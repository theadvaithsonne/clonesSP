# `components/dashboard/ReservesPanel.tsx`

> ReservesPanel — generic reserve-license tab content, mounted inside each item-type's page (Courses / Channels / Workshops / Calls).

**Kind:** React component · **Lines:** 1426 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
ReservesPanel — generic reserve-license tab content, mounted inside each
item-type's page (Courses / Channels / Workshops / Calls).

The buyer sees licenses they own for that item type, can filter by status,
and can assign an available license to another Garage user via email.

Visual language mirrors the existing UP reserve UI in WalletPageNew
(dark surfaces, no white borders, yellow accent on actions, status-themed
gradient icons + chips). Designed to drop in seamlessly.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence`×4 (framer-motion), `Send`×4 (lucide-react), `StatCard`×3 (local), `TicketCheck`×3 (lucide-react), `Loader2`×3 (lucide-react), `Mail`×2 (lucide-react), `XCircle`×2 (lucide-react), `X`×2 (lucide-react), `AlertCircle`×2 (lucide-react), `Check`×2 (lucide-react), `Building2`×2 (lucide-react), `IncomingOffersStrip` (local), `Filter` (lucide-react), `EmptyState` (local), `LicenseRow` (local), `AssignModal` (local), `ApproveOfferModal` (local), `Icon` (local), `Sparkles` (lucide-react), `CheckCircle2` (lucide-react), `Lock` (lucide-react), `DollarSign` (lucide-react), `Hourglass` (lucide-react), `Inbox` (lucide-react)

### Props

- **`ReservesPanel`**: `itemType: ItemReserveType`, `itemId?: string`, `copy?: { title?: string; // empty-state title, e.g. "No course reserv…`, `className?: string`

**Hooks used:** `useState`×18, `useMemo`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReservesPanel` | component | `ReservesPanel({ itemType, itemId, copy, className, }: ReservesPanelProps)` | 135 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getItemReserves`, `getItemReserveStats`, `assignItemReserve`, `listIncomingReserveOffers`, `listOutgoingReserveOffers`, `approveReserveOffer`, `rejectReserveOffer`, `cancelReserveOffer`, … +6
  - `lib/auth.ts` — `getOrgId`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Sparkles`, `Loader2`, `Package`, `CheckCircle2`, `Send`, `X`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/CallsPage.tsx`
- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/WorkshopsPage.tsx`
