# `next.config.ts`

> The Next.js build and runtime configuration, wrapped with Sentry's `withSentryConfig` so builds can upload source maps.

**Kind:** project config / root file · **Lines:** 33

## Purpose
Next.js reads this file whenever it compiles or serves the frontend: `next build` via `npm run build:web`, and the dev server and production handler that `server/main.ts` creates with `next({ dir: ROOT_DIR, ... })`. It turns off a few build-time checks, configures images, strips console logging from production bundles, and adds the Sentry build plugin.

## How it works
- `images: { unoptimized: true }` - `next/image` serves images as-is, with no optimisation pipeline.
- `reactStrictMode: true`.
- `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` - a build succeeds even with type or lint errors. The repo has never been tsc-clean, so build success says nothing about type correctness.
- `compiler.removeConsole` - when `NODE_ENV === "production"`, every `console.*` call except `console.error` and `console.warn` is removed from the bundles. The comment gives the reason: besides the noise, Sentry's console breadcrumbs keep references to large logged objects, such as whole BAT246 boards. In development nothing is removed.
- The default export is `withSentryConfig(nextConfig, {...})`:
  - `org`, `project` and `authToken` come from the environment.
  - `silent: !process.env.CI` keeps Sentry output quiet outside CI.
  - `widenClientFileUpload: true` uploads more client source maps.
  - `disableLogger: true` removes Sentry's own debug logger.
  - The comment says source-map upload is skipped when no auth token is set, so builds still succeed without it.

## Exports
- `default` - the Sentry-wrapped `NextConfig` object.

## Interfaces
- **Environment variables:**
  - `NODE_ENV` - turns on `removeConsole`.
  - `SENTRY_ORG`, `SENTRY_PROJECT` - Sentry target for the upload.
  - `SENTRY_AUTH_TOKEN` - Sentry upload credential. The value is read from the environment and is not in this file.
  - `CI` - controls Sentry's log output.
- **External services:** Sentry, for source-map upload at build time.

## Dependencies
- **Packages:** `next` - the `NextConfig` type. `@sentry/nextjs` - `withSentryConfig`.

## Used by
Nothing imports it; Next.js loads it by convention. It applies to `npm run build:web` (`next build --turbopack`) and to the Next instance that `server/main.ts` starts for `npm run dev` and `npm start`. The runtime Sentry setup is in `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts` and `sentry.edge.config.ts`.

## Notes
- Because `removeConsole` strips `console.log` and `console.info` in production, debug logs show up only in development. Use `console.warn` or `console.error` for anything that must stay visible in production.
- The line `reactStrictMode: true` has odd indentation. That is cosmetic only.
