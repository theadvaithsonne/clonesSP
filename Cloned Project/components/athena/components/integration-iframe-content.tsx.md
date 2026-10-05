# `components/athena/components/integration-iframe-content.tsx`

> Four presentational components for the main area of an Athena room integration view (Figma, Google Calendar, Sheets, YouTube): an empty or loading state, an invalid-link state, a generic embed iframe and a YouTube embed iframe.

**Kind:** React component module (client) · **Lines:** 98

## Purpose
Each Athena room "integration" view embeds an external tool's page next to a sidebar list of saved links. The sidebar is `IntegrationViewShell`. The content area that goes inside the shell (as its `children`) looks much the same for every integration, so the shared pieces live here. The components have no state and fetch nothing; the calling view decides which one to render. In Figmaview, for example: the iframe when the active link is valid, the invalid state when it is not, and the empty state when nothing is saved.

## How it works
- `IntegrationEmptyState` - a full-height dark panel. While `isLoading` is true it shows a spinner and `loadingLabel`. Otherwise it shows the given `icon`, `title`, `description` and a brand-coloured call-to-action button (`cta`, `onCta`), which callers wire to "open the add-link form".
- `IntegrationInvalidState` - a centred card titled "Invalid URL" with a caller-supplied `message`. It is used when the saved link does not pass the view's URL validation.
- `IntegrationIframe` - a full-size borderless iframe on a white background, with a minimum height of 240px. Its default `allow` list is `autoplay; encrypted-media; clipboard-read; clipboard-write; fullscreen`, and callers can override it with `allow`.
- `IntegrationYoutubeIframe` - a black container with an absolutely positioned iframe that fills it and allows `autoplay; encrypted-media; picture-in-picture; fullscreen`. The minimum height is 200px on small screens and is removed from the `sm` breakpoint up.

## Exports
- `IntegrationEmptyState({ isLoading, loadingLabel, icon, title, description, cta, onCta })` - loading spinner, or an empty-state panel with a call to action.
- `IntegrationInvalidState({ message })` - message shown when the saved link is invalid.
- `IntegrationIframe({ src, title, allow? })` - generic embed frame.
- `IntegrationYoutubeIframe({ src, title })` - YouTube embed frame.

## Dependencies
- **Internal:** `./integration-view-shell` - imports the `IntegrationItem` type, which this file never uses.
- **Packages:**
  - `react` - JSX and component types.
  - `lucide-react` - the `Loader2` and `Plus` icons.

## Used by
- `components/athena/components/Figmaview.tsx`
- `components/athena/components/GoogleCalendarview.tsx`
- `components/athena/components/SheetsView.tsx`
- `components/athena/components/Youtubeview.tsx`

## Notes
- The embedded pages load third-party sites (Figma, Google, YouTube) inside iframes, and the default `allow` list grants clipboard read/write and autoplay to them.
- The iframe has no `sandbox` attribute.
