"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useMeeting } from "@/lib/meeting-context";
import MeetPipContent, {
  type PipParticipant,
} from "@/app/meet/join/MeetPipContent";
import {
  createCanvasMediaStream,
  isDocumentPipSupported as checkPipSupported,
  requestPipWindow,
} from "@/lib/livekit/pip-window";

const MEET_PATH_PREFIX = "/meet/join";

interface PipContextValue {
  openPip: () => Promise<void>;
  closePip: () => void;
  isPipSupported: boolean;
  pipWindow: Window | null;
}

const PipContext = createContext<PipContextValue>({
  openPip: async () => {},
  closePip: () => {},
  isPipSupported: false,
  pipWindow: null,
});

export const usePip = () => useContext(PipContext);

export function PipProvider({ children }: { children: ReactNode }) {
  const meeting = useMeeting();
  const router = useRouter();
  const pathname = usePathname();

  const [pipWin, setPipWin] = useState<Window | null>(null);
  const pipWinRef = useRef<Window | null>(null);
  const mediaSessionVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

  const isDocPipSupported = checkPipSupported();

  const openDocumentPip = useCallback(async () => {
    if (pipWinRef.current) return;
    // Empty-PiP guard via shared helper (skipIfVisible defaults to true)
    const pip = await requestPipWindow();
    if (!pip) return;
    pipWinRef.current = pip;
    setPipWin(pip);
    pip.addEventListener("pagehide", () => {
      pipWinRef.current = null;
      setPipWin(null);
    });
  }, []);

  const openDocumentPipManual = useCallback(async () => {
    // Manual open — bypass the visibility guard
    if (pipWinRef.current) return;
    const pip = await requestPipWindow({ skipIfVisible: false });
    if (!pip) return;
    pipWinRef.current = pip;
    setPipWin(pip);
    pip.addEventListener("pagehide", () => {
      pipWinRef.current = null;
      setPipWin(null);
    });
  }, []);

  const closePip = useCallback(() => {
    if (pipWinRef.current) {
      pipWinRef.current.close();
      pipWinRef.current = null;
      setPipWin(null);
    }
  }, []);

  // Expose closePip to non-React callers (leaveMeeting)
  useEffect(() => {
    const w = window as typeof window & { __closeMeetPip?: () => void };
    w.__closeMeetPip = closePip;
    return () => {
      delete w.__closeMeetPip;
    };
  }, [closePip]);

  // Pick best track for media session: remote camera > local camera > local mic > canvas dummy
  const mediaSessionTrack = useMemo<MediaStreamTrack | "canvas" | null>(() => {
    if (!meeting.inCall) return null;
    for (const tracks of meeting.remoteUserTracks.values()) {
      if (tracks.cameraTrack) return tracks.cameraTrack;
    }
    if (meeting.localVideoTrack) return meeting.localVideoTrack;
    if (meeting.localAudioTrack) return meeting.localAudioTrack;
    return "canvas";
  }, [
    meeting.inCall,
    meeting.remoteUserTracks,
    meeting.localVideoTrack,
    meeting.localAudioTrack,
  ]);

  // Maintain hidden video element backing the media session
  useEffect(() => {
    if (!isDocPipSupported || !meeting.inCall) return;

    if (!mediaSessionVideoRef.current) {
      const video = document.createElement("video");
      video.playsInline = true;
      video.muted = true;
      video.setAttribute("autopictureinpicture", "");
      video.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1";
      document.body.appendChild(video);
      mediaSessionVideoRef.current = video;
    }

    const video = mediaSessionVideoRef.current;

    if (mediaSessionTrack && mediaSessionTrack !== "canvas") {
      video.srcObject = new MediaStream([mediaSessionTrack]);
    } else if (mediaSessionTrack === "canvas") {
      if (!canvasStreamRef.current) {
        canvasStreamRef.current = createCanvasMediaStream();
      }
      video.srcObject = canvasStreamRef.current;
    } else {
      video.srcObject = null;
      return;
    }

    video.play().catch(() => {});

    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Garage Meeting",
          artist: "In progress",
        });
        navigator.mediaSession.playbackState = "playing";
      } catch {}
    }

    return () => {
      video.srcObject = null;
    };
  }, [isDocPipSupported, meeting.inCall, mediaSessionTrack]);

  // Register Media Session enterpictureinpicture handler
  useEffect(() => {
    if (!meeting.inCall || !isDocPipSupported) return;
    if (!("mediaSession" in navigator)) return;

    const handler = async () => {
      await openDocumentPip();
    };

    try {
      // @ts-expect-error - Chrome-only Media Session action
      navigator.mediaSession.setActionHandler("enterpictureinpicture", handler);
    } catch {}

    return () => {
      try {
        // @ts-expect-error - Chrome-only Media Session action
        navigator.mediaSession.setActionHandler("enterpictureinpicture", null);
      } catch {}
    };
  }, [meeting.inCall, isDocPipSupported, openDocumentPip]);

  // Auto-open on visibilitychange (tab hidden)
  useEffect(() => {
    if (!meeting.inCall || !isDocPipSupported) return;

    const onVis = () => {
      if (document.hidden && !pipWinRef.current) {
        openDocumentPip().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [meeting.inCall, isDocPipSupported, openDocumentPip]);

  // Auto-close stale PiP that opened while meet tab is visible.
  // Auto-close PiP when meet tab becomes visible AND user is on the meet path.
  useEffect(() => {
    if (!pipWin || !meeting.inCall) return;
    const onMeet = pathname?.startsWith(MEET_PATH_PREFIX);
    if (!onMeet) return;

    if (!document.hidden) {
      closePip();
      return;
    }

    const onVis = () => {
      if (!document.hidden && pipWinRef.current) closePip();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pipWin, meeting.inCall, pathname, closePip]);

  // Auto-close PiP when user navigates TO the meet route
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    const wasOnMeet = prevPathRef.current?.startsWith(MEET_PATH_PREFIX);
    const isOnMeet = pathname?.startsWith(MEET_PATH_PREFIX);
    prevPathRef.current = pathname;
    if (!wasOnMeet && isOnMeet && pipWinRef.current) {
      closePip();
    }
  }, [pathname, closePip]);

  // PiP closed by user → return to meeting view
  const [pipWasOpen, setPipWasOpen] = useState(false);
  useEffect(() => {
    if (pipWin) setPipWasOpen(true);
  }, [pipWin]);
  useEffect(() => {
    if (
      pipWin === null &&
      pipWasOpen &&
      meeting.minimized &&
      meeting.inCall
    ) {
      setPipWasOpen(false);
      meeting.expand();
      router.push(MEET_PATH_PREFIX);
    }
  }, [pipWin, pipWasOpen, meeting, router]);

  // Cleanup when call ends
  useEffect(() => {
    if (!meeting.inCall) closePip();
  }, [meeting.inCall, closePip]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (pipWinRef.current) {
        pipWinRef.current.close();
        pipWinRef.current = null;
      }
      if (mediaSessionVideoRef.current) {
        mediaSessionVideoRef.current.srcObject = null;
        mediaSessionVideoRef.current.remove();
        mediaSessionVideoRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach((t) => t.stop());
        canvasStreamRef.current = null;
      }
    };
  }, []);

  // Build PIP participants
  const pipParticipants = useMemo<PipParticipant[]>(() => {
    if (!meeting.inCall) return [];
    const list: PipParticipant[] = [];
    list.push({
      id: "local",
      name: meeting.meta?.displayName || "You",
      videoTrack: meeting.localVideoTrack || null,
      isMuted: meeting.isMicMuted,
      isLocal: true,
    });
    meeting.remoteUserTracks.forEach((tracks, userId) => {
      list.push({
        id: userId,
        name: meeting.userInfoMap.get(userId) || userId,
        videoTrack: tracks.cameraTrack || null,
        isMuted: !tracks.hasAudio,
        isLocal: false,
      });
    });
    return list;
  }, [
    meeting.inCall,
    meeting.meta,
    meeting.localVideoTrack,
    meeting.isMicMuted,
    meeting.remoteUserTracks,
    meeting.userInfoMap,
  ]);

  const screenShare = useMemo(() => {
    if (meeting.localScreenTrack) {
      return {
        track: meeting.localScreenTrack,
        presenterName: meeting.meta?.displayName || "You",
      };
    }
    if (meeting.screenSharerUserId) {
      const tracks = meeting.remoteUserTracks.get(meeting.screenSharerUserId);
      if (tracks?.screenTrack) {
        return {
          track: tracks.screenTrack,
          presenterName:
            meeting.userInfoMap.get(meeting.screenSharerUserId) ||
            meeting.screenSharerUserId,
        };
      }
    }
    return null;
  }, [
    meeting.localScreenTrack,
    meeting.screenSharerUserId,
    meeting.remoteUserTracks,
    meeting.userInfoMap,
    meeting.meta,
  ]);

  const ctxValue = useMemo<PipContextValue>(
    () => ({
      openPip: openDocumentPipManual,
      closePip,
      isPipSupported: isDocPipSupported,
      pipWindow: pipWin,
    }),
    [openDocumentPipManual, closePip, isDocPipSupported, pipWin],
  );

  const pipRoot =
    pipWin?.document.getElementById("pip-root") ?? null;

  return (
    <PipContext.Provider value={ctxValue}>
      {children}
      {pipWin && pipRoot && meeting.inCall &&
        createPortal(
          <MeetPipContent
            meetTitle={meeting.meta?.meetTitle || "Meeting"}
            participants={pipParticipants}
            screenShare={screenShare}
            isMicMuted={meeting.isMicMuted}
            isCameraOff={meeting.isCameraOff}
            onToggleMic={meeting.toggleMicrophone}
            onToggleCamera={meeting.toggleCamera}
            onLeaveCall={meeting.leaveMeeting}
          />,
          pipRoot,
        )}
    </PipContext.Provider>
  );
}
