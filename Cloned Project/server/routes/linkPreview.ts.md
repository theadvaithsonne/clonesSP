# `server/routes/linkPreview.ts`

> src/routes/linkPreview.ts Fetch Open Graph / oEmbed metadata for a URL (used for submission previews).

**Kind:** Express router · **Lines:** 181 · **Mounted at:** `/link-preview` (browser: `/backend/link-preview`)

<!-- docgen:auto -->

## Purpose
src/routes/linkPreview.ts
Fetch Open Graph / oEmbed metadata for a URL (used for submission previews).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/youtube-channel-check` | `/backend/link-preview/youtube-channel-check` | `requireAuth` | inline | 23 |
| GET | `/` | `/backend/link-preview` | `requireUserOrGarageAdmin` | inline | 108 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 180 |

## Interfaces

- **External HTTP calls:**
  - `GET https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json` (L116)
  - `GET https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}` (L121)
- **Database (Mongoose models used):**
  - `SocialAccount` (server/models/socialAccount.model.ts) — reads: `findOne`
- **External hosts mentioned in the code:** `www.youtube.com`, `www.tiktok.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/middleware/userOrGarageAdmin.ts` — `requireUserOrGarageAdmin`
  - `server/models/socialAccount.model.ts` — `SocialAccount`
  - `server/services/viewTracking.ts` — `extractPlatformPostId`, `fetchYouTubeVideoChannelId`, `resolveYouTubeChannelId`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/link-preview`.
