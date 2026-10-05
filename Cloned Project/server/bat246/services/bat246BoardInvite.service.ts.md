# `server/bat246/services/bat246BoardInvite.service.ts`

> Lets any member of an active BAT246 board email a not-yet-qualified distributor an invite/reminder to buy the $650 Board Entry, and place a qualified distributor onto a board.

**Kind:** BAT246 game module (backend) - service · **Lines:** 149

## Purpose
This is the "Board" counterpart of the POD invite flow in `bat246PodInvite.service.ts`. It powers the Distributors page buttons "Invite / Remind" (for people who have not bought Board Entry yet) and "Ready to be placed on board" (for people who have). Unlike the admin / 1st Base Approve flow (`POST /bat246/distributors/:userId/approve`), the permission here is relaxed to anyone who is part of an active board (`isPartOfAnyActiveBoard`).

## How it works
- **`sendBoardInvite(targetUserId, callerUserId)`** - validates the id and the caller's board membership, loads the target's `Bat246Distributor` and both users. Refuses if the target has no email or is already `isQualified`. Builds a product link `${FRONTEND_URL}/games/bat246/office-invite?productId=<BOARD_ENTRY_PRODUCT_ID>&ref=<callerUserId>`, renders `bat246OfficeInviteEmailTemplate` (product name and price from the `Product`, falling back to "Bat246 Board Entry" / "$650.00") and sends it via `sendMail` from `EMAIL_FROM_NOTIFICATION`. Every click sends an email (no cooldown). Each send is logged as a `Bat246BoardInvite` row of type `invite` (first) or `remind`. The distributor gets `boardInviteSentAt` and `boardInviteCount + 1`; the first-touch inviter fields `boardInvitedByUserId/Email/Name` are written only on the first send and never overwritten.
- **`placeDistributorOnBoard(targetUserId, callerUserId, choice)`** - caller must be on an active board; target must be `isQualified` and not yet `isApproved`. `choice` is either `{ boardId, toDugout: true }` (calls `placeUserInDugout`) or `{ boardId, position }` (calls `placeUserFromReservation` with `skipGreenCard: true`, because the caller is not necessarily the referrer). Afterwards the distributor is marked `isApproved` (keeping an existing `approvedAt`) and the attribution fields `boardPlacedBoardId`, `boardPlacedPositionKey`, `boardPlacedAt`, `boardPlacedByUserId` are set. The board id is looked up again by tracking number, falling back to `choice.boardId`.
- **`getBoardPlacementInfoForCaller(targetUserId, callerUserId, boardId?)`** - same membership and qualification checks, then returns `getPlacementInfo()` for the target, optionally for an explicitly picked board.

## Exports
- `BOARD_ENTRY_PRODUCT_ID` - Mongo id of the $650 Board Entry product (also duplicated in `bat246Layaway.service.ts` and the frontend `InviteNewDistributorModal.tsx`).
- `sendBoardInvite(targetUserId, callerUserId): Promise<{ ok: true; type: "invite" | "remind" }>`
- `placeDistributorOnBoard(targetUserId, callerUserId, choice): Promise<{ ok: true; placement: { position; boardTrackingNo } }>`
- `getBoardPlacementInfoForCaller(targetUserId, callerUserId, boardId?)` - the `getPlacementInfo` result.

## Interfaces
- **Endpoints served (via `server/bat246/routes/bat246.routes.ts`, mounted at `/bat246`, browser `/backend/bat246`, all `requireAuth`):** `POST /distributors/:userId/invite-board`, `GET /distributors/:userId/board-placement-info`, `POST /distributors/:userId/place-on-board`.
- **Database:** `Bat246Distributor` (read/write), `Bat246BoardInvite` (insert), `Bat246Board`, `User`, `Product` (read); placement writes happen in `bat246.service.ts`.
- **External services:** transactional email via `server/services/mailer.ts`.
- **Environment variables:** `FRONTEND_URL` (through `server/config/env.ts`) - base of the emailed product link.

## Dependencies
- **Internal:** `../models/bat246Distributor.model`, `../models/bat246BoardInvites.model`, `../models/bat246Board.model`, `../models/bat246Player.model` (imported, unused); `../../models/user.model`, `../../models/product.model`; `../../services/mailer` (`sendMail`, `EMAIL_FROM_NOTIFICATION`, `bat246OfficeInviteEmailTemplate`); `./bat246PodInvite.service` (`isPartOfAnyActiveBoard`); `./bat246.service` (`getPlacementInfo`, `placeUserFromReservation`, `placeUserInDugout`); `../../config/env` (dynamic import).
- **Packages:** `mongoose` - ObjectId validation/casting.

## Used by
`server/bat246/routes/bat246.routes.ts` and `server/bat246/controllers/bat246.controller.ts` (which reads `BOARD_ENTRY_PRODUCT_ID`).

## Notes
- Any active-board member can place any qualified, unplaced distributor onto any open board id they pass; this is intentional (see the comment on `listOpenBoardsForPlacement` in `bat246.service.ts`).
- There is no rate limit on invite emails; a caller can resend indefinitely.
