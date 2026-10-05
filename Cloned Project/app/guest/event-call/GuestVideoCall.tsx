"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, ScreenShare } from "lucide-react";
import DailyVideoPlayer from "@/app/(dashboard)/workspace/components/DailyVideoPlayer";
import { useGuestLiveKit } from "./useGuestLiveKit";
import { toast } from "sonner";
import { connectGuestSocket, disconnectGuestSocket } from "@/lib/socket";
import { motion } from "framer-motion";

interface GuestVideoCallProps {
  displayName: string;
  eventTitle: string;
}

export default function GuestVideoCall({ displayName, eventTitle }: GuestVideoCallProps) {
  const router = useRouter();
  const [livekitConfig, setLivekitConfig] = useState<{
    serverUrl: string;
    token: string;
    roomName: string;
  } | null>(null);

  // Map of userId to participant name for displaying proper names
  const [userIdToName, setUserIdToName] = useState<Map<string, string>>(new Map());

  // Track remote screen sharers (userId Set)
  const [remoteScreenSharers, setRemoteScreenSharers] = useState<Set<string>>(new Set());

  // Auto-managed screen share view state (switches automatically when someone shares)
  const [showScreenShareView, setShowScreenShareView] = useState(false);

  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    inCall,
    isJoining,
    localVideoTrack,
    localAudioTrack,
    isMicMuted,
    isCameraOff,
    screenSharerUserId,
    joinCall,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    remoteUserTracks,
    userInfoMap,
  } = useGuestLiveKit(livekitConfig);

  // Determine if someone is screen sharing
  // Daily.co hook detects screen shares directly from participant tracks
  const someoneIsScreenSharing = React.useMemo(() => {
    // Check hook-level detection first (most reliable)
    if (screenSharerUserId !== null) return true;
    // Check remoteUserTracks for screen tracks
    for (const [, tracks] of remoteUserTracks) {
      if (tracks.screenTrack) return true;
    }
    // Socket-based tracking as additional signal
    if (remoteScreenSharers.size > 0) return true;
    return false;
  }, [screenSharerUserId, remoteUserTracks, remoteScreenSharers.size]);

  // Find the screen sharer's userId
  const activeScreenSharerUserId = React.useMemo(() => {
    if (!someoneIsScreenSharing) return null;

    // Direct from hook
    if (screenSharerUserId) return screenSharerUserId;

    // From remoteUserTracks
    for (const [userId, tracks] of remoteUserTracks) {
      if (tracks.screenTrack) return userId;
    }

    // From socket tracking
    if (remoteScreenSharers.size > 0) {
      return Array.from(remoteScreenSharers)[0];
    }

    return null;
  }, [someoneIsScreenSharing, screenSharerUserId, remoteUserTracks, remoteScreenSharers]);

  // Fetch participants to get display names using the public endpoint
  const fetchParticipants = useCallback(async () => {
    try {
      const joinCode = sessionStorage.getItem("guest_join_code");
      if (!joinCode) {
        console.log("[Guest Video Call] No join code available for participant fetch");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/events/participants-public?code=${joinCode}`
      );

      if (response.ok) {
        const data = await response.json();
        if (!data.success) return;

        setUserIdToName((prev) => {
          const merged = new Map(prev);
          if (data.participants?.guests) {
            data.participants.guests.forEach((guest: any) => {
              const odId = guest.id || guest.odId || "";
              if (odId) {
                merged.set(odId, guest.name || guest.email);
              }
            });
          }
          return merged;
        });
      }
    } catch (error) {
      console.error("[Guest Video Call] Error fetching participants:", error);
    }
  }, []);

  // Load Daily config and join call on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const serverUrl = sessionStorage.getItem("guest_livekit_server_url");
        const token = sessionStorage.getItem("guest_livekit_token");
        const roomName = sessionStorage.getItem("guest_livekit_room_name") || "";

        if (!serverUrl || !token) {
          toast.error("Missing call credentials");
          return;
        }

        setLivekitConfig({
          serverUrl,
          token,
          roomName,
        });
      } catch (error) {
        console.error("[Guest Video Call] Error loading config:", error);
        toast.error("Failed to load video call configuration");
      }
    };

    loadConfig();
  }, []);

  // Connect to socket and listen for screen share state events
  useEffect(() => {
    const guestJWT = sessionStorage.getItem("guest_jwt");
    console.log("[Guest Video Call] Socket useEffect running - guestJWT:", !!guestJWT, "livekitConfig:", !!livekitConfig);
    if (!guestJWT || !livekitConfig) {
      console.log("[Guest Video Call] Socket useEffect - skipping, missing guestJWT or livekitConfig");
      return;
    }

    console.log("[Guest Video Call] Connecting to socket for screen share events...");
    const socket = connectGuestSocket(guestJWT);
    console.log("[Guest Video Call] Socket instance obtained, connected:", socket.connected, "id:", socket.id);

    let isActive = true;

    // Handle screen share state changes
    const handleScreenShareState = ({ userId, isSharing }: { userId: string; isSharing: boolean }) => {
      if (!isActive) return;
      console.log(`[Guest Video Call] SCREEN SHARE STATE EVENT:`, { userId, isSharing });

      setRemoteScreenSharers((prev) => {
        const newSet = new Set(prev);
        if (isSharing) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    };

    // Handle init-call to get participant mappings
    const handleInitCall = (data: { participants?: Array<{ userId: string; name?: string; email?: string; isScreenSharing?: boolean }> }) => {
      if (!isActive) return;
      console.log("[Guest Video Call] Received daily:init-call:", data);

      if (data.participants) {
        const newSharers = new Set<string>();

        data.participants.forEach((p) => {
          if (p.isScreenSharing) {
            newSharers.add(p.userId);
          }
        });

        setRemoteScreenSharers(newSharers);

        // Build userId -> name mapping
        setUserIdToName((prev) => {
          const merged = new Map(prev);
          data.participants!.forEach((p) => {
            if (p.userId && (p.name || p.email)) {
              merged.set(p.userId, p.name || p.email?.split("@")[0] || "Participant");
            }
          });
          return merged;
        });
      }
    };

    // Handle participants update (for screen share state sync)
    const handleParticipantsUpdate = (data: { channel: string; participants?: Array<{ userId: string; name?: string; email?: string; isScreenSharing?: boolean }> }) => {
      if (!isActive) return;
      console.log("[Guest Video Call] PARTICIPANTS UPDATE EVENT:", data);

      if (data.participants) {
        const newSharers = new Set<string>();

        data.participants.forEach((p) => {
          if (p.isScreenSharing) {
            newSharers.add(p.userId);
          }
        });

        setRemoteScreenSharers(newSharers);

        // Update userId -> name mapping
        setUserIdToName((prev) => {
          const merged = new Map(prev);
          data.participants!.forEach((p) => {
            if (p.userId && (p.name || p.email)) {
              merged.set(p.userId, p.name || p.email?.split("@")[0] || "Participant");
            }
          });
          return merged;
        });
      }
    };

    // Remove existing listeners to prevent duplicates from React Strict Mode
    socket.off("livekit:screen-share-state");
    socket.off("livekit:init-call");
    socket.off("livekit:participants-update");
    // Set up listeners for Daily events
    socket.on("livekit:screen-share-state", handleScreenShareState);
    socket.on("livekit:init-call", handleInitCall);
    socket.on("livekit:participants-update", handleParticipantsUpdate);

    console.log("[Guest Video Call] Registered socket listeners");

    // Wait for connection before emitting join event
    const emitJoinEvent = () => {
      if (!isActive) return;
      console.log("[Guest Video Call] Socket connected, emitting guest:join-event-call");
      socket.emit("guest:join-event-call");
    };

    if (socket.connected) {
      emitJoinEvent();
    } else {
      socket.once("connect", emitJoinEvent);
    }

    // Handle reconnection
    const handleReconnect = () => {
      if (!isActive) return;
      console.log("[Guest Video Call] Socket reconnected, re-emitting guest:join-event-call");
      socket.emit("guest:join-event-call");
    };
    socket.on("reconnect", handleReconnect);

    return () => {
      isActive = false;
      socket.off("connect", emitJoinEvent);
      socket.off("reconnect", handleReconnect);
    };
  }, [livekitConfig]);

  // Poll for participant info when in call
  useEffect(() => {
    if (inCall) {
      fetchParticipants();
      fetchIntervalRef.current = setInterval(fetchParticipants, 5000);
    }

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }
    };
  }, [inCall, fetchParticipants]);

  // Auto-join when config is loaded
  useEffect(() => {
    if (livekitConfig && !inCall && !isJoining) {
      console.log("[Guest Video Call] Auto-joining with config:", livekitConfig);
      joinCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livekitConfig]);

  const handleLeaveCall = async () => {
    await leaveCall();
    sessionStorage.removeItem("guest_jwt");
    sessionStorage.removeItem("guest_event_id");
    sessionStorage.removeItem("guest_display_name");
    sessionStorage.removeItem("guest_livekit_server_url");
    sessionStorage.removeItem("guest_livekit_token");
    sessionStorage.removeItem("guest_livekit_room_name");
    router.push("/");
  };

  // Helper to get participant initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || name.charAt(0).toUpperCase();
  };

  // Auto-toggle screen share view ON when someone is sharing, OFF when they stop
  useEffect(() => {
    if (someoneIsScreenSharing) {
      setShowScreenShareView(true);
    } else {
      setShowScreenShareView(false);
    }
  }, [someoneIsScreenSharing]);

  // Convert remoteUserTracks to array for rendering
  // Resolve names: Daily user_name (from token) > socket/polling map > fallback
  const remoteParticipants = Array.from(remoteUserTracks.entries()).map(
    ([userId, tracks]) => ({
      userId,
      ...tracks,
      name: userInfoMap.get(userId) || userIdToName.get(userId) || "Participant",
    })
  );

  // Debug logging
  useEffect(() => {
    console.log("[Guest Video Call] State:", {
      inCall,
      remoteParticipantsCount: remoteParticipants.length,
      someoneIsScreenSharing,
      activeScreenSharerUserId,
      screenSharerUserId,
      remoteScreenSharers: Array.from(remoteScreenSharers),
      showScreenShareView,
    });
  }, [inCall, remoteParticipants.length, someoneIsScreenSharing, activeScreenSharerUserId, screenSharerUserId, remoteScreenSharers, showScreenShareView]);

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col overflow-hidden h-screen">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header - Minimal */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between bg-black/40 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">{eventTitle}</h1>
            <span className="text-sm text-gray-400">Guest: {displayName}</span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            inCall ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"
          }`}>
            {inCall ? "Connected" : isJoining ? "Connecting..." : "Not connected"}
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 p-1 sm:p-2 min-h-0 overflow-hidden">
          {isJoining && !inCall ? (
            // Loading state
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
                <p className="text-white text-lg">Joining the meeting...</p>
              </div>
            </div>
          ) : showScreenShareView && someoneIsScreenSharing && activeScreenSharerUserId ? (
            // Screen Share Mode: vertical on mobile (70/30), horizontal on desktop
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 h-full overflow-hidden">
              {/* Main Screen Share Area — 80% height on mobile, flex-1 on desktop */}
              <div className="h-[80%] sm:h-auto sm:flex-1 bg-gray-900 rounded-lg overflow-hidden relative min-h-0 flex-shrink-0 sm:flex-shrink">
                {(() => {
                  // Resolve sharer name: try all name sources including remoteParticipants
                  const sharerName =
                    userInfoMap.get(activeScreenSharerUserId) ||
                    userIdToName.get(activeScreenSharerUserId) ||
                    remoteParticipants.find((p) => p.userId === activeScreenSharerUserId)?.name ||
                    "Host";

                  // Get screen track from remoteUserTracks
                  const sharerTracks = remoteUserTracks.get(activeScreenSharerUserId);
                  let screenTrack = sharerTracks?.screenTrack || null;

                  // Fallback: find any screen track
                  if (!screenTrack) {
                    for (const [, tracks] of remoteUserTracks) {
                      if (tracks.screenTrack) {
                        screenTrack = tracks.screenTrack;
                        break;
                      }
                    }
                  }

                  if (screenTrack) {
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <DailyVideoPlayer
                          videoTrack={screenTrack}
                          isLocal={false}
                          isScreenShare
                        />
                        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-blue-500/90 rounded-full text-sm font-medium text-white shadow-lg flex items-center">
                          <ScreenShare className="w-4 h-4 mr-2" />
                          {sharerName}&apos;s Screen
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="flex items-center justify-center h-full text-white">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                          <ScreenShare className="w-8 h-8 text-blue-400" />
                        </div>
                        <p className="text-lg">Loading screen share...</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Participant List — horizontal scroll on mobile (20% height), vertical sidebar on desktop */}
              <div
                className="h-[20%] sm:h-auto sm:w-72 flex flex-row sm:flex-col gap-2 sm:gap-3 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto py-1 sm:py-2 px-1 sm:px-0 sm:pr-1 flex-shrink-0 sm:max-h-full [&::-webkit-scrollbar]:h-2 sm:[&::-webkit-scrollbar]:h-auto sm:[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-600/50 [&::-webkit-scrollbar-thumb]:rounded-full"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(156, 163, 175, 0.5) transparent" }}
              >
                {/* Local User Video */}
                <div className="bg-gray-800 rounded-lg overflow-hidden relative w-32 h-full sm:w-auto sm:h-44 flex-shrink-0" style={{ isolation: "isolate" }}>
                  <div className="w-full h-full">
                    <DailyVideoPlayer
                      videoTrack={isCameraOff ? null : localVideoTrack}
                      isLocal={true}
                      userName={displayName}
                      showMicMuted={isMicMuted}
                    />
                  </div>
                </div>

                {/* Remote User Videos */}
                {remoteParticipants.map((participant) => {
                  const isThisUserScreenSharing =
                    participant.screenTrack !== null ||
                    activeScreenSharerUserId === participant.userId;

                  return (
                    <div
                      key={participant.userId}
                      className="bg-gray-900 rounded-lg overflow-hidden relative w-32 h-full sm:w-auto sm:h-44 flex-shrink-0"
                      style={{ isolation: "isolate" }}
                    >
                      <div className="w-full h-full">
                        <DailyVideoPlayer
                          videoTrack={participant.cameraTrack}
                          userName={participant.name}
                          showMicMuted={!participant.hasAudio}
                        />
                      </div>
                      {isThisUserScreenSharing && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 rounded-full text-xs text-white font-medium">
                          Sharing
                        </div>
                      )}
                    </div>
                  );
                })}

                {remoteParticipants.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                    Waiting for others...
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Normal Grid Mode — adaptive columns, scroll at 17+
            <div
              className={`grid gap-2 sm:gap-4 ${
                (() => {
                  const total = remoteParticipants.length + 1; // +1 for local
                  if (total <= 1) return "grid-cols-1 h-full auto-rows-fr";
                  if (total <= 4) return "grid-cols-2 h-full auto-rows-fr";
                  if (total <= 6) return "grid-cols-2 sm:grid-cols-3 h-full auto-rows-fr";
                  if (total <= 8) return "grid-cols-2 sm:grid-cols-4 h-full auto-rows-fr";
                  if (total <= 16) return "grid-cols-2 sm:grid-cols-4 h-full sm:auto-rows-fr auto-rows-[minmax(150px,1fr)] overflow-y-auto sm:overflow-hidden";
                  // 17+ desktop / 9+ mobile: fixed row height, scroll
                  return "grid-cols-2 sm:grid-cols-4 auto-rows-[minmax(150px,1fr)] overflow-y-auto";
                })()
              }`}
            >
              {/* Local User Video */}
              <div className="relative bg-gray-900 rounded-lg overflow-hidden min-h-0">
                <DailyVideoPlayer
                  videoTrack={isCameraOff ? null : localVideoTrack}
                  isLocal={true}
                  userName={displayName}
                  showMicMuted={isMicMuted}
                />
              </div>

              {/* Remote Videos */}
              {remoteParticipants.map((participant) => {
                return (
                  <div
                    key={participant.userId}
                    className="relative bg-gray-900 rounded-lg overflow-hidden min-h-0"
                  >
                    <DailyVideoPlayer
                      videoTrack={participant.cameraTrack}
                      isLocal={false}
                      userName={participant.name}
                      showMicMuted={!participant.hasAudio}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 bg-black/60 backdrop-blur-md border-t border-white/10">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {/* Microphone Toggle */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={toggleMicrophone}
              disabled={!inCall}
              size="icon"
              variant="ghost"
              className={`rounded-full w-10 h-10 sm:w-12 sm:h-12 text-white hover:bg-white/10 transition-all duration-300 ${
                isMicMuted ? "bg-red-500 hover:bg-red-600!" : ""
              }`}
              title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
            >
              <motion.div
                animate={{ scale: isMicMuted ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 0.6, repeat: isMicMuted ? Infinity : 0 }}
              >
                {isMicMuted ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
              </motion.div>
            </Button>
          </motion.div>

          {/* Camera Toggle */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={toggleCamera}
              disabled={!inCall}
              size="icon"
              variant="ghost"
              className={`rounded-full w-10 h-10 sm:w-12 sm:h-12 text-white hover:bg-white/10 transition-all duration-300 ${
                isCameraOff ? "bg-red-500 hover:bg-red-600!" : ""
              }`}
              title={isCameraOff ? "Turn on camera" : "Turn off camera"}
            >
              <motion.div
                animate={{ scale: isCameraOff ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 0.6, repeat: isCameraOff ? Infinity : 0 }}
              >
                {isCameraOff ? <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Video className="h-4 w-4 sm:h-5 sm:w-5" />}
              </motion.div>
            </Button>
          </motion.div>

          {/* Leave Call */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleLeaveCall}
              size="icon"
              variant="ghost"
              className="rounded-full w-10 h-10 sm:w-12 sm:h-12 bg-red-600 hover:bg-red-700 text-white"
              title="Leave call"
            >
              <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
