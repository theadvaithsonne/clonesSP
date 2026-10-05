# `app/ai-providers/page.tsx`

> Next.js page rendered at `/ai-providers`.

**Kind:** Next.js page · **Lines:** 373 · **Directive:** `"use client"` · **Route:** `/ai-providers` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×6 (components/ui/button.tsx), `Loader2`×3 (lucide-react), `ArrowLeft` (lucide-react), `Sparkles` (lucide-react), `CheckCircle` (lucide-react), `Key` (lucide-react), `Trash2` (lucide-react), `Input` (components/ui/input.tsx), `EyeOff` (lucide-react), `Eye` (lucide-react)

**Hooks used:** `useState`×7, `useRouter` (next/navigation), `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AIProvidersPage)` | component | `AIProvidersPage()` | 52 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/founder-ai-providers/keys?orgId=${orgId}` (L67)
  - `POST /backend/founder-ai-providers/keys?orgId=${orgId}` (L105)
  - `DELETE /backend/founder-ai-providers/keys/${providerId}?orgId=${orgId}` (L135)
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
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Key`, `Trash2`, `Eye`, `EyeOff`, `CheckCircle`, …

## Used by

Entry: reached by the Next.js router at `/ai-providers` (page).
