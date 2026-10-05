/**
 * Public Q&A pass-through — unauthenticated.
 *
 * Q&A pages are visitor-facing; there is no Garage JWT. The backend
 * enforces its own per-IP / per-agent rate limiting and visitor-safe
 * error messages. This route is a transport shim that:
 *   - does NOT require auth
 *   - attaches the shared service secret (harmless — OpenClawApi
 *     allowlists /api/public/qa paths, but we include it for consistency
 *     so the same firewall rules work everywhere)
 *   - forwards x-forwarded-for so the backend sees the real visitor IP
 *   - streams SSE bodies back untouched
 */
import { Router, Request, Response as ExpressResponse } from "express";
import { Readable } from "stream";
import { env } from "../config/env";

const router = Router();

function upstreamBase(): string {
  return env.OPENCLAW_API_URL.replace(/\/+$/, "");
}

function forwardedFor(req: Request): string {
  const h =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress;
  if (!h) return "";
  return Array.isArray(h) ? h[0] : String(h);
}

function serviceHeaders(): Record<string, string> {
  if (!env.OPENCLAW_SERVICE_SECRET) return {};
  return { authorization: `Bearer ${env.OPENCLAW_SERVICE_SECRET}` };
}

// POST /openclaw-qa/:agentId/chat — SSE streaming visitor chat
router.post("/:agentId/chat", async (req: Request, res: ExpressResponse) => {
  const { agentId } = req.params;
  const fwd = forwardedFor(req);

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(
      `${upstreamBase()}/api/public/qa/${encodeURIComponent(agentId)}/chat`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(fwd ? { "x-forwarded-for": fwd } : {}),
          ...serviceHeaders(),
        },
        body: JSON.stringify(req.body ?? {}),
      },
    );
  } catch (err) {
    console.error("[openclaw-qa] chat fetch failed:", err);
    return res
      .status(502)
      .json({ detail: "Something went wrong. Please try again." });
  }

  // On non-200 pass the status + body through so the client can surface
  // the visitor-safe message the backend generated.
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      "content-type",
      upstream.headers.get("content-type") || "application/json",
    );
    return res.send(text);
  }

  res.status(200);
  res.setHeader(
    "content-type",
    upstream.headers.get("content-type") || "text/event-stream",
  );
  res.setHeader("cache-control", "no-cache");
  res.setHeader("x-accel-buffering", "no");

  const nodeStream = Readable.fromWeb(upstream.body as any);
  nodeStream.pipe(res);
  nodeStream.on("error", () => {
    if (!res.headersSent) res.status(502);
    res.end();
  });
});

// GET /openclaw-qa/:agentId/info — public agent metadata
router.get("/:agentId/info", async (req: Request, res: ExpressResponse) => {
  const { agentId } = req.params;
  const fwd = forwardedFor(req);

  try {
    const upstream = await fetch(
      `${upstreamBase()}/api/public/qa/${encodeURIComponent(agentId)}/info`,
      {
        method: "GET",
        headers: {
          ...(fwd ? { "x-forwarded-for": fwd } : {}),
          ...serviceHeaders(),
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      "content-type",
      upstream.headers.get("content-type") || "application/json",
    );
    return res.send(text);
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return res.status(504).json({ detail: "Request timed out" });
    }
    return res.status(502).json({ detail: "Assistant unavailable" });
  }
});

export default router;
