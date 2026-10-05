# `app/(dashboard)/thoughts/components/NotePageComments.tsx`

> React component `NotePageComments`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 149 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `Send` (lucide-react)

### Props

- **`NotePageComments`**: `comments: NotePageComment[]`, `onChange: (comments: NotePageComment[]) => void`, `onClose?: () => void`, `autoFocus?: boolean`, `readOnly?: boolean`

**Hooks used:** `useCallback`×2, `useUser` (context/UserContext.tsx), `useState`, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NotePageComment` | interface |  | 7 |
| `default (NotePageComments)` | component | `NotePageComments({ comments, onChange, onClose, autoFocus, readOnly = false,…)` — Notion-style page comments that sit directly under the title. | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `context/UserContext.tsx` — `useUser`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Send`, `X`

## Used by

- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/page.tsx`
