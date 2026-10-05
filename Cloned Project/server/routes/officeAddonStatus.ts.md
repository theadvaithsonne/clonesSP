# `server/routes/officeAddonStatus.ts`

> Express router with 4 endpoints, mounted at `/office-addon-subscription`.

**Kind:** Express router · **Lines:** 240 · **Mounted at:** `/office-addon-subscription` (browser: `/backend/office-addon-subscription`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/status` | `/backend/office-addon-subscription/status` | `requireAuth` | inline | 20 |
| GET | `/payments` | `/backend/office-addon-subscription/payments` | `requireAuth` | inline | 87 |
| GET | `/check/:addonSlug` | `/backend/office-addon-subscription/check/:addonSlug` | `requireAuth` | inline | 150 |
| GET | `/active` | `/backend/office-addon-subscription/active` | `requireAuth` | inline | 175 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 239 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/officeAddonSubscription.ts` — `getOfficeAddonSubscriptions`, `getActiveOfficeAddonSubscription`, `getOfficeAddonPayments`, `hasActiveAddon`
  - `server/models/officeAddon.model.ts` — `calculateAddonTaxAmounts`, `ADDON_GST_CONFIG`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/office-addon-subscription`.
