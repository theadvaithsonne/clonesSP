# `app/(dashboard)/games/bat246/B2CoinWallet/page.tsx`

> The BAT246 "B2 Coin Wallet" page: shows the user's B2 Coin balance and giving power, their Snap Back Loan, their transaction history, and lets them approve, deny or cancel B2 Coin (Layaway) requests and Snap Back Loan requests.

**Kind:** Next.js page · **Lines:** 1138 · **Route:** `/games/bat246/B2CoinWallet`

## Purpose
B2 Coins are BAT246's internal credit. Eligible players can give them to other office members, typically to cover a board or POD entry; this is the "Layaway" system. A separate "Snap Back Loan" (SBL) system lets a player borrow coins for a board or POD entry, and the loan is repaid automatically from 100% of their future BAT246 earnings. This page is the persistent home for both systems. Before it existed, requests could only be acted on through the notification bell, and there was nowhere to check their status afterwards. It is a client component under the `(dashboard)` route group. It is one of the cards on the BAT246 dashboard, and every office member gets it by default.

## How it works

### Access and back link (L15-L19, L153-L156, L393-L402)
`useMyBat246Grants()` gives `isAlanK` (the hardcoded BAT246 admin email) and `grantedKeys` (from `GET /backend/bat246/permissions/mine`). `DEFAULT_MEMBER_CARD_KEYS` (`documentation`, `b2coinwallet`) mirrors the defaults every office member gets, so holding only those keys does not count as admin. `isAdmin` is used only to label the back link "Admin Board" or "Dashboard"; the link goes to `/games/bat246` either way. The page does not restrict access itself. Every endpoint it calls is scoped to the caller by the backend.

### Data loading (L213-L285)
On mount, seven independent loaders run. Each has its own `null`/error state, a "Try again" button and a spinner:

| Loader | Endpoint | State |
|---|---|---|
| `loadWallet` | `GET /backend/bat246/layaway/my-wallet` | `wallet` (`balance`, `transactions[]`; resets `txPage` to 1) |
| `loadEligibility` | `GET /backend/bat246/layaway/my-eligibility` | `eligibility` (`eligible`, `isAlanK`, totals, `pools[]`) |
| `loadSentRequests` | `GET /backend/bat246/layaway/my-requests` | Layaway requests this user sent |
| `loadIncomingRequests` | `GET /backend/bat246/layaway/requests-for-me` | Layaway requests waiting on this user as the eligible giver |
| `loadMyLoan` | `GET /backend/bat246/snapbackloans/my-loan` | `myLoan` (the user's own most recent loan, or null) |
| `loadSblSentRequests` | `GET /backend/bat246/snapbackloans/my-requests` | SBL requests this user sent |
| `loadSblIncomingRequests` | `GET /backend/bat246/snapbackloans/requests-for-me` | SBL requests waiting on this user |

All calls send `Authorization: Bearer <garage_tok>` via `authHeaders()`.

### Actions (L287-L387)
- `respondToIncoming(id, approve, amount?)` posts `{ approve, amount? }` to `POST /backend/bat246/layaway/requests/:id/respond`, shows a toast with the amount the server sent back, and reloads the incoming requests, wallet and eligibility, because an approval spends the approver's own giving power. It returns a boolean so the confirm modal stays open on failure.
- `confirmApprove(amount?)` is the Approve modal's submit; it closes the modal only on success.
- `cancelSentRequest(id)` calls `POST /backend/bat246/layaway/requests/:id/cancel`.
- `respondToSblIncoming(id, approve)` and `confirmApproveSbl()` do the same for `POST /backend/bat246/snapbackloans/requests/:id/respond`. No amount is sent, because SBL amounts are fixed.
- `cancelSblSentRequest(id)` calls `POST /backend/bat246/snapbackloans/requests/:id/cancel`.
- `actingOnId` / `sblActingOnId` disable only the row whose action is in flight.
- **Deny is one click with no confirmation.** Approve always opens a confirmation modal first.

### UI sections (L389-L962)
- **Header buttons:** "Request SBL" opens `SnapBackLoanModal`, and "Transact" opens `LayawayModal`. That is the same give/request modal the board's Layaway button uses, reused on purpose so its edge cases are not reimplemented: no giving power forces Request mode, the admin never sees Request, a user cannot send to themselves, recipients must be office members, and product amounts come from the server. When `LayawayModal` closes, the page reloads the wallet, eligibility and both request lists. When `SnapBackLoanModal` reports `onRequested`, the page reloads the SBL sent list and `myLoan`.
- **Balance card:** if `eligibility.isAlanK`, shows "Unlimited" instead of the admin's real (usually zero) balance. Otherwise it shows `wallet.balance` formatted with `fmtCoins`, plus a hint when the balance is 0.
- **Giving Power card:** "Unlimited" for the admin. Eligible users see `totalRemaining` plus one chip per pool (`detail — $remaining left`). Ineligible users see an explanation: they would need to be at Home Plate, hold a Leaderboard trophy, qualify for the Matching Bonus, or be #1 in the Lostmoney lineup.
- **My Snap Back Loan card** (only when a loan exists, so it never flashes empty): the product label (`SBL_PRODUCT_LABELS`: board = "$650 Board Entry", pod = "$160 POD Entry"), the giver, Principal / Repaid / Outstanding figures, a progress bar of repaid over principal, active or repaid copy, and the last five repayments.
- **Tabbed history card** (`txView`):
  - *Recent Transaction:* the merged received/sent list from the wallet endpoint. Received rows show "+" and the coin logo; sent rows show "−" and "Sent to …". A "via your request" / "via a request" chip marks `viaRequest` rows. Paging is client-side, 10 rows per page (`TX_PAGE_SIZE`), over the up to 500 rows the backend returns.
  - *Requests:* "Waiting on you" rows (Approve / Deny while pending, otherwise a `StatusBadge`) and "Sent by you" rows (badge, plus Cancel while pending). A red dot on the tab shows when any incoming request is pending.
  - *Loan Requests:* the same structure for SBL, styled orange so it is never confused with a plain B2 Coin ask.

### Local components
- `StatusBadge({ status })` - pill for the `pending | approved | denied | insufficient_at_approval | cancelled` statuses (`STATUS_STYLES`; `insufficient_at_approval` reads "Couldn't be covered").
- `ApproveRequestModal` (L1046-L1137) - portaled to `document.body` at `z-[20000]`. For a product-targeted request the amount is shown read-only, because it is always the real product price. For a plain-amount request the approver can edit the amount, the original is shown and an amber warning appears when it changes, and Confirm is disabled unless the amount is greater than 0. It calls `onConfirm(undefined)` for products and `onConfirm(Number(amount))` otherwise.
- `ApproveSblRequestModal` (L970-L1035) - read-only confirmation. Its copy says the coins come from the approver's giving power, are repaid from the borrower's future earnings, and that the approver's giving power is not restored on repayment.

### Formatting helpers
`fmtCoins(n)` uses locale formatting with at most 2 decimals. `fmtWhen(iso)` formats as "Mon D, YYYY · h:mm AM".

## Exports
- `default B2CoinWalletPage()` - the page component. All other functions, interfaces and constants are module-private.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/layaway/my-wallet`, `GET /backend/bat246/layaway/my-eligibility`, `GET /backend/bat246/layaway/my-requests`, `GET /backend/bat246/layaway/requests-for-me`
  - `POST /backend/bat246/layaway/requests/:id/respond` (`{ approve, amount? }`), `POST /backend/bat246/layaway/requests/:id/cancel`
  - `GET /backend/bat246/snapbackloans/my-loan`, `GET /backend/bat246/snapbackloans/my-requests`, `GET /backend/bat246/snapbackloans/requests-for-me`
  - `POST /backend/bat246/snapbackloans/requests/:id/respond` (`{ approve }`), `POST /backend/bat246/snapbackloans/requests/:id/cancel`
  - Indirectly: `GET /backend/bat246/permissions/mine` (grants hook), `GET /backend/auth/me` (via `useAmIFounder`), plus whatever `LayawayModal` and `SnapBackLoanModal` call.
  - Server side, these are handled by `server/bat246/routes/bat246Layaway.routes.ts` (services in `server/bat246/services/bat246Layaway.service.ts`) and `server/bat246/routes/bat246SnapBackLoan.routes.ts` (services in `server/bat246/services/bat246SnapBackLoan.service.ts`), all behind `requireAuth`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]`.

## Dependencies
- **Internal:**
  - `lib/hooks/useBat246CardAccess.ts` - `useMyBat246Grants`, the `Bat246CardKey` type.
  - `components/bat246/modals/LayawayModal.tsx` - give/request B2 Coins ("Transact").
  - `components/bat246/modals/SnapBackLoanModal.tsx` - request a Snap Back Loan.
- **Packages:** `react` (state/effects), `react-dom` (`createPortal` for the confirm modals), `next` (`Link`), `sonner` (toasts), `lucide-react` (icons).

## Used by
Not imported by any module. It is reached as the Next.js route `/games/bat246/B2CoinWallet`, normally through the B2 Coin Wallet card on the BAT246 dashboard (`/games/bat246`).

## Notes
- The route segment is PascalCase (`B2CoinWallet`), so the URL is case-sensitive.
- The approver can send a different amount than was requested for plain requests. The backend decides whether that amount is allowed (the "insufficient" case comes back as a toast error).
- After `respondToSblIncoming` the page does not reload `myLoan`. That is correct, because the approver is not the borrower.
- Terminology: the UI copy says "B2 Coins", "Layaway" (internally) and "Snap Back Loan / SBL". Keep that wording when editing copy.
