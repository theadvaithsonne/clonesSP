# `components/bat246/modals/SnapBackLoanModal.tsx`

> Step-by-step "Request a Snap Back Loan" modal: the user (or a referrer on a friend's behalf) picks a BAT246 entry product, agrees to repayment terms and asks an eligible member to lend the B2 Coins.

**Kind:** React component · **Lines:** 344

## Purpose
A Snap Back Loan (SBL) is a debt, not a gift: an eligible member lends B2 Coins for an entry product, and the borrower's future BAT246 earnings (board income, Leaderboard bonuses and so on) are automatically used to repay it. It is kept separate from `LayawayModal`'s plain "Request" because it has a different shape: it is product-only, has a terms step and allows one active loan per borrower. Per the file's own comment, text is sized larger than usual because this office's members skew older.

## How it works

### Steps
`step` is one of `"loading" | "blocked" | "friend" | "product" | "terms" | "pick" | "done"`.

- **Start (L84-L100):**
  - With `forFriend`, it goes straight to `"friend"`; referrals are not gated on the caller's own loan.
  - Otherwise it calls `GET /bat246/snapbackloans/my-loan`. If `loan.status === "active"` it shows `"blocked"`. If not, or if the call fails, it goes to `"terms"` when a `productId` prop was supplied and to `"product"` otherwise.
- **blocked:** explains that an outstanding loan is being repaid from future earnings and a new one can be requested once it is paid off, with a Close button.
- **friend:** a `LayawayUserSearch` against `/bat246/layaway/recipients/search`. Picking someone (`pickFriend`) sets `friend` and moves straight to `"product"`. The step also renders a selected-friend row and a Continue button when `friend` is set, but since picking already advances the step and there is no back button, that branch is effectively unreachable.
- **product:** one button per `PRODUCT_OPTIONS` entry ("$650 Board Entry", "$160 POD Entry"). `pickProduct` stores the id and label and moves to `"terms"`.
- **terms (L236-L279):** states the loan amount (`priceLabel`) and that all of the borrower's BAT246 earnings go to the loan until it is paid. In friend mode it adds that the caller is agreeing on the friend's behalf and that the friend's wallet receives the coins and the friend's earnings repay them. A checkbox (`agreed`) enables Continue, which moves to `"pick"`.
- **pick (L281-L320):** an "Ask" picker against `/bat246/layaway/eligible-people` (with remaining amounts shown), an optional note, and the submit button. Errors from the submit appear here.
- **done:** a success message and Close.

### Submit (L116-L146)
`submit()` requires an eligible person and a product (and a friend in friend mode). It POSTs `{ eligibleUserId, productId, note?, borrowerUserId? }` (`borrowerUserId` only when referring a friend) to `/bat246/snapbackloans/request`. On success it shows a `toast.success`, calls `onRequested?.()`, and moves to `"done"`; on failure it shows `data.error`.

`borrowerLabel` / `borrowerPossessive` switch the wording between "you"/"your" and the friend's name.

## Exports
- `SnapBackLoanModal({ productId?, priceLabel?, forFriend = false, onClose, onRequested? })` - the modal.
  - `productId` / `priceLabel` - pre-selected product (used by the boards page), which skips the product step.
  - `forFriend` - referral mode, which adds the friend step and skips the active-loan check.
  - `onRequested` - called after a successful request so the parent can refresh.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/snapbackloans/my-loan` - `requireAuth`; the caller's most recent loan (`getMySnapBackLoan`).
  - `POST /backend/bat246/snapbackloans/request` - `requireAuth`; requires `eligibleUserId` and `productId`, defaults `borrowerUserId` to the caller. `createSnapBackLoanRequest` rejects asking the borrower themself, checks the borrower is an office member, resolves the product price, rejects borrowers whose `Bat246Distributor` record shows the entry already purchased, stores a `Bat246SnapBackLoanRequest`, creates a `snapbackloan_request` `Bat246PlacementNotification` for the lender, and emails the lender (email failures are logged, not fatal). Returns `{ ok, request }`.
  - Search endpoints via `LayawayUserSearch`: `GET /backend/bat246/layaway/recipients/search`, `GET /backend/bat246/layaway/eligible-people`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (fallback `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `components/bat246/modals/LayawayUserSearch.tsx` - person pickers and `LayawayPickedUser`.
- **Packages:** `react` - state/effects; `react-dom` - `createPortal` (overlay at `z-[20000]`); `sonner` - success toast; `lucide-react` - icons.

## Used by
- `app/(dashboard)/games/bat246/boards/page.tsx` (route `/games/bat246/boards`) - opened with a pre-filled product.
- `app/(dashboard)/games/bat246/B2CoinWallet/page.tsx` (route `/games/bat246/B2CoinWallet`).
- `app/(dashboard)/games/bat246/snapbackloans/page.tsx` (route `/games/bat246/snapbackloans`).

## Notes
- The one-active-loan rule is checked here only for self-requests. In friend mode any rejection (friend already has a loan, already purchased, and so on) only appears as an error on the final step.
- If the `my-loan` check fails on the network, the modal lets the user continue; the server is the real gate.
- `PRODUCT_OPTIONS` duplicates the hardcoded product ids in `LayawayModal.tsx`.
- The terms step is the only place the borrower agrees to repayment; in friend mode the friend is never asked to confirm.
