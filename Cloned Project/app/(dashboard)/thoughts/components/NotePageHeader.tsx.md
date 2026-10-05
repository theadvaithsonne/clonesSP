# `app/(dashboard)/thoughts/components/NotePageHeader.tsx`

> React component `NotePageHeader`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 290 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Download` (lucide-react), `NoteCoverPicker` (app/(dashboard)/thoughts/components/NoteCoverPicker.tsx), `X` (lucide-react), `Smile` (lucide-react), `ImageIcon` (lucide-react), `MessageSquare` (lucide-react), `EmojiPicker` (emoji-picker-react)

### Props

- **`NotePageHeader`**: `icon?: string | null`, `coverUrl?: string | null`, `coverPosition?: number | null`, `onIconChange: (icon: string | null) => void`, `onCoverChange: (coverUrl: string | null) => void`, `onCoverPositionChange?: (position: number) => void`, `showAddComment?: boolean`, `onAddComment?: () => void`, `contentClassName?: string`

**Hooks used:** `useState`×6, `useRef`×6, `useCallback`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NotePageHeaderProps` | interface |  | 14 |
| `default (NotePageHeader)` | component | `NotePageHeader({ icon, coverUrl, coverPosition = 50, onIconChange, onCover…)` — Notion-style page chrome: cover, large icon, and Add icon / cover / comment. | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/thoughts/components/NoteCoverPicker.tsx` — `NoteCoverPicker (default)`
  - `app/(dashboard)/thoughts/lib/noteCoverGallery.ts` — `isGradientCover`, `pickRandomCover`, `renderCoverStyle`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Download`, `ImageIcon`, `MessageSquare`, `Smile`, `X`
  - `emoji-picker-react` — `EmojiClickData`, `Theme`

## Used by

- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/page.tsx`
