# `app/(dashboard)/workspace/hooks/useWorkshopPreview.ts`

> React hook `useWorkshopPreview`.

**Kind:** React hook · **Lines:** 267 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useEffect`×5, `useCallback`×4, `useState`×3, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LiveWorkshopData` | interface |  | 6 |
| `AudienceTokenData` | interface |  | 22 |
| `UseWorkshopPreviewResult` | interface |  | 27 |
| `useWorkshopPreview` | hook | `useWorkshopPreview(orgId: string \| null): UseWorkshopPreviewResult` | 39 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/workshop-preview/live?orgId=${orgId}` (L53)
  - `POST /backend/workshop-preview/audience-token` (L96)
  - `GET /backend/workshop-preview/status/${liveWorkshop.meetId}` (L141)
- **Socket.IO events:**
  - listens for: `workshop:preview:live`, `workshop:preview:ended`
- **Timers / queues:** `setInterval` at L189, L209

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`

## Used by

- `app/(dashboard)/workspace/components/WorkshopPreviewCard.tsx`
- `app/(dashboard)/workspace/components/WorkshopPreviewFullscreen.tsx`
- `app/(dashboard)/workspace/components/WorkshopPreviewSection.tsx`
