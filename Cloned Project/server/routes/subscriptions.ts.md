# `server/routes/subscriptions.ts`

> Express router with 14 endpoints, mounted at `/subscriptions`.

**Kind:** Express router · **Lines:** 813 · **Mounted at:** `/subscriptions` (browser: `/backend/subscriptions`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (14)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/plans` | `/backend/subscriptions/plans` | `requireAuth` | inline | 34 |
| GET | `/plans/:itemType/:itemId` | `/backend/subscriptions/plans/:itemType/:itemId` | — | inline | 92 |
| DELETE | `/plans/:planId` | `/backend/subscriptions/plans/:planId` | `requireAuth` | inline | 142 |
| POST | `/subscribe` | `/backend/subscriptions/subscribe` | `requireAuth` | inline | 189 |
| GET | `/my` | `/backend/subscriptions/my` | `requireAuth` | inline | 234 |
| GET | `/check/:itemType/:itemId` | `/backend/subscriptions/check/:itemType/:itemId` | `requireAuth` | inline | 296 |
| GET | `/:subscriptionId` | `/backend/subscriptions/:subscriptionId` | `requireAuth` | inline | 346 |
| POST | `/:subscriptionId/cancel` | `/backend/subscriptions/:subscriptionId/cancel` | `requireAuth` | inline | 402 |
| POST | `/:subscriptionId/pause` | `/backend/subscriptions/:subscriptionId/pause` | `requireAuth` | inline | 460 |
| POST | `/:subscriptionId/resume` | `/backend/subscriptions/:subscriptionId/resume` | `requireAuth` | inline | 506 |
| POST | `/:subscriptionId/sync` | `/backend/subscriptions/:subscriptionId/sync` | `requireAuth` | inline | 552 |
| GET | `/:subscriptionId/payments` | `/backend/subscriptions/:subscriptionId/payments` | `requireAuth` | inline | 599 |
| GET | `/seller/stats` | `/backend/subscriptions/seller/stats` | `requireAuth` | inline | 679 |
| GET | `/seller/subscribers` | `/backend/subscriptions/seller/subscribers` | `requireAuth` | inline | 747 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 812 |

## Interfaces

- **Database (Mongoose models used):**
  - `SubscriptionPlan` (server/models/subscriptionPlan.model.ts) — reads: `findById`
  - `Subscription` (server/models/subscription.model.ts) — reads: `findById`, `aggregate`, `find`, `countDocuments`
  - `SubscriptionPayment` (server/models/subscriptionPayment.model.ts) — reads: `find`, `countDocuments`, `aggregate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/subscription.ts` — `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `deactivateSubscriptionPlan`, `createUserSubscription`, `getUserSubscription`, `getUserActiveSubscription`, `getUserSubscriptions`, `cancelUserSubscription`, … +4
  - `server/models/subscriptionPlan.model.ts` — `SubscriptionPlan`
  - `server/models/subscription.model.ts` — `Subscription`
  - `server/models/subscriptionPayment.model.ts` — `SubscriptionPayment`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/subscriptions`.

## Notes

- `subscriptions.ts`:50 — TODO: Verify user is the owner/seller of the item
