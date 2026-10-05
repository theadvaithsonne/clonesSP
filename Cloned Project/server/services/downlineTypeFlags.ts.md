# `server/services/downlineTypeFlags.ts`

> src/services/downlineTypeFlags.ts Derives the stackable membership sub-states stored on `User.typeFlags` and shown as the "Type" column of the 1Network downline table.

**Kind:** backend service · **Lines:** 94

<!-- docgen:auto -->

## Purpose
src/services/downlineTypeFlags.ts
Derives the stackable membership sub-states stored on `User.typeFlags` and
shown as the "Type" column of the 1Network downline table. See the backend
contract (docs 2026-07-27). Shopper = all three false.

  oneNetworkActivated — active UnilevelPlusPurchase ($25 one-time license)
  networkChainsSub    — active NC recurring sub WITH a real >$0 paid cycle
                        (the $0 combo "free first month" does NOT count)
  founderSub          — active/trial OfficeSubscription where the user is founder

Two entry points: a single-user compute (for maintenance hooks) and a bulk
compute (for the backfill script and the downline-table endpoint) that runs
three set-membership queries instead of N×3.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DownlineTypeFlags` | interface |  | 20 |
| `EMPTY_TYPE_FLAGS` | const | `= { oneNetworkActivated: false, networkChainsSub: false, founderSub: false, }` | 26 |
| `computeTypeFlagsBulk` | function | `async computeTypeFlagsBulk(userIds: (string \| Types.ObjectId)[]): Promise<Map<string, DownlineTypeFlags>>` — Compute type flags for a set of users in three queries. | 41 |
| `computeTypeFlags` | function | `async computeTypeFlags(userId: string \| Types.ObjectId): Promise<DownlineTypeFlags>` — Compute type flags for one user (used by maintenance hooks). | 88 |

## Interfaces

- **Database (Mongoose models used):**
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `find`
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `find`
  - `NcSubscription` (server/models/ncSubscription.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
  - `server/models/ncSubscription.model.ts` — `NcSubscription`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/scripts/backfill-assignee-type-flags.ts`
- `server/scripts/backfill-downline-tree.ts`
- `server/services/downlineTree.ts`
