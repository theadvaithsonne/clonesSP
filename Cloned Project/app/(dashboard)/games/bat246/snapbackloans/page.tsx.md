# `app/(dashboard)/games/bat246/snapbackloans/page.tsx`

> BAT246 "Snap Back Loans" page: one route with two role-aware views. Admins see every loan in the office plus request handling and history; members can request a loan of B2 Coins for their entry, see what they could lend, approve or deny requests made to them, and track their own loans.

**Kind:** Next.js page · **Lines:** 825 · **Route:** `/games/bat246/snapbackloans`

## Purpose
A Snap Back Loan lets a BAT246 member who lacks enough B2 Coins borrow them for their entry purchase (the $650 Board Entry or the $160 POD Entry). The coins come from an eligible member's "giving power" and are repaid automatically from the borrower's future earnings; the lender's giving power is not restored on repayment. This page is the single front end for that feature. Which view a user gets depends on the `snapbackloans` card grant: Alan or anyone granted that card gets the admin view, everyone else the member view. The landing-page tile is shown to everyone.

## How it works

### Top level (L817-L824)
`SnapBackLoansPage` calls `useBat246CardAccess("snapbackloans")`, renders nothing while grants load, then shows `AdminSnapBackLoansView` or `MemberSnapBackLoansView`.

### Shared helpers and types (L10-L77)
- `authHeaders()` builds `Authorization: Bearer <localStorage["garage_tok"]>`.
- `POD_ENTRY_PRODUCT_ID` is the product id of the $160 POD entry. It is used to tell whether the member was invited to the POD product (so the copy says "$160" instead of "$650").
- `fmt(n)` formats dollars and prints "Unlimited" for values at or above `Number.MAX_SAFE_INTEGER` (the backend's way of saying unlimited giving power). `fmtWhen` formats dates as "Mon D, YYYY".
- `PRODUCT_LABELS`: `board` is "$650 Board Entry", `pod` is "$160 POD Entry".
- `LoanRow` (a loan: borrower, giver, product, principal, repaid, outstanding, status `active`/`repaid`, dates, borrower's current giving power) and `SblRequest` (a request: amount, product, note, status, `loanId`, eligible lender, borrower, and for referrals `requestedByName`/`requestedByEmail` with `isReferral`).
- `STATUS_STYLES` maps request statuses `pending`, `approved`, `denied`, `insufficient_at_approval` (shown as "Couldn't be covered") and `cancelled` to a label and pill colours.

### `LoansGrid` (L79-L172)
A table used by both views: Borrower, Product, Principal, Repaid, Outstanding, Status (Active/Repaid pill), Purchasing Power (the borrower's own current giving power, as underwriting context), Issued By (giver) and Date (plus repaid date). Handles loading spinner, error with retry, and an empty message. The doc comment notes that text sizes on this page are deliberately larger than the app's norm because many of this office's members are older and have low eyesight.

### `ConfirmApproveModal` (L174-L221)
Confirmation dialog shown before approving. It restates who is asking and how much (with different wording for referrals), shows any note, and explains that approval sends that amount of B2 Coins from the approver's own giving power and that repayment does not restore it. "Confirm & Send" triggers the approval.

### `LoanRequestsPanel` (L223-L420)
Self-contained panel used by both views:
- Loads `GET ${API}/bat246/snapbackloans/requests-for-me` (requests where the user is the eligible lender) and `GET ${API}/bat246/snapbackloans/my-requests` (requests the user sent).
- **Waiting on you:** only `pending` incoming requests, each with Approve (opens `ConfirmApproveModal`) and Deny. Both call `respond(id, approve)`, which posts `POST ${API}/bat246/snapbackloans/requests/:id/respond` with `{ approve }`, toasts the result, reloads incoming and calls `onChanged`.
- **Sent by you:** every sent request with its status pill; pending ones have a Cancel button that posts `POST ${API}/bat246/snapbackloans/requests/:id/cancel`.
- Reports the pending incoming count via `onPendingCountChange`, which the parent uses for a red dot on the "Loan Requests" tab. `actingOnId` disables the buttons of the request being processed.

### `TransactionsHistory` (L422-L475)
Admin-only read-only audit list of every request the user has ever been asked to answer (all statuses, including denied, uncoverable and cancelled ones that never became loans), from the same `requests-for-me` endpoint.

### `PageShell` (L477-L494)
Page wrapper with a "Dashboard" back link to `/games/bat246`.

### Admin view, `AdminSnapBackLoansView` (L496-L577)
- Tabs: **All Loans** (default), **Loan Requests**, **Transactions**.
- All Loans loads `GET ${API}/bat246/snapbackloans/admin/list` (backend re-checks the `snapbackloans` card and returns 403 otherwise). It shows summary tiles (total loans, active count, total outstanding) above a `LoansGrid`.
- Loan Requests renders `LoanRequestsPanel` and reloads the admin list when a request changes.

### Member view, `MemberSnapBackLoansView` (L579-L815)
On mount it loads, in parallel:
- `GET ${API}/bat246/snapbackloans/my-loan` - whether the user, as borrower, currently has an `active` loan.
- `GET ${API}/bat246/layaway/my-eligibility` - the user's giving power: `eligible`, `isAlanK`, `totalRemaining`, and `pools[]` (each with cap, already given, remaining, detail).
- `GET ${API}/bat246/snapbackloans/my-activity` - every loan the user is part of as borrower or giver.
- `GET ${API}/bat246/snapbackloans/my-requests` - to find the user's own pending request.
- `GET ${API}/bat246/distributor/progress` - `invitedProductId` (POD vs Board pricing) and `steps.hasPurchasedProduct`.

Tabs (default **My Loan**):
- **My Loan:** a prompt to borrow for the "$650"/"$160" entry with a **Request Snap Back Loan** button, then a `LoansGrid` of the user's activity. The button is always visible but disabled until both the loan and pending-request checks have finished, and while a `blockedReason` applies, shown beneath it: already has an outstanding loan; has already completed the entry purchase; or has a pending request waiting on a named lender.
- **Giving Power:** "Unlimited" for Alan; for eligible users the dollar amount they could lend now plus one pill per pool; otherwise an explanation of what makes someone eligible (Home Plate seat, Leaderboard trophy, Matching Bonus, or #1 in the Lostmoney lineup) and a **Request Snap Back Loan for Someone Else** button. That referral path is deliberately not subject to the caller's own loan or purchase state.
- **Loan Requests:** `LoanRequestsPanel`; when a request changes it reloads eligibility, activity, pending request and loan status.

The `SnapBackLoanModal` opens in `"self"` mode (My Loan) or `"friend"` mode (`forFriend`). No `productId` is passed, so the modal starts with its own Board/POD product-pick step (and, for friends, a "who is this for" step). After a request is made, the page reloads activity, pending request and loan status.

## Exports
- `default SnapBackLoansPage()` - picks the admin or member view.

Internal: `LoansGrid`, `ConfirmApproveModal`, `LoanRequestsPanel`, `TransactionsHistory`, `PageShell`, `AdminSnapBackLoansView`, `MemberSnapBackLoansView`, helpers `authHeaders`, `fmt`, `fmtWhen`, and the `LoanRow`, `SblRequest`, `Pool`, `Eligibility`, `DistributorProgress` types.

## Interfaces
- **Backend endpoints called** (all `requireAuth`):
  - `GET /backend/bat246/snapbackloans/admin/list` - every loan (admin only, `snapbackloans` card checked server-side).
  - `GET /backend/bat246/snapbackloans/requests-for-me` - requests where the user is the lender.
  - `GET /backend/bat246/snapbackloans/my-requests` - requests the user sent.
  - `POST /backend/bat246/snapbackloans/requests/:id/respond` - approve or deny (`{ approve }`).
  - `POST /backend/bat246/snapbackloans/requests/:id/cancel` - cancel one's own pending request.
  - `GET /backend/bat246/snapbackloans/my-loan` - the user's latest loan as borrower.
  - `GET /backend/bat246/snapbackloans/my-activity` - loans the user is part of.
  - `GET /backend/bat246/layaway/my-eligibility` - giving power and pools.
  - `GET /backend/bat246/distributor/progress` - invited product and purchase status.
  - Indirectly `GET /backend/bat246/permissions/mine` via `useBat246CardAccess`; the modal makes its own request call.
- **Browser storage:** reads `localStorage["garage_tok"]`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (falls back to `http://localhost:4000`).

## Dependencies
- **Internal:**
  - `lib/hooks/useBat246CardAccess.ts` - admin check for the `snapbackloans` card.
  - `components/bat246/modals/SnapBackLoanModal.tsx` - the request form (self or friend).
- **Packages:** `react`, `next` (`next/link`), `sonner` (toasts), `lucide-react` (icons).

## Used by
- Next.js route `/games/bat246/snapbackloans`; linked from the always-visible "Snap Back Loans" tile on `/games/bat246`. No file imports it.

## Notes
- Approving a request moves real B2 Coin value out of the approver's giving power; the confirmation modal exists for that reason.
- `POD_ENTRY_PRODUCT_ID` is a hardcoded product id that must match the backend's POD entry product (the modal hardcodes the same id).
- The admin view still includes the Loan Requests panel, because the admin is usually the person asked to approve.
- `requests-for-me` is fetched twice for admins who open both the Loan Requests and Transactions tabs (each component loads its own copy).
- The `snapbackloans` card has no column on the Permissions page, so outside Alan the admin view can only be granted by other means.
