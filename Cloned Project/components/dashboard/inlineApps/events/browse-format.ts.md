# `components/dashboard/inlineApps/events/browse-format.ts`

> Formatting shared by the attendee-facing Events pages: Discover, the event page and Purchases.

**Kind:** React component · **Lines:** 195

<!-- docgen:auto -->

## Purpose
Formatting shared by the attendee-facing Events pages: Discover, the event
page and Purchases.

Dates are written day-first ("12–14 Nov 2026") to match the design. Month
names come from en-US on purpose: en-GB abbreviates September to "Sept",
which breaks the three-letter rhythm of the card labels.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `isLive` | function | `isLive(e: Timed, now = Date.now())` | 20 |
| `hasEnded` | function | `hasEnded(e: Timed, now = Date.now())` | 26 |
| `dayMonth` | function | `dayMonth(iso: string)` — "28 Oct" — card labels uppercase it in CSS. | 31 |
| `dateRange` | function | `dateRange(startIso: string, endIso?: string, style: "short" \| "long" = "short")` — "12–14 Nov 2026", "30 Oct – 2 Nov 2026", or a single date for a one-day event. | 41 |
| `timeToGo` | function | `timeToGo(e: Timed, now = Date.now())` — "48 days to go", counted in calendar days rather than 24-hour blocks. | 60 |
| `endOfWeek` | function | `endOfWeek(now = new Date())` — Last moment of the current Monday–Sunday week, local time. | 74 |
| `overlaps` | function | `overlaps(e: Timed, from: Date, to: Date)` — Whether the event runs at any point inside [from, to]. | 82 |
| `DateFilter` | type |  | 89 |
| `matchesDate` | function | `matchesDate(e: Timed, filter: DateFilter, now = new Date())` | 91 |
| `placeName` | function | `placeName(e: Pick<EventProgram, "venue">)` — "BIEC, Bengaluru" — the venue and its city, without repeating either. | 113 |
| `locationLabel` | function | `locationLabel(e: Pick<EventProgram, "venue" \| "format">, variant: "card" \| "full" = "card")` — Where the event happens. | 127 |
| `money` | function | `money(amount: number, currency = "USD")` — "$299" / "₹2,499". Narrow symbols, because several locales write USD as "US$", which the price labels have no room for. | 146 |
| `fromPriceLabel` | function | `fromPriceLabel(fromPrice: number \| null, currency: string)` — "From $120" / "Free", or null when the event has no admission tier yet. | 160 |
| `clock` | function | `clock(iso: string)` — "09:30" — the agenda reads in 24-hour time. | 166 |
| `durationLabel` | function | `durationLabel(startIso: string, endIso: string)` | 171 |
| `dayKey` | function | `dayKey(iso: string)` — Local calendar day, so a 23:30 session doesn't land on tomorrow's tab. | 181 |
| `dayCount` | function | `dayCount(e: Timed)` — Inclusive number of calendar days the event covers. | 187 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
- `components/dashboard/inlineApps/events/EventDetailView.tsx`
- `components/dashboard/inlineApps/events/EventsBrowse.tsx`
- `components/dashboard/inlineApps/events/EventsPurchases.tsx`
