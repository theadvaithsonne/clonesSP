# `components/affiliate/globe/types.ts`

> Shared TypeScript types, API response shapes, a country-centroid lookup table and coordinate helpers for the affiliate globe feature.

**Kind:** React component (types and pure helpers module) · **Lines:** 234

## Purpose
Every part of the affiliate globe (hook, map, sidebar, profile overlay) talks about the same "affiliate user" object returned by the backend's `/affiliate/*` endpoints. This file defines that shape once, plus the marker shape the map needs, and the logic for placing users who have no stored coordinates on the globe.

## How it works
### Domain types
- `AffiliateLocation` - optional `city`, `state`, `country`, `latitude`, `longitude`.
- `AffiliateOffice` - an organisation (office) the user belongs to: `orgId`, `name`, `icon`, `slug`, `role` (`"founder" | "stakeholder"`), optional `guest` flag, `joinedAt`. The comment explains that guest members keep `role: "stakeholder"` because that is the only non-founder enum value; `guest` only changes UI labels and access.
- `AffiliateUserPurchases` - booleans `unilevelPlus` (the $25 Unilevel Plus licence), `basicPlan`, `proPlan` (office plans).
- `AffiliateUser` - the central object: identity (`id`, `name`, `email`, `phone?`, `avatar`, `affiliateId?`), `joinedAt`, `status` (`"active" | "inactive"`), `userType` (`"founder" | "stakeholder"`), root-level `guest?` (mirrors `User.guest` in the backend), `isPaidFounder?`, `purchases?`, referral counts (`directReferrals`, `totalReferrals?`), offices (`officesJoined?`, `offices?`), `hasChildren`, `location`, and an optional `referrer` summary.
- `GlobeMarkerData` - the flattened data one map marker needs (id, name, avatar, lat/lng, referral count, `hasChildren`, `userType`, `status`, `isFocused?`, `purchases?`).
- `AffiliateGlobeState` - a state shape (focused user, children, history, loading, error). It is not referenced by the hook, which keeps these as separate `useState` values.

### API response types
- `DirectChildrenResponse` - `GET /backend/affiliate/direct-children/:userId`: `{ success, userId, children, pagination: { page, limit, total, totalPages, hasMore } }`.
- `UserInfoResponse` - `GET /backend/affiliate/user-info/:userId`: `{ success, user }`.
- `SearchDownlineByEmailResponse` - `GET /backend/affiliate/search-downline-by-email/:userId`: `{ success, found, isSelf?, message?, navigationPath?, targetUser? }`.

### Coordinate helpers
- `COUNTRY_COORDINATES` - approximate centre lat/lng for about 60 countries, keyed by English country name (exact match, case-sensitive).
- `addJitter(coord, range = 3)` (private) - adds a random offset in `[-range/2, +range/2]` so users from the same country do not stack on one point.
- `assignFallbackCoordinates(user)` - returns the user unchanged if it already has numeric lat/lng; otherwise places it at its country's centre plus jitter; if the country is unknown, places it at a random point (latitude within +/-30, longitude within +/-90 of 0,0). Always returns a new object; never mutates the input.
- `isValidCoordinate(lat?, lng?)` - true only for defined, non-NaN values inside -90..90 / -180..180.
- `getLocationString(location)` - joins city, state, country with commas, or `"Unknown Location"`.

## Exports
- Types/interfaces: `AffiliateLocation`, `AffiliateOffice`, `AffiliateUserPurchases`, `AffiliateUser`, `GlobeMarkerData`, `AffiliateGlobeState`, `DirectChildrenResponse`, `UserInfoResponse`, `SearchDownlineByEmailResponse`.
- `COUNTRY_COORDINATES: Record<string, { lat: number; lng: number }>` - country centre lookup.
- `assignFallbackCoordinates(user: AffiliateUser): AffiliateUser` - fills in missing coordinates.
- `isValidCoordinate(lat?: number, lng?: number): boolean` - range check.
- `getLocationString(location: AffiliateLocation): string` - human-readable location.

## Dependencies
None (no imports).

## Used by
- `components/affiliate/globe/AffiliateAccordionSidebar.tsx`
- `components/affiliate/globe/AffiliateGlobeMap.tsx`
- `components/affiliate/globe/AffiliateProfileOverlay.tsx`
- `components/affiliate/globe/hooks/useAffiliateGlobe.ts`
- `components/affiliate/globe/index.ts` (re-exports everything)

## Notes
- Fallback positions are random, so a user without stored coordinates appears at a slightly different place each time the coordinates are recomputed (the hook recomputes for the focused user whenever its marker list is rebuilt). They are presentation-only and never sent back to the server.
- Country names coming from the backend that are not spelled exactly as in the table (e.g. "USA", "UK") fall through to the random-position branch.
