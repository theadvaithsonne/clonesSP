"use client";

import { cn } from "@/lib/utils";
import { CardType, SlotData } from "./types";
import { CardCase, StackedCard, ppbGreenCards, earnedCards, FlagIcon, GRAY_FREE_IMAGE, GRAY_160_IMAGE } from "./MiniCard";
import { TrophyPill } from "./TrophyPill";
import { firstName } from "./nameUtils";

const CARD_BADGE: Record<Exclude<CardType, null>, string> = {
  Gold:   "bg-yellow-400 text-black",
  Black:  "bg-zinc-600 text-white",
  Brown:  "bg-amber-700 text-white",
  Gray:   "bg-neutral-400 text-black",
  Green:  "bg-green-600 text-white",
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
function fmtTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" });
}

interface HomePlateCardProps {
  slot: SlotData | null;
  totalEarning?: number;
  showCredits?: boolean;
  isHighlighted?: boolean;
  className?: string;
  /** Mobile board: larger flag/name/ID, no Date/Time lines. */
  mobileCompact?: boolean;
}

export function HomePlateCard({ slot, isHighlighted, className, mobileCompact = false }: HomePlateCardProps) {
  const greens = ppbGreenCards(slot);
  const earned = earnedCards(slot);
  const allGold = earned.filter((c) => c === "gold");
  // Only the first Gold card sits to the left of the green PPB box, always shown alone
  // (never stacked into an ×N badge). Any additional Gold cards move into the right-side
  // case, where they stack normally alongside Brown/Black.
  const goldEarned = allGold.slice(0, 1);
  const extraGold = allGold.slice(1);
  const grayEarned = earned.filter((c) => c === "gray");
  const otherEarned = [...extraGold, ...earned.filter((c) => c !== "gold" && c !== "gray")];
  const hasBrown = otherEarned.includes("brown");
  return (
    <div className={cn("w-full flex flex-col drop-shadow-[0_8px_14px_rgba(0,0,0,0.6)]", className)}>
      {/* min-height sized for a FILLED slot (name/flags row + ID line +
          scaled Gold/Green/Brown card stacks) — not just the empty state —
          so the card stays the same size whether the slot is occupied or
          blank, matching how BaseCard's per-position minHeight is sized. */}
      <div className="relative w-full min-h-[215px] flex">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 280 300"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="hpBezel" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5ea0ec" />
              <stop offset="45%" stopColor="#2f6fcf" />
              <stop offset="100%" stopColor="#173f86" />
            </linearGradient>
            <linearGradient id="hpFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#eef4fc" />
              <stop offset="100%" stopColor="#cfdef2" />
            </linearGradient>
          </defs>
          {/* Gold home-plate bezel */}
          <path d="M 140,5 L 275,95 L 275,288 Q 275,296 267,296 L 13,296 Q 5,296 5,288 L 5,95 Z" fill="url(#hpBezel)" />
          {/* Inner green fill */}
          <path d="M 140,16 L 265,100 L 265,286 Q 265,288 262,288 L 18,288 Q 15,288 15,286 L 15,100 Z" fill="url(#hpFill)" />
        </svg>

        {/* Roof sheen */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[2%] w-[80%] h-[26%] bg-gradient-to-b from-white/22 to-transparent pointer-events-none" style={{ clipPath: "polygon(50% 0, 100% 78%, 0 78%)" }} />

        {isHighlighted && (
          <div className="absolute inset-0 rounded-[10px] ring-4 ring-yellow-400 ring-offset-2 ring-offset-black shadow-[0_0_24px_6px_rgba(250,204,21,0.45)] pointer-events-none" />
        )}

        <div className="relative z-10 flex flex-col w-full px-2 pt-[26%] pb-[10px]">
          <p className="text-[#0e3a86] font-[family-name:var(--font-bat-display)] text-[18px] font-extrabold uppercase tracking-[0.14em] text-center m-0 leading-tight" style={{ transform: "translateY(-24px)" }}>Home Plate</p>

          {/* flags (share the name's own line) + name + gray cards on right.
              The trophy/gray stack is absolutely positioned (not a flex sibling)
              so its scaled-up height doesn't stretch this row and push the
              Date/Time block down with a big blank gap. */}
          <div className="relative flex items-center gap-1.5 min-h-[18px] mt-0.5 px-2" style={{ transform: "translateY(-18px)" }}>
            {slot && (
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="flex items-center gap-1 leading-none">
                  {slot.countryResidence && (
                    <FlagIcon value={slot.countryResidence} className={mobileCompact ? "w-[32px] h-[23px] flex-shrink-0" : "w-[22.05px] h-[15.75px] flex-shrink-0"} />
                  )}
                  {slot.countryOrigin && (
                    <FlagIcon value={slot.countryOrigin} className={mobileCompact ? "w-[32px] h-[23px] flex-shrink-0" : "w-[22.05px] h-[15.75px] flex-shrink-0"} />
                  )}
                  <span className={cn("font-black text-[#0e3a86] truncate leading-none", mobileCompact ? "text-[27px]" : "text-[18px]")}>
                    {firstName(slot.playerName) || "—"}
                  </span>
                </span>
                {slot.distributorId && (
                  <span className={cn("font-bold text-[#3b6fc7] leading-none", mobileCompact ? "text-[21px]" : "text-[13px]")}>
                    {mobileCompact ? "ID" : "Id"}: {slot.distributorId}{slot.entryNo ? ` - ${slot.entryNo}` : ""}
                  </span>
                )}
              </span>
            )}
            {slot && (grayEarned.length > 0 || slot.trophies) && (
              <div className="absolute top-0 right-0 flex flex-col items-end gap-[3px]" style={{ transform: "scale(1.53) translateY(calc(5% + 18px))", transformOrigin: "center right" }}>
                <TrophyPill trophies={slot.trophies} className="-translate-y-[13px] translate-x-[12px]" />
                {grayEarned.length > 0 && (
                  <div className={cn("flex gap-[2px]", slot.trophies && "-translate-y-[11px]")}>
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
          </div>

          {/* details */}
          {!mobileCompact && (
          <div className="mt-0.5 px-2 text-[#16181d] leading-[1.3]" style={{ transform: "translateY(-18px)" }}>
            <div className="text-[13px]"><span className="font-bold text-black">D:</span> {fmtDate(slot?.enteredAt)}</div>
            <div className="text-[13px]"><span className="font-bold text-black">T:</span> {fmtTime(slot?.enteredAt)}</div>
          </div>
          )}

          {(slot?.isLayaway || slot?.isLayawayPlan || slot?.isCPD) && (
            <div className="flex gap-1 flex-wrap mt-0.5 px-2">
              {slot?.isLayaway && <span className="text-[10px] font-bold text-red-600">$ LAYAWAY</span>}
              {slot?.isLayawayPlan && <span className="text-[10px] font-bold text-green-700">$ PLAN</span>}
              {slot?.isCPD && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide bg-orange-600 text-white">CPD</span>
              )}
            </div>
          )}

          {/* Not gated on `slot` — the green PPB box below always shows (with
              empty dashed placeholders when there are 0 green cards), even
              on a completely unoccupied slot. Only the Gold/other card
              cases are conditional, since earnedCards(null) already
              resolves to [] on its own. */}
          {/* The -5.5% offset only makes sense once there's real Gold/Green
              content to re-balance around — a fully blank slot has nothing
              to offset against, so it stays dead centered. */}
          <div className="mt-auto pt-1.5 flex items-end justify-center gap-1.5" style={slot && !hasBrown ? { transform: "translateX(-5.5%)" } : undefined}>
              {goldEarned.length > 0 && (
                <div className="flex" style={{ alignSelf: "flex-end", transform: "scale(1.45) translateX(-8px)", transformOrigin: "bottom center" }}>
                  <CardCase cards={goldEarned} size="md" frame="earned" stack playerId={slot?.playerId} trigger="click" overlayCount />
                </div>
              )}
              {/* PPB green cards */}
              {slot ? (
                // Occupied slot — whole box scaled up together, first card larger.
                <div className="flex" style={{ alignSelf: "flex-end", transform: "scale(1.1) translateX(-8px) translateX(0.9%)", transformOrigin: "bottom center" }}>
                <div className="inline-flex items-end gap-[10%] rounded-[3px] pt-[18.5px] pb-[1px] px-[7px] shadow-[0_2px_6px_rgba(0,0,0,0.55)] border-2 border-[#3b82f6] bg-white">
                  {Array.from({ length: Math.max(greens.length, 2) }).map((_, i) => {
                    if (i < greens.length) {
                      return (
                        <div key={i} style={i === 0 ? { transform: "scaleX(1.35) scaleY(1.6) translateY(0.2%) translateX(-2px)", transformOrigin: "bottom center" } : { transform: "scaleX(1.15) scaleY(1.31) translateY(-1.8%)", transformOrigin: "bottom center" }}>
                          <StackedCard type="green" count={1} size="md" playerId={slot?.playerId} trigger="click" eventIndex={i} overlayCount />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={i}
                        className="flex flex-col items-center justify-end gap-[1px]"
                        style={i === 0 ? { transform: "scaleX(1.35) scaleY(1.6) translateY(2%)", transformOrigin: "bottom center" } : { transform: "scale(1.15)", transformOrigin: "bottom center" }}
                      >
                        <span className="text-[6.5px] leading-[1.05]">&nbsp;</span>
                        <div className="w-[23.6px] h-[33px] rounded-[2px] border border-dashed border-[#3b82f6]/40 bg-blue-50" />
                      </div>
                    );
                  })}
                </div>
                </div>
              ) : (
                // Fully unoccupied slot — same CardCase component and 1.55
                // scale used by every other base, centered with no offset, so
                // an empty box renders at the exact same size everywhere on
                // the board regardless of position.
                <div className="flex" style={{ alignSelf: "flex-end", transform: "scale(1.55)", transformOrigin: "bottom center" }}>
                  <CardCase cards={[]} size="md" frame="ppb" minSlots={2} />
                </div>
              )}
              {otherEarned.length > 0 && (() => {
                // A tight ~1px gap after the green box here, whether it's
                // just one trailing type (brown/black/extra Gold alone) or
                // all of them together. This box is scaled 1.45× from its
                // own center, so ~half that extra size grows leftward into
                // the green box regardless of margin — 2px (not a bigger
                // negative pull) is what actually nets to ~1px once that
                // scale growth is accounted for.
                // The extra +5% push only applies when there's a real extra
                // Gold card here — that specific case needed more clearance
                // than a plain black/brown-only box, which stays at the
                // tight 1px gap.
                return (
                  <div
                    className="flex"
                    style={{
                      alignSelf: "flex-end",
                      transform: `scale(1.45)${!hasBrown ? " translateX(-8%)" : ""}${extraGold.length > 0 ? " translateX(5%)" : ""}`,
                      transformOrigin: "bottom center",
                      marginLeft: extraGold.length > 0 ? "4px" : "-4px",
                    }}
                  >
                    <CardCase cards={otherEarned} size="md" frame="earned" stack playerId={slot?.playerId} trigger="click" overlayCount />
                  </div>
                );
              })()}
          </div>
        </div>
      </div>
    </div>
  );
}
