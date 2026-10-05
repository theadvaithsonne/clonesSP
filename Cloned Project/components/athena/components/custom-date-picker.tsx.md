# `components/athena/components/custom-date-picker.tsx`

> A popover date picker with "Start" and "Due" tabs, quick shortcuts and range highlighting, used for task dates throughout the Taskroom / Athena module.

**Kind:** React component · **Lines:** 338

## Purpose
Taskroom tasks have a start date and a due date. `CustomDatePicker` is the shared control for setting either one from the kanban cards, the list view, the Gantt chart, the card modal, subtasks and the create-task dialog. It wraps any trigger element (`children`) in a Radix popover. The popover holds a range calendar, two tab buttons showing the current start and due values, and a list of relative-date shortcuts.

## How it works
- **State.**
  - `internalStart` and `internalDue` hold the dates being edited.
  - `activeTab` (`"start"` | `"due"`) says which date the next click sets.
  - `displayedMonth` is the month the calendar shows.
  - `open` is the popover's open state.
- **Sync effect (L36-L60).** While the popover is closed, the internal dates are refreshed from the `startDate` and `dueDate` props. Syncing only while closed stops parent re-renders from undoing a clear the user just made. On open, `activeTab` is set to `defaultTab`, and the calendar jumps to the due date when that tab is active, else to the start date or today.
- **Selecting a day (`handleSelect`, L62-L98).** Days before today are ignored, and the calendar also disables them.
  - *Start tab:* clicking the date that is already the start date sets start and due to that day and closes the popover, a quick single-day pick. Any other date becomes the start, and the picker switches to the Due tab if no due date is set or the due date is now before the new start. It calls `onSelect({ start, due })` without closing.
  - *Due tab:* sets the due date, calls `onSelect`, and closes. A due date earlier than the start is accepted as is; both branches of the code do the same thing.
- **Clearing.** The ✕ on each tab clears that date, calls `onSelect` and switches to that tab. It uses `stopPropagation` so the click does not also act as a tab click.
- **Shortcuts.** Today, Tomorrow, Next week (next Monday), Next weekend (next Saturday), and 2, 4 and 8 weeks out. They apply to the active tab through `handleSelect`. On mobile they show as a horizontal scroll strip, and on desktop as a sidebar.
- **Range styling.** The `range_start`, `range_end` and `range_middle` modifiers are passed to the shadcn `Calendar` in `mode="range"`, using `onDayClick` rather than `selected`. A scoped `<style>` block keyed by `useId()` overrides react-day-picker classes, so each instance can use the `activeColor`, `bgColor` and `borderColor` props. The defaults use the `--brand` and `--brand-foreground` CSS variables.
- **Labels.** Dates are formatted as `M/d/yy`. An empty or invalid date shows "Set date".

## Exports
- `CustomDatePicker({ startDate?, dueDate?, onSelect, children, defaultTab = "due", activeColor?, bgColor?, borderColor?, contentClassName = "bg-[#0a0a0d]" })`.
  - `onSelect(dates: { start?: Date; due?: Date })` is called on every change and always carries both values.
  - `children` must be a single element that can take a ref, because it is used as `PopoverTrigger asChild`.

## Dependencies
- **Internal:** `components/ui/calendar.tsx` (the react-day-picker wrapper), `components/ui/popover.tsx`, `lib/utils.ts` (`cn`). `components/ui/button.tsx` is imported but unused.
- **Packages:** `date-fns` (date maths and formatting), `lucide-react` (icons), `react`.

## Used by
- `components/athena/components/CreateTaskDialog.tsx`
- `components/athena/components/Gantt.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/card-modal.tsx`
- `components/athena/components/kanban-card.tsx`
- `components/athena/components/kanban-column.tsx`
- `components/athena/components/subtaskCompoent.tsx`

## Notes
- Past dates cannot be picked, so an overdue task's start or due date cannot be moved to another past day. It can only be cleared or moved forward.
- `Clock` and `ChevronRight` are imported but unused.
