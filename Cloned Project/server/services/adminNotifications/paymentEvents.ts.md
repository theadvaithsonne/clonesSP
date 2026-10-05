# `server/services/adminNotifications/paymentEvents.ts`

> Turns a new UnilevelPlusPurchase into "$25 payment" admin notification events.

**Kind:** backend service · **Lines:** 167

<!-- docgen:auto -->

## Purpose
Turns a new UnilevelPlusPurchase into "$25 payment" admin notification events.

Triggered by the post-save hook on UnilevelPlusPurchase, the one model every
$25 payment path writes: invoice fulfilment, the Razorpay webhook fallback,
and the direct verify route. They are idempotent against each other (each
checks `getUserPurchase` first), so one real payment creates one purchase and
raises one set of events.

NOT EVERY PURCHASE IS A PAYMENT. Prod data, 2026-09-13, by metadata.source:
  invoice_fulfillment 231 · (none — direct verify) 56 · webhook_fallback 11
  reserve_assignment 7 · synthetic_mint_google_oauth 2 · manual_activation 1
  backfill 1
A reserve licence being assigned moves no money — the buyer paid when they
bought the licence. Backfills, synthetic mints and manual activations aren't
payments either. Those are excluded, as are $0 coupon activations.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `emitUp25PaymentEvents` | function | `async emitUp25PaymentEvents(purchase: any): Promise<void>` | 44 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Timers / queues:** `setTimeout` at L131

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/autoDebitInstrument.ts` — `autoDebitInstrument`
  - `server/services/adminNotifications/dispatch.ts` — `emitAdminEvent`, `EmitSummaryRow`
  - `server/services/adminNotifications/evaluate.ts` — `EvalUser`, `(types only)`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/models/unilevelPlusPurchase.model.ts`
