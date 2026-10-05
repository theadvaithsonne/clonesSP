# `server/routes/deals.ts`

> src/routes/deals.ts

**Kind:** Express router · **Lines:** 318 · **Mounted at:** `/deals` (browser: `/backend/deals`)

<!-- docgen:auto -->

## Purpose
src/routes/deals.ts

Deals feed API — Garage Connect → Deals tab.

  GET    /deals                        the feed (newest first, cursor paged)
  GET    /deals/stats                  four platform totals + all-time series (header cards)
  GET    /deals/:dealId                one deal
  PUT    /deals/:dealId/reaction       react / change reaction
  DELETE /deals/:dealId/reaction       remove mine
  GET    /deals/:dealId/reactions      who reacted
  GET    /deals/:dealId/comments       comments, newest first
  POST   /deals/:dealId/comments       add one
  DELETE /deals/:dealId/comments/:id   soft-delete your own

Reading the feed uses softAuth: the timeline is the same for everyone, and
a token only adds `reactions.mine`. Writing needs a real user. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (9)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/deals` | `softAuth` | inline | 54 |
| GET | `/stats` | `/backend/deals/stats` | — | inline | 80 |
| GET | `/:dealId` | `/backend/deals/:dealId` | `softAuth` | inline | 90 |
| PUT | `/:dealId/reaction` | `/backend/deals/:dealId/reaction` | `requireAuth` | inline | 107 |
| DELETE | `/:dealId/reaction` | `/backend/deals/:dealId/reaction` | `requireAuth` | inline | 132 |
| GET | `/:dealId/reactions` | `/backend/deals/:dealId/reactions` | `softAuth` | inline | 150 |
| GET | `/:dealId/comments` | `/backend/deals/:dealId/comments` | `softAuth` | inline | 191 |
| POST | `/:dealId/comments` | `/backend/deals/:dealId/comments` | `requireAuth` | inline | 241 |
| DELETE | `/:dealId/comments/:commentId` | `/backend/deals/:dealId/comments/:commentId` | `requireAuth` | inline | 286 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 317 |

## Interfaces

- **Database (Mongoose models used):**
  - `DealReaction` (server/models/dealReaction.model.ts) — reads: `countDocuments`, `find`; **writes:** `updateOne`, `deleteOne`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `DealComment` (server/models/dealComment.model.ts) — reads: `find`, `countDocuments`, `findById`, `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `softAuth`, `AuthRequest`
  - `server/utils/http.ts` — `ok`, `fail`
  - `server/services/deals.ts` — `listDeals`, `getDeal`, `getDealStats`, `dealExists`, `isValidDealId`
  - `server/models/dealReaction.model.ts` — `DealReaction`
  - `server/models/dealComment.model.ts` — `DealComment`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/deals`.
