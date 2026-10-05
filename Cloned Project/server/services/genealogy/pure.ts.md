# `server/services/genealogy/pure.ts`

> Pure maths behind /affiliate/genealogy/*.

**Kind:** backend service · **Lines:** 279

<!-- docgen:auto -->

## Purpose
Pure maths behind /affiliate/genealogy/*. No DB, no I/O — everything the
routes compute that is worth a test lives here.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NcStatus` | type |  | 5 |
| `MemberStatus` | type |  | 6 |
| `memberStatus` | function | `memberStatus(nc: NcStatus, qualified: boolean): MemberStatus` — Label precedence agreed 2026-09-19: lapsed > qualified > active > inactive. | 9 |
| `legHeadOf` | function | `legHeadOf(ancestors: unknown[] \| undefined, rootId: string, selfId: string): string \| null` — The root's direct child on this member's path (the member itself when it is a direct), or null when the root is not one of its ancestors. | 17 |
| `pathFromRoot` | function | `pathFromRoot(ancestors: unknown[] \| undefined, rootId: string, selfId: string): string[] \| null` — Ids root → … → self, or null when self is not under root. | 29 |
| `netMinor` | function | `netMinor(inv: { totalAmount?: number; tax?: number; shippingCost?: n…): number` — Invoice value without GST or shipping, in paymentCurrency minor units. | 42 |
| `minorToUsd` | function | `minorToUsd(minor: number, currency: string \| undefined, usdRates: Record<string, number>): number` — Minor units → USD dollars (2dp). | 48 |
| `monthStart` | function | `monthStart(d: Date): Date` | 59 |
| `monthRange` | function | `monthRange(periodKey: string): { from: Date; to: Date }` | 63 |
| `LEVEL_BUCKETS` | const | `= 16` — Levels 1..15 are the bonus zone; everything deeper shares bucket 16 ("16+"). | 69 |
| `levelBucket` | function | `levelBucket(level: number): number` | 70 |
| `rankOrder` | function | `rankOrder(rank: string \| null \| undefined): number` | 74 |
| `TreeMember` | interface |  | 81 |
| `ancestorsOf` | function | `ancestorsOf(matches: readonly { id: string; parentId: string \| null }[], all: readonly TreeMember[]): string[]` — Every ancestor of `matches`, up to and including the root, excluding the matches themselves. | 113 |
| `Cell` | interface |  | 131 |
| `emptyCell` | function | `emptyCell(): Cell` | 138 |
| `buildMatrix` | function | `buildMatrix(members: TreeMember[], legHeads: string[])` — Leg × level matrix (levels 1..15 + "16+"). | 153 |
| `levelHistogram` | function | `levelHistogram(members: TreeMember[]): number[]` | 175 |
| `LegSummary` | interface |  | 181 |
| `summarizeLegs` | function | `summarizeLegs(members: TreeMember[], legHeads: string[]): LegSummary[]` | 193 |
| `EarnSplit` | interface |  | 227 |
| `emptySplit` | function | `emptySplit(): EarnSplit` | 234 |
| `addSplits` | function | `addSplits(...s: EarnSplit[]): EarnSplit` | 238 |
| `UpDistLike` | interface |  | 253 |
| `upEarnings` | function | `upEarnings(me: string, rows: UpDistLike[]): EarnSplit` — What `me` was credited from UnilevelPlusDistribution rows (USD). | 264 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/rankPlan.model.ts` — `RANK_KEYS`
- **Packages:** none

## Used by

- `server/routes/genealogy.ts`
- `server/services/__tests__/genealogyPure.test.ts`
- `server/services/genealogy/data.ts`
- `server/services/genealogy/snapshot.ts`
