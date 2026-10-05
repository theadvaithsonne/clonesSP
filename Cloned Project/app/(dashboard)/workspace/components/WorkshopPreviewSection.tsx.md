# `app/(dashboard)/workspace/components/WorkshopPreviewSection.tsx`

> React component `WorkshopPreviewSection`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 188 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence`×2 (framer-motion), `WorkshopPreviewCard` (app/(dashboard)/workspace/components/WorkshopPreviewCard.tsx), `WorkshopPreviewFullscreen` (app/(dashboard)/workspace/components/WorkshopPreviewFullscreen.tsx)

### Props

- **`WorkshopPreviewSection`**: `orgId: string | null`

**Hooks used:** `useEffect`×6, `useState`×3, `useRef`×2, `useWorkshopPreview` (app/(dashboard)/workspace/hooks/useWorkshopPreview.ts), `useLiveKitAudience` (app/(dashboard)/workspace/hooks/useLiveKitAudience.ts), `useMediasoupAudience` (app/(dashboard)/workspace/hooks/useMediasoupAudience.ts), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopPreviewSection` | component | `memo(({ orgId }: WorkshopPreviewSectionProps) => { const [isExpanded, setIsExpanded] = us…` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/hooks/useWorkshopPreview.ts` — `useWorkshopPreview`, `LiveWorkshopData`
  - `app/(dashboard)/workspace/hooks/useLiveKitAudience.ts` — `useLiveKitAudience`
  - `app/(dashboard)/workspace/hooks/useMediasoupAudience.ts` — `useMediasoupAudience`
  - `app/(dashboard)/workspace/components/WorkshopPreviewCard.tsx` — `WorkshopPreviewCard`
  - `app/(dashboard)/workspace/components/WorkshopPreviewFullscreen.tsx` — `WorkshopPreviewFullscreen`
- **Packages:**
  - `react` — `memo`, `useEffect`, `useState`, `useCallback`, `useRef`
  - `framer-motion` — `AnimatePresence`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
