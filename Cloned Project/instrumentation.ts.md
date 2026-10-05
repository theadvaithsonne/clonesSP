# `instrumentation.ts`

> Next.js server instrumentation hook that loads the right Sentry config for the Node.js or Edge runtime and reports errors thrown during requests.

**Kind:** project config / root file · **Lines:** 14

## Purpose
Next.js calls the `register()` export of a root-level `instrumentation.ts` once when a server instance starts. This file uses that hook to start Sentry on the server side of the Next.js app. It loads only the config that matches the current runtime, so Edge bundles never pull in Node-only Sentry code. Browser-side Sentry is set up separately in `instrumentation-client.ts`.

## How it works
- `register()` checks `process.env.NEXT_RUNTIME`:
  - `"nodejs"`: dynamically imports `./sentry.server.config`. Under the combined server (`server/main.ts`), the backend's `server/instrument.ts` has already started Sentry for the process. In that case `sentry.server.config.ts` finds an existing client (`Sentry.getClient()`) and does not start a second one, so Next.js server errors report through the backend's client. Under `next dev`, `next start` or Vercel there is no backend in the process, and the config starts Sentry itself.
  - `"edge"`: dynamically imports `./sentry.edge.config`, which starts the Edge-compatible SDK (used by `middleware.ts` and any edge routes).
- `onRequestError` is Sentry's `captureRequestError`. Next.js calls it when a nested React Server Component, route handler, server action or middleware throws, and it sends the error to Sentry along with request context.

## Exports
- `register(): Promise<void>` - Next.js startup hook. Loads the Sentry config for the current runtime.
- `onRequestError` - re-export of `captureRequestError` from `@sentry/nextjs`. Reports server-side request errors.

## Interfaces
- **Environment variables:** `NEXT_RUNTIME` (set by Next.js) - picks which config to load. The loaded configs read `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_ENV`.
- **External services:** Sentry.

## Dependencies
- **Internal:** `sentry.server.config.ts` - Node.js-runtime Sentry init (skipped when a client already exists). `sentry.edge.config.ts` - Edge-runtime Sentry init.
- **Packages:** `@sentry/nextjs` - `captureRequestError`.

## Used by
No file imports it. Next.js loads it automatically because of its file name and its place at the project root, both when Next.js runs inside the combined `server/main.ts` process and under the standalone `next` CLI.
