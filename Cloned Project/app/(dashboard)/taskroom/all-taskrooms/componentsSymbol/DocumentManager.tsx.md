# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/DocumentManager.tsx`

> React component `DocumentManager`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 304 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronRight`×2 (lucide-react), `Folder`×2 (lucide-react), `Home` (lucide-react), `Button` (components/ui/button.tsx), `DocumentList` (@/components/documents/DocumentList), `DocumentUpload` (@/components/documents/DocumentUpload)

**Hooks used:** `useState`×7, `useContext`, `useUser` (context/UserContext.tsx), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DocumentManager)` | component | `DocumentManager()` | 303 |

## Interfaces

- **External HTTP calls:**
  - `GET https://startupbrokers.marketsverse.com/api/getprogramtypeclone?email=${encodeURIComponent(context.storeUser.email)}` (L62)
- **External hosts mentioned in the code:** `startupbrokers.marketsverse.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `context/UserContext.tsx` — `useUser`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `types/documents.ts` — `Document`, `SubFolder`, `DocumentListResponse`
- **Relative imports that did not resolve to a file:** `@/ContextAppApi`, `@/components/documents/DocumentUpload`, `@/components/documents/DocumentList`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useContext`
  - `lucide-react` — `Folder`, `Home`, `ChevronRight`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`
