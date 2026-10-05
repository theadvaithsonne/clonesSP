"use client";

import { BoardData } from "../types";
import { X, RefreshCcw } from "lucide-react";

export function SnapBackModal({ board, onClose }: { board: BoardData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12121e] border border-white/15 rounded-xl w-[480px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5 text-blue-400" />
            <span className="text-white font-bold text-lg">Snap-Back Loans</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-white/60 text-sm">
            A Snap-Back Loan is granted when a board splits and a player cannot fully cover their costs.
            Repayment is first-priority on every future earning.
          </p>

          <div className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-2">
            <div className="text-white/40 text-xs uppercase tracking-wider font-semibold">Board</div>
            <div className="text-white font-bold">{board.trackingNumber}</div>
          </div>

          <div className="text-white/40 text-sm text-center py-4">
            Loan records are loaded from the server. Connect backend to view active loans.
          </div>
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
