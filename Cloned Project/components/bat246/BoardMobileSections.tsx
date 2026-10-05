"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BoardData, HotBoxEntry, SlotData } from "./types";
import { firstNameInitial } from "./nameUtils";
import { BaseCard } from "./BaseCard";
import { HomePlateCard } from "./HomePlateCard";
import { GameClock } from "./GameClock";
import {
  BUTTONS,
  LB_CARD_MAX,
  LB_COLOR,
  LB_ICON,
  POD_ART_H,
  POD_ART_W,
  POD_WINDOWS,
  PendingPlacement,
  PodOccupant,
  PodTeamMember,
  PosLabel,
  Slot,
  fmtDate,
  fmtTime,
  slotToPodOccupant,
  type ModalKey,
} from "./BoardLayout";
import { CardCase, FlagIcon, StackedCard, earnedCards, ppbGreenCards, type MiniCardType } from "./MiniCard";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, LayoutGrid, Link2, X } from "lucide-react";
import { LayawayModal } from "./modals/LayawayModal";
import { SnapBackModal } from "./modals/SnapBackModal";
import { MessageModal } from "./modals/MessageModal";
import { PrePickModal } from "./modals/PrePickModal";
import { PencilingModal } from "./modals/PencilingModal";
import { WarpModal } from "./modals/WarpModal";
import { SpeedUpModal } from "./modals/SpeedUpModal";
import { GiftCardModal } from "./modals/GiftCardModal";
import { InviteModal } from "./InviteModal";

/**
 * Phone / tablet-portrait board (switched in by useIsMobileBoard).
 *
 * The desktop board cut into the founder's four sections, ONE SCREEN EACH —
 * no scrolling inside a section. They sit in the same 2×2 arrangement as on
 * the desktop board, and you move between them the way the board is laid
 * out: swipe sideways or up/down, or tap the arrow in the gutter.
 *
 *          A ⇄ B
 *          ⇅   ⇅
 *          C ⇄ D
 *
 *   A — one row: L chip · Boards · BAT 246 · R chip; Leaderboard; Home Plate
 *   B — the 8 action tiles; 3rd Base under them; POD
 *   C — Dugout with 2nd Base A beside it; 1st Base A/B; AT BAT 1–4
 *   D — 2nd Base B with Hot Box top-right; 1st Base C/D + Game Clock in one
 *       row; AT BAT 5–8
 *
 * Each section has exactly two arrows (A: right + down, B: left + down,
 * C: up + right, D: up + left). They live in a reserved gutter along that
 * edge, OUTSIDE the content box, so they can never cover anything on the
 * board. Opening a board shows Section A.
 *
 * "Fits the screen" is enforced two ways. Each section's content is laid out
 * at the screen width and, if its natural height is taller than the screen,
 * FitSection scales the whole section down uniformly (so a long-named
 * roster or a tall phone never makes a section scroll). And in landscape,
 * where height is scarce, B/C/D rearrange into columns (Tailwind
 * `landscape:` variants) so that scale stays near 1.
 *
 * Same look as desktop by construction: the cards ARE the desktop components
 * (HomePlateCard, BaseCard, the AT BAT Slot, GameClock), rendered at their
 * desktop design width and scaled down to the space available (FitCard —
 * the same trick BoardLayout's fitStyle uses) so nothing re-wraps or spills.
 * Tiles, LB rows, POD, dugout and Hot Box reuse the desktop's artwork and
 * constants in compact markup. Every modal is the desktop one. Nothing here
 * is shared back into BoardLayout.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const tok = () => (typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "");

/* Desktop widths of each card (px at the 1,904px design): what FitCard scales
   from, so a phone card is a true miniature of its desktop self. Field =
   1904 − 2×176 = 1552 wide; cards are %-widths of that. */
const DESIGN = {
  homePlate: Math.round(1552 * 0.1558),  // 242
  thirdBase: Math.round(1552 * 0.1659),  // 257
  secondBase: Math.round(1552 * 0.1576), // 245
  firstBase: Math.round(1552 * 0.1317),  // 204
  atBat: 220,                            // one of 8 columns, less margins
  clock: 176,                            // desktop wrapper is w-[176.5px]
  hotBox: 208,                           // desktop panel is w-[208px]
};
const FIELD_CARDS_SCALE = 1.55;          // BoardLayout passes this to every BaseCard

const AT_BAT_LABELS: Record<string, string> = {
  "atBat-0": "AT BAT 1", "atBat-1": "AT BAT 2", "atBat-2": "AT BAT 3", "atBat-3": "AT BAT 4",
  "atBat-4": "AT BAT 5", "atBat-5": "AT BAT 6", "atBat-6": "AT BAT 7", "atBat-7": "AT BAT 8",
};

/**
 * Lays its child out at `designWidth` px and scales it to the width it
 * actually gets — down as far as needed, up to at most `maxScale` (1 = never
 * larger than desktop) — reserving the scaled height so what follows doesn't
 * leave a gap. The child keeps its desktop pixel design intact.
 */
function FitCard({ designWidth, maxScale = 1, className, children }: { designWidth: number; maxScale?: number; className?: string; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [f, setF] = useState(1);
  const [h, setH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const w = outer.clientWidth;
      const s = w > 0 ? Math.min(maxScale, w / designWidth) : 1;
      setF((p) => (Math.abs(p - s) < 0.005 ? p : s));
      // offsetHeight ignores the transform — the unscaled layout height.
      const ih = inner.offsetHeight * s;
      setH((p) => (p != null && Math.abs(p - ih) < 0.5 ? p : ih));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [designWidth, maxScale]);
  // Shrinking: the design-width box overflows the outer, so scale from the
  // left edge. Growing: the box is narrower than the outer — centre it and
  // scale from the centre so it grows evenly to fill.
  const style: React.CSSProperties | undefined =
    f === 1 ? undefined
    : f < 1 ? { width: designWidth, transform: `scale(${f})`, transformOrigin: "top left" }
    : { width: designWidth, margin: "0 auto", transform: `scale(${f})`, transformOrigin: "top center" };
  return (
    <div ref={outerRef} className={className} style={{ height: h }}>
      <div ref={innerRef} style={style}>
        {children}
      </div>
    </div>
  );
}

/**
 * A section's content, fitted to the screen height — a section can never
 * need to scroll. If the content is taller than the screen it is scaled
 * down, but FULL-WIDTH: the block is laid out at 100/f % of the width and
 * scaled by f (the same trick BoardLayout's header uses), so the scaled
 * result still spans edge to edge and only the height shrinks. Scaling the
 * block uniformly instead left blank margins down both sides in landscape.
 *
 * The scale is derived from the content's height at its current layout
 * width; the rows here are fixed-height (buttons, LB bars, design-width
 * cards), so that height barely moves with width and the measure settles
 * in a step or two. The 1% tolerance stops any residual back-and-forth.
 */
function FitSection({ padding = "px-3 pt-3 pb-1.5", fill = false, children }: { padding?: string; fill?: boolean; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState({ f: 1, y: 0 });
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const avail = outer.clientHeight;
      const natural = inner.offsetHeight; // unscaled layout height
      if (!avail || !natural) return;
      const f = Math.min(1, avail / natural);
      const y = Math.max(0, (avail - natural * f) / 2); // centre vertically when there's room
      setFit((p) => (Math.abs(p.f - f) < 0.01 && Math.abs(p.y - y) < 1 ? p : { f, y }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outerRef} className="relative z-10 h-full w-full overflow-hidden">
      <div
        ref={innerRef}
        className={cn("absolute left-0 top-0", fill && "flex flex-col", padding)}
        style={{ minHeight: fill ? "100%" : undefined, width: `${100 / fit.f}%`, transform: `translateY(${fit.y}px) scale(${fit.f})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}

/* Scales its child to the largest size that fits the box it is given (height
   AND width), pinned to that box's top-right corner. Used for the Game Clock,
   which fills the space under the Hot Box. */
function FitFill({ className, onClick, children }: { className?: string; onClick?: () => void; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [s, setS] = useState(1);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const aw = outer.clientWidth;
      const ah = outer.clientHeight;
      const nw = inner.offsetWidth;
      const nh = inner.offsetHeight;
      if (!aw || !ah || !nw || !nh) return;
      const next = Math.min(aw / nw, ah / nh);
      setS((p) => (Math.abs(p - next) < 0.005 ? p : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outerRef} className={cn("relative", className)} onClick={onClick}>
      <div ref={innerRef} className="absolute right-0 top-0 rounded-md ring-2 ring-white" style={{ width: DESIGN.clock, transform: `scale(${s})`, transformOrigin: "top right" }}>{children}</div>
    </div>
  );
}

// Tracking numbers never change once a board exists — cache for the session,
// same idea as BoardLayout's boardSummaryCache.
const summaryCache: Record<string, string> = {};
function useRelatedTracking(board: BoardData) {
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (board._id) summaryCache[board._id] = board.trackingNumber;
    const ids = [board.parentBoardId, board.leftChildBoardId, board.rightChildBoardId].filter(Boolean) as string[];
    const have: Record<string, string> = {};
    const missing: string[] = [];
    for (const id of ids) (summaryCache[id] ? (have[id] = summaryCache[id]) : missing.push(id));
    if (Object.keys(have).length) setMap((p) => ({ ...p, ...have }));
    if (!missing.length) return;
    Promise.all(
      missing.map((id) =>
        fetch(`${API}/bat246/boards/${id}/summary`, { headers: { Authorization: `Bearer ${tok()}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d?.trackingNumber ? ([id, d.trackingNumber as string] as const) : null))
          .catch(() => null),
      ),
    ).then((rs) => {
      const next: Record<string, string> = {};
      for (const r of rs) if (r) { next[r[0]] = r[1]; summaryCache[r[0]] = r[1]; }
      if (Object.keys(next).length) setMap((p) => ({ ...p, ...next }));
    });
  }, [board._id, board.trackingNumber, board.parentBoardId, board.leftChildBoardId, board.rightChildBoardId]);
  return map;
}

/* Varsity heading, same treatment as the desktop's PLAYING FIELD / MINOR LEAGUE. */
function Varsity({ top, bottom, size = 22 }: { top: string; bottom?: string; size?: number }) {
  const style = { WebkitTextStroke: "3px #14210e", paintOrder: "stroke", textShadow: "1px 2px 0 rgba(0,0,0,0.5)" } as React.CSSProperties;
  return (
    <div className="text-center leading-[0.9] select-none">
      <div className="font-[family-name:var(--font-bat-varsity)] font-bold text-white" style={{ ...style, fontSize: size }}>{top}</div>
      {bottom && <div className="font-[family-name:var(--font-bat-varsity)] font-bold text-white" style={{ ...style, fontSize: size * 0.8 }}>{bottom}</div>}
    </div>
  );
}

/** Width of the strip along a section's edge that holds its arrow. The
 *  content box stops at the gutter, so the arrow never overlaps the board. */
// Leaderboard row fills: G red, H orange, T purple.
const MOBILE_LB_ROW_BG: Record<"G" | "H" | "T", string> = {
  G: "linear-gradient(to bottom, #fca5a5 0%, #ef4444 48%, #b91c1c 100%)",
  H: "linear-gradient(to bottom, #fdba74 0%, #f97316 48%, #c2410c 100%)",
  T: "linear-gradient(to bottom, #d8b4fe 0%, #a855f7 48%, #7e22ce 100%)",
};
const GUTTER = 34;

type Dir = "left" | "right" | "up" | "down";
const ARROW_ICON: Record<Dir, React.ElementType> = { left: ChevronLeft, right: ChevronRight, up: ChevronUp, down: ChevronDown };
const ARROW_POS: Record<Dir, string> = {
  right: "right-0 top-1/2 -translate-y-1/2 h-20",
  left: "left-0 top-1/2 -translate-y-1/2 h-20",
  down: "bottom-0 left-1/2 -translate-x-1/2 w-20",
  up: "top-0 left-1/2 -translate-x-1/2 w-20",
};

/* A section's way out: a solid white arrow button centred along its edge.
   `shift` nudges it off centre along that edge (e.g. "-10%" = 10% of the
   screen up/left), to park it where nothing on the board sits. */
function Arrow({ dir, to, shift, onClick }: { dir: Dir; to: string; shift?: string; onClick: () => void }) {
  const Icon = ARROW_ICON[dir];
  const vertical = dir === "up" || dir === "down";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Go ${dir} to Section ${to}`}
      className={cn("absolute z-30 flex items-center justify-center", ARROW_POS[dir])}
      style={
        vertical
          ? { height: GUTTER, ...(shift ? { left: `calc(50% + ${shift})` } : {}) }
          : { width: GUTTER, ...(shift ? { top: `calc(50% + ${shift})` } : {}) }
      }
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-[0_2px_6px_rgba(0,0,0,0.6)] ring-2 ring-black/60 active:bg-yellow-300">
        <Icon className="h-5 w-5" strokeWidth={3} />
      </span>
    </button>
  );
}

/* Bottom sheet for every tap-to-see-details interaction. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    // Portrait: a bottom sheet. Landscape (short screen): a centred card that
    // fits inside the viewport and scrolls within itself.
    <div className="fixed inset-0 z-[9999] flex items-end landscape:items-center landscape:justify-center landscape:p-2 bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-h-[80vh] landscape:max-w-[640px] landscape:max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-2xl landscape:rounded-2xl bg-[#13131f] border-t landscape:border border-white/15 px-4 pt-3 pb-6 landscape:pb-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between mb-3">
          <div className="text-white font-bold text-base">{title}</div>
          <button onClick={onClose} className="p-1 text-white/50 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function BoardMobileSections({ board, highlightPosition, canInvite, myPosition, myUserId, mySalesCredits, pendingPlacements }: {
  board: BoardData;
  highlightPosition?: string;
  isAdmin?: boolean;
  canInvite?: boolean;
  myPosition?: string | null;
  myUserId?: string;
  mySalesCredits?: number | null;
  pendingPlacements?: PendingPlacement[];
}) {
  const [openModal, setOpenModal] = useState<ModalKey>(null);
  const [invitePos, setInvitePos] = useState<{ position: string; posLabel: string } | null>(null);
  const [dugoutDetail, setDugoutDetail] = useState<SlotData | null>(null);
  const [showAllDugout, setShowAllDugout] = useState(false);
  const [dugoutSearch, setDugoutSearch] = useState("");
  const [podDetail, setPodDetail] = useState<{ index: number; occupant: PodOccupant } | null>(null);
  const [podTeamPopup, setPodTeamPopup] = useState<{ teamId: string; loading: boolean; members: PodTeamMember[] } | null>(null);
  // "More" opens the full Hot Box list in a popup (the box itself always shows the first 4).
  const [showHotBox, setShowHotBox] = useState(false);
  // Inside the Hot Box popup, More/Less expands the list like the desktop box does.
  const [hotBoxAll, setHotBoxAll] = useState(false);
  const [hotBoxDetail, setHotBoxDetail] = useState<(HotBoxEntry & { ct: string }) | null>(null);
  // Tapped board position (Home Plate, a base, an AT BAT) → its details popup.
  const [slotPopup, setSlotPopup] = useState<{ label: string; designWidth: number; heightRatio: number; node: React.ReactNode } | null>(null);
  // Tapped Game Clock → enlarged clock.
  const [showClock, setShowClock] = useState(false);
  // Which leaderboard tier is open in the enlarged popup (tap its G/H/T button).
  const [lbPopup, setLbPopup] = useState<"G" | "H" | "T" | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // A board opens as an overview of all four sections with A/B/C/D buttons;
  // tapping one opens that section full size.
  const [view, setView] = useState<"overview" | "sections">("overview");
  const pendingCell = useRef<{ col: number; row: number } | null>(null);
  const router = useRouter();
  // Close the board: back to wherever the player came from, else the boards list.
  const closeBoard = () => { if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push("/games/bat246/boards"); };
  const related = useRelatedTracking(board);
  const close = () => setOpenModal(null);

  // The sections are designed for a phone held sideways. Where the browser
  // allows it (Android Chrome in fullscreen/installed app) lock to landscape;
  // everywhere else (iOS, normal tabs) the "rotate your phone" cover below
  // asks the user to turn the phone. Failure is expected and harmless.
  useEffect(() => {
    const o = typeof screen !== "undefined" ? (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }) : undefined;
    o?.lock?.("landscape")?.catch(() => {});
    return () => { try { o?.unlock?.(); } catch { /* not supported */ } };
  }, []);

  // A new board always opens on Section A (top-left cell).
  useEffect(() => { scrollerRef.current?.scrollTo({ left: 0, top: 0 }); setView("overview"); }, [board._id]);

  // Once the grid is at full size (or back at overview size) jump to the cell
  // that was asked for, with no animation.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (view === "overview") { el.scrollTo({ left: 0, top: 0 }); return; }
    const cell = pendingCell.current;
    if (cell) { el.scrollTo({ left: cell.col * el.clientWidth, top: cell.row * el.clientHeight }); pendingCell.current = null; }
  }, [view]);

  const openSection = (col: 0 | 1, row: 0 | 1) => { pendingCell.current = { col, row }; setView("sections"); };

  // Scroll the 2×2 grid to a cell.
  const goTo = (col: 0 | 1, row: 0 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: col * el.clientWidth, top: row * el.clientHeight, behavior: "smooth" });
  };

  const openPodTeamPopup = (teamId: string) => {
    setPodTeamPopup({ teamId, loading: true, members: [] });
    fetch(`${API}/bat246/pod-team/${teamId}`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then((r) => r.json())
      .then((d) => setPodTeamPopup({ teamId, loading: false, members: d.members ?? [] }))
      .catch(() => setPodTeamPopup({ teamId, loading: false, members: [] }));
  };

  const isPostPP = Date.now() > new Date(board.protectionPeriodEnd).getTime();
  const familyPrefix = board.trackingNumber.split("-")[0].trim();
  const podOccupants = (board.pod ?? []).map(slotToPodOccupant);
  // Same invite-link rules as the desktop layout.
  const hidePreservePosition = !!myPosition && (
    ["homePlate", "thirdBase", "secondBaseA", "secondBaseB"].includes(myPosition) || myPosition.startsWith("atBat-")
  );
  const disablePreservePosition = mySalesCredits === 0;

  const hotBoxRows = (["Gold", "Black", "Brown", "Gray"] as const).flatMap((ct) =>
    board.hotBox.filter((h) => h.cardType === ct).map((e) => ({ ...e, ct })),
  );
  const hotBoxVisible = hotBoxRows.slice(0, 4);
  const hotBoxHasMore = hotBoxRows.length > 4;
  const dugoutOverflow = Math.max(0, board.dugout.length - 8);
  const dugoutFiltered = board.dugout.filter((s) => s?.playerName?.toLowerCase().includes(dugoutSearch.toLowerCase()));

  /* ── pieces ─────────────────────────────────────────────────────────── */

  const childChip = (id: string | null | undefined, side: "L" | "R") => {
    // Taller than the two pills beside them — they reach 8px down into the
    // gap under the row (which is otherwise blank), so the row itself, and
    // everything below it, doesn't move.
    const cls = "flex-1 landscape:flex-[0_1_25.65%] min-w-0 h-[52px] flex items-center justify-center rounded-md bg-green-500 border-[3px] border-blue-500 px-1 text-black font-bold text-[17px] landscape:text-[32px] leading-none whitespace-pre truncate";
    return id ? (
      <Link href={`/games/bat246/${id}`} className={cn(cls, "active:bg-green-400")}>{related[id]?.replace("-", " - ") ?? "…"}</Link>
    ) : (
      <div className={cn(cls, "cursor-default select-none")}>{`${familyPrefix} -      ${side}`}</div>
    );
  };

  /* Tapping a position card opens a popup with everything about its player.
     Taps on the card's own buttons (green cards, WARP, Invite…) are left
     alone, and so are clicks that bubble up from a portaled card modal. */
  const tap = (label: string, slot: SlotData | null, node: React.ReactNode, big: { designWidth: number; heightRatio: number; node: React.ReactNode }) => (
    <div
      className={slot ? "cursor-pointer" : undefined}
      onClick={(e) => {
        if (!slot || !e.currentTarget.contains(e.target as Node)) return;
        if ((e.target as HTMLElement).closest("button,a")) return;
        setSlotPopup({ label, ...big });
      }}
    >
      {node}
    </div>
  );

  const field = (label: string, slot: SlotData | null, key: string, designWidth: number, minHeight: number, className?: string, maxScale?: number) =>
    tap(
      label,
      slot,
      <FitCard designWidth={designWidth} className={className} maxScale={maxScale}>
        <BaseCard label={label} slot={slot} isHighlighted={highlightPosition === key} minHeight={minHeight} cardsScale={FIELD_CARDS_SCALE} mobileCompact />
      </FitCard>,
      { designWidth, heightRatio: 1.27, node: <BaseCard label={label} slot={slot} minHeight={minHeight} cardsScale={FIELD_CARDS_SCALE} /> },
    );

  const atBat = (i: number) => {
    const position = `atBat-${i}`;
    const slot = board.atBat[i] ?? null;
    const pending = pendingPlacements?.find((p) => p.position === position);
    let invite: React.ReactNode = null;
    if (canInvite && pending) {
      const remaining = Math.max(0, new Date(pending.expiresAt).getTime() - Date.now());
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const timeStr = remaining <= 0 ? "Expired" : h > 0 ? `${h}h ${m}m` : `${m}m`;
      invite = (
        <div className="mt-0.5 text-center leading-tight">
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/40 rounded px-1.5 py-px"><Clock className="w-2.5 h-2.5" /> Pending · {timeStr}</div>
          <div className="text-[10px] text-white/70 truncate">{pending.userName || pending.userEmail}</div>
        </div>
      );
    } else if (canInvite && !slot?.playerId) {
      invite = (
        <button onClick={() => setInvitePos({ position, posLabel: AT_BAT_LABELS[position] })} className="mt-0.5 mx-auto flex items-center gap-1 text-[12px] font-semibold text-white bg-blue-600/80 active:bg-blue-500 border border-blue-400/50 rounded px-2.5 py-0.5">
          <Link2 className="w-3 h-3" /> Invite
        </button>
      );
    }
    return (
      <div key={i} className="flex flex-col min-w-0">
        {tap(
          AT_BAT_LABELS[position],
          slot,
          <FitCard designWidth={DESIGN.atBat}>
            <div className="flex flex-col">
              <PosLabel text={`AB${i + 1}`} />
              <Slot slot={slot} isHighlighted={highlightPosition === position} mobileCompact />
            </div>
          </FitCard>,
          { designWidth: DESIGN.atBat, heightRatio: 1.45, node: <div className="flex flex-col"><PosLabel text={`AB${i + 1}`} /><Slot slot={slot} /></div> },
        )}
        {invite}
      </div>
    );
  };

  const LB_TIER_NAME: Record<"G" | "H" | "T", string> = { G: "Grand Slam", H: "Home Run", T: "Triple" };

  /* One leaderboard bar. The G/H/T block is a button that opens the bar
     enlarged in a popup (`big` = that enlarged rendering: same bar, every
     size roughly doubled, block no longer clickable). */
  const lbRow = (tier: "G" | "H" | "T", big = false) => {
    const row = board.leaderBoard.find((r) => r.tier === tier);
    const hasPlayer = !!row?.playerName;
    const ce = (row?.cardsEarned ?? null) as Record<string, number> | null;
    const pid = row?.playerId ?? undefined;
    const cardSize = big ? "md" : "sm";
    return (
      <div
        key={tier}
        className={cn("relative flex items-center rounded-md pl-[2px] py-0 border border-amber-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_3px_rgba(0,0,0,0.45)]", big ? "gap-4 pr-[0.5px]" : "gap-2.5 pr-2.5", !hasPlayer && !big && "opacity-90")}
        style={{ background: MOBILE_LB_ROW_BG[tier] }}
      >
        {/* Tier block — a raised button (3D shadow, presses down on tap). It
            fills the bar's full height and opens the enlarged popup. Same
            size in the popup: the extra room there goes to the player's
            flags, name and cards, not to the block. */}
        <button
          type="button"
          disabled={big}
          onClick={big ? undefined : () => setLbPopup(tier)}
          aria-label={`Show the ${LB_TIER_NAME[tier]} row enlarged`}
          className={cn(
            big ? cn("my-[1px] h-[57px] gap-[0.5px] pl-[2px]", tier === "H" ? "w-[91px]" : tier === "T" ? "w-[82px]" : "w-[77px]") : "my-[1px] h-[57px] w-[111px] gap-1.5",
            " flex-shrink-0 rounded-md flex items-center overflow-hidden border-2 border-[#6b3f12]/70 transition-transform",
            !big && "justify-center cursor-pointer shadow-[0_3px_0_#9a6436,0_4px_8px_rgba(0,0,0,0.45)] active:translate-y-[3px] active:shadow-none",
          )}
          style={{ background: "linear-gradient(to bottom, #ffe6cc 0%, #f6c08f 100%)" }}
        >
          <span className={"w-[42px] h-[48px] flex-shrink-0"} style={{ transform: "scaleY(1.3)" }}>{LB_ICON[tier]}</span>
          <span className={cn("font-extrabold leading-none text-[44px]", big && (tier === "H" ? "ml-[4px]" : tier === "T" ? "-ml-[4px]" : "-ml-[8px]"))} style={{ color: LB_COLOR[tier], WebkitTextStroke: "1.2px #000" }}>{tier}</span>
        </button>
        {hasPlayer && (row?.countryResidence || row?.countryOrigin) && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {row?.countryResidence && <FlagIcon value={row.countryResidence} className={big ? "w-[40px] h-[30px]" : "w-[26px] h-[19px]"} />}
            {row?.countryOrigin && <FlagIcon value={row.countryOrigin} className={big ? "w-[40px] h-[30px]" : "w-[26px] h-[19px]"} />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {!hasPlayer && big && <span className="block truncate text-[24px] font-semibold text-white/85">No one holds this level yet</span>}
          {hasPlayer && (
            <span className={cn("block text-white font-bold truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]", big ? "text-[28px]" : "text-[18px]")}>
              {row!.playerName?.trim().split(/\s+/)[0]?.slice(0, 10)}
              {row!.distributorId && <>-{row!.distributorId.slice(0, 8)}</>}
              {row!.entryNo && <>-{String(row!.entryNo).slice(0, 2)}</>}
            </span>
          )}
        </div>
        {hasPlayer && ce && (
          <div className={cn("flex items-center flex-shrink-0", big ? "gap-1" : "gap-[2px]")}>
            {(ce.gold ?? 0) > 0 && <StackedCard type="gold" count={1} size={cardSize} playerId={pid} trigger="click" />}
            {(ce.green ?? 0) > 0 && (
              <div className={cn("inline-flex items-center rounded-[2px] bg-white border border-[#3b82f6]", big ? "gap-1 px-1 py-[2px]" : "gap-[2px] px-[2px] py-[1px]")}>
                {Array.from({ length: ce.green }).map((_, i) => <StackedCard key={i} type="green" count={1} size={cardSize} playerId={pid} trigger="click" eventIndex={i} />)}
              </div>
            )}
            {(ce.gold ?? 0) > 1 && <StackedCard type="gold" count={ce.gold - 1} size={cardSize} playerId={pid} trigger="click" overlayCount />}
            {(ce.black ?? 0) > 0 && <StackedCard type="black" count={ce.black} size={cardSize} playerId={pid} trigger="click" overlayCount />}
            {(ce.brown ?? 0) > 0 && <StackedCard type="brown" count={ce.brown} size={cardSize} playerId={pid} trigger="click" overlayCount />}
          </div>
        )}
        <span className={cn("flex-shrink-0 font-extrabold tabular-nums leading-none", big ? "text-[20px]" : "text-[21px]")} style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>({LB_CARD_MAX[tier]})</span>
      </div>
    );
  };

  const leaderboard = (
    <div className="flex flex-col gap-2">
      <div className="landscape:hidden text-center font-[family-name:var(--font-bat-display)] text-[24px] tracking-[0.18em] uppercase font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)] leading-none">Leaderboard</div>
      {/* Solid backing so the stadium photo only starts below the T row. */}
      <div className="relative z-20 -mx-[2px] flex flex-col gap-[18px] landscape:gap-[32px] bg-[linear-gradient(100deg,#0a2c6b_0%,#0d3f86_38%,#0f5a6e_70%,#11744a_100%)] px-[2px] py-1.5 landscape:border-b-[3px] landscape:border-black landscape:shadow-[0_1.5px_0_rgba(255,255,255,0.85)]">
        {(["G", "H", "T"] as const).map((tier) => lbRow(tier))}
      </div>
    </div>
  );

  /* Enlarged leaderboard row — opened from a G/H/T button. The bar itself
     at roughly double size (scaled to the screen if it has to be), plus the
     row's details written out underneath so they're readable on any phone. */
  /* A tapped board position, enlarged: the same card as on the board (with
     its date and time), scaled up to fit the screen. */
  const slotPopupEl = slotPopup && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-3" onClick={() => setSlotPopup(null)}>
      <div className="relative pl-[30px]" style={{ width: `min(94vw, calc(100dvh * ${slotPopup.heightRatio}))` }} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setSlotPopup(null)} className="absolute -top-2 right-0 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/60 bg-black/70 text-white" aria-label="Close"><X className="h-5 w-5" strokeWidth={3} /></button>
        <FitCard designWidth={slotPopup.designWidth} maxScale={4}>{slotPopup.node}</FitCard>
      </div>
    </div>
  );

  const lbPopupEl = lbPopup && (() => {
    const row = board.leaderBoard.find((r) => r.tier === lbPopup);
    const ce = (row?.cardsEarned ?? null) as Record<string, number> | null;
    const gray = ce ? ((ce.freeGray ?? 0) + (ce.gray160 ?? 0)) || (ce.gray ?? 0) : 0;
    const cards = ce
      ? ([["Gold", ce.gold], ["Green", ce.green], ["Black", ce.black], ["Brown", ce.brown], ["Gray", gray]] as const)
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([name, n]) => `${n} ${name}`)
          .join(" · ")
      : "";
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-1" onClick={() => setLbPopup(null)}>
        <div className="w-full max-w-[calc(100vw-0.5rem)] max-h-[calc(100dvh-0.5rem)] overflow-y-auto rounded-2xl bg-[#13131f] border border-white/15 p-2 landscape:px-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-white font-bold text-[28px] leading-tight">
              {LB_TIER_NAME[lbPopup]} <span className="text-white/50 font-semibold">({lbPopup})</span>
            </div>
            <button onClick={() => setLbPopup(null)} className="p-1 text-white/60 hover:text-white" aria-label="Close"><X className="w-6 h-6" /></button>
          </div>
          <FitCard designWidth={520} maxScale={1.7}>{lbRow(lbPopup, true)}</FitCard>
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[16px] leading-snug">
            {row?.playerName ? (
              <>
                <span className="text-white/50">Player</span>
                <span className="text-white font-semibold">{row.playerName}</span>
                <span className="text-white/50">Id</span>
                <span className="text-white font-semibold">{row.distributorId ?? "—"}{row.entryNo ? ` - ${row.entryNo}` : ""}</span>
                {cards && (<><span className="text-white/50">Cards</span><span className="text-white font-semibold">{cards}</span></>)}
                {row.qualifiedAt && (<><span className="text-white/50">Qualified</span><span className="text-white font-semibold">{fmtDate(row.qualifiedAt)}</span></>)}
              </>
            ) : null}
            <span className="text-white/50">Max cards</span>
            <span className="text-white font-semibold">{LB_CARD_MAX[lbPopup]}</span>
          </div>
        </div>
      </div>
    );
  })();

  const tiles = (
    <div className="flex flex-col landscape:flex-1 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.5)] px-3 landscape:px-1.5 landscape:rounded-none landscape:relative landscape:z-10 landscape:-mr-[3px] landscape:border-b-[3px] landscape:border-black landscape:shadow-[0_1.5px_0_rgba(255,255,255,0.85)] pt-2 pb-2.5" style={{ background: "linear-gradient(100deg, #0a2c6b 0%, #0d3f86 38%, #0f5a6e 70%, #11744a 100%)" }}>
      <div className="flex items-center justify-center gap-2 mb-2 landscape:flex-1 landscape:mb-1 landscape:gap-3">
        <span className="text-[17px] landscape:text-[34px] font-bold uppercase tracking-[0.2em] font-[family-name:var(--font-bat-display)] leading-none text-black" style={{ WebkitTextStroke: "2px #fff", paintOrder: "stroke", textShadow: "1px 2px 0 rgba(0,0,0,0.5)" }}>Board {board.trackingNumber?.replace(/\s*[LR]$/, "")}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/bat246-text-logo.png" alt="BAT 246" className="h-[26px] landscape:h-[50px] w-auto" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }} draggable={false} />
        {board.warpCount > 0 && (
          <span className="px-1.5 py-0.5 rounded border border-amber-300/50 text-[10px] font-bold tracking-wider" style={{ background: "linear-gradient(to bottom, #7c3aed, #5b21b6)" }}>WARP-{board.warpCount}</span>
        )}
      </div>
      {/* Tiles capped at ~100px so a wide (landscape) screen doesn't blow
          them up into two tall rows. */}
      <div className="mx-auto grid max-w-[440px] grid-cols-4 gap-x-2 landscape:gap-x-1 gap-y-2 landscape:max-w-none landscape:gap-y-3">
        {BUTTONS.map(({ key, label, num, imgSrc }) => (
          <button key={num} onClick={() => setOpenModal(key)} className="block p-0 bg-transparent active:opacity-60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt={label.replace(/\n/g, " ")} className="w-full h-auto aspect-[90/54] landscape:aspect-[90/57] object-fill" style={{ filter: "sepia(0.35)" }} draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );

  const pod = (
    <div className="relative mx-auto w-full select-none" style={{ aspectRatio: `${POD_ART_W} / ${POD_ART_H}`, containerType: "size" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/Pod-New.svg" alt="POD" className="block w-full h-full" draggable={false} />
      {POD_WINDOWS.map((w, i) => {
        const occupant = podOccupants[i];
        return (
          <div key={i} className="absolute" style={{ left: `${(w.x / POD_ART_W) * 100}%`, top: `calc(${(w.y / POD_ART_H) * 100}% + ${i === 0 ? "-0.5%" : i === 1 ? "0%" : i === 3 ? "-3.1%" : i === 2 ? "2.6%" : "1%"})`, width: `${(w.w / POD_ART_W) * 100}%`, height: `${(w.h / POD_ART_H) * 100}%` }}>
            {occupant && (
              <div className="absolute inset-[3%] rounded bg-white/85 text-[#12203a] px-1 flex flex-col justify-center overflow-hidden leading-[1.15] font-extrabold whitespace-nowrap" style={{ fontSize: "clamp(6px, 2.4cqh, 11px)" }}>
                <span className="truncate">{occupant.name}</span>
                <span className="truncate">{occupant.id}{occupant.entry ? ` - ${occupant.entry}` : ""}</span>
                <span className="truncate">D: {occupant.date}</span>
                <span className="truncate">T: {occupant.time}</span>
              </div>
            )}
            <button
              className="absolute -top-2 -right-2 flex items-center justify-center rounded-[3px] border border-black bg-[#9ca3af] text-black font-extrabold leading-none shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
              style={{ width: "clamp(24px, 8.5cqh, 36px)", height: "clamp(24px, 8.5cqh, 36px)", fontSize: "clamp(13px, 4.4cqh, 19px)" }}
              onClick={() => occupant && setPodDetail({ index: i, occupant })}
            >
              {i + 1}
            </button>
          </div>
        );
      })}
      {board.podTeamId && (
        <div className="absolute left-1/2 -translate-x-1/2 bg-white/75 rounded px-2 py-0.5" style={{ top: "88%" }}>
          <span className="font-extrabold text-[#12203a] whitespace-nowrap" style={{ fontSize: "clamp(14px, 6cqh, 26px)" }}>{board.podTeamId}</span>
        </div>
      )}
    </div>
  );

  const dugout = (
    <div className="flex flex-col">
      {/* Landscape: the logo moves out to the right of the box, freeing its height for the dugout. */}
      <div className="landscape:absolute landscape:left-full landscape:top-[64px] landscape:ml-[78px] landscape:w-max"><Varsity top="MINOR" bottom="LEAGUE" size={22.7} /></div>
      <div className="mt-1.5 landscape:mt-0 rounded-lg p-1.5" style={{ backgroundImage: "url(/images/bat246-dugout-bg.jpg)", backgroundSize: "80px 80px", boxShadow: "0 0 0 5px #000, 0 0 0 6px #fff" }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://media.tenor.com/tDau9a7i5hwAAAAj/alert-siren.gif" alt="Siren" className="w-5 h-5 object-contain flex-shrink-0" style={{ visibility: board.status === "split" ? "hidden" : "visible" }} />
          <button
            onClick={() => dugoutOverflow > 0 && setShowAllDugout(true)}
            className="flex-1 min-w-0 rounded-full bg-gradient-to-b from-[#f7baa7] to-[#df7a5d] border border-white/60 py-1 landscape:py-0 landscape:h-[18px] landscape:flex landscape:items-center landscape:justify-center text-center leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.5)]"
            style={{ cursor: dugoutOverflow > 0 ? "pointer" : "default" }}
          >
            <span className="text-[10px] landscape:text-[15px] font-bold text-[#3a160c] tracking-wide">{dugoutOverflow > 0 ? `+${dugoutOverflow} more` : "Overflow"}</span>
          </button>
        </div>
        <div className="rounded-[4px] overflow-hidden border-t-2 border-b-2 border-black shadow-[0_4px_10px_rgba(0,0,0,0.55)]" style={{ backgroundColor: "#b7bac0", backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 16%, rgba(0,0,0,0.12) 100%), repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0.022) 1px 2.5px)" }}>
          {Array.from({ length: 8 }, (_, i) => board.dugout[7 - i] ?? null).map((slot, i) => {
            const num = 8 - i;
            const letter = i <= 5 ? "DUGOUT"[i] : "";
            return (
              <div
                key={i}
                onClick={slot ? () => setDugoutDetail(slot) : undefined}
                className={cn("relative flex items-center h-[32px] landscape:h-[32px] border-b border-black/30 last:border-b-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] overflow-hidden", i % 2 === 0 ? "bg-white/[0.06]" : "bg-black/[0.05]", slot && "active:bg-amber-100/25")}
              >
                <span className="absolute top-[2px] left-[3px] text-[11px] landscape:text-[19px] font-bold text-black/50 leading-none">{num}</span>
                {letter && (
                  <span className="absolute right-1.5 font-[family-name:var(--font-bat-varsity)] text-[14px] landscape:text-[25px] font-extrabold leading-none select-none pointer-events-none" style={{ color: "#fff", WebkitTextStroke: "2.5px #000", paintOrder: "stroke" }}>{letter}</span>
                )}
                <span className={cn("flex-1 pl-3.5 landscape:pl-[24px] pr-6 landscape:pr-[34px] text-[13px] landscape:text-[17px] font-extrabold truncate leading-tight [text-shadow:0_1px_0_rgba(255,255,255,0.35)]", slot?.podTeamId ? "text-blue-900 underline decoration-dotted" : "text-[#15171c]")}>
                  {slot?.podTeamId ?? firstNameInitial(slot?.playerName)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* The Hot Box panel itself. `rows` = what to list (the board shows the
     first 4 + a More button; the popup lists everyone, no button). */
  const hotBoxPanel = (rows: typeof hotBoxRows, inPopup: boolean) => (
    <div className="flex flex-col rounded-xl border-2 border-black/80 shadow-[0_4px_12px_rgba(0,0,0,0.55)] overflow-hidden">
      <div style={{ background: "linear-gradient(180deg, #f5d21a 0%, #f0a81e 38%, #e2601c 68%, #d2281c 100%)" }}>
        <div className="text-center border-b-2 border-black/70 py-[3px]" style={{ background: "linear-gradient(180deg, #f8e25a, #e9bc12)" }}>
          <span className="font-[family-name:var(--font-bat-varsity)] text-[26px] font-black text-black leading-none w-full block" style={{ textShadow: "0 1px 0 rgba(255,255,255,0.4)", WebkitTextStroke: "0.5px black", paintOrder: "stroke fill", letterSpacing: "5px" }}>HOT BOX</span>
        </div>
        {[...rows, ...Array(Math.max(0, 4 - rows.length)).fill(null)].map((entry, i) => (
          <div key={i} className="flex items-center gap-2 px-2.5 py-[1px] border-b border-black/40 last:border-b-0" onClick={entry ? (e) => { e.stopPropagation(); setHotBoxDetail(entry); } : undefined}>
            {entry ? (
              <>
                <CardCase cards={[entry.ct.toLowerCase() as MiniCardType]} size="md" frame="earned" stack playerId={entry.playerId} trigger="click" />
                <span className="text-[12.5px] font-extrabold truncate leading-tight text-[#1a0f04]">{firstNameInitial(entry.playerName)}</span>
              </>
            ) : <span className="block h-[35px]" />}
          </div>
        ))}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); if (!hotBoxHasMore) return; if (inPopup) setHotBoxAll((v) => !v); else { setHotBoxAll(false); setShowHotBox(true); } }}
        className={cn("w-full py-[5px] text-[13px] font-extrabold tracking-wide uppercase border-t border-black/50 bg-white", hotBoxHasMore ? "text-black" : "text-black/70 cursor-default")}
      >
        {inPopup && hotBoxAll ? "Less ▲" : `More (${Math.max(0, hotBoxRows.length - 4)}) ▼`}
      </button>
    </div>
  );
  const hotBox = (
    <div className="cursor-pointer" onClick={() => setShowHotBox(true)}>
      <FitCard designWidth={DESIGN.hotBox}>{hotBoxPanel(hotBoxVisible, false)}</FitCard>
    </div>
  );

  const clockEl = (maxScale: number) => (
    <FitCard designWidth={DESIGN.clock} maxScale={maxScale}>
      {board.status === "split" && board.splitAt ? (
        <GameClock targetDate={new Date(board.protectionPeriodEnd)} pausedRemainingMs={Math.max(0, new Date(board.protectionPeriodEnd).getTime() - new Date(board.splitAt).getTime())} stopped />
      ) : (
        <GameClock targetDate={new Date(board.protectionPeriodEnd)} pausedRemainingMs={board.ppPausedRemainingMs} />
      )}
    </FitCard>
  );
  const clock = clockEl(1.01);
  // Same clock, unscaled — FitFill sizes it.
  const clockPlain = board.status === "split" && board.splitAt ? (
    <GameClock targetDate={new Date(board.protectionPeriodEnd)} pausedRemainingMs={Math.max(0, new Date(board.protectionPeriodEnd).getTime() - new Date(board.splitAt).getTime())} stopped />
  ) : (
    <GameClock targetDate={new Date(board.protectionPeriodEnd)} pausedRemainingMs={board.ppPausedRemainingMs} />
  );

  /* ── the four sections ─────────────────────────────────────────────── */

  const sections: React.ReactNode[] = [
    // ── A ── one nav row, Leaderboard, Home Plate
    <div key="A" className="flex flex-col gap-2.5">
      <div className="flex items-start gap-2 landscape:gap-3 h-11 [container-type:inline-size]">
        {childChip(board.leftChildBoardId, "L")}
        <Link href="/games/bat246/boards" className="flex h-[52px] w-[92px] landscape:w-[150px] items-center justify-center rounded-full bg-yellow-400 active:bg-yellow-300 border-2 border-black text-[19px] landscape:text-[30px] font-bold text-black">Boards</Link>
        {/* Landscape: the "Leaderboard" heading lives here, between the two
            pills, which frees its old line for the rows below. */}
        <span className="hidden landscape:flex h-11 landscape:flex-[1_0_auto] items-center justify-center whitespace-nowrap font-[family-name:var(--font-bat-display)] text-[clamp(14px,3.3cqw,44px)] tracking-[0.02em] uppercase font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)] leading-none">Leaderboard</span>
        <Link href="/games/bat246" title="BAT 246 Dashboard" className="flex h-[52px] w-[92px] landscape:w-[150px] items-center justify-center rounded-full bg-blue-500 active:bg-blue-400 border-2 border-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/bat246-text-logo.png" alt="BAT 246" className="h-6 landscape:h-[38px] w-auto" draggable={false} />
        </Link>
        {childChip(board.rightChildBoardId, "R")}
      </div>
      {leaderboard}
      {/* Shifted 10% of the screen left of centre, as on the desktop board
          where Home Plate sits left of the diamond's axis. Allowed to grow
          past desktop size (maxScale) — it's the one thing on this screen
          with room around it. (Founder-tuned size; the text inside scales
          with the card.) */}
      <div className="relative left-[-10%] mx-auto w-[84%] max-w-[400px] pt-1 landscape:-mt-[72px]">
        {tap(
          "Home Plate",
          board.homePlate,
          <FitCard designWidth={DESIGN.homePlate} maxScale={1.6}>
            <HomePlateCard slot={board.homePlate} isHighlighted={highlightPosition === "homePlate"} mobileCompact />
          </FitCard>,
          { designWidth: DESIGN.homePlate, heightRatio: 0.88, node: <HomePlateCard slot={board.homePlate} /> },
        )}
      </div>
    </div>,

    // ── B ── tiles, 3rd Base under them, POD (POD to the right in landscape)
    // In landscape the left column fills the section's height: tiles on top,
    // 3rd Base pinned to the bottom (2px from the screen end).
    <div key="B" className="flex flex-1 flex-col gap-3 landscape:gap-0 landscape:flex-row landscape:items-stretch">
      <div className="flex flex-col gap-3 landscape:gap-[1px] landscape:flex-1 landscape:min-w-0">
        {tiles}
        <div className="mx-auto w-[74%] max-w-[300px]">{field("3rd Base", board.thirdBase, "thirdBase", DESIGN.thirdBase, 131)}</div>
      </div>
      <div className="mx-auto w-full max-w-[400px] landscape:w-[43%] landscape:max-w-none landscape:self-start landscape:border-b-[3px] landscape:border-l-[3px] landscape:border-black landscape:shadow-[0_1.5px_0_rgba(255,255,255,0.85),-1.5px_0_0_rgba(255,255,255,0.85)]">{pod}</div>
    </div>,

    // ── C ── Dugout + 2nd Base A, 1st Base A/B, AT BAT 1–4
    <div key="C" className="flex flex-col gap-2.5">
      {/* Portrait layout (unchanged). */}
      <div className="flex flex-col gap-2.5 landscape:hidden">
        <div className="flex gap-3 items-start">
          <div className="w-[140px] flex-shrink-0">{dugout}</div>
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            <div className="mx-auto w-full max-w-[260px] pt-7">{field("2nd Base A", board.secondBaseA, "secondBaseA", DESIGN.secondBase, 140)}</div>
          </div>
        </div>
        {/* BaseCard hangs its WARP tab ~26px off a 1st Base card's LEFT edge —
            the grid leaves that room. */}
        <div className="grid grid-cols-2 gap-x-6 pl-6">
          {field("1st Base A", board.firstBase[0] ?? null, "1stA", DESIGN.firstBase, 143)}
          {field("1st Base B", board.firstBase[1] ?? null, "1stB", DESIGN.firstBase, 143)}
        </div>
        <div className="grid grid-cols-2 gap-2.5">{[0, 1, 2, 3].map(atBat)}</div>
      </div>
      {/* Landscape: dugout pinned top-left; 2nd Base A big and centred on the
          screen; 1st Base A/B centred 4px under it; AT BAT 1–4 across the full
          width underneath. */}
      <div className="hidden landscape:block">
        {/* Dugout column and an equal empty column either side of the centre,
            so the centre stays on the screen's middle — and the dugout is part
            of the flow, so it can never reach down into AT BAT 1. */}
        <div className="grid grid-cols-[190px_1fr_190px]">
          <div className="relative pt-[3px]">{dugout}</div>
          <div className="relative left-[8%]">
            <div className="mx-auto w-[39%]">{field("2nd Base A", board.secondBaseA, "secondBaseA", DESIGN.secondBase, 140)}</div>
            {/* Same width as 2nd Base A, with room between them for B's WARP tab. */}
            <div className="mx-auto mt-1 flex justify-center gap-[9%]">
              <div className="w-[39%]">{field("1st Base A", board.firstBase[0] ?? null, "1stA", DESIGN.firstBase, 143)}</div>
              <div className="w-[39%]">{field("1st Base B", board.firstBase[1] ?? null, "1stB", DESIGN.firstBase, 143)}</div>
            </div>
          </div>
          <div />
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-2.5">{[0, 1, 2, 3].map(atBat)}</div>
      </div>
      {board.parentBoardId && (
        <Link href={`/games/bat246/${board.parentBoardId}`} className="mx-auto flex w-full max-w-[260px] items-center justify-center rounded-md bg-[#b83838] active:bg-[#cd5555] border-[3px] border-black py-1 text-black font-bold text-[16px] leading-none">
          Previous {related[board.parentBoardId]?.replace(/\s+[LR]$/, "") ?? "…"}
        </Link>
      )}
    </div>,

    // ── D ── Hot Box top-right beside 2nd Base B, 1st C/D + Clock, AT BAT 5–8
    <div key="D" className="flex flex-col gap-2.5">
      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="mx-auto w-full max-w-[260px] pt-5 landscape:hidden">{field("2nd Base B", board.secondBaseB, "secondBaseB", DESIGN.secondBase, 140)}</div>
          {/* Landscape: 2nd Base B, 1st Base C and 1st Base D are one width; C/D sit
              4px under B, with B centred over the pair. */}
          <div className="hidden landscape:block mx-auto w-[33%]">{field("2nd Base B", board.secondBaseB, "secondBaseB", DESIGN.secondBase, 140)}</div>
          {/* Landscape: 1st C / 1st D / Clock row sits beside the Hot Box. */}
          <div className="hidden landscape:flex justify-center gap-[8%] -mt-1.5">
            <div className="w-[33%]">{field("1st Base C", board.firstBase[2] ?? null, "1stC", DESIGN.firstBase, 143)}</div>
            <div className="w-[33%]">{field("1st Base D", board.firstBase[3] ?? null, "1stD", DESIGN.firstBase, 143)}</div>
          </div>
        </div>
        {/* Landscape: Hot Box on top, Game Clock under it. The column runs down
            to 0.5px above AT BAT 8 and ends 0.5px from the screen's right edge;
            the clock grows to fill the room under the Hot Box (it may reach
            left past the Hot Box) with 0.5px between them. Tap it to enlarge. */}
        <div className="w-[150px] landscape:w-[200px] flex-shrink-0 landscape:self-stretch landscape:mb-[-12.5px] landscape:flex landscape:flex-col">
          {hotBox}
          <FitFill className="hidden landscape:block landscape:flex-1 landscape:min-h-0 landscape:w-[125%] landscape:self-end landscape:mt-[1px] cursor-pointer" onClick={() => setShowClock(true)}>{clockPlain}</FitFill>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-x-5 pl-5 items-start landscape:hidden">
        {field("1st Base C", board.firstBase[2] ?? null, "1stC", DESIGN.firstBase, 143)}
        {field("1st Base D", board.firstBase[3] ?? null, "1stD", DESIGN.firstBase, 143)}
        <div className="pt-[18px]">{clock}</div>
      </div>
      <div className="grid grid-cols-2 landscape:grid-cols-4 gap-2.5">{[4, 5, 6, 7].map(atBat)}</div>
    </div>,
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#09090f] text-white">
      {/* Portrait: cover the board with a rotate prompt. */}
      <div className="fixed inset-0 z-[20000] hidden portrait:flex flex-col items-center justify-center gap-4 bg-[#09090f] px-8 text-center">
        <svg viewBox="0 0 64 64" className="h-20 w-20 animate-pulse text-yellow-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="22" y="6" width="20" height="36" rx="3" transform="rotate(0)" />
          <path d="M14 50a22 22 0 0 0 36 0M50 50l-1-7M50 50l-7 1" />
        </svg>
        <div className="text-[20px] font-bold text-white">Rotate your phone</div>
        <div className="text-[14px] text-white/60">The BAT 246 board is best viewed in landscape.</div>
      </div>
      {/* ── Modals (the desktop ones) ── */}
      {invitePos && myUserId && (
        <InviteModal boardId={board._id} position={invitePos.position} posLabel={invitePos.posLabel} myUserId={myUserId} hidePreservePosition={hidePreservePosition} disablePreservePosition={disablePreservePosition} onClose={() => setInvitePos(null)} />
      )}
      {openModal === "layaway" && <LayawayModal board={board} onClose={close} />}
      {openModal === "snapback" && <SnapBackModal board={board} onClose={close} />}
      {openModal === "message" && <MessageModal board={board} onClose={close} />}
      {openModal === "prepick" && <PrePickModal board={board} onClose={close} />}
      {openModal === "penciling" && <PencilingModal board={board} onClose={close} isPostPP={isPostPP} />}
      {openModal === "warp" && <WarpModal board={board} onClose={close} />}
      {openModal === "speedup" && <SpeedUpModal board={board} onClose={close} />}
      {openModal === "giftcard" && <GiftCardModal board={board} onClose={close} />}

      {/* ── Tap sheets / popups ── */}
      {lbPopupEl}
      {dugoutDetail && (
        <Sheet title={dugoutDetail.podTeamId ?? dugoutDetail.playerName ?? "—"} onClose={() => setDugoutDetail(null)}>
          {dugoutDetail.entryNo && <div className="text-[13px] text-amber-300/90 font-medium">Entry: {dugoutDetail.entryNo}</div>}
          <div className="text-[13px] text-white/60 mt-1">Joined: {fmtDate(dugoutDetail.enteredAt)} · {fmtTime(dugoutDetail.enteredAt)}</div>
          <div className={cn("text-[13px] mt-1", dugoutDetail.referredByName ? "text-blue-300/90" : "text-white/35")}>
            {dugoutDetail.referredByName ? `Referred by: ${dugoutDetail.referredByName}` : "No referrer"}
          </div>
          {(dugoutDetail.countryResidence || dugoutDetail.countryOrigin) && (
            <div className="flex gap-1.5 mt-2">
              {dugoutDetail.countryResidence && <FlagIcon value={dugoutDetail.countryResidence} className="w-[22px] h-[15px]" />}
              {dugoutDetail.countryOrigin && <FlagIcon value={dugoutDetail.countryOrigin} className="w-[22px] h-[15px]" />}
            </div>
          )}
          {dugoutDetail.podTeamId && (
            <button onClick={() => { const id = dugoutDetail.podTeamId!; setDugoutDetail(null); openPodTeamPopup(id); }} className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-[14px] font-bold">See all 4 POD team members</button>
          )}
        </Sheet>
      )}
      {showHotBox && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-3" onClick={() => { setShowHotBox(false); setHotBoxAll(false); }}>
          <div className="relative max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl" style={{ width: "min(94vw, calc(100dvh * 0.82))" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setShowHotBox(false); setHotBoxAll(false); }} className="absolute right-1 top-1 z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/60 bg-black/70 text-white" aria-label="Close"><X className="h-4 w-4" strokeWidth={3} /></button>
            <FitCard designWidth={DESIGN.hotBox} maxScale={4}>{hotBoxPanel(hotBoxAll ? hotBoxRows : hotBoxVisible, true)}</FitCard>
          </div>
        </div>
      )}
      {hotBoxDetail && (
        <Sheet title={`Hot Box · ${hotBoxDetail.ct} card`} onClose={() => setHotBoxDetail(null)}>
          <div className="flex items-center gap-4">
            <CardCase cards={[hotBoxDetail.ct.toLowerCase() as MiniCardType]} size="md" frame="earned" stack playerId={hotBoxDetail.playerId} trigger="click" />
            <div className="min-w-0">
              <div className="text-[22px] font-bold text-white truncate">{hotBoxDetail.playerName ?? "—"}</div>
              {hotBoxDetail.entryNo && <div className="text-[15px] text-amber-300/90">Entry: {hotBoxDetail.entryNo}</div>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[16px]">
            <span className="text-white/50">Card</span><span className="text-white font-semibold">{hotBoxDetail.ct}</span>
            {hotBoxDetail.assignedAt && (<><span className="text-white/50">Assigned</span><span className="text-white font-semibold">{fmtDate(hotBoxDetail.assignedAt)} · {fmtTime(hotBoxDetail.assignedAt)}</span></>)}
          </div>
          <div className="mt-2 text-[12px] text-white/40">Tap the card to see it.</div>
        </Sheet>
      )}
      {slotPopupEl}
      {showClock && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-3" onClick={() => setShowClock(false)}>
          <div className="relative w-[min(560px,90vw)]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowClock(false)} className="absolute -top-2 -right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/60 bg-black/70 text-white" aria-label="Close"><X className="h-5 w-5" strokeWidth={3} /></button>
            {clockEl(4)}
          </div>
        </div>
      )}
      {showAllDugout && (
        <Sheet title={`Dugout (${board.dugout.length})`} onClose={() => { setShowAllDugout(false); setDugoutSearch(""); }}>
          <input type="text" placeholder="Search by name..." value={dugoutSearch} onChange={(e) => setDugoutSearch(e.target.value)} className="mb-2 w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-[14px] text-white placeholder-white/30 outline-none focus:border-amber-400/50" />
          <div className="flex flex-col gap-1.5 landscape:grid landscape:grid-cols-2">
            {dugoutFiltered.map((slot, i) => (
              <div key={i} className="bg-black/40 border border-white/10 rounded-lg p-2.5">
                {slot?.podTeamId ? (
                  <div onClick={() => openPodTeamPopup(slot.podTeamId!)} className="text-[14px] text-blue-300 font-bold underline decoration-dotted">{slot.podTeamId}</div>
                ) : (
                  <div className="text-[14px] text-white font-bold truncate">{slot?.playerName ?? "—"}</div>
                )}
                {slot?.entryNo && <div className="text-[12px] text-amber-300/80 mt-0.5">Entry: {slot.entryNo}</div>}
                {slot && <div className="text-[12px] text-white/50 mt-0.5">Joined: {fmtDate(slot.enteredAt)} · {fmtTime(slot.enteredAt)}</div>}
              </div>
            ))}
            {dugoutFiltered.length === 0 && <div className="col-span-2 text-center text-[13px] text-white/30 py-4">No results</div>}
          </div>
        </Sheet>
      )}
      {podTeamPopup && (
        <Sheet title={`POD Team ${podTeamPopup.teamId}`} onClose={() => setPodTeamPopup(null)}>
          {podTeamPopup.loading ? (
            <div className="text-center text-white/40 py-6">Loading…</div>
          ) : podTeamPopup.members.length === 0 ? (
            <div className="text-center text-white/30 py-6">No members found</div>
          ) : (
            <div className="flex flex-col gap-2">
              {podTeamPopup.members.map((m, i) => (
                <div key={i} className="bg-black/40 border border-white/10 rounded-lg p-3">
                  <div className="text-[16px] text-white font-bold truncate">{m.playerName || "—"}</div>
                  <div className="text-[13px] text-amber-300/80 mt-0.5">
                    {m.position.startsWith("pod-") ? `POD seat ${Number(m.position.split("-")[1]) + 1}` : m.position === "dugout" ? "Dugout (waiting for PP)" : m.position}
                    {m.entryNo ? ` · Entry: ${m.entryNo}` : ""}
                  </div>
                  <div className="text-[13px] text-white/50 mt-0.5">Board {m.boardTrackingNumber}{m.enteredAt ? ` · ${fmtDate(m.enteredAt)}` : ""}</div>
                  {m.referredByName && <div className="text-[13px] text-white/50 mt-0.5">Referred by: {m.referredByName}</div>}
                </div>
              ))}
            </div>
          )}
        </Sheet>
      )}
      {podDetail && (
        <Sheet title={`POD seat ${podDetail.index + 1}`} onClose={() => setPodDetail(null)}>
          <div className="text-[16px] font-bold">{podDetail.occupant.name}</div>
          <div className="text-[13px] text-white/70 mt-1">Id: {podDetail.occupant.id}{podDetail.occupant.entry ? ` - ${podDetail.occupant.entry}` : ""}</div>
          <div className="text-[13px] text-white/70 mt-0.5">D: {podDetail.occupant.date} · T: {podDetail.occupant.time}</div>
          {board.podTeamId && <div className="text-[13px] text-white/70 mt-0.5">P-Team No: {board.podTeamId}</div>}
        </Sheet>
      )}

      {/* ── The four screens in a 2×2 snap grid (A B / C D), each cell one
          screen. Swipe sideways or up/down, or tap a gutter arrow. ── */}
      <div
        ref={scrollerRef}
        className={cn(
          "grid overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          view === "overview" ? "pointer-events-none overflow-hidden" : "h-full w-full overflow-auto snap-both snap-mandatory",
        )}
        // Overview: the same 2×2 grid laid out at full size (so every section
        // looks exactly as it does opened) and shrunk to half to fit the screen.
        style={view === "overview"
          ? { width: "200%", height: "200%", gridTemplateColumns: "50% 50%", gridTemplateRows: "50% 50%", transform: "scale(0.5)", transformOrigin: "top left" }
          : { gridTemplateColumns: "100% 100%", gridTemplateRows: "100% 100%" }}
      >
        {([
          { id: "A", col: 0, row: 0 },
          { id: "B", col: 1, row: 0 },
          { id: "C", col: 0, row: 1 },
          { id: "D", col: 1, row: 1 },
        ] as const).map(({ id, col, row }, i) => (
          <section
            key={id}
            aria-label={`Section ${id}`}
            className="relative h-full w-full snap-start overflow-hidden"
            style={{ gridColumn: col + 1, gridRow: row + 1, backgroundImage: "url('/images/stadium-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center top" }}
          >
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-black/25 to-black/55" />
            {/* Content box — stops short of the two edges that carry this
                section's arrows, so nothing on the board sits under them.
                Section A is the exception at the bottom: its down arrow is
                10% right of centre and the only thing on its bottom row is
                the Home Plate, over on the left — so A keeps the full height
                and the Home Plate sits lower, into that otherwise blank
                strip, without the arrow ever touching it. */}
            {/* Likewise A's right edge: the founder wants its buttons and
                leaderboard bars running to within 2px of the screen edge,
                so A has no right gutter either and its right arrow is parked
                lower, beside the empty field below the bars. */}
            <div className="absolute" style={{ top: row === 1 && id !== "C" && id !== "D" ? GUTTER : 0, bottom: row === 0 && id !== "A" && id !== "B" ? GUTTER : 0, left: col === 1 && id !== "B" && id !== "D" ? GUTTER : 0, right: col === 0 && id !== "A" && id !== "C" ? GUTTER : 0 }}>
              <FitSection
                padding={id === "A" ? "px-[2px] pt-2 pb-1.5" : id === "B" ? "pl-[34px] pr-3 pt-3 pb-[34px] landscape:pl-0 landscape:pr-0 landscape:pt-0 landscape:pb-[4px]" : id === "C" ? "pl-3 pr-[46px] pt-[46px] pb-1.5 landscape:pl-[2px] landscape:pr-[2px] landscape:pt-[2px]" : id === "D" ? "pl-[46px] pr-3 pt-[46px] pb-1.5 landscape:pl-[2px] landscape:pt-[2px] landscape:pr-[0.5px]" : undefined}
                fill={id === "B"}
              >{sections[i]}</FitSection>
            </div>
            {view === "sections" && <>
            {col === 0 && <Arrow dir="right" to={row === 0 ? "B" : "D"} shift={id === "A" ? "27%" : id === "C" ? "-15%" : undefined} onClick={() => goTo(1, row)} />}
            {col === 1 && <Arrow dir="left" to={row === 0 ? "A" : "C"} shift={id === "B" ? "17%" : id === "D" ? "-15%" : undefined} onClick={() => goTo(0, row)} />}
            {/* Section A's down arrow sits 10% right of centre (founder-placed). */}
            {row === 0 && <Arrow dir="down" to={col === 0 ? "C" : "D"} shift={id === "A" ? "10%" : id === "B" ? "15%" : undefined} onClick={() => goTo(col, 1)} />}
            {row === 1 && <Arrow dir="up" to={col === 0 ? "A" : "B"} shift={id === "C" ? "-20%" : id === "D" ? "15%" : undefined} onClick={() => goTo(col, 0)} />}
            </>}
          </section>
        ))}
      </div>

      {/* Overview: translucent watermark-style section buttons over the whole board. */}
      {view === "overview" && (
        <div className="absolute inset-0 z-30 grid grid-cols-2 grid-rows-2">
          {([["A", 0, 0], ["B", 1, 0], ["C", 0, 1], ["D", 1, 1]] as const).map(([id, col, row]) => (
            <button
              key={id}
              type="button"
              onClick={() => openSection(col, row)}
              aria-label={`Open Section ${id}`}
              className="flex items-center justify-center border border-white/15 active:bg-white/10"
            >
              <span className="flex h-[64px] w-[64px] items-center justify-center rounded-2xl border-2 border-white/55 bg-black/30 text-[40px] font-extrabold leading-none text-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.6)] backdrop-blur-[2px]">{id}</span>
            </button>
          ))}
        </div>
      )}
      {/* Overview: close the board and go back. */}
      {view === "overview" && (
        <button
          type="button"
          onClick={closeBoard}
          aria-label="Close board"
          className="absolute right-1.5 top-1.5 z-40 flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-white/45 bg-black/25 text-white shadow-[0_2px_8px_rgba(0,0,0,0.6)] active:bg-black/80"
        >
          <X className="h-5 w-5" strokeWidth={3} />
        </button>
      )}
      {/* Sections: small translucent button back to the overview. */}
      {view === "sections" && (
        <button
          type="button"
          onClick={() => setView("overview")}
          aria-label="Back to whole board"
          className="absolute bottom-1 left-1 z-30 flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-white/35 bg-black/20 text-white/90 backdrop-blur-[2px] active:bg-black/70"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
