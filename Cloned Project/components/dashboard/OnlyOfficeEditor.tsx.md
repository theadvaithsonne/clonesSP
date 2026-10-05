# `components/dashboard/OnlyOfficeEditor.tsx`

> React component `OnlyOfficeEditor`.

**Kind:** React component · **Lines:** 333 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react)

### Props

- **`OnlyOfficeEditor`**: `documentId: string`, `documentType: DocumentType`, `documentTitle: string`, `documentUrl: string`, `documentKey: string`, `callbackUrl: string`, `userId: string`, `userName: string`, `userEmail?: string`, `token?: string`, `serverConfig?: any`, `mode?: "edit" | "view"`, `onReady?: () => void`, `onError?: (error: any) => void`, `onDocumentStateChange?: (isSaved: boolean) => void`

**Hooks used:** `useRef`×2, `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DocumentType` | type |  | 12 |
| `default (OnlyOfficeEditor)` | component | `OnlyOfficeEditor({ documentId, documentType, documentTitle, documentUrl, doc…)` | 60 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_ONLYOFFICE_URL`
- **Timers / queues:** `setTimeout` at L90, L115; `setInterval` at L105

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Loader2`

## Used by

- `app/(dashboard)/cabinet/editor/[documentId]/page.tsx`
- `components/dashboard/DocumentEditorOverlay.tsx`
