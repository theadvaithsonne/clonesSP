# `server/services/downlineTree.ts`

> src/services/downlineTree.ts Maintenance for the denormalized downline-table fields on User (ancestors / depth / legNumber / directsCount / downlineCount / typeFlags).

**Kind:** backend service · **Lines:** 148

<!-- docgen:auto -->

## Purpose
src/services/downlineTree.ts
Maintenance for the denormalized downline-table fields on User
(ancestors / depth / legNumber / directsCount / downlineCount / typeFlags).
The authoritative (re-runnable) populate is scripts/backfill-downline-tree.ts;
these helpers keep the fields correct incrementally after that backfill.

PRECONDITION: the parent must already be backfilled (has correct `ancestors`/
`depth`). Run the backfill once before relying on syncNewEnrollee.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `syncNewEnrollee` | function | `async syncNewEnrollee(childId: string \| Types.ObjectId): Promise<void>` — After a new user is created with `referredBy` set, populate their tree fields and bump the counts of the parent (+directsCount) and every ancestor (+downlineCount). | 19 |
| `reparentUnderNewReferrer` | function | `async reparentUnderNewReferrer(userId: string \| Types.ObjectId): Promise<void>` — Move a user under whoever their `referredBy` now points at, undoing the old parent/ancestor counts along the way. | 81 |
| `refreshTypeFlags` | function | `async refreshTypeFlags(userId: string \| Types.ObjectId): Promise<void>` — Recompute + persist `typeFlags` for one user. | 139 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `countDocuments`; **writes:** `updateOne`, `updateMany`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/services/downlineTypeFlags.ts` — `computeTypeFlags`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/models/user.model.ts`
- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/downlines.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/unilevel-plus.ts`
- `server/routes/webhook.ts`
- `server/scripts/move-upline.ts`
- `server/scripts/repair-broken-legs.ts`
- `server/scripts/setup-test-account.ts`
- `server/services/affiliate.ts`
- `server/services/invoice.ts`
- `server/services/itemReserveLicense.ts`
- `server/services/officeSubscription.ts`
