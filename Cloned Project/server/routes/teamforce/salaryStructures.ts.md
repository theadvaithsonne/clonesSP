# `server/routes/teamforce/salaryStructures.ts`

> Express router with 5 endpoints.

**Kind:** Express router · **Lines:** 157

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/defaults` | — | `requireAuth` | inline | 65 |
| GET | `/` | — | `requireAuth` | inline | 69 |
| POST | `/` | — | `requireAuth` | inline | 83 |
| PATCH | `/:id` | — | `requireAuth` | inline | 109 |
| DELETE | `/:id` | — | `requireAuth` | inline | 143 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 156 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceSalaryStructure` (server/models/teamforce/teamforceSalaryStructure.model.ts) — reads: `find`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforceSalaryStructure.model.ts` — `TeamforceSalaryStructure`, `COMPONENT_CODES`, `TAXABILITY_TYPES`, `CALC_TYPES`, `TAX_REGIMES`, `buildDefaultSalaryStructureComponents`
  - `server/routes/teamforce/_helpers.ts` — `getOrgIdStrict`, `requireTeamforceWriteAccess`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
