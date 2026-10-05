# `components/dashboard/AppContainer.tsx`

> React component `AppContainer`.

**Kind:** React component · **Lines:** 241 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `InlineComponent` (local), `ArrowLeft` (lucide-react), `Loader2` (lucide-react)

### Props

- **`AppContainer`**: `id: string`, `isFounder?: boolean`, `adminApps?: AppRow[]`, `onClose?: () => void`, `teamforceSection?: string`, `dealsSection?: string`, `networkMailSection?: string`, `thoughtsSection?: string`

**Hooks used:** `useState`×6, `useEffect`×5, `useRouter` (next/navigation), `useRef`, `useCallback`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AppContainer)` | component | `AppContainer({ id, isFounder = false, adminApps = [], onClose, teamforce…)` | 15 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/apps/my?orgId=${orgId}` (L77)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L167
- **External hosts mentioned in the code:** `www.google.com`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/sso.ts` — `isSSOEnabled`, `generateExchangeToken`, `buildSSOUrl`
  - `components/ui/button.tsx` — `Button`
  - `components/dashboard/inlineApps/registry.ts` — `INLINE_APP_REGISTRY`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`, `useCallback`
  - `next` — `useParams`, `useRouter`
  - `lucide-react` — `RotateCw`, `ExternalLink`, `ArrowLeft`, `Loader2`

## Used by

- `app/(dashboard)/layout.tsx`
