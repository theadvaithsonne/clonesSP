# `server/models/collaborativeDocument.model.ts`

> Collaborative Document Model for ONLYOFFICE Integration

**Kind:** Mongoose model · **Lines:** 154

<!-- docgen:auto -->

## Purpose
Collaborative Document Model for ONLYOFFICE Integration

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `CollaborativeDocument`

- **Collection:** `collaborativedocuments` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `title` | `String` | required, trim |
| `type` | `String` | required, enum ["word", "cell", "slide"] |
| `organization` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `cabinet` | `Schema.Types.ObjectId` | index, ref "Cabinet" |
| `createdBy` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `collaborators` | `[Schema.Types.ObjectId]` | ref "User" |
| `fileKey` | `String` | required, unique |
| `filePath` | `String` | required |
| `fileUrl` | `String` | — |
| `version` | `Number` | default 1 |
| `lastModifiedBy` | `Schema.Types.ObjectId` | ref "User" |
| `isLocked` | `Boolean` | default false |
| `lockedBy` | `Schema.Types.ObjectId` | ref "User" |
| `lockedAt` | `Date` | — |
| `size` | `Number` | default 0 |
| `mimeType` | `String` | default "application/vnd.openxmlfor… |

### Indexes

- `{ organization: 1, createdBy: 1 }` (L111)
- `{ organization: 1, collaborators: 1 }` (L112)
- `{ fileKey: 1 }` (L113)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DocumentType` | type |  | 4 |
| `ICollaborativeDocument` | interface |  | 6 |
| `CollaborativeDocument` | model | `mongoose.model<ICollaborativeDocument>( "CollaborativeDocument", CollaborativeDocumentSch…` | 150 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Document`, `Schema`

## Used by

- `server/controllers/cabinet.controller.ts`
- `server/controllers/collaborativeDocument.controller.ts`
