# `server/routes/affiliate.ts`

> Express router with 21 endpoints, mounted at `/affiliate`.

**Kind:** Express router · **Lines:** 2360 · **Mounted at:** `/affiliate` (browser: `/backend/affiliate`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (21)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/my-affiliate-id` | `/backend/affiliate/my-affiliate-id` | `requireUserOrGarageAdminAsUser` | inline | 59 |
| GET | `/links` | `/backend/affiliate/links` | `requireUserOrGarageAdminAsUser` | inline | 301 |
| POST | `/links` | `/backend/affiliate/links` | `requireUserOrGarageAdminAsUser` | inline | 330 |
| POST | `/click` | `/backend/affiliate/click` | — | inline | 457 |
| POST | `/conversion` | `/backend/affiliate/conversion` | — | inline | 531 |
| GET | `/links/stats` | `/backend/affiliate/links/stats` | `requireUserOrGarageAdminAsUser` | inline | 629 |
| GET | `/offices` | `/backend/affiliate/offices` | `requireUserOrGarageAdmin` | inline | 707 |
| GET | `/catalog` | `/backend/affiliate/catalog` | `requireUserOrGarageAdmin` | inline | 830 |
| GET | `/referrer-info` | `/backend/affiliate/referrer-info` | — | inline | 1074 |
| GET | `/my-referrer` | `/backend/affiliate/my-referrer` | `requireAuth` | inline | 1145 |
| POST | `/change-referrer` | `/backend/affiliate/change-referrer` | `requireAuth` | inline | 1195 |
| GET | `/invite-details` | `/backend/affiliate/invite-details` | — | inline | 1310 |
| GET | `/org-channels/:storeId` | `/backend/affiliate/org-channels/:storeId` | — | inline | 1439 |
| POST | `/request-otp` | `/backend/affiliate/request-otp` | — | inline | 1471 |
| POST | `/check-user` | `/backend/affiliate/check-user` | — | inline | 1538 |
| POST | `/accept-invite` | `/backend/affiliate/accept-invite` | — | inline | 1620 |
| GET | `/stats` | `/backend/affiliate/stats` | `requireAuth` | inline | 1843 |
| GET | `/network` | `/backend/affiliate/network` | `requireAuth` | inline | 1873 |
| GET | `/direct-children/:userId` | `/backend/affiliate/direct-children/:userId` | `requireAuth` | inline | 1910 |
| GET | `/user-info/:userId` | `/backend/affiliate/user-info/:userId` | `requireUserOrGarageAdmin` | inline | 2054 |
| GET | `/search-downline-by-email/:userId` | `/backend/affiliate/search-downline-by-email/:userId` | `requireAuth` | inline | 2193 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2359 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`, `aggregate`, `find`, `countDocuments`; **writes:** `findByIdAndUpdate`, `create`
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`, `findById`, `find`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `findOne`, `find`
  - `AffiliateClick` (server/models/affiliateClick.model.ts) — reads: `countDocuments`; **writes:** `findOneAndUpdate`
  - `AffiliateLink` (server/models/affiliateLink.model.ts) — reads: `find`, `findOne`, `countDocuments`; **writes:** `updateOne`, `create`
  - `Channel` (server/models/channel.model.ts) — reads: `findById`, `find`
  - `AffiliateConversion` (server/models/affiliateConversion.model.ts) — reads: `countDocuments`; **writes:** `findOneAndUpdate`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `aggregate`
  - `Product` (server/models/product.model.ts) — reads: `find`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `find`
  - `Course` (server/models/course.model.ts) — reads: `find`
  - `Service` (server/models/service.model.ts) — reads: `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `find`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `find`, `findOne`
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `find`
- **Raw collections:** `stores`, `productvariants`
- **Environment variables (`process.env`):** `AFFILIATE_BASE_URL`, `IP_HASH_SALT`
- **Timers / queues:** `setInterval` at L177
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/twoFactorSms.ts` — `storablePhone`
  - `server/middleware/userOrGarageAdmin.ts` — `requireUserOrGarageAdmin`, `requireUserOrGarageAdminAsUser`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/floor.model.ts` — `Floor`
  - `server/models/channel.model.ts` — `Channel`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`
  - `server/services/jwt.ts` — `signJwt`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`
  - `server/models/affiliateLink.model.ts` — `AffiliateLink`
  - `server/models/affiliateClick.model.ts` — `AffiliateClick`
  - `server/models/affiliateConversion.model.ts` — `AffiliateConversion`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/combPlan.model.ts` — `CombPlan`
  - `server/models/product.model.ts` — `Product`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/services/catalogVisibility.ts` — `LEGACY_DIGITAL_PRODUCT_FILTER`
  - `server/models/course.model.ts` — `Course`
  - `server/models/service.model.ts` — `Service`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/services/affiliate.ts` — `getReferrerInfo`, `getReferrerInfoByAffiliateId`, `getSponsorCardByAffiliateId`, `getAffiliateStats`, `getAffiliateNetwork`, `ensureUserHasAffiliateId`, `setReferredBy`, `countAllDescendants`, … +1
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
  - `server/models/officePlan.model.ts` — `OFFICE_PLAN_IDS`
  - `server/services/channel.ts` — `getStoreChannels`, `autoJoinEmployeesChannel`, `addUserToChannel`
  - `server/services/affiliateLinksPage.ts` — `linksPageParams`, `paginateByCategory`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `crypto`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/affiliate`.

## Notes

- Large file (2360 lines) — read it by section; line numbers above point into it.
