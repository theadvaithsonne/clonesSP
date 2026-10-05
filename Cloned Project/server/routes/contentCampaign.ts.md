# `server/routes/contentCampaign.ts`

> src/routes/contentCampaign.ts Content Rewards campaign management — Founder CRUD + analytics.

**Kind:** Express router · **Lines:** 822 · **Mounted at:** `/content-campaigns` (browser: `/backend/content-campaigns`)

<!-- docgen:auto -->

## Purpose
src/routes/contentCampaign.ts
Content Rewards campaign management — Founder CRUD + analytics.

POST   /content-campaigns              → Create campaign
GET    /content-campaigns              → List org campaigns
GET    /content-campaigns/:id          → Get campaign details
PATCH  /content-campaigns/:id          → Update campaign
DELETE /content-campaigns/:id          → Archive campaign
GET    /content-campaigns/:id/stats    → Campaign analytics
GET    /content-campaigns/active       → List active campaigns (any auth user)

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (11)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/active` | `/backend/content-campaigns/active` | `requireAuth` | inline | 48 |
| POST | `/:id/join` | `/backend/content-campaigns/:id/join` | `requireAuth` | inline | 95 |
| POST | `/:id/leave` | `/backend/content-campaigns/:id/leave` | `requireAuth` | inline | 140 |
| POST | `/` | `/backend/content-campaigns` | `requireAuth`, `requireFounder` | inline | 214 |
| GET | `/` | `/backend/content-campaigns` | `requireAuth`, `requireFounder` | inline | 290 |
| GET | `/:id` | `/backend/content-campaigns/:id` | `requireAuth` | inline | 323 |
| PATCH | `/:id` | `/backend/content-campaigns/:id` | `requireAuth`, `requireFounder` | inline | 388 |
| DELETE | `/:id` | `/backend/content-campaigns/:id` | `requireAuth`, `requireFounder` | inline | 485 |
| GET | `/:id/stats` | `/backend/content-campaigns/:id/stats` | `requireAuth`, `requireFounder` | inline | 550 |
| GET | `/:id/wallet` | `/backend/content-campaigns/:id/wallet` | `requireAuth`, `requireFounder` | inline | 661 |
| POST | `/:id/wallet/transfer` | `/backend/content-campaigns/:id/wallet/transfer` | `requireAuth`, `requireFounder` | inline | 740 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 821 |

## Interfaces

- **Database (Mongoose models used):**
  - `ContentCampaign` (server/models/contentCampaign.model.ts) — reads: `find`, `findById`, `findOne`; **writes:** `updateOne`, `create`, `findOneAndUpdate`
  - `ContentSubmission` (server/models/contentSubmission.model.ts) — reads: `find`, `countDocuments`, `aggregate`; **writes:** `updateMany`
  - `CAMPAIGN_STATUSES` (server/models/contentCampaign.model.ts) — referenced
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `requireFounder`
  - `server/models/contentCampaign.model.ts` — `ContentCampaign`, `CAMPAIGN_TYPES`, `CAMPAIGN_STATUSES`, `CAMPAIGN_CURRENCIES`, `SOCIAL_PLATFORMS`
  - `server/models/contentSubmission.model.ts` — `ContentSubmission`
  - `server/models/user.model.ts` — `User`
  - `server/services/wallet.ts` — `getStoreWalletBalance`, `getOrCreateStoreWallet`
  - `server/services/campaignWallet.ts` — `lockBudgetForCampaign`, `refundCampaignToFounder`, `getCampaignWalletByCampaignId`, `getCampaignWalletTransactions`, `transferCampaignToUserWallet`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/content-campaigns`.
