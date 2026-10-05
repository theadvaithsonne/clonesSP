# `app/taskroom/backOffice/athena/AthenaDeepLink.tsx`

> React component `AthenaDeepLink`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 328 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FullScreen`×5 (local), `ErrorCard`×3 (local), `Button`×2 (components/ui/button.tsx), `Loader2` (lucide-react), `InlineLoginModal` (app/taskroom/backOffice/athena/InlineLoginModal.tsx)

**Hooks used:** `useEffect`×2, `useState`×2, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useUserStore` (store/athena/userStore.ts), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AthenaDeepLink)` | component | `AthenaDeepLink()` | 30 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/auth/select-org` (L122)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}` (L139)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `store/athena/userStore.ts` — `useUserStore`
  - `lib/auth.ts` — `clearOrgId`, `clearToken`, `getToken`, `getUserDataFromToken`, `isAuthenticated`, `saveOrgId`, `saveToken`
  - `components/ui/button.tsx` — `Button`
  - `app/taskroom/backOffice/athena/InlineLoginModal.tsx` — `InlineLoginModal (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next` — `useRouter`, `useSearchParams`
  - `axios`
  - `lucide-react` — `Loader2`
  - `sonner` — `toast`

## Used by

- `app/taskroom/backOffice/athena/page.tsx`
