# `server/routes/service.ts`

> Express router with 35 endpoints, mounted at `/services`.

**Kind:** Express router · **Lines:** 2224 · **Mounted at:** `/services` (browser: `/backend/services`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (35)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/services` | `requireAuth` | inline | 286 |
| GET | `/opt-ins/my` | `/backend/services/opt-ins/my` | `requireAuth` | inline | 327 |
| GET | `/payments/pending` | `/backend/services/payments/pending` | `requireAuth` | inline | 348 |
| GET | `/:serviceId` | `/backend/services/:serviceId` | `requireAuth` | inline | 367 |
| POST | `/` | `/backend/services` | `requireAuth` | inline | 434 |
| PUT | `/:serviceId` | `/backend/services/:serviceId` | `requireAuth` | inline | 551 |
| DELETE | `/:serviceId` | `/backend/services/:serviceId` | `requireAuth` | inline | 596 |
| POST | `/:serviceId/milestones` | `/backend/services/:serviceId/milestones` | `requireAuth` | inline | 629 |
| PUT | `/:serviceId/milestones/:milestoneId` | `/backend/services/:serviceId/milestones/:milestoneId` | `requireAuth` | inline | 686 |
| DELETE | `/:serviceId/milestones/:milestoneId` | `/backend/services/:serviceId/milestones/:milestoneId` | `requireAuth` | inline | 724 |
| POST | `/:serviceId/milestones/reorder` | `/backend/services/:serviceId/milestones/reorder` | `requireAuth` | inline | 757 |
| POST | `/:serviceId/opt-in` | `/backend/services/:serviceId/opt-in` | `requireAuth` | inline | 797 |
| GET | `/:serviceId/opt-in` | `/backend/services/:serviceId/opt-in` | `requireAuth` | inline | 828 |
| DELETE | `/opt-ins/:optInId` | `/backend/services/opt-ins/:optInId` | `requireAuth` | inline | 847 |
| POST | `/opt-ins/:optInId/milestones/:milestoneId/start` | `/backend/services/opt-ins/:optInId/milestones/:milestoneId/start` | `requireAuth` | inline | 874 |
| POST | `/opt-ins/:optInId/milestones/:milestoneId/complete` | `/backend/services/opt-ins/:optInId/milestones/:milestoneId/complete` | `requireAuth` | inline | 907 |
| POST | `/opt-ins/:optInId/milestones/:milestoneId/create-order` | `/backend/services/opt-ins/:optInId/milestones/:milestoneId/create-order` | `requireAuth` | inline | 948 |
| POST | `/opt-ins/:optInId/milestones/:milestoneId/verify-payment` | `/backend/services/opt-ins/:optInId/milestones/:milestoneId/verify-payment` | `requireAuth` | inline | 1074 |
| POST | `/:serviceId/reviews` | `/backend/services/:serviceId/reviews` | `requireAuth` | inline | 1196 |
| GET | `/:serviceId/reviews` | `/backend/services/:serviceId/reviews` | `requireAuth` | inline | 1236 |
| PUT | `/reviews/:reviewId` | `/backend/services/reviews/:reviewId` | `requireAuth` | inline | 1261 |
| DELETE | `/reviews/:reviewId` | `/backend/services/reviews/:reviewId` | `requireAuth` | inline | 1285 |
| GET | `/:serviceId/opt-ins` | `/backend/services/:serviceId/opt-ins` | `requireAuth` | inline | 1310 |
| GET | `/:serviceId/stats` | `/backend/services/:serviceId/stats` | `requireAuth` | inline | 1343 |
| POST | `/opt-ins/:optInId/milestones/:milestoneId/attachments` | `/backend/services/opt-ins/:optInId/milestones/:milestoneId/attachments` | `requireAuth` | inline | 1406 |
| DELETE | `/opt-ins/:optInId/milestones/:milestoneId/attachments` | `/backend/services/opt-ins/:optInId/milestones/:milestoneId/attachments` | `requireAuth` | inline | 1488 |
| GET | `/opt-ins/:optInId/milestones/:milestoneId/messages` | `/backend/services/opt-ins/:optInId/milestones/:milestoneId/messages` | `requireAuth` | inline | 1540 |
| POST | `/opt-ins/:optInId/milestones/:milestoneId/messages` | `/backend/services/opt-ins/:optInId/milestones/:milestoneId/messages` | `requireAuth` | inline | 1571 |
| GET | `/opt-ins/:optInId/board` | `/backend/services/opt-ins/:optInId/board` | `requireAuth` | inline | 1671 |
| GET | `/opt-ins/:optInId/files` | `/backend/services/opt-ins/:optInId/files` | `requireAuth` | inline | 1744 |
| GET | `/opt-ins/:optInId/activity` | `/backend/services/opt-ins/:optInId/activity` | `requireAuth` | inline | 1853 |
| GET | `/opt-ins/:optInId/taskroom` | `/backend/services/opt-ins/:optInId/taskroom` | `requireAuth` | inline | 2034 |
| POST | `/opt-ins/:optInId/taskroom/provision` | `/backend/services/opt-ins/:optInId/taskroom/provision` | `requireAuth` | inline | 2073 |
| GET | `/by-taskroom/:roomId` | `/backend/services/by-taskroom/:roomId` | `requireAuth` | inline | 2124 |
| GET | `/:serviceId/taskroom/template` | `/backend/services/:serviceId/taskroom/template` | `requireAuth` | inline | 2193 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2223 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `ServiceOpt` (server/models/serviceOpt.model.ts) — reads: `findOne`, `findById`
  - `Service` (server/models/service.model.ts) — reads: `findById`, `findOne`
  - `ServiceMilestoneMessage` (server/models/serviceMilestoneMessage.model.ts) — reads: `find`, `findById`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/service.model.ts` — `Service`, `IService`, `IServiceHourlyConfig`, `IServiceTaskroomConfig`
  - `server/models/serviceOpt.model.ts` — `ServiceOpt`, `IServiceOpt`
  - `server/models/serviceMilestoneMessage.model.ts` — `ServiceMilestoneMessage`
  - `server/services/bulkEmail.ts` — `notifyNewServiceCreated`
  - `server/services/service.ts` — `createService`, `updateService`, `deleteService`, `getServiceById`, `getServiceBySlug`, `getServices`, `getAvailableServices`, `addMilestone`, … +21
  - `server/services/razorpay.ts` — `createOrder as createRazorpayOrder`, `verifyPaymentSignature`
  - `server/services/taskroomProvision.ts` — `provisionEngagementRoom`, `provisionEngagementRoomAsync`, `getClientBoard`, `getRoomFiles`, `resolveStageTemplates`, `DEFAULT_CLIENT_ACCESS`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/services/channelMembership.ts` — `getUserChannelIds`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/services`.

## Notes

- Large file (2224 lines) — read it by section; line numbers above point into it.
