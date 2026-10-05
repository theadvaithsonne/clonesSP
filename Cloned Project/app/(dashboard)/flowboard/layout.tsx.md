# `app/(dashboard)/flowboard/layout.tsx`

> Layout for every `/flowboard` route: connects the global Flowboard notification socket for the signed-in user and applies the Flowboard light/dark theme wrapper.

**Kind:** Next.js layout (client component) · **Lines:** 79 · **Route:** `/flowboard` (and all child routes)

## Purpose
Flowboard (Garage's Kanban boards feature, backed by the external Flowboard service at `uatapi.garage.app`) needs a user-level notification socket that stays open while the user moves between the board list and individual boards. Putting it in the layout means it is opened once when entering `/flowboard*` and closed when leaving the section. The layout also applies the theme from the persisted Flowboard theme store.

## How it works
- **Mount flag:** `mounted` starts `false` and flips to `true` after the first effect. Before mount it renders a wrapper with only background classes; after mount it adds text-colour classes. Both branches choose `dark min-h-screen bg-[#0b0b0d]` or `min-h-screen bg-white` from `theme`, so the flag mainly avoids a hydration mismatch with the localStorage-persisted theme.
- **Notification socket effect (runs once):** reads `localStorage["garage_tok"]`, decodes it with `jwt-decode`, logs the payload, and if it contains both `orgId` and `userId` calls `notificationSocketService.connect(payload.userId)`. The cleanup calls `notificationSocketService.disconnect()`.
- `fetchUserProfile` and `userProfile` are read from the Flowboard user store but not used; an older effect that connected using `userProfile._id` is commented out.

## Exports
- `default FlowboardLayout({ children })` - wraps children in a themed full-height container.

## Interfaces
- **Socket.IO events:** indirectly, through `notificationSocketService`, connects to the external Flowboard server namespace `/notifications` (path `/flowboard/socket/`). That service also requires an `auth-token` in localStorage or cookies; without it the connect call is a no-op.
- **External services:** Flowboard real-time server at `https://uatapi.garage.app`.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]`; the theme store persists to `localStorage["theme-storage"]`.

## Dependencies
- **Internal:**
  - `app/(dashboard)/flowboard/lib/notification-socket-service.ts` - the global notification socket singleton.
  - `store/flowboard/themeStore.ts` - persisted `theme` (`'dark'` by default).
  - `store/flowboard/userStore.ts` - Flowboard user profile store (currently unused here).
- **Packages:** `react`, `jwt-decode`.

## Used by
Not imported; applied by Next.js to `/flowboard` and `/flowboard/[symbol]` (inside the `(dashboard)` route group's own layout).

## Notes
- The token payload is written to the console (`console.log("payload", payload)`), which exposes user id, org id and email in the browser console.
- `jwtDecode` is not wrapped in try/catch; a malformed `garage_tok` would throw during the effect.
- Because the theme default is `dark`, Flowboard renders dark unless the user changed it.
