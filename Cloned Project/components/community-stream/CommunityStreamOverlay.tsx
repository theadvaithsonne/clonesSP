"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCommunityStreamLiveKit, RemoteUserTracks } from "./useCommunityStreamLiveKit";
import { useAvatarPositions, WORLD_WIDTH, WORLD_HEIGHT, RADIUS_CIRCLE_SIZE } from "./useAvatarPositions";
import { useProximityAudio } from "./useProximityAudio";

// Component for rendering remote user video in circular avatar
const RemoteVideoAvatar = memo(({
  tracks,
  userInfo,
  getInitials,
}: {
  tracks: RemoteUserTracks;
  userInfo: { name: string; email: string };
  getInitials: (name: string) => string;
}) => {
  const videoRef = useRef<HTMLDivElement>(null);

  // Play remote video track when available
  useEffect(() => {
    if (tracks.cameraTrack && videoRef.current) {
      tracks.cameraTrack.play(videoRef.current);
    }
    return () => {
      tracks.cameraTrack?.stop();
    };
  }, [tracks.cameraTrack]);

  return (
    <div className="flex flex-col items-center gap-2 relative">
      {/* Radius circle - faded for remote users */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: `${RADIUS_CIRCLE_SIZE}px`,
          height: `${RADIUS_CIRCLE_SIZE}px`,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(100, 100, 120, 0.15) 0%, rgba(100, 100, 120, 0.05) 50%, transparent 70%)",
          border: "1px solid rgba(100, 100, 120, 0.2)",
        }}
      />
      <div className="relative z-10">
        <div
          className={cn(
            "w-16 h-16 rounded-full overflow-hidden",
            "ring-2 ring-[#2a2a35] ring-offset-2 ring-offset-[#0a0a0c]"
          )}
        >
          {/* Video container - shows when camera track is available */}
          {tracks.cameraTrack ? (
            <div
              ref={videoRef}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Fallback avatar when no video */
            <div className="w-full h-full flex items-center justify-center text-white font-semibold text-lg bg-gradient-to-br from-blue-500 to-blue-700">
              {userInfo.name === "Connecting..." ? "..." : getInitials(userInfo.name)}
            </div>
          )}
        </div>
        {/* Mic muted indicator */}
        {!tracks.hasAudio && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}
        {/* Camera off indicator */}
        {!tracks.cameraTrack && (
          <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <VideoOff className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <span className="text-white text-xs font-medium max-w-[80px] truncate text-center z-10">
        {userInfo.name}
      </span>
    </div>
  );
});

RemoteVideoAvatar.displayName = "RemoteVideoAvatar";

// Office floor plan component - renders the world background
const OfficeFloorPlan = memo(({ cameraOffset }: { cameraOffset: { x: number; y: number } }) => {
  // Generate a repeating pattern of office rooms across the large world
  const rooms = [];

  // Room configuration - create a grid of different room types
  const roomTypes = [
    { width: 400, height: 300, label: "Conference Room" },
    { width: 200, height: 200, label: "Office" },
    { width: 300, height: 200, label: "Meeting Room" },
    { width: 250, height: 150, label: "Break Room" },
  ];

  // Generate rooms in a grid pattern
  for (let x = 100; x < WORLD_WIDTH - 200; x += 600) {
    for (let y = 100; y < WORLD_HEIGHT - 200; y += 400) {
      const roomType = roomTypes[Math.floor((x + y) / 300) % roomTypes.length];
      const offsetX = ((x * 7) % 100) - 50; // Pseudo-random offset
      const offsetY = ((y * 11) % 80) - 40;

      rooms.push({
        x: x + offsetX,
        y: y + offsetY,
        width: roomType.width,
        height: roomType.height,
        label: roomType.label,
      });
    }
  }

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        left: -cameraOffset.x,
        top: -cameraOffset.y,
        opacity: 0.15,
      }}
    >
      {/* World boundary */}
      <rect
        x="20"
        y="20"
        width={WORLD_WIDTH - 40}
        height={WORLD_HEIGHT - 40}
        fill="none"
        stroke="#555"
        strokeWidth="4"
      />

      {/* Corridors - horizontal */}
      {[500, 1100, 1700, 2300].map((y) => (
        <rect
          key={`corridor-h-${y}`}
          x="50"
          y={y}
          width={WORLD_WIDTH - 100}
          height="80"
          fill="rgba(80, 80, 100, 0.1)"
          stroke="#444"
          strokeWidth="1"
        />
      ))}

      {/* Corridors - vertical */}
      {[800, 1800, 2800, 3800].map((x) => (
        <rect
          key={`corridor-v-${x}`}
          x={x}
          y="50"
          width="80"
          height={WORLD_HEIGHT - 100}
          fill="rgba(80, 80, 100, 0.1)"
          stroke="#444"
          strokeWidth="1"
        />
      ))}

      {/* Office rooms */}
      {rooms.map((room, i) => (
        <g key={i}>
          {/* Room */}
          <rect
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.height}
            fill="rgba(60, 60, 80, 0.08)"
            stroke="#666"
            strokeWidth="2"
          />
          {/* Door opening */}
          <rect
            x={room.x + room.width / 2 - 20}
            y={room.y + room.height - 2}
            width="40"
            height="4"
            fill="#0a0a0c"
          />
          {/* Desk inside */}
          <rect
            x={room.x + 30}
            y={room.y + 30}
            width={Math.min(80, room.width - 60)}
            height={Math.min(40, room.height - 80)}
            fill="none"
            stroke="#555"
            strokeWidth="1"
          />
        </g>
      ))}

      {/* Some decorative plants/pillars */}
      {[
        { x: 400, y: 300 },
        { x: 1200, y: 800 },
        { x: 2000, y: 500 },
        { x: 3000, y: 1200 },
        { x: 4000, y: 600 },
        { x: 600, y: 1500 },
        { x: 1500, y: 2000 },
        { x: 2500, y: 1800 },
        { x: 3500, y: 2200 },
        { x: 4200, y: 2500 },
      ].map((pos, i) => (
        <circle
          key={`plant-${i}`}
          cx={pos.x}
          cy={pos.y}
          r="15"
          fill="rgba(100, 150, 100, 0.3)"
          stroke="#4a7a4a"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
});

OfficeFloorPlan.displayName = "OfficeFloorPlan";

interface CommunityStreamOverlayProps {
  isOpen: boolean;
  channelTitle: string;
  meId: string;
  onClose: () => void;
}

export const CommunityStreamOverlay = memo(
  ({
    isOpen,
    channelTitle,
    meId,
    onClose,
  }: CommunityStreamOverlayProps) => {
    // Use the dedicated community stream Daily hook (separate from workspace)
    const {
      localVideoTrack,
      inCall,
      leaveCall,
      toggleMicrophone,
      toggleCamera,
      userInfoMap,
      remoteUserTracks,
    } = useCommunityStreamLiveKit();

    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);

    // Avatar positions for movable avatars with camera following
    const {
      positions,
      cameraOffset,
      viewportSize,
      containerRef,
      worldToScreen,
      isInViewport,
      worldDimensions,
    } = useAvatarPositions(meId, inCall);

    // Proximity-based audio - only hear users when circles overlap
    useProximityAudio(meId, positions, remoteUserTracks, containerRef, inCall);

    // Ref for local video container
    const localVideoRef = useRef<HTMLDivElement>(null);

    // Check if we have a position (needed to know when video container is rendered)
    const hasPosition = positions.has(meId);

    // Play local video track when available
    // Dependencies include hasPosition because the video container only renders when position is set
    useEffect(() => {
      if (localVideoTrack && localVideoRef.current && !isCameraOff) {
        localVideoTrack.play(localVideoRef.current);
      }
      return () => {
        localVideoTrack?.stop();
      };
    }, [localVideoTrack, isCameraOff, hasPosition]);

    const handleToggleMic = useCallback(async () => {
      const result = await toggleMicrophone();
      setIsMicMuted(!result);
    }, [toggleMicrophone]);

    const handleToggleCamera = useCallback(async () => {
      const result = await toggleCamera();
      setIsCameraOff(!result);
    }, [toggleCamera]);

    const handleLeave = useCallback(() => {
      leaveCall();
      onClose();
    }, [leaveCall, onClose]);

    // Get initials from name
    const getInitials = (name: string) => {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    };

    // Get user info from UID mapping
    const getUserInfo = useCallback(
      (odId: string) => {
        const info = userInfoMap.get(odId);
        if (info) {
          return { name: info.name || info.email?.split("@")[0] || "Participant", email: info.email };
        }
        // If odId starts with "unknown-", show "Connecting..." like floor meetings
        if (odId.startsWith("unknown-")) {
          return { name: "Connecting...", email: "" };
        }
        return { name: "Participant", email: "" };
      },
      [userInfoMap]
    );

    // Build the list of remote users to display (only those in viewport)
    const remoteParticipants = Array.from(remoteUserTracks.entries())
      .filter(([odId]) => odId !== meId)
      .map(([odId, tracks]) => ({
        odId,
        tracks,
        userInfo: getUserInfo(odId),
        worldPos: positions.get(odId),
      }))
      .filter(({ worldPos }) => {
        // Only render participants that are in or near viewport
        if (!worldPos) return true; // Show if no position yet
        return isInViewport(worldPos.x, worldPos.y, 300);
      });

    // Get my screen position (should be centered)
    const myWorldPos = positions.get(meId);
    const myScreenPos = myWorldPos ? worldToScreen(myWorldPos.x, myWorldPos.y) : null;

    if (!isOpen) return null;

    return (
      <div className="relative w-full h-full bg-[#0a0a0c] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a35] bg-[#0e0e12] z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Video className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{channelTitle}</h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Users className="w-3.5 h-3.5" />
                <span>Community Stream</span>
                {inCall && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span className="text-green-400">
                      {remoteParticipants.length + 1} participant
                      {remoteParticipants.length !== 0 ? "s" : ""}
                    </span>
                    <span className="text-gray-600">|</span>
                    <span className="text-purple-400 text-[10px]">
                      Use arrow keys or WASD to move
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button
            onClick={handleLeave}
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Content Area - Viewport into the 2D world */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          tabIndex={0}
          style={{ background: "#0a0a0c" }}
        >
          {!inCall ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Connecting to stream...
              </h3>
              <p className="text-gray-400 text-sm max-w-md">
                Please wait while we connect you to the community stream. Make sure your
                camera and microphone are ready.
              </p>
              <div className="mt-6">
                <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              </div>
            </div>
          ) : (
            <>
              {/* Office floor plan - moves with camera */}
              <OfficeFloorPlan cameraOffset={cameraOffset} />

              {/* Local user avatar - always centered in viewport */}
              {myScreenPos && (
                <motion.div
                  className="absolute flex flex-col items-center gap-2 z-10"
                  style={{
                    left: myScreenPos.x,
                    top: myScreenPos.y,
                    transform: "translate(-50%, -50%)",
                  }}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  {/* Radius circle - brighter for local user */}
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: `${RADIUS_CIRCLE_SIZE}px`,
                      height: `${RADIUS_CIRCLE_SIZE}px`,
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      background: "radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 70%)",
                      border: "2px solid rgba(168, 85, 247, 0.4)",
                    }}
                  />
                  <div className="relative z-10">
                    <div
                      className={cn(
                        "w-16 h-16 rounded-full overflow-hidden",
                        "ring-2 ring-purple-400 ring-offset-2 ring-offset-[#0a0a0c]"
                      )}
                    >
                      {/* Video container - shows when camera is on */}
                      {!isCameraOff && localVideoTrack ? (
                        <div
                          ref={localVideoRef}
                          className="w-full h-full object-cover"
                          style={{ transform: "scaleX(-1)" }}
                        />
                      ) : (
                        /* Fallback avatar when camera is off */
                        <div className="w-full h-full flex items-center justify-center text-white font-semibold text-lg bg-gradient-to-br from-purple-500 to-purple-700">
                          You
                        </div>
                      )}
                    </div>
                    {/* Mic indicator */}
                    {isMicMuted && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <MicOff className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {/* Camera indicator */}
                    {isCameraOff && (
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <VideoOff className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-white text-xs font-medium z-10">You</span>
                </motion.div>
              )}

              {/* Remote participants - positioned relative to camera */}
              {remoteParticipants.map(({ odId, tracks, userInfo, worldPos }) => {
                if (!worldPos) return null;
                const screenPos = worldToScreen(worldPos.x, worldPos.y);

                return (
                  <motion.div
                    key={odId}
                    className="absolute z-10"
                    style={{
                      left: screenPos.x,
                      top: screenPos.y,
                      transform: "translate(-50%, -50%)",
                    }}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <RemoteVideoAvatar
                      tracks={tracks}
                      userInfo={userInfo}
                      getInitials={getInitials}
                    />
                  </motion.div>
                );
              })}

              {/* Mini-map in corner */}
              <div
                className="absolute bottom-24 right-4 bg-[#1a1a22]/90 rounded-lg border border-[#2a2a35] p-2 z-20"
                style={{ width: 150, height: 90 }}
              >
                <div className="text-[10px] text-gray-400 mb-1">Mini-map</div>
                <div
                  className="relative bg-[#0e0e12] rounded"
                  style={{
                    width: "100%",
                    height: "calc(100% - 16px)",
                  }}
                >
                  {/* World boundary */}
                  <div className="absolute inset-0 border border-[#333] rounded" />

                  {/* Viewport indicator */}
                  <div
                    className="absolute border border-purple-400/50 bg-purple-400/10"
                    style={{
                      left: `${(cameraOffset.x / worldDimensions.width) * 100}%`,
                      top: `${(cameraOffset.y / worldDimensions.height) * 100}%`,
                      width: `${(viewportSize.width / worldDimensions.width) * 100}%`,
                      height: `${(viewportSize.height / worldDimensions.height) * 100}%`,
                    }}
                  />

                  {/* My position */}
                  {myWorldPos && (
                    <div
                      className="absolute w-2 h-2 bg-purple-500 rounded-full"
                      style={{
                        left: `${(myWorldPos.x / worldDimensions.width) * 100}%`,
                        top: `${(myWorldPos.y / worldDimensions.height) * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  )}

                  {/* Other players */}
                  {Array.from(positions.entries())
                    .filter(([id]) => id !== meId)
                    .map(([id, pos]) => (
                      <div
                        key={id}
                        className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full"
                        style={{
                          left: `${(pos.x / worldDimensions.width) * 100}%`,
                          top: `${(pos.y / worldDimensions.height) * 100}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fixed Controls Bar at Bottom Center */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1a22] rounded-full border border-[#2a2a35] shadow-lg">
            <Button
              onClick={handleToggleMic}
              size="icon"
              disabled={!inCall}
              className={cn(
                "rounded-full w-12 h-12 transition-all",
                isMicMuted
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                  : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              {isMicMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>

            <Button
              onClick={handleToggleCamera}
              size="icon"
              disabled={!inCall}
              className={cn(
                "rounded-full w-12 h-12 transition-all",
                isCameraOff
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                  : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              {isCameraOff ? (
                <VideoOff className="h-5 w-5" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </Button>

            <Button
              onClick={handleLeave}
              size="icon"
              className="rounded-full w-12 h-12 bg-red-500 hover:bg-red-600 text-white transition-all"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

CommunityStreamOverlay.displayName = "CommunityStreamOverlay";
