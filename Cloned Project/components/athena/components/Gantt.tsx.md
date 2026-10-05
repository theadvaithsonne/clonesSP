# `components/athena/components/Gantt.tsx`

> The Gantt-chart tab of the Athena project-management panel: shows a room's tasks, grouped by stage, as date bars on a month, week or day timeline, with drag-to-reschedule and click-to-create.

**Kind:** React component · **Lines:** 1123

## Purpose
Athena shows a taskroom room's tasks in several views: Board, Calendar, List, Gantt and others. The views share one set of stages ("columns") and their task cards, held in `useTaskroomWorkspacetore`. This view lays the stages and cards out as rows against a calendar grid. A user can:
- see task durations, overdue tasks and subtask progress;
- drag or resize a bar to change the task's `startDate` and `dueDate`;
- click an empty day cell to quick-create a task due that day.

Task data lives in the external Taskroom service. All writes go through `useCardStore`.

## How it works

### Helpers (L32-L128)
- **Date maths:** day-based millisecond helpers (`DAY_MS`, `startOfDayMs`, `addDays`, `startOfMonthMs`, `startOfWeekSundayMs`, `daysInMonth`) and formatters. Weeks start on Sunday.
- **`priorityColor` / `priorityLabel`:** map `urgent`, `high`, `normal` and `low` to red, amber, blue and slate.
- **`isOverdue(card)`:** true when the card is not completed and its `dueDate` is in the past.
- **`formatQuickDueTimeLabel`:** formats a time label such as `12:00am` for the quick-create box.
- **`transformCardCustom(card, stageId)`:** converts a task returned by the API into the store's `Card` shape:
  - `title` becomes `name`;
  - tag objects become an array of tag IDs (`tags`) plus the full tag objects (`tagData`);
  - assignee IDs, checklist, comment count and `TaskDataCount` subtask counts are carried over.

### Store wiring and context (L132-L170)
- Reads `columns` and `setColumns` from `useTaskroomWorkspacetore`. Also reads `createCard` and `updateCard` from `useCardStore`, `currentWorkspace` from `useWorkspaceStore`, and `memberData` from the board store.
- `roomId`, `workspaceId` and `Idspace` come from the store. On a shared-task link, where `shareTask` is present in the URL, they come from the `roomId`, `workspaceId` and `spaceId` query parameters instead.
- **Read-only mode:** `isReadOnly = isRoomObserver(currentRoomDetail, roomMemberData ?? memberData)`. Users whose room role is `observer` can view the chart but cannot drag bars, resize them or create tasks.
- **Layout constants:**
  - row height 36px;
  - label column 260px;
  - header 56px;
  - column width 36px (month view), 84px (week view) or 220px (day view).

### Visible period and navigation (L171-L217, L253-L277)
- `viewMode` (`month` | `week` | `day`) and `anchorDate` together define the visible period.
- `viewStart` and `viewDays` give exactly one month, one week (7 days) or one day. The `days` array has one timestamp per column.
- `shiftView(±1)` moves by exactly one period, and "Today" resets the anchor.
- `toolbarLabel` shows the visible range.
- `monthGroups` builds the upper header row.
- `todayIdx` places the yellow "today" line and highlights today's column.

### Local card cache (L219-L251)
- `localCards` maps each card ID to a copy of the card with its `stageId` added. A drag updates this cache, so bars move before the server confirms.
- Whenever `columns` changes, fresh store data is merged over the cache.
- `lastRowStageIdRef` remembers the last stage row the user touched. Quick-create uses it as the default stage.

### Quick create (L282-L376, L988-L1120)
1. **Opening:** clicking a day header cell, or any grid cell in a stage or card row, calls `openCreateForDate(date, stageId?)`. This does nothing for observers. It resets the form, sets the due date to the start of that day, and picks the stage from the clicked row. Without a row, it falls back to the last touched stage or the first stage.
2. **Modal:** a fixed bottom modal shows:
   - an autofocused title textarea;
   - a `CustomDatePicker` button for start and due dates;
   - a stage `Select`;
   - `TagPicker` (scoped to `workspaceId` and `Idspace`), `AssigneePicker` and `PriorityPicker`;
   - a Save button.

   Clicking the backdrop closes the modal and resets the form.
3. **Validation:** `handleSaveCard` requires a stage, a title, a `roomId` and a due date.
4. **Create:** it then calls `createCard({ stageId, title, roomId, startDate, dueDate, description, priority (defaults to "normal"), tags, assignedToIds, timeEstimate? })`.
5. **On success:** it puts the transformed card at the top of the stage's list (matching the server's newest-first order), increments `localCardCount`, and closes the modal.

### Drag and resize (L378-L486)
- Each bar has three grab targets:
  - the bar body (`move`);
  - a right handle (`resize-end`);
  - a left handle (`resize-start`).

  The handles are hidden when the bar runs off the visible period on that side, and for observers.
- **Mouse down** records the starting X position and the saved dates. A bar with only one date is treated as one day long.
- **While dragging,** the window `mousemove` handler converts pixel movement into whole days (`Math.round(dx / colW)`):
  - **Move** shifts both dates.
  - **Resize-end** changes the due date and never makes the bar shorter than one day.
  - **Resize-start** changes the start date with the same one-day minimum.
- Re-renders happen only when the bar crosses a day boundary, at most once per animation frame. The latest dates are also kept in `dragFinalRef`, so `onUp` can read them without waiting for React state.
- **Mouse up:**
  - If the dates did not change (a click, or a drop at the starting position), nothing is saved.
  - Otherwise the component calls `updateCard(cardId, { startDate, dueDate, socketId: undefined })`, then writes the new dates into the shared `columns` so other Athena views stay in sync.
  - If the save fails, it shows a toast and rolls the bar back to the saved dates.
- `dragCleanupRef` removes the window listeners. It runs when a new drag starts and when the component unmounts.

### Scroll-to-task (L488-L560)
- Clicking a card's label calls `scrollToCard`:
  - **Bar in the visible period:** the grid scrolls horizontally so the bar is about one third of the way across.
  - **Bar outside the visible period:** the view first jumps to the period that contains the bar's start. The card ID is saved in `pendingScrollCardRef`, and an effect scrolls to it after the new period renders.
  - **Card without dates:** the grid scrolls to today's column, if that column is visible.

### Rendering (L562-L986)
- **Scroll container:** one container scrolls in both directions. The label column is sticky on the left and the header row is sticky at the top, so no JavaScript scroll syncing is needed.
- **`allRows`:** a flat list of stage rows, each followed by its card rows unless the stage is collapsed.
- **Stage row:** a collapse chevron, a colour swatch, the stage name and the task count (`taskCount`, or the number of cards).
- **Card row:** a completion icon, the name (struck through when done, red when overdue) and a priority chip.
- **Bar position:** the bar is placed from its start and end days, clamped to the visible period. Bars entirely outside the period are hidden. A bar that continues beyond the period gets a dashed, square edge and a chevron on that side.
- **Bar colour:** the stage colour at reduced alpha, or red when overdue.
- **Progress fill:** completed subtasks divided by total subtasks from `TaskDataCount`. Without subtasks, the fill is 100% for completed cards and 0% otherwise.
- **Labels:** the bar shows the name and percentage only when it is wider than 60px. Cards without dates show "No dates set".

## Exports
- `default GanttView()`: the Gantt tab. It takes no props, because everything comes from the stores and the URL.

## Interfaces
- **Backend endpoints called:** none directly. Through `useCardStore`, it calls the external Taskroom service at `NEXT_PUBLIC_TASKROOM_URL`, which is not part of this repo:
  - `POST <TASKROOM>tasks` to create a task;
  - `PUT <TASKROOM>tasks/:id` to update a task's dates.

  Both send the `localStorage.garage_tok` bearer token.
- **Environment variables:** indirect only, through the stores (`NEXT_PUBLIC_TASKROOM_URL`).
- **Browser storage / cookies:** indirect (`garage_tok`).

## Dependencies
- **Internal:**
  - `store/taskroom/taskroomWorkspace.tsx`: `useTaskroomWorkspacetore` (columns, current room, member data) and `isRoomObserver`.
  - `store/taskroom/workspaceStore.ts`: `currentWorkspace`.
  - `store/athena/cardStore.ts`: `createCard` and `updateCard` (Taskroom API calls).
  - `store/athena/boardStore.tsx`: fallback `memberData` for the observer check.
  - `components/athena/components/assignee-picker.tsx`, `custom-date-picker.tsx`, `priority-picker.tsx`, `tag-picker.tsx`: the quick-create pickers.
  - `components/ui/select.tsx`, `components/ui/button.tsx`: shadcn UI.
  - `lib/utils.ts`: `cn`.
- **Packages:**
  - `react`;
  - `next/navigation` (`useSearchParams`);
  - `date-fns` (`format`);
  - `lucide-react` (icons);
  - `sonner` (toasts).

## Used by
- `components/athena/ProjectMangement.tsx`: renders it as `<Gantt />` for the `"Gantt"` tab. `ProjectMangement` is mounted from `app/(dashboard)/layout.tsx`.
- `components/athena/projectmangerbacku.tsx`: an older backup copy of the project manager that also imports it.

## Notes
- Interaction is mouse-only (`mousedown`, `mousemove` and `mouseup` on `window`). Touch devices cannot drag or resize bars.
- Moving a single-date card writes both dates, because the drag treats it as one day long: `startDate = dueDate - 1 day` before the shift. After the save, the card has a start date it did not have before, and the bar is drawn two days long.
- The `description` and `timeEstimate` state is sent to `createCard`, but the quick-create UI has no input for either, so they are always empty. The `createQuickMode=false` path has no UI of its own; only the quick modal is ever shown.
- The priority legend in the toolbar is commented out (L626-L634).
- `localCards` never drops entries for deleted cards. This is harmless, because rows are built from `columns`.
- Dates are compared at local-midnight day granularity, so bars follow the viewer's time zone.
