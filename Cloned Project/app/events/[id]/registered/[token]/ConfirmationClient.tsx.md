# `app/events/[id]/registered/[token]/ConfirmationClient.tsx`

> The post-checkout receipt.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 436 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The post-checkout receipt.

Reached from the checkout page once the registration exists — after payment
settles for a paid ticket, immediately for a free or approval-gated one.
The live status comes from the public ticket endpoint; the money comes from
the order the checkout cached for this tab (see orderCache), because the
public endpoint deliberately doesn't expose pricing to anyone holding a QR
token. No cache (a link opened on another device) simply hides the order
block — everything else still renders.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link`×4 (next/link), `SummaryRow`×4 (components/events/checkout/ui.tsx), `CheckoutShell`×3 (components/events/checkout/ui.tsx), `NextCard`×3 (local), `XCircle` (lucide-react), `Loader2` (lucide-react), `Clock3` (lucide-react), `Check` (lucide-react), `QrCode` (lucide-react), `CalendarPlus` (lucide-react), `Share2` (lucide-react), `ShareEventModal` (components/events/ShareEventModal.tsx)

### Props

- **`ConfirmationClient`**: `slug: string`, `token: string`

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ConfirmationClient)` | component | `ConfirmationClient({ slug, token, }: { slug: string; token: string; })` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/api.ts` — `getTicket`, `ticketCalendarUrl`
  - `components/events/checkout/ui.tsx` — `C`, `CheckoutShell`, `DEFAULT_ACCENT`, `SummaryRow`, `eventDateRange`, `money`
  - `components/events/checkout/orderCache.ts` — `loadOrder`, `CachedOrder`
  - `components/events/ShareEventModal.tsx` — `ShareEventModal (default)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next`
  - `lucide-react` — `CalendarPlus`, `Check`, `Clock3`, `Copy`, `Loader2`, `QrCode`, …

## Used by

- `app/events/[id]/registered/[token]/page.tsx`
