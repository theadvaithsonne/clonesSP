# `components/dashboard/inlineApps/events/sections/RegistrationFormBuilder.tsx`

> The registration form an organizer builds for one event.

**Kind:** React component · **Lines:** 796 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The registration form an organizer builds for one event.

Three panes, left to right: what you can add, what you've built, and the
settings for whatever is selected. That layout is the whole point — the
canvas is a real preview of the public form, so there is no "now go and
check what it looks like" step.

Fields are added by click as well as drag: dragging is faster once you know
the library, but a click target that also works is what makes it usable on
a trackpad and with a keyboard.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×6 (components/dashboard/inlineApps/events/ui.tsx), `GripVertical`×2 (lucide-react), `Plus`×2 (lucide-react), `Trash2`×2 (lucide-react), `Toggle`×2 (components/dashboard/inlineApps/events/ui.tsx), `Loader2` (lucide-react), `Search` (lucide-react), `Icon` (local), `Check` (lucide-react), `FieldCard` (local), `FieldSettings` (local), `Button` (components/dashboard/inlineApps/events/ui.tsx), `Copy` (lucide-react), `FieldPreview` (local), `ChevronDown` (lucide-react)

### Props

- **`RegistrationFormBuilder`**: `eventId: string`

**Hooks used:** `useState`×9, `useCallback`×5, `useMemo`×2, `useRef`, `useConfirm` (components/dashboard/inlineApps/events/ui.tsx), `useEffect`, `useConsoleAction` (components/dashboard/inlineApps/events/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RegistrationFormBuilder)` | component | `RegistrationFormBuilder({ eventId }: { eventId: string })` | 136 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `GOLD`, `Label`, `Toggle`, `useConfirm`, `useConsoleAction`
  - `components/dashboard/inlineApps/events/api.ts` — `getRegistrationForm`, `listTickets`, `saveRegistrationForm`
  - `components/dashboard/inlineApps/events/types.ts` — `CONSENT_FIELD_TYPES`, `STANDARD_FIELD_TYPES`, `EventFormField`, `EventFormFieldType`, `TicketTier`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `AlignLeft`, `Building2`, `Check`, `ChevronDown`, `Copy`, `GripVertical`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/sections/TicketsSection.tsx`
