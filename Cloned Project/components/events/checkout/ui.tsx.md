# `components/events/checkout/ui.tsx`

> Shared chrome for the attendee checkout surfaces — the three-step ticket page and the post-payment confirmation page.

**Kind:** React component · **Lines:** 244 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shared chrome for the attendee checkout surfaces — the three-step ticket
page and the post-payment confirmation page.

These pages are light-themed on purpose. The rest of the product (and the
event landing page the buyer arrives from) is dark, but a checkout reads as
a receipt: the organizer's accent is the only colour that carries meaning,
so everything else is paper.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `React` (react)

### Props

- **`CheckoutShell`**: `event?: EventProgram | null`, `organizationIcon?: string`, `organizationName?: string`, `accent?: string`, `headerRight?: React.ReactNode`, `children: React.ReactNode`
- **`Stepper`**: `current: 1 | 2 | 3`, `onBack?: (step: 1 | 2) => void`, `accent?: string`
- **`SummaryRow`**: `label: React.ReactNode`, `value: React.ReactNode`, `tone?: "muted" | "green"`, `bold?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DEFAULT_ACCENT` | const | `= "#FACC15"` | 14 |
| `C` | const | `= { page: "#f2f2f4", card: "#ffffff", border: "#e6e6ea", borderSoft: "#efeff2", ink: "#15…` — Neutral palette, kept in one place so the two pages can't drift apart. | 17 |
| `money` | function | `money(amount: number, currency: string): string` | 30 |
| `eventDateRange` | function | `eventDateRange(event?: Pick<EventProgram, "startsAt" \| "endsAt">)` — "24 – 26 Mar 2026" — collapsed to one date when the event is single-day. | 44 |
| `eventLocation` | function | `eventLocation(event?: Pick<EventProgram, "venue">)` | 60 |
| `CheckoutShell` | component | `CheckoutShell({ event, organizationIcon, organizationName, accent = DEFAU…)` — Page frame: sticky brand bar, a white sheet, and the legal footer. | 67 |
| `Stepper` | component | `Stepper({ current, onBack, accent = DEFAULT_ACCENT, }: { current: 1…)` — 1-based index of the step the buyer is on. | 163 |
| `SummaryRow` | component | `SummaryRow({ label, value, tone, bold, }: { label: React.ReactNode; va…)` — One line of an order summary. | 220 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `(types only)`
- **Packages:**
  - `react`

## Used by

- `app/events/[id]/checkout/CheckoutClient.tsx`
- `app/events/[id]/registered/[token]/ConfirmationClient.tsx`
- `app/events/[id]/tickets/MyTicketsClient.tsx`
- `components/events/checkout/CheckoutIdentity.tsx`
- `components/events/checkout/FormFields.tsx`
