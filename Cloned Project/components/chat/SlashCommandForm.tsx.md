# `components/chat/SlashCommandForm.tsx`

> Dialog that collects the details for a chosen chat slash command (`/poll`, `/meet`, `/share`, `/taskroom`), performs any needed backend call, and hands back an encoded marker message for the chat page to send.

**Kind:** React component · **Lines:** 1877

## Purpose
Slash commands in Garage chat turn into rich cards (see `components/chat/SlashCommandCards.tsx`). This file is the composer side: once the user selects a command from `SlashCommandMenu`, the host chat page mounts `SlashCommandForm` with that command id. Each sub-form validates input, makes at most one backend call (book a room, create a deal, and so on), encodes the result with an `encode*` helper from `lib/chat-markers.ts`, and calls `onSubmit(encoded)`. The host page is responsible for actually sending the message. The `/taskroom` command is the exception: it renders `ManualTaskroomForm`, which posts a task straight to the group's linked Taskroom board and sends no marker.

The file also still contains the Task, Deal, Approval and Document forms. They are complete but their JSX branch is commented out, so they cannot be reached today.

## How it works

### Dialog router - `SlashCommandForm` (L44-L200)
- `open` is true only for `poll`, `meet`, `share`, or `taskroom` when both `groupId` and `uploadFile` were passed (so the dialog never opens onto an empty body).
- Radix keeps the dialog mounted during its close animation after `command` becomes `null`; the component remembers the last command in `shown` state so the header and body do not blank out while fading.
- Header title/icon come from `FORM_TITLES` / `FORM_ICONS` (which still list `task`, `deal`, `approve`, `doc`).
- For `taskroom`, the members list passed to `ManualTaskroomForm` puts the signed-in `currentUser` first (so reporters can assign to themselves, since the chat's `members[]` excludes self), followed by the other members.

### TaskForm - disabled (L202-L565)
- Creates Taskroom tasks on the external Taskrooms v1 API, hardcoded as `https://uatapi.garage.app/taskroom`.
- On mount it loads the user's taskrooms (`GET /v1/rooms/detail?orgId=&page=1&size=50&userId=`), then the chosen room's stages (`GET /v1/stages/task?roomId=&size=30`), defaulting to the first room and first stage.
- Org id falls back from the `orgId` prop to the JWT payload (`getUserDataFromToken().orgId`) because the `org_id` localStorage key is not always written.
- Assignee modes: locked to the other DM participant (`lockedAssignee`), multi-select checkboxes (`multiAssign`, group chats), or a single select.
- Submit sends one `POST /v1/tasks` per assignee (or one unassigned task), with epoch-millis `startDate`/`dueDate` and priority `urgent` mapped to `high` (the API accepts only low/medium/high). The marker embeds every task id, the assignees, the available assignees (for the card's Reassign menu), the taskroom name and the full stage list so the card can move stages without refetching.

### PollForm (L567-L652)
- Fully client-side. Question up to 280 chars, 2 to 10 options, multiple-choice and anonymous toggles.
- Generates a random `pollId` (`p_<time36>_<rand>`) and option ids `o0`, `o1`, ... and encodes with `encodePoll`. No backend call; votes later live in localStorage via `lib/slash-state.ts`.

### MeetForm (L654-L928)
- Books a real conference room, mirroring `ConferenceRoomPage`'s contract.
- Org id: the `orgId` prop, else `getOrgId()`.
- `loadRooms()` calls `GET /backend/conference-rooms?orgId=...` (response `{ success, rooms }`). The room list always ends with a synthetic "Conference Room (this office)" entry whose id is `OFFICE_CONFERENCE_ROOM_ID` (`"office"`), so any member can book even if no founder has created named rooms. A load failure is shown as an amber warning with Retry and does not hide the office room.
- Date/time default to the next 15-minute slot (`nextSlot()`); duration chips 15/30/60/90 min; optional description; invitee checkboxes from `members`.
- Submit validates title, room and date, rejects a start time more than a minute in the past (the default slot can lapse while the dialog is open), then calls `POST /backend/room-bookings?orgId=...` with `title`, ISO `startTime`/`endTime`, `invitedUserIds`, optional `description`, and `conferenceRoomId` **only** for a named room (the office room books org-wide).
- The booking id is read defensively from `res.booking`, `res.data` or `res`. The marker (`encodeMeet`) carries `eventId` (booking id or a random `evt_...`), times, invitees, `orgId`, `roomId`, `roomName`, `bookingId`, `description`; the card then joins `/meet/conference/<orgId>/<roomId>`.
- Because `api()` drops the HTTP status, a slot clash is detected from the error message (`conflict|already booked|overlap|409`) or an attached `status === 409`; the dialog stays open and no card is sent.

### DealForm - disabled (L930-L1122)
- Search mode: debounced (250 ms, private `useDebouncedValue`) `GET /backend/slash/deals/search?q=...`, with a request sequence counter so stale responses are ignored. Picking a result shares it.
- Create mode: `POST /backend/slash/deals` with `{ name, stage, value }`, then shares the returned deal. Currency defaults to USD.

### ApprovalForm - disabled (L1124-L1239)
- Title, description, approver checkboxes (at least one), optional deadline. `POST /backend/slash/approvals` with `approvalType: "parallel"`; the marker embeds the returned `approval._id` and `requesterId` so the card's buttons can call `/:id/decide`.

### DocForm - disabled (L1241-L1394)
- Cabinet mode loads `GET /backend/cabinet/files/all?orgId=...` once and filters by name client-side. URL mode takes a name and an `http(s)://` URL and generates `doc_<time36>` as the id.

### ShareForm and `fetchShareItems` (L1396-L1576)
- Tabs for course, webinar, product. Each kind is lazy-loaded once per dialog and cached in state, then filtered by title client-side.
- `fetchShareItems()` normalises three endpoints into `{ _id, title, description, image, price, currency, url }`:
  - course: `GET /backend/courses/manage?orgId=...`, link `https://www.garage.app/digital/course/<id>` (hardcoded production domain).
  - webinar: `GET /backend/workshops?orgId=...`, link `/checkout/workshop/<id>`.
  - product: `GET /backend/products?orgId=...&limit=50`, link `/checkout/product/<id>`.
- Each accepts either a bare array or a wrapped `{ courses | workshops | products }` response. Clicking an item encodes it with `encodeShare` immediately (no submit button).

### Shared primitives and date/time picker (L1578-L1876)
- `ModeButton`, `FieldLabel`, `ToggleField`, `SubmitRow` (shows "Working..." while busy), `formatBytes`.
- Date helpers keep values as local `"YYYY-MM-DD"` / `"HH:mm"` strings: `ymd`, `hm`, `parseYmd`, `nextSlot`, `addDays`, `timeLabel`, `dateLabel`, and `ALL_SLOTS` (96 fifteen-minute slots).
- `MeetWhenPicker`: Today / Tomorrow chips plus a calendar popover (past days disabled) and a time list popover used instead of the browser time input (unreadable on the dark dialog). For today only future slots are offered; switching to today bumps a past time to the next slot. The time list is portaled outside the dialog, whose scroll lock blocks wheel scrolling, so it scrolls itself in `onWheel`. It centres on the selected time once when opened.
- `MeetWhenSummary`: one-line "date · start - end" preview.

## Exports
- `SlashCommandForm(props: SlashCommandFormProps)` - the dialog. Props: `command: SlashCommandId | null`, `orgId?`, `members?: SlashFormMember[]`, `lockedAssignee?`, `multiAssign?`, `onSubmit(encoded: string)`, `onClose()`, and for group `/taskroom` only: `groupId?`, `uploadFile?(f: File)`, `onCreated?()`, `syncedMemberIds?`, `currentUser?`.
- `SlashFormMember` (interface) - `{ id, name?, email? }`.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/conference-rooms?orgId=` - list named conference rooms (MeetForm).
  - `POST /backend/room-bookings?orgId=` - create the meeting booking (MeetForm).
  - `GET /backend/courses/manage?orgId=`, `GET /backend/workshops?orgId=`, `GET /backend/products?orgId=&limit=50` - items to share (ShareForm).
  - Unreachable forms only: `GET /backend/slash/deals/search`, `POST /backend/slash/deals`, `POST /backend/slash/approvals`, `GET /backend/cabinet/files/all`.
- **External services:** Taskrooms v1 API at `https://uatapi.garage.app/taskroom` (disabled TaskForm only).

## Dependencies
- **Internal:** `lib/chat-markers.ts` - `encodePoll`, `encodeMeet`, `encodeShare` (and `encodeTask`/`encodeDeal`/`encodeApproval`/`encodeDoc`), `OFFICE_CONFERENCE_ROOM_ID`, types; `lib/api.ts` - `api()`; `lib/auth.ts` - `getToken`, `getUserIdFromToken`, `getUserDataFromToken`, `getOrgId`; `lib/hooks/useSlashCommands.ts` - `SlashCommandId`; `components/chat/ManualTaskroomForm.tsx` - `/taskroom` form; `components/ui/{button,input,textarea,dialog,popover,calendar}.tsx` - UI primitives.
- **Packages:** `react`, `sonner` (validation/error toasts), `lucide-react` (icons).

## Used by
- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`

## Notes
- About 550 lines (TaskForm, DealForm, ApprovalForm, DocForm) are dead code: the branch that rendered them is commented out and `open` excludes those commands. The matching triggers are also commented out in `useSlashCommands.ts`.
- Share links mix a hardcoded production domain (courses) with root-relative paths (webinars, products), so course links always point at `www.garage.app` even on other deployments or white-label hosts.
- The 409 detection in MeetForm depends on the backend's error wording.
