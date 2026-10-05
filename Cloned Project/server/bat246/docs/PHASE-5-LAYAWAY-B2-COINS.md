# BAT246 Phase 5 — Layaway → B2 Coins

## What this phase is

The board "Layaway" button used to open a purely decorative modal reading
`isLayaway`/`isLayawayPlan`/`layawayBalance` fields that nothing in the
codebase ever wrote (confirmed stub — `bat246Split.service.ts` explicitly
lists layaway as unimplemented). Phase 5 builds the real feature behind
that button: people who currently hold certain board positions/status can
hand out **B2 Coins** — a new currency — to any Garage + BAT246-office
member, who can later use them toward a $650 Board Entry or $160 POD
Entry. People who don't currently qualify can ask someone who does.

That old `isLayaway` field-set means something different (an older,
never-shipped "advance-purchase-paid-off-from-future-earnings" idea) and
was deliberately left untouched — its UI still renders below the new
Phase 5 panel in the same modal, unchanged.

## What's implemented

### Eligibility — 5 pools, caps stack

A person's live giving allowance = the **sum** of every pool they
currently qualify for right now (not the highest single one). Evaluated
fresh on every check, never cached.

| Pool | Cap | Signal |
|---|---|---|
| Home Plate (seated on any board, right now) | $1,600 | `Bat246Board.find({"homePlate.playerId": pid})` |
| Last POD sale **and** currently on Home Plate | $280 | `board.podEarnerPlayerId === pid` AND Home Plate pool also true |
| Leaderboard trophy | Triple $100 / Home Run $200 / Grand Slam $300 | `Bat246Player.trophies.{T,H,G}`, highest held |
| Matching Bonus: a direct personal recruit is now the Home Plate occupant, and this person holds a Gray Card | $400 | new logic, built from scratch — no prior link existed |
| **#1 in the Lostmoney "No Wait" lineup** | $300 | same `order:1` query the real auto-pay drip already uses |

Alan K bypasses all of it — uncapped, same universal admin override used
elsewhere in this subsystem.

"Already given" is tracked **per pool, permanently** — losing a
qualifying condition later (e.g. leaving Home Plate) never refunds what
was already given from that pool. There's no separate running-total
field anywhere: every "already given" number is computed by aggregating
the immutable transaction log at check time, so it can never silently
drift out of sync with itself (a class of bug this project hit twice
already on unrelated fields this same engagement).

### The Lineup-#1 pool is not free money

Giving coins from this pool is the person diverting their own real
Lostmoney auto-pay round into coins instead of cash:

1. It increments the real `Bat246LostMoneyPaid.roundAccumulated` field —
   the same field the existing cash auto-pay drip already sizes each
   $300 round from.
2. The existing cash drip (`bat246LostMoneyAutoPay.service.ts`) needed
   **zero code changes** — it already pays less real cash once that
   field is partly filled.
3. Once the round target is fully reached (cash + coins combined), it
   finalizes exactly like a real completed round: marked paid, `order`
   moved to the **back of the lineup**, a `Bat246LostMoneyPayment` row
   logged (`source: "layaway"`, no real money moved for that portion).

### Data model (new)

- `bat246B2CoinWallet.model.ts` — one running balance per recipient.
- `bat246B2CoinTransaction.model.ts` — immutable log, one row per gift,
  with a `breakdown` of which pool(s) it drew from (gifts can span
  multiple pools — allocated largest-cap-first). This is the single
  source of truth for every "already given" figure.
- `bat246LayawayRequest.model.ts` — the "ask an eligible person" record
  (requester / eligible person / recipient / amount / status).
- Additive-only changes to existing models: `layawayRequestId` + `summary`
  on `bat246PlacementNotifications.model.ts`; a new `"layaway"` value on
  `bat246LostMoneyPayment.model.ts`'s `source` enum.

### Backend

- `src/bat246/services/bat246Layaway.service.ts` — eligibility
  computation, `giveB2Coins` (pool allocation, server-derived product
  pricing — never trusts a client-sent amount alongside a productId,
  recipient-must-be-office-member check), the Lostmoney hook above,
  request creation (+ email) and approve/deny.
- `src/bat246/routes/bat246Layaway.routes.ts`, mounted at
  `/bat246/layaway`: `GET /my-eligibility`, `GET /recipients/search`,
  `GET /eligible-people`, `POST /give`, `POST /request`, `POST
  /requests/:id/respond`.
- New `bat246LayawayRequestEmailTemplate` in `services/mailer.ts` — the
  request flow emails the eligible person, not just an in-app
  notification (reuses the existing `sendMail`/`EMAIL_FROM_NOTIFICATION`
  pattern already used for office/POD invites).

### Frontend

- `components/bat246/modals/LayawayUserSearch.tsx` — new debounced
  single-select search picker.
- `components/bat246/modals/LayawayModal.tsx` — rebuilt: a "Give" panel
  when currently eligible, a "Request" panel when not. The old
  `isLayaway`/`isLayawayPlan`/`layawayBalance` list that used to sit below
  it has been removed from this modal entirely (2026-09-12, see below) —
  it's moving to its own Alan-only dashboard instead. Renders via
  `createPortal(..., document.body)` at `z-[20000]` (bug fix, 2026-09-11/12
  — see below) instead of an inline `fixed` div.
- `components/bat246/Bat246NotificationBell.tsx` — 5th notification
  type (`"layaway_request"`) with self-contained Approve/Deny buttons.

### Bug fix (2026-09-11 / 2026-09-12): modal briefly rendered behind the board

Reported: opening Layaway showed the popup appearing *behind* the board's
header/leaderboard/base cards for a couple seconds before popping to the
front.

First attempt (2026-09-11, incomplete): assumed the problem was
`LayawayModal` rendering as a plain `fixed inset-0 z-50` div deep inside
`BoardLayout`'s own transformed/high-z-index tree, so it was switched to
`createPortal(..., document.body)` at `z-[9999]` (matching
`MiniCard.tsx`/`TrophyPill.tsx`'s existing portal pattern). Build was
clean but the user reported the bug still reproduced after a full
restart — proving the root cause was something else.

Actual root cause (found 2026-09-12): `BoardLayout.tsx`'s main content
wrapper carries `relative z-10 has-[.bat246-toolbar-btn:hover]:z-[10000]`
— i.e. while the cursor is hovering *any* toolbar button (including the
Layaway button itself, which the click leaves it resting on), the CSS
`:has()` rule boosts that entire wrapper — header, leaderboard, every
base card — to `z-index: 10000`. That's higher than the modal's
`z-[9999]`, so the whole board out-paints the modal for exactly as long
as the mouse stays over the toolbar icon; the instant it drifts away the
boost drops back to `10` and the modal pops to the front — the "few
seconds" was really "however long the cursor lingered on the button,"
not a fixed delay. The portal was harmless but not the fix. Corrected by
raising the modal to `z-[20000]`, safely above every `z-[10000]` hover
boost in `BoardLayout.tsx` (toolbar-btn hover, leaderboard-trophy hover)
with margin for any future one. `npm run build` clean on the frontend
after the change.

### Change (2026-09-12): old layaway-plan list removed from this modal

The untouched old `isLayaway`/`isLayawayPlan`/`layawayBalance` list (see
"That old `isLayaway` field-set" above) used to render below the Phase 5
panel for anyone opening the modal. In `LayawayModal.tsx`:

1. Dropped the "Red $ = full layaway (pay at board completion). Green $ =
   layaway plan (deducted per sale)." legend line from the explainer text
   above the list.
2. First cut it down to Alan-K-only (gated on `eligibility?.isAlanK`),
   then removed the block entirely — it's no longer shown to anyone in
   this modal, Alan K included. The `layawaySlots` computation and the
   unused `board` destructure were deleted along with it. Plan is to move
   this list to a separate, Alan-only dashboard instead of showing it
   inline in a popup every office member can open (see TODO below).

No backend change — this was always a display-only gate/removal on data
the client already had (`board.homePlate` etc. via the `BoardData` prop),
not a permission check on any endpoint.

### One deliberate deviation from the original design

`giveB2Coins` does **not** wrap its read-then-write in a Mongo
session/transaction. It follows the exact same check-then-write pattern
every other real-money function in this subsystem already uses
(`bat246Wallet.util.ts`, `bat246LostMoneyAutoPay.service.ts`) —
introducing transactions would be new, untested infrastructure here
(they need a replica-set deployment) for a rare, manually-triggered
action, where every neighboring money-moving path already accepts the
same small race window. If concurrent-give abuse ever becomes a real
problem, this is the first place to harden.

### Change (2026-09-12): B2 Coin Wallet card — permissions, defaults, 3-card member landing

New `Bat246CardKey`: `"b2coinwallet"` (labeled **B2 Coin Wallet** everywhere —
the earlier plain "Coin Wallet" label was renamed on every card that showed
it). Two things drove this:

1. **The Permissions matrix (`/games/bat246/permission`) had no B2 Coin
   Wallet column at all** — added as a 7th column, same as any other card.
2. **Every Bat246-office member should have Documentation + B2 Coin Wallet
   access automatically**, not just Alan or someone Alan explicitly grants —
   a new concept alongside the existing "legacy via board position" one:

- `bat246Permission.service.ts` exports `DEFAULT_ORG_CARD_KEYS =
  ["documentation", "b2coinwallet"]` — the single source of truth. Both
  `getGrantedCardKeys()` (powers `/bat246/permissions/mine`, which the
  frontend's `useMyBat246Grants` hook reads) and `isBat246CardAdmin()` now
  auto-include these two for anyone who's simply a Bat246-office member
  (`organizations` array contains the Bat246 org ID) — no explicit
  `Bat246CardPermission` row needed.
- `people-matrix` (the Permissions grid's data) marks `documentation` /
  `b2coinwallet` as `legacy: true` (locked-on, same lock icon/treatment as
  board-position cards) for every row that's a real org member — computed
  from the same `orgMembers` query the grid already runs, not a new one.
  A non-org-member row (rare — someone with a legacy board slot or an
  explicit grant who somehow isn't in the org list) still shows these as
  normal, admin-toggleable checkboxes.
- **`app/(dashboard)/games/bat246/page.tsx`** (the admin icon-grid landing
  page) is now also the landing page for plain office members, not just
  Alan/admins: "Game Boards" was marked `alwaysVisible` (same href
  `/games/bat246/boards` every member already uses to play, independent of
  admin board-management grants), and the routing effect now distinguishes
  "real" admin grants from the two org-wide defaults
  (`hasRealAdminGrant = grantedKeys.some(k => !DEFAULT_MEMBER_CARD_KEYS.includes(k))`)
  so board-position holders still get redirected to the richer
  `/games/bat246/dashboard` (6 cards) exactly as before — only a plain
  member with **no** board position and **no** real grant now stays on this
  page instead of being bounced to `/games/bat246/boards`, and sees exactly
  3 tiles: Game Boards, Documentation, B2 Coin Wallet.
- Renamed the "Coin Wallet" label to "B2 Coin Wallet" on this page, on the
  older `/games/bat246/dashboard` hub's own tile, and on the
  `B2CoinWallet/page.tsx` stub's own heading.
- `B2CoinWallet/page.tsx` itself got no new access check — matching the
  existing, deliberate pattern already used for `documentation/page.tsx`
  (no page-level guard, access is only enforced by which tile you're shown
  on the landing grids, not by the destination route itself).

### Change (2026-09-12): plain-member view of `page.tsx` — no "Admin", no stats

Once plain office members started landing on this page (previous change),
it still read "BAT 246 **Admin** Dashboard" and showed Office
Members/Distributors counts to everyone, including people with no admin
access at all. Now gated on the same `isAdmin = isAlanK ||
hasRealAdminGrant` flag the routing logic already computed: a plain member
sees a plain "BAT 246 Dashboard" heading and no stats row; the two
`/office/bat246/members` + `/bat246/distributors` count fetches are also
skipped entirely for them (never shown, and those endpoints are
admin-facing anyway). Alan and anyone with a real Permissions grant see
the same "Admin Dashboard" + stats as before — unchanged for them.

### Change (2026-09-12): boards/page.tsx had no way back for a plain member

Its "back to admin / dashboard" link was gated on `isAlanK ||
hasDashboardAccess` (the old board-position check) only — a plain office
member (neither) got no back link at all once they could reach
`/games/bat246/boards` via their new "Game Boards" tile, a dead end.
Removed the gate: the link always shows now. Alan → `/games/bat246`
("Admin Board"); board-position holders → `/games/bat246/dashboard`
("Dashboard", unchanged); everyone else → `/games/bat246` ("Dashboard"),
landing on their 3-card default grid from the change above.

### Change (2026-09-12): back-button styling made consistent everywhere

The `boards/page.tsx` back link was upgraded from small faded text
(`text-white/35 text-xs`, no visible boundary — easy to miss) to a proper
pill button: `px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15
text-white/80` with a bigger chevron. Applied the same treatment to every
other back-link across `app/(dashboard)/games/bat246/` for consistency
(admin-only and member-reachable pages alike): `Inviteandplace`, `members`,
`distributors` (+ its `[userId]` not-found state), `B2CoinWallet`,
`documentation`, `permission`, `lostmoney` (+ its `admin` and `paidlist`
sub-pages). Only the className changed on each — every existing
href/label ternary (`isAdmin`/`hasDashboardAccess` routing logic) was left
exactly as it was. Deliberately skipped:
`documentation/board-button-details/page.tsx`'s back link, which lives
inside a dark PDF-viewer-style toolbar chrome, not a dashboard page
header — the pill style would look out of place there.

Known pre-existing (not introduced by this change) follow-up: the
`B2CoinWallet`/`documentation` pages' back link always reads "Admin
Board" even for a plain member now legitimately reaching them via the
default-grant change above, where "Dashboard" would read more correctly.
Left alone for this pass — fixing it needs the same `hasRealAdminGrant`
(real-grant-vs-default-grant) concept `page.tsx` already computes, ported
into these two files. **Fixed in the next change below**, for
`B2CoinWallet/page.tsx` at least (`documentation/page.tsx` still has the
static "Admin Board" label — it has no reason to fetch grants otherwise).

### Change (2026-09-12): B2CoinWallet/page.tsx actually built out, plus a real bug found and fixed along the way

The page was a title-only stub. Built out for real:

- **New backend read path, separate from giving-eligibility on purpose.**
  `getMyB2CoinWallet(userId)` (`bat246Layaway.service.ts`) returns the
  caller's real `Bat246B2CoinWallet.balance` plus their last 500 received
  `Bat246B2CoinTransaction` rows (joined to the giver's name/email, with a
  static `PRODUCT_LABELS` map for the two known giftable products rather
  than trusting `Product.name`/`.description` — this codebase has hit
  real name/description drift on exactly these two products before).
  Mounted as `GET /bat246/layaway/my-wallet`. Deliberately its own
  function/endpoint, not folded into `computeLayawayEligibility()` —
  "how much you can give away" (giving power, `isAlanK` → Unlimited) and
  "how much you've actually received" (a plain number, even for Alan) are
  two unrelated questions with two different answers for the same person.
- **Frontend page** now fetches both `/my-wallet` and the existing
  `/my-eligibility` in parallel and renders three sections: **Your
  Balance** (real received total, "No B2 Coins received yet" empty
  state), **Your Giving Power** (Alan → "Unlimited" with a Sparkles
  badge; a qualifying member → `$X remaining` + the same per-pool chips
  LayawayModal shows; a non-qualifying member → plain-language explainer
  of the 4 non-Alan pools instead of a blank/zero), and **Recent Transaction** (a
  history list — giver, amount, product if it was a product-targeted
  gift, a "via your request" badge when `viaRequest` is true, relative
  timestamp; section renamed from "Received" 2026-09-12 per feedback). Each section has its own independent loading spinner and
  "Failed to load — Try again" error state, so one endpoint failing never
  blanks the whole page. Also fixed the back-link label here specifically
  (see above) — now correctly Alan/real-grant → "Admin Board", everyone
  else → "Dashboard".
- **Real bug found and fixed in the same pass, unrelated to the wallet
  page itself:** typechecking the new backend code surfaced that
  `bat246LayawayRequestEmailTemplate` — imported by name in
  `createLayawayRequest()` and referenced in this very doc's "Backend"
  section as already added — **did not actually exist in
  `services/mailer.ts`**. Because that import sits inside a try/catch
  (by design, so a mail failure never blocks a request), this failed
  silently on every single Layaway "Request" ever created — the eligible
  person got the in-app bell notification but **never the email**, with
  no visible error anywhere. Added the missing template function now
  (same styling conventions as `bat246OfficeInviteEmailTemplate` next to
  it). Backend typecheck is 0 errors after this fix; still not walked
  through with a real send.
- **A second, much bigger real bug found while testing the wallet page
  live: `bat246Layaway.routes.ts` was never mounted in `app.ts` at all.**
  The router file, the service, the models — all real and correct — but
  `import bat246LayawayRoutes ...` / `app.use("/bat246/layaway",
  bat246LayawayRoutes)` were simply never added, despite this doc's own
  "Backend" section claiming they were. Every single endpoint under
  `/bat246/layaway/*` — `my-eligibility`, `my-wallet`, `give`, `request`,
  `respond`, the search endpoints — has been **404ing since the feature
  was first built**, which is exactly why "no live/functional test
  performed yet" stayed true this whole time: the modal and this wallet
  page could never have worked against a real backend until now. Fixed
  by adding the missing import + `app.use` in `app.ts`, matching the
  existing `bat246LostMoney`/`bat246Permission` mounts right above it.
  Confirmed live with `curl` — both endpoints now return `401 Missing
  auth` (correctly reachable, just unauthenticated) instead of `404
  Cannot GET`.
- **Separately discovered while chasing the 404s: the running backend
  dev process wasn't even `npm run dev`.** It was a plain one-shot `tsx
  src/index.ts` (no `watch`), so it had been serving stale code
  regardless of any file changes, backend-wide — not specific to this
  feature. Killed it and started a proper `npm run dev` (`tsx watch`)
  instead so future edits actually take effect without a manual restart.
  Worth knowing: on this Windows checkout, `tsx watch` did **not**
  reliably pick up the `app.ts` edit above on its own (no restart log
  line appeared, endpoint stayed 404) — a manual kill + restart was
  needed to make the mount take effect. If routes still don't show up
  after a save, don't assume the code is wrong — check whether the dev
  process actually restarted first.

### Change (2026-09-12): "see all transactions"

`getMyB2CoinWallet`'s fetch limit raised 50 → 500 (still a hard ceiling,
not true DB pagination — a personal transaction count in the hundreds is
already implausible for this feature). The wallet page now paginates that
full list client-side, `TX_PAGE_SIZE = 10` per page, with the same
Previous/Next control already used by `boards/page.tsx` and
`members/page.tsx` — no new route or page needed. Also gave the "Recent
Transaction" section its own independent "Failed to load — Try again"
error state (previously it just silently showed nothing if `/my-wallet`
failed, relying on the balance card's error message above it).

### Change (2026-09-12): Alan's balance card also says "Unlimited"

Alan's real received balance is (almost always) a genuine `0` — nobody
needs to give the admin coins, since he already bypasses every pool cap
and can give unlimited B2 Coins regardless of any wallet balance. Showing
that literal `0` right above a "Giving Power: Unlimited" card read as a
contradiction/bug. Fixed by branching the Balance card (and the Recent
Transaction empty state) on `eligibility?.isAlanK`: Alan now sees
"Unlimited" with the same Sparkles treatment as the Giving Power card,
and an explanatory line instead of "No B2 Coins received yet." His real
`wallet.balance`/`transactions` are still fetched normally underneath —
only the *display* is overridden for him, so a genuine edge-case gift to
Alan (if that ever happened) still lands in his real balance/history,
it's just not what's shown front-and-center given it's irrelevant to what
he can actually do.

### Change (2026-09-12): bigger explanatory text for readability

Bumped the page subtitle (`text-base` → `text-lg sm:text-xl`) and every
secondary explainer paragraph on the page from `text-sm` to `text-base
sm:text-lg` — the admin "unlimited" note, the non-admin zero-balance
note, the "not currently eligible" explainer, and the "No coins received
yet" empty states (both variants). Per explicit feedback: readable for
older users with low eyesight. Left error messages, per-pool chips, and
transaction-row metadata (timestamps, page-of-page counters) at their
existing small sizes — not called out, and bumping every micro-label too
would clutter the layout.

### Change (2026-09-12): give/request success as a toast, not inline text

`LayawayModal.tsx`'s "Gave B2 Coins to X." / "Request sent to X." messages
were a plain inline `<p className="text-green-400 ...">` that stayed
until the panel reset. Replaced both with `toast.success(...)` (`sonner`
— already globally mounted via `<Toaster />` in `app/layout.tsx`, used
elsewhere in this same subsystem e.g. `permission/page.tsx`), each
`position: "top-right"`, `duration: 4000` (auto-dismiss after 4s), and a
`cancel: { label: "Cancel" }` button to close it early. Removed the now-
unused `success` state entirely. The inline red error message (`error`
state) is untouched — only the success case moved to a toast.

### Change (2026-09-12): toast upgraded from plain to fully custom

Feedback: the plain `toast.success(...)` bar (default sonner black
pill + a bare "Cancel" text) looked too basic. Rather than pull in a
second toast library alongside the one already standard across this app,
switched to `sonner`'s own `toast.custom(...)` API — same dependency,
just its fully-custom-content mode. New `LayawaySuccessToast` component
renders a dark `#12121e`/yellow-bordered card matching the Layaway
modal's own styling: a circular yellow `CheckCircle` icon badge, bold
message text, a ghost "Cancel" button (`toast.dismiss(toastId)`), and a
thin yellow progress bar along the bottom that visually shrinks over the
same 4000ms (`TOAST_DURATION_MS`) the toast auto-dismisses on. Both
give/request success calls now go through one `showLayawaySuccessToast()`
helper instead of duplicating the `toast.custom(...)` call.

### Change (2026-09-12): toast copy shows the real amount, X instead of Cancel

Two more tweaks per feedback:

1. **Amount in the message, server-derived.** "Gave B2 Coins to X." →
   `Sent $${data.amount} B2 Coins to X` (give), and "Request sent to X."
   → `Requested $${data.request.amount} B2 Coins from X` (request —
   reworded from "sent to" since nothing has actually moved yet at that
   point, only asked for). Both read the amount back off the server's own
   response (`GiveResult.amount` / the created request doc's `amount`),
   never the client's own `amount` state input — for a product-targeted
   give/request the client doesn't necessarily know the real price, only
   the server does.
2. **Dismiss button is now an `X` icon**, not a "Cancel" text button —
   same `toast.dismiss(toastId)` behavior, just a small icon-only ghost
   button (reuses the `X` icon already imported in this file).

### Change (2026-09-14): "Transact" button on the B2 Coin Wallet page

The wallet page (`B2CoinWallet/page.tsx`) previously only ever *displayed*
balance/giving-power/history — there was no way to actually give or
request coins from there, only from a board's Layaway toolbar button
(`BoardLayout.tsx` → `LayawayModal`).

Added a **Transact** button at the right end of the "B2 Coin Wallet"
title row (yellow, matches the page's accent color) that opens the exact
same `LayawayModal` the board button already uses — deliberately reused
rather than reimplemented, for two reasons: (1) every edge case asked for
here — recipient must search-select a real Garage + BAT246-office member
(`verifyRecipientIsOfficeMember`, server-side), can't send to yourself,
"not eligible → forced into the Request panel instead of Give", Alan K
never sees a Request panel (his eligibility always resolves
`eligible: true`, so the modal's own `eligibility?.eligible ? <Give> :
<Request>` branch already keeps him on Give) — was already built,
already server-enforced, and already exercised in production via the
board button; and (2) it keeps exactly one give/request code path instead
of two that could drift apart.

`LayawayModal`'s `board` prop was typed as required but was never
actually read inside the component (checked — only the type declared it,
the function body never destructured or referenced it). Made it optional
(`board?: BoardData`) so the wallet page can render the modal with no
board context at all; `BoardLayout.tsx`'s existing `<LayawayModal
board={board} onClose={close} />` call is untouched and still passes it.

**On "if they don't have balance they can't send":** confirmed there is
no wallet-balance debit path anywhere in `bat246Layaway.service.ts` — the
only place `wallet.balance` is ever touched is `creditB2CoinWallet`'s
`balance += amount` (on receiving). A give always draws from the giver's
*eligibility pools* (Home Plate, Leaderboard, Matching Bonus, Lineup-#1 —
board position/status, not received coins), never from their own
received wallet balance — this is the deliberate "giving power vs.
received balance are separate" design from Step 1 of the original plan.
So "not enough balance to send" and "not eligible to give" are the same
underlying check (`eligibility.eligible` / `totalRemaining`), which the
reused modal already enforces server-side on `/bat246/layaway/give`
(re-validates live, never trusts client state) — no new balance-check
code was needed or added.

Typecheck clean on both touched files (`B2CoinWallet/page.tsx`,
`LayawayModal.tsx`).

### Bug fix + redesign (2026-09-14): wallet balance is now sendable, not just giving power

**Real bug, confirmed against a live account** (`tetumetinnu-7049@yopmail.com`):
Alan had given this person 4 B2 Coins — correctly showing as a 4-coin
balance and 4 transaction rows on the wallet page — but clicking Transact
still showed "$0 remaining… not currently eligible", with no way to pass
those 4 real coins along. Root cause: `giveB2Coins` (and the modal built
around it) only ever checked `computeLayawayEligibility`'s pool-based
giving power. Wallet balance (coins already *received*) and giving power
(what board position/status lets you *hand out*) were treated as
completely disconnected — correct for the "Giving Power" card's own
meaning, wrong for "can this person send anything at all".

**Fix, backend (`bat246Layaway.service.ts`):**
- Added `"walletBalance"` to the `PoolKey` union — not a real eligibility
  pool, just a way to record a wallet-sourced portion of a send in a
  transaction's `breakdown` alongside real pool sources, same shape.
- Added `getWalletBalance()` (read) and `debitB2CoinWallet()` (clamped at
  0, mirrors the existing `creditB2CoinWallet`).
- `giveB2Coins` now computes `maxSendable = walletBalance +
  eligibility.totalRemaining` (Alan unchanged: uncapped, never touches his
  own balance) and validates against that instead of
  `eligibility.totalRemaining` alone. Allocation order: **wallet balance
  first** (a plain debit, no side effects), then whatever's left draws
  from the pools exactly as before (`allocateAcrossPools`, including the
  Lineup-#1 real-money hook) — so nothing about the pool-allocation or
  Lineup-#1 code paths changed, they're just fed a possibly-smaller
  amount (`amount - fromWallet`).
- `searchEligiblePeople` (the Request panel's "Ask" search) now also
  folds wallet balance into the `eligibility.totalRemaining` figure it
  returns, so someone with only a wallet balance (no qualifying pool)
  correctly shows up as able to fulfill a request. Deliberately does NOT
  touch `/my-eligibility` (the Giving Power card) — that stays pool-only,
  a different, intentionally separate number now.

**Redesign, frontend (`LayawayModal.tsx`)** — same component both the
board's Layaway button and the wallet page's Transact button open, so one
redesign covers both. Renamed header "Layaway" → "Send B2 Coins". Now
fetches `/my-wallet` alongside `/my-eligibility` on open. One summary
card up top replaces the old "eligible vs not" framing: Alan sees
"Unlimited"; everyone else sees one number — `$X available to send` —
with two small chips underneath breaking it into "$Y from your balance"
and "$Z giving power" (plus the existing per-pool chips). Whether the
Send panel or the Request-someone-else panel renders is now gated on
`maxSendable > 0` (either source), not pool eligibility alone — this is
the actual fix for the reported account. Amount mode also shows a live
"$X available" / "Only $X available" hint client-side; the server check
(`maxSendable` in `giveB2Coins`) remains the authoritative one regardless
of what the client shows.

Typecheck: backend full `tsc --noEmit -p tsconfig.json` clean (0 errors);
frontend targeted grep over `LayawayModal.tsx` / `B2CoinWallet/page.tsx` /
`LayawayUserSearch.tsx` clean.

### Follow-up fix (2026-09-14): Send and Request are independent, not either/or

The redesign above made the mistake of gating the whole modal on one
binary: `maxSendable > 0` → only the Send panel, ever, with the Request
panel unreachable. Feedback back almost immediately: someone with some
coins available (say $4) but who wants to ask for more than that still
needs Request — it's not just for the $0 case.

Replaced the either/or with a `view: "send" | "request"` tab switch —
both are always reachable, independent of your own available total.
Defaults to whichever makes sense once the eligibility+wallet fetch
resolves (Send if you have anything, Request if you don't), but the other
tab is always one click away. The Request tab is not rendered at all for
Alan (no tab bar shows for him) — unlimited supply, nothing to ask for,
same as before. Copy on both panels adjusted to not assume "you have
$0" any more — the Send panel notes when you have nothing yet and
nudges toward Request; the Request panel's intro line now branches on
whether you already have some of your own (`hasAnythingToSend`) instead
of the panel only being reachable in the "nothing at all" case.

### Change (2026-09-14): bigger text throughout the Send/Request modal

Feedback: the whole popup read too small for older users (60+) to read
comfortably. First pass bumped everything one step (text-xl → text-2xl
header, text-sm/xs → text-base/sm body); follow-up feedback ("make the
words bigger, not only popup") pushed it further — the first pass had
mostly grown the modal's own box, not the type inside it. Second pass:
header now `text-3xl`, body/label copy `text-lg`, the summary numbers
`text-3xl`, selected recipient rows `text-xl`, all buttons `text-lg`/
`text-xl`, the amount input `text-2xl`, and the shared
`LayawayUserSearch.tsx` dropdown (input `text-xl`, result rows `text-xl`/
`text-base`) to match. Modal widened again (640px → 700px) and padding
increased throughout so the larger type has room to breathe. No behavior
changed, purely sizing/spacing.

### Change (2026-09-14): request tracking — a "Requests" tab on the wallet page

Until now the only way to act on a layaway request was the notification
bell's Approve/Deny — there was no persistent place to check status
afterward, and no way for the requester to back out of a still-pending
ask. Added a real tracking surface.

**Model:** `bat246LayawayRequest.model.ts` — added `"cancelled"` to the
status enum (distinct from `"denied"`: one is "they said no", the other
is "I changed my mind").

**Service (`bat246Layaway.service.ts`):**
- `cancelLayawayRequest(requestId, requesterUserId)` — only the original
  requester, only while `status === "pending"`.
- `getMyLayawayRequests(userId)` — requests this user SENT (as
  `requestedByUserId`), every status, newest first, with the eligible
  person's and recipient's names/emails resolved.
- `getLayawayRequestsForMe(userId)` — requests WAITING ON (or previously
  answered by) this user as the eligible person (`eligibleUserId`), same
  shape, with the requester's name/email instead.

**Routes:** `POST /requests/:id/cancel`, `GET /my-requests`,
`GET /requests-for-me` — same `requireAuth` + `{ok:true,...}` /
`{error}` convention as every other route in this file.

**Frontend (`B2CoinWallet/page.tsx`):** the "Recent Transaction" card is
now two tabs — "Recent Transaction" (unchanged) and "Requests" (a small
red dot on the tab when anything is pending on you). Requests splits into
two sections:
- **Waiting on you** — Approve/Deny buttons on pending rows; answered
  rows show a status badge instead. Approving reuses the existing
  `giveB2Coins` path via `/requests/:id/respond` (no change there), so
  wallet/eligibility are refreshed afterward same as a direct Send.
- **Sent by you** — a status badge (Pending/Approved/Denied/Couldn't be
  covered/Cancelled) per request, with a Cancel button while pending.

Both lists refresh on mount and after the Transact modal closes (its own
Request tab can create a new "sent by you" row).

Backend: full `tsc --noEmit -p tsconfig.json` clean (0 errors). Frontend:
targeted typecheck on `B2CoinWallet/page.tsx` clean. Also hit the same
`tsx watch` silent-reload issue as before this session (new routes 404'd
until a manual kill+restart) — confirmed live afterward via curl (401,
not 404, on all three new endpoints).

### Change (2026-09-14): approve confirmation popup + editable amount, and sent transactions now show

Two gaps from the "Requests" tab just added:

**1. Approve did nothing to confirm first.** Clicking Approve sent
immediately, for whatever amount was originally asked, no chance to
review or adjust. Added `ApproveRequestModal` (`B2CoinWallet/page.tsx`) —
clicking Approve now opens a popup showing the requester, recipient, and
note, with the amount editable (a plain-amount request only — a
product-targeted request's amount is always the real product price,
shown fixed, not editable, same reasoning `giveB2Coins` already applies
elsewhere). "Confirm & Send" is what actually calls `/respond`; the modal
only closes on success, staying open with the error toast still visible
if the send fails (e.g. allowance no longer covers it).

Backend: `respondToLayawayRequest` now takes an optional `overrideAmount`
— used only when the request has no `productId`. If the approved amount
differs from the original ask, `request.amount` is updated to match what
was actually sent, so the requester's own "Sent by you" status and this
responder's own "Waiting on you" history both show the real number, not
a stale ask (two numbers meant to agree silently drifting apart is a bug
this codebase has already paid for twice — not repeating it here).
`POST /requests/:id/respond` now accepts an optional `amount` in the body
alongside `approve`.

**2. Admin's "Recent Transaction" list was structurally always empty.**
It only ever queried `toUserId === userId` (received). Alan (and anyone
who uses Transact to send) almost never receives, so despite constantly
giving coins out, his own history showed nothing. `getMyB2CoinWallet` now
queries BOTH `toUserId` and `fromUserId`, merges the two, sorts by date,
and re-caps to `limit`. `WalletTransactionView` gained a `direction:
"received" | "sent"` field and renamed `fromName/fromEmail` →
`counterpartyName/counterpartyEmail` (meaning flips with direction — who
gave it, or who it was sent to). Frontend row rendering now branches on
direction: received rows unchanged (yellow "+", gift icon); sent rows get
a "Sent to X" label, a neutral "−" prefix, and a swap icon. Empty-state
copy simplified to "No B2 Coins sent or received yet." (the old
Alan-only copy stopped being accurate now that his sends show up).

This wasn't scoped to admin specifically in the end — the merge applies
to everyone, since anyone who's used Transact to send would want to see
it in their own history too, and the backend has no clean way to
distinguish "real admin" (a BAT246 card-permission concept) from
`isAlanK` anyway.

Backend: full `tsc --noEmit -p tsconfig.json` clean. Frontend: targeted
typecheck on `B2CoinWallet/page.tsx` clean. Hit the same `tsx watch`
silent-reload issue as the last two changes — killed and restarted,
confirmed live via curl (401, not 404).

## What's left / explicitly not built yet

- **Spending B2 Coins at checkout** — the wallet balance is credited, but
  there is no redemption flow yet for using coins toward the $650 Board
  Entry or $160 POD Entry. This was explicitly out of scope for Phase 5.
- **Read paths confirmed live, write paths still not.** After the
  app.ts-mount fix (2026-09-12), `/my-eligibility` and `/my-wallet` have
  actually been exercised against the running dev server and a real
  browser session (Alan's "Unlimited" balance/giving-power view, the
  10-per-page transaction pagination) — that part of "no live test
  performed" is no longer true. Still never walked through live: a real
  `give`, a real `request` → email → approve/deny cycle, or a real
  Lineup-#1 round-completion.
- **No admin/reporting view** — nowhere to see all B2 Coin balances or
  the full transaction ledger across every user; the only read paths
  today are a single person's own `/my-eligibility` and `/my-wallet`.
- **No reversal/refund path** — a mistaken give has no undo; would need a
  new admin-only endpoint if that's ever needed.
- **Pending requests never expire** — `Bat246LayawayRequest` has no TTL
  or "cancel my own request" action; a request just sits `"pending"`
  forever until the eligible person responds.
- **No automated tests** — verification so far is typecheck + manual code
  review only, per the points above.
- **TODO: separate Alan-only dashboard for the layaway-plan list.** The
  old `isLayaway`/`isLayawayPlan`/`layawayBalance` list (players currently
  on the pre-Phase-5 layaway plan, with their `layawayBalance`) has been
  removed from `LayawayModal.tsx` for everyone, Alan K included — it now
  needs its own standalone, Alan-only dashboard/page rather than living
  inline in a popup any office member can open. Not built yet. When it
  is, note that `getBoardById` (`bat246.service.ts`) currently returns
  every slot's `isLayaway`/`isLayawayPlan`/`layawayBalance` to any caller
  who can fetch the board — the new dashboard's endpoint should be
  Alan-K-gated server-side (not just hidden in one UI) rather than
  reusing that same wide-open read.
