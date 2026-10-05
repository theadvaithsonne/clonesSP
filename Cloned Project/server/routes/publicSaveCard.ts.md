# `server/routes/publicSaveCard.ts`

> Public unauthenticated exchange for the admin-initiated save-card link (see garageAdminSavedCards.ts::create-add-link).

**Kind:** Express router · **Lines:** 116 · **Mounted at:** `/public/save-card` (browser: `/backend/public/save-card`)

<!-- docgen:auto -->

## Purpose
Public unauthenticated exchange for the admin-initiated save-card
link (see garageAdminSavedCards.ts::create-add-link).

Flow:
  1. Super-admin mints a link via
     POST /garage-admin/users/:userId/saved-cards/create-add-link.
  2. Admin sends the URL `${FE}/save-card/<token>` to the user.
  3. User opens the URL. FE page calls this endpoint to exchange
     the token for the SetupIntent's client_secret + publishable
     key + display context (email/name so the page can greet them).
  4. FE renders Stripe Elements bound to the SetupIntent, user
     enters card + confirms mandate, existing
     `setup_intent.succeeded` webhook persists the PM to the User
     doc — same code path as the user's own settings page.

The token IS the auth for this call — no bearer needed. It's a […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/exchange` | `/backend/public/save-card/exchange` | — | inline | 45 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 115 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `STRIPE_PUBLISHABLE_KEY`

## Dependencies

- **Internal:**
  - `server/services/jwt.ts` — `verifyJwt`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/save-card`.
