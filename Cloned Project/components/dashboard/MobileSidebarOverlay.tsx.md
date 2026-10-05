# `components/dashboard/MobileSidebarOverlay.tsx`

> React component `MobileSidebarOverlay`.

**Kind:** React component · **Lines:** 189 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `MainSidebar` (components/dashboard/MainSidebar.tsx)

### Props

- **`MobileSidebarOverlay`**: `activePopover: string | null`, `setActivePopover: (popover: string | null) => void`, `activeContainer: string | null`, `setActiveContainer: (container: string | null) => void`, `teamforceSection?: string`, `setTeamforceSection?: (section: string) => void`, `dealsSection?: | "dashboard" | "leads" | "funnel" | "contacts" | "com…`, `setDealsSection?: ( section: | "dashboard" | "leads" | "funnel" | "co…`, `networkMailSection?: "template-library" | "campaigns" | "reports" | "…`, `setNetworkMailSection?: ( section: "template-library" | "campaigns" |…`, `thoughtsSection?: "all-notes" | "starred" | "templates" | "archive" |…`, `setThoughtsSection?: ( section: "all-notes" | "starred" | "templates"…`, `activeChatId: { type: "dm" | "group" | "global-dm"; id: string }`, `setActiveChatId: (chatId: { type: "dm" | "group" | "global-dm"; id: s…`, `setIsProfileOpen: (open: boolean) => void`, `setIsFirstTimeUser: (firstTime: boolean) => void`, `isActivityOpen: boolean`, `setIsActivityOpen: (open: boolean) => void`, `setIsAskCabinetOpen?: (open: boolean) => void`, `className?: string`

**Hooks used:** `useMobileSidebar` (lib/mobile-sidebar-context.tsx), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MobileSidebarOverlay)` | component | `MobileSidebarOverlay({ activePopover, setActivePopover, activeContainer, setActi…)` | 55 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/mobile-sidebar-context.tsx` — `useMobileSidebar`
  - `components/dashboard/MainSidebar.tsx` — `MainSidebar (default)`
- **Packages:**
  - `react` — `useEffect`
  - `framer-motion` — `AnimatePresence`, `motion`

## Used by

- `app/(dashboard)/layout.tsx`
