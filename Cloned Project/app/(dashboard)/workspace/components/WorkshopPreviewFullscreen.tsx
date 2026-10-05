"use client";

import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, Volume2, VolumeX, Users, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveWorkshopData } from "../hooks/useWorkshopPreview";

interface WorkshopPreviewFullscreenProps {
  workshop: LiveWorkshopData;
  screenShareTrack: MediaStreamTrack | null;
  cameraTrack: MediaStreamTrack | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
}

// Video player component for fullscreen using native <video> element
const FullscreenVideoPlayer = memo(
  ({
    videoTrack,
    isScreenShare,
    className,
  }: {
    videoTrack: MediaStreamTrack | null;
    isScreenShare?: boolean;
    className?: string;
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      const videoEl = videoRef.current;
      if (!videoEl || !videoTrack) {
        if (videoEl) videoEl.srcObject = null;
        return;
      }

      const stream = new MediaStream([videoTrack]);
      videoEl.srcObject = stream;
      videoEl.play().catch((err) => {
        console.error("[FullscreenVideoPlayer] Failed to play:", err);
      });

      return () => {
        videoEl.srcObject = null;
      };
    }, [videoTrack]);

    if (!videoTrack) {
      return (
        <div className={cn("bg-[#111116] flex items-center justify-center", className)}>
          <div className="text-gray-500 text-sm">No video</div>
        </div>
      );
    }

    return (
      <div className={cn("relative overflow-hidden", className)}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: isScreenShare ? "contain" : "cover",
            backgroundColor: "#111116",
          }}
        />
      </div>
    );
  }
);
FullscreenVideoPlayer.displayName = "FullscreenVideoPlayer";

export const WorkshopPreviewFullscreen = memo(
  ({
    workshop,
    screenShareTrack,
    cameraTrack,
    isMuted,
    onToggleMute,
    onClose,
  }: WorkshopPreviewFullscreenProps) => {
    // Auto-unmute when entering fullscreen
    useEffect(() => {
      if (isMuted) {
        onToggleMute();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only on mount

    const hasScreenShare = !!screenShareTrack;
    const hasCamera = !!cameraTrack;

    return (
      <motion.div
        className="fixed inset-0 z-50 bg-black/95 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* LIVE badge */}
            <div className="flex items-center gap-1.5 bg-red-600 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-semibold">LIVE</span>
            </div>

            {/* Workshop title */}
            <h1 className="text-white text-lg font-semibold truncate max-w-md">
              {workshop.title}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Host info */}
            <div className="flex items-center gap-2">
              {workshop.hostProfilePicture ? (
                <img
                  src={workshop.hostProfilePicture}
                  alt={workshop.hostName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {workshop.hostName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-white text-sm font-medium">{workshop.hostName}</span>
            </div>

            {/* Viewer count */}
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4 text-white" />
              <span className="text-white text-sm">{workshop.viewerCount} watching</span>
            </div>

            {/* Audio toggle */}
            <button
              onClick={onToggleMute}
              className={cn(
                "p-2.5 rounded-full transition-colors",
                isMuted
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  : "bg-red-500 hover:bg-red-600 text-white"
              )}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {/* Minimize button */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Minimize2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 relative p-6">
          {hasScreenShare ? (
            // Screen share + camera PiP layout
            <div className="w-full h-full relative">
              {/* Main screen share */}
              <FullscreenVideoPlayer
                videoTrack={screenShareTrack}
                isScreenShare={true}
                className="w-full h-full rounded-xl"
              />

              {/* Camera PiP in bottom right */}
              {hasCamera && (
                <motion.div
                  className="absolute bottom-4 right-4 w-64 h-36 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <FullscreenVideoPlayer
                    videoTrack={cameraTrack}
                    isScreenShare={false}
                    className="w-full h-full"
                  />
                  {/* Host name label */}
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                    {workshop.hostName}
                  </div>
                </motion.div>
              )}
            </div>
          ) : hasCamera ? (
            // Camera only - centered
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden">
                <FullscreenVideoPlayer
                  videoTrack={cameraTrack}
                  isScreenShare={false}
                  className="w-full h-full"
                />
              </div>
            </div>
          ) : (
            // No video - show placeholder
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <span className="text-white text-5xl font-bold">
                    {workshop.hostName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-white text-2xl font-semibold">{workshop.hostName}</h2>
                <p className="text-gray-400">Waiting for video...</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="px-6 py-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center">
            <p className="text-gray-400 text-sm">
              You are watching as a viewer. Click outside or press ESC to minimize.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }
);
WorkshopPreviewFullscreen.displayName = "WorkshopPreviewFullscreen";
