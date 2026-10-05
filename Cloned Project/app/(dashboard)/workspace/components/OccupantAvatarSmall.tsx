"use client";

import { memo, useMemo, useRef, useEffect } from "react";
import { PeerState } from "../types";
import {
  getPreferredScreenTrack,
  getActiveCameraTrack,
  buildSingleTrackStream,
} from "../utils";
import { cn } from "@/lib/utils";
import { ScreenShare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";

export const OccupantAvatarSmall = memo(
  ({
    peer,
    isLocal,
    initials,
    isVideoOn,
    isScreenSharing,
    onWatchScreenShare,
  }: {
    peer: PeerState;
    isLocal: boolean;
    initials: string;
    isVideoOn?: boolean;
    isScreenSharing?: boolean;
    onWatchScreenShare: () => void;
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const screenTrack = useMemo(
      () =>
        getPreferredScreenTrack(
          peer.stream,
          isScreenSharing || peer.isScreenSharing
        ),
      [peer.stream, isScreenSharing, peer.isScreenSharing]
    );
    const cameraTrack = useMemo(
      () => (isVideoOn ? getActiveCameraTrack(peer.stream) : null),
      [peer.stream, isVideoOn]
    );
    const trackToUse = screenTrack ? null : cameraTrack;

    useEffect(() => {
      if (!videoRef.current) return;

      const element = videoRef.current;

      if (trackToUse) {
        const existingStream = element.srcObject as MediaStream | null;
        const existingTrackId = existingStream?.getVideoTracks()[0]?.id;

        if (existingTrackId !== trackToUse.id) {
          element.srcObject = buildSingleTrackStream(trackToUse);
        }
        element.muted = true;
        void element.play().catch(() => {});
      } else if (element.srcObject) {
        element.srcObject = null;
      }
    }, [trackToUse]);

    const showVideo = Boolean(trackToUse);

    return (
      <motion.div
        className="relative h-8 w-8 rounded-full border border-[#3a3a45] overflow-hidden cursor-pointer hover:border-[#4a4a55] transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          if (screenTrack) {
            onWatchScreenShare();
          }
        }}
        initial={{ opacity: 0, scale: 0, rotate: -180 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0, rotate: 180 }}
        transition={{ duration: 0.3, ease: "backOut" }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        layout
      >
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted // Mute all small previews to prevent audio feedback
            className={cn(
              "w-full h-full object-cover",
              isLocal && !!cameraTrack && "transform scale-x-[-1]"
            )}
          />
        ) : (
          <Avatar className="h-full w-full">
            {peer.profilePicture ? (
              <img
                src={peer.profilePicture}
                alt={peer.name || peer.email}
                className="h-full w-full object-cover"
              />
            ) : (
              <AvatarFallback className="text-[8px] bg-[#2a1752] text-[#e6d7ff]">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
        )}

        {screenTrack && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <ScreenShare className="h-3 w-3 text-blue-300" />
          </div>
        )}

        {/* Recording Indicator */}
        {peer.isRecording && (
          <div
            className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-red-600 border-2 border-[#1a1a20] animate-pulse"
            title={`${peer.name || "User"} is recording`}
          />
        )}

        <div
          className={cn(
            "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#1a1a20]",
            isLocal ? "bg-green-400" : "bg-blue-400"
          )}
        />
      </motion.div>
    );
  }
);
OccupantAvatarSmall.displayName = "OccupantAvatarSmall";
