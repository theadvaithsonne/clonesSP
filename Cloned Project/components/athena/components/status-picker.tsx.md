# `components/athena/components/status-picker.tsx`

> Popover picker that lists a Taskroom room's stages (statuses) with search and infinite scroll, and reports the chosen stage to its parent.

**Kind:** React component · **Lines:** 229

## Purpose
In Athena/Taskroom, a task's "status" is the kanban stage it sits in. This component wraps any trigger element (passed as `children`) in a Radix popover that loads the room's stages from the external Taskroom API, so the user can move a task to another stage from the card modal or apply a status to many tasks in the list view.

## How it works
- **Room resolution (L55-L57):** uses the `roomId` prop, or falls back to the route params `space`, `id` or `symbol` from `useParams()`. With no room id, nothing is fetched.
- **Fetching (L61-L117):** `fetchStages(page, search, isLoadMore)` calls `GET ${TASKROOM_API_URL}rooms/detail/{roomId}?page=N&size=20[&search=...]` with `Authorization: Bearer <localStorage.garage_tok>`. A successful response (`status` true with `data`) is a list of `Stage` objects. They are sorted by `stageType` in the order `tostart`, `active`, `done`, `closed` (others last). On load-more, new stages are de-duplicated by `_id` and the whole list is sorted again. `hasMore` comes from `metadata.totalPages`; with no metadata it is false. An `isFetchingRef` guard prevents overlapping requests.
- **Open/search (L119-L128):** while the popover is open, any change to the search text resets to page 1 and refetches after a 300 ms debounce.
- **Infinite scroll (L130-L147):** a sentinel at the bottom of the list (rendered only when `hasMore` and not loading) is watched by an `IntersectionObserver`. It reads current values from `stateRef` so the observer does not need to be recreated on every state change.
- **Selection (L149-L153):** calls `onSelect(stageId, stage)`, closes the popover and clears the search. A row counts as selected when `status` equals the stage `_id` or its `name`.
- **UI:** "Select Status" header, search input, coloured dot per stage (`stage.color`, default blue), check mark on the selected stage, spinner while loading, "No stages found" when empty.

## Exports
- `StatusPicker({ status?, onSelect, children, roomId?, initialTasks? })` - the popover picker. `initialTasks` is accepted only for compatibility and is ignored.
- `type StatusValue = string` - the value passed to `onSelect` (a stage id).
- `interface Stage` - `{ _id, roomId, name, color, stageType, orderId, taskCount, status }`.

## Interfaces
- **Backend endpoints called:** `GET {NEXT_PUBLIC_TASKROOM_URL}rooms/detail/{roomId}?page&size=20&search` - external Taskroom API; returns the room's stages, paginated.
- **External services:** Taskroom v2 API (default `https://uatapi.garage.app/taskroomv2/v2/`).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - API base.
- **Browser storage / cookies:** reads `garage_tok` from `localStorage`.

## Dependencies
- **Internal:** `components/ui/popover.tsx` - Radix popover; `lib/utils.ts` - `cn`.
- **Packages:** `next` (`useParams`), `react`, `lucide-react` icons, `js-cookie` (imported but unused).

## Used by
`components/athena/components/card-modal.tsx` (moving one card, passes `roomId` and the card's `stageId`) and `components/athena/components/ListView.tsx` (bulk "Status" action; no `roomId`, so it relies on route params).

## Notes
- `Cookies` and `totalPages` state are unused.
- In ListView's bulk action the parent stores the returned stage id in a `status` field; the picker itself only knows stage ids.
