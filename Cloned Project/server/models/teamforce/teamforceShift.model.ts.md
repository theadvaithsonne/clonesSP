# `server/models/teamforce/teamforceShift.model.ts`

> Mongoose model `TeamforceShift` (collection `teamforceshifts`) with 8 top-level fields.

**Kind:** Mongoose model · **Lines:** 24

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `TeamforceShift`

- **Collection:** `teamforceshifts` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `name` | `String` | required, trim |
| `startTime` | `String` | required |
| `endTime` | `String` | required |
| `workingHours` | `Number` | default 0 |
| `graceMinutes` | `Number` | default 0 |
| `breakMinutes` | `Number` | default 0 |
| `isActive` | `Boolean` | default true |

### Indexes

- `{ orgId: 1 }` (L21)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TeamforceShift` | model | `model("TeamforceShift", TeamforceShiftSchema)` | 23 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`

## Used by

- `server/routes/teamforce/shifts.ts`
