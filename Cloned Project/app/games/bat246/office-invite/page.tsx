"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { isAuthenticated, getUserIdFromToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Landing page for the admin "+ Invite" email — recruits a brand-new
// prospect who has no Garage account yet. Unlike the board/position join
// page, there's no board to preview: this goes straight to login/signup,
// then the Path to Bat246 Distributor gate on /games/bat246/boards.
function OfficeInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const storageListenerRef = useRef<((e: StorageEvent) => void) | null>(null);

  const ref = searchParams.get("ref") || "";
  const productId = searchParams.get("productId") || "";

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

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
        body: JSON.stringify({
          userId,
          ...(ref ? { ref } : {}),
          ...(productId ? { invitedProductId: productId } : {}),
        }),
      });
    } catch {}
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
    <div className="h-screen w-full bg-[#09090f] flex flex-col items-center justify-center px-4">
      {/* Widened from max-w-sm (384px) — at the bigger text sizes below,
          that narrow a column wrapped the description onto 5 cramped
          lines. This width lets it settle into ~2. */}
      <div className="w-full max-w-2xl text-center">
        <div className="text-[25.3px] text-blue-300/70 uppercase tracking-wider font-medium mb-1">
          You&apos;ve been invited
        </div>
        <h1 className="text-white font-bold text-[46px] mb-2">Join BAT 246</h1>
        <p className="text-white/40 text-[32.2px] mb-6">
          Sign in to see the steps to become a qualified BAT 246 distributor.
        </p>
        {/* Button keeps its own narrower width — "Get Started" doesn't
            need to stretch across the whole widened column above. */}
        <button
          onClick={handleJoin}
          disabled={claiming}
          className="w-full max-w-sm mx-auto px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-[32.2px] font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Started"}
        </button>
      </div>

      {/* Auth modal — embeds the existing login page in an iframe */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md mx-4 bg-[#0c0c0e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white text-sm font-medium">Sign in to continue</span>
              <button onClick={closeModal} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe
              // source=bat246 — the ONLY thing this flag does is tell the
              // embedded /login page to show a "Powered By" label above the
              // Garage logo (see Welcome.tsx's `showPoweredBy`). Every other
              // /login entry point is unaffected.
              src={`/login?flow=login&hideBack=1&source=bat246${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`}
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

export default function OfficeInvitePageWrapper() {
  return (
    <Suspense fallback={null}>
      <OfficeInvitePage />
    </Suspense>
  );
}
