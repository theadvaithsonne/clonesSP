# `components/dashboard/founderGrid/orders/founderOrderCells.tsx`

> Cell renderers + formatters for the founder Orders grid (Communities and Digital Products today; the endpoint also serves courses and workshops).

**Kind:** React component · **Lines:** 321 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Cell renderers + formatters for the founder Orders grid (Communities and
Digital Products today; the endpoint also serves courses and workshops).

Split out of the column definitions (mirroring `liveStreams/
founderStreamCells.tsx`) so the table, the CSV export and the footer
strip all format the same invoice the same way — a row that reads
"₹4,999.00" and a CSV column that reads "4999" is the kind of mismatch
that turns into a support ticket.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Pill`×4 (local), `UserIcon` (lucide-react), `Building2` (lucide-react), `Repeat` (lucide-react), `DollarSign` (lucide-react)

### Props

- **`Pill`**: `className: string`, `children: ReactNode`
- **`InvoiceStatusBadge`**: `row: FounderChannelInvoiceRow`
- **`UserStatusBadge`**: `row: FounderItemUserRow`
- **`InvoiceNumberCell`**: `row: FounderChannelInvoiceRow`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GLASS_STYLE` | export |  | 30 |
| `formatMoney` | function | `formatMoney(amountMinor: number, currency: string): string` — Amounts on Invoice are stored in the smallest unit (paise/cents) — see invoice.model.ts:113. | 39 |
| `formatDate` | function | `formatDate(iso: string \| Date \| null \| undefined, opts?: Intl.DateTimeFormatOptions): string` | 51 |
| `formatDateTime` | function | `formatDateTime(iso: string \| Date \| null \| undefined): string` | 64 |
| `sumByCurrency` | function | `sumByCurrency(entries: Array<{ amount: number; currency: string \| null }>): string` — Money totals across rows that may not share a currency. | 85 |
| `statusBadgeClass` | function | `statusBadgeClass(status: ChannelInvoiceStatus): string` — Invoice status → badge colour. | 109 |
| `userStatusBadgeClass` | function | `userStatusBadgeClass(status: FounderItemUserRow["status"]): string` | 128 |
| `Pill` | component | `Pill({ className, children, }: { className: string; children: Re…)` — A pill. `whitespace-nowrap` is load-bearing — the cell clips its overflow, and a wrapped label would render twice as tall as every other row's. | 148 |
| `InvoiceStatusBadge` | component | `InvoiceStatusBadge({ row }: { row: FounderChannelInvoiceRow })` | 164 |
| `UserStatusBadge` | component | `UserStatusBadge({ row }: { row: FounderItemUserRow })` | 181 |
| `InvoiceNumberCell` | component | `InvoiceNumberCell({ row }: { row: FounderChannelInvoiceRow })` | 187 |
| `CustomerCell` | component | `CustomerCell({ name, email, picture, }: { name: string \| null; email: st…)` — The buyer. No profile picture on the invoice row, so the icon tile is the avatar — same frosted tile the Live Streams grid falls back to. | 205 |
| `ItemCell` | component | `ItemCell({ title }: { title: string \| null })` — The thing that was bought — a community, a digital product, a course. | 241 |
| `TypeCell` | component | `TypeCell({ row }: { row: FounderChannelInvoiceRow })` | 252 |
| `AmountCell` | component | `AmountCell({ row }: { row: FounderChannelInvoiceRow })` | 266 |
| `CreatedCell` | component | `CreatedCell({ row }: { row: FounderChannelInvoiceRow })` | 283 |
| `Bar` | component | `Bar({ w, h = "h-3.5", dim, rounded = "rounded", }: { w: string;…)` — One shimmer bar. `w` is a Tailwind width class so the skeleton can echo the rough length of the text it stands in for. | 302 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `ChannelInvoiceStatus`, `FounderChannelInvoiceRow`, `FounderItemUserRow`, `(types only)`
  - `components/dashboard/founderGrid/tokens.ts` — `GLASS_STYLE`
- **Packages:**
  - `react` — `ReactNode`
  - `lucide-react` — `Building2`, `DollarSign`, `Repeat`, `User as UserIcon`

## Used by

- `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx`
- `components/dashboard/founderGrid/orders/founderOrderColumns.tsx`
