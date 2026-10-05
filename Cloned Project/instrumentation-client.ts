import * as Sentry from "@sentry/nextjs";

// This repo serves TWO products from one bundle: my.garage.app (the member
// app) and admin.garage.app (the admin console). Host is the real signal in
// production; the pathname covers dev and previews, where the console is
// reached at /garage-admin on whatever host the branch is served from.
const isAdminSurface =
  typeof window !== "undefined" &&
  (window.location.hostname === "admin.garage.app" ||
    window.location.pathname.startsWith("/garage-admin"));

// Public browser DSN — set NEXT_PUBLIC_SENTRY_DSN to the garage-web Sentry
// project. No-ops until it's set, so this is safe to ship dark.
//
// NEXT_PUBLIC_SENTRY_DSN_ADMIN is optional: set it to a separate project's DSN
// and the console's errors file there instead, which is what gives the Admin
// App tab a web project alongside its mobile one. Left unset, both surfaces
// report to the one project and the `surface` tag below is how you tell them
// apart (search `surface:garage-admin-web`).
//
// Worth knowing before enabling it: the Sentry webpack plugin uploads source
// maps to ONE project, so the second project gets minified stack traces until
// the same maps are also uploaded to it (a `sentry-cli sourcemaps upload
// --project garage-admin-web` step after the build).
const adminDsn = process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN;
const dsn =
  isAdminSurface && adminDsn ? adminDsn : process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: true,
  // Tracing OFF for now (avoids sentry-trace/baggage headers on API fetches →
  // CORS-preflight risk). Add later if needed.
  tracesSampleRate: 0,
  // Session replay: error-linked only (no continuous recording) and masked —
  // this is a user-data app. Only ~10% of error sessions upload a replay.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
    // Turn every console.error(...) catch block into an issue.
    Sentry.captureConsoleIntegration({ levels: ["error"] }),
    // Keep extra props on thrown objects (err.response, err.code, …).
    Sentry.extraErrorDataIntegration({ depth: 5 }),
  ],
  ignoreErrors: [
    /ResizeObserver loop (limit exceeded|completed)/i,
    "Non-Error promise rejection captured with value: undefined",
    // ── Transient client-side noise, not server bugs ─────────────────────────
    // These are console.error'd by the app on flaky networks / expired tokens
    // and turned into issues by captureConsoleIntegration. They aren't
    // actionable (the backend is fine; individual clients drop connections),
    // so drop them at the propagator instead of paging on them.
    "Failed to fetch", // TypeError on any dropped/cancelled/offline fetch
    "Load failed", // Safari's equivalent
    "NetworkError when attempting to fetch", // Firefox's equivalent
    "Failed to connect to API", // our lib/api wrapper's message
    "Please check if the server is running", // ditto
    "connect_error", // Socket.IO connect retries ("[CLIENT] connect_error timeout/xhr poll error")
    "Invalid token", // expired/invalid JWT → redirect to /login (normal churn)
  ],
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//],
});

// Which surface an issue came from, so the two are separable even while they
// share a project. Set after init so it lands on every event.
Sentry.setTag("surface", isAdminSurface ? "garage-admin-web" : "garage-web");

// App Router navigation instrumentation (no-op without tracing; kept for the hook).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
