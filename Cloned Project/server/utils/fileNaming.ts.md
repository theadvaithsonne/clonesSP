# `server/utils/fileNaming.ts`

> Helpers for keeping a cabinet file's stored names in sync with what the browser actually writes to disk.

**Kind:** backend utility · **Lines:** 83

<!-- docgen:auto -->

## Purpose
Helpers for keeping a cabinet file's stored names in sync with what the
browser actually writes to disk.

Renaming a file used to touch only `name`, while every download path read
`originalName`, so a renamed file still downloaded under its upload name.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `downloadNameFor` | function | `downloadNameFor(file: { name?: string \| null; originalName?: string \| null;…): string` — The name a download should be saved as. | 16 |
| `buildContentDisposition` | function | `buildContentDisposition(fileName: string, type: "attachment" \| "inline" = "attachment"): string` — Build a Content-Disposition header value per RFC 6266 / RFC 5987. | 46 |
| `applyFileRename` | function | `applyFileRename(file: any, newName: string): void` — Apply a rename to a cabinet file document (user, organization or floor). | 62 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/controllers/cabinet.controller.ts`
- `server/services/s3.ts`
