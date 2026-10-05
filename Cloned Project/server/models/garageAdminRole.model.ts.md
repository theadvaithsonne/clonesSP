# `server/models/garageAdminRole.model.ts`

> Mongoose model for named garage-admin roles that exist independently of any admin, each carrying a permission template.

**Kind:** Mongoose model · **Lines:** 58

## Purpose
Admin roles used to be derived by grouping existing admins by their `role` string, so a role only existed once someone held it and a role typed into the invite dialog was lost on refresh. This collection lets a super admin define roles up front. The stored permissions are a template copied into an admin when the role is chosen, not a live link: editing a role later does not re-permission existing holders. Authorisation always reads the admin's own `pagePermissions` (see `garageAdmin.model.ts`).

## How it works
- `name` (required, trimmed, max 40 chars).
- `nameLower` (required, lowercased) - carries the uniqueness constraint (unique index `{ nameLower: 1 }`) so "Finance" and "finance" cannot both exist. A separate field is used instead of a collation-based unique index, which the comment says is easy to get wrong.
- `permissions` - sub-schema generated from `ADMIN_PAGES`, one `"none" | "view" | "manage"` field per page (default `"none"`), `strict: false` so `"<pageKey>:<actionKey>"` action grants persist; validated in code via `sanitizePagePermissions`.
- `createdBy` (ref `GarageAdmin`).
- Timestamps on.

The model is registered with a `models.GarageAdminRole ||` guard to avoid `OverwriteModelError` on hot reload.

## Exports
- `GarageAdminRole` - model `"GarageAdminRole"` (default collection `garageadminroles`). Untyped (no generic), so documents are loosely typed.

## Interfaces
- **Database:** collection `garageadminroles` (read/write).

## Dependencies
- **Internal:** `server/config/adminPages.ts` - `ADMIN_PAGES`, `ADMIN_PAGE_LEVELS`.
- **Packages:** `mongoose`.

## Used by
`server/controllers/garageAdmin.controller.ts` only (role listing/creation for the garage-admin console under `/garage-admin`).

## Notes
- The permission sub-schema duplicates the one in `garageAdmin.model.ts`; both are generated from the same config so they stay aligned.
- `createdBy` uses `Types.ObjectId` rather than `Schema.Types.ObjectId`; Mongoose accepts both.
