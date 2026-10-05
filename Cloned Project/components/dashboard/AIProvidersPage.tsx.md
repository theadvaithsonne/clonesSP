# `components/dashboard/AIProvidersPage.tsx`

> React component `AIProvidersPage`.

**Kind:** React component · **Lines:** 345 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `Loader2`×3 (lucide-react), `Sparkles` (lucide-react), `CheckCircle` (lucide-react), `Key` (lucide-react), `Trash2` (lucide-react), `Input` (components/ui/input.tsx), `EyeOff` (lucide-react), `Eye` (lucide-react)

**Hooks used:** `useState`×7, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AIProvidersPage)` | component | `AIProvidersPage()` | 50 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/founder-ai-providers/keys?orgId=${orgId}` (L63)
  - `POST /backend/founder-ai-providers/keys?orgId=${orgId}` (L91)
  - `DELETE /backend/founder-ai-providers/keys/${providerId}?orgId=${orgId}` (L120)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Key`, `Trash2`, `Eye`, `EyeOff`, `CheckCircle`, `Loader2`, …

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/ManagementPage.tsx`
