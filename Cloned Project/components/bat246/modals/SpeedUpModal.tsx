"use client";

import { BoardData } from "../types";
import { X, Zap } from "lucide-react";

export function SpeedUpModal({ board, onClose }: { board: BoardData; onClose: () => void }) {
  const emptyAbSlots = board.atBat.filter(s => !s).length;
  const emptyDugoutSlots = Math.max(0, 8 - board.dugout.filter(Boolean).length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12121e] border border-white/15 rounded-xl w-[440px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold text-lg">Speed Up Your Board</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-white/60 text-sm">
            Fill empty At Bat and Dugout slots faster by recruiting more players. More players = faster warp = faster split.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
              <div className="text-2xl font-black text-yellow-400">{emptyAbSlots}</div>
              <div className="text-white/50 text-xs mt-1">At Bat slots open</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
              <div className="text-2xl font-black text-blue-400">{emptyDugoutSlots}</div>
              <div className="text-white/50 text-xs mt-1">Dugout slots open</div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-3">Board Status</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Warp Level</span>
                <span className="text-purple-300 font-bold">{board.warpCount === 0 ? "None" : `WARP-${board.warpCount}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Board Status</span>
                <span className="text-white font-semibold capitalize">{board.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Tracking #</span>
                <span className="text-white font-semibold">{board.trackingNumber}</span>
              </div>
            </div>
          </div>

          <p className="text-white/40 text-xs text-center">
            Share the board link with your recruits to fill the remaining slots.
          </p>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
