# `components/athena/components/GoogleCalendarview.tsx`

> The "Google Calendar" tab of the Athena project-management panel: users save Google Calendar links against a taskroom room and view them in an embedded iframe.

**Kind:** React component · **Lines:** 212

## Purpose
This is one of Athena's per-room "integration" tabs, alongside Figma, Notion, YouTube and Sheets. It keeps a list of Google Calendar links for the current taskroom room and shows the selected calendar inside the app. Listing, paging, the add/edit/delete form and the API calls come from the shared `useIntegrationList` hook and the `IntegrationViewShell` layout. This file adds the calendar-specific URL parsing, validation and embed building.

## How it works
- **Room resolution (L113-L119):** the room ID is chosen in this order:
  1. the `roomId` prop;
  2. if the URL has a `shareTask` query parameter, the `roomId` query parameter;
  3. otherwise `currentRoomDetail._id` from the taskroom workspace store.

  If no room ID results, the component renders `IntegrationRoomNotFound`.
- **Data:** `useIntegrationList(resolvedRoomId, "google-calendar")`.
- **`GOOGLE_CALENDAR_CONFIG` (L18-L45):** the UI copy for the shell ("Calendars", "Connect", placeholders and so on).
- **`extractCalendarUrlFromInput` (L47-L52):** this is the link normaliser passed to `saveIntegration`. If the user pastes Google's full `<iframe ... src="...">` embed snippet, it pulls out the `src` value. Otherwise it returns the trimmed input.
- **`isGoogleCalendarHost` (L54-L57):** returns true only for `calendar.google.com`, with or without a leading `www.`.
- **`isValidGoogleCalendarUrl` (L99-L110):** the host must be `calendar.google.com`, and the URL must match one of these forms:
  - an `/embed` path that has a `src` parameter;
  - a URL with a `cid` or `src` query parameter;
  - a path of the form `/calendar/(u/N/)r/<id>`.
- **`buildIframeUrl` (L59-L97):** turns each accepted form into a `https://calendar.google.com/calendar/embed?src=...` URL:
  - existing `/embed` URLs are kept unchanged;
  - `cid` becomes `src`;
  - `src` is copied along with any of `ctz`, `mode`, `showTitle`, `showNav`, `showDate`, `showPrint`, `showTabs` and `showCalendars`;
  - the `/r/<id>` path segment is URL-decoded into `src`;
  - any other URL is returned unchanged.
- **Save (L123-L130):** the input is normalised first, then validated. An invalid link shows "Please provide a valid Google Calendar URL or embed link."
- **Render (L144-L210):** the component renders `IntegrationViewShell`. The header shows an "Open in Google" link to the stored URL. The body depends on the selected item:
  - **Valid link:** an iframe with clipboard permissions only.
  - **Invalid saved link:** `IntegrationInvalidState`.
  - **Nothing selected:** an empty state whose CTA opens the sidebar and the add form.

## Exports
- `default GoogleCalendarview({ roomId?: string })`: the Google Calendar integration tab.

## Interfaces
- **Backend endpoints called:** none directly. Through `useIntegrationList`, it calls the external Taskroom service (not part of this repo): `GET/POST <TASKROOM>/external/integrations` and `PUT/DELETE <TASKROOM>/external/integrations/:id`, with `type=google-calendar`. `<TASKROOM>` is `NEXT_PUBLIC_TASKROOM_URL`, which defaults to `https://uatapi.garage.app/taskroomv2/v2/`.
- **External services:** Google Calendar embed (`calendar.google.com/calendar/embed`) in an iframe.
- **Browser storage / cookies:** indirect. The hook sends `localStorage.garage_tok` as a bearer token.

## Dependencies
- **Internal:**
  - `components/athena/components/use-integration-list.ts`: data and form state.
  - `components/athena/components/integration-view-shell.tsx`: layout and the room-not-found screen.
  - `components/athena/components/integration-iframe-content.tsx`: iframe, empty state and invalid state.
  - `store/taskroom/taskroomWorkspace.tsx`: provides `currentRoomDetail`.
- **Packages:** `react`, `next/navigation` (`useSearchParams`), `lucide-react` (`CalendarDays` and `ExternalLink` icons).

## Used by
- `components/athena/ProjectMangement.tsx`: renders it for the `"GoogleCalendar"` tab as `<GoogleCalendarview />`. `ProjectMangement` is mounted from `app/(dashboard)/layout.tsx`.

## Notes
- The embed works only for calendars that are public or shared with the viewer's Google account. A private calendar loads Google's own sign-in or permission screen inside the iframe.
- The stored link is the normalised one, so an `<iframe>` snippet is saved as just its `src` URL.
