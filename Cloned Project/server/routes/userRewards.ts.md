# `server/routes/userRewards.ts`

> Express router with 8 endpoints, mounted at `/me/rewards`.

**Kind:** Express router · **Lines:** 442 · **Mounted at:** `/me/rewards` (browser: `/backend/me/rewards`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (8)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/me/rewards` | `requireAuth` | inline | 27 |
| POST | `/:id/gift` | `/backend/me/rewards/:id/gift` | `requireAuth` | inline | 163 |
| GET | `/offers/incoming` | `/backend/me/rewards/offers/incoming` | `requireAuth` | inline | 317 |
| GET | `/offers/outgoing` | `/backend/me/rewards/offers/outgoing` | `requireAuth` | inline | 328 |
| POST | `/offers/:id/approve` | `/backend/me/rewards/offers/:id/approve` | `requireAuth` | inline | 339 |
| POST | `/offers/:id/reject` | `/backend/me/rewards/offers/:id/reject` | `requireAuth` | inline | 358 |
| POST | `/offers/:id/cancel` | `/backend/me/rewards/offers/:id/cancel` | `requireAuth` | inline | 377 |
| GET | `/offers/recipient-eligibility` | `/backend/me/rewards/offers/recipient-eligibility` | `requireAuth` | inline | 411 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 441 |

## Interfaces

- **Database (Mongoose models used):**
  - `CouponAssignment` (server/models/couponAssignment.model.ts) — reads: `find`
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`, `findOne`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/models/couponAssignment.model.ts` — `CouponAssignment`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/couponAssignment.ts` — `transferAssignment`
  - `server/services/pendingCouponGift.ts` — `PendingGiftError`, `approvePendingGift`, `cancelPendingGift`, `createPendingGift`, `listIncomingPending`, `listOutgoingPending`, `rejectPendingGift`, `searchRecipientEligibility`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`, `ZodError`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/me/rewards`.
