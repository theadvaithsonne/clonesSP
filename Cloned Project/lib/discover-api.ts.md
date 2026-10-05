# `lib/discover-api.ts`

> Typed client for the "Discover offices" directory: listing, searching, categories, trending offices, an office's public profile, and joining or requesting to join an office.

**Kind:** frontend library · **Lines:** 124

## Purpose
The office directory (the offices browser on `/select-organization` and the `components/offices/*` widgets) lets a signed-in user find other Garage offices and join them. This module wraps the backend endpoints behind that UI with typed functions and cleans up two backend quirks: raw regex matching on user input and duplicate, inconsistently spelled categories.

## How it works
All calls go through `api()` from `lib/api.ts`, which prefixes `NEXT_PUBLIC_API_URL` (now `<origin>/backend`) and attaches the `garage_tok` Bearer token when present.

- **Regex escaping.** The backend drops `search` and `category` straight into a Mongo `$regex`, so a stray `(` or `+` would cause a 500. `escapeRegex` escapes regex metacharacters before sending.
- **`fetchDiscoverOffices({ search?, category?, page?, limit? })`.** Sends the escaped search; for category it sends `\s*<escaped category>\s*` so free-text categories stored with stray whitespace (`"Creative "`) still match (case is already ignored server-side). Defaults: `page=1`, `limit=12`. The backend matches `search` against the office name only and also lists private offices; joining one of those goes through `requestToJoinOffice` instead.
- **`fetchDiscoverCategories()`.** The backend groups by the exact stored string, so `"Marketing"`, `"marketing"` and `"Marketing "` arrive separately. This function trims names, drops empty ones, merges case-insensitively under the first spelling it encounters (adding counts), and sorts by count descending.
- **`fetchPublicOffice(orgId)`.** Returns `organization` from the public HQ endpoint, the only place `office_public` (whether anyone may join directly) is exposed.
- **`fetchTrendingOffices({ days = 7, limit = 6 })`.** Offices ranked by joins in the window; offices with no joins are excluded server-side. Returns `{ days, offices }`, falling back to the requested `days` and an empty list.
- **`joinPublicOffice(userId, orgId)`.** Joins an open office; private offices answer 403. Response may carry `alreadyMember`.
- **`requestToJoinOffice(userId, orgId, name?)`.** Asks a private office's founders for access.

## Exports
- `type DiscoverOffice` - office card data (`_id`, `name`, optional `slug`, `description`, `icon`, `coverPhoto`, `category`, `city`, `state`, `country`, `createdAt`, `memberCount`).
- `type DiscoverCategory` - `{ name, count }`.
- `type DiscoverPagination` - `{ page, limit, total, totalPages }`.
- `type PublicOfficeDetails` - public profile including `office_public` and `founders[]`.
- `type TrendingOffice` - `DiscoverOffice & { recentJoins: number }`.
- `fetchDiscoverOffices(params)` - `Promise<{ organizations: DiscoverOffice[]; pagination: DiscoverPagination }>`.
- `fetchDiscoverCategories(): Promise<DiscoverCategory[]>` - merged, sorted categories.
- `fetchPublicOffice(orgId: string): Promise<PublicOfficeDetails>`.
- `fetchTrendingOffices({ days?, limit? }?)` - `Promise<{ days: number; offices: TrendingOffice[] }>`.
- `joinPublicOffice(userId: string, orgId: string)` - `Promise<{ alreadyMember?: boolean }>`.
- `requestToJoinOffice(userId: string, orgId: string, name?: string)` - `Promise<{ message?: string }>`.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/discover/organizations?search=&category=&page=&limit=` - paginated office list (`server/routes/discover.ts`).
  - `GET /backend/discover/categories` - category counts.
  - `GET /backend/discover/trending?days=&limit=` - trending offices.
  - `GET /backend/public/hq-organizations/:orgId` - public office profile (`server/routes/public.ts`).
  - `POST /backend/guest-auth/public-join` - body `{ guestUserId, orgId }`; join an open office (`server/routes/guestAuth.ts`).
  - `POST /backend/guest-auth/request-join` - body `{ guestUserId, orgId, name }`; request access to a private office.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper (base URL, auth header, error handling).
- **Packages:** none.

## Used by
- `app/select-organization/page.tsx` (route `/select-organization`)
- `components/offices/CategoryNav.tsx`, `components/offices/FeaturedOffices.tsx`, `components/offices/JoinOfficeDialog.tsx`, `components/offices/OfficeGridView.tsx`, `components/offices/OfficeSearchPalette.tsx`, `components/offices/OfficesTopBar.tsx`

## Notes
- The backend also serves `GET /discover/featured`, which this module does not wrap.
- The user id is sent in the body as `guestUserId`; the join endpoints are shared with the guest-office flow.
