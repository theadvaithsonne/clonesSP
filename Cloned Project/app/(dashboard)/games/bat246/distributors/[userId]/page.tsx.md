# `app/(dashboard)/games/bat246/distributors/[userId]/page.tsx`

> Client page showing one qualified BAT 246 distributor's profile: contact details, qualification flags, office membership and a two-level upline chain.

**Kind:** Next.js page · **Lines:** 435 · **Route:** `/games/bat246/distributors/[userId]`

## Purpose
The Distributors grid (`/games/bat246/distributors`) links each row here. The page merges two data sources about the same person, the BAT 246 distributor record (qualification state, distributor ID) and the BAT 246 office members list (role, join date, address, upline), into a read-only profile view. It performs no writes.

## How it works
**Route param.** `params` is a Promise (Next.js 15); it is unwrapped with React's `use()` to get `userId` (a Garage User id).

**Data loading (three independent effects).**
1. *Breadcrumb access (L145-L152).* Unless the viewer is the hardcoded BAT 246 admin (`ALAN_K_EMAIL`, compared case-insensitively against `useAmIFounder().userData.email`), it calls `GET /backend/bat246/my-dashboard-access` and stores `hasAccess`. This only decides where the first breadcrumb points: admin -> `/games/bat246` ("Admin Board"), dashboard-access holders -> `/games/bat246/dashboard`, everyone else -> `/games/bat246/boards`.
2. *Members (L154-L162).* Uses `getMembersCache()` if a fresh (under 60 s) copy exists, otherwise fetches `GET /backend/office/bat246/members`, stores it with `setMembersCache()` and keeps `members`.
3. *Distributor (L164-L176).* Fetches `GET /backend/bat246/distributors?page=1&limit=50`, builds `allDistIds` (a Set of every returned distributor's user id, used to label upline people) and finds the row whose `userId._id` (or raw `userId`) equals the route param. No match sets the sentinel `"not_found"`. `pageLoading` clears when this request settles.

**Derived data.**
- `membersMap` - `Map<userId, CachedMember>` built from the members list.
- `getUplineChain()` (L111-L131) walks `member.upline` up to 2 levels, guarding against cycles with a `visited` set. For each ancestor it prefers the richer `CachedMember` record over the bare `PersonBlock` embedded in `upline`, and flags whether that ancestor is in `allDistIds`.
- Display name/email/phone fall back from the distributor's populated user to the member record; location prefers `address.formatted`, else city/state/country from either source.

**Rendering.**
- Loading: pulse skeleton. Not found: "Distributor not found" with a back link to the grid.
- Hero card: avatar (image or initial), name, `distributorId` badge, "Qualified" badge, office role badge, email/phone/address/postal code, joined and qualified dates, and an "Active Distributor / Not Qualified" pill.
- "Qualification Status" card (only when a distributor row exists): `FlagRow`s for Office Member, Garage Affiliate (with expiry), BAT 246 Membership (with expiry), Product Purchased, and an overall verdict from `isQualified`.
- "Office Membership" card (only when a member row exists): role, guest vs full member, member-since timestamp, city/state/country.
- "Upline Chain" card: up to two level cards marked "Distributor" or "Not yet", or an empty state.

Small local components: `Avatar`, `SectionCard`, `InfoRow`, `FlagRow`, plus the `fmtDate()` formatter (en-US short date, optional time, "—" when empty).

## Exports
- `default DistributorDetailPage({ params }: { params: Promise<{ userId: string }> })` - the page component.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/my-dashboard-access` - only for breadcrumb target.
  - `GET /backend/office/bat246/members` - office members with upline data (skipped when cached).
  - `GET /backend/bat246/distributors?page=1&limit=50` - qualified distributors, newest qualification first.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` as the bearer token.

## Dependencies
- **Internal:**
  - `lib/bat246MembersCache.ts` - `getMembersCache` / `setMembersCache` and the `CachedMember` / `PersonBlock` types.
  - `lib/hooks/useAmIFounder.ts` - viewer email and auth loading state.
- **Packages:** `react` (`use`, `useState`, `useEffect`, `useMemo`), `next/link`, `lucide-react` (icons).

## Used by
Not imported by any file; reached as the dynamic route `/games/bat246/distributors/<userId>`, linked from the Distributors grid page.

## Notes
- **50-row ceiling:** the backend `listDistributors` caps `limit` at 50 and sorts by `qualifiedAt` descending, and this page only fetches page 1. A distributor who is not among the 50 most recently qualified will show "Distributor not found" even though they exist. Likewise `allDistIds` only knows those 50, so an older distributor in someone's upline is labelled "Not yet".
- The admin email is hardcoded at L15; it affects only the breadcrumb here, not data access.
- No access gate on the page itself; what a viewer can see is whatever the backend endpoints return to their token.
