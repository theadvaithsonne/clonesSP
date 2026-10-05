# `server/bat246/models/bat246PlacementNotifications.model.ts`

> Mongoose model behind the BAT246 notification bell. It holds notifications addressed to an upline user: placements awaiting action, membership and affiliate purchases, and layaway or Snap Back Loan requests.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 34

## Purpose
BAT246 tells a player's upline (or an admin) when something needs their attention: a newly qualified downline waiting for an AT BAT placement, a downline buying the membership or Unilevel Plus, or someone asking them to give B2 Coins or approve a Snap Back Loan. The model began as placement-only, which is where its name comes from, and gained more types over time through the free-form `notificationType` field.

## How it works
Fields (no schema timestamps; `createdAt` defaults to now):
- `notificationType` (String, default `"placement"`, no enum). The comment lists:
  - `placement`: an AT BAT placement is pending, with `boardId` and `position`;
  - `membership`: the $20 annual membership was bought;
  - `affiliate`: the $25 Unilevel Plus was bought.

  The code also writes `placement_unassigned`, `layaway_request` and `snapbackloan_request`.
- `boardId` (default `null`), `boardTrackingNo`, `position`.
- `qualifiedUserId` (→ `User`, required), `qualifiedUserEmail` (required), `qualifiedUserName`: the person the notification is about.
- `uplineUserId` (→ `User`, required): the recipient. `uplinePosition` gives their board position.
- `isRead` and `isActioned` (both default `false`).
- `layawayRequestId` (→ `bat246LayawayRequests`) and `snapBackLoanRequestId` (→ `bat246SnapBackLoanRequests`): links to the underlying request.
- `summary`: display text.

Index: `{ uplineUserId: 1, isActioned: 1 }`, matching the bell query.

Reading and updating (`bat246.controller.ts`):
- `getNotifications` returns the caller's rows where `isActioned: false`, newest first.
- `markNotificationRead` sets `isRead`.
- `clearNotification` sets both `isActioned` and `isRead`.

Both updates are limited to rows whose `uplineUserId` is the caller.

Rows are created by:
- `bat246.service.ts`
- `bat246Layaway.service.ts`
- `bat246MembershipBilling.service.ts`
- `bat246SnapBackLoan.service.ts`
- `server/routes/invoice.ts`, which checks `exists` first so repeat fulfilments do not create duplicates.

## Exports
- `Bat246PlacementNotification` - Mongoose model registered as `"bat246PlacementNotifications"`.

## Interfaces
- **Database:** collection `bat246placementnotifications`.
- **Endpoints using it** (all `requireAuth`):
  - `GET /backend/bat246/notifications`
  - `POST /backend/bat246/notifications/:id/read`
  - `POST /backend/bat246/notifications/:id/clear`

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/bat246/controllers/bat246.controller.ts`, `server/bat246/services/bat246.service.ts`, `server/bat246/services/bat246Layaway.service.ts`, `server/bat246/services/bat246MembershipBilling.service.ts`, `server/bat246/services/bat246SnapBackLoan.service.ts`, `server/routes/invoice.ts`, `server/routes/productCheckout.ts`, `server/routes/unilevel-plus.ts`, `server/services/invoice.ts`.

## Notes
- **Historical data gap:** `layawayRequestId` and `summary` used to be passed to `create()` without being declared here. Mongoose's strict mode silently dropped them, so every `layaway_request` notification created before the fix lacks them, and the bell's inline Approve/Deny buttons never worked for those rows. Old rows were not backfilled.
- When adding a new notification field, declare it in this schema, or it will be silently discarded.
- `boardId` uses `ref: "Bat246Board"`, which does not match the registered board model name (`"bat246Boards"`).
