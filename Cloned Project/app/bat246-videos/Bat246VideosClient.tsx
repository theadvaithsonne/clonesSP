"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Info, Lock, Maximize, Play, X } from "lucide-react";
import {
  VIDEOS,
  VIDEOS_KEY,
  WATCHED_KEY,
  REQUIRED_VIDEOS,
  PRODUCT_VIDEO,
  PRODUCT_KEY,
  isVideoUnlocked,
  isVideoPlayable,
  isComingSoon,
  playerCaption,
  readUnlocks,
  readWatched,
  readProductWatched,
  type Bat246Video,
} from "@/lib/webinar/bat246VideoGate";

const NAVY = "#101A35";

// Same destination as the two "JOIN NOW" buns on the gotobigwin.com landing
// page (components/welcome/Bat246Landing.tsx) — the BAT246 office-invite
// checkout, pre-filled with Alan K's referrer id (697a4b54730b71c41d48900c,
// confirmed against the User collection: redbaron2020@mail.com / "Alan K")
// so a signup from here attributes back to him the same way. Opens in a new
// tab via the existing target="_blank" on the <a> below, same as there.
const JOIN_URL =
  "https://my.garage.app/games/bat246/office-invite?productId=6a159466cd9f94f7f23b2ef9&ref=697a4b54730b71c41d48900c";

/** Videos that show a full-bleed collage (instead of the normal "Watch
 *  Next"/ended screen) the moment they finish, each with its own big red
 *  Close button — same pattern as the product film (V-00), now shared by
 *  V-2 ("Show Me The Money!"). Keyed by video id; add an entry here and
 *  drop the image into public/images to give any other chapter the same
 *  treatment with no other code change. */
const END_COLLAGES: Record<number, string> = {
  [PRODUCT_VIDEO.id]: "/images/bat246-product-end-collage.jpg",
  1: "/images/bat246-video-1-end-collage.jpg",
  2: "/images/bat246-video-2-end-collage.jpg",
  3: "/images/bat246-video-3-end-collage.jpg",
  4: "/images/bat246-video-4-end-collage.jpg",
  5: "/images/bat246-video-5-end-collage.jpg",
  6: "/images/bat246-video-6-end-collage.jpg",
};

/** Title-card image shown for half a second right as a video ends, before
 *  the "THE END" bridge clip. Keyed by video id, same pattern as
 *  END_COLLAGES: add an entry (+ its alt text below) to give any other
 *  chapter the same beat with no other code change. */
const PRE_END_IMAGES: Record<number, string> = {
  // Reuses the product film's own gallery cover art — no separate asset.
  [PRODUCT_VIDEO.id]: PRODUCT_VIDEO.image!,
  1: "/images/bat246-video-1-chosen.png",
  2: "/images/bat246-video-2-chosen.jpeg",
  4: "/images/bat246-video-4-chosen.png",
  5: "/images/bat246-video-5-chosen.png",
};
const PRE_END_IMAGE_ALT: Record<number, string> = {
  [PRODUCT_VIDEO.id]: PRODUCT_VIDEO.label,
  1: "You've Been Chosen...",
  2: "Show Me The Money!",
  4: "The Secret Formula",
  5: "Your Board Never Stops Moving",
};
const PRE_END_IMAGE_MS = 500;

/** Alt text per END_COLLAGES entry — kept alongside it so a future addition
 *  can't forget one half of the pair. */
const END_COLLAGE_ALT: Record<number, string> = {
  [PRODUCT_VIDEO.id]: "Welcome to B2",
  1: "The Secret Formula, The Game Changer, Opportunity Real, Baseball-Themed Time Leverage System",
  2: "Congrats — everyone got 2 sales",
  3: "Grandma puzzle — question mark",
  4: "Leader Board — 25% = $400, Minor League Dugout",
  5: "Just Before The Accident, Leader Board 25% Value, $2,000 All Star, Assembly Line",
  6: "Cloud 9 Pod System — Leader Board, $300,000",
};

/** One gradient per card, cycling — purely decorative, keeps the titled
 *  placeholder chapters from reading as one grey wall. */
const CARD_TONES = [
  "from-[#3A2E6B] to-[#241A4A]",
  "from-[#1F4A5C] to-[#12303D]",
  "from-[#5C2E3A] to-[#3A1B24]",
  "from-[#2E5C3E] to-[#1B3A26]",
  "from-[#5C4A1F] to-[#3A2E12]",
  "from-[#3A2E5C] to-[#241A3A]",
];

/** Resolve any id (0 = the product film, 1-6 = a chapter) to its record. */
/**
 * Warm the browser's image cache for a video's end-collage while that video
 * plays. Without this, the <img> in the fullscreen player has no size until
 * it finishes fetching over the network — so the moment a video ends, its
 * wrapping box (and the Close button pinned to that box's corner) briefly
 * renders near-zero-size and gets centered on screen by the flex layout
 * around it, looking like a frozen/stuck button, before snapping to its real
 * top-right position once the fetch completes.
 *
 * react-dom's `preload` (not a bare `new Image()`) is what makes this
 * actually reliable: it emits a real `<link rel="preload" as="image">`, so
 * the browser starts and tracks the fetch itself instead of a JS object that
 * has no listener holding it alive — with `new Image()` a couple of these
 * were observed still taking ~5s on a slower connection, most likely
 * GC'd/deprioritized before the fetch actually landed.
 *
 * Called from the <video>'s `playing` event — only the active clip's, at low
 * priority, once frames are actually on screen. Preloading all seven up
 * front at high priority (26 MB when they were PNGs) starved the video
 * itself: V1 spent 35s of its first 45s buffering on a 5 Mbps line. A clip
 * is minutes long, so there's ample time for one ~0.5 MB JPG. Repeat calls
 * (pause/resume) are de-duplicated by `preload` itself.
 */
function warmEndCollage(id: number) {
  const src = END_COLLAGES[id];
  if (src) preload(src, { as: "image", fetchPriority: "low" });
}

/** Safari (macOS/iPadOS) and every iOS browser play HLS natively, and do it
 *  better than MediaSource there (native fullscreen, AirPlay, battery). */
function prefersNativeHls(video: HTMLVideoElement): boolean {
  if (!video.canPlayType("application/vnd.apple.mpegurl")) return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/.test(ua))
  );
}

/** hls.js is only needed off Apple devices, so it's a lazy chunk — started
 *  when the gallery mounts (see the effect in the component) so it's already
 *  loaded by the time a card is clicked. */
let hlsModule: Promise<typeof import("hls.js")> | null = null;
const loadHls = () => (hlsModule ??= import("hls.js"));

function videoById(id: number): Bat246Video | undefined {
  if (id === PRODUCT_VIDEO.id) return PRODUCT_VIDEO;
  return VIDEOS.find((v) => v.id === id);
}

/**
 * Bat246 intro-video gallery — a dedicated page (not a modal). Reached
 * only from the "Short Intro Videos" tile or the "02" hidden code on
 * gotobigwin.com (Bat246Landing.tsx), both of which unlock(2) first.
 *
 * V-1 ("You've Been Chosen") is the landing page — a single "coming soon"
 * screen with a manual link into the chapters grid, since V-1 has no clip
 * yet. That grid opens with V-1 and V-2 ("Show Me The Money!"); watching
 * V-2 opens every remaining chapter (V3-V6) at once. The clips for V1/V3-V6
 * don't exist yet (each is a titled "coming soon" card), but the order and
 * progressive-unlock chain are wired now, so a real clip slots straight in
 * whenever it's produced.
 *
 * The NUMBER-1 product film (V-00) isn't part of this gallery's UI at all
 * — no grid card, no nav entry point — though its own watch state
 * (PRODUCT_KEY/productWatched) and END_COLLAGES entry are still wired up
 * in case a future entry point reintroduces it.
 */
export default function Bat246VideosClient() {
  const router = useRouter();

  // Gate the whole PAGE the same way the tile itself is gated — reaching
  // this page is a real URL, so a visitor who guesses/bookmarks it directly
  // must still have earned it. Checked once on mount, not reactively.
  const [checkedAccess, setCheckedAccess] = useState(false);
  useEffect(() => {
    if (!readUnlocks().has(2)) {
      router.replace("/");
      return;
    }
    setCheckedAccess(true);
  }, [router]);

  // Start fetching hls.js now, while the visitor is still reading the
  // gallery, so a card click doesn't wait on it (see loadHls).
  useEffect(() => {
    const probe = document.createElement("video");
    if (!prefersNativeHls(probe)) void loadHls();
  }, []);

  // Whether the product film has been watched to completion — no longer a
  // gate on the rest of the funnel, but it still decides whether V-1 has
  // joined the grid yet (see isVideoUnlocked) and lets its own card/caption
  // tell "already watched" from "not yet."
  const [productWatched, setProductWatched] = useState(false);
  useEffect(() => {
    setProductWatched(readProductWatched());
    // Every fresh visit to this page starts on V-01 ("You've Been
    // Chosen"), even for a visitor who's already watched further ahead —
    // `view`'s own useState("video1") default already covers this, so
    // there is deliberately no resume-to-chapters logic here. Previously
    // this jumped straight to the chapters grid whenever V-2 had already
    // been watched; the founder wants every entry from the gotobigwin
    // landing page's "Short Intro Videos" tile to always open on V-01.
    // Chapter unlock/watched state (below) is untouched by this — a
    // returning visitor still sees everything they'd already unlocked
    // once they reach the grid, just not skipped straight to it.
  }, []);

  // Which screen is showing: the single "You've Been Chosen" film (V-01,
  // the landing page) or the chapters grid. V-00 (the product film) is no
  // longer a separate page — it opens directly in the fullscreen player
  // from wherever it's offered (a grid card, or the footer logo), the same
  // way every other chapter does, so it never needs its own `view` state
  // or a "which page do I return to" concept.
  // Three screens, not two: the chapters grid shows only V1+V2 at first,
  // then all 6 once V2 is finished — "chapters2" and "chapters6" are each
  // their own step so Back can walk chapters6 -> chapters2 -> video1
  // one at a time, instead of chapters6 -> video1 skipping a screen.
  const [view, setView] = useState<"video1" | "chapters2" | "chapters6">("video1");

  // Make the browser/hardware Back button step through
  // video1 -> chapters2 -> chapters6 one screen at a time instead of
  // leaving the page outright. Without this, all three screens are just
  // local state on the ONE history entry this page got when
  // Bat246Landing's tile navigated here (router.push("/bat246-videos")) —
  // so Back always popped that single entry straight to gotobigwin's
  // landing page, no matter which screen was showing.
  //
  // Tag this page's own entry "video1" (replaceState — doesn't add a new
  // entry), then push one more entry every time `view` advances to
  // "chapters2" or "chapters6". A popstate listener mirrors `view` to
  // whatever the popped entry says, so each Back pops exactly one screen,
  // and only once there's no bat246View entry left to pop into does Back
  // actually leave via Next's own routing to gotobigwin's landing page.
  useEffect(() => {
    window.history.replaceState({ bat246View: "video1" }, "");
  }, []);
  useEffect(() => {
    if (view === "chapters2" || view === "chapters6") {
      window.history.pushState({ bat246View: view }, "");
    }
  }, [view]);
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const v = e.state?.bat246View;
      if (v === "video1" || v === "chapters2" || v === "chapters6") setView(v);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Which chapters have been watched. This IS the gate for isVideoUnlocked.
  // Only set from onEnded, so "unlocked" always means "actually finished."
  const [watched, setWatched] = useState<Set<number>>(new Set());
  useEffect(() => {
    setWatched(readWatched());
  }, []);

  // Once all 6 chapters are watched, persist VIDEOS_KEY so Bat246Landing's
  // own mount-effect (readNumber(VIDEOS_KEY) >= REQUIRED_VIDEOS -> unlock(3))
  // opens the B2 Back Office tile on the next visit. The localStorage
  // handoff is the only channel — this funnel has no server account to
  // coordinate through. (Only ever fires once real chapter clips exist and
  // have all been watched.)
  useEffect(() => {
    if (watched.size < REQUIRED_VIDEOS) return;
    try {
      window.localStorage.setItem(VIDEOS_KEY, String(watched.size));
    } catch {
      // Private browsing — the unlock just won't survive a reload.
    }
  }, [watched]);

  const markProductWatched = useCallback(() => {
    setProductWatched(true);
    // No view change needed — V-00 opens directly in the fullscreen player
    // over whatever page was already showing (see onEnded below), so
    // closing it just reveals that same page again, now with V-1 in play.
    try {
      window.localStorage.setItem(PRODUCT_KEY, "1");
    } catch {
      // Private browsing — the gate just won't persist across reloads.
    }
  }, []);

  const markWatched = useCallback((id: number) => {
    setWatched((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      try {
        window.localStorage.setItem(WATCHED_KEY, JSON.stringify([...next]));
      } catch {
        // Private browsing — the gate just won't persist across reloads.
      }
      return next;
    });
  }, []);

  // Which video is open in the fullscreen player. null = gallery. Can be
  // 0 (the product film) or a chapter id (once that chapter has a clip).
  const [active, setActive] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  // True only for the one render where "Watch Next" just switched videos —
  // the one case autoplay is wanted (an explicit "continue" click). Every
  // other way of opening a video leaves this false so it loads paused.
  const [autoplayNext, setAutoplayNext] = useState(false);
  // Whichever video is active and has an END_COLLAGES entry finishing shows
  // a full-bleed image in place of the video, with one big close button,
  // instead of the normal auto-advance/"Watch Next" flow. Set only from
  // onEnded below; cleared by the same per-video reset effect that clears
  // `ended`/`autoplayNext`.
  const [showEndCollage, setShowEndCollage] = useState(false);
  // True while the "THE END" bridge clip plays between a video ending and
  // its collage appearing, requested so the cut to the collage doesn't feel
  // instant. Set from onEnded, same as showEndCollage; cleared either by
  // that clip's own onEnded/onError (see the player below) or by the
  // per-video reset effect if the visitor closes/switches videos before it
  // finishes.
  const [collagePending, setCollagePending] = useState(false);
  // True for PRE_END_IMAGE_MS right as a video with a PRE_END_IMAGES entry
  // ends — shows that title card before the bridge clip takes over. A plain
  // image has no "ended" event of its own, so this (unlike collagePending)
  // needs a real timer; the id lives in a ref so the per-video reset effect
  // can cancel a still-pending one if the visitor switches videos mid-beat.
  const [preEndImage, setPreEndImage] = useState(false);
  const preEndImageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // Drives the big centered play button drawn over the <video> — visitors
  // kept missing the native controls' small bottom-left play button
  // entirely. True while actually playing, so the overlay hides itself and
  // never blocks the native controls/seek bar once playback has started.
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const endVideoRef = useRef<HTMLVideoElement>(null);

  // Fullscreen is requested on this wrapper (video + our own controls), not
  // the bare <video> — fullscreening the element alone would hide our
  // back/exit buttons since they aren't descendants of the video itself.
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // The footer's "Video # — Memo" label opens a small info popup — purely
  // informational, no gating logic attached.
  const [memoOpen, setMemoOpen] = useState(false);
  useEffect(() => {
    if (!memoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMemoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [memoOpen]);

  const exitToGallery = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setActive(null);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const nowFullscreen =
        document.fullscreenElement === playerWrapperRef.current;
      setIsFullscreen(nowFullscreen);
      // Exiting fullscreen normally means "back to the gallery." But some
      // Chromium browsers auto-drop native fullscreen the instant a
      // <video> inside the fullscreened tree reaches 'ended' — even though
      // it's the wrapping div we fullscreened, not the video itself. That
      // fires right as onEnded is swapping in the end-collage, and without
      // this guard it would win the race and force-close the WHOLE player,
      // dumping the visitor back onto the gallery instead of showing the
      // collage. So: only auto-close on a real fullscreen exit while the
      // collage isn't showing. collagePending (the bridge clip right
      // before the collage) and preEndImage (the title card right before
      // that) need the same guard — that's exactly the window this race
      // tends to land in.
      if (
        !nowFullscreen &&
        active !== null &&
        !showEndCollage &&
        !collagePending &&
        !preEndImage
      )
        setActive(null);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [active, showEndCollage, collagePending, preEndImage]);

  // Explicit Escape handler too, for the case native fullscreen never
  // engaged (iOS Safari only fullscreens <video> itself) — the video-view
  // fills the viewport via CSS regardless, so keyboard users need a way out.
  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitToGallery();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exitToGallery]);

  // Reset per-video UI whenever a different video becomes active — including
  // collagePending/preEndImage, so switching videos mid-beat doesn't leave a
  // stale one attached to whatever video is active by then. preEndImage's
  // timer (unlike collagePending's media events) is a real setTimeout, so it
  // needs explicit cancellation here too.
  useEffect(() => {
    setEnded(false);
    setAutoplayNext(false);
    setShowEndCollage(false);
    setCollagePending(false);
    setPreEndImage(false);
    setIsVideoPlaying(false);
    if (preEndImageTimeoutRef.current) {
      clearTimeout(preEndImageTimeoutRef.current);
      preEndImageTimeoutRef.current = null;
    }
  }, [active]);

  // Autoplay the "THE END" bridge clip the moment it mounts. A plain
  // `autoPlay` attribute is enough in most browsers, but falls back here
  // if the browser's autoplay policy blocks it — otherwise the visitor
  // would be stuck looking at its first frame forever with no controls.
  useEffect(() => {
    if (!collagePending) return;
    const video = endVideoRef.current;
    if (!video) return;
    video.play().catch(() => {
      setCollagePending(false);
      setShowEndCollage(true);
    });
  }, [collagePending]);

  // Request fullscreen the moment a video opens — the click that set
  // `active` is the user gesture this needs. Wrapped defensively: some
  // webviews don't support Fullscreen API on arbitrary elements, and this
  // must never break playback — the CSS video-view fills the viewport
  // regardless, so it reads as "fullscreen" either way.
  useEffect(() => {
    if (active === null) return;
    const el = playerWrapperRef.current;
    if (!el || document.fullscreenElement === el) return;
    const anyEl = el as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const req = anyEl.requestFullscreen?.() ?? anyEl.webkitRequestFullscreen?.();
    if (req && typeof (req as Promise<void>).catch === "function") {
      (req as Promise<void>).catch(() => {
        // Rejected — no native fullscreen this time. Not an error state.
      });
    }
  }, [active]);

  // Attach the active clip's HLS stream to the <video>. The <video> has no
  // `src` prop because every clip is an adaptive .m3u8 (see HLS_BASE in
  // bat246VideoGate.ts): Apple devices play that natively, everything else
  // needs hls.js feeding it through MediaSource. Keyed on the <video> being
  // mounted, not just `active` — the end collage and its 1s black screen
  // unmount it, and Replay mounts a fresh one that needs attaching again.
  const activeSrc = active !== null ? videoById(active)?.src ?? null : null;
  const videoMounted =
    activeSrc !== null && !showEndCollage && !collagePending && !preEndImage;
  useEffect(() => {
    const video = videoRef.current;
    if (!videoMounted || !activeSrc || !video) return;
    if (prefersNativeHls(video)) {
      video.src = activeSrc;
      return;
    }
    let cancelled = false;
    let hls: import("hls.js").default | null = null;
    loadHls().then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        // No MediaSource at all — last resort is the browser's own HLS.
        video.src = activeSrc;
        return;
      }
      // Start low and climb, for the fastest first frame. hls.js's default
      // is the first rendition in master.m3u8, which is the top quality.
      // startLevel -1 alone isn't enough: its bandwidth test downloads the
      // first segment at the lowest level only to measure, then fetches that
      // SAME segment again at a higher level before playing — two downloads
      // before frame one (4s on a 3 Mbps line). testBandwidth: false plays
      // the segment picked from the starting estimate instead — and that
      // estimate has to be set explicitly: left unset, hls.js raises it to
      // the first rendition's bitrate, i.e. picks the top quality again.
      // 1 Mbps opens on 360p/480p; after that ABR climbs per segment.
      const instance = new Hls({
        startLevel: -1,
        testBandwidth: false,
        abrEwmaDefaultEstimate: 1_000_000,
        capLevelToPlayerSize: true,
      });
      hls = instance;
      // hls.js already retries individual segment/playlist failures; these
      // are the documented recoveries for when it gives up (e.g. a phone
      // dropping signal mid-clip) so the video resumes instead of freezing.
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) instance.recoverMediaError();
        else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) instance.startLoad();
      });
      instance.loadSource(activeSrc);
      instance.attachMedia(video);
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [activeSrc, videoMounted]);

  // The big single-video landing layout — used only for V-01 ("You've Been
  // Chosen") now that V-00 opens directly in the fullscreen player instead
  // of a dedicated page. Kept as its own function (rather than inlined)
  // so the "when a real clip is dropped in, it slots straight in with no
  // other change" promise still holds: once VIDEOS[0].src is set, this
  // same code makes V-01 playable, no JSX change.
  function renderBigVideoScreen(video: Bat246Video, numberLabel: string) {
    const playable = !!video.src;
    const isWatched = watched.has(video.id);
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <p
          className={[
            "mb-2 flex flex-wrap items-baseline justify-center gap-x-2 text-center transition",
            isWatched ? "opacity-70" : "",
          ].join(" ")}
        >
          <span
            className={[
              "font-black tracking-[0.2em] text-white/70 transition-all",
              isWatched
                ? "text-[22.57px] sm:text-[28.22px]"
                : "text-[23.76px] sm:text-[29.7px]",
            ].join(" ")}
          >
            {numberLabel}
          </span>
          <span
            className={[
              "font-semibold text-white/80 transition-all",
              isWatched
                ? "text-[22.57px] sm:text-[28.22px]"
                : "text-[23.76px] sm:text-[29.7px]",
            ].join(" ")}
          >
            &ldquo;{video.label}&rdquo;
          </span>
        </p>

        <button
          type="button"
          disabled={!playable}
          onClick={() => playable && setActive(video.id)}
          aria-label={playable ? video.label : `${video.label} — coming soon`}
          className={[
            // Split by breakpoint instead of one rule for every screen —
            // that kept fixing one viewport shape by breaking another.
            // Below sm: (phones): width-first — w-full (capped by the
            // column) with aspect-video deriving height purely from that
            // width. No flex-grow competing for space here, so it can't
            // be squeezed into a mismatched box the way flex-1 did on a
            // tall/narrow screen.
            // From sm: up (laptop/desktop): back to the ORIGINAL
            // height-first sizing this always used before today — flex-1
            // grows the box to the column's available height, self-center
            // derives width from that via aspect-video. This is what the
            // banner looked like before any of today's mobile-responsive
            // changes; restored as-is for sm:+ since laptop was never
            // actually broken.
            "group relative mt-4 block w-full aspect-video max-w-full self-center overflow-hidden rounded-3xl border text-left shadow-[0_18px_50px_-18px_rgba(0,0,0,0.8)] transition sm:w-auto sm:min-h-0 sm:flex-1",
            playable
              ? "cursor-pointer border-white/15"
              : "cursor-not-allowed border-white/10 opacity-80",
            isWatched ? "opacity-90 grayscale-[0.1]" : "",
          ].join(" ")}
        >
          <div className="absolute inset-0 bg-white" />
          {video.image ? (
            <>
              <div
                className="absolute inset-0 bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${video.image})` }}
              />
              {/* Dark wash so the play button/label overlays stay legible on any photo. */}
              <div className="absolute inset-0 bg-black/35" />
            </>
          ) : (
            <div
              className="absolute inset-0 opacity-[0.25]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: "26px 26px",
              }}
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3">
            {playable ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3DA35D] text-white shadow-lg ring-[3px] ring-white/80 transition group-hover:scale-105 group-hover:bg-[#329150] sm:h-20 sm:w-20 sm:ring-[4.4px] md:h-24 md:w-24">
                  <Play className="h-5 w-5 fill-current sm:h-8 sm:w-8 md:h-10 md:w-10" />
                </div>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 sm:h-20 sm:w-20 md:h-24 md:w-24">
                  <Clock className="h-5 w-5 text-[#F5C451] sm:h-8 sm:w-8 md:h-10 md:w-10" />
                </div>
                <span className="text-sm font-black uppercase tracking-[0.2em] text-[#F5C451] sm:text-base md:text-lg">
                  Coming soon
                </span>
              </>
            )}
          </div>
        </button>

        {/* No clip yet (video1's real case today) — there's nothing to
            auto-advance on, so give a manual way forward instead of a
            dead end. Once a real clip is set, `playable` flips true and
            this disappears — onEnded above takes over automatically. */}
        {!playable && (
          <button
            type="button"
            onClick={() => setView("chapters2")}
            className="mx-auto mt-4 text-sm font-semibold text-white/60 underline underline-offset-4 transition hover:text-white"
          >
            Continue to your chapters &rarr;
          </button>
        )}
      </div>
    );
  }

  if (!checkedAccess) return null;

  // Whether either of the two chapters-grid screens (2-visible or
  // 6-visible) is showing, as opposed to the video1 landing page.
  const inChapters = view === "chapters2" || view === "chapters6";

  // The footer gains the B2 logo button (V-00's only entry point, now that
  // it's never one of the grid cards) on both chapters screens (2-visible
  // and 6-visible) — Memo shifts left on either to make room for it. Only
  // the video1 landing page keeps Memo centered with no logo.
  const showFooterLogo = inChapters;

  // Footer/memo copy, keyed by which screen is showing — computed once
  // here instead of repeating the same ternary at every call site. Both
  // chapters screens share the same copy; only video1 differs.
  const memoLabel = inChapters ? "Video # — Memo" : "Video #01 — Memo";
  const memoTitle = inChapters ? "Your Intro Chapters" : VIDEOS[0].label;
  const memoTagline = inChapters ? "Six short chapters, one per week." : VIDEOS[0].tagline;
  const memoBody = inChapters
    ? "Watch each chapter in order to unlock the next — finish all six and your Back Office opens up."
    : "Watch it once, start to finish — then straight into your intro chapters.";

  const activeVideo = active !== null ? videoById(active) : undefined;

  // After the product film ends the "next" is chapter 1 — which is
  // coming-soon, so there's nothing to autoplay into. A "Watch Next"
  // button only appears when the next item in sequence actually has a clip.
  const nextAfterActive =
    active === PRODUCT_VIDEO.id
      ? VIDEOS[0]
      : active !== null
        ? VIDEOS[VIDEOS.findIndex((v) => v.id === active) + 1]
        : undefined;
  const nextVideo =
    active !== null && ended && nextAfterActive && !isComingSoon(nextAfterActive)
      ? nextAfterActive
      : undefined;

  return (
    <div className="flex h-[100dvh] flex-col text-white" style={{ background: NAVY }}>
      {/* ── Header band ───────────────────────────────────────────── */}
      <header className="relative shrink-0 bg-sky-200 px-3 py-3 sm:px-6 sm:py-4">
        {/* 3-column grid (was absolute-positioned side buttons + a
            justify-center title) — on narrow viewports the old layout let
            "SHORT INTRO VIDEOS" overlap the Join/Back buttons since the
            title centered on the viewport regardless of how wide the side
            clusters were. Fixed auto/auto side columns + a 1fr middle
            column means the title always centers BETWEEN whatever the
            side buttons actually take up, with `min-w-0`+`truncate` as a
            last-resort safety net on the very narrowest phones.
            Join now lives IN the grid's 3rd column instead of being
            absolutely positioned over everything — absolute positioning
            took it out of the grid's own width accounting entirely, so
            the middle column had no idea it needed to leave room for it
            and truncated too late, letting Join sit on top of the title's
            last letters on a narrow phone. */}
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2">
          <div className="flex items-center gap-2 justify-self-start">
            <button
              type="button"
              onClick={() => {
                // Goes through the same real browser history the hardware
                // Back button now uses (see the popstate effect above) —
                // chapters6 -> chapters2 -> video1 -> leave the page — so
                // this button and physical Back can never disagree about
                // what's "back".
                if (view !== "video1") window.history.back();
                else router.push("/");
              }}
              aria-label="Back"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#101A35]/70 transition hover:bg-black/5 hover:text-[#101A35] sm:h-12 sm:w-12"
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          <h1
            title={inChapters ? "Short Intro Videos" : VIDEOS[0].label}
            className="min-w-0 truncate px-1 text-center text-lg font-black uppercase tracking-wide text-[#101A35] sm:text-2xl md:text-3xl"
          >
            {inChapters ? "Short Intro Videos" : VIDEOS[0].label}
          </h1>

          <div className="justify-self-end">
            {inChapters && (
              <a
                href={JOIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 shrink-0 items-center rounded-md bg-green-600 px-3 text-sm font-black text-white transition hover:bg-green-500 sm:h-12 sm:px-5 sm:text-xl md:text-[25px]"
              >
                Join
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
        <div
          className={[
            "mx-auto flex w-full min-h-0 flex-1 flex-col",
            // Both pages get the same wide cap. video1's box is sized
            // height-first (flex-1) then derives width from the 16:9 ratio —
            // capping the column at 6xl (1152px) capped the derived height
            // well short of the available vertical space between header and
            // footer, leaving a visible blank gap above/below the box. The
            // wider cap lets it grow with the available height instead.
            "max-w-[98%]",
          ].join(" ")}
        >
          {view === "video1" ? (
            renderBigVideoScreen(VIDEOS[0], "V-01")
          ) : (
            /* ── The intro chapters — revealed progressively as earlier
                 ones are watched, centered in whatever room the
                 header/footer leave ──── */
            (() => {
              // Not-yet-reached chapters aren't rendered at all (see
              // isVideoUnlocked), so the grid's shape has to follow however
              // many actually made the cut — 3 columns is the max (matching
              // the original fixed 3x2 layout for all 6), but with fewer
              // videos it drops to that many columns instead of leaving the
              // rest of a 3-wide row blank. V-00 is never one of these
              // cards — it's reached only via the footer logo button, not
              // the grid.
              //
              // Always 1 column on mobile (cards stacked, full width each)
              // regardless of `visible.length` — 2-3 cards side by side on
              // a narrow phone screen squeezed each one too thin. Widens to
              // the real column count at sm:/md:. Picked from a small
              // static set of complete Tailwind class strings (not built
              // via template-literal interpolation) so the Tailwind
              // compiler can actually see and generate them.
              //
              // h-full + auto-rows-fr (fit exactly inside the available
              // height, no scroll) only from sm: up — on a phone, forcing
              // 6 cards stacked 1-per-row into one fixed viewport height
              // squeezed each card down to a sliver (and, combined with
              // each card's own aspect-video, fighting over the remaining
              // space left gaps around the thumbnail again). Below sm:,
              // cards size naturally (full column width, height purely
              // from aspect-video) and the column scrolls if they don't
              // fit — the `flex-1` + `min-h-0` + `overflow-y-auto` pattern
              // already used for the outer page shell. From sm: up there's
              // always been enough height for 1-2 rows to fit without it,
              // so the old fit-exactly behavior stays there — letting the
              // scroll behavior apply unconditionally is what showed a
              // needless scrollbar on laptop screens.
              //
              // Which cards show is keyed off `view`, not purely
              // isVideoUnlocked/watched — on "chapters2" only V1+V2 show
              // even if `watched` already has more (e.g. after stepping
              // Back from chapters6), so Back genuinely reveals fewer
              // cards instead of always showing everything already
              // unlocked. "chapters6" shows the real computed unlock set.
              const visible =
                view === "chapters6"
                  ? VIDEOS.filter((v) => isVideoUnlocked(v.id, watched))
                  : VIDEOS.filter((v) => v.id <= 2);
              const cols = Math.min(visible.length, 3) || 1;
              const colsClass =
                cols <= 1
                  ? "grid-cols-1"
                  : cols === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
              // From sm: up, each card's cell has a DEFINITE height
              // (sm:h-full + sm:auto-rows-fr on the grid below) — whether
              // width or height should drive the card's 16:9 sizing
              // depends on the cell's own shape, which flips with row
              // count: a single row (e.g. the 2-card V1+V2 screen) leaves
              // far more cell height than a 16:9 box at that column width
              // needs, so WIDTH must drive it — sizing by height there
              // (flex-1) grew the card past what max-w-full then allowed,
              // and the two constraints didn't reconcile, leaving a
              // too-tall box (gaps with bg-contain, real content cropped
              // with bg-cover). Two-plus rows (the 6-card screen) is the
              // opposite: each row is short relative to its column width,
              // so HEIGHT must drive it — sizing by width there would
              // make cards taller than their row and overflow. Below sm:
              // (mobile) is unaffected either way, since rows there have
              // no definite height to fight over at all (natural sizing +
              // scroll) — width-first is always correct there.
              const rows = Math.max(1, Math.ceil(visible.length / cols));
              const cardSizeClass =
                rows === 1
                  ? "aspect-video w-full max-w-full self-center"
                  : "aspect-video w-full max-w-full self-center sm:w-auto sm:min-h-0 sm:flex-1";
              return (
                <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
                  <div
                    className={[
                      "grid w-full gap-3 sm:h-full sm:auto-rows-fr sm:gap-4 md:gap-6",
                      colsClass,
                    ].join(" ")}
                  >
                    {visible.map((v, i) => {
                  const comingSoon = isComingSoon(v);
                  // Visible (revealed in the grid, via `visible` above) does
                  // NOT mean playable — a real chapter still waits its turn
                  // behind whichever real chapter comes before it, so a
                  // visitor can't jump straight to a later real clip without
                  // watching the ones before it. See isVideoPlayable.
                  const playable = isVideoPlayable(v, watched);
                  const isWatched = watched.has(v.id);
                  return (
                    <div
                      key={v.id}
                      className="flex h-full min-h-0 flex-col items-center justify-center"
                    >
                      {/* Title greyed out 30% and the card 10% once
                          watched — the only "you've seen this" signal now
                          that the checkmark/"Watched" label are gone. */}
                      <p
                        title={`V-${v.id} "${v.label}"`}
                        className={[
                          "mb-1 w-full shrink-0 truncate px-1 text-center transition sm:mb-2",
                          isWatched ? "opacity-70" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "font-black tracking-[0.1em] text-white/70 transition-all",
                            isWatched
                              ? "text-[17.87px] sm:text-[21.63px] md:text-[31.98px]"
                              : "text-[18.81px] sm:text-[22.77px] md:text-[33.66px]",
                          ].join(" ")}
                        >
                          V-{v.id}
                        </span>{" "}
                        <span
                          className={[
                            "font-semibold text-white/80 transition-all",
                            isWatched
                              ? "text-[17.87px] sm:text-[21.63px] md:text-[31.98px]"
                              : "text-[18.81px] sm:text-[22.77px] md:text-[33.66px]",
                          ].join(" ")}
                        >
                          &ldquo;{v.label}&rdquo;
                        </span>
                      </p>
                      <button
                        type="button"
                        disabled={!playable}
                        onClick={() => playable && setActive(v.id)}
                        aria-label={
                          playable
                            ? `${v.label}${isWatched ? " — watched" : ""}`
                            : comingSoon
                              ? `${v.label} — coming soon`
                              : `${v.label} — locked`
                        }
                        // cardSizeClass (computed above from the actual
                        // row count) picks width-first vs height-first —
                        // see its own comment for why a single row needs
                        // the opposite sizing strategy from two-plus rows.
                        className={[
                          "group relative overflow-hidden rounded-2xl border text-left transition",
                          cardSizeClass,
                          playable
                            ? "cursor-pointer border-white/15 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.65)]"
                            : "cursor-default border-[#F5C451]/25",
                          isWatched ? "opacity-90 grayscale-[0.1]" : "",
                        ].join(" ")}
                      >
                        {v.image ? (
                          <>
                            <div
                              className="absolute inset-0 bg-contain bg-center bg-no-repeat"
                              style={{ backgroundImage: `url(${v.image})` }}
                            />
                            {/* Dark wash so the icon/label overlays stay legible on any photo. */}
                            <div className="absolute inset-0 bg-black/35" />
                          </>
                        ) : (
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${CARD_TONES[i % CARD_TONES.length]}`}
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {playable ? (
                            // Always the play icon — no separate "watched"
                            // checkmark state, on request.
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3DA35D] text-white ring-2 ring-white/80 transition group-hover:bg-[#329150] sm:h-11 sm:w-11 sm:ring-[3px] md:h-14 md:w-14">
                              <Play className="h-4 w-4 fill-current sm:h-5 sm:w-5 md:h-6 md:w-6" />
                            </div>
                          ) : comingSoon ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5C451]/15 sm:h-11 sm:w-11 md:h-14 md:w-14">
                              <Clock className="h-4 w-4 text-[#F5C451] sm:h-5 sm:w-5 md:h-6 md:w-6" />
                            </div>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 sm:h-11 sm:w-11 md:h-14 md:w-14">
                              <Lock className="h-4 w-4 text-white sm:h-5 sm:w-5 md:h-6 md:w-6" />
                            </div>
                          )}
                        </div>
                        {comingSoon && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-7">
                            <span className="text-sm font-black text-[#F5C451] sm:text-base">
                              Coming soon
                            </span>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                    })}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </main>

      {/* ── Footer band ───────────────────────────────────────────── */}
      <footer
        className={[
          "relative flex shrink-0 items-center gap-3 bg-sky-200 px-4 py-4",
          showFooterLogo ? "justify-between" : "justify-center",
        ].join(" ")}
      >
        {/* Plain bold text read as a label, not a control — pill shape,
            solid fill and a shadow give it the same "pressable" affordance
            as every other button on this page (Join, the footer logo). */}
        <button
          type="button"
          onClick={() => setMemoOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-full bg-[#101A35] px-6 py-3 text-base font-black uppercase tracking-[0.2em] text-white shadow-[0_4px_14px_-4px_rgba(16,26,53,0.6)] transition hover:scale-105 hover:bg-[#1B2C6B] active:scale-95 sm:px-7 sm:py-3.5 sm:text-lg"
        >
          <Info className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
          {memoLabel}
        </button>

        {/* Opens the optional V-00 product film directly in the fullscreen
            player, same as any grid card would. Shown on both chapters
            screens (V-00 is never a grid card itself), so this is its
            only entry point once a visitor reaches the chapters grid. */}
        {showFooterLogo && (
          <button
            type="button"
            onClick={() => setActive(PRODUCT_VIDEO.id)}
            aria-label={`Watch ${PRODUCT_VIDEO.label}`}
            // Pulled out of the flex flow via `absolute` and centered on
            // the bar's own vertical midpoint, so it can be bigger than
            // the bar itself without making the bar any taller.
            className="absolute right-4 top-1/2 flex h-20 w-20 shrink-0 -translate-y-1/2 items-center justify-center transition hover:scale-105 sm:right-6 sm:h-24 sm:w-24"
          >
            {/* Already a circular coin badge on a transparent background —
                object-contain (not -cover, and no ring/clip wrapper) so its
                own edge shows through instead of being cropped by a second
                CSS circle. */}
            <img
              src="/images/bat246-footer-b2-logo.png"
              alt=""
              className="h-full w-full object-contain"
            />
          </button>
        )}
      </footer>

      {/* ── Memo popup ────────────────────────────────────────────── */}
      {memoOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setMemoOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            // Doubled from the original small box on desktop: max-w-md ->
            // max-w-[56rem] (exactly 2x 28rem), and a real white border (was
            // an almost-invisible border-white/10) instead of just bigger.
            // Padding/text below scale back down on mobile (base) — the
            // doubled desktop sizing had no mobile variant at all and blew
            // out a phone-width dialog.
            className="w-full max-w-[56rem] rounded-2xl border-2 border-white bg-[#141E3D] p-5 shadow-2xl sm:p-8 md:p-12"
          >
            <div className="flex items-start justify-between gap-3 sm:gap-6 md:gap-8">
              <h2 className="text-xl font-black text-white sm:text-2xl md:text-4xl">
                {memoLabel}
              </h2>
              <button
                type="button"
                onClick={() => setMemoOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white sm:h-12 sm:w-12 md:h-16 md:w-16"
              >
                <X className="h-4 w-4 sm:h-6 sm:w-6 md:h-8 md:w-8" />
              </button>
            </div>
            <p className="mt-3 text-base font-bold text-[#F5C451] sm:mt-4 sm:text-xl md:mt-6 md:text-[2rem]">
              {memoTitle}
            </p>
            {memoTagline && (
              <p className="mt-1 text-sm font-semibold text-white/70 sm:mt-2 sm:text-base md:text-[1.75rem]">
                {memoTagline}
              </p>
            )}
            <p className="mt-4 text-sm leading-relaxed text-white/60 sm:mt-6 sm:text-base md:mt-8 md:text-[1.75rem]">
              {memoBody}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Fullscreen player ────────────────────────────────────────
          CSS fills the viewport regardless of whether native Fullscreen
          engages (see the requestFullscreen effect above). */}
      {active !== null && activeVideo?.src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black"
          role="dialog"
          aria-modal="true"
        >
          <div ref={playerWrapperRef} className="relative flex h-full w-full flex-col">
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2 sm:right-5 sm:top-5">
              {showEndCollage || collagePending || preEndImage ? null : (
                <>
                  {!isFullscreen && (
                    <button
                      type="button"
                      onClick={() =>
                        playerWrapperRef.current?.requestFullscreen?.().catch(() => {})
                      }
                      aria-label="View fullscreen"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                    >
                      <Maximize className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center p-0 sm:p-6">
              {preEndImage && active !== null && PRE_END_IMAGES[active] ? (
                // Title card shown for PRE_END_IMAGE_MS right as the video
                // ends, before the bridge clip — see PRE_END_IMAGES above.
                <img
                  src={PRE_END_IMAGES[active]}
                  alt={PRE_END_IMAGE_ALT[active] ?? ""}
                  className="max-h-full max-w-full object-contain sm:rounded-xl sm:shadow-2xl"
                />
              ) : collagePending ? (
                // Bridge clip between the video ending and its collage
                // appearing. onEnded/onError both hand off to the collage
                // so a playback failure can never strand the visitor here.
                <video
                  ref={endVideoRef}
                  src="/bat246-the-end.mp4"
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full"
                  onEnded={() => {
                    setCollagePending(false);
                    setShowEndCollage(true);
                  }}
                  onError={() => {
                    setCollagePending(false);
                    setShowEndCollage(true);
                  }}
                />
              ) : showEndCollage && active !== null && END_COLLAGES[active] ? (
                // Wrapping the image in an `inline-block` box its own size
                // (not the full player width/height) means the Close button
                // below, positioned relative to THIS box, tracks the image's
                // actual rendered corner instead of the dialog's — so it
                // never floats off over the letterboxing on a narrow screen.
                // `min-h-0` on the flex parent above is what lets the image
                // shrink to fit the viewport at all: without it, a flex
                // column item won't shrink below its content's natural
                // height, and the image spilled past the screen and got
                // cropped instead of scaling down.
                <div className="relative inline-block max-h-full max-w-full">
                  <img
                    src={END_COLLAGES[active]}
                    alt={END_COLLAGE_ALT[active] ?? ""}
                    className="block max-h-[calc(100dvh-2rem)] max-w-full object-contain sm:max-h-[calc(100dvh-3rem)] sm:rounded-xl sm:shadow-2xl"
                  />
                  {/* Replay — same button as the big centered play button
                      shown before a video starts. Swapping back to the
                      <video> branch (showEndCollage false) unmounts and
                      remounts a fresh <video> for this same `active` id, so
                      autoplaying it here is what makes one click actually
                      restart playback instead of just re-revealing the
                      video paused at its first frame. */}
                  <button
                    type="button"
                    onClick={() => {
                      setAutoplayNext(true);
                      setShowEndCollage(false);
                    }}
                    aria-label={`Replay ${activeVideo?.label ?? ""}`}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3DA35D] shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-[3px] ring-white/80 transition hover:scale-105 hover:bg-[#329150] sm:h-20 sm:w-20 sm:ring-[4.4px] md:h-24 md:w-24">
                      <Play className="ml-1 h-5 w-5 fill-white text-white sm:ml-1.5 sm:h-9 sm:w-9 md:h-11 md:w-11" />
                    </span>
                  </button>
                  {/* Deliberately big, square (not the round icon buttons
                      used elsewhere in this player) and labeled — the
                      founder wants this impossible to miss for older
                      visitors. Scaled down on mobile (base) so it doesn't
                      swallow most of a narrow phone's collage image; grows
                      back to the original footprint at sm:/md:. */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowEndCollage(false);
                      // V-01 is opened from the "video1" landing page, not
                      // a grid card — closing it should land the visitor on
                      // the chapters grid, showing just V1+V2 (chapters2).
                      // V-2 closing is what promotes chapters2 -> chapters6,
                      // revealing the rest — each is its own Back stop (see
                      // the history effects above).
                      if (active === 1) setView("chapters2");
                      else if (active === 2) setView("chapters6");
                      exitToGallery();
                    }}
                    aria-label="Close and return to your chapters"
                    // Same footprint as the green play/replay button on
                    // this page, scaled up ~15% at every tier.
                    className="absolute right-1 top-1 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 px-1 text-center text-[10px] font-black uppercase text-white shadow-[0_8px_24px_rgba(220,38,38,0.6)] ring-2 ring-white/80 transition hover:scale-105 hover:bg-red-700 sm:right-2 sm:top-2 sm:h-[92px] sm:w-[92px] sm:text-lg sm:ring-4 md:right-4 md:top-4 md:h-[110px] md:w-[110px] md:text-2xl"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="relative max-h-full max-w-full sm:w-full">
                  <video
                    key={active}
                    ref={videoRef}
                    // No `src` — the stream is attached by the HLS effect
                    // above (native on Apple devices, hls.js elsewhere).
                    // Same thumbnail already shown on the card that was just
                    // clicked, so it's already in the browser's cache —
                    // without a poster the video area is just empty black
                    // (bg-black below) until the stream buffers its first
                    // frame, which read as "the screen takes time to load."
                    poster={activeVideo.image}
                    controls
                    autoPlay={autoplayNext}
                    playsInline
                    // Any video with an END_COLLAGES entry (V-00, V-01, V-2,
                    // V-3, V-6) shows its collage above instead of
                    // auto-closing — the visitor closes it themselves via
                    // the big red button, which is what actually advances on
                    // (V-00 -> V-01; V-01/V-2 -> back to the chapter grid,
                    // now with V-3 onward unlocked once V-2 is the one that
                    // closed). Every other chapter (opened from the grid)
                    // keeps the original behavior: stays open, flips
                    // `ended`, and reveals the payoff/"Watch Next" below for
                    // the visitor to act on.
                    onEnded={() => {
                      if (active === null) return;
                      if (active === PRODUCT_VIDEO.id) {
                        markProductWatched();
                      } else {
                        markWatched(active);
                      }
                      if (END_COLLAGES[active]) {
                        if (PRE_END_IMAGES[active]) {
                          // Title card first, then the bridge clip, then
                          // the collage — see PRE_END_IMAGES above.
                          setPreEndImage(true);
                          preEndImageTimeoutRef.current = setTimeout(() => {
                            setPreEndImage(false);
                            setCollagePending(true);
                          }, PRE_END_IMAGE_MS);
                        } else {
                          // "THE END" bridge clip first, then the collage —
                          // see collagePending above.
                          setCollagePending(true);
                        }
                      } else {
                        setEnded(true);
                      }
                    }}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPlaying={() => active !== null && warmEndCollage(active)}
                    onPause={() => setIsVideoPlaying(false)}
                    className="max-h-full max-w-full bg-black sm:aspect-video sm:w-full sm:rounded-xl sm:shadow-2xl"
                  />
                  {/* Big centered play button — the native controls' own
                      play button (small, bottom-left) kept going unnoticed.
                      Disappears the moment playback actually starts, so it
                      never sits on top of the native controls/seek bar. */}
                  {!isVideoPlaying && (
                    <button
                      type="button"
                      onClick={() => videoRef.current?.play()}
                      aria-label={`Play ${activeVideo.label}`}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3DA35D] shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-[3px] ring-white/80 transition hover:scale-105 hover:bg-[#329150] sm:h-20 sm:w-20 sm:ring-[4.4px] md:h-24 md:w-24">
                        <Play
                          className="ml-1 h-5 w-5 fill-white text-white sm:ml-1.5 sm:h-9 sm:w-9 md:h-11 md:w-11"
                        />
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {!showEndCollage && !collagePending && !preEndImage && (
              <div className="shrink-0 px-4 pb-6 pt-2 sm:px-6">
                {nextVideo ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Explicit "continue" gesture — the one place autoplay
                      // is OK.
                      setAutoplayNext(true);
                      setActive(nextVideo.id);
                    }}
                    className="mx-auto flex items-center gap-1.5 rounded-full bg-[#F5C451] px-5 py-2 text-sm font-black text-[#1B2C6B] transition hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,white)]"
                  >
                    Watch Next: {nextVideo.label}
                    <span aria-hidden>&rarr;</span>
                  </button>
                ) : (
                  <p className="text-center text-xs font-semibold text-white/50">
                    {active !== null
                      ? playerCaption(active, watched, productWatched)
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
