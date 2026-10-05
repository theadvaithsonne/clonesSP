# `components/dashboard/RecordedLiveStreamPage.tsx`

> React component `RecordedLiveStreamPage`.

**Kind:** React component · **Lines:** 1143 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×11 (lucide-react), `DropdownMenuItem`×4 (components/ui/dropdown-menu.tsx), `Video`×3 (lucide-react), `CheckCircle2`×3 (lucide-react), `StickyNote`×3 (lucide-react), `Play`×2 (lucide-react), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `MoreVertical`×2 (lucide-react), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `Pencil`×2 (lucide-react), `Trash2`×2 (lucide-react), `X`×2 (lucide-react), `Check` (lucide-react), `Send` (lucide-react), `Plus` (lucide-react), `AiNotesSection` (local), `MemoCard` (local)

### Props

- **`RecordedLiveStreamPage`**: `viewRole?: "founder" | "customer"`

**Hooks used:** `useState`×23, `useEffect`×5, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RecordedLiveStreamPage` | component | `RecordedLiveStreamPage({ viewRole }: { viewRole?: "founder" \| "customer" })` | 56 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/note-taker/by-workshop/${encodeURIComponent(notesForWorkshopId!)}/summary` (L205)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/webinar/${realWorkshopId}/recordings` (L282)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L229, L323

## Dependencies

- **Internal:**
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`
  - `lib/feed-api.ts` — `getLearnInitLivestream`, `getLearnInit`, `getPlaylists`, `createPlaylist`, `addVideosToPlaylist`, `quickAddToPlaylist`, `deleteWorkshopRecording`, `getVideoShareLink`, … +5
  - `lib/utils.ts` — `cn`
  - `lib/api/voice-memos.ts` — `voiceMemosApi`, `VoiceMemo`
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Clock`, `Play`, `Search`, `X`, `CheckCircle2`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L523), `dangerouslySetInnerHTML` (L610).
