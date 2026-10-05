# `hooks/useWebinarLivePreview.ts`

> A React hook that detects a live webinar in the user's current organization (by polling and through Socket.IO events) and decides whether to show the floating "webinar is live" preview popup.

**Kind:** React hook · **Lines:** 201

## Purpose
When someone in an organization goes live with a webinar, other members see a floating preview popup that invites them to join. This hook supplies the popup's data and visibility rules. It works out the org from auth storage, so no props are needed. It also handles hiding the popup for the host, for users who dismissed it, and for users who already opened the webinar in another tab.

## How it works
**Org tracking.** `orgId` starts as `getOrgId()` (localStorage `garage_org_id`) or the `orgId` claim in the token. A `storage` listener for `garage_org_id` updates it when another tab switches org and clears all webinar state.

**Fetching.** `fetchLive()` calls `GET ${API_URL}/workshop-preview/live?orgId=...` with `cache: "no-store"`. It stores `d.workshop` when `d.success` and a workshop are present, and `null` otherwise or on error. It runs on mount and every 30 s (`POLL_MS`), and restarts when `orgId` changes.

**Realtime.** With an `orgId`, it gets the shared socket from `connectSocket()` and listens for:
- `workshop:preview:live` - refetches.
- `workshop:preview:ended` - clears the webinar and removes every `webinar_preview_joined_<userId>_*` key from localStorage.
The backend emits these only to the org's room (see `emitWorkshopPreviewUpdate` in `server/services/socket.ts`, called from `server/routes/workshopPreview.ts`, `webinarRoutes.ts`, `publicMeet.ts`, `server/realtime/mediasoupHandlers.ts` and `webinarEnd.ts`).

**Dismissed.** sessionStorage `webinar_preview_dismissed_<workshopId>` = `"1"` hides the popup for that workshop in this tab. `dismiss()` sets it.

**Joined elsewhere.** `markJoined(workshopId)` writes the current timestamp to localStorage `webinar_preview_joined_<userId>_<workshopId>`. `checkJoined()` treats the flag as valid for 30 minutes (`JOINED_TTL_MS`) and re-runs on cross-tab `storage` events. When this tab becomes visible again and the flag is older than 5 s, the flag is cleared, on the assumption that the user has come back from the webinar tab.

**Visibility rule.** `shouldShow` is true only when a webinar exists, the user is not the host (compares `hostEmail` with the token email, case-insensitive), it has not been dismissed, it has not been joined elsewhere, and `webinarType !== "livekit"`. LiveKit webinars are excluded because the preview player (`useMediasoupAudience`) supports only mediasoup.

## Exports
- `useWebinarLivePreview()` - returns `{ webinar: LiveWebinarInfo | null, shouldShow, dismiss(), markJoined(workshopId), refetch }`.
- `interface LiveWebinarInfo` - `{ workshopId, title, thumbnail, hostName, hostProfilePicture, hostEmail, meetId, agoraChannel, startedAt, viewerCount, isScreenSharing, screenSharingByUid, webinarType? }`.

## Interfaces
- **Backend endpoints called:** `GET /backend/workshop-preview/live?orgId=<id>` - public (no auth); returns the most recently started live workshop for the org (`server/routes/workshopPreview.ts`).
- **Socket.IO events:** listens for `workshop:preview:live` and `workshop:preview:ended`.
- **Browser storage / cookies:** localStorage `garage_org_id` (read and watched), `webinar_preview_joined_<userId>_<workshopId>` (timestamp); sessionStorage `webinar_preview_dismissed_<workshopId>`.
- **Background work:** 30-second polling interval.

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL` (the `/backend` base); `lib/socket.ts` - `connectSocket` (shared Socket.IO client); `lib/auth.ts` - `getOrgId`, `getUserDataFromToken`.
- **Packages:** `react`.

## Used by
- `app/(dashboard)/workspace/components/NetworkStatsCard.tsx`
- `components/webinar-live-preview/WebinarLivePreviewPopup.tsx`

## Notes
- The `storage` event fires only in *other* tabs, so an org switch in the same tab is not picked up until remount.
- The socket listeners are removed on cleanup, but the socket itself is shared and is not disconnected here.
