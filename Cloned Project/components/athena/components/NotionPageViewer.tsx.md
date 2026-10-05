# `components/athena/components/NotionPageViewer.tsx`

> Client component that fetches a Notion page's record map through the app's own Next.js API route and renders it read-only with `react-notion-x`.

**Kind:** React component · **Lines:** 112

## Purpose
The Athena / Taskroom project-management area lets a room link Notion pages as "Documents". This component is the actual reader for one linked page: it turns a public or integration-shared Notion URL into rendered blocks inside the app instead of embedding notion.so in an iframe. It is loaded lazily (with SSR disabled) by `Notionview.tsx`.

## How it works
- **Lazy renderer pieces.** `NotionRenderer` is imported via `next/dynamic` with `ssr: false`; the optional third-party block renderers `Collection` (databases), `Code` and `Modal` are dynamically imported from `react-notion-x/build/third-party/*` so their heavy dependencies only load in the browser.
- **Loading.** `loadPage(signal?)` resets state, then calls `GET /api/notion/page?url=<encoded pageUrl>`. On a non-OK response it throws the route's `error` message; on success it stores `json.recordMap`. Aborted requests are ignored so an unmount or URL change does not set stale state.
- **Effect.** A `useEffect` keyed on `loadPage` (which depends on `pageUrl`) and `refreshToken` creates an `AbortController`, runs the load and aborts on cleanup. Bumping `refreshToken` from the parent therefore re-fetches the page.
- **States.**
  - Loading: a `.garage-notion-loading` block with an animated bar and "Loading document...".
  - Error / empty record map: a dark card with the error text and a **Retry** button that calls `loadPage()` again (without an abort signal).
  - Success: `NotionRenderer` inside `.garage-notion-canvas` / `.garage-notion-document`, with `fullPage`, light mode (`darkMode={false}`), `disableHeader`, `previewImages`, `isImageZoomable`, the optional `pageTitle`, and the three dynamic components.
- **Styles.** Imports `react-notion-x/styles.css` plus the local `notion-shell.css`, which only adjusts layout (full-width document, white canvas, loading bar) and does not restyle Notion blocks.

## Exports
- `default NotionPageViewer({ pageUrl, pageTitle?, refreshToken = 0 })` - renders the Notion page at `pageUrl`. `pageTitle` is passed to the renderer; changing `refreshToken` forces a reload.

## Interfaces
- **Backend endpoints called:** `GET /api/notion/page?url=...` - Next.js route handler (`app/api/notion/page/route.ts`) that parses the page ID and returns `{ recordMap, pageId }` via `notion-client`, or `{ error }` with 400/502.
- **External services:** Notion (indirectly, through the API route).

## Dependencies
- **Internal:** `components/athena/components/notion-shell.css` - layout and loading-bar styles.
- **Packages:** `react-notion-x` - Notion block renderer and styles; `notion-types` - `ExtendedRecordMap` type; `next` - `dynamic` imports; `lucide-react` - `AlertCircle`, `RefreshCw` icons; `react`.

## Used by
- `components/athena/components/Notionview.tsx` (dynamic import, `ssr: false`), which is rendered by the "Notion" tab of `components/athena/ProjectMangement.tsx`.

## Notes
- The page must be readable by the server: either published to the web or shared with the integration whose token the API route uses (`NOTION_TOKEN` / `NOTION_API_KEY`); otherwise the route returns a 502 with that hint, which this component displays.
- The parent also changes the component `key` when `refreshToken` changes, so in practice a refresh remounts the viewer as well as re-running the effect.
