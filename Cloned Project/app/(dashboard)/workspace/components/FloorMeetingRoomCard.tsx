"use client";

import { memo, useMemo } from "react";
import { PeerState, Floor } from "../types";
import {
  getPreferredScreenTrack,
  getActiveCameraTrack,
  buildSingleTrackStream,
} from "../utils";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ScreenShareCard } from "./ScreenShareCard";
import { OccupantAvatarSmall } from "./OccupantAvatarSmall";

export const FloorMeetingRoomCard = memo(
  ({
    floor,
    occupants,
    meId,
    isJoining,
    onJoin,
    onWatchScreenShare,
  }: {
    floor: Floor;
    occupants: PeerState[];
    meId: string;
    isJoining?: boolean;
    onJoin: () => void;
    onWatchScreenShare: (peer: PeerState) => void;
  }) => {
    const amInRoom = occupants.some((p) => p.id === meId);
    const screenSharers = useMemo(
      () =>
        occupants
          .map((peer) => {
            const track = getPreferredScreenTrack(
              peer.stream,
              peer.isScreenSharing
            );
            return track ? { peer, track } : null;
          })
          .filter(
            (entry): entry is { peer: PeerState; track: MediaStreamTrack } =>
              Boolean(entry)
          ),
      [occupants]
    );

    return (
      <motion.div
        className={cn(
          "relative p-4 border rounded-lg bg-[#1a1a20]/50 backdrop-blur-sm shadow-lg w-[280px] min-h-[160px] group",
          amInRoom ? "border-cyan-400/50" : isJoining ? "border-cyan-400/40" : "border-cyan-500/30",
          !amInRoom && !isJoining && "cursor-pointer hover:border-cyan-500/50 hover:shadow-md"
        )}
        onClick={!amInRoom && !isJoining ? onJoin : undefined}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ scale: !amInRoom ? 1.02 : 1 }}
        layout
      >
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-cyan-300 truncate">
            {floor.name}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Meeting Room</p>
        </div>

        <p className="text-xs text-gray-400">
          {occupants.length} member{occupants.length !== 1 ? "s" : ""} inside
        </p>

        {/* {screenSharers.length > 0 && (
          <div className="mt-3 space-y-2">
            {screenSharers.map(({ peer, track }) => (
              <ScreenShareCard
                key={`${peer.id}-screen`}
                peer={peer}
                screenTrack={track}
                onWatch={() => {
                  const previewStream = buildSingleTrackStream(track);
                  if (!previewStream) return;
                  onWatchScreenShare({
                    ...peer,
                    stream: previewStream,
                    isScreenSharing: true,
                  });
                }}
              />
            ))}
          </div>
        )} */}

        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {occupants.slice(0, 3).map((peer) => {
            const initials = (peer.name || peer.email)
              .slice(0, 2)
              .toUpperCase();
            const isLocal = peer.id === meId;
            const screenTrack = getPreferredScreenTrack(
              peer.stream,
              peer.isScreenSharing
            );
            const isScreenSharing = Boolean(
              peer.isScreenSharing || screenTrack
            );
            const cameraTrack = !isScreenSharing
              ? getActiveCameraTrack(peer.stream)
              : null;
            const isVideoOn = Boolean(cameraTrack);

            return (
              <OccupantAvatarSmall
                key={peer.id}
                peer={peer}
                isLocal={isLocal}
                initials={initials}
                isVideoOn={isVideoOn}
                isScreenSharing={isScreenSharing}
                onWatchScreenShare={() => {
                  if (!screenTrack) return;
                  const previewStream = buildSingleTrackStream(screenTrack);
                  if (!previewStream) return;
                  onWatchScreenShare({
                    ...peer,
                    stream: previewStream,
                    isScreenSharing: true,
                  });
                }}
              />
            );
          })}
          {occupants.length > 3 && (
            <div className="h-8 w-8 rounded-full bg-gray-600 border border-[#3a3a45] flex items-center justify-center">
              <span className="text-[8px] text-gray-300 font-medium">
                +{occupants.length - 3}
              </span>
            </div>
          )}
        </div>

        {isJoining && (
          <div className="absolute inset-0 bg-black/70 rounded-lg flex items-center justify-center z-20">
            <Loader2 className="h-5 w-5 text-cyan-400 animate-spin mr-2" />
            <span className="text-cyan-300 font-medium text-sm">Joining...</span>
          </div>
        )}
        {!amInRoom && !isJoining && (
          <div className="absolute inset-0 bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
            <span className="text-white font-medium text-sm">Join Room</span>
          </div>
        )}
      </motion.div>
    );
  }
);
FloorMeetingRoomCard.displayName = "FloorMeetingRoomCard";
