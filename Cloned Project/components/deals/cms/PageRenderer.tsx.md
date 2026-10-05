# `components/deals/cms/PageRenderer.tsx`

> React component `PageRenderer`.

**Kind:** React component · **Lines:** 496 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ModuleView`×2 (local), `LeadFormBlock` (local), `LogoBlockView` (components/deals/cms/CmsBlockViews.tsx), `SocialIconsBlockView` (components/deals/cms/CmsBlockViews.tsx), `FooterBlockView` (components/deals/cms/CmsBlockViews.tsx), `ColumnModuleEditor` (components/deals/cms/ColumnModuleEditor.tsx)

### Props

- **`PageRenderer`**: `content: CmsPageContent`, `form?: CmsForm | null`, `interactive?: boolean`, `selectedId?: string | null`, `onSelect?: (id: string) => void`, `onDelete?: (id: string) => void`, `onAddToColumn?: (layoutId: string, columnId: string, type: CmsModuleT…`, `onRemoveFromColumn?: (layoutId: string, columnId: string, moduleId: s…`, `width?: number`

**Hooks used:** `useState`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PageRenderer)` | component | `PageRenderer({ content, form, interactive = false, selectedId, onSelect,…)` | 448 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/cms/types.ts` — `CmsForm`, `CmsModule`, `CmsModuleType`, `CmsPageContent`, `(types only)`
  - `lib/cms/api.ts` — `submitCmsForm`
  - `lib/cms/columns.ts` — `getLayoutColumns`
  - `components/deals/cms/ColumnModuleEditor.tsx` — `ColumnModuleEditor (default)`
  - `components/deals/cms/CmsBlockViews.tsx` — `FooterBlockView`, `LogoBlockView`, `SocialIconsBlockView`
- **Packages:**
  - `react` — `useState`

## Used by

- `app/p/[slug]/page.tsx`
- `components/deals/cms/PageBuilderShell.tsx`
