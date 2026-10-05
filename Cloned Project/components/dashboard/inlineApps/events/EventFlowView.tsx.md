# `components/dashboard/inlineApps/events/EventFlowView.tsx`

> One event inside the attendee Events pages: its page, and from "Get tickets" the in-app checkout, then back.

**Kind:** React component · **Lines:** 77 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
One event inside the attendee Events pages: its page, and from "Get
tickets" the in-app checkout, then back. Discover and Purchases both open
events through this, so the flow is the same wherever it starts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `EventCheckoutView` (components/dashboard/inlineApps/events/EventCheckoutView.tsx), `EventDetailView` (components/dashboard/inlineApps/events/EventDetailView.tsx)

### Props

- **`EventFlowView`**: `slug: string`, `rootLabel: string`, `onBack: () => void`, `initial?: PublicEventPayload | null`, `startInCheckout?: boolean`, `onOpenPurchases?: () => void`, `onScrollTop?: () => void`

**Hooks used:** `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventFlowView)` | component | `EventFlowView({ slug, rootLabel, onBack, initial, startInCheckout, onOpen…)` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/api.ts` — `PublicEventPayload`, `(types only)`
  - `components/dashboard/inlineApps/events/EventCheckoutView.tsx` — `EventCheckoutView (default)`
  - `components/dashboard/inlineApps/events/EventDetailView.tsx` — `EventDetailView (default)`
- **Packages:**
  - `react` — `useState`

## Used by

- `components/dashboard/inlineApps/events/EventsBrowse.tsx`
- `components/dashboard/inlineApps/events/EventsPurchases.tsx`
