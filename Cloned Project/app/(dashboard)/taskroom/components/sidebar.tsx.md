# `app/(dashboard)/taskroom/components/sidebar.tsx`

> React component `DashboardSidebar`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 751 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Image`×2 (next/image), `Separator`×2 (components/ui/separator.tsx), `Nav`×2 (app/(dashboard)/taskroom/components/nav.tsx), `SidebarContent`×2 (local), `PenSquare` (lucide-react), `TooltipProvider` (components/ui/tooltip.tsx), `Tooltip` (components/ui/tooltip.tsx), `TooltipTrigger` (components/ui/tooltip.tsx), `Link` (next/link), `TooltipContent` (components/ui/tooltip.tsx), `LogOut` (lucide-react), `X` (lucide-react), `Menu` (lucide-react)

**Hooks used:** `useState`×5, `useEffect`×3, `usePathname` (next/navigation), `useIsMobile` (hooks/use-mobile.ts), `useRouter` (next/navigation), `useUIStore` (store/uiStore.tsx), `useSidebarStore` (store/sidebarStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DashboardSidebar` | component | `DashboardSidebar()` | 427 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/uiStore.tsx` — `useUIStore`
  - `store/sidebarStore.tsx` — `useSidebarStore`
  - `hooks/use-mobile.ts` — `useIsMobile`
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/separator.tsx` — `Separator`
  - `app/(dashboard)/taskroom/components/nav.tsx` — `Nav`
  - `components/ui/tooltip.tsx` — `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`
  - `lib/taskroomApps.ts` — `apps`, `getAppMenuItems`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `usePathname`, `useRouter`
  - `lucide-react` — `Building2`, `SquareKanban`, `CreditCard`, `HardDrive`, `LayoutDashboard`, `Lightbulb`, …

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
