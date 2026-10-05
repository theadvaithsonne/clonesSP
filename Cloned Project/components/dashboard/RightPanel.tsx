"use client";

import { ChatPreviewText } from "@/components/chat/ChatPreviewText";
import React, { useEffect, useMemo, useState, useRef } from "react";
import DropVideoPlayer from "./drops/DropVideoPlayer";
import CustomVideoPlayer from "./CustomVideoPlayer";
import WebinarChatReplay from "@/components/webinar/WebinarChatReplay";
import { useOrgShareOrigin } from "@/lib/hooks/useOrgShareOrigin";
import { StickyNote, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  ChevronDown,
  ChevronUp,
  Bell,
  Search,
  MessageSquare,
  Plus,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Check,
  Star,
  X,
  Loader2,
  Upload,
  UserPlus,
  User,
  CreditCard,
  Link2,
  Copy,
  CircleDollarSign,
  Play,
  Heart,
  Share2,
  Video,
  Send,
  ListPlus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Download,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import { readCoverOriginal } from "@/lib/coverOriginal";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChat } from "@/lib/chat-context";
import { useSidebarCollapse } from "@/lib/sidebar-collapse-context";
import NotificationPage from "@/components/dashboard/NotificationPage";
import MiniChatWindow from "@/components/dashboard/MiniChatWindow";
import CreateGroupDialog from "@/components/dashboard/CreateGroupDialog";
import InviteMemberDialog from "@/components/dashboard/InviteMemberDialog";
import { AnimatePresence, motion } from "framer-motion";
import { getTeamMembers, type TeamMember, searchUsersForAssignment, getCombPlanForItem, getChannelSubscribers, getChannelMembershipDetails, getChannelWithStats, type CombPlan, type Channel, type ChannelSubscriber, getVideoShareLink, getPlaylistShareLink, quickAddToPlaylist, getPlaylist, getStandaloneVideoStreamUrl, getCourseVideoStreamUrl, type Playlist, type PlaylistVideo, type Workshop, getRecurringWorkshopAnalytics, getWorkshopRegistrations, getWorkshopAnalytics, type Product, type Course, type Service, getWorkshopSessions, type WorkshopSession } from "@/lib/feed-api";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ReviewsPanel } from "@/components/reviews";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useAuthStore } from "@/store/authStore";
import type { ReviewTargetType } from "@/lib/reviews-api";

const isVideoSizingPage = (popover: string | null) => {
  if (!popover) return false;
  return [
    "Content:AllVideos",
    "Content",
    "Long Form Videos",
    "Content:Videos",
    "Content:Playlists",
    "Content:Drops",
    "Drops",
    "Drops:Feed",
    "Drops:Uploads",
    "Live:Recording",
    "Live:Recorded",
    "Recorded Live Stream"
  ].includes(popover);
};

// ---------- Types ----------
type ChatType = "individual" | "group" | "global";

interface Member {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  role: "founder" | "stakeholder";
  profilePicture?: string;
  lastSeenAt?: string | null;
}

interface Group {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  unread?: number;
}

interface GlobalDmUser {
  _id: string;
  name?: string;
  email: string;
  profilePicture?: string;
}

// ---------- Tab type ----------
type RightPanelTab = "chats" | "notifications" | "search" | "download" | "information" | "members" | "view_options" | "orders" | "video_player" | "drops_feed" | "playlist_player" | "sessions" | "enrollments" | "attendees" | "reviews";

// ---------- Tab widths helper ----------
const getTabWidth = (tabId: RightPanelTab) => {
  switch (tabId) {
    case "chats":
      return 72;
    case "notifications":
      return 112;
    case "search":
      return 79;
    case "download":
      return 97;
    case "information":
    case "members":
      return 105;
    case "view_options":
      return 115;
    case "orders":
      return 85;
    case "video_player":
    case "drops_feed":
    case "playlist_player":
      return 120;
    case "sessions":
      return 105;
    case "enrollments":
      return 110;
    case "attendees":
      return 105;
    case "reviews":
      return 95;
    default:
      return 32;
  }
};

// ---------- Play Store SVG ----------
function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.18 23.75C2.61 23.44 2.25 22.85 2.25 22.14V1.86C2.25 1.15 2.61 0.56 3.18 0.25L13.56 12L3.18 23.75Z"
        fill="currentColor"
        opacity="0.8"
      />
      <path
        d="M17.02 15.66L5.16 22.6L13.56 12L17.02 15.66Z"
        fill="currentColor"
      />
      <path
        d="M21.07 10.44C21.56 10.73 21.75 11.26 21.75 12C21.75 12.74 21.49 13.28 21.07 13.56L18.02 15.3L14.24 12L18.02 8.7L21.07 10.44Z"
        fill="currentColor"
      />
      <path
        d="M5.16 1.4L17.02 8.34L13.56 12L5.16 1.4Z"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
  );
}

/**
 * QR + share tools for an affiliate referral link. Renders the QR via the
 * free api.qrserver.com service (same pattern used in
 * checkout/CryptoPaymentPanel.tsx) — zero dependency install. The Garage
 * logo is overlaid in the center; QR error-correction is bumped to H (30%
 * recoverable) so the logo covering ~20% of the code doesn't break scan.
 *
 * Display: CSS-positioned logo on top of the <img>. Download / share:
 * canvas composition — QR + white rounded panel + logo → PNG blob.
 */
const GARAGE_LOGO_SRC = "/logo-icon.svg";
/**
 * The three product marks are the published app icons, pulled from the Play
 * Store listings themselves (`com.garageapp.hq`, `app.garage.store`,
 * `com.networkchain.app`) rather than redrawn — the earlier local files had
 * drifted: `/networkchains-icon.png` was the Garage mark, and
 * `/garage-shop-icon.png` carried a play notch the shipped icon doesn't have.
 *
 * Garage HQ's is artwork on transparency; the other two carry their own black
 * ground, so anything placing them on a light surface needs a dark tile behind
 * all three for the HQ one to read.
 */
const GARAGE_HQ_APP_ICON_SRC = "/app-icons/garage-hq.png";
/** NetworkChains brand mark, used when the QR points at a networkchains.com link. */
const NETWORKCHAINS_LOGO_SRC = "/app-icons/networkchains.png";
/** Garage Shop app mark — the Garage silhouette on black. */
const GARAGE_SHOP_LOGO_SRC = "/app-icons/garage-shop.png";

/** Compose a QR PNG with a brand logo overlaid in the center. */
async function composeQrWithLogo(
  url: string,
  size = 1024,
  logoSrc: string = GARAGE_LOGO_SRC,
): Promise<Blob> {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    url,
  )}&margin=16&ecc=H`;

  // Fetch the QR PNG as a blob first so drawImage() doesn't taint the canvas
  // (qrserver returns CORS headers but going through fetch is the safe path).
  const qrRes = await fetch(qrUrl);
  if (!qrRes.ok) throw new Error("Failed to fetch QR");
  const qrBlob = await qrRes.blob();
  const qrObjUrl = URL.createObjectURL(qrBlob);

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });

  try {
    const [qrImg, logoImg] = await Promise.all([
      loadImg(qrObjUrl),
      loadImg(logoSrc),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2d context unavailable");

    // 1. QR background
    ctx.drawImage(qrImg, 0, 0, size, size);

    // 2. White rounded panel behind the logo — improves scan contrast when
    //    the logo has semi-transparent regions or non-square silhouette.
    const panel = Math.round(size * 0.22);
    const panelX = (size - panel) / 2;
    const panelY = (size - panel) / 2;
    const radius = Math.round(panel * 0.14);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(panelX + radius, panelY);
    ctx.lineTo(panelX + panel - radius, panelY);
    ctx.quadraticCurveTo(panelX + panel, panelY, panelX + panel, panelY + radius);
    ctx.lineTo(panelX + panel, panelY + panel - radius);
    ctx.quadraticCurveTo(panelX + panel, panelY + panel, panelX + panel - radius, panelY + panel);
    ctx.lineTo(panelX + radius, panelY + panel);
    ctx.quadraticCurveTo(panelX, panelY + panel, panelX, panelY + panel - radius);
    ctx.lineTo(panelX, panelY + radius);
    ctx.quadraticCurveTo(panelX, panelY, panelX + radius, panelY);
    ctx.closePath();
    ctx.fill();

    // 3. Logo, centered inside the panel with padding. Preserve aspect
    //    (logoImg is ~283x251 → wider than tall).
    const padding = Math.round(panel * 0.14);
    const inner = panel - padding * 2;
    const nw = logoImg.naturalWidth || 283;
    const nh = logoImg.naturalHeight || 251;
    const scale = Math.min(inner / nw, inner / nh);
    const drawW = nw * scale;
    const drawH = nh * scale;
    const drawX = (size - drawW) / 2;
    const drawY = (size - drawH) / 2;
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob returned null"))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(qrObjUrl);
  }
}

function AffiliateQrShare({
  url,
  title,
  filenameHint = "affiliate-link",
  logoSrc = GARAGE_LOGO_SRC,
  caption = "Scan to open the affiliate link",
}: {
  url: string;
  title?: string;
  filenameHint?: string;
  /** Brand mark punched into the middle of the QR (display + download). */
  logoSrc?: string;
  caption?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Display: ecc=H so the CSS-overlaid logo doesn't break scan. Same param on
  // the download URL inside composeQrWithLogo.
  const displayQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&margin=8&ecc=H`;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const blob = await composeQrWithLogo(url, 1024, logoSrc);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${filenameHint}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success("QR code saved");
    } catch {
      toast.error("Failed to save QR — try again");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
      if (nav?.share) {
        try {
          if (nav.canShare) {
            const blob = await composeQrWithLogo(url, 1024, logoSrc);
            const file = new File([blob], `${filenameHint}-qr.png`, {
              type: blob.type || "image/png",
            });
            if (nav.canShare({ files: [file] })) {
              await nav.share({
                title: title || "Affiliate link",
                text: title,
                url,
                files: [file],
              });
              return;
            }
          }
          await nav.share({
            title: title || "Affiliate link",
            text: title,
            url,
          });
          return;
        } catch (shareErr: any) {
          // AbortError = user dismissed share sheet. Not an error.
          if (shareErr?.name === "AbortError") return;
          // Fall through to clipboard fallback on other failures.
        }
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to share — try again");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mt-2 mb-4 flex flex-col items-center gap-3">
      <div className="relative rounded-2xl bg-white p-3">
        <img
          key={displayQrSrc}
          src={displayQrSrc}
          alt="Affiliate link QR code"
          width={180}
          height={180}
          className="block h-[180px] w-[180px]"
        />
        {/* Logo overlay — matches the canvas composition used at download time.
            22% panel of 180 = ~40px; logo scales inside with padding. The
            wrapper is inset by the card padding so "center" is the center of
            the QR itself, not of the padded white card. */}
        <div
          className="absolute inset-3 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="flex items-center justify-center rounded-md bg-white h-[40px] w-[40px] p-[5px]">
            <img
              src={logoSrc}
              alt=""
              className="max-h-full max-w-full w-auto h-auto block object-contain"
            />
          </div>
        </div>
      </div>
      <p className="text-[10px] font-normal font-inter text-[#8888a0] text-center leading-[1.4]">
        {caption}
      </p>
      <div className="grid grid-cols-2 gap-2 w-full max-w-[220px]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-1.5 bg-[#1b1b1f] border border-[#2a2a30] hover:border-brand/40 text-white text-xs font-semibold py-2 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center justify-center gap-1.5 bg-[#1b1b1f] border border-[#2a2a30] hover:border-brand/40 text-white text-xs font-semibold py-2 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {sharing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
          Share
        </button>
      </div>
    </div>
  );
}

// ---------- Grow Your Network link options ----------

/**
 * The funnels a user can hand out from "Grow Your Network". All of them carry
 * the SAME affiliate id — only the landing page differs, so the picker is about
 * which pitch the visitor reads, not about which code they're credited to.
 */
export type GrowNetworkLinkKind =
  | "hq"
  | "founders"
  | "ecommerce"
  | "irl"
  | "backoffice"
  | "networkchains"
  | "whitelabel"
  | "complan"
  | "bigwin";

/** Public NetworkChains site that hosts the affiliate registration funnel. */
const NETWORKCHAINS_BASE_URL = (
  process.env.NEXT_PUBLIC_NETWORKCHAINS_URL || "https://networkchains.com"
).replace(/\/$/, "");

/**
 * The Garage founders landing page. Same `?ref=` contract as the whitelabel
 * site: it shows the referrer's name on the page and carries the code through
 * to sign-up, so a founder who launches an office from it lands in the
 * sharer's downline.
 */
const FOUNDERS_BASE_URL = (
  process.env.NEXT_PUBLIC_GARAGE_FOUNDERS_URL || "https://founder.garage.app"
).replace(/\/$/, "");

/**
 * The Garage for Ecommerce Founders landing page. Same `?ref=` contract as the
 * founders site — it credits the referrer by name on the page and carries the
 * code through to the app login as `referCode`.
 */
const ECOMMERCE_BASE_URL = (
  process.env.NEXT_PUBLIC_GARAGE_ECOMMERCE_URL || "https://ecommerce.garage.app"
).replace(/\/$/, "");

/**
 * The GarageIRL landing page, for offline businesses. Same `?ref=` contract as
 * the founders site — the page shows a "Referred by" pill with the referrer's
 * name and carries the code through to the app as `referCode`.
 */
const IRL_BASE_URL = (
  process.env.NEXT_PUBLIC_GARAGE_IRL_URL || "https://irl.garage.app"
).replace(/\/$/, "");

/**
 * The Garage BackOffice landing page — the five-app suite pitch. Same `?ref=`
 * contract as the founders site: it resolves the code into a "Referred by"
 * pill and carries it through to the office checkout as `referCode`.
 */
const BACKOFFICE_BASE_URL = (
  process.env.NEXT_PUBLIC_GARAGE_BACKOFFICE_URL || "https://backoffice.garage.app"
).replace(/\/$/, "");

/** Garage Whitelabel landing page — reads `?ref=` and forwards it to the app. */
const WHITELABEL_BASE_URL = (
  process.env.NEXT_PUBLIC_GARAGE_WHITELABEL_URL || "https://whitelabel.garage.app"
).replace(/\/$/, "");

/**
 * The compensation-plan deck. Same `?ref=` contract as the whitelabel site: the
 * deck credits the referrer on the page and carries the code onward to the
 * NetworkChains register link behind its "Get started" CTA.
 */
const COMPLAN_BASE_URL = (
  process.env.NEXT_PUBLIC_GARAGE_COMPLAN_URL || "https://complan.garage.app"
).replace(/\/$/, "");

/**
 * "Refer To Garage" — the invite into the Garage HQ office itself.
 *
 * Deliberately hard-coded to Garage HQ's own org, NOT the viewer's: this row is
 * the same link in every office's panel, so a founder sharing it puts the guest
 * in Garage HQ and in their own 1Network. Every other row on this panel is
 * built from the viewer's org; this one must not be, or each office would hand
 * out an invite to itself instead.
 *
 * The shape is the storefront's office deep link (see lib/deeplink.ts): join
 * `orgId`, then land on that office's workspace. Only `referCode` varies.
 */
const GARAGE_HQ_ORG_ID = "68f1fe05876fcc5fadb61951";
const GARAGE_HQ_ORG_SLUG = "garage-app";
const GARAGE_HQ_APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://my.garage.app"
).replace(/\/$/, "");

function buildReferToGarageUrl(affiliateId: string | null): string {
  const params = new URLSearchParams({
    intent: "join-office",
    orgId: GARAGE_HQ_ORG_ID,
    orgSlug: GARAGE_HQ_ORG_SLUG,
  });
  // Attribution is read from `referCode` by both /login and /verify. Omitted
  // rather than sent empty when the viewer has no affiliate id yet — a blank
  // code is not a code, and the join would silently record nobody.
  if (affiliateId) params.set("referCode", affiliateId);
  params.set("flow", "login");
  params.set("redirect", `/workspace?orgId=${GARAGE_HQ_ORG_ID}`);
  return `${GARAGE_HQ_APP_URL}/login?${params.toString()}`;
}

type GrowNetworkOption = {
  key: GrowNetworkLinkKind;
  name: string;
  /** One-liner under the option name in the picker. */
  blurb: string;
  /** Heading above the link box, e.g. "Your NetworkChains Link". */
  linkLabel: string;
  qrLogoSrc: string;
  qrCaption: string;
  filenameHint: string;
  shareTitle: string;
  copiedToast: string;
  /** Null when the link can't be built (HQ with no org slug). */
  buildUrl: (ctx: { affiliateId: string | null; hqSlug: string | null }) => string | null;
};

const GROW_NETWORK_OPTIONS: GrowNetworkOption[] = [
  {
    key: "hq",
    name: "Garage HQ Lobby",
    blurb: "Guests browse your HQ and request to join your office.",
    linkLabel: "Your Lobby Link",
    qrLogoSrc: GARAGE_LOGO_SRC,
    qrCaption: "Scan to open your HQ lobby",
    filenameHint: "hq-lobby",
    shareTitle: "Join my HQ lobby",
    copiedToast: "Lobby link copied to clipboard!",
    buildUrl: ({ affiliateId, hqSlug }) =>
      hqSlug
        ? `https://www.garage.app/hq/${hqSlug}${affiliateId ? `?ref=${affiliateId}` : ""}`
        : null,
  },
  {
    key: "founders",
    name: "Garage For Founders",
    blurb: "The main Garage pitch, with your code attached.",
    linkLabel: "Your Founders Link",
    qrLogoSrc: GARAGE_LOGO_SRC,
    qrCaption: "Scan to open the Garage landing page",
    filenameHint: "garage-founders",
    shareTitle: "Run your business out of one office",
    copiedToast: "Founders link copied to clipboard!",
    buildUrl: ({ affiliateId }) =>
      affiliateId ? `${FOUNDERS_BASE_URL}/?ref=${affiliateId}` : null,
  },
  {
    key: "ecommerce",
    name: "Garage For Ecommerce",
    blurb: "For merchants who already sell a product.",
    // Garage mark on an emerald tile — the pitch is a Garage property, and the
    // green keeps it from reading as a repeat of the two yellow rows above.
    linkLabel: "Your Ecommerce Link",
    qrLogoSrc: GARAGE_LOGO_SRC,
    qrCaption: "Scan to open the ecommerce landing page",
    filenameHint: "garage-ecommerce",
    shareTitle: "A store that sells itself",
    copiedToast: "Ecommerce link copied to clipboard!",
    buildUrl: ({ affiliateId }) =>
      affiliateId ? `${ECOMMERCE_BASE_URL}/?ref=${affiliateId}` : null,
  },
  {
    key: "irl",
    name: "GarageIRL",
    blurb: "For offline businesses that get walk-in customers.",
    // Garage mark on an amber tile — IRL is a Garage property, and the orange
    // keeps it apart from the yellow HQ/founders rows and the green store row.
    linkLabel: "Your GarageIRL Link",
    qrLogoSrc: GARAGE_LOGO_SRC,
    qrCaption: "Scan to open the GarageIRL page",
    filenameHint: "garage-irl",
    shareTitle: "Get paid for the customers you send",
    copiedToast: "GarageIRL link copied to clipboard!",
    buildUrl: ({ affiliateId }) =>
      affiliateId ? `${IRL_BASE_URL}/?ref=${affiliateId}` : null,
  },
  {
    key: "backoffice",
    name: "Garage BackOffice",
    blurb: "The five-app suite that replaces their software bill.",
    // Garage mark on a violet tile — another Garage property, kept off the
    // yellow founders rows, the green store row and the orange IRL row.
    linkLabel: "Your BackOffice Link",
    qrLogoSrc: GARAGE_LOGO_SRC,
    qrCaption: "Scan to open the BackOffice page",
    filenameHint: "garage-backoffice",
    shareTitle: "Five tools, one subscription",
    copiedToast: "BackOffice link copied to clipboard!",
    buildUrl: ({ affiliateId }) =>
      affiliateId ? `${BACKOFFICE_BASE_URL}/?ref=${affiliateId}` : null,
  },
  {
    key: "networkchains",
    name: "NetworkChains",
    blurb: "Invite affiliates to build their network under you.",
    linkLabel: "Your NetworkChains Link",
    qrLogoSrc: NETWORKCHAINS_LOGO_SRC,
    qrCaption: "Scan to open the affiliate link",
    filenameHint: "networkchains",
    shareTitle: "Join my network on NetworkChains",
    copiedToast: "NetworkChains link copied to clipboard!",
    // Landing-page funnel, NOT the register form: the picker rows are about
    // which pitch the visitor reads, so this one drops `/register` and hands
    // out the referral landing page at `networkchains.com/?ref=<affiliateId>`.
    // The direct-referral row above (GROW_NETWORK_REFER_APPS) keeps
    // `/register`, because that row exists to put someone straight into
    // sign-up.
    //
    // `?ref=` — a NAMED param, the same contract the whitelabel and founders
    // landing pages use. A bare `?aff_…` is a valueless query key that the
    // landing page has no way to look up, so it credited nobody while the page
    // still loaded perfectly: the miss is invisible in testing.
    buildUrl: ({ affiliateId }) =>
      affiliateId
        ? `${NETWORKCHAINS_BASE_URL}/?ref=${encodeURIComponent(affiliateId)}`
        : null,
  },
  {
    key: "whitelabel",
    name: "Garage Whitelabel",
    blurb: "Your own branded domain, with your code attached.",
    // Garage mark, forced to plain white on black — whitelabel is the product
    // with the branding stripped out, and it keeps this row from reading as a
    // duplicate of the yellow HQ row above it.
    linkLabel: "Your Whitelabel Link",
    qrLogoSrc: GARAGE_LOGO_SRC,
    qrCaption: "Scan to open the whitelabel page",
    filenameHint: "garage-whitelabel",
    shareTitle: "Run Garage on your own domain",
    copiedToast: "Whitelabel link copied to clipboard!",
    buildUrl: ({ affiliateId }) =>
      affiliateId ? `${WHITELABEL_BASE_URL}/?ref=${affiliateId}` : null,
  },
  {
    key: "complan",
    name: "Compensation Plan",
    blurb: "Walk them through how the earnings actually work.",
    // Garage mark again — the deck is a Garage property. The sky tile is what
    // separates it from the HQ and whitelabel rows at a glance.
    linkLabel: "Your Compensation Plan Link",
    qrLogoSrc: GARAGE_LOGO_SRC,
    qrCaption: "Scan to open the compensation plan",
    filenameHint: "garage-compensation-plan",
    shareTitle: "How the Garage compensation plan works",
    copiedToast: "Compensation plan link copied to clipboard!",
    buildUrl: ({ affiliateId }) =>
      affiliateId ? `${COMPLAN_BASE_URL}/?ref=${affiliateId}` : null,
  },
];

/**
 * Bat246's own funnel — gotobigwin.com is that office's white-label domain.
 *
 * Its founders share the office from inside my.garage.app, so the lobby row
 * above hands them a www.garage.app link, which sends their recruits to
 * Garage's brand instead of theirs. This row sends them to gotobigwin.com
 * itself — `/?ref=<code>`, the same `?ref=` contract the founders/whitelabel
 * rows use — so the recruit lands on Bat246's own funnel and the referral
 * still attributes.
 *
 * Offered ONLY when the office the panel is sharing is Bat246 (see
 * `isBat246Office` where the list is built); nothing else on the panel
 * changes. Hard-coded on purpose: a one-office arrangement, like the same
 * constant in Welcome.tsx / WebinarPreJoin.tsx / OpenInAppGate.tsx.
 */
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
const BAT246_ORG_SLUG = "bat246";
const BAT246_PUBLIC_ORIGIN = "https://gotobigwin.com";
const BAT246_LOGO_SRC = "/images/bat246-alan-logo.png";

const BAT246_BIGWIN_OPTION: GrowNetworkOption = {
  key: "bigwin",
  name: "Go to Bigwin landing page",
  blurb: "The gotobigwin.com landing page, with your code attached.",
  linkLabel: "Your Bigwin Link",
  qrLogoSrc: BAT246_LOGO_SRC,
  qrCaption: "Scan to open the Bigwin landing page",
  filenameHint: "bigwin-landing",
  shareTitle: "Join me on Bigwin",
  copiedToast: "Bigwin link copied to clipboard!",
  // The gotobigwin.com landing itself (Bat246Landing.tsx reads `?ref=` and
  // carries it into JOIN NOW), not the /hq lobby — that page is the funnel.
  buildUrl: ({ affiliateId }) =>
    affiliateId ? `${BAT246_PUBLIC_ORIGIN}/?ref=${affiliateId}` : null,
};

// ---------- Mobile app downloads ----------

/**
 * Full-colour Google Play mark. Same geometry as PlayStoreIcon above, but with
 * the brand colours per region instead of currentColor — this one sits in the
 * middle of the QR, where a monochrome mark would read as part of the code.
 */
function GooglePlayMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.18 23.75C2.61 23.44 2.25 22.85 2.25 22.14V1.86C2.25 1.15 2.61 0.56 3.18 0.25L13.56 12L3.18 23.75Z"
        fill="#00A0FF"
      />
      <path d="M5.16 1.4L17.02 8.34L13.56 12L5.16 1.4Z" fill="#00F076" />
      <path d="M17.02 15.66L5.16 22.6L13.56 12L17.02 15.66Z" fill="#FF3A44" />
      <path
        d="M21.07 10.44C21.56 10.73 21.75 11.26 21.75 12C21.75 12.74 21.49 13.28 21.07 13.56L18.02 15.3L14.24 12L18.02 8.7L21.07 10.44Z"
        fill="#FFC900"
      />
    </svg>
  );
}

/** Apple mark for the App Store rows and QR centre. */
function AppleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.2 1.29-2.18 3.84.03 3.05 2.67 4.06 2.7 4.07zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

type StoreKey = "play" | "ios";

const DOWNLOAD_STORES: Record<
  StoreKey,
  { label: string; platform: string; icon: React.ReactNode }
> = {
  play: {
    label: "Play Store",
    platform: "Android",
    icon: <GooglePlayMark className="h-[15px] w-[15px]" />,
  },
  ios: {
    label: "App Store",
    platform: "iOS",
    icon: <AppleMark className="h-[15px] w-[15px] text-white" />,
  },
};

/**
 * Store listings, one entry per app. The `pcampaignid=web_share` param that
 * Play's share sheet appends is dropped — it only tags the referrer and makes
 * for a denser QR.
 */
const DOWNLOAD_APPS: {
  id: string;
  name: string;
  tagline: string;
  /** The app's own icon — the row tile and the QR centre both render it. */
  iconSrc: string;
  links: Record<StoreKey, string>;
}[] = [
  {
    id: "garage-hq",
    name: "Garage HQ",
    tagline: "Your virtual office, anywhere",
    iconSrc: GARAGE_HQ_APP_ICON_SRC,
    links: {
      play: "https://play.google.com/store/apps/details?id=com.garageapp.hq",
      ios: "https://apps.apple.com/in/app/garage-hq/id6754905027",
    },
  },
  {
    id: "garage-shop",
    name: "Garage Shop",
    tagline: "Drops, deals and digital products",
    iconSrc: GARAGE_SHOP_LOGO_SRC,
    links: {
      play: "https://play.google.com/store/apps/details?id=app.garage.store",
      ios: "https://apps.apple.com/pk/app/garage-shop/id6770841662",
    },
  },
  {
    id: "networkchains",
    name: "NetworkChains",
    tagline: "Build and track your network",
    iconSrc: NETWORKCHAINS_LOGO_SRC,
    links: {
      play: "https://play.google.com/store/apps/details?id=com.networkchain.app",
      ios: "https://apps.apple.com/in/app/networkchains/id6758221987",
    },
  },
];

// ---------- Grow Your Network: direct referral rows ----------

/**
 * Liquid-glass surface for the Grow Your Network panel: a translucent pane
 * that picks up what's behind it (blur + saturation), a bright rim along the
 * top edge and a dimmer one along the bottom, and a vertical sheen so the pane
 * reads as lit from above rather than as a flat tinted box.
 *
 * The rim is the part that carries the effect — dropping the inset shadows
 * leaves plain frosted glass.
 */
const LIQUID_GLASS =
  "border border-white/12 bg-gradient-to-b from-white/[0.10] via-white/[0.05] to-white/[0.02] backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.20),inset_0_-1px_0_0_rgba(255,255,255,0.06),0_10px_30px_-18px_rgba(0,0,0,0.9)]";

/** Same material, dialled down for controls sitting on top of a glass pane. */
const LIQUID_GLASS_CONTROL =
  "border border-white/12 bg-gradient-to-b from-white/[0.14] to-white/[0.06] backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22)] hover:from-white/[0.20] hover:to-white/[0.10] hover:border-brand/40";


/**
 * The Garage storefront, where the Garage Store referral link lands. Same base
 * the affiliate product links use — deliberately garage.app and not the
 * viewer's whitelabel origin, because the store is the public shopfront.
 */
const GARAGE_STORE_URL = (
  process.env.NEXT_PUBLIC_GARAGE_AFFILIATE_BASE_URL || "https://www.garage.app"
).replace(/\/$/, "");

/**
 * The three products a viewer refers into directly. Every row carries the SAME
 * affiliate code — only the door the invitee walks through changes, so the row
 * is about who they should become (member / affiliate / shopper), not about
 * who gets credited.
 */
type GrowNetworkReferApp = {
  id: string;
  name: string;
  blurb: string;
  icon: React.ReactNode;
  tileClass: string;
  /** Null while the viewer's affiliate id is still loading. */
  buildUrl: (affiliateId: string | null) => string | null;
  copiedToast: string;
};

const GROW_NETWORK_REFER_APPS: GrowNetworkReferApp[] = [
  {
    id: "garage-hq",
    name: "Garage HQ",
    blurb: "Invite founders & members to join your HQ",
    // Untinted: both marks are yellow artwork on transparency, so black is the
    // ground they were drawn for.
    icon: (
      <img
        src={GARAGE_LOGO_SRC}
        alt=""
        className="max-h-[20px] max-w-[20px] object-contain"
      />
    ),
    tileClass: "bg-black border border-[#2a2a30]",
    buildUrl: (affiliateId) => buildReferToGarageUrl(affiliateId),
    copiedToast: "Garage HQ link copied to clipboard!",
  },
  {
    id: "networkchains",
    name: "Networkchains",
    blurb: "Bring affiliates into your referral network",
    icon: (
      <img
        src={NETWORKCHAINS_LOGO_SRC}
        alt=""
        className="max-h-[20px] max-w-[20px] object-contain"
      />
    ),
    tileClass: "bg-black border border-[#2a2a30]",
    buildUrl: (affiliateId) =>
      affiliateId ? `${NETWORKCHAINS_BASE_URL}/register/${affiliateId}` : null,
    copiedToast: "NetworkChains link copied to clipboard!",
  },
  {
    id: "garage-store",
    name: "Garage Store",
    blurb: "Share your store link with potential shoppers",
    icon: (
      <img
        src={GARAGE_SHOP_LOGO_SRC}
        alt=""
        className="max-h-[26px] max-w-[26px] object-contain"
      />
    ),
    tileClass: "bg-black border border-[#2a2a30]",
    buildUrl: (affiliateId) =>
      affiliateId ? `${GARAGE_STORE_URL}/login?ref=${affiliateId}` : null,
    copiedToast: "Garage Store link copied to clipboard!",
  },
];

/** One referral row: who the link invites, and a copy button for it. */
function GrowNetworkReferRow({
  app,
  affiliateId,
}: {
  app: GrowNetworkReferApp;
  affiliateId: string | null;
}) {
  const url = app.buildUrl(affiliateId);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success(app.copiedToast);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl px-3.5 py-3", LIQUID_GLASS)}>
      <span
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          app.tileClass
        )}
      >
        {app.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold font-inter text-white leading-[1.4]">
          {app.name}
        </span>
        <span className="block text-[10px] font-normal font-inter text-[#8888a0] leading-[1.4]">
          {app.blurb}
        </span>
      </span>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!url}
        // The URL itself is the tooltip: the row doesn't print it, and people
        // do want to see where a link goes before they hand it out.
        title={url || "Link not available yet — your affiliate id is still loading"}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold font-inter text-white shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
          LIQUID_GLASS_CONTROL
        )}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-brand" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Copy link
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Whose affiliate code the panel hands out. Defaults to the viewer; picking a
 * teammate switches every link on the panel to that person's code, which is
 * what makes it possible to read someone else's link out to a guest — on a
 * call, at an event — without logging in as them.
 *
 * Search is by name, email or mobile because those are the three things you can
 * ask a person for out loud. It reuses two endpoints that already exist:
 * `/unilevel-plus/users/search` matches all three fields but searches every
 * user on Garage, and `/team/list` says who is actually in this org — the list
 * shown is the intersection, so nobody can reach outside their own org.
 */
type GrowNetworkSharer = {
  id: string;
  name: string;
  email?: string;
  profilePicture?: string;
  affiliateId: string;
};

type SharerCandidate = {
  id: string;
  name: string;
  email?: string;
  profilePicture?: string;
};

function GrowNetworkSharerPicker({
  meName,
  value,
  onChange,
}: {
  meName: string;
  value: GrowNetworkSharer | null;
  onChange: (sharer: GrowNetworkSharer | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [remote, setRemote] = useState<SharerCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // The org roster, fetched the first time the picker is opened rather than on
  // mount — most people never open it.
  useEffect(() => {
    if (!open || members) return;
    const orgId =
      typeof window !== "undefined"
        ? localStorage.getItem("garage_org_id") || ""
        : "";
    if (!orgId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    getTeamMembers(orgId)
      .then((list) => {
        if (!cancelled) setMembers(list || []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, members]);

  // Debounced, and only past two characters — the backend returns nothing for
  // shorter queries anyway.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchUsersForAssignment(q);
        if (cancelled) return;
        setRemote(
          (res?.users || []).map((u) => ({
            id: u._id,
            name: u.name,
            email: u.email,
            profilePicture: u.profilePicture,
          }))
        );
      } catch {
        if (!cancelled) setRemote([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const memberIds = useMemo(
    () => new Set((members || []).map((m) => m._id)),
    [members]
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const roster: SharerCandidate[] = (members || []).map((m) => ({
      id: m._id,
      name: m.name,
      email: m.email,
      profilePicture: m.profilePicture,
    }));

    if (!q) return roster.slice(0, 25);

    const byText = roster.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
    );
    // Remote hits are what makes a mobile number searchable — the roster
    // endpoint doesn't carry phone numbers. Anyone outside this org is dropped.
    const byPhoneOrName = remote.filter((u) => memberIds.has(u.id));

    const seen = new Set<string>();
    return [...byText, ...byPhoneOrName]
      .filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)))
      .slice(0, 25);
  }, [members, remote, memberIds, query]);

  const pick = async (candidate: SharerCandidate) => {
    setResolvingId(candidate.id);
    try {
      // Already on the backend for invite-link previews; the userId form
      // returns the person's affiliate code.
      const res = await api<{
        success: boolean;
        referrer?: { affiliateCode?: string };
      }>(`/affiliate/referrer-info?userId=${encodeURIComponent(candidate.id)}`);
      const code = res?.referrer?.affiliateCode;
      if (!code) {
        toast.error(`${candidate.name || "That member"} has no affiliate link yet`);
        return;
      }
      onChange({ ...candidate, affiliateId: code });
      setOpen(false);
      setQuery("");
    } catch {
      toast.error("Couldn't load that member's link");
    } finally {
      setResolvingId(null);
    }
  };

  const label = value?.name || meName;
  const initial = (label || "?").trim().charAt(0).toUpperCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 shrink-0 transition-all cursor-pointer",
            LIQUID_GLASS_CONTROL
          )}
          title="Whose link this panel hands out"
        >
          <Avatar className="h-5 w-5">
            <AvatarImage src={value?.profilePicture} alt="" />
            <AvatarFallback className="bg-[#2a2a30] text-[9px] font-bold text-white">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[110px] truncate text-[10px] font-bold font-inter text-white leading-[1.4]">
            {label}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-[#8888a0]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn("w-[280px] rounded-2xl p-2 bg-[#0e0e12]/70", LIQUID_GLASS)}
      >
        <div className={cn("flex items-center gap-2 rounded-full px-2.5 py-2", LIQUID_GLASS_CONTROL)}>
          <Search className="h-3.5 w-3.5 shrink-0 text-[#8888a0]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or mobile"
            className="w-full bg-transparent text-[11px] font-inter text-white placeholder:text-[#6b6b80] outline-none"
          />
          {searching && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#8888a0]" />
          )}
        </div>

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
              setQuery("");
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04] cursor-pointer"
          >
            <X className="h-3.5 w-3.5 shrink-0 text-[#8888a0]" />
            <span className="text-[11px] font-semibold font-inter text-white">
              Use my own link
            </span>
          </button>
        )}

        <div className="mt-2 max-h-[240px] space-y-1 overflow-y-auto">
          {members === null ? (
            <p className="px-2.5 py-3 text-[10px] font-inter text-[#8888a0]">
              Loading members…
            </p>
          ) : candidates.length === 0 ? (
            <p className="px-2.5 py-3 text-[10px] font-inter text-[#8888a0] leading-[1.5]">
              {query.trim()
                ? "Nobody in this organization matches that."
                : "No members to show."}
            </p>
          ) : (
            candidates.map((candidate) => {
              const isActive = candidate.id === value?.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => pick(candidate)}
                  disabled={resolvingId !== null}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer disabled:opacity-60",
                    isActive ? "bg-brand/[0.08]" : "hover:bg-white/[0.04]"
                  )}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={candidate.profilePicture} alt="" />
                    <AvatarFallback className="bg-[#2a2a30] text-[9px] font-bold text-white">
                      {(candidate.name || "?").trim().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold font-inter text-white leading-[1.4]">
                      {candidate.name || candidate.email}
                    </span>
                    {candidate.email && (
                      <span className="block truncate text-[10px] font-inter text-[#8888a0] leading-[1.4]">
                        {candidate.email}
                      </span>
                    )}
                  </span>
                  {resolvingId === candidate.id ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#8888a0]" />
                  ) : isActive ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-brand" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const QR_SIZE = 168;

/**
 * App list → store list → QR. Picking a store reveals its QR inline with the
 * store logo punched into the middle, so it's obvious which listing you're
 * about to land on. ecc=H (30% recoverable) covers the ~21% the logo hides —
 * same trade-off as AffiliateQrShare.
 */
function AppDownloadsPanel() {
  const [openApp, setOpenApp] = useState<string | null>(DOWNLOAD_APPS[0].id);
  const [selected, setSelected] = useState<{ appId: string; store: StoreKey } | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch {
      toast.error("Couldn't copy the link — try again");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-white font-inter">
          Download the apps
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[#8888a0]">
          Pick a store to reveal its QR code, then scan it with your phone camera
          to install.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {DOWNLOAD_APPS.map((app) => {
          const isOpen = openApp === app.id;
          return (
            <div
              key={app.id}
              className="overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#17171d]"
            >
              <button
                type="button"
                onClick={() => setOpenApp(isOpen ? null : app.id)}
                className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2a2a30] bg-[#0e0e12]">
                  <img
                    src={app.iconSrc}
                    alt=""
                    className="h-8 w-8 object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {app.name}
                  </span>
                  <span className="block truncate text-[11px] text-[#8888a0]">
                    {app.tagline}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 flex-shrink-0 text-[#8888a0] transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-1">
                      {(Object.keys(DOWNLOAD_STORES) as StoreKey[]).map((key) => {
                        const store = DOWNLOAD_STORES[key];
                        const url = app.links[key];
                        const rowKey = `${app.id}:${key}`;
                        const isActive =
                          selected?.appId === app.id && selected.store === key;
                        return (
                          <div
                            key={key}
                            className={cn(
                              "overflow-hidden rounded-xl border bg-[#0e0e12] transition-colors",
                              isActive ? "border-brand/40" : "border-[#2a2a30]"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelected(
                                  isActive ? null : { appId: app.id, store: key }
                                )
                              }
                              className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                            >
                              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                                {store.icon}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold text-white">
                                  {store.label}
                                </span>
                                <span className="block text-[10px] text-[#8888a0]">
                                  {store.platform}
                                </span>
                              </span>
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 flex-shrink-0 transition-transform duration-200",
                                  isActive
                                    ? "rotate-90 text-brand"
                                    : "text-[#8888a0]"
                                )}
                              />
                            </button>

                            {isActive && (
                              <div className="flex flex-col items-center gap-3 border-t border-[#2a2a30] px-3 pb-3.5 pt-3.5">
                                <div className="relative rounded-2xl bg-white p-2.5">
                                  <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(
                                      url
                                    )}&margin=8&ecc=H`}
                                    alt={`${app.name} on the ${store.label} — QR code`}
                                    width={QR_SIZE}
                                    height={QR_SIZE}
                                    className="block"
                                    style={{ height: QR_SIZE, width: QR_SIZE }}
                                  />
                                  {/* The app's own icon punched into the centre —
                                      which app you're installing is what the QR
                                      is about; the store is already named by the
                                      row above it. A white ring separates the
                                      dark tile from the code so the finder
                                      pattern still reads. */}
                                  <div
                                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                                    aria-hidden="true"
                                  >
                                    <div className="flex h-[40px] w-[40px] items-center justify-center rounded-xl bg-white p-[3px]">
                                      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-black">
                                        <img
                                          src={app.iconSrc}
                                          alt=""
                                          className="h-full w-full object-contain"
                                        />
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-center text-[10px] leading-[1.4] text-[#8888a0]">
                                  Scan to open {app.name} on the {store.label}
                                </p>
                                <div className="grid w-full grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(rowKey, url)}
                                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#2a2a30] bg-[#1b1b1f] py-2 text-xs font-semibold text-white transition-colors hover:border-brand/40"
                                  >
                                    {copiedKey === rowKey ? (
                                      <>
                                        <Check className="h-3.5 w-3.5 text-brand" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3.5 w-3.5" />
                                        Copy link
                                      </>
                                    )}
                                  </button>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#2a2a30] bg-[#1b1b1f] py-2 text-xs font-semibold text-white transition-colors hover:border-brand/40"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Status & Date Formatting Helpers ----------
const formatLastMessageTime = (timestamp?: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();
  }

  const day = date.getDate();
  const month = date.toLocaleDateString([], { month: "short" });

  let suffix = "th";
  if (day === 1 || day === 21 || day === 31) suffix = "st";
  else if (day === 2 || day === 22) suffix = "nd";
  else if (day === 3 || day === 23) suffix = "rd";

  return `${day}${suffix} ${month}`;
};

const getStatusColor = (lastSeenAt?: string | null) => {
  if (!lastSeenAt) return "bg-[#555] border-[#0e0e12]"; // offline
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 5 * 60 * 1000) return "bg-[#00E676] border-[#0e0e12]"; // active (green)
  return "bg-[#8888a0] border-[#0e0e12]"; // offline (grey)
};

const EmptyChatState = ({
  onStartNew,
  isGroup = false,
  onGroupCreated,
}: {
  onStartNew?: () => void;
  isGroup?: boolean;
  onGroupCreated?: (id: string, name: string) => void;
}) => {
  return (
    <div className="flex flex-col items-center justify-between py-6 px-4 text-center h-full flex-1 min-h-[420px]">
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Graphic Illustration */}
        <div className="relative w-44 h-36 flex items-center justify-center mb-6">
          {/* Back left circle/squircle */}
          <div className="absolute w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 -translate-x-12 -translate-y-2 opacity-50" />

          {/* Back right circle/squircle */}
          <div className="absolute w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 translate-x-12 translate-y-4 opacity-50" />

          {/* Front squircle card (light grey with outline) */}
          <div className="absolute w-28 h-28 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center shadow-xl">
            <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20">
              <MessageSquare className="w-7 h-7 text-brand stroke-[1.8]" />
            </div>
          </div>

          {/* Overlapping small bottom circle with avatar outline */}
          <div className="absolute w-12 h-12 rounded-full bg-[#0e0e12] border border-white/10 translate-y-12 flex items-center justify-center shadow-lg z-10">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-4.5 h-4.5 text-white/70" />
            </div>
          </div>
        </div>

        {/* Text */}
        <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
          Start your first conversation
        </h3>
        <p className="text-xs text-[#8888a0] max-w-[240px] leading-relaxed">
          Connect with network, share moments, and stay in touch - all in one place.
        </p>
      </div>

      {/* Button at the bottom */}
      <div className="w-full px-2 pt-4">
        {isGroup ? (
          <CreateGroupDialog onCreated={onGroupCreated} triggerType="custom">
            <button
              type="button"
              className="w-full py-3 bg-brand hover:bg-brand/95 text-brand-foreground rounded-full font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-[0_2px_8px] shadow-brand/20"
            >
              Start a new chat
            </button>
          </CreateGroupDialog>
        ) : (
          <button
            type="button"
            onClick={onStartNew}
            className="w-full py-3 bg-brand hover:bg-brand/95 text-brand-foreground rounded-full font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-[0_2px_8px] shadow-brand/20"
          >
            Start a new chat
          </button>
        )}
      </div>
    </div>
  );
};

const getDummyPreview = (userId: string) => {
  const previews = [
    "Lorem ipsum dolor sit, consectetur adipiscing...",
    "Aliquam at tortor vel nisi volutpat molestie.",
    "Suspendisse potenti. Curabitur in metus vitae.",
    "Donec sed auctor libero. Cras vitae libero.",
    "Nam sagittis, libero quis elementum malesuada.",
    "Curabitur rhoncus lectus imperdiet, pulvinar...",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % previews.length;
  return previews[idx];
};

// ---------- Props ----------
interface RightPanelProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  activeChatId: { type: "dm" | "group" | "global-dm"; id: string };
  setActiveChatId: (v: {
    type: "dm" | "group" | "global-dm";
    id: string;
  }) => void;
  setActivePopover: (v: string | null) => void;
  width?: number;
  setWidth?: (v: number) => void;
  isDragging?: boolean;
  setIsDragging?: (v: boolean) => void;
  onClose?: () => void;
  activePopover?: string | null;
}

/**
 * Community images for the info panel.
 *
 * The saved cover is cropped to the banner, but this panel is for looking at
 * the community rather than previewing that crop — so it shows the untouched
 * upload when this browser has a record of it (see `lib/coverOriginal`), and
 * contains rather than covers, so nothing is cut off.
 */
export function CommunityImageGallery({
  coverImage,
  galleryImages,
}: {
  coverImage?: string;
  galleryImages: string[];
}) {
  const [cover, setCover] = useState(coverImage || "");
  const [selected, setSelected] = useState<string | null>(null);

  // localStorage is client-only, so start on the saved cover and upgrade to
  // the original after mount — otherwise SSR and the client disagree.
  useEffect(() => {
    if (!coverImage) {
      setCover("");
      return;
    }
    setCover(readCoverOriginal(coverImage)?.url || coverImage);
  }, [coverImage]);

  const images = [cover, ...galleryImages].filter(Boolean);
  if (images.length === 0) return null;
  // `selected` can name the cover that was just swapped for its original.
  const activeImg = selected && images.includes(selected) ? selected : images[0];

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[1.8/1] rounded-xl overflow-hidden border border-[#2a2a35] bg-[#16161e] shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeImg}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeImg}
          alt="Gallery Active"
          className="relative w-full h-full object-contain"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
          {images.map((img) => (
            <button
              key={img}
              onClick={() => setSelected(img)}
              className={cn(
                "w-[64px] h-[44px] rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0",
                activeImg === img
                  ? "border-brand scale-95"
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Component ----------
export default function RightPanel({
  collapsed,
  setCollapsed,
  activeChatId,
  setActiveChatId,
  setActivePopover,
  width,
  setWidth,
  isDragging,
  setIsDragging,
  onClose,
  activePopover,
}: RightPanelProps) {
  const { collapsed: leftSidebarCollapsed } = useSidebarCollapse();
  // Founder of the *currently signed-in* office. Lets the reviews tab offer a
  // delete on any review, not just the viewer's own — see the note where it's
  // passed to ReviewsPanel.
  const { amIFounder } = useAmIFounder();
  const [activeTab, setActiveTab] = useState<RightPanelTab>("chats");
  const [infoData, setInfoData] = useState<{
    type: "commission" | "affiliate" | "members" | "membership" | "view_options" | "orders" | "information" | "sessions" | "enrollments" | "attendees" | "grow_network";
    channel?: Channel;
    workshop?: Workshop;
    product?: Product;
    course?: Course;
    service?: Service;
    itemType?: "channel" | "workshop" | "product" | "course" | "service";
    affiliateId?: string;
  } | null>(null);

  // ── Video Player state ──────────────────────────────
  // Target whose reviews the panel is showing, set by "right-panel:open-reviews".
  const [reviewsData, setReviewsData] = useState<{
    targetType: ReviewTargetType;
    targetId: string;
    title?: string;
  } | null>(null);
  // Chat replay for webinar recordings: the playhead, plus when the egress
  // started (chat is stored separately from the video and re-synced here).
  /**
   * Public links use the office's own verified domain when it has one, so a
   * white-label founder working inside my.garage.app still shares their brand.
   */
  const shareOrigin = useOrgShareOrigin();
  const [replayTime, setReplayTime] = useState(0);
  const [replayStartedAt, setReplayStartedAt] = useState<string | null>(null);

  const [videoPlayerData, setVideoPlayerData] = useState<{
    url: string;
    title: string;
    description?: string;
    thumbnail?: string;
    id?: string;
    type?: "standalone" | "workshop";
    recordingId?: string;
  } | null>(null);
  const [videoShareLink, setVideoShareLink] = useState<string>("");
  const [loadingVideoShareLink, setLoadingVideoShareLink] = useState<boolean>(false);

  // ── Playlist Player state ───────────────────────────
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [activePlaylistVideoIdx, setActivePlaylistVideoIdx] = useState<number>(0);
  const [playlistStreamUrl, setPlaylistStreamUrl] = useState<string | null>(null);
  const [loadingPlaylist, setLoadingPlaylist] = useState<boolean>(false);

  // ── Drops Feed state ────────────────────────────────
  const [dropsFeedData, setDropsFeedData] = useState<{
    drops: Array<{
      _id: string;
      caption: string;
      authorId: { _id: string; name?: string; email: string; profilePicture?: string; avatar?: string };
      videoUrl?: string;
      videoS3Key?: string;
      sourceType: "upload" | "link";
      duration: number;
      thumbnailUrl?: string;
      viewsCount: number;
      likesCount: number;
      sharesCount: number;
      likedByMe?: boolean;
      streamUrl: string | null;
      createdAt: string;
    }>;
    startIndex: number;
  } | null>(null);
  const [dropsCurrentIndex, setDropsCurrentIndex] = useState(0);
  const [dropsLikedIds, setDropsLikedIds] = useState<Set<string>>(new Set());
  const [myAffiliateId, setMyAffiliateId] = useState<string>("");
  const dropsFeedRef = useRef<HTMLDivElement>(null);
  const [scrollRequest, setScrollRequest] = useState<{ index: number; timestamp: number } | null>(null);

  const [activeGalleryImage, setActiveGalleryImage] = useState<string | null>(null);
  const [expandedFaqIdx, setExpandedFaqIdx] = useState<number | null>(null);
  const [fullChannelDetails, setFullChannelDetails] = useState<Channel | null>(null);
  const [loadingFullChannel, setLoadingFullChannel] = useState(false);

  // ── Workshop Drawer state ───────────────────────────
  const [drawerSessions, setDrawerSessions] = useState<any[]>([]);
  const [drawerRegistrations, setDrawerRegistrations] = useState<any[]>([]);
  const [drawerAnalytics, setDrawerAnalytics] = useState<any>(null);
  const [loadingDrawerData, setLoadingDrawerData] = useState<boolean>(false);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState<string>("");
  const [expandedDrawerItem, setExpandedDrawerItem] = useState<string | null>(null);

  // ── Grow Your Network (HQ lobby link) state ─────────
  // Mirrors what GuestFunnelDialog used to fetch, so the panel can show the
  // guest allowance and the white-label link teaser.
  const [growNetGuestCount, setGrowNetGuestCount] = useState<number>(0);
  const [growNetGuestLimit, setGrowNetGuestLimit] = useState<number | null>(25);
  const [growNetLimitReached, setGrowNetLimitReached] = useState<boolean>(false);
  const [growNetIsProPlan, setGrowNetIsProPlan] = useState<boolean>(false);
  // Which landing page the shared link points at. Every option carries the same
  // affiliate id — only the funnel it lands on changes. Null until the viewer
  // picks one: the direct referral rows are what the panel leads with.
  const [growNetLinkKind, setGrowNetLinkKind] =
    useState<GrowNetworkLinkKind | null>(null);
  const authUser = useAuthStore((state) => state.user);
  const [growNetPickerOpen, setGrowNetPickerOpen] = useState(false);
  // Whose code the links carry. Null = the viewer's own.
  const [growNetSharer, setGrowNetSharer] = useState<GrowNetworkSharer | null>(
    null
  );
  // Set when the panel was opened from a specific office — an office card on an
  // affiliate profile, say — so the HQ lobby row points at THAT office instead
  // of whichever org the viewer happens to be sitting in. Cleared on every open
  // without one, or the previous office would leak into the next visit.
  const [growNetHqOverride, setGrowNetHqOverride] = useState<{
    slug: string;
    label?: string;
  } | null>(null);

  // ── Recurring Sessions state for affiliate link share ──
  const [allAffiliateSessions, setAllAffiliateSessions] = useState<WorkshopSession[]>([]);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>("");
  const [loadingAffiliateSessions, setLoadingAffiliateSessions] = useState<boolean>(false);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1); // 1-12

  // Helper date formatting functions
  const formatTime12Hour = (time24: string): string => {
    if (!time24) return "12:00 AM";
    const [hoursStr, minutesStr] = time24.split(":");
    const hours = parseInt(hoursStr, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutesStr} ${ampm}`;
  };

  const getTimezoneAbbr = (tz?: string): string => {
    if (!tz) return "UTC";
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value || tz;
    } catch {
      return tz;
    }
  };

  const timeAgo = (dateString?: string) => {
    if (!dateString) return "5 days ago";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "5 days ago";
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (seconds < 60) return "Just now";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      const months = Math.floor(days / 30);
      if (months < 12) return `${months}mo ago`;
      const years = Math.floor(months / 12);
      return `${years}y ago`;
    } catch {
      return "5 days ago";
    }
  };

  // Fetch workshop drawer details when activeTab or infoData changes
  useEffect(() => {
    if (!infoData || infoData.itemType !== "workshop" || !infoData.workshop?._id) {
      return;
    }
    const workshopId = infoData.workshop._id;
    const orgId = localStorage.getItem("garage_org_id") || "";

    const fetchWorkshopDrawerData = async () => {
      setLoadingDrawerData(true);
      try {
        if (activeTab === "sessions") {
          if (infoData.workshop.isRecurring) {
            const result = await getRecurringWorkshopAnalytics(workshopId, orgId, {
              limit: 50,
              includePast: true,
            });
            if (result && result.sessions) {
              setDrawerSessions(result.sessions);
            } else {
              setDrawerSessions([]);
            }
          } else {
            const wDate = infoData.workshop.date ? new Date(infoData.workshop.date) : new Date();
            setDrawerSessions([
              {
                sessionDate: wDate,
                workshopTitle: infoData.workshop.title,
                totalEnrollments: infoData.workshop.registeredParticipantsCount || 0,
                totalAttended: infoData.workshop.attendeesCount || 0,
                totalRevenue: infoData.workshop.totalRevenueUSD || 0,
                currency: infoData.workshop.currency || "USD",
                recordingReady: false,
              }
            ]);
          }
        } else if (activeTab === "enrollments") {
          const regs = await getWorkshopRegistrations(workshopId, orgId);
          setDrawerRegistrations(regs?.registrations || []);
        } else if (activeTab === "attendees") {
          const regs = await getWorkshopRegistrations(workshopId, orgId);
          setDrawerRegistrations(regs?.registrations || []);
          const analyticsResult = await getWorkshopAnalytics(workshopId, orgId);
          if (analyticsResult && analyticsResult.analytics) {
            setDrawerAnalytics(analyticsResult.analytics);
          }
        }
      } catch (err) {
        console.error("Error fetching right panel workshop details:", err);
      } finally {
        setLoadingDrawerData(false);
      }
    };

    fetchWorkshopDrawerData();
  }, [infoData, activeTab]);

  useEffect(() => {
    setActiveGalleryImage(null);
    setExpandedFaqIdx(null);
  }, [infoData]);

  // Fetch recurring sessions when infoData changes and is a recurring workshop
  useEffect(() => {
    if (!infoData || infoData.itemType !== "workshop" || !infoData.workshop?._id || !infoData.workshop.isRecurring) {
      setAllAffiliateSessions([]);
      setSelectedSessionDate("");
      return;
    }

    const fetchSessionsForAffiliate = async () => {
      setLoadingAffiliateSessions(true);
      try {
        const result = await getWorkshopSessions(infoData.workshop._id, { limit: 150, includePast: false });
        if (result && result.sessions) {
          // Filter out completed sessions
          const activeSessions = result.sessions.filter((s: WorkshopSession) => !s.isPast);
          setAllAffiliateSessions(activeSessions);

          if (activeSessions.length > 0) {
            const firstSessionDate = new Date(activeSessions[0].startDateTime);
            const dateInTz = infoData.workshop.timezone
              ? new Date(firstSessionDate.toLocaleString("en-US", { timeZone: infoData.workshop.timezone }))
              : firstSessionDate;
            setCurrentMonth(dateInTz.getMonth() + 1);
            setCurrentYear(dateInTz.getFullYear());
          } else {
            const today = new Date();
            setCurrentMonth(today.getMonth() + 1);
            setCurrentYear(today.getFullYear());
          }
        } else {
          setAllAffiliateSessions([]);
        }
      } catch (err) {
        console.error("Error fetching sessions for affiliate:", err);
        setAllAffiliateSessions([]);
      } finally {
        setLoadingAffiliateSessions(false);
      }
    };

    fetchSessionsForAffiliate();
  }, [infoData]);

  // Resolve active video details based on activeTab
  const activePlaylistVideo = currentPlaylist?.videos?.[activePlaylistVideoIdx];
  const targetVideoId = activeTab === "playlist_player" ? activePlaylistVideo?._id : videoPlayerData?.id;
  const targetVideoType = activeTab === "playlist_player" ? (activePlaylistVideo?._videoSource as "workshop" | "standalone" | undefined || "standalone") : videoPlayerData?.type;
  const targetRecordingId = activeTab === "playlist_player" ? undefined : videoPlayerData?.recordingId;
  const targetVideoDate = activeTab === "playlist_player" ? (activePlaylistVideo as any)?.createdAt || (activePlaylistVideo as any)?.date : (videoPlayerData as any)?.date;

  const [videoSummary, setVideoSummary] = useState<any>(null);
  const [videoSummaryLoading, setVideoSummaryLoading] = useState(false);

  // Fetch share link when targetVideoId, targetVideoType or playlistId changes
  useEffect(() => {
    const isPlaylistMode = activeTab === "playlist_player";
    if (isPlaylistMode) {
      if (!playlistId) {
        setVideoShareLink("");
        return;
      }
    } else {
      if (!targetVideoId || !targetVideoType) {
        setVideoShareLink("");
        return;
      }
    }

    let active = true;
    const fetchShareLink = async () => {
      setLoadingVideoShareLink(true);
      try {
        const orgId = localStorage.getItem("garage_org_id") || "";
        if (isPlaylistMode && playlistId) {
          const res = await getPlaylistShareLink(playlistId, orgId);
          if (active) {
            setVideoShareLink(res.shareLink || "");
          }
        } else if (targetVideoId && targetVideoType) {
          const realId = targetVideoId.includes("__") ? targetVideoId.split("__")[0] : targetVideoId;
          // When the opener didn't hand us a recordingId, getVideoShareLink
          // resolves the workshop's newest recording itself so the link lands
          // on the playable /recording/:recordingId page.
          const recordingId = targetRecordingId || (targetVideoId.includes("__") ? targetVideoId.split("__")[1] : undefined);
          const res = await getVideoShareLink(
            realId,
            orgId,
            targetVideoType,
            recordingId
          );
          if (active) {
            setVideoShareLink(res.shareLink || "");
          }
        }
      } catch (err) {
        console.error("Error fetching share link:", err);
      } finally {
        if (active) {
          setLoadingVideoShareLink(false);
        }
      }
    };
    fetchShareLink();
    return () => {
      active = false;
    };
  }, [targetVideoId, targetVideoType, targetRecordingId, activeTab, playlistId]);

  // Fetch video AI summary when targetVideoId changes (for workshop type)
  useEffect(() => {
    const isWorkshop = targetVideoType === "workshop";
    if (!targetVideoId || !isWorkshop) {
      setVideoSummary(null);
      setVideoSummaryLoading(false);
      return;
    }

    let active = true;
    const fetchSummary = async () => {
      setVideoSummaryLoading(true);
      try {
        const token = getToken() || "";
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const realId = targetVideoId.includes("__") ? targetVideoId.split("__")[0] : targetVideoId;
        const res = await fetch(
          `${API_URL}/note-taker/by-workshop/${encodeURIComponent(realId)}/summary`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (!res.ok) {
          throw new Error("Summary not found");
        }
        const data = await res.json();
        if (active) {
          setVideoSummary(data);
        }
      } catch (err) {
        console.error("Error fetching video summary:", err);
        if (active) {
          setVideoSummary(null);
        }
      } finally {
        if (active) {
          setVideoSummaryLoading(false);
        }
      }
    };

    fetchSummary();
    return () => {
      active = false;
    };
  }, [targetVideoId, targetVideoType]);

  const handleAddVideoToPlaylist = async () => {
    if (!targetVideoId || !targetVideoType) return;
    try {
      const realId = targetVideoId.includes("__") ? targetVideoId.split("__")[0] : targetVideoId;
      const videoEntry = {
        videoSource: targetVideoType,
        videoId: realId
      };
      await quickAddToPlaylist(videoEntry);
      toast.success("Added to My Playlist!");
    } catch (err) {
      console.error("Failed to add video to playlist:", err);
      toast.error("Failed to add to playlist");
    }
  };

  const loadPlaylistVideoStreamUrl = async (video: any) => {
    try {
      if (video._videoSource === "workshop") {
        const token = getToken() || "";
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const res = await fetch(`${apiUrl}/webinar/${video._id}/recordings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          return null;
        }
        const data = await res.json();
        const rec = data.recordings?.[0];
        return rec?.streamUrl || rec?.downloadUrl || null;
      } else if (video.videoS3Key) {
        const streamFn = video._videoSource === "standalone" ? getStandaloneVideoStreamUrl : getCourseVideoStreamUrl;
        const result = await streamFn(video.videoS3Key);
        return result.url;
      } else if (video.videoUrl) {
        return video.videoUrl;
      }
    } catch (err) {
      console.error("Failed to load playlist video stream URL:", err);
    }
    return null;
  };

  // Fetch playlist details
  useEffect(() => {
    if (!playlistId) {
      setCurrentPlaylist(null);
      return;
    }
    let active = true;
    const fetchDetails = async () => {
      setLoadingPlaylist(true);
      try {
        const res = await getPlaylist(playlistId);
        if (active && res?.playlist) {
          setCurrentPlaylist(res.playlist);
          setActivePlaylistVideoIdx(0);
        }
      } catch (err) {
        console.error("Failed to load playlist details:", err);
      } finally {
        if (active) setLoadingPlaylist(false);
      }
    };
    fetchDetails();
    return () => {
      active = false;
    };
  }, [playlistId]);

  // Fetch stream URL for the active video in playlist
  useEffect(() => {
    const videos = currentPlaylist?.videos || [];
    const activeVideo = videos[activePlaylistVideoIdx];
    if (!activeVideo) {
      setPlaylistStreamUrl(null);
      return;
    }
    let active = true;
    const fetchStream = async () => {
      const url = await loadPlaylistVideoStreamUrl(activeVideo);
      if (active) {
        setPlaylistStreamUrl(url);
      }
    };
    fetchStream();
    return () => {
      active = false;
    };
  }, [currentPlaylist, activePlaylistVideoIdx]);

  // Membership details state
  const [membershipDetails, setMembershipDetails] = useState<{
    isFree: boolean;
    status: string;
    hasAccess?: boolean;
    joinedAt?: string;
    lastBillingDate?: string;
    nextBillingDate?: string;
    amount?: number;
    currency?: string;
    period?: string;
  } | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);
  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false);

  const [orgDetails, setOrgDetails] = useState<{ name: string; slug?: string } | null>(null);
  const [plan, setPlan] = useState<CombPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const [channelMembers, setChannelMembers] = useState<ChannelSubscriber[]>([]);
  const [loadingChannelMembers, setLoadingChannelMembers] = useState(false);
  const [channelMembersSearch, setChannelMembersSearch] = useState("");
  const [totalChannelMembers, setTotalChannelMembers] = useState(0);
  const [hasMoreChannelMembers, setHasMoreChannelMembers] = useState(false);
  const [loadingMoreChannelMembers, setLoadingMoreChannelMembers] = useState(false);
  const [channelMembersOffset, setChannelMembersOffset] = useState(0);

  // Fetch channel members when infoData changes with type "members" or "orders"
  useEffect(() => {
    if ((infoData?.type === "members" || infoData?.type === "orders") && infoData.channel?._id) {
      setLoadingChannelMembers(true);
      setChannelMembersOffset(0);
      const orgId = localStorage.getItem("garage_org_id") || "";
      getChannelSubscribers(infoData.channel._id, orgId, { limit: 50, offset: 0 })
        .then((result) => {
          if (result?.subscribers) {
            setChannelMembers(result.subscribers);
            setTotalChannelMembers(result.total || 0);
            setHasMoreChannelMembers(result.pagination?.hasMore || false);
          } else {
            setChannelMembers([]);
            setTotalChannelMembers(0);
            setHasMoreChannelMembers(false);
          }
        })
        .catch((err) => {
          console.error("Error loading channel subscribers in RightPanel:", err);
          setChannelMembers([]);
          setTotalChannelMembers(0);
          setHasMoreChannelMembers(false);
          toast.error(err.message || "Failed to load community members. Make sure you are joined!");
        })
        .finally(() => {
          setLoadingChannelMembers(false);
        });
    } else {
      setChannelMembers([]);
      setTotalChannelMembers(0);
      setHasMoreChannelMembers(false);
      setChannelMembersOffset(0);
      setChannelMembersSearch("");
    }
  }, [infoData]);

  const handleLoadMoreMembers = async () => {
    if (!infoData || !infoData.channel?._id || loadingMoreChannelMembers || !hasMoreChannelMembers) return;
    setLoadingMoreChannelMembers(true);
    const orgId = localStorage.getItem("garage_org_id") || "";
    const nextOffset = channelMembersOffset + 50;
    try {
      const result = await getChannelSubscribers(infoData.channel._id, orgId, {
        limit: 50,
        offset: nextOffset,
      });
      if (result?.subscribers) {
        setChannelMembers((prev) => [...prev, ...result.subscribers]);
        setTotalChannelMembers(result.total || 0);
        setHasMoreChannelMembers(result.pagination?.hasMore || false);
        setChannelMembersOffset(nextOffset);
      }
    } catch (err: any) {
      console.error("Error loading more channel subscribers:", err);
      toast.error(err.message || "Failed to load more members");
    } finally {
      setLoadingMoreChannelMembers(false);
    }
  };

  // Fetch membership details when infoData changes with type "membership" or "information"
  useEffect(() => {
    if ((infoData?.type === "membership" || infoData?.type === "information") && infoData.channel?._id) {
      setLoadingMembership(true);
      setMembershipDetails(null);
      const orgId = localStorage.getItem("garage_org_id") || "";
      getChannelMembershipDetails(infoData.channel._id, orgId)
        .then((result) => {
          const channel = infoData.channel;
          const isFreeChannel = channel.isFree || (!channel.price || channel.price === 0);
          setMembershipDetails({
            isFree: isFreeChannel,
            status: result.status,
            hasAccess: result.hasAccess,
            joinedAt: result.joinedAt,
            lastBillingDate: result.lastBillingDate || (!isFreeChannel ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() : undefined),
            nextBillingDate: result.nextBillingDate || (!isFreeChannel ? new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString() : undefined),
            amount: result.amount || channel.price,
            currency: result.currency || channel.currency,
            period: result.period || channel.subscriptionPeriod,
          });
        })
        .catch((err) => {
          console.error("Error loading membership details in RightPanel:", err);
          setMembershipDetails(null);
        })
        .finally(() => {
          setLoadingMembership(false);
        });
    } else if (infoData?.type !== "membership") {
      setMembershipDetails(null);
    }
  }, [infoData]);

  // Fetch org details for the referral link
  useEffect(() => {
    async function fetchOrgDetails() {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) return;

        const response = await api<{
          org: { name: string; slug?: string };
        }>(`/org/${orgId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (response.org) {
          setOrgDetails(response.org);
        }
      } catch (err) {
        console.error("Error fetching org details in RightPanel:", err);
      }
    }
    fetchOrgDetails();
  }, []);

  // Fetch guest allowance for the "Grow Your Network" panel
  useEffect(() => {
    if (infoData?.type !== "grow_network") return;
    const orgId = typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null;
    if (!orgId) return;

    let cancelled = false;

    async function checkGuestLimit() {
      try {
        const response = await api<{
          ok: boolean;
          guestCount: number;
          guestLimit: number | null;
          limitReached: boolean;
          planType?: string;
        }>(`/guest-auth/guest-limit-status?orgId=${orgId}`);
        if (cancelled || !response?.ok) return;
        setGrowNetLimitReached(response.limitReached);
        setGrowNetGuestCount(response.guestCount);
        setGrowNetGuestLimit(response.guestLimit);
        setGrowNetIsProPlan(response.planType === "pro");
      } catch (err) {
        console.error("Error checking guest limit in RightPanel:", err);
      }
    }

    checkGuestLimit();
    return () => {
      cancelled = true;
    };
  }, [infoData]);

  // Fetch user's affiliate ID
  useEffect(() => {
    async function fetchAffiliateId() {
      try {
        const response = await api<{ affiliateId: string }>("/affiliate/my-affiliate-id", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (response?.affiliateId) {
          setMyAffiliateId(response.affiliateId);
        }
      } catch (err) {
        console.error("Error fetching affiliate ID in RightPanel:", err);
      }
    }
    fetchAffiliateId();
  }, []);

  // Clear infoData and switch tab back to default when collapsed is set to true (panel closed)
  useEffect(() => {
    if (collapsed) {
      setInfoData(null);
      setVideoPlayerData(null);
      setDropsFeedData(null);
      setPlaylistId(null);
      setCurrentPlaylist(null);
      setPlaylistStreamUrl(null);
      setShowUnsubscribeConfirm(false);
      setReviewsData(null);
      if (activeTab === "information" || activeTab === "members" || activeTab === "view_options" || activeTab === "orders" || activeTab === "video_player" || activeTab === "drops_feed" || activeTab === "playlist_player" || activeTab === "sessions" || activeTab === "enrollments" || activeTab === "attendees" || activeTab === "reviews") {
        setActiveTab("chats");
      }
    }
  }, [collapsed, activeTab]);

  // Fetch full channel details (including benefits, faqs, aboutText, galleryImages) when channel ID changes
  useEffect(() => {
    const channelId = infoData?.channel?._id;
    if (!channelId) {
      setFullChannelDetails(null);
      return;
    }

    setLoadingFullChannel(true);
    const orgId = localStorage.getItem("garage_org_id") || "";

    getChannelWithStats(channelId, orgId)
      .then((result) => {
        if (result?.channel) {
          setFullChannelDetails(result.channel);
        } else {
          setFullChannelDetails(infoData.channel);
        }
      })
      .catch((err) => {
        console.error("Error loading full channel details in RightPanel:", err);
        setFullChannelDetails(infoData.channel);
      })
      .finally(() => {
        setLoadingFullChannel(false);
      });
  }, [infoData?.channel?._id]);

  // Clear infoData when switching to any other tab
  useEffect(() => {
    if (activeTab !== "information" && activeTab !== "members" && activeTab !== "view_options" && activeTab !== "orders" && activeTab !== "sessions" && activeTab !== "enrollments" && activeTab !== "attendees" && infoData !== null) {
      setInfoData(null);
      setShowUnsubscribeConfirm(false);
    }
    if (activeTab !== "video_player" && videoPlayerData !== null) {
      setVideoPlayerData(null);
    }
    if (activeTab !== "drops_feed" && dropsFeedData !== null) {
      setDropsFeedData(null);
    }
  }, [activeTab, infoData, videoPlayerData, dropsFeedData]);

  // Dispatch event to toggle center backdrop tint based on information tab state
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("right-panel:toggle-tint", {
      detail: { tint: infoData !== null }
    }));
    return () => {
      window.dispatchEvent(new CustomEvent("right-panel:toggle-tint", {
        detail: { tint: false }
      }));
    };
  }, [infoData]);

  // Fetch commission plan when infoData changes
  useEffect(() => {
    if (infoData?.type === "commission" || infoData?.type === "affiliate") {
      setLoadingPlan(true);
      const itemType = infoData.itemType || (infoData.course ? "course" : infoData.product ? "product" : infoData.service ? "service" : (!infoData.channel && infoData.workshop) ? "workshop" : "channel");
      const itemId = itemType === "workshop"
        ? infoData.workshop?._id
        : itemType === "product"
          ? infoData.product?._id
          : itemType === "course"
            ? infoData.course?._id
            : itemType === "service"
              ? infoData.service?._id
              : infoData.channel?._id;
      if (itemId) {
        getCombPlanForItem(itemType as any, itemId)
          .then((res) => {
            if (res?.plan) {
              setPlan(res.plan);
            } else {
              setPlan(null);
            }
          })
          .catch(() => setPlan(null))
          .finally(() => setLoadingPlan(false));
      } else {
        setPlan(null);
        setLoadingPlan(false);
      }
    } else {
      setPlan(null);
    }
  }, [infoData]);

  // Listen to open-information custom event
  useEffect(() => {
    const handleOpenInformation = (e: Event) => {
      const customEvent = e as CustomEvent<{
        type: "commission" | "affiliate" | "members" | "membership" | "view_options" | "orders" | "information" | "sessions" | "enrollments" | "attendees" | "grow_network";
        channel?: Channel;
        workshop?: Workshop;
        product?: Product;
        service?: Service;
        itemType?: "channel" | "workshop" | "product" | "service";
        affiliateId?: string;
        /** Preselects a landing page, and which office the HQ row points at. */
        growNetwork?: {
          kind?: GrowNetworkLinkKind;
          hqSlug?: string;
          hqLabel?: string;
        };
      }>;
      if (customEvent.detail) {
        setInfoData(customEvent.detail);
        if (customEvent.detail.type === "grow_network") {
          // Applied on every open, including the plain one from the sidebar, so
          // the panel never reopens still showing the office it was last
          // launched from.
          const preset = customEvent.detail.growNetwork;
          setGrowNetLinkKind(preset?.kind ?? null);
          setGrowNetHqOverride(
            preset?.hqSlug
              ? { slug: preset.hqSlug, label: preset.hqLabel }
              : null
          );
          setGrowNetPickerOpen(false);
        }
        if (customEvent.detail.type === "members") {
          setActiveTab("members");
        } else if (customEvent.detail.type === "view_options") {
          setActiveTab("view_options");
        } else if (customEvent.detail.type === "orders") {
          setActiveTab("orders");
        } else if (customEvent.detail.type === "sessions") {
          setActiveTab("sessions");
        } else if (customEvent.detail.type === "enrollments") {
          setActiveTab("enrollments");
        } else if (customEvent.detail.type === "attendees") {
          setActiveTab("attendees");
        } else {
          setActiveTab("information");
        }
      }
    };

    // Listen for video player open events
    const handleOpenVideoPlayer = (e: Event) => {
      const customEvent = e as CustomEvent<{
        url: string;
        title: string;
        description?: string;
        thumbnail?: string;
        id?: string;
        type?: "standalone" | "workshop";
        recordingId?: string;
      }>;
      if (customEvent.detail) {
        setVideoPlayerData(customEvent.detail);
        // Reset the chat replay, then resolve when this recording actually
        // started — the caller only hands us a playback URL.
        setReplayTime(0);
        setReplayStartedAt(
          (customEvent.detail as any).startedAt ?? null,
        );
        setInfoData(null);
        setDropsFeedData(null);
        setActiveTab("video_player");
        setCollapsed(false);
      }
    };

    // Listen for drops feed open events
    const handleOpenDropsFeed = (e: Event) => {
      const customEvent = e as CustomEvent<{
        drops: any[];
        startIndex: number;
      }>;
      if (customEvent.detail) {
        setDropsFeedData(customEvent.detail);
        // Seed liked state from the server so the heart survives a
        // refresh — otherwise re-liking counts a second time.
        setDropsLikedIds(
          new Set(
            (customEvent.detail.drops || [])
              .filter((d: any) => d?.likedByMe)
              .map((d: any) => d._id as string)
          )
        );
        setDropsCurrentIndex(customEvent.detail.startIndex || 0);
        setScrollRequest({ index: customEvent.detail.startIndex || 0, timestamp: Date.now() });
        setInfoData(null);
        setVideoPlayerData(null);
        setActiveTab("drops_feed");
        setCollapsed(false);
      }
    };

    const handleOpenPlaylist = (e: Event) => {
      const customEvent = e as CustomEvent<{
        playlistId: string;
      }>;
      if (customEvent.detail?.playlistId) {
        setPlaylistId(customEvent.detail.playlistId);
        setCurrentPlaylist(null);
        setActivePlaylistVideoIdx(0);
        setPlaylistStreamUrl(null);
        setInfoData(null);
        setVideoPlayerData(null);
        setDropsFeedData(null);
        setActiveTab("playlist_player");
        setCollapsed(false);
      }
    };

    // Listen for reviews open events ("See all" on a card or community page)
    const handleOpenReviews = (e: Event) => {
      const customEvent = e as CustomEvent<{
        targetType: ReviewTargetType;
        targetId: string;
        title?: string;
      }>;
      if (customEvent.detail?.targetId) {
        setReviewsData(customEvent.detail);
        setInfoData(null);
        setVideoPlayerData(null);
        setDropsFeedData(null);
        setActiveTab("reviews");
        setCollapsed(false);
      }
    };

    window.addEventListener("right-panel:open-information", handleOpenInformation);
    window.addEventListener("right-panel:open-video-player", handleOpenVideoPlayer);
    window.addEventListener("right-panel:open-playlist", handleOpenPlaylist);
    window.addEventListener("right-panel:open-drops-feed", handleOpenDropsFeed);
    window.addEventListener("right-panel:open-reviews", handleOpenReviews);
    return () => {
      window.removeEventListener("right-panel:open-information", handleOpenInformation);
      window.removeEventListener("right-panel:open-video-player", handleOpenVideoPlayer);
      window.removeEventListener("right-panel:open-playlist", handleOpenPlaylist);
      window.removeEventListener("right-panel:open-drops-feed", handleOpenDropsFeed);
      window.removeEventListener("right-panel:open-reviews", handleOpenReviews);
    };
  }, []);

  // IntersectionObserver to detect active slide in drops feed
  const isScrollingRef = useRef(false);
  useEffect(() => {
    if (activeTab !== "drops_feed" || !dropsFeedData) return;
    const container = dropsFeedRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Ignore observer firings during programmatic scroll-to-index
        if (isScrollingRef.current) return;
        // Pick the entry with the highest intersection ratio from this batch
        // to avoid off-by-one when multiple slides are simultaneously visible
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(idx) && (!best || entry.intersectionRatio > best.ratio)) {
              best = { idx, ratio: entry.intersectionRatio };
            }
          }
        }
        if (best !== null) {
          setDropsCurrentIndex(best.idx);
        }
      },
      { root: container, threshold: [0.5, 0.75, 1.0] }
    );
    const slots = container.querySelectorAll("[data-index]");
    slots.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [dropsFeedData, activeTab]);

  // Keyboard navigation for drops in sidebar
  useEffect(() => {
    if (activeTab !== "drops_feed" || !dropsFeedData) return;
    const handle = (e: KeyboardEvent) => {
      const container = dropsFeedRef.current;
      if (!container) return;
      let target = -1;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        target = Math.min(dropsCurrentIndex + 1, dropsFeedData.drops.length - 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        target = Math.max(dropsCurrentIndex - 1, 0);
      }
      if (target >= 0) {
        const el = container.querySelector(`[data-index="${target}"]`);
        el?.scrollIntoView({ behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [dropsCurrentIndex, dropsFeedData, activeTab]);

  // Scroll to initial index when opening drops feed
  useEffect(() => {
    if (activeTab === "drops_feed" && dropsFeedData && scrollRequest) {
      // Guard: suppress IntersectionObserver updates while we programmatically scroll
      isScrollingRef.current = true;
      const container = dropsFeedRef.current;
      const el = container?.querySelector(`[data-index="${scrollRequest.index}"]`);
      if (el) {
        el.scrollIntoView({ block: "start", inline: "nearest" });
      }
      // Allow observer to resume after scroll-snap has settled (~300ms)
      const t = setTimeout(() => { isScrollingRef.current = false; }, 300);
      return () => clearTimeout(t);
    }
  }, [activeTab, dropsFeedData, scrollRequest]);

  const navigateToDrop = (index: number) => {
    if (!dropsFeedData) return;
    const clamped = Math.max(0, Math.min(index, dropsFeedData.drops.length - 1));
    const container = dropsFeedRef.current;
    const el = container?.querySelector(`[data-index="${clamped}"]`);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const handleView = (id: string) => {
    api(`/drops/${id}/view`, { method: "POST" }, getToken()!).catch(() => { });
  };

  const renderSessionsTabContent = () => {
    if (loadingDrawerData) {
      return (
        <div className="flex-grow flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-2" />
          <p className="text-sm text-[#9fa0b8]">Loading sessions...</p>
        </div>
      );
    }
    const workshop = infoData?.workshop;
    if (!workshop) return null;

    return (
      <div className="flex-grow flex flex-col min-h-0">
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <h2 className="text-2xl font-extrabold tracking-tight"># Sessions</h2>
          <span className="px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-xs text-[#9fa0b8] font-medium">
            {drawerSessions.length} total
          </span>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b6b7b] mb-4 shrink-0">
          Previous Sessions
        </h3>

        {drawerSessions.length === 0 ? (
          <div className="text-center py-12 text-[#6b6b7b] text-sm bg-[#111114] border border-[#1f1f2a] rounded-xl">
            No sessions found for this live stream.
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto pr-1">
            {drawerSessions.map((session, index) => {
              const sDate = session.sessionDate ? new Date(session.sessionDate) : new Date();
              const formattedDate = format(sDate, "EEE, MMM d");
              const formattedTime = formatTime12Hour(workshop.startTime || "00:00");
              const tz = getTimezoneAbbr(workshop.timezone);
              const isExpanded = expandedDrawerItem === `session-${index}`;

              const agendaTitle = workshop.agenda?.[index]?.title ||
                `Session ${index + 1}: ${workshop.title}`;

              return (
                <div
                  key={index}
                  className="border border-[#1f1f2a] rounded-xl bg-[#0e0e12] overflow-hidden transition-all duration-200"
                >
                  <div
                    onClick={() => setExpandedDrawerItem(isExpanded ? null : `session-${index}`)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.01] transition-colors"
                  >
                    <div>
                      <h4 className="font-semibold text-base text-white">{agendaTitle}</h4>
                      <p className="text-xs text-[#6b6b7b] mt-1">
                        {formattedDate} • {formattedTime} • {tz}
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-[#6b6b7b] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-5 pt-1 border-t border-[#1f1f2a]/50 bg-[#111116]/50">
                      <div className="grid grid-cols-4 gap-4 text-center sm:text-left mt-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#6b6b7b] block mb-1">
                            Enrollments
                          </span>
                          <span className="text-sm font-extrabold text-white">
                            {(session.totalEnrollments || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#6b6b7b] block mb-1">
                            Attendees
                          </span>
                          <span className="text-sm font-extrabold text-white">
                            {(session.totalAttended || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#6b6b7b] block mb-1">
                            Revenue
                          </span>
                          <span className="text-sm font-extrabold text-white">
                            ${(session.totalRevenue || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#6b6b7b] block mb-1">
                            Recording
                          </span>
                          {session.recordingUrl ? (
                            <a
                              href={session.recordingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#3b82f6] hover:underline font-bold block mt-0.5"
                            >
                              Ready
                            </a>
                          ) : (
                            <span className="text-xs text-[#6b6b7b] font-medium block mt-0.5">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderEnrollmentsTabContent = () => {
    if (loadingDrawerData) {
      return (
        <div className="flex-grow flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-2" />
          <p className="text-sm text-[#9fa0b8]">Loading enrollments...</p>
        </div>
      );
    }
    const filteredList = drawerRegistrations.filter(reg => {
      const u = reg.userId || {};
      const name = u.name || "";
      const email = u.email || "";
      return name.toLowerCase().includes(drawerSearchQuery.toLowerCase()) ||
        email.toLowerCase().includes(drawerSearchQuery.toLowerCase());
    });

    return (
      <div className="flex-grow flex flex-col min-h-0 h-full">
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <h2 className="text-2xl font-extrabold tracking-tight">Enrollments</h2>
          <span className="px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-xs text-[#9fa0b8] font-medium">
            {drawerRegistrations.length} Members
          </span>
        </div>

        <div className="relative mb-5 shrink-0">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6b6b7b]" />
          <input
            type="text"
            placeholder="Search attendees..."
            value={drawerSearchQuery}
            onChange={(e) => setDrawerSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#111114] border border-[#1f1f2a] rounded-xl text-white placeholder-[#6b6b7b] text-sm focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>

        <div className="flex-grow overflow-y-auto space-y-2 pr-1 min-h-0">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-[#6b6b7b] text-sm bg-[#111114] border border-[#1f1f2a] rounded-xl">
              No enrolled members found matching query.
            </div>
          ) : (
            filteredList.map((reg) => {
              const u = reg.userId || {};
              const name = u.name || "Unknown Member";
              const email = u.email || "—";
              const profilePic = u.profilePicture;
              const isExpanded = expandedDrawerItem === `enroll-${reg._id}`;
              const enrolTime = reg.registeredAt ? format(new Date(reg.registeredAt), "dd/MM/yyyy • h:mm a") : "—";

              return (
                <div
                  key={reg._id}
                  className="border border-[#1f1f2a] rounded-xl bg-[#0e0e12] overflow-hidden transition-all duration-200"
                >
                  <div
                    onClick={() => setExpandedDrawerItem(isExpanded ? null : `enroll-${reg._id}`)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.01]"
                  >
                    <div className="flex items-center gap-3">
                      {profilePic ? (
                        <img src={profilePic} alt={name} className="w-10 h-10 rounded-full object-cover border border-[#2a2a35]" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#1c1c24] text-brand flex items-center justify-center font-bold text-sm border border-[#2a2a35]">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-sm text-white">{name}</h4>
                        <p className="text-xs text-[#6b6b7b] mt-0.5">{email}</p>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-[#6b6b7b] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-5 pt-2 border-t border-[#1f1f2a]/50 bg-[#111116]/50 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        {u._id && (
                          <button
                            onClick={() => openMini("dm", u._id, name, profilePic)}
                            className="p-2 bg-[#1a1a22] border border-[#2a2a35] hover:bg-[#252530] text-[#9fa0b8] hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Message"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 bg-[#1c1c24] border border-[#2a2a35] text-xs font-semibold text-[#9fa0b8] rounded-xl">
                          Enrolled: {enrolTime}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderAttendeesTabContent = () => {
    if (loadingDrawerData) {
      return (
        <div className="flex-grow flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-2" />
          <p className="text-sm text-[#9fa0b8]">Loading attendees...</p>
        </div>
      );
    }
    const filteredList = drawerRegistrations.filter(reg => {
      const u = reg.userId || {};
      const name = u.name || "";
      const email = u.email || "";
      return name.toLowerCase().includes(drawerSearchQuery.toLowerCase()) ||
        email.toLowerCase().includes(drawerSearchQuery.toLowerCase());
    });

    return (
      <div className="flex-grow flex flex-col min-h-0 h-full">
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <h2 className="text-2xl font-extrabold tracking-tight">Attendees</h2>
          <span className="px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-xs text-[#9fa0b8] font-medium">
            {drawerRegistrations.filter(r => r.status === "attended" || drawerAnalytics?.participants?.find((p: any) => p.userId === r.userId?._id)?.attended).length} Members
          </span>
        </div>

        <div className="relative mb-5 shrink-0">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6b6b7b]" />
          <input
            type="text"
            placeholder="Search attendees..."
            value={drawerSearchQuery}
            onChange={(e) => setDrawerSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#111114] border border-[#1f1f2a] rounded-xl text-white placeholder-[#6b6b7b] text-sm focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>

        <div className="flex-grow overflow-y-auto space-y-2 pr-1 min-h-0">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-[#6b6b7b] text-sm bg-[#111114] border border-[#1f1f2a] rounded-xl">
              No attendees found matching query.
            </div>
          ) : (
            filteredList.map((reg) => {
              const u = reg.userId || {};
              const name = u.name || "Unknown Member";
              const email = u.email || "—";
              const profilePic = u.profilePicture;
              const isExpanded = expandedDrawerItem === `attend-${reg._id}`;

              const participantDetail = drawerAnalytics?.participants?.find((p: any) => p.userId === u._id);

              const inTime = participantDetail?.joinedMeetingAt
                ? format(new Date(participantDetail.joinedMeetingAt), "dd/MM/yyyy • h:mm a")
                : "—";
              const outTime = participantDetail?.leftMeetingAt
                ? format(new Date(participantDetail.leftMeetingAt), "dd/MM/yyyy • h:mm a")
                : "—";
              const duration = participantDetail?.durationInMeeting;

              return (
                <div
                  key={reg._id}
                  className="border border-[#1f1f2a] rounded-xl bg-[#0e0e12] overflow-hidden transition-all duration-200"
                >
                  <div
                    onClick={() => setExpandedDrawerItem(isExpanded ? null : `attend-${reg._id}`)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.01]"
                  >
                    <div className="flex items-center gap-3">
                      {profilePic ? (
                        <img src={profilePic} alt={name} className="w-10 h-10 rounded-full object-cover border border-[#2a2a35]" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#1c1c24] text-brand flex items-center justify-center font-bold text-sm border border-[#2a2a35]">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-sm text-white">{name}</h4>
                        <p className="text-xs text-[#6b6b7b] mt-0.5">{email}</p>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-[#6b6b7b] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-5 pt-2 border-t border-[#1f1f2a]/50 bg-[#111116]/50 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        {u._id && (
                          <button
                            onClick={() => openMini("dm", u._id, name, profilePic)}
                            className="p-2 bg-[#1a1a22] border border-[#2a2a35] hover:bg-[#252530] text-[#9fa0b8] hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Message"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 bg-[#1c1c24] border border-[#2a2a35] text-[11px] font-semibold text-[#9fa0b8] rounded-lg">
                          In: {inTime}
                        </span>
                        <span className="px-2.5 py-1 bg-[#1c1c24] border border-[#2a2a35] text-[11px] font-semibold text-[#9fa0b8] rounded-lg">
                          Out: {outTime}
                        </span>
                        {duration !== undefined && (
                          <span className="px-2.5 py-1 bg-[#1c1c24] border border-[#2a2a35] text-[11px] font-semibold text-[#9fa0b8] rounded-lg">
                            Duration: {Math.round(duration)} min
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderInformationTabContent = () => {
    if (!infoData) return null;

    const { type, channel, workshop, product, course, service, itemType, affiliateId } = infoData;
    const isWorkshop = itemType === "workshop" || (!channel && workshop);
    const getSessionDateLabel = (dateStr: string) => {
      if (!workshop) return dateStr;
      const s = allAffiliateSessions.find(x => x.dateString === dateStr);
      if (!s) return dateStr;
      try {
        return new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          ...(workshop.timezone ? { timeZone: workshop.timezone } : {}),
        }).format(new Date(s.startDateTime));
      } catch (e) {
        return dateStr;
      }
    };
    const handlePrevMonth = () => {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(prev => prev - 1);
      } else {
        setCurrentMonth(prev => prev - 1);
      }
      setSelectedSessionDate("");
    };

    const handleNextMonth = () => {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(prev => prev + 1);
      } else {
        setCurrentMonth(prev => prev + 1);
      }
      setSelectedSessionDate("");
    };

    const isPrevMonthDisabled = () => {
      const today = new Date();
      return currentYear < today.getFullYear() || (currentYear === today.getFullYear() && currentMonth <= today.getMonth() + 1);
    };

    const formatMonthYear = (m: number, y: number) => {
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    };

    const sessionsForCurrentMonth = allAffiliateSessions.filter(s => {
      const sDate = new Date(s.startDateTime);
      const dateInTz = workshop?.timezone
        ? new Date(sDate.toLocaleString("en-US", { timeZone: workshop.timezone }))
        : sDate;
      return dateInTz.getMonth() + 1 === currentMonth && dateInTz.getFullYear() === currentYear;
    });
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();
    const orgSlug = orgDetails?.slug || localStorage.getItem("garage_org_slug") || (orgDetails?.name ? slugify(orgDetails.name) : "org-slug");
    const referralUrl = course?._id
      ? (affiliateId
        ? `https://www.garage.app/digital/course/${course._id}?ref=${affiliateId}`
        : `https://www.garage.app/digital/course/${course._id}`)
      : service?._id
      ? (affiliateId
        ? `https://www.garage.app/digital/service/${service._id}?ref=${affiliateId}`
        : `https://www.garage.app/digital/service/${service._id}`)
      : product?._id
        ? (product.isDigital || product.deliveryMethod === "digital"
          ? (affiliateId
            ? `https://www.garage.app/digital/product/${product._id}?ref=${affiliateId}`
            : `https://www.garage.app/digital/product/${product._id}`)
          : (affiliateId
            ? `${window.location.origin}/checkout/product/${product._id}?ref=${affiliateId}`
            : `${window.location.origin}/checkout/product/${product._id}`))
        : channel?._id
          ? (affiliateId
            ? `https://www.garage.app/digital/channel/${channel._id}?ref=${affiliateId}`
            : `https://www.garage.app/digital/channel/${channel._id}`)
          : (affiliateId
            ? `https://www.garage.app/digital?ref=${affiliateId}`
            : `https://www.garage.app/digital`);

    const handleCopyLink = () => {
      navigator.clipboard.writeText(referralUrl);
      toast.success("Referral link copied to clipboard!");
    };

    const renderHowItWorks = () => (
      <div className="space-y-4 pt-2">
        <h3 className="text-[10px] font-bold font-inter text-brand uppercase tracking-wider leading-[1.4]">
          How It Works
        </h3>
        <div className="space-y-4">
          {/* Item 1 */}
          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-brand-foreground shrink-0">
              <Upload className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white font-inter leading-[1.4]">Share your link</h4>
              <p className="text-[10px] font-normal font-inter text-[#8888a0] mt-0.5 leading-[1.4]">
                Invite friends for free by sharing this link.
              </p>
            </div>
          </div>
          {/* Item 2 */}
          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-brand-foreground shrink-0">
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white font-inter leading-[1.4]">Wait for them to buy</h4>
              <p className="text-[10px] font-normal font-inter text-[#8888a0] mt-0.5 leading-[1.4]">
                They can buy anything from any business selling on Garage.
              </p>
            </div>
          </div>
          {/* Item 3 */}
          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-brand-foreground shrink-0">
              <CircleDollarSign className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white font-inter leading-[1.4]">Earn forever</h4>
              <p className="text-[10px] font-normal font-inter text-[#8888a0] mt-0.5 leading-[1.4]">
                You get the commissions set by the founder of the respective product.
              </p>
            </div>
          </div>
        </div>
      </div>
    );

    // ── Grow Your Network ──────────────────────────────
    // The share funnels (HQ lobby / founders landing / NetworkChains /
    // whitelabel / comp plan), rendered in the panel instead of the old dialog.
    // The affiliate id is the same across all of them — only the destination
    // changes.
    if (type === "grow_network") {
      // A picked teammate's code wins: every link on the panel is then theirs,
      // which is the whole point of picking them.
      const growNetAffiliateId =
        growNetSharer?.affiliateId || affiliateId || myAffiliateId;
      // orgSlug falls back to the "org-slug" placeholder — treat that as "unknown"
      // so we never hand out a dead link.
      const resolvedOrgSlug = orgSlug && orgSlug !== "org-slug" ? orgSlug : null;
      // An office the panel was opened from wins over the viewer's current org:
      // the point of that entry is to share THAT office's lobby.
      const hqSlug = growNetHqOverride?.slug ?? resolvedOrgSlug;

      // Is the office being shared Bat246? Same precedence as `hqSlug` and
      // the "<org> HQ Lobby" label: an override (panel opened from another
      // office's entry) is judged by its slug, otherwise the viewer's own org
      // by id — the same id check Welcome.tsx and MainSidebar.tsx use — with
      // the slug as a second signal in case the id has not settled yet.
      const isBat246Office = growNetHqOverride
        ? growNetHqOverride.slug === BAT246_ORG_SLUG
        : localStorage.getItem("garage_org_id") === BAT246_ORG_ID ||
          resolvedOrgSlug === BAT246_ORG_SLUG;
      // The Bigwin row goes FIRST for Bat246 — it is the link that office
      // should be handing out. Every other office sees the list unchanged.
      const growNetOptions = isBat246Office
        ? [BAT246_BIGWIN_OPTION, ...GROW_NETWORK_OPTIONS]
        : GROW_NETWORK_OPTIONS;

      // Nothing is picked until the viewer opens the dropdown. The referral
      // rows above are the primary action here, and a preselected funnel link
      // sitting below them reads as "this is the link to copy".
      const activeOption =
        growNetOptions.find((o) => o.key === growNetLinkKind) ?? null;
      const shareUrl = activeOption
        ? activeOption.buildUrl({ affiliateId: growNetAffiliateId, hqSlug })
        : null;

      const handleCopyShareLink = () => {
        if (!shareUrl || !activeOption) return;
        navigator.clipboard.writeText(shareUrl);
        toast.success(activeOption.copiedToast);
      };

      // The lobby row is the only option whose link points at the viewer's own
      // office rather than at a Garage-owned page, so "Garage HQ Lobby" named
      // the wrong company for every org but Garage. Falls back to the static
      // name while orgDetails is still loading — a row labelled " HQ Lobby" is
      // worse than one labelled with the product.
      const orgLabel =
        growNetHqOverride?.label?.trim() || orgDetails?.name?.trim();
      const optionName = (option: GrowNetworkOption) =>
        option.key === "hq" && orgLabel ? `${orgLabel} HQ Lobby` : option.name;

      return (
        <div className="flex flex-col justify-between min-h-[calc(100vh-140px)]">
          <div className="space-y-6">
            {/* Header — the pill says whose links these are. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold font-geist text-white leading-none">
                  Grow Your Network
                </h2>
                <GrowNetworkSharerPicker
                  meName={authUser?.name || authUser?.email || "Me"}
                  value={growNetSharer}
                  onChange={setGrowNetSharer}
                />
              </div>
              {growNetSharer && (
                <p className="text-[10px] font-normal font-inter text-brand leading-[1.4]">
                  Every link below carries {growNetSharer.name}'s code, not yours.
                </p>
              )}
            </div>

            {growNetLimitReached && (
              <div className="bg-[#FE2954]/10 border border-[#FE2954]/20 rounded-xl p-3.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-[#FE2954] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#FE2954] font-inter leading-[1.4]">
                      Guest limit reached
                    </p>
                    <p className="text-[10px] font-normal font-inter text-[#FE2954]/80 mt-0.5 leading-[1.4]">
                      Your organization has reached the maximum of {growNetGuestLimit}{" "}
                      guests on the Basic plan. Upgrade to Pro for unlimited guests.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* The direct invites — one code, three products to land in. */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold font-inter text-brand leading-[1.4]">
                Refer Directly to your Network
              </h3>
              <div className="space-y-2">
                {GROW_NETWORK_REFER_APPS.map((app) => (
                  <GrowNetworkReferRow
                    key={app.id}
                    app={app}
                    affiliateId={growNetAffiliateId}
                  />
                ))}
              </div>
            </div>

            {/* The landing pages — same code, but a pitch page instead of an
                invite, so they can go to anyone. Collapsed by default: eight
                funnels laid out flat buried the three rows above. */}
            <div className="space-y-3">
              <p className="text-[10px] font-normal font-inter text-[#9fa0b8] leading-[1.5]">
                Or, share the landing page website with anyone — no invite needed.
              </p>
              <h3 className="text-[10px] font-bold font-inter text-brand uppercase tracking-wider leading-[1.4]">
                Share Landing Page
              </h3>
              <div>
                <button
                  type="button"
                  onClick={() => setGrowNetPickerOpen((open) => !open)}
                  aria-expanded={growNetPickerOpen}
                  aria-haspopup="listbox"
                  className={cn(
                    "w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all cursor-pointer hover:border-white/25",
                    LIQUID_GLASS
                  )}
                >
                  <span className="flex-1 min-w-0 text-sm font-bold font-inter text-white truncate leading-[1.4]">
                    {activeOption
                      ? optionName(activeOption)
                      : "Choose a Landing Page to Share"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-[#8888a0] transition-transform duration-200",
                      growNetPickerOpen && "rotate-180"
                    )}
                  />
                </button>

                {growNetPickerOpen && (
                  <div
                    className="mt-2 space-y-2"
                    role="listbox"
                    aria-label="Choose a landing page"
                  >
                    {growNetOptions.map((option) => {
                      const isActive = option.key === activeOption?.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => {
                            setGrowNetLinkKind(option.key);
                            setGrowNetPickerOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all cursor-pointer",
                            LIQUID_GLASS,
                            isActive
                              ? "border-brand/70 from-brand/[0.14] via-brand/[0.07] to-brand/[0.03]"
                              : "hover:border-white/25"
                          )}
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-bold text-white font-inter leading-[1.4]">
                              {optionName(option)}
                            </span>
                            <span className="block text-[10px] font-normal font-inter text-[#8888a0] mt-0.5 leading-[1.4]">
                              {option.blurb}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeOption &&
            (shareUrl ? (
              <>
                {/* QR + share tools */}
                <AffiliateQrShare
                  url={shareUrl}
                  title={activeOption.shareTitle}
                  filenameHint={activeOption.filenameHint}
                  logoSrc={activeOption.qrLogoSrc}
                  caption={activeOption.qrCaption}
                />

                {/* Link Box */}
                <div className="space-y-3 pt-6">
                  <h3 className="text-[10px] font-bold font-inter text-brand uppercase tracking-wider leading-[1.4]">
                    {activeOption.linkLabel}
                  </h3>
                  <div className={cn("flex items-center gap-2 rounded-2xl px-4 py-3", LIQUID_GLASS)}>
                    <span className="text-xs font-normal font-inter text-white/90 truncate flex-1 select-all leading-[1.4]">
                      {shareUrl}
                    </span>
                    <button
                      onClick={handleCopyShareLink}
                      className="text-[#8888a0] hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0"
                      title="Copy link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleCopyShareLink}
                    className="w-full bg-brand hover:opacity-90 text-brand-foreground font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer font-inter leading-[1.4]"
                  >
                    Copy Link
                  </button>
                  <span className="text-[10px] font-normal font-inter text-[#8888a0] text-center block leading-[1.4]">
                    Select the link above and press Ctrl+C, or use the Copy Link button
                  </span>
                </div>
              </>
            ) : (
              <div className="bg-[#17171d] border border-[#2E2E2E] rounded-xl py-4 px-3 text-center text-xs text-white/60 font-inter leading-[1.4] mt-6">
                {activeOption.key === "hq"
                  ? "Lobby link not available. Make sure your organization has a name or slug configured."
                  : "Link not available yet — your affiliate id is still loading."}
              </div>
            ))}
        </div>
      );
    }

    if (type === "commission" || type === "affiliate") {
      const activeItem = itemType === "product" && product
        ? product
        : itemType === "course" && course
          ? course
          : itemType === "service" && service
            ? service
            : (isWorkshop && workshop ? workshop : channel);
      if (!activeItem) return null;

      // A service carries its contract total in `totalPrice`; every other type
      // uses `price`.
      const priceVal =
        ("price" in activeItem ? activeItem.price : activeItem.totalPrice) || 0;
      const currencySymbol = activeItem.currency === "INR" ? "₹" : "$";

      const calculateAmount = (percentage: number): number => {
        if (priceVal <= 0) return 0;
        const netPrice = priceVal * 0.95;
        return Math.round(((netPrice * percentage) / 100) * 100) / 100;
      };

      const formatAmount = (amount: number): string => {
        return `${currencySymbol}${amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      };

      const platformFeePercent = plan?.platformPercentage ?? 5;
      const totalCommission = plan ? plan.levels.reduce((sum, l) => sum + l.percentage, 0) : 0;
      const sellerPercentage = 100 - platformFeePercent - totalCommission;

      const platformFeeAmount = priceVal * (platformFeePercent / 100);
      const affiliatesAmount = calculateAmount(totalCommission);
      const youKeepAmount = priceVal - platformFeeAmount - affiliatesAmount;

      if (isWorkshop && workshop) {
        const affiliateParams = new URLSearchParams();
        if (selectedSessionDate) {
          affiliateParams.set("sessionDate", selectedSessionDate);
        }
        if (affiliateId) {
          affiliateParams.set("ref", affiliateId);
        }
        const queryStr = affiliateParams.toString() ? `?${affiliateParams.toString()}` : "";

        // The office's OWN domain when it has one verified, so a white-label
        // founder copying a link from my.garage.app still hands out their
        // brand. Falls back to the current origin for everyone else.
        const affiliateLink = `${shareOrigin}/checkout/workshop/${workshop._id}${queryStr}`;
        const directLink = `${shareOrigin}/webinar/${workshop._id}${queryStr}`;

        return (
          <div className="flex flex-col justify-between min-h-[calc(100vh-140px)]">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-[15px] font-bold font-geist text-white mb-1.5 leading-none">
                  Earning Potential
                </h2>
                <p className="text-[10px] font-normal font-inter text-[#9fa0b8] leading-[1.4]">
                  Earn passive income by growing your 1Network. If anyone in your network subscribes to this community, this is how much you can earn.
                </p>
              </div>

              {/* Stats Card Boxes */}
              {loadingPlan ? (
                <div className="py-8 flex justify-center items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                </div>
              ) : plan ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Total Affiliate Comp */}
                    <div className="border border-[#2a2a30] bg-[#1a1a20]/40 rounded-xl py-3.5 px-2 text-center flex flex-col items-center justify-center">
                      <p className="text-[10px] font-normal font-inter text-[#8888a0] mb-1.5 leading-[1.4]">
                        Total Affiliate Comp
                      </p>
                      <p className="text-base font-bold text-[#00E676] leading-none">
                        {sellerPercentage.toFixed(2)}%
                      </p>
                      <p className="text-xs font-semibold text-[#00E676] mt-1 leading-none">
                        {formatAmount(youKeepAmount)}
                      </p>
                    </div>
                    {/* {Org} Keeps */}
                    <div className="border border-[#2a2a30] bg-[#1a1a20]/40 rounded-xl py-3.5 px-2 text-center flex flex-col items-center justify-center">
                      <p className="text-[10px] font-normal font-inter text-[#8888a0] mb-1.5 leading-[1.4]">
                        {orgDetails?.name || "Org"} Keeps
                      </p>
                      <p className="text-base font-bold text-brand leading-none">
                        {totalCommission.toFixed(2)}%
                      </p>
                      <p className="text-xs font-semibold text-brand mt-1 leading-none">
                        {formatAmount(affiliatesAmount)}
                      </p>
                    </div>
                    {/* Garage Fees */}
                    <div className="border border-[#2a2a30] bg-[#1a1a20]/40 rounded-xl py-3.5 px-2 text-center flex flex-col items-center justify-center">
                      <p className="text-[10px] font-normal font-inter text-[#8888a0] mb-1.5 leading-[1.4]">
                        Garage Fees
                      </p>
                      <p className="text-base font-bold text-white/60 leading-none">
                        {platformFeePercent.toFixed(2)}%
                      </p>
                      <p className="text-xs font-semibold text-white/60 mt-1 leading-none">
                        {formatAmount(platformFeeAmount)}
                      </p>
                    </div>
                  </div>

                  {/* MLM Levels Breakdown List */}
                  <div className="divide-y divide-[#2a2a30] border-t border-b border-[#2a2a30] py-1 mt-4 mb-4">
                    {plan.levels.map((level, idx) => {
                      const levelAmt = calculateAmount(level.percentage);
                      const getLevelTitle = (num: number) => {
                        if (num === 1) return "Direct Referral";
                        return `Level ${num}`;
                      };
                      const getLevelSubtitle = (num: number) => {
                        if (num === 1) return "Direct referrals";
                        if (num === 2) return "Secondary Referrals";
                        if (num === 3) return "Tertiary Referrals";
                        return `Level ${num} Referrals`;
                      };
                      return (
                        <div
                          key={level.level}
                          className="flex items-center justify-between py-3.5"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white font-inter leading-[1.4]">
                              {getLevelTitle(level.level)}
                            </span>
                            <span className="text-[10px] font-normal font-inter text-[#8888a0] mt-0.5 leading-[1.4]">
                              {getLevelSubtitle(level.level)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3.5">
                            <div className="bg-[#FE2954] text-white font-bold text-[10px] px-2 py-0.5 rounded font-inter leading-[1.4]">
                              {level.percentage.toFixed(2)}%
                            </div>
                            <span className="text-sm font-bold text-brand font-inter leading-[1.4]">
                              {formatAmount(levelAmt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="bg-[#17171d] border border-[#2E2E2E] rounded-xl py-4 px-3 text-center text-xs text-white/60 mb-4 font-inter leading-[1.4]">
                  No commissions paid for this live stream
                </div>
              )}
              {renderHowItWorks()}
            </div>

            {/* ONE Affiliate Link Box */}
            <div className="space-y-4 pt-4 pb-2">
              {workshop.isRecurring ? (
                <>
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold font-inter text-brand uppercase tracking-wider leading-[1.4]">
                      Select Specific Session
                    </h3>

                    {/* Month Paging Header */}
                    <div className="flex items-center justify-between bg-[#1b1b1f] border border-[#2a2a30] rounded-xl px-4 py-2">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="text-[#8888a0] hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-transparent border-none outline-none"
                        disabled={isPrevMonthDisabled()}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-white font-inter">
                        {formatMonthYear(currentMonth, currentYear)}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="text-[#8888a0] hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Inline Monthly Calendar Grid */}
                    {loadingAffiliateSessions ? (
                      <div className="flex items-center gap-2 text-xs text-[#8888a0] justify-center py-4">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                        <span>Loading sessions...</span>
                      </div>
                    ) : (
                      <div className="bg-[#1b1b1f] border border-[#2a2a30] rounded-2xl p-3 sm:p-4">
                        {/* Weekdays Row */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                          {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                            <span key={idx} className="text-[10px] font-bold text-[#8888a0] font-inter py-1">
                              {day}
                            </span>
                          ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
                          {/* Empty spacer cells before the 1st of month */}
                          {Array.from({ length: firstDayIndex }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="aspect-square" />
                          ))}

                          {/* Calendar Days */}
                          {Array.from({ length: daysInMonth }).map((_, idx) => {
                            const dayNum = idx + 1;
                            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                            const hasSession = allAffiliateSessions.some(s => s.dateString === dateStr);
                            const isSelected = selectedSessionDate === dateStr;

                            return (
                              <button
                                key={`day-${dayNum}`}
                                type="button"
                                disabled={!hasSession}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedSessionDate("");
                                  } else {
                                    setSelectedSessionDate(dateStr);
                                  }
                                }}
                                className={cn(
                                  "aspect-square flex items-center justify-center text-xs font-semibold rounded-xl transition-all font-inter border",
                                  isSelected
                                    ? "bg-[#0052cc] text-white border-[#0052cc]"
                                    : hasSession
                                      ? "border-[#2a2a30] hover:border-brand/40 bg-[#16161a] text-white cursor-pointer"
                                      : "text-white/20 cursor-default opacity-40 bg-transparent border-transparent"
                                )}
                              >
                                {dayNum}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Affiliate Copy Box (Only visible on selection) */}
                  {selectedSessionDate && (
                    <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                      <h3 className="text-[11px] font-bold font-inter text-brand uppercase tracking-wider leading-[1.4]">
                        Affiliate Link For Live Stream
                      </h3>
                      <AffiliateQrShare
                        url={directLink}
                        title="Join this live stream"
                        filenameHint="workshop-session"
                      />
                      <div className="flex items-center gap-2 bg-[#1b1b1f] border border-[#2a2a30] rounded-xl px-4 py-3">
                        <span className="text-xs font-normal font-inter text-white/90 truncate flex-1 select-all leading-[1.4]">
                          {directLink}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(directLink);
                            toast.success("Affiliate link copied to clipboard!");
                          }}
                          className="text-[#8888a0] hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0"
                          title="Copy affiliate link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-[10px] font-normal font-inter text-[#8888a0] text-center block leading-[1.4] pt-2">
                        Select the link above and press Ctrl+C, or use the Copy Link button
                      </span>
                    </div>
                  )}
                </>
              ) : (
                /* One-time Live Stream (Always show single link directly) */
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold font-inter text-brand uppercase tracking-wider leading-[1.4]">
                    Affiliate Link For Live Stream
                  </h3>
                  <AffiliateQrShare
                    url={directLink}
                    title="Join this live stream"
                    filenameHint="workshop"
                  />
                  <div className="flex items-center gap-2 bg-[#1b1b1f] border border-[#2a2a30] rounded-xl px-4 py-3">
                    <span className="text-xs font-normal font-inter text-white/90 truncate flex-1 select-all leading-[1.4]">
                      {directLink}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(directLink);
                        toast.success("Affiliate link copied to clipboard!");
                      }}
                      className="text-[#8888a0] hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0"
                      title="Copy affiliate link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[10px] font-normal font-inter text-[#8888a0] text-center block leading-[1.4] pt-2">
                    Select the link above and press Ctrl+C, or use the Copy Link button
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }




      return (
        <div className="flex flex-col justify-between min-h-[calc(100vh-140px)]">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-[15px] font-bold font-geist text-white mb-1.5 leading-none">
                Earning Potential
              </h2>
              <p className="text-[10px] font-normal font-inter text-[#9fa0b8] leading-[1.4]">
                Earn passive income by growing your 1Network. If anyone in your network {itemType === "product" ? "purchases this product" : itemType === "course" ? "purchases this course" : "subscribes to this community"}, this is how much you can earn.
              </p>
            </div>

            {/* Three Column Stats Card Boxes */}
            {loadingPlan ? (
              <div className="py-8 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : plan ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {/* Total Affiliate Comp */}
                  <div className="border border-[#2a2a30] bg-[#1a1a20]/40 rounded-xl py-3.5 px-2 text-center flex flex-col items-center justify-center">
                    <p className="text-[10px] font-normal font-inter text-[#8888a0] mb-1.5 leading-[1.4]">
                      Total Affiliate Comp
                    </p>
                    <p className="text-base font-bold text-[#00E676] leading-none">
                      {sellerPercentage.toFixed(2)}%
                    </p>
                    <p className="text-xs font-semibold text-[#00E676] mt-1 leading-none">
                      {formatAmount(youKeepAmount)}
                    </p>
                  </div>
                  {/* {Org} Keeps */}
                  <div className="border border-[#2a2a30] bg-[#1a1a20]/40 rounded-xl py-3.5 px-2 text-center flex flex-col items-center justify-center">
                    <p className="text-[10px] font-normal font-inter text-[#8888a0] mb-1.5 leading-[1.4]">
                      {orgDetails?.name || "Org"} Keeps
                    </p>
                    <p className="text-base font-bold text-brand leading-none">
                      {totalCommission.toFixed(2)}%
                    </p>
                    <p className="text-xs font-semibold text-brand mt-1 leading-none">
                      {formatAmount(affiliatesAmount)}
                    </p>
                  </div>
                  {/* Garage Fees */}
                  <div className="border border-[#2a2a30] bg-[#1a1a20]/40 rounded-xl py-3.5 px-2 text-center flex flex-col items-center justify-center">
                    <p className="text-[10px] font-normal font-inter text-[#8888a0] mb-1.5 leading-[1.4]">
                      Garage Fees
                    </p>
                    <p className="text-base font-bold text-white/60 leading-none">
                      {platformFeePercent.toFixed(2)}%
                    </p>
                    <p className="text-xs font-semibold text-white/60 mt-1 leading-none">
                      {formatAmount(platformFeeAmount)}
                    </p>
                  </div>
                </div>

                {/* MLM Levels Breakdown List */}
                <div className="divide-y divide-[#2a2a30] border-t border-b border-[#2a2a30] py-1 mt-4 mb-12">
                  {plan.levels.map((level, idx) => {
                    const levelAmt = calculateAmount(level.percentage);
                    const getLevelTitle = (num: number) => {
                      if (num === 1) return "Direct Referral";
                      return `Level ${num}`;
                    };
                    const getLevelSubtitle = (num: number) => {
                      if (num === 1) return "Direct referrals";
                      if (num === 2) return "Secondary Referrals";
                      if (num === 3) return "Tertiary Referrals";
                      return `Level ${num} Referrals`;
                    };
                    return (
                      <div
                        key={level.level}
                        className="flex items-center justify-between py-3.5"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white font-inter leading-[1.4]">
                            {getLevelTitle(level.level)}
                          </span>
                          <span className="text-[10px] font-normal font-inter text-[#8888a0] mt-0.5 leading-[1.4]">
                            {getLevelSubtitle(level.level)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3.5">
                          <div className="bg-[#FE2954] text-white font-bold text-[10px] px-2 py-0.5 rounded font-inter leading-[1.4]">
                            {level.percentage.toFixed(2)}%
                          </div>
                          <span className="text-sm font-bold text-brand font-inter leading-[1.4]">
                            {formatAmount(levelAmt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="bg-[#17171d] border border-[#2E2E2E] rounded-xl py-4 px-3 text-center text-xs text-white/60 mb-4 font-inter leading-[1.4]">
                No commissions paid for this {itemType === "product" ? "product" : itemType === "course" ? "course" : itemType === "service" ? "service" : "community"}
              </div>
            )}

            {/* Unified How It Works steps */}
            {renderHowItWorks()}
          </div>

          {/* QR + share tools (fills the empty space above the referral link) */}
          <AffiliateQrShare
            url={referralUrl}
            title={
              itemType === "product"
                ? "Check out this product"
                : itemType === "course"
                  ? "Check out this course"
                  : itemType === "service"
                    ? "Check out this service"
                    : "Join this community"
            }
            filenameHint={itemType || "affiliate"}
          />

          {/* Referral Link Box */}
          <div className="space-y-3 pt-6">
            <h3 className="text-[10px] font-bold font-inter text-brand uppercase tracking-wider leading-[1.4]">
              Your Referral Link
            </h3>
            <div className="flex items-center gap-2 bg-[#1b1b1f] border border-[#2a2a30] rounded-xl px-4 py-3">
              <span className="text-xs font-normal font-inter text-white/90 truncate flex-1 select-all leading-[1.4]">
                {referralUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="text-[#8888a0] hover:text-white transition-colors cursor-pointer"
                title="Copy link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleCopyLink}
              className="w-full bg-brand hover:opacity-90 text-brand-foreground font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer font-inter leading-[1.4]"
            >
              Copy Link
            </button>
            <span className="text-[10px] font-normal font-inter text-[#8888a0] text-center block leading-[1.4]">
              Select the link above and press Ctrl+C, or use the Copy Link button
            </span>
          </div>
        </div>
      );
    }



    // Membership details for "My Communities" view
    if (type === "membership") {
      const currencySymbol = (membershipDetails?.currency === "INR" ? "₹" : "$");
      const isFree = membershipDetails?.isFree ?? (channel.isFree || !channel.price || channel.price === 0);
      const amount = membershipDetails?.amount || channel.price || 0;
      const period = membershipDetails?.period || channel.subscriptionPeriod;
      const status = membershipDetails?.status || "active";
      const isActive = status === "active" || status === "authenticated";

      const formatDate = (dateStr?: string) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      };

      return (
        <div className="flex flex-col justify-between min-h-[calc(100vh-140px)]">
          <div className="space-y-5">
            {/* Header */}
            <div>
              <h2 className="text-[15px] font-bold font-geist text-white mb-1 leading-none">
                Membership details
              </h2>
              <p className="text-[11px] font-normal font-inter text-[#9fa0b8] leading-[1.4]">
                Current membership subscription
              </p>
            </div>

            {loadingMembership ? (
              <div className="py-8 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : (
              <>
                {/* Price display */}
                {isFree ? (
                  <div>
                    <span className="text-[32px] font-black text-white leading-none">Free</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[28px] font-black text-white leading-none">
                        {currencySymbol}{amount.toFixed(0)}
                        {channel.isSubscription && (
                          <>/{period === "monthly" ? "mo" : period === "yearly" ? "yr" : period === "weekly" ? "wk" : period === "quarterly" ? "qtr" : (period || "mo")}</>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9fa0b8] font-inter mt-1 leading-[1.4]">
                      {channel.isSubscription ? (
                        `Billed ${period === "monthly" ? "monthly" : period === "yearly" ? "annually" : period === "weekly" ? "weekly" : "periodically"}. Cancel anytime.`
                      ) : (
                        "One-time payment. Lifetime access."
                      )}
                    </p>
                  </div>
                )}

                {/* Status card */}
                <div className="bg-[#1a1a20] border border-[#2a2a30] rounded-xl overflow-hidden">
                  {/* Status row */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a30]">
                    <span className="text-[13px] text-[#8888a0] font-inter">Status</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className="text-[13px] font-semibold text-white capitalize">
                        {isActive ? "Active" : status}
                      </span>
                    </div>
                  </div>

                  {/* Paid-only rows */}
                  {!isFree && membershipDetails?.lastBillingDate && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a30]">
                      <span className="text-[13px] text-[#8888a0] font-inter">Last billing date</span>
                      <span className="text-[13px] font-semibold text-white">
                        {formatDate(membershipDetails.lastBillingDate)}
                      </span>
                    </div>
                  )}

                  {/* Member since */}
                  {membershipDetails?.joinedAt && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a30]">
                      <span className="text-[13px] text-[#8888a0] font-inter">Member since</span>
                      <span className="text-[13px] font-semibold text-white">
                        {formatDate(membershipDetails.joinedAt)}
                      </span>
                    </div>
                  )}

                  {/* Next billing date (paid only) */}
                  {!isFree && membershipDetails?.nextBillingDate && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-[13px] text-[#8888a0] font-inter">Next billing date</span>
                      <span className="text-[13px] font-semibold text-white">
                        {formatDate(membershipDetails.nextBillingDate)}
                      </span>
                    </div>
                  )}

                  {/* Fallback: member since from channel if no joinedAt */}
                  {!membershipDetails?.joinedAt && isFree && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-[13px] text-[#8888a0] font-inter">Member since</span>
                      <span className="text-[13px] font-semibold text-white">
                        {formatDate(channel.createdAt)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Unsubscribe button */}
          <div className="pt-6 pb-2">
            <button
              onClick={() => setShowUnsubscribeConfirm(true)}
              className="w-full bg-brand hover:opacity-90 text-brand-foreground font-bold py-3.5 rounded-xl text-sm transition-all duration-200 cursor-pointer"
            >
              {channel.isSubscription ? "Unsubscribe" : "Leave Community"}
            </button>
          </div>

          {/* Unsubscribe Confirmation Dialog */}
          <AlertDialog open={showUnsubscribeConfirm} onOpenChange={setShowUnsubscribeConfirm}>
            <AlertDialogContent className="bg-[#111114] border-[#2a2a35] max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white text-lg font-bold font-geist">
                  {channel.isSubscription ? `Unsubscribe from ${channel.title}?` : `Leave ${channel.title}?`}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[#9fa0b8] text-sm font-inter leading-relaxed">
                  You will lose access to this community&apos;s feeds and content.
                  {channel.isSubscription && " Your subscription will be cancelled at the end of the current billing cycle."}
                  {!channel.isSubscription && !isFree && " You may need to pay again to rejoin."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="border-[#2a2a35] text-white bg-transparent hover:bg-[#1a1a22] hover:text-white rounded-xl py-2.5 px-4 font-semibold text-sm cursor-pointer transition-all">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    // Dispatch unsubscribe action back to communities page
                    window.dispatchEvent(new CustomEvent("community:unsubscribe-request", {
                      detail: { channelId: channel._id }
                    }));
                    setShowUnsubscribeConfirm(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white border-none rounded-xl py-2.5 px-4 font-semibold text-sm cursor-pointer transition-all"
                >
                  Unsubscribe
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }

    if (type === "information") {
      if (isWorkshop && workshop) {
        const activeWorkshop = workshop;
        const galleryImages = activeWorkshop.galleryImages || [];
        const images = [activeWorkshop.thumbnail, ...galleryImages].filter(Boolean) as string[];
        const activeImg = activeGalleryImage || images[0] || "";

        const learningPoints = activeWorkshop.learningPoints || [];
        const whatsIncluded = activeWorkshop.whatsIncluded || [];
        const benefits = activeWorkshop.requirements || [];
        const faqs = activeWorkshop.faqs || [];

        const allLearningPoints = [...learningPoints, ...whatsIncluded].filter(Boolean);

        const priceVal = activeWorkshop.price || 0;
        const currencySymbol = activeWorkshop.currency === "INR" ? "₹" : "$";

        return (
          <div className="space-y-6 pb-8">
            {/* 1. Title */}
            <div className="px-1">
              <h2 className="text-xl font-extrabold text-white leading-tight">
                {activeWorkshop.title}
              </h2>
            </div>

            {/* 2. Image Gallery */}
            {images.length > 0 && (
              <div className="space-y-3">
                {/* Active Image */}
                <div className="relative w-full aspect-[1.8/1] rounded-xl overflow-hidden border border-[#2a2a35] bg-[#16161e] shadow-lg">
                  <img
                    src={activeImg}
                    alt="Gallery Active"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Thumbnails Row */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
                    {images.map((img, idx) => (
                      <button
                        key={img}
                        onClick={() => setActiveGalleryImage(img)}
                        className={cn(
                          "w-[64px] h-[44px] rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0",
                          activeImg === img
                            ? "border-brand scale-95"
                            : "border-transparent opacity-60 hover:opacity-100"
                        )}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2b. Introduction Video (YouTube embed or uploaded MP4) */}
            {(activeWorkshop.videoUrl || activeWorkshop.videoFile) && (() => {
              const getYTEmbedUrl = (url: string): string => {
                if (!url) return "";
                if (url.includes("youtu.be/")) {
                  const parts = url.split("youtu.be/");
                  if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                } else if (url.includes("youtube.com/watch?v=")) {
                  const parts = url.split("v=");
                  if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
                } else if (url.includes("youtube.com/embed/")) {
                  const parts = url.split("embed/");
                  if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                }
                return "";
              };
              const embedUrl = activeWorkshop.videoUrl ? getYTEmbedUrl(activeWorkshop.videoUrl) : "";
              return (
                <div className="space-y-2">
                  <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider">
                    WATCH INTRO
                  </h3>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#2a2a35] bg-[#16161e] shadow-lg">
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        title="Webinar Introduction Video"
                      />
                    ) : activeWorkshop.videoFile ? (
                      <video
                        src={activeWorkshop.videoFile}
                        controls
                        className="w-full h-full object-contain"
                        preload="metadata"
                      />
                    ) : null}
                    {!embedUrl && !activeWorkshop.videoFile && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/45 pointer-events-none">
                        <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
                          <Play className="w-6 h-6 text-brand-foreground fill-current translate-x-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 3. About This Webinar */}
            {activeWorkshop.description && (
              <div className="space-y-2">
                <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider">
                  ABOUT THIS WEBINAR
                </h3>
                <div
                  className="text-sm text-[#9fa0b8] leading-relaxed break-words [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-brand [&_a]:hover:underline"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeDescription(activeWorkshop.description || ""),
                  }}
                />
              </div>
            )}

            {/* 4. What You'll Learn */}
            {allLearningPoints.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider">
                  WHAT YOU&apos;LL LEARN
                </h3>
                <div className="space-y-3">
                  {allLearningPoints.map((point, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 text-brand-foreground stroke-[3.5]" />
                      </div>
                      <span className="text-sm text-white/90 leading-relaxed">
                        {point}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Pricing Section */}
            <div className="space-y-3">
              <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider">
                PRICING
              </h3>
              <div className="bg-[#1a1a20] border border-[#2a2a30] rounded-xl p-4 space-y-4">
                <div>
                  <span className="text-xl font-bold text-white">
                    {activeWorkshop.isFree ? (
                      "Free to join"
                    ) : (
                      <span>
                        {currencySymbol}{priceVal.toLocaleString("en-US")}
                        {activeWorkshop.isRecurring && (
                          <span className="text-xs text-[#9fa0b8] font-normal font-inter">
                            /{activeWorkshop.enrollmentType === "per_session" ? "session" : "month"}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </div>
                {benefits.length > 0 && (
                  <div className="space-y-2">
                    {benefits.map((point, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-white/90">
                        <Check className="w-3.5 h-3.5 text-brand" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("workshop:register-request", {
                      detail: { workshopId: activeWorkshop._id }
                    }));
                    if (onClose) onClose();
                  }}
                  className="w-full bg-brand hover:opacity-90 text-brand-foreground font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer font-inter leading-[1.4]"
                >
                  {activeWorkshop.isRegistered || activeWorkshop.hasPaid ? "Enrolled" : "Register Now"}
                </button>
              </div>
            </div>

            {/* 6. FAQ Accordion */}
            {faqs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider">
                  FAQ
                </h3>
                <div className="space-y-2.5">
                  {faqs.map((faq, idx) => {
                    const isExpanded = expandedFaqIdx === idx;
                    return (
                      <div
                        key={idx}
                        className="border border-[#2a2a30] bg-[#1a1a20]/60 rounded-xl overflow-hidden transition-all duration-300"
                      >
                        <button
                          onClick={() => setExpandedFaqIdx(isExpanded ? null : idx)}
                          className="w-full flex items-center justify-between text-left p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        >
                          <span className="text-sm font-bold text-white pr-4">
                            {faq.question}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-brand shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-brand shrink-0" />
                          )}
                        </button>
                        <div
                          className={cn(
                            "transition-all duration-300 ease-in-out overflow-hidden",
                            isExpanded ? "max-h-[500px] border-t border-[#2a2a35] p-4 bg-[#111115]/40" : "max-h-0"
                          )}
                        >
                          <p className="text-xs text-[#9fa0b8] leading-relaxed whitespace-pre-line">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      }

      if (loadingFullChannel) {
        return (
          <div className="py-20 flex flex-col justify-center items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <span className="text-xs text-[#8888a0]">Loading community info...</span>
          </div>
        );
      }

      const activeChannel = fullChannelDetails || channel;
      const galleryImages = activeChannel.galleryImages || [];
      const whatsIncluded = activeChannel.whatsIncluded || [];
      const benefits = activeChannel.benefits || [];
      const faqs = activeChannel.faqs || [];

      // Helper: extract YouTube embed URL
      const getYTEmbedUrl = (url: string): string => {
        if (!url) return "";
        if (url.includes("youtu.be/")) {
          const parts = url.split("youtu.be/");
          if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
        } else if (url.includes("youtube.com/watch?v=")) {
          const parts = url.split("v=");
          if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
        } else if (url.includes("youtube.com/embed/")) {
          const parts = url.split("embed/");
          if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
        }
        return "";
      };

      const priceVal = activeChannel.price || 0;
      const actualPrice = priceVal;
      const isFree = activeChannel.isFree || actualPrice === 0;
      const currencySymbol = activeChannel.currency === "INR" ? "₹" : "$";
      const totalAmt = actualPrice;

      const formatPrice = (val: number) => {
        return `${currencySymbol}${val.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      };

      const isUserJoined = Boolean(
        membershipDetails &&
        (membershipDetails.hasAccess || !!membershipDetails.joinedAt) &&
        membershipDetails.status === "active"
      );

      const handleJoinClick = () => {
        window.dispatchEvent(new CustomEvent("community:subscribe-request", {
          detail: { channelId: activeChannel._id }
        }));
      };

      return (
        <div className="space-y-6 pb-8">
          {/* 1. Title */}
          <div className="px-1">
            <h2 className="text-xl font-extrabold text-white leading-tight">
              {activeChannel.title}
            </h2>
          </div>

          {/* 2. Image Gallery */}
          <CommunityImageGallery
            coverImage={activeChannel.coverImage}
            galleryImages={galleryImages}
          />

          {/* 2b. Introduction Video (YouTube embed or uploaded MP4) */}
          {(activeChannel.videoUrl || activeChannel.videoFile) && (() => {
            const embedUrl = activeChannel.videoUrl ? getYTEmbedUrl(activeChannel.videoUrl) : "";
            return (
              <div className="space-y-2">
                <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider">
                  WATCH INTRO
                </h3>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#2a2a35] bg-[#16161e] shadow-lg">
                  {embedUrl ? (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      title="Community Introduction Video"
                    />
                  ) : activeChannel.videoFile ? (
                    <video
                      src={activeChannel.videoFile}
                      controls
                      className="w-full h-full object-contain"
                      preload="metadata"
                    />
                  ) : null}
                  {!embedUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 pointer-events-none">
                      <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
                        <Play className="w-6 h-6 text-brand-foreground fill-current translate-x-0.5" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 3. About This Community */}
          {(activeChannel.aboutText || activeChannel.description) && (
            <div className="space-y-2">
              <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider">
                ABOUT THIS COMMUNITY
              </h3>
              <div
                className="text-sm text-[#9fa0b8] leading-relaxed break-words [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-brand [&_a]:hover:underline"
                dangerouslySetInnerHTML={{
                  __html: sanitizeDescription(activeChannel.aboutText || activeChannel.description || ""),
                }}
              />
            </div>
          )}

          {/* Benefits */}
          {benefits.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider font-inter">
                MEMBERSHIP BENEFITS
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {benefits.map((benefit, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#2a2a30] bg-[#1a1a20]/60"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand/10">
                        {benefit.icon ? (
                          <span className="text-lg">{benefit.icon}</span>
                        ) : (
                          <Check className="h-5 w-5 text-brand" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-1 text-sm">{benefit.title}</h4>
                        <p className="text-xs text-[#9fa0b8] leading-relaxed">{benefit.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. What You'll Learn */}
          {whatsIncluded.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider font-inter">
                WHAT YOU&apos;LL LEARN
              </h3>
              <div className="space-y-3">
                {whatsIncluded.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-brand-foreground stroke-[3.5]" />
                    </div>
                    <span className="text-sm text-white/90 leading-relaxed font-inter">
                      {point}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Pricing Section */}
          {!isFree && (
            <div className="space-y-3">
              <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider font-inter">
                PRICING
              </h3>
              <div className="bg-[#1a1a20] border border-[#2a2a30] rounded-xl p-4 space-y-4">
                <div className="border-b border-[#2a2a30] pb-2">
                  <span className="text-sm font-bold text-white font-inter">
                    {isFree ? "Free Membership" : "Pro Membership"}
                  </span>
                </div>
                <div className="space-y-2 text-xs text-[#9fa0b8]">
                  <div className="flex justify-between">
                    <span className="font-inter">Item</span>
                    <span className="text-white font-medium font-inter">
                      {isFree ? "Free Membership" : "Pro Membership"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-inter">Price</span>
                    <span className="text-white font-medium font-inter">
                      {isFree ? "Free" : `${activeChannel.currency || "USD"} ${priceVal.toFixed(2)}${activeChannel.isSubscription ? ` / ${activeChannel.subscriptionPeriod || "month"}` : ""}`}
                    </span>
                  </div>
                  {!isFree && (
                    <>
                      <div className="flex justify-between border-t border-[#2a2a30] pt-2 font-bold text-white text-sm">
                        <span className="font-inter">Total</span>
                        <span className="text-brand font-inter">
                          {formatPrice(totalAmt)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 6. FAQ Accordion */}
          {faqs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-brand text-[11px] font-bold uppercase tracking-wider font-inter">
                FAQ
              </h3>
              <div className="space-y-2.5">
                {faqs.map((faq, idx) => {
                  const isExpanded = expandedFaqIdx === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-[#2a2a30] bg-[#1a1a20]/60 rounded-xl overflow-hidden transition-all duration-300"
                    >
                      <button
                        onClick={() => setExpandedFaqIdx(isExpanded ? null : idx)}
                        className="w-full flex items-center justify-between text-left p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <span className="text-sm font-bold text-white pr-4 font-inter">
                          {faq.question}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-brand shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-brand shrink-0" />
                        )}
                      </button>
                      <div
                        className={cn(
                          "transition-all duration-300 ease-in-out overflow-hidden",
                          isExpanded ? "max-h-[500px] border-t border-[#2a2a30] p-4 bg-[#111115]/40" : "max-h-0"
                        )}
                      >
                        <p className="text-xs text-[#9fa0b8] leading-relaxed whitespace-pre-line font-inter">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7. Action Join Button */}
          <div className="pt-4">
            <button
              disabled={isUserJoined}
              onClick={handleJoinClick}
              className={cn(
                "w-full font-bold py-3.5 rounded-xl text-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 font-inter",
                isUserJoined
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default"
                  : "bg-brand hover:opacity-90 text-brand-foreground border-none shadow-md"
              )}
            >
              {isUserJoined ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  Joined
                </>
              ) : (
                <>
                  {isFree ? "Join Community" : "Subscribe"}
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const filteredMembers = useMemo(() => {
    return channelMembers.filter((m) => {
      const user = m.user;
      if (!user) return false;
      if (!channelMembersSearch.trim()) return true;
      const q = channelMembersSearch.toLowerCase();
      return (
        user.name?.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q)
      );
    });
  }, [channelMembers, channelMembersSearch]);

  const renderMembersTabContent = () => {
    if (!infoData || infoData.type !== "members") return null;

    if (loadingChannelMembers) {
      return (
        <div className="py-8 flex flex-col justify-center items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
          <span className="text-xs text-[#8888a0]">Loading members...</span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Title and search bar */}
        <div>
          {/* Borderless Search Input with icon and divider line */}
          <div className="relative flex items-center border-b border-[#2a2a35]/65 pb-1 mb-2">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8888a0]" />
            <input
              type="text"
              placeholder="Search members"
              value={channelMembersSearch}
              onChange={(e) => setChannelMembersSearch(e.target.value)}
              className="w-full pl-6 pr-3 py-1 bg-transparent border-none text-sm text-white placeholder-[#8888a0] focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Member items list */}
        {filteredMembers.length === 0 ? (
          <div className="text-center py-8 text-xs text-white/60 bg-[#17171d] border border-[#2E2E2E]/40 rounded-xl px-3">
            {channelMembersSearch.trim() ? "No matching members found" : "No members in this community"}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredMembers.map((member) => {
              const user = member.user;
              if (!user) return null;
              const userId = user._id;
              const isMe = userId === meId;

              return (
                <div key={userId} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Avatar
                      className="h-9 w-9 flex-shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("affiliate-profile:open", {
                            detail: { userId },
                          })
                        );
                      }}
                    >
                      <AvatarImage src={user.profilePicture} alt={user.name || user.email} className="object-cover" />
                      <AvatarFallback className="bg-white/10 text-white/70 text-xs font-semibold">
                        {(user.name?.[0] || user.email?.[0] || "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className="flex flex-col min-w-0 cursor-pointer hover:opacity-85 transition-opacity"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("affiliate-profile:open", {
                            detail: { userId },
                          })
                        );
                      }}
                    >
                      <span className="text-[13px] font-medium text-white truncate leading-tight">
                        {user.name || "Anonymous Member"}
                      </span>
                      <span className="text-[11px] text-[#8888a0] truncate mt-0.5 leading-none">
                        {user.email}
                      </span>
                    </div>
                  </div>
                  {!isMe && (
                    <button
                      onClick={() => openMini("dm", userId, user.name || user.email, user.profilePicture)}
                      className="h-8 w-8 flex items-center justify-center text-[#8888a0] hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                      title="Message"
                    >
                      <svg
                        className="h-4.5 w-4.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            {hasMoreChannelMembers && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLoadMoreMembers}
                  disabled={loadingMoreChannelMembers}
                  className="w-full py-2.5 border border-white/10 hover:border-white/20 hover:bg-white/5 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                >
                  {loadingMoreChannelMembers ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderViewOptionsTabContent = () => {
    if (!infoData || !infoData.channel) return null;
    const channel = infoData.channel;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white mb-1.5 font-geist">View options</h2>
          <p className="text-xs text-[#9fa0b8] leading-relaxed font-inter">
            Choose a community view to inspect members or orders for <strong className="text-white">{channel.title}</strong>.
          </p>
        </div>

        <div className="space-y-3">
          {/* Members Button */}
          <button
            onClick={() => {
              setInfoData({ type: "members", channel });
              setActiveTab("members");
            }}
            className="w-full flex items-center justify-between p-4 bg-[#1c1c20] border border-[#2a2a35] hover:bg-[#252530] transition-all rounded-xl text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#25252b] flex items-center justify-center text-[#9fa0b8] group-hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white font-inter">Members</h4>
                <p className="text-[11px] text-[#8888a0] font-inter">View the list of members in this community</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-[#8888a0] group-hover:text-white transition-colors transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Orders Button */}
          <button
            onClick={() => {
              setInfoData({ type: "orders", channel });
              setActiveTab("orders");
            }}
            className="w-full flex items-center justify-between p-4 bg-[#1c1c20] border border-[#2a2a35] hover:bg-[#252530] transition-all rounded-xl text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#25252b] flex items-center justify-center text-[#9fa0b8] group-hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white font-inter">Orders</h4>
                <p className="text-[11px] text-[#8888a0] font-inter">View the invoices and orders history</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-[#8888a0] group-hover:text-white transition-colors transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const renderOrdersTabContent = () => {
    if (!infoData || !infoData.channel) return null;
    const channel = infoData.channel;
    const isFree = channel.isFree || !channel.price || channel.price === 0;

    // Generate mock orders/invoices from channelMembers for paid communities
    const ordersList = !isFree && channelMembers.length > 0
      ? channelMembers.map((member, idx) => {
        const user = member.user;
        const priceVal = channel.price || 0;
        const symbol = channel.currency === "INR" ? "₹" : "$";
        return {
          invoiceNumber: `INV-${20482 + idx}`,
          memberName: user?.name || user?.email || "Anonymous Member",
          email: user?.email || "",
          date: member.joinedAt
            ? new Date(member.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : new Date(Date.now() - idx * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          amount: priceVal,
          currency: symbol,
        };
      })
      : [];

    return (
      <div className="space-y-4">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => {
                setInfoData({ type: "view_options", channel });
                setActiveTab("view_options");
              }}
              className="text-[#8888a0] hover:text-white mr-1 transition-colors cursor-pointer flex-shrink-0"
              title="Back to View options"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-white font-geist">Orders</h2>
            {!isFree && ordersList.length > 0 && (
              <span className="bg-[#2a2a30] text-white/90 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                {ordersList.length}
              </span>
            )}
          </div>
        </div>

        {/* Content list */}
        {isFree ? (
          <div className="text-center py-10 text-xs text-white/60 bg-[#17171d] border border-[#2E2E2E]/40 rounded-xl px-4 leading-relaxed font-inter">
            This is a free community. No sales orders or invoices are generated.
          </div>
        ) : loadingChannelMembers ? (
          <div className="py-8 flex flex-col justify-center items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <span className="text-xs text-[#8888a0] font-inter">Loading orders...</span>
          </div>
        ) : ordersList.length === 0 ? (
          <div className="text-center py-10 text-xs text-white/60 bg-[#17171d] border border-[#2E2E2E]/40 rounded-xl px-4 leading-relaxed font-inter">
            No orders or invoices found for this community.
          </div>
        ) : (
          <div className="space-y-3">
            {ordersList.map((ord) => (
              <div
                key={ord.invoiceNumber}
                className="flex items-center justify-between p-3.5 bg-[#17171d] border border-[#2E2E2E]/40 rounded-xl font-inter"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-xs font-bold text-white leading-tight font-geist">
                    {ord.invoiceNumber}
                  </span>
                  <span className="text-[11px] font-medium text-white/70 truncate mt-1">
                    {ord.memberName}
                  </span>
                  <span className="text-[10px] text-[#8888a0] truncate mt-0.5">
                    {ord.date}
                  </span>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-xs font-bold text-[#10B981]">
                    {ord.currency}{ord.amount.toFixed(2)}
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5 rounded-full font-semibold mt-1.5 uppercase leading-none">
                    Paid
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const [chatType, setChatType] = useState<ChatType>("individual");
  const [chatDropdownOpen, setChatDropdownOpen] = useState(false);
  const [showAllDms, setShowAllDms] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const DM_PREVIEW = 5;

  const [localWidth, setLocalWidth] = useState(() => {
    if (typeof window === "undefined") return 360;
    try {
      const saved = localStorage.getItem("dashboard.rightpanel.width");
      return saved ? parseInt(saved, 10) : 360;
    } catch {
      return 360;
    }
  });
  const [localIsDragging, setLocalIsDragging] = useState(false);

  const currentWidth = width !== undefined ? width : localWidth;
  const currentSetWidth = setWidth !== undefined ? setWidth : setLocalWidth;
  const currentIsDragging = isDragging !== undefined ? isDragging : localIsDragging;
  const currentSetIsDragging = setIsDragging !== undefined ? setIsDragging : setLocalIsDragging;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    currentSetIsDragging(true);

    const startX = e.clientX;
    const startWidth = currentWidth;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const isVideoTab = activeTab === "video_player" || activeTab === "playlist_player" || activeTab === "drops_feed";
      const isVideoPage = isVideoSizingPage(activePopover) || isVideoTab;
      const maxDrag = isVideoPage
        ? Math.max(720, Math.floor(window.innerWidth * 0.42))
        : 480;
      const minDrag = isVideoPage ? 360 : 240;
      const newWidth = Math.max(minDrag, Math.min(maxDrag, startWidth - deltaX));
      currentSetWidth(newWidth);
      try {
        if (!isVideoPage) {
          const isInfoTab = activeTab === "information" || activeTab === "members" || activeTab === "view_options" || activeTab === "orders" || activeTab === "sessions" || activeTab === "enrollments" || activeTab === "attendees" || activeTab === "reviews";
          if (isInfoTab) {
            localStorage.setItem("dashboard.rightpanel.infowidth", String(newWidth));
          } else {
            localStorage.setItem("dashboard.rightpanel.width", String(newWidth));
          }
        }
      } catch { }
    };

    const handleMouseUp = () => {
      currentSetIsDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Favourites — persisted to localStorage
  const [favourites, setFavourites] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("chat_favourites");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  function toggleFavourite(id: string) {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("chat_favourites", JSON.stringify([...next]));
      } catch { }
      return next;
    });
  }

  // Mini chat windows state
  const [miniChats, setMiniChats] = useState<Array<{
    kind: "dm" | "group" | "global-dm";
    id: string;
    name: string;
    avatar?: string;
    minimized: boolean;
  }>>([]);

  // Open mini chat helper
  function openMini(
    kind: "dm" | "group" | "global-dm",
    id: string,
    name: string,
    avatar?: string
  ) {
    if (activeChatId && activeChatId.id !== "") {
      const currentType = activeChatId.type;
      const currentId = activeChatId.id;
      let currentName = "Chat";
      let currentAvatar: string | undefined = undefined;

      if (currentType === "dm") {
        if (currentId.startsWith("openclaw_agent_")) {
          currentName = "AI Agent";
        } else {
          const m = members.find((x) => (x._id || x.id) === currentId);
          if (m) {
            currentName = m.name || m.email;
            currentAvatar = m.profilePicture;
          } else {
            currentName = "Direct Message";
          }
        }
      } else if (currentType === "group") {
        const g = groups.find((x) => x.id === currentId);
        if (g) {
          currentName = g.name;
          currentAvatar = g.picture || undefined;
        } else {
          currentName = "Group Chat";
        }
      } else if (currentType === "global-dm") {
        const u = globalDmUsers.find((x) => x._id === currentId);
        if (u) {
          currentName = u.name || u.email;
          currentAvatar = u.profilePicture;
        } else {
          currentName = "Global Chat";
        }
      }

      setMiniChats((prev) => {
        let next = [...prev];

        // 1. Add current full-screen chat
        const existsCurrentIdx = next.findIndex((c) => c.kind === currentType && c.id === currentId);
        if (existsCurrentIdx > -1) {
          const chatObj = next[existsCurrentIdx];
          next.splice(existsCurrentIdx, 1);
          next.unshift({ ...chatObj, minimized: false });
        } else {
          next.unshift({ kind: currentType, id: currentId, name: currentName, avatar: currentAvatar, minimized: false });
        }

        // 2. Add the newly clicked chat (only if it is different)
        if (currentId !== id || currentType !== kind) {
          const existsNewIdx = next.findIndex((c) => c.kind === kind && c.id === id);
          if (existsNewIdx > -1) {
            const chatObj = next[existsNewIdx];
            next.splice(existsNewIdx, 1);
            next.unshift({ ...chatObj, minimized: false });
          } else {
            next.unshift({ kind, id, name, avatar, minimized: false });
          }
        }

        // Apply expand limit to keep only top 2 expanded
        let expandedCount = 0;
        next = next.map((c) => {
          if (!c.minimized) {
            if (expandedCount < 2) {
              expandedCount++;
              return c;
            } else {
              return { ...c, minimized: true };
            }
          }
          return c;
        });

        return next;
      });

      setActiveChatId({ type: "dm", id: "" });
      return;
    }
    setMiniChats((prev) => {
      const existsIdx = prev.findIndex((c) => c.kind === kind && c.id === id);
      let next = [...prev];

      if (existsIdx > -1) {
        const chatObj = prev[existsIdx];
        if (existsIdx === 0 && !chatObj.minimized) {
          next.splice(0, 1);
        } else {
          next.splice(existsIdx, 1);
          next.unshift({ ...chatObj, minimized: false });
        }
      } else {
        next.unshift({ kind, id, name, avatar, minimized: false });
      }

      let expandedCount = 0;
      next = next.map((chat) => {
        if (!chat.minimized) {
          if (expandedCount < 2) {
            expandedCount++;
            return chat;
          } else {
            return { ...chat, minimized: true };
          }
        }
        return chat;
      });

      return next;
    });
  }

  function toggleMinimize(kind: "dm" | "group" | "global-dm", id: string) {
    setMiniChats((prev) => {
      const idx = prev.findIndex((c) => c.kind === kind && c.id === id);
      if (idx === -1) return prev;
      const chat = prev[idx];
      const nextMinimized = !chat.minimized;

      let next = [...prev];
      if (!nextMinimized) {
        next.splice(idx, 1);
        next.unshift({ ...chat, minimized: false });

        let expandedCount = 0;
        next = next.map((c) => {
          if (!c.minimized) {
            if (expandedCount < 2) {
              expandedCount++;
              return c;
            } else {
              return { ...c, minimized: true };
            }
          }
          return c;
        });
      } else {
        next[idx] = { ...chat, minimized: true };
      }
      return next;
    });
  }

  function closeMini(kind: "dm" | "group" | "global-dm", id: string) {
    setMiniChats((prev) => prev.filter((c) => !(c.kind === kind && c.id === id)));
  }

  // Data
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [globalDmUsers, setGlobalDmUsers] = useState<GlobalDmUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const meId = getUserIdFromToken() || "";

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).miniChats = miniChats;
    }
  }, [miniChats]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).globalDmUsers = globalDmUsers;
    }
  }, [globalDmUsers]);

  const {
    dmUnread: contextDmUnread,
    groupUnread: contextGroupUnread,
    groupMentioned: contextGroupMentioned,
    globalDmUnread: contextGlobalDmUnread,
    dmLastMessageTime,
    groupLastMessageTime,
    globalDmLastMessageTime,
    dmLastMessageText,
    groupLastMessageText,
    globalDmLastMessageText,
  } = useChat();

  const prevCollapsedRef = useRef(collapsed);

  useEffect(() => {
    const justOpened = prevCollapsedRef.current && !collapsed;
    prevCollapsedRef.current = collapsed;

    if (justOpened && activeChatId && activeChatId.id) {
      const type = activeChatId.type;
      const id = activeChatId.id;

      // Determine name and avatar for the active full screen chat
      let name = "Chat";
      let avatar: string | undefined = undefined;

      if (type === "dm") {
        if (id.startsWith("openclaw_agent_")) {
          name = "AI Agent";
        } else {
          const m = members.find((x) => (x._id || x.id) === id);
          if (m) {
            name = m.name || m.email;
            avatar = m.profilePicture;
          } else {
            name = "Direct Message";
          }
        }
      } else if (type === "group") {
        const g = groups.find((x) => x.id === id);
        if (g) {
          name = g.name;
          avatar = g.picture || undefined;
        } else {
          name = "Group Chat";
        }
      } else if (type === "global-dm") {
        const u = globalDmUsers.find((x) => x._id === id);
        if (u) {
          name = u.name || u.email;
          avatar = u.profilePicture;
        } else {
          name = "Global Chat";
        }
      }

      openMini(type, id, name, avatar);
      setActiveChatId({ type: "dm", id: "" });
    }
  }, [collapsed, activeChatId, members, groups, globalDmUsers]);

  // ---- Load members ----
  async function loadMembers() {
    const orgId = localStorage.getItem("garage_org_id");
    try {
      const res = await api<{ members: Member[] }>(
        "/team/list?orgId=" + orgId,
        {},
        getToken()!
      );
      setMembers(res.members || []);
    } catch { }
  }

  // ---- Load groups ----
  async function loadGroups() {
    const orgId = localStorage.getItem("garage_org_id");
    // Bail rather than sending the literal string "null" as orgId.
    if (!orgId) {
      setGroups([]);
      return;
    }
    try {
      const res = await api<{ groups: Group[] }>(
        `/groups?orgId=${orgId}`,
        {},
        getToken()!
      );
      setGroups(res.groups || []);
    } catch { }
  }

  // ---- Load global DM users ----
  async function loadGlobalDmUsers(search?: string) {
    try {
      const convRes = await api<{
        conversations: Array<{
          otherId: string;
          otherUser: GlobalDmUser | null;
        }>;
      }>("/global-dm/conversations", {}, getToken()!);
      let users = (convRes.conversations || [])
        .filter((c) => c.otherUser)
        .map((c) => c.otherUser!);

      if (search?.trim()) {
        const searchRes = await api<{ users: GlobalDmUser[] }>(
          `/users/discover?search=${encodeURIComponent(search)}&limit=20`,
          {},
          getToken()!
        );
        const existingIds = new Set(users.map((u) => u._id));
        const newUsers = (searchRes.users || []).filter(
          (u) => !existingIds.has(u._id)
        );
        users = [...users, ...newUsers];
      }
      setGlobalDmUsers(users);
    } catch { }
  }

  useEffect(() => {
    loadMembers();
    loadGroups();
    loadGlobalDmUsers();

    const onTeamReload = () => loadMembers();
    const onGroupsReload = () => loadGroups();
    const onOrgSwitched = () => {
      loadMembers();
      loadGroups();
    };
    window.addEventListener("team:reload", onTeamReload as any);
    window.addEventListener("groups:reload", onGroupsReload as any);
    window.addEventListener("org:switched", onOrgSwitched as any);
    return () => {
      window.removeEventListener("team:reload", onTeamReload as any);
      window.removeEventListener("groups:reload", onGroupsReload as any);
      window.removeEventListener("org:switched", onOrgSwitched as any);
    };
  }, []);

  // Sync group unread from context
  useEffect(() => {
    setGroups((prev) =>
      prev.map((g) => ({ ...g, unread: contextGroupUnread[g.id] ?? 0 }))
    );
  }, [contextGroupUnread]);

  // ---- Sorted lists ----
  const others = useMemo(() => {
    const seen = new Set<string>();
    return (members || [])
      .filter((m) => {
        const id = (m._id ?? m.id) as string | undefined;
        if (!id || id === meId) return false;
        if (seen.has(id)) return false;

        // ONLY show users with whom you have had a conversation historically
        if (!dmLastMessageTime[id]) return false;

        seen.add(id);
        return true;
      })
      .filter((m) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aId = (a._id ?? a.id) as string;
        const bId = (b._id ?? b.id) as string;
        const aTime = dmLastMessageTime[aId] || 0;
        const bTime = dmLastMessageTime[bId] || 0;
        if (aTime !== bTime) return bTime - aTime;
        return (a.name || a.email).localeCompare(b.name || b.email);
      });
  }, [members, meId, searchQuery, dmLastMessageTime]);

  const sortedGroups = useMemo(
    () =>
      groups
        .filter((g) => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return g.name?.toLowerCase().includes(q);
        })
        .sort((a, b) => {
          const aTime = groupLastMessageTime[a.id] || 0;
          const bTime = groupLastMessageTime[b.id] || 0;
          if (aTime !== bTime) return bTime - aTime;
          return (a.name || "").localeCompare(b.name || "");
        }),
    [groups, searchQuery, groupLastMessageTime]
  );

  const sortedGlobalDmUsers = useMemo(
    () =>
      globalDmUsers
        .filter((u) => u._id !== meId)
        .filter((u) => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return (
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          const aTime = globalDmLastMessageTime[a._id] || 0;
          const bTime = globalDmLastMessageTime[b._id] || 0;
          if (aTime !== bTime) return bTime - aTime;
          return (a.name || a.email).localeCompare(b.name || b.email);
        }),
    [globalDmUsers, meId, searchQuery, globalDmLastMessageTime]
  );

  const contactMembers = useMemo(() => {
    const seen = new Set<string>();
    return (members || [])
      .filter((m) => {
        const id = (m._id ?? m.id) as string | undefined;
        if (!id || id === meId) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .filter((m) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const nameA = a.name || a.email || "";
        const nameB = b.name || b.email || "";
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      });
  }, [members, meId, searchQuery]);

  const groupedContacts = useMemo(() => {
    const groups: Record<string, Member[]> = {};
    contactMembers.forEach((m) => {
      const name = m.name || m.email || "";
      const firstLetter = name[0]?.toUpperCase() || "#";
      const groupKey = /^[A-Z]$/.test(firstLetter) ? firstLetter : "#";
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(m);
    });
    // Sort keys: A-Z then #
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
    const result: Record<string, Member[]> = {};
    sortedKeys.forEach((key) => {
      result[key] = groups[key];
    });
    return result;
  }, [contactMembers]);

  const isEmpty =
    (chatType === "individual" && others.length === 0 && !searchQuery.trim()) ||
    (chatType === "group" && sortedGroups.length === 0 && !searchQuery.trim()) ||
    (chatType === "global" && sortedGlobalDmUsers.length === 0 && !searchQuery.trim());

  // ---- Unread totals ----
  const totalDmUnread = useMemo(
    () => Object.values(contextDmUnread).reduce((s, c) => s + (c || 0), 0),
    [contextDmUnread]
  );
  const totalGroupUnread = useMemo(
    () => Object.values(contextGroupUnread).reduce((s, c) => s + (c || 0), 0),
    [contextGroupUnread]
  );
  const totalGlobalUnread = useMemo(
    () => Object.values(contextGlobalDmUnread).reduce((s, c) => s + (c || 0), 0),
    [contextGlobalDmUnread]
  );

  const renderVideoDetailsSection = (scrollable: boolean = true) => {
    if (!targetVideoId) return null;

    // Get current details
    const activePlaylistVideo = currentPlaylist?.videos?.[activePlaylistVideoIdx];
    const isPlaylistMode = activeTab === "playlist_player";
    const title = isPlaylistMode ? activePlaylistVideo?.title : videoPlayerData?.title;
    const description = isPlaylistMode ? activePlaylistVideo?.description : videoPlayerData?.description;

    const handleShareClick = () => {
      if (loadingVideoShareLink) {
        toast.info("Fetching link...");
        return;
      }
      if (videoShareLink) {
        navigator.clipboard.writeText(videoShareLink);
        toast.success("Affiliate link copied to clipboard!");
      } else {
        toast.error("Affiliate link not available.");
      }
    };

    return (
      <div className={cn(
        "px-5 py-5 flex flex-col gap-5 select-text scrollbar-hide",
        scrollable ? "border-t border-[#2E2E2E] flex-1 overflow-y-auto" : "flex-shrink-0"
      )}>
        {/* Title */}
        <div>
          <h3 className="text-white text-base font-bold leading-snug line-clamp-2">{title || "Untitled Video"}</h3>
        </div>

        {/* Date & Action Buttons Row */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/[0.03] pb-3">
          {/* Published Date */}
          <div className="text-[#8888a0] text-xs font-semibold whitespace-nowrap">
            {timeAgo(targetVideoDate)}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareClick}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:bg-white/[0.05] text-white rounded-full text-[11px] font-semibold cursor-pointer transition-all active:scale-95 whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Affiliate Link
            </button>

            <button
              onClick={handleAddVideoToPlaylist}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:bg-white/[0.05] text-white rounded-full text-[11px] font-semibold cursor-pointer transition-all active:scale-95 whitespace-nowrap"
            >
              <ListPlus className="w-3.5 h-3.5" />
              Add to playlist
            </button>
          </div>
        </div>

        {/* Description Box */}
        {description && (
          <div className="bg-[#131316] border border-white/5 rounded-2xl p-4">
            <p
              className="text-[#9fa0b8] text-xs leading-relaxed [&_a]:text-brand [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(description) }}
            />
          </div>
        )}

        {/* AI Summary Section (only for recordings when successfully loaded) */}
        {!videoSummaryLoading && videoSummary && videoSummary.summary && targetVideoType === "workshop" && (
          <div className="rounded-2xl border border-brand/20 bg-brand/[0.02] p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4.5 h-4.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.982-11.825H13l3.018-7.175L7.018 13.825H11l-1.187 2.079z" />
                </svg>
                <span className="text-sm font-bold text-white tracking-wide">AI Notes</span>
                <span className="border border-brand/40 text-brand text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase scale-90">Beta</span>
              </div>
            </div>

            {/* Summary Text */}
            {videoSummary.summary.summary && (
              <div className="space-y-1">
                <h4 className="text-[#8888a0] text-[10px] font-bold uppercase tracking-wider">Summary</h4>
                <p className="text-white text-xs leading-relaxed">{videoSummary.summary.summary}</p>
              </div>
            )}

            {/* Key Points */}
            {videoSummary.summary.keyPoints && videoSummary.summary.keyPoints.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[#8888a0] text-[10px] font-bold uppercase tracking-wider">Key Points</h4>
                <ul className="space-y-2 text-white text-xs leading-relaxed list-disc list-inside marker:text-brand">
                  {videoSummary.summary.keyPoints.map((point: string, idx: number) => (
                    <li key={idx} className="pl-1">{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Feedback Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-brand/10">
              <span className="text-[10px] text-[#6b6b7b]">Was this helpful?</span>
              <div className="flex items-center gap-2">
                <button className="p-1 hover:text-brand text-[#6b6b7b] transition-colors cursor-pointer">
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 hover:text-brand text-[#6b6b7b] transition-colors cursor-pointer">
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    );
  };

  const panelWidth = collapsed ? 0 : currentWidth;

  const chatTypeLabel =
    chatType === "individual"
      ? "Individuals Chats"
      : chatType === "group"
        ? "Group Chats"
        : "Global Chats";

  const chatTypeOptions: { value: ChatType; label: string; shortLabel: string }[] = [
    { value: "individual", label: "DMs", shortLabel: "DMs" },
    { value: "group", label: "Group Chats", shortLabel: "Groups" },
    { value: "global", label: "Global Chats", shortLabel: "Global" },
  ];

  // ---- Tab icons ----
  const tabs: {
    id: RightPanelTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
      {
        id: "chats",
        label: "Chats",
        icon: <MessageSquare className="h-[15px] w-[15px]" />,
        badge: totalDmUnread + totalGroupUnread + totalGlobalUnread || undefined,
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: <Bell className="h-[15px] w-[15px]" />,
      },
      {
        id: "search",
        label: "Search",
        icon: <Search className="h-[15px] w-[15px]" />,
      },
      {
        id: "download",
        label: "Download",
        icon: <PlayStoreIcon className="h-[15px] w-[15px]" />,
      },
    ];

  if (infoData) {
    if (infoData.type === "members") {
      tabs.push({
        id: "members",
        label: "Members",
        icon: null,
      });
    } else if (infoData.type === "view_options") {
      tabs.push({
        id: "view_options",
        label: "View Options",
        icon: null,
      });
    } else if (infoData.type === "orders") {
      tabs.push({
        id: "orders",
        label: "Orders",
        icon: null,
      });
    } else {
      tabs.push({
        id: "information",
        label:
          infoData.type === "information"
            ? "Learn more"
            : infoData.type === "grow_network"
              ? "Grow Network"
              : "Information",
        icon: null,
      });
    }
  }

  if (reviewsData) {
    tabs.push({
      id: "reviews",
      label: "Reviews",
      icon: <Star className="h-[15px] w-[15px]" />,
    });
  }

  if (videoPlayerData) {
    tabs.push({
      id: "video_player",
      label: "Information",
      icon: <Video className="h-[15px] w-[15px]" />,
    });
  }

  if (dropsFeedData) {
    tabs.push({
      id: "drops_feed",
      label: "Information",
      icon: <Video className="h-[15px] w-[15px]" />,
    });
  }

  if (playlistId) {
    tabs.push({
      id: "playlist_player",
      label: "Information",
      icon: <Video className="h-[15px] w-[15px]" />,
    });
  }



  return (
    <aside
      className={cn(
        "absolute right-0 top-0 bottom-0 z-[610] bg-[#0e0e12] h-full flex flex-col overflow-hidden",
        collapsed ? "border-l-0" : "border-l border-[#2E2E2E] shadow-2xl",
        currentIsDragging ? "" : "transition-all duration-150"
      )}
      style={{ width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth }}
    >
      {currentIsDragging && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize pointer-events-auto bg-transparent" />
      )}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 bottom-0 left-0 w-[6px] cursor-col-resize z-[100]"
          title="Drag to resize"
        />
      )}
      {!collapsed && (
        <>
          {/* ── Header: pill tabs + collapse button ── */}
          {activeTab !== "search" && (
            <div
              className="sticky top-0 z-10 flex items-center h-[48px] bg-[#0e0e12]/95 backdrop-blur border-b border-[#2E2E2E] px-5 flex-shrink-0"
            >
              <div className="flex items-center gap-2 w-full">
                {/* Pill tabs only — collapse button is in the AppTabBar */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const isInfo = tab.id === "information" || tab.id === "members" || tab.id === "view_options" || tab.id === "orders" || tab.id === "sessions" || tab.id === "enrollments" || tab.id === "attendees";
                    return (
                      <div key={tab.id} className="relative">
                        <button
                          onClick={() => {
                            setActiveTab(tab.id);
                          }}
                          className={cn(
                            isInfo
                              ? cn(
                                "relative flex items-center justify-center h-8 rounded-full text-xs font-semibold select-none flex-shrink-0 transition-all duration-200 px-3",
                                isActive
                                  ? "bg-brand text-brand-foreground font-bold cursor-pointer"
                                  : "border border-white/10 text-[#8888a0] hover:text-white hover:bg-white/[0.05] cursor-pointer"
                              )
                              : cn(
                                "relative flex items-center h-8 rounded-lg text-xs font-semibold select-none flex-shrink-0 justify-start pl-2 overflow-hidden transition-colors duration-200",
                                isActive
                                  ? "text-brand-foreground cursor-pointer font-bold"
                                  : "text-[#8888a0] hover:text-white hover:bg-white/[0.05] cursor-pointer"
                              )
                          )}
                          style={{
                            width: isActive ? getTabWidth(tab.id) : (isInfo ? getTabWidth(tab.id) : 32),
                            transition: currentIsDragging ? "none" : "width 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                          }}
                          title={tab.label}
                        >
                          {isActive && !isInfo && (
                            <motion.div
                              layoutId={currentIsDragging ? undefined : "activeRightPanelTabIndicator"}
                              className="absolute inset-0 bg-brand rounded-lg shadow-sm"
                              transition={currentIsDragging ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 24, mass: 1 }}
                              style={{ zIndex: 0 }}
                            />
                          )}
                          <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
                            {tab.icon}
                            <AnimatePresence initial={false}>
                              {(isActive || isInfo) && (
                                <motion.span
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -8 }}
                                  transition={{ type: "spring", stiffness: 180, damping: 24, mass: 1 }}
                                  className={cn(isInfo ? "" : "hidden sm:inline")}
                                >
                                  {tab.label}
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </span>
                        </button>

                        {tab.badge && tab.badge > 0 && (
                          <span
                            className={cn(
                              "absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-[4px] text-[9px] font-bold flex items-center justify-center pointer-events-none",
                              isActive
                                ? "bg-black text-white"
                                : "bg-brand text-brand-foreground"
                            )}
                          >
                            {tab.badge > 99 ? "99+" : tab.badge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-7 w-7 flex items-center justify-center text-[#8888a0] hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0"
                    title="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
          {/* ── Body ── */}
          <div
            className={cn(
              "flex-1 overscroll-contain scrollbar-hide",
              (activeTab === "drops_feed" || activeTab === "video_player" || activeTab === "playlist_player" || activeTab === "search" || activeTab === "sessions" || activeTab === "enrollments" || activeTab === "attendees") ? "overflow-hidden" : "overflow-y-auto"
            )}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* CHATS TAB */}
            {activeTab === "chats" && (
              <div className="relative flex flex-col h-full min-h-0">
                {/* Search Bar / Segmented Tab Row */}
                <div className="px-4 pt-3 pb-2 flex-shrink-0">
                  {isSearchOpen ? (
                    <div className="relative flex items-center gap-2 w-full">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8888a0]" />
                        <input
                          type="text"
                          placeholder="Search chats..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-8 py-2 bg-[#17171d] border border-[#2E2E2E] rounded-full text-xs text-white placeholder-[#8888a0] focus:outline-none focus:border-brand/40 transition-colors"
                          autoFocus
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888a0] hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="text-xs text-[#8888a0] hover:text-white transition-colors px-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* Magnifier Search Button */}
                      <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-[#17171d] text-[#8888a0] hover:text-white hover:bg-white/[0.05] transition-all flex-shrink-0 cursor-pointer"
                        title="Search chats"
                      >
                        <Search className="h-4 w-4" />
                      </button>

                      {/* Tabs Container */}
                      <div className="flex items-center border border-white/10 rounded-full bg-[#16161c]/40 p-[3px] flex-1 relative overflow-hidden">
                        {chatTypeOptions.map((opt) => {
                          const isActive = chatType === opt.value;
                          const labelToShow = currentWidth < 360 ? opt.shortLabel : opt.label;
                          const hasUnread =
                            opt.value === "individual"
                              ? totalDmUnread > 0
                              : opt.value === "group"
                                ? totalGroupUnread > 0
                                : totalGlobalUnread > 0;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setChatType(opt.value);
                                setSearchQuery("");
                              }}
                              className={cn(
                                "relative flex-1 py-1.5 text-[11px] font-semibold transition-colors duration-200 select-none rounded-full z-10 cursor-pointer flex items-center justify-center gap-1.5 px-1 min-w-0",
                                isActive ? "text-brand-foreground font-bold" : "text-[#8888a0] hover:text-white"
                              )}
                              title={opt.label}
                            >
                              {isActive && (
                                <div
                                  className="absolute inset-0 bg-brand rounded-full"
                                  style={{ zIndex: -1 }}
                                />
                              )}
                              <span className="truncate">{labelToShow}</span>
                              {hasUnread && (
                                <span
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                    isActive ? "bg-black" : "bg-brand"
                                  )}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat list */}
                <div className={cn("flex-1 px-4 pb-4 space-y-1 overflow-y-auto min-h-0", isEmpty && "flex flex-col")}>
                  {/* ── Individual Chats ── */}
                  {chatType === "individual" && (
                    <>
                      {others.length === 0 && !searchQuery.trim() ? (
                        <EmptyChatState onStartNew={() => setActiveTab("search")} />
                      ) : (
                        <>
                          {/* Favourites section — only shown when there are starred contacts */}
                          {(() => {
                            const favMembers = others.filter((m) =>
                              favourites.has((m._id ?? m.id) as string)
                            );
                            if (favMembers.length === 0) return null;
                            return (
                              <div className="mb-4">
                                <div className="flex items-center justify-between px-1 mb-2">
                                  <span className="text-[10px] font-semibold text-[#8888a0] uppercase tracking-wider">
                                    Favourites
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFavourites(new Set());
                                      localStorage.removeItem("chat_favourites");
                                    }}
                                    className="h-5 w-5 flex items-center justify-center text-[#8888a0] hover:text-white rounded transition-colors cursor-pointer"
                                    title="Clear Favourites"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="divide-y divide-[#2E2E2E]">
                                  {favMembers.map((favMember) => {
                                    const favId = (favMember._id ?? favMember.id) as string;
                                    const unread = contextDmUnread[favId] || 0;
                                    const isActive =
                                      (activeChatId.type === "dm" && activeChatId.id === favId) ||
                                      miniChats.some((c) => c.kind === "dm" && c.id === favId);
                                    const lastTime = dmLastMessageTime[favId];
                                    const formattedTime = formatLastMessageTime(lastTime);
                                    const statusColor = getStatusColor(favMember.lastSeenAt);
                                    const previewSnippet = dmLastMessageText[favId] || "";

                                    return (
                                      <div
                                        key={favId}
                                        onClick={() =>
                                          openMini("dm", favId, favMember.name || favMember.email, favMember.profilePicture)
                                        }
                                        className={cn(
                                          "w-full flex items-center gap-3 px-2 py-3 transition-all duration-150 cursor-pointer group/item",
                                          isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                                        )}
                                      >
                                        <div className="relative flex-shrink-0">
                                          <Avatar className="h-[38px] w-[38px] border border-white/10">
                                            <AvatarImage src={favMember.profilePicture} />
                                            <AvatarFallback className="bg-brand/20 text-brand text-xs font-semibold">
                                              {(favMember.name?.[0] || favMember.email?.[0] || "?").toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0e0e12]", statusColor)} />
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col text-left gap-0.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-white truncate font-medium">
                                              {favMember.name || favMember.email}
                                            </span>
                                            {formattedTime && (
                                              <span className="text-[10px] text-[#8888a0] font-medium ml-2">
                                                {formattedTime}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#8888a0] truncate flex-1 pr-2">
                                              <ChatPreviewText text={previewSnippet} />
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleFavourite(favId);
                                                }}
                                                className="h-5 w-5 flex items-center justify-center text-amber-400 hover:text-amber-500 rounded transition-colors cursor-pointer"
                                                title="Remove from Favourites"
                                              >
                                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                                              </button>
                                              {unread > 0 && (
                                                <span className="h-5 w-5 min-w-[20px] px-1 rounded-[6px] bg-brand text-brand-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                                                  {unread > 99 ? "99+" : unread}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Direct Messages section */}
                          <div className="divide-y divide-[#2E2E2E]">
                            {others.length === 0 && searchQuery.trim() ? (
                              <p className="text-xs text-[#8888a0] px-2 py-3 text-left">
                                No results found.
                              </p>
                            ) : (
                              others.map((m) => {
                                const id = (m._id ?? m.id) as string;
                                const unread = contextDmUnread[id] || 0;
                                const isActive =
                                  (activeChatId.type === "dm" && activeChatId.id === id) ||
                                  miniChats.some((c) => c.kind === "dm" && c.id === id);
                                const isFav = favourites.has(id);
                                const lastTime = dmLastMessageTime[id];
                                const formattedTime = formatLastMessageTime(lastTime);
                                const statusColor = getStatusColor(m.lastSeenAt);
                                const previewSnippet = dmLastMessageText[id] || "";

                                return (
                                  <div
                                    key={id}
                                    onClick={() =>
                                      openMini("dm", id, m.name || m.email, m.profilePicture)
                                    }
                                    className={cn(
                                      "w-full flex items-center gap-3 px-2 py-3 transition-all duration-150 cursor-pointer group/item",
                                      isActive
                                        ? "bg-white/[0.06]"
                                        : "hover:bg-white/[0.03]"
                                    )}
                                  >
                                    <div className="relative flex-shrink-0">
                                      <Avatar className="h-[38px] w-[38px] border border-white/10">
                                        <AvatarImage src={m.profilePicture} />
                                        <AvatarFallback className="bg-white/10 text-white/70 text-xs font-semibold">
                                          {(m.name?.[0] || m.email?.[0] || "?").toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0e0e12]", statusColor)} />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col text-left gap-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-white truncate font-medium">
                                          {m.name || m.email}
                                        </span>
                                        {formattedTime && (
                                          <span className="text-[10px] text-[#8888a0] font-medium ml-2">
                                            {formattedTime}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-[#8888a0] truncate flex-1 pr-2">
                                          <ChatPreviewText text={previewSnippet} />
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFavourite(id);
                                            }}
                                            className={cn(
                                              "h-5 w-5 flex items-center justify-center rounded transition-all",
                                              isFav
                                                ? "text-amber-400 opacity-100"
                                                : "text-[#8888a0] hover:text-amber-400 opacity-0 group-hover/item:opacity-100"
                                            )}
                                            title={isFav ? "Remove from favourites" : "Add to favourites"}
                                          >
                                            <Star className={cn("h-3.5 w-3.5", isFav && "fill-amber-400")} />
                                          </button>
                                          {unread > 0 && (
                                            <span className="h-5 w-5 min-w-[20px] px-1 rounded-[6px] bg-brand text-brand-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                                              {unread > 99 ? "99+" : unread}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* ── Group Chats ── */}
                  {chatType === "group" && (
                    <>
                      {sortedGroups.length === 0 ? (
                        <EmptyChatState
                          isGroup={true}
                          onGroupCreated={(newId, groupName) => {
                            loadGroups();
                            openMini("group", newId, groupName || "New Group");
                          }}
                        />
                      ) : (
                        <div className="divide-y divide-[#2E2E2E]">
                          {sortedGroups.map((g) => {
                            const unread = g.unread || 0;
                            const isActive =
                              (activeChatId.type === "group" && activeChatId.id === g.id) ||
                              miniChats.some((c) => c.kind === "group" && c.id === g.id);
                            const lastTime = groupLastMessageTime[g.id];
                            const formattedTime = formatLastMessageTime(lastTime);
                            const previewSnippet = groupLastMessageText[g.id] || g.description || "";

                            return (
                              <div
                                key={g.id}
                                onClick={() =>
                                  openMini("group", g.id, g.name, g.picture || undefined)
                                }
                                className={cn(
                                  "w-full flex items-center gap-3 px-2 py-3 transition-all duration-150 cursor-pointer group/item",
                                  isActive
                                    ? "bg-white/[0.06]"
                                    : "hover:bg-white/[0.03]"
                                )}
                              >
                                <div className="relative flex-shrink-0">
                                  <Avatar className="h-[38px] w-[38px] border border-white/10">
                                    <AvatarImage src={g.picture || undefined} />
                                    <AvatarFallback className="bg-brand/20 text-brand text-xs font-semibold">
                                      {g.name?.[0]?.toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col text-left gap-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-white truncate font-medium">
                                      {g.name}
                                    </span>
                                    {formattedTime && (
                                      <span className="text-[10px] text-[#8888a0] font-medium ml-2">
                                        {formattedTime}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-[#8888a0] truncate flex-1 pr-2">
                                      <ChatPreviewText text={previewSnippet} />
                                    </span>
                                    {/* WhatsApp-style "@": an unread message here tags me */}
                                    {unread > 0 && contextGroupMentioned[g.id] && (
                                      <span
                                        className="h-5 w-5 mr-1 rounded-[6px] bg-brand text-brand-foreground text-[12px] font-bold flex items-center justify-center flex-shrink-0"
                                        title="You were mentioned"
                                        aria-label="You were mentioned"
                                      >
                                        @
                                      </span>
                                    )}
                                    {unread > 0 && (
                                      <span className="h-5 w-5 min-w-[20px] px-1 rounded-[6px] bg-brand text-brand-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                                        {unread > 99 ? "99+" : unread}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Global Chats ── */}
                  {chatType === "global" && (
                    <>
                      {sortedGlobalDmUsers.length === 0 ? (
                        <EmptyChatState onStartNew={() => setActiveTab("search")} />
                      ) : (
                        <div className="divide-y divide-[#2E2E2E]">
                          {sortedGlobalDmUsers.map((u) => {
                            const unread = contextGlobalDmUnread[u._id] || 0;
                            const isActive =
                              (activeChatId.type === "global-dm" && activeChatId.id === u._id) ||
                              miniChats.some((c) => c.kind === "global-dm" && c.id === u._id);
                            const lastTime = globalDmLastMessageTime[u._id];
                            const formattedTime = formatLastMessageTime(lastTime);
                            const statusColor = getStatusColor(null);
                            const previewSnippet = globalDmLastMessageText[u._id] || "";

                            return (
                              <div
                                key={u._id}
                                onClick={() =>
                                  openMini("global-dm", u._id, u.name || u.email, u.profilePicture)
                                }
                                className={cn(
                                  "w-full flex items-center gap-3 px-2 py-3 transition-all duration-150 cursor-pointer group/item",
                                  isActive
                                    ? "bg-white/[0.06]"
                                    : "hover:bg-white/[0.03]"
                                )}
                              >
                                <div className="relative flex-shrink-0">
                                  <Avatar className="h-[38px] w-[38px] border border-white/10">
                                    <AvatarImage src={u.profilePicture} />
                                    <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                                      {(u.name?.[0] || u.email?.[0] || "?").toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0e0e12]", statusColor)} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col text-left gap-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-white truncate font-medium">
                                      {u.name || u.email}
                                    </span>
                                    {formattedTime && (
                                      <span className="text-[10px] text-[#8888a0] font-medium ml-2">
                                        {formattedTime}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-[#8888a0] truncate flex-1 pr-2">
                                      <ChatPreviewText text={previewSnippet} />
                                    </span>
                                    {unread > 0 && (
                                      <span className="h-5 w-5 min-w-[20px] px-1 rounded-[6px] bg-brand text-brand-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                                        {unread > 99 ? "99+" : unread}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Floating Plus button */}
                {!isEmpty && (
                  chatType === "group" ? (
                    <CreateGroupDialog
                      triggerType="fab"
                      onCreated={(newId, groupName) => {
                        loadGroups();
                        openMini("group", newId, groupName || "New Group");
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("search")}
                      className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-brand hover:bg-brand/95 text-brand-foreground flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:scale-105 active:scale-95 transition-all z-50 cursor-pointer animate-in fade-in zoom-in-50 duration-250"
                      title="New Chat"
                    >
                      <Plus className="h-6 w-6 stroke-[3]" />
                    </button>
                  )
                )}
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === "notifications" && (
              <div className="h-full overflow-hidden">
                <NotificationPage
                  onClose={() => { }}
                  isMini={true}
                />
              </div>
            )}

            {/* SEARCH TAB */}
            {activeTab === "search" && (
              <div className="flex flex-col h-full min-h-0 bg-[#0e0e12]">
                {/* ── New Chat Header ── */}
                <div className="sticky top-0 z-10 flex items-center h-[48px] border-b border-[#2E2E2E] px-4 flex-shrink-0 bg-[#0e0e12]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("chats");
                      setSearchQuery("");
                    }}
                    className="flex items-center gap-2 text-white hover:text-white/80 cursor-pointer"
                  >
                    <ChevronLeft className="h-5.5 w-5.5 text-white stroke-[2.5]" />
                    <span className="text-base font-semibold text-white/95">New Chat</span>
                  </button>
                </div>

                {/* ── Search Input ── */}
                <div className="px-4 pt-4 pb-3 space-y-4 flex-shrink-0 bg-[#0e0e12]">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#8888a0]" />
                    <input
                      type="text"
                      placeholder="Search contacts"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[#17171d] border border-[#2E2E2E] rounded-xl text-sm text-white placeholder-[#8888a0] focus:outline-none focus:border-brand/40 transition-colors h-10"
                    />
                  </div>

                  {!searchQuery.trim() && (
                    <div className="space-y-3 pb-1">
                      {/* New Contact */}
                      <InviteMemberDialog>
                        <button
                          type="button"
                          className="w-full flex items-center gap-4 px-2 py-1.5 rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer text-left"
                        >
                          <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-brand-foreground flex-shrink-0">
                            <UserPlus className="h-5 w-5 stroke-[2.5]" />
                          </div>
                          <span className="text-sm font-semibold text-white">New Contact</span>
                        </button>
                      </InviteMemberDialog>

                      {/* New Group */}
                      <CreateGroupDialog
                        triggerType="list-item"
                        onCreated={(newId, groupName) => {
                          loadGroups();
                          openMini("group", newId, groupName || "New Group");
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* ── Alphabetical Contact Roster ── */}
                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 min-h-0 scrollbar-hide">
                  {Object.entries(groupedContacts).length === 0 ? (
                    <p className="text-xs text-[#8888a0] px-2 py-3">No results found.</p>
                  ) : (
                    Object.entries(groupedContacts).map(([letter, list]) => (
                      <div key={letter} className="space-y-1">
                        <div className="text-[#8888a0] font-bold text-xs uppercase tracking-wider px-2 py-1 mt-2">
                          {letter}
                        </div>
                        <div className="space-y-0.5">
                          {list.map((m) => {
                            const id = (m._id ?? m.id) as string;
                            const statusColor = getStatusColor(m.lastSeenAt);
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => {
                                  const kind = chatType === "global" ? "global-dm" : "dm";
                                  openMini(kind, id, m.name || m.email, m.profilePicture);
                                  setActiveTab("chats");
                                  setSearchQuery("");
                                }}
                                className="w-full flex items-center gap-4 px-2 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer text-left"
                              >
                                <div className="relative flex-shrink-0">
                                  <Avatar className="h-10 w-10 border border-white/10">
                                    <AvatarImage src={m.profilePicture} />
                                    <AvatarFallback className="bg-brand/20 text-brand text-sm font-semibold">
                                      {(m.name?.[0] || m.email?.[0] || "?").toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0e0e12]", statusColor)} />
                                </div>
                                <span className="text-sm font-medium text-white/90 truncate">
                                  {m.name || m.email}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* DOWNLOAD TAB */}
            {activeTab === "download" && (
              <div className="px-5 py-6 select-text overflow-y-auto max-h-[calc(100vh-64px)] scrollbar-hide">
                <AppDownloadsPanel />
              </div>
            )}

            {/* REVIEWS TAB — tighter side padding than the other tabs; the
                review cards carry their own borders, so extra inset just
                narrows an already narrow panel. */}
            {activeTab === "reviews" && reviewsData && (
              <div className="px-3 py-4 select-text overflow-y-auto max-h-[calc(100vh-64px)] scrollbar-hide">
                {reviewsData.title && (
                  <p className="text-xs text-[#8a8a9b] mb-3">
                    {reviewsData.title}
                  </p>
                )}
                {/* `amIFounder` is scoped to the signed-in office, while this
                    panel can also show a target from another org (a Discover
                    listing). That only ever over-offers the control: the
                    backend authorizes the delete against the target's own org
                    and 403s otherwise, which surfaces in the panel's error
                    slot. The founder's reliable cross-product view is the
                    "All reviews" tab in Ratings & Reviews. */}
                <ReviewsPanel
                  targetType={reviewsData.targetType}
                  targetId={reviewsData.targetId}
                  canModerate={amIFounder}
                />
              </div>
            )}

            {/* INFORMATION TAB */}
            {activeTab === "information" && infoData && (
              <div className="px-5 py-6 select-text overflow-y-auto max-h-[calc(100vh-64px)] scrollbar-hide">
                {renderInformationTabContent()}
              </div>
            )}

            {/* MEMBERS TAB */}
            {activeTab === "members" && infoData && (
              <div className="px-5 py-6 select-text overflow-y-auto max-h-[calc(100vh-64px)] scrollbar-hide">
                {renderMembersTabContent()}
              </div>
            )}

            {/* VIEW OPTIONS TAB */}
            {activeTab === "view_options" && infoData && (
              <div className="px-5 py-6 select-text overflow-y-auto max-h-[calc(100vh-64px)] scrollbar-hide">
                {renderViewOptionsTabContent()}
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === "orders" && infoData && (
              <div className="px-5 py-6 select-text overflow-y-auto max-h-[calc(100vh-64px)] scrollbar-hide">
                {renderOrdersTabContent()}
              </div>
            )}

            {/* SESSIONS TAB */}
            {activeTab === "sessions" && infoData && (
              <div className="flex flex-col h-full min-h-0 select-text p-6 overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
                {renderSessionsTabContent()}
              </div>
            )}

            {/* ENROLLMENTS TAB */}
            {activeTab === "enrollments" && infoData && (
              <div className="flex flex-col h-full min-h-0 select-text p-6 overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
                {renderEnrollmentsTabContent()}
              </div>
            )}

            {/* ATTENDEES TAB */}
            {activeTab === "attendees" && infoData && (
              <div className="flex flex-col h-full min-h-0 select-text p-6 overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
                {renderAttendeesTabContent()}
              </div>
            )}

            {/* VIDEO PLAYER TAB */}
            {activeTab === "video_player" && videoPlayerData && (
              <div className="flex flex-col h-full overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
                {/* Video */}
                <div className="relative bg-black flex-shrink-0 max-h-[55vh]" style={{ aspectRatio: "16/9" }}>
                  <CustomVideoPlayer
                    key={videoPlayerData.url}
                    src={videoPlayerData.url}
                    poster={videoPlayerData.thumbnail}
                    autoPlay
                    onTimeUpdate={setReplayTime}
                  />
                </div>
                {/* Chat replay — only webinars have room chat to replay. */}
                {videoPlayerData.type === "workshop" && videoPlayerData.id && (
                  <div className="flex-shrink-0 border-y border-white/[0.06] max-h-[30vh] overflow-hidden">
                    <WebinarChatReplay
                      workshopId={videoPlayerData.id}
                      startedAt={replayStartedAt}
                      currentTime={replayTime}
                      className="max-h-[30vh]"
                    />
                  </div>
                )}
                {/* Info */}
                {renderVideoDetailsSection()}
              </div>
            )}

            {/* PLAYLIST PLAYER TAB */}
            {activeTab === "playlist_player" && playlistId && (() => {
              const videos = currentPlaylist?.videos || [];
              const activeVideo = videos[activePlaylistVideoIdx];
              return (
                <div className="flex flex-col h-full overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
                  {/* Video Player */}
                  <div className="relative bg-black flex-shrink-0 max-h-[55vh]" style={{ aspectRatio: "16/9" }}>
                    {loadingPlaylist ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0c0c0e]">
                        <Loader2 className="h-8 w-8 text-brand animate-spin mb-2" />
                        <p className="text-xs text-[#8888a0]">Loading video...</p>
                      </div>
                    ) : playlistStreamUrl ? (
                      <CustomVideoPlayer
                        id="playlist-panel-video"
                        key={playlistStreamUrl}
                        src={playlistStreamUrl}
                        poster={activeVideo?.thumbnail}
                        autoPlay
                        onEnded={() => {
                          if (activePlaylistVideoIdx < videos.length - 1) {
                            setActivePlaylistVideoIdx(activePlaylistVideoIdx + 1);
                          }
                        }}
                      />
                    ) : activeVideo?.videoUrl ? (
                      <CustomVideoPlayer
                        id="playlist-panel-video"
                        key={activeVideo.videoUrl}
                        src={activeVideo.videoUrl}
                        poster={activeVideo?.thumbnail}
                        autoPlay
                        onEnded={() => {
                          if (activePlaylistVideoIdx < videos.length - 1) {
                            setActivePlaylistVideoIdx(activePlaylistVideoIdx + 1);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#9fa0b8] bg-[#0c0c0e]">
                        <p className="text-xs">Streaming link not available</p>
                      </div>
                    )}

                    {/* Left overlay back chevron */}
                    <button
                      onClick={() => {
                        setActiveTab("chats");
                        setPlaylistId(null);
                      }}
                      className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-black/45 hover:bg-black/60 flex items-center justify-center text-white cursor-pointer transition-all active:scale-90"
                      title="Close Player"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Scrollable details and playlist videos list */}
                  <div className="flex-1 overflow-y-auto select-text scrollbar-hide flex flex-col">
                    {/* Active Video Details */}
                    {renderVideoDetailsSection(false)}

                    {/* Playlist Header details */}
                    <div className="px-5 py-4 flex flex-col gap-1 bg-[#131316] border-t border-b border-[#2E2E2E] flex-shrink-0">
                      <h2 className="text-white text-base font-bold leading-tight">{currentPlaylist?.title || "Playlist"}</h2>
                      <span className="text-[#8888a0] text-xs font-semibold">
                        {videos.length > 0 ? `${activePlaylistVideoIdx + 1} / ${videos.length} videos` : "No videos"}
                      </span>
                    </div>

                    {/* Scrollable list of videos inside playlist */}
                    <div className="divide-y divide-[#2E2E2E]/30 bg-[#0e0e12] select-none">
                      {loadingPlaylist ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 text-brand animate-spin mb-2" />
                          <p className="text-xs text-[#8888a0]">Loading playlist...</p>
                        </div>
                      ) : videos.length > 0 ? (
                        videos.map((video: PlaylistVideo, idx: number) => {
                          const isActive = idx === activePlaylistVideoIdx;

                          const fmtDuration = (sec?: number) => {
                            if (!sec) return "0:00";
                            const m = Math.floor(sec / 60);
                            const s = sec % 60;
                            return `${m}:${s < 10 ? "0" : ""}${s}`;
                          };

                          return (
                            <div
                              key={video._id}
                              onClick={() => setActivePlaylistVideoIdx(idx)}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-l-4",
                                isActive
                                  ? "bg-brand/5 border-brand hover:bg-brand/10"
                                  : "border-transparent hover:bg-white/[0.02]"
                              )}
                            >
                              {/* Play Icon or Number */}
                              <div className="w-5 flex items-center justify-center flex-shrink-0">
                                {isActive ? (
                                  <Play className="w-3.5 h-3.5 text-brand fill-brand" />
                                ) : (
                                  <span className="text-[#6b6b7b] text-xs font-mono">{idx + 1}</span>
                                )}
                              </div>

                              {/* Thumbnail with overlay duration & type badge */}
                              <div className="w-24 aspect-[16/10] bg-[#1a1a22] rounded-lg overflow-hidden flex-shrink-0 relative border border-white/5">
                                {video.thumbnail ? (
                                  <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Video className="w-5 h-5 text-white/20" />
                                  </div>
                                )}
                                {video.duration && (
                                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-semibold px-1 rounded">
                                    {fmtDuration(video.duration)}
                                  </span>
                                )}
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[9px] font-bold tracking-wider text-brand uppercase px-1 truncate select-none">
                                  {(() => {
                                    const src = video._videoSource || video.contentType || "";
                                    if (src === "workshop") return "RECORDING";
                                    if (src === "standalone") return "VIDEO";
                                    if (src === "courseVideo" || src === "course") return "COURSE";
                                    return "VIDEO";
                                  })()}
                                </span>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className={cn(
                                  "text-xs font-semibold leading-snug line-clamp-2",
                                  isActive ? "text-brand" : "text-white"
                                )}>
                                  {video.title}
                                </h4>
                                <span className="text-[#8888a0] text-[10px] mt-1 truncate">
                                  {(() => {
                                    const src = video._videoSource || video.contentType || "";
                                    if (src === "workshop") return "Recording";
                                    if (src === "standalone") return "Video";
                                    if (src === "courseVideo" || src === "course") return "Course";
                                    return "Video";
                                  })()}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-xs text-[#8888a0]">No videos in this playlist</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* DROPS FEED TAB */}
            {activeTab === "drops_feed" && dropsFeedData && (() => {
              const drops = dropsFeedData.drops;
              const currentDrop = drops[dropsCurrentIndex];
              if (!currentDrop) return null;
              const fmtNum = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);
              const timeAgo = (d: string) => {
                const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
                if (sec < 60) return "Just now";
                const min = Math.floor(sec / 60);
                if (min < 60) return `${min}m ago`;
                const hr = Math.floor(min / 60);
                if (hr < 24) return `${hr}h ago`;
                return `${Math.floor(hr / 24)}d ago`;
              };
              const isLiked = dropsLikedIds.has(currentDrop._id);
              return (
                <div className="relative flex items-center h-full bg-[#0e0e12] px-3 py-4" style={{ height: "calc(100vh - 48px)" }}>
                  <style>{`
                    .drops-feed { scrollbar-width: none; -ms-overflow-style: none; }
                    .drops-feed::-webkit-scrollbar { display: none; }
                  `}</style>

                  {/* Scrollable Snap container for drops */}
                  <div
                    ref={dropsFeedRef}
                    className="drops-feed flex-1 h-full bg-black overflow-y-scroll rounded-[20px] border border-[#2a2a35]/40"
                    style={{
                      scrollSnapType: "y mandatory",
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    {drops.map((drop, index) => {
                      const isCurrentlyActive = index === dropsCurrentIndex;
                      const isNext = index === dropsCurrentIndex + 1;
                      const shouldRender = Math.abs(index - dropsCurrentIndex) <= 1;

                      return (
                        <div
                          key={drop._id}
                          data-index={index}
                          className="w-full h-full relative shrink-0"
                          style={{
                            height: "100%",
                            scrollSnapAlign: "start",
                            scrollSnapStop: "always",
                          }}
                        >
                          {shouldRender ? (
                            <DropVideoPlayer
                              streamUrl={drop.streamUrl || ""}
                              videoUrl={drop.videoUrl}
                              sourceType={drop.sourceType}
                              thumbnailUrl={drop.thumbnailUrl}
                              isActive={isCurrentlyActive}
                              isNext={isNext}
                              onViewCounted={() => handleView(drop._id)}
                            />
                          ) : (
                            <div className="w-full h-full bg-black" style={{ backgroundImage: drop.thumbnailUrl ? `url(${drop.thumbnailUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
                          )}

                          {/* Bottom info overlay */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none">
                            <div className="flex items-center gap-2 mb-1.5 pointer-events-auto">
                              <div
                                className="w-6 h-6 rounded-full bg-[#2a2a35] bg-cover bg-center border border-white/20 flex-shrink-0"
                                style={{ backgroundImage: `url(${drop.authorId?.profilePicture || drop.authorId?.avatar || ""})` }}
                              />
                              <span className="text-white text-xs font-semibold truncate">
                                {drop.authorId?.name || "Unknown"}
                              </span>
                              <span className="text-white/40 text-[9px] ml-auto">{timeAgo(drop.createdAt)}</span>
                            </div>
                            {drop.caption && (
                              <p className="text-white/90 text-[11px] line-clamp-2 leading-relaxed">{drop.caption}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Vertical controls on the right side */}
                  <div className="w-14 flex flex-col items-center justify-center gap-6 z-20 flex-shrink-0 select-none">
                    {/* Navigation arrows */}
                    <div className="flex flex-col gap-2.5">
                      <button
                        onClick={() => navigateToDrop(dropsCurrentIndex - 1)}
                        disabled={dropsCurrentIndex === 0}
                        className="w-9 h-9 rounded-full bg-[#1a1a24] border border-[#2a2a35]/60 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/25 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-md"
                        title="Previous Drop"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => navigateToDrop(dropsCurrentIndex + 1)}
                        disabled={dropsCurrentIndex === drops.length - 1}
                        className="w-9 h-9 rounded-full bg-[#1a1a24] border border-[#2a2a35]/60 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/25 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-md"
                        title="Next Drop"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Divider line */}
                    <div className="h-[1px] w-5 bg-white/10" />

                    {/* Action buttons */}
                    <div className="flex flex-col items-center gap-5">
                      {/* Share Button (Send paper plane icon) */}
                      <button
                        onClick={() => {
                          const meId = getUserIdFromToken() || "";
                          const refId = myAffiliateId || meId;
                          const orgSlug = orgDetails?.slug || localStorage.getItem("garage_org_slug") || (orgDetails?.name ? slugify(orgDetails.name) : "org-slug");
                          const url = orgSlug
                            ? `${window.location.origin}/guest/${orgSlug}/drop/${currentDrop._id}?referCode=${refId}`
                            : `${window.location.origin}/drops/${currentDrop._id}?ref=${refId}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Drop affiliate link copied to clipboard!");
                          api(`/drops/${currentDrop._id}/share`, { method: "POST" }, getToken()!).catch(() => { });
                        }}
                        className="flex flex-col items-center gap-1 group cursor-pointer"
                        title="Share Drop"
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 group-hover:text-white group-hover:bg-white/5 active:scale-90 transition-all">
                          <Send className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-semibold text-[#8888a0] group-hover:text-white transition-colors">
                          {fmtNum(currentDrop.sharesCount || 0)}
                        </span>
                      </button>

                      {/* Like Button */}
                      <button
                        onClick={() => {
                          const isLikedNow = dropsLikedIds.has(currentDrop._id);
                          setDropsLikedIds(prev => {
                            const next = new Set(prev);
                            if (isLikedNow) next.delete(currentDrop._id);
                            else next.add(currentDrop._id);
                            return next;
                          });
                          setDropsFeedData(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              drops: prev.drops.map(d =>
                                d._id === currentDrop._id
                                  ? { ...d, likesCount: d.likesCount + (isLikedNow ? -1 : 1) }
                                  : d
                              )
                            };
                          });
                          // Reconcile with the server's authoritative count —
                          // the bump above is optimistic and the server is
                          // idempotent, so it may not have moved at all.
                          api<{ success: boolean; liked: boolean; likesCount: number }>(
                            `/drops/${currentDrop._id}/like`,
                            { method: "POST", body: JSON.stringify({ liked: !isLikedNow }) },
                            getToken()!
                          )
                            .then(res => {
                              if (!res?.success) return;
                              setDropsLikedIds(prev => {
                                const next = new Set(prev);
                                if (res.liked) next.add(currentDrop._id);
                                else next.delete(currentDrop._id);
                                return next;
                              });
                              setDropsFeedData(prev => prev && ({
                                ...prev,
                                drops: prev.drops.map(d =>
                                  d._id === currentDrop._id
                                    ? { ...d, likesCount: res.likesCount, likedByMe: res.liked }
                                    : d
                                )
                              }));
                            })
                            .catch(() => {
                              // Roll back the optimistic update.
                              setDropsLikedIds(prev => {
                                const next = new Set(prev);
                                if (isLikedNow) next.add(currentDrop._id);
                                else next.delete(currentDrop._id);
                                return next;
                              });
                              setDropsFeedData(prev => prev && ({
                                ...prev,
                                drops: prev.drops.map(d =>
                                  d._id === currentDrop._id
                                    ? { ...d, likesCount: d.likesCount + (isLikedNow ? 1 : -1) }
                                    : d
                                )
                              }));
                            });
                        }}
                        className="flex flex-col items-center gap-1 group cursor-pointer"
                        title={isLiked ? "Unlike" : "Like"}
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all">
                          <Heart className={cn("w-5 h-5 transition-all", isLiked ? "text-[#FE2954] fill-[#FE2954] scale-110" : "text-white/80 group-hover:text-white group-hover:bg-white/5")} />
                        </div>
                        <span className={cn("text-[10px] font-semibold transition-colors", isLiked ? "text-[#FE2954]" : "text-[#8888a0] group-hover:text-white")}>
                          {fmtNum(currentDrop.likesCount || 0)}
                        </span>
                      </button>

                      {/* View Counter */}
                      <div className="flex flex-col items-center gap-1 text-white/40 cursor-default" title="Views">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center">
                          <Eye className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-semibold text-[#8888a0]">
                          {fmtNum(currentDrop.viewsCount || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}
      {/* Mini Chat Windows */}
      {!(activeChatId && activeChatId.id) && (
        <div
          className="fixed bottom-0 z-[9998] flex flex-row-reverse items-end gap-3 pointer-events-none"
          style={{
            right: collapsed ? 16 : (currentWidth !== undefined ? currentWidth + 16 : 376),
          }}
        >
          <AnimatePresence>
            {miniChats.map((chat) => (
              <MiniChatWindow
                key={`${chat.kind}:${chat.id}`}
                kind={chat.kind}
                targetId={chat.id}
                targetName={chat.name}
                targetAvatar={chat.avatar}
                isFavourite={favourites.has(chat.id)}
                onToggleFavourite={() => toggleFavourite(chat.id)}
                minimized={chat.minimized}
                onToggleMinimize={() => toggleMinimize(chat.kind, chat.id)}
                onClose={() => closeMini(chat.kind, chat.id)}
                onExpand={() => {
                  setActiveChatId({ type: chat.kind, id: chat.id });
                  closeMini(chat.kind, chat.id);
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </aside>
  );
}
