# `components/athena/components/stage-summary-dialog.tsx`

> Modal that loads a summary of every card in one Taskroom kanban stage, groups the cards by assignee, and can export that summary as plain text, PDF or DOCX.

**Kind:** React component · **Lines:** 518

## Purpose
In the Athena/Taskroom kanban board, each column (stage) can open a "Summary" view. This component fetches that stage's summary from the external Taskroom API and shows headline stats (total, completed, assignees, overdue), then each assignee's cards with tags and checklist progress. Users can copy the summary to the clipboard or download it as PDF or Word for status reports.

## How it works

### Data fetch (L123-L145)
When `isOpen` becomes true (or `stageId` changes), it calls `GET ${NEXT_PUBLIC_TASKROOM_URL}stages/summery/{stageId}` (the spelling "summery" is part of the endpoint) with `Authorization: Bearer <localStorage.garage_tok>`. If the token is missing it shows a toast and stops. The response type is `StageSummaryResponse`: `stageData` plus `data[]`, where each entry has `individual_members`, `group_members` and `unassigned` lists.

### Grouping (`groupByAssignee`, L147-L176)
- `individual_members`: the first `assigneeData` entry becomes the group; its `cards` are used as they are (only the first occurrence per user is kept).
- `group_members` (cards with several assignees): every assignee gets a group and the cards are pushed into each, so a shared card appears under each of its assignees.
- `unassigned`: each item is a card. It is keyed by the card's own `_id`, so every unassigned card gets its own "Unassigned" group (initials `Un`) rather than one shared group.
Initials are the first letters of up to two name words.

### Stats (L178-L188)
`getStats()` flattens all grouped cards and counts total, `isCompleted`, groups and `isOverDue`. Cards in several groups are counted more than once.

### Exports
- `copyToClipboard` (L190-L208): writes an indented text outline (card status, checklist names and items) with `navigator.clipboard`.
- `handleSharePdf` (L210-L249): builds a PDF with `jsPDF`, wrapping long titles with `splitTextToSize` and adding pages when near the bottom; saves `Summary-<stage>.pdf`.
- `handleShareDocx` (L251-L278): builds a `docx` document (H1 title, H2 per assignee, bulleted cards and checklist items at levels 0-2) and saves `Summary-<stage>.docx` via `file-saver`.
All three use `card.title` for the card label.

### Rendering (L280-L517)
Returns `null` when closed. Otherwise it draws a fixed overlay (click outside closes) styled with inline style objects (`s`, `btnBase`) instead of Tailwind. While loading it shows `StageSummarySkeleton`; on error a red message; otherwise the stats row and the groups. Each card shows a status dot, title, tag badges and each checklist with a progress bar and items. Small inline components (`StatusDot`, `CheckBox`, `Avatar`) are defined inside the render. Avatar colours rotate through `AVATAR_COLORS`. The footer has the Copy text / PDF / DOCX buttons, disabled until data is loaded.

## Exports
- `StageSummaryDialog({ stageId, stageName, isOpen, onClose, baseUrl? })` - the summary modal. `stageName` is the fallback title until data loads.

## Interfaces
- **Backend endpoints called:** `GET {NEXT_PUBLIC_TASKROOM_URL}stages/summery/{stageId}` - external Taskroom API, stage summary grouped by assignee.
- **External services:** Taskroom v2 API (uatapi.garage.app).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - API base (expected to end in `/`; there is no fallback here).
- **Browser storage / cookies:** reads `garage_tok` from `localStorage`.

## Dependencies
- **Packages:** `jspdf` - PDF export; `docx` - Word export; `file-saver` - triggers the DOCX download; `sonner` - toasts; `lucide-react` - icons; `react` - state and effects.

## Used by
`components/athena/components/kanban-column.tsx` (opened from a column's menu). A stale copy in `kanban-columnbacvkup.txt` also references it.

## Notes
- The `baseUrl` prop (default `https://uatapi.garage.app/flowboard`) is never used; the fetch always uses `NEXT_PUBLIC_TASKROOM_URL`.
- The progress bar width for every checklist on a card uses the card-wide percentage, not that checklist's own ratio.
- Several imported icons (`Check`, `UserPlus`, `Archive`, `Send`) are unused.
- There is no `"use client"` directive; it works because the importing components are client components.
