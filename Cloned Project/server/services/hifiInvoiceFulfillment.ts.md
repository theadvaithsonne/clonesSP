# `server/services/hifiInvoiceFulfillment.ts`

> Fulfillment for the "hifi_investment" invoice itemType.

**Kind:** backend service · **Lines:** 331

<!-- docgen:auto -->

## Purpose
Fulfillment for the "hifi_investment" invoice itemType.

The invoice was minted by /hifi/applications/:id/invoice against an
existing `hifi_investment_application` doc, then paid via the
standard currency-aware /api/invoices/:id/pay-with-wallet flow. At
this point the investor's store wallet is already debited. This hook:

  1. Updates the hifi_investment_application:
       paymentStatus = "success"
       paidAt = now
       status = "completed"
       paymentPayload = { method:"garage_wallet", currency, ... }
       stepStatuses.<payStepId> = "success"  (if payStepId provided)
  2. Upserts a hifi_investment_subscription row keyed on applicationId
     so retries don't dupe. Sets status="settled", paidAt=now.
  3. Credits the founder-org StoreWallet in the same currency with the […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `HifiFulfillmentResult` | interface |  | 33 |
| `findOrgFounderId` | function | `async findOrgFounderId(orgId: any): Promise<string \| null>` — Founders are identified via User.organizations[{organization, role:"founder"}]. | 46 |
| `fulfillHifiInvestmentInvoice` | function | `async fulfillHifiInvestmentInvoice(invoice: any): Promise<HifiFulfillmentResult>` | 60 |

## Interfaces

- **Socket.IO events:**
  - emits: `hifi:application:paid`
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`; **writes:** `create`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `Invoice` (server/models/invoice.model.ts) — **writes:** `updateOne`
- **Raw collections:** `hifi_investment_applications`, `hifi_investment_subscriptions`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `mongoose` — `Types`
  - `crypto`

## Used by

- `server/routes/bond.ts`
- `server/routes/hifiInvoice.ts`
- `server/routes/wallet.ts`
- `server/services/bondInvoiceFulfillment.ts`
- `server/services/bondPayoutEngine.ts`
- `server/services/invoice.ts`
- `server/services/wallet.ts`
