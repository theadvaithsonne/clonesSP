"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BoardData, CardType, PositionReservation, SlotData } from "./types";
import { BaseCard } from "./BaseCard";
import { HomePlateCard } from "./HomePlateCard";
import { GameClock } from "./GameClock";
import { MiniCard, StackedCard, CardCase, ppbGreenCards, earnedCards, FlagIcon, GRAY_FREE_IMAGE, GRAY_160_IMAGE } from "./MiniCard";
import { firstName } from "./nameUtils";
import { DollarSign, RefreshCcw, Mail, ListOrdered, Pencil, Rocket, Zap, Gift, GitFork, Link2, Clock, X } from "lucide-react";
import { LayawayModal } from "./modals/LayawayModal";
import { SnapBackModal } from "./modals/SnapBackModal";
import { MessageModal } from "./modals/MessageModal";
import { PrePickModal } from "./modals/PrePickModal";
import { PencilingModal } from "./modals/PencilingModal";
import { WarpModal } from "./modals/WarpModal";
import { SpeedUpModal } from "./modals/SpeedUpModal";
import { GiftCardModal } from "./modals/GiftCardModal";
import { InviteModal } from "./InviteModal";
import { TrophyPill, HOME_PLATE_TROPHY_SCALE } from "./TrophyPill";

export interface PendingPlacement {
  userId: string;
  userName: string;
  userEmail: string;
  position: string;
  purchasedAt: string;
  expiresAt: string;
}


const CARD_BADGE: Record<Exclude<CardType, null>, string> = {
  Gold: "bg-yellow-400 text-black",
  Black: "bg-zinc-500 border border-zinc-300/50 text-white",
  Brown: "bg-amber-700 text-white",
  Gray: "bg-neutral-400 text-black",
  Green: "bg-green-600 text-white",
};

const HOT_BOX_ROW: Record<"Gold" | "Black" | "Brown" | "Gray" | "Green", string> = {
  Gold: "bg-gradient-to-b from-yellow-400 to-yellow-600 border-yellow-200",
  Black: "bg-gradient-to-b from-zinc-500 to-zinc-700 border-zinc-300/60",
  Brown: "bg-gradient-to-b from-amber-600 to-amber-800 border-amber-400/70",
  Gray: "bg-gradient-to-b from-neutral-400 to-neutral-600 border-neutral-200/70",
  Green: "bg-gradient-to-b from-green-500 to-green-700 border-green-300/70",
};

const BC_SQ: Record<string, string> = {
  gold: "bg-yellow-400",
  black: "bg-zinc-500 border border-zinc-300/50",
  brown: "bg-amber-700",
  green: "bg-green-600",
  gray: "bg-neutral-400",
};

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
// DD-MM-YYYY — used for the POD gondola specifically (small ticket-style
// widget; the long "Month Day, Year" form used elsewhere on the board
// doesn't fit its layout).
function fmtDateDMY(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}
export function fmtTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" });
}

export function Slot({
  slot,
  className,
  style,
  isHighlighted,
  mobileCompact,
}: {
  slot: SlotData | null;
  accentBorder?: string;
  showCredits?: boolean;
  totalEarning?: number;
  className?: string;
  style?: React.CSSProperties;
  isHighlighted?: boolean;
  compact?: boolean;
  /** Mobile board only: larger flag/name/ID, no Date/Time lines. Unrelated to `compact`. */
  mobileCompact?: boolean;
}) {
  const greens = ppbGreenCards(slot);
  const earned = earnedCards(slot);
  const goldEarned = earned.filter((c) => c === "gold");
  const grayEarned = earned.filter((c) => c === "gray");
  const otherEarned = earned.filter((c) => c !== "gold" && c !== "gray");
  return (
    <div className={cn(
      "rounded-[7px] p-[2.5px] bg-gradient-to-b from-[#5ea0ec] via-[#2f6fcf] to-[#173f86] shadow-[0_5px_9px_rgba(0,0,0,0.5)]",
      isHighlighted && "ring-4 ring-yellow-400 ring-offset-2 ring-offset-black shadow-[0_0_24px_6px_rgba(250,204,21,0.45)]",
      className,
    )} style={style}>
      <div className="relative rounded-[5px] bg-gradient-to-b from-[#eef4fc] to-[#cfdef2] flex flex-col px-2 pt-3 pb-1.5 min-h-[120px]">
        {/* Gray cards — top-right corner */}
        {slot && (grayEarned.length > 0 || slot.trophies) && (
          <div className="absolute top-[1px] right-[1px] z-10 flex flex-col items-end gap-[3px]" style={{ transform: "translateY(35%)" }}>
            <TrophyPill trophies={slot.trophies} scale={HOME_PLATE_TROPHY_SCALE} className="-translate-y-[15px]" />
            {grayEarned.length > 0 && (
              <div className="flex gap-[2px]">
                {(() => {
                  const freeGray = slot.freeGrayCards ?? 0;
                  const gray160 = slot.grayCard160 ?? 0;
                  const legacyGray = freeGray === 0 && gray160 === 0 ? (slot.grayCards ?? 0) : 0;
                  return (
                    <>
                      {freeGray > 0 && <StackedCard type="gray" count={freeGray} size="sm" playerId={slot.playerId ?? undefined} imageSrc={GRAY_FREE_IMAGE} tooltipLabel="FREE GREY CARD" trigger="click" overlayCount />}
                      {gray160 > 0 && <StackedCard type="gray" count={gray160} size="sm" playerId={slot.playerId ?? undefined} imageSrc={GRAY_160_IMAGE} tooltipLabel="160 GREY CARD" eventIndex={freeGray} trigger="click" overlayCount />}
                      {legacyGray > 0 && <StackedCard type="gray" count={legacyGray} size="sm" playerId={slot.playerId ?? undefined} trigger="click" overlayCount />}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        {!slot ? (
          mobileCompact ? (
            <div className="text-[#7a828f] leading-[1.45] text-[20px]"><div className="font-semibold">ID:</div></div>
          ) : (
          <div className="text-[#7a828f] leading-[1.45] text-[13px]">
            <div className="font-semibold">Id:</div>
            <div className="font-semibold flex gap-1.5"><span>D:</span><span>T:</span></div>
          </div>
          )
        ) : (
          <>
            <div style={{ transform: "translateY(-8px)" }}>
              <div className="flex items-center gap-1.5 min-h-[18px]">
                {slot.countryResidence && (
                  <FlagIcon value={slot.countryResidence} className={mobileCompact ? "w-[32px] h-[23px]" : "w-[21px] h-[15px]"} />
                )}
                {slot.countryOrigin && (
                  <FlagIcon value={slot.countryOrigin} className={mobileCompact ? "w-[32px] h-[23px]" : "w-[21px] h-[15px]"} />
                )}
                <span className={cn("font-extrabold text-[#0e3a86] truncate leading-none", mobileCompact ? "text-[26px]" : "text-[16px]")}>
                  {firstName(slot.playerName) || "—"}
                </span>
              </div>
              <div className="mt-0 text-[#16181d] leading-[1.3]">
                <div className={mobileCompact ? "text-[21px] font-semibold" : "text-[13px]"}><span className="font-semibold text-black">{mobileCompact ? "ID:" : "Id:"}</span> {slot.distributorId ?? ""}{slot.distributorId && slot.entryNo ? " - " : ""}{slot.entryNo ?? ""}</div>
                {!mobileCompact && (
                <div className="text-[13px] flex gap-1.5">
                  <span><span className="font-semibold text-black">D:</span> {fmtDate(slot.enteredAt)}</span>
                  <span><span className="font-semibold text-black">T:</span> {fmtTime(slot.enteredAt)}</span>
                </div>
                )}
              </div>
            </div>
            {(slot.isLayaway || slot.isLayawayPlan || slot.isCPD) && (
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {slot.isLayaway && <span className="text-[9px] font-bold text-red-600">$ LAYAWAY</span>}
                {slot.isLayawayPlan && <span className="text-[9px] font-bold text-green-700">$ PLAN</span>}
                {slot.isCPD && (
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded-sm uppercase tracking-wide bg-orange-600 text-white">CPD</span>
                )}
              </div>
            )}
            {(greens.length > 0 || earned.length > 0) && (
              <div className="mt-auto pt-1.5 flex items-center justify-center gap-[3px] flex-wrap">
                {goldEarned.length > 0 && (
                  <span className="absolute" style={{ left: 4, bottom: "-6.5%", transform: "scale(1.55)", transformOrigin: "bottom left" }}>
                    <CardCase cards={goldEarned} size="md" frame="earned" stack playerId={slot?.playerId} trigger="click" overlayCount className="border-0 p-0 bg-transparent shadow-none scale-y-[1.18] origin-bottom" cardClassName="border !border-black" />
                  </span>
                )}
                {greens.length > 0 && <StackedCard type="green" count={greens.length} size="sm" playerId={slot?.playerId} trigger="click" overlayCount />}
                {(() => {
                  const blackCount = otherEarned.filter(c => c === "black").length;
                  const brownCount = otherEarned.filter(c => c === "brown").length;
                  return (
                    <>
                      {blackCount > 0 && <StackedCard type="black" count={blackCount} size="sm" playerId={slot?.playerId} trigger="click" overlayCount />}
                      {brownCount > 0 && <StackedCard type="brown" count={brownCount} size="sm" playerId={slot?.playerId} trigger="click" overlayCount />}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Badge({ text, color = "bg-blue-700/80" }: { text: string; color?: string }) {
  return (
    <div className={cn(
      "text-[10px] font-bold text-white px-1.5 py-px rounded-sm inline-block leading-tight backdrop-blur-sm tracking-wide",
      color,
    )}>
      {text}
    </div>
  );
}

export function PosLabel({ text }: { text: string }) {
  return (
    <span className="self-start relative z-20 ml-1.5 -mb-[5px] px-2 pt-px pb-[3px] rounded-t-[4px] text-white font-[family-name:var(--font-bat-display)] text-[9px] font-bold uppercase tracking-wide leading-none bg-gradient-to-b from-[#2f6fd6] to-[#0c3a86] border border-b-0 border-sky-200/60 shadow-[0_-1px_2px_rgba(0,0,0,0.35)]">
      {text}
    </span>
  );
}

export type ModalKey = "layaway" | "snapback" | "message" | "prepick" | "penciling" | "warp" | "speedup" | "giftcard" | null;

interface DugoutHover {
  slot: SlotData;
  top: number;
  left: number;
}

interface PodDetail {
  index: number;
  occupant: PodOccupant;
  top: number;
  left: number;
}

export const BUTTONS: { key: ModalKey; icon: React.ElementType; label: string; num: number; imgSrc?: string }[] = [
  { key: "layaway", icon: DollarSign, label: "Layaway", num: 2, imgSrc: "/images/bat246-btn-layaway.svg" },
  { key: "snapback", icon: RefreshCcw, label: "Snap-Back\nLoans", num: 3, imgSrc: "/images/bat246-btn-snapback.svg" },
  { key: "message", icon: Mail, label: "Email", num: 4, imgSrc: "/images/bat246-btn-message.svg" },
  { key: "prepick", icon: ListOrdered, label: "Pre-Pick", num: 5, imgSrc: "/images/bat246-btn-prepick.svg" },
  { key: "penciling", icon: Pencil, label: "Penciling", num: 6, imgSrc: "/images/bat246-btn-penciling.svg" },
  { key: "warp", icon: Rocket, label: "The Warp\nButton", num: 7, imgSrc: "/images/bat246-btn-warp.svg" },
  { key: "speedup", icon: Zap, label: "Speed Up\nYour Board", num: 8, imgSrc: "/images/bat246-btn-speedup.svg" },
  { key: "giftcard", icon: Gift, label: "Gift Card\nShop", num: 9, imgSrc: "/images/bat246-btn-giftcard.svg" },
];

/* Header toolbar geometry — everything left of the 8-button grid is fixed-width, so
   the grid's page position is a constant. Used by the header (left padding) and by the
   body items that must line up under it (Current Board block, child-board nav arrows).
     px-3 (12) + admin block p-1 (4) + gold bars (470) + gap-4 (16) = 502
   Grid is 4×100 + 3×8 gaps = 424, rendered at TOOLBAR_GRID_SCALE from its left edge. */
const TOOLBAR_GRID_SCALE = 1.24;
const TOOLBAR_GRID_PL = 457.79;
const TOOLBAR_GRID_LEFT = 502 + TOOLBAR_GRID_PL;
const TOOLBAR_GRID_W = 424 * TOOLBAR_GRID_SCALE;
/* Responsive fit — the header is a fixed-pixel design: the LB bars end
   visually at ~652px (470px box × 136.39% + offsets), the Board-number +
   8-button-grid unit is anchored at TOOLBAR_ANCHOR and reaches
   TOOLBAR_GRID_LEFT + TOOLBAR_GRID_W ≈ 1,486px, and the right-anchored POD
   artwork needs POD_W_PER_H × header-height more (≈1,900px all-in). On
   narrower windows the WHOLE header content scales down uniformly (see the
   headerFit effect in BoardLayout) — leaderboard, board number, and cards
   shrink together, and the POD, whose size tracks the header's height,
   shrinks with them automatically. */
const TOOLBAR_ANCHOR = 660; // Board-number + grid unit's left edge (px, just past the LB bars' visual overhang)
const HEADER_GAP = 14;      // breathing room between the grid's right edge and the POD

/* Field fit — the diamond cards' boxes are %-width (they shrink with the
   window) but their content is a fixed-pixel design (16px names, 13px
   details, fixed min-heights, mini-card stacks blown up ×1.55) tuned for a
   ~1,550px-wide field / ~1,900px body. On narrower windows the text wrapped
   and the mini-card stacks spilled past the card edges, so each card's
   content scales down uniformly instead (same 100/f%-width + scale(f) trick
   as the header). */
const BODY_DESIGN_W = 1904;                    // AT BAT row spans the full body width
const FIELD_DESIGN_W = BODY_DESIGN_W - 2 * 176; // diamond layer is inset 176px per side
const BODY_DESIGN_H = 820;                     // body height the vertical %-positions were tuned at
const WINDOW_DESIGN_H = 1000;                   // window height the header design assumes
const MAX_UPSCALE = 1.5;                     // sanity cap for growth on very large monitors

/* Up-scaling guard: shrinking is width-driven (vertical overflow just
   scrolls), but GROWING must also respect the available height — on a wide
   but short window, width-only growth would push the diamond rows into the
   AT BAT row. */
const fitRatio = (wRatio: number, hRatio: number) =>
  wRatio <= 1 ? wRatio : Math.min(wRatio, Math.max(1, hRatio), MAX_UPSCALE);

/* Sizes a %-width box's fixed-pixel content uniformly: lay it out at its full
   design width (100/f%) and scale it to the box — visually the same width,
   but nothing wraps or spills when shrinking, and the content grows to fill
   on larger screens. No-op at scale 1. */
const fitStyle = (f: number): React.CSSProperties | undefined =>
  f !== 1 ? { width: `${100 / f}%`, transform: `scale(${f})`, transformOrigin: "top left" } : undefined;

/* POD gondola artwork (public/images/Pod-V7.svg) — the four glass panes, taken straight
   from the <rect> coordinates in the SVG so the overlaid labels sit inside the windows. */
export const POD_ART_W = 1535;
export const POD_ART_H = 1365;
// This artwork shares the old Pod-V7/V8 canvas's exact width (1535) but is
// taller (1362 vs 1024), so re-using the original x/w window coordinates
// as-is — only the y offsets may need adjusting if the gondola itself sits
// at a different vertical position within the taller canvas.
export const POD_WINDOWS = [
  { x: 355, y: 450, w: 377, h: 202 },
  { x: 836, y: 450, w: 377, h: 202 },
  { x: 355, y: 710, w: 377, h: 202 },
  { x: 841, y: 797, w: 377, h: 202 },
];
/* POD visual width per px of header height: the artwork's height is 141.28% of
   the header's, its canvas aspect is POD_ART_W/POD_ART_H, and it renders
   through scaleX(1.388) — used by the headerFit effect to derive the header's
   full design width. */
const POD_W_PER_H = 1.4128 * (POD_ART_W / POD_ART_H) * 1.388;

export type PodOccupant = { name: string; id: string; entry: string; date: string; time: string };

// A dugout/atBat slot tagged with a shared team ID (all 4 members of a POD
// cycle) — clicking it fetches the other members via GET /bat246/pod-team/:teamId.
export type PodTeamMember = { playerId: string; playerName: string; entryNo: string | null; position: string; boardTrackingNumber: string; enteredAt: string | null; referredByName?: string | null };

/* Real POD gondola data — board.pod (3 visual seats; the 4th POD-cycle
   placement is redirected into the tree/dugout instead of a seat, see
   bat246_pod_invite.md) mapped to the window-label shape the render below
   expects. Missing/empty seats render nothing, same as the old placeholder's
   `null` entries. */
export function slotToPodOccupant(slot: SlotData | null | undefined): PodOccupant | null {
  if (!slot?.playerId) return null;
  return {
    name: slot.playerName ?? "—",
    id: slot.distributorId ?? "",
    entry: slot.entryNo ?? "",
    date: fmtDateDMY(slot.enteredAt),
    time: fmtTime(slot.enteredAt),
  };
}

const LB_MAX: Record<"G" | "H" | "T", number> = { G: 300000, H: 100000, T: 50000 };
export const LB_CARD_MAX: Record<"G" | "H" | "T", number> = { G: 7, H: 5, T: 3 };
export const LB_COLOR: Record<"G" | "H" | "T", string> = { G: "#ef4444", H: "#f59e0b", T: "#6366f1" };

export const LB_ICON: Record<"G" | "H" | "T", React.ReactNode> = {
  // Grand Slam — trophy artwork
  // eslint-disable-next-line @next/next/no-img-element
  G: <img src="/images/bat246-lb-grandslam.svg" alt="Grand Slam" className="w-full h-full object-fill" draggable={false} />,
  // Home Run — cap artwork (SVG canvas has internal whitespace — scale to fill)
  // eslint-disable-next-line @next/next/no-img-element
  H: <img src="/images/bat246-lb-cap.svg" alt="Home Run" className="w-full h-full object-fill scale-[1.15]" draggable={false} />,
  // Triple — trophy artwork (SVG canvas has internal whitespace — scale to fill). Height
  // scaled down separately from width since it's the vertical overflow that clips it.
  // eslint-disable-next-line @next/next/no-img-element
  T: <img src="/images/bat246-lb-trophy.svg" alt="Triple" className="w-full h-full object-fill" style={{ transform: "scale(1.2251, 1)" }} draggable={false} />,
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Tracking numbers never change once a board is created — cache them for the
// session so prev/next header buttons render instantly when navigating boards.
const boardSummaryCache: Record<string, { boardNumber: number; trackingNumber: string }> = {};

export function BoardLayout({ board, highlightPosition, readOnly, isAdmin, canInvite, myPosition, myUserId, mySalesCredits, pendingPlacements }: {
  board: BoardData;
  highlightPosition?: string;
  readOnly?: boolean;
  isAdmin?: boolean;
  canInvite?: boolean;
  myPosition?: string | null;
  myUserId?: string;
  mySalesCredits?: number | null;
  pendingPlacements?: PendingPlacement[];
}) {
  const [openModal, setOpenModal] = useState<ModalKey>(null);
  const [dugoutHover, setDugoutHover] = useState<DugoutHover | null>(null);
  const [podDetail, setPodDetail] = useState<PodDetail | null>(null);
  const [showAllDugout, setShowAllDugout] = useState(false);
  const [dugoutSearch, setDugoutSearch] = useState("");
  const [podTeamPopup, setPodTeamPopup] = useState<{ teamId: string; loading: boolean; members: PodTeamMember[] } | null>(null);
  const [invitePos, setInvitePos] = useState<{ position: string; posLabel: string } | null>(null);
  const [sirenActive, setSirenActive] = useState(false);
  const [hotBoxExpanded, setHotBoxExpanded] = useState(false);
  const [relatedBoards, setRelatedBoards] = useState<Record<string, { boardNumber: number; trackingNumber: string }>>({});
  const close = () => setOpenModal(null);

  // Opens the "who's on this POD team" popup for a dugout/atBat slot shown
  // as "P-Team Id: X" instead of a name.
  const openPodTeamPopup = (teamId: string) => {
    setPodTeamPopup({ teamId, loading: true, members: [] });
    const tok = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/pod-team/${teamId}`, { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => r.json())
      .then((d) => setPodTeamPopup({ teamId, loading: false, members: d.members ?? [] }))
      .catch(() => setPodTeamPopup({ teamId, loading: false, members: [] }));
  };

  // Header fit — the header is a fixed ~1,900px-wide pixel design (LB bars +
  // Board number + button grid + right-anchored POD). Rather than shrinking
  // any single piece (cards alone looked odd next to a full-size leaderboard
  // and pod), the WHOLE content scales down uniformly when the viewport is
  // narrower than the design: the inner wrapper gets scale(f) with width
  // 100/f% (so it still spans the full width), the header's own height is set
  // to the scaled content height, and the POD — sized off the header's
  // height — shrinks with it automatically.
  const headerElRef = useRef<HTMLDivElement | null>(null);
  const headerInnerRef = useRef<HTMLDivElement | null>(null);
  const [headerFit, setHeaderFit] = useState<{ scale: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const outer = headerElRef.current;
    const inner = headerInnerRef.current;
    if (!outer || !inner || readOnly) return;
    const measure = () => {
      const W = outer.getBoundingClientRect().width;
      const H0 = inner.offsetHeight; // unscaled content height (transforms don't affect layout)
      if (!W || !H0) return;
      const designW = TOOLBAR_GRID_LEFT + TOOLBAR_GRID_W + HEADER_GAP + POD_W_PER_H * H0;
      const scale = fitRatio(W / designW, window.innerHeight / WINDOW_DESIGN_H);
      setHeaderFit((prev) =>
        prev && Math.abs(prev.scale - scale) < 0.005 && Math.abs(prev.height - H0 * scale) < 0.5
          ? prev
          : { scale, height: H0 * scale }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [readOnly]);
  // POD text sizing — the window labels use container-query (cqh) fonts whose
  // px floors/caps were tuned for the full-size pod. Now that the pod shrinks
  // with the header, a fixed 8px floor is too big for the shrunken windows and
  // the text gets clipped by their overflow-hidden boxes — so the px bounds
  // scale with the header too, keeping the text proportional at every size.
  const podS = headerFit?.scale ?? 1;

  // Field fit — one scale for the diamond cards (vs the field layer's width)
  // and one for the AT BAT row + right-column widgets (Game Clock, Hot Box,
  // PLAYING FIELD label — vs the full body width); see *_DESIGN_W above.
  // Both shrink on smaller screens AND grow on larger ones (bounded by the
  // body's height and MAX_UPSCALE via fitRatio, so growth never pushes the
  // diamond rows into each other on wide-but-short windows).
  const bodyElRef = useRef<HTMLDivElement | null>(null);
  const fieldElRef = useRef<HTMLDivElement | null>(null);
  const [fieldScale, setFieldScale] = useState(1);
  const [bodyScale, setBodyScale] = useState(1);
  useLayoutEffect(() => {
    const body = bodyElRef.current;
    const field = fieldElRef.current;
    if (!body || !field) return;
    const measure = () => {
      const b = body.getBoundingClientRect();
      const hRatio = b.height / BODY_DESIGN_H;
      const fs = fitRatio(field.getBoundingClientRect().width / FIELD_DESIGN_W, hRatio);
      const bs = fitRatio(b.width / BODY_DESIGN_W, hRatio);
      setFieldScale((prev) => (Math.abs(prev - fs) < 0.005 ? prev : fs));
      setBodyScale((prev) => (Math.abs(prev - bs) < 0.005 ? prev : bs));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    ro.observe(field);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  // Child-board nav arrows portal into the page's top "All Boards" bar
  // (left arrow right after "All Boards", right arrow pinned to the far right).
  const [navLeftEl, setNavLeftEl] = useState<HTMLElement | null>(null);
  const [navRightEl, setNavRightEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavLeftEl(document.getElementById("bat246-nav-left"));
    setNavRightEl(document.getElementById("bat246-nav-right"));
  }, []);

  // Close the POD detail popover on any click outside it.
  useEffect(() => {
    if (!podDetail) return;
    const onDocClick = () => setPodDetail(null);
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [podDetail]);

  // Fetch board numbers for parent / child boards (lightweight summary endpoint
  // + session cache — the old full-board fetch made the prev/next buttons slow)
  useEffect(() => {
    // Seed the cache with the board we're looking at, so navigating to a
    // parent/child shows this board's number instantly on arrival.
    if (board._id && board.trackingNumber) {
      boardSummaryCache[board._id] = { boardNumber: board.boardNumber, trackingNumber: board.trackingNumber };
    }

    const ids = [board.parentBoardId, board.leftChildBoardId, board.rightChildBoardId].filter(Boolean) as string[];
    if (ids.length === 0) return;

    const cached: Record<string, { boardNumber: number; trackingNumber: string }> = {};
    const missing: string[] = [];
    for (const id of ids) {
      if (boardSummaryCache[id]) cached[id] = boardSummaryCache[id];
      else missing.push(id);
    }
    if (Object.keys(cached).length > 0) setRelatedBoards((prev) => ({ ...prev, ...cached }));
    if (missing.length === 0) return;

    const tok = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    Promise.all(
      missing.map((id) =>
        fetch(`${API}/bat246/boards/${id}/summary`, { headers: { Authorization: `Bearer ${tok}` } })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => d?.trackingNumber ? { id, boardNumber: d.boardNumber, trackingNumber: d.trackingNumber } : null)
          .catch(() => null)
      )
    ).then((results) => {
      const map: Record<string, { boardNumber: number; trackingNumber: string }> = {};
      for (const r of results) if (r) { map[r.id] = { boardNumber: r.boardNumber, trackingNumber: r.trackingNumber }; boardSummaryCache[r.id] = map[r.id]; }
      if (Object.keys(map).length > 0) setRelatedBoards((prev) => ({ ...prev, ...map }));
    });
  }, [board.parentBoardId, board.leftChildBoardId, board.rightChildBoardId]);

  // Siren: buzzes for 10s on visit unless dugout + at-bat slots are exactly full (8)
  useEffect(() => {
    if (!isAdmin) return;
    // Never buzz (or even show as active) on a local dev machine — this
    // used to be gated here and the guard went missing at some point.
    if (process.env.NODE_ENV === "development") return;
    const totalFilled = (board.dugout?.filter(Boolean).length ?? 0) + (board.atBat?.filter(Boolean).length ?? 0);
    if (totalFilled >= 8) return;

    setSirenActive(true);

    let audioCtx: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let sweepInterval: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const resumeAudio = () => { audioCtx?.resume().catch(() => { }); };
    const closeAudio = () => {
      if (closed || !audioCtx) return;
      closed = true;
      audioCtx.close().catch(() => { });
    };

    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AC();
      oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = "sine";
      gain.gain.value = 0.12;
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      resumeAudio();
      let high = true;
      sweepInterval = setInterval(() => {
        if (!oscillator || !audioCtx) return;
        oscillator.frequency.setValueAtTime(high ? 950 : 600, audioCtx.currentTime);
        high = !high;
      }, 450);
    } catch {
      // audio blocked/unavailable — visual siren still runs
    }

    // Browsers suspend AudioContext until a user gesture — resume on first interaction
    window.addEventListener("pointerdown", resumeAudio, { once: true });
    window.addEventListener("keydown", resumeAudio, { once: true });

    const stopTimer = setTimeout(() => {
      if (sweepInterval) clearInterval(sweepInterval);
      if (oscillator) { try { oscillator.stop(); } catch { } }
      closeAudio();
    }, 10000);

    return () => {
      clearTimeout(stopTimer);
      window.removeEventListener("pointerdown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
      if (sweepInterval) clearInterval(sweepInterval);
      if (oscillator) { try { oscillator.stop(); } catch { } }
      closeAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const podOccupants = (board.pod ?? []).map(slotToPodOccupant);
  const isPostPP = Date.now() > new Date(board.protectionPeriodEnd).getTime();
  const canShowInvite = !readOnly && canInvite;
  const hasPrevBtn = !readOnly && !!board.parentBoardId;
  // Family number for the not-yet-split L/R placeholders ("6-1002 L" → "6").
  const familyPrefix = board.trackingNumber.split("-")[0].trim();
  // True when at least one AT BAT slot is actually showing the "Invite" button
  // (empty, no pending placement) — used to nudge the dugout border down so it
  // doesn't sit too close to the AT BAT row when that button appears.
  const hasAnyAtBatInvite = canShowInvite && board.atBat.some(
    (slot, i) => !slot?.playerId && !pendingPlacements?.find(p => p.position === `atBat-${i}`)
  );
  // Home Plate, 3rd Base, 2nd Base A/B, and AT BAT players can only generate "Without Position" links.
  // AT BAT players already occupy a slot — "Preserve Position" is meaningless for them.
  const hidePreservePosition = !!myPosition && (
    ["homePlate", "thirdBase", "secondBaseA", "secondBaseB"].includes(myPosition) ||
    myPosition.startsWith("atBat-")
  );
  // 1st Base players must earn their first Green Card (via a "Without Position" sale)
  // before they can generate a "Preserve Position" link.
  const disablePreservePosition = mySalesCredits === 0;

  const AT_BAT_LABELS: Record<string, string> = {
    "atBat-0": "AT BAT 1", "atBat-1": "AT BAT 2", "atBat-2": "AT BAT 3", "atBat-3": "AT BAT 4",
    "atBat-4": "AT BAT 5", "atBat-5": "AT BAT 6", "atBat-6": "AT BAT 7", "atBat-7": "AT BAT 8",
  };

  function AtBatInviteBtn({ position, slot }: { position: string; slot?: SlotData | null }) {
    if (!canShowInvite) return null;
    // Keeps AB4/AB5's button clear of the "Previous" button centered between them on child boards.
    const nudge: React.CSSProperties | undefined =
      hasPrevBtn && position === "atBat-3" ? { position: "relative", left: "-22%" }
      : hasPrevBtn && position === "atBat-4" ? { position: "relative", left: "22%" }
      : undefined;
    // Show pending placement tooltip if someone has already purchased via invite link
    const pending = pendingPlacements?.find(p => p.position === position);
    if (pending) {
      const remaining = Math.max(0, new Date(pending.expiresAt).getTime() - Date.now());
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const timeStr = remaining <= 0 ? "Expired" : h > 0 ? `${h}h ${m}m` : `${m}m`;
      return (
        <div className="mt-0 mx-auto relative group w-full flex justify-center">
          <div className="flex items-center gap-1 text-[9px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/40 rounded py-0 px-1.5 cursor-default leading-tight" style={nudge}>
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            Pending · {timeStr}
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block w-52 bg-[#13131f] border border-white/20 rounded-lg px-3 py-2.5 shadow-2xl pointer-events-none">
            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1.5">Pending Placement</div>
            <div className="text-[12px] text-white font-semibold truncate">{pending.userName || pending.userEmail}</div>
            <div className="text-[10px] text-white/50 mt-0.5 truncate">{pending.userEmail}</div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-white/50">
              <Clock className="w-3 h-3 text-amber-400/70 flex-shrink-0" />
              Expires in <span className="text-amber-300 font-semibold">{timeStr}</span>
            </div>
          </div>
        </div>
      );
    }
    // Don't show invite button if slot is already filled
    if (slot?.playerId) return null;
    return (
      <button
        onClick={() => setInvitePos({ position, posLabel: AT_BAT_LABELS[position] ?? position })}
        className="mt-0 mb-0.5 mx-auto flex items-center gap-1 text-[11px] font-semibold text-white bg-blue-600/70 hover:bg-blue-500 border border-blue-400/50 rounded py-[2px] px-[8px] leading-tight transition-colors"
        style={nudge}
      >
        <Link2 className="w-[12px] h-[12px]" /> Invite
      </button>
    );
  }

  return (
    <>
      {/* ── Invite modal ─────────────────────────────────────────────────── */}
      {invitePos && myUserId && (
        <InviteModal boardId={board._id} position={invitePos.position} posLabel={invitePos.posLabel} myUserId={myUserId} hidePreservePosition={hidePreservePosition} disablePreservePosition={disablePreservePosition} onClose={() => setInvitePos(null)} />
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {!readOnly && openModal === "layaway" && <LayawayModal board={board} onClose={close} />}
      {!readOnly && openModal === "snapback" && <SnapBackModal board={board} onClose={close} />}
      {!readOnly && openModal === "message" && <MessageModal board={board} onClose={close} />}
      {!readOnly && openModal === "prepick" && <PrePickModal board={board} onClose={close} />}
      {!readOnly && openModal === "penciling" && <PencilingModal board={board} onClose={close} isPostPP={isPostPP} />}
      {!readOnly && openModal === "warp" && <WarpModal board={board} onClose={close} />}
      {!readOnly && openModal === "speedup" && <SpeedUpModal board={board} onClose={close} />}
      {!readOnly && openModal === "giftcard" && <GiftCardModal board={board} onClose={close} />}

      {showAllDugout && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setShowAllDugout(false); setDugoutSearch(""); }}>
          <div className="w-[320px] max-h-[80vh] bg-[#13131f] border border-white/15 rounded-xl p-4 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="text-white font-bold text-sm">Dugout ({board.dugout.length})</div>
              <button onClick={() => { setShowAllDugout(false); setDugoutSearch(""); }} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-2 flex-shrink-0">
              <input
                type="text"
                placeholder="Search by name..."
                value={dugoutSearch}
                onChange={e => setDugoutSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder-white/30 outline-none focus:border-amber-400/50 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              {board.dugout
                .filter(slot => slot?.playerName?.toLowerCase().includes(dugoutSearch.toLowerCase()))
                .map((slot, i) => (
                  <div key={i} className="bg-black/40 border border-white/10 rounded p-2">
                    {slot?.podTeamId ? (
                      <div
                        onClick={() => openPodTeamPopup(slot.podTeamId!)}
                        className="text-[12px] text-blue-300 font-bold truncate leading-tight underline decoration-dotted cursor-pointer"
                        title="Click to see all 4 POD team members"
                      >
                        {slot.podTeamId}
                      </div>
                    ) : (
                      <div className="text-[12px] text-white font-bold truncate leading-tight">{slot?.playerName ?? "—"}</div>
                    )}
                    {slot?.entryNo && (
                      <div className="text-[10px] text-amber-300/80 mt-0.5 font-medium">Entry: {slot.entryNo}</div>
                    )}
                    {slot && (
                      <div className="text-[10px] text-white/50 mt-0.5">
                        Joined: {fmtDate(slot.enteredAt)} · {fmtTime(slot.enteredAt)}
                      </div>
                    )}
                  </div>
                ))}
              {board.dugout.filter(slot => slot?.playerName?.toLowerCase().includes(dugoutSearch.toLowerCase())).length === 0 && (
                <div className="text-center text-[11px] text-white/30 py-4">No results</div>
              )}
            </div>
          </div>
        </div>
      )}

      {dugoutHover && (
        <div
          className="pointer-events-none fixed z-[9999] w-52 bg-[#13131f] border border-white/20 rounded-lg px-3 py-2 shadow-2xl"
          style={{ top: dugoutHover.top, left: dugoutHover.left, transform: "scale(1.1)", transformOrigin: "top left" }}
        >
          <div className="text-[12px] text-white font-bold leading-snug">{dugoutHover.slot.podTeamId ?? dugoutHover.slot.playerName ?? "—"}</div>
          {dugoutHover.slot.entryNo && (
            <div className="text-[9px] text-amber-300/80 mt-0.5 font-medium">Entry: {dugoutHover.slot.entryNo}</div>
          )}
          <div className="text-[9px] text-white/50 mt-0.5">
            Joined: {fmtDate(dugoutHover.slot.enteredAt)} · {fmtTime(dugoutHover.slot.enteredAt)}
          </div>
          {dugoutHover.slot.referredByName ? (
            <div className="text-[9px] text-blue-300/80 mt-1 font-medium">
              Referred by: {dugoutHover.slot.referredByName}
            </div>
          ) : (
            <div className="text-[9px] text-white/30 mt-1">No referrer</div>
          )}
          {(dugoutHover.slot.countryResidence || dugoutHover.slot.countryOrigin) && (
            <div className="flex gap-1 mt-1.5">
              {dugoutHover.slot.countryResidence && (
                <FlagIcon value={dugoutHover.slot.countryResidence} className="w-[13px] h-[9px]" />
              )}
              {dugoutHover.slot.countryOrigin && (
                <FlagIcon value={dugoutHover.slot.countryOrigin} className="w-[13px] h-[9px]" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── POD team popup — click a "P-100X" dugout/atBat slot to see all 4
             members of that POD cycle (they can span 2 boards after a split
             carries the 4th entrant's slot forward — see getPodTeamDetails). ── */}
      {podTeamPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
          onClick={() => setPodTeamPopup(null)}
        >
          <div className="w-[600px] max-h-[80vh] bg-[#13131f] border border-white/15 rounded-xl p-8 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div className="text-white font-bold text-2xl">POD Team {podTeamPopup.teamId}</div>
              <button onClick={() => setPodTeamPopup(null)} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-8 h-8" />
              </button>
            </div>
            {podTeamPopup.loading ? (
              <div className="text-center text-[20px] text-white/40 py-6">Loading…</div>
            ) : podTeamPopup.members.length === 0 ? (
              <div className="text-center text-[20px] text-white/30 py-6">No members found</div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto">
                {podTeamPopup.members.map((m, i) => (
                  <div key={i} className="bg-black/40 border border-white/10 rounded-lg p-4">
                    <div className="text-[24px] text-white font-bold truncate leading-tight">{m.playerName || "—"}</div>
                    <div className="text-[20px] text-amber-300/80 mt-1 font-medium">
                      {m.position.startsWith("pod-") ? `POD seat ${Number(m.position.split("-")[1]) + 1}` : m.position === "dugout" ? "Dugout (waiting for PP)" : m.position}
                      {m.entryNo ? ` · Entry: ${m.entryNo}` : ""}
                    </div>
                    <div className="text-[20px] text-white/50 mt-1">Board {m.boardTrackingNumber}{m.enteredAt ? ` · ${fmtDate(m.enteredAt)}` : ""}</div>
                    {m.referredByName && (
                      <div className="text-[20px] text-white/50 mt-1">Referred by: {m.referredByName}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {podDetail && (
        <div
          className="fixed z-[9999] w-44 bg-white border border-black/15 rounded-lg px-3 py-2 shadow-2xl"
          style={{ top: podDetail.top, left: podDetail.left, transform: "scale(2.288)", transformOrigin: "top left" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[12px] text-black font-bold leading-snug">{podDetail.occupant.name}</div>
          <div className="text-[10px] text-black font-bold mt-0.5">Id: {podDetail.occupant.id}{podDetail.occupant.entry ? ` - ${podDetail.occupant.entry}` : ""}</div>
          <div className="text-[9px] text-black font-bold mt-0.5">D: {podDetail.occupant.date} · T: {podDetail.occupant.time}</div>
          <div className="text-[9px] text-black font-bold mt-0.5">P-Team No: {board.podTeamId}</div>
        </div>
      )}

      <div
        className="flex flex-col text-white relative h-full"
        style={{
          backgroundImage: "url('/images/stadium-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Layered atmosphere — keeps the field vivid while grounding the header + edges */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/55 via-black/10 to-black/40" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(120% 80% at 50% 38%, transparent 45%, rgba(0,0,0,0.45) 100%)" }} />

        <div className="relative z-10 has-[.bat246-toolbar-btn:hover]:z-[10000] has-[.lb-trophy-hover-trigger:hover]:z-[10000] flex flex-col h-full">

          {/* ════ HEADER ══════════════════════════════════════════════════ */}
          <div
            ref={headerElRef}
            className="relative z-40 backdrop-blur-md flex-shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            style={{
              background: "linear-gradient(100deg, #0a2c6b 0%, #0d3f86 38%, #0f5a6e 70%, #11744a 100%)",
              // When the content is scaled, set the header's own box to the
              // scaled height too (transforms don't affect layout) — the POD,
              // sized as a % of this height, shrinks/grows along with it.
              height: headerFit && headerFit.scale !== 1 ? headerFit.height : undefined,
            }}
          >
            {/* ── POD gondola — replaces the old sky photo + POD boxes. The four window
                   panes are positioned as a % of the artwork so the labels track the
                   image at any size (see POD_WINDOWS for the source coordinates).
                   Shown to logged-in users (admin + regular board view), but not on the
                   public read-only invite/preview boards. ── */}
            {!readOnly && (
              <div id="bat246-pod-art" className="absolute right-0 z-10 pointer-events-none select-none" style={{ top: "-41.28%", height: "141.28%", aspectRatio: `${POD_ART_W} / ${POD_ART_H}`, containerType: "size", transform: "scaleX(1.388)", transformOrigin: "right center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/Pod-New.svg" alt="POD" className="block w-full h-full" draggable={false} />
                {POD_WINDOWS.map((w, i) => {
                  // Numbered badge always shows for every window. The white
                  // occupant box only renders once that window actually has
                  // an occupant — no box at all for an empty seat.
                  const occupant = podOccupants[i];
                  const showBox = !!occupant;
                  return (
                    <div
                      key={i}
                      className="absolute"
                      style={{
                        left: `${(w.x / POD_ART_W) * 100}%`,
                        top: `calc(${(w.y / POD_ART_H) * 100}% + ${i === 0 ? "2.5%" : i === 1 ? "2.5%" : "1%"})`,
                        width: `${(w.w / POD_ART_W) * 100}%`,
                        height: `${(w.h / POD_ART_H) * 100}%`,
                      }}
                    >
                      {showBox && (
                        <div
                          className="peer absolute flex flex-col justify-end overflow-hidden pl-2 pr-6 rounded-md text-[#12203a] bg-white/80 origin-center transition-transform duration-150 ease-out has-[.pod-occupant-text:hover]:scale-[1.7745] has-[.pod-occupant-text:hover]:z-[70] has-[.pod-occupant-text:hover]:bg-white pointer-events-auto"
                          style={{
                            top: i === 3 ? "-20.68%" : i === 2 ? "-1.68%" : "-22.54%",
                            bottom: i === 3 ? "7.32%" : i === 2 ? "-11.68%" : "7.46%",
                            left: i === 1 || i === 3 ? "0.13%" : "6.13%",
                            right: i === 1 || i === 3 ? "-2.87%" : "-8.87%",
                          }}
                        >
                          <div style={{ transform: "translate(-5%, -8%)" }}>
                            <div className="pod-occupant-text cursor-pointer" style={{ transform: "translateX(-9%)" }}>
                              {occupant && (
                                <>
                                  <span className="font-extrabold leading-[1.1] whitespace-nowrap text-left block" style={{ fontSize: `clamp(${8 * podS}px, 3cqh, ${14.5 * podS}px)` }}>{occupant.name}</span>
                                  <span className="font-extrabold leading-[1.1] whitespace-nowrap text-left block" style={{ fontSize: `clamp(${8 * podS}px, 3cqh, ${14.5 * podS}px)` }}>{occupant.id} - {occupant.entry}</span>
                                  <span className="font-extrabold leading-[1.1] whitespace-nowrap text-left block" style={{ fontSize: `clamp(${8 * podS}px, 3cqh, ${14.5 * podS}px)` }}>D: {occupant.date}</span>
                                  <span className="font-extrabold leading-[1.1] whitespace-nowrap text-left block" style={{ fontSize: `clamp(${8 * podS}px, 3cqh, ${14.5 * podS}px)` }}>T: {occupant.time}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        className="absolute z-[60] flex-shrink-0 border border-black bg-[#9ca3af] text-black font-extrabold flex items-center justify-center leading-none shadow-[0_1px_3px_rgba(0,0,0,0.5)] pointer-events-auto transition-opacity duration-150 ease-out peer-has-[.pod-occupant-text:hover]:opacity-0 peer-has-[.pod-occupant-text:hover]:pointer-events-none"
                        style={{
                          width: `clamp(${14 * podS}px, 4.5cqh, ${20 * podS}px)`,
                          height: `clamp(${14 * podS}px, 4.5cqh, ${20 * podS}px)`,
                          fontSize: `clamp(${8 * podS}px, 2.3cqh, ${11 * podS}px)`,
                          borderRadius: "3px",
                          transform: "translateY(-50%)",
                          top: i === 3 ? "-21%" : i === 2 ? "18%" : "-2%",
                          right: i === 3 ? "-4.37%" : i === 1 ? "-2.87%" : "-8.87%",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!occupant) return; // nothing to show yet for an empty seat
                          const r = e.currentTarget.getBoundingClientRect();
                          const popupW = 176 * 2.288; // w-44 scaled by the popup's scale(2.288)
                          const popupH = 130 * 2.288;
                          const margin = 8;
                          const left = Math.min(r.left, window.innerWidth - popupW - margin);
                          const top = Math.min(r.bottom + 6, window.innerHeight - popupH - margin);
                          setPodDetail((prev) =>
                            prev?.index === i ? null : { index: i, occupant, top: Math.max(margin, top), left: Math.max(margin, left) }
                          );
                        }}
                      >
                        {i + 1}
                      </button>
                    </div>
                  );
                })}
                {/* Team number — white box, black text, in the open space below
                    the windows/"POD SYSTEM" banner on the artwork. Only shown
                    once a cycle has actually started (podTeamId assigned on
                    the first placement — see assignPodTeamId). */}
                {board.podTeamId && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bg-white/70 rounded px-2 py-0.5"
                    style={{ top: "88%" }}
                  >
                    <span className="font-extrabold text-[#12203a] whitespace-nowrap" style={{ fontSize: `clamp(18px, 6cqh, 30px)` }}>
                      {/* Board 6-1002 only — display-only masking, board.podTeamId itself is untouched */}
                      {board.podTeamId}
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* Scaled content wrapper — everything except the POD (which sizes
                itself off the header's height and must stay right-anchored to
                the real viewport edge). At scale 1 this renders untransformed
                and is layout-identical to the old markup; below 1 it scales
                about the top-left with width 100/f%, so the scaled result
                still spans the full header width. */}
            <div
              ref={headerInnerRef}
              style={
                headerFit && headerFit.scale !== 1
                  ? { width: `${100 / headerFit.scale}%`, transform: `scale(${headerFit.scale})`, transformOrigin: "top left" }
                  : undefined
              }
            >
              {/* glossy top highlight */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="flex items-center gap-4 px-3 pt-0.5 pb-0">

                {/* Leaderboard + toolbar wrapper — shown to all logged-in users (admin
                  and regular board view alike, per-user view parity), but hidden
                  on the public read-only invite/preview boards. */}
                {!readOnly && (
                  <div className="flex flex-1 items-center gap-4 rounded-lg px-1 py-0">
                    {/* LB bars — nudged to touch the header's top/left border.
                      Boards without child-nav buttons sit slightly lower. */}
                    <div className="relative flex flex-col w-[470px] flex-shrink-0 has-[.lb-trophy-hover-trigger:hover]:z-[10000]" style={{ transform: `translate(calc(-12px + 1.5%), ${(board.leftChildBoardId || board.rightChildBoardId) ? -4 : -3}px)` }}>
                      {/* Title centered over the tier bars — bars are 143.57% wide (see
                        below), so this must match to stay centered over their real width */}
                      <div className="text-center font-[family-name:var(--font-bat-display)] text-[22px] text-white tracking-[0.18em] uppercase font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)] whitespace-nowrap leading-none mb-1" style={{ width: "136.39%" }}>
                        Leaderboard
                      </div>
                      <div className="flex flex-col gap-2">
                        {(["G", "H", "T"] as const).map((tier) => {
                          const row = board.leaderBoard.find(r => r.tier === tier);
                          const earnings = row?.earnings ?? 0;
                          const max = LB_MAX[tier];
                          const pct = Math.min(100, (earnings / max) * 100);
                          const hasPlayer = !!row?.playerName;
                          const ce = row?.cardsEarned;
                          return (
                            <div
                              key={tier}
                              className={cn(
                                "relative flex items-center gap-1.5 rounded-md pl-[1px] pr-1.5 py-0.5 transition-transform duration-300 ease-in-out has-[.lb-trophy-hover-trigger:hover]:scale-[2] has-[.lb-trophy-hover-trigger:hover]:z-[10000]",
                                !hasPlayer && "opacity-90",
                              )}
                              style={{ width: "136.39%", transformOrigin: "left center" }}
                            >
                              {/* Background — real-width now (not a scaleX trick), so it matches
                              the row's actual box and the content (cards/count) can spread
                              all the way to the real right edge instead of being cramped
                              inside the old, narrower box while only the paint stretched. */}
                              <div
                                className="absolute inset-0 rounded-md border border-amber-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_3px_rgba(0,0,0,0.45)] -z-10"
                                style={{ background: "linear-gradient(to bottom, #ffe98a 0%, #f1c84e 48%, #cca023 100%)" }}
                              />
                              {/* Tier badge — stretches to fill the bar's height. Whitish-grey
                              plate, with the tier's own colour carried by the letter. */}
                              <div
                                className="h-[46px] w-[82px] rounded flex-shrink-0 flex items-center justify-center gap-[5px] pl-0.5 pr-1.5 border border-black/20 shadow-[0_1px_2px_rgba(0,0,0,0.35)] overflow-hidden"
                                style={{ backgroundColor: "#FFD3AC", transform: "translateX(1%)" }}
                              >
                                <span className="lb-trophy-hover-trigger w-[32px] h-[44px] flex-shrink-0 cursor-pointer" style={{ transform: "scale(1.02) scaleY(1.4)" }}>{LB_ICON[tier]}</span>
                                <span className="text-[27px] font-extrabold leading-none" style={{ color: LB_COLOR[tier], WebkitTextStroke: "1px #000" }}>{tier}</span>
                              </div>

                              {/* Flags — only when the tier is occupied */}
                              {hasPlayer && (row?.countryResidence || row?.countryOrigin) && (
                                <div className="flex items-center gap-0.5 flex-shrink-0" style={{ marginLeft: "0.4%" }}>
                                  {row?.countryResidence && (
                                    <FlagIcon value={row.countryResidence} className="w-[34px] h-[26px]" />
                                  )}
                                  {row?.countryOrigin && (
                                    <FlagIcon value={row.countryOrigin} className="w-[34px] h-[26px]" />
                                  )}
                                </div>
                              )}

                              {/* Player name-ID-Entry, e.g. "Bat246-2-1002B2-2".
                              Display rules: name = first name only, max 10 chars;
                              ID = max 6 digits + 2 letters (8 chars); Entry = max 2 digits. */}
                              <div className="flex-1 flex items-center min-w-0">
                                {hasPlayer && (
                                  <span className="text-[16.48px] text-black/80 font-bold truncate" style={{ transform: "translateX(27%)" }}>
                                    {row!.playerName?.trim().split(/\s+/)[0]?.slice(0, 10)}
                                    {row!.distributorId && <>-{row!.distributorId.slice(0, 8)}</>}
                                    {row!.entryNo && <>-{String(row!.entryNo).slice(0, 2)}</>}
                                  </span>
                                )}
                              </div>

                              {/* Earned cards — one per type with ×N badge; hover shows history.
                              Scaled up to fill the bar's leftover vertical space: a transform
                              doesn't affect layout, so the bar keeps its height. Anchored right
                              so the growth eats into the empty name area, not the (N) count. */}
                              {hasPlayer && ce && (
                                <div className="flex items-center gap-[0.5%] flex-shrink-0" style={{ transform: "translateX(10%) scale(1.22)", transformOrigin: "right center", marginRight: "0.2%" }}>
                                  {(() => {
                                    const goldCnt = (ce as any).gold ?? 0;
                                    const greenCnt = (ce as any).green ?? 0;
                                    const blackCnt = (ce as any).black ?? 0;
                                    const brownCnt = (ce as any).brown ?? 0;
                                    return (
                                      <>
                                        {/* Only the first Gold card shows up front; any extra Gold
                                        cards move after the Green cards (never stacked ×N here). */}
                                        {goldCnt > 0 && (
                                          <StackedCard type="gold" count={1} size="md" playerId={row?.playerId ?? undefined} trigger="click" />
                                        )}
                                        {greenCnt > 0 && (
                                          // pb-1 — StackedCard nudges green cards down via
                                          // translateY(2.5%) (a transform, so it doesn't add
                                          // to this box's own computed height), which with
                                          // zero padding painted the cards poking out past
                                          // the box's bottom border. A few px of buffer here
                                          // (not extra top/side padding, which risks tripping
                                          // this page's global header-height auto-shrink)
                                          // absorbs just that shift.
                                          <div className="inline-flex items-center gap-[0.5%] rounded-[2px] bg-white px-[3px] pt-0 pb-1 border border-[#3b82f6]">
                                            {Array.from({ length: greenCnt }).map((_, i) => (
                                              <div key={i} style={{ transform: "translateY(0.9px)" }}>
                                                <StackedCard type="green" count={1} size="md" playerId={row?.playerId ?? undefined} trigger="click" eventIndex={i} />
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {goldCnt > 1 && (
                                          <StackedCard type="gold" count={goldCnt - 1} size="md" playerId={row?.playerId ?? undefined} trigger="click" overlayCount />
                                        )}
                                        {blackCnt > 0 && (
                                          <StackedCard type="black" count={blackCnt} size="md" playerId={row?.playerId ?? undefined} trigger="click" overlayCount />
                                        )}
                                        {brownCnt > 0 && (
                                          <StackedCard type="brown" count={brownCnt} size="md" playerId={row?.playerId ?? undefined} trigger="click" overlayCount />
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Static watermark: max cards for this tier (G=7, H=5, T=3) */}
                              {/*
                          {hasPlayer && ce && (() => {
                            const colorSum = (["gold", "black", "brown", "green"] as const)
                              .reduce((s, t) => s + ((ce as any)[t] ?? 0), 0);
                            const graySum = ((ce.freeGray ?? 0) + (ce.gray160 ?? 0)) || (ce.gray ?? 0);
                            const cardSum = colorSum + graySum;
                            if (cardSum === 0) return null;
                            return <span className="flex-shrink-0 text-[12px] font-extrabold text-black/80 tabular-nums leading-none">({cardSum})</span>;
                          })()}
                          */}
                              <span
                                className="flex-shrink-0 -mr-1.5 pl-2 text-[19.5px] font-extrabold tabular-nums leading-none"
                                style={{ color: "rgba(0,0,0,0.55)", marginLeft: "1%" }}
                              >
                                ({LB_CARD_MAX[tier]})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* The 8-button toolbar grid used to live here as a flex item —
                      it moved into the scaled Board-number unit below so both can
                      shrink together on narrower windows. */}
                    {/* Right-block spacer — reserves the px-anchored sky/logo/POD area, so the
                      leaderboard flex item spans the whole blue zone at any viewport width */}
                    <div className="flex-shrink-0 ml-auto" style={{ width: "312px" }} />

                  </div>
                )}

                {/* Board number + BAT246 watermark + 8-button toolbar — one unit,
                  anchored at TOOLBAR_ANCHOR (just past the gold Leaderboard bars'
                  visual overhang). Lives inside the scaled content wrapper, so on
                  narrower windows it shrinks together with the leaderboard (and
                  the POD) via the headerFit effect instead of on its own. Internal
                  offsets are the old fixed-pixel values rebased to the anchor. */}
                {!readOnly && (
                  <div
                    className="absolute inset-y-0 z-20 has-[.bat246-toolbar-btn:hover]:z-[10000] flex items-center"
                    style={{ left: TOOLBAR_ANCHOR }}
                  >
                    <div className="absolute top-1/2 z-20 flex flex-col items-center gap-0.5" style={{ left: 758.5 - TOOLBAR_ANCHOR, transform: "translateY(-67.5%) translateX(-17%) scale(1.1449)" }}>
                      <div className="flex flex-row items-baseline gap-1.5">
                        <span className="text-[22px] font-bold uppercase tracking-[0.2em] font-[family-name:var(--font-bat-display)] leading-none text-black" style={{ WebkitTextStroke: "2px #ffffff", paintOrder: "stroke", textShadow: "1px 2px 0 rgba(0,0,0,0.5)" }}>Board</span>
                        <span className="font-[family-name:var(--font-bat-display)] font-bold text-[22px] leading-none text-black" style={{ WebkitTextStroke: "2px #ffffff", paintOrder: "stroke", textShadow: "1px 2px 0 rgba(0,0,0,0.5)" }}>
                          {/* Board 6-1002 only — display-only masking, board.trackingNumber itself is untouched */}
                          {board.trackingNumber?.replace(/\s*[LR]$/, "")}
                        </span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/bat246-text-logo.png" alt="BAT 246" className="mt-0.5" style={{ height: "66.34px", width: "auto", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))", transform: "translateY(2%)" }} />
                      {board.warpCount > 0 && (
                        <div className="px-2 py-0.5 rounded border border-amber-300/50 text-[10px] font-bold text-white tracking-wider" style={{ background: "linear-gradient(to bottom, #7c3aed, #5b21b6)" }}>
                          WARP-{board.warpCount}
                        </div>
                      )}
                    </div>
                    <div style={{ paddingLeft: TOOLBAR_GRID_LEFT - TOOLBAR_ANCHOR }}>
                      <div className="flex flex-col items-center gap-1.5" style={{ transform: `scale(${TOOLBAR_GRID_SCALE})`, transformOrigin: "left center" }}>
                        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 100px)", columnGap: 8, rowGap: 12.04, paddingTop: 5, paddingBottom: 5 }}>
                          {BUTTONS.map(({ key, icon: Icon, label, num, imgSrc }, i) => (
                            /* Top row grows downward (origin at its top edge) so the hover
                               blow-up stays inside the board instead of spilling off the top;
                               bottom row grows upward for the same reason. */
                            <button key={num} onClick={(e) => { e.currentTarget.blur(); setOpenModal(key); }}
                              style={{ transformOrigin: i < 4 ? "center top" : "center bottom" }}
                              className="bat246-toolbar-btn relative block p-0 border-0 outline-none focus:outline-none focus-visible:outline-none bg-transparent cursor-pointer active:opacity-60 transition-transform duration-150 ease-out hover:scale-[1.87] hover:z-50">
                              {imgSrc
                                /* eslint-disable-next-line @next/next/no-img-element */
                                ? <img src={imgSrc} alt={label.replace(/\n/g, " ")} className="object-contain" style={{ width: 90, height: 54, maxWidth: "none", filter: "sepia(0.35)" }} draggable={false} />
                                : <Icon className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" style={{ width: 44.1, height: 44.1 }} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>{/* /scaled content wrapper */}
          </div>

          {/* ════ BODY ════════════════════════════════════════════════════ */}
          <div ref={bodyElRef} className="relative flex-1 flex">

            {/* Child-board nav arrows — portaled into the page's top "All Boards"
                bar instead of floating over the board (left arrow right after
                "All Boards", right arrow pinned to the far right end). */}
            {navLeftEl && board.leftChildBoardId && createPortal(
              <Link href={`/games/bat246/${board.leftChildBoardId}`}
                className="relative flex items-center justify-center px-1.5 py-1 rounded-md bg-green-500 hover:bg-green-400 border-[3px] border-blue-500 transition-colors whitespace-nowrap"
                style={{ marginLeft: "-4.7%", marginRight: "calc(1% + 34px)", transform: "scale(1.5)", transformOrigin: "left center" }}>
                <span className="inline-block text-black font-bold text-[15px] leading-snug">
                  {relatedBoards[board.leftChildBoardId]?.trackingNumber?.replace("-", " - ") ?? "…"}
                </span>
              </Link>,
              navLeftEl,
            )}
            {navRightEl && board.rightChildBoardId && createPortal(
              <Link id="bat246-nav-right-btn" href={`/games/bat246/${board.rightChildBoardId}`}
                className="relative flex items-center justify-center px-1.5 py-1 rounded-md bg-green-500 hover:bg-green-400 border-[3px] border-blue-500 transition-colors whitespace-nowrap"
                style={{ transform: "translateX(-29%) translateY(12.5%) scale(1.5)", transformOrigin: "right center" }}>
                <span className="inline-block text-black font-bold text-[15px] leading-snug">
                  {relatedBoards[board.rightChildBoardId]?.trackingNumber?.replace("-", " - ") ?? "…"}
                </span>
              </Link>,
              navRightEl,
            )}
            {/* Not split yet on that side: same button, non-clickable, number left blank ("6 -      L"). */}
            {navLeftEl && !board.leftChildBoardId && createPortal(
              <div
                className="relative flex items-center justify-center px-1.5 py-1 rounded-md bg-green-500 border-[3px] border-blue-500 whitespace-nowrap cursor-default select-none"
                style={{ marginLeft: "-4.7%", marginRight: "calc(1% + 34px)", transform: "scale(1.5)", transformOrigin: "left center" }}>
                <span className="inline-block text-black font-bold text-[15px] leading-snug whitespace-pre">{`${familyPrefix} -      L`}</span>
              </div>,
              navLeftEl,
            )}
            {navRightEl && !board.rightChildBoardId && createPortal(
              <div id="bat246-nav-right-btn"
                className="relative flex items-center justify-center px-1.5 py-1 rounded-md bg-green-500 border-[3px] border-blue-500 whitespace-nowrap cursor-default select-none"
                style={{ transform: "translateX(-29%) translateY(12.5%) scale(1.5)", transformOrigin: "right center" }}>
                <span className="inline-block text-black font-bold text-[15px] leading-snug whitespace-pre">{`${familyPrefix} -      R`}</span>
              </div>,
              navRightEl,
            )}

            {/* ── Playing field — diamond layout (absolute, reference-matched) ───
                   On the read-only invite/preview boards (no leaderboard/toolbar/dugout
                   above), the diamond is nudged down 2% so it isn't crammed under the
                   invite banner. */}
            <div
              ref={fieldElRef}
              className="absolute z-10 pointer-events-none"
              style={{ top: readOnly ? "6%" : "0%", height: "70.5%", left: readOnly ? 16 : 176, right: 176 }}
            >
              {/* Home Plate — upper-left */}
              {/* Nudged left so it sits right up against the Dugout column */}
              <div className="absolute pointer-events-auto z-30" style={{ left: "4.5%", top: "-7.5%", width: "15.58%" }}>
                <div style={fitStyle(fieldScale)}>
                  <HomePlateCard slot={board.homePlate} showCredits isHighlighted={highlightPosition === "homePlate"} />
                </div>
              </div>

              {/* Bases — positioned to mirror the reference diamond */}
              {([
                { key: "thirdBase", label: "3rd Base", slot: board.thirdBase, left: 38.5, top: 21, w: 16.59, minH: 131 },
                { key: "secondBaseA", label: "2nd Base A", slot: board.secondBaseA, left: 12.5, top: hasAnyAtBatInvite ? 39.3 : canShowInvite ? 39 : 40.5, w: 15.76, minH: 140 },
                { key: "secondBaseB", label: "2nd Base B", slot: board.secondBaseB, left: 64.5, top: hasAnyAtBatInvite ? 39.3 : canShowInvite ? 39 : 40.5, w: 15.76, minH: 140 },
                { key: "1stA", label: "1st Base A", slot: board.firstBase[0] ?? null, left: ppbGreenCards(board.firstBase[0]).length >= 2 ? 3.5 : 2, top: hasAnyAtBatInvite ? 71.4 : canShowInvite ? 71.7 : 73.2, w: 13.17, minH: 143 },
                { key: "1stB", label: "1st Base B", slot: board.firstBase[1] ?? null, left: 25, top: hasAnyAtBatInvite ? 71.4 : canShowInvite ? 71.7 : 73.2, w: 13.17, minH: 143 },
                { key: "1stC", label: "1st Base C", slot: board.firstBase[2] ?? null, left: 54.7, top: hasAnyAtBatInvite ? 71.4 : canShowInvite ? 71.7 : 73.2, w: 13.17, minH: 143 },
                { key: "1stD", label: "1st Base D", slot: board.firstBase[3] ?? null, left: 78.7, top: hasAnyAtBatInvite ? 71.4 : canShowInvite ? 71.7 : 73.2, w: 13.17, minH: 143 },
              ] as const).map(({ key, label, slot, left, top, w, minH }) => (
                <div key={key} className="absolute pointer-events-auto" style={{ left: `${left}%`, top: `${top}%`, width: `${w}%` }}>
                  <div style={fitStyle(fieldScale)}>
                    <BaseCard label={label} slot={slot} showCredits isHighlighted={highlightPosition === key} minHeight={minH} cardsScale={1.55} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── At Bat row — anchored to align with Dugout/Hot Box bottom edge ── */}
            <div
              className="absolute left-0 right-0 bottom-0 px-2 pb-1"
              style={{ top: hasPrevBtn ? "calc(74% + 4px)" : canShowInvite ? "calc(75% + 4px)" : readOnly ? "calc(81.5% + 4px)" : "calc(77.5% + 4px)", display: "grid", gridTemplateColumns: "repeat(8, 1fr)", alignItems: "start", gap: "4px" }}
            >
              {([0, 1, 2, 3, 4, 5, 6, 7] as const).map((i) => (
                <div key={i} style={{ gridColumn: `${i + 1} / ${i + 2}` }} className="relative pt-0 mx-[5px]">
                  <div className="flex flex-col" style={fitStyle(bodyScale)}>
                    <PosLabel text={`AB${i + 1}`} />
                    <Slot slot={board.atBat[i] ?? null} accentBorder="border-l-amber-400" compact isHighlighted={highlightPosition === `atBat-${i}`} />
                    <AtBatInviteBtn position={`atBat-${i}`} slot={board.atBat[i] ?? null} />
                  </div>
                </div>
              ))}
              {/* Prev board button — all logged-in users, child boards only, floating between
                  AB4 and AB5; hidden on read-only invite/preview boards since it links to the
                  authenticated board page. Stays visible even after this board itself has
                  split — parentBoardId doesn't change, so the link back stays valid. */}
              {!readOnly && board.parentBoardId && (() => {
                // Trailing " L"/" R" (left/right split side) isn't needed here.
                const prevTrackingNumber =
                  relatedBoards[board.parentBoardId]?.trackingNumber?.replace(/\s+[LR]$/, "") ?? "…";
                const prevLabel = `Previous ${prevTrackingNumber}`;
                const prevFontSize = Math.max(16, Math.min(30, 409 / prevLabel.length));
                return (
                  <div className="absolute z-20" style={{ bottom: "calc(4px + 2.5%)", left: "50%", transform: "translateX(-50%)" }}>
                    <Link href={`/games/bat246/${board.parentBoardId}`}
                      className="relative flex items-center justify-center px-1 rounded-md bg-[#b83838] hover:bg-[#cd5555] border-[3px] border-black transition-colors whitespace-nowrap"
                      style={{ width: "240px", height: "35px" }}>
                      <span className="text-black font-bold leading-none" style={{ fontSize: `${prevFontSize}px` }}>{prevLabel}</span>
                    </Link>
                  </div>
                );
              })()}
            </div>

            {/* ── Minor League / Dugout — roster panel, shown to logged-in users
                   (admin + regular board view), hidden on read-only invite/preview boards.
                   Scales with the body factor (appended to the position nudge, top-left
                   origin so it stays anchored in the left rail) — the whole panel
                   (siren, Overflow pill, roster, door bracket) shrinks/grows together
                   with the rest of the board instead of staying fixed-size. The page
                   frame's dugout gap measures this element's rect, so it adapts too. ─── */}
            {!readOnly && (() => {
              // Overflow pill shows a number instead of the "Overflow" label
              // once the dugout has more than 8 occupants — nudge the whole
              // panel up 1% in that state so the taller pill content doesn't
              // crowd what's below it.
              const dugoutOverflowing = board.dugout.length > 8;
              const baseY = canShowInvite ? 30 : 31.5;
              const panelY = dugoutOverflowing ? baseY - 1 : baseY;
              return (
              <div id="bat246-dugout-panel" className="absolute left-6 top-3 w-[165px] flex-shrink-0 flex flex-col z-20 px-1.5 pt-3 pb-3" style={{ maxHeight: "calc(79% - 16px)", overflow: "visible", transform: `translate(-14%, ${panelY}%) scale(${bodyScale})`, transformOrigin: "top left" }}>
                <div className="absolute pointer-events-none" style={{ top: "-8%", bottom: 0, left: 0, right: "-15%", backgroundImage: "url(/images/bat246-dugout-bg.jpg)", backgroundSize: "80px 80px", backgroundRepeat: "repeat" }} />
                {/* Border — three independent bars (top/right/bottom only, no left
                    piece at all) instead of a box-shadow ring + clip-path. A ring
                    naturally wraps every corner, so clipping away just the left
                    side always left a hard-edged stub right where the cut met the
                    top bar; separate bars have no shared corner geometry to cut,
                    so the left stays genuinely open with no artifact. */}
                <div className="absolute pointer-events-none" style={{ top: "-8%", left: 0, right: "-15%", height: "7px", background: "#000000" }} />
                <div className="absolute pointer-events-none" style={{ top: "-8%", bottom: 0, right: "-15%", width: "7px", background: "#000000" }} />
                <div className="absolute pointer-events-none" style={{ bottom: 0, left: 0, right: "-15%", height: "7px", background: "#000000" }} />
                {/* Thin white trim just outside the black border above, on all
                    three sides (top/right/bottom), matching the "no left" rule. */}
                <div className="absolute pointer-events-none" style={{ top: "calc(-8% - 1px)", left: 0, right: "calc(-15% - 1.5px)", height: "1px", background: "#ffffff" }} />
                <div className="absolute pointer-events-none" style={{ top: "calc(-8% - 1px)", bottom: "-1px", right: "calc(-15% - 1.5px)", width: "1.5px", background: "#ffffff" }} />
                <div className="absolute pointer-events-none" style={{ bottom: "-1px", left: 0, right: "calc(-15% - 1.5px)", height: "1px", background: "#ffffff" }} />

                {/* MINOR LEAGUE varsity title — same treatment as the
                    PLAYING FIELD label (font-bat-varsity, white with a dark
                    stroke + shadow). Was removed when this panel was
                    reworked from an admin-only overlay into the current
                    shared roster panel; restoring it here, sitting above
                    the panel's own top border (which itself pokes up "-8%"
                    above the panel box — 108% clears that plus a 10px gap,
                    matching the same panel-relative percentage the border
                    bars above already use, so it scales in lockstep). */}
                <div className="absolute pointer-events-none left-0 right-[-15%] text-center leading-[0.85]" style={{ bottom: "calc(110% + 10px)" }}>
                  <div className="font-[family-name:var(--font-bat-varsity)] font-bold text-[34px] text-white" style={{ WebkitTextStroke: "3px #14210e", paintOrder: "stroke", textShadow: "1px 2px 0 rgba(0,0,0,0.5)" }}>MINOR</div>
                  <div className="font-[family-name:var(--font-bat-varsity)] font-bold text-[27px] text-white" style={{ WebkitTextStroke: "3px #14210e", paintOrder: "stroke", textShadow: "1px 2px 0 rgba(0,0,0,0.5)" }}>LEAGUE</div>
                </div>

                {/* Count pill + siren — pill only appears when dugout has 9+ players */}
                <div className="flex items-center gap-1 flex-shrink-0 mb-1.5" style={{ transform: "translateY(-22px) translateX(8.4px)" }}>
                  {/* Hidden once the board has split; visibility (not removal) keeps the Overflow pill in place. */}
                  <img
                    src="https://media.tenor.com/tDau9a7i5hwAAAAj/alert-siren.gif"
                    alt="Siren"
                    className="w-[29px] h-[29px] flex-shrink-0 object-contain"
                    style={{ transform: "translateX(10%) scale(1.15)", visibility: board.status === "split" ? "hidden" : "visible" }}
                  />
                  {(() => {
                    const overflow = Math.max(0, board.dugout.length - 8);
                    return (
                      <button
                        onClick={() => overflow > 0 && setShowAllDugout(true)}
                        className="flex-1 ml-[20%] rounded-full bg-gradient-to-b from-[#f7baa7] to-[#df7a5d] border border-white/60 text-center leading-none py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.5)] transition-all"
                        style={{ cursor: overflow > 0 ? "pointer" : "default", transform: "translateX(-10%)" }}
                      >
                        {overflow > 0 ? (
                          <span className="text-[13px] font-bold text-[#3a160c]">{overflow}</span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#3a160c] tracking-wide w-full text-center block">Overflow</span>
                        )}
                      </button>
                    );
                  })()}
                </div>

                {/* Quilted roster — numbers (8→1), names, 3D DUGOUT letters */}
                <div
                  className="rounded-[4px] overflow-hidden flex-shrink-0 border-t-2 border-b-2 border-black shadow-[0_4px_10px_rgba(0,0,0,0.55)] relative"
                  style={{
                    backgroundColor: "#b7bac0",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 16%, rgba(0,0,0,0.12) 100%), repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0.022) 1px 2.5px)",
                    transform: "translateY(-6%) translateX(8.4px)",
                  }}
                >
                  {/* Right border with door opening on row 1 (last 40px): solid top 10% + bottom 10%, open middle 80% */}
                  <div className="absolute right-0 top-0 h-full pointer-events-none z-50" style={{ width: "2px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.7) calc(100% - 31px), transparent calc(100% - 31px), transparent calc(100% - 6px), rgba(0,0,0,0.7) calc(100% - 6px), rgba(0,0,0,0.7) 100%)" }} />
                  {Array.from({ length: 8 }, (_, i) => board.dugout[7 - i] ?? null).map((slot, i) => {
                    const num = 8 - i;
                    const letter = i >= 0 && i <= 5 ? "DUGOUT"[i] : "";
                    return (
                      <div
                        key={i}
                        className={cn(
                          "relative flex items-center justify-between gap-1 pl-1 pr-1.5 h-[40px] border-b border-black/30 last:border-b-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-colors overflow-hidden",
                          i % 2 === 0 ? "bg-white/[0.06]" : "bg-black/[0.05]",
                          "hover:bg-amber-100/25",
                        )}
                        onMouseEnter={slot ? (e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setDugoutHover({ slot, top: r.top, left: r.right + 8 });
                        } : undefined}
                        onMouseLeave={slot ? () => setDugoutHover(null) : undefined}
                      >
                        {/* top-left: number */}
                        <div className="absolute top-[2px] left-[2px] leading-none">
                          <span className="text-[16px] font-bold text-black/45 leading-none">{num}</span>
                        </div>
                        {/* right edge, vertically centered: DUGOUT letter — watermark */}
                        {letter && (
                          <div className="absolute right-[calc(2px+14.8%)] inset-y-0 flex items-center pointer-events-none">
                            <span
                              className="font-[family-name:var(--font-bat-varsity)] text-[18.89px] font-extrabold leading-none select-none"
                              style={{ color: "#ffffff", WebkitTextStroke: "2.5px #000000", paintOrder: "stroke" }}
                            >
                              {letter}
                            </span>
                          </div>
                        )}
                        {slot?.podTeamId ? (
                          <span
                            onClick={(e) => { e.stopPropagation(); openPodTeamPopup(slot.podTeamId!); }}
                            className="flex-1 text-[17px] font-extrabold text-blue-900 truncate pl-2.5 pr-5 leading-tight underline decoration-dotted cursor-pointer [text-shadow:0_1px_0_rgba(255,255,255,0.35)]"
                            title="Click to see all 4 POD team members"
                          >
                            {slot.podTeamId}
                          </span>
                        ) : (
                          <span className="flex-1 text-[17px] font-extrabold text-[#15171c] truncate pl-2.5 pr-5 leading-tight [text-shadow:0_1px_0_rgba(255,255,255,0.35)]">{slot?.playerName ?? ""}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Door bracket for row "1" (the bottom row) — rendered as a sibling of the
                    roster panel (not inside it) so it isn't clipped by the roster's own
                    overflow-hidden; the horizontal bar needs to visibly extend past the
                    roster's right edge into the border. bottom/right match the wrapper's own
                    pb-3 / px-1.5 padding so this lines up with the roster's true edges. */}
                <div className="absolute pointer-events-none" style={{ bottom: "12px", right: "6px", height: "40px", width: 0, transform: "translateY(-19.2px) translateX(8.4px)" }}>
                  <div className="absolute top-[6px] h-[3px] w-[16px] bg-black" style={{ right: "-5.3px" }} />
                  <div className="absolute bottom-[6px] h-[3px] w-[16px] bg-black" style={{ right: "-5.3px" }} />
                </div>

                {/* {board.dugout.length > 8 && (
                  <button
                    onClick={() => setShowAllDugout(true)}
                    className="mt-1.5 self-center text-[9px] font-bold text-amber-100 bg-black/55 border border-amber-400/40 rounded px-2 py-0.5 flex-shrink-0 hover:bg-black/70 transition-colors"
                  >
                    +{board.dugout.length - 8} more
                  </button> */}

              </div>
              );
            })()}

            {/* ── HOT BOX — independent absolute panel ── */}
            <div className="absolute right-[calc(0.75rem+5%-58px)] w-[208px] px-0.5 pt-3" style={{ zIndex: hotBoxExpanded ? 100 : 20, top: readOnly ? "10%" : "0.75rem", transform: bodyScale !== 1 ? `scale(${bodyScale})` : undefined, transformOrigin: "top right" }}>
              {(() => {
                const allHotBoxRows = (["Gold", "Black", "Brown", "Gray"] as const).flatMap((ct) =>
                  board.hotBox.filter((h) => h.cardType === ct).map((e) => ({ ...e, ct }))
                );
                const sliced = hotBoxExpanded ? allHotBoxRows : allHotBoxRows.slice(0, 4);
                const visibleRows: (typeof allHotBoxRows[number] | null)[] = [
                  ...sliced,
                  ...Array(Math.max(0, 4 - sliced.length)).fill(null),
                ];
                const hasMore = allHotBoxRows.length > 4;
                return (
                  <div className="flex flex-col rounded-xl border-2 border-black/80 shadow-[0_4px_12px_rgba(0,0,0,0.55)] overflow-hidden">
                    <div style={{ background: "linear-gradient(180deg, #f5d21a 0%, #f0a81e 38%, #e2601c 68%, #d2281c 100%)" }}>
                      <div className="text-center border-b-2 border-black/70 py-[3px]" style={{ background: "linear-gradient(180deg, #f8e25a, #e9bc12)" }}>
                        <span className="font-[family-name:var(--font-bat-varsity)] text-[26px] font-black text-black leading-none w-full block" style={{ textShadow: "0 1px 0 rgba(255,255,255,0.4)", WebkitTextStroke: "0.5px black", paintOrder: "stroke fill", letterSpacing: "5px" }}>HOT BOX</span>
                      </div>
                      {visibleRows.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 px-2.5 py-[1px] border-b border-black/40 last:border-b-0">
                          {entry ? (
                            <>
                              <CardCase cards={[entry.ct.toLowerCase() as import("./MiniCard").MiniCardType]} size="md" frame="earned" stack playerId={entry.playerId} trigger="click" />
                              <span className="text-[12.5px] font-extrabold truncate leading-tight text-[#1a0f04]">{entry.playerName ?? ""}</span>
                            </>
                          ) : (
                            <span className="text-[11px] text-transparent select-none block h-[35px]">&nbsp;</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => hasMore && setHotBoxExpanded((v) => !v)}
                      className={cn(
                        "w-full py-[5px] text-[13px] font-extrabold tracking-wide uppercase border-t border-black/50 transition-colors bg-white",
                        hasMore
                          ? "text-black hover:text-black/70 cursor-pointer"
                          : "text-black/70 cursor-default"
                      )}
                    >
                      {hotBoxExpanded ? "Less ▲" : `More (${Math.max(0, allHotBoxRows.length - 4)}) ▼`}
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* ── PLAYING FIELD — independent absolute label ── */}
            <div className="absolute right-[calc(0.75rem+13%)] top-[36%] w-[165px] z-20 text-center leading-[0.85] py-3" style={{ transform: bodyScale !== 1 ? `scale(${bodyScale})` : undefined, transformOrigin: "top right" }}>
              <div className="font-[family-name:var(--font-bat-varsity)] font-bold text-[34px] text-white" style={{ WebkitTextStroke: "3px #14210e", paintOrder: "stroke", textShadow: "1px 2px 0 rgba(0,0,0,0.5)" }}>PLAYING</div>
              <div className="font-[family-name:var(--font-bat-varsity)] font-bold text-[27px] text-white" style={{ WebkitTextStroke: "3px #14210e", paintOrder: "stroke", textShadow: "1px 2px 0 rgba(0,0,0,0.5)" }}>FIELD</div>
            </div>

            {/* ── GAME CLOCK — independent absolute panel — the 1.46 design
                blow-up now multiplies with the body's responsive scale, so the
                clock shrinks/grows with the board instead of staying fixed
                (it used to overflow onto the field cards on small screens). ── */}
            <div className="absolute right-3 w-[176.5px] z-20" style={{ top: readOnly ? "56.5%" : canShowInvite ? "48.5%" : "50%", transform: `translateX(-1.5%) scale(${1.46 * bodyScale})`, transformOrigin: "top right" }}>
              {board.status === "split" && board.splitAt ? (
                <GameClock
                  targetDate={new Date(board.protectionPeriodEnd)}
                  pausedRemainingMs={Math.max(0, new Date(board.protectionPeriodEnd).getTime() - new Date(board.splitAt).getTime())}
                  stopped
                />
              ) : (
                <GameClock targetDate={new Date(board.protectionPeriodEnd)} pausedRemainingMs={board.ppPausedRemainingMs} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
