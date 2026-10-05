"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { SlotData } from "./types";

/** Trophy icons in display order G → H → T (same artwork as the leaderboard chips). */
const TROPHY_ICONS: { key: "G" | "H" | "T"; src: string; label: string; imgClass?: string }[] = [
  { key: "G", src: "/images/bat246-lb-grandslam.svg", label: "Grand Slam Trophy" },
  { key: "H", src: "/images/bat246-lb-cap.svg", label: "Home Run Trophy", imgClass: "scale-[1.2]" },
  { key: "T", src: "/images/bat246-lb-trophy.svg", label: "Triple Trophy", imgClass: "scale-[1.1]" },
];

/**
 * Small cream pill showing the player's permanently earned leaderboard
 * trophies. Renders nothing when the player has none. Clicking opens a
 * large viewer modal with Prev / Next navigation across the earned trophies.
 */
/**
 * Canonical trophy display scale — the size trophies render at in the Home Plate
 * card. Every other position sizes its trophies to match this exact value so the
 * whole board stays consistent (see BaseCard / the AT BAT Slot), and any trophies
 * earned in the future automatically render at this same size.
 */
export const HOME_PLATE_TROPHY_SCALE = 1.53;

export function TrophyPill({ trophies, className, scale = 1 }: { trophies?: SlotData["trophies"]; className?: string; scale?: number }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (!trophies || (!trophies.G && !trophies.H && !trophies.T)) return null;
  const earned = TROPHY_ICONS.filter((t) => trophies[t.key]);
  const pill = (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-[2.7px] rounded-[7px] bg-[#f7f3e8] border border-black/35 shadow-[0_1px_3px_rgba(0,0,0,0.45)] px-[4.5px] py-[1.8px] -translate-y-[6px] cursor-pointer select-none",
        className,
      )}
      onClick={(e) => { e.stopPropagation(); setOpenIdx(0); }}
      title="View trophies"
    >
      {earned.map((t, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={t.key}
          src={t.src}
          alt={t.label}
          title={t.label}
          className={cn("w-[12.6px] h-[12.6px] object-contain", t.imgClass)}
          draggable={false}
          onClick={(e) => { e.stopPropagation(); setOpenIdx(i); }}
        />
      ))}
    </div>
  );
  return (
    <>
      {scale === 1 ? pill : (
        <span className="inline-block" style={{ transform: `scale(${scale})`, transformOrigin: "top right" }}>
          {pill}
        </span>
      )}
      {openIdx !== null && (
        <TrophyModal earned={earned} startIdx={openIdx} onClose={() => setOpenIdx(null)} />
      )}
    </>
  );
}

/** Full-screen trophy viewer — one trophy at a time with Prev / Next / Close. */
function TrophyModal({
  earned,
  startIdx,
  onClose,
}: {
  earned: typeof TROPHY_ICONS;
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(Math.min(startIdx, earned.length - 1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(earned.length - 1, i + 1));
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, earned.length]);

  const t = earned[idx];

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#e5e7eb] rounded-xl border-2 border-black shadow-2xl flex flex-col w-[420px] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Trophy artwork */}
        <div className="flex flex-col items-center justify-center px-8 pt-8 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.src} alt={t.label} className="h-[300px] w-auto object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]" draggable={false} />
          <div className="mt-5 text-[#16181d] font-bold text-lg tracking-wide text-center">{t.label}</div>
        </div>

        {/* Bottom bar — pagination + close (same style as the card-back modals) */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/10 border-t border-black/30 rounded-b-xl">
          {earned.length > 1 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="text-black/60 hover:text-black disabled:opacity-30 text-xs px-2 py-1 rounded border border-black/35 transition-colors"
              >
                ‹ Prev
              </button>
              <span className="text-black/50 text-xs tabular-nums">{idx + 1} / {earned.length}</span>
              <button
                onClick={() => setIdx((i) => Math.min(earned.length - 1, i + 1))}
                disabled={idx === earned.length - 1}
                className="text-black/60 hover:text-black disabled:opacity-30 text-xs px-2 py-1 rounded border border-black/35 transition-colors"
              >
                Next ›
              </button>
            </div>
          ) : (
            <span className="text-black/40 text-[10px]">Trophy</span>
          )}
          <button
            onClick={onClose}
            className="text-black/60 hover:text-black text-xs px-3 py-1 rounded border border-black/35 transition-colors"
          >
            Close ✕
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
