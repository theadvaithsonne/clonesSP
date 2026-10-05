# `components/athena/components/cccc.txt`

> An orphaned plain-text copy of an older version of the Taskroom "Create / Edit Room" dialog (`CreateRoomDialog`), kept beside the live component but never compiled or imported.

**Kind:** React component source saved as `.txt` (dead code) · **Lines:** 1127

## Purpose
This file holds TSX source for an earlier single-step version of `CreateRoomDialog`, the dialog used in the Taskroom / Athena project-management module to create a room (a project inside a space) and optionally configure its stage template. Because it has a `.txt` extension, Next.js/Turbopack and TypeScript ignore it: it is not part of the build and nothing imports it. The live, maintained implementation is `components/athena/components/create-room-dialog.tsx`. Treat this file as a scratch backup or reference snapshot.

## How it works
The code describes what the old dialog did, if it were ever renamed back to `.tsx`:

- **Room form (L555-L691).** Fields: room name with a small icon picker, optional description, a "Make Private" switch (defaults to `true`), and, on create only, a "Custom Template" switch. Submit button text changes between "Update Room", "Next: Setup Template" and "Create Room".
- **Icon upload (L174-L222).** Image files only (checked with `file.type.startsWith("image/")`). They are previewed through `FileReader` and uploaded on submit as multipart `files` with `folder=room-icons` to `${API_URL}/api/s3upload/multiple`, where `API_URL` is hardcoded to `https://uatapi.garage.app`. The first returned `data[0].url` becomes the room's `bgImage`.
- **Submit (L475-L540).** Edit mode calls `updateRoom(room._id, {...})`. Create mode either calls `createRoom({...}, workspaceId, router)` straight away, or, when "Custom Template" is on, stores the form in `pendingRoomCreationData` and opens the template editor (`setIsOpenTempate(true)`).
- **Template editor (L692-L1124).** It has a template `<Select>` (with an "+ Add New Template" option that calls `setNewTemplate()`), a template name and accent colour, and stages grouped into four stage types: `tostart`, `active`, `done` and `closed`. Stages can be added (preset colour swatches, a custom colour picker and a live preview), edited inline, deleted, and drag-reordered within the same stage type only (`handleDrop`, L269-L292). Editing is allowed only when the template is `custom` or its `userId` matches the `userId` decoded from the `garage_tok` JWT (L155-L164).
- **Apply (L303-L342).** With pending creation data, it creates the room with `stageTemplateId: selectedTemplate`. Otherwise it sends `PUT ${NEXT_PUBLIC_TASKROOM_URL}rooms/${currentRoom.id}` with the selected template id. "Save as template" calls the template store's `addStageTemplate()`.
- **Members (L356-L473).** When editing, it loads room members (`GET …room/members?roomId=`) and space members (`GET …space/members?spaceId=`), and can remove a room member (`DELETE …room/members/:id`). The UI for picking members is not rendered.

## Exports
The text declares `export function CreateRoomDialog({ open, onOpenChange, spaceId, room })`, but nothing can import it from a `.txt` file.

## Interfaces
- **External services:** the Taskroom API at `NEXT_PUBLIC_TASKROOM_URL` (rooms, room/space members) and the S3 upload endpoint on `https://uatapi.garage.app`. Neither is part of this repo.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL`.
- **Browser storage / cookies:** reads `localStorage.garage_tok` (bearer token, JWT-decoded for `userId`) and the `TaskRoomUserDetails` cookie.

## Dependencies
- **Internal (as written):** `@/store/taskroom/roomStore` (**does not exist** in this repo), `@/store/taskroom/workspaceStore`, `@/store/taskroom/workspaceMemberStore`, `@/store/taskroom/templateStore`, and shadcn UI components under `components/ui/`.
- **Packages (as written):** `axios`, `jwt-decode`, `js-cookie`, `sonner`, `lucide-react`, `next/navigation`.

## Used by
Nothing imports this file, and its extension stops it from being built. It appears unused.

## Notes
- If this file were renamed to `.tsx`, it would not compile: `store/taskroom/roomStore` is missing, and the live dialog now gets `createRoom` and `updateRoom` from `useTaskroomWorkspacetore` in `store/taskroom/taskroomWorkspace.tsx`.
- `setisPrivate(room.isPrivate || true)` (L437) always resolves to `true`, so in this version an edited room always showed as private.
- The file can be deleted safely, or kept only as history. The live `create-room-dialog.tsx` replaced it with a two-step flow plus an "existing vs custom template" choice screen.
