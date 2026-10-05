# `app/(dashboard)/thoughts/types.ts`

> Types for the Thoughts (Notes) application

**Kind:** Next.js app-directory module (colocated) · **Lines:** 255

<!-- docgen:auto -->

## Purpose
Types for the Thoughts (Notes) application

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Note` | interface |  | 3 |
| `NotePageComment` | interface |  | 38 |
| `NoteBreadcrumbItem` | interface |  | 46 |
| `NoteColor` | interface |  | 54 |
| `CreateNoteData` | interface |  | 60 |
| `UpdateNoteData` | interface |  | 70 |
| `NoteFilter` | interface |  | 86 |
| `NotesResponse` | interface |  | 95 |
| `NoteVersion` | interface |  | 102 |
| `NoteVersionsResponse` | interface |  | 120 |
| `RestoreVersionResponse` | interface |  | 126 |
| `NoteActions` | interface |  | 132 |
| `ViewMode` | type |  | 142 |
| `SortBy` | type |  | 143 |
| `SortOrder` | type |  | 144 |
| `NOTE_COLORS` | const | `= [ { name: "Default", value: "#ffffff", class: "bg-white border border-gray-200" }, { na…` | 147 |
| `getColorClass` | function | `getColorClass(color: string): string` | 163 |
| `formatDate` | function | `formatDate(dateString: string): string` | 169 |
| `truncateText` | function | `truncateText(text: string, maxLength: number = 100): string` | 189 |
| `extractTextFromBlocks` | function | `extractTextFromBlocks(content: string): string` | 195 |
| `getNotePreview` | function | `getNotePreview(content: string, maxLength: number = 300): string` | 252 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/(dashboard)/thoughts/archive/page.tsx`
- `app/(dashboard)/thoughts/components/ColorPicker.tsx`
- `app/(dashboard)/thoughts/components/NoteCard.tsx`
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/components/NoteEditor.tsx`
- `app/(dashboard)/thoughts/components/NotePageHoverCard.tsx`
- `app/(dashboard)/thoughts/components/NoteViewer.tsx`
- `app/(dashboard)/thoughts/components/VersionHistory.tsx`
- `app/(dashboard)/thoughts/page.tsx`
- `app/(dashboard)/thoughts/recovery/page.tsx`
- `app/(dashboard)/thoughts/starred/page.tsx`
- `app/(dashboard)/thoughts/trash/page.tsx`
- `lib/thoughts-events.ts`
