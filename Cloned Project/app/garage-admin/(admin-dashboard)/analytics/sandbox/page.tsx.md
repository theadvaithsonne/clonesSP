# `app/garage-admin/(admin-dashboard)/analytics/sandbox/page.tsx`

> Reference sandbox for the analytics chart template — every state and edge case the components/analytics primitives are built to handle, side by side.

**Kind:** Next.js page · **Lines:** 382 · **Directive:** `"use client"` · **Route:** `/garage-admin/analytics/sandbox` (page)

<!-- docgen:auto -->

## Purpose
Reference sandbox for the analytics chart template — every state and
edge case the components/analytics primitives are built to handle,
side by side. This is what the developer wiring real APIs should look
at before writing a single fetch call: it shows what LineChart/ChartCard
do with loading, error, empty, single/two-point, long (365pt, pannable),
negative, flat, and each unit + interval.

Deliberately not linked from the sidebar (see the report) — this is a
dev reference, not a product surface, but it must stay a real route.
Note for future edits: Next's App Router treats an underscore-prefixed
folder (`_sandbox`) as a PRIVATE folder excluded from routing entirely
(this repo already relies on that for app/garage-admin/(admin-dashboard)/
_stub/, a non-routed shared component) — so this route lives at
/garage-admin/analytics/sandbox, not /analytics/_sandbox.

Everything below is generated from a fixed reference instant, not […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Cell`×15 (local), `ChartCard`×15 (components/analytics/ChartCard.tsx), `Section`×6 (local), `Grid`×6 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AnalyticsSandboxPage)` | component | `AnalyticsSandboxPage()` | 82 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/analytics/ChartCard.tsx` — `ChartCard`
  - `components/analytics/mock.ts` — `bucketStarts`, `emptySeries`, `generateSeries`, `headlineFromSeries`, `seriesFromValues`
  - `components/analytics/types.ts` — `ChartInterval`, `DateRange`, `(types only)`
- **Packages:** none

## Used by

Entry: reached by the Next.js router at `/garage-admin/analytics/sandbox` (page).
