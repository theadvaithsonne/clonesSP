# `components/dashboard/DocumentEditorOverlay.tsx`

> React component `DocumentEditorOverlay`.

**Kind:** React component · **Lines:** 257 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText`×2 (lucide-react), `FileSpreadsheet` (lucide-react), `Presentation` (lucide-react), `AnimatePresence` (framer-motion), `X` (lucide-react), `Users` (lucide-react), `Button` (components/ui/button.tsx), `OnlyOfficeEditor` (components/dashboard/OnlyOfficeEditor.tsx)

### Props

- **`DocumentEditorOverlay`**: `isOpen: boolean`, `onClose: () => void`, `documentId: string`, `organizationId: string`, `userId: string`, `userName: string`, `userEmail?: string`

**Hooks used:** `useState`×5, `useEffect`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DocumentEditorOverlay` | component | `DocumentEditorOverlay({ isOpen, onClose, documentId, organizationId, userId, user…)` | 43 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/cabinet/documents/${documentId}?organizationId=${organizationId}` (L68)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/dashboard/OnlyOfficeEditor.tsx` — `OnlyOfficeEditor (default)`, `DocumentType`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `react-dom` — `createPortal`
  - `lucide-react` — `X`, `Users`, `FileText`, `FileSpreadsheet`, `Presentation`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/dashboard/CabinetPage.tsx`
