# `server/services/officeProInvoiceCommission.ts`

> Fire the Pro-plan 3-bucket commission ($24 UP + $24 direct + $48 platform) for an office_plan Pro invoice that was paid OUTSIDE of Razorpay — the cryptobrand-bootstrap flow (wallet / crypto / manual) otherwise skips it entirely because `di…

**Kind:** backend service · **Lines:** 417

<!-- docgen:auto -->

## Purpose
Fire the Pro-plan 3-bucket commission ($24 UP + $24 direct + $48
platform) for an office_plan Pro invoice that was paid OUTSIDE of
Razorpay — the cryptobrand-bootstrap flow (wallet / crypto / manual)
otherwise skips it entirely because `distributeOfficeCommission` in
officeSubscription.ts only fires from Razorpay webhook handlers.

The Razorpay flow still runs its own distributeOfficeCommission — that
path stays unchanged. This function is the sibling for
non-Razorpay-paid invoices, wired from fulfillInvoice's `office_plan`
case.

Idempotency: guarded by `invoice.metadata.officeProCommissionAt`. Also
UP dedupe via a unique `paymentId` per invoice (not per-payment-cycle
like the Razorpay path, because these invoices only ever have one
payment event — they're not recurring on the Razorpay side).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DistributeResult` | interface |  | 25 |
| `distributeProOfficeCommissionForInvoice` | function | `async distributeProOfficeCommissionForInvoice(invoiceOrId: any): Promise<DistributeResult>` — Fire the Pro-plan commission for `invoice` if it's a paid Pro invoice that hasn't been distributed yet. | 41 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/models/officePlan.model.ts` — `OfficePlan`, `OFFICE_PLAN_IDS`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/scripts/retro-distribute-office-pro-invoice.ts`
- `server/services/invoice.ts`
