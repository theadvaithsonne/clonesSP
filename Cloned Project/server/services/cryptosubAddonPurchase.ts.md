# `server/services/cryptosubAddonPurchase.ts`

> Cryptosub add-on — invoice-based purchase flow.

**Kind:** backend service · **Lines:** 786

<!-- docgen:auto -->

## Purpose
Cryptosub add-on — invoice-based purchase flow.

Contract (from the plan file, docs/cryptosub-addon.md if you want a
full narrative):
  1. Founder self-serves. `purchaseCryptosubAddon` mints a $600 USD
     (+18% GST when Indian-billed) recurring invoice and charges the
     founder's saved card on-session immediately.
  2. Invoice pays → `fulfillInvoice`'s `cryptosub` switch case
     fires `activateCryptosubFromInvoice` (upserts an
     OfficeAddonSubscription so `hasActiveAddon(orgId, "cryptosub")`
     returns true) + `chargeReferralCommission` (credits 50% of the
     base $600 = $300 USD to the buyer's direct referrer's Affiliate
     Wallet via `creditAffiliateOrPlatform`).
  3. Yearly renewal cron (`runCryptosubRenewalTick`) mints the next
     invoice ~7 days before `currentEnd` and off_session charges the
     saved card. Fail → status:"halted" + email. Success → extend […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CryptosubPurchaseInput` | interface |  | 41 |
| `CryptosubPurchaseResult` | interface | Response of the invoice-mint flow. | 54 |
| `CryptosubPriceQuote` | interface |  | 63 |
| `quoteCryptosubPrice` | function | `async quoteCryptosubPrice(buyerUserId: string, orgId: string): Promise<CryptosubPriceQuote>` — Compute the price the founder will pay for the cryptosub add-on, accounting for GST based on their buyer region. | 112 |
| `purchaseCryptosubAddon` | function | `async purchaseCryptosubAddon(input: CryptosubPurchaseInput): Promise<CryptosubPurchaseResult>` — Mint a cryptosub add-on invoice and hand the founder off to the standard `/invoice/<id>` pay page — same "external hosted checkout" pattern the office subscription flow uses. | 156 |
| `activateCryptosubFromInvoice` | function | `async activateCryptosubFromInvoice(invoice: IInvoice): Promise<void>` — Upsert the OfficeAddonSubscription doc so `hasActiveAddon(orgId, "cryptosub")` returns true. | 245 |
| `chargeReferralCommission` | function | `async chargeReferralCommission(invoice: IInvoice): Promise<{ distributed: boolean; breakdown: any }>` — Distribute the $300 cryptosub add-on commission across three buckets: $150 flat to L1, $144 depth-weighted across L1..L6, $6 baseline to platform. | 459 |
| `RenewalTickResult` | interface |  | 660 |
| `runCryptosubRenewalTick` | function | `async runCryptosubRenewalTick(): Promise<RenewalTickResult>` — Scan for cryptosub subscriptions whose `currentEnd` falls within the renewal lead window, and mint the next invoice for the founder to pay through the standard invoice-pay page (same pattern as the initial purchase). | 678 |
| `CryptosubStatusResult` | interface |  | 749 |
| `getCryptosubStatus` | function | `async getCryptosubStatus(orgId: string): Promise<CryptosubStatusResult>` | 761 |

## Interfaces

- **Database (Mongoose models used):**
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `findOne`, `find`; **writes:** `updateOne`, `findOneAndUpdate`
  - `Invoice` (server/models/invoice.model.ts) — **writes:** `updateOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`, `IInvoice`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
  - `server/models/user.model.ts` — `User`
  - `server/services/invoice.ts` — `createInvoice`
  - `server/services/officeAddonSubscription.ts` — `hasActiveAddon`
  - `server/services/wallet.ts` — `creditAffiliateOrPlatform`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`
  - `server/utils/gstTax.ts` — `applyGstToLine`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`, `cryptosubCycleMs`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/cryptosubAddon.ts`
- `server/services/invoice.ts`
