# `components/dashboard/AIProviderSelector.tsx`

> React component `AIProviderSelector`.

**Kind:** React component · **Lines:** 103 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx)

### Props

- **`AIProviderSelector`**: `keys: ProviderKey[]`, `selectedProvider: string | null`, `onProviderChange: (providerId: string) => void`, `disabled?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AIProviderSelector)` | component | `AIProviderSelector({ keys, selectedProvider, onProviderChange, disabled = fals…)` | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/hooks/useAIProvider.ts` — `ProviderKey`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
- **Packages:** none

## Used by

- `components/dashboard/AskCabinetSidebar.tsx`
- `components/dashboard/BettyDashboardPage.tsx`
