# `lib/giphy.ts`

> Browser-side client for the app's own `/api/giphy` proxy. It searches and lists trending GIFs and stickers, and picks the right image size for a thumbnail or a chat message.

**Kind:** frontend library · **Lines:** 135

## Purpose
The chat GIF picker needs GIPHY results without exposing the GIPHY API key in the browser. A Next.js route handler (`app/api/giphy/route.ts`) holds the key on the server. This file builds requests to that proxy, turns errors into readable messages and chooses image renditions from GIPHY's many size variants.

## How it works
**Request building (`callProxy`, private).** Builds a URL for `/api/giphy` on `window.location.origin` and sets `action` (`search` | `trending`), `type` (`gifs` | `stickers`), and `q`, `limit`, `offset` and `rating` when given. It then sends a GET request. Because it uses `window`, it only runs in the browser.

**Error handling.** On a non-OK response it tries to read `error` or `detail` from the JSON body. A 503 means the server has no `GIPHY_API_KEY` (the proxy returns 503 in that case), and it is reported as a setup error asking for the key to be set and the server restarted. Any other failure throws with the proxy's message, or `"Giphy proxy <status>"` if there is none.

**Public wrappers.** Four thin functions combine the action and type. Each returns the raw GIPHY response body `{ data, pagination? }`.

**Picking a rendition.** GIPHY sends width and height as strings, so a private `num()` helper converts them to numbers (or `undefined`).
- `pickPreview` is for the picker's 3-column grid. It prefers the small renditions to keep the grid light: `fixed_width_small` → `fixed_height_small` → `preview_gif` → `fixed_width` → `fixed_height` → `downsized`.
- `pickShare` is for the URL embedded in the chat bubble. It prefers `downsized` (about a 2 MB cap, still high quality) → `original` → `fixed_height` → `fixed_width`, and also returns the GIPHY share page as `source`.
- Both return `{ url: "" }` when none of the variants has a URL.

## Exports
- `interface GiphyImageVariant` - `{ url, width?, height?, size?, mp4?, webp? }` (numbers are given as strings).
- `interface GiphyGif` - `{ id, title?, url?, images: { fixed_width_small?, fixed_width?, fixed_height_small?, fixed_height?, original?, downsized?, preview_gif? } }`.
- `type GiphyRating = "g" | "pg" | "pg-13" | "r"`.
- `giphyTrending(opts?)` - trending GIFs.
- `giphySearch(query, opts?)` - search GIFs.
- `giphyStickersTrending(opts?)` - trending stickers.
- `giphyStickersSearch(query, opts?)` - search stickers.
- `pickPreview(g: GiphyGif): { url, w?, h? }` - grid thumbnail.
- `pickShare(g: GiphyGif): { url, w?, h?, source? }` - full-quality URL to post.

`opts` is `{ limit?, offset?, rating? }`. Every fetch function returns `Promise<{ data: GiphyGif[]; pagination?: { total_count, count, offset } }>`.

## Interfaces
- **Endpoints called:** `GET /api/giphy?action=&type=&q=&limit=&offset=&rating=` - Next.js route handler in this repo (not under `/backend`). It forwards to `https://api.giphy.com/v1/<type>/<action>` and uses rating `g` when none is given.
- **External services:** GIPHY API, reached only through the proxy.
- **Environment variables:** `GIPHY_API_KEY`, read by the proxy route, not by this file.

## Dependencies
- **Internal:** none imported. The file relies on `app/api/giphy/route.ts` at runtime.
- **Packages:** none

## Used by
- `components/chat/GifPicker.tsx`

## Notes
- The proxy also forwards a `lang` parameter, but this client never sends one.
- The proxy rejects a `search` with an empty `q` (see its route file). Callers should use the trending functions when the query is empty.
