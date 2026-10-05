# `components/dashboard/service-taskroom/EngagementFilesTab.tsx`

> The "Files" tab of a service engagement, shown when the founder enabled `enableFilesTab`.

**Kind:** React component · **Lines:** 412 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The "Files" tab of a service engagement, shown when the founder enabled
`enableFilesTab`.

One place for every file on the engagement, from three sources that mean
different things and are therefore kept apart:
 - shared with the client (the founder's milestone briefs and deliverables),
 - uploaded by the client,
 - attached to cards in the engagement room.

The list arrives pre-filtered from `GET /services/opt-ins/:id/files`: files on
milestones the client has not unlocked never reach the browser, because the
stored URLs are directly fetchable and hiding the control would not be enough.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Section`×3 (local), `FileRow`×3 (local), `Loader2`×2 (lucide-react), `FileText` (lucide-react), `Eye` (lucide-react), `Download` (lucide-react), `X` (lucide-react), `Icon` (local), `Lock` (lucide-react), `Upload` (lucide-react)

### Props

- **`EngagementFilesTab`**: `optInId: string`, `isFounder?: boolean`, `onOptInUpdated?: (optIn: ServiceOpt) => void`

**Hooks used:** `useState`×5, `useRef`, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EngagementFilesTab` | component | `EngagementFilesTab({ optInId, isFounder = false, onOptInUpdated, }: { optInId:…)` | 149 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/upload` (L217)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/dashboard/ServiceMediaCarousel.tsx` — `formatFileSize`
  - `lib/auth.ts` — `getToken`
  - `lib/feed-api.ts` — `addMilestoneAttachments`, `getEngagementFiles`, `removeMilestoneAttachment`, `EngagementFiles`, `ServiceMilestoneAttachment`, `ServiceOpt`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Download`, `Eye`, `FileText`, `FolderOpen`, `KanbanSquare`, `Loader2`, …
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
