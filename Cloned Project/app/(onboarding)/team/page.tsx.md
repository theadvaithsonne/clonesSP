# `app/(onboarding)/team/page.tsx`

> Next.js page rendered at `/team`.

**Kind:** Next.js page · **Lines:** 75 · **Directive:** `"use client"` · **Route:** `/team` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Shell` (components/Layout/Shell.tsx)

**Hooks used:** `useState`, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TeamInvitePage)` | component | `TeamInvitePage()` | 11 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/invites/create` (L29)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/Layout/Shell.tsx` — `Shell (default)`
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `react` — `useState`
  - `next` — `useRouter`

## Used by

Entry: reached by the Next.js router at `/team` (page).
