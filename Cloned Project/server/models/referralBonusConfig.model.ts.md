# `server/models/referralBonusConfig.model.ts`

> Singleton Mongoose model holding the platform-wide signup referral bonus setting (amount per side and on/off).

**Kind:** Mongoose model · **Lines:** 64

## Purpose
When a referred user completes their profile, both the referrer and the new user are paid `amountUsd` from the platform's store wallet (Shorupan / Garage HQ) into their own store wallets. This model stores that one setting. It is deliberately a singleton: `key` is unique and always `"global"`, so reading the config is an unambiguous `findOne({ key: "global" })`.

## How it works
- `key` - enum `["global"]`, default `"global"`, unique, required.
- `amountUsd` - USD paid to **each** side (0.10 means $0.10 to the referrer and $0.10 to the referee); required, min 0, default 0, and a sanity ceiling of `max: 100`. The comment explains the ceiling: the bonus pays on every referred signup without per-payout approval, so a mistyped 1000 could drain the platform wallet.
- `isActive` - default `false`.
- `updatedBy` (ref `GarageAdmin`) and `updatedByEmail` - who last changed it, since this setting moves real money.
- Schema options: `timestamps: true`, explicit `collection: "referralbonusconfigs"`.
- The model is registered with a `mongoose.models.ReferralBonusConfig ||` guard so re-importing (for example under hot reload) does not throw an OverwriteModelError.

## Exports
- `ReferralBonusConfig` - the model (collection `referralbonusconfigs`).
- `IReferralBonusConfig` - document interface.

## Interfaces
- **Database:** `ReferralBonusConfig` (collection `referralbonusconfigs`) - single row read by the payout service and edited by admins.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/routes/garageAdminReferralBonus.ts` - mounted at `/garage-admin/referral-bonus` (browser: `/backend/garage-admin/referral-bonus`), super-admin only; `GET /` reads and `PUT /` updates this config.
- `server/services/referralSignupBonus.ts` - reads it when deciding whether and how much to pay on profile completion.

## Notes
- **A missing row means the feature is off.** There is intentionally no implicit default amount: a bonus that starts paying because a document was missing is the wrong failure direction.
- Because the model is exported via `mongoose.models.X || mongoose.model(...)`, its TypeScript type may widen to a generic `Model<any>` at some call sites.
