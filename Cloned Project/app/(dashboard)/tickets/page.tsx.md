# `app/(dashboard)/tickets/page.tsx`

> Next.js page rendered at `/tickets`.

**Kind:** Next.js page · **Lines:** 209 · **Directive:** `"use client"` · **Route:** `/tickets` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link`×2 (next/link), `LifeBuoy` (lucide-react), `Plus` (lucide-react), `SkeletonRows` (local), `Sparkles` (lucide-react), `Row` (local), `Icon` (local), `AlertCircle` (lucide-react)

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TicketsListPage)` | component | `TicketsListPage()` | 44 |

## Interfaces

- **Timers / queues:** `setInterval` at L66

## Dependencies

- **Internal:**
  - `lib/api/tickets.ts` — `ticketsApi`, `Ticket`, `TicketStatus`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next`
  - `date-fns` — `format`
  - `lucide-react` — `AlertCircle`, `CheckCircle2`, `Circle`, `Clock`, `LifeBuoy`, `Loader2`, …

## Used by

Entry: reached by the Next.js router at `/tickets` (page).
