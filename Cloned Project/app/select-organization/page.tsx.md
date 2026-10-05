# `app/select-organization/page.tsx`

> Next.js page rendered at `/select-organization`.

**Kind:** Next.js page · **Lines:** 682 · **Directive:** `"use client"` · **Route:** `/select-organization` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SectionHeading`×7 (components/offices/ui.tsx), `Pill`×5 (components/offices/ui.tsx), `OfficeCard`×3 (components/offices/OfficeCard.tsx), `OfficeSwitcherCard`×3 (components/offices/OfficeCard.tsx), `OfficesPageSkeleton`×2 (components/offices/OfficesSkeletons.tsx), `OfficeGrid`×2 (components/offices/OfficeGridView.tsx), `OfficeCardSkeleton`×2 (components/offices/OfficeCard.tsx), `Loader2`×2 (lucide-react), `Atmosphere` (components/offices/ui.tsx), `OfficesTopBar` (components/offices/OfficesTopBar.tsx), `MyOfficesView` (components/offices/MyOfficesView.tsx), `OfficeGridView` (components/offices/OfficeGridView.tsx), `GettingStartedCard` (components/offices/HubSections.tsx), `FindOfficeCard` (components/offices/OfficeCard.tsx), `HubHero` (components/offices/HubSections.tsx), `JoinAnotherOfficeTile` (components/offices/OfficeCard.tsx), `FeaturedOfficesSkeleton` (components/offices/FeaturedOffices.tsx), `FeaturedOffices` (components/offices/FeaturedOffices.tsx), `CategoryRail` (components/offices/CategoryNav.tsx), `GrowthNote` (components/offices/FeaturedOffices.tsx), `CategoryTilesSkeleton` (components/offices/CategoryNav.tsx), `CategoryTiles` (components/offices/CategoryNav.tsx), `OfficesFooter` (components/offices/HubSections.tsx), `JoinOfficeDialog` (components/offices/JoinOfficeDialog.tsx), `OfficeEmblem` (components/offices/ui.tsx), `Suspense` (react), `OrganizationSelectionPageContent` (local)

**Hooks used:** `useState`×12, `useMemo`×5, `useEffect`×4, `useRouter` (next/navigation), `usePathname` (next/navigation), `useSearchParams` (next/navigation), `useRef`, `useLayoutEffect`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrganizationSelectionPage)` | component | `OrganizationSelectionPage()` | 675 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/profile?userId=${userId}` (L121)
  - `GET /backend/auth/me` (L158)
  - `POST /backend/auth/select-org` (L306)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `clearToken`, `getToken`, `getUserDataFromToken`, `saveOrgId`, `saveToken`
  - `lib/discover-api.ts` — `fetchDiscoverCategories`, `fetchDiscoverOffices`, `fetchPublicOffice`, `fetchTrendingOffices`, `TrendingOffice`, `DiscoverCategory`, `DiscoverOffice`, `PublicOfficeDetails`
  - `lib/bat246Office.ts` — `BAT246_ORG_ID`, `bat246LandingPath`
  - `components/offices/OfficesTopBar.tsx` — `OfficesTopBar`
  - `components/offices/OfficeGridView.tsx` — `OfficeGrid`, `OfficeGridView`, `GridMode`
  - `components/offices/CategoryNav.tsx` — `CategoryRail`, `CategoryTiles`, `CategoryTilesSkeleton`
  - `components/offices/OfficeCard.tsx` — `FindOfficeCard`, `JoinAnotherOfficeTile`, `OfficeCard`, `OfficeCardSkeleton`, `OfficeSwitcherCard`, `OfficeCardData`
  - `components/offices/JoinOfficeDialog.tsx` — `JoinOfficeDialog`
  - `components/offices/HubSections.tsx` — `GettingStartedCard`, `HubHero`, `OfficesFooter`
  - `components/offices/FeaturedOffices.tsx` — `FeaturedOffices`, `FeaturedOfficesSkeleton`, `GrowthNote`
  - `components/offices/MyOfficesView.tsx` — `MyOfficesView`
  - `components/offices/OfficesSkeletons.tsx` — `OfficesPageSkeleton`
  - `components/offices/ui.tsx` — `Atmosphere`, `OfficeEmblem`, `Pill`, `SectionHeading`, `joinedLabel`
- **Packages:**
  - `react` — `Suspense`, `useCallback`, `useEffect`, `useLayoutEffect`, `useMemo`, `useRef`, …
  - `next` — `usePathname`, `useRouter`, `useSearchParams`
  - `lucide-react` — `Loader2`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/select-organization` (page).
