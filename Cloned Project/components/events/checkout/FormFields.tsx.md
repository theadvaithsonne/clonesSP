# `components/events/checkout/FormFields.tsx`

> The organizer's registration form, rendered light for the checkout page.

**Kind:** React component · **Lines:** 271 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The organizer's registration form, rendered light for the checkout page.

Standard field types write into the typed `attendee` record the checkout API
expects; everything else answers into the free-form `answers` bag keyed by
field key. The split matters: the server validates `answers` against the
form config and drops anything it didn't ask for, so a custom question can
only be stored if it came from the builder.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronDown` (lucide-react)

### Props

- **`FormFieldInput`**: `field: EventFormField`, `accent?: string`, `attendee: Attendee`, `answers: Record<string, unknown>`, `nameParts: NameParts`, `onAttendee: (patch: Partial<Attendee>) => void`, `onNamePart: (part: "first" | "last", value: string) => void`, `onAnswer: (value: unknown) => void`, `onCountryBlur: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Attendee` | type |  | 20 |
| `CONSENT_TYPES` | const | `= [ "terms", "marketing_opt_in", "photo_consent", ]` — Consent fields answer with a boolean and render as a checkbox. | 23 |
| `ATTENDEE_KEYS` | const | `= { email: "email", phone: "phone", company: "company", job_title: "jobTitle", country: "…` — Standard fields write into the typed attendee record rather than `answers`. | 30 |
| `NAME_PART` | const | `= { first_name: "first", last_name: "last", }` — First and last name are edited separately and joined into the one `name` the registration stores. | 43 |
| `NameParts` | type |  | 48 |
| `joinName` | function | `joinName(parts: NameParts)` | 50 |
| `fieldSpansRow` | function | `fieldSpansRow(field: EventFormField)` — Wide fields take the whole row; the rest pair up two to a row. | 54 |
| `FormFieldInput` | component | `FormFieldInput({ field, accent = DEFAULT_ACCENT, attendee, answers, namePa…)` | 65 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/types.ts` — `EventFormField`, `EventFormFieldType`, `(types only)`
  - `components/dashboard/inlineApps/events/api.ts` — `AttendeeInput`, `(types only)`
  - `components/events/checkout/ui.tsx` — `C`, `DEFAULT_ACCENT`
- **Packages:**
  - `react`
  - `lucide-react` — `ChevronDown`

## Used by

- `app/events/[id]/checkout/CheckoutClient.tsx`
- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
