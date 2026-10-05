# `server/services/officeAddonSubscription.ts`

> Module exporting `initializeOfficeAddons`, `getOfficeAddons`, `getOfficeAddonBySlug`, `createOfficeAddonSubscription` and 12 more.

**Kind:** backend service · **Lines:** 1326

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `initializeOfficeAddons` | function | `async initializeOfficeAddons(): Promise<IOfficeAddon[]>` — Initialize office add-ons in database and Razorpay Run this once on startup or via admin endpoint | 74 |
| `getOfficeAddons` | function | `async getOfficeAddons(): Promise<IOfficeAddon[]>` — Get all active office add-ons | 328 |
| `getOfficeAddonBySlug` | function | `async getOfficeAddonBySlug(slug: string): Promise<IOfficeAddon \| null>` — Get office add-on by slug | 335 |
| `CreateOfficeAddonSubscriptionInput` | interface |  | 343 |
| `createOfficeAddonSubscription` | function | `async createOfficeAddonSubscription(input: CreateOfficeAddonSubscriptionInput): Promise<IOfficeAddonSubscription>` — Create an office add-on subscription for an organization Requires org to have an active office plan (Basic or Pro) | 358 |
| `getOfficeAddonSubscription` | function | `async getOfficeAddonSubscription(orgId: string, addonSlug?: string): Promise<IOfficeAddonSubscription \| null>` — Get office add-on subscription for an organization | 483 |
| `getOfficeAddonSubscriptions` | function | `async getOfficeAddonSubscriptions(orgId: string): Promise<IOfficeAddonSubscription[]>` — Get all office add-on subscriptions for an organization | 504 |
| `getActiveOfficeAddonSubscription` | function | `async getActiveOfficeAddonSubscription(orgId: string, addonSlug?: string): Promise<IOfficeAddonSubscription \| null>` — Get active office add-on subscription for an organization | 518 |
| `hasActiveAddon` | function | `async hasActiveAddon(orgId: string, addonSlug: string): Promise<boolean>` — Check if organization has an active add-on | 539 |
| `syncOfficeAddonSubscriptionStatus` | function | `async syncOfficeAddonSubscriptionStatus(subscriptionId: string): Promise<IOfficeAddonSubscription \| null>` — Sync add-on subscription status with Razorpay | 565 |
| `handleOfficeAddonSubscriptionAuthenticated` | function | `async handleOfficeAddonSubscriptionAuthenticated(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle add-on subscription authenticated event | 606 |
| `handleOfficeAddonSubscriptionActivated` | function | `async handleOfficeAddonSubscriptionActivated(razorpaySubscription: RazorpaySubscription, payment?: any): Promise<void>` — Handle add-on subscription activated event (first payment successful) | 665 |
| `handleOfficeAddonSubscriptionCharged` | function | `async handleOfficeAddonSubscriptionCharged(razorpaySubscription: RazorpaySubscription, payment: any): Promise<void>` — Handle add-on subscription charged event (recurring payment successful) | 754 |
| `handleOfficeAddonSubscriptionHalted` | function | `async handleOfficeAddonSubscriptionHalted(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle add-on subscription halted event | 848 |
| `handleOfficeAddonSubscriptionCancelled` | function | `async handleOfficeAddonSubscriptionCancelled(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle add-on subscription cancelled event | 887 |
| `handleOfficeAddonSubscriptionPending` | function | `async handleOfficeAddonSubscriptionPending(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle add-on subscription pending event | 927 |
| `getOfficeAddonPayments` | function | `async getOfficeAddonPayments(orgId: string): Promise<IOfficeAddonPayment[]>` — Get payments for an add-on subscription | 1316 |

## Interfaces

- **Database (Mongoose models used):**
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`, `find`; **writes:** `updateOne`, `create`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `create`
  - `OfficeAddonPayment` (server/models/officeAddonPayment.model.ts) — reads: `findOne`, `find`; **writes:** `create`, `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/officeAddon.model.ts` — `OfficeAddon`, `IOfficeAddon`, `OFFICE_ADDONS_CONFIG`, `ADDON_COMMISSION_STRUCTURE`, `calculateAddonTaxAmounts`, `extractAddonBaseFromTotal`, `ADDON_GST_CONFIG`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`, `IOfficeAddonSubscription`, `OfficeAddonSubscriptionStatus`
  - `server/models/officeAddonPayment.model.ts` — `OfficeAddonPayment`, `IOfficeAddonPayment`
  - `server/services/razorpay.ts` — `createPlan as createRazorpayPlan`, `createSubscription as createRazorpaySubscription`, `fetchSubscription as fetchRazorpaySubscription`, `cancelSubscription as cancelRazorpaySubscription`, `createCustomer as createRazorpayCustomer`, `RazorpaySubscription`
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/services/officeSubscription.ts` — `hasActiveOfficeSubscription`
  - `server/services/wallet.ts` — `creditAffiliateOrPlatform`
  - `server/utils/exchangeRate.ts` — `convertInrToUsd`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/cryptobrandCheckout.ts`
- `server/routes/myOfficePlans.ts`
- `server/routes/officeAddonCheckout.ts`
- `server/routes/officeAddonStatus.ts`
- `server/routes/webhook.ts`
- `server/services/cryptobrandCheckoutStatus.ts`
- `server/services/cryptosubAddonPurchase.ts`
- `server/services/init.ts`
- `server/services/officePlanStatus.ts`
- `server/services/whitelabelAddonPurchase.ts`
