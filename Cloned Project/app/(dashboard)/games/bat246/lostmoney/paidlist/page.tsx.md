# `app/(dashboard)/games/bat246/lostmoney/paidlist/page.tsx`

> Client admin page for the YourMoneyBack Paid List: two queues ("No Wait Lineup" and "90 Days Waiting Period") of people approved for repayment, with stats, a global pause switch for automatic payments, add/edit/reorder/move/delete controls and an "Invite to BAT 246" action.

**Kind:** Next.js page · **Lines:** 944 · **Route:** `/games/bat246/lostmoney/paidlist`

## Purpose
People whose loss claims are approved are repaid automatically from BAT 246 sales: the backend's `bat246LostMoneyAutoPay.service.ts` takes a 3% drip of each real sale and pays people in Paid List order. This page is where an admin controls that queue: who is on it, how much they are approved for, in which order they are paid, whether they still sit in the 90-day waiting period, and whether payouts are running at all. It is restricted to the BAT 246 owner account and anyone granted the "lostmoney" card. Claims are approved on the sibling page `/games/bat246/lostmoney/admin`, which also adds rows here.

## How it works

### Access (L58, L439-L446)
`useBat246CardAccess("lostmoney")`; renders nothing while loading and "Admin only." for others. Every endpoint used is guarded server side by `requireAuth` + `requireAlanK` (`isBat246CardAdmin(..., "lostmoney")`).

### Two grids (L76-L81, L140-L171, L497-L517)
- `lineupView` is `"active"` (No Wait Lineup, people the auto-pay drip can pay) or `"waiting"` (newly approved people parked for 90 days). The backend classifies rows by `movedToLineupAt`: field absent (legacy) or a timestamp = active; explicitly `null` = waiting.
- `refreshPaidAdmin(page, view)` calls `GET /backend/bat246/lostmoney/paid/admin?page=&limit=10&lineup=<view>` and stores `paid`, `totalPages` and `stats`. It reruns whenever `isAdmin`, `paidPage` or `lineupView` change; switching grids resets to page 1.
- For waiting rows the server adds `eligibleOn` / `eligibleNow`, a 90-day countdown from `createdAt` that subtracts any time payments were paused. For all rows it adds `alreadyBat246Member` when the linked user already belongs to the BAT 246 organisation.

### Stats (L519-L530)
"Total Paid Members" (rows with `totalPaid > 0`) and "Total Money Repaid" (sum of `totalPaid`), computed by the backend across the whole collection, independent of grid or page.

### Pause switch (L93-L138, L464-L494)
`refreshPaymentsStatus()` reads `GET /backend/bat246/lostmoney/payments/status`; `togglePayments()` asks for confirmation and posts `POST /backend/bat246/lostmoney/payments/toggle` with `{ enabled }`. The pill shows "Payments: Running" or "Paused by <email>". The backend records pause intervals so the 90-day clocks freeze while paused; the waiting grid shows "(paused — clock frozen)".

### Add to Paid List (L173-L266, L532-L657)
- A search box debounced by 300 ms calls `GET /backend/bat246/lostmoney/people/search?q=` (verified Garage users matched by name, email or phone, max 10). Picking a result links the row to that `userId` and email.
- If nothing matches, "add as new person" switches to manual mode with name and optional email fields.
- The admin enters an optional **Reported Loss** (kept only on first creation) and **Approve to Repay ($)**, then `submitManualAdd()` posts `POST /backend/bat246/lostmoney/paid/add` with `{ name, userId?, email, reportedLoss, amount, lineup: lineupView }`. The new row lands in the grid currently open. If the person already exists (matched by `userId`, else case-insensitive name), the server adds `amount` to their `approvedAmount` instead of creating a duplicate. For new rows the page jumps to the last page of that grid using the returned `total`.

### Table (L660-L939)
Columns: Sr.No (global position), Name (+ email, inline pencil edit), Date and Time created, Reported Loss, Approved Claim (inline pencil edit), then either Eligible On (waiting) or Last Payment and Total Paid (active), an Invite column, and actions.
- **Edit name** -> `POST /paid/:id/edit-name` `{ name }` (Enter saves, Escape cancels).
- **Edit approved amount** -> `POST /paid/:id/edit-amount` `{ amount }`; the server refuses an amount lower than what has already been paid.
- **Reorder** arrows -> `movePaidOrder()` swaps two adjacent rows optimistically and posts `POST /paid/swap-order` `{ idA, idB }` (pairwise swap of `order`), reverting on error. Swaps work only within the current page; the first row of page 1 and last row of the last page have their arrows disabled.
- **Move** (waiting grid) -> confirm, then `POST /paid/:id/move-to-lineup`; the person joins the back of the payment queue.
- **Move back** (active grid) -> confirm, then `POST /paid/:id/move-to-waiting`; future auto-pay rounds stop for them, nothing paid is undone.
- **Delete** -> confirm, then `POST /paid/:id/delete`.
- **Invite** -> `inviteToBat246()`: uses the row's email or prompts for one, validates it with a simple regex, then posts `POST /backend/invites/create?orgId=<BAT246_ORG_ID>` with `{ members: [{ email, name, role: "stakeholder" }] }` (the standard organisation invite flow). Rows already in the office show an "Already part of BAT 246" badge instead.

All mutating paths for these endpoints are under `/backend/bat246/lostmoney` and send the `garage_tok` bearer token via `authHeaders()`.

## Exports
- `default LostMoneyPaidListPage()` - the page component.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/lostmoney/paid/admin?page=&limit=&lineup=active|waiting` - one page of a grid plus stats.
  - `GET /backend/bat246/lostmoney/payments/status`, `POST /backend/bat246/lostmoney/payments/toggle` - global auto-pay switch.
  - `GET /backend/bat246/lostmoney/people/search?q=` - link a row to a Garage account.
  - `POST /backend/bat246/lostmoney/paid/add` - create a row or top up an approved amount.
  - `POST /backend/bat246/lostmoney/paid/:id/edit-name`, `/edit-amount`, `/move-to-lineup`, `/move-to-waiting`, `/delete`; `POST /backend/bat246/lostmoney/paid/swap-order`.
  - `POST /backend/invites/create?orgId=...` - invite the person into the BAT 246 organisation.
- **Database (via those endpoints):** `Bat246LostMoneyPaid` (collection `bat246lostmoneypaids`), `Bat246LostMoneyPaymentSettings` (`bat246lostmoneypaymentsettings`), `User` (search and membership check).
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]`.

## Dependencies
- **Internal:** `lib/hooks/useBat246CardAccess.ts` - "lostmoney" card admin check.
- **Packages:** `react`, `next/link`, `lucide-react` (icons), `sonner` (toasts).

## Used by
Not imported by any file; reached as the Next.js route `/games/bat246/lostmoney/paidlist`, linked from `/games/bat246/lostmoney`.

## Notes
- **Real money:** the pause switch and the active-lineup order directly control who the automatic drip pays next. "Stop All Payments" halts the drip for every sale until restarted.
- The BAT 246 organisation id is hardcoded at L12 (the same constant appears in the backend routes); moving BAT 246 to another org requires changing both.
- Reordering cannot cross a page boundary; to move someone several pages, an admin must repeat swaps page by page.
- The invite email check is a loose regex; validation of the actual invite happens in the backend invite route.
- Approving here does not pay anyone; `totalPaid` and `lastPaymentAt` change only through the backend auto-pay service.
