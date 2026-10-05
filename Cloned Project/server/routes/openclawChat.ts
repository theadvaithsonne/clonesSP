/**
 * Chat entry point that supersedes the Next.js /api/openclaw/chat route.
 *
 * Two branches:
 *   - Personal agent (personalAgentId + userId present):
 *     POST /api/chat on OpenClawApi (SSE). We drain the SSE into a single
 *     `{ response, agentId }` JSON reply so the frontend doesn't have to
 *     change its consumption shape.
 *   - Shared agent (no personalAgentId):
 *     POST /v1/chat/completions on the OpenClaw gateway with agent_id
 *     resolved via env-var email map / default.
 *
 * Both branches support JSON and multipart (file upload) bodies. File
 * uploads are only meaningful on the personal-agent branch.
 */
import { Router, Request, Response as ExpressResponse } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { env } from "../config/env";

const router = Router();

// Memory storage — we forward the buffer straight to OpenClawApi as
// multipart. Cap at 50 MB per file, total 200 MB per request.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

type AgentMap = Map<string, string>;
let _cachedMap: AgentMap | null = null;
function userAgentMap(): AgentMap {
  if (_cachedMap) return _cachedMap;
  const map: AgentMap = new Map();
  const raw = env.OPENCLAW_USER_AGENT_MAP;
  if (raw.trim()) {
    for (const pair of raw.split(",")) {
      const i = pair.indexOf(":");
      if (i === -1) continue;
      const email = pair.slice(0, i).trim().toLowerCase();
      const agentId = pair.slice(i + 1).trim();
      if (email && agentId) map.set(email, agentId);
    }
  }
  _cachedMap = map;
  return map;
}

function resolveAgentId(personalAgentId?: string | null, userEmail?: string | null): string {
  if (personalAgentId?.trim()) return personalAgentId.trim();
  if (userEmail) {
    const hit = userAgentMap().get(userEmail.toLowerCase());
    if (hit) return hit;
  }
  return env.OPENCLAW_DEFAULT_AGENT_ID;
}

// Drain an SSE stream from OpenClawApi into a single concatenated reply.
async function drainSse(upstream: globalThis.Response): Promise<string> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const dataStr = trimmed.slice(6).trim();
      if (dataStr === "[DONE]") break outer;
      try {
        const data = JSON.parse(dataStr);
        const delta = data?.choices?.[0]?.delta?.content;
        if (delta) reply += delta;
      } catch {
        /* skip malformed */
      }
    }
  }
  return reply;
}

function serviceHeaders(user?: { userId: string; orgId?: string; role?: string }): Record<string, string> {
  const h: Record<string, string> = {};
  if (env.OPENCLAW_SERVICE_SECRET) h["authorization"] = `Bearer ${env.OPENCLAW_SERVICE_SECRET}`;
  if (user) {
    h["x-user-id"] = user.userId;
    if (user.orgId) h["x-org-id"] = user.orgId;
    if (user.role) h["x-user-role"] = user.role;
  }
  return h;
}

async function callPersonalAgentSse(
  body: Record<string, unknown>,
  user: any,
): Promise<globalThis.Response> {
  const url = `${env.OPENCLAW_API_URL.replace(/\/+$/, "")}/api/chat`;
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...serviceHeaders(user),
    },
    body: JSON.stringify(body),
  });
}

async function callPersonalAgentMultipart(
  form: FormData,
  user: any,
): Promise<globalThis.Response> {
  const url = `${env.OPENCLAW_API_URL.replace(/\/+$/, "")}/api/chat`;
  return fetch(url, {
    method: "POST",
    headers: serviceHeaders(user),
    body: form,
  });
}

async function callSharedAgentGateway(
  agentId: string,
  messages: any[],
): Promise<globalThis.Response> {
  return fetch(`${env.OPENCLAW_GATEWAY_URL.replace(/\/+$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENCLAW_GATEWAY_TOKEN}`,
      "content-type": "application/json",
      "x-openclaw-agent-id": agentId,
    },
    body: JSON.stringify({
      model: `openclaw:${agentId}`,
      messages,
      stream: true,
    }),
  });
}

// POST /openclaw-chat — JSON or multipart
router.post(
  "/",
  requireAuth,
  upload.array("files"),
  async (req: Request, res: ExpressResponse) => {
    try {
      const contentType = (req.headers["content-type"] || "").toLowerCase();
      const isMultipart = contentType.includes("multipart/form-data");
      const user = (req as any).user;

      if (isMultipart) {
        const fields = req.body as Record<string, string>;
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const message = fields.message || "";
        const userEmail = fields.userEmail || null;
        const userId = fields.userId || user?.userId;
        const personalAgentId = fields.personalAgentId || null;
        const sessionId = fields.sessionId || null;
        const model = fields.model || null;

        if (!message && files.length === 0) {
          return res.status(400).json({ error: "Message or file is required" });
        }
        if (!personalAgentId?.trim() || !userId) {
          return res.status(400).json({ error: "File uploads require a personal agent" });
        }

        let history: { role: string; content: string }[] = [];
        if (fields.history) {
          try {
            history = JSON.parse(fields.history);
          } catch {
            /* ignore */
          }
        }

        const agentId = resolveAgentId(personalAgentId, userEmail);

        const form = new FormData();
        form.append("message", message || "Please process the attached file.");
        form.append("agent_id", agentId);
        form.append("user_id", userId);
        if (sessionId) form.append("session_id", sessionId);
        if (model) form.append("model", model);
        if (history.length) form.append("history", JSON.stringify(history));
        for (const f of files) {
          form.append("files", new Blob([new Uint8Array(f.buffer)], { type: f.mimetype }), f.originalname);
        }

        const upstream = await callPersonalAgentMultipart(form, user);
        if (!upstream.ok) {
          const errText = await upstream.text();
          let detail: any;
          try {
            detail = JSON.parse(errText);
          } catch {
            detail = { error: errText };
          }
          return res.status(upstream.status).json({
            error: detail?.detail || detail?.error || `Agent Manager returned ${upstream.status}`,
            code: upstream.status,
          });
        }
        const reply = await drainSse(upstream);
        return res.json({ response: reply, agentId });
      }

      // JSON path
      const { message, history = [], userEmail, userId, personalAgentId, sessionId, model } = (req.body ?? {}) as {
        message?: string;
        history?: { role: string; content: string }[];
        userEmail?: string;
        userId?: string;
        personalAgentId?: string;
        sessionId?: string;
        model?: string;
      };

      if (!message?.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      const effectiveUserId = userId || user?.userId;
      const agentId = resolveAgentId(personalAgentId, userEmail);

      if (personalAgentId?.trim() && effectiveUserId) {
        const upstream = await callPersonalAgentSse(
          {
            message,
            agent_id: agentId,
            user_id: effectiveUserId,
            ...(sessionId ? { session_id: sessionId } : {}),
            ...(model ? { model } : {}),
          },
          user,
        );
        if (!upstream.ok) {
          const errText = await upstream.text();
          let detail: any;
          try {
            detail = JSON.parse(errText);
          } catch {
            detail = { error: errText };
          }
          return res.status(upstream.status).json({
            error: detail?.detail || detail?.error || `Agent Manager returned ${upstream.status}`,
            code: upstream.status,
          });
        }
        const reply = await drainSse(upstream);
        return res.json({ response: reply, agentId });
      }

      // Shared agent via gateway
      const messages = [...history, { role: "user", content: message }];
      const upstream = await callSharedAgentGateway(agentId, messages);
      if (!upstream.ok) {
        const errText = await upstream.text();
        console.error("[openclaw-chat] gateway error:", upstream.status, errText);
        return res.status(502).json({ error: `OpenClaw gateway returned ${upstream.status}` });
      }
      const reply = await drainSse(upstream);
      return res.json({ response: reply, agentId });
    } catch (err) {
      console.error("[openclaw-chat] error:", err);
      return res.status(502).json({ error: "Failed to reach OpenClaw" });
    }
  },
);

export default router;
