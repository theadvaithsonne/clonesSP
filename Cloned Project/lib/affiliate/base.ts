// Shared base for the ported 1Network (affiliate) feature.
//
// Every affiliate/feed/org call targets Garage (roam-backend, test.garage.app),
// NOT NetworkChains' own backend. NC and Garage share JWT secret + user DB, so
// the user's NC token is accepted there directly (same pattern already used by
// lib/api/garage.ts → fetchMyAffiliateId). This `api()` mirrors the Garage
// app's lib/api.ts helper so the ported components/hooks need only an import
// swap (`@/lib/api` → `@/lib/affiliate/base`).

import * as Sentry from "@sentry/nextjs";
import { getToken, getAdminToken } from "@/lib/auth";

export const GARAGE_API_URL =
  process.env.NEXT_PUBLIC_GARAGE_API_URL || "https://test.garage.app";

export async function api<T>(
  path: string,
  opts: RequestInit = {},
  token?: string,
): Promise<T> {
  // Order matters: an explicit `token` arg wins, then the consumer session
  // (unaffected — this is what every consumer affiliate caller already has),
  // and only when NEITHER exists do we fall back to the garage-admin
  // console's token. The admin console (e.g. the funnel CTA product picker)
  // has no consumer session at all, so without this fallback these requests
  // go out with no Authorization header. The backend now accepts the
  // garage-admin token on these routes, mapping it to the admin's own user
  // record (garagenew-backend 4aeb61dc).
  const auth = token ?? getToken() ?? getAdminToken() ?? undefined;

  const isFormData = opts.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  };
  if (!isFormData) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${GARAGE_API_URL}${path}`, {
      ...opts,
      headers: { ...headers, ...((opts.headers as Record<string, string>) || {}) },
      cache: "no-store",
    });
  } catch (err) {
    // Network/timeout failure (no response) — genuine failure.
    Sentry.captureException(err, { tags: { feature: "affiliate", action: "request" } });
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    let msg = `Server error (${res.status})`;
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || msg;
    } catch {}
    if (res.status >= 500) {
      Sentry.captureException(new Error(msg), {
        tags: { feature: "affiliate", action: "request" },
        contexts: { http: { url: `${GARAGE_API_URL}${path}`, method: opts.method, status_code: res.status } },
      });
    }
    throw new Error(msg);
  }
  return res.json();
}
