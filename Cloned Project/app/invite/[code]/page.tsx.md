# `app/invite/[code]/page.tsx`

> Next.js page rendered at `/invite/[code]`.

**Kind:** Next.js page · **Lines:** 204 · **Directive:** `"use client"` · **Route:** `/invite/[code]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Loader2`×2 (lucide-react), `AlertCircle`×2 (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Users` (lucide-react), `Check` (lucide-react)

**Hooks used:** `useState`×6, `useEffect`×2, `useParams` (next/navigation), `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (InvitePage)` | component | `InvitePage()` | 28 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/groups/invite/${code}` (L48)
  - `POST /backend/groups/invite/${code}/join` (L71)
- **Timers / queues:** `setTimeout` at L91

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useParams`, `useRouter`
  - `lucide-react` — `Loader2`, `Users`, `AlertCircle`, `Check`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/invite/[code]` (page).
