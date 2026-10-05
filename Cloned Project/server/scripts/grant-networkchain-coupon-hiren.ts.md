# `server/scripts/grant-networkchain-coupon-hiren.ts`

> src/scripts/grant-networkchain-coupon-hiren.ts

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 171

<!-- docgen:auto -->

## Purpose
src/scripts/grant-networkchain-coupon-hiren.ts

Give h.sabalpara6844@gmail.com (Hiren Sabalpara) a 3-month NetworkChain
subscription via the GETNETWORKCHAINS coupon (100% off × 3 cycles).

Goes through `createThirdPartyInvoice` — the same service a real NetworkChain
purchase uses — rather than hand-writing an invoice, so fulfilment,
activation and commission distribution all behave exactly as they would for
a paying customer. The resulting row is byte-identical in shape to
khanthecoach@gmail.com's working chain (INV-MQEXRCOR-R8X6).

Depends on the redemption-scope fix: the coupon has cycleCount 3, so
`redemptionScopeFor` files the redemption under `parentInvoiceId: <root>`,
which is the only key `generateNextChildInvoice` reads. Without that fix
this would grant exactly one free cycle and then start billing.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Timers / queues:** `setTimeout` at L152

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/grant-networkchain-coupon-hiren.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--confirm`.
