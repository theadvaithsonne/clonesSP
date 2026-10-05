# `server/services/affiliate.ts`

> Module exporting `ensureUserHasAffiliateId`, `setReferredBy`, `setReferredByAffiliateId`, `isInMyDownline` and 6 more.

**Kind:** backend service · **Lines:** 549

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ensureUserHasAffiliateId` | function | `async ensureUserHasAffiliateId(userId: string): Promise<string>` — Ensure a user has an affiliate ID, generating one if missing | 10 |
| `setReferredBy` | function | `async setReferredBy(userId: string): Promise<void>` — Set the referredBy field based on user role: - Founders: referred by shorupan | 37 |
| `setReferredByAffiliateId` | function | `async setReferredByAffiliateId(userId: string, affiliateId: string, orgIdHint?: string \| null): Promise<boolean>` — Set the referredBy field based on an affiliate ID (for checkout links). | 112 |
| `isInMyDownline` | function | `async isInMyDownline(meId: string, candidateReferrerId: string): Promise<boolean>` — Returns true if `candidateReferrerId` sits somewhere in `meId`'s downline tree — i.e. | 222 |
| `getReferrerInfo` | function | `async getReferrerInfo(referrerId: string \| Types.ObjectId)` — Get referrer information by user ID | 255 |
| `getReferrerInfoByAffiliateId` | function | `async getReferrerInfoByAffiliateId(affiliateId: string)` — Get referrer info by affiliate ID (for backward compatibility with invite links) | 285 |
| `getSponsorCardByAffiliateId` | function | `async getSponsorCardByAffiliateId(affiliateId: string)` — The sponsor card for an invite/register link: who referred me, and nothing else. | 307 |
| `getAffiliateStats` | function | `async getAffiliateStats(userId: string)` — Get affiliate statistics for a user | 334 |
| `countAllDescendants` | function | `async countAllDescendants(userId: string): Promise<number>` — Count all descendants of a user using $graphLookup (single DB operation) | 391 |
| `getAffiliateNetwork` | function | `async getAffiliateNetwork(userId: string, maxDepth = 10)` — Get the affiliate network (referral tree) for a user. | 426 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`, `countDocuments`, `aggregate`, `find`
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`, `isValidAffiliateId`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invoice.ts`
- `server/routes/jobsCandidate.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/serviceCheckout.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/ecommerceInvoice.ts`
- `server/services/pendingInvite.ts`
- `server/services/welcomeEmail.ts`
