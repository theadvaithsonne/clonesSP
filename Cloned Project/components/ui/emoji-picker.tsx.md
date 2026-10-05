# `components/ui/emoji-picker.tsx`

> React component `EmojiPickerComponent`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 136 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button` (components/ui/button.tsx), `Smile` (lucide-react), `EmojiPicker` (emoji-picker-react)

### Props

- **`EmojiPickerComponent`**: `onEmojiSelect: (emoji: string) => void`, `className?: string`, `align?: "left" | "right"`, `width?: string | number`, `height?: string | number`, `open?: boolean`, `onOpenChange?: (open: boolean) => void`, `hideTrigger?: boolean`

**Hooks used:** `useState`×2, `useRef`, `useEffect`, `useLayoutEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EmojiPickerComponent` | component | `EmojiPickerComponent({ onEmojiSelect, className, align = "right", width = 320, h…)` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useLayoutEffect`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Smile`
  - `emoji-picker-react` — `EmojiClickData`

## Used by

- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
- `components/garage-admin/SupportChatsConsole.tsx`
- `components/webinar/ChatPanel.tsx`
