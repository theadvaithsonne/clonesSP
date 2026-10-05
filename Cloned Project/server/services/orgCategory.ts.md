# `server/services/orgCategory.ts`

> Module exporting `isValidCategoryName`, `listCategoryNames`, `listCategoriesWithCounts`, `createOrgCategory` and 2 more.

**Kind:** backend service · **Lines:** 247

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `isValidCategoryName` | function | `async isValidCategoryName(name: string \| undefined \| null): Promise<boolean>` — True when `name` matches an existing OrgCategory (case-insensitive). | 11 |
| `listCategoryNames` | function | `async listCategoryNames(): Promise<string[]>` — List every category name currently in the taxonomy, sorted by name asc. | 30 |
| `CategoryWithCount` | interface |  | 38 |
| `listCategoriesWithCounts` | function | `async listCategoriesWithCounts(): Promise<CategoryWithCount[]>` — Admin table view: every category + how many orgs currently use it. | 51 |
| `createOrgCategory` | function | `async createOrgCategory(input: { name: string; createdByAdminId?: string \| null; }): Promise<{ _id: Types.ObjectId; name: string; slug…` — Create a new category. | 86 |
| `renameOrgCategory` | function | `async renameOrgCategory(categoryId: string, newName: string): Promise<{ category: { _id: Types.ObjectId; name: …` — Rename a category. Cascades the new name onto every Organization that had the old name. | 120 |
| `mergeAndDeleteOrgCategory` | function | `async mergeAndDeleteOrgCategory(sourceCategoryId: string, targetCategoryId: string): Promise<{ deleted: true; orgsReassigned: number; …` — Merge every org that uses `sourceCategoryId` into `targetCategoryId`, then delete the source. | 186 |

## Interfaces

- **Database (Mongoose models used):**
  - `OrgCategory` (server/models/orgCategory.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `create`, `deleteOne`
  - `Organization` (server/models/organization.model.ts) — reads: `aggregate`; **writes:** `updateMany`

## Dependencies

- **Internal:**
  - `server/models/orgCategory.model.ts` — `OrgCategory`, `slugifyCategoryName`
  - `server/models/organization.model.ts` — `Organization`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminOrgCategories.ts`
- `server/routes/org.ts`
- `server/services/affiliateAnalytics.ts`
