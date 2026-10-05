"use client";

import { useState } from "react";
import { BoardData } from "../types";
import { X, Pencil } from "lucide-react";

const AB_SLOTS = ["AB1","AB2","AB3","AB4","AB5","AB6","AB7","AB8"] as const;
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function PencilingModal({
  board,
  onClose,
  isPostPP,
}: { board: BoardData; onClose: () => void; isPostPP: boolean }) {
  const [playerId, setPlayerId] = useState("");
  const [targetSlot, setTargetSlot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = Date.now();
  const activePencilings = board.penciling.filter(p => new Date(p.expiresAt).getTime() > now);
  const takenSlots = new Set(activePencilings.map(p => p.targetAbSlot));

  async function save() {
    if (!playerId || !targetSlot) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("garage_tok") ?? "";
      const res = await fetch(`${API}/bat246/boards/${board._id}/penciling`, {
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
            <Pencil className="w-5 h-5 text-amber-400" />
            <span className="text-white font-bold text-lg">Penciling</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isPostPP ? (
            <div className="bg-red-900/40 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
              Penciling is only available during the Protection Period. PP has ended for this board.
            </div>
          ) : (
            <>
              <p className="text-white/60 text-sm">
                1st Base players only. Reserve an At Bat slot for 24 hours. Expires automatically.
              </p>

              {activePencilings.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-white/40 text-xs font-semibold uppercase tracking-wider">Active (expires in 24h)</div>
                  {activePencilings.map((p, i) => {
                    const expiresIn = Math.max(0, Math.floor((new Date(p.expiresAt).getTime() - now) / 3_600_000));
                    return (
                      <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10 text-sm">
                        <span className="text-white/70 font-mono text-xs">{p.playerId.slice(-8)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-300 font-bold">{p.targetAbSlot}</span>
                          <span className="text-white/30 text-xs">{expiresIn}h left</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">1st Base Player ID</label>
                <input
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  placeholder="MongoDB player _id"
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-white/25"
                />
              </div>

              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">Target At Bat Slot</label>
                <div className="grid grid-cols-4 gap-2">
                  {AB_SLOTS.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setTargetSlot(slot)}
                      disabled={takenSlots.has(slot)}
                      className={`py-2 rounded-lg text-sm font-bold transition-colors border ${
                        targetSlot === slot
                          ? "bg-amber-600 border-amber-400 text-white"
                          : takenSlots.has(slot)
                          ? "bg-white/5 border-white/10 text-white/25 cursor-not-allowed"
                          : "bg-white/5 border-white/15 text-white/70 hover:border-amber-500 hover:text-white"
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
                className="w-full py-2.5 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {saving ? "Saving…" : "Set Penciling (24h)"}
              </button>
            </>
          )}
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors">
            {isPostPP ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
