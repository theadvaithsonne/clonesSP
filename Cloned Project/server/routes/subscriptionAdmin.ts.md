# `server/routes/subscriptionAdmin.ts`

> Express router with 8 endpoints, mounted at `/subscription-admin`.

**Kind:** Express router · **Lines:** 728 · **Mounted at:** `/subscription-admin` (browser: `/backend/subscription-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (8)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/plans` | `/backend/subscription-admin/plans` | `requireAuth` | inline | 52 |
| GET | `/subscriptions` | `/backend/subscription-admin/subscriptions` | `requireAuth` | inline | 136 |
| GET | `/subscriptions/:subscriptionId` | `/backend/subscription-admin/subscriptions/:subscriptionId` | `requireAuth` | inline | 225 |
| POST | `/subscriptions/:subscriptionId/cancel` | `/backend/subscription-admin/subscriptions/:subscriptionId/cancel` | `requireAuth` | inline | 314 |
| POST | `/subscriptions/:subscriptionId/sync` | `/backend/subscription-admin/subscriptions/:subscriptionId/sync` | `requireAuth` | inline | 388 |
| POST | `/subscriptions/:subscriptionId/extend` | `/backend/subscription-admin/subscriptions/:subscriptionId/extend` | `requireAuth` | inline | 445 |
| GET | `/analytics` | `/backend/subscription-admin/analytics` | `requireAuth` | inline | 531 |
| GET | `/payments` | `/backend/subscription-admin/payments` | `requireAuth` | inline | 653 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 727 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `SubscriptionPlan` (server/models/subscriptionPlan.model.ts) — reads: `find`, `countDocuments`
  - `Subscription` (server/models/subscription.model.ts) — reads: `find`, `countDocuments`, `findOne`, `aggregate`
  - `SubscriptionPayment` (server/models/subscriptionPayment.model.ts) — reads: `find`, `aggregate`, `countDocuments`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/subscriptionPlan.model.ts` — `SubscriptionPlan`
  - `server/models/subscription.model.ts` — `Subscription`
  - `server/models/subscriptionPayment.model.ts` — `SubscriptionPayment`
  - `server/services/subscription.ts` — `cancelUserSubscription`, `syncSubscriptionStatus`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/subscription-admin`.
