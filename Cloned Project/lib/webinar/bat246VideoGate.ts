/**
 * Bat246 intro-video gate — shared between the gotobigwin.com landing page
 * (components/welcome/Bat246Landing.tsx, which only needs to know whether
 * tile 2/3 are unlocked) and the video gallery page
 * (app/bat246-videos/Bat246VideosClient.tsx, which owns actually watching
 * them). Moved out to its own module so both places read/write the exact
 * same localStorage keys and unlock rule — duplicating this logic across
 * two files would have been one missed edit away from the two pages
 * silently disagreeing about what's unlocked.
 *
 * This page is public with no login, so there is no account to hang this
 * state on — localStorage is the only source of truth. A visitor who
 * clears storage simply sees the funnel again, which is harmless.
 */

export const STORE_KEY = "bat246:unlocks";
/** Webinar attendance in seconds, written by the webinar room. */
export const WATCH_KEY = "bat246:webinarSeconds";
/** How many of the 6 intro videos have been watched. */
export const VIDEOS_KEY = "bat246:videosWatched";
export const WATCHED_KEY = "bat246:introWatched";

export const REQUIRED_WEBINAR_SECONDS = 15 * 60;
export const REQUIRED_VIDEOS = 6;

/** Whether the NUMBER-1 product intro has been watched to completion. This
 *  is the entry gate for the whole V1–V6 gallery: it plays first, and only
 *  once it's finished does "You've Been Chosen" (V1) open up. */
export const PRODUCT_KEY = "bat246:productWatched";

export interface Bat246Video {
  id: number;
  /** null = the clip isn't produced yet (a titled "coming soon" chapter). */
  src: string | null;
  label: string;
  tagline?: string;
  /** Card background — falls back to a plain gradient tone when unset. */
  image?: string;
}

/**
 * Every intro is HLS (adaptive bitrate: 360p up to 720p/1080p, 6s segments)
 * served by the `bat246-videos` CloudFront distribution, whose origin is
 * s3://nela-app/public/bat246/hls/<slug>/. The old progressive MP4s under
 * public/bat246/ buffered badly on phones: one fixed bitrate (V1 needed a
 * steady 2.6 Mbps) straight out of us-east-1 with no CDN. Re-encode a new
 * clip into the same <slug>/master.m3u8 layout; the player (see
 * Bat246VideosClient.tsx) plays it natively on Apple devices and via
 * hls.js everywhere else.
 */
const HLS_BASE = "https://d2has1crxwsmiq.cloudfront.net";
const hlsSrc = (slug: string) => `${HLS_BASE}/${slug}/master.m3u8`;

/**
 * The one real intro that exists today — the NUMBER-1 BRAND product film
 * (2:19), self-hosted on the app's own AWS (see HLS_BASE) rather than a
 * throwaway third-party host. It plays FIRST; finishing it is what reveals
 * "You've Been Chosen" and the rest of the gallery.
 */
export const PRODUCT_VIDEO: Bat246Video = {
  id: 0,
  src: hlsSrc("number-1-product"),
  label: "The Goose That Laid The Golden Egg",
  tagline: "Earn like a pro this month.",
  image: "/images/bat246-video-number-1-product.jpeg",
};

/**
 * The founder's six intro chapters. The clips themselves don't exist yet —
 * `src: null` marks each as "coming soon" — but the titles, order and
 * progressive-unlock chain are wired now, so when a real clip is dropped in
 * (set its `src`) it slots straight into the gallery with no other change.
 */
export const VIDEOS: Bat246Video[] = [
  {
    id: 1,
    // HLS on CloudFront, same as PRODUCT_VIDEO above.
    src: hlsSrc("bat246-video-youve-been-chosen"),
    label: "You've Been Chosen",
    tagline: "Earn like a pro this month.",
    image: "/images/bat246-video-youve-been-chosen.jpg",
  },
  {
    id: 2,
    // HLS on CloudFront, same as PRODUCT_VIDEO above. Points at the "-v2"
    // slug (re-encoded 1080p/720p/480p/360p ladder, same settings as every
    // other chapter) rather than overwriting the original
    // "bat246-video-show-me-the-money" objects, so the prior clip is still
    // on S3 untouched if this one ever needs to be rolled back.
    src: hlsSrc("bat246-video-show-me-the-money-v2"),
    label: "Show Me The Money!",
    tagline: "Earn like a pro this month.",
    image: "/images/bat246-video-show-me-the-money.jpeg",
  },
  {
    id: 3,
    // HLS on CloudFront, same as PRODUCT_VIDEO above.
    src: hlsSrc("bat246-video-all-products-pass-the-grandma-test"),
    label: "All Products Pass The Grandma Test",
    tagline: "Earn like a pro this month.",
    image: "/images/bat246-video-all-products-pass-the-grandma-test.jpg",
  },
  {
    id: 4,
    // HLS on CloudFront, same as PRODUCT_VIDEO above.
    src: hlsSrc("bat246-video-the-secret-formula"),
    label: "The Secret Formula",
    tagline: "Beat the clock — time leverage.",
    image: "/images/bat246-video-the-secret-formula.jpg",
  },
  {
    id: 5,
    // HLS on CloudFront, same as PRODUCT_VIDEO above.
    src: hlsSrc("bat246-video-your-board-never-stops-moving"),
    label: "Your Board Never Stops Moving",
    tagline: "Earn like a pro this month.",
    image: "/images/bat246-video-your-board-never-stops-moving.jpg",
  },
  {
    id: 6,
    // HLS on CloudFront, same as PRODUCT_VIDEO above.
    src: hlsSrc("bat246-video-who-wants-to-be-a-millionaire"),
    label: "Who Wants To Be A Millionaire?",
    tagline: "Earn like a pro this month.",
    image: "/images/bat246-video-who-wants-to-be-a-millionaire.jpg",
  },
];

export type TileId = 2 | 3;

/** A chapter with no clip yet — teased, titled, but not playable. */
export function isComingSoon(video: Bat246Video): boolean {
  return !video.src;
}

/**
 * Two-stage gallery gate, not a per-chapter chain. V1 ("You've Been
 * Chosen") and V2 ("Show Me The Money!") are both open unconditionally —
 * they're the grid's two starting cards, so there's nothing to earn before
 * seeing them. Then, watching V2 opens every remaining chapter (V3-V6) all
 * at once — the founder doesn't want a further one-by-one gate once the
 * visitor is past the first real video, since most of the rest are
 * "coming soon" stubs anyway.
 *
 * "Unlocked" here means "revealed," not "playable": a chapter can be
 * unlocked and still be coming-soon (no clip). The gallery uses
 * isComingSoon on top of this to decide whether it actually opens.
 *
 * V-00 (the NUMBER-1 product film) isn't part of this at all — it isn't in
 * VIDEOS, and it's never one of the grid cards. It's reached only via the
 * footer logo button on the gallery page (Bat246VideosClient.tsx).
 */
export function isVideoUnlocked(id: number, watched: Set<number>): boolean {
  if (id <= 2) return true;
  return watched.has(2);
}

/**
 * Whether a chapter's card is openable — same two-stage gate as
 * isVideoUnlocked (V1/V2 always, V3-V6 all together the moment V2 is
 * watched), just also requiring the clip to actually exist.
 *
 * Previously this ALSO required each chapter to be watched in strict order
 * (V3 before V4 before V5...), with coming-soon stubs skipped over — that
 * was invisible while V3-V6 were still stubs (isComingSoon already blocked
 * them regardless), but once real clips were dropped in for all of them it
 * started actively locking V4-V6 behind watching V3 first, contradicting
 * the "all unlock together once V2 is watched" design this whole gate was
 * built around. Removed on request — every chapter past V2 is playable
 * the moment V2 is watched, no further one-by-one order.
 */
export function isVideoPlayable(
  video: Bat246Video,
  watched: Set<number>
): boolean {
  if (isComingSoon(video)) return false;
  return isVideoUnlocked(video.id, watched);
}

/** Caption under the player, tuned to what's actually playing/gating. */
export function playerCaption(
  id: number,
  watched: Set<number>,
  productWatched: boolean
): string {
  if (id === PRODUCT_VIDEO.id) {
    return productWatched ? "Watched — pick another or close this" : "Playing…";
  }
  if (watched.has(id)) return "Watched — pick another or close this";
  return "Playing…";
}

/** Read the product-film watched flag from localStorage. */
export function readProductWatched(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRODUCT_KEY) === "1";
  } catch {
    return false;
  }
}

export function readUnlocks(): Set<TileId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    return new Set(arr.filter((n): n is TileId => n === 2 || n === 3));
  } catch {
    return new Set();
  }
}

export function persistUnlocks(s: Set<TileId>) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify([...s]));
  } catch {
    // Private-browsing quota errors must not break the page.
  }
}

export function readNumber(key: string): number {
  if (typeof window === "undefined") return 0;
  const n = Number(window.localStorage.getItem(key));
  return Number.isFinite(n) ? n : 0;
}

export function readWatched(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(WATCHED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}
