# `components/dashboard/inlineApps/events/EventsPurchases.tsx`

> Attendee-facing Events: Purchases — the tickets this user holds.

**Kind:** React component · **Lines:** 485 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Attendee-facing Events: Purchases — the tickets this user holds.

Paid orders come from the invoice feed (/api/invoices/my/list, the same one
as Garage Pay → Orders), kept to `event_ticket` lines, and each is resolved
to its passes through the public ticket lookup (invoice number + an
attendee's email). Orders the in-app checkout completed in this browser fill
the two gaps that lookup has (see pass-store): orders where the buyer is not
one of the attendees, and free registrations, which raise no invoice.

Opening a purchase shows its passes: QR code, ticket ID and the order.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Ticket`×4 (lucide-react), `EmptyPanel`×3 (components/dashboard/inlineApps/events/browse-ui.tsx), `SectionHeading`×3 (components/dashboard/inlineApps/events/browse-ui.tsx), `EventFlowView` (components/dashboard/inlineApps/events/EventFlowView.tsx), `ChevronRight` (lucide-react), `EventBar` (components/dashboard/inlineApps/events/browse-ui.tsx), `PassCard` (components/dashboard/inlineApps/events/EventPasses.tsx), `ExternalLink` (lucide-react), `EventCard` (components/dashboard/inlineApps/events/browse-ui.tsx), `CardSkeleton` (components/dashboard/inlineApps/events/browse-ui.tsx)

### Props

- **`EventsPurchases`**: `onDiscover?: () => void`

**Hooks used:** `useState`×4, `useAuthStore`×2 (store/authStore.tsx), `useRef`×2, `useEffect`×2, `useCallback`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventsPurchases)` | component | `EventsPurchases({ onDiscover }: { onDiscover?: () => void })` | 131 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/invoices/my/list?invoiceType=one_time&limit=${PAGE_SIZE}&skip=${skip}` (L76)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/utils.ts` — `cn`
  - `store/authStore.tsx` — `useAuthStore`
  - `components/dashboard/inlineApps/events/api.ts` — `lookupTickets`
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `(types only)`
  - `components/dashboard/inlineApps/events/browse-format.ts` — `dateRange`, `dayMonth`, `hasEnded`, `isLive`, `locationLabel`, `money`
  - `components/dashboard/inlineApps/events/browse-ui.tsx` — `CARD_GRID`, `CardSkeleton`, `EmptyPanel`, `EventBar`, `EventCard`, `OUTLINE_BUTTON`, `PAGE`, `SectionHeading`
  - `components/dashboard/inlineApps/events/EventPasses.tsx` — `PassCard`, `fetchPasses`, `Pass`
  - `components/dashboard/inlineApps/events/EventFlowView.tsx` — `EventFlowView (default)`
  - `components/dashboard/inlineApps/events/pass-store.ts` — `loadStoredOrders`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ChevronRight`, `ExternalLink`, `Ticket`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
