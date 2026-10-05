# `lib/webinar/bat246VideoGate.ts`

> Shared catalogue and unlock rules for the BAT246 intro videos and the gotobigwin.com landing tiles, with localStorage read/write helpers.

**Kind:** frontend library · **Lines:** 238

## Purpose
The BAT246 funnel has a public landing page (`components/welcome/Bat246Landing.tsx`, served for gotobigwin.com) whose tiles 2 and 3 unlock as the visitor progresses, and a separate video gallery (`app/bat246-videos/Bat246VideosClient.tsx`, route `/bat246-videos`) where the intro videos are actually watched. Both pages must agree on the same localStorage keys and the same unlock rule, so that logic lives here once instead of being duplicated. The pages are public with no login, so localStorage is the only source of truth; a visitor who clears storage simply sees the funnel again.

## How it works
### Storage keys and thresholds
| Constant | Key | Meaning |
| --- | --- | --- |
| `STORE_KEY` | `bat246:unlocks` | JSON array of unlocked landing tiles (only `2` and `3` are kept). |
| `WATCH_KEY` | `bat246:webinarSeconds` | Seconds of webinar attendance; per the comment, written by the webinar room. |
| `VIDEOS_KEY` | `bat246:videosWatched` | Number of the six intro videos watched (written by the gallery). |
| `WATCHED_KEY` | `bat246:introWatched` | JSON array of watched video IDs. |
| `PRODUCT_KEY` | `bat246:productWatched` | `"1"` once the product film was watched to the end. |

`REQUIRED_WEBINAR_SECONDS` is 15 minutes (unlocks tile 2 on the landing page) and `REQUIRED_VIDEOS` is 6 (unlocks tile 3).

### Video catalogue
- All clips are HLS (`<slug>/master.m3u8`) on a CloudFront distribution whose origin, per the comment, is an S3 prefix under `public/bat246/hls/`. The base URL is the hardcoded `HLS_BASE` constant. This replaced progressive MP4s that buffered badly on phones. The gallery plays HLS natively on Apple devices and via hls.js elsewhere.
- `PRODUCT_VIDEO` (id 0, "The Goose That Laid The Golden Egg") is the NUMBER-1 product film. It is not one of the grid cards; per the comments it is reached from the gallery's footer logo button.
- `VIDEOS` holds the six chapters (ids 1-6: "You've Been Chosen", "Show Me The Money!", "All Products Pass The Grandma Test", "The Secret Formula", "Your Board Never Stops Moving", "Who Wants To Be A Millionaire?"), each with an HLS `src`, tagline and a card image under `/images/`. Video 2 points at a `-v2` slug so the original objects stay on S3 for rollback.
- `src: null` means "coming soon"; today every chapter has a clip, though some comments still describe them as unproduced.

### Unlock rules
- `isVideoUnlocked(id, watched)`: videos 1 and 2 are always unlocked; 3-6 all unlock together once video 2 is in `watched`. "Unlocked" means revealed, not necessarily playable.
- `isVideoPlayable(video, watched)`: unlocked and not coming soon. A former strict-order rule (3 before 4 before 5...) was removed on request; the comment records why.
- `playerCaption(id, watched, productWatched)`: "Watched - pick another or close this" or "Playing…".

### Storage helpers
All read helpers return an empty value during SSR and on parse/storage errors. `persistUnlocks` swallows quota errors. `readNumber` does not wrap `localStorage.getItem` in try/catch, so it can throw where storage access itself is blocked.

## Exports
- Constants: `STORE_KEY`, `WATCH_KEY`, `VIDEOS_KEY`, `WATCHED_KEY`, `PRODUCT_KEY`, `REQUIRED_WEBINAR_SECONDS`, `REQUIRED_VIDEOS`.
- `interface Bat246Video` - `{ id: number; src: string | null; label: string; tagline?: string; image?: string }`.
- `PRODUCT_VIDEO: Bat246Video` - the product film.
- `VIDEOS: Bat246Video[]` - the six chapters.
- `type TileId = 2 | 3` - landing tiles that can be unlocked.
- `isComingSoon(video): boolean`
- `isVideoUnlocked(id: number, watched: Set<number>): boolean`
- `isVideoPlayable(video: Bat246Video, watched: Set<number>): boolean`
- `playerCaption(id: number, watched: Set<number>, productWatched: boolean): string`
- `readProductWatched(): boolean`
- `readUnlocks(): Set<TileId>`
- `persistUnlocks(s: Set<TileId>): void`
- `readNumber(key: string): number` - numeric localStorage value or 0.
- `readWatched(): Set<number>`

## Interfaces
- **Browser storage / cookies:** the five localStorage keys above.
- **External services:** AWS CloudFront (HLS video delivery, origin S3).

## Dependencies
- None.

## Used by
- `app/bat246-videos/Bat246VideosClient.tsx` (route `/bat246-videos`) - plays the videos and writes watch progress.
- `components/welcome/Bat246Landing.tsx` - reads progress on mount and unlocks tiles 2 and 3.

## Notes
- Nothing outside this file in `app/`, `components/`, `hooks/` or `lib/` references the literal `bat246:webinarSeconds`, so the webinar-attendance writer that `WATCH_KEY` describes may not exist; tile 2 would then never unlock by attendance.
- Some comments ("The clips themselves don't exist yet", "the one real intro that exists today") are out of date now that all chapters have `src` set.
