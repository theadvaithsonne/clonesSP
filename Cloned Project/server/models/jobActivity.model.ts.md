# `server/models/jobActivity.model.ts`

> src/models/jobActivity.model.ts

**Kind:** Mongoose model · **Lines:** 69

<!-- docgen:auto -->

## Purpose
src/models/jobActivity.model.ts

The timeline of one application: every stage move, score, interview, offer
and internal note. Notes live here too (type "note") so the profile drawer's
Activity and Notes tabs read one collection; the candidate never sees any of it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `JobActivity`

- **Collection:** `jobactivities` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `jobId` | `Schema.Types.ObjectId` | required, ref "JobPosting" |
| `applicationId` | `Schema.Types.ObjectId` | required, ref "JobApplication" |
| `actorId` | `Schema.Types.ObjectId` | ref "User" |
| `type` | `String` | required, enum JOB_ACTIVITY_TYPES |
| `text` | `String` | default "" |
| `mentions` | `[Schema.Types.ObjectId]` | ref "User" |
| `data` | `Schema.Types.Mixed` | — |

### Indexes

- `{ applicationId: 1, createdAt: -1 }` (L65)
- `{ orgId: 1, createdAt: -1 }` (L66)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JOB_ACTIVITY_TYPES` | const | `= [ "applied", "auto_scored", "knockout", "stage_moved", "rejected", "withdrawn", "note",…` | 9 |
| `JobActivityType` | type |  | 30 |
| `IJobActivity` | interface |  | 32 |
| `JobActivity` | model | `model<IJobActivity>("JobActivity", JobActivitySchema)` | 68 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/routes/jobsFounder.ts`
- `server/services/jobs.ts`
