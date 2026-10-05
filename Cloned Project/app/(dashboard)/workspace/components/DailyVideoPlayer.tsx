"use client";
import React, { useRef, useEffect, useCallback } from "react";

interface DailyVideoPlayerProps {
  videoTrack: MediaStreamTrack | null | undefined;
  isLocal?: boolean;
  userName?: string;
  showMicMuted?: boolean;
  isScreenShare?: boolean;
}

const DailyVideoPlayer: React.FC<DailyVideoPlayerProps> = ({
  videoTrack,
  isLocal,
  userName,
  showMicMuted,
  isScreenShare,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Main effect: set srcObject on the video element when the track changes
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (!videoTrack) {
      videoEl.srcObject = null;
      setIsLoading(false);
      return;
    }

    console.log("[DailyVideoPlayer] Setting video track:", {
      trackId: videoTrack.id,
      kind: videoTrack.kind,
      readyState: videoTrack.readyState,
      enabled: videoTrack.enabled,
      muted: videoTrack.muted,
      label: videoTrack.label,
      isLocal,
      isScreenShare,
      videoElDimensions: `${videoEl.clientWidth}x${videoEl.clientHeight}`,
    });

    setIsLoading(true);

    const stream = new MediaStream([videoTrack]);
    videoEl.srcObject = stream;

    const handlePlaying = () => {
      setIsLoading(false);
      console.log("[DailyVideoPlayer] Video playing:", {
        isScreenShare,
        videoWidth: videoEl.videoWidth,
        videoHeight: videoEl.videoHeight,
      });
    };

    const handleError = (e: Event) => {
      console.error("[DailyVideoPlayer] Video element error:", e, {
        isScreenShare,
        trackReadyState: videoTrack.readyState,
        error: videoEl.error,
      });
    };

    videoEl.addEventListener("playing", handlePlaying);
    videoEl.addEventListener("error", handleError);

    // Auto-play with fallback
    videoEl.play().catch((err) => {
      console.warn("[DailyVideoPlayer] Autoplay failed:", err, { isScreenShare });
      setIsLoading(false);
    });

    return () => {
      videoEl.removeEventListener("playing", handlePlaying);
      videoEl.removeEventListener("error", handleError);
    };
  }, [videoTrack, isLocal, isScreenShare]);

  // Clean up srcObject on unmount
  useEffect(() => {
    return () => {
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, []);

  const shouldMirror = isLocal && !isScreenShare;
  const objectFit = isScreenShare ? "contain" : "cover";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      {/* Native video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          backgroundColor: "#1a1a1a",
          transform: shouldMirror ? "scaleX(-1)" : undefined,
          display: videoTrack ? "block" : "none",
        }}
      />

      {/* Loading indicator when initializing screen share */}
      {isLoading && videoTrack && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(26, 26, 26, 0.9)",
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid rgba(168, 85, 247, 0.2)",
              borderTop: "4px solid rgba(168, 85, 247, 1)",
              borderRadius: "50%",
              animation: "daily-spin 1s linear infinite",
            }}
          />
          <div
            style={{
              marginTop: "16px",
              fontSize: "14px",
              fontWeight: "500",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            Loading screen share...
          </div>
          <style>
            {`
              @keyframes daily-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}

      {/* Avatar overlay when camera is off */}
      {!videoTrack && userName && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a1a",
            zIndex: 1,
          }}
        >
          {/* Avatar circle */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              fontWeight: "600",
              color: "white",
              marginBottom: "12px",
              boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          {/* User name below avatar */}
          <div
            style={{
              fontSize: "14px",
              fontWeight: "500",
              color: "rgba(255, 255, 255, 0.9)",
              textAlign: "center",
            }}
          >
            {userName}
          </div>
          {/* Camera off & mic muted indicators */}
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "rgba(255, 255, 255, 0.5)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56"></path>
              </svg>
              Camera off
            </div>
            {showMicMuted && (
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(239, 68, 68, 0.9)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
                Mic off
              </div>
            )}
          </div>
        </div>
      )}

      {/* User name label - only show when video is on */}
      {userName && videoTrack && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
            gap: "8px",
          }}
        >
          <div
            style={{
              padding: "4px 12px",
              backgroundColor: isLocal
                ? "rgba(168, 85, 247, 0.9)"
                : "rgba(0, 0, 0, 0.7)",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: isLocal ? "600" : "500",
              color: "white",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
              zIndex: 10,
            }}
          >
            {userName}
          </div>
          {/* Mic muted indicator */}
          {showMicMuted && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.9)",
                borderRadius: "9999px",
                padding: "6px",
                zIndex: 10,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyVideoPlayer;
