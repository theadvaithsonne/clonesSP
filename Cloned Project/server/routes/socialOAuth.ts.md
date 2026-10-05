# `server/routes/socialOAuth.ts`

> src/routes/socialOAuth.ts OAuth flows for social media platforms — YouTube and Instagram.

**Kind:** Express router · **Lines:** 364 · **Mounted at:** `/social-oauth` (browser: `/backend/social-oauth`)

<!-- docgen:auto -->

## Purpose
src/routes/socialOAuth.ts
OAuth flows for social media platforms — YouTube and Instagram.

GET  /social-oauth/:platform/authorize   → Redirect user to platform OAuth
GET  /social-oauth/:platform/callback    → Handle OAuth callback, store tokens
POST /social-oauth/:platform/disconnect  → Revoke and remove tokens

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:platform/authorize` | `/backend/social-oauth/:platform/authorize` | `requireAuth` | inline | 56 |
| GET | `/:platform/callback` | `/backend/social-oauth/:platform/callback` | — | inline | 105 |
| POST | `/:platform/disconnect` | `/backend/social-oauth/:platform/disconnect` | `requireAuth` | inline | 268 |
| POST | `/:platform/refresh` | `/backend/social-oauth/:platform/refresh` | `requireAuth` | inline | 297 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 363 |

## Interfaces

- **External HTTP calls:**
  - `GET https://graph.facebook.com/v22.0/me/accounts?access_token=${tokenData.access_token}` (L186)
  - `GET https://graph.facebook.com/v22.0/${page.id}?fields=instagram_business_account&access_token=${tokenData.access_token}` (L192)
  - `GET https://graph.instagram.com/v22.0/${igId}?fields=username&access_token=${tokenData.access_token}` (L199)
  - `GET https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true` (L210)
- **Database (Mongoose models used):**
  - `SocialAccount` (server/models/socialAccount.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`
- **Environment variables (`process.env`):** `META_APP_ID`, `META_APP_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_REDIRECT_BASE`
- **External hosts mentioned in the code:** `graph.facebook.com`, `www.googleapis.com`, `graph.instagram.com`, `www.facebook.com`, `accounts.google.com`, `oauth2.googleapis.com`, `www.instagram.com`, `www.youtube.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/socialAccount.model.ts` — `SocialAccount`
  - `server/services/viewTracking.ts` — `extractUsername`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `crypto`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/social-oauth`.
