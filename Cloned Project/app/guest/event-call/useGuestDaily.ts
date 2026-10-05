"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import DailyIframe, {
  DailyCall,
  DailyParticipant,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
  DailyEventObjectFatalError,
} from "@daily-co/daily-js";
import { toast } from "sonner";

// Simplified remote user tracks - Daily handles screen share natively
export interface RemoteUserTracks {
  odId: string;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  hasAudio: boolean;
  hasVideo: boolean;
}

interface GuestDailyConfig {
  roomUrl: string;
  token: string;
  roomName: string;
}

// Helper to extract MediaStreamTracks from a DailyParticipant
function extractTracks(participant: DailyParticipant) {
  const tracks = participant.tracks;
  const hasVideo = tracks?.video?.state === "playable";
  const hasAudio = tracks?.audio?.state === "playable";
  const hasScreenVideo = tracks?.screenVideo?.state === "playable";
  return {
    cameraTrack: hasVideo ? (tracks?.video?.persistentTrack ?? null) : null,
    screenTrack: hasScreenVideo ? (tracks?.screenVideo?.persistentTrack ?? null) : null,
    audioTrack: tracks?.audio?.persistentTrack ?? null,
    hasAudio,
    hasVideo,
  };
}

export function useGuestDaily(config: GuestDailyConfig | null) {
  const callObjectRef = useRef<DailyCall | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [inCall, setInCall] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const isScreenSharingRef = useRef(false);
  const [screenSharerUserId, setScreenSharerUserId] = useState<string | null>(null);

  // Remote user tracks map: userId -> tracks
  const [remoteUserTracks, setRemoteUserTracks] = useState<Map<string, RemoteUserTracks>>(new Map());

  // Name map from Daily's participant.user_name (set via meeting token)
  const [userInfoMap, setUserInfoMap] = useState<Map<string, string>>(new Map());

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; senderName: string; msg: string; time: string }>>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatIdCounter = useRef(0);

  // --- Update local tracks ---
  const updateLocalTracks = useCallback((co: DailyCall) => {
    const local = co.participants()?.local;
    if (!local) return;

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo } = extractTracks(local);
    setLocalVideoTrack(cameraTrack);
    setLocalAudioTrack(audioTrack);
    setIsMicMuted(!hasAudio);
    setIsCameraOff(!hasVideo);

    if (screenTrack) {
      setLocalScreenTrack(screenTrack);
      if (!isScreenSharingRef.current) {
        setIsScreenSharing(true);
        isScreenSharingRef.current = true;
      }
    } else if (isScreenSharingRef.current) {
      setLocalScreenTrack(null);
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
    }
  }, []);

  // --- Update a remote participant ---
  const updateRemoteParticipant = useCallback((participant: DailyParticipant) => {
    const userId = participant.user_id;
    if (!userId || participant.local) return;

    // Skip audience/receive-only participants (workshop preview viewers)
    if (userId.startsWith("audience-")) return;

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo } = extractTracks(participant);

    // Play audio
    if (audioTrack && hasAudio) {
      try {
        const audioEl = new Audio();
        audioEl.srcObject = new MediaStream([audioTrack]);
        audioEl.autoplay = true;
        audioEl.play().catch((e) => console.warn("[GUEST DAILY] Audio autoplay failed:", e));
      } catch (e) {
        console.warn("[GUEST DAILY] Error playing remote audio:", e);
      }
    }

    // Store user_name from Daily participant (set via meeting token)
    if (participant.user_name) {
      setUserInfoMap((prev) => {
        if (prev.get(userId) === participant.user_name) return prev;
        const updated = new Map(prev);
        updated.set(userId, participant.user_name!);
        return updated;
      });
    }

    // Detect remote screen sharing
    if (screenTrack) {
      setScreenSharerUserId(userId);
    }

    setRemoteUserTracks((prev) => {
      const updated = new Map(prev);
      updated.set(userId, {
        odId: userId,
        cameraTrack,
        screenTrack,
        audioTrack,
        hasAudio,
        hasVideo,
      });
      return updated;
    });
  }, []);

  // --- Remove a remote participant ---
  const removeRemoteParticipant = useCallback((userId: string) => {
    setRemoteUserTracks((prev) => {
      const updated = new Map(prev);
      updated.delete(userId);
      return updated;
    });
    setScreenSharerUserId((prev) => (prev === userId ? null : prev));
  }, []);

  // --- Leave call ---
  const leaveCall = useCallback(async () => {
    console.log("[GUEST DAILY] leaveCall called");
    const co = callObjectRef.current;
    if (co) {
      try {
        await co.leave();
        co.destroy();
      } catch (e) {
        console.log("[GUEST DAILY] Error leaving call:", e);
      }
      callObjectRef.current = null;
    }

    setInCall(false);
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setLocalScreenTrack(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setRemoteUserTracks(new Map());
    setUserInfoMap(new Map());
    setChatMessages([]);
    setUnreadChatCount(0);
    setIsMicMuted(false);
    setIsCameraOff(false);
    setScreenSharerUserId(null);
    console.log("[GUEST DAILY] Call cleanup complete");
  }, []);

  // --- Join call ---
  const joinCall = useCallback(async () => {
    if (!config || isJoining || inCall) {
      console.log("[GUEST DAILY] Cannot join:", { hasConfig: !!config, isJoining, inCall });
      return;
    }

    setIsJoining(true);
    console.log("[GUEST DAILY] joinCall called with config:", {
      roomUrl: config.roomUrl,
      roomName: config.roomName,
    });

    // Reset screen share state when joining (clear any stale state from previous sessions)
    setScreenSharerUserId(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setLocalScreenTrack(null);
    setRemoteUserTracks(new Map());

    // Clean up existing call
    if (callObjectRef.current) {
      try {
        await callObjectRef.current.leave();
        callObjectRef.current.destroy();
      } catch (e) {
        console.log("[GUEST DAILY] Error cleaning up existing call:", e);
      }
      callObjectRef.current = null;
    }

    try {
      console.log("[GUEST DAILY] Creating Daily call object...");
      const callObject = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });
      callObjectRef.current = callObject;

      // Set up event handlers BEFORE joining
      callObject.on("participant-joined", (event?: DailyEventObjectParticipant) => {
        if (!event) return;
        const p = event.participant;
        if (p.local) return;
        console.log(`[GUEST DAILY] participant-joined: ${p.user_id || p.session_id}`);
        updateRemoteParticipant(p);
      });

      callObject.on("participant-updated", (event?: DailyEventObjectParticipant) => {
        if (!event) return;
        const p = event.participant;
        if (p.local) {
          updateLocalTracks(callObject);
        } else {
          updateRemoteParticipant(p);
        }
      });

      callObject.on("participant-left", (event?: DailyEventObjectParticipantLeft) => {
        if (!event) return;
        const userId = event.participant.user_id || event.participant.session_id;
        console.log(`[GUEST DAILY] participant-left: ${userId}`);
        if (userId) removeRemoteParticipant(userId);
      });

      // Chat & host-mute: listen for incoming messages
      callObject.on("app-message", (event: any) => {
        if (!event || !event.data) return;

        // Handle host mute request
        if (event.data.type === "host-mute-request") {
          const local = callObject.participants()?.local;
          if (local && local.user_id === event.data.targetUserId) {
            callObject.setLocalAudio(false);
            setIsMicMuted(true);
            toast.info("You have been muted by the host");
          }
          return;
        }

        if (!event.data.msg) return;
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        chatIdCounter.current += 1;
        const senderName = callObject.participants()?.[event.fromId]?.user_name || "Unknown";
        setChatMessages((prev) => [...prev, {
          id: `msg-${chatIdCounter.current}`,
          sender: event.fromId,
          senderName,
          msg: event.data.msg,
          time,
        }]);
        setUnreadChatCount((prev) => prev + 1);
      });

      callObject.on("error", (event?: DailyEventObjectFatalError) => {
        console.error("[GUEST DAILY] Fatal error:", event);
        toast.error(`Call error: ${event?.errorMsg || "Unknown error"}`);
        leaveCall();
      });

      // Join
      console.log("[GUEST DAILY] Joining room:", config.roomUrl);
      await callObject.join({
        url: config.roomUrl,
        token: config.token,
      });
      console.log("[GUEST DAILY] Successfully joined room");

      // Extract local tracks
      updateLocalTracks(callObject);

      // Process existing remote participants
      const participants = callObject.participants();
      Object.values(participants).forEach((p) => {
        if (!p.local && p.user_id) {
          updateRemoteParticipant(p);
        }
      });

      setInCall(true);
      toast.success("Joined the meeting successfully!");
    } catch (error: any) {
      console.error("[GUEST DAILY] Join failed:", error);

      if (error.name === "NotAllowedError") {
        toast.error("Camera/microphone permission denied. Please allow access and try again.");
      } else if (error.name === "NotFoundError") {
        toast.error("Camera or microphone not found. Please check your devices.");
      } else {
        toast.error(`Failed to join call: ${error.message || "Unknown error"}`);
      }

      if (callObjectRef.current) {
        try {
          await callObjectRef.current.leave();
          callObjectRef.current.destroy();
        } catch (e) {
          console.log("[GUEST DAILY] Error during cleanup:", e);
        }
        callObjectRef.current = null;
      }
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
    } finally {
      setIsJoining(false);
    }
  }, [config, isJoining, inCall, leaveCall, updateLocalTracks, updateRemoteParticipant, removeRemoteParticipant]);

  // --- Toggle microphone ---
  const toggleMicrophone = useCallback(async () => {
    const co = callObjectRef.current;
    if (!co) return false;
    const local = co.participants()?.local;
    if (!local) return false;
    const newState = !local.audio;
    co.setLocalAudio(newState);
    setIsMicMuted(!newState);
    console.log("[GUEST DAILY] Microphone toggled:", newState);
    return newState;
  }, []);

  // --- Toggle camera ---
  const toggleCamera = useCallback(async () => {
    const co = callObjectRef.current;
    if (!co) return false;
    const local = co.participants()?.local;
    if (!local) return false;
    const newState = !local.video;
    co.setLocalVideo(newState);
    setIsCameraOff(!newState);
    console.log("[GUEST DAILY] Camera toggled:", newState);
    return newState;
  }, []);

  // --- Toggle screen share ---
  const toggleScreenShare = useCallback(async () => {
    const co = callObjectRef.current;
    if (!co) {
      console.error("[GUEST DAILY] No active call object for screen share");
      return;
    }

    try {
      if (isScreenSharingRef.current) {
        console.log("[GUEST DAILY] Stopping screen share");
        co.stopScreenShare();
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setLocalScreenTrack(null);
      } else {
        console.log("[GUEST DAILY] Starting screen share");
        await co.startScreenShare();
      }
    } catch (error: any) {
      console.error("[GUEST DAILY] Error toggling screen share:", error);
      if (error.name === "NotAllowedError") {
        console.log("[GUEST DAILY] Screen share cancelled by user");
      } else {
        toast.error(`Screen share error: ${error.message}`);
      }
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      setLocalScreenTrack(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callObjectRef.current) {
        console.log("[GUEST DAILY] Component unmounting while in call, cleaning up");
        try {
          callObjectRef.current.leave();
          callObjectRef.current.destroy();
        } catch (e) {
          console.log("[GUEST DAILY] Error during unmount cleanup:", e);
        }
      }
    };
  }, []);

  // Detect screen sharer from remoteUserTracks
  useEffect(() => {
    if (screenSharerUserId !== null) return;

    for (const [userId, tracks] of remoteUserTracks) {
      if (tracks.screenTrack) {
        setScreenSharerUserId(userId);
        break;
      }
    }
  }, [remoteUserTracks, screenSharerUserId]);

  // Clear screen sharer when no one has screen track
  useEffect(() => {
    if (screenSharerUserId === null) return;

    const sharerTracks = remoteUserTracks.get(screenSharerUserId);
    if (!sharerTracks || !sharerTracks.screenTrack) {
      // Check if anyone else has a screen track
      let found = false;
      for (const [userId, tracks] of remoteUserTracks) {
        if (tracks.screenTrack) {
          setScreenSharerUserId(userId);
          found = true;
          break;
        }
      }
      if (!found) {
        setScreenSharerUserId(null);
      }
    }
  }, [remoteUserTracks, screenSharerUserId]);

  // --- Send chat message ---
  const sendChatMessage = useCallback((msg: string) => {
    const co = callObjectRef.current;
    if (!co || !msg.trim()) return;
    co.sendAppMessage({ msg: msg.trim() }, "*");
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    chatIdCounter.current += 1;
    setChatMessages((prev) => [...prev, {
      id: `msg-${chatIdCounter.current}`,
      sender: "local",
      senderName: "You",
      msg: msg.trim(),
      time,
    }]);
  }, []);

  const clearUnreadChat = useCallback(() => setUnreadChatCount(0), []);

  return {
    inCall,
    isJoining,
    localVideoTrack,
    localAudioTrack,
    localScreenTrack,
    remoteUserTracks,
    userInfoMap,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    screenSharerUserId,
    joinCall,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    // Chat
    chatMessages,
    unreadChatCount,
    sendChatMessage,
    clearUnreadChat,
  };
}
