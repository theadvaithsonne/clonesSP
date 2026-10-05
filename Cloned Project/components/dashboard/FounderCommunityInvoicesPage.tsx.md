# `components/dashboard/FounderCommunityInvoicesPage.tsx`

> FounderInvoicesPage

**Kind:** React component · **Lines:** 1554 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
FounderInvoicesPage

Shared founder-facing invoice list, parameterised by `itemType`:
`channel` (Communities), `workshop` (Live Streams), `course` (Courses),
or `product` (Digital Products). Renders identical UI across all four
— filters, table columns, pagination — with only the labels + item
dropdown swapped.

BE: GET /feed/founder/invoices?orgId=&itemType=&... (feed.ts,
founder-gated). Response includes per-page invoices, total count for
pagination, and a flat `items[]` list that populates the item-filter
dropdown without a second call.

Per-type wrappers pin the `itemType` + `itemLabel` props:
  - FounderCommunityOrdersPage → itemType="channel"
  - FounderLiveOrdersPage      → itemType="workshop" […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×14 (components/ui/table.tsx), `TableCell`×14 (components/ui/table.tsx), `SelectItem`×9 (components/ui/select.tsx), `Select`×7 (components/ui/select.tsx), `SelectTrigger`×7 (components/ui/select.tsx), `SelectValue`×7 (components/ui/select.tsx), `SelectContent`×7 (components/ui/select.tsx), `Input`×6 (components/ui/input.tsx), `X`×4 (lucide-react), `UsersIcon`×4 (lucide-react), `FileText`×4 (lucide-react), `TableRow`×4 (components/ui/table.tsx), `Loader2`×3 (lucide-react), `Filter`×2 (lucide-react), `Search`×2 (lucide-react), `TabsTrigger`×2 (components/ui/tabs.tsx), `TabsContent`×2 (components/ui/tabs.tsx), `Table`×2 (components/ui/table.tsx), `TableHeader`×2 (components/ui/table.tsx), `TableBody`×2 (components/ui/table.tsx), `UserIcon`×2 (lucide-react), `Badge`×2 (components/ui/badge.tsx), `ChevronLeft`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `Tabs` (components/ui/tabs.tsx), `TabsList` (components/ui/tabs.tsx), `Button` (components/ui/button.tsx), `Download` (lucide-react), `Building2` (lucide-react), `Repeat` (lucide-react), `DollarSign` (lucide-react), `Link` (next/link), `ExternalLink` (lucide-react), `UserActivityOverlay` (components/dashboard/UserActivityOverlay.tsx)

### Props

- **`FounderInvoicesPage`**: `itemType: FounderInvoiceItemType`, `itemLabel: string`, `itemLabelPlural: string`, `initialTab?: "invoices" | "users"`, `hideTabs?: boolean`

**Hooks used:** `useState`×15, `useEffect`×7, `useMemo`×4, `useCallback`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderInvoicesPage` | component | `FounderInvoicesPage({ itemType, itemLabel, itemLabelPlural, initialTab = "invoi…)` | 287 |

## Interfaces

- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L391, L492

## Dependencies

- **Internal:**
  - `lib/csvExport.ts` — `exportRowsAsCsv`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getFounderInvoices`, `getFounderItemUsers`, `FounderChannelInvoiceRow`, `FounderInvoicesFilters`, `FounderInvoiceItemType`, `ChannelInvoiceStatus`, `FounderItemUserRow`, `FounderItemUsersFilters`, … +1
  - `components/dashboard/UserActivityOverlay.tsx` — `UserActivityOverlay`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `next`
  - `lucide-react` — `FileText`, `Search`, `X`, `Loader2`, `ExternalLink`, `ChevronLeft`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Large file (1554 lines) — read it by section; line numbers above point into it.
