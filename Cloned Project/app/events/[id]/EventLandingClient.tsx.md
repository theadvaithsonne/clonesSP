# `app/events/[id]/EventLandingClient.tsx`

> React component `EventLandingClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 93 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `EventSiteRenderer` (components/events/site/EventSiteRenderer.tsx), `ShareEventModal` (components/events/ShareEventModal.tsx)

### Props

- **`EventLandingClient`**: `slug: string`

**Hooks used:** `useState`×3, `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventLandingClient)` | component | `EventLandingClient({ slug }: { slug: string })` — The customer-facing event page. | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/events/site/EventSiteRenderer.tsx` — `EventSiteRenderer (default)`, `PublicTier`
  - `components/dashboard/inlineApps/events/api.ts` — `getPublicEvent`, `PublicEventPayload`
  - `components/events/ShareEventModal.tsx` — `ShareEventModal (default)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`

## Used by

- `app/events/[id]/page.tsx`
