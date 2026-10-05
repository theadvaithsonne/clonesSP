# `server/models/teamforce/teamforceWeeklyOffPattern.model.ts`

> Mongoose model `TeamforceWeeklyOffPattern` (collection `teamforceweeklyoffpatterns`) with 5 top-level fields.

**Kind:** Mongoose model · **Lines:** 31

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `TeamforceWeeklyOffPattern`

- **Collection:** `teamforceweeklyoffpatterns` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `name` | `String` | required, trim |
| `patternType` | `String` | default "Fixed", enum ["Fixed", "Rotating"] |
| `offDays` | `[Number]` | default [] |
| `isActive` | `Boolean` | default true |

### Indexes

- `{ orgId: 1 }` (L25)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TeamforceWeeklyOffPattern` | model | `model( "TeamforceWeeklyOffPattern", TeamforceWeeklyOffPatternSchema )` | 27 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`

## Used by

- `server/routes/teamforce/weeklyOffPatterns.ts`
- `server/services/teamforce/payroll/attendanceLoader.ts`
