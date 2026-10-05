# `server/scripts/migrate-cabinets.ts`

> Module exporting `migrateCabinetData`.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 241

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `migrateCabinetData` | function | `async migrateCabinetData()` — Migration script to clean up duplicate cabinets and separate user/floor data | 12 |

## Interfaces

- **Database (Mongoose models used):**
  - `Cabinet` (server/models/cabinet.model.ts) — reads: `find`; **writes:** `findByIdAndDelete`, `updateOne`
  - `File` (server/models/cabinet.model.ts) — reads: `find`; **writes:** `updateOne`
  - `UserCabinet` (server/models/cabinet.model.ts) — reads: `findOne`; **writes:** `new + save`
  - `UserFile` (server/models/cabinet.model.ts) — **writes:** `new + save`
  - `FloorCabinet` (server/models/cabinet.model.ts) — reads: `findOne`; **writes:** `new + save`
  - `FloorFile` (server/models/cabinet.model.ts) — **writes:** `new + save`

## Dependencies

- **Internal:**
  - `server/models/cabinet.model.ts` — `Cabinet`, `File`
  - `server/models/cabinet.model.ts` — `UserCabinet`, `UserFile`, `FloorCabinet`, `FloorFile`
- **Packages:** none

## Used by

- `server/controllers/cabinet.controller.ts`

Entry: run by hand: `npx tsx server/scripts/migrate-cabinets.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Cabinet` (findByIdAndDelete, updateOne); `File` (updateOne); `UserCabinet` (new + save); `UserFile` (new + save); `FloorCabinet` (new + save); `FloorFile` (new + save).
