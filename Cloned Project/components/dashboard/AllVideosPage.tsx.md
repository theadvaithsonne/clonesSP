# `components/dashboard/AllVideosPage.tsx`

> React component `AllVideosPage`.

**Kind:** React component · **Lines:** 774 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Video`×4 (lucide-react), `Play`×4 (lucide-react), `Loader2`×3 (lucide-react), `Clock`×3 (lucide-react), `ListVideo`×3 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `X` (lucide-react)

**Hooks used:** `useState`×11, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AllVideosPage` | component | `AllVideosPage()` | 36 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/drops?orgId=${orgId}&limit=15` (L87)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/webinar/${realWorkshopId}/recordings` (L218)
  - `GET ${apiUrl}/webinar/${video._id}/recordings` (L327)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L307

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getLearnInitLivestream`, `getPlaylists`, `getStandaloneVideos`, `getVideoShareLink`, `getPlaylistShareLink`, `getStandaloneVideoStreamUrl`, `getCourseVideoStreamUrl`, `Workshop`, … +2
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getOrgId`, `getUserIdFromToken`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Video`, `Play`, `Clock`, `Share2`, `MoreVertical`, `ListVideo`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L442).
