# `components/qa/PublicQAChat.tsx`

> React component `PublicQAChat`.

**Kind:** React component · **Lines:** 376 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Bot`×2 (lucide-react), `RotateCcw` (lucide-react), `ReactMarkdown` (react-markdown), `Send` (lucide-react)

### Props

- **`PublicQAChat`**: `agentId: string`

**Hooks used:** `useState`×8, `useEffect`×4, `useMemo`×2, `useCallback`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PublicQAChat)` | component | `PublicQAChat({ agentId }: { agentId: string })` | 34 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/openclaw/qa/${agentId}/info` (L75)
  - `POST /api/openclaw/qa/${agentId}/chat` (L138)

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `react-markdown`
  - `remark-gfm`
  - `lucide-react` — `Bot`, `Loader2`, `RotateCcw`, `Send`

## Used by

- `app/qa/[agentId]/page.tsx`
