# `components/dashboard/AppTabBar.tsx`

> React component `AppTabBar`.

**Kind:** React component · **Lines:** 279 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `AnimatePresence` (framer-motion), `React` (react), `X` (lucide-react), `Plus` (lucide-react), `NewTabPicker` (components/dashboard/NewTabPicker.tsx), `User` (lucide-react)

### Props

- **`AppTabBar`**: `className?: string`, `tabs: string[]`, `tabSet?: TabSet`, `activeTab: string | null`, `getTabLabel?: (tab: string) => string`, `onSelectTab: (tab: string) => void`, `onCloseTab: (tab: string) => void`, `onNewTab: (tab: string) => void`, `canGoBack: boolean`, `canGoForward: boolean`, `onBack: () => void`, `onForward: () => void`, `collapsed: boolean`, `onToggleSidebar: () => void`, `onToggleRightPanel?: () => void`, `rightPanelCollapsed?: boolean`, `me?: { id?: string; _id?: string; profilePicture?: string; name?: str…`, `children?: React.ReactNode`

**Hooks used:** `useState`×2, `useRef`, `useChat` (lib/chat-context.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AppTabBar)` | component | `AppTabBar({ className, tabs, tabSet = "main", activeTab, getTabLabel,…)` | 40 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/dashboard/NewTabPicker.tsx` — `NewTabPicker (default)`
  - `lib/chat-context.tsx` — `useChat`
  - `lib/founderPages.ts` — `TabSet`, `(types only)`
- **Packages:**
  - `react` — `useRef`, `useState`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`, `Plus`, `X`, `User`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`
