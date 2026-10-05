"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { connectWebinarSocket, disconnectWebinarSocket } from "@/lib/socket";
import EvergreenRoom from "@/components/webinar/EvergreenRoom";
import { getToken, getUserDataFromToken, getOrgId, isAuthenticated } from "@/lib/auth";
import { useWebinarLiveKit } from "@/hooks/useWebinarLiveKit";
import {
  createMagicLink,
  readMagicLink,
  magicLinkUrl,
} from "@/lib/webinar/magic-link";
import PlanPhoneVerifySheet from "@/components/webinar/PlanPhoneVerifySheet";
import JoinRequestsPanel from "@/components/webinar/JoinRequestsPanel";
import { fetchWhitelabelOrg } from "@/lib/whitelabel";
import {
  resolveGarageStoreItem,
  resolveTermMonths,
  parseGarageStoreId,
  createComboInvoice,
  claimFreeMonth,
  subscribeStandalone,
  subscribeOffice,
} from "@/lib/webinar/garage-store-plans";
import useWebinarStore, { detectLocalDeviceType } from "@/store/webinarStore";
import { useSimulatedAudience } from "@/components/webinar/useSimulatedAudience";
import { describeThisBrowser, getWebinarDeviceId } from "@/lib/webinar-device";
import type { WebinarRole } from "@/store/webinarStore";
import VideoGrid from "@/components/webinar/VideoGrid";
import ChatPanel from "@/components/webinar/ChatPanel";
import ParticipantsList from "@/components/webinar/ParticipantsList";
import ControlBar from "@/components/webinar/ControlBar";
import MicPickerDialog from "@/components/webinar/MicPickerDialog";
import { realAudioInputs } from "@/lib/webinar/mic-devices";
import FullscreenButton from "@/components/webinar/FullscreenButton";
import PinnedProductCard from "@/components/webinar/PinnedProductCard";
import ProductPickerDialog from "@/components/webinar/ProductPickerDialog";
import WebinarCheckoutDialog from "@/components/webinar/WebinarCheckoutDialog";
import StoreCheckoutDialog from "@/components/webinar/StoreCheckoutDialog";
import {
  generateInvoice,
  type InvoiceReferrerInfo,
  type Sellable,
} from "@/lib/feed-api";
import type { DisplayCurrency } from "@/lib/webinar/currency";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { createPortal } from "react-dom";
import { Share2, Check, X, MessageSquare, UserPlus } from "lucide-react";
import { usePictureInPicture } from "@/hooks/livekit/usePictureInPicture";
import WebinarPipContent from "@/components/webinar/WebinarPipContent";
import WebinarPreJoin from "@/components/webinar/WebinarPreJoin";
import ShopPanel from "@/components/webinar/ShopPanel";
import BidsPanel from "@/components/webinar/BidsPanel";
import LiveAuctionCard from "@/components/webinar/LiveAuctionCard";
import { useLiveLot } from "@/hooks/webinar/useLiveLot";
import {
  cancelAuction,
  startAuctionRound,
  type AuctionRoundConfig,
} from "@/lib/api/auctions";
import { isSettled } from "@/lib/api/auctionLot";
import {
  announceLotChange as announceLot,
  dispatchLocalPing,
} from "@/lib/webinar/bid-channel";
import { useAuthStore } from "@/store/authStore";

const BASE_TABS = ["Chat", "People", "Shop"] as const;
/** "Bids" only exists while a lot is on the block — see `tabs` below. */
type Tab = (typeof BASE_TABS)[number] | "Bids";

// ── Mobile → app/store redirect ──────────────────────────────────────────────
// Webinar links on mobile always go to the Garage HQ app (or its store page if
// not installed) — the web room is desktop-only. The app deep-links back to
// this same path via Universal/App Links, preserving ?ref= etc.

function detectMobileOS(): "android" | "ios" | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS 13+ reports a desktop Mac UA but has touch.
  if (/macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return "ios";
  return null;
}

export default function WebinarRoomClient() {
  const { id: webinarId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlRole = (searchParams.get("role") || "attendee") as WebinarRole;
  const panelistToken = searchParams.get("pt") || null;
  const affiliateRef = searchParams.get("ref") || "";
  const isPublicViewer = searchParams.get("public") === "1";
  // Name-only host entry (the Bat246 "05" code). This flow MUST run pre-join
  // to mint its demo-host token — an old session can never stand in for it.
  const isDemoNoReg = searchParams.get("noreg") === "1";
  // Founder's per-session share links append ?sessionDate=YYYY-MM-DD so
  // returning buyers skip the picker and land directly on this session.
  // Pipeline: URL → prop → WebinarPreJoin's first runPrepareJoin call.
  const urlSessionDate = searchParams.get("sessionDate") || undefined;

  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRef = useRef(false);

  const [joined, setJoined] = useState(false);
  // Wall-clock elapsed since this client first joined the room. Reset
  // when the user leaves; survives short reconnects via the join flag.
  const joinedAtRef = useRef<number | null>(null);
  const [callElapsed, setCallElapsed] = useState(0);
  useEffect(() => {
    if (!joined) {
      joinedAtRef.current = null;
      setCallElapsed(0);
      return;
    }
    if (joinedAtRef.current === null) joinedAtRef.current = Date.now();
    const tick = () => {
      const start = joinedAtRef.current ?? Date.now();
      setCallElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [joined]);
  const [activeTab, setActiveTab_] = useState<Tab>("Chat");
  const setActiveTab = (tab: Tab) => {
    setActiveTab_(tab);
    useWebinarStore.getState().setChatTabActive(tab === "Chat");
  };
  const [mediaStarted, setMediaStarted] = useState(false);
  const [joinError, setJoinError] = useState("");
  // Another device of this account holds the seat (or took it from this
  // tab). Set from the ALREADY_CONNECTED join answer and from
  // webinar:replacedByDevice; cleared by a successful join.
  const [deviceChoice, setDeviceChoice] = useState<{
    label: string;
    youMoved: boolean;
    replaced: boolean;
  } | null>(null);
  // "Use this browser" — a join with takeover, owned by the socket effect.
  const takeoverJoinRef = useRef<(() => void) | null>(null);
  // Recording mode chosen at workshop creation ("manual" or "automatic").
  // Received from webinar:joinRoom response. If automatic, we silently
  // trigger startRecording once host media is live. Manual = wait for click.
  const [recordingMode, setRecordingMode] = useState<"manual" | "automatic">("manual");
  const [autoRecordTriggered, setAutoRecordTriggered] = useState(false);
  const [socketStatus, setSocketStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });

  // Guest flow state
  const [needsPreJoin, setNeedsPreJoin] = useState(false);
  // Evergreen (pre-recorded, scheduled) playback. `null` = not yet known, so
  // the live path stays parked until we've answered the question — otherwise a
  // scheduled webinar would briefly join the SFU before switching.
  const [isEvergreen, setIsEvergreen] = useState<boolean | null>(null);

  // Scripted audience for the LIVE room. No-ops unless the host enabled one,
  // and only ever appends chat messages — the live path is otherwise untouched.
  // Held off until the evergreen probe has settled so it can't fire in a room
  // that is about to become an evergreen player instead.
  useSimulatedAudience(webinarId, isEvergreen === false);
  const [guestToken, setGuestToken] = useState<string | null>(null);

  // Garage Store: when a buyer's 24h window has never started we ask for
  // their phone and verify it — that save also stamps profileCompletedAt,
  // which is what starts the window. The pending token is held here so the
  // purchase resumes afterwards; the same link re-quotes live, so by then
  // it prices the free first cycle.
  const [profileOpen, setProfileOpen] = useState(false);
  const pendingMagicLinkRef = useRef<string | null>(null);

  /**
   * Profile saved → the 24h window has just been stamped open. Re-read the
   * SAME magic link (it re-quotes live) and finish the purchase.
   */
  // A different product on screen means the previous purchase state is
  // stale ("Waiting for payment" for something no longer pinned reads as a
  // bug). Reset whenever the pinned item changes.
  const pinnedProductId = useWebinarStore((s) => s.pinnedProduct?._id);
  useEffect(() => {
    setBuyState("idle");
    pendingMagicLinkRef.current = null;
  }, [pinnedProductId]);

  const resumePendingPurchase = useCallback(async () => {
    const token = pendingMagicLinkRef.current;
    pendingMagicLinkRef.current = null;
    setProfileOpen(false);
    if (!token) return;
    setBuyState("loading");
    try {
      const link = await readMagicLink(token);
      if (link.status === "purchased") {
        toast.success("You're already subscribed to this plan.");
        setBuyState("paid");
        return;
      }
      // The window is open now, so the page will quote the better price.
      window.open(
        magicLinkUrl(token),
        "_blank",
        "noopener,noreferrer",
      );
      setBuyState("opened");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't complete this purchase",
      );
      setBuyState("error");
    }
  }, []);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [myAffiliateId, setMyAffiliateId] = useState("");
  // Display name the buyer typed on the name-entry screen (or from the
  // JWT if it wasn't a placeholder). Piped into webinar:joinRoom so the
  // attendee tile shows what they actually typed instead of the JWT's
  // email-local-part fallback.
  const [myDisplayName, setMyDisplayName] = useState<string>("");

  // Product purchase state
  const [buyState, setBuyState] = useState<
    "idle" | "loading" | "opened" | "paid" | "error"
  >("idle");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutInvoiceId, setCheckoutInvoiceId] = useState<string | null>(null);
  const [checkoutReferrer, setCheckoutReferrer] =
    useState<InvoiceReferrerInfo | null>(null);
  // Garage Store storefront checkout (for physical store-product
  // pins) — separate from the invoice-based checkout above because
  // it talks to /storefront/:slug/cart/checkout, not Razorpay.
  const [storeCheckoutOpen, setStoreCheckoutOpen] = useState(false);
  // Buyer's chosen display currency for the active store-product
  // checkout. Captured from PinnedProductCard's per-card toggle so the
  // invoice we generate matches the unit the buyer was looking at.
  // Defaults to USD until the buyer picks otherwise; reset alongside
  // storeCheckoutOpen.
  const [storeCheckoutCurrency, setStoreCheckoutCurrency] =
    useState<DisplayCurrency>("USD");
  const [swapPickerOpen, setSwapPickerOpen] = useState(false);

  // Shop tab. `catalogOrgId` is whose catalog to list: the backend doesn't
  // echo the host's org on joinRoom today, so we take it from the response
  // if it ever appears and otherwise fall back to the viewer's own token —
  // correct for the host and same-org co-hosts.
  const [catalogOrgId, setCatalogOrgId] = useState<string | null>(null);
  // Bat246 "knock" — visitors currently waiting on this host to let them
  // in. See webinar:joinRequest / webinar:respondJoinRequest below and
  // WebinarPreJoin's "waiting-for-host" state on the other end.
  const [pendingJoinRequests, setPendingJoinRequests] = useState<
    { requestId: string; name: string }[]
  >([]);
  const [shopBusyItemId, setShopBusyItemId] = useState<string | null>(null);
  // A Shop pick routed to the storefront checkout, kept separate from the
  // pinned product so buying from the tab never disturbs what's pinned.
  const [shopStoreItem, setShopStoreItem] = useState<Sellable | null>(null);

  // LiveKit-backed transport. Shape matches the legacy useMediasoup hook so
  // the rest of the page (and the ControlBar) need no changes.
  // The ref lets the hook ask for a roster resync when LiveKit surfaces a
  // participant the socket roster doesn't know — the resync closure itself
  // is created inside the join effect below.
  const rosterResyncRef = useRef<(() => void) | null>(null);
  const mediasoup = useWebinarLiveKit(socketRef, webinarId, rosterResyncRef);

  // ── Live auction ────────────────────────────────────────────────────
  // A pinned storefront item may have a lot running on it. Only store
  // products can: they're the only pin type the Garage Store backend knows
  // about, and the lot read resolves null for anything with no `auction`
  // subdoc — so a plain Buy Now pin never produces one and the card below
  // falls through to PinnedProductCard.
  const pinnedProduct = useWebinarStore((s) => s.pinnedProduct);
  const myRole = useWebinarStore((s) => s.role);
  const auctionProductId =
    pinnedProduct?.itemType === "store-product" ? pinnedProduct._id : null;

  // Auth is read after mount, never during render: this page renders on the
  // server too and localStorage isn't there yet, so an inline read would
  // hydrate mismatched.
  const [authed, setAuthed] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    setAuthed(!!getToken());
    setMeId(getUserDataFromToken().userId);
  }, []);

  /**
   * "This lot changed — re-read it." Sent after a bid, after a round opens and
   * after a cancel, over every transport at once: the LiveKit data channel
   * (fastest), the room socket (survives a media reconnect and reaches viewers
   * whose data channel dropped), and a local window event, because neither
   * remote transport echoes back to the sender.
   */
  const announceLotChange = useCallback(
    (productId: string | null) => {
      announceLot({
        productId,
        room: mediasoup.getRoom(),
        socket: socketRef.current,
        webinarId,
      });
    },
    [mediasoup, webinarId]
  );

  const {
    auction,
    bids,
    bidding,
    win,
    wallet,
    bid: placeLotBid,
    shortfallUsd,
    clearShortfall,
    refresh: refreshLot,
  } = useLiveLot({
    productId: auctionProductId,
    authed,
    // Fan the bid out so every other viewer refetches now rather than on their
    // own 3s poll — this is what makes the price move for the room at once.
    onBidPlaced: announceLotChange,
  });

  const [cancellingAuction, setCancellingAuction] = useState(false);
  const handleCancelAuction = useCallback(async () => {
    if (!auctionProductId) return;
    setCancellingAuction(true);
    try {
      const { refundedCount } = await cancelAuction(auctionProductId);
      toast.success(
        refundedCount > 0
          ? `Auction cancelled — ${refundedCount} bid${refundedCount === 1 ? "" : "s"} refunded`
          : "Auction cancelled"
      );
      refreshLot();
      // Same ping a bid sends: the lot changed, everyone should re-read it.
      announceLotChange(auctionProductId);
    } catch (err) {
      toast.error((err as Error)?.message || "Couldn't cancel the auction");
    } finally {
      setCancellingAuction(false);
    }
  }, [auctionProductId, refreshLot, announceLotChange]);

  // The Bids tab exists only while a lot is on the block — an empty ledger
  // tab on a stream that never auctions anything is just noise.
  const tabs = useMemo<Tab[]>(
    () => (auction ? ["Chat", "Bids", "People", "Shop"] : [...BASE_TABS]),
    [auction]
  );

  // A lot being unpinned mid-view must not strand the sidebar on a tab that
  // no longer exists.
  useEffect(() => {
    if (!auction && activeTab === "Bids") setActiveTab("Chat");
  }, [auction, activeTab]);

  // A round opening is the loudest thing that can happen in the room, so the
  // sidebar goes to the ledger by itself — nobody hunts for a tab while a 60s
  // lot runs. Once per lot, keyed by product id: a viewer who deliberately
  // switches back to Chat mid-auction is not dragged to Bids on the next poll,
  // and the next lot still gets its own switch.
  const openLotId =
    auction && !isSettled(auction.status) ? auction.productId : null;
  const autoOpenedLotRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openLotId || autoOpenedLotRef.current === openLotId) return;
    autoOpenedLotRef.current = openLotId;
    setActiveTab_("Bids");
    useWebinarStore.getState().setChatTabActive(false);
  }, [openLotId]);

  // PiP support
  const localStream = useWebinarStore((s) => s.localStream);
  const fallbackTrack = localStream?.getVideoTracks()[0] || localStream?.getAudioTracks()[0] || null;
  const { pipWindow, openPip, isPipSupported, closePip } = usePictureInPicture(joined, fallbackTrack);

  // PiP is only opened manually via the minimize button or Media Session handler.
  // Auto-opening is not allowed by browsers (requires user gesture).

  // Mobile browsers never get the web room: try to open the app (which is
  // registered for this exact URL), and fall back to the app store.
  /** Bat246: its white-label funnel must not bounce mobile users to the app. */
  const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
  /**
   * Resolved from the hostname, NOT from the white-label React context: this
   * route sits under the root layout, which mounts no provider, and that hook
   * throws when none is present — it 500'd the whole webinar page.
   *
   * undefined = lookup still in flight.
   */
  const [wlOrgId, setWlOrgId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    if (
      host === "my.garage.app" ||
      host.endsWith(".garage.app") ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      setWlOrgId(null);
      return;
    }
    let cancelled = false;
    fetchWhitelabelOrg(host)
      .then((org) => !cancelled && setWlOrgId(org?.orgId ?? null))
      .catch(() => !cancelled && setWlOrgId(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const isGotobigwin =
    catalogOrgId === BAT246_ORG_ID ||
    wlOrgId === BAT246_ORG_ID ||
    (typeof window !== "undefined" &&
      /(^|\.)gotobigwin\.com$/i.test(window.location.hostname));

  /**
   * Bat246/gotobigwin only: ask which mic, when there is a choice to make.
   *
   * Their hosts present with a headset, an audio interface and the built-in
   * mic all plugged in, and the browser's default is often the wrong one —
   * they were going live on the laptop mic. Gated on `mediaStarted` rather
   * than `joined` for two reasons: a mic prompt is meaningless to an
   * attendee who never publishes, and device LABELS are empty strings until
   * mic permission has been granted, so asking earlier would list
   * "Microphone 1 / 2 / 3".
   *
   * Once per room session. The ref (not state) is what stops a re-render or
   * a socket-blip rejoin from re-opening it; the host auto-start path is
   * already guarded by `freshMedia` for the same reason.
   */
  const micPromptShownRef = useRef(false);
  const [micPickerOpen, setMicPickerOpen] = useState(false);
  const listMediaDevices = mediasoup.listMediaDevices;

  useEffect(() => {
    if (!isGotobigwin || !mediaStarted || micPromptShownRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { audioinput } = await listMediaDevices();
        // Only worth asking when there is more than one real mic —
        // realAudioInputs drops Chrome-on-Windows' "default"/"communications"
        // aliases, which would otherwise make one mic look like three.
        if (cancelled || realAudioInputs(audioinput).length < 2) return;
        micPromptShownRef.current = true;
        setMicPickerOpen(true);
      } catch {
        // Enumeration blocked — leave the browser default alone.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGotobigwin, mediaStarted, listMediaDevices]);

  /**
   * Bat246 (gotobigwin) keeps only the last hour of chat.
   *
   * The server already trims what it hands a joiner, but someone who simply
   * stays in the room never re-reads that history — without this their panel
   * would keep growing all session. Ticks once a minute and drops anything
   * older than an hour, so the two ends agree on what's visible.
   */
  useEffect(() => {
    if (!isGotobigwin) return;
    const CHAT_TTL_MS = 60 * 60 * 1000;
    const prune = () => {
      const cutoff = Date.now() - CHAT_TTL_MS;
      const store = useWebinarStore.getState();
      const kept = store.messages.filter(
        (m) => new Date(m.timestamp).getTime() >= cutoff,
      );
      if (kept.length !== store.messages.length) store.setMessages(kept);
    };
    prune();
    const id = setInterval(prune, 60_000);
    return () => clearInterval(id);
  }, [isGotobigwin]);

  const [mobileOS, setMobileOS] = useState<"android" | "ios" | null>(null);
  useEffect(() => {
    const os = detectMobileOS();
    if (!os) return;
    /**
     * Bat246 stays in the browser on mobile.
     *
     * Its funnel sends people straight from a white-label domain into a
     * webinar; bouncing them to "install the Garage HQ app" breaks that
     * journey and shows them Garage's brand, which is the opposite of what a
     * white-label domain is for.
     *
     * Keyed off the white-label org, so this only applies to visitors
     * arriving on Bat246's own domain — my.garage.app is unaffected, as is
     * every other office.
     */
    // Checked via isGotobigwin FIRST — a synchronous hostname match, so a
    // slow or failed white-label lookup (fetchWhitelabelOrg throwing sets
    // wlOrgId to null, not BAT246_ORG_ID) can never cause a false
    // "this isn't Bat246" redirect on gotobigwin.com. Only falls back to
    // waiting on the async wlOrgId lookup for a path that doesn't match
    // the hostname pattern but might still resolve to the Bat246 org.
    if (isGotobigwin) return;
    // Same race as the app gate: until the white-label lookup resolves we do
    // not know the office, and redirecting first would defeat the exemption.
    if (wlOrgId === undefined) return; // office not known yet
    if (wlOrgId === BAT246_ORG_ID) return;
    setMobileOS(os);
    const path = `webinar/${webinarId}${window.location.search}`;
    if (os === "android") {
      // Chrome intent URL: opens the app if installed. Deliberately NO
      // S.browser_fallback_url here — this navigation fires without a user
      // gesture, and a fallback made Chrome auto-redirect people to the
      // Play Store. The interstitial below has an explicit store button
      // instead. (The manual "Open the app" button keeps its fallback:
      // that one is user-initiated, and Chrome only follows it when the
      // package genuinely isn't installed.)
      window.location.href =
        `intent://${path}#Intent;scheme=garagehq;package=com.garageapp.hq;end`;
      return;
    }
    // iOS: try the custom scheme. NO timed App Store fallback — the old
    // 2s visibilityState check couldn't tell "app not installed" apart
    // from "user hasn't answered the Open-in-app popup yet", so anyone
    // who hesitated on the popup got yanked to the App Store even with
    // the app installed. If the scheme no-ops the interstitial stays on
    // screen with its explicit store button.
    window.location.href = `garagehq://${path}`;
    // whitelabel deps matter: the first run happens before the office is
    // known, so without them the early-return above would skip the redirect
    // permanently on every white-label domain, not just the exempt one.
  }, [webinarId, wlOrgId, isGotobigwin]);

  // Is this a scheduled (evergreen) webinar? Asked once, up front: a `false`
  // (the overwhelmingly common case) leaves every existing code path below
  // exactly as it was, and a `true` short-circuits the room entirely.
  useEffect(() => {
    if (!webinarId) return;
    let cancelled = false;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/public/webinar/${webinarId}/evergreen-state`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setIsEvergreen(!!d?.enabled);
      })
      // On failure, fall back to the LIVE path — never strand a real webinar
      // behind a player it doesn't have a video for.
      .catch(() => {
        if (!cancelled) setIsEvergreen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [webinarId]);

  // Auth + role gate: only trusted roles skip the pre-join screen.
  //   - Host (owner going live) — server verifies via workshop.createdBy.
  //   - Panelist with a valid ?pt=<token> — server verifies.
  //   - Public viewer (?public=1) — gets an anonymous token silently.
  // Everyone else — including logged-in attendees — goes through
  // WebinarPreJoin so the paywall / not-yet-started / session-choice /
  // wrong-session gates all run. WebinarPreJoin itself skips email+OTP
  // when a JWT is already present, so logged-in users don't re-verify.
  useEffect(() => {
    // Bat246/gotobigwin never redirects to the app (see the mobileOS
    // effect below) — bailing here anyway on raw OS detection left it
    // with no app redirect AND no pre-join/join, stuck forever. Only
    // skip when a redirect is actually about to happen.
    if (detectMobileOS() && !isGotobigwin) return; // redirecting to the app — don't start the room
    // isAuthenticated() — not a bare getToken() — because getToken() returns
    // whatever string is in localStorage, expired or not. An expired token
    // used to pass as a "trusted host": it skipped pre-join, left guestToken
    // null, and was then handed to the socket, which rejected it with
    // "Invalid token". ?noreg=1 always goes through pre-join too, since its
    // whole purpose is to mint a fresh demo-host token.
    const isTrustedRole = urlRole === "host" || !!panelistToken;
    if (isAuthenticated() && isTrustedRole && !isDemoNoReg) {
      setInitialCheckDone(true);
      return;
    }
    if (isPublicViewer) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/public/webinar/join-anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webinarId }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.success && d.token) setGuestToken(d.token); })
        .catch(() => {})
        .finally(() => setInitialCheckDone(true));
    } else {
      // Attendees — logged in or not — all go through pre-join.
      setNeedsPreJoin(true);
      setInitialCheckDone(true);
    }
  }, [webinarId, isPublicViewer, urlRole, panelistToken, isDemoNoReg, isGotobigwin]);

  // Auto-start recording when the workshop was created with
  // recordingMode=automatic AND host media is live. Runs once per session.
  // Works for both code paths that can start media: handleStartMedia and the
  // host auto-start inside the joinRoom callback.
  useEffect(() => {
    if (!mediaStarted) return;
    if (recordingMode !== "automatic") return;
    if (autoRecordTriggered) return;
    const role = useWebinarStore.getState().role;
    if (role !== "host") return;

    setAutoRecordTriggered(true);
    socketRef.current?.emit(
      "webinar:startRecording",
      { webinarId },
      (res: { success: boolean; error?: string }) => {
        if (res?.success) {
          useWebinarStore.getState().setIsRecording(true);
          toast.success("Recording started automatically");
        } else {
          toast.error("Auto-record failed: " + (res?.error || ""));
        }
      }
    );
  }, [mediaStarted, recordingMode, autoRecordTriggered, webinarId]);

  // Safety net for any end path the socket never announces (an older
  // server's REST stop, a lost event): while seated, ask the public validate
  // endpoint every 30s, and leave when it says the webinar is no longer live.
  useEffect(() => {
    if (!joined || !webinarId) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`${base}/public/webinar/validate?id=${webinarId}`);
        const data = await res.json();
        if (data?.success && data.webinar && data.webinar.isLive === false) {
          toast.info("This webinar has ended");
          doCleanup();
          router.push("/");
        }
      } catch {
        /* could not tell — never end on a network error */
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [joined, webinarId]); // eslint-disable-line

  // Host closes or reloads the tab while live: warn first (the browser's own
  // "Leave site?" dialog — beforeunload cannot show custom UI), and if they
  // leave anyway, end the webinar for everyone on the way out. Without this
  // the stream stays Active on the backend with nobody broadcasting, and
  // attendees sit in a dead room. pagehide rather than unload: it also covers
  // tab/window close and is the last moment a websocket frame still flushes.
  // Gated on the store's role at event time, not urlRole: only the actual
  // host arms it, and once webinar:webinarEnded → resetRoom() drops role back
  // to "attendee", an already-ended room no longer blocks navigation.
  useEffect(() => {
    if (!joined) return;
    const hostIsLive = () => useWebinarStore.getState().role === "host";
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hostIsLive()) return;
      e.preventDefault();
      e.returnValue = ""; // Chrome only shows the dialog with returnValue set
    };
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted || !hostIsLive()) return;
      socketRef.current?.emit("webinar:endWebinar", { webinarId });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [joined, webinarId]);

  // ── Single useEffect: connect socket, register ALL listeners, join room ───
  useEffect(() => {
    // See the pre-join gate above — same Bat246/gotobigwin exemption.
    if (detectMobileOS() && !isGotobigwin) return; // redirecting to the app — don't join
    // Evergreen sessions play a file; they must never open a media transport.
    // Also waits out the `null` (unknown) state so we can't join and then bail.
    if (isEvergreen !== false) return;
    if (!webinarId || hasJoinedRef.current || !initialCheckDone) return;
    // Must have either a LIVE user session or a guest token. An expired
    // localStorage token is not a session — proceeding on one is what sent a
    // dead token to the socket.
    if (!isAuthenticated() && !guestToken) return;
    // CRITICAL: don't try to join the room while the pre-join flow is
    // still running (paywall, session-choice, not-yet-started, etc.).
    // Firing webinar:joinRoom before the buyer has completed payment
    // makes the socket gate reject with "You aren't enrolled" and burns
    // through the retry budget. Then, when payment eventually succeeds
    // and setNeedsPreJoin(false) fires, the stale joinError surfaces
    // as the "Failed to join" screen. Only join once pre-join has
    // finished (i.e. onJoinReady set guestToken via handleJoinReady,
    // which also flips needsPreJoin to false).
    if (needsPreJoin) return;

    hasJoinedRef.current = true;

    const socket = connectWebinarSocket(guestToken || undefined);
    socketRef.current = socket;

    // Bat246/gotobigwin only: connectWebinarSocket retries forever
    // (reconnectionAttempts: Infinity) and connect_error never surfaced
    // anything to the user, so a handshake that never succeeds left
    // people stuck on "Joining webinar..." with no feedback and no way
    // out. Give up after a bounded wait (or several fast consecutive
    // failures) and show the existing "Failed to join" screen instead.
    let joinTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let connectErrorCount = 0;
    const failJoin = (message: string) => {
      if (joinTimeoutId) {
        clearTimeout(joinTimeoutId);
        joinTimeoutId = null;
      }
      if (!hasCompletedJoin) setJoinError(message);
    };
    if (isGotobigwin) {
      joinTimeoutId = setTimeout(
        () => failJoin("Having trouble connecting — check your internet connection and try reloading."),
        15000
      );
    }

    // Track whether initial join completed so reconnect can re-join
    let hasCompletedJoin = false;
    // Media torn down because another device took the seat; a successful
    // re-join must bring it up like a first join.
    let mediaDown = false;

    // Who this tab is, to the server: what separates "this tab reconnecting"
    // from "me, on a second device" (garagenew-backend webinarPresence). A
    // per-tab id, so two tabs count as two devices. `features` opts into the
    // ALREADY_CONNECTED answer and `webinar:replacedByDevice`; a client
    // without it is left to coexist, as before.
    const deviceId = getWebinarDeviceId();
    const deviceLabel = describeThisBrowser();
    const joinPayload = (takeover = false) => ({
      webinarId,
      role: urlRole,
      panelistToken,
      deviceType: detectLocalDeviceType(),
      deviceId,
      deviceLabel,
      features: ["deviceChoice"],
      // Pass the display name the buyer typed on name-entry so the
      // attendee tile doesn't fall back to the JWT's email-local-part
      // placeholder (new users whose OTP-created User.name was blank
      // otherwise show as "prefix-1504" or similar).
      ...(myDisplayName ? { displayName: myDisplayName } : {}),
      ...(takeover ? { takeover: true } : {}),
    });

    // ── Join the room (called on first connect AND on every reconnect) ──
    // Post-payment race: the HTTP verify-payment route synchronously writes
    // the WorkshopRegistration row before returning success, but the socket
    // server's read can hit a stale Mongo replica for a beat. First attempt
    // sees "aren't enrolled"; the row is committed to primary within a
    // second. Retry up to 4× with 750ms spacing so the buyer never sees
    // Failed to join solely because their fulfillment write hadn't
    // replicated yet.
    const NOT_ENROLLED_MSG = "You aren't enrolled for this session";
    let notEnrolledAttempts = 0;
    const MAX_NOT_ENROLLED_ATTEMPTS = 4;
    const doJoin = (takeover = false) => {
      console.log("[WebinarPage] Joining webinar:", webinarId, "role:", urlRole, "socketId:", socket.id, takeover ? "(takeover)" : "");
      socket.emit(
        "webinar:joinRoom",
        joinPayload(takeover),
        async (response: any) => {
          console.log("[WebinarPage] joinRoom callback received:", response?.success, response?.role);
          const isRejoin = hasCompletedJoin;
          if (response?.code === "ALREADY_CONNECTED") {
            // Another device of this account holds the seat. No seat was
            // given, so nothing here goes on to connect media and evict the
            // other one — the choice is the user's (screen below).
            setDeviceChoice({
              label: response.activeDevice?.label || "another device",
              youMoved: !!response.youMoved,
              replaced: false,
            });
            return;
          }
          if (response?.code === "ENDED") {
            // The session is over; this re-join found no room to come back to.
            toast.info("This webinar has ended");
            doCleanup();
            router.push("/");
            return;
          }
          if (!response?.success) {
            const err = response?.error || "Failed to join room";
            if (
              err === NOT_ENROLLED_MSG &&
              notEnrolledAttempts < MAX_NOT_ENROLLED_ATTEMPTS
            ) {
              notEnrolledAttempts += 1;
              console.log(
                `[WebinarPage] not-enrolled retry ${notEnrolledAttempts}/${MAX_NOT_ENROLLED_ATTEMPTS} in 750ms — likely fulfillment/read race`
              );
              window.setTimeout(doJoin, 750);
              return;
            }
            setJoinError(err);
            return;
          }
          // Reset the retry counter on a successful join so any later
          // reconnect starts fresh.
          notEnrolledAttempts = 0;
          setDeviceChoice(null);
          // A takeover after our media was torn down is a first join as far
          // as media goes, whatever the socket has seen.
          const freshMedia = !isRejoin || mediaDown;
          mediaDown = false;

          const store = useWebinarStore.getState();
          store.setWebinarId(webinarId);
          store.setWebinarTitle(response.webinarTitle || "");
          store.setWebinarThumbnail(response.webinarThumbnail || "");
          setRecordingMode(response.recordingMode || "manual");
          // Host's org, when the server sends it — the Shop tab lists that
          // org's catalog. Falls back to the viewer's own token below.
          setCatalogOrgId(
            response.hostOrgId || response.orgId || getUserDataFromToken().orgId || null
          );
          store.setRole(response.role || urlRole);
          store.setMessages(response.chatHistory || []);
          // Echo the caller's avatar (looked up server-side from User.profilePicture)
          // so the self-tile in the grid can render it when the camera is off.
          store.setLocalAvatar(response.myAvatar || "");
          // Rehydrate pinned product for late joiners
          store.setPinnedProduct(response.pinnedProduct || null);
          // Merge the server's roster instead of rebuilding it — a rebuild
          // dropped every live stream reference on reconnect. Peers whose
          // socket the server lost but whose media is still up stay as
          // ghost rows until LiveKit settles them.
          {
            const lkRoom = mediasoup.getRoom();
            const liveIdentities = lkRoom
              ? Array.from(lkRoom.remoteParticipants.values()).map(
                  (p) => p.identity
                )
              : [];
            store.syncPeers(response.peers || [], liveIdentities);
          }

          try {
            // Connect to the LiveKit room. Subscriptions to existing remote
            // tracks happen automatically once the room joins, so there's no
            // separate getProducers/consume step like the old mediasoup path.
            await mediasoup.initDevice({
              role: response.role || urlRole,
              panelistToken: panelistToken,
              guestToken,
            });
            console.log("[WebinarPage] LiveKit room connected");

            setJoined(true);
            hasCompletedJoin = true;
            if (joinTimeoutId) {
              clearTimeout(joinTimeoutId);
              joinTimeoutId = null;
            }
            connectErrorCount = 0;

            // Auto-start media for host/panelist — first join only. On a
            // re-join the LiveKit room survived the socket blip (or the
            // hook's rejoin path republishes what was on), and forcing
            // startMedia here would switch a deliberately muted host's
            // camera and mic back on.
            if (
              freshMedia &&
              (response.role === "host" || response.role === "panelist")
            ) {
              try {
                await mediasoup.startMedia();
                setMediaStarted(true);
              } catch (err: any) {
                console.warn("Auto media start failed:", err.message);
              }
            }
          } catch (err: any) {
            console.error("LiveKit init error:", err);
            setJoinError("Failed to initialize video: " + err.message);
          }
        }
      );
    };
    // "Use this browser" / "Take over here" on the device screen.
    takeoverJoinRef.current = () => doJoin(true);

    // ── Roster resync (ported from the mobile room's resyncRoom) ──
    // Re-runs the join handshake for its ack snapshot only: the server keeps
    // this socket's media plumbing when the same socket re-joins, and
    // syncPeers merges rather than rebuilds, so nothing on screen blinks.
    // Throttled — the LiveKit unknown-participant trigger can burst when
    // several people arrive at once.
    let lastResyncAt = 0;
    const resyncRoster = () => {
      if (!socket.connected || !hasCompletedJoin) return;
      const now = Date.now();
      if (now - lastResyncAt < 4000) return;
      lastResyncAt = now;
      socket.emit(
        "webinar:joinRoom",
        joinPayload(),
        (response: any) => {
          if (response?.code === "ALREADY_CONNECTED") {
            // Our seat went to another device while this tab was away.
            setDeviceChoice({
              label: response.activeDevice?.label || "another device",
              youMoved: !!response.youMoved,
              replaced: false,
            });
            return;
          }
          if (!response?.success) return;
          const store = useWebinarStore.getState();
          const lkRoom = mediasoup.getRoom();
          const liveIdentities = lkRoom
            ? Array.from(lkRoom.remoteParticipants.values()).map(
                (p) => p.identity
              )
            : [];
          store.syncPeers(response.peers || [], liveIdentities);
          // The ack's role is grant-aware — it catches a promotion or
          // demotion whose socket event we missed while disconnected.
          if (response.role) store.setRole(response.role);
          store.setPinnedProduct(response.pinnedProduct || null);
          mediasoup.refreshConsumers();
        }
      );
    };
    rosterResyncRef.current = resyncRoster;

    // Coming back to a hidden tab is the moment a stale roster shows: the
    // socket may have silently died (resume it) or merely missed events
    // (re-pull the snapshot).
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) socket.connect();
      else resyncRoster();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Connection events
    socket.on("connect", () => {
      setSocketStatus("connected");
      // On reconnect (not first connect), re-join the room. The LiveKit
      // room rides a separate connection — it usually survives a socket
      // blip, so it is NOT torn down here; initDevice inside doJoin
      // reuses it when it's still connected and rebuilds it when not.
      if (hasCompletedJoin) {
        console.log("[WebinarPage] Socket reconnected, re-joining room...");
        doJoin();
      }
    });
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("connect_error", (err: Error) => {
      console.error("[WebinarPage] Socket error:", err.message);
      setSocketStatus("disconnected");
      // Bat246 only, and only while we've never actually gotten in —
      // once joined, a later blip is just a normal reconnect. Several
      // fast consecutive failures fail out sooner than the 15s backstop
      // above would on its own.
      if (isGotobigwin && !hasCompletedJoin) {
        connectErrorCount += 1;
        if (connectErrorCount >= 3) {
          failJoin("Having trouble connecting — check your internet connection and try reloading.");
        }
      }
    });

    // ── Room events (register BEFORE joining) ──
    socket.on("webinar:newMessage", (msg: any) => {
      useWebinarStore.getState().addMessage(msg);

      // Tagged in chat. The sender resolved "@Name" to a userId and the
      // server checked it against the room, so this is only ever "is one of
      // them me" — no name matching, which would break the moment someone
      // renamed themselves or two people shared a display name.
      const myId = getUserDataFromToken().userId;
      if (
        !myId ||
        msg.userId === myId ||
        !Array.isArray(msg.mentions) ||
        !msg.mentions.includes(myId)
      ) {
        return;
      }

      try {
        const audio = new Audio("/notification.mp3");
        audio.volume = 0.5;
        // Autoplay stays blocked until the page has been interacted with.
        // The toast still lands, so a silent failure is the right outcome.
        audio.play().catch(() => { });
      } catch { }

      toast.info(`${msg.name || "Someone"} mentioned you`, {
        description: String(msg.text || "").slice(0, 140),
        action: { label: "View", onClick: () => setActiveTab("Chat") },
      });
    });
    // Server broadcasts the message's FULL reactions map on every toggle,
    // so applying it verbatim keeps everyone converged even after a miss.
    socket.on(
      "webinar:messageReaction",
      ({ messageId, reactions }: { messageId: string; reactions: Record<string, string[]> }) =>
        useWebinarStore.getState().setMessageReactions(messageId, reactions || {})
    );
    socket.on("webinar:recordingStarted", () => { useWebinarStore.getState().setIsRecording(true); toast.info("Recording started"); });
    socket.on("webinar:recordingStopped", () => {
      useWebinarStore.getState().setIsRecording(false);
      const role = useWebinarStore.getState().role;
      if (role === "host") {
        // Server is finalising the LiveKit egress; we'll get a
        // recordingReady event with the download URL when it lands in S3.
        toast.info("Recording stopped — preparing your download…", {
          duration: 8000,
        });
      } else {
        toast.info("Recording stopped");
      }
    });

    // Server pushes this once the LiveKit Composite Egress has uploaded the
    // grid MP4 to S3. Trigger a one-shot browser download for the host.
    socket.on(
      "webinar:recordingReady",
      ({
        hostUserId,
        downloadUrl,
        filename,
        size,
        duration,
      }: {
        hostUserId: string;
        downloadUrl: string;
        filename: string;
        size: number;
        duration: number;
      }) => {
        const me = getUserDataFromToken();
        if (me?.userId !== hostUserId) return; // host-only download
        if (!downloadUrl) return;
        try {
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = filename || "webinar-recording.mp4";
          a.target = "_blank";
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
          const mb = (size / 1024 / 1024).toFixed(1);
          toast.success(
            `Recording ready (${mb} MB${duration ? `, ${Math.round(duration)}s` : ""}) — downloading`
          );
        } catch (err) {
          toast.error("Could not auto-download recording — open it from Workshop Analytics");
        }
      }
    );

    // The user chose another device; this tab's seat went with it. Drop the
    // media now, quietly — LiveKit is about to evict this identity when the
    // other device connects, and cleanup() is what keeps the hook from
    // reading that as a failure and rejoining. The "moved" screen offers to
    // take the seat back.
    socket.on("webinar:replacedByDevice", ({ label }: { label?: string }) => {
      mediaDown = true;
      setDeviceChoice({ label: label || "another device", youMoved: true, replaced: true });
      setJoined(false);
      setMediaStarted(false);
      mediasoup.cleanup().catch(() => {});
    });

    socket.on("webinar:peerJoined", (peer: any) => {
      // Deliberately silent. Arrivals and departures used to raise a toast
      // each; in a stream of any size that is a constant drip of popups over
      // the video, and the event repeats whenever someone re-runs the join
      // handshake on the same socket (the mobile app does that on every
      // return from its picture-in-picture player), so the same person
      // announced themselves repeatedly without ever having left.
      //
      // The People tab is the honest place for presence — it carries the
      // live roster and the count.
      useWebinarStore.getState().addPeer(peer);
    });
    socket.on("webinar:peerLeft", ({ socketId, reason }: any) => {
      const store = useWebinarStore.getState();
      const leaving = store.peers.find((p) => p.socketId === socketId);
      if (!leaving) return;
      // The server now says WHY (garagenew-backend webinarPresence). A seat
      // carried to a new socket, or handed to another of the same person's
      // devices, is followed by that socket's peerJoined: keep the row as a
      // ghost for it to migrate onto. A leave or a kick is final.
      if (reason === "reconnected" || reason === "replaced") {
        store.markPeerSocketStale(socketId);
        return;
      }
      if (reason === "left" || reason === "removed") {
        store.removePeer(socketId);
        return;
      }
      // A grace-window expiry, or an older server with no reason: socket
      // death is still not presence death — the media may be flowing from a
      // phone in PiP. Only trust it as "left" when LiveKit agrees; otherwise
      // keep the row as a ghost until ParticipantDisconnected settles it.
      const lkRoom = mediasoup.getRoom();
      const mediaAlive =
        !!leaving.userId &&
        !!lkRoom &&
        !!lkRoom.getParticipantByIdentity(leaving.userId);
      if (mediaAlive) {
        store.markPeerSocketStale(socketId);
        return;
      }
      // Silent, for the same reason as peerJoined above.
      store.removePeer(socketId);
    });
    socket.on("webinar:peerRoleChanged", ({ socketId, role }: any) => useWebinarStore.getState().updatePeerRole(socketId, role));
    socket.on("webinar:peerMicState", ({ socketId, muted }: any) => useWebinarStore.getState().updatePeerMuted(socketId, muted));
    socket.on("webinar:peerCameraState", ({ socketId, enabled }: any) => useWebinarStore.getState().updatePeerCamera(socketId, enabled));
    // Bat246 "knock" — a visitor is asking to be let in. The backend only
    // ever emits this to a socket it has verified holds the host seat, and
    // only for Bat246 webinars — nothing to gate here beyond dedupe.
    socket.on(
      "webinar:joinRequest",
      ({ requestId, name }: { requestId: string; name: string }) => {
        setPendingJoinRequests((prev) =>
          prev.some((r) => r.requestId === requestId)
            ? prev
            : [...prev, { requestId, name: name || "Guest" }]
        );
      }
    );
    socket.on("webinar:handRaised", ({ socketId, raised }: any) => {
      useWebinarStore.getState().updateHandRaised(socketId, raised);
    });

    // Note: with LiveKit the mediasoup-only events `webinar:newProducer`,
    // `webinar:consumerClosed`, and `webinar:screenShareStopped` are no longer
    // needed — the LiveKit Room fires its own TrackSubscribed/Unsubscribed
    // events which the useWebinarLiveKit hook wires straight into the store.

    socket.on("webinar:forceMuted", () => {
      mediasoup.forceMute();
      toast.warning("The host muted your microphone");
    });

    socket.on("webinar:reaction", ({ socketId, name, emoji }: any) => {
      // The server broadcasts with io.to(room), so our own reaction comes
      // straight back to us. ControlBar already spawned it locally (as
      // "You"), so ignore the echo rather than rendering it twice.
      if (socketId && socketId === socket.id) return;
      useWebinarStore.getState().addReaction({ name, emoji, id: Date.now() + Math.random() });
    });

    socket.on("webinar:removedFromRoom", () => {
      toast.error("You were removed from the webinar");
      setTimeout(() => { doCleanup(); router.push("/"); }, 1500);
    });

    socket.on("webinar:roleChanged", async ({ role: newRole, self }: any) => {
      useWebinarStore.getState().setRole(newRole);
      if (newRole === "panelist") {
        toast.success("You are now a Co-Host!");
        try { await mediasoup.startMedia(); setMediaStarted(true); } catch {}
      } else if (newRole === "attendee") {
        mediasoup.stopScreenShare();
        mediasoup.cleanupSendOnly(); // close producers + send transport only
        // recv transport and consumers stay alive — attendee still watches streams
        setMediaStarted(false);
        // Stop local camera/mic tracks so the indicator lights go off
        const ls = useWebinarStore.getState().localStream;
        ls?.getTracks().forEach((t) => t.stop());
        useWebinarStore.getState().setLocalStream(null);
        useWebinarStore.getState().setMicEnabled(false);
        useWebinarStore.getState().setCamEnabled(false);
        // Re-consume any producers we may have dropped during the role swap
        mediasoup.refreshConsumers();
        // Someone else demoting you is news; standing down yourself is not,
        // and "you have been moved" would read as if it were done to you.
        if (self) toast.info("You're no longer a Co-Host.");
        else toast.warning("You have been moved back to attendee.");
      }
    });

    socket.on("webinar:webinarEnded", () => {
      toast.info("The webinar has ended");
      // Navigate immediately. If a recording upload is in flight, the XHR
      // is not tied to this component's lifecycle — it keeps running on
      // the next page, and a success/failure toast will fire from there.
      if (useWebinarStore.getState().isUploadingRecording) {
        toast.info("Recording is uploading in the background — stay signed in to get the download link.");
      }
      setTimeout(() => { doCleanup(); router.push("/"); }, 800);
    });

    socket.on("webinar:newQA", (q: any) => useWebinarStore.getState().addQuestion(q));
    socket.on("webinar:qaUpdated", (q: any) => useWebinarStore.getState().updateQuestion(q));
    socket.on("webinar:newPoll", (p: any) => useWebinarStore.getState().addPoll(p));
    socket.on("webinar:pollUpdated", (p: any) => useWebinarStore.getState().updatePoll(p));

    // ── Product selling events ───────────────────────────────────────────
    socket.on("webinar:productPinned", ({ product }: any) => {
      useWebinarStore.getState().setPinnedProduct(product);
    });
    socket.on("webinar:productUnpinned", () => {
      useWebinarStore.getState().setPinnedProduct(null);
    });
    socket.on(
      "webinar:productPurchased",
      ({ buyerName, productName }: { buyerName?: string; productName?: string }) => {
        if (buyerName && productName) {
          toast.success(`${buyerName} just bought ${productName}`, {
            icon: "🎉",
          });
        }
      }
    );
    // The socket leg of the auction ping. Carries no state — like its LiveKit
    // twin it only says "lot X changed, re-read it" — and exists because the
    // data channel is dead for anyone whose media transport is reconnecting,
    // which on a 60s lot is the difference between bidding and watching.
    socket.on("webinar:auctionPing", ({ productId }: { productId?: string | null }) => {
      dispatchLocalPing(productId ?? null);
    });

    // ── Initial join ──
    if (socket.connected) {
      doJoin();
    } else {
      socket.once("connect", doJoin);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      rosterResyncRef.current = null;
      if (joinTimeoutId) clearTimeout(joinTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webinarId, urlRole, initialCheckDone, guestToken, needsPreJoin, isEvergreen, isGotobigwin]);

  // Cleanup on unmount
  useEffect(() => () => doCleanup(), []); // eslint-disable-line

  function doCleanup() {
    mediasoup.cleanup();
    disconnectWebinarSocket();
    useWebinarStore.getState().resetRoom();
    hasJoinedRef.current = false;
  }

  // Bat246 "knock" — host approves/denies a waiting visitor. Optimistic
  // removal from the local list: the backend is the source of truth for
  // who's actually let in (WebinarPreJoin only proceeds once it receives
  // the corresponding webinar:joinApproved/joinDenied event), so a failed
  // emit here just means the row silently reappears never — acceptable,
  // the host can react to the row disappearing and can't easily retell a
  // request that already errored server-side.
  const handleRespondJoinRequest = useCallback(
    (requestId: string, approve: boolean) => {
      setPendingJoinRequests((prev) =>
        prev.filter((r) => r.requestId !== requestId)
      );
      socketRef.current?.emit("webinar:respondJoinRequest", {
        requestId,
        approve,
      });
    },
    []
  );

  // "Keep the other device" / "Close" on the device screen: this tab bows out.
  const handleDeviceBowOut = () => {
    socketRef.current?.emit("webinar:leaveRoom", { webinarId });
    doCleanup();
    router.push("/");
  };

  const handlePipLeave = () => {
    closePip();
    socketRef.current?.emit("webinar:leaveRoom", { webinarId });
    doCleanup();
    router.push("/");
  };

  const handleStartMedia = async () => {
    try {
      await mediasoup.startMedia();
      setMediaStarted(true);
      toast.success("Camera & mic enabled");
      // The auto-record useEffect above watches mediaStarted + recordingMode
      // and triggers startRecording itself — no need to duplicate here.
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.error("Camera/mic permission denied.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error("Could not access camera/mic: " + msg);
      }
    }
  };

  const handleJoinReady = useCallback((token: string, displayName: string, userAffiliateId: string) => {
    setGuestToken(token);
    setMyAffiliateId(userAffiliateId);
    if (displayName?.trim()) setMyDisplayName(displayName.trim());
    setNeedsPreJoin(false);
  }, []);

  const handleBuy = useCallback(async (displayCurrency: DisplayCurrency | null) => {
    const pinnedProduct = useWebinarStore.getState().pinnedProduct;
    if (!pinnedProduct) return;
    if (!getToken()) return; // card handles the "Sign in to buy" redirect

    // Physical storefront items skip the invoice flow entirely —
    // /api/invoices/generate doesn't accept itemType:store-product,
    // and Garage Store has its own /storefront/:slug/cart/checkout
    // API. Pop the in-overlay shipping form instead, forwarding the
    // buyer's chosen display currency so the invoice is generated in
    // the same unit they were looking at.
    if (
      pinnedProduct.itemType === "store-product" &&
      pinnedProduct.isPhysical &&
      pinnedProduct.storeSlug
    ) {
      setStoreCheckoutCurrency(displayCurrency ?? "USD");
      setStoreCheckoutOpen(true);
      return;
    }
    // Digital store-products (or any with no slug) just open the
    // storefront page — payment + delivery happen there.
    if (pinnedProduct.itemType === "store-product" && pinnedProduct.productUrl) {
      window.open(pinnedProduct.productUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // Garage Store plans don't go through /api/invoices/generate — the
    // Unilevel Plus combo endpoints mint their own invoices, and WHICH
    // endpoint applies depends on this viewer's own state (they may
    // already own the licence, or have used the combo before). Resolve
    // that here rather than trusting anything on the pin.
    if (pinnedProduct.itemType === "garage-store") {
      setBuyState("loading");
      try {
        const offer = await resolveGarageStoreItem(
          pinnedProduct._id,
          getOrgId(),
        );
        // The pin's id carries the term ("<catalogId>:<termMonths>"); every
        // checkout endpoint wants the bare catalog id, so strip it here
        // rather than at four separate call sites.
        const { catalogId } = parseGarageStoreId(pinnedProduct._id);

        // Garage office plan (Starter / Pro). Subscribing needs an org,
        // so a viewer without one is sent through the create-an-office
        // flow with the plan pre-selected — that page creates the org
        // and then subscribes it.
        if (offer.kind === "office") {
          if (!offer.orgId) {
            window.open(
              `/organization?plan=${offer.plan.slug}`,
              "_blank",
              "noopener,noreferrer",
            );
            setBuyState("opened");
            return;
          }
          const r = await subscribeOffice(offer.orgId, offer.plan.slug);
          if (r?.requiresPayment && r.invoiceId) {
            window.open(
              `/invoice/${r.invoiceId}`,
              "_blank",
              "noopener,noreferrer",
            );
            setBuyState("opened");
          } else if (r?.success) {
            toast.success(`${offer.plan.name} activated!`);
            setBuyState("paid");
          } else {
            throw new Error("Couldn't start this subscription");
          }
          return;
        }

        if (offer.kind === "loading" || offer.kind === "unavailable") {
          toast.error(
            offer.kind === "unavailable"
              ? offer.reason
              : "Still loading this plan — try again in a moment.",
          );
          setBuyState("idle");
          return;
        }

        // ── Magic-link checkout ────────────────────────────────────────
        // Minting a link and reading it back is how we learn whether this
        // viewer is ALREADY subscribed to the partner: the server checks
        // for a live paid chain (`status: "purchased"`) — there's no other
        // endpoint that answers that. The link also re-quotes on every
        // read, which is what lets us open the buyer's 24h window first
        // and get the better price on the next read.
        const { userId: viewerId } = getUserDataFromToken();
        if (!viewerId) {
          // Guest-only webinar token (no underlying User). /magic-link is
          // auth-gated, so there's nothing we can mint for them yet.
          toast.error("Please sign in with your email to buy this plan.");
          setBuyState("idle");
          return;
        }

        const termMonths = resolveTermMonths(offer);
        const created = await createMagicLink({
          userId: viewerId,
          thirdPartyClientId: catalogId,
          termMonths,
          // Mail it too: the tab we open can be closed or blocked, and the
          // offer re-quotes live, so the emailed copy stays valid.
          sendEmail: true,
        });
        if (!created?.token) throw new Error("Couldn't prepare this offer");

        let link = await readMagicLink(created.token);

        if (link.status === "purchased") {
          toast.success("You're already subscribed to this plan.");
          setBuyState("paid");
          return;
        }
        if (link.status !== "active") {
          toast.error("This offer is no longer available.");
          setBuyState("idle");
          return;
        }

        // Window shut and no profile on file → they've never completed
        // onboarding, so the free first cycle was never started. Send them
        // through Complete Profile (which also verifies their phone); the
        // save stamps profileCompletedAt and opens the 24h window. We then
        // re-read the SAME link and it re-quotes at the better price.
        // A window with no START has never run: the buyer never completed
        // their profile, and that save is what stamps profileCompletedAt.
        // Collect it now, then resume — the link re-quotes on the next read.
        //
        // A window that started and then EXPIRED is a different case: the
        // offer is simply gone, profileCompletedAt is already set, and
        // re-opening the profile would stamp nothing and loop the buyer.
        // Those go straight to checkout at the normal price.
        if (link.offer && !link.offer.open && !link.offer.startsAt) {
          toast.message("Verify your phone to unlock the first month free");
          pendingMagicLinkRef.current = created.token;
          setProfileOpen(true);
          setBuyState("idle");
          return;
        }

        // Hand off to the magic-link page rather than minting the invoice
        // here: it re-quotes live, renders the offer, and runs checkout
        // itself — so the buyer sees what they're paying for instead of
        // landing straight on an invoice.
        window.open(created.url, "_blank", "noopener,noreferrer");
        setBuyState("opened");
        return;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't start this purchase",
        );
        setBuyState("error");
      }
      return;
    }

    const { orgId, email, name } = getUserDataFromToken();
    if (!orgId || !email) {
      toast.error("Missing account info — please re-login and try again.");
      return;
    }

    setBuyState("loading");
    try {
      const res = await generateInvoice({
        orgId,
        itemType: pinnedProduct.itemType as Exclude<
          typeof pinnedProduct.itemType,
          "store-product"
        >,
        itemId: pinnedProduct._id,
        quantity: 1,
        customer: { email, name: name || undefined },
      });
      if (!res?.invoiceId) {
        throw new Error("Invoice response missing id");
      }
      setCheckoutInvoiceId(res.invoiceId);
      setCheckoutReferrer(res.referrer || null);
      setCheckoutOpen(true);
      setBuyState("opened");
    } catch (err: any) {
      setBuyState("error");
      toast.error("Could not start purchase: " + (err?.message || "unknown"));
      setTimeout(() => setBuyState("idle"), 2500);
    }
  }, []);

  /**
   * Buy straight from the Shop tab. Routes down the same two checkout paths
   * the pinned-product overlay uses — the storefront cart for store products,
   * an invoice + Razorpay dialog for everything else — so nothing new had to
   * be built on the payment side.
   */
  const handleShopBuy = useCallback(async (item: Sellable) => {
    if (!getToken()) {
      toast.error("Sign in to buy.");
      return;
    }

    if (item.itemType === "store-product") {
      if (!item.storeSlug) {
        toast.error("This item has no storefront to check out through.");
        return;
      }
      setShopStoreItem(item);
      setStoreCheckoutCurrency("USD");
      setStoreCheckoutOpen(true);
      return;
    }

    const { orgId, email, name } = getUserDataFromToken();
    if (!orgId || !email) {
      toast.error("Missing account info — please re-login and try again.");
      return;
    }

    setShopBusyItemId(item.itemId);
    try {
      const res = await generateInvoice({
        orgId,
        itemType: item.itemType as Exclude<Sellable["itemType"], "store-product">,
        itemId: item.itemId,
        quantity: 1,
        customer: { email, name: name || undefined },
      });
      if (!res?.invoiceId) throw new Error("Invoice response missing id");
      setCheckoutInvoiceId(res.invoiceId);
      setCheckoutReferrer(res.referrer || null);
      setCheckoutOpen(true);
    } catch (err: any) {
      toast.error("Could not start purchase: " + (err?.message || "unknown"));
    } finally {
      setShopBusyItemId(null);
    }
  }, []);

  const handleCheckoutPaid = useCallback(() => {
    setBuyState("paid");
    if (checkoutInvoiceId) {
      socketRef.current?.emit("webinar:productPurchased", {
        webinarId,
        invoiceId: checkoutInvoiceId,
      });
    }
    setCheckoutInvoiceId(null);
    setCheckoutReferrer(null);
  }, [checkoutInvoiceId, webinarId]);

  const handleCheckoutDialogChange = useCallback((open: boolean) => {
    setCheckoutOpen(open);
    if (!open) {
      // Dialog was closed. If the user hadn't already paid, reset so they can retry.
      setBuyState((prev) => (prev === "paid" ? "paid" : "idle"));
      setCheckoutInvoiceId(null);
      setCheckoutReferrer(null);
    }
  }, []);

  const handleUnpinProduct = useCallback(() => {
    socketRef.current?.emit(
      "webinar:unpinProduct",
      { webinarId },
      (res: { success: boolean; error?: string }) => {
        if (!res?.success) {
          toast.error("Could not unpin: " + (res?.error || "unknown"));
        }
      }
    );
  }, [webinarId]);

  const handleProductExpired = useCallback(() => {
    const role = useWebinarStore.getState().role;
    // Only the host emits the unpin — avoids every client racing to send it.
    // Other clients clear locally via the server's broadcast (or via the
    // identical countdown they're running).
    if (role === "host") {
      socketRef.current?.emit("webinar:unpinProduct", { webinarId });
    } else {
      useWebinarStore.getState().setPinnedProduct(null);
    }
  }, [webinarId]);

  const handleSwapPick = useCallback(
    (item: Sellable, durationMinutes: number | null, round?: AuctionRoundConfig) => {
      socketRef.current?.emit(
        "webinar:pinProduct",
        {
          webinarId,
          itemType: item.itemType,
          itemId: item.itemId,
          durationMinutes,
        },
        async (res: { success: boolean; error?: string }) => {
          if (!res?.success) {
            toast.error("Could not pin item: " + (res?.error || "unknown"));
            return;
          }
          if (!round) return;
          // Only after the pin lands: the lot is read off whatever is pinned,
          // so a round opened first would be live against an item nobody in the
          // room is looking at yet.
          try {
            await startAuctionRound(item.itemId, round);
            announceLotChange(item.itemId);
            toast.success("Auction is live — bids are open");
          } catch (err) {
            // The pin stands; only the round failed. Say which.
            toast.error((err as Error)?.message || "Couldn't start the auction");
          }
        }
      );
    },
    [webinarId, announceLotChange]
  );

  const handleShareScreen = async () => {
    const { screenSharing } = useWebinarStore.getState();
    if (screenSharing) {
      mediasoup.stopScreenShare();
      toast.info("Screen sharing stopped");
    } else {
      try {
        await mediasoup.shareScreen();
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "NotAllowedError") {
          toast.error("Screen share failed: " + err.message);
        }
      }
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (mobileOS) {
    // Auto-redirect fired from the effect; these buttons are the manual
    // fallback if the browser blocked the navigation.
    // Going to the store loses the URL — a fresh install launches with no
    // link, so a bare store button dropped both the webinar and the
    // affiliate ref. garage-store's /hq/app-redirect owns that hand-off for
    // the HQ app: it parks the destination + ref against the device (and in
    // the Play referrer on Android) before sending the visitor to the store,
    // and the app claims it on first launch and opens this webinar with the
    // ref intact. So the store buttons go through it instead of the raw
    // store listings.
    const storeUrl = (() => {
      const q = new URLSearchParams({ target: `webinar/${webinarId}` });
      if (affiliateRef) q.set("ref", affiliateRef);
      return `https://www.garage.app/hq/app-redirect?${q.toString()}`;
    })();
    const path = typeof window !== "undefined" ? `webinar/${webinarId}${window.location.search}` : `webinar/${webinarId}`;
    const openAppUrl =
      mobileOS === "android"
        ? `intent://${path}#Intent;scheme=garagehq;package=com.garageapp.hq;S.browser_fallback_url=${encodeURIComponent(storeUrl)};end`
        : `garagehq://${path}`;
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-5" />
          <p className="text-white text-lg font-semibold mb-1">Opening in the Garage HQ app…</p>
          <p className="text-zinc-400 text-sm mb-6">
            Webinars on mobile play in the Garage HQ app. Install it if you haven&apos;t yet — this link will open right where you left off.
          </p>
          <a href={openAppUrl} className="block w-full bg-yellow-400 text-black font-semibold text-sm px-5 py-3 rounded-full mb-3">
            Open the app
          </a>
          <a href={storeUrl} className="block w-full bg-zinc-900 text-white font-semibold text-sm px-5 py-3 rounded-full">
            {mobileOS === "android" ? "Get it on Google Play" : "Download on the App Store"}
          </a>
        </div>
      </div>
    );
  }

  if (needsPreJoin) {
    return (
      <WebinarPreJoin
        webinarId={webinarId}
        affiliateId={affiliateRef}
        urlSessionDate={urlSessionDate}
        onJoinReady={handleJoinReady}
      />
    );
  }

  // Evergreen renders instead of the live room — but only AFTER the pre-join
  // gate above. It used to sit at the top of this block, which skipped the
  // paywall, registration, not-yet-started, session-choice and wrong-session
  // checks entirely: anyone with the link watched a paid evergreen webinar for
  // free. The timing gate is schedule-based rather than host-start based, so an
  // evergreen session passes it normally even though no host ever clicks Start.
  if (isEvergreen === true) {
    return (
      <EvergreenRoom
        webinarId={webinarId}
        title={useWebinarStore.getState().webinarTitle || undefined}
        sessionDate={searchParams.get("sessionDate") || undefined}
      />
    );
  }

  // Another device of this account holds the seat, or took it from this tab.
  // The choice is the user's, and nothing connects until they make it.
  if (deviceChoice) {
    const moved = deviceChoice.youMoved;
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-zinc-950 rounded-xl p-8 text-center border border-white/[0.08] max-w-sm">
          <p className="text-white text-lg font-semibold mb-2">
            {moved ? `You moved to ${deviceChoice.label}` : `You’re already in on ${deviceChoice.label}`}
          </p>
          <p className="text-zinc-400 text-sm mb-5">
            {moved
              ? "This webinar is playing on your other device. Take it over here?"
              : "Watch here instead, or keep it on your other device."}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => takeoverJoinRef.current?.()}
              className="bg-white text-black text-sm font-medium px-5 py-2 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              {moved ? "Take over here" : "Use this browser"}
            </button>
            <button
              onClick={handleDeviceBowOut}
              className="bg-zinc-800 hover:bg-white/15 text-white text-sm px-5 py-2 rounded-lg transition-colors"
            >
              {moved ? "Close" : `Keep ${deviceChoice.label}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-zinc-950 rounded-xl p-8 text-center border border-white/[0.08] max-w-sm">
          <p className="text-red-400 text-lg font-semibold mb-2">Failed to join</p>
          <p className="text-zinc-400 text-sm mb-5">{joinError}</p>
          <button onClick={() => router.push("/")} className="bg-zinc-800 hover:bg-white/15 text-white text-sm px-5 py-2 rounded-lg transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-medium">Joining webinar...</p>
          <p className="text-zinc-500 text-sm mt-1">Setting up secure connection</p>
        </div>
      </div>
    );
  }

  const renderPanel = () => {
    const socket = socketRef.current;
    switch (activeTab) {
      case "Chat":   return <ChatPanel socket={socket} webinarId={webinarId} />;
      case "Bids":   return <BidsPanel auction={auction} bids={bids} meId={meId} />;
      case "People": return <ParticipantsList socket={socket} webinarId={webinarId} />;
      case "Shop":   return (
        <ShopPanel
          orgId={catalogOrgId}
          onBuy={handleShopBuy}
          busyItemId={shopBusyItemId}
        />
      );
      default:       return null;
    }
  };

  return (
    <>
    {/* Bat246 "knock" — the backend only ever emits webinar:joinRequest to
        a socket it has verified holds the host seat on a Bat246 webinar,
        so pendingJoinRequests structurally stays empty for every other
        org's host (JoinRequestsPanel itself renders null when empty). Not
        gated on catalogOrgId here — that value isn't populated for the
        "05" demo-host's synthetic token, which is exactly the host this
        panel exists for. */}
    {myRole === "host" && (
      <JoinRequestsPanel
        requests={pendingJoinRequests}
        onApprove={(id) => handleRespondJoinRequest(id, true)}
        onDeny={(id) => handleRespondJoinRequest(id, false)}
      />
    )}
    {/* Root: two columns. The sidebar is a sibling of the whole left column
        (header + stage), not of the stage alone, so it runs the full screen
        height and the header stays scoped to the video side. */}
    <div className="h-screen w-screen bg-[#282828] flex overflow-hidden">
      {/* ── Left column: scoped header + video stage ── */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
      {/* Header — streamer identity on the left (avatar + two-line
          title/name block), session controls on the right. The REC tag
          lives inline next to the title, which is why the
          standalone RecordingBanner strip is gone. min-w-0 lets the title
          truncate inside its slot instead of pushing siblings. */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="min-h-14 rounded-2xl border border-white/10 bg-[#282828]/95 backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] flex items-center px-4 py-2 gap-3">
          <StreamHeaderInfo
            socketStatus={socketStatus}
            joined={joined}
            callElapsed={callElapsed}
          />
          <div className="flex-1" />
          {/* Share sits left of Chat; Chat is the far-right control. */}
          <InviteButton
            webinarId={webinarId}
            affiliateId={myAffiliateId}
            isGotobigwin={isGotobigwin}
          />
          {/* Chat opener — only while the sidebar is closed; once it's open
              the sidebar's own X closes it, so the button would be dead
              weight. Opening always lands on the Chat tab; People and Shop
              are one click away in the tab strip. */}
          {!sidebarOpen && (
            <ChatToggleButton
              onOpen={() => {
                setActiveTab("Chat");
                setSidebarOpen(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Video stage */}
        <div
          id="webinar-stage"
          className="flex-1 h-full relative overflow-hidden bg-[#181818]"
        >
          <VideoGrid />

          {/* Fullscreen — floating top-right overlay on the stage. Lives
              inside #webinar-stage (the element fullscreen is scoped to) so
              it stays visible and clickable once fullscreen is on. */}
          <FullscreenButton />

          {/* Controls — floating liquid-glass overlay pinned to the top of
              the stage. Mounted INSIDE this container (not below the body)
              so it consumes no layout height and the video grid fills the
              screen; ControlBar's auto-hide timer listens on this element
              as its pointer host. */}
          <ControlBar
            socket={socketRef.current}
            webinarId={webinarId}
            onToggleMic={mediasoup.toggleMic}
            onToggleCam={mediasoup.toggleCam}
            onShareScreen={handleShareScreen}
            onStartMedia={handleStartMedia}
            mediaStarted={mediaStarted}
            connected={socketStatus === "connected"}
            roomReady={joined}
            recordingMode={recordingMode}
            getRoom={mediasoup.getRoom}
            listMediaDevices={mediasoup.listMediaDevices}
            setVideoDevice={mediasoup.setVideoDevice}
            setAudioDevice={mediasoup.setAudioDevice}
            setOutputDevice={mediasoup.setOutputDevice}
            onOpenPip={openPip}
            isPipSupported={isPipSupported}
            alwaysVisible={isGotobigwin}
            isGotobigwin={isGotobigwin}
          />
          <MicPickerDialog
            open={micPickerOpen}
            onOpenChange={setMicPickerOpen}
            listDevices={mediasoup.listMediaDevices}
            onPickDevice={mediasoup.setAudioDevice}
          />
          <PlanPhoneVerifySheet
            open={profileOpen}
            onClose={() => {
              pendingMagicLinkRef.current = null;
              setProfileOpen(false);
            }}
            onVerified={resumePendingPurchase}
          />
          {/* A lot and a Buy Now button are two offers on the same item, so
              they never share the slot: while an auction is running on the
              pinned product the auction card takes over entirely. */}
          {auction ? (
            <LiveAuctionCard
              auction={auction}
              fallbackName={pinnedProduct?.name}
              fallbackImage={pinnedProduct?.images?.[0]}
              authed={authed}
              meId={meId}
              bidding={bidding}
              win={win}
              wallet={wallet}
              onBid={placeLotBid}
              shortfallUsd={shortfallUsd}
              onShortfallClear={clearShortfall}
              isHost={myRole === "host"}
              onCancelAuction={handleCancelAuction}
              cancelling={cancellingAuction}
              onUnpin={handleUnpinProduct}
            />
          ) : (
            <PinnedProductCard
              onBuy={handleBuy}
              onUnpin={handleUnpinProduct}
              onSwap={() => setSwapPickerOpen(true)}
              onExpired={handleProductExpired}
              buyState={buyState}
            />
          )}
          <ProductPickerDialog
            open={swapPickerOpen}
            onOpenChange={setSwapPickerOpen}
            onPick={handleSwapPick}
          />
          <WebinarCheckoutDialog
            open={checkoutOpen}
            onOpenChange={handleCheckoutDialogChange}
            invoiceId={checkoutInvoiceId}
            organizationName={
              useWebinarStore.getState().webinarTitle || "Purchase"
            }
            userEmail={getUserDataFromToken().email || ""}
            userName={getUserDataFromToken().name || undefined}
            referrer={checkoutReferrer}
            onPaid={handleCheckoutPaid}
          />
          {/* Garage Store storefront checkout — opens for physical
              store-product pins AND for Shop-tab picks. Talks directly to
              /storefront/:slug/cart/checkout to create an order, then deep-
              links to the storefront for payment. */}
          {storeCheckoutOpen &&
            (() => {
              // A Shop-tab pick wins when present; otherwise fall back to
              // the pinned product (the original overlay-buy path).
              if (shopStoreItem) {
                return (
                  <StoreCheckoutDialog
                    item={{
                      itemType: shopStoreItem.itemType,
                      itemId: shopStoreItem.itemId,
                      name: shopStoreItem.name,
                      description: shopStoreItem.description,
                      price: shopStoreItem.price,
                      currency: shopStoreItem.currency,
                      image: shopStoreItem.image,
                      isPhysical: shopStoreItem.isPhysical,
                      storeSlug: shopStoreItem.storeSlug,
                    }}
                    displayCurrency={storeCheckoutCurrency}
                    liveWorkshopId={webinarId}
                    liveSessionDate={
                      urlSessionDate ??
                      new Date().toISOString().slice(0, 10)
                    }
                    onClose={() => {
                      setStoreCheckoutOpen(false);
                      setShopStoreItem(null);
                    }}
                  />
                );
              }
              const pp = useWebinarStore.getState().pinnedProduct;
              if (!pp || !pp.storeSlug) return null;
              return (
                <StoreCheckoutDialog
                  item={{
                    itemType: pp.itemType,
                    itemId: pp._id,
                    name: pp.name,
                    description: pp.description,
                    price: pp.price,
                    currency: pp.currency,
                    image: pp.images?.[0],
                    isPhysical: pp.isPhysical,
                    storeSlug: pp.storeSlug,
                    productUrl: pp.productUrl,
                  }}
                  displayCurrency={storeCheckoutCurrency}
                  liveWorkshopId={webinarId}
                  liveSessionDate={
                    urlSessionDate ?? new Date().toISOString().slice(0, 10)
                  }
                  onClose={() => setStoreCheckoutOpen(false)}
                />
              );
            })()}
        </div>
      </div>

      {/* ── Right column: full-height sidebar ── */}
      {sidebarOpen && (
        <div className="w-80 sm:w-96 h-screen flex flex-col border-l border-white/10 bg-[#282828] shrink-0">
          <div className="flex border-b border-white/10 bg-[#282828] shrink-0">
            {tabs.map((tab) => (
              <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
            ))}
            <button
              onClick={() => setSidebarOpen(false)}
              className="px-2.5 text-zinc-500 hover:text-white transition-colors shrink-0"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">{renderPanel()}</div>
        </div>
      )}
    </div>

    {pipWindow?.document?.getElementById("pip-root") &&
      createPortal(
        <WebinarPipContent
          onToggleMic={mediasoup.toggleMic}
          onToggleCam={mediasoup.toggleCam}
          onLeave={handlePipLeave}
        />,
        pipWindow.document.getElementById("pip-root")!
      )}

    </>
  );
}

/* ── Inline sub-components ──────────────────────────────────────────────────── */

/**
 * Left side of the header: the streamer's avatar next to a two-line block —
 * stream title (with the REC tag inline) on top, streamer name
 * underneath. The REC tag here replaces the old standalone RecordingBanner
 * strip; it reads from the same `isRecording` store flag, which the
 * webinar:recordingStarted / recordingStopped broadcasts keep in sync for
 * every participant.
 */
function StreamHeaderInfo({
  socketStatus,
  joined,
  callElapsed,
}: {
  socketStatus: "connecting" | "connected" | "disconnected";
  joined: boolean;
  callElapsed: number;
}) {
  const role = useWebinarStore((s) => s.role);
  const peers = useWebinarStore((s) => s.peers);
  const isRecording = useWebinarStore((s) => s.isRecording);
  const webinarTitle = useWebinarStore((s) => s.webinarTitle) || "Live Stream";
  const webinarThumbnail = useWebinarStore((s) => s.webinarThumbnail);
  const user = useAuthStore((s) => s.user);

  // Who is running the session — still the sub-line under the title. When *we*
  // are the host we know ourselves from the auth store / JWT; otherwise we read
  // the host's identity off the peer list the server sent on join.
  const hostPeer = peers.find((p) => p.role === "host");
  const hostName =
    role === "host"
      ? user?.name || getUserDataFromToken().name || "You (Host)"
      : hostPeer?.name || "Host";

  // The image headlines the STREAM, not whoever is running it — deliberately
  // NOT falling back to the host's avatar, since a session can now be started
  // by the creator or by a delegated `live_streams` admin and the header would
  // change face depending on who clicked Start. No cover set → title initial.
  const initial = (webinarTitle || "?").trim().charAt(0).toUpperCase();
  const connected = socketStatus === "connected";

  // Every pill on the title row shares this geometry so their tops, bottoms
  // and text baselines line up instead of each sizing to its own padding.
  const TAG =
    "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-bold leading-none tracking-wide flex-shrink-0 border";

  const roleColors: Record<string, string> = {
    host: "bg-purple-900/50 text-purple-300 border-purple-500/30",
    panelist: "bg-blue-900/50 text-blue-300 border-blue-500/30",
    attendee: "bg-zinc-900 text-zinc-400 border-white/15",
  };

  const elapsedLabel = (() => {
    const h = Math.floor(callElapsed / 3600);
    const m = Math.floor((callElapsed % 3600) / 60);
    const s = callElapsed % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  })();

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {/* Stream cover art — rounded-square rather than a circle, so it doesn't
          read as a person's avatar. Falls back to a gradient initial. */}
      {webinarThumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={webinarThumbnail}
          alt={webinarTitle}
          className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/15 flex-shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-white/25 to-white/5 border border-white/15 text-white text-sm font-semibold flex-shrink-0">
          {initial}
        </div>
      )}

      <div className="min-w-0">
        {/* Top line: title + every status pill, all on one baseline. */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-white text-sm font-semibold leading-5 truncate max-w-[160px] sm:max-w-[280px]">
            {webinarTitle}
          </span>
          {/* No LIVE pill: the stream is already flagged as live elsewhere in
              the room, so repeating it next to the title was noise. Only the
              failure state — reconnecting — still earns a pill. */}
          {!connected && (
            <span
              className={`${TAG} bg-zinc-800/60 text-zinc-400 border-white/15`}
              title="Reconnecting…"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
              RECONNECTING
            </span>
          )}
          {isRecording && (
            <span
              className={`${TAG} bg-red-600/20 border-red-500/40 text-red-300`}
              title="This session is being recorded"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              REC
            </span>
          )}
          {joined && (
            <span
              className={`${TAG} bg-white/[0.06] border-white/10 text-zinc-300 tabular-nums font-semibold`}
              title="Call duration"
            >
              {elapsedLabel}
            </span>
          )}
          <span
            className={`${TAG} capitalize ${roleColors[role] || roleColors.attendee}`}
          >
            {role === "panelist" ? "Co-Host" : role}
          </span>
        </div>
        {/* Bottom line: streamer name */}
        <span className="block text-[11px] text-zinc-400 truncate">{hostName}</span>
      </div>
    </div>
  );
}

function InviteButton({
  webinarId,
  affiliateId: propAffiliateId,
  isGotobigwin,
}: {
  webinarId: string;
  affiliateId?: string;
  isGotobigwin?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // The COPIER's own affiliate id, fetched for any signed-in user. It
  // always wins over the prop: the prop is whatever the join flow handed
  // up, and for viewers who arrived through someone's ?ref= link that
  // could historically be the SHARER's id — which put the wrong ref on
  // copied invite links. Guests (no token) keep the prop, which after the
  // WebinarPreJoin fix is only ever their own id from the OTP join.
  const [ownAffiliateId, setOwnAffiliateId] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/affiliate/my-affiliate-id`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.affiliateId) setOwnAffiliateId(d.affiliateId);
      })
      .catch(() => {});
  }, []);

  const affiliateId = ownAffiliateId || propAffiliateId || "";

  const copy = () => {
    if (isGotobigwin) {
      const url = new URL(`${window.location.origin}/webinar/${webinarId}`);
      url.searchParams.set("invite", "1");
      if (affiliateId) {
        url.searchParams.set("ref", affiliateId);
      }
      navigator.clipboard.writeText(url.toString()).then(() => {
        setCopied(true);
        toast.success("Invite link copied!");
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const base = `${window.location.origin}/webinar/${webinarId}`;
      const link = affiliateId ? `${base}?ref=${affiliateId}` : base;
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        toast.success("Invite link copied!");
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (isGotobigwin) {
    return (
      <button
        onClick={copy}
        title={copied ? "Invite link copied" : "Copy invite link"}
        aria-label={copied ? "Invite link copied" : "Invite"}
        // Solid white on black text, and deliberately larger than the glass
        // pills around it: on gotobigwin, inviting people IS the funnel, so
        // this is the one control meant to be seen rather than blend in.
        className={`flex h-11 items-center gap-2 px-5 rounded-full text-sm font-semibold shadow-lg transition-all active:scale-95 ${
          copied
            ? "bg-emerald-400 text-black"
            : "bg-white text-black hover:bg-white/90"
        }`}
      >
        {copied ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
        <span>{copied ? "Copied" : "Invite"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={copy}
      title={copied ? "Invite link copied" : "Copy invite link"}
      aria-label={copied ? "Invite link copied" : "Share"}
      // Liquid glass, same recipe as the control bar: translucent black fill,
      // saturated backdrop blur, hairline border and an inner top highlight.
      className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xl backdrop-saturate-150 transition-all active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ${
        copied
          ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
          : "border-white/15 bg-white/10 text-white hover:bg-white/20 hover:border-white/25"
      }`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
    </button>
  );
}

/**
 * Chat opener — same glass pill geometry as InviteButton so the two header
 * controls read as a pair. Rendered only while the sidebar is closed, which
 * is also the only time it carries the unread badge.
 */
function ChatToggleButton({ onOpen }: { onOpen: () => void }) {
  const unreadChat = useWebinarStore((s) => s.unreadChatCount);

  return (
    <button
      onClick={onOpen}
      title="Show chat"
      aria-label="Toggle Chat"
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-xl backdrop-saturate-150 transition-all active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-white/20 hover:border-white/25"
    >
      <MessageSquare className="w-4 h-4" />
      {unreadChat > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-white text-black text-[10px] font-semibold flex items-center justify-center leading-none">
          {unreadChat > 9 ? "9+" : unreadChat}
        </span>
      )}
    </button>
  );
}

function TabButton({ tab, active, onClick }: { tab: Tab; active: boolean; onClick: () => void }) {
  const handCount = useWebinarStore((s) => s.peers.filter((p) => p.handRaised).length);
  const unreadChat = useWebinarStore((s) => s.unreadChatCount);
  // +1 for the local user — `peers` is everyone else in the room. The scripted
  // audience is counted here too so the tab agrees with the list it opens.
  const peopleCount =
    useWebinarStore((s) => s.peers.length) +
    useWebinarStore((s) => s.simulatedPeople.length) +
    1;
  const badge = tab === "Chat" && !active && unreadChat > 0 ? unreadChat : tab === "People" && handCount > 0 ? handCount : null;

  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`flex-1 min-w-0 truncate border-b-2 px-2 py-2.5 text-xs font-semibold relative transition-colors ${
        active
          ? "border-white text-white"
          : "border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {tab === "People" ? `People (${peopleCount})` : tab}
      {badge !== null && (
        <span className={`absolute top-1 right-1 min-w-4 h-4 px-0.5 text-xs rounded-full flex items-center justify-center leading-none ${tab === "Chat" ? "bg-white text-black font-semibold" : "bg-yellow-500 text-black font-semibold"}`}>
          {typeof badge === "number" && badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
