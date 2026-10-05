# `app/taskroom/[workspace]/settings/general/[space]/page.tsx`

> Next.js page rendered at `/taskroom/[workspace]/settings/general/[space]`.

**Kind:** Next.js page · **Lines:** 459 · **Directive:** `"use client"` · **Route:** `/taskroom/[workspace]/settings/general/[space]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Button`×2 (components/ui/button.tsx), `Plus`×2 (lucide-react), `Input` (components/ui/input.tsx), `Badge` (components/ui/badge.tsx)

**Hooks used:** `useState`×7, `useWorkspaceStore` (store/taskroom/workspaceStore.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WorkspaceSettingsPage)` | component | `WorkspaceSettingsPage()` | 15 |

## Interfaces

- **External HTTP calls:**
  - `POST https://uatapi.garage.app/api/s3upload/single` (L102)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/badge.tsx` — `Badge`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useRef`
  - `lucide-react` — `Edit2`, `Loader2`, `Plus`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/taskroom/[workspace]/settings/general/[space]` (page).
