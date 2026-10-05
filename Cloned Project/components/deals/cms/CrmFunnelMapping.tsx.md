# `components/deals/cms/CrmFunnelMapping.tsx`

> React component `CrmFunnelMapping`.

**Kind:** React component · **Lines:** 362 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `Plus` (lucide-react)

### Props

- **`CrmFunnelMapping`**: `open: boolean`, `page: CmsPage | null`, `formFields: CmsFormField[]`, `onClose: () => void`, `onPageUpdate?: (page: CmsPage) => void`

**Hooks used:** `useState`×5, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CrmFunnelMapping)` | component | `CrmFunnelMapping({ open, page, formFields, onClose, onPageUpdate, }: { open:…)` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/cms/types.ts` — `CmsFormField`, `CmsFunnelRule`, `CmsPage`, `CmsPipeline`, `(types only)`
  - `lib/cms/api.ts` — `connectCmsCrm`, `createCmsRule`, `deleteCmsRule`, `listCmsPipelines`, `listCmsRules`, `updateCmsRule`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Plus`, `X`
  - `sonner` — `toast`

## Used by

- `components/deals/cms/PageBuilderShell.tsx`
