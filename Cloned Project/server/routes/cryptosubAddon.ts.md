# `server/routes/cryptosubAddon.ts`

> Founder-facing routes for the invoice-based cryptosub add-on.

**Kind:** Express router · **Lines:** 95 · **Mounted at:** `/cryptosub-addon` (browser: `/backend/cryptosub-addon`)

<!-- docgen:auto -->

## Purpose
Founder-facing routes for the invoice-based cryptosub add-on.
Mounted at /cryptosub-addon in app.ts.

Endpoints:
  POST /purchase   — start the on-session first charge against a saved card
  GET  /status     — has-access + renew-at for the current org
  GET  /price      — quote base + GST + total for the current buyer

Also mounts an admin-only trigger endpoint for the renewal cron so
staff can run it on demand from /garage-admin.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/purchase` | `/backend/cryptosub-addon/purchase` | `requireAuth`, `requireFounder` | inline | 24 |
| GET | `/status` | `/backend/cryptosub-addon/status` | `requireAuth` | inline | 46 |
| GET | `/price` | `/backend/cryptosub-addon/price` | `requireAuth` | inline | 63 |
| POST | `/admin/renewal-tick` | `/backend/cryptosub-addon/admin/renewal-tick` | `requireGarageAdminAuth` | inline | 78 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 94 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `requireFounder`
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`
  - `server/services/cryptosubAddonPurchase.ts` — `purchaseCryptosubAddon`, `getCryptosubStatus`, `quoteCryptosubPrice`, `runCryptosubRenewalTick`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/cryptosub-addon`.
