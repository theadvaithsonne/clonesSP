# `server/models/orgCategory.model.ts`

> Mongoose model for the admin-managed list of office categories, plus a helper that turns a category name into a URL-safe slug.

**Kind:** Mongoose model · **Lines:** 76

## Purpose
Founders pick their office's category (e.g. "Real Estate") from a fixed list when they create or manage an organization. That list is owned by garage admins and lives in this collection, so there is no free-text category input in the frontend pickers anymore.

`Organization.category` (see `server/models/organization.model.ts`) is intentionally a plain string equal to an `OrgCategory.name`, not an ObjectId reference. Every existing reader (discover facets, affiliate leaderboards, public office projections) therefore keeps working; renames and deletes are cascaded to organizations with a single `Organization.updateMany` performed in the service layer.

## How it works
- Fields:
  - `name` - required, trimmed, unique display name.
  - `slug` - required, unique, lowercased; derived from `name`, used only for de-duplication and URL safety. Consumers ignore it.
  - `createdByAdminId` - ref `GarageAdmin`, `null` by default (rows inserted by the seed script have no admin).
  - `timestamps: true`.
- Indexes: besides the field-level `unique` on `name` and `slug`, an extra unique index on `{ name: 1 }` with collation `{ locale: "en", strength: 2 }` makes names case-insensitively unique, so "Tech" and "tech" cannot coexist; MongoDB rejects the second insert with a duplicate-key error.
- `slugifyCategoryName(name)`: NFKD-normalises, strips combining diacritical marks, lowercases, trims, collapses every run of non-alphanumerics to `-`, and trims leading/trailing hyphens. `"Real Estate"` becomes `real-estate`; `"Consulting & Advisory"` becomes `consulting-advisory`.

## Exports
- `OrgCategory` (type) - inferred schema type plus `_id: Types.ObjectId`.
- `OrgCategory` (value) - the Mongoose model `model<OrgCategory>("OrgCategory", ...)`.
- `slugifyCategoryName(name: string): string` - slug helper described above.

## Interfaces
- **Database:** `OrgCategory` (collection `orgcategories`) - defined here; read/written by the service.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`, `InferSchemaType`.

## Used by
- `server/services/orgCategory.ts` - `isValidCategoryName`, `listCategoryNames`, `listCategoriesWithCounts`, `createOrgCategory`, `renameOrgCategory`, `mergeAndDeleteOrgCategory` (the latter two perform the `Organization` cascade).
- `server/scripts/seed-org-categories.ts` - a hand-run seed script that inserts the initial categories (without `createdByAdminId`).

## Notes
- `name` carries two unique indexes (the plain field-level one and the collated one). The collated one is the one that enforces the case-insensitive rule.
- Both a type and a value are exported under the name `OrgCategory` (TypeScript declaration merging).
