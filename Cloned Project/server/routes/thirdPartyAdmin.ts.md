# `server/routes/thirdPartyAdmin.ts`

> Express router with 6 endpoints, mounted at `/garage-admin/third-party-clients`.

**Kind:** Express router · **Lines:** 223 · **Mounted at:** `/garage-admin/third-party-clients` (browser: `/backend/garage-admin/third-party-clients`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/clients` | `/backend/garage-admin/third-party-clients/clients` | — | inline | 87 |
| GET | `/clients` | `/backend/garage-admin/third-party-clients/clients` | — | inline | 124 |
| GET | `/clients/:id` | `/backend/garage-admin/third-party-clients/clients/:id` | — | inline | 135 |
| POST | `/clients/:id/rotate-key` | `/backend/garage-admin/third-party-clients/clients/:id/rotate-key` | — | inline | 147 |
| PATCH | `/clients/:id` | `/backend/garage-admin/third-party-clients/clients/:id` | — | inline | 167 |
| DELETE | `/clients/:id` | `/backend/garage-admin/third-party-clients/clients/:id` | — | inline | 210 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L8)
- `requireFounder` (L9)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 222 |

## Interfaces

- **Database (Mongoose models used):**
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `find`, `findById`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `requireFounder`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`, `generateApiKey`, `generateWebhookSecret`, `THIRD_PARTY_SCOPES`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/third-party-clients`.
