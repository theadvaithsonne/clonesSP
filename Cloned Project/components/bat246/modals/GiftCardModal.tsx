"use client";

import { BoardData } from "../types";
import { X, Gift } from "lucide-react";

export function GiftCardModal({ board, onClose }: { board: BoardData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12121e] border border-white/15 rounded-xl w-[440px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-400" />
            <span className="text-white font-bold text-lg">Gift Card Shop</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-white/60 text-sm">
            Purchase a gift card to give someone a free entry on this board.
            Gift cards are linked to a specific board position.
          </p>

          <div className="grid grid-cols-1 gap-3">
            {[
              { name: "At Bat Entry", price: 650, description: "One At Bat slot on this board" },
              { name: "Dugout Entry", price: 650, description: "Queued Dugout position" },
            ].map((item) => (
              <div key={item.name} className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold text-sm">{item.name}</div>
                  <div className="text-white/40 text-xs mt-0.5">{item.description}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 font-bold">${item.price.toLocaleString()}</span>
                  <button className="px-3 py-1.5 rounded-lg bg-pink-700 hover:bg-pink-600 text-white text-xs font-semibold transition-colors">
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg px-4 py-3 text-yellow-300 text-xs">
            Board: {board.trackingNumber} · Minor League ${board.minorLeagueAmount.toLocaleString()}
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
