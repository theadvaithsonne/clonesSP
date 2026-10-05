# `server/models/standaloneVideo.model.ts`

> Mongoose model `StandaloneVideo` (collection `standalonevideos`) with 10 top-level fields.

**Kind:** Mongoose model · **Lines:** 83

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `StandaloneVideo`

- **Collection:** `standalonevideos` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `title` | `String` | required, trim |
| `description` | `String` | trim |
| `thumbnail` | `String` | trim |
| `videoUrl` | `String` | trim |
| `videoS3Key` | `String` | trim |
| `sourceType` | `String` | required, default "upload", enum ["upload", "link"] |
| `duration` | `Number` | default 0 |
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `createdBy` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `isPublished` | `Boolean` | default true |

### Indexes

- `{ orgId: 1, isPublished: 1, createdAt: -1 }` (L76)
- `{ createdBy: 1, createdAt: -1 }` (L77)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IStandaloneVideo` | interface |  | 4 |
| `StandaloneVideo` | model | `mongoose.model<IStandaloneVideo>( "StandaloneVideo", StandaloneVideoSchema )` | 79 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/contentEngagement.ts`
- `server/routes/feed.ts`
- `server/routes/public.ts`
- `server/routes/standaloneVideo.ts`
- `server/services/playlist.ts`
