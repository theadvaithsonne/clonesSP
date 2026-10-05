# `server/services/officeSubscription.ts`

> Module exporting `initializeOfficePlans`, `getOfficePlans`, `getOfficePlanBySlug`, `getOfficePlan` and 24 more.

**Kind:** backend service · **Lines:** 3322

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `initializeOfficePlans` | function | `async initializeOfficePlans(): Promise<IOfficePlan[]>` — Initialize office plans in database and Razorpay Run this once on startup or via admin endpoint | 84 |
| `getOfficePlans` | function | `async getOfficePlans(): Promise<IOfficePlan[]>` — Get all active office plans | 546 |
| `getOfficePlanBySlug` | function | `async getOfficePlanBySlug(slug: string): Promise<IOfficePlan \| null>` — Get office plan by slug | 553 |
| `getOfficePlan` | function | `async getOfficePlan(planId: string): Promise<IOfficePlan \| null>` — Get office plan by ID | 562 |
| `CreateOfficeSubscriptionInput` | interface |  | 570 |
| `createOfficeSubscription` | function | `async createOfficeSubscription(input: CreateOfficeSubscriptionInput): Promise<IOfficeSubscription>` — Create an office subscription for an organization | 584 |
| `getOfficeSubscription` | function | `async getOfficeSubscription(orgId: string): Promise<IOfficeSubscription \| null>` — Get office subscription for an organization | 704 |
| `getActiveOfficeSubscription` | function | `async getActiveOfficeSubscription(orgId: string): Promise<IOfficeSubscription \| null>` — Get active office subscription for an organization | 716 |
| `OFFICE_GRACE_PERIOD_DAYS` | const | `= 7` | 752 |
| `OfficeGraceState` | interface |  | 755 |
| `computeOfficeGraceState` | function | `computeOfficeGraceState(subscription: IOfficeSubscription \| null, now: Date = new Date()): OfficeGraceState` — Derive the current grace state for a Pro subscription. | 789 |
| `hasActiveOfficeSubscription` | function | `async hasActiveOfficeSubscription(orgId: string): Promise<boolean>` — Check if organization has an active subscription Organizations with parent: true (GARAGE HQs) are never locked even without payment | 850 |
| `getTrialInfo` | function | `getTrialInfo(subscription: IOfficeSubscription \| null)` — Get trial information for a subscription | 928 |
| `canInviteStakeholders` | function | `async canInviteStakeholders(orgId: string): Promise<boolean>` — Check if organization can invite stakeholders (Pro plan only) Also allows: parent orgs (GARAGE HQs), trial subscriptions, and test orgs | 957 |
| `getSubscriptionRecoveryInfo` | function | `async getSubscriptionRecoveryInfo(orgId: string): Promise<{ isHalted: boolean; isPending: boolean; …` — Get recovery information for a halted or pending subscription Returns the recovery URL and any unpaid invoices | 1020 |
| `cancelOfficeSubscription` | function | `async cancelOfficeSubscription(subscriptionId: string, cancelAtCycleEnd: boolean = true): Promise<IOfficeSubscription>` — Cancel an office subscription | 1090 |
| `syncOfficeSubscriptionStatus` | function | `async syncOfficeSubscriptionStatus(subscriptionId: string): Promise<IOfficeSubscription \| null>` — Sync subscription status with Razorpay | 1133 |
| `handleOfficeSubscriptionAuthenticated` | function | `async handleOfficeSubscriptionAuthenticated(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription authenticated event | 1172 |
| `handleOfficeSubscriptionActivated` | function | `async handleOfficeSubscriptionActivated(razorpaySubscription: RazorpaySubscription, payment?: any): Promise<void>` — Handle subscription activated event (first payment successful) | 1241 |
| `handleOfficeSubscriptionCharged` | function | `async handleOfficeSubscriptionCharged(razorpaySubscription: RazorpaySubscription, payment: any): Promise<void>` — Handle subscription charged event (recurring payment successful) | 1326 |
| `handleOfficeSubscriptionHalted` | function | `async handleOfficeSubscriptionHalted(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription halted event (payment failed after retries) | 1442 |
| `handleOfficeSubscriptionCancelled` | function | `async handleOfficeSubscriptionCancelled(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription cancelled event | 1495 |
| `handleOfficeSubscriptionPending` | function | `async handleOfficeSubscriptionPending(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription pending event | 1544 |
| `UpgradePreview` | interface |  | 2280 |
| `calculateUpgradePreview` | function | `async calculateUpgradePreview(orgId: string): Promise<UpgradePreview>` — Calculate upgrade preview for an organization Returns wallet credit info instead of payment breakdown | 2308 |
| `UpgradeResult` | interface |  | 2394 |
| `initiateOfficeUpgrade` | function | `async initiateOfficeUpgrade(orgId: string, founderId: string): Promise<UpgradeResult>` — Initiate and complete office plan upgrade in one call | 2416 |
| `getOfficeUpgradeHistory` | function | `async getOfficeUpgradeHistory(orgId: string): Promise<IOfficeUpgradeHistory[]>` — Get upgrade history for an organization | 2615 |
| `DowngradePreview` | interface |  | 2649 |
| `calculateDowngradePreview` | function | `async calculateDowngradePreview(orgId: string): Promise<DowngradePreview>` | 2683 |
| `DowngradeResult` | interface |  | 2757 |
| `initiateOfficeDowngrade` | function | `async initiateOfficeDowngrade(orgId: string, founderId: string): Promise<DowngradeResult>` | 2767 |
| `processScheduledOfficeDowngrades` | function | `async processScheduledOfficeDowngrades(): Promise<number>` — Cron entry point: switch every subscription whose scheduled downgrade has come due. | 2902 |
| `processExpiredOfficeGrace` | function | `async processExpiredOfficeGrace(): Promise<number>` — Cron entry point: auto-downgrade every Pro sub whose grace period has lapsed without payment. | 2948 |
| `activateOfficeFromPaidInvoice` | function | `async activateOfficeFromPaidInvoice(invoice: any): Promise<{ status: "activated" \| "extended" \| "alr…` — Activate (or extend) an org's office subscription from a PAID invoice that never went through Razorpay. | 3241 |

## Interfaces

- **Database (Mongoose models used):**
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `updateOne`, `create`
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `find`, `findOne`, `findById`; **writes:** `updateOne`, `create`, `deleteOne`
  - `OfficeSubscriptionPayment` (server/models/officeSubscriptionPayment.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
  - `OfficeUpgradeHistory` (server/models/officeUpgradeHistory.model.ts) — reads: `find`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/services/downlineTree.ts` — `refreshTypeFlags`
  - `server/models/officePlan.model.ts` — `OfficePlan`, `IOfficePlan`, `OFFICE_PLANS_CONFIG`, `OFFICE_PLAN_IDS`, `OFFICE_COMMISSION_STRUCTURE`, `calculateTaxAmounts`, `extractBaseFromTotal`, `GST_CONFIG`
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`, `IOfficeSubscription`, `OfficeSubscriptionStatus`
  - `server/models/officeSubscriptionPayment.model.ts` — `OfficeSubscriptionPayment`, `IOfficeSubscriptionPayment`
  - `server/services/razorpay.ts` — `createPlan as createRazorpayPlan`, `createSubscription as createRazorpaySubscription`, `fetchSubscription as fetchRazorpaySubscription`, `cancelSubscription as cancelRazorpaySubscription`, `createCustomer as createRazorpayCustomer`, `RazorpaySubscription`
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/services/wallet.ts` — `creditAffiliateOrPlatform`
  - `server/utils/exchangeRate.ts` — `convertInrToUsd`
  - `server/models/officeUpgradeHistory.model.ts` — `OfficeUpgradeHistory`, `IOfficeUpgradeHistory`, `ICreditCalculation`
  - `server/services/wallet.ts` — `creditStoreWallet`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/invoice.ts`
- `server/routes/joinRequests.ts`
- `server/routes/officeAddonCheckout.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/officeSubscriptionAdmin.ts`
- `server/routes/webhook.ts`
- `server/scripts/repair-foundersoffice-activation.ts`
- `server/services/conferenceRoomBilling.ts`
- `server/services/invoice.ts`
- `server/services/officeAddonSubscription.ts`
- `server/utils/cabinetStorage.ts`

## Notes

- Large file (3322 lines) — read it by section; line numbers above point into it.
