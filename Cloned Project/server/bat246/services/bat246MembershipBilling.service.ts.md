# `server/bat246/services/bat246MembershipBilling.service.ts`

> Runs the BAT246 membership model where new members get 2 months free and then pay $12 a month: activating the free trial, and a billing sweep that charges members who are due.

**Kind:** BAT246 game module (backend) — service · **Lines:** 199

## Purpose
New BAT246 users no longer buy a one-time $20/year membership. They claim a free 2-month trial, and after that they are billed $12 every month from their own BAT246 store wallet into Alan K's wallet. This file holds both halves:
- the activation handler behind the "Claim Free for 2 Months" button;
- the sweep that `server/index.ts` runs on a timer.

Legacy $20/year members have no `membershipPlan` or `nextBillingAt`, so neither function ever touches them.

## How it works
**`activateFreeTrialMembership(userId)`**
- Throws `"Membership is already active"` if the user's `Bat246Player.membershipActive` is already true.
- Creates a `Bat246Player` through `createBat246Player` if none exists yet. Membership is one of several qualification steps and can come before the entry purchase.
- Sets these fields on the player:
  - `membershipActive: true`
  - `membershipPlan: "trial"`
  - `membershipStartedAt: now`
  - `nextBillingAt` and `membershipExpiresAt`: now + 2 months
- Upserts the user's `Bat246Distributor`. Insert defaults are all flags false.
- Recomputes `isQualified` as `isOfficeMember && hasPurchasedProduct`. Membership counts as satisfied because this handler is what sets it, and the Garage-affiliate check was dropped from qualification. It then writes `hasBat246Membership: true`, `membershipExpiresAt`, `isQualified`, and `qualifiedAt` if the user just became qualified.
- On a fresh qualification, it lazily imports and calls `assignDistributorId` and `maybeCreatePlacementNotification`. Failures here are swallowed.
- If the distributor has a `bat246RefUserId` (upline), it creates a `Bat246PlacementNotification` of type `"membership"` for that upline.
- Returns `{ active: true, plan: "trial", nextBillingAt }`.

This mirrors what the paid `bat246_membership` invoice fulfilment in `server/services/invoice.ts` does, without the payment.

**`runDueMembershipBilling()`**
- Finds players with `membershipActive: true` and `nextBillingAt <= now`.
- **Claim.** For each one, it atomically claims the cycle with `findOneAndUpdate({ _id, nextBillingAt: <value just read> })`. The update sets `membershipPlan: "monthly"` and moves `nextBillingAt` and `membershipExpiresAt` forward one month. A duplicate or concurrent tick fails the match and counts as skipped.
- **Charge.** Only after the claim does it call `chargeMembershipFee`. That function resolves the org (from the product tagged `bat246_entry`) and Alan's user id, then:
  - debits the member $12 with `directDebitStoreWalletAllowNegative`, so the wallet may go below zero;
  - credits Alan $12 with `directCreditStoreWallet`.
- **Dedupe keys.** Both calls carry a dedupe key built from the user id and the billed cycle date (yyyy-mm-dd), which `WalletTransaction` indexes as unique on `metadata.dedupeKey`.
- Returns `{ billed, skipped }`. Per-player errors are logged and counted as skipped.

`addMonths()` uses `Date.setMonth`. A Jan 31 start therefore rolls into early March, which is normal JS behaviour.

## Exports
- `MEMBERSHIP_TRIAL_MONTHS` — `2`.
- `MEMBERSHIP_MONTHLY_FEE` — `12` (USD).
- `activateFreeTrialMembership(userId: string): Promise<{ active: true; plan: "trial"; nextBillingAt: Date }>` — starts the trial. Throws if membership is already active.
- `runDueMembershipBilling(): Promise<{ billed: number; skipped: number }>` — one billing sweep pass.

## Interfaces
- **Endpoints served (indirectly):** `POST /backend/bat246/membership/activate-free` (`requireAuth`) in `server/bat246/routes/bat246.routes.ts` calls `activateFreeTrialMembership`.
- **Database:**
  - Reads and writes `Bat246Player` (model `bat246Players`) and `Bat246Distributor` (model `bat246Distributors`).
  - Creates `Bat246PlacementNotification` rows.
  - Reads `Product` and `User`.
  - Writes `StoreWallet` and `WalletTransaction` through the wallet helpers.
- **Background work:** `server/index.ts` schedules `runDueMembershipBilling` once 60 seconds after boot and then every 6 hours, through `setInterval`.

## Dependencies
- **Internal:**
  - `bat246Player.model.ts`, `bat246Distributor.model.ts` and `bat246PlacementNotifications.model.ts` (lazily imported).
  - `bat246PlayerId.util.ts` (`createBat246Player`).
  - `bat246Wallet.util.ts` (credit and allow-negative debit helpers).
  - `bat246.service.ts` (`maybeCreatePlacementNotification`) and `bat246DistributorId.util.ts` (`assignDistributorId`), both lazily imported.
  - `server/models/user.model.ts` and `product.model.ts`.
- **Packages:** `mongoose` (`Types.ObjectId`).

## Used by
- `server/bat246/routes/bat246.routes.ts`, which serves the free-trial activation endpoint.
- `server/index.ts`, which runs the billing sweeper.

## Notes
- **Failed charges are lost.** The cycle is claimed (and `nextBillingAt` moved forward) before money moves. If `chargeMembershipFee` throws, or returns early because the org or Alan can't be resolved, that month is never charged, and the next sweep will not retry it.
- **The dedupe key protects the ledger, not the balance.** The wallet helpers change the balance first and write the `WalletTransaction` second. A duplicate key would therefore fail after the balance had already changed. The atomic claim is the real protection against double-charging.
- **The route comment is out of date.** The comment above the route in `bat246.routes.ts` still says "3-month trial". The code uses 2 months.
- The admin email is hardcoded on line 29.
