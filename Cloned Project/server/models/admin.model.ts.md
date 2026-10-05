# `server/models/admin.model.ts`

> Mongoose model `Admin` for a legacy email/password admin account with an `admin` or `superadmin` role.

**Kind:** Mongoose model · **Lines:** 25

## Purpose
Defines a simple admin-user record (email, name, password hash, role, active flag). It predates the `GarageAdmin` model that the garage-admin console and other models (`createdBy` refs elsewhere) use today.

## How it works
- Fields: `email` (required, unique, lowercased, trimmed), `name` (required), `passwordHash` (required - only a hash is stored, never plaintext), `role` (`"admin"` | `"superadmin"`, default `"admin"`), `isActive` (default `true`), plus `createdAt`/`updatedAt` timestamps.
- A unique index on `email` is declared twice (once via `unique: true` on the field, once with `AdminSchema.index`), which Mongoose may warn about as a duplicate index.
- Stored in the default collection `admins`.

## Exports
- `AdminModel` - the Mongoose model `"Admin"`.
- `type Admin` - `InferSchemaType` of the schema.

## Interfaces
- **Database:** `Admin` (collection `admins`) - schema definition.

## Dependencies
- **Packages:** `mongoose` - schema/model.

## Used by
`server/controllers/admin.controller.ts` (`registerAdmin`, `loginAdmin`, `me`, `listAdmins`, `toggleActive`). No route file in `server/` imports that controller, so this model appears unreachable from HTTP at present.

## Notes
- Duplicate email index definition (field-level `unique` plus explicit `index`).
