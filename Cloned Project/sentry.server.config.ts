import * as Sentry from "@sentry/nextjs";

// Under the combined server (server/main.ts) the backend's server/instrument.ts
// has already initialised Sentry for this Node process. A second init would
// replace that client and install the OpenTelemetry hooks twice, so server-side
// Next.js errors report through the backend's client instead (same SENTRY_DSN).
// `next dev` / `next start` / Vercel have no backend in-process and init here.
if (!Sentry.getClient()) {
  // Server DSN — SENTRY_DSN (or the public one as fallback). No-op until set.
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: true,
    // Errors unsampled; only perf traces sampled to protect the tracing quota.
    tracesSampleRate: 0.1,
    integrations: [
      // Every server-side console.error(...) → an issue (API routes, server
      // actions, RSC catch blocks that log instead of throw).
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
      Sentry.extraErrorDataIntegration({ depth: 5 }),
    ],
  });
}
