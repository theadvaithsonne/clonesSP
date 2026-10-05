# `components/dashboard/inlineApps/events/EventPasses.tsx`

> An order's passes, as the attendee carries them: one card per person with the QR the door scans, who it's for, the pass type and the ticket ID.

**Kind:** React component · **Lines:** 141 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
An order's passes, as the attendee carries them: one card per person with
the QR the door scans, who it's for, the pass type and the ticket ID.

Shown straight after checkout and again from Purchases. The QR encodes the
public ticket page rather than the raw token — the same choice the ticket
page makes — so any phone camera at the door lands on the live status.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CheckCircle2` (lucide-react), `Clock3` (lucide-react), `XCircle` (lucide-react), `CalendarPlus` (lucide-react), `ExternalLink` (lucide-react)

### Props

- **`PassCard`**: `slug: string`, `pass: Pass`

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Pass` | type | What a pass card needs — the lookup and the ticket endpoint both return it. | 17 |
| `ticketId` | function | `ticketId(token: string)` — Ticket IDs are the token's leading characters — what the lookup accepts. | 23 |
| `fetchPasses` | function | `async fetchPasses(tokens: string[])` — Resolves passes by token, for an order this browser just placed. | 32 |
| `PassCard` | component | `PassCard({ slug, pass }: { slug: string; pass: Pass })` | 53 |

## Interfaces

- **External hosts mentioned in the code:** `api.qrserver.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/api.ts` — `getTicket`, `ticketCalendarUrl`, `LookedUpTicket`
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `(types only)`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `CalendarPlus`, `CheckCircle2`, `Clock3`, `ExternalLink`, `XCircle`

## Used by

- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
- `components/dashboard/inlineApps/events/EventsPurchases.tsx`
