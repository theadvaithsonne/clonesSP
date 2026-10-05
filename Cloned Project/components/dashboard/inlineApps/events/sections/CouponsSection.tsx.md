# `components/dashboard/inlineApps/events/sections/CouponsSection.tsx`

> Coupons that apply to this event.

**Kind:** React component · **Lines:** 132 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Coupons that apply to this event.

Read-only on purpose. Events do not own a discount system — coupons are the
org's existing coupons (routes/founderCoupons.ts) with
`applicableTo: ["event_ticket"]`, and they are created and edited on the
Coupons surface. Duplicating that CRUD here would give founders two places to
manage one thing, and two places for the rules to drift.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `EmptyState` (components/dashboard/inlineApps/events/ui.tsx), `Percent` (lucide-react), `Button` (components/dashboard/inlineApps/events/ui.tsx), `ExternalLink` (lucide-react), `Card` (components/dashboard/inlineApps/events/ui.tsx)

### Props

- **`CouponsSection`**: `eventId: string`, `eventName: string`, `onManageCoupons?: () => void`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CouponsSection)` | component | `CouponsSection({ eventId, eventName, onManageCoupons, }: { eventId: string…)` | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `Card`, `EmptyState`, `GOLD`
  - `components/dashboard/inlineApps/events/api.ts` — `listEventCoupons`, `OrgCoupon`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `ExternalLink`, `Loader2`, `Percent`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
