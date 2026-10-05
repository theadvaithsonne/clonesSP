# `app/games/bat246/join/[boardId]/[position]/page.tsx`

> Next.js page rendered at `/games/bat246/join/[boardId]/[position]`.

**Kind:** Next.js page · **Lines:** 189 · **Directive:** `"use client"` · **Route:** `/games/bat246/join/[boardId]/[position]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link` (next/link), `ChevronLeft` (lucide-react), `Loader2` (lucide-react), `BoardLayout` (components/bat246/BoardLayout.tsx), `X` (lucide-react)

### Props

- **`JoinPositionPage`**: `params: Promise<{ boardId: string; position: string }>`

**Hooks used:** `useState`×5, `useEffect`×3, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (JoinPositionPage)` | component | `JoinPositionPage({ params }: { params: Promise<{ boardId: string; position: …)` | 21 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/bat246/boards/${boardId}/public` (L35)
  - `POST /backend/bat246/claim-invite` (L65)
  - `POST /backend/bat246/office/join` (L73)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get/set), `garage_org_id` (localStorage: set)
- **Timers / queues:** `setInterval` at L42

## Dependencies

- **Internal:**
  - `components/bat246/BoardLayout.tsx` — `BoardLayout`
  - `components/bat246/types.ts` — `BoardData`
  - `lib/auth.ts` — `isAuthenticated`, `getUserIdFromToken`
- **Packages:**
  - `react` — `use`, `useEffect`, `useRef`, `useState`
  - `next` — `useRouter`, `useSearchParams`
  - `lucide-react` — `ChevronLeft`, `X`, `Loader2`

## Used by

Entry: reached by the Next.js router at `/games/bat246/join/[boardId]/[position]` (page).
