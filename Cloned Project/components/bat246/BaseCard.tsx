"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CardType, SlotData } from "./types";
import { CardCase, MiniCardType, StackedCard, ppbGreenCards, earnedCards, FlagIcon, GRAY_FREE_IMAGE, GRAY_160_IMAGE } from "./MiniCard";
import { TrophyPill, HOME_PLATE_TROPHY_SCALE } from "./TrophyPill";
import { firstName } from "./nameUtils";

const CARD_BADGE: Record<Exclude<CardType, null>, string> = {
  Gold: "bg-yellow-400 text-black",
  Black: "bg-zinc-600 text-white",
  Brown: "bg-amber-700 text-white",
  Gray: "bg-neutral-400 text-black",
  Green: "bg-green-600 text-white",
  NoCard: "bg-neutral-200 text-black",
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
function fmtTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" });
}

interface BaseCardProps {
  label: string;
  slot: SlotData | null;
  showCredits?: boolean;
  isHighlighted?: boolean;
  className?: string;
  minHeight?: number;
  cardsScale?: number;
  /** Mobile board: larger flag/name/ID, no Date/Time lines. */
  mobileCompact?: boolean;
}

export function BaseCard({ label, slot, isHighlighted, className, minHeight = 92, cardsScale = 1, mobileCompact = false }: BaseCardProps) {
  const greens = ppbGreenCards(slot);
  const earned = earnedCards(slot);
  const allGold = earned.filter((c) => c === "gold");
  // Only the first Gold card sits to the left of the green PPB box, always shown alone
  // (never stacked into an ×N badge). Any additional Gold cards move into the right-side
  // case, where they stack normally alongside Brown/Black.
  const goldEarned = allGold.slice(0, 1);
  const extraGold = allGold.slice(1);
  const grayEarned = earned.filter((c) => c === "gray");
  // 3rd Base with gray cards needs a bit more room so the extra badge row
  // doesn't crowd the Date/Time block below it.
  const effectiveMinHeight = label === "3rd Base" && grayEarned.length > 0 ? minHeight * 1.06 : minHeight;
  const otherEarned = [...extraGold, ...earned.filter((c) => c !== "gold" && c !== "gray")];
  const noCardItems: MiniCardType[] = Array.from({ length: slot?.noCards ?? 0 }, () => "noCard" as MiniCardType);
  const ppbCards: MiniCardType[] = [...greens, ...noCardItems];
  // 1st Base with both PPB green slots filled — auto-attach the WARP tab to the
  // card's left edge as a visual cue.
  const showWarpTab = label.startsWith("1st") && greens.length >= 2;

  // Gray stacks rendered in the top-right cluster — the Date/Time block below
  // reserves this much right padding so the cluster never sits on top of the
  // time text (the D/T spans wrap as whole units into a stacked layout when
  // the remaining width is too narrow, instead of being covered).
  const grayFree = slot?.freeGrayCards ?? 0;
  const gray160Cnt = slot?.grayCard160 ?? 0;
  const grayLegacy = grayFree === 0 && gray160Cnt === 0 ? (slot?.grayCards ?? 0) : 0;
  const grayStackCount = (grayFree > 0 ? 1 : 0) + (gray160Cnt > 0 ? 1 : 0) + (grayLegacy > 0 ? 1 : 0);

  // Fit the bottom mini-card row inside the card: it renders at cardsScale
  // (×1.55 on the diamond), which gets wider than the card itself once a slot
  // has earned enough cards — the stacks then spill past the card's edges and
  // over neighboring cards. Measure the row's layout width against the card's
  // inner width and lower the scale just enough to fit.
  const cardBodyRef = useRef<HTMLDivElement | null>(null);
  const cardsRowRef = useRef<HTMLDivElement | null>(null);
  const [rowScale, setRowScale] = useState(cardsScale);
  useLayoutEffect(() => {
    const body = cardBodyRef.current;
    const row = cardsRowRef.current;
    if (!body || !row) return;
    const measure = () => {
      const avail = body.clientWidth - 6;
      // Sum the stacks' layout widths (offsetWidth ignores the row's scale
      // transform, so there's no feedback loop) — the row itself is a
      // full-width flex container, so its own scrollWidth would just echo
      // the card width and never reflect how wide the content really is.
      const kids = Array.from(row.children) as HTMLElement[];
      const rowW = kids.reduce((sum, k) => sum + k.offsetWidth, 0) + 6 * Math.max(0, kids.length - 1);
      if (avail <= 0 || rowW <= 0) return;
      const s = Math.min(cardsScale, Math.max(0.6, avail / rowW));
      setRowScale((prev) => (Math.abs(prev - s) < 0.01 ? prev : s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    ro.observe(row);
    return () => ro.disconnect();
  }, [cardsScale, slot]);

  // Title fit — long player names used to truncate with "…"; shrink the
  // name's font instead (down to 9px) so the full name stays visible, and
  // only ellipsize below that floor. Imperative (measured at the base 16px,
  // then applied straight to the element) so there's no feedback loop.
  const nameRef = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const fit = () => {
      const base = mobileCompact ? 27 : 16;
      el.style.fontSize = `${base}px`;
      const natural = el.scrollWidth;
      const avail = el.clientWidth;
      if (natural > avail && avail > 0) {
        el.style.fontSize = `${Math.max(mobileCompact ? 13 : 9, Math.floor(base * (avail / natural) * 10) / 10)}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slot?.playerName, mobileCompact]);
  return (
    <div className={cn("w-full flex flex-col", className)}>
      {/* Label tab sitting on the top edge */}
      <span className="self-start relative z-20 ml-1.5 -mb-[5px] px-2 pt-px pb-[3px] rounded-t-[4px] text-white font-[family-name:var(--font-bat-display)] text-[11px] font-bold uppercase tracking-wide leading-none bg-gradient-to-b from-[#2f6fd6] to-[#0c3a86] border border-b-0 border-sky-200/60 shadow-[0_-1px_2px_rgba(0,0,0,0.35)]">
        {label}
      </span>

      {/* Rectangle card — same bezel style as AT BAT Slot */}
      <div
        className={cn(
          "relative rounded-[7px] p-[2.5px] bg-gradient-to-b from-[#5ea0ec] via-[#2f6fcf] to-[#173f86] shadow-[0_5px_9px_rgba(0,0,0,0.5)]",
          isHighlighted && "ring-4 ring-yellow-400 ring-offset-2 ring-offset-black shadow-[0_0_24px_6px_rgba(250,204,21,0.45)]",
        )}
      >
        {showWarpTab && (
          <div
            className="absolute flex items-center justify-center rounded-[10px] z-10"
            style={{ left: 0, top: "1%", bottom: "1%", width: "26.32px", transform: "translateX(-100%)", background: "linear-gradient(180deg, #0a2c6b 0%, #0d3f86 38%, #0f5a6e 70%, #11744a 100%)", boxShadow: "0 2px 5px rgba(0,0,0,0.5)" }}
          >
            <span className="text-white font-extrabold text-[19px] leading-none tracking-widest whitespace-nowrap" style={{ transform: "rotate(-90deg)", backfaceVisibility: "hidden", WebkitFontSmoothing: "antialiased", textRendering: "optimizeLegibility" }}>WARP</span>
          </div>
        )}
        <div
          ref={cardBodyRef}
          className="relative rounded-[5px] bg-gradient-to-b from-[#eef4fc] to-[#cfdef2] flex flex-col px-2 pt-1.5"
          style={{ minHeight: `${effectiveMinHeight}px` }}
        >
          {/* Trophies + gray cards — top-right corner (trophy pill sits above the grays) */}
          {slot && (grayEarned.length > 0 || slot.trophies) && (
            <div className="absolute top-[1px] right-[1px] z-10 flex flex-col items-end gap-[3px]" style={{ transform: `${cardsScale !== 1 ? `scale(${cardsScale}) ` : ""}translateY(16px)`, transformOrigin: "top right" }}>
              {/* Counter-scale the position wrapper's cardsScale so the trophy always
                  renders at the canonical Home Plate size, no matter the card scaling. */}
              <TrophyPill trophies={slot.trophies} scale={HOME_PLATE_TROPHY_SCALE / cardsScale} className="-translate-y-[24px] translate-x-[8px]" />
              {grayEarned.length > 0 && (
                <div className={cn("flex gap-[2px]", slot.trophies && "-translate-y-[27px]")}>
                  {(() => {
                    const freeGray = slot.freeGrayCards ?? 0;
                    const gray160 = slot.grayCard160 ?? 0;
                    const legacyGray = freeGray === 0 && gray160 === 0 ? (slot.grayCards ?? 0) : 0;
                    return (
                      <>
                        {freeGray > 0 && <StackedCard type="gray" count={freeGray} size="sm" playerId={slot.playerId ?? undefined} imageSrc={GRAY_FREE_IMAGE} tooltipLabel="FREE GREY CARD" trigger="click" overlayCount cardClassName="border" />}
                        {gray160 > 0 && <StackedCard type="gray" count={gray160} size="sm" playerId={slot.playerId ?? undefined} imageSrc={GRAY_160_IMAGE} tooltipLabel="160 GREY CARD" eventIndex={freeGray} trigger="click" overlayCount cardClassName="border" />}
                        {legacyGray > 0 && <StackedCard type="gray" count={legacyGray} size="sm" playerId={slot.playerId ?? undefined} trigger="click" overlayCount cardClassName="border" />}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Header: flags + name (flags share the name's own line so they
              align with it exactly; the ID/Entry line stays untouched below) */}
          <div className="flex items-center gap-1.5 min-h-[20px] pr-9">
            {slot && (
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="flex items-center gap-1 leading-none">
                  {slot.countryResidence && (
                    <FlagIcon value={slot.countryResidence} className={mobileCompact ? "w-[34px] h-[25px] flex-shrink-0" : "w-[23.625px] h-[17.325px] flex-shrink-0"} />
                  )}
                  {slot.countryOrigin && (
                    <FlagIcon value={slot.countryOrigin} className={mobileCompact ? "w-[34px] h-[25px] flex-shrink-0" : "w-[23.625px] h-[17.325px] flex-shrink-0"} />
                  )}
                  <span ref={nameRef} className="font-extrabold text-[#0e3a86] text-[16px] truncate leading-none">
                    {firstName(slot.playerName) || "—"}
                  </span>
                </span>
                {slot.distributorId && (
                  <span className={cn("font-bold text-[#3b6fc7] leading-none", mobileCompact ? "text-[22px]" : "text-[13px]")}>
                    {mobileCompact ? "ID" : "Id"}: {slot.distributorId}{slot.entryNo ? ` - ${slot.entryNo}` : ""}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Details — Date / Time (Entry moved inline next to the ID).
              1st Base stacks D: above T: instead of sharing one row. When gray
              stacks hang in the top-right corner, reserve their width so the
              time text is never covered — the D/T spans then wrap as whole
              units (1st-Base-style stacking) instead of breaking mid-value. */}
          {!mobileCompact && (
          <div className="mt-1 text-[#16181d] leading-[1.35]" style={grayStackCount > 0 ? { paddingRight: grayStackCount * 40 } : undefined}>
            {label.startsWith("1st Base") ? (
              <>
                <div className="text-[13px]"><span className="font-bold text-black">D:</span> {fmtDate(slot?.enteredAt)}</div>
                <div className="text-[13px]"><span className="font-bold text-black">T:</span> {fmtTime(slot?.enteredAt)}</div>
              </>
            ) : (
              <div className="text-[13px] flex flex-wrap gap-x-1.5">
                <span className="whitespace-nowrap"><span className="font-bold text-black">D:</span> {fmtDate(slot?.enteredAt)}</span>
                <span className="whitespace-nowrap" style={{ marginLeft: label === "3rd Base" && grayEarned.length === 2 ? 0 : "3%" }}><span className="font-bold text-black">T:</span> {fmtTime(slot?.enteredAt)}</span>
              </div>
            )}
          </div>
          )}

          {(slot?.isLayaway || slot?.isLayawayPlan || slot?.isCPD) && (
            <div className="flex gap-1 flex-wrap mt-0.5">
              {slot?.isLayaway && <span className="text-[10px] font-bold text-red-600">$ LAYAWAY</span>}
              {slot?.isLayawayPlan && <span className="text-[10px] font-bold text-green-700">$ PLAN</span>}
              {slot?.isCPD && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide bg-orange-600 text-white">CPD</span>
              )}
            </div>
          )}

          {/* Card display — gold PPB box always shows 2 slots (green cards or empty) + earned-cards box.
              2nd/3rd Base rows are left-aligned (~1% gap) with free space kept at the
              right for future cards. 1st Base stays centered — only its gold card is
              visually pulled toward the left border. */}
          {/* Not gated on `slot` — the green PPB box below (minSlots=2)
              always shows, with empty dashed placeholders when there are 0
              green cards, even on a completely unoccupied slot. */}
          {(() => {
            const isFirstBase = label.startsWith("1st");
            // 2nd Base A/B only: whenever there's no Gold card (whether the slot has
            // only green PPB cards, or green + black/brown), the green box left-aligns
            // behind a blank Gold-sized placeholder instead of sitting flush at the
            // edge or centered — so both cases line up at the same x-position.
            const isSecondBase = label === "2nd Base A" || label === "2nd Base B";
            // Requires an actual occupant — a fully unoccupied 2nd Base slot
            // has no Gold-card position to line up against, so it should
            // just center like every other empty base instead of reserving
            // this left-aligned spacer.
            const secondBaseNoGold = isSecondBase && !!slot && goldEarned.length === 0;
            // Left-align when earned cards (gold/black/brown) exist, or on 2nd Base
            // A/B even with no earned cards; a lone green PPB box elsewhere (1st/3rd
            // Base) stays centered.
            const leftAlign = !isFirstBase && (goldEarned.length > 0 || otherEarned.length > 0 || secondBaseNoGold);
            return (
              <div
                ref={cardsRowRef}
                className={cn("mt-auto pt-1.5 flex items-end", secondBaseNoGold ? undefined : "gap-1.5", leftAlign ? "justify-start -ml-[6px]" : "justify-center")}
                style={rowScale !== 1 ? { transform: `scale(${rowScale})`, transformOrigin: leftAlign ? "bottom left" : "bottom center" } : undefined}
              >
                {/* Give the earned (gold/black/brown) boxes a matching transparent 2px border so
                  they're the same height as the green PPB box (border-2) and every card lines
                  up at the same size. Scoped to base cards — Home Plate is untouched. */}
                {goldEarned.length > 0 && <CardCase cards={goldEarned} size="md" frame="earned" stack playerId={slot?.playerId} trigger="click" overlayCount className={cn("border-0 p-0 bg-transparent shadow-none scale-y-[1.18] origin-bottom", isFirstBase && "-translate-x-[20px]")} cardClassName="border !border-black" />}
                {secondBaseNoGold && <div className="w-[22px] flex-shrink-0" style={{ marginRight: "6px" }} aria-hidden />}
                <CardCase
                  cards={ppbCards}
                  size="md"
                  frame="ppb"
                  minSlots={2}
                  stack
                  playerId={slot?.playerId}
                  trigger="click"
                  overlayCount
                  className={cn(
                    "px-[3px]",
                    isFirstBase ? (goldEarned.length > 0 ? "-translate-x-[26px]" : undefined) : goldEarned.length > 0 ? "-ml-[4px]" : undefined,
                    secondBaseNoGold && "scale-x-[0.93] origin-left",
                  )}
                />
                {otherEarned.length > 0 && (
                  <CardCase
                    cards={otherEarned}
                    size="md"
                    frame="earned"
                    stack
                    playerId={slot?.playerId}
                    trigger="click"
                    overlayCount
                    className={cn("border-0 p-0 bg-transparent shadow-none scale-y-[1.18] origin-bottom", !isFirstBase && !secondBaseNoGold && "-ml-[4px]")}
                    style={secondBaseNoGold ? { marginLeft: "-1%" } : undefined}
                    cardClassName="border !border-black"
                  />
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
