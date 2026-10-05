"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Radio, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { readBat246GuestSession } from "@/lib/webinar/bat246GuestSession";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  WATCH_KEY,
  VIDEOS_KEY,
  WATCHED_KEY,
  REQUIRED_WEBINAR_SECONDS,
  REQUIRED_VIDEOS,
  type TileId,
  readUnlocks,
  persistUnlocks,
  readNumber,
} from "@/lib/webinar/bat246VideoGate";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * gotobigwin.com landing — Bat246's white-label funnel.
 *
 * Laid out as the founder's "burger": a JOIN NOW bun top and bottom, with
 * coloured fillings stacked between them. Locked fillings stay dimmed but
 * READABLE on purpose, so a visitor can see what they're working toward.
 *
 * Progression:
 *   1. Live Webinar  — always open, it's why people land here
 *   2. Short Intro Videos — opens after 15 minutes of webinar attendance,
 *      once the visitor comes back
 *   3. B2 Back Office — opens after all 6 short videos are watched
 *   4. cheese — a display slice, not a control: no label, no click
 *
 * The buns are never gated. An earlier revision made Join Now wait on two
 * intro videos; the founder removed that, so the videos are now something
 * you're rewarded with rather than something you must sit through.
 *
 * Unlocks persist in localStorage. This page is public with no login, so
 * there is no account to hang the state on — and a funnel visitor who
 * clears storage simply sees the funnel again, which is harmless.
 */

const NAVY = "#101A35";

/** Alan Kippax's letter. Held as data so the copy stays readable and the
 *  apostrophes and quotes need no JSX escaping. */
const STORY_INTRO = [
  "For more than 30 years, I have pursued one goal: to create a business system that can help the average person earn an above-average income.",
  "Looking back now, I would describe my best previous attempt as Grade 4.",
  "But I never stopped learning. I never stopped improving.",
  "Three decades of experience, mistakes, breakthroughs, and new technology have brought us to this moment.",
  "32 years. One vision. Everything learned along the way.",
  "Now it\u2019s ready! Welcome to B2.",
];

const STORY_MORE = [
  "I was only 10 years old when I first began thinking about a simple question:",
  "How can someone make the greatest amount of money in the least amount of time?",
  "By the time I was 28, that question had become a clear vision. I began pursuing a dream: to build a business that could give average, everyday people a real opportunity to earn incomes normally associated with top professionals \u2014 doctors, lawyers, dentists, and others.",
  "There were successes. There were failures. There were hard lessons, new technologies, and relentless improvement.",
  "But through all of it, I never gave up.",
  "This is not simply another version of what I built before.",
  "Today, with everything those years have taught me, I believe we have finally reached Grade 13.",
  "Over the years, we have watched many developments that people said would \u201clevel the playing field\u201d \u2014 networking, computers, the Internet, smartphones, and now, perhaps most dramatically, AI.",
  "Each changed what an ordinary person could accomplish.",
  "But with B2, we are addressing another major barrier that has prevented many people from participating in opportunities like this:",
  "B2 is leveling the playing field in a way we have never been able to do before. The financial cost of getting started.",
  "It is the result of everything those 32 years have taught me \u2014 and everything I now believe is possible.",
];

const STORY_CLOSE = [
  "B2 is, by far, the clearest expression yet of the vision I began pursuing all those years ago.",
  "Welcome to B2.",
];


/** localStorage flag for "this visitor entered the host code (05)". */
const HOST_CODE_KEY = "bat246_host_code";

/**
 * Where Welcome.tsx stores the `?ref=` / `?referCode=` a visitor arrived with.
 * Per-origin, so on gotobigwin.com it only ever holds a code from a
 * gotobigwin.com link.
 */
const STORED_REFERRAL_KEY = "referral_code";

export default function Bat246Landing({
  webinar,
  referralCode,
}: {
  webinar: { id: string; title: string; live: boolean } | null;
  /** The affiliate code on the landing URL, if any (from Welcome.tsx). */
  referralCode?: string | null;
}) {
  const router = useRouter();

  /**
   * The webinar URL for an ATTENDEE, carrying whoever referred this visitor.
   *
   * The JOIN NOW buttons used to push to `/webinar/<id>` bare, dropping the
   * `?ref=` the visitor arrived with. With no code, the backend credits the
   * webinar office's founder (routes/publicWebinar.ts), so anyone who opened
   * a friend's gotobigwin.com link and clicked JOIN NOW was attributed to the
   * founder instead of the friend who shared it.
   *
   * The URL code wins; the stored one covers a visitor who arrived on a ref
   * link, wandered (e.g. to the intro videos) and came back to a bare URL.
   * The room reads `ref` specifically (WebinarRoomClient), so that's the name
   * used. The backend still refuses to move anyone who already has a
   * referrer, so carrying a code can't re-parent an existing member.
   */
  const attendeeWebinarHref = useCallback(
    (id: string) => {
      let ref = (referralCode || "").trim();
      if (!ref) {
        try {
          ref = (localStorage.getItem(STORED_REFERRAL_KEY) || "").trim();
        } catch {
          /* storage blocked — no fallback, the founder default applies */
        }
      }
      return ref ? `/webinar/${id}?ref=${encodeURIComponent(ref)}` : `/webinar/${id}`;
    },
    [referralCode]
  );

  // Whoever's link this visitor arrived on, read straight off the URL — feeds
  // the JOIN NOW / office-invite buttons further down (joinNow), which is a
  // separate destination from the "Live Webinar" tile above and needs its own
  // ref rather than attendeeWebinarHref's. `ref` is what affiliate share
  // links carry (matches the `ref`/`referCode` pair Welcome.tsx reads for the
  // normal login flow); falls back to Alan K's id in joinNow when absent so a
  // bare gotobigwin.com visit still attributes correctly.
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref") || searchParams.get("referCode");
  const [unlocked, setUnlocked] = useState<Set<TileId>>(new Set());
  const [storyOpen, setStoryOpen] = useState(false);
  const [code, setCode] = useState("");
  const isMobile = useIsMobile();

  // Whether THIS visitor already verified email/OTP for `webinar` this
  // visit (see bat246GuestSession.ts / WebinarPreJoin.tsx's BAT246_ORG_ID
  // branch). Drives the "Live Webinar" tile's waiting/live copy below —
  // an unregistered visitor never sees "Waiting for the host", only a
  // registered one does.
  const [hasWebinarSession, setHasWebinarSession] = useState(false);
  const [webinarLiveNow, setWebinarLiveNow] = useState(false);
  // Set when the host code (05) is entered. Persisted because the room can
  // bounce a would-be host back here (e.g. no session exists yet), and losing
  // the flag on that round trip is what left them stuck on the attendee gate.
  const [hostUnlocked, setHostUnlocked] = useState(false);
  useEffect(() => {
    try {
      setHostUnlocked(localStorage.getItem(HOST_CODE_KEY) === "1");
    } catch {
      /* private mode / blocked storage — just stay locked */
    }
  }, []);

  useEffect(() => {
    if (!webinar) {
      setHasWebinarSession(false);
      setWebinarLiveNow(false);
      return;
    }
    setHasWebinarSession(!!readBat246GuestSession(webinar.id));
    setWebinarLiveNow(webinar.live);
  }, [webinar]);

  // Once registered, poll so the tile flips to "It's live, join now!" the
  // moment the host starts — without the visitor having to refresh.
  // Deliberately not polled for an unregistered visitor: there's nothing
  // for them to resume, so it's not worth the extra requests.
  useEffect(() => {
    if (!webinar || !hasWebinarSession) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `${API_URL}/public/webinar/validate?id=${webinar.id}`
        );
        const data = await res.json();
        if (!cancelled && data?.success && data.webinar) {
          setWebinarLiveNow(!!data.webinar.isLive);
        }
      } catch {
        // Transient network hiccup — the next tick tries again. Leaves the
        // last-known status on screen rather than flashing an error state.
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [webinar, hasWebinarSession]);

  // Auto-enter the moment the poll above catches the host going live — the
  // tile's own copy already promises this ("we'll drop you straight in —
  // no need to refresh"), so the page has to act on it instead of just
  // relabeling the tile and leaving the click to the visitor.
  //
  // Edge-triggered (false → true) via prevLiveRef, NOT "is live" — so a
  // registered visitor who lands here (or deliberately backs out of an
  // already-live room to this page) while it's already live is left on
  // the tile to click in themselves, not immediately shoved back in.
  // Seeded from `webinar?.live` so the mount effect above hydrating
  // webinarLiveNow from false to an already-true prop doesn't itself read
  // as a flip.
  const prevLiveRef = useRef(webinar?.live ?? false);
  useEffect(() => {
    const wasLive = prevLiveRef.current;
    prevLiveRef.current = webinarLiveNow;
    if (!wasLive && webinarLiveNow && hasWebinarSession && webinar) {
      toast.success("Webinar is now live! Joining...");
      router.push(attendeeWebinarHref(webinar.id));
    }
  }, [webinarLiveNow, hasWebinarSession, webinar, router, attendeeWebinarHref]);

  // Shared by the "Live Webinar" tile and both JOIN NOW buns — registered
  // + not-live yet is a no-op (nothing new to show, the tile already says
  // so) rather than sending them back through a popup they already cleared.
  const goToWebinar = useCallback(() => {
    if (!webinar) {
      window.location.href = "https://my.garage.app";
      return;
    }
    // Host code entered: go in AS HOST. The host is the person who starts
    // the session, so they must never be held behind the "waiting for the
    // host" gate below — that gate exists for attendees. This is why
    // entering 05 and then clicking the tile used to dead-end on a toast.
    if (hostUnlocked) {
      router.push(`/webinar/${webinar.id}?noreg=1&role=host`);
      return;
    }
    if (hasWebinarSession && !webinarLiveNow) {
      toast.info("Still waiting for the host to let you in — hang tight!");
      return;
    }
    router.push(attendeeWebinarHref(webinar.id));
  }, [webinar, hasWebinarSession, webinarLiveNow, hostUnlocked, router, attendeeWebinarHref]);

  const unlock = useCallback((id: TileId) => {
    setUnlocked((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      persistUnlocks(next);
      return next;
    });
  }, []);

  // Evaluated on mount — i.e. when the visitor COMES BACK (including a
  // return from the /bat246-videos gallery, a separate page now — see
  // lib/webinar/bat246VideoGate.ts), which is exactly when the founder
  // wants the tile to have opened up. That page is the one writing
  // VIDEOS_KEY as intros get watched; this is the read side, and it's
  // the ONLY thing that needs to know about video-watching progress here
  // — the videos themselves, and everything about playing/unlocking them
  // individually, live entirely on that page now.
  useEffect(() => {
    setUnlocked(readUnlocks());
    if (readNumber(WATCH_KEY) >= REQUIRED_WEBINAR_SECONDS) unlock(2);
    if (readNumber(VIDEOS_KEY) >= REQUIRED_VIDEOS) unlock(3);
  }, [unlock]);

  const overlayOpen = storyOpen;
  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setStoryOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Stop the page scrolling behind the overlay.
    //
    // Cleared unconditionally rather than restoring a captured previous
    // value: if this ever re-ran while already locked it would capture
    // "hidden" as the value to put back, and the page would never scroll
    // again. The page has no other reason to set body overflow, so "" is
    // always the correct resting state.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [overlayOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  /**
   * Release the (auth) shell's touch lock for this page.
   *
   * That layout pins html and body with `touch-action: none; position:
   * fixed; overflow: hidden` — it is built for the login screen, which
   * fits one viewport and must not scroll or zoom. This page is taller,
   * and on a phone that lock swallows the scroll gesture entirely, so no
   * amount of overflow on our own container helps.
   *
   * Applied on a timeout because the parent layout's effect runs AFTER a
   * child's on mount; without the tick it would immediately re-apply the
   * lock over the top of this. Restored on unmount so the login screen
   * keeps the behaviour it wants.
   */
  useEffect(() => {
    const release = () => {
      for (const el of [document.documentElement, document.body]) {
        el.style.touchAction = "auto";
        el.style.position = "static";
        el.style.overflow = "auto";
        el.style.height = "auto";
        el.style.overscrollBehavior = "auto";
      }
    };
    const t = setTimeout(release, 0);
    release();
    return () => {
      clearTimeout(t);
      for (const el of [document.documentElement, document.body]) {
        el.style.cssText = "";
      }
    };
  }, []);

  /**
   * Hidden override, entered in the thin slot above the top bun.
   *
   *   02 — unlock the Short Intro Videos tile in place. Does NOT navigate
   *        there — the visitor still clicks the tile themselves, same as
   *        earning the unlock normally (15 min of webinar attendance).
   *   03 — open yourmoneyback.info/aboutus in a new tab. Does NOT unlock
   *        the B2 Back Office tile — that still only opens once all 6
   *        intro videos are watched.
   *   05 — drop straight into the webinar with no name and no
   *        registration (see the note on the handler below).
   *
   * Compared as trimmed strings, not numbers, so "02" and "2" both land and
   * a stray "002" doesn't. Unknown codes clear the box and do nothing —
   * deliberately silent, since an error message would advertise that the
   * slot means something.
   *
   * Takes the already-normalized code rather than reading `code` state, so
   * both submit paths below (the form's onSubmit, and the mobile
   * auto-trigger in handleCodeChange) can call it with a value they just
   * computed themselves instead of racing setCode's async update.
   */
  const applyCode = useCallback(
    (entered: string) => {
      if (entered === "2") {
        unlock(2);
      } else if (entered === "3") {
        // New tab, not a navigation away from this page — does not unlock
        // the B2 Back Office tile, which must still be earned by watching
        // all 6 videos.
        window.open("https://yourmoneyback.info/aboutus", "_blank", "noopener,noreferrer");
      } else if (entered === "5") {
        // Straight into the room: WebinarPreJoin reads noreg=1 and skips
        // email/OTP for a name-only entry, and role=host is what makes the
        // eventual webinar:joinRoom socket call ask for the host role (the
        // server still independently verifies it's allowed — see
        // demo-host-join in publicWebinar.ts).
        // Remember it first, so the "Live Webinar" tile also lets them in as
        // host afterwards instead of dropping them on the attendee
        // waiting-gate — the exact dead end this code was hitting.
        setHostUnlocked(true);
        try {
          localStorage.setItem(HOST_CODE_KEY, "1");
        } catch {
          /* blocked storage — the in-memory flag still covers this visit */
        }
        if (webinar) {
          router.push(`/webinar/${webinar.id}?noreg=1&role=host`);
        } else {
          // `webinar` arrives from a fetch AFTER mount. Silently doing nothing
          // here is what made 05 look dead; tell them instead. The flag above
          // is already set, so the tile works the moment the fetch lands.
          toast.info("Loading the webinar — tap Live Webinar in a moment.");
        }
      }
    },
    // `webinar` matters: it arrives from a fetch AFTER mount, so leaving it
    // out froze this callback around the initial null and made code 05 a
    // silent no-op for anyone who typed it.
    [unlock, webinar, router],
  );

  const submitCode = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      applyCode(code.trim().replace(/^0+(?=\d)/, ""));
      setCode("");
    },
    [code, applyCode],
  );

  // Mobile numeric keypads have no Enter/Go key that reliably fires the
  // form's onSubmit, so a phone visitor who typed "02" was stuck with a
  // filled box and nothing unlocked. On mobile, fire once the exact two
  // literal digits "02"/"03"/"05" have been typed — checked against the
  // raw value, not the leading-zero-stripped one submitCode uses, so a
  // bare "2" alone (an easy stray tap) never fires this early; only the
  // real code does. Desktop keeps using the form's onSubmit (Enter)
  // unchanged, where a bare "2" still lands same as it always has.
  const handleCodeChange = useCallback(
    (raw: string) => {
      setCode(raw);
      if (!isMobile) return;
      if (raw === "02" || raw === "03" || raw === "05") {
        applyCode(raw[1]);
        setCode("");
      }
    },
    [isMobile, applyCode],
  );

  const tiles = [
    {
      id: 1,
      title: "Live Webinar",
      // No webinar resolved yet → generic copy. Not registered (never
      // completed email/OTP) → plain live/not-live status, regardless of
      // whether the webinar happens to be live right now. Registered
      // (verified email/OTP this visit, redirected home once that's done —
      // see WebinarPreJoin.tsx's isBat246Webinar branch) → personal
      // waiting/ready copy, kept current by the polling effect above. The
      // two-line "You're all set…" waiting message is ONLY for that
      // registered-and-not-live case — an unregistered visitor hasn't
      // verified anything yet, so it would be misleading to tell them
      // they're "all set".
      subs: !webinar
        ? ["Come join us for free"]
        : hasWebinarSession
          ? webinarLiveNow
            ? ["It's live, join now!"]
            : [
                "You’re all set. The moment the host starts, we’ll drop you straight in — no need to refresh.",
                "Waiting for the host to go live…",
              ]
          : [webinarLiveNow ? "Webinar is live" : "Click to join webinar"],
      centerSub: true,
      // Coral red, lighter at the top shading to a deeper red at the
      // bottom — matches the founder's reference artwork. Full strength
      // only while the webinar is actually live; a lighter tint of the same
      // red until then (a clean lighter colour, not a dimmed/greyed one), so
      // the tile itself signals "not yet". Stays clickable either way —
      // it's the waiting room.
      tone: "from-[#F78A89] via-[#EE6668] to-[#DE4F55]",
      fadedTone: "from-[#FBB7B5] via-[#F79E9E] to-[#EF8A8C]",
      faded: !webinarLiveNow,
      ink: "text-[#1F0F0E]",
      // Always open — it's why people land here.
      open: true,
      display: false,
      onClick: goToWebinar,
    },
    {
      id: 2,
      title: "Short Intro Videos",
      // One centred line: "only" not "only a", minutes abbreviated, and
      // the article dropped from "a great understanding".
      subs: ["- Only few MIN. each - Gain great understanding"],
      centerSub: true,
      // Bright green, lighter at the top shading deeper at the bottom —
      // matches the founder's reference artwork. A lighter tint of the same
      // green while locked (clean lighter colour, not dimmed/greyed).
      tone: "from-[#92E08E] via-[#6BCC74] to-[#43AE60]",
      fadedTone: "from-[#B9F2AB] via-[#9CE697] to-[#7ED681]",
      faded: !unlocked.has(2),
      ink: "text-[#0E2A17]",
      // Locked (lighter tint) until the webinar has been attended.
      open: unlocked.has(2),
      display: false,
      onClick: () => {
        // Every fresh click from THIS landing page starts the gallery
        // clean — no "Watched" badges left over from a previous visit.
        // Only clears WATCHED_KEY (per-chapter watched state); VIDEOS_KEY
        // (the "all 6 done" milestone that unlocks the B2 Back Office
        // tile) is untouched, so a visitor who already earned that stays
        // unlocked even though the chapter badges themselves reset.
        try {
          window.localStorage.removeItem(WATCHED_KEY);
        } catch {
          // Private browsing — nothing to clear, the gallery just starts
          // fresh anyway since there was never anything persisted.
        }
        router.push("/bat246-videos");
      },
    },
    {
      // Cheese — a display slice, not a control (no onClick below).
      id: 4,
      title: "Options",
      subs: ["for Interested Players of BAT 246"],
      centerSub: true,
      // Cheese yellow, lighter at the top shading to a deeper gold at the
      // bottom — matches the founder's reference artwork.
      tone: "from-[#FBE168] via-[#F6CF45] to-[#EAB82A]",
      // Never faded — a display slice has no locked/live state to signal.
      fadedTone: "from-[#FBE168] via-[#F6CF45] to-[#EAB82A]",
      faded: false,
      ink: "text-[#1A1407]",
      open: true,
      display: true,
      onClick: () => {},
    },
    {
      id: 3,
      title: "B2 Back Office",
      subs: ["Detailed info — opens once you have joined"],
      centerSub: true,
      // Toasted brown, lighter at the top shading deeper at the bottom —
      // matches the founder's reference artwork. One step deeper under
      // the cursor.
      tone: "from-[#D69D62] via-[#C5854B] to-[#A86737] group-hover:from-[#C98F56] group-hover:via-[#B57740] group-hover:to-[#985B2E]",
      // Deliberately NOT given the lighter "not yet" tint the first two
      // tiles use — on request this one keeps the original locked
      // treatment (its real colour, dimmed via opacity-70 below).
      fadedTone: "from-[#D69D62] via-[#C5854B] to-[#A86737]",
      faded: false,
      ink: "text-[#2A170B]",
      open: unlocked.has(3),
      display: false,
      onClick: () => {
        window.location.href = "https://my.garage.app";
      },
    },
  ];

  // Display-only slices aren't achievements, so they don't count toward
  // "N of M unlocked". Commented out along with the label below that used
  // these — not needed for now.
  // const openCount = tiles.filter((t) => t.open && !t.display).length;
  // const unlockableCount = tiles.filter((t) => !t.display).length;

  // The JOIN NOW bun opens the BAT246 office-invite checkout on bat246.com
  // in a new tab.
  // Pre-filled with whoever's affiliate id is in the URL (refFromUrl above) —
  // e.g. a Grow Your Network share link — so that person gets the credit.
  // Falls back to Alan K's id (697a4b54730b71c41d48900c — confirmed against
  // the User collection: redbaron2020@mail.com / "Alan K") so a bare
  // gotobigwin.com visit with no ref still attributes back to him. New tab
  // (not a redirect) so the visitor never loses this landing page. No longer
  // tied to goToWebinar — that's still used by the separate "Live Webinar"
  // tile.
  const joinNow = useCallback(() => {
    const refId = refFromUrl || "697a4b54730b71c41d48900c";
    window.open(
      `https://bat246.com/games/bat246/office-invite?productId=6a159466cd9f94f7f23b2ef9&ref=${encodeURIComponent(refId)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [refFromUrl]);

  return (
    <div
      data-allow-scroll
      className="min-h-[100dvh] text-white"
      style={{
        background: `radial-gradient(1100px 600px at 15% -5%, #24365F 0%, transparent 60%),
                     radial-gradient(900px 520px at 95% 5%, #2B1B3D 0%, transparent 55%),
                     ${NAVY}`,
      }}
    >
      {/* Tightened vertical rhythm so the badge artwork is fully visible on
          landing without having to scroll to it. */}
      <main className="mx-auto grid max-w-[1320px] items-start gap-8 px-4 py-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-10">
        {/* ── Left: badge + story ─────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          {/* Wraps both the badge and the story box so they shift left
              together as one group — separate from the badge's own
              individual -5%/+5%/scale-110 transform below (that one only
              moves/grows the badge relative to this wrapper; this one
              moves the whole wrapper, badge + box together, relative to
              the column). translate-x is a % of THIS wrapper's own width
              (~the column width), not the badge's, so the two shifts are
              independent and not additive in the same frame of reference.

              Both shifts (this one and the badge's own, below) only exist to
              balance the two-column desktop grid — there's no second column
              to balance against on mobile, where the page is single-column,
              so the same offsets just push the badge and story box visibly
              off-center. lg: scoped so mobile renders with no horizontal
              shift at all (centered, matching items-center/text-center on
              the section above) and desktop is pixel-for-pixel unchanged. */}
          <div className="flex w-full flex-col items-center lg:translate-x-[-5%]">
            {/* translate-y/-x shift the badge down-left 5% of its own box,
                scale-110 grows it 10% — all via transform, so it doesn't
                change layout flow/spacing on its own. Because of that, the
                badge now visually overhangs a bit lower than its allocated
                space; the story box below has extra top margin (mt-10, was
                mt-6) so it clears the shifted badge instead of crowding it.
                x/y shift is lg-only for the same centering reason as the
                wrapper above — scale-110 stays for every size, it doesn't
                pull the badge off-center. */}
            <div className="relative scale-110 lg:translate-x-[-5%] lg:translate-y-[5%]">
              {/* Warm halo behind the badge. Not rounded-full here — this
                  artwork (unlike the old bat246-logo.jpeg) isn't a plain
                  circle: it's a circle + drop shadow + a "PERFECTED SINCE
                  1994" banner stacked below, so its bounding box is taller
                  than it is wide. A circular halo would mismatch that shape
                  and peek out oddly beside the banner. */}
              <div className="absolute inset-0 -z-10 blur-2xl" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.85), transparent)" }} />
              <Image
                src="/images/bat246-alan-logo.png"
                alt="BAT 246 — TLS Revolution — Earn like a pro this month — Perfected since 1994"
                width={1404}
                height={1518}
                priority
                // Capped against viewport height, not just width — the point is
                // that the whole badge is on screen when the page opens. No
                // rounded-full/shadow-2xl: this asset already has its own
                // circle edge and drop shadow baked in, so those would only
                // clip/duplicate it.
                className="h-auto w-44 max-w-full sm:w-56 lg:w-64"
              />
            </div>

            <div className="mt-10 w-full rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left backdrop-blur-sm sm:p-6">
              {/* All six paragraphs fit fine in the desktop column, so they
                  stay full there — but the same block was dumping the whole
                  letter above the fold on a phone before a visitor ever saw
                  the burger below it. line-clamp-2 (mobile/tablet only, off
                  again at lg:) truncates the rendered paragraphs down to two
                  lines; the "Read more…" button right underneath already
                  opens the full letter, so nothing is actually lost. */}
              <div className="line-clamp-2 lg:line-clamp-none">
                {STORY_INTRO.map((para, i) => (
                  <p
                    key={i}
                    className={`text-[18px] leading-relaxed text-white/80 ${
                      i === 0 ? "" : "mt-3"
                    }`}
                  >
                    {para}
                  </p>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p className="text-[18px] font-bold text-[#F5C451]">
                  Alan Kippax,
                </p>
                <button
                  type="button"
                  onClick={() => setStoryOpen(true)}
                  className="text-sm font-black uppercase tracking-[0.14em] text-[#FF4D5A] underline-offset-4 hover:underline"
                >
                  Read more&hellip;
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Right: the burger ───────────────────────────────────── */}
        <section
          className={[
            // The 4.5%/12% offset balances this column against the badge's
            // own left-shift in the two-column desktop grid — with no second
            // column on mobile it just pushed the whole burger off-center,
            // same reasoning as the badge/story shifts above. lg-scoped so
            // mobile centers naturally and desktop is unchanged.
            "flex flex-col gap-3.5 transition-transform duration-300 lg:translate-x-[4.5%] lg:translate-y-[1%]",
            // Nudged further right while the "Read more" panel is open (at
            // lg+ only — that panel only leaves this column visible from
            // lg up, so pushing it below that would just move it for no
            // reason). Reverts to the normal 4.5% the instant the panel
            // closes, since this class is only present while storyOpen.
            storyOpen ? "lg:translate-x-[38%]" : "",
          ].join(" ")}
        >
          <AccessCodeSlot
            value={code}
            onChange={handleCodeChange}
            onSubmit={submitCode}
          />

          <JoinNow onClick={joinNow} />

          {tiles.map((t, i) => (
            <motion.button
              key={t.id}
              type="button"
              // The cheese slice is decoration, not a control: nothing to
              // press, nothing to announce.
              disabled={t.display || !t.open}
              onClick={!t.display && t.open ? t.onClick : undefined}
              aria-hidden={t.display || undefined}
              tabIndex={t.display ? -1 : undefined}
              aria-disabled={!t.display && !t.open}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * i }}
              whileHover={!t.display && t.open ? { scale: 1.015 } : undefined}
              whileTap={!t.display && t.open ? { scale: 0.99 } : undefined}
              className={[
                // Every filling the same thickness — roughly double the
                // bun — and inset horizontally so the buns overhang them.
                // Narrower inset on small phones so the fillings keep
                // usable width instead of getting squeezed too thin.
                // Vertical shading (light top → deeper bottom) plus a glossy
                // inset highlight along the top edge and a soft inner shadow
                // along the bottom, so each filling reads as a puffy 3D slab
                // like the founder's reference artwork rather than a flat
                // colour block.
                "group relative mx-4 min-h-[86px] overflow-hidden rounded-2xl bg-gradient-to-b px-4 py-6 text-left transition-all sm:mx-8 sm:px-5",
                // Lighter tint of the tile's own colour (first two tiles only)
                // until it's actually available — locked, or the webinar isn't
                // live yet. Full colour the moment it is. No opacity involved,
                // so it reads as a lighter colour rather than a dimmed one.
                t.faded ? t.fadedTone : t.tone,
                // Hand cursor everywhere — including the locked tiles and
                // the decorative cheese slice — the founder didn't want the
                // "blocked" cursor on locked tiles at all.
                t.display
                  ? "cursor-pointer shadow-[0_12px_30px_-12px_rgba(0,0,0,0.7),inset_0_2px_2px_rgba(255,255,255,0.45),inset_0_-4px_6px_rgba(0,0,0,0.18)]"
                  : t.open
                    ? "cursor-pointer shadow-[0_12px_30px_-12px_rgba(0,0,0,0.7),inset_0_2px_2px_rgba(255,255,255,0.45),inset_0_-4px_6px_rgba(0,0,0,0.18)] hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8),inset_0_2px_2px_rgba(255,255,255,0.5),inset_0_-4px_6px_rgba(0,0,0,0.2)]"
                    // Locked. A tile with its own lighter tint (faded) skips
                    // the dim; the rest (B2 Back Office) keep the original
                    // real-colour-at-opacity-70 fade.
                    : `cursor-pointer shadow-[inset_0_2px_2px_rgba(255,255,255,0.35),inset_0_-4px_6px_rgba(0,0,0,0.18)] ${t.faded ? "" : "opacity-70"}`,
              ].join(" ")}
            >
              <div className="flex min-h-[38px] items-center justify-between gap-4">
                <div className={t.centerSub ? "w-full" : "min-w-0"}>
                  {/* One size and one weight across every filling. */}
                  <span
                    className={`block text-lg font-black leading-tight sm:text-xl ${t.ink} ${
                      t.centerSub ? "text-center" : ""
                    }`}
                  >
                    {t.title}
                  </span>
                  {t.subs.map((line, k) => (
                    <span
                      key={k}
                      className={[
                        "block font-medium",
                        // The intro-videos lines were called out to be
                        // larger and centred than the other subtexts.
                        t.centerSub
                          ? "text-center text-base sm:text-lg"
                          : "text-sm",
                        k === 0 ? "mt-1" : "mt-0.5",
                        t.ink,
                        t.centerSub ? "" : "opacity-85",
                      ].join(" ")}
                    >
                      {line}
                    </span>
                  ))}
                </div>

                {!t.display && t.open && t.id === 1 && webinar?.live && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#C1121F] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Live
                  </span>
                )}
              </div>

              {/* Locked-tile indicator: grey wash (opacity-50 above) plus an
                  explicit lock glyph in the corner, so a first-time visitor
                  who hasn't watched/joined the webinar can tell at a glance
                  which fillings aren't available yet. */}
              {!t.display && !t.open && (
                <Lock
                  aria-hidden
                  className={`absolute right-3 top-3 h-4 w-4 opacity-80 ${t.ink}`}
                />
              )}
            </motion.button>
          ))}

          {/* Returning members log in at bat246.com (the founder's own
              site). NOT this app's own /login: on gotobigwin.com that route
              renders this very landing page again (Welcome.tsx's isBat246
              branch), so pushing to it just reloaded the page. */}
          <JoinNow
            onClick={() => {
              window.location.href = "https://bat246.com/";
            }}
            label="Log In"
            variant="bottom"
          />

          {/* Decorative twin of the AccessCodeSlot's at-rest rule above the
              top bun — same size and colour, but static: no hidden input,
              no hover/focus behaviour. pt-7 puts it the same distance below
              the Log In bun as the slot's rule sits above Join Now. */}
          <div className="flex justify-center pb-1 pt-7">
            <span aria-hidden className="h-[2px] w-20 rounded-full bg-white/80" />
          </div>

          {/* "N of M unlocked" — commented out for now, not needed. */}
          {/* <p className="pt-1 text-right text-xs font-medium text-white/35">
            {openCount} of {unlockableCount} unlocked
          </p> */}
        </section>
      </main>

      {/* ── The full letter ──────────────────────────────────────────
          A large panel over everything, logo included — it's long enough
          that expanding it in the column would push the burger off screen. */}
      {storyOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Below lg: unchanged — full-width centered overlay, same as
          // before (the page itself is single-column there, so there's no
          // "right side" to keep visible anyway). At lg+: anchored to the
          // left instead of centered, and the backdrop goes from a near-
          // opaque blur to a light, unblurred tint — enough to show the
          // background is inactive without hiding the burger (Join Now,
          // tiles) sitting behind it on the right.
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6 lg:justify-start lg:bg-black/45 lg:backdrop-blur-none lg:pl-6 lg:pr-4"
          onClick={() => setStoryOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Perfected since 1994"
        >
          {/* Wide enough (below lg) that the letter's paragraphs wrap onto
              very few lines each, so the whole thing fits without
              scrolling on a normal screen. max-h-[90vh] + overflow-y-auto
              on the inner div is a safety net for short viewports — the
              box itself can never exceed 90% of the screen height, so it
              can't run off the bottom even if it needs that fallback
              scroll. At lg+ the panel narrows to roughly half the
              viewport so the burger stays visible beside it — that
              narrower column means more wrapped lines than the full-width
              version, so the fallback scroll is more likely to actually
              be needed there; it's still capped at 90vh either way. */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-[1603px] max-h-[90vh] rounded-2xl border border-white/12 bg-[#0A0E1A] shadow-2xl lg:w-[62%] lg:max-w-[1180px] lg:min-w-[680px]"
          >
            <button
              type="button"
              onClick={() => setStoryOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Fallback scroll only — kept as a safety net for very short
                viewports, but the sizing below is tuned to stay under 90vh
                on a normal screen. A 760px reading column was wrapping
                nearly every sentence onto 2-3 lines and pushed the total
                past the box height (scrollbar showed up). Widened to
                1100px — long enough that most lines fit on one row, still
                narrower than the full box so there's visible side margin
                for breathing room. Top padding trimmed separately (pt-*)
                so the heading sits close under the close button instead
                of leaving tall empty space above it — that reclaimed gap
                is what was tipping the total over 90vh. */}
            <div className="max-h-[90vh] overflow-y-auto px-6 pb-6 pt-2 sm:px-8 sm:pb-8 sm:pt-2.5 md:px-10 md:pb-10 md:pt-3 lg:px-6 lg:pb-6 lg:pt-2">
            <div className="mx-auto max-w-[1300px]">
            {/* Same size as "BAT 246" below from sm: up. Stays a step
                smaller on narrow phones — at 2xl with this much letter-
                tracking the phrase can run wide enough to crowd the close
                button in the top-right corner, and pr-14 gives it clearance
                either way. */}
            <p className="pr-14 text-lg font-black uppercase tracking-[0.15em] text-[#F5C451] sm:pr-0 sm:text-2xl sm:tracking-[0.25em]">
              Perfected since 1994
            </p>

            <div className="mt-5 space-y-3">
              {STORY_MORE.map((para, i) => (
                <p
                  key={i}
                  className="text-[17.2px] leading-snug text-white/80 sm:text-[18.2px]"
                >
                  {para}
                </p>
              ))}
            </div>

            <div className="my-5 border-y border-[#F5C451]/25 py-4 text-center">
              <p className="text-3xl font-black tracking-tight text-white">
                BAT 246
              </p>
              <p className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-[#F5C451]">
                &ldquo;Earn like a pro this month!&rdquo;
              </p>
            </div>

            <div className="space-y-3">
              {STORY_CLOSE.map((para, i) => (
                <p
                  key={i}
                  className="text-[17.2px] leading-snug text-white/80 sm:text-[18.2px]"
                >
                  {para}
                </p>
              ))}
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-lg font-black text-white">Alan Kippax</p>
              <p className="text-sm font-semibold text-[#F5C451]">
                Perfected Since 1994
              </p>
            </div>
            </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Intro videos moved off this page entirely — see
          app/bat246-videos/Bat246VideosClient.tsx. Both the tile above and
          access code 02 (submitCode) now navigate there instead of
          opening a modal here. */}
    </div>
  );
}

/**
 * The hidden access slot, sitting just above the top bun.
 *
 * At rest it is a thin black rule that reads as part of the layout. Hover or
 * focus expands it into a small input. Keyboard users get it on focus-within
 * too, so it isn't hover-only and therefore unreachable on a phone or by tab.
 *
 * Nothing here labels itself: the whole point is that a visitor doesn't
 * notice it, while the founder's team can find it.
 */
function AccessCodeSlot({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange(v: string): void;
  onSubmit(e: React.FormEvent): void;
}) {
  return (
    <form onSubmit={onSubmit} className="group/slot flex justify-center pb-1 pt-4">
      <div className="relative flex h-12 items-center">
        {/* At rest: a white rule. Black was invisible against the navy. */}
        <span
          aria-hidden
          className="h-[2px] w-20 rounded-full bg-white/80 transition-opacity duration-200 group-hover/slot:opacity-0 group-focus-within/slot:opacity-0"
        />
        {/* Roughly twice the old box, white-outlined, wide enough for three
            digits without the caret crowding them. */}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          maxLength={3}
          aria-label="Access code"
          className="absolute left-1/2 top-1/2 h-11 w-28 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white/80 bg-white/10 px-2 text-center text-lg font-bold tracking-[0.3em] text-white opacity-0 outline-none transition-opacity duration-200 placeholder:text-white/40 group-hover/slot:opacity-100 focus:opacity-100 group-focus-within/slot:opacity-100"
        />
      </div>
    </form>
  );
}

/**
 * The bun. Black lettering on golden sesame bread, with a thick black rule
 * either side of the words.
 *
 * The two burger-bun halves, matching the founder's reference artwork. They
 * are NOT mirror images — a real bun isn't:
 *   - "top" (Join Now!): the crown — a tall half-circle dome, toasted brown
 *     on the crust, flat pale cut face underneath.
 *   - "bottom" (Log In): the heel — flat cut face on top, then a squat,
 *     flattened underside: it curves up at both ends but sits flat across
 *     the middle, like it's resting on the table. Shorter than the crown.
 *
 * The crown's dome is a real ellipse, not Tailwind's `rounded-t-full`: with a 9999px
 * radius the browser clamps each top corner to the box's height, leaving a
 * long FLAT run across the middle — a rounded rectangle, not a bun. Giving
 * each dome-side corner a horizontal radius of 50% makes the two corners meet
 * in the centre as one continuous arc, and a vertical radius of the FULL
 * height makes that arc run all the way down to the cut face — a half
 * ellipse on a flat base, no straight side walls (the founder was specific:
 * "like a half circle", not a dome on a box). Because the ellipse meets the
 * base travelling vertically, the ends aren't pointed; an earlier version
 * that gave the base corners a big radius of their own came out lemon-shaped.
 * The 6px is the base corner, taken off the dome's vertical radius via calc()
 * so each side still sums to 100% and the browser doesn't scale the radii.
 *
 * How domed it LOOKS is set by dome height ÷ half-width, and the arc is the
 * same ellipse at every width — so on the wide desktop column the bun is
 * taller than on a phone (the sm: min-height below) or it squashes to a lid.
 *
 * The seeds are a fixed scatter — generated once, not random per render,
 * which would make them jump around on every re-render/hover — kept to the
 * dome half of each bun (above the words on the crown, below them on the
 * heel), the way sesame sits on real bread.
 *
 * `flex-1` on the rules makes them run the remaining width; the wide
 * horizontal padding is what stops them short of the bun's edge, as in the
 * artwork. Always enabled — the intro-video gate that used to disable it is
 * gone.
 */
function JoinNow({
  onClick,
  label = "Join Now!",
  variant = "top",
}: {
  onClick(): void;
  label?: string;
  variant?: "top" | "bottom";
}) {
  const top = variant === "top";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.99 }}
      className={[
        // Label is text-xl / text-2xl grown ~26% (20 → 25.3px, 24 → 30.4px),
        // a size the founder settled on by eye.
        "group relative flex w-full cursor-pointer items-center justify-center gap-4 overflow-hidden px-10 text-[25.3px] font-black uppercase tracking-[0.1em] text-[#17120E] transition hover:brightness-105 sm:gap-5 sm:px-16 sm:text-[30.4px]",
        // Crown: taller on sm+ than the fillings — the column is ~600px wide
        // there and the dome's rise has to keep pace with that width or the
        // arc flattens into a lid (see the shape note above). The label sits
        // low, under the dome's peak, as in the art.
        // Heel: deliberately much squatter than the crown — about half its
        // height, barely taller than the label itself. It's the half that
        // rests on the table, so it's pressed flat, and the founder wanted
        // the difference obvious at a glance, not something you notice on
        // a second look. Label sits in its upper, flat-topped part.
        top
          ? "min-h-[96px] pb-4 pt-8 sm:min-h-[120px] sm:pb-4 sm:pt-12"
          : "min-h-[58px] pb-3.5 pt-1.5 sm:min-h-[62px] sm:pb-4 sm:pt-2",
      ].join(" ")}
      style={{
        // Crown: full-height half-ellipse on a flat base.
        // Heel: a flat top, then short straight sides into a shallow bend
        // — the bottom corners are 30% wide and 60% tall, so the underside
        // only curves up at the two ends and stays FLAT across the whole
        // middle 40%, like a bun pressed onto a table, rather than
        // mirroring the crown's deep dome.
        borderRadius: top
          ? "50% 50% 6px 6px / calc(100% - 6px) calc(100% - 6px) 6px 6px"
          : "6px 6px 30% 30% / 6px 6px 60% 60%",
        // Crown: toasted on TOP — the dark brown lives up on the crust where
        // the oven browned it, fading to the pale cut face at the bottom —
        // with a soft sheen low on the dome. Heel: pale cut face on top,
        // toasted underneath. (The crown used to be shaded the other way,
        // dark at the base; the founder called that out as upside-down.)
        background: top
          ? "radial-gradient(ellipse 60% 55% at 50% 72%, rgba(255,240,196,0.9) 0%, rgba(255,240,196,0) 70%), linear-gradient(to bottom, #B86E1C 0%, #D48A28 16%, #EBAE46 48%, #F4C86E 78%, #F8D98E 100%)"
          : "radial-gradient(ellipse 60% 70% at 50% 30%, rgba(255,238,190,0.85) 0%, rgba(255,238,190,0) 70%), linear-gradient(to bottom, #F5CD76 0%, #EEB249 50%, #DA8F2A 88%, #C47A20 100%)",
        // Crown: dark inset band along the crown's rim (the toasted edge),
        // light inset along the cut face. Heel: the reverse, plus a
        // tighter, closer drop shadow since it's sitting on the surface.
        boxShadow: top
          ? "0 14px 30px -12px rgba(0,0,0,0.85), inset 0 6px 10px rgba(110,60,8,0.45), inset 0 -3px 4px rgba(255,255,255,0.4)"
          : "0 10px 18px -8px rgba(0,0,0,0.9), inset 0 3px 4px rgba(255,255,255,0.45), inset 0 -6px 10px rgba(120,70,10,0.4)",
      }}
    >
      {(top ? TOP_BUN_SEEDS : BOTTOM_BUN_SEEDS).map((s, i) => (
        <span
          key={i}
          aria-hidden
          // A mix of seeds, as in the artwork: mostly white, with every
          // third one a toasted dark brown.
          //   White: a solid dark-brown twin offset down-right behind it (a
          //   hard, unblurred shadow) plus a thin dark outline, so it reads
          //   as white on dark brown rather than a pale dot lost in the
          //   orange. Fully opaque on purpose — translucent just tinted the
          //   bun and the effect vanished.
          //   Dark: a ROASTED seed — the bun's own toasted shade, a few
          //   steps deeper than the darkest crust colour, not chocolate
          //   brown (that read as burnt). Lifted off the bun by a pale glint
          //   on its upper-left edge and a soft shadow in the same tone.
          className={`pointer-events-none absolute h-[7px] w-[11px] rounded-full ${
            i % 3 === 2 ? "bg-[#A35A12]" : "bg-[#FFFCF4]"
          }`}
          style={{
            left: `${s.l}%`,
            top: `${s.t}%`,
            transform: `rotate(${s.r}deg)`,
            boxShadow:
              i % 3 === 2
                ? "1px 2px 2px rgba(110,55,8,0.55), inset 1px 1px 1px rgba(255,236,190,0.6)"
                : "2px 3px 0 #4A2305, 0 0 0 1px rgba(74,35,5,0.55), inset -1px -1px 1px rgba(190,120,40,0.5)",
          }}
        />
      ))}
      <span aria-hidden className="h-[3px] flex-1 rounded-full bg-[#17120E]" />
      {/* font-black alone wasn't thick enough for the founder — the
          family's heaviest weight is still fairly thin at this size — so
          the glyphs are outlined in their own colour, which fattens every
          stroke without changing the letterforms. paint-order keeps the
          stroke under the fill so the edges stay crisp. */}
      <span
        className="whitespace-nowrap"
        style={{ WebkitTextStroke: "1px #17120E", paintOrder: "stroke fill" }}
      >
        {label}
      </span>
      <span aria-hidden className="h-[3px] flex-1 rounded-full bg-[#17120E]" />
    </motion.button>
  );
}

// Seed positions as % of the bun box: l = left, t = top, r = rotation.
// The dome now curves the full height, so near the ends the crust sits well
// inside the box: the outermost seeds (l ≤ 18 / ≥ 88) are pushed down (top
// bun) or up (bottom bun) to stay on the bread instead of being clipped.
const TOP_BUN_SEEDS = [
  { l: 6, t: 64, r: -30 }, { l: 10, t: 50, r: 15 }, { l: 14, t: 58, r: -8 },
  { l: 18, t: 34, r: 35 }, { l: 23, t: 40, r: -20 }, { l: 28, t: 14, r: 10 },
  { l: 33, t: 32, r: -35 }, { l: 37, t: 10, r: 25 }, { l: 42, t: 26, r: -12 },
  { l: 47, t: 9, r: 40 }, { l: 52, t: 22, r: -25 }, { l: 56, t: 8, r: 5 },
  { l: 61, t: 28, r: 30 }, { l: 66, t: 12, r: -40 }, { l: 71, t: 36, r: 18 },
  { l: 75, t: 16, r: -15 }, { l: 80, t: 30, r: 28 }, { l: 84, t: 50, r: -22 },
  { l: 88, t: 46, r: 12 }, { l: 92, t: 64, r: -32 }, { l: 25, t: 62, r: 20 },
  { l: 76, t: 60, r: -10 },
];
const BOTTOM_BUN_SEEDS = [
  { l: 6, t: 36, r: 30 }, { l: 10, t: 50, r: -15 }, { l: 14, t: 44, r: 8 },
  { l: 18, t: 66, r: -35 }, { l: 23, t: 60, r: 20 }, { l: 28, t: 78, r: -10 },
  { l: 33, t: 66, r: 35 }, { l: 37, t: 82, r: -25 }, { l: 42, t: 72, r: 12 },
  { l: 47, t: 84, r: -40 }, { l: 52, t: 76, r: 25 }, { l: 56, t: 82, r: -5 },
  { l: 61, t: 70, r: -30 }, { l: 66, t: 80, r: 40 }, { l: 71, t: 64, r: -18 },
  { l: 75, t: 82, r: 15 }, { l: 80, t: 68, r: -28 }, { l: 84, t: 48, r: 22 },
  { l: 88, t: 54, r: -12 }, { l: 92, t: 36, r: 32 }, { l: 24, t: 40, r: -20 },
  { l: 75, t: 42, r: 10 },
];
