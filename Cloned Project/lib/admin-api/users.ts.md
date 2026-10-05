# `lib/admin-api/users.ts`

> Garage-admin client for the All Users table and member operations: paginated user list with filters, a user's wallets and payout accounts, extending the 24-hour offer, moving a member to a new upline, and user type-ahead search.

**Kind:** frontend library · **Lines:** 279

## Purpose
This module is shared by the admin Users page, the User Wallets page, and several dialogs (withdrawal, move upline, payout details, company scope, invite admin, support chats, downline scope, member profile). It defines the shapes those screens use for a user row and a user's wallets, and the calls that load or change them. `lib/admin-api/demo.ts` uses `AdminUserListItem` to build its fake rows.

## How it works
- `qs(params)` builds the query string and skips empty values. Responses use the `{ success, data }` envelope and the helpers return `.data`; `searchUsers` is the exception and returns `.users`.
- **`listUsers(filters)`** calls `GET /backend/garage-admin/users` with:
  - `search`, `skip`, `limit`;
  - `includeActivated` - by default the backend shows a prospecting view that hides users who already activated the $25 Unilevel Plus subscription; pass true to show everyone;
  - per-column filters `fName`, `fLocation`, `fActivated` - applied on the server because the list is paginated (filtering one page in the browser would search about 30 of about 1,900 users);
  - `rootUserId` - "Open View": limit the list to that user's downline (everyone with this id in their ancestor path).

  Each `AdminUserListItem` has:
  - identity and verification flags, location, upline and offices (with logo);
  - `typeFlags`, direct and downline counts;
  - the 24-hour welcome-offer state (`AdminUserOfferWindow`: window times, `status` `not_started | pending | expired | completed`, admin-extension audit fields);
  - purchase totals and commissions generated.
- **`getUserWallets(userId)`** returns the user summary (offices, upline, direct referral count) and every wallet:
  - `walletType` and the store org;
  - `balance` and `withdrawableBalance` (cents);
  - payout `accounts` - `AdminWalletAccount` with bank fields (country, bank, account number, SWIFT, routing, IBAN, beneficiary) or crypto fields (network, address, memo).
- **`extendUserOffer(userId, hours)`** re-opens or extends the welcome-offer window to `now + hours` (1-720). The backend never shortens a window. It returns the recalculated window so the row can be updated in place.
- **`moveUpline(userId, newReferrerId, { moveCommissions? })`** re-parents a member in the referral tree. On its own it only affects future commissions. With `moveCommissions: true` the backend reverses the member's already-paid Unilevel Plus commission distribution and runs it again down the new chain, **moving real money between wallets**. The result reports the moved member, previous and new upline, `directReferralsMoved`, and `commissionMove` (status `applied | skipped | blocked | failed`, the amount reversed, whether the new distribution `balanced`, `platformDelta`, and the new distribution id). The move can succeed while the commission step does not, so never assume money moved because the request returned 200. Validation failures (self-referral, cycle, no change, not found) are thrown with the server's message.
- **`searchUsers(q, limit = 8)`** is a type-ahead over verified users by name or email, using the same endpoint as the coupon-assignment picker. It returns `[]` for a blank query instead of the whole user table.

## Exports
- Types: `AdminUserOffice`, `AdminUserUpline`, `AdminUserOfferWindow`, `AdminUserListItem`, `AdminUsersResult`, `AdminWalletAccount`, `AdminUserWallet`, `AdminUplineRef`, `AdminUserWallets`, `MoveUplineResult`, `AdminUserSuggestion`.
- `listUsers(filters?): Promise<AdminUsersResult>`
- `getUserWallets(userId): Promise<AdminUserWallets>`
- `extendUserOffer(userId, hours): Promise<Partial<AdminUserOfferWindow>>`
- `moveUpline(userId, newReferrerId, opts?): Promise<MoveUplineResult>`
- `searchUsers(q, limit?): Promise<AdminUserSuggestion[]>`

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/garage-admin/users` - `server/routes/garageAdmin.ts` (`listAllUsers`, any garage admin)
  - `GET /backend/garage-admin/users/:userId/wallets` - `getUserWalletsForAdmin`
  - `POST /backend/garage-admin/users/:userId/extend-offer` - `extendUserOffer`
  - `POST /backend/garage-admin/users/:userId/move-upline` - `adminMoveUpline`
  - `GET /backend/garage-admin/users/search?q&limit` - `adminUserSearchRouter` from `server/routes/userSearch.ts`, mounted at `/garage-admin/users`

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/user-wallets/page.tsx`, `app/garage-admin/(admin-dashboard)/users/page.tsx`
- `components/admin/InitiateWithdrawalDialog.tsx`, `MoveUplineDialog.tsx`, `PayoutAccountDetail.tsx`
- `components/garage-admin/CompanyScopeDialog.tsx`, `InviteAdminDialog.tsx`, `SupportChatsConsole.tsx`, `downline-scope.tsx`, `member-profile-view.tsx`
- `lib/admin-api/demo.ts`

## Notes
- `AdminWalletAccount` carries full bank account numbers and crypto addresses. Treat what this module returns as sensitive.
