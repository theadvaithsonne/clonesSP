# `components/dashboard/drops/DropUploadModal.tsx`

> React component `DropUploadModal`.

**Kind:** React component · **Lines:** 635 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `X` (lucide-react), `Link2` (lucide-react), `Upload` (lucide-react), `Info` (lucide-react), `AlertCircle` (lucide-react)

### Props

- **`DropUploadModal`**: `orgId: string`, `onClose: () => void`, `onCreated: (drop: any) => void`

**Hooks used:** `useState`×11, `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DropUploadModal)` | component | `DropUploadModal({ orgId, onClose, onCreated, }: DropUploadModalProps)` | 14 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/drops/link-preview?url=${encodeURIComponent(url)}` (L68)
  - `POST /backend/drops?orgId=${orgId}` (L125)
  - `POST /backend/drops/presigned-upload?orgId=${orgId}` (L196)
- **Timers / queues:** `setTimeout` at L55

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`, `API_URL`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useState`, `useRef`, `useCallback`
  - `lucide-react` — `X`, `Link2`, `Upload`, `Loader2`, `AlertCircle`, `Info`

## Used by

- `components/dashboard/DropsPage.tsx`
