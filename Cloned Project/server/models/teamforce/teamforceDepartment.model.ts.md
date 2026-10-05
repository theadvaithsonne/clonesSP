# `server/models/teamforce/teamforceDepartment.model.ts`

> Mongoose model for a Teamforce department within an organisation, with an optional department head.

**Kind:** Mongoose model · **Lines:** 25

## Purpose
Departments group employees in the Teamforce HR module. Employee profiles reference a department through `departmentId`. The same department IDs are used to scope break policies ("By Department"), partial payroll runs, and Bulk Upload's name-to-ID resolution on the frontend.

## How it works
- Fields: `orgId` (required, ref `Organization`), `name` (required, trimmed), `description`, `headId` (ref `User`, the department head), `isActive` (default `true`). `timestamps: true`.
- Indexes: **unique** `{ orgId, name }` and `{ orgId }`.
- Deletes are soft (`isActive: false`), and the list endpoint returns only active departments.

## Exports
- `TeamforceDepartment` - the Mongoose model `"TeamforceDepartment"` (collection `teamforcedepartments`).

## Interfaces
- **Database:** `TeamforceDepartment` (collection `teamforcedepartments`).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
- `server/routes/teamforce/departments.ts`, mounted at `/teamforce/departments` (browser: `GET|POST /backend/teamforce/departments`, `PATCH|DELETE /backend/teamforce/departments/:id`).
- Referenced by name from `TeamforceEmployeeProfile.departmentId`.

## Notes
- The create route does no duplicate-name check of its own. It relies on the unique index, which is case-sensitive and also counts soft-deleted rows, so re-creating a deleted department with the same name fails with a duplicate-key error.
