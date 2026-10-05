# `components/dashboard/docusign/shared/admin/branding/EmailContentSection.tsx`

> React component `EmailContentSection`.

**Kind:** React component · **Lines:** 173 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `RotateCcw` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx)

### Props

- **`EmailContentSection`**: `catalog: DsBrandingCatalogItem[]`, `defaults: DsBrandingEditor["defaults"]["content"]`, `limits: DsBrandingEditor["limits"]`, `kind: DsEmailKind`, `onKindChange: (kind: DsEmailKind) => void`, `content: Record<DsEmailKind, DsEmailContent>`, `onChange: (kind: DsEmailKind, field: Field, value: string) => void`, `onResetKind: (kind: DsEmailKind) => void`, `errors: DsBrandingFieldError[]`

**Hooks used:** `useRef`, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EmailContentSection` | component | `EmailContentSection({ catalog, defaults, limits, kind, onKindChange, content, o…)` | 36 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/docusign/types.ts` — `DsBrandingCatalogItem`, `DsBrandingEditor`, `DsBrandingFieldError`, `DsEmailContent`, `DsEmailKind`, `(types only)`
  - `components/dashboard/docusign/shared/admin/branding/brandingUi.ts` — `FIELD_ERROR`, `FIELD_HINT`, `FIELD_LABEL`, `SECTION`, `SECTION_SUBTITLE`, `SECTION_TITLE`, `TEXT_AREA`, `TEXT_INPUT`, … +1
- **Packages:**
  - `react` — `useRef`, `useState`
  - `lucide-react` — `RotateCcw`

## Used by

- `components/dashboard/docusign/shared/admin/branding/BrandingTab.tsx`
