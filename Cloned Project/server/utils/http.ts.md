# `server/utils/http.ts`

> Module exporting `ok`, `fail`.

**Kind:** backend utility · **Lines:** 7

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ok` | function | `ok(data: T)` | 1 |
| `fail` | function | `fail(message: string, code?: string)` | 4 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/controllers/admin.controller.ts`
- `server/controllers/aiProviderKey.controller.ts`
- `server/controllers/coworkingSpace.controller.ts`
- `server/controllers/coworkingSpaceBooking.controller.ts`
- `server/controllers/downlineOffer.controller.ts`
- `server/controllers/garageAdmin.controller.ts`
- `server/controllers/settings.controller.ts`
- `server/routes/deals.ts`
- `server/routes/founderAiProviders.ts`
- `server/routes/garageAdminAnnouncements.ts`
- `server/routes/garageAdminOrgCategories.ts`
- `server/routes/garageAdminOrgKyc.ts`
- `server/routes/garageAdminVerify.ts`
- `server/routes/garageAdminWithdrawalPreferences.ts`
- `server/routes/publicAnalytics.ts`
- `server/routes/publicAnnouncements.ts`
- `server/routes/publicFx.ts`
- `server/routes/rbac.ts`
