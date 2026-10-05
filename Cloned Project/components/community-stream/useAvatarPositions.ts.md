# `components/community-stream/useAvatarPositions.ts`

> Hook that owns the 2D world for a Community Stream: avatar positions, keyboard movement, a camera that follows the local avatar, and position sync over Socket.IO.

**Kind:** React hook (client) + constants · **Lines:** 241

## Purpose
The Community Stream room is a large virtual office floor of 5000 x 3000 px, and the screen shows only part of it. This hook does three jobs:
- keeps every participant's world position;
- moves the local avatar with the arrow keys or WASD;
- computes the camera offset that keeps the local avatar centred, and syncs positions with other clients through the backend.

`useProximityAudio` uses these positions to decide who can hear whom.

## How it works
**Constants:**
- `WORLD_WIDTH = 5000`, `WORLD_HEIGHT = 3000`
- `MOVE_SPEED = 30` px per keypress (private)
- `AVATAR_SIZE = 64`
- `RADIUS_CIRCLE_SIZE = 300`: the diameter of the hearing circle.

**State:**
- `positions`: `Map<userId, {x, y}>` in world pixels.
- `cameraOffset`: the world coordinate of the viewport's top-left corner.
- `viewportSize`
- `containerRef`: must be attached to the viewport element.

**Joining (effect on `inCall` and `meId`):**
1. Picks a random start position with a 200 px margin from the world edges and stores it for `meId`.
2. Centres the camera after 50 ms.
3. Emits `community-stream:position-update` with `{x, y}`.
4. Subscribes to:
   - `community-stream:position-changed` (`{odId, x, y}`): upserts one user's position.
   - `community-stream:positions-sync` (`{positions: [...]}`): bulk load of positions; never overwrites the local user's own entry.
   - `community-stream:user-left` (`{odId}`): removes the user.

**Camera:**
- `updateCamera(x, y)` reads the container's bounding rect.
- It centres the camera on `(x, y)` and clamps the offset to `[0, WORLD - viewport]`.

**Resize:**
- A `ResizeObserver` on the container updates `viewportSize` and re-centres the camera on the local avatar.

**Movement:**
- A `window` `keydown` listener (active only while `inCall`) handles `ArrowUp/Down/Left/Right` and `w/a/s/d` in either case.
- It calls `preventDefault()` and moves the avatar by 30 px, clamped so the hearing circle stays inside the world.
- Inside the `setPositions` updater it also:
  - re-centres the camera;
  - emits `community-stream:position-update` with the new position.

**Helpers:**
- `worldToScreen(x, y)` subtracts the camera offset.
- `isInViewport(x, y, margin = 200)` checks whether a world point falls inside the viewport plus a margin.

**Backend side** (`server/realtime/socket.ts`):
- An in-memory `communityStreamPositions` map, keyed by channel and then by user.
- On `community-stream:position-update`, the server stores the position for the socket's cached channel and broadcasts `community-stream:position-changed` to the other members of that channel.
- On join, the server emits `community-stream:positions-sync` with any existing positions.
- On leave, the server deletes the user's entry and emits `community-stream:user-left`.

## Exports
- `useAvatarPositions(meId: string, inCall: boolean)` returns `{ positions, cameraOffset, viewportSize, containerRef, worldToScreen, isInViewport, worldDimensions: { width, height } }`.
- `WORLD_WIDTH`, `WORLD_HEIGHT`, `AVATAR_SIZE`, `RADIUS_CIRCLE_SIZE` (numbers).

## Interfaces
- **Socket.IO events:**
  - Emits `community-stream:position-update`.
  - Listens for `community-stream:position-changed`, `community-stream:positions-sync` and `community-stream:user-left`.
- **Background work:** a window `keydown` listener and a `ResizeObserver`.

## Dependencies
- **Internal:** `lib/socket.ts` (`connectSocket`).
- **Packages:** `react`.

## Used by
- `components/community-stream/CommunityStreamOverlay.tsx`
- `components/community-stream/useProximityAudio.ts` (imports `RADIUS_CIRCLE_SIZE`)
- `components/community-stream/index.ts`

## Notes
- **Keyboard capture is global.** While the user is in a call, every W/A/S/D and arrow keypress anywhere on the page is swallowed by `preventDefault`, including keypresses in text inputs.
- Side effects (the socket emit and `updateCamera`) run inside a React state updater. In React Strict Mode (development), updaters run twice, so each move can be emitted twice.
- **`positions-sync` is probably missed.** The server sends it while it handles `workspace:move-to-space`, but this hook subscribes only once `inCall` becomes true. That happens after the LiveKit connection completes, so the sync most likely arrives before the listener exists. If so, users already in the room stay invisible until they next move.
- The resize effect depends on `positions`, so the `ResizeObserver` is torn down and recreated on every movement.
- The field is named `odId` (probably a typo for "id" or "uid") both here and in the server payloads.
