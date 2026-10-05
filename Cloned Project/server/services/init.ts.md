# `server/services/init.ts`

> Module exporting `initializeGarageHQ`, `addUserToOrg`, `addUserToGarageHQ`.

**Kind:** backend service · **Lines:** 288

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `initializeGarageHQ` | function | `async initializeGarageHQ()` — Initialize GARAGE HQ organization and founder user This ensures the parent organization always exists | 18 |
| `addUserToOrg` | function | `async addUserToOrg(userId: string, orgId: string, opts?: { guest?: boolean }): Promise<boolean>` — Join a new user to a SPECIFIC office, mirroring the Garage HQ onboarding. | 149 |
| `addUserToGarageHQ` | function | `async addUserToGarageHQ(userId: string, opts?: { guest?: boolean })` | 209 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `Floor` (server/models/floor.model.ts) — reads: `find`; **writes:** `insertMany`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
- **External hosts mentioned in the code:** `35yqu70ay5.ufs.sh`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/garageAdminInit.ts` — `initializeGarageSuperAdmin`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`
  - `server/services/store.ts` — `createStoreForOrganization`
  - `server/services/officeAddonSubscription.ts` — `initializeOfficeAddons`
  - `server/services/channel.ts` — `autoJoinMembersChannel`, `autoJoinDefaultChannel`, `autoJoinMandatoryChannels`
- **Packages:** none

## Used by

- `server/db/mongo.ts`
- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/downlines.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/serviceCheckout.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/itemReserveLicense.ts`
