# `components/athena/components/tag-picker.tsx`

> Popover for choosing, searching and creating the tags on an Athena/Taskroom task, plus a small `TagChip` component that shows one tag with an optional remove button.

**Kind:** React component · **Lines:** 346

## Purpose
Tags in Taskroom belong to a space. Any trigger element (passed as `children`) can be wrapped in `TagPicker` to open a multi-select list of that space's tags, filter it, or create a new tag with one of the preset colours. The picker does not save anything on the task itself; it hands the new selection back through `onSelect` and the parent persists it. It is used throughout the task UIs: create dialog, card modal, kanban card and column, list view, Gantt and subtasks.

## How it works
- **Loading tags (L88-L110):** each time the popover opens it calls `GET ${NEXT_PUBLIC_TASKROOM_URL}tags?spaceId={Idspace}&size=100` with `Authorization: Bearer <localStorage.garage_tok>`, and stores `data.data` when `status` is true. With no `Idspace`, nothing loads. Only the first 100 tags are fetched; there is no pagination.
- **Selecting (L121-L133):** `handleToggleTag` adds or removes an id from `selectedTagIds` (a controlled prop) and calls `onSelect(newIds, matchingTagObjects)`, so parents get both ids and `{ _id, name, color }` objects.
- **Search (L160-L162):** filters the loaded tags on the client by name, case-insensitively.
- **Creating (L135-L158):** "Create new tag" switches to a form pre-filled with the current search text. The user enters a name, picks one of `TAG_PRESET_HEX`, sees a live preview chip, and presses Create. This calls `useTagStore().createTag({ workspaceId: boardId, spaceId: Idspace, name, color })`, which POSTs to `${NEXT_PUBLIC_TASKROOM_URL}tags`. The new tag is appended locally, selected straight away (`onSelect` fires) and the form closes. Failures show a `sonner` toast.
- **Closing (L112-L119):** resets the create form and the search text.
- Colours are rendered through `getTagStyles` / `normalizeTagColor` / `isSameTagColor` so legacy Tailwind-class colours display correctly.

## Exports
- `TagPicker({ boardId, selectedTagIds, onSelect, Idspace, children, activeColor?, bgColor?, borderColor?, contentClassName? })` - the popover. `boardId` is sent as `workspaceId` when a tag is created; `Idspace` is the space id. `contentClassName` (default `bg-[#121218]`) styles the popover. `activeColor`, `bgColor` and `borderColor` are declared but ignored.
- `TagChip({ label, onRemove?, disabled?, maxWidthClass? })` - a truncated, coloured tag pill; on hover it shows an "x" button that calls `onRemove` (click propagation is stopped) unless `disabled`.

## Interfaces
- **Backend endpoints called (external Taskroom API):**
  - `GET {NEXT_PUBLIC_TASKROOM_URL}tags?spaceId&size=100` - list the space's tags
  - `POST {NEXT_PUBLIC_TASKROOM_URL}tags` - create a tag (through `store/athena/tagStore.ts`)
- **External services:** Taskroom v2 API (uatapi.garage.app).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL`.
- **Browser storage / cookies:** reads `garage_tok` from `localStorage`.

## Dependencies
- **Internal:** `components/athena/components/tag-colors.ts` - preset palette and colour normalisation; `store/athena/tagStore.ts` - `createTag`; `components/ui/popover.tsx` - Radix popover; `lib/utils.ts` - `cn`.
- **Packages:** `react`, `lucide-react` icons, `sonner` toasts.

## Used by
`components/athena/components/CreateTaskDialog.tsx`, `Gantt.tsx`, `ListView.tsx`, `card-modal.tsx`, `kanban-card.tsx`, `kanban-column.tsx` and `subtaskCompoent.tsx` (all in `components/athena/components/`).

## Notes
- The tag list is fetched again every time the popover opens; there is no shared cache.
- The naming is confusing: `boardId` is used as the workspace id when creating a tag. In `subtaskCompoent.tsx` it is actually passed the room id, so check what callers send before relying on it.
