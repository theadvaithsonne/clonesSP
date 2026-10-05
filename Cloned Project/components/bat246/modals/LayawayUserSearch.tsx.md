# `components/bat246/modals/LayawayUserSearch.tsx`

> Single-select, debounced user search box whose results dropdown is portaled to `document.body`, used by the BAT246 B2 Coin (Layaway) and Snap Back Loan modals.

**Kind:** React component · **Lines:** 175

## Purpose
The B2 Coin "Send"/"Request" flows and the Snap Back Loan flow all need to pick one person from the BAT246 office: a recipient, a friend, or an eligible lender. This component is that picker. It follows the debounce/outside-click pattern of `components/ui/user-search-picker.tsx`, but is single-select and talks to BAT246-scoped endpoints that return `{ userId, ... }` rather than `{ _id, ... }`.

## How it works
- **Debounced fetch (L58-L82):** whenever `query`, `endpoint` or `resultsKey` changes, a 250 ms timer fires `GET ${API}${endpoint}?q=<query>` (trimmed, inner whitespace collapsed) with the `garage_tok` Bearer token, then stores `data[resultsKey]`. A per-effect `stale` flag stops a slow earlier response from overwriting a newer one. Errors produce an empty list. The fetch also runs once on mount with an empty query.
- **Outside click (L84-L97):** a document `mousedown` listener closes the dropdown unless the click is inside the input container or inside the portaled dropdown. Checking the dropdown is required because, being portaled, it is not a DOM child of the container; without that check a click on a result would close the list before its `onClick` ran.
- **Positioning (L99-L114):** while open, the input's bounding rect is measured and the dropdown is placed with `position: fixed` just below it. It re-measures on any scroll (capture phase, so modal scrolling counts) and on resize. This avoids the dropdown being clipped by the host modal's `overflow-y-auto` wrapper.
- **Render (L116-L172):** the dropdown shows only when open and the query is non-blank or a request is loading. It shows a spinner, "No matches", or one button per result with name and email. When `showRemaining` is set and the result has `eligibility`, it also shows `$totalRemaining`, or the infinity sign for the BAT246 admin (`isAlanK`). Selecting calls `onSelect(u)`, then clears the query and results and closes. The dropdown uses `z-[20050]`, above the host modals' `z-[20000]`.

## Exports
- `LayawayUserSearch({ endpoint, resultsKey, placeholder?, onSelect, showRemaining? })` - the picker. `endpoint` is a path appended to `NEXT_PUBLIC_API_URL`; `resultsKey` is `"users"` or `"people"`, the response field to read; `placeholder` defaults to "Search by name or email..."; `showRemaining` shows each person's remaining sendable amount.
- `interface LayawayPickedUser` - `{ userId, name, email, profilePicture?, eligibility?: { totalRemaining, isAlanK } }`, the shape of a result and of the value passed to `onSelect`.

## Interfaces
- **Backend endpoints called (as passed in by callers):**
  - `GET /backend/bat246/layaway/recipients/search?q=` - `requireAuth`; `searchBat246OfficeUsers` returns `{ users }`, members of the BAT246 organisation matching name/email.
  - `GET /backend/bat246/layaway/eligible-people?q=` - `requireAuth`; `searchEligiblePeople` returns `{ people }`, the same users plus an `eligibility` object whose `totalRemaining` is wallet balance plus pool giving power.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (fallback `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Packages:** `react` - state, effects, refs; `react-dom` - `createPortal`; `lucide-react` - `Search`, `Loader2` icons.

## Used by
- `components/bat246/modals/LayawayModal.tsx` - recipient and eligible-person fields.
- `components/bat246/modals/SnapBackLoanModal.tsx` - friend and lender fields.

## Notes
- `res.ok` is not checked; an error body without the expected key simply yields "No matches".
- Each search against `eligible-people` makes the server compute eligibility for every candidate, so it is heavier than the recipients search.
