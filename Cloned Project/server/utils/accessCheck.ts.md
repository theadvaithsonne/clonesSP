# `server/utils/accessCheck.ts`

> Check if a membership has founder-level access.

**Kind:** backend utility · **Lines:** 11

<!-- docgen:auto -->

## Purpose
Check if a membership has founder-level access.
Returns true for actual founders OR stakeholders with fullAccess granted by admin.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `hasFounderAccess` | function | `hasFounderAccess(membership: { role?: string \| null; fullAccess?: boolean; }): boolean` — Check if a membership has founder-level access. | 5 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/middleware/auth.ts`
- `server/middleware/roles.ts`
- `server/middleware/userOrGarageAdmin.ts`
- `server/realtime/openclawWs.ts`
- `server/routes/affiliate.ts`
- `server/routes/betty.ts`
- `server/routes/call.ts`
- `server/routes/callBooking.ts`
- `server/routes/conferenceRoom.ts`
- `server/routes/drops.ts`
- `server/routes/founderAiProviders.ts`
- `server/routes/founderCouponItems.ts`
- `server/routes/founderCouponRules.ts`
- `server/routes/founderCoupons.ts`
- `server/routes/founderPlatformCoupons.ts`
- `server/routes/founderStoreCommissions.ts`
- `server/routes/franchiseProgram.ts`
- `server/routes/initialSetup.ts`
- `server/routes/joinRequests.ts`
- `server/routes/learnInit.ts`
- `server/routes/membership.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/playlist.ts`
- `server/routes/rbac.ts`
- `server/routes/service.ts`
- _…and 11 more_
