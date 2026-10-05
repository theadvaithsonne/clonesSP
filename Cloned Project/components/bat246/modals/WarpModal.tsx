"use client";

import { BoardData } from "../types";
import { X, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

const WARP_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "text-white/40",
  1: "text-blue-400",
  2: "text-yellow-400",
  3: "text-orange-400",
  4: "text-red-400",
};

const WARP_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "No warp active — board is in normal PP mode",
  1: "WARP-1 — 1st Base A reached 2 sales",
  2: "WARP-2 — 1st Base B also reached 2 sales",
  3: "WARP-3 — 1st Base C also reached 2 sales",
  4: "WARP-4 — All 4 warped, clock killed, split imminent",
};

const POS_LABELS = ["1BA", "1BB", "1BC", "1BD"];

export function WarpModal({ board, onClose }: { board: BoardData; onClose: () => void }) {
  const wc = board.warpCount;

  const slots = [0, 1, 2, 3].map((i) => ({
    posLabel: POS_LABELS[i],
    slot: board.firstBase?.[i] ?? null,
    level: (i + 1) as 1 | 2 | 3 | 4,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12121e] border border-white/15 rounded-xl w-[440px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-purple-400" />
            <span className="text-white font-bold text-lg">The Warp Button</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current overall warp level */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <div className="text-[11px] text-white/40 uppercase tracking-widest mb-1">Current Warp Level</div>
            <div className={`text-3xl font-black ${WARP_COLORS[wc]}`}>
              {wc === 0 ? "—" : `WARP-${wc}`}
            </div>
            <div className="text-white/50 text-sm mt-2">{WARP_LABELS[wc]}</div>
          </div>

          {/* Per-player live warp progress */}
          <div className="space-y-2">
            {slots.map(({ posLabel, slot, level }) => {
              const ws = slot?.warpStatus ?? 0;
              const isWarped = ws >= 2;
              return (
                <div
                  key={posLabel}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 border",
                    isWarped
                      ? "bg-purple-900/30 border-purple-500/40"
                      : "bg-white/3 border-white/8",
                  )}
                >
                  {/* Level circle */}
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                    isWarped ? "bg-purple-600 text-white" : "bg-white/10 text-white/30",
                  )}>
                    {level}
                  </div>

                  {/* Position + player name + status text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-white/35 uppercase tracking-wider">{posLabel}</span>
                      <span className={cn(
                        "text-sm font-semibold truncate",
                        isWarped ? "text-purple-300" : slot ? "text-white/75" : "text-white/25",
                      )}>
                        {slot?.playerName ?? "Vacant"}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/35 mt-0.5">
                      {isWarped
                        ? "Fully warped — 2 of 2 sales made"
                        : ws === 1
                        ? "1 of 2 sales made"
                        : slot
                        ? "No sales yet — 0 of 2"
                        : "Slot empty"}
                    </div>
                  </div>

                  {/* warpStatus dots (live from slot.warpStatus) */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {[0, 1].map((dot) => (
                      <div
                        key={dot}
                        className={cn(
                          "w-3.5 h-3.5 rounded-full border",
                          dot < ws
                            ? "bg-purple-400 border-purple-300"
                            : "border-white/25 bg-transparent",
                        )}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
