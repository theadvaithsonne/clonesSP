# `server/services/downlineMemberLiveStreams.ts`

> ─────────────────────────────────────────────────────────────────────── Downline member profile → Live Streams tab, and its per-session drill-down.

**Kind:** backend service · **Lines:** 884

<!-- docgen:auto -->

## Purpose
───────────────────────────────────────────────────────────────────────
Downline member profile → Live Streams tab, and its per-session drill-down.

Rows are the live streams a MEMBER registered for, one row per stream.
Clicking "See Session Level Data" on a recurring stream opens the same
shape again, one row per SESSION of that stream.

⚠️ DELIBERATELY SEPARATE FROM `founderStreamTable.ts`.

That service answers a different question — "every stream this ORG runs,
for the founder console" — and the two tables are tuned independently.
Nothing here imports from it, and the status rule below is a copy, not a
shared helper, so a change to the founder console can never silently
re-shape a downline profile (or the reverse). If you are tempted to
de-duplicate them: don't. The duplication is the requirement.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MemberStreamStatus` | type |  | 55 |
| `MemberStreamFrequency` | type | "One Time" vs "Recurring" — the Frequency column. | 62 |
| `MemberStreamEnrollment` | type | The Enrollment Type column. | 65 |
| `MemberLiveStreamRow` | interface |  | 67 |
| `listMemberLiveStreams` | function | `async listMemberLiveStreams(params: { userId: string; viewerId?: string; }): Promise<{ rows: MemberLiveStreamRow[] }>` — The Live Streams tab — one row per live stream the member registered for. | 723 |
| `listMemberLiveStreamSessions` | function | `async listMemberLiveStreamSessions(params: { userId: string; workshopId: string; viewerId?: st…): Promise<{ rows: MemberLiveStreamRow[]; workshopTi…` — The "See Session Level Data" drill-down — one row per SESSION of a single recurring stream that this member registered for. | 775 |

## Interfaces

- **Database (Mongoose models used):**
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `find`
  - `WebinarAttendance` (server/models/webinarAttendance.model.ts) — reads: `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `find`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `aggregate`
  - `Review` (server/models/review.model.ts) — reads: `find`
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `find`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/models/webinarAttendance.model.ts` — `WebinarAttendance`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/combPlan.model.ts` — `CombPlan`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/review.model.ts` — `Review`
  - `server/models/productOrder.model.ts` — `ProductOrder`
  - `server/utils/workshopStatus.ts` — `computeSessionWindow`, `deriveSessionStatus`, `isSessionDeleted`, `sessionDayKey`
  - `server/utils/recurrence.ts` — `calculateSessions`
  - `server/services/affiliateItemUrl.ts` — `buildAffiliateItemUrl`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/downlineProfile.ts`
