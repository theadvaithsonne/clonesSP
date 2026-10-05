# `components/chat/SlashCommandCards.tsx`

> Renders the rich "slash card" chat bubbles (task, poll, meeting, deal, approval, document, shared product) that slash-command messages decode into.

**Kind:** React component · **Lines:** 968

## Purpose
When a user sends a slash command in chat (`/poll`, `/meet`, `/share`, and formerly `/task`, `/deal`, `/approve`, `/doc`), the composer (`components/chat/SlashCommandForm.tsx`) encodes the data as a marker string via `lib/chat-markers.ts`. When the message is displayed, `components/chat/MessageContent.tsx` decodes the marker and hands the payload to one of the seven card components in this file. The cards are not just static previews: several are interactive and keep live state through the client store `lib/slash-state.ts`, which is updated optimistically on click and by socket echoes (see `lib/hooks/useSlashCardSync.ts`).

## How it works

### Shared shell (L55-L100)
- `CardShell` always draws a dark card (`bg-[#1a1a1f]`) regardless of the bubble colour, so cards stay readable on the gold "own message" bubble. The `isOwn` prop is accepted but currently unused for styling.
- `CardHeader` is the small icon + uppercase label strip with an optional right-hand slot.
- Every clickable element calls `e.stopPropagation()` so clicks on the card do not trigger the surrounding message-bubble handlers.

### TaskCard (L102-L419)
- Shows a Taskroom task: taskroom name, title, description and a 4-column metadata grid (Assignee, Due Date, Priority, Status) built with the private `MetaCell`.
- Live overrides win over the marker snapshot: `useTaskStage(taskId)` and `useTaskAssignee(taskId)` from `lib/slash-state.ts`.
- Taskroom stages are user-defined, so `pickStageId()` maps the "In Progress" and "Mark Done" buttons to a real stage by normalised name (`inprogress`/`doing`/`active`/`wip`, and `done`/`complete`/`completed`/`finished`/`closed`). With no name match it falls back to the second stage (in progress) or the last stage (done).
- `moveStage()` sets the stage optimistically with `slashState.setTaskStage`, then sends `PUT {TASKROOMS_BASE}/v1/tasks/move/<taskId>` with `{ stageId }` for **every** id in `data.taskIds` (a multi-assignee task is N real tasks that move together). On failure it rolls back and shows a toast.
- `reassign()` (only shown when the marker carries `availableAssignees`) sets the assignee optimistically, then sends `PUT {TASKROOMS_BASE}/v1/tasks/<taskId>` with `{ assignedToId }` for every task id. Unlike `moveStage`, a failure does **not** roll back the optimistic assignee.
- "Open in Taskrooms" links to `/taskroom/all-taskrooms?taskroomId=...` in a new tab.
- `statusLabel()` prefers the live stage name and falls back to the legacy `status` enum (`todo`/`inprogress`/`done`) for old cards.

### PollCard (L421-L516)
- Options come from the marker. Votes are kept **only in the current browser** (`usePollVote` / `slashState.togglePollVote`, persisted to localStorage). Single-choice clicks replace the vote (or clear it on a second click); multi-choice clicks toggle.
- The vote count and percentages are simulated: total is 1 if you voted, and your option shows 100%, others 0%. There is no backend tally (the code comments say so).

### MeetCard (L518-L591)
- Shows title, room name, start time, duration, description and invitee count.
- Join URL: `/meet/conference/<orgId>/<roomId>` when the marker has both (a real booked conference room from `MeetForm`); otherwise the legacy `joinCode`, used as is if it is a full URL, else `/meet/<joinCode>`.

### DealCard (L593-L680)
- Shows name, stage badge, formatted value and owner, plus clickable stage pills (`lead`, `qualified`, `proposal`, `won`, `lost`).
- `updateStage()` sets the stage optimistically via `slashState.setDealStage`, then sends `PATCH /backend/slash/deals/<dealId>/stage`. The backend broadcasts `slash:deal-updated` to the org room, which `useSlashCardSync` applies for every viewer. Failure rolls back.

### ApprovalCard (L682-L823)
- Per-approver status list and overall badge come from `useApprovalStatuses` / `useApprovalOverall` (socket-fed cache). Overall defaults to `pending`.
- If `currentUserId` is one of `data.approvers` and has not decided yet, Approve / Reject buttons appear. `decide()` applies the decision optimistically, sends `POST /backend/slash/approvals/<approvalId>/decide` with `{ decision }`, then stores the server-computed `overallStatus`. Failure resets the user back to `pending`.
- The backend rejects repeat decisions with 409 and non-approvers with 403; it recomputes overall as "any reject = rejected, all approved = approved, else pending" and emits `slash:approval-decided` to the org and to the requester.

### DocCard (L825-L893)
- Picks an icon by MIME type (image, video, audio, PDF, other). Shows a thumbnail preview for images or when a `thumbnail` is present, plus Download and Open links to `data.url`.

### ShareCard (L895-L942)
- Whole card is a link to `data.url` (course / webinar / product). Shows image, title, description, price badge ("Free" when the price is missing or 0) and a CTA label per kind: Enroll, Register, Buy now.

### Helpers (L944-L967)
`formatDate`, `formatMoney` (Intl currency, falls back to `"<CUR> <value>"` for an invalid currency code), `formatBytes`, plus `formatDateLong` and `priorityColor` for the task card.

## Exports
- `TaskCard({ data: TaskCardData, isOwn? })` - Taskroom task card with stage and reassign actions.
- `PollCard({ data: PollCardData, isOwn? })` - poll with local-only voting.
- `MeetCard({ data: MeetCardData, isOwn? })` - meeting/booking card with Join link.
- `DealCard({ data: DealCardData, isOwn? })` - deal card with live stage pills.
- `ApprovalCard({ data: ApprovalCardData, isOwn?, currentUserId? })` - approval request with approve/reject for approvers.
- `DocCard({ data: DocCardData, isOwn? })` - shared file card.
- `ShareCard({ data: ShareCardData, isOwn? })` - shared course/webinar/product card.

## Interfaces
- **Backend endpoints called:**
  - `PATCH /backend/slash/deals/:id/stage` - change a deal's stage (org-scoped).
  - `POST /backend/slash/approvals/:id/decide` - record the viewer's approve/reject decision.
- **External services:** Taskrooms API at the hardcoded `https://uatapi.garage.app/taskroom` (`PUT /v1/tasks/move/:id`, `PUT /v1/tasks/:id`), called with the user's Garage bearer token.
- **Socket.IO events:** none directly; the live state it reads is fed by `slash:deal-updated`, `slash:approval-decided` and `slash:task-updated` handled in `lib/hooks/useSlashCardSync.ts`.
- **Browser storage / cookies:** indirectly, localStorage key `garage_slash_state_v1` via `lib/slash-state.ts` (poll votes, stage/assignee/approval overrides).

## Dependencies
- **Internal:** `lib/chat-markers.ts` - card data types; `lib/slash-state.ts` - live overrides and their setters; `lib/api.ts` - `api()` wrapper that prefixes `NEXT_PUBLIC_API_URL`; `lib/auth.ts` - `getToken()`; `lib/utils.ts` - `cn`; `components/ui/dropdown-menu.tsx` - reassign menu.
- **Packages:** `react` (state), `sonner` (toasts), `lucide-react` (icons).

## Used by
- `components/chat/MessageContent.tsx` - picks the card by decoded marker type.

## Notes
- `TASKROOMS_BASE` points at the older `/taskroom` v1 API on the UAT host, while newer Taskroom code (e.g. `TaskroomLinkPicker.tsx`) uses `NEXT_PUBLIC_TASKROOM_URL`. Task cards created today may therefore talk to a different Taskroom deployment than the rest of the app.
- Poll results are not shared between users; every viewer only sees their own vote.
- The `/task`, `/deal`, `/approve` and `/doc` composer forms are disabled, but these cards still render older messages that carry those markers.
