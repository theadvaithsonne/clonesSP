# `server/models/garageAdmin.model.ts`

> Mongoose model for platform ("Garage admin") back-office accounts, including their per-page permissions, session cutoff and step-up verification secrets.

**Kind:** Mongoose model · **Lines:** 132

## Purpose
Garage admins are a separate identity from ordinary `User`s; they sign into the garage-admin console (routes mounted under `/garage-admin`). This model holds who they are, their role label, page-level RBAC map, active flag, and the data used by the "Verify your admin" second factor. It is the most widely imported admin model: auth middleware, the admin controller, support chat, tickets, withdrawals and admin notifications all read it.

## How it works
**Page permissions.** `PagePermissionsSchema` is built at load time from `ADMIN_PAGES` in `server/config/adminPages.ts`: one field per page key, each `"none" | "view" | "manage"` (from `ADMIN_PAGE_LEVELS`) defaulting to `"none"`. Building it from the config keeps model and config from drifting. It is `strict: false` so per-action grants stored as `"<pageKey>:<actionKey>"` (for example `"one_time_affiliates:assign-agent"`) survive; those keys are validated in code by `sanitizePagePermissions` / `normalizePagePermissions`, not by the schema. The comment warns to read the map through `normalizePagePermissions` because `.lean()` reads skip defaults and older rows lack keys for newer pages.

**Fields:**
- `email` (required, unique, lowercased), `name` (required).
- `role` - free-text label (default `"garage-admin"`). Two values carry meaning: `"garage-super-admin"` bypasses `pagePermissions` entirely; `"garage-admin"` is the default delegated label. `isReservedRoleName()` in `config/adminPages` stops the super-admin label being typed into the invite form.
- `pagePermissions` - the map above (default `{}`); ignored for super admins.
- `pagePermissionsSet` (default false) - false on rows that existed before page RBAC or were never edited; those admins get `LEGACY_ADMIN_PERMISSIONS` instead of an all-"none" console. Flipped true the first time a super admin saves a map, which distinguishes "deliberately all none" from "never configured".
- `isActive` (default true) - the auth middleware rejects inactive admins.
- `profilePicture`, `invitedBy` (ref `GarageAdmin`), `invitedAt`, `lastLoginAt`.
- `sessionsInvalidatedAt` - any admin JWT issued before this instant is refused by `server/middleware/garageAdminAuth.ts`. Stamped when step-up verification runs out of attempts, effectively signing out the token holder.
- `verification` (`select: false`) - `questions[]` of `{ id, prompt, answerHash }`, `failedAttempts`, `lastVerifiedAt`, `lastFailedAt`. Only admins with seeded questions are gated (opt-in per account, see `server/services/adminVerification.ts`). `answerHash` is bcrypt over a pepper plus the normalised answer; the pepper is an environment secret, so the stored hashes are not crackable from the database alone. `select: false` keeps the hashes out of ordinary reads.

Timestamps on. Explicit unique index on `email`.

## Exports
- `GarageAdminModel` - model `"GarageAdmin"` (default collection `garageadmins`).
- `GarageAdmin` - type inferred from the schema (`InferSchemaType`).

## Interfaces
- **Database:** collection `garageadmins` (read/write).
- **Environment variables (indirect):** the verification pepper is read by `services/adminVerification.ts` (`ADMIN_VERIFY_PEPPER`, falling back to a value derived from `JWT_SECRET`), not by this file.

## Dependencies
- **Internal:** `server/config/adminPages.ts` - `ADMIN_PAGES` and `ADMIN_PAGE_LEVELS` to build the permission sub-schema.
- **Packages:** `mongoose`.

## Used by
`server/middleware/garageAdminAuth.ts`, `server/middleware/userOrGarageAdmin.ts`, `server/controllers/garageAdmin.controller.ts`, routes `auth.ts`, `garageAdmin.ts`, `garageAdminIgniteCall.ts`, `garageAdminNetworkChainSubs.ts`, `garageAdminOneTimeAffiliates.ts`, `garageAdminSupportChats.ts`, `garageAdminTickets.ts`, `garageAdminVerify.ts` (all `/garage-admin` routers except `auth.ts`), `wallet.ts`, services `adminNotifications/dispatch.ts`, `ensureGarageAdmin.ts`, `garageAdminInit.ts`, `supportChat.ts`, `supportTicketTaskroom.ts`, `ticketAutoAssign.ts`, `withdrawal.ts`, and the manual script `server/scripts/set-admin-verification.ts` (20 importers in total).

## Notes
- Security-sensitive: always query `verification` explicitly with `.select("+verification")`; never return it to clients.
- `email` is declared `unique: true` and also indexed again with `GarageAdminSchema.index({ email: 1 }, { unique: true })`; Mongoose may log a duplicate-index warning.
- Adding a page to `ADMIN_PAGES` automatically adds a field here; no migration is needed thanks to defaults, but `.lean()` reads will not see the default.
