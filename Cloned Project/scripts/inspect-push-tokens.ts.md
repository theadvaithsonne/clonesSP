# `scripts/inspect-push-tokens.ts`

> Read-only diagnostic script that summarises registered mobile push tokens (`DeviceToken`) by app, platform and active state, optionally listing one user's tokens.

**Kind:** backend helper/test script (connects to the configured DB; read-only in practice) · **Lines:** 107

## Purpose
When push notifications do not arrive on the mobile apps (Garage chat and NetworkChain), the first question is whether the device ever registered a token or whether the backend simply never sends. This script answers that from the database: it prints a breakdown of every row in `DeviceToken`, calls out NetworkChain iOS/Android counts, and can dump a single user's tokens. It is run by hand and imported by nothing.

## How it works
- Loads `.env` (`dotenv.config()`; `server/config/env.ts` also loads `dotenv/config`) and connects to `env.MONGODB_URI` — the **production** database in this project. Throws if the URI is empty.
- Runs an aggregation over `DeviceToken` grouped by `{ app, platform, isActive }` with a row count and the newest `updatedAt`, sorted by count, and prints it as a table. A missing/null `app` is shown as `(legacy)`: rows that predate the `app` field belong to garage-chat but are reported separately rather than merged.
- Sums NetworkChain (`app === "networkchain"`) tokens for `ios` and `android` and prints hints: zero Android tokens is expected (the comment says the app has no FCM config); zero iOS tokens means registration fails before the POST.
- With `--user <email|userId>`: a 24-hex argument is treated as a `User` `_id`, anything else as an email (lower-cased). It lists that user's tokens (app, platform, active, app version, failed attempts, last update, first 28 chars of the token), newest first.

Usage:
```
npx tsx scripts/inspect-push-tokens.ts
npx tsx scripts/inspect-push-tokens.ts --user me@x.com
npx tsx scripts/inspect-push-tokens.ts --user <24-hex userId>
```

## Exports
None. Defines a local `getArg(name)` helper for `--name value` CLI flags and runs `run()` on load.

## Interfaces
- **Database:** `DeviceToken` - aggregate and find (read only); `User` - find by id or email (read only). Production DB.
- **Environment variables:** `MONGODB_URI` (via `env`) - database to inspect.

## Dependencies
- **Internal:** `server/config/env.ts` - `env.MONGODB_URI`; `server/models/deviceToken.model.ts` - `DeviceToken` model; `server/models/user.model.ts` - `User` model.
- **Packages:** `mongoose` - connection and aggregation; `dotenv` - loads `.env`.

## Used by
Nothing imports it. Run manually with `npx tsx` from the repo root.

## Notes
- Despite the generic label for scripts in this folder ("writes to the configured DB"), the script performs no writes.
- Token values are truncated in output but still partially printed; treat the output as sensitive.
