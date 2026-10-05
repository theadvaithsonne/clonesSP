"use client";

import { useState } from "react";
import { BoardData } from "../types";
import { X, Mail } from "lucide-react";

export function MessageModal({ board, onClose }: { board: BoardData; onClose: () => void }) {
  const [selected, setSelected] = useState<string>("");
  const [message, setMessage] = useState("");

  const allPlayers = [
    board.homePlate,
    board.thirdBase,
    board.secondBaseA,
    board.secondBaseB,
    ...board.firstBase,
    ...board.atBat,
    ...board.dugout,
  ].filter(Boolean).map(s => s!);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12121e] border border-white/15 rounded-xl w-[480px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-sky-400" />
            <span className="text-white font-bold text-lg">Email / Message Player</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">Select Player</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">— choose a player —</option>
              {allPlayers.map((s, i) => (
                <option key={i} value={s.playerEmail ?? ""}>
                  {s.playerName} ({s.playerEmail})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your message..."
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500 placeholder:text-white/25"
            />
          </div>

          <button
            disabled={!selected || !message.trim()}
            className="w-full py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            Send Message
          </button>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
