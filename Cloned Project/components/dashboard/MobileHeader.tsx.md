# `components/dashboard/MobileHeader.tsx`

> React component `MobileHeader`.

**Kind:** React component · **Lines:** 149 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Image`×2 (next/image), `Menu` (lucide-react), `User` (lucide-react), `MoreVertical` (lucide-react)

### Props

- **`MobileHeader`**: `className?: string`, `me?: { id?: string; _id?: string; profilePicture?: string; name?: str…`

**Hooks used:** `useMobileSidebar` (lib/mobile-sidebar-context.tsx), `useWhitelabelContext` (lib/whitelabel-context.tsx), `useIsBat246Office` (lib/bat246Office.ts), `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MobileHeader)` | component | `MobileHeader({ className, me }: MobileHeaderProps)` | 27 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}` (L45)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/mobile-sidebar-context.tsx` — `useMobileSidebar`
  - `lib/api.ts` — `api`
  - `lib/whitelabel-context.tsx` — `useWhitelabelContext`
  - `lib/bat246Office.ts` — `BAT246_DISPLAY_NAME`, `BAT246_LOGO_SRC`, `useIsBat246Office`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Menu`, `MoreVertical`, `User`
  - `next`

## Used by

- `app/(dashboard)/layout.tsx`
