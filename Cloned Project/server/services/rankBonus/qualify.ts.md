# `server/services/rankBonus/qualify.ts`

> src/services/rankBonus/qualify.ts

**Kind:** backend service · **Lines:** 177

<!-- docgen:auto -->

## Purpose
src/services/rankBonus/qualify.ts

Computes everyone's rank in a single O(n) pass over the referral tree.

The key insight: a node's rank depends only on what its CHILDREN's subtrees
contain, never on its parent or siblings. So if we process deepest-first,
every child is already resolved when we reach the parent and no iteration is
needed.

Rules (see NETWORKCHAIN_RANK_BONUS_PLAN.md):
  Bronze   = you are active AND >= 5 direct referrals are active
  Silver   = 1 Bronze  in each of 4 distinct legs
  Gold     = 1 Silver  in each of 5 distinct legs
  Diamond  = 1 Gold    in each of 6 distinct legs
  Platinum = 1 Diamond in each of 10 distinct legs
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RankOrdinal` | type | Ordinal: Bronze=0 … Platinum=4. | 29 |
| `QualifyInput` | interface |  | 31 |
| `QualifiedUser` | interface |  | 39 |
| `QualifyResult` | interface |  | 50 |
| `qualifyTree` | function | `qualifyTree(input: QualifyInput): QualifyResult` | 58 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/rankPlan.model.ts` — `IRankPlan`, `RANK_KEYS`, `RankKey`
- **Packages:** none

## Used by

- `server/scripts/preview-rank-bonus.ts`
- `server/services/rankBonus/run.ts`
