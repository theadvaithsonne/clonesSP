# `components/dashboard/inlineApps/events/CreateEventModal.tsx`

> Create Event — the founder create form.

**Kind:** React component · **Lines:** 1500 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Create Event — the founder create form.

Styled to ServiceFormModal, which is the reference founder create form:
a centred #141414 card on a blurred black scrim, #262626 hairlines,
#1A1A1A inputs with a #FBD10D focus ring, bold uppercase zinc-400
micro-labels, and a sticky footer bar. If that form is restyled, this one
should move with it.

The one departure is the 3-step stepper in the header. An event carries three
unrelated decision sets (what it is / where it happens / what it costs) and
the venue step owns an interactive map — one continuous scroll buries the map
and the ticket rows.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FieldLabel`×14 (local), `Button`×7 (components/ui/button.tsx), `Input`×6 (components/ui/input.tsx), `SelectField`×5 (local), `DateTimeField`×4 (components/dashboard/inlineApps/events/DateTimeField.tsx), `SectionHeading`×3 (local), `Loader2`×3 (lucide-react), `SwitchControl`×2 (components/dashboard/inlineApps/events/ui.tsx), `X`×2 (lucide-react), `ToggleRow`×2 (local), `Icon`×2 (local), `CustomSelect` (components/dashboard/inlineApps/events/ui.tsx), `React` (react), `Check` (lucide-react), `ImageIcon` (lucide-react), `VenuePicker` (components/dashboard/inlineApps/events/VenuePicker.tsx), `MapPin` (lucide-react), `FounderAlertsSection` (components/dashboard/products/FounderAlertsSection.tsx), `CapacityMeter` (components/dashboard/inlineApps/events/ui.tsx), `GripVertical` (lucide-react), `Trash2` (lucide-react), `Plus` (lucide-react), `CommissionPlanSection` (components/dashboard/CommissionPlanSection.tsx), `RegistrationStep` (components/dashboard/inlineApps/events/CreateEventExtras.tsx), `AgendaStep` (components/dashboard/inlineApps/events/CreateEventExtras.tsx), `SpeakersStep` (components/dashboard/inlineApps/events/CreateEventExtras.tsx), `SponsorsStep` (components/dashboard/inlineApps/events/CreateEventExtras.tsx)

### Props

- **`CreateEventModal`**: `isOpen: boolean`, `onClose: () => void`, `onCreated: (eventId: string) => void`, `initialEvent?: EventProgram | null`, `onSaved?: () => void`

**Hooks used:** `useState`×29, `useEffect`×4, `useRef`×2, `useMemo`×2, `useFounderAlerts` (components/dashboard/products/useFounderAlerts.ts), `useHideBottomBar` (components/dashboard/inlineApps/events/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CreateEventModal)` | component | `CreateEventModal({ isOpen, onClose, onCreated, initialEvent, onSaved, }: { i…)` — Create *and* edit. | 251 |

## Interfaces

- **External hosts mentioned in the code:** `zoom.us`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/dashboard/CommissionPlanSection.tsx` — `CommissionPlanSection`, `saveCommissionPlan`
  - `components/dashboard/inlineApps/events/api.ts` — `createEvent`, `listSessions`, `listTickets`, `updateEvent`, `uploadBanner`
  - `components/dashboard/inlineApps/events/announceEvent.ts` — `announceEvent`
  - `components/dashboard/products/FounderAlertsSection.tsx` — `FounderAlertsSection`
  - `components/dashboard/products/useFounderAlerts.ts` — `useFounderAlerts`
  - `components/dashboard/inlineApps/events/VenuePicker.tsx` — `VenuePicker (default)`, `VenueValue`
  - `components/dashboard/inlineApps/events/CreateEventExtras.tsx` — `AgendaStep`, `RegistrationStep`, `SpeakersStep`, `SponsorsStep`, `emptyRegistration`, `saveEventExtras`, `wizardEventDays`, `RegistrationDraft`, … +3
  - `components/dashboard/inlineApps/events/DateTimeField.tsx` — `DateTimeField (default)`
  - `components/dashboard/inlineApps/events/ui.tsx` — `CapacityMeter`, `CustomSelect`, `EVENT_CATEGORIES`, `EVENT_LANGUAGES`, `fromLocalInput`, `blurOnWheel`, `localTimezone`, `SwitchControl`, … +3
  - `components/dashboard/inlineApps/events/types.ts` — `AgendaSession`, `EventFormat`, `EventProgram`, `EventStreamType`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Building2`, `Check`, `GripVertical`, `ImageIcon`, `Link2`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
- `components/dashboard/inlineApps/events/EventsApp.tsx`

## Notes

- Large file (1500 lines) — read it by section; line numbers above point into it.
