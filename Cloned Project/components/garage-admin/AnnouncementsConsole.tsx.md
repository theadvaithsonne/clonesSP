# `components/garage-admin/AnnouncementsConsole.tsx`

> Alerts & Promotions — Admin → Others → Alerts & Promotions.

**Kind:** React component · **Lines:** 1137 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Alerts & Promotions — Admin → Others → Alerts & Promotions.

Authors the dialogs and banners users see on the login screen and inside the
app. Five choices make up an announcement: where it shows, how big it is,
text vs. image + text, which visual template, and where its button goes.

The preview pane renders the SAME component the app renders
(components/announcements/AnnouncementCard), so what an admin approves here
is literally what ships — no second mock to drift out of sync.

Super admin only. Backend: garagenew-backend routes/garageAdminAnnouncements.ts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FieldLabel`×13 (local), `Input`×8 (components/ui/input.tsx), `Chip`×8 (local), `ChoiceTile`×7 (local), `Loader2`×5 (lucide-react), `Button`×4 (components/ui/button.tsx), `Section`×4 (local), `Switch`×4 (components/ui/switch.tsx), `Megaphone`×2 (lucide-react), `ArrowLeft` (lucide-react), `RichTextEditor` (components/ui/rich-text-editor.tsx), `X` (lucide-react), `ImageIcon` (lucide-react), `Upload` (lucide-react), `Glyph` (local), `Ban` (lucide-react), `AnnouncementPreviewStage` (components/garage-admin/AnnouncementPreviewStage.tsx), `AlertTriangle` (lucide-react), `Editor` (local), `Plus` (lucide-react), `RotateCcw` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx)

**Hooks used:** `useState`×9, `useCallback`×3, `useRef`, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AnnouncementsConsole)` | component | `AnnouncementsConsole()` | 826 |

## Interfaces

- **External hosts mentioned in the code:** `garage.app`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/rich-text-editor.tsx` — `RichTextEditor`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/utils.ts` — `cn`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/garage-admin/AnnouncementPreviewStage.tsx` — `AnnouncementPreviewStage (default)`
  - `lib/announcements.ts` — `DEEP_LINK_TARGETS`, `ICON_OPTIONS`, `SIZE_OPTIONS`, `SURFACE_OPTIONS`, `TEMPLATE_OPTIONS`, `emptyAnnouncementDraft`, `Announcement`, `AnnouncementDraft`, … +4
  - `lib/admin-api/announcements.ts` — `createAnnouncement`, `deleteAnnouncement`, `listAnnouncements`, `resetAnnouncementDismissals`, `updateAnnouncement`, `uploadAnnouncementImage`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `AlertTriangle`, `ArrowLeft`, `Ban`, `BellRing`, `CalendarClock`, `Gift`, …

## Used by

- `app/garage-admin/(admin-dashboard)/announcements/page.tsx`
