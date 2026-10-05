# `server/models/shareableLink.model.ts`

> Mongoose model `ShareableLink` (collection `shareablelinks`) with 12 top-level fields.

**Kind:** Mongoose model · **Lines:** 106

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ShareableLink`

- **Collection:** `shareablelinks` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `token` | `String` | required, unique |
| `linkType` | `String` | required, enum ["internal", "external"] |
| `accessLevel` | `String` | default "restricted", enum ["public", "restricted"] |
| `file` | `Schema.Types.ObjectId` | required |
| `fileModel` | `String` | default "UserFile", enum ["UserFile", "OrganizationFile", "FloorFile… |
| `owner` | `Schema.Types.ObjectId` | required, ref "User" |
| `organization` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `expiresAt` | `Date` | required |
| `maxAccessCount` | `Number` | default 100 |
| `accessCount` | `Number` | default 0 |
| `status` | `String` | default "active", enum ["active", "expired", "limit_reached", "rev… |
| `lastAccessedAt` | `Date` | default null |

### Indexes

- `{ token: 1 }, { unique: true }` (L99)
- `{ file: 1, linkType: 1 }, { unique: true }` (L100)
- `{ owner: 1, organization: 1 }` (L101)
- `{ expiresAt: 1 }` (L102)
- `{ status: 1 }` (L103)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ShareableLink` | model | `model("ShareableLink", ShareableLinkSchema)` | 105 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`

## Used by

- `server/controllers/shareableLink.controller.ts`
