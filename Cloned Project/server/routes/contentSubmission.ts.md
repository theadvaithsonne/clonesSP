# `server/routes/contentSubmission.ts`

> src/routes/contentSubmission.ts Content Rewards submission management.

**Kind:** Express router · **Lines:** 801 · **Mounted at:** `/content-submissions` (browser: `/backend/content-submissions`)

<!-- docgen:auto -->

## Purpose
src/routes/contentSubmission.ts
Content Rewards submission management.

POST   /content-submissions                          → Submit a post URL
GET    /content-submissions                          → List user's submissions
GET    /content-submissions/earnings                 → User's earnings summary
GET    /content-submissions/campaign/:campaignId     → Founder: list campaign submissions
GET    /content-submissions/:id/live-views           → Founder: live view count for review screen
PATCH  /content-submissions/:id/review               → Founder: approve/reject

Payouts are no longer triggered manually. They run via the hourly
contentPayoutSweeper, which debits the CampaignWallet and credits the
affiliate's NC Wallet atomically inside one Mongo transaction.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (8)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/content-submissions` | `requireAuth` | inline | 55 |
| GET | `/` | `/backend/content-submissions` | `requireAuth` | inline | 254 |
| GET | `/earnings` | `/backend/content-submissions/earnings` | `requireAuth` | inline | 289 |
| GET | `/campaign/:campaignId` | `/backend/content-submissions/campaign/:campaignId` | `requireAuth`, `requireFounder` | inline | 379 |
| GET | `/:id/live-views` | `/backend/content-submissions/:id/live-views` | `requireAuth`, `requireFounder` | inline | 428 |
| PATCH | `/:id/review` | `/backend/content-submissions/:id/review` | `requireAuth`, `requireFounder` | inline | 496 |
| POST | `/:id/refresh-views` | `/backend/content-submissions/:id/refresh-views` | `requireAuth` | inline | 617 |
| POST | `/campaign/:campaignId/refresh-views` | `/backend/content-submissions/campaign/:campaignId/refresh-views` | `requireAuth`, `requireFounder` | inline | 719 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `recalcCampaignTotalViews` | function | `async recalcCampaignTotalViews(campaignId: Types.ObjectId)` | 29 |
| `default (router)` | default |  | 800 |

## Interfaces

- **Database (Mongoose models used):**
  - `ContentSubmission` (server/models/contentSubmission.model.ts) — reads: `aggregate`, `find`, `findById`; **writes:** `create`
  - `ContentCampaign` (server/models/contentCampaign.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `SocialAccount` (server/models/socialAccount.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `requireFounder`
  - `server/models/contentSubmission.model.ts` — `ContentSubmission`
  - `server/models/contentCampaign.model.ts` — `ContentCampaign`
  - `server/models/socialAccount.model.ts` — `SocialAccount`
  - `server/services/viewTracking.ts` — `detectPlatform`, `extractPlatformPostId`, `fetchViewsAuto`, `extractUsernameFromPostUrl`, `fetchYouTubeVideoChannelId`, `resolveYouTubeChannelId`
  - `server/services/contentPayoutSweeper.ts` — `sweepContentPayouts`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`
- `server/services/contentPayoutSweeper.ts`

Entry: mounted in `server/app.ts` at `/content-submissions`.
