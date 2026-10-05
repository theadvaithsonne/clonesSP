# `server/routes/openclawCronTemplates.ts`

> Express router with 5 endpoints, mounted at `/openclaw-templates`.

**Kind:** Express router · **Lines:** 93 · **Mounted at:** `/openclaw-templates` (browser: `/backend/openclaw-templates`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/openclaw-templates` | `requireAuth` | inline | 16 |
| POST | `/` | `/backend/openclaw-templates` | `requireAuth` | inline | 28 |
| POST | `/:templateId/instantiate` | `/backend/openclaw-templates/:templateId/instantiate` | `requireAuth` | inline | 44 |
| PATCH | `/:templateId` | `/backend/openclaw-templates/:templateId` | `requireAuth` | inline | 60 |
| DELETE | `/:templateId` | `/backend/openclaw-templates/:templateId` | `requireAuth` | inline | 77 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 92 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/openclaw.ts` — `callOpenClaw`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/openclaw-templates`.
