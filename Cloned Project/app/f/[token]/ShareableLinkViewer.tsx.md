# `app/f/[token]/ShareableLinkViewer.tsx`

> React component `ShareableLinkViewer`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 713 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/ui/button.tsx), `Card`×3 (components/ui/card.tsx), `CardHeader`×3 (components/ui/card.tsx), `CardTitle`×3 (components/ui/card.tsx), `CardDescription`×3 (components/ui/card.tsx), `CardContent`×3 (components/ui/card.tsx), `Eye`×2 (lucide-react), `Image` (lucide-react), `Video` (lucide-react), `Music` (lucide-react), `FileText` (lucide-react), `Archive` (lucide-react), `File` (lucide-react), `ArrowLeft` (lucide-react), `Link2` (lucide-react), `ArrowRight` (lucide-react), `Minimize2` (lucide-react), `Maximize2` (lucide-react), `ViewerHeader` (local), `Loader2` (lucide-react), `Lock` (lucide-react), `AlertTriangle` (lucide-react)

### Props

- **`ShareableLinkViewer`**: `token: string`

**Hooks used:** `useState`×11, `useCallback`×7, `useEffect`×3, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ShareableLinkViewer)` | component | `ShareableLinkViewer({ token }: { token: string })` | 240 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/affiliate-share.ts` — `copyToClipboard`
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `next` — `useRouter`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `File`, `AlertTriangle`, `ArrowLeft`, `ArrowRight`, `FileText`, `Image`, …

## Used by

- `app/f/[token]/page.tsx`
