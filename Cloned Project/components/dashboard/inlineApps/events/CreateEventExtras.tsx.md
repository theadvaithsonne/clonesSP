# `components/dashboard/inlineApps/events/CreateEventExtras.tsx`

> The optional back half of the create wizard: registration form, agenda, speakers and sponsors.

**Kind:** React component · **Lines:** 805 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The optional back half of the create wizard: registration form, agenda,
speakers and sponsors.

These four live in their own file because they share one shape and none of
it belongs to the event record itself. Each is a separate collection keyed by
`eventId`, so none of it can be written until the event exists — the wizard
collects drafts here and `saveEventExtras` flushes them straight after
`createEvent`, the same deferred-save contract the banner and the commission
plan already use.

Every step is skippable on purpose. An organizer who just wants a page up
should not have to invent a session or a speaker first, and each of these has
a full editor in the console afterwards. What the wizard offers is the
shortest version of each.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StepIntro`×4 (local), `CustomSelect`×4 (components/dashboard/inlineApps/events/ui.tsx), `RowCard`×3 (local), `AddRowButton`×3 (local), `Trash2`×2 (lucide-react), `MicroLabel`×2 (local), `Plus` (lucide-react), `SwitchControl` (components/dashboard/inlineApps/events/ui.tsx), `LogoPicker` (local), `Upload` (lucide-react)

### Props

- **`RegistrationStep`**: `value: RegistrationDraft`, `onChange: (next: RegistrationDraft) => void`
- **`AgendaStep`**: `days: string[]`, `value: SessionDraft[]`, `onChange: (next: SessionDraft[]) => void`
- **`SpeakersStep`**: `value: SpeakerDraft[]`, `onChange: (next: SpeakerDraft[]) => void`
- **`SponsorsStep`**: `value: SponsorDraft[]`, `onChange: (next: SponsorDraft[]) => void`

**Hooks used:** `useState`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RegistrationDraft` | interface |  | 147 |
| `emptyRegistration` | function | `emptyRegistration(): RegistrationDraft` | 153 |
| `RegistrationStep` | component | `RegistrationStep({ value, onChange, }: { value: RegistrationDraft; onChange:…)` | 159 |
| `SessionDraft` | interface |  | 318 |
| `wizardEventDays` | function | `wizardEventDays(startsAt: string, endsAt: string): string[]` — Every calendar day between the two datetime-local strings on step 1. | 339 |
| `newSession` | function | `newSession(day: string): SessionDraft` | 360 |
| `AgendaStep` | component | `AgendaStep({ days, value, onChange, }: { /** The event's own days. Emp…)` | 369 |
| `SpeakerDraft` | interface |  | 495 |
| `newSpeaker` | function | `newSpeaker(): SpeakerDraft` | 503 |
| `SpeakersStep` | component | `SpeakersStep({ value, onChange, }: { value: SpeakerDraft[]; onChange: (n…)` | 511 |
| `SponsorDraft` | interface |  | 576 |
| `newSponsor` | function | `newSponsor(): SponsorDraft` | 586 |
| `SponsorsStep` | component | `SponsorsStep({ value, onChange, }: { value: SponsorDraft[]; onChange: (n…)` | 595 |
| `EventExtras` | interface |  | 709 |
| `saveEventExtras` | function | `async saveEventExtras(eventId: string, extras: EventExtras, registrationTouched: boolean): Promise<void>` — Write the drafts against a freshly created event. | 723 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/api.ts` — `createSession`, `createSpeaker`, `createSponsor`, `saveRegistrationForm`, `uploadEventImage`
  - `components/dashboard/inlineApps/events/ui.tsx` — `CustomSelect`, `SwitchControl`, `blurOnWheel`, `fromLocalInput`
  - `components/dashboard/inlineApps/events/types.ts` — `EventFormField`, `EventFormFieldType`, `(types only)`
- **Packages:**
  - `react` — `useMemo`, `useState`
  - `lucide-react` — `Plus`, `Trash2`, `Upload`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
