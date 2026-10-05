# `server/routes/garageAdmin.ts`

> Express router with 40 endpoints, mounted at `/garage-admin`.

**Kind:** Express router · **Lines:** 485 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (40)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/request-otp` | `/backend/garage-admin/request-otp` | — | `requestGarageAdminOtp` | 127 |
| POST | `/login` | `/backend/garage-admin/login` | — | `loginGarageAdmin` | 128 |
| POST | `/ensure-admin` | `/backend/garage-admin/ensure-admin` | — | inline | 129 |
| GET | `/profile` | `/backend/garage-admin/profile` | `requireGarageAdminAuth` | `getGarageAdminProfile` | 139 |
| GET | `/admins` | `/backend/garage-admin/admins` | `requireGarageAdminAuth` | `withListSearch(listGarageAdmins, matchAdmin)` | 140 |
| GET | `/assignable-agents` | `/backend/garage-admin/assignable-agents` | `requireGarageAdminAuth` | `withListSearch(listGarageAdmins, matchAdmin)` | 150 |
| GET | `/library-affiliate` | `/backend/garage-admin/library-affiliate` | `requireGarageAdminAuth` | inline | 178 |
| GET | `/organizations` | `/backend/garage-admin/organizations` | `requireGarageAdminAuth` | `withListSearch(getAllOrganizations, matchOrg)` | 206 |
| GET | `/organizations/:id` | `/backend/garage-admin/organizations/:id` | `requireGarageAdminAuth` | `getOrganizationById` | 211 |
| POST | `/organizations/:id/assign-admin` | `/backend/garage-admin/organizations/:id/assign-admin` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `assignAdminToOrganization` | 215 |
| GET | `/organizations/:id/invoices` | `/backend/garage-admin/organizations/:id/invoices` | `requireGarageAdminAuth` | `listInvoicesForOrganization` | 221 |
| GET | `/organizations/:id/sellable-items` | `/backend/garage-admin/organizations/:id/sellable-items` | `requireGarageAdminAuth` | `listSellableItemsForOrganization` | 226 |
| GET | `/founders` | `/backend/garage-admin/founders` | `requireGarageAdminAuth` | `withListSearch(getAllFounders, matchPerson)` | 231 |
| GET | `/stakeholders` | `/backend/garage-admin/stakeholders` | `requireGarageAdminAuth` | `withListSearch(getAllStakeholders, matchPerson)` | 236 |
| GET | `/unilevel-plus-license-holders` | `/backend/garage-admin/unilevel-plus-license-holders` | `requireGarageAdminAuth` | `getAllUnilevelPlusLicenseHolders` | 244 |
| GET | `/users` | `/backend/garage-admin/users` | `requireGarageAdminAuth` | `listAllUsers` | 255 |
| GET | `/users/:userId/wallets` | `/backend/garage-admin/users/:userId/wallets` | `requireGarageAdminAuth` | `getUserWalletsForAdmin` | 260 |
| GET | `/users/:userId/purchases` | `/backend/garage-admin/users/:userId/purchases` | `requireGarageAdminAuth` | `listUserPurchases` | 269 |
| GET | `/users/:userId/products` | `/backend/garage-admin/users/:userId/products` | `requireGarageAdminAuth` | `listUserPurchasedProducts` | 274 |
| POST | `/users/:userId/extend-offer` | `/backend/garage-admin/users/:userId/extend-offer` | `requireGarageAdminAuth` | `extendUserOffer` | 283 |
| POST | `/users/:userId/move-upline` | `/backend/garage-admin/users/:userId/move-upline` | `requireGarageAdminAuth` | `adminMoveUpline` | 291 |
| GET | `/user-wallets` | `/backend/garage-admin/user-wallets` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `listAllUserWallets` | 297 |
| GET | `/withdrawals` | `/backend/garage-admin/withdrawals` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `listWithdrawals` | 305 |
| GET | `/withdrawals/stats` | `/backend/garage-admin/withdrawals/stats` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `getWithdrawalStats` | 311 |
| POST | `/withdrawals/quote` | `/backend/garage-admin/withdrawals/quote` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `adminQuoteWithdrawal` | 317 |
| POST | `/withdrawals` | `/backend/garage-admin/withdrawals` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `adminInitiateWithdrawal` | 323 |
| POST | `/withdrawals/:id/complete` | `/backend/garage-admin/withdrawals/:id/complete` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `adminCompleteWithdrawal` | 329 |
| POST | `/withdrawals/:id/reject` | `/backend/garage-admin/withdrawals/:id/reject` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `adminRejectWithdrawal` | 335 |
| GET | `/platform-fee-overrides` | `/backend/garage-admin/platform-fee-overrides` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `listPlatformFeeOverrides` | 343 |
| PUT | `/platform-fee-overrides/:orgId` | `/backend/garage-admin/platform-fee-overrides/:orgId` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `setPlatformFeeOverride` | 349 |
| DELETE | `/platform-fee-overrides/:orgId` | `/backend/garage-admin/platform-fee-overrides/:orgId` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `removePlatformFeeOverride` | 355 |
| POST | `/invite` | `/backend/garage-admin/invite` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `inviteGarageAdmin` | 363 |
| PATCH | `/admins/:id/toggle` | `/backend/garage-admin/admins/:id/toggle` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `toggleGarageAdminActive` | 369 |
| PATCH | `/admins/:id/access` | `/backend/garage-admin/admins/:id/access` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `updateGarageAdminAccess` | 377 |
| GET | `/admin-roles` | `/backend/garage-admin/admin-roles` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `listGarageAdminRoles` | 384 |
| POST | `/admin-roles` | `/backend/garage-admin/admin-roles` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `createGarageAdminRole` | 392 |
| PATCH | `/admin-roles/:name` | `/backend/garage-admin/admin-roles/:name` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `updateGarageAdminRole` | 398 |
| DELETE | `/admin-roles/:name` | `/backend/garage-admin/admin-roles/:name` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `deleteGarageAdminRole` | 404 |
| GET | `/admin-pages` | `/backend/garage-admin/admin-pages` | `requireGarageAdminAuth` | `getAdminPageCatalogue` | 412 |
| POST | `/upload` | `/backend/garage-admin/upload` | `requireGarageAdminAuth`, `upload.single("file")` | inline | 415 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 484 |

## Interfaces

- **Database (Mongoose models used):**
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/models/user.model.ts` — `User`
  - `server/controllers/garageAdmin.controller.ts` — `inviteGarageAdmin`, `requestGarageAdminOtp`, `loginGarageAdmin`, `getGarageAdminProfile`, `listGarageAdmins`, `toggleGarageAdminActive`, `getAllOrganizations`, `getOrganizationById`, … +28
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`
  - `server/services/ensureGarageAdmin.ts` — `ensureGarageSuperAdmin`
  - `server/services/s3.ts` — `s3Service`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `multer`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
