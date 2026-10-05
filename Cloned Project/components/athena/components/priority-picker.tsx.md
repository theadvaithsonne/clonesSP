# `components/athena/components/priority-picker.tsx`

> A popover menu that wraps any trigger element and lets the user set a task's priority (Urgent, High, Normal, Low) or clear it.

**Kind:** React component · **Lines:** 90

## Purpose
Task priority is edited from many places in the Athena/Taskroom task UI: the create-task dialog, kanban cards and columns, list view, Gantt chart, the card modal and subtasks. This component puts the menu in one place so every caller gets the same options and colours. The caller supplies the trigger (`children`) and decides what to do with the chosen value.

## How it works
- It wraps the Radix-based `Popover` from `components/ui/popover.tsx`. `children` becomes the trigger through `PopoverTrigger asChild`. The component controls the `open` state itself.
- Options are fixed:
  - `urgent` - red flag
  - `high` - amber flag
  - `normal` - blue flag
  - `low` - grey flag
  - "Clear" - value `null`, shown with a `Ban` icon
- Choosing an option calls `onSelect(value)` and closes the popover.
- The option that matches the current `priority` gets `font-medium` styling.
- **Theming:** the hover background and border colours can be overridden with `bgColor` and `borderColor`. By default they are 8% of `var(--brand)` mixed with transparent (`color-mix`). Inline styles cannot target `:hover`, so the component injects a scoped `<style>` tag. The class name in it comes from `React.useId()` with the colons removed, which keeps each picker's hover colour independent.
- `contentClassName` (default `bg-[#0a0a0d]`) sets the popover background.

## Exports
- `type PriorityLevel = "urgent" | "high" | "normal" | "low" | any` - a priority value. Because of the `| any`, the type does not actually restrict values.
- `PriorityPicker({ priority?, onSelect, children, activeColor?, bgColor?, borderColor?, contentClassName? })` - the picker.

## Dependencies
- **Internal:** `components/ui/popover.tsx` - `Popover`, `PopoverTrigger`, `PopoverContent`; `lib/utils.ts` - `cn`.
- **Packages:** `react`; `lucide-react` - `Flag` and `Ban` icons.

## Used by
- `components/athena/components/CreateTaskDialog.tsx`
- `components/athena/components/Gantt.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/card-modal.tsx`
- `components/athena/components/kanban-card.tsx`
- `components/athena/components/kanban-column.tsx`
- `components/athena/components/subtaskCompoent.tsx`

## Notes
- The `activeColor` prop is accepted but never used. `Sparkles` is imported but unused.
- "Clear" sends `null`. Callers must treat that as "no priority".
- `app/taskroom/components/` imports a separate `./priority-picker` of its own, not this file.
