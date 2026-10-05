# `components/dashboard/inlineApps/events/VenuePicker.tsx`

> Venue details with a real, interactive map.

**Kind:** React component · **Lines:** 669 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Venue details with a real, interactive map.

The map is the primary input, not decoration: searching, clicking the map,
dragging the pin or hitting "Use my location" all reverse-geocode and fill
the address fields, and editing the fields by hand re-locates the pin.
Whatever the founder ends up with, `coordinates` is saved alongside the text
— the public page and the directions link both read it.

Two locate buttons, deliberately: "Use my location" asks the DEVICE where it
is, "Locate from address" geocodes the fields above. They were one button
once, which answered neither question well.

Uses the Mapbox token the globe views already ship with
(NEXT_PUBLIC_MAPBOX_TOKEN). With no token the component degrades to plain
address fields rather than breaking the wizard.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×6 (local), `Loader2`×4 (lucide-react), `MapPin`×2 (lucide-react), `LocateFixed`×2 (lucide-react), `Search` (lucide-react), `X` (lucide-react), `Crosshair` (lucide-react)

### Props

- **`VenuePicker`**: `value: VenueValue`, `onChange: (next: VenueValue) => void`

**Hooks used:** `useRef`×6, `useState`×6, `useEffect`×4, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `VenueValue` | interface |  | 26 |
| `default (VenuePicker)` | component | `VenuePicker({ value, onChange, }: { value: VenueValue; onChange: (next:…)` | 114 |

## Interfaces

- **External HTTP calls:**
  - `GET api.mapbox.com/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,place&limit=1` (L152)
  - `GET api.mapbox.com/${encodeURIComponent(
            query.trim()
          )}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,place&limit=5` (L339)
  - `GET api.mapbox.com/${encodeURIComponent(q)}.json?${params.toString()}` (L435)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Timers / queues:** `setTimeout` at L336
- **External hosts mentioned in the code:** `api.mapbox.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `GOLD`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `mapbox-gl`
  - `lucide-react` — `Crosshair`, `LocateFixed`, `Loader2`, `MapPin`, `Search`, `X`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
