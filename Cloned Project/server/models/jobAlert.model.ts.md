# `server/models/jobAlert.model.ts`

> src/models/jobAlert.model.ts

**Kind:** Mongoose model · **Lines:** 64

<!-- docgen:auto -->

## Purpose
src/models/jobAlert.model.ts

A saved Garage Jobs search a member wants to hear about. The sweeper
(services/jobsSweeper.ts) emails new matching postings — instantly, daily or
weekly on `weekday` — and `lastSentAt` marks where the next digest starts.
Criteria use the same shape and matching as GET /jobs/discover
(services/jobSearch.ts), so an alert finds exactly what the search showed.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `JobAlert`

- **Collection:** `jobalerts` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, ref "User" |
| `name` | `String` | required, trim |
| `criteria` | `{ q, location, workplace, employmentType, experience, salaryMin, department }` | nested |
| `frequency` | `String` | default "daily", enum ALERT_FREQUENCIES |
| `weekday` | `Number` | — |
| `active` | `Boolean` | default true |
| `lastSentAt` | `Date` | — |

### Indexes

- `{ active: 1, frequency: 1 }` (L60)
- `{ userId: 1, createdAt: -1 }` (L61)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ALERT_FREQUENCIES` | const | `= ["instant", "daily", "weekly"] as const` | 12 |
| `AlertFrequency` | type |  | 13 |
| `IJobAlertCriteria` | interface |  | 15 |
| `IJobAlert` | interface |  | 25 |
| `JobAlert` | model | `model<IJobAlert>("JobAlert", JobAlertSchema)` | 63 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/jobPosting.model.ts` — `EMPLOYMENT_TYPES`, `WORKPLACE_TYPES`
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/routes/jobsCandidate.ts`
- `server/services/jobSearch.ts`
- `server/services/jobsSweeper.ts`
