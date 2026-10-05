# `server/routes/teamforce/taxDeclaration.ts`

> Express router with 6 endpoints.

**Kind:** Express router · **Lines:** 415

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | — | `requireAuth` | inline | 82 |
| POST | `/` | — | `requireAuth` | inline | 102 |
| POST | `/lock` | — | `requireAuth` | inline | 137 |
| GET | `/org-summary` | — | `requireAuth` | inline | 165 |
| POST | `/unlock` | — | `requireAuth` | inline | 216 |
| GET | `/regime-preview` | — | `requireAuth` | inline | 249 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 414 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceEmployeeTaxDeclaration` (server/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts) — reads: `findOne`, `find`; **writes:** `findOneAndUpdate`
  - `TeamforceEmployeeProfile` (server/models/teamforce/teamforceEmployeeProfile.model.ts) — reads: `find`, `findOne`
  - `TeamforcePTSlab` (server/models/teamforce/teamforcePTSlab.model.ts) — reads: `find`
  - `TeamforceSalaryStructure` (server/models/teamforce/teamforceSalaryStructure.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts` — `TeamforceEmployeeTaxDeclaration`
  - `server/models/teamforce/teamforceEmployeeProfile.model.ts` — `TeamforceEmployeeProfile`
  - `server/models/teamforce/teamforcePTSlab.model.ts` — `TeamforcePTSlab`
  - `server/models/teamforce/teamforceSalaryStructure.model.ts` — `TeamforceSalaryStructure`
  - `server/routes/teamforce/_helpers.ts` — `getAuthUser`, `getOrgIdStrict`, `hasFullAccess`
  - `server/services/teamforce/payroll/index.ts` — `computeSection192TDS`, `resolveStructure`, `ageOnDate`, `PTSlab`, `CityType`, `Regime`, `RawStructure`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
