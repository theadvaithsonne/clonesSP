# `server/bat246/routes/bat246SnapBackLoan.routes.ts`

> Express router for BAT246 Snap Back Loans: requesting a B2 Coin loan for an entry, approving or denying and cancelling requests, the member's own loan views, and the admin list.

**Kind:** BAT246 game module (backend) — Express router · **Lines:** 130 · **Mounted at:** `/bat246/snapbackloans` (browser: `/backend/bat246/snapbackloans`)

## Purpose
A Snap Back Loan lends B2 Coins to someone so they can buy the $650 Board Entry or $160 POD Entry. The loan is repaid automatically from that person's future real BAT246 earnings. This router exposes `bat246SnapBackLoan.service.ts` over HTTP; the service holds every rule (eligibility, one active loan per borrower, the approval race guard, repayment). The underlying documents are described in `bat246SnapBackLoanRequest.model.ts`, `bat246SnapBackLoan.model.ts` and `bat246SnapBackLoanRepayment.model.ts`.

## How it works
Every route uses `requireAuth`. Successful responses are `{ ok: true, ... }`. Errors are `400 { error }`.

- `POST /request` `{eligibleUserId, productId, note?, borrowerUserId?}`:
  - `eligibleUserId` and `productId` are required.
  - `borrowerUserId` defaults to the caller. A different value makes it a referral: the caller asks on a friend's behalf, and the friend's earnings will be garnished.
  - Calls `createSnapBackLoanRequest`, which validates the request, saves it, creates a notification and emails the lender.
- `POST /requests/:id/respond` `{approve}`: `respondToSnapBackLoanRequest(id, caller, !!approve)`. Only the eligible lender may respond. Approving moves the coins with `giveB2Coins` and creates the loan.
- `POST /requests/:id/cancel`: `cancelSnapBackLoanRequest`. Only the original requester may cancel, and only while the request is pending.
- `GET /my-requests`: requests the caller sent (`getMySnapBackLoanRequests`).
- `GET /requests-for-me`: requests addressed to the caller as lender (`getSnapBackLoanRequestsForMe`).
- `GET /my-loan`: the caller's most recent loan and its repayment ledger (`getMySnapBackLoan`). Powers the "My Loan" card on the B2 Coin Wallet page.
- `GET /my-activity`: every loan where the caller is borrower or giver, in the same row shape as the admin grid (`getMySnapBackLoanActivity`).
- `GET /admin/list`: allowed when `isBat246CardAdmin(email, userId, "snapbackloans")` passes, i.e. the admin email or an explicit "snapbackloans" card grant. Otherwise 403. Returns `adminListSnapBackLoans()`: every loan, the amount owed, and the borrower's current giving power.

## Exports
- `default` — the Express `Router`.

## Interfaces
- **Endpoints served:** the eight routes above under `/backend/bat246/snapbackloans`. All need a Bearer JWT, and `/admin/list` also needs a card permission.
- **Database:** none directly. Through the service: `Bat246SnapBackLoanRequest`, `Bat246SnapBackLoan`, `Bat246SnapBackLoanRepayment`, `Bat246PlacementNotification`, `Bat246Distributor`, `User`, plus B2 Coin wallet and transaction writes inside `giveB2Coins`.

## Dependencies
- **Internal:** `server/bat246/services/bat246SnapBackLoan.service.ts` (all logic), `server/bat246/services/bat246Permission.service.ts` (`isBat246CardAdmin`), `server/middleware/auth.ts` (`requireAuth`).
- **Packages:** `express` - Router and types.

## Used by
- Mounted in `server/app.ts` with `app.use("/bat246/snapbackloans", bat246SnapBackLoanRoutes)`.
- Frontend: `components/bat246/modals/SnapBackLoanModal.tsx` (submitting requests), `app/(dashboard)/games/bat246/snapbackloans/page.tsx` (member activity and the admin list), and the B2 Coin Wallet page (`my-loan`).

## Notes
- `/admin/list` reads `caller.email` from `req.user`. `requireAuth` fills that in from the database, so the admin email check works.
