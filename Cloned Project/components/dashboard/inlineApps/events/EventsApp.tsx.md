# `components/dashboard/inlineApps/events/EventsApp.tsx`

> Shell for the Events module.

**Kind:** React component · **Lines:** 247 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shell for the Events module.

Lives at /workspace under the Founder tab, driven by the `Founder:Events`
popover — there is no /events route. Navigation between the event list and
the PLAN / SELL / REACH sections comes from the dashboard's floating bottom
bar, which talks to this component over CustomEvents rather than props,
mirroring `channels:open-create-modal` and `deals:inline-navigate`.

  events:open-create-modal   → open the create form
  events:navigate {section}  → switch section, or "list" to go back
  events:state {section}     ← broadcast so the bottom bar can render the
                               right tab set

The web builder is a full-screen tool: it mounts above everything (including
the bottom bar) with its own exit control.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `EventsListView` (components/dashboard/inlineApps/events/EventsListView.tsx), `EventConsole` (components/dashboard/inlineApps/events/EventConsole.tsx), `EventPickerModal` (components/dashboard/inlineApps/events/EventPickerModal.tsx), `CreateEventModal` (components/dashboard/inlineApps/events/CreateEventModal.tsx), `WebsiteBuilder` (components/dashboard/inlineApps/events/WebsiteBuilder.tsx)

### Props

- **`EventsApp`**: `onClose`, `initialEventId`, `showClose`, `onNavigatePopover`

**Hooks used:** `useState`×7, `useCallback`×5, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EventsNavSection` | type | What the bottom bar highlights: "list", or a console section. | 31 |
| `default (EventsApp)` | component | `EventsApp({ onClose, initialEventId, showClose = true, onNavigatePopo…)` — `onClose` stays required to match `InlineAppProps` exactly — React's ComponentClass props are invariant, so widening it to optional here makes the component unassignable to `INLINE_APP_REGISTRY`. | 64 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/registry.ts` — `InlineAppProps`, `(types only)`
  - `components/dashboard/inlineApps/events/EventsListView.tsx` — `EventsListView (default)`
  - `components/dashboard/inlineApps/events/EventConsole.tsx` — `EventConsole (default)`, `ConsoleSection`
  - `components/dashboard/inlineApps/events/CreateEventModal.tsx` — `CreateEventModal (default)`
  - `components/dashboard/inlineApps/events/EventPickerModal.tsx` — `EventPickerModal (default)`
  - `components/dashboard/inlineApps/events/WebsiteBuilder.tsx` — `WebsiteBuilder (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `X`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/inlineApps/registry.ts`
