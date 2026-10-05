# `server/models/dealComment.model.ts`

> Mongoose model `DealComment` (collection `dealcomments`) with 5 top-level fields.

**Kind:** Mongoose model · **Lines:** 28

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `DealComment`

- **Collection:** `dealcomments` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `dealId` | `String` | required, index |
| `userId` | `Types.ObjectId` | required, index, ref "User" |
| `body` | `String` | required, trim |
| `parentId` | `Types.ObjectId` | default null, ref "DealComment" |
| `deletedAt` | `Date` | default null |

### Indexes

- `{ dealId: 1, createdAt: -1 }` (L24)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DealComment` | const | `= models.DealComment \|\| model("DealComment", DealCommentSchema)` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `models`, `Types`

## Used by

- `server/routes/deals.ts`
- `server/services/deals.ts`
