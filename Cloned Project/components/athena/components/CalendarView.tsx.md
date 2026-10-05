# `components/athena/components/CalendarView.tsx`

> Client-side calendar for a Taskroom (Athena project-management) room: loads the room's dated tasks from the external Taskroom API and shows them in month, week or day views with drag-to-move and drag-to-resize date editing.

**Kind:** React component · **Lines:** 1635

## Purpose
Athena is the project-management module of Garage (kanban boards called "rooms", tasks called "cards"). This file is the "Calendar" tab of a room. It fetches every task in the visible month that has a start and/or due date, lays them out on a grid, and lets members reschedule a task by dragging it or stretching its edges. The task data does not live in this repo's backend: it comes from the external Taskroom service (`NEXT_PUBLIC_TASKROOM_URL`, falling back to `https://uatapi.garage.app/taskroomv2/v2/`). Creating tasks is delegated to the parent (`ProjectMangement.tsx`) through a window event; editing a task opens the shared `CardModal`.

## How it works

### Types and pure helpers (L33-L283)
- `Card` (exported) is the shape passed to `CardModal`. `CalendarTaskApi` is the raw task from the calendar endpoint; `AthenaCalendarEvent` is the normalised render model (`isAllDay`, `startMs`/`endMs` for timed events, `startDayMs`/`endDayMs` as local-midnight day keys).
- Colour helpers: `priorityToDotClass` maps `urgent/high/normal/low` to Tailwind dot colours; `stageColorBorder` / `stageColorBg` turn the task's stage hex colour into an RGBA border/background (grey fallback).
- `isDateOnlyDueLocal(d)` treats a local time of exactly 00:00:00.000 or 23:59:59 as "no time of day" (an all-day due date).
- `buildMonthLayout(monthDays, events)` splits the month grid into 7-day rows and, per row, places every overlapping event into a horizontal "lane" (greedy first-fit, longer spans first). Each placement records `colStart`, `colSpan`, `lane`, and whether the bar starts/ends in that row (so bars that cross weeks render as continuing).
- `buildAllDayLayout(rangeDays, events)` does the same lane packing for the "ALL DAY" strip of week/day views, using only `isAllDay` events.

### Room, permissions and task creation (L289-L348)
- The room id is `searchParams.roomId` when the URL has `shareTask` (a shared-task link), otherwise `currentRoomDetail._id` from the Taskroom workspace store.
- `isReadOnly = isRoomObserver(currentRoomDetail, roomMemberData ?? memberData)`: users whose room role is `observer` can look but not create, drag or resize; attempts show a "Observers can only view this board" toast.
- `openCreateTaskDialog(dueDateMs)` dispatches a `taskroom:open-create-task` `CustomEvent` on `window` with `{ dueDateMs, hideSubtask: true, defaultToCurrentRoom: true }`. `ProjectMangement.tsx` listens for it and opens `CreateTaskDialog`. Clicking a month cell or its "+" pre-fills that day at midnight; clicking a 30-minute slot in week/day view pre-fills `dayStart + slotIndex * 30 min`; the toolbar "Add Task" uses today (month view) or the anchor date.

### Loading events (L350-L506, L553-L572)
- `fetchCalendarEvents({ sBound, eBound })` calls `GET <TASKROOM_API_URL>rooms/detail/calendar/<roomId>?sBound=&eBound=` with `Authorization: Bearer <localStorage garage_tok>`. The bounds are always the start and end of the anchor date's month, so week/day views reuse the month's data.
- Each task is normalised:
  - No `startDate`: placed on its due day. If the due time has a real time of day it becomes a 30-minute timed event at that time; otherwise (or with no due date at all, which falls back to "today") it is an all-day single-day event.
  - With `startDate`: `convertedStartDate`/`convertedDueDate` (ISO strings) are preferred over the numeric fields. A missing or non-positive range is widened to 30 minutes. A range that starts at local midnight and ends at 23:59:59 is treated as an all-day (possibly multi-day) span; anything else is a timed event.
- A ref (`lastBoundsKeyRef`) prevents refetching when the month bounds have not changed. A `taskroom:task-created` window event (dispatched by `CreateTaskDialog` after a successful create) triggers a refetch of the current month.

### Saving date changes (L508-L551)
`applyDateUpdate(cardId, { startDate, dueDate })` updates local `events` optimistically, then calls `useCardStore().updateCard(cardId, {...payload, socketId: undefined})`, which issues `PUT <NEXT_PUBLIC_TASKROOM_URL>tasks/<id>`. If that throws, a toast is shown and the month is refetched to undo the optimistic change.

### Drag and resize (L590-L911)
A `dragGhost` state holds the in-progress preview; `eventsForRender` substitutes it for the real event so the UI moves live, and the dragged bar is shown at 60% opacity.
- **Month move** (HTML5 drag-and-drop): `handleEventDragStart` remembers which day of the bar was grabbed (`dragOffsetDaysRef`). `handleWeekRowDragOver` / `handleWeekRowDrop` convert the pointer's x position into a column of the week row and shift the whole span. All-day events are saved as `startOfDay(newStart)` .. `endOfDay(newEnd)`; timed events keep their time-of-day offsets.
- **Month resize** (mouse events on the right-edge handle): `handleMonthResizeMouseDown` finds the hovered cell via `document.elementFromPoint` and its `data-day-ms` attribute (falling back to pixel delta / column width), never letting the end go before the start. On release the due date becomes `endOfDay(newEndDay)`.
- **Week/day timed events** (`handleTimedMouseDown`): vertical mouse drags in three modes, `move`, `resize-start` and `resize-end`, converted at 30 minutes per `SLOT_HEIGHT` (48 px), snapped to 15 minutes, with a 15-minute minimum duration. Saved on mouse-up only if something changed.

### Derived grid data and navigation (L913-L996)
`monthDays` is the Sunday-to-Saturday grid covering the month; `rangeDays` is 1 day (day view), 4 days (`fourDays`) or the Sunday-started week. `timeSlots` is 48 half-hour labels. `navLabel` formats the toolbar title. Prev/Next step by a month, 7, 4 or 1 day depending on the view; "Today" resets the anchor.

### Render (L1002-L1634)
- Toolbar: prev/next, label, Today, a Month/Week/Day segmented switch (yellow `#FACC15` accent) and "Add Task" (hidden for observers).
- Month view: header row, then one absolutely-positioned grid per week; day cells carry `data-day-ms`; bars show start time (timed events) plus title, coloured by stage. Clicking a bar calls `toggle()`, which maps the event into a `Card`-like object (`_id`, `name`, `startDate = startDayMs`, `dueDate = endDayMs`) and opens `CardModal`.
- Week/day view: sticky day headers (today highlighted), an "ALL DAY" lane strip, a 24-hour half-hour grid, and an overlay where timed events are placed in side-by-side sub-columns when they overlap (all overlapping events in a day share the same column count). Top/bottom handles resize; the body moves.
- A translucent "Loading..." overlay shows during fetches.

## Exports
- `CalendarView()` - the calendar component (no props; reads room context from stores and the URL).
- `Card` (interface) - task shape handed to `CardModal`.

## Interfaces
- **External services:** Taskroom API (not part of this repo): `GET {TASKROOM_URL}rooms/detail/calendar/:roomId?sBound&eBound` (here) and `PUT {TASKROOM_URL}tasks/:id` (via `cardStore.updateCard`).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base (default `https://uatapi.garage.app/taskroomv2/v2/`).
- **Browser storage / cookies:** reads `localStorage.garage_tok` as the bearer token.
- **Window events:** dispatches `taskroom:open-create-task`; listens for `taskroom:task-created`.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` - current room, member role, `isRoomObserver`, `columns`/`setColumns`; `store/athena/boardStore.tsx` - fallback `memberData`; `store/athena/cardStore.ts` - `updateCard`; `components/athena/components/card-modal.tsx` - task detail modal; `components/ui/button.tsx`; `lib/utils.ts` (`cn`).
- **Packages:** `date-fns` (day/month arithmetic, formatting), `sonner` (toasts), `lucide-react` (icons), `next/navigation` (`useSearchParams`), `react`.

## Used by
`components/athena/ProjectMangement.tsx` and `components/athena/projectmangerbacku.tsx` (an older backup copy), which render it as the room's calendar view.

## Notes
- Only the timed-event body, the all-day strip buttons and the week/day blocks stop click propagation; they do not open `CardModal` (only month-view bars do).
- `CardModal` is given placeholder values `userId="userId"` and `orgId="orgId"` and a no-op `updateTaskAndCardCounts`.
- The `fourDays` mode is fully supported in logic but is not offered in `CALENDAR_VIEW_OPTIONS`.
- `fetchBoardDetails` and `columns` are read but unused. The normalised events also carry `stageId`/`tagData`, which are not in the `AthenaCalendarEvent` type (TypeScript errors are ignored at build).
- Week/day views only show tasks from the anchor date's month, so a week that crosses a month boundary will miss tasks from the other month.
- `updateCard` shows its own success/error toast, so each successful drag produces a "Card updated" toast.
