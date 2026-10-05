# `components/affiliate/globe/AffiliateGlobeMap.tsx`

> Mapbox GL 3D globe that plots the focused affiliate and their direct referrals as avatar markers with popups, auto-rotation and fly-to navigation.

**Kind:** React component · **Lines:** 455

## Purpose
Visual half of the affiliate network explorer. It receives ready-made `GlobeMarkerData` from `useAffiliateGlobe` and renders them on a dark, slowly spinning globe. Marker popups let the user drill into a referral's network or open their profile; both actions are reported back to the parent through callbacks.

## How it works
### Map setup (L247-L319)
- Requires `NEXT_PUBLIC_MAPBOX_TOKEN`; without it the component renders "Mapbox token not configured" and never creates a map.
- Creates a `mapboxgl.Map` with style `mapbox://styles/mapbox/dark-v11`, `projection: "globe"`, centre `[0, 20]`, zoom 1.5, no world copies.
- On `style.load` it applies `setFog` for an atmosphere/star-field look; on `load` it sets `mapLoaded`, which gates marker creation.
- Window `resize` calls `map.resize()`. Cleanup cancels the animation frame, removes markers and popups and destroys the map.

### Auto-rotation (L227-L245, L321-L329)
- `spinGlobe` runs on `requestAnimationFrame`, shifting the centre longitude so a full revolution takes about 120 s at zoom 0, slowing as zoom increases (`speedFactor = max(0.1, 1 - zoom/10)`).
- `isSpinning` (state) and `isSpinningRef` (for the RAF loop) control it. Drag, pitch, rotate and zoom start events pause spinning via `userInteractingRef`; the matching end events resume it if spinning is still enabled.
- A bottom-left pause/play button toggles `isSpinning`; a second button flies back to the world view.

### Markers and popups (L48-L195)
- `createMarkerElement` builds a DOM element with classes `affiliate-globe-marker` plus `has-children`, `founder`, `focused`, and `pro-plan` / `basic-plan` from purchases (styles in `app/globals.css`). It shows the avatar image (falling back to the initial on load error) or the initial on a gradient (amber for founders, purple otherwise).
- `createPopupHTML` builds the popup as an HTML string: avatar, name (with " (You)" for the focused marker), a Founder/Member badge, purchase badges (`$25` for Unilevel Plus, `Basic`, `Pro`), the referral count and buttons. The focused marker gets only "View Profile"; others get "View Network" (only when `hasChildren`) and "View Profile". Buttons carry `data-user-id` / `data-profile-id`.
- `addMarkers` clears previous markers, then adds one `mapboxgl.Marker` and one `mapboxgl.Popup` per entry. Clicking a marker closes other popups, opens its popup, stops rotation and flies to it (zoom at least 3). It re-runs whenever `markers` or `mapLoaded` changes.

### Popup button handling (L197-L225)
Because popup content is raw HTML, a single document-level `click` listener uses `closest(".affiliate-popup-button")`: a `data-user-id` button calls `onMarkerClick(userId)` (drill down), a `data-profile-id` button calls `onViewProfile(profileId)`. Both close all popups first.

### Following the focused user (L336-L355)
When `focusedUser.id` changes (after load), the map flies to the user's stored coordinates at zoom 2, or back to the world view if they have none.

### Overlays
A dimmed spinner while `isLoading`, and a "No referrals to display on the globe" banner when not loading and `markers` is empty.

## Exports
- `AffiliateGlobeMap(props)` - props:
  - `markers: GlobeMarkerData[]` - what to plot.
  - `focusedUser: AffiliateUser | null` - drives the fly-to.
  - `onMarkerClick(userId)` - "View Network" pressed.
  - `onViewProfile(userId)` - "View Profile" pressed.
  - `isLoading: boolean` - shows the loading overlay.

## Interfaces
- **External services:** Mapbox GL JS with Mapbox-hosted tiles and the `dark-v11` style.
- **Environment variables:** `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox public access token.

## Dependencies
- **Internal:** `./types` - `GlobeMarkerData`, `AffiliateUser` (also imports `getLocationString`, unused).
- **Packages:** `mapbox-gl` (+ `mapbox-gl/dist/mapbox-gl.css`) - globe rendering; `react` - hooks.

## Used by
- `components/affiliate/globe/AffiliateGlobeView.tsx`
- `components/affiliate/globe/index.ts` (re-export)

## Notes
- **Unescaped HTML.** `marker.name` and `marker.avatar` are interpolated into `setHTML(...)` popup markup and, on the initial fallback, into `innerHTML`, without escaping. Names are user-controlled, so a crafted display name could inject markup or script into another user's browser when they view the globe. Escaping these values (or building the popup with DOM nodes) would close this.
- The document-level click listener reacts to any element with class `affiliate-popup-button` anywhere on the page, not only inside this map.
- The focused-user fly-to uses the user's raw `location`, not the jittered fallback coordinates its marker was placed at, so for users without stored coordinates the camera resets to world view while the marker appears elsewhere.
- The focused-user effect intentionally depends on `focusedUser?.id` only (no lint-complete dependency list).
