# `components/feed/ArticleEditor.tsx`

> React component `ArticleEditor`.

**Kind:** React component · **Lines:** 416 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ToolbarButton`×8 (local), `ToolbarDivider`×2 (local), `Check` (lucide-react), `Unlink` (lucide-react), `X` (lucide-react), `BubbleMenu` (@tiptap/react/menus), `LinkInput` (local), `Bold` (lucide-react), `Italic` (lucide-react), `Strikethrough` (lucide-react), `Code` (lucide-react), `Heading2` (lucide-react), `Heading3` (lucide-react), `Quote` (lucide-react), `LinkIcon` (lucide-react), `EditorContent` (@tiptap/react)

### Props

- **`ArticleEditor`**: `initialContent?: string`, `onChange: (html: string) => void`, `placeholder?: string`

**Hooks used:** `useEffect`×3, `useState`×2, `useRef`×2, `useCallback`×2, `useMemo`, `useEditor` (@tiptap/react)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ArticleEditor` | component | `ArticleEditor({ initialContent = "", onChange, placeholder = "Write your …)` | 214 |

## Interfaces

- **Timers / queues:** `setTimeout` at L146, L276

## Dependencies

- **Internal:**
  - `components/feed/article-editor.css` (side effect)
- **Packages:**
  - `@tiptap/react` — `useEditor`, `EditorContent`, `BubbleMenu`
  - `@tiptap/starter-kit`
  - `@tiptap/extension-link`
  - `@tiptap/extension-placeholder`
  - `react` — `useState`, `useCallback`, `useEffect`, `useRef`, `useMemo`
  - `lucide-react` — `Bold`, `Italic`, `Strikethrough`, `Heading2`, `Heading3`, `Quote`, …

## Used by

- `components/feed/InlinePostComposer.tsx`
