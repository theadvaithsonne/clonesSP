# `components/events/site/EventVenueMap.tsx`

> Read-only venue map for the public event page (and the builder preview).

**Kind:** React component · **Lines:** 119 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Read-only venue map for the public event page (and the builder preview).

Renders the exact pin the organizer dropped in the wizard. Falls back to the
styled placeholder when there are no coordinates or no Mapbox token, so the
section never collapses to an empty box.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MapPin` (lucide-react)

### Props

- **`EventVenueMap`**: `coordinates?: { lat?: number; lng?: number }`, `label?: string`, `height?: number`, `variant?: "light" | "dark"`, `pinColor?: string`

**Hooks used:** `useRef`×2, `useEffect`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventVenueMap)` | component | `EventVenueMap({ coordinates, label, height = 320, variant = "dark", pinCo…)` | 16 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_MAPBOX_TOKEN`

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `mapbox-gl`
  - `lucide-react` — `MapPin`

## Used by

- `components/dashboard/inlineApps/events/EventDetailView.tsx`
- `components/events/site/EventSiteRenderer.tsx`
