# `store/flowboard/formStore.tsx`

> React hooks `useForms`, `useCurrentForm`, `useSelectedElement`, `useFormLoading`.

**Kind:** client state store · **Lines:** 468

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useFormStore`×6 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FormElement` | interface |  | 7 |
| `FormSettings` | interface |  | 16 |
| `Form` | interface |  | 29 |
| `FormSubmission` | interface |  | 41 |
| `FormState` | interface |  | 50 |
| `useFormStore` | const | `= create<FormState>()( persist( (set, get) => ({ // Initial state forms: [], currentForm: null, sub…` | 114 |
| `useForms` | hook | `useForms()` | 459 |
| `useCurrentForm` | hook | `useCurrentForm()` | 460 |
| `useSelectedElement` | hook | `useSelectedElement()` | 461 |
| `useFormLoading` | hook | `useFormLoading()` | 465 |
| `useFormSaving` | hook | `useFormSaving()` | 466 |
| `useFormError` | hook | `useFormError()` | 467 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
