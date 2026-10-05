# `components/admin/MoveUplineDialog.tsx`

> Admin dialog for re-parenting an affiliate member under a different upline (referrer), with an opt-in switch to also move commissions already paid on the member's purchase.

**Kind:** React component · **Lines:** 493

## Purpose
In the affiliate / Unilevel Plus programme every member has an upline who earns on their sales. Admins sometimes need to correct who that is. This dialog, opened from the garage-admin member profile, lets an admin search for a new upline, preview the current-to-new change, and commit it through `POST /backend/garage-admin/users/:userId/move-upline`. Because moving historical commissions shifts real money between wallets, that part is off by default and explained in detail in the UI.

## How it works

### Props and state
- Props: `memberId`, `memberName`, `memberEmail`, `currentUpline` (`AdminUplineRef | null`), `directReferrals` (count of the member's direct downline), `open`, `onOpenChange`, `onDone`.
- State: `search` and its 300 ms debounced copy `debounced`, `results`, `searching`, `selected`, `submitting`, `moveCommissions` (default `false`), and an `inputRef` for autofocus.

### Reset on open (L135-L148)
Each time `open` becomes true, every field is reset, `moveCommissions` goes back to `false` (so the choice can never carry over from a previous member), and the search box is focused after 80 ms.

### Search (L150-L188)
- Fewer than 2 characters clears results.
- Otherwise calls `listUsers({ search, limit: 8, includeActivated: true })`. The long comment explains why `includeActivated` is mandatory: the admin users list hides members with `typeFlags.oneNetworkActivated` (those who paid for the $25 Unilevel Plus subscription) by default, which made paying members, the most likely uplines, impossible to pick.
- The member themself is filtered out of results. An `alive` flag discards responses from stale searches.

### Preview and selection
- Two `PersonChip`s show Current upline (or "No upline - root") and New upline. Results render as buttons with avatar, name, email and `affiliateId`; the current upline is tagged "· current".
- `alreadyUpline` is true when the selected user is already the upline; it disables Confirm and shows an inline warning.

### Commission switch and warning (L378-L455)
- A `role="switch"` toggle, "Also move already-paid commissions".
- Off: the ledger is historical; only future sales route to the new upline.
- On: the original payout from the member's $25 purchase is reversed and re-distributed down the new chain. The warning box turns red and explains that the old upline loses what they earned and platform revenue usually drops.
- If `directReferrals > 0`, it notes that the direct downline moves with the member.

### Confirm (L195-L237)
`moveUpline(memberId, selected.id, { moveCommissions })`, then a toast chosen from the result:
- No sweep requested, or no `commissionMove` in the response: success, mentioning `directReferralsMoved` if any.
- `commissionMove.status === "applied"`: success with `reversalTotal`, plus a "did not reconcile - please review" note when `balanced === false`.
- `"skipped"`: success, commissions unchanged, with the reason.
- `"blocked"` / `"failed"`: a warning that the move stands but commissions did NOT move.

It then calls `onDone()` and closes. Errors show `toast.error`.

### Internal components
- `Avatar({ name, email, src, size })` - image, or an initial on a gradient chip.
- `PersonChip({ label, name, email, src, tone })` - the preview card.

## Exports
- `MoveUplineDialog(props)` - the dialog described above.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/garage-admin/users?search=...&limit=8&includeActivated=...` (via `listUsers`) - upline search.
  - `POST /backend/garage-admin/users/:userId/move-upline` with body `{ newReferrerId, moveCommissions? }` (via `moveUpline`) - performs the move. Served by `server/routes/garageAdmin.ts`.
- **Browser storage / cookies:** the helpers authenticate with the `garage_admin_token` from `localStorage` (through `garageAdminApi` in `lib/api.ts`).

## Dependencies
- **Internal:** `components/ui/dialog.tsx` - Radix dialog primitives (`showCloseButton={false}`, custom close button).
- **Internal:** `lib/admin-api/users.ts` - `listUsers`, `moveUpline`, types `AdminUserListItem`, `AdminUplineRef`.
- **Packages:** `react`, `lucide-react` (icons), `sonner` (toasts).

## Used by
- `components/garage-admin/member-profile-view.tsx` (the garage-admin member profile).

## Notes
- The `DialogContent` uses `grid-cols-[minmax(0,1fr)]` on purpose: without it, long un-wrappable emails widened the grid column and were clipped instead of truncated.
- Never assume money moved just because the request succeeded; the code deliberately reads `commissionMove.status` separately.
