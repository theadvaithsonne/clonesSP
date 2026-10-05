# `app/(dashboard)/tickets/[id]/page.tsx`

> Next.js page rendered at `/tickets/[id]`.

**Kind:** Next.js page · **Lines:** 394 · **Directive:** `"use client"` · **Route:** `/tickets/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `ArrowLeft`×2 (lucide-react), `Message`×2 (local), `AlertCircle` (lucide-react), `Link` (next/link), `X` (lucide-react), `Paperclip` (lucide-react), `Send` (lucide-react), `Sparkles` (lucide-react)

**Hooks used:** `useState`×7, `useRef`×2, `useParams` (next/navigation), `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TicketDetailPage)` | component | `TicketDetailPage()` | 33 |

## Interfaces

- **Timers / queues:** `setInterval` at L65

## Dependencies

- **Internal:**
  - `lib/api/tickets.ts` — `ticketsApi`, `uploadTicketFile`, `Ticket`, `TicketAttachment`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `next` — `useParams`, `useRouter`
  - `date-fns` — `format`
  - `lucide-react` — `AlertCircle`, `ArrowLeft`, `Loader2`, `Paperclip`, `Send`, `Sparkles`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/tickets/[id]` (page).
