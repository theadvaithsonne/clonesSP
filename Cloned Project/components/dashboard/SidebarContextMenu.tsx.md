# `components/dashboard/SidebarContextMenu.tsx`

> React component `SidebarContextMenu`.

**Kind:** React component · **Lines:** 476 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuPrimitive`×11 (@radix-ui/react-dropdown-menu), `MenuItem`×8 (local), `MenuSeparator`×3 (local), `SubMenu`×3 (local), `Icon`×2 (local), `MenuLabel`×2 (local), `GroupedPages`×2 (local), `ChevronRight` (lucide-react)

### Props

- **`SidebarContextMenu`**: `getPageState: (popover: string) => NavPageState`, `getLink: (popover: string) => string | null`, `onOpen: (page: Pick<NavNode, "popover" | "href">) => void`, `onOpenInNewTab: (popover: string, label: string) => void`, `onOpenInSidePeek: (popover: string, label: string) => void`, `onCloseTab: (popover: string) => void`

**Hooks used:** `useEffect`×3, `useRef`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OFFICE_PAGE` | const | `= "@office"` — Stands in for the Office home — the Community view with no popover — in `data-nav-popover` and NavNode.popover, so it can have a menu and a tab. | 21 |
| `NavNode` | interface | A page, or a nested group of pages, listed under a sidebar section header. | 24 |
| `navGroup` | function | `navGroup(label: string, items: NavNode[])` — `data-nav-group` value for a section header: its name and the pages under it. | 38 |
| `NavPageState` | interface |  | 40 |
| `default (SidebarContextMenu)` | component | `SidebarContextMenu({ getPageState, getLink, onOpen, onOpenInNewTab, onOpenInSi…)` — Notion-style right-click menu for the sidebar. | 203 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `Fragment`, `useEffect`, `useRef`, `useState`, `ComponentProps`, `CSSProperties`
  - `@radix-ui/react-dropdown-menu`
  - `lucide-react` — `AppWindow`, `ChevronRight`, `ExternalLink`, `Link2`, `PanelRight`, `X`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
