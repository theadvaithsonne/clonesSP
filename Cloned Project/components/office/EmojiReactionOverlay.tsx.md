# `components/office/EmojiReactionOverlay.tsx`

> React component `EmojiReactionOverlay`.

**Kind:** React component · **Lines:** 34 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion)

### Props

- **`EmojiReactionOverlay`**: `reactions: EmojiReaction[]`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EmojiReactionOverlay)` | component | `EmojiReactionOverlay({ reactions }: EmojiReactionOverlayProps)` | 10 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `hooks/office/useEmojiReactions.ts` — `EmojiReaction`, `(types only)`
- **Packages:**
  - `framer-motion` — `AnimatePresence`, `motion`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
