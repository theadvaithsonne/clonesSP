# `components/garage-admin/OneTimeAffiliatesFilterDrawer.tsx`

> Filter drawer for the One Time Affiliates table.

**Kind:** React component · **Lines:** 1072 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Filter drawer for the One Time Affiliates table. Same field-list →
per-field screen morph as NetworkChainSubsFilterDrawer, with the columns
Shorupan filters this page by:
  - Downline / Sponsor:      pick a person; table scopes to their tree
  - Location:                country ▸ state/territory ▸ city
  - NetworkChain Subscriber: Yes / No / Any     (tri-state)
  - Activation date:         preset or custom from/to
  - Joining date:            preset or custom from/to
  - Reserves / Assigned / Directs: count buckets

Backend contract — a query layer on the EXISTING table endpoint
GET /garage-admin/one-time-affiliates (no separate search route):
  ?rootUserId=<id>
  &country=india&state=karnataka&city=bangalore
  &isSubscriber=yes|no
  &activatedFrom=YYYY-MM-DD&activatedTo=YYYY-MM-DD […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `BucketScreen`×3 (local), `PickerField`×3 (local), `X`×2 (lucide-react), `DateScreen`×2 (local), `Icon`×2 (local), `OptionList`×2 (local), `Tick`×2 (local), `AnimatePresence` (framer-motion), `ArrowLeft` (lucide-react), `FieldList` (local), `DownlineScreen` (components/garage-admin/downline-scope.tsx), `LocationScreen` (local), `SubscriberScreen` (local), `ChevronRight` (lucide-react), `Search` (lucide-react)

### Props

- **`OneTimeAffiliatesFilterDrawer`**: `open: boolean`, `onClose: () => void`, `filters: OneTimeAffiliateFilters`, `onApply: (f: OneTimeAffiliateFilters) => void`, `locations?: LocationFacet[]`

**Hooks used:** `useState`×4, `useMemo`×4, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DownlinePerson` | export |  | 48 |
| `SubscriberFilter` | type |  | 50 |
| `LocationFacet` | interface | One distinct country ▸ state ▸ city triple present in the data, with the number of affiliates in it. | 57 |
| `OneTimeAffiliateFilters` | interface |  | 64 |
| `OneTimeAffiliatesFilterDrawer` | component | `OneTimeAffiliatesFilterDrawer({ open, onClose, filters, onApply, locations = [], }: { ope…)` | 123 |
| `hasAnyFilter` | function | `hasAnyFilter(f: OneTimeAffiliateFilters): boolean` — True when at least one filter would narrow the table. | 433 |
| `applyFiltersToQuery` | function | `applyFiltersToQuery(qs: URLSearchParams, f: OneTimeAffiliateFilters)` — Serialize the filters onto the table's existing query string. | 451 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/garage-admin/downline-scope.tsx` — `DownlineScreen`, `PersonAvatar`, `DownlinePerson`
  - `lib/countries.ts` — `COUNTRIES`, `flagEmoji`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `ArrowLeft`, `Calendar`, `CalendarPlus`, `Check`, `Globe`, `Layers`, …

## Used by

- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
