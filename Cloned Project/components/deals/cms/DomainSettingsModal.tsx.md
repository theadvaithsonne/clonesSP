# `components/deals/cms/DomainSettingsModal.tsx`

> React component `DomainSettingsModal`.

**Kind:** React component · **Lines:** 207 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react)

### Props

- **`DomainSettingsModal`**: `open: boolean`, `pageSlug?: string`, `onClose: () => void`

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DomainSettingsModal)` | component | `DomainSettingsModal({ open, pageSlug, onClose, }: { open: boolean; pageSlug?: s…)` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/cms/types.ts` — `CmsDomain`, `(types only)`
  - `lib/cms/api.ts` — `addCmsDomain`, `deleteCmsDomain`, `listCmsDomains`, `verifyCmsDomain`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `X`
  - `sonner` — `toast`

## Used by

- `components/deals/cms/CmsDashboard.tsx`
- `components/deals/cms/PageBuilderShell.tsx`
