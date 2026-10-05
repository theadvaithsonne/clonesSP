# `server/models/sharing.model.ts`

> Mongoose model `SharedItem` (collection `shareditems`) with 11 top-level fields.

**Kind:** Mongoose model · **Lines:** 133

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `SharedItem`

- **Collection:** `shareditems` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `itemId` | `Schema.Types.ObjectId` | required |
| `itemType` | `String` | required, enum ["file", "cabinet"] |
| `owner` | `Schema.Types.ObjectId` | required, ref "User" |
| `sharedWith` | `Schema.Types.ObjectId` | required, ref "User" |
| `organization` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `permissions` | `{ canView, canDownload, canEdit, canDelete }` | nested |
| `message` | `String` | trim |
| `status` | `String` | default "pending", enum ["pending", "accepted", "declined", "revoke… |
| `respondedAt` | `Date` | — |
| `expiresAt` | `Date` | — |
| `metadata` | `Schema.Types.Mixed` | default {} |

### Model `SharedAccessLog`

- **Collection:** `sharedaccesslogs` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `sharedItem` | `Schema.Types.ObjectId` | required, ref "SharedItem" |
| `accessedBy` | `Schema.Types.ObjectId` | required, ref "User" |
| `action` | `String` | required, enum ["view", "download", "edit", "delete"] |
| `ipAddress` | `String` | — |
| `userAgent` | `String` | — |
| `metadata` | `Schema.Types.Mixed` | default {} |

### Indexes

- `{ owner: 1, organization: 1 }` (L113)
- `{ sharedWith: 1, organization: 1 }` (L114)
- `{ itemId: 1, itemType: 1 }` (L115)
- `{ status: 1 }` (L116)
- `{ expiresAt: 1 }` (L117)
- `{ sharedItem: 1 }` (L120)
- `{ accessedBy: 1 }` (L121)
- `{ action: 1 }` (L122)
- `{ createdAt: 1 }` (L123)
- `{ itemId: 1, itemType: 1, sharedWith: 1 }, { unique: true }` (L126)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SharedItem` | model | `model("SharedItem", SharedItemSchema)` | 131 |
| `SharedAccessLog` | model | `model("SharedAccessLog", SharedAccessLogSchema)` | 132 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`

## Used by

- `server/controllers/cabinet.controller.ts`
