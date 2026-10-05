# `app/events/[id]/tickets/MyTicketsClient.tsx`

> "My tickets".

**Kind:** Next.js app-directory module (colocated) · **Lines:** 296 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"My tickets".

An attendee who lost the confirmation email still has the reference from the
checkout screen or their receipt. This trades that reference for the passes
on it, QR codes included.

Two fields rather than one, on purpose: a QR token is exactly what a door
scanner accepts and invoice numbers run in sequence, so a reference on its
own is not a secret. The email the booking was made with is what turns it
into one. The server applies the same rule and answers every miss with the
same message, so neither field can be used to probe for the other.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×2 (local), `CheckoutShell` (components/events/checkout/ui.tsx), `Link` (next/link), `ArrowLeft` (lucide-react), `Loader2` (lucide-react), `Search` (lucide-react), `TicketCard` (local), `TicketIcon` (lucide-react)

### Props

- **`MyTicketsClient`**: `slug: string`

**Hooks used:** `useState`×5

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MyTicketsClient)` | component | `MyTicketsClient({ slug }: { slug: string })` | 42 |

## Interfaces

- **External hosts mentioned in the code:** `api.qrserver.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/api.ts` — `lookupTickets`, `LookedUpTicket`
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `(types only)`
  - `components/events/checkout/ui.tsx` — `C`, `CheckoutShell`, `eventDateRange`, `eventLocation`, `money`
- **Packages:**
  - `react` — `useState`
  - `next`
  - `lucide-react` — `ArrowLeft`, `Loader2`, `Search`, `Ticket as TicketIcon`

## Used by

- `app/events/[id]/tickets/page.tsx`
