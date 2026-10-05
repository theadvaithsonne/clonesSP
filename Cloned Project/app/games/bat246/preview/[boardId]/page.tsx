"use client";

import { use, useEffect, useState } from "react";
import { BoardLayout } from "@/components/bat246/BoardLayout";
import { BoardData } from "@/components/bat246/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function BoardPreviewPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = use(params);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) return;
    fetch(`${API}/bat246/boards/${boardId}/public`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.board) setBoard(d.board); })
      .finally(() => setLoading(false));
  }, [boardId]);

  return (
    <div className="min-h-screen w-full bg-[#09090f] flex flex-col">
      <div className="flex-shrink-0 px-4 py-3 bg-black/40 border-b border-white/10">
        <div className="text-white font-bold text-sm">
          Board Preview{board?.trackingNumber ? ` — ${board.trackingNumber}` : ""}
        </div>
      </div>

      <div className="flex-1 overflow-auto min-w-[860px] w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/40 gap-3">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            Loading…
          </div>
        ) : board ? (
          <BoardLayout board={board} readOnly />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
            <div className="text-white/20 text-4xl">🏟️</div>
            <div className="text-white/60 font-semibold">Board preview unavailable</div>
          </div>
        )}
      </div>
    </div>
  );
}
