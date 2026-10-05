# `app/(dashboard)/tickets/new/page.tsx`

> Next.js page rendered at `/tickets/new`.

**Kind:** Next.js page · **Lines:** 252 · **Directive:** `"use client"` · **Route:** `/tickets/new` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link`×2 (next/link), `Loader2`×2 (lucide-react), `ArrowLeft` (lucide-react), `ImageIcon` (lucide-react), `X` (lucide-react), `Paperclip` (lucide-react)

**Hooks used:** `useState`×6, `useRouter` (next/navigation), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NewTicketPage)` | component | `NewTicketPage()` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api/tickets.ts` — `ticketsApi`, `uploadTicketFile`, `TicketAttachment`, `TicketPriority`
- **Packages:**
  - `react` — `useRef`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `ArrowLeft`, `ImageIcon`, `Loader2`, `Paperclip`, `X`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/tickets/new` (page).
