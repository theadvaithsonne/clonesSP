# `server/services/whitelabelAddonPurchase.ts`

> Whitelabel add-on — invoice-based purchase flow.

**Kind:** backend service · **Lines:** 933

<!-- docgen:auto -->

## Purpose
Whitelabel add-on — invoice-based purchase flow.

Contract (from the plan file, docs/whitelabel-addon.md if you want a
full narrative):
  1. Founder self-serves. `purchaseWhitelabelAddon` mints a $600 USD
     (+18% GST when Indian-billed) recurring invoice and charges the
     founder's saved card on-session immediately.
  2. Invoice pays → `fulfillInvoice`'s `whitelabel_addon` switch case
     fires `activateWhitelabelFromInvoice` (upserts an
     OfficeAddonSubscription so `hasActiveAddon(orgId, "white-label")`
     returns true) + `chargeReferralCommission` (credits 50% of the
     base $600 = $300 USD to the buyer's direct referrer's Affiliate
     Wallet via `creditAffiliateOrPlatform`).
  3. Yearly renewal cron (`runWhitelabelRenewalTick`) mints the next
     invoice ~7 days before `currentEnd` and off_session charges the
     saved card. Fail → status:"halted" + email. Success → extend […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `Organization`

- **Collection:** `organizations` (default pluralised name)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WhitelabelPurchaseInput` | interface |  | 41 |
| `WhitelabelPurchaseResult` | interface | Response of the invoice-mint flow. | 54 |
| `WhitelabelPriceQuote` | interface |  | 63 |
| `quoteWhitelabelPrice` | function | `async quoteWhitelabelPrice(buyerUserId: string, orgId: string): Promise<WhitelabelPriceQuote>` — Compute the price the founder will pay for the whitelabel add-on, accounting for GST based on their buyer region. | 112 |
| `purchaseWhitelabelAddon` | function | `async purchaseWhitelabelAddon(input: WhitelabelPurchaseInput): Promise<WhitelabelPurchaseResult>` — Mint a whitelabel add-on invoice and hand the founder off to the standard `/invoice/<id>` pay page — same "external hosted checkout" pattern the office subscription flow uses. | 156 |
| `activateWhitelabelFromInvoice` | function | `async activateWhitelabelFromInvoice(invoice: IInvoice): Promise<void>` — Upsert the OfficeAddonSubscription doc so `hasActiveAddon(orgId, "white-label")` returns true. | 245 |
| `activateBundledWhitelabelFromCryptosub` | function | `async activateBundledWhitelabelFromCryptosub(invoice: IInvoice): Promise<void>` — Bundle-grant whitelabel access when a Cryptosub invoice is paid, IF the org opted in at office-creation time (`whitelabelRequested: true`). | 341 |
| `chargeReferralCommission` | function | `async chargeReferralCommission(invoice: IInvoice): Promise<{ distributed: boolean; breakdown: any }>` — Distribute the $300 whitelabel add-on commission across three buckets: $150 flat to L1, $144 depth-weighted across L1..L6, $6 baseline to platform. | 579 |
| `RenewalTickResult` | interface |  | 807 |
| `runWhitelabelRenewalTick` | function | `async runWhitelabelRenewalTick(): Promise<RenewalTickResult>` — Scan for whitelabel subscriptions whose `currentEnd` falls within the renewal lead window, and mint the next invoice for the founder to pay through the standard invoice-pay page (same pattern as the initial purchase). | 825 |
| `WhitelabelStatusResult` | interface |  | 896 |
| `getWhitelabelStatus` | function | `async getWhitelabelStatus(orgId: string): Promise<WhitelabelStatusResult>` | 908 |

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
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`, `whitelabelCycleMs`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/initialSetup.ts`
- `server/routes/whitelabelAddon.ts`
- `server/scripts/retro-fulfill-whitelabel.ts`
- `server/services/invoice.ts`
