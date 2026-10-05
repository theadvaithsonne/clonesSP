# `components/athena/components/Youtubeview.tsx`

> The Athena room "Videos" integration: lets users link YouTube videos to a Taskroom room and watch them in an embedded player.

**Kind:** React component · **Lines:** 182

## Purpose
Athena rooms can host "integrations" - saved external links of a given type shown inside the app. This file is the YouTube flavour. It contributes only the YouTube-specific parts (copy, URL validation, embed URL building) and reuses the generic integration shell, iframe components and list hook shared by the other integration views.

## How it works
- **Room resolution:** uses the `roomId` prop if given; otherwise, on shared-task URLs (`?shareTask=...`) the `roomId` query parameter; otherwise `currentRoomDetail._id` from the Taskroom store. With no room it renders `IntegrationRoomNotFound`.
- **Data:** `useIntegrationList(roomId, "youtube")` manages the list, pagination sentinel, search, selection, add/edit form and delete. That hook talks to the external Taskroom API at `{NEXT_PUBLIC_TASKROOM_URL}external/integrations` (GET filtered by `type`, POST, PUT `/:id`, DELETE `/:id`).
- **Validation (`isValidYoutubeUrl`):** host must be `youtube.com`, `youtu.be` or `youtube-nocookie.com` (ignoring `www.`, `m.`, `music.`), and the URL must be a `youtu.be/<id>`, `/watch?v=`, `/embed/` or `/shorts/` form. `handleSave` passes this to `list.saveIntegration` as a validator that returns an error message or `null`.
- **Embedding (`buildIframeUrl`):** extracts the video ID and returns `https://www.youtube.com/embed/<id>?rel=0&modestbranding=1`; falls back to the original URL.
- **Rendering:** `IntegrationViewShell` gets `YOUTUBE_CONFIG` (all labels/placeholders) plus every list field. The header shows an "Open on YouTube" link for the active item. The body shows the YouTube iframe for a valid link, an invalid-link notice for a stored bad link, or an empty state whose CTA opens the sidebar and the add form.

## Exports
- `default Youtubeview({ roomId?: string })` - the YouTube integration view for a room.

## Interfaces
- **External services:** Taskroom API `external/integrations` (via `useIntegrationList`); YouTube embed player (iframe).

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` (`currentRoomDetail`), `./integration-view-shell` (`IntegrationViewShell`, `IntegrationRoomNotFound`), `./integration-iframe-content` (`IntegrationEmptyState`, `IntegrationInvalidState`, `IntegrationYoutubeIframe`), `./use-integration-list` (list CRUD hook).
- **Packages:** `react` (`useMemo`), `next/navigation` (`useSearchParams`), `lucide-react` (icons).

## Used by
- `components/athena/ProjectMangement.tsx`
