# `server/controllers/admin.controller.ts`

> Express handlers for a standalone "Admin" account type (register, login, profile, list, toggle active). Nothing mounts them, so this is dead code.

**Kind:** Express controller · **Lines:** 105

## Purpose
This looks like an early scaffold for admin accounts. It uses its own `Admin` Mongoose model and signs its own JWTs. The live admin console uses the separate `GarageAdmin` model instead (see `server/controllers/garageAdmin.controller.ts` and `server/middleware/garageAdminAuth.ts`). No router imports this file and `server/app.ts` mounts nothing that reaches it. The comments in the file ("Example of using Model.find ...", "Example admin list ...") suggest it was written as a pattern reference.

## How it works
Every handler replies with the shared envelope from `server/utils/http.ts`: `ok(data)` gives `{ success: true, data }` and `fail(message)` gives `{ success: false, message, code }`.

- **`registerAdmin`** (L16-L43): checks `req.body` against a zod schema (`email`, `name` of at least 2 characters, `password` of at least 8 characters, optional `role` of `"admin" | "superadmin"`). It returns 400 on bad input and 409 if the email already exists. Otherwise it hashes the password with bcrypt (cost 12), creates the document with `role` defaulting to `"admin"`, and returns 201 with `{ id, email, name, role }`. **It logs the raw request body, which includes the plaintext password, to the console (L17, L19).**
- **`loginAdmin`** (L50-L73): checks the `email`/`password` schema, looks up the admin by email and rejects a missing or `isActive: false` account with 401 "Invalid credentials". It then checks the password with `bcrypt.compare`. On success it signs a JWT `{ sub, role, email }` with `env.JWT_SECRET`, valid for 7 days, and returns `{ token, role, name, email }`.
- **`me`** (L75-L83): loads the admin whose id is `req.user!.id` (the `user` field declared in `server/types/express.d.ts`), leaving out `passwordHash`. Returns 404 if there is no match. Nothing in this file sets `req.user`; some auth middleware would have to set it first.
- **`listAdmins`** (L86-L91): returns every admin without `passwordHash`, newest first.
- **`toggleActive`** (L94-L104): flips `isActive` for `req.params.id` with one aggregation-pipeline update (`$set: { isActive: { $not: "$isActive" } }`) and returns the updated document, or 404.

## Exports
- `registerAdmin(req, res)` - create an admin account.
- `loginAdmin(req, res)` - check credentials and issue a 7-day JWT.
- `me(req, res)` - return the current admin's profile (needs `req.user`).
- `listAdmins(_req, res)` - list all admins.
- `toggleActive(req, res)` - flip an admin's `isActive` flag.

## Interfaces
- **Database:** `AdminModel` (model `Admin`, collection `admins`): read and write. Fields: `email` (unique, lowercase), `name`, `passwordHash`, `role`, `isActive`, plus timestamps.
- **Environment variables:** `JWT_SECRET` (through `env.JWT_SECRET`) - signs login tokens.

## Dependencies
- **Internal:** `server/models/admin.model.ts` - the `Admin` model; `server/config/env.ts` - `JWT_SECRET`; `server/utils/http.ts` - `ok`/`fail` envelopes.
- **Packages:** `express` (types), `bcryptjs` (password hashing), `jsonwebtoken` (token signing), `zod` (input validation).

## Used by
Unused. No file imports it and no route reaches it.

## Notes
- The tokens carry `sub`, but `garageAdminAuth` expects `garageAdminId`, so they would not work with the live admin middleware. Both still use the same `JWT_SECRET`.
- `listAdmins` and `toggleActive` have no authorization of their own. If anyone wires these up, put them behind admin middleware.
- Before reusing `registerAdmin`, remove the `console.log` calls, which print plaintext passwords.
