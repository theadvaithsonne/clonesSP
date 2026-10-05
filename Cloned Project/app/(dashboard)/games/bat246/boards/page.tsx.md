# `app/(dashboard)/games/bat246/boards/page.tsx`

> The BAT246 "Boards" page (Minor League lobby): for ordinary members it shows the path to becoming a qualified distributor and sells the membership and the $650/$160 entry product (by card, wallet, Razorpay or B2 Coins). For the board admin it lists, creates, activates and hides boards.

**Kind:** Next.js page · **Lines:** 2049 · **Route:** `/games/bat246/boards`

## Purpose
This is the main board list for the BAT246 game and the onboarding funnel for new players. A non-admin member sees a progress bar towards "BAT 246 Distributor":
1. Being in the BAT 246 office.
2. Holding a BAT 246 membership.
3. Buying the entry product.

They also see banners to complete the missing steps, and the board lists only once they are qualified. The admin (anyone holding the `boards` card, including the hardcoded BAT246 admin) gets the full board catalogue plus management tools. The page also auto-switches users into the BAT246 organisation if they arrive while signed into another org. It is a client component in the `(dashboard)` route group.

## How it works

### File layout
- L1-L44: imports, constants (`BOARDS_PER_PAGE = 6`, `BAT246_ORGS`, `STATUS_COLOR`, `WARP_COLOR`) and `getToken()`.
- L46-L195: `DistributorProgressBar` and its step definitions.
- L198-L274: position constants and `PositionSummary`.
- L276-L371: `PositionLinksPanel` (admin invite links).
- L373-L440: `BoardCard`.
- L442-L1161: the `Bat246BoardsPage` state, data loading and handlers.
- L1163-L1629: main page JSX.
- L1631-L2045: modals.

### Helper components (L46-L440)
- **`DistributorProgressBar({ progress })`** shows a skeleton while loading, a gold "BAT 246 Distributor — Qualified" badge once `isQualified` is true, and otherwise a stepper plus progress bar.
  - Steps come from `PROGRESS_STEPS_BASE` (office, then membership) plus `entryStep(invitedProductId)`. The entry step reads "$160 POD Entry" when the user was invited for the POD product (`POD_ENTRY_PRODUCT_ID`) and "$650 Board Entry" otherwise.
  - A "$25 Garage Affiliate" step is commented out with a `TEMP` note. Step widths are computed from the step count so the remaining steps stay evenly spaced.
- **`PositionSummary({ positions })`** draws one small chip per board slot (3B, 2A, 2B, 1A-1D, B1-B8), coloured green when filled, yellow when reserved (the tooltip shows the reservation's expiry time) and grey when open, plus counts.
- **`PositionLinksPanel({ boardId, trackingNumber })`** is admin only and collapsible. It copies the board overview link `/games/bat246/<boardId>` and per-position join links `/games/bat246/join/<boardId>/<positionKey>` to the clipboard.
- **`BoardCard({ board, isAdmin })`** links to `/games/bat246/<id>`. It shows the tracking number, title and status badge; an active board past `protectionPeriodEnd` shows "PP Ended" in the stalled colour. It also shows the Minor League amount, the WARP level, the protection period (PP) status and the position summary. A "Preview" button copies `/games/bat246/preview/<id>`. Admins also get the position links panel.

### Page state and data loading (L442-L1161)
- **Who is admin:** `useBat246CardAccess("boards").isAdmin`, stored in a variable confusingly named `isAlanK`. Non-admins always see only their own boards (`effectiveMine = true`). Admins can toggle "My Boards" / "All Boards".
- `useBoards(effectiveMine)` returns `boards` and `completed` from `GET /backend/bat246/boards[?mine=true]`. It polls every 15s and caches in `sessionStorage`.
- **Non-admin loads:**
  - `GET /backend/bat246/my-dashboard-access` decides where the back link goes.
  - `GET /backend/bat246/membership/status` sets `membershipActive`.
  - `GET /backend/wallet/affiliate/balance` gives `hasPurchasedUnilevelPlus`, and `GET /backend/unilevel-plus/product` gives the price and the 24h-window / combo rule (`upOfferClosed`).
  - `fetchDistributorProgress()` calls `GET /backend/bat246/distributor/progress`. It runs on load, again whenever the window regains focus (for example after checking out in another tab), and after every purchase.
- **Org auto-join (L1059-L1098):**
  - If `userData.orgName` is in `BAT246_ORGS` (`"TestCompany XYZ"`, `"Bat246"`, `"BAT 246"`), the page clears the `sessionStorage` guard `bat246_org_autojoin_attempted`.
  - Otherwise, once per tab, it calls `POST /backend/bat246/office/join`. The backend adds the user to the BAT246 org as a stakeholder and returns a new JWT. The page writes `garage_tok` and `garage_org_id` to `localStorage` (with a hardcoded org-id fallback at L1090) and reloads.
  - The guard prevents an infinite reload loop. A second attempt, or any failure, redirects to `/workspace`.
- **Board grouping (L1134-L1161):**
  - `pendingBoards`: status `pending`, admin only.
  - `activeBoards`: anything not pending, split or completed.
  - `allCompleted`: split or completed boards that leaked into `boards`, plus `completed`.
  - Each section has its own client-side search (tracking number, title, board number), resets to page 1 on search, and pages at 6 boards (2×3).

### Purchase flows
- **Membership, free trial (L971-L994):** the "Claim Free for 2 Months" button opens a confirmation popup that discloses the later $12/month debit from the B2 wallet. On OK it calls `POST /backend/bat246/membership/activate-free`, with no invoice. An older $20/year membership payment modal (L1816-L1881) is still in the file, but nothing sets `membershipModalOpen` any more, so it is effectively dead code kept on purpose.
- **Entry product purchase, `handleBoardEntryBuy` (L743-L785):**
  - Shown when the user has not bought the entry product and is not qualified. The product is the POD product (`$160`) if invited for it, otherwise the board-entry product (`$650`); both product ids are hardcoded at L66 and L1317.
  - It calls `POST /backend/checkout/product/:productId/process-checkout` with the session email and name, a hardcoded `referralId` affiliate code, and `bat246Ref` (the BAT246 referrer from the progress endpoint).
  - When the response has an `invoiceId`, it opens the in-page payment modal: `PlatformCouponInput` (applies coupons through `POST /backend/api/invoices/:id/apply-platform-coupon`) plus `PaymentMethodSelector`. The amount is the sticker price in cents, because entry products are tax-free.
  - `isFree` / `isMember` responses mean nothing is left to pay.
- **Razorpay completion (L540-L741):**
  - `PaymentMethodSelector.onPaymentInitiated` means "done" only for `walletPaid`, `stripePaid` or `alreadyPaid`.
  - For Razorpay responses (`razorpayOrderId` + `razorpayKeyId`), the page loads `https://checkout.razorpay.com/v1/checkout.js`, opens the checkout and, in its `handler`, calls `POST /backend/api/invoices/:id/verify-payment`.
  - Any other response shape shows an error instead of claiming success. The comments describe the earlier bug: every initiation was treated as paid, so the user saw "activated" without being charged. This mirrors `CheckoutPaymentStep.tsx`.
  - Handlers: `handleUpPaymentInitiated` / `handleUpVerifyPayment` for Garage Affiliate, and `handleBoardEntryPaymentInitiated` / `handleBoardEntryVerifyPayment` for entry products.
- **Pay with B2 Coins (L787-L871, L1956-L2037):**
  - `handleB2CoinsBuy` creates a full-price invoice through the same `process-checkout` call, then fetches `GET /backend/bat246/layaway/my-wallet` for the balance.
  - The modal shows Available vs Required. Both are plain dollars: `process-checkout` already returns `product.totalAmount` in dollars, and the comment at L491-L497 stresses that no cents conversion happens here.
  - If the balance covers it, `handleB2CoinsPay` calls `POST /backend/bat246/layaway/pay-entry` with `{ invoiceId }`.
  - If not, a "Request SBL" button hands the product to `SnapBackLoanModal`, which manages its own Snap Back Loan request flow.
- **Garage Affiliate / Unilevel Plus (L516-L657, L937-L969, L1631-L1712):**
  - `handleUPActivate` calls `POST /backend/unilevel-plus/checkout/create-order` with `source: "bat246_office"`, which exempts it from the backend's post-24h-window guard. It stores the GST-inclusive `razorpayOrder.amount` in `upInvoiceTotalCents`.
  - The modal prefers the coupon-adjusted total, then the backend total, then a local 18% GST estimate (`UP_GST_MULT`). GST only applies to INR payments.
  - **The banner that opens this flow is disabled with `{false && ...}` (TEMP, L1242), so in practice the flow cannot be reached right now.**

### Admin tools
- **Create board:** `POST /backend/bat246/boards`, with a toast showing the new tracking number.
- **Pending boards ("Setup Required"):** "Activate Board — Start PP Clock" calls `POST /backend/bat246/boards/:id/activate` with `{ nextHomePlatePayout }`. That value defaults to 200 because the payout selector is commented out. Activation starts the 120h Protection Period.
- **Family-6 Make Live / Pause Live (L1100-L1132):** finds boards whose tracking numbers are `6-1001`, `6-1002 L` and `6-1003 R` in the loaded list, and toggles all of them with `POST /backend/bat246/boards/:id/hidden` (`{ hidden }`) after a confirmation popup. A hidden board is visible only to the BAT246 admin email.
- **Notification bell:** `Bat246NotificationBell` gets `handlePlaceNow`, which posts `{ notificationId }` to `POST /backend/bat246/boards/:boardId/place-user` to place a qualified user from a placement notification.

### Visibility rules in the JSX
- The distributor progress bar, the membership banner and the entry-product banner are shown only to non-admins, and each only while its step is incomplete.
- The Active and Completed board sections render only for admins or qualified distributors. Unqualified members see just the funnel.

## Exports
- `default Bat246BoardsPage()` - the page component. `DistributorProgressBar`, `PositionSummary`, `PositionLinksPanel`, `BoardCard` and all constants are module-private.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/boards[?mine=true]` (via `useBoards`), `POST /backend/bat246/boards`, `POST /backend/bat246/boards/:id/activate`, `POST /backend/bat246/boards/:id/hidden`, `POST /backend/bat246/boards/:id/place-user`
  - `GET /backend/bat246/my-dashboard-access`, `GET /backend/bat246/membership/status`, `POST /backend/bat246/membership/activate-free`, `GET /backend/bat246/distributor/progress`, `POST /backend/bat246/office/join`
  - `GET /backend/bat246/layaway/my-wallet`, `POST /backend/bat246/layaway/pay-entry`
  - `POST /backend/checkout/product/:productId/process-checkout`
  - `POST /backend/api/invoices/:id/apply-platform-coupon`, `POST /backend/api/invoices/:id/verify-payment`
  - `GET /backend/wallet/affiliate/balance`, `GET /backend/unilevel-plus/product`, `POST /backend/unilevel-plus/checkout/create-order`
  - Indirectly: the notification endpoints (`/backend/bat246/notifications...`) through `Bat246NotificationBell`, the payment endpoints through `PaymentMethodSelector`, and the Snap Back Loan endpoints through `SnapBackLoanModal`.
- **External services:** Razorpay Checkout JS (`checkout.razorpay.com`), loaded on demand.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:**
  - `localStorage`: reads `garage_tok`; writes `garage_tok` and `garage_org_id` after an org auto-join.
  - `sessionStorage`: `bat246_org_autojoin_attempted` (one-shot guard), and the board-list cache keys `bat246_boards` / `bat246_boards_mine` (through `useBoards`).
  - Clipboard: board, preview and join links.
- **Background work:** board polling every 15s (`useBoards`); progress re-fetch on `window` `focus`.

## Dependencies
- **Internal:**
  - `components/bat246/hooks/useBoards.ts` - board lists with polling and cache.
  - `components/bat246/types.ts` - `BoardSummary`.
  - `lib/hooks/useAmIFounder.ts` - user email, name and org name.
  - `lib/hooks/useBat246CardAccess.ts` - `boards` card admin check.
  - `components/checkout/PaymentMethodSelector.tsx` - payment method UI that creates the payment on an invoice.
  - `components/ui/platform-coupon-input.tsx` - platform coupon entry.
  - `components/bat246/Bat246NotificationBell.tsx` - notifications and the "Place now" action (`PlacementNotification` type).
  - `components/bat246/modals/SnapBackLoanModal.tsx` - Snap Back Loan request.
- **Packages:** `react`, `next` (`Link`, `useRouter`), `sonner` (toasts), `lucide-react` (icons).

## Used by
Not imported by any module. It is reached as the Next.js route `/games/bat246/boards`, linked from the yellow "Boards" pill on the board page (`/games/bat246/[boardId]`), from the BAT246 dashboards, and from back links on other BAT246 pages.

## Notes
- **Hardcoded identifiers:** the POD and board-entry product ids (L66, L1317), an affiliate `referralId` code sent with every entry checkout (L761, L813), a fallback BAT246 org id (L1090), and the Family-6 tracking numbers. The hidden-boards confirmation copy also names the admin's email. None of these are secrets, but they will break silently if the database records change.
- `isAlanK` actually means "has the `boards` card grant", not just the one admin user.
- `[boardId]/page.tsx` duplicates the `BAT246_ORGS` list; keep the two in sync. The comment explains why both spellings are accepted (the org was renamed outside this codebase).
- Dead or temporarily disabled code: the Garage Affiliate banner (`false &&`), the $20/year membership modal, the commented-out HP payout selector and the commented-out affiliate progress step.
- The Family-6 toggle fires the hide requests with `Promise.all` without checking each response's `ok`, so a partial failure still shows a success toast.
- Units differ between flows. `PaymentMethodSelector` totals are in cents; B2 Coin amounts and `process-checkout`'s `product.totalAmount` are in dollars.
