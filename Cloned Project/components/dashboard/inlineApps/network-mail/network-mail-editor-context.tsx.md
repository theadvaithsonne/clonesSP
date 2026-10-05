# `components/dashboard/inlineApps/network-mail/network-mail-editor-context.tsx`

> React component `NetworkMailEditorProvider`.

**Kind:** React component · **Lines:** 54 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `NetworkMailEditorContext` (local)

### Props

- **`NetworkMailEditorProvider`**: `templateId: string`, `children: ReactNode`

**Hooks used:** `useCallback`, `useMemo`, `useContext`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NetworkMailEditorProvider` | component | `NetworkMailEditorProvider({ templateId, children, }: { templateId: string; children: …)` | 22 |
| `useNetworkMailEditor` | hook | `useNetworkMailEditor()` | 51 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/network-mail-api.ts` — `uploadTemplateAsset`, `getNetworkMailOrgId`
- **Packages:**
  - `react` — `createContext`, `useCallback`, `useContext`, `useMemo`, `ReactNode`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/social-icons.tsx`
- `components/dashboard/inlineApps/network-mail/template-image-upload.ts`
