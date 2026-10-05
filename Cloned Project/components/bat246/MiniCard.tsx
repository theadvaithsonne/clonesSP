"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Country } from "country-state-city";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { SlotData } from "./types";
import GreenCardBackSvg from "./GreenCardBackSvg";

const ALL_COUNTRIES = Country.getAllCountries();

/** Bat246 stores countryResidence/countryOrigin as the full country name (the
 * same value the profile popover saves via country-state-city), not a 2-letter
 * ISO code — so resolve the flag by name lookup, matching ProfilePopover's own
 * name-based matching. Falls back treating the value itself as a 2-letter code. */
function flagIsoCode(value?: string | null): string {
  if (!value) return "";
  if (value.length === 2) return value.toLowerCase();
  const match = ALL_COUNTRIES.find((c) => c.name.toLowerCase() === value.toLowerCase());
  return match?.isoCode?.toLowerCase() ?? "";
}

/** @deprecated Unicode regional-indicator flag emoji have no glyph in Windows'
 * default font — Chrome/Edge on Windows render the bare two letters (e.g. "IN")
 * instead of a flag. Use <FlagIcon /> instead, which renders a real SVG image. */
export function flagEmoji(value?: string | null): string {
  const code = flagIsoCode(value);
  return code
    ? code.toUpperCase().replace(/[A-Z]/g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    : "";
}

/** Renders a country flag as an SVG image (flagcdn.com) instead of a Unicode
 * emoji — Windows has no font glyphs for flag emoji, so browsers there fall
 * back to showing the raw two-letter code (e.g. "IN") instead of a flag. */
export function FlagIcon({
  value,
  className,
  title,
}: {
  value?: string | null;
  className?: string;
  title?: string;
}) {
  const code = flagIsoCode(value);
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={title ?? value ?? code}
      title={title ?? value ?? undefined}
      className={cn("inline-block align-middle rounded-[1px] shadow-sm border border-black", className)}
    />
  );
}

export type MiniCardType = "gold" | "green" | "black" | "brown" | "gray" | "noCard";

/** Color recipe for each Bat246 trading-card type (mirrors the printed GOLD/GREEN cards). */
const SCHEME: Record<MiniCardType, { from: string; mid: string; to: string; border: string; bar: string; label: string }> = {
  gold:   { from: "#fff7c2", mid: "#f4cf4e", to: "#c9970f", border: "#7a5c0c", bar: "#6b4f08", label: "#3a2c00" },
  green:  { from: "#9bf0a4", mid: "#3fc457", to: "#137a22", border: "#0c4d14", bar: "#0b4012", label: "#eafff0" },
  black:  { from: "#9aa2b0", mid: "#4b525f", to: "#1c222c", border: "#0a0e15", bar: "#0a0e15", label: "#e8ebf2" },
  brown:  { from: "#e0ab6e", mid: "#a96a2c", to: "#5e3510", border: "#341d06", bar: "#341d06", label: "#fbe6d2" },
  gray:   { from: "#eeeef1", mid: "#b6b6bd", to: "#7c7c85", border: "#45454c", bar: "#45454c", label: "#1c1c1f" },
  noCard: { from: "#f5f5f5", mid: "#d4d4d4", to: "#a3a3a3", border: "#737373", bar: "#737373", label: "#1c1c1c" },
};

const SIZE: Record<"xs" | "sm" | "md", string> = {
  xs: "w-[11px] h-[15px] rounded-[1.5px]",
  sm: "w-[15px] h-[21px] rounded-[2px]",
  md: "w-[20px] h-[28px] rounded-[3px]",
};

const GREEN_SIZE_PX: Record<"xs" | "sm" | "md", { w: number; h: number }> = {
  xs: { w: 11 * 1.18, h: 15 * 1.18 },
  sm: { w: 15 * 1.18, h: 21 * 1.18 },
  md: { w: 20 * 1.18, h: 28 * 1.18 },
};

/** Printed card-face art per type. Gray has no fixed art — its Free/160 sub-types pass `imageSrc` explicitly. */
const TYPE_IMAGE: Partial<Record<MiniCardType, string>> = {
  green: "/images/bat246-green-card.svg",
  gold: "/images/bat246-gold-card.svg",
  black: "/images/bat246-black-card.svg",
  brown: "/images/bat246-brown-card.svg",
  noCard: "/images/bat246-nocard-card.jpg",
};

/** Card-back artwork per type (shown in the click-to-reveal back modal). */
const TYPE_BACK_IMAGE: Partial<Record<MiniCardType, string>> = {
  gold:   "/images/bat246-gold-card-back.svg",
  black:  "/images/bat246-black-card-back.svg",
  brown:  "/images/bat246-brown-card-back.svg",
  gray:   "/images/bat246-grey-free-card-back.svg",
  noCard: "/images/bat246-nocard-card-back.svg",
};
// Gray has two sub-types with distinct backs (Free vs 160).
const GRAY_160_BACK_IMAGE = "/images/bat246-grey-160-card-back.svg";

/** A miniature Bat246 trading card — gold/green/black/brown/gray. */
export function MiniCard({ type, size = "sm", title, className, imageSrc }: { type: MiniCardType; size?: "xs" | "sm" | "md"; title?: string; className?: string; imageSrc?: string }) {
  const src = imageSrc ?? TYPE_IMAGE[type];
  if (src) {
    const gs = GREEN_SIZE_PX[size];
    return (
      <div
        className={cn("relative flex-shrink-0 overflow-hidden border shadow-[0_1px_2px_rgba(0,0,0,0.5)]", SIZE[size], className)}
        style={{ borderColor: SCHEME[type].border, width: `${gs.w}px`, height: `${gs.h}px` }}
        title={title ?? type}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
    );
  }
  const s = SCHEME[type];
  // Match the same green-derived footprint as art cards, so every card type
  // (including art-less/legacy cards) renders at one uniform size & height.
  const gs = GREEN_SIZE_PX[size];
  return (
    <div
      className={cn("relative flex-shrink-0 overflow-hidden border shadow-[0_1px_2px_rgba(0,0,0,0.5)]", SIZE[size], className)}
      style={{ background: `linear-gradient(150deg, ${s.from} 0%, ${s.mid} 48%, ${s.to} 100%)`, borderColor: s.border, width: `${gs.w}px`, height: `${gs.h}px` }}
      title={title ?? type}
    >
      {/* top title bar (the "GOLD CARD" header strip) */}
      <div className="absolute top-0 inset-x-0" style={{ height: "26%", background: s.bar, opacity: 0.9 }} />
      {/* central globe emblem (HomeRun / Bat246 world) */}
      <div
        className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "52%",
          height: "38%",
          background: "radial-gradient(circle at 36% 30%, #d6ecff 0%, #4b96e0 55%, #1f5fa8 100%)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(0,0,0,0.4)",
        }}
      />
      {/* bottom banner strip */}
      <div className="absolute bottom-0 inset-x-0" style={{ height: "18%", background: s.bar, opacity: 0.75 }} />
      {/* glossy sheen */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/5 to-transparent" style={{ height: "44%" }} />
    </div>
  );
}

/** PPB (green) cards a slot has paid into — the 0–2 green spaces in the PPB box. */
export function ppbGreens(slot?: SlotData | null): number {
  return Math.max(0, Math.min(2, slot?.salesCredits ?? 0));
}

/** Earned business cards (BCs) a slot holds, beyond the green PPB spaces. */
export function earnedCards(slot?: SlotData | null): MiniCardType[] {
  if (!slot) return [];
  const out: MiniCardType[] = [];
  const goldCount = slot.goldCards || (slot.cardType === "Gold" ? 1 : 0);
  for (let i = 0; i < goldCount; i++) out.push("gold");
  if (slot.cardType === "Green") out.push("green");
  // Gray cards now come in 2 sub-types (Free / 160) but render the same gray card visual.
  const grayCount = (slot.freeGrayCards ?? 0) + (slot.grayCard160 ?? 0) || (slot.grayCards ?? 0);
  for (let i = 0; i < grayCount; i++) out.push("gray");
  for (let i = 0; i < (slot.blackCards ?? 0); i++) out.push("black");
  for (let i = 0; i < (slot.brownCards ?? 0); i++) out.push("brown");
  return out;
}

export const GRAY_FREE_IMAGE = "/images/bat246-grey-free-card.svg";
export const GRAY_160_IMAGE = "/images/bat246-grey-160-card.svg";

/** Per-card hover label + art for a slot's gray cards, distinguishing Free vs 160 sub-types. */
export function grayCardItems(slot?: SlotData | null): { label: string; imageSrc?: string }[] {
  if (!slot) return [];
  const free = slot.freeGrayCards ?? 0;
  const c160 = slot.grayCard160 ?? 0;
  if (free || c160) {
    return [
      ...Array.from({ length: free }, () => ({ label: "Free Grey Card", imageSrc: GRAY_FREE_IMAGE })),
      ...Array.from({ length: c160 }, () => ({ label: "160 Grey Card", imageSrc: GRAY_160_IMAGE })),
    ];
  }
  return Array.from({ length: slot.grayCards ?? 0 }, () => ({ label: "Grey Card" }));
}

/** Full ordered list of cards a slot displays: green PPB spaces then earned BCs. */
export function allSlotCards(slot?: SlotData | null): MiniCardType[] {
  const greens = Array.from({ length: ppbGreens(slot) }, () => "green" as MiniCardType);
  return [...greens, ...earnedCards(slot)];
}

const CARD_LABEL: Record<MiniCardType, string> = {
  gold: "GOLD", green: "GREEN", black: "BLACK", brown: "BROWN", gray: "GRAY", noCard: "NONE",
};

/** Green PPB-space cards a slot has paid into (the gold-bordered box group). */
export function ppbGreenCards(slot?: SlotData | null): MiniCardType[] {
  return Array.from({ length: ppbGreens(slot) }, () => "green" as MiniCardType);
}

// ─── Card-history types & cache ───────────────────────────────────────────────

interface CardBackPerson {
  playerName: string | null;
  playerIdNo: string | null;
  entryNo: string | null;
  distributorId?: string | null;
}

interface CardBack {
  assignedTo?: CardBackPerson | null;
  position?: string | null;
  freePositionAssignedTo?: string | null;
  freePosition?: CardBackPerson | null;
  atBatPositionNo?: string | null;
  firstBasePosition?: "A" | "B" | "C" | "D" | null;
  issuedAt?: string | null;
  boardTrackingNo?: string | null;
  stolenFrom?: CardBackPerson | null;       // player whose 1st base slot was taken when gold card was earned
  stolenFromPosition?: string | null;       // their 1st base position key (e.g. "1stB")
}

interface CardEarningEvent {
  cardType: string;
  earnedAt: string;
  boardTrackingNumber: string | null;
  referredUserId: string | null;
  referredUserName: string | null;
  position: string | null;
  cardBack?: CardBack | null;
}

// Raw board position keys → human-readable labels (mirrors Bat246NotificationBell.tsx).
const POSITION_LABELS: Record<string, string> = {
  thirdBase: "3rd Base", secondBaseA: "2nd Base A", secondBaseB: "2nd Base B",
  "1stA": "1st Base A", "1stB": "1st Base B", "1stC": "1st Base C", "1stD": "1st Base D",
  "atBat-0": "AT BAT 1", "atBat-1": "AT BAT 2", "atBat-2": "AT BAT 3", "atBat-3": "AT BAT 4",
  "atBat-4": "AT BAT 5", "atBat-5": "AT BAT 6", "atBat-6": "AT BAT 7", "atBat-7": "AT BAT 8",
};
function formatPosition(pos: string | null | undefined): string {
  if (!pos) return "—";
  return POSITION_LABELS[pos] ?? pos;
}

type HistoryState = CardEarningEvent[] | "loading" | "error";

// Module-level cache so repeated hovers on the same player + type never re-fetch.
const historyCache = new Map<string, CardEarningEvent[]>();

// Registry of stable close functions — lets any card close all others on open.
const closeRegistry = new Set<() => void>();

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function fmtEarnedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtEarnedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
}

/** Compact "label: value" row used inside the Baseball Card / Free Position sections. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[9.5px] leading-snug">
      <span className="text-white/45">{label}</span>
      <span className="text-white/85 font-semibold text-right truncate max-w-[140px]">{value}</span>
    </div>
  );
}

// ─── HistoryTooltip ────────────────────────────────────────────────────────────

/** Content rendered inside the card-hover popover when history data is available. */
function HistoryTooltip({ type, history, label: labelOverride }: { type: MiniCardType; history: HistoryState; label?: string }) {
  const s = SCHEME[type];
  const label = labelOverride ?? `${CARD_LABEL[type]} CARD`;

  return (
    <div className="flex flex-col gap-1.5 min-w-[200px] max-w-[280px]">
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-t-[4px] -mx-[1px] -mt-[1px]"
        style={{ background: `linear-gradient(90deg, ${s.bar} 0%, ${s.mid} 100%)` }}
      >
        <MiniCard type={type} size="sm" />
        <span className="text-white text-[11px] font-extrabold tracking-[0.12em] uppercase">{label}</span>
      </div>

      {/* Body */}
      <div className="px-1 pb-0.5">
        {history === "loading" && (
          <div className="flex items-center gap-1.5 py-1">
            <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white/80 animate-spin flex-shrink-0" />
            <span className="text-white/50 text-[10px]">Loading...</span>
          </div>
        )}

        {history === "error" && (
          <span className="text-red-400/80 text-[10px]">Details unavailable</span>
        )}

        {Array.isArray(history) && history.length === 0 && (
          <span className="text-white/40 text-[10px] italic">Earned before tracking was added</span>
        )}

        {Array.isArray(history) && history.length > 0 && (
          <div className="flex flex-col gap-[6px]">
            {history.map((ev, i) => {
              const cb = ev.cardBack;
              const issuedAt = cb?.issuedAt ?? ev.earnedAt;
              const boardNo = cb?.boardTrackingNo ?? ev.boardTrackingNumber;
              return (
                <div key={i} className="flex flex-col gap-[3px] border-b border-white/10 last:border-0 pb-[5px] last:pb-0">
                  <div className="flex items-center gap-1">
                    <span className="text-white/40 text-[9px] font-bold tabular-nums">#{i + 1}</span>
                    {boardNo && (
                      <span className="text-amber-300/70 text-[9px] font-semibold">Board {boardNo}</span>
                    )}
                    <span className="ml-auto text-white/35 text-[9px]">{fmtEarnedAt(issuedAt)} {fmtEarnedTime(issuedAt)}</span>
                  </div>

                  {cb?.assignedTo ? (
                    <div className="flex flex-col gap-[4px]">
                      <div className="flex flex-col gap-[1px] bg-white/[0.05] rounded-[3px] px-1.5 py-1">
                        <span className="text-emerald-300/85 text-[8px] font-extrabold uppercase tracking-wider mb-[1px]">Baseball Card</span>
                        <Field label="Assigned To" value={cb.assignedTo.playerName || "—"} />
                        <Field label="1st Base Position" value={formatPosition(cb.position)} />
                        <Field label="ID" value={cb.assignedTo.distributorId || cb.assignedTo.playerIdNo || "—"} />
                        <Field label="Entry" value={cb.assignedTo.entryNo || "—"} />
                      </div>
                      <div className="flex flex-col gap-[1px] bg-white/[0.05] rounded-[3px] px-1.5 py-1">
                        <span className="text-sky-300/85 text-[8px] font-extrabold uppercase tracking-wider mb-[1px]">Free Position</span>
                        <Field label="Assigned To" value={cb.freePosition?.playerName || ev.referredUserName || "—"} />
                        <Field label="At Bat Position" value={formatPosition(cb.atBatPositionNo)} />
                        <Field label="ID" value={cb.freePosition?.distributorId || cb.freePosition?.playerIdNo || "—"} />
                        <Field label="Entry" value={cb.freePosition?.entryNo || "—"} />
                      </div>
                      {type === "gold" && cb.stolenFrom && (
                        <div className="flex flex-col gap-[1px] bg-amber-400/[0.08] rounded-[3px] px-1.5 py-1 border border-amber-400/20">
                          <span className="text-amber-300/85 text-[8px] font-extrabold uppercase tracking-wider mb-[1px]">Stolen From</span>
                          <Field label="Player" value={cb.stolenFrom.playerName || "—"} />
                          <Field label="1st Base Position" value={formatPosition(cb.stolenFromPosition)} />
                          <Field label="ID" value={cb.stolenFrom.distributorId || cb.stolenFrom.playerIdNo || "—"} />
                          <Field label="Entry" value={cb.stolenFrom.entryNo || "—"} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-white/80 text-[10px] leading-snug">
                      {ev.referredUserName
                        ? <>Referred <span className="font-semibold text-white">{ev.referredUserName}</span></>
                        : <span className="italic text-white/40">Earned before tracking was added</span>
                      }
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card-back overlay helpers ────────────────────────────────────────────────

/** Measures a bold Arial run through a cached canvas context. Used to shrink a
 *  value to its column *before* it paints — no measure-then-relayout pass, so
 *  the text never flashes at the wrong size. Estimates during SSR. */
const measureBold = (() => {
  let ctx: CanvasRenderingContext2D | null | undefined;
  return (text: string, size: number) => {
    if (ctx === undefined) {
      ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    }
    if (!ctx) return text.length * size * 0.58;
    ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
    return ctx.measureText(text).width;
  };
})();

/** Largest size (down to `CARD_TEXT.minScale` of `size`) that keeps `text` inside `maxWidth`. */
function fitFontSize(text: string, size: number, maxWidth: number) {
  const width = measureBold(text, size);
  return width <= maxWidth ? size : Math.max(size * CARD_TEXT.minScale, (size * maxWidth) / width);
}

// ─── Card-back value layout ───────────────────────────────────────────────────
//
// Every card back is fixed art with its red labels baked in, so values are
// anchored off label geometry measured from the art itself — the right edge and
// baseline of each label, in that art's own viewBox units.
//
// Those units differ per card (the green art is 1684 wide, the rest 2245) but
// every back renders into the same box on screen, so sizes and spacing are
// declared once in *display* pixels and converted per card. That is what makes
// the filled-in text come out identical on every card, whatever its art scale.
const CARD_DISPLAY_W = 720; // px width each card back renders at

const CARD_TEXT = {
  size:     26,    // value font size, in display px
  gap:      12,    // space after the label's colon, in display px
  gutter:   16,    // space kept before the next column, in display px
  minScale: 0.62,  // smallest a value may shrink before it is condensed instead
  stroke:   0.035, // halo stroke width ÷ font size
};

/** A red label as measured off the card art (in that card's viewBox units). */
type CardLabelRow = {
  y: number;            // label baseline — values sit on it
  left?: number;        // right edge of the left label (omitted where the art is pre-printed)
  rightLabelX?: number; // where the right-hand label starts, i.e. where a left value must stop
  right?: number;       // right edge of the right label
};

type CardSlot = { x: number; y: number; size: number; maxWidth: number };

/** Pairs a measured layout with the slot helpers that place values in it. */
function cardBack<K extends string>(layout: {
  vw: number;
  vh: number;
  edge: number; // right edge of the printed content area
  rows: Record<K, CardLabelRow>;
}) {
  const unit   = layout.vw / CARD_DISPLAY_W; // art units per display px
  const size   = CARD_TEXT.size * unit;
  const gap    = CARD_TEXT.gap * unit;
  const gutter = CARD_TEXT.gutter * unit;
  const slot = (row: CardLabelRow, x: number, limit: number): CardSlot => ({
    x, y: row.y, size, maxWidth: Math.max(size, limit - x),
  });
  return {
    ...layout,
    /** Value just after the row's left label, stopping before the right column. */
    left: (k: K): CardSlot | null => {
      const r = layout.rows[k];
      if (r.left == null) return null;
      return slot(r, r.left + gap, (r.rightLabelX ?? layout.edge) - gutter);
    },
    /** Value just after the row's right label, stopping at the card's edge. */
    right: (k: K): CardSlot | null => {
      const r = layout.rows[k];
      if (r.right == null) return null;
      return slot(r, r.right + gap, layout.edge);
    },
  };
}

/** A filled-in value on a card back — the single text style used by every card:
 *  baseline-aligned with its red label, shrunk to fit its column, and condensed
 *  as a last resort so a long name or timestamp can never reach the next one. */
function CardValue({ slot, value }: { slot: CardSlot | null; value: string | null | undefined }) {
  if (!slot) return null;
  const text     = value || "—";
  const fontSize = fitFontSize(text, slot.size, slot.maxWidth);
  const clamped  = measureBold(text, fontSize) > slot.maxWidth;
  return (
    <text
      x={slot.x}
      y={slot.y}
      fontSize={fontSize}
      fontWeight="bold"
      fontFamily="Arial, Helvetica, sans-serif"
      fill="#111111"
      paintOrder="stroke"
      stroke="rgba(255,255,255,0.4)"
      strokeWidth={slot.size * CARD_TEXT.stroke}
      textLength={clamped ? slot.maxWidth : undefined}
      lengthAdjust={clamped ? "spacingAndGlyphs" : undefined}
      style={{ userSelect: "none" } as React.CSSProperties}
    >
      {text}
    </text>
  );
}

/** Shared "waiting for the card-back API" overlay. */
function CardLoading({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-1.5 bg-black/50 rounded-lg px-3 py-2">
        <div className={cn("w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0", accent)} />
        <span className="text-white/60 text-[10px]">Loading card data…</span>
      </div>
    </div>
  );
}

/** How far the card pair is nudged up so it overlaps the action-button row above. */
const CARD_STAGE_LIFT = 150;

/** Backdrop that centres a front+back card pair. The cards are fixed-size art,
 *  so the pair is scaled down to whatever the viewport can show (and stacks
 *  below `md`, where a side-by-side pair would shrink to unreadable). */
function CardStage({ onClose, children, centered = false }: { onClose: () => void; children: React.ReactNode; centered?: boolean }) {
  const pairRef = useRef<HTMLDivElement | null>(null);
  const maxLift = centered ? 0 : CARD_STAGE_LIFT;
  const [fit, setFit] = useState({ scale: 1, lift: maxLift });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const el = pairRef.current;
    if (!el) return;
    const update = () => {
      // offsetWidth/Height are layout sizes — unaffected by the transform we
      // apply below, so measuring here can't feed back into itself.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const scale = Math.min(1, (window.innerWidth - 24) / w, (window.innerHeight - 24) / h);
      const room  = (window.innerHeight - h * scale) / 2 - 12; // space above the centred pair
      const lift  = Math.max(0, Math.min(maxLift * scale, room));
      setFit((prev) => (prev.scale === scale && prev.lift === lift ? prev : { scale, lift }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, [maxLift]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden bg-black/25"
      onClick={onClose}
    >
      <div
        ref={pairRef}
        className="relative flex shrink-0 flex-col items-center gap-3 landscape:flex-row landscape:gap-[18px] md:flex-row md:gap-[18px] [&>*]:shrink-0"
        style={{ transform: `translateY(-${fit.lift}px) scale(${fit.scale})` }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─── GreenCardBackModal ────────────────────────────────────────────────────────
//
// Approach: render the portrait SVG (1190×1684) inside a parent <svg> element
// that has a landscape viewBox (1684×1190). The portrait card is rotated -90°
// via an SVG transform so it fills the landscape frame. Then <text> elements
// are placed in the same SVG coordinate space — no unit-conversion required,
// no extra library needed.
//
// Transform for rotating portrait → landscape:
//   translate(0, 1190) rotate(-90)
//   Maps portrait (x,y) → landscape (y, 1190-x)
//
// Section boundaries in LANDSCAPE SVG coords (landscape_y = 1190 - portrait_x):
//   Pete Rose banner:  portrait x=820–1190  → landscape y=   0–370
//   BASEBALL CARD:     portrait x=594–820   → landscape y= 370–596  (white bg)
//   FREE POSITION:     portrait x=259–594   → landscape y= 596–931  (dark green bg)
//   DATE/TIME:         portrait x= 55–259   → landscape y= 931–1135 (white bg)
//
// Landscape x = portrait y (content runs from portrait y=58 to y=1625 → lx=58–1625).

// Display size for the landscape card in the modal
const GCB_VW = 1684; // SVG viewBox width  (= portrait height)
const GCB_VH = 1190; // SVG viewBox height (= portrait width)
const GCB_W  = 720;  // rendered pixel width
const GCB_H  = Math.round(GCB_W * GCB_VH / GCB_VW); // ≈ 509 px

/** Green card back — label boxes measured off the rotated art (landscape units). */
const GREEN_BACK = cardBack({
  vw: GCB_VW,
  vh: GCB_VH,
  edge: 1545,
  rows: {
    bcAssigned: { y:  429.3, left: 428.4, rightLabelX: 956.5, right: 1057.1 }, // ASSIGNED TO / ID #
    bcPosition: { y:  515.7, left: 560.0, rightLabelX: 957.0, right: 1147.5 }, // 1ST BASE POSITION / ENTRY #
    fpAssigned: { y:  783.0, left: 428.3, rightLabelX: 970.9, right: 1071.4 }, // ASSIGNED TO / ID #
    fpAtBat:    { y:  869.3, left: 554.5, rightLabelX: 971.3, right: 1161.9 }, // AT BAT POSITION # / ENTRY #
    dt:         { y: 1065.7, left: 388.4, rightLabelX: 971.3, right: 1173.4 }, // DATE/TIME / BOARD #
  },
});

function GreenCardBackModal({
  events,
  onClose,
}: {
  events: CardEarningEvent[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => { setIdx(0); }, [events]);

  if (events.length === 0) return null;

  const ev   = events[Math.min(idx, events.length - 1)];
  const cb   = ev.cardBack;
  const issuedAt = cb?.issuedAt ?? ev.earnedAt;
  const boardNo  = cb?.boardTrackingNo ?? ev.boardTrackingNumber;
  const L = GREEN_BACK;

  return (
    <CardStage onClose={onClose} centered>
        {/* ── Left: Front card ─────────────────────────────────────────── */}
        <div className="bg-[#0e0f18] rounded-xl border border-white/10 shadow-2xl flex items-center justify-center p-4" style={{ zoom: 0.95 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/bat246-green-card.svg"
            alt="Green Card Front"
            style={{ height: GCB_H, width: "auto", display: "block" }}
            draggable={false}
          />
        </div>

        {/* ── Right: Back card + pagination ───────────────────────────── */}
        <div className="bg-[#0e0f18] rounded-xl border border-white/10 shadow-2xl flex flex-col" style={{ zoom: 0.924 }}>
          <div className="relative" style={{ width: GCB_W, height: GCB_H }}>
            <svg
              width={GCB_W}
              height={GCB_H}
              viewBox={`0 0 ${GCB_VW} ${GCB_VH}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "block", width: "100%", height: "100%" }}
            >
              {/* Portrait SVG (1190×1684) as React component, rotated -90° to landscape */}
              <g transform={`translate(0,${GCB_VH}) rotate(-90)`}>
                <GreenCardBackSvg
                  x={0} y={0}
                  width={GCB_VH}
                  height={GCB_VW}
                  viewBox="0 0 1190.25 1683.75"
                />
              </g>

              {cb && (
                <>
                  {/* ── BASEBALL CARD section ───────────────────────────── */}
                  <CardValue slot={L.left("bcAssigned")}  value={cb.assignedTo?.playerName} />
                  <CardValue slot={L.right("bcAssigned")} value={cb.assignedTo?.distributorId ?? cb.assignedTo?.playerIdNo} />
                  <CardValue slot={L.left("bcPosition")}  value={formatPosition(cb.position)} />
                  <CardValue slot={L.right("bcPosition")} value={cb.assignedTo?.entryNo} />

                  {/* ── FREE POSITION section ───────────────────────────── */}
                  <CardValue slot={L.left("fpAssigned")}  value={cb.freePosition?.playerName ?? ev.referredUserName} />
                  <CardValue slot={L.right("fpAssigned")} value={cb.freePosition?.distributorId ?? cb.freePosition?.playerIdNo} />
                  <CardValue slot={L.left("fpAtBat")}     value={formatPosition(cb.atBatPositionNo)} />
                  <CardValue slot={L.right("fpAtBat")}    value={cb.freePosition?.entryNo} />

                  {/* ── DATE/TIME section ───────────────────────────────── */}
                  <CardValue slot={L.left("dt")}  value={issuedAt ? `${fmtEarnedAt(issuedAt)}  ${fmtEarnedTime(issuedAt)}` : null} />
                  <CardValue slot={L.right("dt")} value={boardNo} />
                </>
              )}
            </svg>
            {!cb && <CardLoading accent="border-emerald-300/30 border-t-emerald-300/80" />}
          </div>

          {/* ── Bottom bar: pagination + close ──────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-t border-white/10">
            {events.length > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  className="text-white/60 hover:text-white disabled:opacity-30 text-xs px-2 py-1 rounded border border-white/20 transition-colors"
                >
                  ‹ Prev
                </button>
                <span className="text-white/40 text-xs tabular-nums">{idx + 1} / {events.length}</span>
                <button
                  onClick={() => setIdx((i) => Math.min(events.length - 1, i + 1))}
                  disabled={idx === events.length - 1}
                  className="text-white/60 hover:text-white disabled:opacity-30 text-xs px-2 py-1 rounded border border-white/20 transition-colors"
                >
                  Next ›
                </button>
              </div>
            ) : (
              <span className="text-white text-base font-extrabold">Green Card</span>
            )}
            <button
              onClick={onClose}
              className="text-white hover:bg-white/15 text-base font-extrabold px-5 py-1.5 rounded-md border-2 border-white transition-colors"
            >
              Close ✕
            </button>
          </div>
        </div>
    </CardStage>
  );
}

// ─── StandardCardBackModal ────────────────────────────────────────────────────
//
// All landscape card-back SVGs (Gold, Black, Brown) are 2245×1587.
// Section y-boundaries (SVG units, same for Gold/Black/Brown):
//   BASEBALL CARD : y ~260–708   (white / card-specific bg)
//   FREE POSITION : y ~691–1081  (gray  bg, fill "#797B6F")
//   STOLEN FROM   : y ~1081–1361 (yellow bg, fill "#FFCC00")
//   DATE/TIME     : y ~1361–1587 (card-specific bg)
//
// NoCard SVG has a different layout — see NoCardBackModal below.

const GLD_W = 720;
const GLD_H = Math.round(GLD_W * 1587 / 2245); // ≈ 509 px

// Gold / Black / Brown share a field layout but not exact geometry — each row
// below is measured off that card's own art (2245×1587 units). `edge` mirrors
// the left margin of the labels, keeping values inside the printed panel.
const GOLD_BACK = cardBack({
  vw: 2245, vh: 1587, edge: 2060,
  rows: {
    bcAssigned: { y:  557, left: 512, rightLabelX: 1276, right: 1388 },
    bcPosition: { y:  672, left: 434, rightLabelX: 1276, right: 1490 },
    fpAssigned: { y:  942, left: 512, rightLabelX: 1295, right: 1407 },
    fpAtBat:    { y: 1035, left: 655, rightLabelX: 1295, right: 1510 },
    sfStolen:   { y: 1214, left: 550, rightLabelX: 1295, right: 1412 },
    sfPosition: { y: 1312, left: 668, rightLabelX: 1295, right: 1518 },
    dt:         { y: 1465, left: 487, rightLabelX: 1295, right: 1523 },
  },
});

const BLACK_BACK = cardBack({
  vw: 2245, vh: 1587, edge: 2060,
  rows: {
    bcAssigned: { y:  559, left: 525, rightLabelX: 1276, right: 1392 },
    bcPosition: { y:  674, left: 443, rightLabelX: 1276, right: 1499 },
    fpAssigned: { y:  910, left: 525, rightLabelX: 1295, right: 1412 },
    fpAtBat:    { y: 1025, left: 657, rightLabelX: 1295, right: 1518 },
    sfStolen:   { y: 1189, left: 550, rightLabelX: 1295, right: 1412 },
    sfPosition: { y: 1304, left: 668, rightLabelX: 1295, right: 1518 },
    dt:         { y: 1458, left: 478, rightLabelX: 1295, right: 1532 },
  },
});

// The brown (Home Plate) card prints its own BASEBALL CARD position — that row
// takes no value, hence the missing `left`.
const BROWN_BACK = cardBack({
  vw: 2245, vh: 1587, edge: 2121,
  rows: {
    bcAssigned: { y:  559, left: 480, rightLabelX: 1345, right: 1462 },
    bcPosition: { y:  674,            rightLabelX: 1345, right: 1568 },
    fpAssigned: { y:  910, left: 463, rightLabelX: 1345, right: 1462 },
    fpAtBat:    { y: 1025, left: 595, rightLabelX: 1345, right: 1568 },
    sfStolen:   { y: 1189, left: 488, rightLabelX: 1345, right: 1462 },
    sfPosition: { y: 1304, left: 606, rightLabelX: 1342, right: 1565 },
    dt:         { y: 1458, left: 426, rightLabelX: 1349, right: 1585 },
  },
});

// NoCard sections differ: BASEBALL CARD holds STOLEN BY / POSITION / CARD
// EARNED (the last spanning the full width), then STOLEN FROM, then DATE/TIME.
const NOCARD_BACK = cardBack({
  vw: 2245, vh: 1587, edge: 2059,
  rows: {
    bcStolenBy:   { y:  592, left: 493, rightLabelX: 1276, right: 1404 },
    bcPosition:   { y:  688, left: 450, rightLabelX: 1276, right: 1520 },
    bcCardEarned: { y:  777, left: 580 },
    sfStolen:     { y: 1085, left: 584, rightLabelX: 1295, right: 1423 },
    sfPosition:   { y: 1200, left: 714, rightLabelX: 1295, right: 1539 },
    dt:           { y: 1466, left: 515, rightLabelX: 1295, right: 1554 },
  },
});

/** Shared overlay modal for Gold, Black, and Brown card backs. */
function StandardCardBackModal({
  events,
  onClose,
  frontSrc,
  backSrc,
  cardLabel,
  layout,
  accent,
}: {
  events: CardEarningEvent[];
  onClose: () => void;
  frontSrc: string;
  backSrc: string;
  cardLabel: string;
  layout: typeof GOLD_BACK;
  accent: string;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [events]);

  const ev       = events.length > 0 ? events[Math.min(idx, events.length - 1)] : null;
  const cb       = ev?.cardBack;
  const issuedAt = cb?.issuedAt ?? ev?.earnedAt;
  const boardNo  = cb?.boardTrackingNo ?? ev?.boardTrackingNumber;
  const L        = layout;

  return (
    <CardStage onClose={onClose}>
        <div className="bg-[#0e0f18] rounded-xl border border-white/10 shadow-2xl flex items-center justify-center p-4" style={{ zoom: 0.95 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frontSrc} alt="Card Front" style={{ height: GLD_H, width: "auto", display: "block" }} draggable={false} />
        </div>
        <div className="bg-[#0e0f18] rounded-xl border border-white/10 shadow-2xl flex flex-col" style={{ zoom: 0.924 }}>
          <div className="relative" style={{ width: GLD_W, height: GLD_H }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backSrc} alt="Card Back" style={{ width: GLD_W, height: GLD_H, display: "block" }} draggable={false} />
            {/* Values ride in an SVG laid over the art, in the art's own units,
                so they scale with the card and stay put at any size. */}
            <svg
              viewBox={`0 0 ${L.vw} ${L.vh}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 pointer-events-none"
              style={{ width: "100%", height: "100%" }}
            >
              {cb && (
                <>
                  {/* ── BASEBALL CARD ───────────────────────────────────── */}
                  <CardValue slot={L.left("bcAssigned")}  value={cb.assignedTo?.playerName} />
                  <CardValue slot={L.right("bcAssigned")} value={cb.assignedTo?.distributorId ?? cb.assignedTo?.playerIdNo} />
                  <CardValue slot={L.left("bcPosition")}  value={formatPosition(cb.position)} />
                  <CardValue slot={L.right("bcPosition")} value={cb.assignedTo?.entryNo} />

                  {/* ── FREE POSITION ───────────────────────────────────── */}
                  <CardValue slot={L.left("fpAssigned")}  value={cb.freePosition?.playerName ?? ev.referredUserName} />
                  <CardValue slot={L.right("fpAssigned")} value={cb.freePosition?.distributorId ?? cb.freePosition?.playerIdNo} />
                  <CardValue slot={L.left("fpAtBat")}     value={formatPosition(cb.atBatPositionNo)} />
                  <CardValue slot={L.right("fpAtBat")}    value={cb.freePosition?.entryNo} />

                  {/* ── STOLEN FROM ─────────────────────────────────────── */}
                  <CardValue slot={L.left("sfStolen")}    value={cb.stolenFrom?.playerName} />
                  <CardValue slot={L.right("sfStolen")}   value={cb.stolenFrom?.distributorId ?? cb.stolenFrom?.playerIdNo} />
                  <CardValue slot={L.left("sfPosition")}  value={formatPosition(cb.stolenFromPosition)} />
                  <CardValue slot={L.right("sfPosition")} value={cb.stolenFrom?.entryNo} />

                  {/* ── DATE/TIME ───────────────────────────────────────── */}
                  <CardValue slot={L.left("dt")}  value={issuedAt ? `${fmtEarnedAt(issuedAt)}  ${fmtEarnedTime(issuedAt)}` : null} />
                  <CardValue slot={L.right("dt")} value={boardNo} />
                </>
              )}
            </svg>
            {!cb && <CardLoading accent={accent} />}
          </div>
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-t border-white/10">
            {events.length > 1 ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="text-white/60 hover:text-white disabled:opacity-30 text-xs px-2 py-1 rounded border border-white/20 transition-colors">‹ Prev</button>
                <span className="text-white/40 text-xs tabular-nums">{idx + 1} / {events.length}</span>
                <button onClick={() => setIdx((i) => Math.min(events.length - 1, i + 1))} disabled={idx === events.length - 1} className="text-white/60 hover:text-white disabled:opacity-30 text-xs px-2 py-1 rounded border border-white/20 transition-colors">Next ›</button>
              </div>
            ) : (
              <span className="text-white/30 text-[10px]">{cardLabel}</span>
            )}
            <button onClick={onClose} className="text-white/50 hover:text-white text-xs px-3 py-1 rounded border border-white/20 transition-colors">Close ✕</button>
          </div>
        </div>
    </CardStage>
  );
}

// Thin wrappers that supply the correct art, layout and label
function GoldCardBackModal({ events, onClose }: { events: CardEarningEvent[]; onClose: () => void }) {
  return <StandardCardBackModal events={events} onClose={onClose} frontSrc="/images/bat246-gold-card.svg" backSrc="/images/bat246-gold-card-back.svg" cardLabel="Gold Card" layout={GOLD_BACK} accent="border-amber-300/30 border-t-amber-300/80" />;
}
function BlackCardBackModal({ events, onClose }: { events: CardEarningEvent[]; onClose: () => void }) {
  return <StandardCardBackModal events={events} onClose={onClose} frontSrc="/images/bat246-black-card.svg" backSrc="/images/bat246-black-card-back.svg" cardLabel="Black Card" layout={BLACK_BACK} accent="border-slate-300/30 border-t-slate-300/80" />;
}
function BrownCardBackModal({ events, onClose }: { events: CardEarningEvent[]; onClose: () => void }) {
  return <StandardCardBackModal events={events} onClose={onClose} frontSrc="/images/bat246-brown-card.svg" backSrc="/images/bat246-brown-card-back.svg" cardLabel="Brown Card" layout={BROWN_BACK} accent="border-orange-300/30 border-t-orange-300/80" />;
}

// ─── NoCardBackModal ──────────────────────────────────────────────────────────
// NoCard SVG (bat246-nocard-card-back.svg) has a different section layout:
//   BASEBALL CARD: y ~260–905 (shows the STOLEN BY = gold earner's info)
//   STOLEN FROM:   y ~905–1288 (shows the NoCard holder's own info)
//   DATE/TIME:     y ~1288–1514

function NoCardBackModal({ events, onClose }: { events: CardEarningEvent[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [events]);

  const ev       = events.length > 0 ? events[Math.min(idx, events.length - 1)] : null;
  const cb       = ev?.cardBack;
  const issuedAt = cb?.issuedAt ?? ev?.earnedAt;
  const boardNo  = cb?.boardTrackingNo ?? ev?.boardTrackingNumber;
  const L        = NOCARD_BACK;

  return (
    <CardStage onClose={onClose}>
        <div className="bg-[#0e0f18] rounded-xl border border-white/10 shadow-2xl flex items-center justify-center p-4" style={{ zoom: 0.95 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/bat246-nocard-card.jpg" alt="NoCard Front" style={{ height: GLD_H, width: "auto", display: "block" }} draggable={false} />
        </div>
        <div className="bg-[#0e0f18] rounded-xl border border-white/10 shadow-2xl flex flex-col" style={{ zoom: 0.924 }}>
          <div className="relative" style={{ width: GLD_W, height: GLD_H }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/bat246-nocard-card-back.svg" alt="NoCard Back" style={{ width: GLD_W, height: GLD_H, display: "block" }} draggable={false} />
            <svg
              viewBox={`0 0 ${L.vw} ${L.vh}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 pointer-events-none"
              style={{ width: "100%", height: "100%" }}
            >
              {cb && (
                <>
                  {/* BASEBALL CARD — stolen by (gold card earner) */}
                  <CardValue slot={L.left("bcStolenBy")}   value={cb.stolenBy?.playerName} />
                  <CardValue slot={L.right("bcStolenBy")}  value={cb.stolenBy?.distributorId ?? cb.stolenBy?.playerIdNo} />
                  <CardValue slot={L.left("bcPosition")}   value={formatPosition(cb.position)} />
                  <CardValue slot={L.right("bcPosition")}  value={cb.stolenBy?.entryNo} />
                  <CardValue slot={L.left("bcCardEarned")} value={cb.cardEarned} />
                  {/* STOLEN FROM — NoCard holder */}
                  <CardValue slot={L.left("sfStolen")}     value={cb.stolenFrom?.playerName} />
                  <CardValue slot={L.right("sfStolen")}    value={cb.stolenFrom?.distributorId ?? cb.stolenFrom?.playerIdNo} />
                  <CardValue slot={L.left("sfPosition")}   value={formatPosition(cb.stolenFromPosition)} />
                  <CardValue slot={L.right("sfPosition")}  value={cb.stolenFrom?.entryNo} />
                  {/* DATE/TIME */}
                  <CardValue slot={L.left("dt")}  value={issuedAt ? `${fmtEarnedAt(issuedAt)}  ${fmtEarnedTime(issuedAt)}` : null} />
                  <CardValue slot={L.right("dt")} value={boardNo} />
                </>
              )}
            </svg>
            {!cb && <CardLoading accent="border-red-400/30 border-t-red-400/80" />}
          </div>
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-t border-white/10">
            {events.length > 1 ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="text-white/60 hover:text-white disabled:opacity-30 text-xs px-2 py-1 rounded border border-white/20 transition-colors">‹ Prev</button>
                <span className="text-white/40 text-xs tabular-nums">{idx + 1} / {events.length}</span>
                <button onClick={() => setIdx((i) => Math.min(events.length - 1, i + 1))} disabled={idx === events.length - 1} className="text-white/60 hover:text-white disabled:opacity-30 text-xs px-2 py-1 rounded border border-white/20 transition-colors">Next ›</button>
              </div>
            ) : (
              <span className="text-white/30 text-[10px]">No Card</span>
            )}
            <button onClick={onClose} className="text-white/50 hover:text-white text-xs px-3 py-1 rounded border border-white/20 transition-colors">Close ✕</button>
          </div>
        </div>
    </CardStage>
  );
}

// ─── CardBackModal ────────────────────────────────────────────────────────────

/** Simple front-and-back reveal modal for non-green card types. */
function CardBackModal({
  type,
  frontSrc,
  backSrc,
  onClose,
}: {
  type: MiniCardType;
  frontSrc: string;
  backSrc: string;
  onClose: () => void;
}) {
  return (
    <CardStage onClose={onClose}>
        {/* Front */}
        <div className="bg-[#0e0f18] rounded-xl border border-white/10 shadow-2xl flex items-center justify-center p-4" style={{ zoom: 0.95 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frontSrc} alt="Card Front" style={{ height: GCB_H, width: "auto", display: "block" }} draggable={false} />
        </div>


        {/* Back */}
        <div className="bg-[#0e0f18] rounded-xl border border-white/10 shadow-2xl flex flex-col" style={{ zoom: 0.924 }}>
          <div className="flex items-center justify-center p-4 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backSrc} alt="Card Back" style={{ height: GCB_H, width: "auto", display: "block" }} draggable={false} />
          </div>
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-t border-white/10">
            <span className="text-white/30 text-[10px]">{CARD_LABEL[type]} Card</span>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white text-xs px-3 py-1 rounded border border-white/20 transition-colors"
            >
              Close ✕
            </button>
          </div>
        </div>
    </CardStage>
  );
}

// ─── StackedCard ───────────────────────────────────────────────────────────────

/** A single slot in a CardCase that collapses duplicates of the same color into one card with an ×N
 *  badge. When `playerId` is provided, hovering shows a card-earning history tooltip fetched from
 *  the API. Without `playerId`, falls back to showing individual card images on hover. */
export function StackedCard({
  type, count, size, trigger = "hover", playerId, eventIndex, label, tooltipLabel, imageSrc, overlayCount = false, cardClassName,
}: {
  type: MiniCardType;
  count: number;
  size: "sm" | "md";
  trigger?: "hover" | "click";
  playerId?: string;
  eventIndex?: number;
  /** Overrides the default per-type caption (e.g. distinguishing FREE vs 160 gray cards). */
  label?: string;
  /** Overrides the hover popover header text (full text, e.g. "FREE GREY CARD"). Falls back to `label`. */
  tooltipLabel?: string;
  /** Overrides the card-face art (e.g. distinguishing FREE vs 160 gray card art). Falls back to the type's default art. */
  imageSrc?: string;
  /** Extra classes for the card face itself (e.g. `border-0` to drop the card border). */
  cardClassName?: string;
  /** Leaderboard style: draws the count as a big number over the card art (with the color name above it) instead of the small ×N badge. Shown even when count is 1. */
  overlayCount?: boolean;
}) {
  const hasArt = !!(imageSrc ?? TYPE_IMAGE[type]);
  const [pop, setPop] = useState<{ top: number; left: number } | null>(null);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Stable refs so registry callbacks never go stale
  const closeFnRef = useRef<() => void>(() => {});
  const stableCloseRef = useRef<() => void>(() => {});
  const stacked = count > 1;
  const isOpen = !!pop;

  // Whether this is a green card that should show the full card-back modal on click
  const isGreenModal  = type === "green"  && trigger === "click" && !!playerId;
  const isGoldModal   = type === "gold"   && trigger === "click" && !!playerId;
  const isBlackModal  = type === "black"  && trigger === "click" && !!playerId;
  const isBrownModal  = type === "brown"  && trigger === "click" && !!playerId;
  const isNoCardModal = type === "noCard" && trigger === "click" && !!playerId;
  const isDataModal   = isGreenModal || isGoldModal || isBlackModal || isBrownModal || isNoCardModal;
  // Static back image only when no data modal handles the click
  const isCardBackModal = !!TYPE_BACK_IMAGE[type] && trigger === "click" && !isDataModal;

  const closePop = () => { setPop(null); abortRef.current?.abort(); };
  // Keep closeFnRef pointing at current closePop on every render
  closeFnRef.current = closePop;

  // Register a stable close wrapper in the global registry on mount
  useEffect(() => {
    const stable = () => closeFnRef.current();
    stableCloseRef.current = stable;
    closeRegistry.add(stable);
    return () => { closeRegistry.delete(stable); };
  }, []);

  // Close when user clicks outside this card (only while pop is open AND not in a full modal)
  useEffect(() => {
    if (!pop || isDataModal || isCardBackModal) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        closeFnRef.current();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pop, isDataModal]);

  // Fetch card history when the popover opens (debounced 150 ms).
  useEffect(() => {
    if (!isOpen || !playerId) return;

    const cacheKey = `${playerId}:${type}`;
    const cached = historyCache.get(cacheKey);
    if (cached) { setHistory(cached); return; }

    setHistory("loading");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const cardTypeParam = type.charAt(0).toUpperCase() + type.slice(1);
    const token = getToken();
    const timer = setTimeout(() => {
      fetch(`${API}/bat246/players/${playerId}/card-history?cardType=${cardTypeParam}`, {
        signal: ctrl.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),        },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: CardEarningEvent[]) => {
          historyCache.set(cacheKey, data);
          setHistory(data);
        })
        .catch((err) => {
          if ((err as any)?.name !== "AbortError") setHistory("error");
        });
    }, 150);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
      abortRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, playerId, type]);

  const openPop = (el: HTMLElement) => {
    // Close every other open card before opening this one
    for (const close of closeRegistry) {
      if (close !== stableCloseRef.current) close();
    }
    const r = el.getBoundingClientRect();
    setPop({ top: r.bottom + 8, left: r.left + r.width / 2 });
  };

  const hoverProps = trigger === "hover" && type !== "noCard" ? {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => openPop(e.currentTarget),
    onMouseLeave: closePop,
  } : {};

  const clickProps = trigger === "click" ? {
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      pop ? closePop() : openPop(e.currentTarget);
    },
  } : {};

  // Slice events to the ones relevant to this card instance
  const relevantHistory: CardEarningEvent[] =
    eventIndex !== undefined && Array.isArray(history)
      ? history.slice(eventIndex, eventIndex + count)
      : Array.isArray(history)
        ? history
        : [];

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative flex flex-col items-center justify-end gap-[1px]",
        trigger === "click" && "cursor-pointer select-none",
      )}
      style={type === "green" ? { transform: "translateY(2.5%)" } : undefined}
      {...hoverProps}
      {...clickProps}
    >
      {stacked && !overlayCount && (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 px-[2px] py-[0.5px] rounded bg-black text-white text-[6px] font-extrabold leading-none border border-white/50 shadow-[0_1px_2px_rgba(0,0,0,0.7)]">×{count}</span>
      )}
      <div className="relative">
        <MiniCard type={type} size={size} imageSrc={imageSrc} className={cardClassName} />
        {overlayCount && count > 1 && (
          <div className="absolute inset-0 z-[5] pointer-events-none">
            <span
              className={cn(
                "absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 font-extrabold text-white leading-none tabular-nums",
                size === "md" ? "text-[17px]" : "text-[13px]",
              )}
              style={{ textShadow: "0 0 3px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9), 0 0 1px #000" }}
            >
              {count}
            </span>
          </div>
        )}
      </div>
      {!stacked && !hasArt && !overlayCount ? (
        <span className="text-white font-bold uppercase leading-[1.05] tracking-tight text-center text-[6.5px]">{label ?? CARD_LABEL[type]}</span>
      ) : null}

      {/* Green card → full card-back modal with data overlay */}
      {isGreenModal && pop && (
        <GreenCardBackModal
          events={history === "loading" || history === "error" || history === null ? [] : relevantHistory}
          onClose={closePop}
        />
      )}

      {/* Gold card → full card-back modal with data overlay (includes STOLEN FROM section) */}
      {isGoldModal && pop && (
        <GoldCardBackModal
          events={history === "loading" || history === "error" || history === null ? [] : relevantHistory}
          onClose={closePop}
        />
      )}

      {isBlackModal && pop && (
        <BlackCardBackModal
          events={history === "loading" || history === "error" || history === null ? [] : relevantHistory}
          onClose={closePop}
        />
      )}

      {isBrownModal && pop && (
        <BrownCardBackModal
          events={history === "loading" || history === "error" || history === null ? [] : relevantHistory}
          onClose={closePop}
        />
      )}

      {isNoCardModal && pop && (
        <NoCardBackModal
          events={history === "loading" || history === "error" || history === null ? [] : relevantHistory}
          onClose={closePop}
        />
      )}

      {/* Non-data cards with a back image → simple front+back modal */}
      {isCardBackModal && pop && (
        <CardBackModal
          type={type}
          frontSrc={imageSrc ?? TYPE_IMAGE[type] ?? ""}
          backSrc={
            type === "gray" && imageSrc === GRAY_160_IMAGE
              ? GRAY_160_BACK_IMAGE
              : TYPE_BACK_IMAGE[type]!
          }
          onClose={closePop}
        />
      )}

      {/* All other cards (or green/gold without playerId) → small tooltip popover */}
      {!isDataModal && !isCardBackModal && pop && createPortal(
        <div
          className="z-[9999] rounded-md border border-white/15 bg-[#0e0f18] shadow-2xl overflow-hidden pointer-events-none"
          style={{ position: "fixed", top: pop.top, left: pop.left, transform: "translateX(-50%)" }}
        >
          {playerId && history !== null ? (
            <div className="p-1.5">
              <HistoryTooltip
                type={type}
                label={tooltipLabel ?? label}
                history={
                  eventIndex !== undefined && Array.isArray(history)
                    ? history.slice(eventIndex, eventIndex + count)
                    : history
                }
              />
            </div>
          ) : (
            <div className="flex items-end gap-[3px] p-1.5">
              {Array.from({ length: count }).map((_, i) => (
                <MiniCard key={i} type={type} size={size} imageSrc={imageSrc} />
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── CardCase ─────────────────────────────────────────────────────────────────

/**
 * A labeled "display case" of trading cards — black header strip + the mini cards below.
 * `frame="ppb"` draws the gold PPB border; `frame="earned"` draws a neutral border.
 * `stack` collapses duplicate colors (except green) into one ×N card with a hover popover.
 * `playerId` threads through to `StackedCard` so hovering shows card-earning history.
 */
export function CardCase({
  cards,
  size = "md",
  frame = "earned",
  minSlots = 0,
  stack = false,
  playerId,
  trigger = "hover",
  className,
  style,
  overlayCount = false,
  cardClassName,
}: {
  cards: MiniCardType[];
  size?: "sm" | "md";
  frame?: "ppb" | "earned";
  minSlots?: number;
  stack?: boolean;
  playerId?: string;
  trigger?: "hover" | "click";
  className?: string;
  style?: CSSProperties;
  overlayCount?: boolean;
  /** Extra classes for each card face (e.g. `border-0` to drop the card border). */
  cardClassName?: string;
}) {
  const dim = size === "md" ? "w-[20px] h-[28px]" : "w-[15px] h-[21px]";
  const empties = Math.max(0, minSlots - cards.length);

  // Collapse same-color cards into ×N stacks, preserving order. Green is never stacked.
  const groups: { type: MiniCardType; count: number; eventIndex?: number }[] = [];
  if (stack) {
    const typeIdx = new Map<MiniCardType, number>();
    for (const c of cards) {
      if (c === "green" || c === "noCard") {
        const idx = typeIdx.get(c) ?? 0;
        typeIdx.set(c, idx + 1);
        groups.push({ type: c, count: 1, eventIndex: idx });
        continue;
      }
      const g = groups.find((gr) => gr.type === c);
      if (g) g.count++;
      else groups.push({ type: c, count: 1 });
    }
  }

  // No real cards at all (just empty placeholder slots, e.g. an unoccupied
  // slot's green PPB box) — show a blank white case instead of the black
  // "holding real cards" background.
  const isEmptyCase = cards.length === 0;
  // Green (ppb) boxes are always white now, occupied or not — only the
  // earned (gold/black/brown) boxes still use the black "holding real
  // cards" background.
  const isGreenBox = frame === "ppb";
  return (
    <div
      className={cn(
        "inline-flex items-stretch gap-[2px] rounded-[3px] p-[1px] shadow-[0_2px_6px_rgba(0,0,0,0.55)]",
        isGreenBox || isEmptyCase ? "bg-white" : "bg-[#0b0b0d]",
        frame === "ppb" ? "border-2 border-[#3b82f6]" : "border-0",
        className,
      )}
      style={style}
    >
      {cards.length === 0 && empties === 0 ? (
        <div className={dim} />
      ) : stack ? (
        <>
          {groups.map((g, i) => (
            // frame === "ppb" is always the green PPB box (never mixed with
            // gold/black/brown), so this only ever scales green cards — a
            // couple % bigger without touching the box's own border/bg.
            <div key={`${g.type}-${i}`} style={frame === "ppb" ? { transform: "scaleX(1.03) scaleY(1.065) translateY(-1.4%)" } : undefined}>
              <StackedCard type={g.type} count={g.count} size={size} playerId={playerId} trigger={trigger} eventIndex={g.eventIndex} overlayCount={overlayCount} cardClassName={cardClassName} />
            </div>
          ))}
          {Array.from({ length: empties }).map((_, i) => (
            <div key={`e${i}`} className="flex flex-col items-center justify-end">
              {/* Sized to match a real card's art footprint (art renders at 1.18×
                  the frame size) so empty and filled cases are equal height.
                  A fully unoccupied slot (isEmptyCase) shows no dashed mark
                  at all — just blank white space filling the box, still
                  sized the same so the box itself doesn't collapse. Mixed
                  case (some real cards + some empty) shows a light dashed
                  mark visible against the box's white background. */}
              <div className={cn("rounded-[2px]", isEmptyCase ? "" : "border border-dashed border-[#3b82f6]/40 bg-blue-50", size === "md" ? "w-[23.6px] h-[33px]" : "w-[17.7px] h-[24.8px]")} />
            </div>
          ))}
        </>
      ) : (
        <>
          {cards.map((c, i) => (
            <div key={i} className="flex flex-col items-center justify-end gap-[1px]">
              {c !== "green" && (
                <span className="text-white font-bold uppercase leading-[1.05] tracking-tight text-center text-[6.5px]">{CARD_LABEL[c]}</span>
              )}
              <MiniCard type={c} size={size} />
            </div>
          ))}
          {Array.from({ length: empties }).map((_, i) => (
            <div key={`e${i}`} className="flex flex-col items-center justify-end gap-[1px]">
              <span className="text-[6.5px] leading-[1.05]">&nbsp;</span>
              <div className={cn(dim, "rounded-[2px]", isEmptyCase ? "" : "border border-dashed border-[#3b82f6]/40 bg-blue-50")} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
