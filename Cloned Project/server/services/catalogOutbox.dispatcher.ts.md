# `server/services/catalogOutbox.dispatcher.ts`

> Catalog outbox dispatcher.

**Kind:** backend service · **Lines:** 231

<!-- docgen:auto -->

## Purpose
Catalog outbox dispatcher.

Drains pending CatalogOutbox rows, signs each as a webhook payload, POSTs
to NetworkChainApi, and either marks `sent` or schedules an exponential
retry. Started once from `src/index.ts` after the Mongo connection is up.

Design decisions:
 - Single-process. If multiple roam-backend instances run, each polls
   independently; the `findOneAndUpdate` to `in_flight` race-protects
   against double-delivery.
 - Batch size of 50 per tick caps per-tick latency; webhook receiver is
   cheap (idempotency Redis SETNX + Celery enqueue).
 - We carry IDs only in the payload — NC re-fetches the latest doc. This
   eliminates "old payload overwrites new" races and survives schema drift.
 - HMAC: same `signWebhookPayload` contract as `thirdPartyWebhook.ts`,
   different headers (`x-gu-catalog-*`) so middleware can tell them apart.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `startCatalogDispatcher` | function | `startCatalogDispatcher(): void` | 205 |
| `stopCatalogDispatcher` | function | `stopCatalogDispatcher(): void` | 224 |

## Interfaces

- **Database (Mongoose models used):**
  - `CatalogOutbox` (server/models/catalogOutbox.model.ts) — **writes:** `updateOne`, `findOneAndUpdate`
- **Environment via `server/config/env.ts`:** `env.OPENCLAW_GARAGE_WEBHOOK_SECRET`, `env.OPENCLAW_NC_URL`, `env.CATALOG_OUTBOX_DISPATCH_DISABLED`
- **Timers / queues:** `setInterval` at L215

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/catalogOutbox.model.ts` — `CatalogOutbox`, `CatalogOutboxItemType`
- **Packages:**
  - `axios`
  - `crypto`

## Used by

- `server/index.ts`
