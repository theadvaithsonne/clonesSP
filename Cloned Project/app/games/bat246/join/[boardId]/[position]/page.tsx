"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, X, Loader2 } from "lucide-react";
import { BoardLayout } from "@/components/bat246/BoardLayout";
import { BoardData } from "@/components/bat246/types";
import { isAuthenticated, getUserIdFromToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const POSITION_LABELS: Record<string, string> = {
  thirdBase: "3rd Base", secondBaseA: "2nd Base A", secondBaseB: "2nd Base B",
  "1stA": "1st Base A", "1stB": "1st Base B", "1stC": "1st Base C", "1stD": "1st Base D",
  "atBat-0": "AT BAT 1", "atBat-1": "AT BAT 2", "atBat-2": "AT BAT 3", "atBat-3": "AT BAT 4",
  "atBat-4": "AT BAT 5", "atBat-5": "AT BAT 6", "atBat-6": "AT BAT 7", "atBat-7": "AT BAT 8",
  "unassigned": "Open Position (assigned on approval)",
};

export default function JoinPositionPage({ params }: { params: Promise<{ boardId: string; position: string }> }) {
  const { boardId, position } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const storageListenerRef = useRef<((e: StorageEvent) => void) | null>(null);

  useEffect(() => {
    if (!boardId) return;
    const fetchBoard = () =>
      fetch(`${API}/bat246/boards/${boardId}/public`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.board) setBoard(d.board); })
        .finally(() => setLoading(false));
    fetchBoard();
    // Keep in sync with the live board (e.g. PP time getting reset/extended)
    // instead of freezing on whatever was fetched when the invite link was opened.
    const id = setInterval(fetchBoard, 10_000);
    return () => clearInterval(id);
  }, [boardId]);

  const ref = searchParams.get("ref") || "";
  const posLabel = POSITION_LABELS[position] ?? position;

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  // Clean up storage listener on unmount
  useEffect(() => {
    return () => {
      if (storageListenerRef.current) {
        window.removeEventListener("storage", storageListenerRef.current);
      }
    };
  }, []);

  async function claimAndGo(userId: string) {
    const tok = localStorage.getItem("garage_tok") ?? "";
    try {
      await fetch(`${API}/bat246/claim-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, boardId, position, ...(ref ? { ref } : {}) }),
      });
    } catch {}
    // Join the Bat246 office so the token is scoped to the right org
    try {
      const r = await fetch(`${API}/bat246/office/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      });
      if (r.ok) {
        const { token, orgId: joinedOrgId } = await r.json();
        if (token) {
          localStorage.setItem("garage_tok", token);
          localStorage.setItem("garage_org_id", joinedOrgId || "6a0d34e677323d1b81c6469b");
        }
      }
    } catch {}
    router.push("/games/bat246/boards");
  }

  function openModal() {
    setShowModal(true);
    // Listen for token saved by the login page inside the iframe
    const handler = (e: StorageEvent) => {
      if (e.key === "garage_tok" && e.newValue) {
        window.removeEventListener("storage", handler);
        storageListenerRef.current = null;
        setShowModal(false);
        const uid = getUserIdFromToken();
        if (uid) claimAndGo(uid);
      }
    };
    storageListenerRef.current = handler;
    window.addEventListener("storage", handler);
  }

  function closeModal() {
    setShowModal(false);
    if (storageListenerRef.current) {
      window.removeEventListener("storage", storageListenerRef.current);
      storageListenerRef.current = null;
    }
  }

  async function handleJoin() {
    if (authed) {
      const uid = getUserIdFromToken();
      if (!uid) return;
      setClaiming(true);
      await claimAndGo(uid);
      return;
    }
    openModal();
  }

  return (
    <div className="h-screen w-full bg-[#09090f] flex flex-col overflow-auto">
      {/* Back nav */}
      <div className="flex-shrink-0 px-4 py-2 bg-black/40 border-b border-white/10">
        <Link href="/games/bat246/boards" className="inline-flex items-center gap-1 text-white/40 hover:text-white/80 text-xs transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
          All Boards
        </Link>
      </div>

      {/* Invite banner */}
      <div className="flex-shrink-0 px-4 py-3 bg-blue-950/60 border-b border-blue-400/20 flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] text-blue-300/70 uppercase tracking-wider font-medium mb-0.5">You've been invited</div>
          <div className="text-white font-semibold text-sm">Join at <span className="text-blue-300">{posLabel}</span></div>
        </div>

        <button
          onClick={handleJoin}
          disabled={claiming}
          className="flex-shrink-0 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center gap-2"
        >
          {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
        </button>
      </div>

      {/* Board preview */}
      <div className="flex-1 min-w-[860px] w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/40 gap-3">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            Loading…
          </div>
        ) : board ? (
          <BoardLayout board={board} highlightPosition={position} readOnly />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
            <div className="text-white/20 text-4xl">🏟️</div>
            <div className="text-white/60 font-semibold">Board preview unavailable</div>
            <p className="text-white/30 text-sm max-w-xs">This board could not be loaded.</p>
          </div>
        )}
      </div>

      {/* Auth modal — embeds the existing login page in an iframe */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md mx-4 bg-[#0c0c0e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white text-sm font-medium">Sign in to claim your spot</span>
              <button onClick={closeModal} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe
              src="/login?flow=login&hideBack=1"
              className="w-full border-0"
              style={{ height: 580 }}
              title="Sign in"
            />
          </div>
        </div>
      )}
    </div>
  );
}
