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

export const OccupantAvatar = memo(
  ({ peer, isLocal }: { peer: PeerState; isLocal: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const initials = (peer.name || peer.email).slice(0, 2).toUpperCase();
    const activeScreenTrack = useMemo(
      () => getPreferredScreenTrack(peer.stream, peer.isScreenSharing),
      [peer.stream, peer.isScreenSharing]
    );
    const isScreenSharing = Boolean(peer.isScreenSharing || activeScreenTrack);
    const cameraTrack = useMemo(
      () => (!isScreenSharing ? getActiveCameraTrack(peer.stream) : null),
      [peer.stream, isScreenSharing]
    );
    const isVideoOn = Boolean(cameraTrack);

    useEffect(() => {
      if (!videoRef.current) return;
      const videoNode = videoRef.current;

      if (cameraTrack) {
        const existingStream = videoNode.srcObject as MediaStream | null;
        const existingTrackId = existingStream?.getVideoTracks()[0]?.id;

        if (existingTrackId !== cameraTrack.id) {
          videoNode.srcObject = buildSingleTrackStream(cameraTrack);
        }
      } else if (videoNode.srcObject) {
        videoNode.srcObject = null;
      }
    }, [cameraTrack]);

    return (
      <div
        className={cn(
          "relative h-24 w-24 md:h-32 md:w-32 rounded-full bg-gray-800 border-4 shadow-lg overflow-hidden flex flex-col items-center justify-center",
          isLocal ? "border-yellow-400" : "border-gray-600"
        )}
      >
        {cameraTrack && isVideoOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={cn(
              "w-full h-full object-cover",
              isLocal && "transform scale-x-[-1]"
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-700">
            {isScreenSharing ? (
              <ScreenShare className="h-12 w-12 text-blue-400" />
            ) : (
              <Avatar className="h-full w-full">
                <AvatarFallback className="text-xl bg-[#2a1752] text-[#e6d7ff]">
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}
        <div className="absolute bottom-0 w-full bg-black/50 text-white text-xs text-center p-1 truncate">
          {peer.name}
        </div>
      </div>
    );
  }
);
OccupantAvatar.displayName = "OccupantAvatar";
