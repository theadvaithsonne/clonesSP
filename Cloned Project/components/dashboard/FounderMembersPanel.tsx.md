# `components/dashboard/FounderMembersPanel.tsx`

> FounderMembersPanel

**Kind:** React component · **Lines:** 634 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
FounderMembersPanel

Rebuilt version of the "Members" page inside Founder:Communities.
The prior implementation used raw <select> + <table>, filtered
client-side (so search only saw the current page), and never
surfaced the new subscription state fields (cancelling batch, LTV,
cancelledAt). This one:

  - Uses UI-kit primitives across the board (Card / Select / Table /
    Badge / Input).
  - Server-side search + bucket filter + pagination — so the numbers
    always agree with the counts and the founder can page through
    large channel rosters.
  - Filter chips wire to the BE's new `counts` bucket rollup, so
    "Active 42 · Cancelling 3 · Expired 12" reflects the whole
    channel roster, not just the current page. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×6 (components/ui/table.tsx), `TableCell`×6 (components/ui/table.tsx), `Users`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `Card`×2 (components/ui/card.tsx), `CardContent`×2 (components/ui/card.tsx), `SelectItem`×2 (components/ui/select.tsx), `Loader2`×2 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `X` (lucide-react), `Filter` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `UserCircle2` (lucide-react), `Badge` (components/ui/badge.tsx), `Calendar` (lucide-react), `DollarSign` (lucide-react), `MessageSquare` (lucide-react), `MessageSquareOff` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`FounderMembersPanel`**: `orgId: string | null`, `channels: Channel[]`

**Hooks used:** `useState`×10, `useEffect`×4, `useCallback`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderMembersPanel` | component | `FounderMembersPanel({ orgId, channels }: FounderMembersPanelProps)` | 139 |

## Interfaces

- **Timers / queues:** `setTimeout` at L171

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `lib/feed-api.ts` — `getChannelSubscribers`, `toggleMemberPosting`, `ChannelSubscriber`, `ChannelSubscriberBucketCounts`, `ChannelMembershipBucket`, `Channel`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Users`, `Search`, `X`, `Loader2`, `ChevronLeft`, `ChevronRight`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/ChannelsPage.tsx`
