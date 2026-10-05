# `server/scripts/redeliver-thirdparty-webhook.ts`

> src/scripts/redeliver-thirdparty-webhook.ts

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 104

<!-- docgen:auto -->

## Purpose
src/scripts/redeliver-thirdparty-webhook.ts

Re-send the `invoice.paid` webhook for a third-party invoice whose delivery
never landed, so the partner's own system learns about a subscription we
already created on our side.

Why this exists: `createThirdPartyInvoice` dispatches the webhook
fire-and-forget — it is NOT awaited, so it runs after the call returns. A
script that creates an invoice and then closes its Mongo connection kills
that dispatch mid-flight, leaving `webhookDelivery.attempts: 0`. The invoice
is perfect on our side (paid, coverage valid, redemption filed) while the
partner shows the member as inactive, because they were never told. That is
exactly what happened to h.sabalpara6844@gmail.com on 1 Oct 2026.

`retryInvoiceWebhook` has the same fire-and-forget shape, so this calls
`deliverInvoiceWebhook` directly and AWAITS it — the point is to still be […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Timers / queues:** `setTimeout` at L90

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/redeliver-thirdparty-webhook.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--confirm`.
