# `server/routes/public.ts`

> Express router with 31 endpoints, mounted at `/public`.

**Kind:** Express router · **Lines:** 3759 · **Mounted at:** `/public` (browser: `/backend/public`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (31)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/hq-organizations` | `/backend/public/hq-organizations` | — | inline | 42 |
| GET | `/hq-organizations/:orgId` | `/backend/public/hq-organizations/:orgId` | — | inline | 213 |
| GET | `/all-founders` | `/backend/public/all-founders` | — | inline | 324 |
| GET | `/all-stakeholders` | `/backend/public/all-stakeholders` | — | inline | 426 |
| GET | `/all-affiliates-customers` | `/backend/public/all-affiliates-customers` | — | inline | 523 |
| GET | `/total-hours-monitored` | `/backend/public/total-hours-monitored` | — | inline | 618 |
| GET | `/cities-count` | `/backend/public/cities-count` | — | inline | 656 |
| GET | `/tracker-stats` | `/backend/public/tracker-stats` | — | inline | 703 |
| GET | `/courses/:courseId` | `/backend/public/courses/:courseId` | — | inline | 824 |
| GET | `/workshops/:workshopId` | `/backend/public/workshops/:workshopId` | — | inline | 1057 |
| GET | `/products/:productId` | `/backend/public/products/:productId` | — | inline | 1312 |
| GET | `/channels/:channelId` | `/backend/public/channels/:channelId` | — | inline | 1557 |
| GET | `/testimonials/:orgSlug` | `/backend/public/testimonials/:orgSlug` | — | inline | 1770 |
| GET | `/testimonials/:orgSlug/categories` | `/backend/public/testimonials/:orgSlug/categories` | — | inline | 1902 |
| GET | `/testimonials/:orgSlug/:testimonialSlug` | `/backend/public/testimonials/:orgSlug/:testimonialSlug` | — | inline | 1938 |
| GET | `/calls/:orgId` | `/backend/public/calls/:orgId` | — | inline | 2053 |
| GET | `/calls/:orgId/:callId` | `/backend/public/calls/:orgId/:callId` | — | inline | 2258 |
| GET | `/sellable-items` | `/backend/public/sellable-items` | — | inline | 2554 |
| GET | `/organizations/:slug` | `/backend/public/organizations/:slug` | — | inline | 2701 |
| GET | `/sellable-items/:type/:id` | `/backend/public/sellable-items/:type/:id` | — | inline | 2810 |
| GET | `/all-affiliates` | `/backend/public/all-affiliates` | — | inline | 2887 |
| GET | `/posts/:postId` | `/backend/public/posts/:postId` | — | inline | 2955 |
| GET | `/playlists/:playlistId` | `/backend/public/playlists/:playlistId` | — | inline | 3044 |
| GET | `/recordings/:recordingId` | `/backend/public/recordings/:recordingId` | — | inline | 3233 |
| GET | `/videos/:videoId` | `/backend/public/videos/:videoId` | — | inline | 3338 |
| GET | `/organizations/:orgId/users` | `/backend/public/organizations/:orgId/users` | — | inline | 3420 |
| GET | `/owner-by-email` | `/backend/public/owner-by-email` | `requireClientKey` | inline | 3496 |
| POST | `/install-intent` | `/backend/public/install-intent` | — | inline | 3620 |
| POST | `/install-intent/claim` | `/backend/public/install-intent/claim` | — | inline | 3668 |
| POST | `/pending-invite` | `/backend/public/pending-invite` | — | inline | 3701 |
| POST | `/pending-invite/lookup` | `/backend/public/pending-invite/lookup` | — | inline | 3739 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 3758 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`, `findById`, `distinct`, `countDocuments`, `findOne`
  - `User` (server/models/user.model.ts) — reads: `find`, `countDocuments`, `distinct`, `findById`, `findOne`
  - `TimeTracking` (server/models/timeTracking.model.ts) — reads: `aggregate`
  - `Course` (server/models/course.model.ts) — reads: `findById`, `find`
  - `Channel` (server/models/channel.model.ts) — reads: `find`, `findById`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `findOne`, `find`
  - `CourseEnrollment` (server/models/courseEnrollment.model.ts) — reads: `countDocuments`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`, `find`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `countDocuments`
  - `Product` (server/models/product.model.ts) — reads: `findById`, `find`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `countDocuments`
  - `Testimonial` (server/models/testimonial.model.ts) — reads: `find`, `countDocuments`, `distinct`, `findOne`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `find`, `countDocuments`, `findOne`, `findById`
  - `CallPurchase` (server/models/callPurchase.model.ts) — reads: `countDocuments`
  - `CallBooking` (server/models/callBooking.model.ts) — reads: `countDocuments`, `find`
  - `Service` (server/models/service.model.ts) — reads: `find`, `findById`
  - `InstallIntent` (server/models/installIntent.model.ts) — reads: `countDocuments`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/middleware/clientKey.ts` — `requireClientKey`
  - `server/models/timeTracking.model.ts` — `TimeTracking`
  - `server/utils/geocoding.ts` — `getCoordinatesFromAddress`
  - `server/models/course.model.ts` — `Course`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/combPlan.model.ts` — `CombPlan`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/product.model.ts` — `Product`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/testimonial.model.ts` — `Testimonial`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/callPurchase.model.ts` — `CallPurchase`
  - `server/models/callBooking.model.ts` — `CallBooking`
  - `server/models/service.model.ts` — `Service`
  - `server/utils/recordingTime.ts` — `recordingStartedAt`
  - `server/services/installIntent.ts` — `claimIntent`, `clientIp`, `hashIp`, `recordIntent`, `MATCH_WINDOW_MS`, `Fingerprint`
  - `server/models/installIntent.model.ts` — `InstallIntent`
  - `server/services/identifier.ts` — `classifyIdentifier`
  - `server/services/otpRateLimit.ts` — `callerKey`
  - `server/services/pendingInvite.ts` — `allowInviteRequest`, `lookupPendingInvite`, `savePendingInvite`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public`.

## Notes

- Large file (3759 lines) — read it by section; line numbers above point into it.
