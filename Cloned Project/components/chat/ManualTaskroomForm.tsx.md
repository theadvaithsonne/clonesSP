# `components/chat/ManualTaskroomForm.tsx`

> The inline form behind the group-chat `/taskroom` slash command: it files a task, with optional media and assignees, directly on the group's linked Taskroom board.

**Kind:** React component (client) · **Lines:** 413

## Purpose
Groups linked to a Taskroom board get tasks from AI capture of chat messages, but members also need to add tasks by hand. Unlike the other slash-command forms, which encode a `[garage-...]` marker and post it as a chat message, this form posts nothing to the chat: it calls the backend once to create the task on the board and closes. It is group-chat only: `SlashCommandForm` renders it only for `command === "taskroom"`, which the slash hook surfaces only for group chats with a linked board.

## How it works
**Fields.**
- *Task* title (required, auto-focused; Enter submits).
- *Details*, an optional description.
- *Images & videos*: a hidden `<input type="file" accept="image/*,video/*" multiple>` behind a dashed drop-zone button, plus paste support anywhere in the form (clipboard image/video items are intercepted). Non-media files are ignored. Each file is uploaded sequentially through the caller-supplied `uploadFile` (the host decides where files go) and kept as `{ fileUrl, fileName, fileType }`; thumbnails (image or muted video with a play icon) can be removed. The input is reset after each selection so the same file can be chosen again. Upload errors show a toast and stop the remaining uploads.
- *Assignees*: a searchable checkbox list of `members` (filtered by name). The current user is marked "(you)". When `syncedMemberIds` is non-empty, members not in it get a "not on board" hint, because the backend skips them.
- *Priority*: `low | normal | high | urgent`, default `normal`.

**Submit.** Disabled while the title is empty or an upload/submit is running. It sends `POST /backend/groups/:groupId/taskroom/task` with `{ title, description?, priority, assigneeUserIds, attachments }`. The backend requires group membership (not admin) and returns `201 { ok, task }`, where `task.notAssigned` lists members it could not assign. On success a toast says "Task added to Taskroom", with a description of how many members were skipped when any were, then `onCreated()` (the host uses it to refresh `GroupTasksPanel`) and `onClose()` run. On failure the error message appears in a red box inside the form.

## Exports
- `ManualTaskroomForm({ groupId, members, syncedMemberIds?, currentUserId?, uploadFile, onCreated?, onClose })` - the form (also the default export).
- `interface ManualTaskroomMember` - `{ id, name }` for each selectable assignee.

## Interfaces
- **Backend endpoints called:** `POST /backend/groups/:groupId/taskroom/task` - create a manual task on the linked board (`server/routes/groups.ts`; errors such as "not linked", "disabled" or "board gone" come back with their own status and message).
- **External services:** Taskroom, indirectly through the backend.

## Dependencies
- **Internal:** `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx` - form controls; `lib/api.ts` - authenticated backend fetch.
- **Packages:** `lucide-react` - icons; `sonner` - toasts; `react` - hooks.

## Used by
- `components/chat/SlashCommandForm.tsx` - renders it for the `/taskroom` command inside `GroupChatPage`.

## Notes
- Removing an attachment only drops it from the list; the already-uploaded file is not deleted.
- The backend's request schema accepts exactly the four priority values used here; adding a priority needs a matching backend change.
