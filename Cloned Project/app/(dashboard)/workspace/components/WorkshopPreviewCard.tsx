"use client";

import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX, Users, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveWorkshopData } from "../hooks/useWorkshopPreview";

interface WorkshopPreviewCardProps {
  workshop: LiveWorkshopData;
  screenShareTrack: MediaStreamTrack | null;
  cameraTrack: MediaStreamTrack | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onExpand: () => void;
  isConnecting: boolean;
}

// Simple video player component for preview using native <video> element
const PreviewVideoPlayer = memo(
  ({
    videoTrack,
    isScreenShare,
  }: {
    videoTrack: MediaStreamTrack | null;
    isScreenShare?: boolean;
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
        console.error("[PreviewVideoPlayer] Failed to play:", err);
      });

      return () => {
        videoEl.srcObject = null;
      };
    }, [videoTrack]);

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: isScreenShare ? "contain" : "cover",
          backgroundColor: "#1a1a1a",
        }}
      />
    );
  }
);
PreviewVideoPlayer.displayName = "PreviewVideoPlayer";

export const WorkshopPreviewCard = memo(
  ({
    workshop,
    screenShareTrack,
    cameraTrack,
    isMuted,
    onToggleMute,
    onExpand,
    isConnecting,
  }: WorkshopPreviewCardProps) => {
    // Prioritize screen share, fall back to camera
    const displayTrack = screenShareTrack || cameraTrack;
    const isScreenShare = !!screenShareTrack;

    return (
      <motion.div
        className="w-full mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div
          className={cn(
            "relative rounded-xl overflow-hidden bg-[#1a1a20]/80 backdrop-blur-sm border border-red-500/30",
            "shadow-lg shadow-red-500/10 cursor-pointer group",
            "hover:border-red-500/50 hover:shadow-red-500/20 transition-all duration-200"
          )}
          onClick={onExpand}
        >
          {/* LIVE Badge */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-xs font-semibold">LIVE</span>
            </div>
            <div className="bg-black/70 px-2 py-1 rounded-full">
              <span className="text-white text-xs font-medium truncate max-w-[200px] block">
                {workshop.title}
              </span>
            </div>
          </div>

          {/* Video Preview Area */}
          <div className="relative aspect-video max-h-[200px] bg-[#111116]">
            {isConnecting ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                  <span className="text-gray-400 text-xs">Connecting...</span>
                </div>
              </div>
            ) : displayTrack ? (
              <PreviewVideoPlayer
                videoTrack={displayTrack}
                isScreenShare={isScreenShare}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {workshop.hostName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">{workshop.hostName}</span>
                  <span className="text-gray-500 text-xs">Waiting for video...</span>
                </div>
              </div>
            )}

            {/* Gradient overlay at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

            {/* Expand icon on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Maximize2 className="w-8 h-8 text-white" />
                <span className="text-white text-sm font-medium">Click to expand</span>
              </div>
            </div>
          </div>

          {/* Bottom info bar */}
          <div className="px-4 py-3 flex items-center justify-between bg-[#111116]/50">
            <div className="flex items-center gap-3">
              {/* Host avatar */}
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
              <div className="flex flex-col">
                <span className="text-white text-sm font-medium">{workshop.hostName}</span>
                <span className="text-gray-400 text-xs">Host</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Viewer count */}
              <div className="flex items-center gap-1.5 text-gray-400">
                <Users className="w-4 h-4" />
                <span className="text-xs">{workshop.viewerCount}</span>
              </div>

              {/* Mute toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute();
                }}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isMuted
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                )}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);
WorkshopPreviewCard.displayName = "WorkshopPreviewCard";
