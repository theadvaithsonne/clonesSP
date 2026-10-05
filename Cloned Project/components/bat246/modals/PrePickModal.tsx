"use client";

import { useState } from "react";
import { BoardData } from "../types";
import { X, ListOrdered } from "lucide-react";

const AB_SLOTS = ["AB1","AB2","AB3","AB4","AB5","AB6","AB7","AB8"] as const;
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function PrePickModal({ board, onClose }: { board: BoardData; onClose: () => void }) {
  const [playerId, setPlayerId] = useState("");
  const [targetSlot, setTargetSlot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takenSlots = new Set(board.prePick.map(p => p.targetAbSlot));

  async function save() {
    if (!playerId || !targetSlot) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("garage_tok") ?? "";
      const res = await fetch(`${API}/bat246/boards/${board._id}/prepick`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ playerId, targetAbSlot: targetSlot }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12121e] border border-white/15 rounded-xl w-[440px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-indigo-400" />
            <span className="text-white font-bold text-lg">Pre-Pick</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-white/60 text-sm">
            Reserve an At Bat slot for a specific recruit before they join. One active pre-pick per player.
          </p>

          {board.prePick.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-white/40 text-xs font-semibold uppercase tracking-wider">Active Pre-Picks</div>
              {board.prePick.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10 text-sm">
                  <span className="text-white/70 font-mono text-xs">{p.playerId.slice(-8)}</span>
                  <span className="text-indigo-300 font-bold">{p.targetAbSlot}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">Player ID</label>
            <input
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              placeholder="MongoDB player _id"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-white/25"
            />
          </div>

          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">Target Slot</label>
            <div className="grid grid-cols-4 gap-2">
              {AB_SLOTS.map(slot => (
                <button
                  key={slot}
                  onClick={() => setTargetSlot(slot)}
                  disabled={takenSlots.has(slot)}
                  className={`py-2 rounded-lg text-sm font-bold transition-colors border ${
                    targetSlot === slot
                      ? "bg-indigo-600 border-indigo-400 text-white"
                      : takenSlots.has(slot)
                      ? "bg-white/5 border-white/10 text-white/25 cursor-not-allowed"
                      : "bg-white/5 border-white/15 text-white/70 hover:border-indigo-500 hover:text-white"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            disabled={!playerId || !targetSlot || saving}
            onClick={save}
            className="w-full py-2.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {saving ? "Saving…" : "Set Pre-Pick"}
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
