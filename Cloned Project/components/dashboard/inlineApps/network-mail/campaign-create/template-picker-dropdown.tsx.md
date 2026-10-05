# `components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown.tsx`

> React component `TemplatePickerDropdown`.

**Kind:** React component · **Lines:** 175 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText`×2 (lucide-react), `ChevronDown` (lucide-react), `Search` (lucide-react), `CategoryTag` (local), `ArrowRight` (lucide-react)

### Props

- **`TemplatePickerDropdown`**: `templates: CampaignTemplateItem[]`, `loading?: boolean`, `selectedId: string`, `selectedName: string`, `onSelect: (id: string, name: string) => void`, `onCreateNew?: () => void`, `label?: string`, `hint?: string`, `placeholder?: string`

**Hooks used:** `useState`×2, `useRef`, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TemplatePickerDropdown` | component | `TemplatePickerDropdown({ templates, loading, selectedId, selectedName, onSelect, o…)` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/campaign-create/constants.ts` — `CATEGORY_COLORS`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignTemplateItem`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ArrowRight`, `ChevronDown`, `FileText`, `Search`

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/step-1-template.tsx`
- `components/dashboard/products/ProductEmailAlertsSection.tsx`
- `components/shared/OrgWelcomeEmailSection.tsx`
