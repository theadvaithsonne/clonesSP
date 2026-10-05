# `server/models/deal.model.ts`

> Mongoose model `Deal` (collection `deals`) with 8 top-level fields.

**Kind:** Mongoose model · **Lines:** 34

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `Deal`

- **Collection:** `deals` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `name` | `String` | required, trim |
| `stage` | `String` | index, default "lead", enum ["lead", "qualified", "proposal", "won", "l… |
| `value` | `Number` | default 0 |
| `currency` | `String` | default "USD" |
| `ownerId` | `Schema.Types.ObjectId` | ref "User" |
| `createdBy` | `Schema.Types.ObjectId` | required, ref "User" |
| `nextFollowUp` | `Date` | — |

### Indexes

- `{ name: "text" }` (L31)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Deal` | model | `model("Deal", DealSchema)` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/slashDeals.ts`
