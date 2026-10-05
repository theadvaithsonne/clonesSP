# `components/deals/cms/PageBuilderShell.tsx`

> React component `PageBuilderShell`.

**Kind:** React component · **Lines:** 1189 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AlignmentPicker`×4 (local), `Icon`×2 (local), `Trash2`×2 (lucide-react), `PageRenderer`×2 (components/deals/cms/PageRenderer.tsx), `PaddingEditor`×2 (local), `ArrowLeft` (lucide-react), `ChevronDown` (lucide-react), `ArrowUp` (lucide-react), `ArrowDown` (lucide-react), `Copy` (lucide-react), `LeadFormBuilderModal` (components/deals/cms/LeadFormBuilderModal.tsx), `DomainSettingsModal` (components/deals/cms/DomainSettingsModal.tsx), `CrmFunnelMapping` (components/deals/cms/CrmFunnelMapping.tsx)

### Props

- **`PageBuilderShell`**: `pageId: string`, `onBack: () => void`

**Hooks used:** `useState`×16, `useCallback`×3, `useRef`×2, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PageBuilderShell)` | component | `PageBuilderShell({ pageId, onBack, }: { pageId: string; onBack: () => void; })` | 151 |

## Interfaces

- **Timers / queues:** `setTimeout` at L224

## Dependencies

- **Internal:**
  - `lib/cms/api.ts` — `getCmsPage`, `publishCmsPage`, `updateCmsForm`, `updateCmsPage`
  - `lib/cms/moduleDefaults.ts` — `createModule`, `MODULE_LIBRARY`
  - `lib/uploadthing.ts` — `uploadFiles`
  - `lib/cms/moduleTree.ts` — `addModuleToColumn`, `findModule`, `mapModules`, `removeModuleFromColumn`, `updateLayoutColumns`
  - `lib/cms/columns.ts` — `getLayoutColumns`, `makeColumns`
  - `lib/cms/types.ts` — `CmsForm`, `CmsModule`, `CmsPage`, `CmsPageContent`, `DevicePreview`, `(types only)`
  - `components/deals/cms/PageRenderer.tsx` — `PageRenderer (default)`
  - `components/deals/cms/LeadFormBuilderModal.tsx` — `LeadFormBuilderModal (default)`
  - `components/deals/cms/DomainSettingsModal.tsx` — `DomainSettingsModal (default)`
  - `components/deals/cms/CrmFunnelMapping.tsx` — `CrmFunnelMapping (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ArrowLeft`, `ChevronDown`, `Copy`, `Monitor`, `Smartphone`, `Tablet`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/deals/cms/[id]/page.tsx`
- `app/(dashboard)/deals/cms/page.tsx`
