# `lib/hooks/useBat246CardAccess.ts`

> Hooks that decide which BAT246 back-office "cards" (admin sections) the current user may open: the game owner gets everything, and everyone else gets only what has been granted on the BAT246 Permissions page.

**Kind:** React hook · **Lines:** 68

## Purpose
The BAT246 game has an admin back-office under `/games/bat246` made up of cards such as Boards, Members, Distributors and Lost Money. Access is not role-based: the owner (the account referred to in code as "Alan K") holds every card, and can grant individual cards to other users from `/games/bat246/permission`. Every back-office page uses this hook to show or hide its content.

## How it works
- `BAT246_CARD_KEYS` lists the card keys: `boards`, `members`, `distributors`, `documentation`, `lostmoney`, `inviteandplace`, `b2coinwallet`, `snapbackloans`.
- `useMyBat246Grants()`:
  1. Waits for `useAmIFounder()` to finish loading, then compares `userData.email` (case-insensitively) with the owner email hardcoded on L6 (`ALAN_K_EMAIL`). The owner skips the network call.
  2. Otherwise it uses a module-level cache (`_grantsCache`, 30 s TTL in `GRANTS_TTL`) shared by every component on the page, or calls `GET /backend/bat246/permissions/mine` with the `garage_tok` bearer token. The response's `cardKeys` array (anything else counts as empty) becomes `grantedKeys`; on failure `grantedKeys` is empty.
  3. `loading` stays true until auth has loaded and the grant check has finished.
- `useBat246CardAccess(cardKey)` reduces that to `isAdmin = isAlanK || grantedKeys.includes(cardKey)`.

## Exports
- `useBat246CardAccess(cardKey: Bat246CardKey)` - `{ isAdmin, loading }` for one card.
- `useMyBat246Grants()` - `{ isAlanK, grantedKeys, loading }`.
- `BAT246_CARD_KEYS` - readonly tuple of card keys.
- `type Bat246CardKey` - union of those keys.

## Interfaces
- **Backend endpoints called:** `GET /backend/bat246/permissions/mine` (`server/bat246/routes/bat246Permission.routes.ts`, `requireAuth`) - returns `{ cardKeys }` granted to the caller via `getGrantedCardKeys`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (fallback `http://localhost:4000`).
- **Browser storage / cookies:** localStorage `garage_tok` (session token).

## Dependencies
- **Internal:** `lib/hooks/useAmIFounder.ts` - current user's email from `/auth/me`.
- **Packages:** `react` - state and effects.

## Used by
- `app/(dashboard)/games/bat246/page.tsx`
- `app/(dashboard)/games/bat246/boards/page.tsx`
- `app/(dashboard)/games/bat246/members/page.tsx`
- `app/(dashboard)/games/bat246/distributors/page.tsx`
- `app/(dashboard)/games/bat246/Inviteandplace/page.tsx`
- `app/(dashboard)/games/bat246/B2CoinWallet/page.tsx`
- `app/(dashboard)/games/bat246/lostmoney/admin/page.tsx`
- `app/(dashboard)/games/bat246/lostmoney/paidlist/page.tsx`
- `app/(dashboard)/games/bat246/permission/page.tsx`
- `app/(dashboard)/games/bat246/snapbackloans/page.tsx`

## Notes
- The owner check uses a hardcoded email. The backend's owner-only routes use their own `requireAlanKOnly` middleware, so the two checks must be kept in step if the owner account ever changes.
- The client-side check only hides UI; the backend routes behind each card must enforce access themselves.
- The grants cache is module-level and is not cleared on logout or account switch; a different user in the same tab could see the previous user's grants for up to 30 seconds.
