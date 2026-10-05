# `server/routes/genealogy.ts`

> src/routes/genealogy.ts /affiliate/genealogy/* — the Genealogy page (Tree / Legs / Levels).

**Kind:** Express router · **Lines:** 565 · **Mounted at:** `/affiliate/genealogy` (browser: `/backend/affiliate/genealogy`)

<!-- docgen:auto -->

## Purpose
src/routes/genealogy.ts
/affiliate/genealogy/* — the Genealogy page (Tree / Legs / Levels). Every
route is scoped: ?root must be the caller or in the caller's downline, and any
:memberId/:nodeId must sit under that root. Contact details only for the
caller's own directs. See docs spec genealogy/backend-requirements.md.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (10)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/summary` | `/backend/affiliate/genealogy/summary` | — | inline | 82 |
| GET | `/children/:nodeId` | `/backend/affiliate/genealogy/children/:nodeId` | — | inline | 162 |
| GET | `/path/:memberId` | `/backend/affiliate/genealogy/path/:memberId` | — | inline | 203 |
| GET | `/search` | `/backend/affiliate/genealogy/search` | — | inline | 226 |
| GET | `/member/:memberId` | `/backend/affiliate/genealogy/member/:memberId` | — | inline | 306 |
| GET | `/legs` | `/backend/affiliate/genealogy/legs` | — | inline | 361 |
| GET | `/legs/:legHeadId/members` | `/backend/affiliate/genealogy/legs/:legHeadId/members` | — | inline | 431 |
| GET | `/matrix` | `/backend/affiliate/genealogy/matrix` | — | inline | 451 |
| GET | `/level/:n/members` | `/backend/affiliate/genealogy/level/:n/members` | — | inline | 479 |
| GET | `/lite` | `/backend/affiliate/genealogy/lite` | — | inline | 537 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L26)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 564 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`, `findOne`
  - `GenealogySnapshotRun` (server/models/genealogySnapshot.model.ts) — reads: `exists`
  - `GenealogySnapshot` (server/models/genealogySnapshot.model.ts) — reads: `countDocuments`
  - `RankPlan` (server/models/rankPlan.model.ts) — reads: `findOne`
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/genealogySnapshot.model.ts` — `GenealogySnapshot`, `GenealogySnapshotRun`
  - `server/models/rankRun.model.ts` — `previousPeriodKeyFor`
  - `server/models/rankPlan.model.ts` — `RANK_KEYS`, `RankPlan`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/rankBonus/detail.ts` — `getUserRankDetail`
  - `server/services/genealogy/data.ts` — `GenealogyError`, `resolveRoot`, `assertUnder`, `loadTree`, `earningsFromMember`, `ncRenewalDate`, `productsBought`, `pendingDirects`
  - `server/services/genealogy/pure.ts` — `TreeMember`, `MemberStatus`, `levelHistogram`, `monthStart`, `pathFromRoot`, `summarizeLegs`, `buildMatrix`, `levelBucket`, … +2
  - `server/services/unilevelPlusCommission.ts` — `INFINITY_T1_MIN_LEGS`, `INFINITY_T2_MIN_LEGS`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/affiliate/genealogy`.
