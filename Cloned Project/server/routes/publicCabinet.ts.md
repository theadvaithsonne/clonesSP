# `server/routes/publicCabinet.ts`

> Express router with 2 endpoints, mounted at `/public/f`.

**Kind:** Express router · **Lines:** 15 · **Mounted at:** `/public/f` (browser: `/backend/public/f`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:token/meta` | `/backend/public/f/:token/meta` | — | `ShareableLinkController.getLinkMeta` | 9 |
| GET | `/:token` | `/backend/public/f/:token` | — | `ShareableLinkController.accessExternalLink` | 12 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/controllers/shareableLink.controller.ts` — `ShareableLinkController`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/f`.
