# `components/dashboard/liveStreams/founderStreamCells.tsx`

> Cell renderers for the founder Live Streams grid.

**Kind:** React component · **Lines:** 540 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Cell renderers for the founder Live Streams grid.

Split out of the column definitions so the table, the CSV export and the
options drawer can all render the same badge for the same status — a row
that says "Completed" and a drawer that offers "Start" is the kind of
contradiction that costs a founder a live session.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar`×2 (local), `Icon` (local), `Video` (lucide-react), `CommunityLine` (local)

### Props

- **`StatusBadge`**: `status: FounderStreamStatus`
- **`Avatar`**: `src?: string | null`, `name?: string | null`, `className?: string`, `rounded?: string`
- **`StreamThumb`**: `src?: string`, `title: string`
- **`Stack`**: `lines: Array<{ text: string; tone?: "primary" | "money" | "muted" } |…`

**Hooks used:** `useState`×4, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `formatUsd` | function | `formatUsd(amount: number): string` | 20 |
| `formatPrice` | function | `formatPrice(amount: number, currency: string): string` — Money in the stream's own currency — the Payment column shows what the buyer is actually charged, not a USD conversion of it. | 29 |
| `currencyFlag` | function | `currencyFlag(currency: string): string` | 50 |
| `formatLongDate` | function | `formatLongDate(iso: string): string` — "Tuesday, March 10th 2026" — the first line of the Date/Time cell. | 56 |
| `formatShortDate` | function | `formatShortDate(iso: string): string` — "Mar 10" — the compact form used inside a recurrence rule. | 66 |
| `formatClock` | function | `formatClock(hhmm: string): string` — "7:00 PM" from a stored "19:00". | 79 |
| `timezoneAbbr` | function | `timezoneAbbr(tz: string, at?: string \| Date): string` — The short zone label for a stream ("IST", "EST", "BST"). | 202 |
| `formatDuration` | function | `formatDuration(startTime: string, endTime: string): string` — "1 hr", "90 min" — the window length, for the recurring Date/Time line. | 232 |
| `statusMeta` | function | `statusMeta(status: FounderStreamStatus)` — The label/icon/tone behind a status, for anything that needs to render one outside a table cell (the recurring view's series header chip). | 264 |
| `StatusBadge` | component | `StatusBadge({ status }: { status: FounderStreamStatus })` | 268 |
| `GLASS_STYLE` | const | `= { backgroundColor: "rgba(255,255,255,0.055)", backgroundImage: "linear-gradient(135deg,…` — Frosted grey surface for anything with no image of its own — a host with no profile picture, a stream with no cover art. | 306 |
| `Avatar` | component | `Avatar({ src, name, className = "h-9 w-9", rounded = "rounded-full…)` | 315 |
| `StreamThumb` | component | `StreamThumb({ src, title }: { src?: string; title: string })` — Stream thumbnail — falls back to the same frosted grey tile with a muted video glyph, rather than a broken image or a coloured block. | 350 |
| `Stack` | component | `Stack({ lines, }: { lines: Array<{ text: string; tone?: "primary"…)` — The two- and three-line money/count stacks columns 11–15 all use. | 375 |
| `CommunitiesCell` | component | `CommunitiesCell({ row }: { row: FounderStreamRow })` — The communities a stream is published to. | 425 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/country-flag.ts` — `getCountryFlag`
  - `lib/feed-api.ts` — `FounderStreamRow`, `FounderStreamStatus`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`, `CSSProperties`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Activity`, `CheckCircle2`, `Hourglass`, `Trash2`, `Video`

## Used by

- `components/dashboard/liveStreams/FounderLiveStreamsTable.tsx`
- `components/dashboard/liveStreams/SeriesHeaderBar.tsx`
- `components/dashboard/liveStreams/SwitchViewPanel.tsx`
- `components/dashboard/liveStreams/founderStreamColumns.tsx`
