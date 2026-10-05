"use client";

/**
 * Auth for the ported NetworkChains admin pages.
 *
 * These pages talk to contacts-backend (backend.networkchains.com), NOT the
 * Garage backend, and they need an NC admin token rather than the Garage admin
 * session token. We obtain one by silently exchanging the Garage token at
 * POST /admin/auth/elevate-garage — no second login, no OTP gate.
 *
 * NEXT_PUBLIC_NC_API_URL is deliberately its own variable: in this app
 * NEXT_PUBLIC_API_URL points at garagenew-backend, so reading it here would send
 * every NC admin call to the wrong backend and 404 silently.
 */

export const NC_API_URL =
  process.env.NEXT_PUBLIC_NC_API_URL ?? "https://backend.networkchains.com";

const NC_TOKEN_KEY = "nc_admin_token";
const GARAGE_TOKEN_KEY = "garage_admin_token";

/** Thrown when an NC admin request returns 401 after a re-elevation attempt. */
export class NcAdminUnauthorizedError extends Error {
  constructor(message = "NetworkChains admin session expired") {
    super(message);
    this.name = "NcAdminUnauthorizedError";
  }
}

/** Generic NC admin API error carrying the HTTP status for UI mapping. */
export class NcAdminApiError extends Error {
  status: number;
  /**
   * Raw `detail` field from the parsed response body, when present (e.g.
   * PostHog's own rejection message on `posthog_upstream`). Purely additive —
   * `message`/`status` keep their existing semantics, since callers like
   * `admin-sentry.ts` match on `e.message` exactly.
   */
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "NcAdminApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function getNcAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NC_TOKEN_KEY);
}

export function setNcAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NC_TOKEN_KEY, token);
}

export function clearNcAdminToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(NC_TOKEN_KEY);
}

/**
 * Result of a garage-token elevation attempt. "unauthorized" means the
 * operator holds no NetworkChains page in the Garage permission editor (or is
 * no longer an active admin) — render the refusal panel. This is also what a
 * hand-typed /garage-admin/networkchains URL hits when the sidebar has
 * correctly hidden the section. "unavailable" means we couldn't tell (network error, non-401/403
 * failure, malformed body, or no garage session to elevate from) — render a
 * retry state, not a refusal.
 */
export type NcElevationResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

/** In-flight elevation, so N parallel hooks trigger one request, not N. */
let elevating: Promise<NcElevationResult> | null = null;

async function elevate(): Promise<NcElevationResult> {
  if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
  const garageToken = window.localStorage.getItem(GARAGE_TOKEN_KEY);
  if (!garageToken) return { ok: false, reason: "unavailable" };
  try {
    const res = await fetch(`${NC_API_URL}/admin/auth/elevate-garage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${garageToken}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "unauthorized" };
    }
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const json = (await res.json().catch(() => ({}))) as { token?: string };
    if (!json.token) return { ok: false, reason: "unavailable" };
    setNcAdminToken(json.token);
    return { ok: true, token: json.token };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Cached NC admin token, elevating from the Garage session if absent.
 * Resolves `{ ok: false, reason: "unauthorized" }` when the operator is not an
 * allowlisted garage-super-admin — callers render the not-authorised panel
 * rather than an OTP gate. Resolves `{ ok: false, reason: "unavailable" }` when
 * elevation could not be completed for any other reason (network error,
 * backend outage, malformed response, missing garage session) — callers
 * should offer retry rather than claim the operator lacks access.
 */
export async function ensureNcAdminToken(): Promise<NcElevationResult> {
  const existing = getNcAdminToken();
  if (existing) return { ok: true, token: existing };
  if (!elevating) {
    elevating = elevate().finally(() => {
      elevating = null;
    });
  }
  return elevating;
}

async function call(path: string, init: RequestInit, token: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${NC_API_URL}${path}`, {
    ...init,
    headers,
  });
}

// Note: `result.ok` uses a boolean-literal discriminant, which this repo's
// non-strict tsconfig (`strict: false` -> `strictNullChecks: false`) does not
// narrow via plain `if (!result.ok)` checks. An explicit type predicate keeps
// the narrowing correct regardless of that setting.
function isElevationFailure(
  result: NcElevationResult
): result is { ok: false; reason: "unauthorized" | "unavailable" } {
  return result.ok === false;
}

function unauthorizedOrUnavailable(result: { ok: false; reason: "unauthorized" | "unavailable" }): Error {
  return result.reason === "unauthorized"
    ? new NcAdminUnauthorizedError("Not authorised for NetworkChains admin")
    : new NcAdminApiError("NetworkChains admin service unavailable", 503);
}

/** Authed request with one-shot re-elevation on 401. */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let result = await ensureNcAdminToken();
  if (isElevationFailure(result)) throw unauthorizedOrUnavailable(result);
  let token = result.token;

  let res = await call(path, init, token);
  if (res.status === 401) {
    // Expired or revoked: drop it, elevate once more, retry once. A second 401
    // is terminal — never loop.
    clearNcAdminToken();
    result = await ensureNcAdminToken();
    if (isElevationFailure(result)) throw unauthorizedOrUnavailable(result);
    token = result.token;
    res = await call(path, init, token);
    if (res.status === 401) {
      clearNcAdminToken();
      throw new NcAdminUnauthorizedError();
    }
  }
  return res;
}

/** Authed request returning the `data` field of contacts-backend's envelope. */
export async function ncAdminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init);
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: T;
    error?: string;
    detail?: string;
  };
  if (!res.ok || json.ok === false || json.data === undefined) {
    throw new NcAdminApiError(json.error || `Request failed (${res.status})`, res.status, json.detail);
  }
  return json.data;
}

/** Authed request returning the raw body — for endpoints with no envelope. */
export async function ncAdminFetchRaw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init);
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!res.ok) {
    throw new NcAdminApiError(json?.error || `Request failed (${res.status})`, res.status, json?.detail);
  }
  return json;
}
