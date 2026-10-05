"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import DailyIframe, {
  DailyCall,
  DailyParticipant,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
  DailyEventObjectFatalError,
  DailyEventObjectNonFatalError,
} from "@daily-co/daily-js";
import { connectSocket } from "@/lib/socket";
import { toast } from "sonner";

// Remote user tracks - simplified from previous dual-UID pattern
// Daily handles screen share as a separate track on the same participant
export interface RemoteUserTracks {
  odId: string;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  hasAudio: boolean;
  hasVideo: boolean;
  hasScreenVideo: boolean;
}

// Chat message type
export interface DailyChatMessage {
  id: string;
  sender: string; // "local" or session_id
  senderName: string;
  msg: string;
  time: string;
}

// Helper to extract MediaStreamTracks from a DailyParticipant
function extractTracks(participant: DailyParticipant) {
  const tracks = participant.tracks;
  const hasVideo = tracks?.video?.state === "playable";
  const hasAudio = tracks?.audio?.state === "playable";
  const screenVideoState = tracks?.screenVideo?.state;
  const screenVideoPersistentTrack = tracks?.screenVideo?.persistentTrack;
  const hasScreenVideo = screenVideoState === "playable";

  console.log(`[DAILY extractTracks] userId=${participant.user_id} local=${participant.local}`, {
    videoState: tracks?.video?.state,
    audioState: tracks?.audio?.state,
    screenVideoState,
    hasScreenVideoPersistentTrack: !!screenVideoPersistentTrack,
    screenTrackReadyState: screenVideoPersistentTrack?.readyState,
    screenTrackEnabled: screenVideoPersistentTrack?.enabled,
    screenTrackMuted: screenVideoPersistentTrack?.muted,
    hasScreenVideo,
    allTrackKeys: tracks ? Object.keys(tracks) : [],
  });

  return {
    cameraTrack: hasVideo ? (tracks?.video?.persistentTrack ?? null) : null,
    screenTrack: hasScreenVideo ? (screenVideoPersistentTrack ?? null) : null,
    audioTrack: tracks?.audio?.persistentTrack ?? null,
    hasAudio,
    hasVideo,
    hasScreenVideo,
  };
}

export function useDaily() {
  const callObjectRef = useRef<DailyCall | null>(null);
  const isLeavingRef = useRef(false); // Guard against double leaveCall()
  const [inCall, setInCall] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const isScreenSharingRef = useRef(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [remoteUserTracks, setRemoteUserTracks] = useState<Map<string, RemoteUserTracks>>(new Map());
  const [userInfoMap, setUserInfoMap] = useState<Map<string, { name?: string; email: string }>>(new Map());
  const [is1on1Call, setIs1on1Call] = useState(false);

  // Cloud recording state
  const [isCloudRecording, setIsCloudRecording] = useState(false);
  const [recordingStartedByMe, setRecordingStartedByMe] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<DailyChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatIdCounter = useRef(0);

  // Debug: log inCall state changes
  useEffect(() => {
    console.log("[DAILY] inCall state changed:", inCall);
  }, [inCall]);

  // --- Update local tracks from the local participant ---
  const updateLocalTracks = useCallback((co: DailyCall) => {
    const local = co.participants()?.local;
    if (!local) return;

    const { cameraTrack, screenTrack, audioTrack } = extractTracks(local);
    setLocalVideoTrack(cameraTrack);
    setLocalAudioTrack(audioTrack);

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

  // --- Update a remote participant in the tracks map ---
  const updateRemoteParticipant = useCallback((participant: DailyParticipant) => {
    const userId = participant.user_id;
    if (!userId || participant.local) return;

    // Skip audience/receive-only participants (workshop preview viewers)
    if (userId.startsWith("audience-")) return;

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo, hasScreenVideo } = extractTracks(participant);

    // Play audio track directly (Daily persistent tracks need to be played)
    if (audioTrack && hasAudio) {
      try {
        const audioEl = new Audio();
        audioEl.srcObject = new MediaStream([audioTrack]);
        audioEl.autoplay = true;
        audioEl.play().catch((e) => console.warn("[DAILY] Audio autoplay failed:", e));
      } catch (e) {
        console.warn("[DAILY] Error playing remote audio:", e);
      }
    }

    // Store user_name from Daily participant in userInfoMap (set via meeting token)
    if (participant.user_name) {
      setUserInfoMap((prev) => {
        const existing = prev.get(userId);
        if (existing?.name === participant.user_name) return prev;
        const updated = new Map(prev);
        updated.set(userId, {
          name: participant.user_name,
          email: existing?.email || "",
        });
        console.log(`[DAILY] Updated userInfoMap from Daily participant: ${userId} -> ${participant.user_name}`);
        return updated;
      });
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
        hasScreenVideo,
      });
      console.log(`[DAILY] Updated remoteUserTracks for ${userId}:`, {
        hasCamera: !!cameraTrack,
        hasScreen: !!screenTrack,
        hasAudio,
        hasVideo,
        hasScreenVideo,
      });
      return updated;
    });
  }, []);

  // --- Remove a remote participant from the tracks map ---
  const removeRemoteParticipant = useCallback((userId: string) => {
    setRemoteUserTracks((prev) => {
      const updated = new Map(prev);
      updated.delete(userId);
      console.log(`[DAILY] Removed ${userId} from remoteUserTracks`);
      return updated;
    });
  }, []);

  // --- Leave call and clean up ---
  const leaveCall = useCallback(async () => {
    // Guard against re-entrance: during co.leave() the Daily SDK fires
    // participant-left for remote users, which triggers the 1-on-1 auto-leave
    // calling leaveCall() a second time on the same call object.
    if (isLeavingRef.current) {
      console.log("[DAILY] leaveCall already in progress, skipping");
      return;
    }
    isLeavingRef.current = true;
    console.log("[DAILY] leaveCall called");

    const co = callObjectRef.current;
    if (co) {
      // Null the ref FIRST so any concurrent code path sees no active call
      callObjectRef.current = null;
      try {
        await co.leave();
        console.log("[DAILY] Left call successfully");
      } catch (e) {
        console.log("[DAILY] Error leaving call:", e);
      }
      try {
        co.destroy();
        console.log("[DAILY] Call object destroyed");
      } catch (e) {
        console.log("[DAILY] Error destroying call object:", e);
      }
    }

    setInCall(false);
    setRemoteUserTracks(new Map());
    setLocalVideoTrack(null);
    setLocalScreenTrack(null);
    setLocalAudioTrack(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setIs1on1Call(false);
    setUserInfoMap(new Map());
    setIsCloudRecording(false);
    setRecordingStartedByMe(false);
    setIsRecordingLoading(false);
    setChatMessages([]);
    setUnreadChatCount(0);

    // Move user back to lobby
    const socket = connectSocket();
    socket.emit("workspace:move-to-space", { spaceId: "lobby" });
    socket.emit("daily:screen-share-state", { isSharing: false });
    console.log("[DAILY] Moved user back to lobby and cleared screen share state");

    isLeavingRef.current = false;
  }, []);

  // --- Main socket event listener effect ---
  useEffect(() => {
    const socket = connectSocket();
    console.log("[DAILY] Setting up event listeners on socket:", socket.id);

    const handleJoinCall = async (data: {
      roomUrl: string;
      token: string;
      roomName?: string;
      meetingType?: string;
      partnerId?: string;
      hostId?: string;
      participants?: Array<{ userId: string; name?: string; email: string }>;
    }) => {
      try {
        console.log("[DAILY] handleJoinCall called with data:", {
          roomUrl: data.roomUrl,
          roomName: data.roomName,
          meetingType: data.meetingType,
          hasParticipants: !!data.participants,
          participantsCount: data.participants?.length,
        });

        if (!data.roomUrl) {
          console.error("[DAILY] No room URL provided in join-call event. Backend may have failed to create the room.", data);
          toast.error("Failed to join call: meeting room is not ready. Please try again.");
          return;
        }

        // Detect 1-on-1 knock call
        const is1on1KnockCall = !data.meetingType && !!(data.partnerId || data.hostId);
        setIs1on1Call(is1on1KnockCall);

        // Store participant info
        if (data.participants && data.participants.length > 0) {
          setUserInfoMap((prev) => {
            const merged = new Map(prev);
            data.participants!.forEach((p) => {
              merged.set(p.userId, { name: p.name, email: p.email });
            });
            return merged;
          });
          console.log("[DAILY] Stored user info for participants:", data.participants.length);
        }

        // Reset leaving guard so the new call can proceed
        isLeavingRef.current = false;

        // Clean up any existing call object
        if (callObjectRef.current) {
          console.log("[DAILY] Existing call object found, cleaning up...");
          try {
            await callObjectRef.current.leave();
            callObjectRef.current.destroy();
          } catch (e) {
            console.log("[DAILY] Error cleaning up existing call:", e);
          }
          callObjectRef.current = null;
        }

        // Create Daily call object
        console.log("[DAILY] Creating Daily call object...");
        const callObject = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: !is1on1KnockCall,  // audio-only for knock calls
        });
        callObjectRef.current = callObject;

        // Set up Daily event handlers BEFORE joining
        callObject.on("participant-joined", (event?: DailyEventObjectParticipant) => {
          if (!event) return;
          const p = event.participant;
          if (p.local) return;
          console.log(`[DAILY] participant-joined: ${p.user_id || p.session_id}`);
          updateRemoteParticipant(p);
        });

        callObject.on("participant-updated", (event?: DailyEventObjectParticipant) => {
          if (!event) return;
          const p = event.participant;
          if (p.local) {
            // Update local tracks
            updateLocalTracks(callObject);
          } else {
            updateRemoteParticipant(p);
          }
        });

        callObject.on("participant-left", (event?: DailyEventObjectParticipantLeft) => {
          if (!event) return;
          const p = event.participant;
          const userId = p.user_id || p.session_id;
          console.log(`[DAILY] participant-left: ${userId}`);

          if (userId) {
            removeRemoteParticipant(userId);
          }

          // For 1-on-1 calls, auto-leave when the other person leaves
          if (is1on1KnockCall) {
            const remainingRemote = Object.values(callObject.participants()).filter(
              (pp) => !pp.local
            );
            if (remainingRemote.length === 0) {
              console.log("[DAILY] 1-on-1 call ended, other user left - auto-leaving");
              leaveCall();
            }
          }
        });

        // Chat: listen for incoming messages
        callObject.on("app-message", (event: any) => {
          if (!event || !event.data?.msg) return;
          const time = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          chatIdCounter.current += 1;
          const senderName =
            callObject.participants()?.[event.fromId]?.user_name || "Unknown";
          setChatMessages((prev) => [
            ...prev,
            {
              id: `msg-${chatIdCounter.current}`,
              sender: event.fromId,
              senderName,
              msg: event.data.msg,
              time,
            },
          ]);
          setUnreadChatCount((prev) => prev + 1);
          console.log(`[DAILY] Chat message from ${senderName}: ${event.data.msg}`);
        });

        // Cloud recording: listen for recording state changes
        callObject.on("recording-started", () => {
          console.log("[DAILY] Cloud recording started");
          setIsCloudRecording(true);
          // Don't show toast if we started it (we already know)
        });

        callObject.on("recording-stopped", () => {
          console.log("[DAILY] Cloud recording stopped");
          setIsCloudRecording(false);
          setRecordingStartedByMe(false);
          toast.info("Recording stopped");
        });

        callObject.on("recording-error", (event: any) => {
          console.error("[DAILY] Recording error:", event);
          setIsCloudRecording(false);
          setRecordingStartedByMe(false);
          toast.error(`Recording error: ${event?.errorMsg || "Unknown error"}`);
        });

        callObject.on("error", (event?: DailyEventObjectFatalError) => {
          console.error("[DAILY] Fatal error:", event);
          toast.error(`Call error: ${event?.errorMsg || "Unknown error"}`);
          leaveCall();
        });

        callObject.on("nonfatal-error", (event?: DailyEventObjectNonFatalError) => {
          console.warn("[DAILY] Non-fatal error:", event);
        });

        // Join the call
        console.log("[DAILY] Joining room:", data.roomUrl);
        await callObject.join({
          url: data.roomUrl,
          token: data.token,
        });
        console.log("[DAILY] Successfully joined room");

        // Extract local tracks after joining
        updateLocalTracks(callObject);

        // Process any remote participants already in the call
        const participants = callObject.participants();
        Object.values(participants).forEach((p) => {
          if (!p.local && p.user_id) {
            updateRemoteParticipant(p);
          }
        });

        setInCall(true);
      } catch (error: any) {
        console.error("[DAILY] Join failed:", error);

        if (error.name === "NotAllowedError" || error.message?.includes("permission")) {
          toast.error("Camera/microphone permission denied. Please allow access and try again.");
        } else if (error.name === "NotFoundError") {
          toast.error("Camera or microphone not found. Please check your devices.");
        } else {
          toast.error(`Failed to join call: ${error.message || "Unknown error"}`);
        }

        // Clean up on error
        if (callObjectRef.current) {
          try {
            await callObjectRef.current.leave();
            callObjectRef.current.destroy();
          } catch (e) {
            console.log("[DAILY] Error during cleanup:", e);
          }
          callObjectRef.current = null;
        }
      }
    };

    const handleInitCall = (data: any) => {
      console.log("[DAILY] Received daily:init-call on socket:", socket.id, "data:", data);
      handleJoinCall(data);
    };

    const handleJoinCallEvent = (data: any) => {
      console.log("[DAILY] Received daily:join-call with data:", data);
      handleJoinCall(data);
    };

    const handleLeaveCall = () => {
      console.log("[DAILY] Received daily:leave-call event");
      leaveCall();
    };

    const handleParticipantsUpdate = (data: {
      channel?: string;
      roomName?: string;
      participants: Array<{ userId: string; name?: string; email: string }>;
    }) => {
      console.log("[DAILY] Received daily:participants-update:", data);

      if (data.participants && data.participants.length > 0) {
        setUserInfoMap((prev) => {
          const merged = new Map(prev);
          data.participants.forEach((p) => {
            merged.set(p.userId, { name: p.name, email: p.email });
          });
          return merged;
        });
        console.log("[DAILY] Updated userInfoMap:", data.participants.length, "participants");
      }
    };

    const handleCallAnsweredElsewhere = (data: {
      roomName?: string;
      channel?: string;
      answeredOn: string;
      message: string;
    }) => {
      console.log("[DAILY] Call answered elsewhere:", data);

      if (callObjectRef.current) {
        console.log("[DAILY] Already in a call, ignoring answered-elsewhere");
        return;
      }

      toast.info(data.message || "Call answered on another device", {
        duration: 4000,
      });
    };

    const handleJoinError = (data: { error: string; spaceId?: string }) => {
      console.error("[DAILY] Join error from server:", data);
      toast.error(data.error || "Failed to join meeting room.");
      // Move user back to lobby since room join failed
      socket.emit("workspace:move-to-space", { spaceId: "lobby" });
    };

    socket.on("daily:init-call", handleInitCall);
    socket.on("daily:join-call", handleJoinCallEvent);
    socket.on("daily:leave-call", handleLeaveCall);
    socket.on("daily:participants-update", handleParticipantsUpdate);
    socket.on("daily:call-answered-elsewhere", handleCallAnsweredElsewhere);
    socket.on("daily:join-error", handleJoinError);

    return () => {
      console.log("[DAILY] Cleaning up useEffect, removing event listeners");
      socket.off("daily:init-call", handleInitCall);
      socket.off("daily:join-call", handleJoinCallEvent);
      socket.off("daily:leave-call", handleLeaveCall);
      socket.off("daily:participants-update", handleParticipantsUpdate);
      socket.off("daily:call-answered-elsewhere", handleCallAnsweredElsewhere);
      socket.off("daily:join-error", handleJoinError);

      if (callObjectRef.current) {
        console.log("[DAILY] Call object exists, leaving call on cleanup");
        leaveCall();
      }
    };
  }, [leaveCall, updateLocalTracks, updateRemoteParticipant, removeRemoteParticipant]);

  // --- Emit leave on page unload (reload/close) so backend cleans up immediately ---
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callObjectRef.current) {
        console.log("[DAILY] beforeunload: emitting leave events");
        const socket = connectSocket();
        socket.emit("daily:leave-call", {});
        socket.emit("workspace:move-to-space", { spaceId: "lobby" });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // --- Toggle microphone ---
  const toggleMicrophone = useCallback(async (): Promise<boolean> => {
    const co = callObjectRef.current;
    if (!co) return false;

    const local = co.participants()?.local;
    if (!local) return false;

    const newState = !local.audio;
    co.setLocalAudio(newState);
    console.log("[DAILY] Microphone toggled:", newState);
    return newState;
  }, []);

  // --- Toggle camera ---
  const toggleCamera = useCallback(async (): Promise<boolean> => {
    const co = callObjectRef.current;
    if (!co) return false;

    const local = co.participants()?.local;
    if (!local) return false;

    const newState = !local.video;
    co.setLocalVideo(newState);
    console.log("[DAILY] Camera toggled:", newState);
    return newState;
  }, []);

  // --- Toggle screen share ---
  const toggleScreenShare = useCallback(async (): Promise<void> => {
    const co = callObjectRef.current;
    if (!co) {
      console.error("[DAILY] No active call object for screen share");
      return;
    }

    const socket = connectSocket();

    try {
      if (isScreenSharingRef.current) {
        console.log("[DAILY] Stopping screen share");
        co.stopScreenShare();
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setLocalScreenTrack(null);
        socket.emit("daily:screen-share-state", { isSharing: false });
        console.log("[DAILY] Screen share stopped");
      } else {
        console.log("[DAILY] Starting screen share");
        await co.startScreenShare();
        // Track will be picked up via participant-updated event for local participant
        // which calls updateLocalTracks
        socket.emit("daily:screen-share-state", { isSharing: true });
        console.log("[DAILY] Screen share started");
      }
    } catch (error: any) {
      console.error("[DAILY] Error toggling screen share:", error);

      if (error.name === "NotAllowedError" || error.code === "PERMISSION_DENIED") {
        console.log("[DAILY] Screen share cancelled by user");
      } else {
        toast.error(`Screen share error: ${error.message}`);
      }

      // Reset state on error
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      setLocalScreenTrack(null);
      socket.emit("daily:screen-share-state", { isSharing: false });
    }
  }, []);

  // --- Toggle cloud recording ---
  // Only the person who started recording can stop it
  const toggleCloudRecording = useCallback(async (): Promise<boolean> => {
    const co = callObjectRef.current;
    if (!co || isRecordingLoading) return isCloudRecording;

    try {
      if (isCloudRecording) {
        if (!recordingStartedByMe) {
          toast.error("Only the person who started recording can stop it");
          return true;
        }
        setIsRecordingLoading(true);
        await co.stopRecording();
        setRecordingStartedByMe(false);
        console.log("[DAILY] Stopping cloud recording");
        return false;
      } else {
        setIsRecordingLoading(true);
        await co.startRecording({ type: "cloud" });
        setRecordingStartedByMe(true);
        toast.success("Cloud recording started");
        console.log("[DAILY] Starting cloud recording");
        return true;
      }
    } catch (error: any) {
      console.error("[DAILY] Error toggling cloud recording:", error);
      toast.error(`Recording error: ${error.message || "Failed to toggle recording"}`);
      return isCloudRecording;
    } finally {
      setIsRecordingLoading(false);
    }
  }, [isCloudRecording, recordingStartedByMe, isRecordingLoading]);

  // --- Send chat message ---
  const sendChatMessage = useCallback((msg: string) => {
    const co = callObjectRef.current;
    if (!co || !msg.trim()) return;

    co.sendAppMessage({ msg: msg.trim() }, "*");

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    chatIdCounter.current += 1;
    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg-${chatIdCounter.current}`,
        sender: "local",
        senderName: "You",
        msg: msg.trim(),
        time,
      },
    ]);
    console.log("[DAILY] Chat message sent:", msg.trim());
  }, []);

  // --- Clear unread chat count ---
  const clearUnreadChat = useCallback(() => {
    setUnreadChatCount(0);
  }, []);

  return {
    inCall,
    localVideoTrack,
    localScreenTrack,
    remoteUserTracks,
    isScreenSharing,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    userInfoMap,
    localScreenShareUid: null as null, // Compat stub - Daily doesn't use dual UIDs
    is1on1Call,
    // Cloud recording
    isCloudRecording,
    recordingStartedByMe,
    isRecordingLoading,
    toggleCloudRecording,
    // Chat
    chatMessages,
    unreadChatCount,
    sendChatMessage,
    clearUnreadChat,
  };
}
