# `server/scripts/fix-hiren-nc-webhook-identity.ts`

> src/scripts/fix-hiren-nc-webhook-identity.ts

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 102

<!-- docgen:auto -->

## Purpose
src/scripts/fix-hiren-nc-webhook-identity.ts

Hiren's NetworkChain subscription is correct on OUR side — invoice paid,
coverage valid, 3-cycle coupon filed on the chain root — and NetworkChain
acknowledged our webhook with a 200. He still shows inactive on their side
because of what the payload was MISSING.

The webhook body carries `metadata: redactInternalKeys(invoice.metadata)`.
233 of the 249 NetworkChain root invoices carry `metadata.userId` (the
GARAGE user id — verified: Khan's is 69e603ea…, which is his own Garage
account) plus `metadata.orgId`. Hiren's carries NEITHER, because the normal
flow has NetworkChain call our API and pass those ids themselves, whereas
this subscription was created by calling the service directly from a script
that never supplied them.

So they received an invoice.paid for an email with no account identifiers […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Timers / queues:** `setTimeout` at L86

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/fix-hiren-nc-webhook-identity.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--confirm`.
