# `components/garage-admin/member-profile-view.tsx`

> Shared member-profile view — ONE implementation rendered by three garage admin row→detail routes: One Time Affiliates, Users, and NetworkChain Subs.

**Kind:** React component · **Lines:** 1819 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shared member-profile view — ONE implementation rendered by three garage
admin row→detail routes: One Time Affiliates, Users, and NetworkChain Subs.
Each route mounts <MemberProfileView params={params} backLabel="…" />; the
only per-list difference is the breadcrumb label. Everything else (Move
Upline, Saved Cards, the tabs, columns, padding) is common, so teammate
changes land in one place. Header (identity + upline + location) + tabs of
what the member bought/joined: Offices, Communities, Live Streams, Courses,
Digital Products, Purchases, Saved Cards. Data via
lib/affiliate/downline-profile-api.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×9 (local), `ActionButton`×5 (local), `DataTable`×5 (components/data-table/DataTable.tsx), `ChevronLeft`×2 (lucide-react), `SwitcherPill`×2 (local), `SelectViewDrawer`×2 (components/downline/select-view-drawer.tsx), `ChevronRight`×2 (lucide-react), `DownlineQueryProvider` (components/downline/downline-query-provider.tsx), `MemberProfileViewInner` (local), `ArrowUpFromLine` (lucide-react), `WhatsAppIcon` (local), `Check` (lucide-react), `Share2` (lucide-react), `Mail` (lucide-react), `Phone` (lucide-react), `MemberActivityChart` (components/garage-admin/MemberActivityChart.tsx), `AdminSavedCardsPanel` (components/admin/AdminSavedCardsPanel.tsx), `CommunityDetailDrawer` (components/downline/community-detail-drawer.tsx), `SpeakersDrawer` (components/downline/speakers-drawer.tsx), `MoveUplineDialog` (components/admin/MoveUplineDialog.tsx), `Icon` (local), `ChevronDown` (lucide-react), `ExternalLink` (lucide-react)

### Props

- **`MemberProfileView`**: `params: Promise<{ userId: string }>`, `backLabel: string`

**Hooks used:** `useState`×11, `useMemo`×5, `useQuery`×4 (@tanstack/react-query), `useRouter` (next/navigation), `useAdminAccess` (components/garage-admin/use-admin-access.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MemberProfileView` | component | `MemberProfileView({ params, backLabel, }: { params: Promise<{ userId: string …)` | 266 |

## Interfaces

- **Timers / queues:** `setTimeout` at L441
- **External hosts mentioned in the code:** `wa.me`

## Dependencies

- **Internal:**
  - `components/garage-admin/MemberActivityChart.tsx` — `MemberActivityChart`
  - `components/downline/speakers-drawer.tsx` — `SpeakersDrawer`, `SpeakersDrawerState`
  - `lib/affiliate/downline-livestreams-api.ts` — `fetchMemberLiveStreams`, `fetchMemberLiveStreamSessions`, `MemberLiveStreamRow`
  - `components/admin/MoveUplineDialog.tsx` — `MoveUplineDialog`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `lib/admin-api/users.ts` — `AdminUplineRef`, `(types only)`
  - `components/admin/AdminSavedCardsPanel.tsx` — `AdminSavedCardsPanel`
  - `components/downline/community-detail-drawer.tsx` — `CommunityDetailDrawer`, `CommunityDrawer`
  - `components/downline/select-view-drawer.tsx` — `SelectViewDrawer`, `ViewOption`
  - `components/downline/profile-icons.tsx` — `OfficesIcon`, `CommunitiesIcon`, `LiveStreamsIcon`, `CoursesIcon`, `DigitalProductsIcon`, `PurchasesIcon`, `DigitalModeIcon`
  - `components/downline/downline-query-provider.tsx` — `DownlineQueryProvider`
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/types.ts` — `ColumnDef`, `SortState`, `(types only)`
  - `lib/affiliate/downline-profile-api.ts` — `fetchMemberProfile`, `fetchMemberTab`, `MemberOffice`, `MemberPurchaseItem`, `MemberPhysicalOrderItem`, `MemberCommunityItem`, `MemberTabCategory`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `lib/countries.ts` — `COUNTRIES`
- **Packages:**
  - `react` — `use`, `useMemo`, `useState`
  - `next` — `useRouter`
  - `@tanstack/react-query` — `useQuery`, `keepPreviousData`
  - `lucide-react` — `Phone`, `Mail`, `Share2`, `Check`, `ChevronDown`, `ChevronLeft`, …

## Used by

- `app/garage-admin/(admin-dashboard)/networkchain-subs/[userId]/page.tsx`
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/[userId]/page.tsx`
- `app/garage-admin/(admin-dashboard)/users/[userId]/page.tsx`

## Notes

- Large file (1819 lines) — read it by section; line numbers above point into it.
