# `server/instrument.ts`

> A side-effect-only module that sets up Sentry error tracking for the backend. It must load before Express, HTTP or Mongoose so Sentry's auto-instrumentation can hook those libraries.

**Kind:** backend module · **Lines:** 47

## Purpose
Sentry for Node patches libraries when they are first required. To catch Express, HTTP and Mongo activity, this file must be the first import in each backend entry point: `import "./instrument"` appears on line 2 of `server/index.ts` and before the http, Express and Mongoose imports in `server/main.ts`. When `SENTRY_DSN` is unset, Sentry is created with `enabled: false`, so the backend can be deployed without reporting anything.

## How it works
`Sentry.init` is called with:
- `dsn: env.SENTRY_DSN || undefined` and `enabled: Boolean(env.SENTRY_DSN)`.
- `environment: env.SENTRY_ENV || env.NODE_ENV`.
- `sendDefaultPii: true`. Events include the request body, query, headers and user.
- `tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE` (defaults to 0.1 in `server/config/env.ts`).
- `captureConsoleIntegration({ levels: ["error"] })`, added on top of the SDK defaults. Most route `catch` blocks only call `console.error(..., err)`, so this turns handled errors into Sentry issues without editing each handler.

`beforeSend` filters and cleans each event:
1. **Redacts admin verification answers.** If the request body is an object with an `answer` field, `answer` is replaced with `"[redacted]"`. If the body is a string and the URL matches `/garage-admin/verify`, the whole body is redacted. Without this, the secret answer that the admin-verify flow hashes would reach Sentry in plain text.
2. **Drops console noise.** An event from the console integration (`event.logger === "console"`) is discarded unless it carries a real `Error` or an exception.
3. **Drops process warnings.** Node warnings matching `(node:<pid>) [` and Mongoose `[MONGOOSE] Warning` messages are discarded.

## Exports
None. The module is imported only for its side effect.

## Interfaces
- **External services:** Sentry, through the DSN.
- **Environment variables (via `env`):** `SENTRY_DSN` - turns reporting on; `SENTRY_ENV` - environment tag; `NODE_ENV` - fallback environment tag; `SENTRY_TRACES_SAMPLE_RATE` - fraction of transactions traced.

## Dependencies
- **Internal:** `server/config/env.ts` - Sentry settings.
- **Packages:** `@sentry/node` - the SDK.

## Used by
- `server/index.ts` and `server/main.ts`, both as their first import. The frontend's Sentry setup is separate (`sentry.*.config.ts` and `instrumentation*.ts` at the repository root).

## Notes
- `sendDefaultPii: true` sends request bodies to Sentry. Only the admin `answer` field is redacted, so other sensitive fields (OTPs, passwords, payment data) in a failing request's body may still reach Sentry.
- Because every `console.error` that carries an `Error` becomes an issue, noisy error logging adds directly to the Sentry quota.
- Importing `server/config/env.ts` this early means `env` is evaluated before anything else in the backend.
