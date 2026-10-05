"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  CircleDot,
  Mic,
  MicOff,
  MessageSquare,
  Video,
  VideoOff,
  PhoneOff,
  Play,
  Send,
  Square,
  ScreenShare,
  ScreenShareOff,
  Link2,
  Check,
  Users,
  UserX,
  X,
  PictureInPicture2,
  MoreVertical,
  ChevronUp,
  Loader2,
} from "lucide-react";
import DailyVideoPlayer from "@/app/(dashboard)/workspace/components/DailyVideoPlayer";
import MeetAttendancePanel from "./MeetAttendancePanel";
import { useMeeting } from "@/lib/meeting-context";
import { usePip } from "@/components/meet/PersistentPipRenderer";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface MeetVideoCallProps {
  displayName: string;
  meetTitle: string;
  isHost: boolean;
  joinCode: string;
  participantId: string;
  affiliateId?: string;
}

export default function MeetVideoCall({
  displayName,
  meetTitle,
  isHost,
  joinCode,
  participantId,
  affiliateId,
}: MeetVideoCallProps) {
  const router = useRouter();
  const meeting = useMeeting();
  const { openPip, isPipSupported } = usePip();
  const [livekitConfig, setLivekitConfig] = useState<{
    serverUrl: string;
    token: string;
    roomName: string;
  } | null>(null);

  // Map of userId to participant name for displaying proper names
  const [userIdToName, setUserIdToName] = useState<Map<string, string>>(new Map());
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [meetStatus, setMeetStatus] = useState<string>("scheduled");
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    inCall,
    isJoining,
    localVideoTrack,
    localAudioTrack,
    localScreenTrack,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    screenSharerUserId,
    setServerScreenSharerUserId,
    leaveMeeting: leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    remoteUserTracks,
    userInfoMap,
    // Device selection
    availableMicrophones,
    availableCameras,
    availableSpeakers,
    selectedMicId,
    selectedCameraId,
    selectedSpeakerId,
    switchMicrophone,
    switchCamera,
    switchSpeaker,
    // Active speaker
    activeSpeakerId,
    // Recording
    isCloudRecording,
    recordingStartedByMe,
    isRecordingLoading,
    toggleCloudRecording,
    // Host controls
    muteParticipant,
    unmuteParticipant,
    kickParticipant,
    wasKicked,
    // Chat
    chatMessages,
    unreadChatCount,
    sendChatMessage,
    clearUnreadChat,
  } = meeting;

  // Auto-managed screen share view state (switches automatically when someone shares)
  const [showScreenShareView, setShowScreenShareView] = useState(false);
  // Attendance panel toggle (host only)
  const [showAttendancePanel, setShowAttendancePanel] = useState(false);
  // Chat panel toggle
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Mobile overflow menu toggle
  const [showMobileOverflow, setShowMobileOverflow] = useState(false);
  // Kick confirmation dialog
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);
  const [isKicking, setIsKicking] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Check if any remote user has a screen track
  const hasScreenTrackInRemoteUserTracks = Array.from(
    remoteUserTracks.values()
  ).some((tracks) => tracks.screenTrack !== null);

  // Determine if someone is screen sharing (local or remote)
  const someoneIsScreenSharing =
    isScreenSharing ||
    screenSharerUserId !== null ||
    hasScreenTrackInRemoteUserTracks;

  // Fetch participants to get display names and server-side screen share state
  const fetchParticipants = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/participants?code=${joinCode}`
      );

      if (response.ok) {
        const data = await response.json();
        if (!data.success) return;

        const newMap = new Map<string, string>();

        data.participants?.forEach((participant: any) => {
          const odId =
            participant.id ||
            participant.participantId ||
            participant.odId ||
            "";

          if (odId) {
            newMap.set(odId, participant.displayName || "Participant");
          }
        });

        if (newMap.size > 0) {
          setUserIdToName(newMap);
        }

        // Update server-authoritative screen share state
        if (data.screenSharingByUserId !== undefined) {
          setServerScreenSharerUserId(data.screenSharingByUserId);
          console.log(
            `[Meet Video Call] Server screenSharingByUserId: ${data.screenSharingByUserId}`
          );
        }
      }
    } catch (error) {
      console.error("[Meet Video Call] Error fetching participants:", error);
    }
  }, [joinCode, setServerScreenSharerUserId]);

  // Load initial status from session storage
  useEffect(() => {
    const status = sessionStorage.getItem("meet_status");
    if (status) {
      setMeetStatus(status);
    }
  }, []);

  // Load LiveKit config
  const loadLivekitConfig = async () => {
    try {
      const serverUrl = sessionStorage.getItem("meet_livekit_server_url");
      const token = sessionStorage.getItem("meet_livekit_token");
      const roomName = sessionStorage.getItem("meet_livekit_room_name") || "";

      if (!serverUrl || !token) {
        toast.error("Missing call credentials");
        return false;
      }

      setLivekitConfig({
        serverUrl,
        token,
        roomName,
      });
      return true;
    } catch (error) {
      console.error("[Meet Video Call] Error loading config:", error);
      toast.error("Failed to load video call configuration");
      return false;
    }
  };

  // Load config when meeting is live
  useEffect(() => {
    if (meetStatus === "live" && !livekitConfig) {
      loadLivekitConfig();
    }
  }, [isHost, meetStatus, livekitConfig]);

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

  // Auto-join when config is loaded AND meeting is live (delegated to MeetingProvider)
  useEffect(() => {
    if (livekitConfig && !inCall && !isJoining && meetStatus === "live") {
      meeting.joinMeeting(
        livekitConfig,
        {
          joinCode,
          meetTitle,
          displayName,
          participantId,
          affiliateId,
        },
        isHost,
      );
    }
  }, [livekitConfig, meetStatus, inCall, isJoining]);

  const handleStartMeeting = async () => {
    setIsStarting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: joinCode }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setMeetStatus("live");
        sessionStorage.setItem("meet_status", "live");

        // Store LiveKit credentials from backend response
        if (data.serverUrl || data.livekitServerUrl) {
          sessionStorage.setItem("meet_livekit_server_url", data.serverUrl || data.livekitServerUrl);
        }
        if (data.token) {
          sessionStorage.setItem("meet_livekit_token", data.token);
        }
        if (data.roomName) {
          sessionStorage.setItem("meet_livekit_room_name", data.roomName);
        }

        toast.success("Meeting started! Joining call...");

        const configLoaded = await loadLivekitConfig();
        if (!configLoaded) {
          toast.error("Failed to initialize video call");
        }
      } else {
        toast.error(data.message || "Failed to start meeting");
      }
    } catch (error) {
      console.error("[Meet Video Call] Error starting meeting:", error);
      toast.error("Failed to start meeting");
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndMeeting = async () => {
    setIsEnding(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: joinCode }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Meeting ended");
        await handleLeaveCall();
      } else {
        toast.error(data.message || "Failed to end meeting");
      }
    } catch (error) {
      console.error("[Meet Video Call] Error ending meeting:", error);
      toast.error("Failed to end meeting");
    } finally {
      setIsEnding(false);
    }
  };

  const handleLeaveCall = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/meet/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode, participantId }),
      });
    } catch (error) {
      console.error("[Meet Video Call] Error notifying leave:", error);
    }

    await leaveCall();

    // Clear session storage
    sessionStorage.removeItem("meet_jwt");
    sessionStorage.removeItem("meet_id");
    sessionStorage.removeItem("meet_display_name");
    sessionStorage.removeItem("meet_livekit_server_url");
    sessionStorage.removeItem("meet_livekit_token");
    sessionStorage.removeItem("meet_livekit_room_name");
    sessionStorage.removeItem("meet_join_code");
    sessionStorage.removeItem("meet_is_host");
    sessionStorage.removeItem("meet_participant_id");
    sessionStorage.removeItem("meet_status");

    router.push("/");
  };

  // Chat handlers
  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput("");
  };

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (isChatOpen) clearUnreadChat();
  }, [isChatOpen, clearUnreadChat]);

  // Copy meeting link to clipboard (with affiliate ID if available)
  const handleCopyLink = async () => {
    let meetingUrl = `${window.location.origin}/meet/join?code=${joinCode}`;
    if (affiliateId) {
      meetingUrl += `&ref=${affiliateId}`;
    }
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setLinkCopied(true);
      toast.success("Meeting link copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error("[Meet Video Call] Error copying link:", error);
      toast.error("Failed to copy link");
    }
  };

  // Handler for screen share toggle that also notifies the backend
  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        await toggleScreenShare();
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/public/meet/screen-share/start`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: joinCode,
              participantId,
            }),
          }
        );
        console.log("[Meet Video Call] Notified backend: screen share started");
      } catch (error) {
        console.error("[Meet Video Call] Error starting screen share:", error);
      }
    } else {
      try {
        await toggleScreenShare();
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/public/meet/screen-share/stop`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: joinCode, participantId }),
          }
        );
        console.log("[Meet Video Call] Notified backend: screen share stopped");
      } catch (error) {
        console.error("[Meet Video Call] Error stopping screen share:", error);
      }
    }
  };

  // Reset screen share view toggle when screen share ends
  useEffect(() => {
    if (!someoneIsScreenSharing) {
      setShowScreenShareView(false);
    }
  }, [someoneIsScreenSharing]);

  // Auto-toggle screen share view ON when ANYONE starts screen sharing
  useEffect(() => {
    if (someoneIsScreenSharing) {
      setShowScreenShareView(true);
    }
  }, [someoneIsScreenSharing]);

  // Helper to get participant initials
  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || name.charAt(0).toUpperCase()
    );
  };

  // Debounced active speaker ID for grid reordering (prevents jarring jumps)
  const [debouncedActiveSpeakerId, setDebouncedActiveSpeakerId] = useState<string | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedActiveSpeakerId(activeSpeakerId);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [activeSpeakerId]);

  // Convert remoteUserTracks Map to array, sorted with active speaker first
  const remoteParticipants = useMemo(() => {
    const participants = Array.from(remoteUserTracks.entries()).map(
      ([userId, tracks]) => ({
        userId,
        ...tracks,
        name: userInfoMap.get(userId) || userIdToName.get(userId) || "Participant",
      })
    );

    if (debouncedActiveSpeakerId) {
      participants.sort((a, b) => {
        if (a.userId === debouncedActiveSpeakerId) return -1;
        if (b.userId === debouncedActiveSpeakerId) return 1;
        return 0;
      });
    }

    return participants;
  }, [remoteUserTracks, userInfoMap, userIdToName, debouncedActiveSpeakerId]);

  // Handle kick participant (host only)
  const handleKickParticipant = useCallback(async (userId: string) => {
    // Send app-message for instant client-side ejection
    kickParticipant(userId);

    // Notify backend to set leftAt
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/meet/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: joinCode,
          participantId: userId,
          hostParticipantId: participantId,
        }),
      });
    } catch (error) {
      console.error("[Meet Video Call] Error kicking participant:", error);
    }
  }, [kickParticipant, joinCode, participantId]);

  // Confirm kick from dialog
  const handleConfirmKick = useCallback(async () => {
    if (!kickTarget) return;
    setIsKicking(true);
    try {
      await handleKickParticipant(kickTarget.id);
    } finally {
      setIsKicking(false);
      setKickTarget(null);
    }
  }, [kickTarget, handleKickParticipant]);

  // Redirect when kicked
  useEffect(() => {
    if (wasKicked && !inCall) {
      sessionStorage.removeItem("meet_jwt");
      sessionStorage.removeItem("meet_id");
      sessionStorage.removeItem("meet_display_name");
      sessionStorage.removeItem("meet_livekit_server_url");
      sessionStorage.removeItem("meet_livekit_token");
      sessionStorage.removeItem("meet_livekit_room_name");
      sessionStorage.removeItem("meet_join_code");
      sessionStorage.removeItem("meet_is_host");
      sessionStorage.removeItem("meet_participant_id");
      sessionStorage.removeItem("meet_status");
      router.push("/");
    }
  }, [wasKicked, inCall, router]);

  // Debug logging
  useEffect(() => {
    console.log("[Meet Video Call] State update:", {
      inCall,
      isJoining,
      hasLocalVideo: !!localVideoTrack,
      hasLocalAudio: !!localAudioTrack,
      remoteParticipantsCount: remoteParticipants.length,
      isCameraOff,
      isMicMuted,
      meetStatus,
      isHost,
      screenSharerUserId,
      showScreenShareView,
      someoneIsScreenSharing,
      hasScreenTrackInRemoteUserTracks,
      remoteUserTracksCount: remoteUserTracks.size,
    });
  }, [
    inCall,
    isJoining,
    localVideoTrack,
    localAudioTrack,
    remoteParticipants.length,
    isCameraOff,
    isMicMuted,
    meetStatus,
    isHost,
    screenSharerUserId,
    showScreenShareView,
    someoneIsScreenSharing,
    hasScreenTrackInRemoteUserTracks,
    remoteUserTracks,
  ]);

  // ─── Picture-in-Picture: handled globally by PipProvider ───
  // Minimize closes the meet view and lets the global PiP take over.
  const handleMinimize = useCallback(() => {
    meeting.minimize();
    openPip().catch(() => {});
    router.push("/dashboard");
  }, [meeting, openPip, router]);

  // Show start meeting UI for host when meeting is not live
  if (isHost && meetStatus !== "live" && !inCall) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#111116] border-b border-[#2a2a35] px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">{meetTitle}</h1>
              <p className="text-sm text-gray-400 mt-1">Host: {displayName}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                Ready to Start
              </div>
            </div>
          </div>
        </div>

        {/* Start Meeting UI */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Video className="h-12 w-12 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Ready to Start?
              </h2>
              <p className="text-gray-400">
                As the host, you can start the meeting whenever you&apos;re ready.
                <br />
                Participants will be able to join once you start.
              </p>
            </div>
            <Button
              onClick={handleStartMeeting}
              disabled={isStarting}
              className="h-14 px-8 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {isStarting ? (
                <>
                  <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start Meeting
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-[#111116] border-b border-[#2a2a35] px-4 sm:px-6 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{meetTitle}</h1>
            <p className="text-xs text-gray-400">
              {isHost ? "Host" : "Participant"}: {displayName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                inCall
                  ? "bg-green-500/20 text-green-400"
                  : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {inCall
                ? "Connected"
                : isJoining
                ? "Connecting..."
                : "Not connected"}
            </div>
            {isHost && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                Host
              </div>
            )}
            {isPipSupported && inCall && (
              <Button
                onClick={handleMinimize}
                size="icon"
                className="h-8 w-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
                title="Minimize to Picture-in-Picture"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-1 sm:p-2 overflow-hidden min-h-0">
        <div className="h-full">
          {isJoining && !inCall ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
                <p className="text-white text-lg">Joining the meeting...</p>
              </div>
            </div>
          ) : showScreenShareView && someoneIsScreenSharing ? (
            // Screen Share Mode: vertical on mobile (80/20), horizontal on desktop
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 h-full overflow-hidden">
              {/* Main Screen Share Area — 80% height on mobile, flex-1 on desktop */}
              <div className="h-[80%] sm:h-auto sm:flex-1 bg-[#1a1a20] rounded-lg overflow-hidden relative border border-[#2a2a35] min-h-0 flex-shrink-0 sm:flex-shrink">
                {(() => {
                  // Check if local user is screen sharing
                  if (isScreenSharing && localScreenTrack) {
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <DailyVideoPlayer
                          videoTrack={localScreenTrack}
                          isLocal={true}
                          isScreenShare
                        />
                        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-green-500/90 rounded-full text-sm font-medium text-white shadow-lg flex items-center">
                          <ScreenShare className="w-4 h-4 mr-2" />
                          Your Screen
                        </div>
                      </div>
                    );
                  }

                  // Otherwise show remote screen sharer
                  // In webinars only the host can share, so fallback to "Host"
                  const sharerName = screenSharerUserId
                    ? userInfoMap.get(screenSharerUserId) ||
                      userIdToName.get(screenSharerUserId) ||
                      remoteParticipants.find((p) => p.userId === screenSharerUserId)?.name ||
                      "Host"
                    : "Host";

                  // Find the screen track from remoteUserTracks
                  let screenTrack: MediaStreamTrack | null = null;
                  if (screenSharerUserId) {
                    const sharerTracks = remoteUserTracks.get(screenSharerUserId);
                    screenTrack = sharerTracks?.screenTrack || null;
                  }

                  // Fallback: iterate through remoteUserTracks to find any screen track
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
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(156, 163, 175, 0.5) transparent",
                }}
              >
                {/* Local User Video */}
                <div className="bg-[#1a1a20] rounded-lg overflow-hidden relative w-32 h-full sm:w-auto sm:h-44 flex-shrink-0 border border-[#2a2a35]">
                  <DailyVideoPlayer
                    videoTrack={isCameraOff ? null : localVideoTrack}
                    isLocal={true}
                    userName={displayName}
                    showMicMuted={isMicMuted}
                  />
                  {isScreenSharing && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 rounded-full text-xs text-white font-medium">
                      Sharing
                    </div>
                  )}
                </div>

                {/* Remote User Videos */}
                {remoteParticipants.map((participant) => {
                  const isThisUserScreenSharing =
                    participant.screenTrack !== null ||
                    screenSharerUserId === participant.userId;
                  const isSpeaking = participant.userId === activeSpeakerId;

                  return (
                    <div
                      key={participant.userId}
                      className={cn(
                        "bg-[#1a1a20] rounded-lg overflow-hidden relative w-32 h-full sm:w-auto sm:h-44 flex-shrink-0 group transition-shadow duration-300",
                        isSpeaking
                          ? "border-2 border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]"
                          : "border border-[#2a2a35]"
                      )}
                    >
                      <DailyVideoPlayer
                        videoTrack={participant.cameraTrack}
                        userName={participant.name}
                        showMicMuted={!participant.hasAudio}
                      />
                      {isThisUserScreenSharing && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 rounded-full text-xs text-white font-medium">
                          Sharing
                        </div>
                      )}
                      {isHost && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            onClick={() => participant.hasAudio ? muteParticipant(participant.userId) : unmuteParticipant(participant.userId)}
                            className={`p-1.5 ${participant.hasAudio ? "bg-red-500/80 hover:bg-red-500" : "bg-green-500/80 hover:bg-green-500"} rounded-full text-white`}
                            title={participant.hasAudio ? `Mute ${participant.name}` : `Unmute ${participant.name}`}
                          >
                            {participant.hasAudio ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => setKickTarget({ id: participant.userId, name: participant.name })}
                            className="p-1.5 bg-red-600/80 hover:bg-red-700 rounded-full text-white"
                            title={`Remove ${participant.name}`}
                          >
                            <UserX className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Normal Grid Mode
            (() => {
              // Get screen track for grid view display
              let screenTrackForGrid: MediaStreamTrack | null = null;
              let screenSharerNameForGrid = "Host";

              // Check for remote screen share
              if (someoneIsScreenSharing && !isScreenSharing) {
                for (const [userId, tracks] of remoteUserTracks) {
                  if (tracks.screenTrack) {
                    screenTrackForGrid = tracks.screenTrack;
                    screenSharerNameForGrid =
                      userInfoMap.get(userId) || userIdToName.get(userId) || remoteParticipants.find((p) => p.userId === userId)?.name || "Host";
                    break;
                  }
                }
              }

              // Calculate total cards for grid layout
              const hasScreenShare = isScreenSharing || screenTrackForGrid;
              const totalCards =
                remoteParticipants.length + 1 + (hasScreenShare ? 1 : 0);

              return (
                <div
                  className={`grid gap-2 sm:gap-4 ${
                    (() => {
                      if (totalCards <= 1) return "grid-cols-1 h-full auto-rows-fr";
                      if (totalCards <= 4) return "grid-cols-2 h-full auto-rows-fr";
                      if (totalCards <= 6) return "grid-cols-2 sm:grid-cols-3 h-full auto-rows-fr";
                      if (totalCards <= 8) return "grid-cols-2 sm:grid-cols-4 h-full auto-rows-fr";
                      if (totalCards <= 16) return "grid-cols-2 sm:grid-cols-4 h-full sm:auto-rows-fr auto-rows-[minmax(150px,1fr)] overflow-y-auto sm:overflow-hidden";
                      // 17+ desktop / 9+ mobile: fixed row height, scroll
                      return "grid-cols-2 sm:grid-cols-4 auto-rows-[minmax(150px,1fr)] overflow-y-auto";
                    })()
                  }`}
                >
                  {/* Remote Screen Share Card */}
                  {screenTrackForGrid && (
                    <div className="relative bg-[#1a1a20] rounded-lg overflow-hidden border-2 border-blue-500 min-h-0">
                      <DailyVideoPlayer
                        videoTrack={screenTrackForGrid}
                        isLocal={false}
                        isScreenShare
                      />
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-blue-500/90 rounded-full text-xs font-medium text-white shadow-lg flex items-center">
                        <ScreenShare className="w-3 h-3 mr-1" />
                        {screenSharerNameForGrid}&apos;s Screen
                      </div>
                    </div>
                  )}

                  {/* Local Screen Share Card */}
                  {isScreenSharing && localScreenTrack && (
                    <div className="relative bg-[#1a1a20] rounded-lg overflow-hidden border-2 border-green-500 min-h-0">
                      <DailyVideoPlayer
                        videoTrack={localScreenTrack}
                        isLocal={true}
                        isScreenShare
                      />
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500/90 rounded-full text-xs font-medium text-white shadow-lg flex items-center">
                        <ScreenShare className="w-3 h-3 mr-1" />
                        Your Screen
                      </div>
                    </div>
                  )}

                  {/* Local Video (Camera) */}
                  <div className="relative bg-[#1a1a20] rounded-lg overflow-hidden border border-[#2a2a35] min-h-0">
                    <DailyVideoPlayer
                      videoTrack={isCameraOff ? null : localVideoTrack}
                      isLocal={true}
                      userName={displayName}
                      showMicMuted={isMicMuted}
                    />
                    {isScreenSharing && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 rounded-full text-xs text-white font-medium">
                        Sharing
                      </div>
                    )}
                  </div>

                  {/* Remote Videos (Cameras) */}
                  {remoteParticipants.map((participant) => {
                    const isUserScreenSharing =
                      participant.screenTrack !== null;
                    const isSpeaking = participant.userId === activeSpeakerId;

                    return (
                      <div
                        key={participant.userId}
                        className={cn(
                          "relative bg-[#1a1a20] rounded-lg overflow-hidden min-h-0 group transition-shadow duration-300",
                          isSpeaking
                            ? "border-2 border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]"
                            : "border border-[#2a2a35]"
                        )}
                      >
                        <DailyVideoPlayer
                          videoTrack={participant.cameraTrack}
                          isLocal={false}
                          userName={participant.name}
                          showMicMuted={!participant.hasAudio}
                        />
                        {isUserScreenSharing && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 rounded-full text-xs text-white font-medium">
                            Sharing
                          </div>
                        )}
                        {isHost && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {participant.hasAudio && (
                              <button
                                onClick={() => muteParticipant(participant.userId)}
                                className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white"
                                title={`Mute ${participant.name}`}
                              >
                                <MicOff className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => setKickTarget({ id: participant.userId, name: participant.name })}
                              className="p-1.5 bg-red-600/80 hover:bg-red-700 rounded-full text-white"
                              title={`Remove ${participant.name}`}
                            >
                              <UserX className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 bg-[#111116] border-t border-[#2a2a35] px-4 sm:px-6 py-2 sm:py-3">
        <div className="flex items-end justify-center gap-3 sm:gap-4 flex-wrap">
          {/* Microphone Toggle + Device Selector */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center">
              <Button
                onClick={toggleMicrophone}
                disabled={!inCall}
                className={cn(
                  "h-10 w-10 sm:h-12 sm:w-12 rounded-full sm:rounded-r-none",
                  isMicMuted
                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                    : "bg-gray-700 hover:bg-gray-600 text-white"
                )}
                title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMicMuted ? (
                  <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    disabled={!inCall}
                    className="hidden sm:flex h-12 w-6 rounded-full rounded-l-none bg-gray-700 hover:bg-gray-600 text-white border-l border-gray-600 p-0 items-center justify-center"
                    title="Select microphone & speaker"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-64 p-2">
                  <div className="text-xs font-medium text-gray-400 px-2 py-1 mb-1">Microphone</div>
                  {availableMicrophones.length === 0 ? (
                    <p className="text-xs text-gray-500 px-2 py-1">No microphones found</p>
                  ) : (
                    availableMicrophones.map((mic) => (
                      <button
                        key={mic.deviceId}
                        onClick={() => switchMicrophone(mic.deviceId)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-800 transition-colors flex items-center justify-between",
                          selectedMicId === mic.deviceId ? "text-blue-400 bg-blue-500/10" : "text-gray-300"
                        )}
                      >
                        <span className="truncate">{mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}</span>
                        {selectedMicId === mic.deviceId && <Check className="h-3 w-3 flex-shrink-0 ml-2" />}
                      </button>
                    ))
                  )}
                  {availableSpeakers.length > 0 && (
                    <>
                      <div className="border-t border-gray-700 my-2" />
                      <div className="text-xs font-medium text-gray-400 px-2 py-1 mb-1">Speaker</div>
                      {availableSpeakers.map((speaker) => (
                        <button
                          key={speaker.deviceId}
                          onClick={() => switchSpeaker(speaker.deviceId)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-800 transition-colors flex items-center justify-between",
                            selectedSpeakerId === speaker.deviceId ? "text-blue-400 bg-blue-500/10" : "text-gray-300"
                          )}
                        >
                          <span className="truncate">{speaker.label || `Speaker ${speaker.deviceId.slice(0, 5)}`}</span>
                          {selectedSpeakerId === speaker.deviceId && <Check className="h-3 w-3 flex-shrink-0 ml-2" />}
                        </button>
                      ))}
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <span className="text-[9px] sm:text-[10px] text-gray-500">{isMicMuted ? "Unmute" : "Mic"}</span>
          </div>

          {/* Camera Toggle + Device Selector */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center">
              <Button
                onClick={toggleCamera}
                disabled={!inCall}
                className={cn(
                  "h-10 w-10 sm:h-12 sm:w-12 rounded-full sm:rounded-r-none",
                  isCameraOff
                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                    : "bg-gray-700 hover:bg-gray-600 text-white"
                )}
                title={isCameraOff ? "Turn on camera" : "Turn off camera"}
              >
                {isCameraOff ? (
                  <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Video className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    disabled={!inCall}
                    className="hidden sm:flex h-12 w-6 rounded-full rounded-l-none bg-gray-700 hover:bg-gray-600 text-white border-l border-gray-600 p-0 items-center justify-center"
                    title="Select camera"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-64 p-2">
                  <div className="text-xs font-medium text-gray-400 px-2 py-1 mb-1">Camera</div>
                  {availableCameras.length === 0 ? (
                    <p className="text-xs text-gray-500 px-2 py-1">No cameras found</p>
                  ) : (
                    availableCameras.map((cam) => (
                      <button
                        key={cam.deviceId}
                        onClick={() => switchCamera(cam.deviceId)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-800 transition-colors flex items-center justify-between",
                          selectedCameraId === cam.deviceId ? "text-blue-400 bg-blue-500/10" : "text-gray-300"
                        )}
                      >
                        <span className="truncate">{cam.label || `Camera ${cam.deviceId.slice(0, 5)}`}</span>
                        {selectedCameraId === cam.deviceId && <Check className="h-3 w-3 flex-shrink-0 ml-2" />}
                      </button>
                    ))
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <span className="text-[9px] sm:text-[10px] text-gray-500">{isCameraOff ? "Start Video" : "Camera"}</span>
          </div>

          {/* Screen Share Button - Only visible to host */}
          {isHost && (
            <div className="flex flex-col items-center gap-1">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleToggleScreenShare}
                  disabled={!inCall}
                  className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full ${
                    isScreenSharing
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  }`}
                  title={isScreenSharing ? "Stop sharing" : "Share your screen"}
                >
                  {isScreenSharing ? (
                    <ScreenShareOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <ScreenShare className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </motion.div>
              <span className="text-[9px] sm:text-[10px] text-gray-500">{isScreenSharing ? "Stop Share" : "Share"}</span>
            </div>
          )}

          {/* Chat Toggle */}
          <div className="flex flex-col items-center gap-1">
            <Button
              onClick={() => setIsChatOpen((v) => !v)}
              disabled={!inCall}
              className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full relative ${
                isChatOpen
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
              title={isChatOpen ? "Close chat" : "Open chat"}
            >
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
                  {unreadChatCount > 9 ? "9+" : unreadChatCount}
                </span>
              )}
            </Button>
            <span className="text-[9px] sm:text-[10px] text-gray-500">Chat</span>
          </div>

          {/* --- Desktop-only buttons (hidden on mobile, shown in overflow menu) --- */}

          {/* Copy Link Button - desktop only */}
          <div className="hidden sm:flex flex-col items-center gap-1">
            <Button
              onClick={handleCopyLink}
              className={`h-12 w-12 rounded-full ${
                linkCopied
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
              title="Copy meeting link"
            >
              {linkCopied ? (
                <Check className="h-5 w-5" />
              ) : (
                <Link2 className="h-5 w-5" />
              )}
            </Button>
            <span className="text-[10px] text-gray-500">{linkCopied ? "Copied!" : "Invite"}</span>
          </div>

          {/* Picture-in-Picture Button - desktop only */}
          {isPipSupported && (
            <div className="hidden sm:flex flex-col items-center gap-1">
              <Button
                onClick={handleMinimize}
                disabled={!inCall}
                className="h-12 w-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
                title="Minimize to Picture-in-Picture"
              >
                <PictureInPicture2 className="h-5 w-5" />
              </Button>
              <span className="text-[10px] text-gray-500">PiP</span>
            </div>
          )}

          {/* Attendance Panel Button - Host only, desktop only */}
          {isHost && (
            <div className="hidden sm:flex flex-col items-center gap-1">
              <Button
                onClick={() => setShowAttendancePanel(!showAttendancePanel)}
                disabled={!inCall}
                className={`h-12 w-12 rounded-full ${
                  showAttendancePanel
                    ? "bg-purple-500 hover:bg-purple-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-white"
                }`}
                title="View attendance"
              >
                <Users className="h-5 w-5" />
              </Button>
              <span className="text-[10px] text-gray-500">People</span>
            </div>
          )}

          {/* Cloud Recording - Host only, desktop only */}
          {isHost && (
            <div className="hidden sm:flex flex-col items-center gap-1">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={toggleCloudRecording}
                  disabled={!inCall || isRecordingLoading}
                  className={`h-12 w-12 rounded-full ${
                    isRecordingLoading
                      ? "bg-gray-700 opacity-60 cursor-not-allowed"
                      : isCloudRecording && recordingStartedByMe
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : isCloudRecording
                          ? "bg-red-500/40 text-white"
                          : "bg-gray-700 hover:bg-gray-600 text-white"
                  }`}
                  title={
                    isRecordingLoading
                      ? "Please wait..."
                      : isCloudRecording
                        ? "Stop recording"
                        : "Start cloud recording"
                  }
                >
                  {isRecordingLoading ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isCloudRecording ? (
                    <Square className="h-5 w-5 fill-current" />
                  ) : (
                    <CircleDot className="h-5 w-5" />
                  )}
                </Button>
              </motion.div>
              <span className="text-[10px] text-gray-500">{isCloudRecording ? "Stop Rec" : "Record"}</span>
            </div>
          )}

          {/* --- Mobile overflow menu (three-dot) --- */}
          <div className="relative flex flex-col items-center gap-1 sm:hidden">
            <Button
              onClick={() => setShowMobileOverflow((v) => !v)}
              className={`h-10 w-10 rounded-full ${
                showMobileOverflow
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            <span className="text-[9px] text-gray-500">More</span>

            {/* Overflow popup */}
            {showMobileOverflow && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMobileOverflow(false)}
                />
                {/* Menu */}
                <div className="absolute bottom-full mb-2 right-0 z-50 bg-[#1a1a24] border border-[#2a2a35] rounded-xl shadow-xl py-2 min-w-[180px]">
                  {/* Invite */}
                  <button
                    onClick={() => { handleCopyLink(); setShowMobileOverflow(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#2a2a35] transition-colors"
                  >
                    {linkCopied ? <Check className="h-4 w-4 text-green-400" /> : <Link2 className="h-4 w-4 text-gray-400" />}
                    {linkCopied ? "Copied!" : "Copy Invite Link"}
                  </button>

                  {/* PiP */}
                  {isPipSupported && (
                    <button
                      onClick={() => { handleMinimize(); setShowMobileOverflow(false); }}
                      disabled={!inCall}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#2a2a35] transition-colors disabled:opacity-40"
                    >
                      <PictureInPicture2 className="h-4 w-4 text-gray-400" />
                      Picture-in-Picture
                    </button>
                  )}

                  {/* People - Host only */}
                  {isHost && (
                    <button
                      onClick={() => { setShowAttendancePanel(!showAttendancePanel); setShowMobileOverflow(false); }}
                      disabled={!inCall}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#2a2a35] transition-colors disabled:opacity-40"
                    >
                      <Users className={`h-4 w-4 ${showAttendancePanel ? "text-purple-400" : "text-gray-400"}`} />
                      People
                    </button>
                  )}

                  {/* Record - Host only */}
                  {isHost && (
                    <button
                      onClick={() => { toggleCloudRecording(); setShowMobileOverflow(false); }}
                      disabled={!inCall || isRecordingLoading}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#2a2a35] transition-colors disabled:opacity-40"
                    >
                      {isRecordingLoading ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : isCloudRecording ? (
                        <Square className="h-4 w-4 text-red-400 fill-current" />
                      ) : (
                        <CircleDot className="h-4 w-4 text-gray-400" />
                      )}
                      {isRecordingLoading ? "Please wait..." : isCloudRecording ? "Stop Recording" : "Start Recording"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* End Meeting (Host only) */}
          {isHost && (
            <div className="flex flex-col items-center gap-1">
              <Button
                onClick={handleEndMeeting}
                disabled={isEnding}
                size="icon"
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-orange-600 hover:bg-orange-700 text-white"
                title="End Meeting"
              >
                {isEnding ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Square className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
              <span className="text-[9px] sm:text-[10px] text-gray-500">End</span>
            </div>
          )}

          {/* Leave Call */}
          <div className="flex flex-col items-center gap-1">
            <Button
              onClick={handleLeaveCall}
              size="icon"
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-600 hover:bg-red-700 text-white"
              title="Leave Call"
            >
              <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <span className="text-[9px] sm:text-[10px] text-gray-500">Leave</span>
          </div>
        </div>
      </div>

      {/* Attendance Panel (Host only) */}
      {isHost && (
        <MeetAttendancePanel
          joinCode={joinCode}
          isOpen={showAttendancePanel}
          onClose={() => setShowAttendancePanel(false)}
          onKickParticipant={handleKickParticipant}
        />
      )}

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-96 bg-[#0e0e12]/95 backdrop-blur-md border border-[#2a2a35] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[10000]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a35]">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-white">In-call Chat</span>
            </div>
            <Button
              onClick={() => setIsChatOpen(false)}
              size="icon"
              variant="ghost"
              className="rounded-full w-7 h-7 text-gray-400 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                <p>No messages yet</p>
              </div>
            )}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${
                  msg.sender === "local" ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-medium text-gray-400">{msg.senderName}</span>
                  <span className="text-[10px] text-gray-600">{msg.time}</span>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-2xl text-sm break-words ${
                    msg.sender === "local"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-[#1e1e28] text-gray-200 rounded-bl-md"
                  }`}
                >
                  {msg.msg}
                </div>
              </div>
            ))}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendChat} className="flex items-center gap-2 px-3 py-3 border-t border-[#2a2a35]">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#1a1a24] border border-[#2a2a35] rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-colors"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!chatInput.trim()}
              className="rounded-full w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Document PiP rendering is handled globally by PipProvider */}
      {/* Kick Confirmation Dialog */}
      <AlertDialog open={!!kickTarget} onOpenChange={(open) => { if (!open && !isKicking) setKickTarget(null); }}>
        <AlertDialogContent className="bg-[#1a1a20] border-[#2a2a35]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove participant</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to remove <span className="font-medium text-white">{kickTarget?.name}</span> from this meeting? They will be disconnected immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isKicking}
              className="bg-transparent border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35] hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isKicking}
              onClick={handleConfirmKick}
            >
              {isKicking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
