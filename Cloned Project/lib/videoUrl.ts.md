# `lib/videoUrl.ts`

> Helpers to recognise YouTube and Vimeo URLs, turn them into embed and thumbnail URLs, and fetch YouTube oEmbed metadata.

**Kind:** frontend library · **Lines:** 75

## Purpose
Course and content pages let creators paste a video link. This module centralises the URL parsing that used to be duplicated across `CoursesPage`, `ContentPage` and guest pages (per the header comment), so every surface extracts IDs and builds iframes the same way.

## How it works
- `YOUTUBE_ID_REGEX` matches the 11-character video ID in `youtube.com/watch?v=`, `/embed/`, `/shorts/`, `/v/` and `youtu.be/` links.
- Embed builders fall back to returning the original URL when no ID is found, so a caller can pass any link straight into an `<iframe src>`.
- `getYouTubeThumbnail` maps a quality keyword to YouTube's static image names (`default`, `mqdefault`, `hqdefault`, `sddefault`, `maxresdefault`) on `img.youtube.com`. Note `maxresdefault` does not exist for every video.
- `getVimeoEmbedUrl` only understands numeric `vimeo.com/<id>` links.
- `isYouTubeUrl` / `isVimeoUrl` are simple substring checks (they also match those words appearing anywhere in the string).
- `fetchYouTubeOEmbed` calls YouTube's public oEmbed endpoint (no API key), accepts an optional `AbortSignal`, and returns `null` on a non-YouTube URL, a non-OK response or any network error.

## Exports
- `getYouTubeId(url: string): string | null`
- `getYouTubeEmbedUrl(url: string): string` - `https://www.youtube.com/embed/<id>` or the input.
- `getYouTubeThumbnail(url: string, quality: "default" | "mq" | "hq" | "sd" | "maxres" = "hq"): string | null`
- `getVimeoEmbedUrl(url: string): string` - `https://player.vimeo.com/video/<id>` or the input.
- `isYouTubeUrl(url: string): boolean`
- `isVimeoUrl(url: string): boolean`
- `type YouTubeOEmbed` - `title`, `author_name`, `author_url`, `thumbnail_url`, `thumbnail_width`, `thumbnail_height`, `provider_name`.
- `fetchYouTubeOEmbed(url: string, signal?: AbortSignal): Promise<YouTubeOEmbed | null>`

## Interfaces
- **External services:** YouTube oEmbed (`https://www.youtube.com/oembed`), YouTube image CDN (`img.youtube.com`), YouTube and Vimeo embed players.

## Dependencies
- None (uses global `fetch`).

## Used by
- `components/dashboard/CoursesPage.tsx`

## Notes
- The header says the logic was consolidated from several pages, but only `CoursesPage.tsx` imports it; other pages may still carry their own copies.
