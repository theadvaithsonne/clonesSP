# `components/dashboard/inlineApps/network-mail/merge-variable-picker.tsx`

> React components `DynamicFieldsHelper`, `DynamicFieldsCard`, `VariablePickerButton`, `MergeVariableAutocomplete`.

**Kind:** React component · **Lines:** 631 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Zap`×3 (lucide-react), `VariableRow`×2 (local), `Icon` (local), `Plus` (lucide-react), `Lightbulb` (lucide-react), `VariablePickerButton` (local), `DynamicFieldsHelper` (local), `ChevronDown` (lucide-react), `X` (lucide-react), `Search` (lucide-react), `CategoryHeading` (local)

### Props

- **`DynamicFieldsHelper`**: `children: React.ReactNode`
- **`DynamicFieldsCard`**: `onInsert: (key: string) => void`, `variables?: MergeVariable[]`, `label?: string`, `hint?: React.ReactNode`
- **`VariablePickerButton`**: `onInsert: (key: string) => void`, `variables?: MergeVariable[]`, `variant?: PickerVariant`, `label?: string`, `title?: string`
- **`MergeVariableAutocomplete`**: `editableRef: { readonly current: HTMLElement | null }`, `onInserted: () => void`, `variables?: MergeVariable[]`

**Hooks used:** `useState`×5, `useMemo`×4, `useEffect`×3, `useCallback`×3, `useRef`×2, `useLayoutEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `editableFromSelection` | function | `editableFromSelection(): HTMLElement \| null` — The contentEditable host of the current selection, if there is one. | 37 |
| `insertTokenAtCaret` | function | `insertTokenAtCaret(editable: HTMLElement, key: string, deleteBack = 0): boolean` — Inserts `{{key}}` at the caret, optionally eating `deleteBack` characters first (the ` | 59 |
| `appendToken` | function | `appendToken(editable: HTMLElement, key: string): void` — Appends a token to the end of an editable — the no-selection fallback. | 92 |
| `DynamicFieldsHelper` | component | `DynamicFieldsHelper({ children }: { children: React.ReactNode })` — The explainer that sits under the sidebar button. | 185 |
| `DynamicFieldsCard` | component | `DynamicFieldsCard({ onInsert, variables, label = "Insert Dynamic Field", hint…)` — The sidebar unit: a full-width "Insert Dynamic Field" button with the explainer directly beneath it. | 199 |
| `VariablePickerButton` | component | `VariablePickerButton({ onInsert, variables, variant = "toolbar", label = "Dynami…)` | 260 |
| `MergeVariableAutocomplete` | component | `MergeVariableAutocomplete({ editableRef, onInserted, variables, }: { /** Readonly so …)` | 504 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/merge-variables.ts` — `MERGE_CATEGORY_HINTS`, `MERGE_VARIABLE_CATEGORY_ORDER`, `mergeToken`, `pickableTextVariables`, `sampleLabel`, `MergeVariable`, `MergeVariableCategory`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useLayoutEffect`, `useMemo`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `ChevronDown`, `Lightbulb`, `Plus`, `Search`, `X`, `Zap`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
