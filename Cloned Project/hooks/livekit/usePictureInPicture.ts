"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCanvasMediaStream,
  isDocumentPipSupported,
  requestPipWindow,
} from "@/lib/livekit/pip-window";

/**
 * Document Picture-in-Picture hook. Used by webinar (standalone).
 * The meet flow uses the global PipProvider instead.
 *
 * Features:
 * - Auto-open on document.visibilitychange
 * - Media Session enterpictureinpicture handler (Chrome auto-PiP on tab switch)
 * - Canvas dummy stream when fallbackTrack is null (cam+mic both off)
 * - Empty-PiP guard: won't open over a visible host page
 */
export function usePictureInPicture(
  inCall: boolean,
  fallbackTrack: MediaStreamTrack | null,
) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const mediaSessionVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

  const supported = useMemo(() => isDocumentPipSupported(), []);

  const openPip = useCallback(async () => {
    if (pipWindowRef.current) return;
    const pip = await requestPipWindow({ skipIfVisible: false });
    if (!pip) return;
    pipWindowRef.current = pip;
    setPipWindow(pip);
    pip.addEventListener("pagehide", () => {
      pipWindowRef.current = null;
      setPipWindow(null);
    });
  }, []);

  const closePip = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setPipWindow(null);
    }
  }, []);

  // Hidden video element for media session (canvas fallback when no track)
  useEffect(() => {
    if (!supported || !inCall) return;

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

    if (fallbackTrack) {
      video.srcObject = new MediaStream([fallbackTrack]);
    } else {
      if (!canvasStreamRef.current) {
        canvasStreamRef.current = createCanvasMediaStream();
      }
      video.srcObject = canvasStreamRef.current;
    }

    video.play().catch(() => {});

    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Garage Webinar",
          artist: "In progress",
        });
        navigator.mediaSession.playbackState = "playing";
      } catch {}
    }

    return () => {
      video.srcObject = null;
    };
  }, [supported, inCall, fallbackTrack]);

  // Media session enterpictureinpicture action
  useEffect(() => {
    if (!inCall || !supported || !("mediaSession" in navigator)) return;

    const handler = async () => {
      // Use empty-PiP guard via skipIfVisible
      if (pipWindowRef.current) return;
      const pip = await requestPipWindow({ skipIfVisible: true });
      if (!pip) return;
      pipWindowRef.current = pip;
      setPipWindow(pip);
      pip.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipWindow(null);
      });
    };

    try {
      // @ts-expect-error - Chrome-only Media Session action
      navigator.mediaSession.setActionHandler("enterpictureinpicture", handler);
    } catch {}

    return () => {
      try {
        // @ts-expect-error
        navigator.mediaSession.setActionHandler("enterpictureinpicture", null);
      } catch {}
    };
  }, [inCall, supported]);

  // Auto-open on visibilitychange
  useEffect(() => {
    if (!inCall || !supported) return;

    const onVis = async () => {
      if (document.hidden && !pipWindowRef.current) {
        const pip = await requestPipWindow({ skipIfVisible: false });
        if (!pip) return;
        pipWindowRef.current = pip;
        setPipWindow(pip);
        pip.addEventListener("pagehide", () => {
          pipWindowRef.current = null;
          setPipWindow(null);
        });
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [inCall, supported]);

  // Cleanup when leaving call
  useEffect(() => {
    if (!inCall) closePip();
  }, [inCall, closePip]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
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

  return {
    pipWindow,
    openPip,
    closePip,
    isPipSupported: supported,
  };
}
