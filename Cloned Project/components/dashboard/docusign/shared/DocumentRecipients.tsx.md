# `components/dashboard/docusign/shared/DocumentRecipients.tsx`

> React components `ShowRecipientsSwitch`, `RecipientsToggle`, `RecipientsList`.

**Kind:** React component · **Lines:** 144 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Switch` (components/ui/switch.tsx), `ChevronRight` (lucide-react)

### Props

- **`ShowRecipientsSwitch`**: `checked: boolean`, `onChange: (value: boolean) => void`
- **`RecipientsToggle`**: `recipients: RecipientSummary[] | undefined`, `expanded: boolean`, `onToggle: () => void`
- **`RecipientsList`**: `recipients: RecipientSummary[]`, `showOrder?: boolean`

**Hooks used:** `useState`×2, `useEffect`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RecipientSummary` | interface |  | 12 |
| `useRecipientToggles` | hook | `useRecipientToggles()` | 38 |
| `ShowRecipientsSwitch` | component | `ShowRecipientsSwitch({ checked, onChange }: { checked: boolean; onChange: (value…)` | 66 |
| `RecipientsToggle` | component | `RecipientsToggle({ recipients, expanded, onToggle, }: { recipients: Recipien…)` | 77 |
| `RecipientsList` | component | `RecipientsList({ recipients, showOrder }: { recipients: RecipientSummary[]…)` | 118 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/switch.tsx` — `Switch`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `ChevronRight`

## Used by

- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
