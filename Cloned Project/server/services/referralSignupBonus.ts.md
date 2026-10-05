# `server/services/referralSignupBonus.ts`

> Module exporting `payReferralSignupBonus`.

**Kind:** backend service · **Lines:** 347

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReferralBonusResult` | type | Global signup referral bonus. | 39 |
| `payReferralSignupBonus` | function | `async payReferralSignupBonus(userOrId: any): Promise<ReferralBonusResult>` | 55 |

## Interfaces

- **Database (Mongoose models used):**
  - `ReferralBonusConfig` (server/models/referralBonusConfig.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `ReferralBonusPayout` (server/models/referralBonusPayout.model.ts) — reads: `exists`; **writes:** `create`, `updateOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/referralBonusConfig.model.ts` — `ReferralBonusConfig`
  - `server/models/referralBonusPayout.model.ts` — `ReferralBonusPayout`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/profile.ts`
