# `components/athena/components/Figmaview.tsx`

> The "Figma" tab of the Athena project-management panel: users save Figma file links against a taskroom room and preview them in an embedded iframe.

**Kind:** React component · **Lines:** 169

## Purpose
Athena (the taskroom / project-management panel) has several "integration" tabs: Figma, Google Calendar, Notion, YouTube and Sheets. Each tab keeps a per-room list of external links and shows the selected one inside the app. This file is the Figma version. It only supplies the Figma-specific pieces: UI copy, URL validation and building the embed URL. The list, the sidebar, the add/edit form and the API calls all come from the shared `useIntegrationList` hook and the `IntegrationViewShell` layout.

## How it works
- **Room resolution (L74-L80):** the room ID is chosen in this order:
  1. the `roomId` prop;
  2. if the URL has a `shareTask` query parameter (a shared-task link), the `roomId` query parameter;
  3. otherwise `currentRoomDetail._id` from the taskroom workspace store.

  If no room ID results, the component renders `IntegrationRoomNotFound` with a "Room not found" message.
- **Data:** `useIntegrationList(resolvedRoomId, "figma")` loads and pages the room's integrations of type `figma`, and owns all form and sidebar state.
- **`FIGMA_CONFIG` (L18-L45):** all labels, placeholders and empty-state copy that `IntegrationViewShell` displays (brand letter "F", "Designs", "Connect", and so on).
- **`isValidFigmaUrl` (L61-L71):** accepts only `figma.com` or `www.figma.com` URLs whose path starts with `/file/`, `/proto/`, `/board/`, `/embed/` or `/design/`.
- **`buildIframeUrl` (L47-L59):**
  - a Figma URL whose path already starts with `/embed` is used unchanged;
  - any other Figma URL is wrapped as `https://www.figma.com/embed?embed_host=share&url=<encoded url>`;
  - anything else is returned unchanged.
- **Save (L84-L87):** `list.saveIntegration` gets a validator that returns an error message for a non-Figma URL. No link normaliser is passed.
- **Render (L101-L167):** the component renders `IntegrationViewShell`.
  - When an item is selected, the header shows an "Open in Figma" link that opens the stored link in a new tab.
  - The body depends on the selected item:
    - **Valid link:** `IntegrationIframe` with camera, microphone, clipboard and autoplay permissions.
    - **Invalid saved link:** `IntegrationInvalidState`, which asks the user to edit the link.
    - **Nothing selected:** `IntegrationEmptyState`. Its CTA opens the sidebar and the add form.

## Exports
- `default FigmaView({ roomId?: string })`: the Figma integration tab. `roomId` overrides how the room is resolved.

## Interfaces
- **Backend endpoints called:** none directly. Through `useIntegrationList`, it calls the external Taskroom service (not part of this repo): `GET/POST <TASKROOM>/external/integrations` and `PUT/DELETE <TASKROOM>/external/integrations/:id`, with `type=figma`. `<TASKROOM>` is `NEXT_PUBLIC_TASKROOM_URL`, which defaults to `https://uatapi.garage.app/taskroomv2/v2/`.
- **External services:** Figma embed (`https://www.figma.com/embed`) in an iframe.
- **Browser storage / cookies:** indirect. The hook reads the `garage_tok` bearer token from `localStorage`.

## Dependencies
- **Internal:**
  - `components/athena/components/use-integration-list.ts`: list, paging, CRUD and form state.
  - `components/athena/components/integration-view-shell.tsx`: `IntegrationViewShell` layout and `IntegrationRoomNotFound`.
  - `components/athena/components/integration-iframe-content.tsx`: iframe, empty state and invalid state.
  - `store/taskroom/taskroomWorkspace.tsx`: `useTaskroomWorkspacetore`, which provides `currentRoomDetail`.
- **Packages:** `react` (`useMemo`), `next/navigation` (`useSearchParams`), `lucide-react` (`Figma` and `ExternalLink` icons).

## Used by
- `components/athena/ProjectMangement.tsx`: renders it for the `"Figma"` tab as `<Figmaview />`, without a `roomId` prop. `ProjectMangement` is mounted from `app/(dashboard)/layout.tsx`, so this tab is reachable from any dashboard page that opens the Athena panel.

## Notes
- `GoogleCalendarview.tsx` follows the same pattern, so a fix to the shared shell or hook affects both tabs.
- The header link uses the raw stored link, not the embed URL.
