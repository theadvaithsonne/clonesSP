# `components/dashboard/UserActivityOverlay.tsx`

> UserActivityOverlay

**Kind:** React component · **Lines:** 976 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
UserActivityOverlay

Full-viewport overlay that renders on top of the current founder
dashboard page. Opens when a founder clicks a row on the "Users" tab
of any of the four Orders pages (Communities / Live / Courses /
Products). Contents branch on `itemType`:

  - itemType === "channel": three sub-tabs — Communities (from
    ChannelMembership), Invoices, Events (from ChannelMembershipEvent).
  - other itemTypes: two sub-tabs — {ItemLabel}s (grouped from
    invoices), Invoices. No events tab (only communities carry a
    membership event log today).

All data comes from `/feed/founder/user-detail`, so the overlay makes
exactly one round-trip on open. Filters inside the sub-tabs operate
on the already-fetched data — no additional server round-trips.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×25 (components/ui/table.tsx), `TableCell`×25 (components/ui/table.tsx), `SelectItem`×20 (components/ui/select.tsx), `TableRow`×8 (components/ui/table.tsx), `Select`×5 (components/ui/select.tsx), `SelectTrigger`×5 (components/ui/select.tsx), `SelectValue`×5 (components/ui/select.tsx), `SelectContent`×5 (components/ui/select.tsx), `Building2`×4 (lucide-react), `Table`×4 (components/ui/table.tsx), `TableHeader`×4 (components/ui/table.tsx), `TableBody`×4 (components/ui/table.tsx), `Badge`×4 (components/ui/badge.tsx), `TabsTrigger`×3 (components/ui/tabs.tsx), `TabsContent`×3 (components/ui/tabs.tsx), `UserIcon`×2 (lucide-react), `FileText`×2 (lucide-react), `Input`×2 (components/ui/input.tsx), `Mail` (lucide-react), `X` (lucide-react), `DollarSign` (lucide-react), `Calendar` (lucide-react), `Loader2` (lucide-react), `Tabs` (components/ui/tabs.tsx), `TabsList` (components/ui/tabs.tsx), `Activity` (lucide-react), `Repeat` (lucide-react), `BadgeCheck` (lucide-react), `XCircle` (lucide-react), `Link` (next/link), `ExternalLink` (lucide-react)

### Props

- **`UserActivityOverlay`**: `orgId: string`, `itemType: FounderInvoiceItemType`, `itemLabel: string`, `itemLabelPlural: string`, `userId: string`, `onClose: () => void`

**Hooks used:** `useState`×10, `useMemo`×4, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UserActivityOverlay` | component | `UserActivityOverlay({ orgId, itemType, itemLabel, itemLabelPlural, userId, onCl…)` | 156 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getFounderUserDetail`, `FounderInvoiceItemType`, `FounderUserDetailResponse`, `FounderUserDetailChannelItem`, `FounderUserDetailPurchasedItem`, `FounderUserDetailInvoice`, `ChannelInvoiceStatus`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `next`
  - `lucide-react` — `X`, `Loader2`, `ExternalLink`, `User as UserIcon`, `Building2`, `FileText`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/FounderCommunityInvoicesPage.tsx`
- `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx`
