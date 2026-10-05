/**
 * Shared OpenClawApi client for roam-backend.
 *
 * Every call carries:
 *   - Authorization: Bearer <OPENCLAW_SERVICE_SECRET>  (service identity)
 *   - x-user-id, x-org-id, x-user-role                 (end-user identity)
 *
 * OpenClawApi's middleware rejects non-public calls without the bearer.
 * The trusted identity headers are only trusted *because* the bearer
 * validated — roam-backend is the only place that mints them, after
 * verifying the caller's JWT via requireAuth.
 */
import type { AuthUser } from "../middleware/auth";
import { env } from "../config/env";

export interface ProxyResult<T = any> {
  status: number;
  data: T;
}

function buildUrl(path: string): string {
  const base = env.OPENCLAW_API_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function buildHeaders(user?: AuthUser, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  if (env.OPENCLAW_SERVICE_SECRET) {
    headers["Authorization"] = `Bearer ${env.OPENCLAW_SERVICE_SECRET}`;
  }
  if (user) {
    headers["x-user-id"] = user.userId;
    if (user.orgId) headers["x-org-id"] = user.orgId;
    if (user.role) headers["x-user-role"] = user.role;
  }
  return headers;
}

/**
 * JSON-in, JSON-out proxy call. Use for normal REST endpoints.
 * Returns {status, data}; data is parsed JSON when possible, else `{raw: text}`.
 */
export async function callOpenClaw(
  path: string,
  method: string,
  opts: { user?: AuthUser; body?: unknown; query?: Record<string, string | undefined> } = {}
): Promise<ProxyResult> {
  let url = buildUrl(path);
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const init: RequestInit = {
    method,
    headers: buildHeaders(opts.user),
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

/**
 * Streaming proxy — returns the raw Response so the caller can pipe
 * body chunks back to the browser (SSE, long chat streams, downloads).
 */
export async function streamOpenClaw(
  path: string,
  method: string,
  opts: { user?: AuthUser; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Response> {
  const url = buildUrl(path);
  const init: RequestInit = {
    method,
    headers: buildHeaders(opts.user, opts.headers),
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }
  return fetch(url, init);
}
