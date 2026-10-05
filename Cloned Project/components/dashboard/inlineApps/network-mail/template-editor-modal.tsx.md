# `components/dashboard/inlineApps/network-mail/template-editor-modal.tsx`

> React component `TemplateEditorModal`.

**Kind:** React component · **Lines:** 74 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `TemplateEditorView` (local)

### Props

- **`TemplateEditorModal`**: `template: EditorModalTemplate`, `onClose: () => void`, `zIndex?: number`

**Hooks used:** `useEffect`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EditorModalTemplate` | type |  | 29 |
| `TemplateEditorModal` | component | `TemplateEditorModal({ template, onClose, zIndex = 740, }: { template: EditorMod…)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `react-dom` — `createPortal`
  - `next`
  - `lucide-react` — `Loader2`

## Used by

- `components/dashboard/products/ProductEmailAlertsSection.tsx`
- `components/shared/OrgWelcomeEmailSection.tsx`
