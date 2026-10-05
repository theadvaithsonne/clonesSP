# `server/routes/downlineProfile.ts`

> ─────────────────────────────────────────────────────────────────────── Downline member profile — per-tab data with server-side sort + pagination.

**Kind:** Express router · **Lines:** 210 · **Mounted at:** `/affiliate` (browser: `/backend/affiliate`)

<!-- docgen:auto -->

## Purpose
───────────────────────────────────────────────────────────────────────
Downline member profile — per-tab data with server-side sort + pagination.

The header comes from GET /affiliate/user-info/:userId (identity, upline,
location, counts). This route serves every profile TAB:

  GET /affiliate/downline/:userId/purchases
      ?category=<offices|communities|live_streams|courses|digital_products|all>
      &page=1&limit=20&sortBy=<columnId>&sortOrder=<asc|desc>

…plus the header's monthly activity chart:

  GET /affiliate/downline/:userId/monthly?year=YYYY
───────────────────────────────────────────────────────────────────────

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/downline/:userId/purchases` | `/backend/affiliate/downline/:userId/purchases` | `requireUserOrGarageAdmin` | inline | 45 |
| GET | `/downline/:userId/monthly` | `/backend/affiliate/downline/:userId/monthly` | `requireUserOrGarageAdmin` | inline | 106 |
| GET | `/downline/:userId/live-streams` | `/backend/affiliate/downline/:userId/live-streams` | `requireUserOrGarageAdmin` | inline | 152 |
| GET | `/downline/:userId/live-streams/:workshopId/sessions` | `/backend/affiliate/downline/:userId/live-streams/:workshopId/sessions` | `requireUserOrGarageAdmin` | inline | 179 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 209 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/userOrGarageAdmin.ts` — `requireUserOrGarageAdmin`
  - `server/services/downlineMemberMonthly.ts` — `getMemberMonthlyActivity`
  - `server/services/downlineMemberLiveStreams.ts` — `listMemberLiveStreams`, `listMemberLiveStreamSessions`
  - `server/services/downlineMemberPurchases.ts` — `listMemberPurchases`, `listMemberOffices`, `listMemberCommunities`, `listMemberPhysicalOrders`, `MemberTabCategory`, `SortOrder`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/affiliate`.
