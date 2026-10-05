# `instrumentation-client.ts`

> Next.js client instrumentation file that initialises Sentry error reporting (with masked, error-only session replay) in the browser and tags each event with the product surface it came from.

**Kind:** project config / root file · **Lines:** 73

## Purpose
Next.js 15 automatically loads a root-level `instrumentation-client.ts` in the browser before the app becomes interactive. This file uses that hook to start the Sentry browser SDK for the whole frontend. One bundle serves two products, the member app (`my.garage.app`) and the admin console (`admin.garage.app`, or `/garage-admin` in dev and previews), so the file works out which surface is running and can send the two to separate Sentry projects or tag them apart.

## How it works
- **Surface detection (L7-L10):** `isAdminSurface` is true in the browser when the hostname is `admin.garage.app` or the pathname starts with `/garage-admin`. During SSR evaluation (`window` undefined) it is false.
- **DSN choice (L25-L27):** on the admin surface, if `NEXT_PUBLIC_SENTRY_DSN_ADMIN` is set, events go to that project. Otherwise they go to `NEXT_PUBLIC_SENTRY_DSN`. With no DSN set, Sentry stays disabled (`enabled: Boolean(dsn)`), so the file is safe to ship before Sentry is configured.
- **`Sentry.init` options (L29-L65):**
  - `environment`: `NEXT_PUBLIC_SENTRY_ENV`, falling back to `NODE_ENV`.
  - `sendDefaultPii: true`.
  - `tracesSampleRate: 0`. Tracing is deliberately off so the SDK does not add `sentry-trace`/`baggage` headers to API fetches, which could trigger CORS preflights.
  - Replay: no continuous recording (`replaysSessionSampleRate: 0`). About 10% of sessions that hit an error upload a replay (`replaysOnErrorSampleRate: 0.1`). All text and inputs are masked and all media is blocked.
  - Integrations: `replayIntegration`, `captureConsoleIntegration({ levels: ["error"] })` (every `console.error` becomes an issue) and `extraErrorDataIntegration({ depth: 5 })` (keeps extra properties such as `err.response` and `err.code`).
  - `ignoreErrors` drops noise that cannot be acted on: ResizeObserver loop warnings, undefined promise rejections, browser network-failure messages ("Failed to fetch", "Load failed", "NetworkError when attempting to fetch"), the `lib/api` wrapper's "Failed to connect to API" / "Please check if the server is running" messages, Socket.IO `connect_error` retries and "Invalid token" (expired JWTs, which lead to a normal redirect to `/login`).
  - `denyUrls` ignores errors from Chrome, Firefox and Safari extensions.
- **Surface tag (L69):** after init, `Sentry.setTag("surface", ...)` sets `garage-admin-web` or `garage-web`, so you can filter the two surfaces even when they share one project (for example, search `surface:garage-admin-web`).

## Exports
- `onRouterTransitionStart` - set to `Sentry.captureRouterTransitionStart`. Next.js calls it on App Router navigations. With tracing off it does nothing, but it is kept so tracing can be turned on later.

## Interfaces
- **External services:** Sentry (error events and session replays).
- **Environment variables:**
  - `NEXT_PUBLIC_SENTRY_DSN` - main browser DSN (the garage-web project).
  - `NEXT_PUBLIC_SENTRY_DSN_ADMIN` - optional separate DSN for the admin console.
  - `NEXT_PUBLIC_SENTRY_ENV` - Sentry environment name.
  - `NODE_ENV` - fallback environment name.

## Dependencies
- **Packages:** `@sentry/nextjs` - browser SDK init, replay, console capture, extra error data and router-transition hooks.

## Used by
No file imports it. Next.js loads it automatically in the browser because of its file name and its place at the project root. It is the client-side counterpart to `instrumentation.ts`, which handles the server and edge runtimes.

## Notes
- The Sentry webpack plugin (`withSentryConfig` in `next.config.ts`) uploads source maps to only one project. If `NEXT_PUBLIC_SENTRY_DSN_ADMIN` is used, the admin project gets minified stack traces unless the same maps are also uploaded to it, for example with a separate `sentry-cli sourcemaps upload --project garage-admin-web` step (see the comment at L21-L24).
- Because `captureConsoleIntegration` turns every `console.error` into an issue, a new noisy `console.error` in a catch block will show up in Sentry. Add recurring benign messages to `ignoreErrors` rather than leaving them to page people.
- The DSN is a public browser key, read from env. Nothing secret is hardcoded here.
