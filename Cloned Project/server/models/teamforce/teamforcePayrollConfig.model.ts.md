# `server/models/teamforce/teamforcePayrollConfig.model.ts`

> Mongoose model `TeamforcePayrollConfig` (collection `teamforcepayrollconfigs`) with 6 top-level fields.

**Kind:** Mongoose model · **Lines:** 30

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `TeamforcePayrollConfig`

- **Collection:** `teamforcepayrollconfigs` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Types.ObjectId` | required, unique, ref "Organization" |
| `attendanceCutoffDay` | `Number` | required, default 1 |
| `defaultState` | `String` | trim, default "Karnataka" |
| `fyStartMonth` | `Number` | default 4 |
| `locked` | `Boolean` | default false |
| `lockedSince` | `Date` | default null |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TeamforcePayrollConfig` | model | `model( "TeamforcePayrollConfig", TeamforcePayrollConfigSchema )` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/teamforce/payrollConfig.ts`
- `server/routes/teamforce/payrollRuns.ts`
