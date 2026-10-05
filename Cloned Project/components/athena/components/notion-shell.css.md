# `components/athena/components/notion-shell.css`

> Layout-only stylesheet that makes an embedded Notion page (rendered by `NotionPageViewer.tsx`) fill its container, and that styles the viewer's loading state.

**Kind:** Stylesheet · **Lines:** 82

## Purpose
`NotionPageViewer.tsx` renders Notion content inside the Taskroom/Athena UI. By default, Notion renderer markup caps the page at a fixed reading width and gives it its own scroller. This file overrides only those layout constraints so the document stretches to the full panel width. The header comment states that it deliberately leaves Notion's block styles alone.

## How it works
- `.garage-notion-canvas` is a full-size, vertically scrolling white container.
- `.garage-notion-document` is a full-width, white wrapper that sets the CSS variable `--notion-max-width: 100%`. It sets the variable again on the nested `.notion` root.
- Inside the document wrapper, the rules remove the width caps on Notion's internal elements: `.notion-frame`, `.notion-page-scroller` (which also gets `min-height: auto`) and `.notion-page-content-inner`.
- A media query (`min-width: 1300px` and `min-height: 300px`) keeps pages with an aside (`.notion-page-content-has-aside`) at full width.
- Loading state:
  - `.garage-notion-loading` is a centred dark (`#0e0e12`) column with muted 13px text.
  - `.garage-notion-loading-bar` is a 120×3px track. Its `::after` pseudo-element is a brand-coloured (`var(--brand)`) bar that slides across the track using the `garage-notion-shimmer` keyframes (1.2s, infinite).

## Exports
None. It is a plain global CSS file imported for its side effects.

## Dependencies
- Relies on the `--brand` CSS variable defined by the app's theme.
- Targets class names produced by the Notion renderer used in `NotionPageViewer.tsx`.

## Used by
- `components/athena/components/NotionPageViewer.tsx`, through `import "./notion-shell.css"`. It uses `garage-notion-loading`, `garage-notion-loading-bar`, `garage-notion-canvas` and `garage-notion-document`.

## Notes
- Next.js loads it as global CSS, so these class names apply app-wide. The `garage-notion-` prefix keeps them from colliding with other styles.
