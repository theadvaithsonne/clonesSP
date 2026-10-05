# `app/(dashboard)/thoughts/components/DatabaseViewsSection.tsx`

> React components `Tag`, `TablePreview`, `BoardPreview`, `GalleryPreview` and 30 more.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1115 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Tag`×42 (local), `FileText`×4 (lucide-react), `Link2`×2 (lucide-react), `React` (react), `Crosshair` (lucide-react), `ArrowRight` (lucide-react), `Trash2` (lucide-react), `LayoutGrid` (lucide-react), `Plus` (lucide-react), `RefreshCw` (lucide-react), `User` (lucide-react), `Calendar` (lucide-react), `Bell` (lucide-react), `Image` (lucide-react), `Video` (lucide-react), `Music` (lucide-react), `Paperclip` (lucide-react), `Globe` (lucide-react), `Hexagon` (lucide-react), `Sigma` (lucide-react), `ArrowLeft` (lucide-react), `TablePreview` (local), `BoardPreview` (local), `GalleryPreview` (local), `ListPreview` (local), `CalendarPreview` (local), `TimelinePreview` (local), `ChartPreview` (local), `LinkedViewPreview` (local), `CommentPreview` (local), `DuplicatePreview` (local), `MoveToPreview` (local), `DeletePreview` (local), `TemplatePreview` (local), `ButtonPreview` (local), `SyncedBlockPreview` (local), `PagePreview` (local), `LinkToPagePreview` (local), `MentionPersonPreview` (local), `MentionPagePreview` (local), … +23 more

### Props

- **`Tag`**: `name: string`
- **`TablePreview`**: `onSelect: () => void`
- **`BoardPreview`**: `onSelect: () => void`
- **`GalleryPreview`**: `onSelect: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Tag` | component | `Tag({ name }: { name: string })` | 17 |
| `TablePreview` | component | `TablePreview({ onSelect }: { onSelect: () => void })` | 26 |
| `BoardPreview` | component | `BoardPreview({ onSelect }: { onSelect: () => void })` | 59 |
| `GalleryPreview` | component | `GalleryPreview({ onSelect }: { onSelect: () => void })` | 82 |
| `ListPreview` | component | `ListPreview({ onSelect }: { onSelect: () => void })` | 102 |
| `CalendarPreview` | component | `CalendarPreview({ onSelect }: { onSelect: () => void })` | 125 |
| `TimelinePreview` | component | `TimelinePreview({ onSelect }: { onSelect: () => void })` | 154 |
| `ChartPreview` | component | `ChartPreview({ onSelect }: { onSelect: () => void })` | 174 |
| `LinkedViewPreview` | component | `LinkedViewPreview({ onSelect }: { onSelect: () => void })` | 205 |
| `CommentPreview` | component | `CommentPreview({ onSelect }: { onSelect: () => void })` | 220 |
| `DuplicatePreview` | component | `DuplicatePreview({ onSelect }: { onSelect: () => void })` | 236 |
| `MoveToPreview` | component | `MoveToPreview({ onSelect }: { onSelect: () => void })` | 250 |
| `DeletePreview` | component | `DeletePreview({ onSelect }: { onSelect: () => void })` | 264 |
| `TemplatePreview` | component | `TemplatePreview({ onSelect }: { onSelect: () => void })` | 278 |
| `ButtonPreview` | component | `ButtonPreview({ onSelect }: { onSelect: () => void })` | 292 |
| `SyncedBlockPreview` | component | `SyncedBlockPreview({ onSelect }: { onSelect: () => void })` | 306 |
| `PagePreview` | component | `PagePreview({ onSelect }: { onSelect: () => void })` | 320 |
| `LinkToPagePreview` | component | `LinkToPagePreview({ onSelect }: { onSelect: () => void })` | 339 |
| `MentionPersonPreview` | component | `MentionPersonPreview({ onSelect }: { onSelect: () => void })` | 351 |
| `MentionPagePreview` | component | `MentionPagePreview({ onSelect }: { onSelect: () => void })` | 368 |
| `DatePreview` | component | `DatePreview({ onSelect }: { onSelect: () => void })` | 383 |
| `ReminderPreview` | component | `ReminderPreview({ onSelect }: { onSelect: () => void })` | 401 |
| `TableOfContentsPreview` | component | `TableOfContentsPreview({ onSelect }: { onSelect: () => void })` | 413 |
| `MediaImagePreview` | component | `MediaImagePreview({ onSelect }: { onSelect: () => void })` | 541 |
| `MediaVideoPreview` | component | `MediaVideoPreview({ onSelect }: { onSelect: () => void })` | 555 |
| `MediaAudioPreview` | component | `MediaAudioPreview({ onSelect }: { onSelect: () => void })` | 569 |
| `MediaFilePreview` | component | `MediaFilePreview({ onSelect }: { onSelect: () => void })` | 583 |
| `MediaPDFPreview` | component | `MediaPDFPreview({ onSelect }: { onSelect: () => void })` | 597 |
| `MediaWebPreview` | component | `MediaWebPreview({ onSelect }: { onSelect: () => void })` | 611 |
| `MediaEmbedPreview` | component | `MediaEmbedPreview({ onSelect }: { onSelect: () => void })` | 625 |
| `MediaCodePreview` | component | `MediaCodePreview({ onSelect }: { onSelect: () => void })` | 639 |
| `MediaMathPreview` | component | `MediaMathPreview({ onSelect }: { onSelect: () => void })` | 668 |
| `MediaInlineEquationPreview` | component | `MediaInlineEquationPreview({ onSelect }: { onSelect: () => void })` | 682 |
| `default (DatabaseViewsSection)` | component | `DatabaseViewsSection({ editor, block, onBack, onClose }: DatabaseViewsSectionPro…)` | 697 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowLeft`, `ArrowRight`, `Bell`, `Calendar`, `Crosshair`, `FileText`, …
  - `@blocknote/core` — `insertOrUpdateBlock as _insertOrUpdateBlock`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/CommandsMenu.tsx`
