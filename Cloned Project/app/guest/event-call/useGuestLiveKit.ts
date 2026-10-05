"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  LocalParticipant,
  LocalTrackPublication,
  Participant,
  DisconnectReason,
} from "livekit-client";
import { toast } from "sonner";

// Simplified remote user tracks - same interface as useGuestDaily
export interface RemoteUserTracks {
  odId: string;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  hasAudio: boolean;
  hasVideo: boolean;
}

interface GuestLiveKitConfig {
  serverUrl: string;
  token: string;
  roomName: string;
}

/** Extract MediaStreamTracks from a RemoteParticipant */
function extractRemoteTracks(participant: RemoteParticipant) {
  const cameraPub = participant.getTrackPublication(Track.Source.Camera);
  const micPub = participant.getTrackPublication(Track.Source.Microphone);
  const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);

  const hasVideo = !!cameraPub?.track?.mediaStreamTrack;
  const hasAudio = !!micPub?.track?.mediaStreamTrack;
  const hasScreenVideo = !!screenPub?.track?.mediaStreamTrack;

  return {
    cameraTrack: hasVideo ? cameraPub!.track!.mediaStreamTrack : null,
    screenTrack: hasScreenVideo ? screenPub!.track!.mediaStreamTrack : null,
    audioTrack: hasAudio ? micPub!.track!.mediaStreamTrack : null,
    hasAudio,
    hasVideo,
    hasScreenVideo,
  };
}

export function useGuestLiveKit(config: GuestLiveKitConfig | null) {
  const roomRef = useRef<Room | null>(null);
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

  // Name map from LiveKit participant.name (set via token metadata)
  const [userInfoMap, setUserInfoMap] = useState<Map<string, string>>(new Map());

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; senderName: string; msg: string; time: string }>>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatIdCounter = useRef(0);

  // Audio element refs for cleanup
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // --- Update local tracks ---
  const updateLocalTracks = useCallback((room: Room) => {
    const local = room.localParticipant;
    if (!local) return;

    const cameraPub = local.getTrackPublication(Track.Source.Camera);
    const micPub = local.getTrackPublication(Track.Source.Microphone);
    const screenPub = local.getTrackPublication(Track.Source.ScreenShare);

    const cameraTrack = cameraPub?.track?.mediaStreamTrack ?? null;
    const audioTrack = micPub?.track?.mediaStreamTrack ?? null;
    const screenTrack = screenPub?.track?.mediaStreamTrack ?? null;

    setLocalVideoTrack(cameraTrack);
    setLocalAudioTrack(audioTrack);
    setIsMicMuted(!local.isMicrophoneEnabled);
    setIsCameraOff(!local.isCameraEnabled);

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
  const updateRemoteParticipant = useCallback((participant: RemoteParticipant) => {
    const userId = participant.identity;
    if (!userId) return;

    // Skip audience/receive-only participants (workshop preview viewers)
    if (userId.startsWith("audience-")) return;

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo } = extractRemoteTracks(participant);

    // Play audio via HTMLAudioElement
    if (audioTrack && hasAudio) {
      try {
        let audioEl = audioElementsRef.current.get(userId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioElementsRef.current.set(userId, audioEl);
        }
        audioEl.srcObject = new MediaStream([audioTrack]);
        audioEl.play().catch((e) => console.warn("[GUEST LIVEKIT] Audio autoplay failed:", e));
      } catch (e) {
        console.warn("[GUEST LIVEKIT] Error playing remote audio:", e);
      }
    }

    // Store participant name from LiveKit participant
    if (participant.name) {
      setUserInfoMap((prev) => {
        if (prev.get(userId) === participant.name) return prev;
        const updated = new Map(prev);
        updated.set(userId, participant.name!);
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

    // Clean up audio element
    const audioEl = audioElementsRef.current.get(userId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      audioElementsRef.current.delete(userId);
    }
  }, []);

  // --- Leave call ---
  const leaveCall = useCallback(async () => {
    console.log("[GUEST LIVEKIT] leaveCall called");
    const room = roomRef.current;
    if (room) {
      try {
        room.disconnect(true);
      } catch (e) {
        console.log("[GUEST LIVEKIT] Error disconnecting:", e);
      }
      roomRef.current = null;
    }

    // Clean up all audio elements
    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElementsRef.current.clear();

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
    console.log("[GUEST LIVEKIT] Call cleanup complete");
  }, []);

  // --- Join call ---
  const joinCall = useCallback(async () => {
    if (!config || isJoining || inCall) {
      console.log("[GUEST LIVEKIT] Cannot join:", { hasConfig: !!config, isJoining, inCall });
      return;
    }

    setIsJoining(true);
    console.log("[GUEST LIVEKIT] joinCall called with config:", {
      serverUrl: config.serverUrl,
      roomName: config.roomName,
    });

    // Reset screen share state when joining (clear any stale state from previous sessions)
    setScreenSharerUserId(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setLocalScreenTrack(null);
    setRemoteUserTracks(new Map());

    // Clean up existing room
    if (roomRef.current) {
      try {
        roomRef.current.disconnect(true);
      } catch (e) {
        console.log("[GUEST LIVEKIT] Error cleaning up existing room:", e);
      }
      roomRef.current = null;
    }

    try {
      console.log("[GUEST LIVEKIT] Creating LiveKit Room...");
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Set up event handlers BEFORE connecting

      // Remote participant connected
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log(`[GUEST LIVEKIT] ParticipantConnected: ${participant.identity}`);
        updateRemoteParticipant(participant);
      });

      // Remote track subscribed
      room.on(
        RoomEvent.TrackSubscribed,
        (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          console.log(`[GUEST LIVEKIT] TrackSubscribed: ${participant.identity} source=${publication.source}`);
          updateRemoteParticipant(participant);
        }
      );

      // Remote track unsubscribed
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          console.log(`[GUEST LIVEKIT] TrackUnsubscribed: ${participant.identity} source=${publication.source}`);
          updateRemoteParticipant(participant);
        }
      );

      // Remote track muted/unmuted
      room.on(RoomEvent.TrackMuted, (publication, participant: Participant) => {
        if (participant instanceof RemoteParticipant) {
          updateRemoteParticipant(participant);
        }
      });

      room.on(RoomEvent.TrackUnmuted, (publication, participant: Participant) => {
        if (participant instanceof RemoteParticipant) {
          updateRemoteParticipant(participant);
        }
      });

      // Local track published
      room.on(
        RoomEvent.LocalTrackPublished,
        (publication: LocalTrackPublication, participant: LocalParticipant) => {
          console.log(`[GUEST LIVEKIT] LocalTrackPublished: source=${publication.source}`);
          updateLocalTracks(room);
        }
      );

      room.on(
        RoomEvent.LocalTrackUnpublished,
        (publication: LocalTrackPublication, participant: LocalParticipant) => {
          console.log(`[GUEST LIVEKIT] LocalTrackUnpublished: source=${publication.source}`);
          updateLocalTracks(room);
        }
      );

      // Participant disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        const userId = participant.identity;
        console.log(`[GUEST LIVEKIT] ParticipantDisconnected: ${userId}`);
        if (userId) removeRemoteParticipant(userId);
      });

      // Chat & host controls: listen for incoming data messages
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          const decoded = JSON.parse(new TextDecoder().decode(payload));

          // Handle host mute request
          if (decoded.type === "host-mute-request") {
            const localIdentity = room.localParticipant?.identity;
            if (localIdentity && localIdentity === decoded.targetUserId) {
              room.localParticipant.setMicrophoneEnabled(false);
              setIsMicMuted(true);
              toast.info("You have been muted by the host");
            }
            return;
          }

          // Handle host kick request
          if (decoded.type === "host-kick-request") {
            const localIdentity = room.localParticipant?.identity;
            if (localIdentity && localIdentity === decoded.targetUserId) {
              toast.info("You have been removed from the call by the host");
              leaveCall();
            }
            return;
          }

          if (!decoded?.msg) return;

          const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          chatIdCounter.current += 1;
          const senderName = participant?.name || participant?.identity || "Unknown";
          setChatMessages((prev) => [...prev, {
            id: `msg-${chatIdCounter.current}`,
            sender: participant?.identity || "unknown",
            senderName,
            msg: decoded.msg,
            time,
          }]);
          setUnreadChatCount((prev) => prev + 1);
        } catch (e) {
          // Not a valid message, ignore
        }
      });

      // Room disconnected unexpectedly
      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.log("[GUEST LIVEKIT] Room disconnected, reason:", reason);
        toast.error("Call disconnected");
        leaveCall();
      });

      // Room error
      // Note: LiveKit Room does not have a direct "error" event like Daily.
      // Fatal errors result in a Disconnected event with a reason.

      // Connect to the room
      console.log("[GUEST LIVEKIT] Connecting to room:", config.serverUrl);
      await room.connect(config.serverUrl, config.token);
      console.log("[GUEST LIVEKIT] Successfully connected to room:", room.name);

      // Enable microphone and camera
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(true);

      // Extract local tracks after enabling
      updateLocalTracks(room);

      // Process existing remote participants
      room.remoteParticipants.forEach((participant) => {
        if (!participant.identity.startsWith("audience-")) {
          updateRemoteParticipant(participant);
        }
      });

      setInCall(true);
      toast.success("Joined the meeting successfully!");
    } catch (error: any) {
      console.error("[GUEST LIVEKIT] Join failed:", error);

      if (error.name === "NotAllowedError" || error.message?.includes("permission")) {
        toast.error("Camera/microphone permission denied. Please allow access and try again.");
      } else if (error.name === "NotFoundError") {
        toast.error("Camera or microphone not found. Please check your devices.");
      } else {
        toast.error(`Failed to join call: ${error.message || "Unknown error"}`);
      }

      if (roomRef.current) {
        try {
          roomRef.current.disconnect(true);
        } catch (e) {
          console.log("[GUEST LIVEKIT] Error during cleanup:", e);
        }
        roomRef.current = null;
      }
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
    } finally {
      setIsJoining(false);
    }
  }, [config, isJoining, inCall, leaveCall, updateLocalTracks, updateRemoteParticipant, removeRemoteParticipant]);

  // --- Toggle microphone ---
  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return false;

    const local = room.localParticipant;
    const isEnabled = local.isMicrophoneEnabled;
    await local.setMicrophoneEnabled(!isEnabled);
    setIsMicMuted(isEnabled); // if was enabled, now muted
    console.log("[GUEST LIVEKIT] Microphone toggled:", !isEnabled);

    updateLocalTracks(room);
    return !isEnabled;
  }, [updateLocalTracks]);

  // --- Toggle camera ---
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return false;

    const local = room.localParticipant;
    const isEnabled = local.isCameraEnabled;
    await local.setCameraEnabled(!isEnabled);
    setIsCameraOff(isEnabled); // if was enabled, now off
    console.log("[GUEST LIVEKIT] Camera toggled:", !isEnabled);

    updateLocalTracks(room);
    return !isEnabled;
  }, [updateLocalTracks]);

  // --- Toggle screen share ---
  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      console.error("[GUEST LIVEKIT] No active room for screen share");
      return;
    }

    try {
      if (isScreenSharingRef.current) {
        console.log("[GUEST LIVEKIT] Stopping screen share");
        await room.localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setLocalScreenTrack(null);
      } else {
        console.log("[GUEST LIVEKIT] Starting screen share");
        await room.localParticipant.setScreenShareEnabled(true);
        // Track will be picked up via LocalTrackPublished event
      }
    } catch (error: any) {
      console.error("[GUEST LIVEKIT] Error toggling screen share:", error);
      if (error.name === "NotAllowedError" || error.code === "PERMISSION_DENIED") {
        console.log("[GUEST LIVEKIT] Screen share cancelled by user");
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
      if (roomRef.current) {
        console.log("[GUEST LIVEKIT] Component unmounting while in call, cleaning up");
        try {
          roomRef.current.disconnect(true);
        } catch (e) {
          console.log("[GUEST LIVEKIT] Error during unmount cleanup:", e);
        }
        roomRef.current = null;
      }
      // Clean up all audio elements
      audioElementsRef.current.forEach((el) => {
        el.srcObject = null;
        el.remove();
      });
      audioElementsRef.current.clear();
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
    const room = roomRef.current;
    if (!room || !msg.trim()) return;

    const payload = new TextEncoder().encode(JSON.stringify({ msg: msg.trim() }));
    room.localParticipant.publishData(payload, { reliable: true });

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
