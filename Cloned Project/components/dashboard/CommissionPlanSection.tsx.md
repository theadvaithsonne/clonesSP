# `components/dashboard/CommissionPlanSection.tsx`

> React components `CommissionPlanSection`, `CompPlanDisplay`, `CompPlanBadge`.

**Kind:** React component · **Lines:** 1212 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Users`×6 (lucide-react), `Percent`×5 (lucide-react), `ChevronDown`×3 (lucide-react), `Input`×3 (components/ui/input.tsx), `ChevronUp`×2 (lucide-react), `Info`×2 (lucide-react), `Switch` (components/ui/switch.tsx), `X` (lucide-react), `Plus` (lucide-react), `Lock` (lucide-react)

### Props

- **`CommissionPlanSection`**: `itemType: "course" | "product" | "channel" | "workshop" | "service" |…`, `itemId?: string`, `itemName: string`, `isPaid?: boolean`, `onPlanCreated?: (plan: CombPlan) => void`, `className?: string`
- **`CompPlanDisplay`**: `itemType: "course" | "product" | "channel" | "workshop" | "service" |…`, `itemId: string`, `className?: string`
- **`CompPlanBadge`**: `itemType: "course" | "product" | "channel" | "workshop" | "service" |…`, `itemId: string`, `price?: number`, `currency?: string`, `isFounder?: boolean`, `usePublicApi?: boolean`, `className?: string`

**Hooks used:** `useState`×15, `useEffect`×7, `useRef`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CommissionPlanSection` | component | `CommissionPlanSection({ itemType, itemId, itemName, isPaid, onPlanCreated, classN…)` | 40 |
| `saveCommissionPlan` | function | `async saveCommissionPlan(itemId: string): Promise<CombPlan \| null>` | 608 |
| `CompPlanDisplay` | component | `CompPlanDisplay({ itemType, itemId, className, }: CompPlanDisplayProps)` | 626 |
| `CompPlanBadge` | component | `CompPlanBadge({ itemType, itemId, price, currency = "$", isFounder = fals…)` | 851 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/switch.tsx` — `Switch`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `CombPlanLevel`, `CombPlan`, `CombPlanKind`, `createCombPlan`, `updateCombPlan`, `getCombPlanForItem`, `getCombPlanForItemPublic`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Plus`, `Trash2`, `ChevronDown`, `ChevronUp`, `Users`, `Percent`, …
  - `sonner` — `toast`

## Used by

- `app/guest/[slug]/GuestOfficePage.tsx`
- `components/dashboard/CallsPage.tsx`
- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/ServiceFormModal.tsx`
- `components/dashboard/ServicesPage.tsx`
- `components/dashboard/WorkshopsPage.tsx`
- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
- `components/dashboard/inlineApps/events/sections/TicketsSection.tsx`
