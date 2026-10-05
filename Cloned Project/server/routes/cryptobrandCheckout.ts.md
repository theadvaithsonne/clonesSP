# `server/routes/cryptobrandCheckout.ts`

> Cryptobrand checkout status route — GET /org/:orgId/cryptobrand-checkout.

**Kind:** Express router · **Lines:** 200 · **Mounted at:** `/org` (browser: `/backend/org`)

<!-- docgen:auto -->

## Purpose
Cryptobrand checkout status route — GET /org/:orgId/cryptobrand-checkout.

Server-authoritative "does this cryptobrand org still owe its Pro or
Cryptosub bootstrap?" query. Replaces the seller FE's session-storage
tracking (which is empty on login and dropped when picking an
existing org). Returns the pending invoice(s) if any are unpaid, so
the FE can redirect the founder straight into the invoice pay page.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:orgId/cryptobrand-checkout` | `/backend/org/:orgId/cryptobrand-checkout` | `requireAuth` | inline | 40 |
| POST | `/:orgId/cryptobrand-upgrade` | `/backend/org/:orgId/cryptobrand-upgrade` | `requireAuth` | inline | 105 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 199 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `exists`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/services/cryptobrandCheckoutStatus.ts` — `getCryptobrandCheckoutStatus`
  - `server/services/officePlanStatus.ts` — `getOfficePlanStatusForOrg`
  - `server/services/cryptobrandOfficeBootstrap.ts` — `mintProOfficeInvoice`, `mintCryptosubInvoice`
  - `server/services/officeAddonSubscription.ts` — `hasActiveAddon`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/org`.
