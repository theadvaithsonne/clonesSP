# `server/services/genealogy/data.ts`

> src/services/genealogy/data.ts DB access for /affiliate/genealogy/*.

**Kind:** backend service · **Lines:** 416

<!-- docgen:auto -->

## Purpose
src/services/genealogy/data.ts
DB access for /affiliate/genealogy/*. Maths lives in ./pure.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GenealogyError` | class | `extends Error` | 18 |
| `resolveRoot` | function | `async resolveRoot(callerId: string, rootParam?: string)` — Effective view root: the caller, or a member of the caller's downline. | 27 |
| `assertUnder` | function | `async assertUnder(rootOid: Types.ObjectId, memberId: string)` — `memberId` must be the root or inside its subtree; 404 otherwise (no leak). | 43 |
| `statusSets` | function | `async statusSets(ids?: Types.ObjectId[])` — active = paid NC subscriber now; hasChain = owns any NC chain root; qualified = active UnilevelPlusPurchase. | 73 |
| `ncOf` | function | `ncOf(id: string, s: { active: Set<string>; hasChain: Set<string> }): NcStatus` | 101 |
| `volumeUsdByUser` | function | `async volumeUsdByUser(from: Date, to: Date, ids?: Types.ObjectId[])` — Paid-invoice volume per user in [from, to). | 109 |
| `loadTree` | function | `loadTree(rootOid: Types.ObjectId): Promise<{ root: TreeMember; members: TreeMember[]…` — The root plus every descendant, with status, leg, level and this month's volume attached. | 159 |
| `earningsFromMember` | function | `async earningsFromMember(me: Types.ObjectId, member: Types.ObjectId)` | 241 |
| `ncRenewalDate` | function | `async ncRenewalDate(userId: Types.ObjectId): Promise<Date \| null>` — Latest nextDueDate across the member's NC chain (null when none). | 318 |
| `productsBought` | function | `async productsBought(userId: Types.ObjectId)` — Distinct paid products, newest first; amount is the latest ex-GST USD price. | 345 |
| `pendingDirects` | function | `async pendingDirects(directIds: Types.ObjectId[]): Promise<number>` — Directs covered by a paid NC invoice right now but not active (free month only) — they count once they pay. | 385 |
| `emptySplit` | export |  | 415 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `exists`, `findById`, `find`
  - `RankPlan` (server/models/rankPlan.model.ts) — reads: `findOne`
  - `Invoice` (server/models/invoice.model.ts) — reads: `distinct`, `aggregate`, `find`, `findOne`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `distinct`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `find`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `find`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/rankPlan.model.ts` — `RankPlan`
  - `server/services/rankBonus/activeSubscribers.ts` — `getActivePaidSubscribers`
  - `server/fx/fxService.ts` — `getRateTable`
  - `server/services/genealogy/pure.ts` — `NcStatus`, `TreeMember`, `EarnSplit`, `memberStatus`, `legHeadOf`, `netMinor`, `minorToUsd`, `monthStart`, … +3
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/genealogy.ts`
- `server/services/genealogy/snapshot.ts`
