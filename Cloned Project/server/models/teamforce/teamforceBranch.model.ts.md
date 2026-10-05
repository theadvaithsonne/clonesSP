# `server/models/teamforce/teamforceBranch.model.ts`

> Mongoose model for a Teamforce (HR module) office branch belonging to an organisation.

**Kind:** Mongoose model · **Lines:** 29

## Purpose
Teamforce lets an organisation describe its physical structure. A branch is one office or location (name, optional short code and postal address). Employee profiles point at a branch through `TeamforceEmployeeProfile.branchId`. Partial payroll runs can also be scoped to a list of branch IDs.

## How it works
- Fields: `orgId` (required, ref `Organization`), `name` (required, trimmed), `code` (trimmed), `address`, `city`, `state`, `country`, `postalCode`, and `isActive` (default `true`). `timestamps: true` adds `createdAt`/`updatedAt`.
- Indexes: a **unique** compound index on `{ orgId, name }` and a plain index on `{ orgId }`.
- Deletes are soft. The router sets `isActive: false` and keeps the document.

## Exports
- `TeamforceBranch` - the Mongoose model `"TeamforceBranch"` (default collection `teamforcebranches`).

## Interfaces
- **Database:** `TeamforceBranch` (collection `teamforcebranches`), written and read by the branches router.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
- `server/routes/teamforce/branches.ts`, the CRUD router mounted at `/teamforce/branches` (browser: `GET|POST /backend/teamforce/branches`, `PATCH|DELETE /backend/teamforce/branches/:id`).
- Referenced by name from `TeamforceEmployeeProfile.branchId`.

## Notes
- The unique `{orgId, name}` index is not partial, but deletes are soft. The router's duplicate check is case-insensitive and only looks at **active** branches. So re-creating a branch with exactly the same name as a soft-deleted one passes that check, then fails at the database with a duplicate-key error.
- The unique index is case-sensitive. The router's regex check is what stops "Pune" and "pune" from both existing.
