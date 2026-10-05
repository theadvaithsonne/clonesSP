# `components/chat/MessageActions.tsx`

> React components `LongPressDiv`, `MessageActionMenu`, `MessageReactions`, `QuickReactionButton` and 4 more.

**Kind:** React component · **Lines:** 1002 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MenuItem`×11 (local), `Trash2`×3 (lucide-react), `ToolbarIcon`×3 (local), `PortalEmojiPicker`×2 (local), `Smile`×2 (lucide-react), `Forward`×2 (lucide-react), `Copy`×2 (lucide-react), `EmojiPicker` (emoji-picker-react), `ChevronDown` (lucide-react), `Reply` (lucide-react), `MessageSquareText` (lucide-react), `Pin` (lucide-react), `Edit3` (lucide-react), `UserPlus` (lucide-react), `ListX` (lucide-react), `CheckSquare` (lucide-react), `ReactionDetailPopup` (local), `Plus` (lucide-react), `ArrowLeft` (lucide-react), `Check` (lucide-react)

### Props

- **`LongPressDiv`**: `onLongPress: () => void`, `className?: string`, `children: React.ReactNode`, `onClick?: (e: React.MouseEvent) => void`
- **`MessageActionMenu`**: `ctx: MessageActionContext`, `meId: string`, `align?: "left" | "right"`, `forceOpen?: boolean`, `onClose?: () => void`, `triggerVariant?: "default" | "inside"`
- **`MessageReactions`**: `messageId: string`, `meId: string`, `align: "left" | "right"`, `reactions?: Record<string, string[]>`, `onReact?: (emoji: string) => void`, `userMap?: Record<string, ReactionUserInfo>`
- **`QuickReactionButton`**: `messageId: string`, `meId: string`, `openTo: "left" | "right"`, `onReact?: (emoji: string) => void`

**Hooks used:** `useState`×8, `useRef`×6, `useEffect`×4, `useMessageExtras`×2 (lib/messageExtras.ts), `useLongPress` (lib/hooks/useLongPress.ts), `useLayoutEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `QUICK_REACTIONS` | const | `= ["👍", "❤️", "😂", "😮", "😢", "🙏"]` | 102 |
| `LongPressDiv` | component | `LongPressDiv({ onLongPress, className, children, onClick, }: { onLongPre…)` | 105 |
| `MessageActionContext` | type |  | 124 |
| `MessageActionMenu` | component | `MessageActionMenu({ ctx, meId, align = "left", forceOpen, onClose, triggerVar…)` | 162 |
| `ReactionUserInfo` | type |  | 436 |
| `MessageReactions` | component | `MessageReactions({ messageId, meId, align, reactions: reactionsProp, onReact…)` | 571 |
| `QuickReactionButton` | component | `QuickReactionButton({ messageId, meId, openTo, onReact, }: { messageId: string;…)` | 653 |
| `SelectionToolbar` | component | `SelectionToolbar({ count, onCancel, onCopy, onForward, onDelete, }: { count:…)` | 757 |
| `SelectionCheckOverlay` | component | `SelectionCheckOverlay({ selected }: { selected: boolean })` | 840 |
| `ForwardTarget` | type |  | 856 |
| `ForwardDialog` | component | `ForwardDialog({ open, text, targets, onClose, onSend, }: { open: boolean;…)` | 862 |
| `DeleteConfirmDialog` | component | `DeleteConfirmDialog({ open, count, onConfirm, onCancel, }: { open: boolean; cou…)` | 947 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/messageExtras.ts` — `messageExtras`, `useMessageExtras`
  - `lib/hooks/useLongPress.ts` — `useLongPress`
- **Packages:**
  - `react` — `useEffect`, `useLayoutEffect`, `useMemo`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Reply`, `Smile`, `Star`, `Pin`, `Plus`, `Forward`, …
  - `emoji-picker-react` — `EmojiClickData`, `Theme`

## Used by

- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
