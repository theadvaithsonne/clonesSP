# `lib/favicon.ts`

> Two pure helpers that extract a hostname from a URL and build a prioritised list of favicon image URLs for it.

**Kind:** frontend library · **Lines:** 21

## Purpose
Intended for UI that shows a website's icon next to a link (bookmarks, link previews). Instead of fetching anything, it returns candidate image URLs so a component can try them in order, falling back on `onError`.

## How it works
- `domainFromUrl(url)` parses the string with `new URL()` and returns `hostname`; if parsing throws (no scheme, garbage input) it returns the input unchanged.
- `faviconCandidates(url, size = 64)` returns three URLs in priority order:
  1. DuckDuckGo icon service (`icons.duckduckgo.com/ip3/<domain>.ico`)
  2. Google S2 favicon service with the requested `sz`
  3. The site's own `https://<domain>/favicon.ico`

## Exports
- `domainFromUrl(url: string): string` - hostname, or the original string on parse failure.
- `faviconCandidates(url: string, size?: number): string[]` - ordered favicon URLs.

## Interfaces
- **External services:** DuckDuckGo icon service and Google S2 favicons (requested by the browser when a component renders the URLs; this file makes no requests itself).

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
Nothing imports it - the file appears unused.

## Notes
- The domain is interpolated without encoding; if `domainFromUrl` falls back to a raw non-URL string, the generated URLs may be malformed.
- Rendering these URLs leaks the visited domain to DuckDuckGo/Google.
