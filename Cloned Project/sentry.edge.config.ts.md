# `sentry.edge.config.ts`

> Sentry SDK setup for the Next.js **edge runtime**: it calls `Sentry.init` with the DSN, environment, PII, trace sampling and console-error capture settings.

**Kind:** project config / root file · **Lines:** 15

## Purpose
Next.js runs code in two server runtimes, Node.js and edge. Each one needs its own Sentry initialisation. This file covers the edge runtime, which in this project mainly means `middleware.ts` (the host-based rewrites) and any route that opts into `runtime = "edge"`. It does nothing when imported on its own: `instrumentation.ts` loads it from `register()` only when `NEXT_RUNTIME === "edge"`.

## How it works
- The DSN comes from `SENTRY_DSN`, falling back to `NEXT_PUBLIC_SENTRY_DSN`. `enabled: Boolean(dsn)` keeps the SDK switched off until a DSN is set, so local or unconfigured environments send nothing.
- `environment` is `SENTRY_ENV`, falling back to `NODE_ENV`.
- `sendDefaultPii: true` attaches request and user data (for example IP and headers) to events.
- Every error is sent (no error sampling). `tracesSampleRate: 0.1` keeps 10% of performance traces.
- `captureConsoleIntegration({ levels: ["error"] })` turns every `console.error(...)` in edge code into a Sentry issue. A source comment explains that `extraErrorDataIntegration` is Node-only, so it is left out here.
- This file has no `Sentry.getClient()` guard. Its sibling `sentry.server.config.ts` has one, because under the combined server (`server/main.ts`) the backend has already initialised Sentry in the same Node process. The edge runtime is a separate isolate with no backend client in it, so initialising unconditionally is fine.

## Exports
None. The file is imported only for its side effect (`Sentry.init`).

## Interfaces
- **Environment variables:** `SENTRY_DSN` - server-side DSN (preferred); `NEXT_PUBLIC_SENTRY_DSN` - fallback DSN; `SENTRY_ENV` - environment tag; `NODE_ENV` - fallback environment tag.
- **External services:** Sentry (error and trace ingestion).

## Dependencies
- **Packages:** `@sentry/nextjs` - provides `init` and `captureConsoleIntegration`.

## Used by
- `instrumentation.ts` - `register()` dynamically imports it when `process.env.NEXT_RUNTIME === "edge"`. Next.js calls `register()` once when each runtime starts.

## Notes
- Keep the settings in step with `sentry.server.config.ts` (Node runtime) and `instrumentation-client.ts` (browser). The DSN, environment, sample rate and console-capture choices match across the three files.
- `sendDefaultPii: true` means personal data reaches Sentry. Review it if data-protection requirements change.
