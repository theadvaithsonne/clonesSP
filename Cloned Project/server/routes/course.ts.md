# `server/routes/course.ts`

> Express router with 31 endpoints, mounted at `/courses`.

**Kind:** Express router · **Lines:** 1451 · **Mounted at:** `/courses` (browser: `/backend/courses`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (31)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/courses` | `requireAuth` | inline | 42 |
| GET | `/admin/enrollments` | `/backend/courses/admin/enrollments` | `requireAuth` | inline | 166 |
| GET | `/manage` | `/backend/courses/manage` | `requireAuth` | inline | 197 |
| GET | `/` | `/backend/courses` | `requireAuth` | inline | 223 |
| GET | `/:courseId` | `/backend/courses/:courseId` | `requireAuth` | inline | 276 |
| PUT | `/:courseId` | `/backend/courses/:courseId` | `requireAuth` | inline | 328 |
| DELETE | `/:courseId` | `/backend/courses/:courseId` | `requireAuth` | inline | 403 |
| POST | `/:courseId/clone` | `/backend/courses/:courseId/clone` | `requireAuth` | inline | 420 |
| POST | `/:courseId/sections` | `/backend/courses/:courseId/sections` | `requireAuth` | inline | 447 |
| PUT | `/:courseId/sections/:sectionId` | `/backend/courses/:courseId/sections/:sectionId` | `requireAuth` | inline | 469 |
| DELETE | `/:courseId/sections/:sectionId` | `/backend/courses/:courseId/sections/:sectionId` | `requireAuth` | inline | 495 |
| POST | `/:courseId/sections/reorder` | `/backend/courses/:courseId/sections/reorder` | `requireAuth` | inline | 516 |
| POST | `/:courseId/sections/:sectionId/chapters` | `/backend/courses/:courseId/sections/:sectionId/chapters` | `requireAuth` | inline | 555 |
| PUT | `/:courseId/sections/:sectionId/chapters/:chapterId` | `/backend/courses/:courseId/sections/:sectionId/chapters/:chapterId` | `requireAuth` | inline | 596 |
| DELETE | `/:courseId/sections/:sectionId/chapters/:chapterId` | `/backend/courses/:courseId/sections/:sectionId/chapters/:chapterId` | `requireAuth` | inline | 640 |
| POST | `/:courseId/sections/:sectionId/chapters/reorder` | `/backend/courses/:courseId/sections/:sectionId/chapters/reorder` | `requireAuth` | inline | 667 |
| POST | `/:courseId/enroll` | `/backend/courses/:courseId/enroll` | `requireAuth` | inline | 699 |
| GET | `/:courseId/enrollment` | `/backend/courses/:courseId/enrollment` | `requireAuth` | inline | 755 |
| GET | `/enrollments/me` | `/backend/courses/enrollments/me` | `requireAuth` | inline | 769 |
| POST | `/:courseId/create-order` | `/backend/courses/:courseId/create-order` | `requireAuth` | inline | 793 |
| POST | `/:courseId/verify-payment` | `/backend/courses/:courseId/verify-payment` | `requireAuth` | inline | 976 |
| POST | `/:courseId/create-subscription` | `/backend/courses/:courseId/create-subscription` | `requireAuth` | inline | 1079 |
| GET | `/:courseId/subscription-status` | `/backend/courses/:courseId/subscription-status` | `requireAuth` | inline | 1194 |
| POST | `/:courseId/chapters/:chapterId/complete` | `/backend/courses/:courseId/chapters/:chapterId/complete` | `requireAuth` | inline | 1237 |
| POST | `/:courseId/chapters/:chapterId/incomplete` | `/backend/courses/:courseId/chapters/:chapterId/incomplete` | `requireAuth` | inline | 1270 |
| POST | `/:courseId/chapters/:chapterId/progress` | `/backend/courses/:courseId/chapters/:chapterId/progress` | `requireAuth` | inline | 1297 |
| POST | `/:courseId/assets` | `/backend/courses/:courseId/assets` | `requireAuth` | inline | 1334 |
| DELETE | `/:courseId/assets/:assetId` | `/backend/courses/:courseId/assets/:assetId` | `requireAuth` | inline | 1364 |
| GET | `/:courseId/stats` | `/backend/courses/:courseId/stats` | `requireAuth` | inline | 1383 |
| POST | `/:courseId/quiz/:chapterId/submit` | `/backend/courses/:courseId/quiz/:chapterId/submit` | `requireAuth` | inline | 1398 |
| GET | `/:courseId/quiz-analytics` | `/backend/courses/:courseId/quiz-analytics` | `requireAuth` | inline | 1430 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1450 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `CourseEnrollment` (server/models/courseEnrollment.model.ts) — reads: `find`, `findOne`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `find`
  - `Course` (server/models/course.model.ts) — reads: `findById`, `findOne`
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `RAZORPAY_KEY_ID`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/rbac.ts` — `isFounderOrModuleAdmin`
  - `server/models/user.model.ts` — `User`
  - `server/models/course.model.ts` — `Course`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
  - `server/services/course.ts` — `* as courseService`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/services/bulkEmail.ts` — `notifyNewCourseCreated`
  - `server/services/razorpay.ts` — `createOrder`, `verifyPaymentSignature`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/utils/gstTax.ts` — `getCommissionBase`
  - `server/utils/gstBuyerRegion.ts` — `isBuyerInIndia`
  - `server/services/subscription.ts` — `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `createUserSubscription`, `hasSubscriptionAccess`, `getUserActiveSubscription`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/courses`.
