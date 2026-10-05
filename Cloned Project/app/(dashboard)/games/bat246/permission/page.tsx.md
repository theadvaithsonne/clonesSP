# `app/(dashboard)/games/bat246/permission/page.tsx`

> Alan-only BAT246 "Permissions" page: a people-by-cards checkbox grid for granting or revoking access to the BAT246 back-office cards, with search, pagination and batch save.

**Kind:** Next.js page · **Lines:** 406 · **Route:** `/games/bat246/permission`

## Purpose
BAT246 back-office tiles (Office Members, Distributors, Lost Money, and so on) are gated by per-user "card" grants. This page is where the game owner (identified by a hardcoded email, constant `ALAN_K_EMAIL` on L13) decides who gets which card. It is the editing UI for the `Bat246CardPermission` grants that `useBat246CardAccess` / `useMyBat246Grants` read everywhere else. Managing permissions is itself never grantable; only that one account can use this page.

## How it works

### Gate (L65-L67, L175-L183)
- `useAmIFounder()` provides the current user's email. `isAlanK` is true only when it matches `ALAN_K_EMAIL` (case-insensitive).
- Anyone else sees a centred "Admin only." message. The backend enforces the same rule with its `requireAlanKOnly` middleware on both endpoints this page uses.

### Loading the matrix (L79-L92)
- `loadPeople()` fetches `GET ${API}/bat246/permissions/people-matrix` with the bearer token from `localStorage["garage_tok"]`.
- The backend returns `people[]`: everyone in the BAT246 org, plus anyone else who has a grant or a board position, excluding Alan himself, sorted by name/email. Each person has `access[cardKey] = { granted, legacy }` for every card key.
- `legacy: true` means the access is automatic and cannot be revoked here: either the person holds a board position (for `boards`, `members`, `distributors`, `inviteandplace`) or they are a plain org member (for the default cards `documentation`, `b2coinwallet`).

### Grid (L42-L50, L270-L374)
- `COLUMNS` lists seven cards with the same icons/colours as the landing-page tiles: Game Boards, Office Members, Distributors, Documentation, Lost Money, Invite and Place, B2 Coin Wallet.
- `NON_EDITABLE_CARDS = ["boards"]`: Game Boards access is governed only by board position, so that column is always disabled (with a lock icon and tooltip).
- Each cell is a square button. Visual states: locked (grey with lock: a legacy cell, or a non-editable cell that is off), checked (brand colour with tick), unchecked. The person column is sticky on horizontal scroll; the table has a 900px minimum width.
- A legend explains "Has access", "Board position (locked)", "No access".

### Editing workflow (L56-L58, L106-L173)
- View mode is read-only. **Edit** clears the `draft` and enables clicking.
- `draft[userId][cardKey]` holds only the overrides the admin has clicked. `isChecked` resolves a cell as: legacy means always true; in edit mode the draft value wins if present; otherwise the server's `granted`.
- `toggle` ignores clicks outside edit mode, on legacy cells and on non-editable columns.
- **Cancel** discards the draft. **Save** diffs the draft against the server state, building `changes: [{ userId, cardKey, granted }]` for cells that actually differ. With no changes it just leaves edit mode. Otherwise it posts `POST ${API}/bat246/permissions/bulk-update` with `{ changes }`, shows a `sonner` toast ("Updated permissions for N people"), leaves edit mode and reloads the matrix. Errors show a toast with the server's message.
- On the server, a `granted: true` change upserts a `Bat246CardPermission` (recording `grantedByEmail`) and a `false` change deletes it; malformed entries and Alan's own account are skipped.

### Search and pagination (L94-L104, L258-L268, L376-L401)
- Client-side filter on name or email; changing the search resets to page 1. `PAGE_SIZE` is 15, with prev/next buttons and a "N people · page x of y" label.

## Exports
- `default Bat246PermissionPage()` - the page component.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/permissions/people-matrix` - full people-by-cards access matrix (requireAuth + Alan-only).
  - `POST /backend/bat246/permissions/bulk-update` - apply a batch of grant/revoke changes (requireAuth + Alan-only).
- **Database (via backend):** `Bat246CardPermission` (grants, upserted/deleted on save), `User` (org members, names, emails), plus a scan of board positions for legacy access.
- **Browser storage:** reads `localStorage["garage_tok"]` for the `Authorization: Bearer` header.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (falls back to `http://localhost:4000`).

## Dependencies
- **Internal:**
  - `lib/hooks/useAmIFounder.ts` - current user's email for the Alan check.
  - `lib/hooks/useBat246CardAccess.ts` - the `Bat246CardKey` type only.
- **Packages:** `react` (`useState`, `useEffect`, `useMemo`), `next` (`next/link`), `sonner` (toasts), `lucide-react` (icons).

## Used by
- Next.js route `/games/bat246/permission`; linked from the "Permissions" tile on `/games/bat246`, which only Alan sees. No file imports it.

## Notes
- `BAT246_CARD_KEYS` also contains `snapbackloans`, but it has no column here, so that card cannot be granted or revoked from this grid.
- The admin identity is a hardcoded email duplicated in this file, in `lib/hooks/useBat246CardAccess.ts` and on the backend; changing the owner means editing all of them.
- Grant changes take up to 30 seconds to show for the affected user, because `useMyBat246Grants` caches grants in memory for that long.
