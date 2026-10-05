# `components/athena/components/SheetsView.tsx`

> The "Sheets" tab of an Athena/Taskroom room: manages the room's linked Google Sheets and shows the selected one in an embedded iframe.

**Kind:** React component · **Lines:** 160

## Purpose
One of several "integration" tabs (Notion, Figma, YouTube, Sheets...) that attach external links to a Taskroom room. Unlike `Notionview.tsx`, which carries its own data logic, this view delegates list fetching, pagination and CRUD to the shared `useIntegrationList` hook (integration type `"googlesheet"`) and renders with `IntegrationViewShell` plus the iframe helpers from `integration-iframe-content.tsx`.

## How it works
- **Room resolution**: `roomId` prop, else `?roomId=` when `?shareTask` is present, else `currentRoomDetail._id` from `useTaskroomWorkspacetore`. No room renders `IntegrationRoomNotFound`.
- **Data**: `useIntegrationList(resolvedRoomId, "googlesheet")` supplies items, active item, form state, sidebar state, infinite-scroll sentinel and `saveIntegration` / `deleteIntegration`. The hook talks to the external Taskroom `external/integrations` API with the `garage_tok` bearer token.
- **Validation**: `handleSave` passes a validator to `saveIntegration`: `isValidSheetUrl` accepts a `docs.google.com` URL whose path contains `/spreadsheets/`, or any URL containing `pubhtml` (published sheets).
- **Embedding**: `buildIframeUrl` leaves `pubhtml` links unchanged; otherwise it strips the query string and anything after `/edit`, then appends `/edit`, so the sheet opens in the normal editor inside the iframe (the viewer's own Google login decides access).
- **Rendering**: `IntegrationViewShell` with `SHEETS_CONFIG` labels and an "Open in Sheets" header link (new tab). Body: `IntegrationIframe` for a valid link, `IntegrationInvalidState` for a bad stored link, or `IntegrationEmptyState` ("Connect a sheet", which opens the sidebar and the form).

## Exports
- `default SheetsView({ roomId?: string })` - Google Sheets tab for a room.

## Interfaces
- **Backend endpoints called (external Taskroom service, via `useIntegrationList`):** list/create/update/delete on `{NEXT_PUBLIC_TASKROOM_URL}external/integrations` with `type=googlesheet`.
- **External services:** Google Sheets (iframe embed).

## Dependencies
- **Internal:** `components/athena/components/integration-view-shell.tsx` - shell layout and room-not-found state; `components/athena/components/integration-iframe-content.tsx` - `IntegrationIframe`, `IntegrationEmptyState`, `IntegrationInvalidState`; `components/athena/components/use-integration-list.ts` - data hook; `store/taskroom/taskroomWorkspace.tsx` - current room.
- **Packages:** `next` - `useSearchParams`; `lucide-react` - icons; `react`.

## Used by
- `components/athena/ProjectMangement.tsx` - "Sheets" view.
- `components/athena/projectmangerbacku.tsx` - an older backup copy of the project manager.
