"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectSocket } from "@/lib/socket";

// Mirrors the backend's KNOCK_TIMEOUT_MS — safety net in case the
// workspace:knock-cancelled expiry event never arrives (dropped socket).
const RING_TIMEOUT_MS = 45_000;

export const PENDING_KNOCK_ACCEPT_KEY = "workspace:pending-knock-accept";

interface IncomingKnock {
  from: string;
  fromName?: string;
  fromProfilePicture?: string;
}

/**
 * Dashboard-wide incoming-knock ring. WorkspaceClient owns the full knock UX
 * on /workspace, but it unmounts everywhere else — this component (mounted in
 * the dashboard layout, which persists across page navigation) catches
 * `workspace:knock-request` on every other page.
 *
 * Decline is emitted directly (the backend decline path needs no workspace
 * presence). Accept can't be: the backend's knock-accept handler silently
 * no-ops unless the accepter is in workspace presence. So accept stashes the
 * knock in sessionStorage and navigates to /workspace; WorkspaceClient emits
 * `workspace:knock-accept` once the backend confirms presence
 * (`workspace:join-confirmed`) — mirroring the outgoing-knock handoff the
 * feed page already uses via `workspace:pending-knock`.
 */
export function GlobalKnockRing({ myName }: { myName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [knock, setKnock] = useState<IncomingKnock | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knockRef = useRef<IncomingKnock | null>(null);
  knockRef.current = knock;
  // Read inside stable socket handlers without re-registering on navigation.
  const onWorkspaceRef = useRef(false);
  onWorkspaceRef.current = !!pathname?.startsWith("/workspace");

  useEffect(() => {
    const socket = connectSocket();

    const stopRing = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (notificationRef.current) {
        notificationRef.current.close();
        notificationRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const dismiss = () => {
      stopRing();
      setKnock(null);
    };

    const handleKnockRequest = (data: IncomingKnock) => {
      console.log(
        "[GlobalKnockRing] knock-request received",
        data,
        onWorkspaceRef.current ? "(suppressed: on /workspace)" : ""
      );
      // On the office page WorkspaceClient shows its own knock panel.
      if (onWorkspaceRef.current || !data?.from) return;

      stopRing();
      setKnock(data);

      try {
        const audio = new Audio("/knock.mp3");
        audio.volume = 0.5;
        audio.loop = true;
        audioRef.current = audio;
        audio.play().catch(() => {});
      } catch {}

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        data.fromName
      ) {
        try {
          const notification = new Notification("🚪 Someone is knocking", {
            body: `${data.fromName} wants to talk to you`,
            icon: data.fromProfilePicture || undefined,
            badge: "/logo.svg",
            tag: `knock-${data.from}`,
            requireInteraction: true,
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
          notificationRef.current = notification;
        } catch {}
      }

      timeoutRef.current = setTimeout(dismiss, RING_TIMEOUT_MS);
    };

    // Knocker cancelled or the knock expired server-side. Also covers the
    // accept-then-navigate race: this component outlives page transitions, so
    // it can void a stashed accept while WorkspaceClient is still mounting —
    // otherwise the consumed accept would yank the (already gone) knocker
    // into a call.
    const handleKnockCancelled = (data?: { by?: string; from?: string }) => {
      const who = data?.from ?? data?.by;
      try {
        const raw = sessionStorage.getItem(PENDING_KNOCK_ACCEPT_KEY);
        if (raw && who && (JSON.parse(raw) as { from?: string })?.from === who) {
          sessionStorage.removeItem(PENDING_KNOCK_ACCEPT_KEY);
        }
      } catch {}
      if (knockRef.current && (!who || knockRef.current.from === who)) {
        dismiss();
      }
    };

    // Answered/declined on another of my devices (ring-everywhere, answer-once).
    const handleKnockHandled = () => dismiss();
    const handleAnsweredElsewhere = () => dismiss();

    console.log("[GlobalKnockRing] mounted — knock listeners registered");
    socket.on("workspace:knock-request", handleKnockRequest);
    socket.on("workspace:knock-cancelled", handleKnockCancelled);
    socket.on("workspace:knock-handled", handleKnockHandled);
    socket.on("livekit:call-answered-elsewhere", handleAnsweredElsewhere);

    return () => {
      socket.off("workspace:knock-request", handleKnockRequest);
      socket.off("workspace:knock-cancelled", handleKnockCancelled);
      socket.off("workspace:knock-handled", handleKnockHandled);
      socket.off("livekit:call-answered-elsewhere", handleAnsweredElsewhere);
      stopRing();
    };
  }, []);

  const stopRingUI = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const accept = () => {
    if (!knock) return;
    try {
      sessionStorage.setItem(
        PENDING_KNOCK_ACCEPT_KEY,
        JSON.stringify({ from: knock.from, fromName: knock.fromName, ts: Date.now() })
      );
    } catch {}
    stopRingUI();
    setKnock(null);
    router.push("/workspace");
  };

  const decline = () => {
    if (!knock) return;
    connectSocket().emit("workspace:knock-decline", {
      targetId: knock.from,
      byName: myName || "A colleague",
    });
    stopRingUI();
    setKnock(null);
  };

  return (
    <AnimatePresence>
      {knock && !pathname?.startsWith("/workspace") && (
        <motion.div
          className="fixed top-6 right-6 z-[9999] max-w-sm w-full"
          initial={{ opacity: 0, x: 400, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 400, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="bg-[#0e0e12]/95 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-900/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {knock.fromProfilePicture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={knock.fromProfilePicture}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                      Knock Request
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">
                    <span className="text-purple-300">
                      {knock.fromName || "Someone"}
                    </span>{" "}
                    wants to talk to you
                  </p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  onClick={accept}
                  size="sm"
                  className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 rounded-full"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  onClick={decline}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 hover:bg-red-600/20 rounded-full"
                >
                  <X className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
