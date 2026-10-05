"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { API_URL } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { getOrgId, getUserDataFromToken } from "@/lib/auth";

export interface LiveWebinarInfo {
  workshopId: string;
  title: string;
  thumbnail: string | null;
  hostName: string;
  hostProfilePicture: string | null;
  hostEmail: string;
  meetId: string;
  agoraChannel: string;
  startedAt: string;
  viewerCount: number;
  isScreenSharing: boolean;
  screenSharingByUid: number | null;
  webinarType?: "mediasoup" | "livekit";
}

const POLL_MS = 30_000;
const JOINED_TTL_MS = 30 * 60 * 1000;

function joinedKey(uid: string, wid: string) {
  return `webinar_preview_joined_${uid}_${wid}`;
}
function dismissedKey(wid: string) {
  return `webinar_preview_dismissed_${wid}`;
}

function readOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return getOrgId() || getUserDataFromToken()?.orgId || null;
}

/**
 * Detects a live webinar in the user's current organization and exposes
 * state for the floating preview popup.
 *
 * orgId is read directly from auth storage so this hook works for every
 * office without any prop drilling. It also reacts when the user switches
 * organizations in the same browser session.
 */
export function useWebinarLivePreview() {
  // Reactive orgId — updates when user switches org without a full page reload
  const [orgId, setOrgId] = useState<string | null>(readOrgId);

  const [webinar, setWebinar] = useState<LiveWebinarInfo | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isJoinedElsewhere, setIsJoinedElsewhere] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tokenData = getUserDataFromToken();
  const userId = tokenData?.userId ?? "";
  const userEmail = tokenData?.email?.toLowerCase() ?? "";

  // React to org switches (e.g. multi-org user picks a different org)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "garage_org_id") {
        setOrgId(e.newValue || getUserDataFromToken()?.orgId || null);
        // Clear stale webinar state from previous org
        setWebinar(null);
        setIsDismissed(false);
        setIsJoinedElsewhere(false);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Fetch live webinar for this org ──────────────────────────────────────
  const fetchLive = useCallback(async () => {
    if (!orgId) { setWebinar(null); return; }
    try {
      const r = await fetch(`${API_URL}/workshop-preview/live?orgId=${orgId}`, {
        cache: "no-store",
      });
      if (!r.ok) { setWebinar(null); return; }
      const d = await r.json();
      setWebinar(d.success && d.workshop ? d.workshop : null);
    } catch {
      setWebinar(null);
    }
  }, [orgId]);

  // Initial fetch + polling (resets when orgId changes)
  useEffect(() => {
    fetchLive();
    pollRef.current = setInterval(fetchLive, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLive]);

  // ── Socket: real-time live/ended events (already org-scoped by backend) ──
  // Backend joins each socket to org:${orgId} on connection, so these events
  // only arrive from the user's own organization.
  useEffect(() => {
    if (!orgId) return;
    const socket = connectSocket();

    const onLive = () => fetchLive();
    const onEnded = () => {
      setWebinar(null);
      if (userId) {
        Object.keys(localStorage)
          .filter((k) => k.startsWith(`webinar_preview_joined_${userId}_`))
          .forEach((k) => localStorage.removeItem(k));
      }
    };

    socket.on("workshop:preview:live", onLive);
    socket.on("workshop:preview:ended", onEnded);
    return () => {
      socket.off("workshop:preview:live", onLive);
      socket.off("workshop:preview:ended", onEnded);
    };
  }, [orgId, fetchLive, userId]);

  // ── Dismissed: sessionStorage per workshop (per browser tab) ─────────────
  useEffect(() => {
    if (!webinar) { setIsDismissed(false); return; }
    setIsDismissed(
      sessionStorage.getItem(dismissedKey(webinar.workshopId)) === "1"
    );
  }, [webinar?.workshopId]);

  // ── Joined elsewhere: localStorage + cross-tab storage events ────────────
  const checkJoined = useCallback(() => {
    if (!webinar || !userId) { setIsJoinedElsewhere(false); return; }
    const raw = localStorage.getItem(joinedKey(userId, webinar.workshopId));
    if (!raw) { setIsJoinedElsewhere(false); return; }
    const ts = parseInt(raw, 10);
    if (Date.now() - ts > JOINED_TTL_MS) {
      localStorage.removeItem(joinedKey(userId, webinar.workshopId));
      setIsJoinedElsewhere(false);
    } else {
      setIsJoinedElsewhere(true);
    }
  }, [webinar?.workshopId, userId]);

  useEffect(() => {
    checkJoined();
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("webinar_preview_joined")) checkJoined();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [checkJoined]);

  // ── Visibility: tab regains focus → assume user left the webinar tab ──────
  useEffect(() => {
    if (!webinar || !userId) return;
    const wid = webinar.workshopId;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const raw = localStorage.getItem(joinedKey(userId, wid));
      if (!raw) return;
      const ts = parseInt(raw, 10);
      // Give the webinar tab at least 5 s to open before we reset the flag
      if (Date.now() - ts > 5_000) {
        localStorage.removeItem(joinedKey(userId, wid));
        setIsJoinedElsewhere(false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [webinar?.workshopId, userId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isHost =
    !!webinar && !!userEmail && webinar.hostEmail.toLowerCase() === userEmail;

  // Only show for mediasoup webinars — useMediasoupAudience is mediasoup-only
  const shouldShow =
    !!webinar &&
    !isHost &&
    !isDismissed &&
    !isJoinedElsewhere &&
    webinar.webinarType !== "livekit";

  // ── Actions ───────────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    if (!webinar) return;
    sessionStorage.setItem(dismissedKey(webinar.workshopId), "1");
    setIsDismissed(true);
  }, [webinar?.workshopId]);

  const markJoined = useCallback(
    (workshopId: string) => {
      if (!userId) return;
      localStorage.setItem(joinedKey(userId, workshopId), String(Date.now()));
      setIsJoinedElsewhere(true);
    },
    [userId]
  );

  return { webinar, shouldShow, dismiss, markJoined, refetch: fetchLive };
}
