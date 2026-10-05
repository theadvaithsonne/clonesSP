# `server/utils/storeSlug.ts`

> Module exporting `generateSlug`, `ensureUniqueSlug`.

**Kind:** backend utility · **Lines:** 43

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateSlug` | function | `generateSlug(name: string): string` — Generate URL-friendly slug from organization name Example: "My Awesome Company" -> "my-awesome-company" | 7 |
| `ensureUniqueSlug` | function | `async ensureUniqueSlug(slug: string, excludeOrgId?: string): Promise<string>` — Ensure slug is unique by appending number if needed Example: "my-company" -> "my-company-2" if "my-company" exists | 21 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
- **Packages:** none

## Used by

- `server/scripts/migrate-affiliate.ts`
- `server/services/store.ts`
