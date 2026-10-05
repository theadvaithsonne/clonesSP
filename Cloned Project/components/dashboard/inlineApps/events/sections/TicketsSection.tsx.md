# `components/dashboard/inlineApps/events/sections/TicketsSection.tsx`

> Tickets and add-ons.

**Kind:** React component · **Lines:** 780 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Tickets and add-ons.

Both are rows in `event_ticket_tiers`, separated by `kind`. They share the
inventory counter, the sales window, the pricing rules and the checkout
path — the only real difference is where a buyer meets them, so giving
add-ons their own collection would have meant maintaining two of everything.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/dashboard/inlineApps/events/ui.tsx), `TextInput`×3 (components/dashboard/inlineApps/events/ui.tsx), `TextArea`×2 (components/dashboard/inlineApps/events/ui.tsx), `DateTimeField`×2 (components/dashboard/inlineApps/events/DateTimeField.tsx), `CapacityMeter` (components/dashboard/inlineApps/events/ui.tsx), `RegistrationFormBuilder` (components/dashboard/inlineApps/events/sections/RegistrationFormBuilder.tsx), `Loader2` (lucide-react), `EmptyState` (components/dashboard/inlineApps/events/ui.tsx), `PackagePlus` (lucide-react), `Ticket` (lucide-react), `Plus` (lucide-react), `Card` (components/dashboard/inlineApps/events/ui.tsx), `GripVertical` (lucide-react), `Play` (lucide-react), `Pause` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `Modal` (components/dashboard/inlineApps/events/ui.tsx), `Select` (components/dashboard/inlineApps/events/ui.tsx), `CommissionPlanSection` (components/dashboard/CommissionPlanSection.tsx), `Toggle` (components/dashboard/inlineApps/events/ui.tsx)

### Props

- **`TicketsSection`**: `eventId: string`, `capacity?: number`, `onChanged?: () => void`

**Hooks used:** `useState`×9, `useEffect`×2, `useConfirm` (components/dashboard/inlineApps/events/ui.tsx), `useMemo`, `useCallback`, `useConsoleAction` (components/dashboard/inlineApps/events/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TicketsSection)` | component | `TicketsSection({ eventId, capacity, onChanged, }: { eventId: string; /** T…)` | 150 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `CapacityMeter`, `Card`, `EmptyState`, `GOLD`, `Modal`, `Select`, `TextArea`, … +7
  - `components/dashboard/CommissionPlanSection.tsx` — `CommissionPlanSection`, `saveCommissionPlan`
  - `lib/feed-api.ts` — `getCombPlanForItem`
  - `components/dashboard/inlineApps/events/DateTimeField.tsx` — `DateTimeField (default)`
  - `components/dashboard/inlineApps/events/sections/RegistrationFormBuilder.tsx` — `RegistrationFormBuilder (default)`
  - `components/dashboard/inlineApps/events/api.ts` — `createTicket`, `deleteTicket`, `listTickets`, `reorderTickets`, `updateTicket`
  - `components/dashboard/inlineApps/events/types.ts` — `TicketTier`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `GripVertical`, `Loader2`, `PackagePlus`, `Pause`, `Pencil`, `Play`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
