/**
 * Generic OpenClawApi pass-through.
 *
 * Frontend calls `/openclaw-proxy/api/<whatever>` → this handler forwards
 * to `${OPENCLAW_API_URL}/api/<whatever>` with the shared service secret
 * and the authenticated user's identity headers attached.
 *
 * Guardrails:
 *   - requireAuth: rejects anything without a valid Garage JWT
 *   - Path must start with `/api/` on the target side. Anything else 404s.
 *   - No body transformation — JSON, form data, binary all pass through
 *   - Response is streamed back as-is (Content-Type preserved) so SSE and
 *     file downloads work without buffering
 *
 * For routes that need custom logic (agent-id resolution, session
 * storage side-effects, public-unauthenticated access) keep an explicit
 * route file alongside this catch-all. The explicit handler wins because
 * Express matches it first.
 */
import { Router, Request, Response as ExpressResponse } from "express";
import { Readable } from "stream";
import { requireAuth } from "../middleware/auth";
import { env } from "../config/env";

const router = Router();

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
  // Strip the user's JWT — service calls use the shared secret instead.
  "authorization",
  // Don't double-inject identity headers if the client tried to spoof them.
  "x-user-id",
  "x-org-id",
  "x-user-role",
]);

function buildUpstreamHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (value === undefined) continue;
    out[name] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  if (env.OPENCLAW_SERVICE_SECRET) {
    out["authorization"] = `Bearer ${env.OPENCLAW_SERVICE_SECRET}`;
  }
  const user = (req as any).user;
  if (user) {
    out["x-user-id"] = user.userId;
    if (user.orgId) out["x-org-id"] = user.orgId;
    if (user.role) out["x-user-role"] = user.role;
  }
  return out;
}

router.use(requireAuth);

router.all(/.*/, async (req: Request, res: ExpressResponse) => {
  // req.path is whatever came after the /openclaw-proxy mount prefix.
  // We only allow forwarding under /api/* on the OpenClawApi side —
  // anything else is almost certainly a mistake.
  if (!req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not a proxyable OpenClawApi path" });
  }

  const base = env.OPENCLAW_API_URL.replace(/\/+$/, "");
  const qs = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";
  const url = `${base}${req.path}${qs}`;

  // Body handling:
  //   - JSON was already parsed by express.json() → re-serialize
  //   - Anything else (multipart, raw) wasn't parsed → pipe req directly
  let body: BodyInit | undefined;
  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  if (hasBody) {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    if (ct.includes("application/json") && req.body && typeof req.body === "object") {
      body = JSON.stringify(req.body);
    } else if (req.readable) {
      body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    }
  }

  const init: RequestInit = {
    method,
    headers: buildUpstreamHeaders(req),
  };
  if (body !== undefined) {
    init.body = body;
    // Node's fetch requires duplex: 'half' when streaming a request body.
    (init as any).duplex = "half";
  }

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    console.error(`[openclaw-proxy] fetch failed for ${method} ${url}:`, err);
    return res.status(502).json({ error: "OpenClawApi unreachable" });
  }

  // Mirror status + relevant headers back to the client.
  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    res.setHeader(key, value);
  });

  if (!upstream.body) {
    return res.end();
  }
  // Stream the body through — preserves SSE, large downloads, etc.
  const nodeStream = Readable.fromWeb(upstream.body as any);
  nodeStream.pipe(res);
  nodeStream.on("error", (err) => {
    console.error("[openclaw-proxy] upstream stream error:", err);
    if (!res.headersSent) res.status(502);
    res.end();
  });
});

export default router;
