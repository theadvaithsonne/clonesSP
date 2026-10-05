# `app/(dashboard)/games/bat246/members/page.tsx`

> BAT246 "Office Members" page: a searchable, paginated table of everyone in the BAT246 office with contact details, role, join date and upline (referrer).

**Kind:** Next.js page · **Lines:** 378 · **Route:** `/games/bat246/members`

## Purpose
Part of the BAT246 back office (the tiles on `/games/bat246`). It gives admins, and anyone granted the "members" card on the Permissions page, a directory of all registered members of the BAT246 office and who referred each of them. The list comes from the backend office route, which resolves the BAT246 organisation from the product tagged `bat246_entry`.

## How it works

### Access and back link (L81-L99, L138-L147)
- `useAmIFounder()` is used only for its `loading` flag; `useBat246CardAccess("members")` gives `isAdmin` (Alan, or anyone with the `members` grant).
- For non-admins, once auth has loaded, it calls `GET ${API}/bat246/my-dashboard-access` and stores `hasAccess` (true when the user holds a board position that earns the richer dashboard).
- The back button target depends on role: admins go to `/games/bat246` ("Admin Board"), dashboard holders to `/games/bat246/dashboard` ("Dashboard"), everyone else to `/games/bat246/boards` ("Boards").
- The page itself does not block non-admins: anyone who opens the URL gets the table if the API answers. The backend route only requires a valid login (`requireAuth`).

### Loading the members (L101-L110)
- First checks the module-level cache from `lib/bat246MembersCache.ts` (`getMembersCache()`, 60-second TTL). On a hit it renders immediately.
- Otherwise fetches `GET ${API}/office/bat246/members` with the bearer token from `localStorage["garage_tok"]`, stores the result with `setMembersCache` and shows it. Failure shows "Failed to load members". The BAT246 landing page (`/games/bat246`) warms the same cache when it loads its stats, so coming from there is usually instant.

### Search and pagination (L112-L132, L161-L186)
- Client-side, case-insensitive substring search over member name, email, city, country, and the upline's name and email. A result count shows inside the search box.
- Changing the search resets to page 1. `PAGE_SIZE` is 15; the footer shows "Showing start-end of N" with Previous/Next buttons when there is more than one page.

### Table rendering (L240-L372)
- Six columns (shared `GRID` template): Member (avatar + name + email), Phone, Location (city, country; hover shows `address.formatted`), Role, Joined, Upline (Referrer).
- `MemberAvatar` shows `profilePicture` or a coloured initial (brand colour for founders); `UplineAvatar` is the smaller upline version. `initials` falls back from name to email to "?".
- Role badge: "Founder" (crown icon) when `role === "founder"`, otherwise "Stakeholder".
- Joined date is formatted as month + year (`fmtDate`), with "—" for missing values.
- Separate states for loading (an in-page 10-row skeleton), error, and empty ("No members match your search" / "No members found"). Rows fade in with a staggered `animationDelay`.

## Exports
- `default Bat246MembersPage()` - the page component.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/office/bat246/members` - BAT246 office member list (`totalMembers`, `members[]` with `address`, `role`, `joinedAt`, `upline`); requires login.
  - `GET /backend/bat246/my-dashboard-access` - whether the user has the board-position dashboard (only used to choose the back link).
  - Indirectly, `useBat246CardAccess` calls `GET /backend/bat246/permissions/mine`.
- **Browser storage:** reads `localStorage["garage_tok"]` (JWT for the `Authorization: Bearer` header).
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (falls back to `http://localhost:4000`).

## Dependencies
- **Internal:**
  - `lib/bat246MembersCache.ts` - in-memory 60s cache and the `MembersApiResponse` / `PersonBlock` types.
  - `lib/hooks/useAmIFounder.ts` - auth loading state.
  - `lib/hooks/useBat246CardAccess.ts` - "members" card admin check.
  - `components/ui/badge.tsx` - role badge.
- **Packages:** `react`, `next` (`next/link`), `lucide-react` (icons).

## Used by
- Next.js route `/games/bat246/members`; linked from the "Office Members" tile on `/games/bat246`. While its code loads, `members/loading.tsx` is shown.

## Notes
- Phone numbers, emails and addresses of every office member are visible to any logged-in user who opens the URL, because neither the page nor the backend route checks the `members` grant. The grant only controls whether the tile appears on the landing page.
- The cache is per browser tab (module memory), not persisted.
