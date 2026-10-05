# `app/games/bat246/office-invite/page.tsx`

> Next.js page rendered at `/games/bat246/office-invite`.

**Kind:** Next.js page · **Lines:** 158 · **Directive:** `"use client"` · **Route:** `/games/bat246/office-invite` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `X` (lucide-react), `Suspense` (react), `OfficeInvitePage` (local)

**Hooks used:** `useState`×3, `useEffect`×2, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OfficeInvitePageWrapper)` | component | `OfficeInvitePageWrapper()` | 151 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/bat246/claim-invite` (L40)
  - `POST /backend/bat246/office/join` (L51)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get/set), `garage_org_id` (localStorage: set)

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `isAuthenticated`, `getUserIdFromToken`
- **Packages:**
  - `react` — `Suspense`, `useEffect`, `useRef`, `useState`
  - `next` — `useRouter`, `useSearchParams`
  - `lucide-react` — `X`, `Loader2`

## Used by

Entry: reached by the Next.js router at `/games/bat246/office-invite` (page).
