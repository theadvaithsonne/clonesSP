// ============================================================
// PostHog Node.js client — server-side analytics for Garage
// ============================================================
//
// Ported from the NC contacts-backend setup (see
// /Volumes/cache/networkchain/contacts-backend/src/lib/posthog.ts).
// Same safety profile:
//   - If POSTHOG_KEY is unset, the module logs a warning and every
//     capture call becomes a no-op. That means deploying this file
//     without setting the env var is completely inert — no lag, no
//     hang, no network traffic.
//   - Batched flush (20 events / 3 s) so hot-path events don't take
//     a sync HTTP latency tax.
//   - captureServer / captureServerException are void: callers do
//     NOT await them. Fire-and-forget by design.

import { PostHog } from "posthog-node";

const POSTHOG_KEY = process.env.POSTHOG_KEY;
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

let client: PostHog | null = null;

if (POSTHOG_KEY) {
  try {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // Batched flush — 20 events or 3 s, whichever comes first.
      flushAt: 20,
      flushInterval: 3000,
    });
    console.log("[posthog] server-side client initialized");
  } catch (err) {
    // Constructor errors would be exotic (SDK bug) but we swallow so
    // an analytics-only misconfig can never crash the API surface.
    console.error("[posthog] init failed — analytics disabled:", err);
    client = null;
  }
} else {
  console.warn(
    "[posthog] POSTHOG_KEY missing — server-side analytics disabled",
  );
}

/**
 * Resolve a distinct_id for a server-side event.
 * Priority:
 *  1. Authenticated user id
 *  2. `x-posthog-distinct-id` header forwarded by the frontend
 *     (anonymous id — kept stable across page loads by localStorage)
 *  3. Email (last-resort — e.g. an OTP request from a brand-new
 *     visitor who doesn't have a userId yet)
 */
export function resolveDistinctId(opts: {
  userId?: string;
  headerDistinctId?: string | string[];
  fallbackEmail?: string;
}): string {
  if (opts.userId) return opts.userId;
  const hdr = Array.isArray(opts.headerDistinctId)
    ? opts.headerDistinctId[0]
    : opts.headerDistinctId;
  if (hdr) return hdr;
  if (opts.fallbackEmail) return `email:${opts.fallbackEmail}`;
  return "anonymous";
}

export function captureServer(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): void {
  if (!client) return;
  try {
    client.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: { app: "garage-backend", ...args.properties },
    });
  } catch (err) {
    // Analytics must never break the request path.
    console.error("[posthog] capture failed:", err);
  }
}

export function captureServerException(args: {
  distinctId: string;
  error: unknown;
  properties?: Record<string, unknown>;
}): void {
  if (!client) return;
  try {
    const err =
      args.error instanceof Error
        ? args.error
        : new Error(String(args.error));
    client.captureException(err, args.distinctId, {
      app: "garage-backend",
      ...args.properties,
    });
  } catch (err) {
    console.error("[posthog] captureException failed:", err);
  }
}

/** Alias flow — call after a user identifies (login success) so the
 *  pre-signup anonymous events merge with the new user_id. */
export function aliasUser(args: {
  distinctId: string;
  alias: string;
}): void {
  if (!client) return;
  try {
    client.alias({ distinctId: args.distinctId, alias: args.alias });
  } catch (err) {
    console.error("[posthog] alias failed:", err);
  }
}

/** Called on SIGTERM/SIGINT. Waits at most 3 s so a slow/unreachable
 *  PostHog can't block a clean pm2 restart. */
export async function shutdownPostHog(): Promise<void> {
  if (!client) return;
  try {
    await Promise.race([
      client.shutdown(),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch (err) {
    console.error("[posthog] shutdown failed:", err);
  }
}

export default client;
