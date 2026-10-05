# `components/dashboard/backOfficeAppSideBar.tsx`

> React component `BackOfficeAppSidebar`.

**Kind:** React component · **Lines:** 933 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SidebarItem`×5 (local), `Image` (next/image), `Briefcase` (lucide-react), `ChartColumn` (lucide-react), `FolderOpen` (lucide-react), `UserCheck` (lucide-react), `BadgePercent` (lucide-react), `NotesIcon` (local), `Mailbox` (lucide-react), `Cloud` (lucide-react), `FileSignature` (lucide-react), `Link` (next/link)

### Props

- **`BackOfficeAppSidebar`**: `setActivePopover: (value: string | null) => void`, `activePopover: string | null`, `setActiveContainer?: (value: string | null) => void`, `activeContainer?: string`, `teamforceSection?: string`, `setTeamforceSection?: (section: string) => void`, `dealsSection?: string`, `setDealsSection?: ( section: | "dashboard" | "leads" | "funnel" | "co…`, `networkMailSection?: string`, `setNetworkMailSection?: ( section: "template-library" | "campaigns" |…`, `thoughtsSection?: string`, `setThoughtsSection?: ( section: "all-notes" | "starred" | "templates"…`

**Hooks used:** `useState`×10, `useEffect`×6, `useRouter` (next/navigation), `usePathname` (next/navigation), `useSearchParams` (next/navigation), `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useTaskroomWorkspacetore` (store/taskroom/taskroomWorkspace.tsx), `useUserStore` (store/athena/userStore.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BackOfficeAppSidebar)` | component | `BackOfficeAppSidebar({ setActivePopover, activePopover, setActiveContainer, acti…)` | 183 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/taskroomSiderBar.tsx` — `TaskroomSidebar`
  - `components/dashboard/TaskroomWorkspace.tsx` — `TaskroomWorkspace`
  - `store/taskroom/taskroomWorkspace.tsx` — `useTaskroomWorkspacetore`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
  - `store/athena/userStore.ts` — `useUserStore`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/auth.ts` — `getUserIdFromToken`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getEmployee`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useRouter`, `usePathname`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `LogOut`, `Plus`, `ChevronLeft`, `TrendingUp`, `UserPlus`, `LayoutDashboard`, …

## Used by

- `components/dashboard/MainSidebar.tsx`
