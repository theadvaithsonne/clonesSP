# `components/dashboard/ContentPage.tsx`

> React component `ContentPage`.

**Kind:** React component · **Lines:** 2660 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Video`×10 (lucide-react), `X`×9 (lucide-react), `Loader2`×8 (lucide-react), `ListVideo`×7 (lucide-react), `Play`×6 (lucide-react), `CheckCircle2`×5 (lucide-react), `Trash2`×5 (lucide-react), `Upload`×4 (lucide-react), `DropdownMenuItem`×4 (components/ui/dropdown-menu.tsx), `Edit`×4 (lucide-react), `Plus`×4 (lucide-react), `ImageIcon`×3 (lucide-react), `BookOpen`×3 (lucide-react), `Save`×2 (lucide-react), `LinkIcon`×2 (lucide-react), `CheckCircle`×2 (lucide-react), `AlertTriangle`×2 (lucide-react), `EyeOff`×2 (lucide-react), `Eye`×2 (lucide-react), `Clock`×2 (lucide-react), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `MoreVertical`×2 (lucide-react), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `ShareButton`×2 (local), `ListPlus`×2 (lucide-react), `Music`×2 (lucide-react), `Icon` (local), `Search` (lucide-react), `Check` (lucide-react), `Send` (lucide-react), `GripVertical` (lucide-react), `Settings2` (lucide-react), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), … +5 more

### Props

- **`ContentPage`**: `initialSection?: "videos" | "playlists"`, `viewRole?: "founder" | "customer"`

**Hooks used:** `useState`×57, `useEffect`×16, `useRef`×5

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ContentPage` | component | `ContentPage({ initialSection = "videos", viewRole = "customer" }: Conte…)` | 1170 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/webinar/${id}/recordings` (L1370)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `lfv_viewMode` (localStorage: get/set), `lfv_sortOrder` (localStorage: get/set), `lfv_customOrder` (localStorage: get/set), `lfv_hiddenIds` (localStorage: get/set), `garage_tok` (localStorage: get), `garage_org_id` (localStorage: get), `open_playlist_id` (localStorage: get/remove), `target_video_id` (localStorage: get/remove)
- **Timers / queues:** `setTimeout` at L608, L1394
- **External hosts mentioned in the code:** `www.youtube.com`, `player.vimeo.com`, `youtube.com`, `vimeo.com`

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getPlaylists`, `getPlaylist`, `createPlaylist`, `updatePlaylist as updatePlaylistApi`, `deletePlaylist as deletePlaylistApi`, `addVideosToPlaylist`, `removeVideoFromPlaylist`, `quickAddToPlaylist`, … +28
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `lucide-react` — `BookOpen`, `Clock`, `Play`, `Search`, `X`, `ArrowLeft`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Large file (2660 lines) — read it by section; line numbers above point into it.
