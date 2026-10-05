# `app/games/bat246/preview/[boardId]/page.tsx`

> Next.js page rendered at `/games/bat246/preview/[boardId]`.

**Kind:** Next.js page · **Lines:** 48 · **Directive:** `"use client"` · **Route:** `/games/bat246/preview/[boardId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `BoardLayout` (components/bat246/BoardLayout.tsx)

### Props

- **`BoardPreviewPage`**: `params: Promise<{ boardId: string }>`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BoardPreviewPage)` | component | `BoardPreviewPage({ params }: { params: Promise<{ boardId: string }> })` | 9 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/bat246/boards/${boardId}/public` (L16)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `components/bat246/BoardLayout.tsx` — `BoardLayout`
  - `components/bat246/types.ts` — `BoardData`
- **Packages:**
  - `react` — `use`, `useEffect`, `useState`

## Used by

Entry: reached by the Next.js router at `/games/bat246/preview/[boardId]` (page).
