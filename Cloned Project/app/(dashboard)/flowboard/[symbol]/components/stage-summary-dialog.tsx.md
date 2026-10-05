# `app/(dashboard)/flowboard/[symbol]/components/stage-summary-dialog.tsx`

> A modal that fetches a Flowboard stage (Kanban column) summary from the external Flowboard API, groups the stage's cards by assignee, and lets the user copy it as text or download it as a PDF or DOCX.

**Kind:** Next.js app-directory module (colocated, client component) · **Lines:** 624

## Purpose
Flowboard is the Kanban/task-board feature of Garage (route `/flowboard/[symbol]`). Each column header in the board has a "share" button; clicking it opens this dialog. The dialog gives a readable report of the stage: who is working on which card, each card's tags, and its checklists with item completion. The report can be pasted into chat or shared as a file. All data comes from the Flowboard service at `https://uatapi.garage.app/flowboard`, which is an external service and not part of this repo's Express backend.

## How it works

### Local types (L15-L94)
The file declares its own response shapes rather than importing shared types:
- `ChecklistItem`, `ChecklistData`, `Card` (`_id`, `name`, `isCompleted`, `isOverDue`, `checklistData[]`, `tagData[]`, ...).
- `IndividualMember` / `AssigneeInfo` - a set of cards plus the `assigneeData` user records.
- `StageSummaryResponse` - `{ status, stageData: { _id, name, cardCount }, data: [{ individual_members, group_members, unassigned }] }`.
- `AssigneeGroup` - the normalised view used for rendering and export: `{ userId, name, initials, cards }`.
- `JwtPayload` is declared but never used (as are the `Cookies` import and the commented-out spinner imports).

### Loading skeleton (L96-L128)
`StageSummarySkeleton` renders three placeholder assignee blocks with nested card/checklist placeholders using the shared `Skeleton` component.

### Fetching (L141-L176)
Whenever `isOpen` becomes true (or `stageId` / `baseUrl` change while open) the effect:
1. Reads the bearer token from `localStorage["garage_tok"]`. If it is missing it shows a `sonner` error toast ("Authentication token missing") and stops.
2. Calls `GET {baseUrl}/v1/stages/summery/{stageId}` (note the backend's spelling "summery") with `Authorization: Bearer <token>`.
3. Stores the JSON in `data`; non-OK responses or thrown errors set `error`, which replaces the content area with a red message.

The data is re-fetched each time the dialog opens; there is no cache.

### Grouping by assignee (`groupByAssignee`, L178-L268)
Flattens the three buckets the API returns into one list of `AssigneeGroup`s keyed by user id:
- **individual_members** - uses only the first `assigneeData` entry; the first member seen for a user sets that user's card list (later members for the same user are ignored, not merged).
- **group_members** - for cards shared by several people, every assignee in `assigneeData` gets the member's cards appended, so a shared card appears under each assignee.
- **unassigned** - each entry is itself a card; it is grouped under the card's own `_id` with name "Unassigned" and initials "Un". Because the key is the card id, each unassigned card becomes its own "Unassigned" group rather than one combined group.

Initials are the first letters of up to two name words, upper-cased.

### Export actions
- **Copy Text** (`copyToClipboard`, L270-L304) builds a plain-text outline: title, one block per assignee (`initials name`), cards marked `✓`/`○`, then checklist names and items marked "completed" or "○pen". Writes it with `navigator.clipboard.writeText` and shows a success toast.
- **Share as PDF** (`handleSharePdf`, L306-L380) uses `jsPDF`: an 18pt title, a subtitle, then per-assignee headings, `[Completed]`/`[Open]` card lines wrapped to 180 units with `splitTextToSize`, and indented checklist lines. A small `checkPageBreak` helper adds pages when the cursor nears the bottom margin. Saves as `Summary-<stage name>.pdf`.
- **Share as DOCX** (`handleShareDocx`, L382-L467) uses the `docx` library: Heading 1 title, Heading 2 per assignee, bulleted card lines (bold) at level 0, checklist names at level 1 and checklist items at level 2. `Packer.toBlob` produces the file and `file-saver`'s `saveAs` downloads `Summary-<stage name>.docx`.

All three buttons are disabled while loading or when there is no data.

### Rendering (L469-L623)
Returns `null` when closed. Otherwise a fixed full-screen overlay holds a card (max width 2xl, max height 80vh) with a header (stage name from the response, falling back to the `stageName` prop, plus a close button), a scrollable body (skeleton, error, or the grouped list with initials avatar, card names, tag chips using `tag.name || tag`, and read-only checkboxes for checklist items with completed items struck through) and the footer with the three export buttons. The close "X" is the only way to dismiss; clicking the backdrop does nothing.

## Exports
- `StageSummaryDialog({ stageId, stageName, isOpen, onClose, baseUrl? })` - the modal component. `baseUrl` defaults to `https://uatapi.garage.app/flowboard`.

## Interfaces
- **External services:** Flowboard API (`https://uatapi.garage.app/flowboard`) - `GET /v1/stages/summery/{stageId}`.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` (the Garage JWT, set by several login/redirect pages) for the bearer token.

## Dependencies
- **Internal:** `components/ui/button.tsx` - footer buttons; `components/ui/skeleton.tsx` - loading placeholders.
- **Packages:** `react` (state/effects), `lucide-react` (X, Copy, FileText icons), `sonner` (toasts), `jspdf` (PDF export), `docx` (Word export), `file-saver` (download the DOCX blob), `js-cookie` (imported but unused).

## Used by
- `app/(dashboard)/flowboard/[symbol]/components/kanban-column.tsx` - rendered in each column header, opened by the share (Share2) button with `stageId={column._id}` and `stageName={column.name}`. Reached through the `/flowboard/[symbol]` board page.

## Notes
- The API URL is hard-coded to the UAT Flowboard host; there is no environment variable for it.
- `groupByAssignee` runs on every render and again for each export; fine for small stages.
- The text export prints "○pen" (with a circle character) for open checklist items, which looks like a typo but is the actual output.
- `console.log("responseData", ...)` is left in `groupByAssignee`.
