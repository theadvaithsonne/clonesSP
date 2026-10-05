# `components/dashboard/ServiceEngagementView.tsx`

> React component `ServiceEngagementView`.

**Kind:** React component · **Lines:** 1114 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×7 (lucide-react), `Lock`×4 (lucide-react), `Check`×3 (lucide-react), `X`×2 (lucide-react), `FileText`×2 (lucide-react), `MessageCircle`×2 (lucide-react), `Hourglass` (lucide-react), `ExternalLink` (lucide-react), `EngagementActivityPanel` (components/dashboard/service-taskroom/EngagementActivityPanel.tsx), `Upload` (lucide-react), `Eye` (lucide-react), `Send` (lucide-react), `Shield` (lucide-react), `Activity` (lucide-react), `Download` (lucide-react), `AlertTriangle` (lucide-react), `Clock` (lucide-react)

### Props

- **`ServiceEngagementView`**: `optIn: ServiceOpt`, `service: Service | null`, `formatCurrency: (value: number, currency?: string) => string`, `onPayMilestone: (milestoneId: string) => void`, `payingMilestoneId: string | null`, `isFounder?: boolean`

**Hooks used:** `useState`×11, `useMemo`×3, `useCallback`×3, `useEffect`×3, `useRef`×2, `useTaskroomWorkspacetore` (store/taskroom/taskroomWorkspace.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ServiceEngagementView` | component | `ServiceEngagementView({ optIn, service, formatCurrency, onPayMilestone, payingMil…)` | 142 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/upload` (L328)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `wa.me`

## Dependencies

- **Internal:**
  - `components/dashboard/ServiceMediaCarousel.tsx` — `formatFileSize`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getServiceMilestoneMessages`, `postServiceMilestoneMessage`, `getTeamMembers`, `Service`, `ServiceOpt`, `MilestoneProgress`, `addMilestoneAttachments`, `removeMilestoneAttachment`, … +3
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/service-taskroom/EngagementActivityPanel.tsx` — `EngagementActivityPanel`
  - `store/taskroom/taskroomWorkspace.tsx` — `useTaskroomWorkspacetore`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Activity`, `AlertTriangle`, `Check`, `Clock`, `Download`, `Eye`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/ServicesPage.tsx`
