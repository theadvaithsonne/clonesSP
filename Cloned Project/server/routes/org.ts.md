# `server/routes/org.ts`

> Express router with 11 endpoints, mounted at `/org`.

**Kind:** Express router · **Lines:** 1134 · **Mounted at:** `/org` (browser: `/backend/org`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (11)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/create-first-time` | `/backend/org/create-first-time` | `requireAuth` | `createFirstTimeOfficeHandler` | 420 |
| POST | `/upsert` | `/backend/org/upsert` | `requireAuth` | inline | 422 |
| GET | `/resolve-pincode` | `/backend/org/resolve-pincode` | — | inline | 658 |
| GET | `/categories` | `/backend/org/categories` | — | inline | 704 |
| GET | `/:orgId` | `/backend/org/:orgId` | `requireAuth` | inline | 716 |
| PUT | `/:orgId` | `/backend/org/:orgId` | `requireAuth` | inline | 747 |
| POST | `/:orgId/welcome-email/test` | `/backend/org/:orgId/welcome-email/test` | `requireAuth` | inline | 913 |
| POST | `/upload/:orgId` | `/backend/org/upload/:orgId` | `requireAuth` | inline | 946 |
| PUT | `/:orgId/branding` | `/backend/org/:orgId/branding` | `requireAuth` | inline | 994 |
| GET | `/:orgId/branding` | `/backend/org/:orgId/branding` | `requireAuth` | inline | 1063 |
| DELETE | `/:orgId` | `/backend/org/:orgId` | `requireAuth` | inline | 1095 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `createFirstTimeOfficeHandler` | function | `async createFirstTimeOfficeHandler(req, res)` — Office creation, shared by two routes. | 50 |
| `default (router)` | default |  | 1133 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`, `findById`; **writes:** `create`, `findByIdAndUpdate`, `findByIdAndDelete`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`; **writes:** `updateMany`
  - `ConferenceRoom` (server/models/conferenceRoom.model.ts) — **writes:** `create`
- **External hosts mentioned in the code:** `uploadthing.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/conferenceRoom.model.ts` — `ConferenceRoom`
  - `server/utils/uploadthing.ts` — `uploadToUploadThing`
  - `server/utils/geocoding.ts` — `getCoordinatesFromAddress`, `resolvePostalCode`
  - `server/services/store.ts` — `createStoreForOrganization`, `updateStore`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`
  - `server/services/bulkEmail.ts` — `notifyNewOfficeCreated`
  - `server/services/aivatarWallet.service.ts` — `addAivatarCredits`, `WELCOME_BONUS_CENTS`
  - `server/services/orgCategory.ts` — `isValidCategoryName`
  - `server/services/officeEligibility.ts` — `assertCanCreateOffice`, `OfficeEligibilityError`, `eligibilityErrorBody`
  - `server/services/welcomeEmail.ts` — `DEFAULT_WELCOME_TEMPLATE_ID`, `sendWelcomeEmailTest`
- **Packages:**
  - `express` — `Router`, `RequestHandler`
  - `zod` — `z`

## Used by

- `server/app.ts`
- `server/routes/platformOffices.ts`

Entry: mounted in `server/app.ts` at `/org`.
