# `server/routes/teamforce/payrollRuns.ts`

> Express router with 12 endpoints.

**Kind:** Express router · **Lines:** 1177

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (12)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | — | `requireAuth` | inline | 467 |
| GET | `/me/transactions` | — | `requireAuth` | inline | 650 |
| GET | `/me/form16` | — | `requireAuth` | inline | 699 |
| GET | `/month-summary` | — | `requireAuth` | inline | 778 |
| GET | `/` | — | `requireAuth` | inline | 841 |
| GET | `/:id` | — | `requireAuth` | inline | 858 |
| PATCH | `/:id/transactions/:txId` | — | `requireAuth` | inline | 894 |
| POST | `/:id/approve` | — | `requireAuth` | inline | 939 |
| POST | `/:id/mark-paid` | — | `requireAuth` | inline | 994 |
| POST | `/:id/transactions/:txId/email` | — | `requireAuth` | inline | 1102 |
| POST | `/:id/email-all` | — | `requireAuth` | inline | 1123 |
| DELETE | `/:id` | — | `requireAuth` | inline | 1155 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1176 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceEmployeeProfile` (server/models/teamforce/teamforceEmployeeProfile.model.ts) — reads: `findOne`, `find`
  - `TeamforceSalaryStructure` (server/models/teamforce/teamforceSalaryStructure.model.ts) — reads: `findOne`
  - `TeamforceEmployeeTaxDeclaration` (server/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts) — reads: `findOne`
  - `TeamforcePayrollTransaction` (server/models/teamforce/teamforcePayrollTransaction.model.ts) — reads: `find`, `findOne`; **writes:** `findOneAndUpdate`, `deleteMany`
  - `TeamforcePayrollRun` (server/models/teamforce/teamforcePayrollRun.model.ts) — reads: `findOne`, `findById`, `find`; **writes:** `updateOne`, `create`, `deleteOne`
  - `TeamforcePayrollConfig` (server/models/teamforce/teamforcePayrollConfig.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`
  - `TeamforcePTSlab` (server/models/teamforce/teamforcePTSlab.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforcePayrollRun.model.ts` — `TeamforcePayrollRun`
  - `server/models/teamforce/teamforcePayrollTransaction.model.ts` — `TeamforcePayrollTransaction`
  - `server/models/teamforce/teamforcePayrollConfig.model.ts` — `TeamforcePayrollConfig`
  - `server/models/teamforce/teamforceEmployeeProfile.model.ts` — `TeamforceEmployeeProfile`
  - `server/models/teamforce/teamforceSalaryStructure.model.ts` — `TeamforceSalaryStructure`
  - `server/models/teamforce/teamforcePTSlab.model.ts` — `TeamforcePTSlab`
  - `server/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts` — `TeamforceEmployeeTaxDeclaration`
  - `server/routes/teamforce/_helpers.ts` — `getAuthUser`, `getOrgIdStrict`, `requireTeamforceWriteAccess`
  - `server/services/teamforce/payroll/index.ts` — `computeSection192TDS`, `computePF`, `computeESI`, `computeProfessionalTax`, `determineEsiCoverage`, `getESIPeriod`, `resolveStructure`, `prorateResolved`, … +9
  - `server/services/teamforce/payroll/attendanceLoader.ts` — `loadAttendanceForRun`, `persistDeferredLop`
  - `server/services/teamforce/payroll/slipEmail.ts` — `sendSalarySlipEmail`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
