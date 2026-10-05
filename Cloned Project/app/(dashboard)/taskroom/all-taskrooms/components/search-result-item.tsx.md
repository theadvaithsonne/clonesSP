# `app/(dashboard)/taskroom/all-taskrooms/components/search-result-item.tsx`

> One clickable row in the TaskRoom search dropdown, representing a room, a task or a subtask.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 104

## Purpose
Renders a single search hit from the Taskroom search API with consistent styling (category dot, title, optional description, priority, tags, overdue and completed flags) and navigates to the hit when clicked.

## How it works
- **Category colour dot:** `categoryColors` maps `rooms` to blue, `tasks` to orange and `subTasks` to green (unknown categories fall back to the task colour).
- **Priority badge:** `priorityColors` gives `high`, `medium` and `low` red, orange and green tints; unknown priorities use the medium style.
- **Tag badges:** `getTagVariant(tag)` looks up a lower-cased tag in a hard-coded palette ("in progress", "backend", "security", "design", "deals", "taskroom", ...); other tags get a neutral grey.
- Shows "Completed" in green when `isCompleted`, and "Overdue" in red when `isOverDue`. The badge row is rendered only if there are tags, a priority or an overdue flag.
- **Navigation (`approute`):** on click it calls `router.push` with
  - rooms: `/all-taskrooms/{id}`
  - tasks: `/all-taskrooms/{roomId}?card={id}`
  - subTasks: `/all-taskrooms/{roomId}?card={taskId}&task={id}`

## Exports
- `default SearchResultItem({ item })` - `item` is a `SearchItem`: `{ id, title, description, category: "rooms" | "tasks" | "subTasks", priority?, tags?, isOverDue?, isCompleted?, roomId?, taskId? }`.

## Dependencies
- **Packages:** `next` - `useRouter` from `next/navigation`.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/components/search-list.tsx` - renders one per result in each section.

## Notes
- **Likely broken links:** there is no `/all-taskrooms` route in this project (no `app/all-taskrooms` or `app/(dashboard)/all-taskrooms` folder, and no rewrite in `middleware.ts` or `next.config.ts`). The TaskRoom pages live at `/taskroom/all-taskrooms?taskroomId=...`, so clicking a result probably lands on a 404. The `card`/`task` query parameters are likewise not read by `TaskroomSubPage.tsx`.
- `approute`'s parameter is untyped (`e`), so this file relies on the build ignoring TypeScript errors.
