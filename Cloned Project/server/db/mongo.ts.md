# `server/db/mongo.ts`

> Opens the backend's single Mongoose connection to MongoDB, picking a safe `autoIndex` policy, then seeds the GARAGE HQ organisation.

**Kind:** database connection · **Lines:** 44

## Purpose
Every Mongoose model in `server/models/` shares the default `mongoose` connection, and this file is the only place it is opened. The boot sequence in `server/index.ts` awaits `connectMongo()` before it starts the boot tasks and background sweepers. In this project `MONGODB_URI` points at the **production** database.

## How it works
1. **Guard.** Throws `Error("MONGODB_URI is missing")` if `env.MONGODB_URI` is empty, so boot fails loudly.
2. **autoIndex policy (L8-L29).** By default Mongoose builds every index declared in a schema each time it connects. On a large production collection (the comment names `WalletTransaction`), a newly added index starts a background `createIndex` that can pin the database CPU for hours. So:
   - `autoIndex = true` when `NODE_ENV !== "production"` (dev keeps the convenience).
   - `autoIndex = false` in production. Index changes are supposed to ship through a deliberate migration (the comment names `npm run indexes:sync`) run in a quiet window.
   - `MONGO_AUTO_INDEX=true` (case-insensitive) forces it on whatever `NODE_ENV` is. This is meant for the first boot of a brand-new cluster.
3. Calls `mongoose.connect(env.MONGODB_URI, { autoIndex })` and logs `[mongo] connected (NODE_ENV=…, autoIndex=…)`.
4. Attaches `connected` and `error` listeners to `mongoose.connection` for logging.
5. **HQ seeding.** Calls `initializeGarageHQ()` from `server/services/init.ts`. That function finds or creates the parent organisation (`Organization` with `parent: true`, named "GARAGE HQ") and makes sure its default floors exist. Failures are logged and swallowed, so a seeding error never blocks boot.

## Exports
- `connectMongo(): Promise<void>` - connects Mongoose and runs HQ initialisation. Throws only when the URI is missing or `mongoose.connect` rejects.

## Interfaces
- **Database:** opens the default Mongoose connection. Through `initializeGarageHQ`, it reads and may create `Organization` and `Floor` documents.
- **Environment variables:** `MONGODB_URI` (via `env`) - connection string; `NODE_ENV` (via `env`) - decides autoIndex; `MONGO_AUTO_INDEX` (read straight from `process.env`) - forces autoIndex on.

## Dependencies
- **Internal:** `server/config/env.ts` - `MONGODB_URI` and `NODE_ENV`; `server/services/init.ts` - `initializeGarageHQ()`.
- **Packages:** `mongoose` - the ODM and connection.

## Used by
- `server/index.ts` - awaited early in the backend boot sequence. That sequence runs both standalone and under the combined entry point `server/main.ts`.

## Notes
- The `connected` listener is attached *after* the initial `connect` resolves. It therefore logs only later (re)connections, not the first one.
- In production, a new schema index does **not** appear until someone builds it on purpose. A query that relies on it can be slow until then.
- `initializeGarageHQ` writes to the production database on every boot, but only when the HQ organisation or its floors are missing. It is idempotent.
