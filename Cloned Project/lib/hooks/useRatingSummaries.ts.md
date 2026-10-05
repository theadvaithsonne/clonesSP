# `lib/hooks/useRatingSummaries.ts`

> React hook `useRatingSummaries`.

**Kind:** React hook · **Lines:** 53

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useRatingSummaries` | hook | `useRatingSummaries(targetType: ReviewTargetType, ids: string[]): Record<string, RatingSummary>` — Rating summaries for a grid of cards, fetched in ONE batched request rather than one per card. | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/reviews-api.ts` — `getRatingSummaries`, `RatingSummary`, `ReviewTargetType`
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
