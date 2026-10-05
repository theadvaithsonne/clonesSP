# `app/events/[id]/ticket/[token]/TicketClient.tsx`

> React component `TicketClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 234 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `XCircle`×2 (lucide-react), `Loader2` (lucide-react), `Link` (next/link), `Clock3` (lucide-react), `CheckCircle2` (lucide-react), `CalendarDays` (lucide-react), `Clock` (lucide-react), `MapPin` (lucide-react), `CalendarPlus` (lucide-react)

### Props

- **`TicketClient`**: `slug: string`, `token: string`

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TicketClient)` | component | `TicketClient({ slug, token, }: { slug: string; token: string; })` | 31 |

## Interfaces

- **External hosts mentioned in the code:** `api.qrserver.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/api.ts` — `getTicket`, `ticketCalendarUrl`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next`
  - `lucide-react` — `Loader2`, `CalendarPlus`, `MapPin`, `CalendarDays`, `Clock`, `CheckCircle2`, …

## Used by

- `app/events/[id]/ticket/[token]/page.tsx`
