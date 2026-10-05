# `server/routes/workshop.ts`

> Express router with 35 endpoints, mounted at `/workshops`.

**Kind:** Express router · **Lines:** 3471 · **Mounted at:** `/workshops` (browser: `/backend/workshops`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (35)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/workshops` | `requireAuth` | inline | 100 |
| GET | `/trash` | `/backend/workshops/trash` | `requireAuth` | inline | 185 |
| GET | `/founder-table` | `/backend/workshops/founder-table` | `requireAuth` | inline | 292 |
| GET | `/:workshopId` | `/backend/workshops/:workshopId` | `requireAuth` | inline | 359 |
| POST | `/` | `/backend/workshops` | `requireAuth` | inline | 398 |
| PUT | `/:workshopId` | `/backend/workshops/:workshopId` | `requireAuth` | inline | 597 |
| DELETE | `/:workshopId` | `/backend/workshops/:workshopId` | `requireAuth` | inline | 783 |
| PATCH | `/:workshopId/soft-delete` | `/backend/workshops/:workshopId/soft-delete` | `requireAuth` | inline | 837 |
| POST | `/:workshopId/restore` | `/backend/workshops/:workshopId/restore` | `requireAuth` | inline | 887 |
| POST | `/:workshopId/sessions/:sessionDate/trash` | `/backend/workshops/:workshopId/sessions/:sessionDate/trash` | `requireAuth` | inline | 938 |
| POST | `/:workshopId/sessions/:sessionDate/restore` | `/backend/workshops/:workshopId/sessions/:sessionDate/restore` | `requireAuth` | inline | 1043 |
| GET | `/:workshopId/sessions/:sessionDate/detail` | `/backend/workshops/:workshopId/sessions/:sessionDate/detail` | `requireAuth` | inline | 1184 |
| PUT | `/:workshopId/sessions/:sessionDate` | `/backend/workshops/:workshopId/sessions/:sessionDate` | `requireAuth` | `updateWorkshopSessionHandler` | 1477 |
| PATCH | `/:workshopId/sessions/:sessionDate` | `/backend/workshops/:workshopId/sessions/:sessionDate` | `requireAuth` | `updateWorkshopSessionHandler` | 1482 |
| POST | `/:workshopId/sessions/:sessionDate/revert` | `/backend/workshops/:workshopId/sessions/:sessionDate/revert` | `requireAuth` | inline | 1497 |
| POST | `/:workshopId/register` | `/backend/workshops/:workshopId/register` | `requireAuth` | inline | 1569 |
| POST | `/:workshopId/create-order` | `/backend/workshops/:workshopId/create-order` | `requireAuth` | inline | 1604 |
| POST | `/:workshopId/verify-payment` | `/backend/workshops/:workshopId/verify-payment` | `requireAuth` | inline | 1789 |
| DELETE | `/:workshopId/register` | `/backend/workshops/:workshopId/register` | `requireAuth` | inline | 1890 |
| GET | `/:workshopId/registrations` | `/backend/workshops/:workshopId/registrations` | `requireAuth` | inline | 2021 |
| GET | `/:workshopId/sessions` | `/backend/workshops/:workshopId/sessions` | `requireAuth` | inline | 2067 |
| POST | `/:workshopId/sessions/:sessionDate/register` | `/backend/workshops/:workshopId/sessions/:sessionDate/register` | `requireAuth` | inline | 2122 |
| POST | `/:workshopId/sessions/:sessionDate/create-order` | `/backend/workshops/:workshopId/sessions/:sessionDate/create-order` | `requireAuth` | inline | 2178 |
| POST | `/:workshopId/sessions/:sessionDate/verify-payment` | `/backend/workshops/:workshopId/sessions/:sessionDate/verify-payment` | `requireAuth` | inline | 2390 |
| POST | `/:workshopId/register-full` | `/backend/workshops/:workshopId/register-full` | `requireAuth` | inline | 2514 |
| POST | `/:workshopId/create-order-full` | `/backend/workshops/:workshopId/create-order-full` | `requireAuth` | inline | 2556 |
| POST | `/:workshopId/verify-payment-full` | `/backend/workshops/:workshopId/verify-payment-full` | `requireAuth` | inline | 2705 |
| GET | `/:workshopId/sessions/:sessionDate/access` | `/backend/workshops/:workshopId/sessions/:sessionDate/access` | `requireAuth` | inline | 2809 |
| POST | `/:workshopId/create-subscription` | `/backend/workshops/:workshopId/create-subscription` | `requireAuth` | inline | 2845 |
| GET | `/:workshopId/subscription-status` | `/backend/workshops/:workshopId/subscription-status` | `requireAuth` | inline | 2963 |
| GET | `/:workshopId/analytics` | `/backend/workshops/:workshopId/analytics` | `requireAuth` | inline | 3010 |
| GET | `/:workshopId/analytics/sessions` | `/backend/workshops/:workshopId/analytics/sessions` | `requireAuth` | inline | 3074 |
| POST | `/:workshopId/sync-attendance` | `/backend/workshops/:workshopId/sync-attendance` | `requireAuth` | inline | 3144 |
| POST | `/:workshopId/mark-attended/:userId` | `/backend/workshops/:workshopId/mark-attended/:userId` | `requireAuth` | inline | 3188 |
| POST | `/:workshopId/generate-meeting` | `/backend/workshops/:workshopId/generate-meeting` | `requireAuth` | inline | 3254 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 3470 |

## Interfaces

- **Socket.IO events:**
  - emits: `workshop:created`, `workshop:updated`, `workshop:deleted`, `workshop:soft-deleted`, `workshop:restored`, `workshop:session-trashed`, `workshop:session-restored`, `workshop:session-updated`, `workshop:registration-updated`
- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`, `findOne`, `findById`; **writes:** `findOneAndUpdate`, `updateOne`
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `find`, `findOne`; **writes:** `findOneAndUpdate`
  - `emailAlertsZodSchema` (server/models/emailAlerts.schema.ts) — referenced
  - `founderAlertsZodSchema` (server/models/founderAlerts.schema.ts) — referenced
  - `Meet` (server/models/meet.model.ts) — **writes:** `updateMany`, `create`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `countDocuments`, `findOne`
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `RAZORPAY_KEY_ID`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/rbac.ts` — `isFounderOrModuleAdmin`
  - `server/services/webinarHost.ts` — `getSessionHost`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/founderAlerts.schema.ts` — `founderAlertsZodSchema`, `normalizeFounderAlerts`
  - `server/models/emailAlerts.schema.ts` — `emailAlertsZodSchema`, `normalizeEmailAlerts`
  - `server/services/bulkEmail.ts` — `notifyNewWorkshopCreated`
  - `server/models/meet.model.ts` — `Meet`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/utils/meetCode.ts` — `generateMeetJoinCode`, `generateMeetAgoraChannel`
  - `server/config/env.ts` — `env`
  - `server/services/workshop.ts` — `createWorkshop`, `updateWorkshop`, `deleteWorkshop`, `getWorkshopById`, `getOrgWorkshops`, `getUserAccessibleWorkshops`, `registerForFreeWorkshop`, `registerForPaidWorkshop`, … +12
  - `server/services/founderStreamTable.ts` — `getFounderStreamTable`
  - `server/utils/recurrence.ts` — `parseSessionDate`, `isValidSessionDate`
  - `server/services/razorpay.ts` — `createOrder`, `verifyPaymentSignature`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/utils/gstTax.ts` — `getCommissionBase`
  - `server/utils/gstBuyerRegion.ts` — `isBuyerInIndia`
  - `server/services/subscription.ts` — `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `createUserSubscription`, `hasSubscriptionAccess`, `getUserActiveSubscription`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/utils/workshopStatus.ts` — `enrichSessionsWithStatus`, `sessionDayKey`, `deriveWorkshopStatus`, `deriveClockStatus`, `isSessionDeleted`, `isWorkshopDeleted`
  - `server/utils/sessionOverlay.ts` — `SESSION_EDITABLE_FIELDS`, `hasSessionEdits`, `resolveEffectiveSession`, `resolveSessionPricing`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/workshops`.

## Notes

- Large file (3471 lines) — read it by section; line numbers above point into it.
