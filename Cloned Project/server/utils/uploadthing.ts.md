# `server/utils/uploadthing.ts`

> Module exporting `uploadToUploadThing`, `deleteFromUploadThing`.

**Kind:** backend utility · **Lines:** 56

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UploadThingResponse` | interface |  | 4 |
| `uploadToUploadThing` | function | `async uploadToUploadThing(file: Buffer \| string, fileName: string, fileType: string): Promise<UploadThingResponse>` | 11 |
| `deleteFromUploadThing` | function | `async deleteFromUploadThing(fileKey: string): Promise<void>` | 42 |

## Interfaces

- **External HTTP calls:**
  - `POST https://api.uploadthing.com/api/upload` (L26)
  - `DELETE https://api.uploadthing.com/api/delete` (L43)
- **Environment via `server/config/env.ts`:** `env.UPLOADTHING_SECRET`
- **External hosts mentioned in the code:** `api.uploadthing.com`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:** none

## Used by

- `server/routes/org.ts`
