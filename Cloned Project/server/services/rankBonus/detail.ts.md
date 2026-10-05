# `server/services/rankBonus/detail.ts`

> src/services/rankBonus/detail.ts

**Kind:** backend service · **Lines:** 428

<!-- docgen:auto -->

## Purpose
src/services/rankBonus/detail.ts

Read-only projections behind the admin UI. Nothing here writes.

The point is to answer "why does this person hold this rank, and what would
move them?" without anyone having to re-run the job or read Mongo by hand.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PersonSummary` | interface |  | 15 |
| `UserRankDetail` | interface |  | 61 |
| `getUserRankDetail` | function | `async getUserRankDetail(userIdRaw: string, thirdPartyClientId: Types.ObjectId \| string): Promise<UserRankDetail \| null>` | 101 |
| `SubscriberRow` | interface |  | 304 |
| `listSubscribers` | function | `async listSubscribers(opts: { thirdPartyClientId: Types.ObjectId \| string; search…): Promise<{ rows: SubscriberRow[]; total: number; a…` | 326 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`, `aggregate`, `countDocuments`
  - `RankPlan` (server/models/rankPlan.model.ts) — reads: `findOne`
  - `RankQualification` (server/models/rankQualification.model.ts) — reads: `find`
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`
  - `RANK_KEYS` (server/models/rankPlan.model.ts) — referenced

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/rankQualification.model.ts` — `RankQualification`
  - `server/models/rankPlan.model.ts` — `RankPlan`, `RANK_KEYS`, `payoutFor`, `RankKey`
  - `server/services/rankBonus/activeSubscribers.ts` — `getActivePaidSubscribers`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminRankBonus.ts`
- `server/routes/genealogy.ts`
- `server/routes/rankBonus.ts`
