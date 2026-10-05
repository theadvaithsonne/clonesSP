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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Simplified remote user tracks - same interface as useMeetDaily
export interface RemoteUserTracks {
  odId: string;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  hasAudio: boolean;
  hasVideo: boolean;
}

interface MeetLiveKitConfig {
  serverUrl: string;
  token: string;
  roomName: string;
}

/** Extract MediaStreamTracks from a RemoteParticipant's published tracks */
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
  };
}

export function useMeetLiveKit(config: MeetLiveKitConfig | null, isHost: boolean = false) {
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

  // Audio elements for remote participants (managed outside React state to avoid re-renders)
  const remoteAudioEls = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Name map from LiveKit participant.name (set via token metadata)
  const [userInfoMap, setUserInfoMap] = useState<Map<string, string>>(new Map());

  // Device selection state
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableSpeakers, setAvailableSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");
  const selectedSpeakerIdRef = useRef<string>("");
  // Keep ref in sync with state so callbacks always see the latest value
  useEffect(() => { selectedSpeakerIdRef.current = selectedSpeakerId; }, [selectedSpeakerId]);

  // Active speaker state
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  // Kick state
  const [wasKicked, setWasKicked] = useState(false);

  // Cloud recording state
  const [isCloudRecording, setIsCloudRecording] = useState(false);
  const [recordingStartedByMe, setRecordingStartedByMe] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const activeEgressIdRef = useRef<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; senderName: string; msg: string; time: string }>>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatIdCounter = useRef(0);

  // Server-authoritative screen sharer userId setter (for external polling)
  const [serverScreenSharerUserId, setServerScreenSharerUserId] = useState<string | null>(null);

  // --- Update local tracks from the room's local participant ---
  const updateLocalTracks = useCallback((room: Room) => {
    const local = room.localParticipant;
    if (!local) return;

    const cameraPub = local.getTrackPublication(Track.Source.Camera);
    const micPub = local.getTrackPublication(Track.Source.Microphone);
    const screenPub = local.getTrackPublication(Track.Source.ScreenShare);

    setLocalVideoTrack(cameraPub?.track?.mediaStreamTrack ?? null);
    setLocalAudioTrack(micPub?.track?.mediaStreamTrack ?? null);
    setIsMicMuted(!local.isMicrophoneEnabled);
    setIsCameraOff(!local.isCameraEnabled);

    const screenTrack = screenPub?.track?.mediaStreamTrack ?? null;
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

  // --- Enumerate available devices ---
  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await Room.getLocalDevices();

      // Filter out "default" pseudo-devices to avoid duplicate entries
      const filtered = allDevices.filter((d: MediaDeviceInfo) => d.deviceId !== "default");

      setAvailableMicrophones(filtered.filter((d: MediaDeviceInfo) => d.kind === "audioinput"));
      setAvailableCameras(filtered.filter((d: MediaDeviceInfo) => d.kind === "videoinput"));
      setAvailableSpeakers(filtered.filter((d: MediaDeviceInfo) => d.kind === "audiooutput"));

      // Try to determine currently active input devices from the room's local participant tracks
      const room = roomRef.current;
      if (room) {
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);

        // Get the deviceId from the active track's settings
        const activeMicId = micPub?.track?.mediaStreamTrack?.getSettings()?.deviceId;
        const activeCamId = camPub?.track?.mediaStreamTrack?.getSettings()?.deviceId;

        if (activeMicId && activeMicId !== "default") {
          setSelectedMicId(activeMicId);
        } else {
          // Fallback: resolve "default" by label, or use first available
          const mics = filtered.filter((d: MediaDeviceInfo) => d.kind === "audioinput");
          if (activeMicId === "default") {
            const defaultLabel = allDevices.find((d: MediaDeviceInfo) => d.deviceId === "default" && d.kind === "audioinput")?.label;
            const actualName = defaultLabel?.replace(/^Default\s*-\s*/, "") || "";
            const actual = mics.find((d: MediaDeviceInfo) => d.label === actualName);
            setSelectedMicId(actual?.deviceId || mics[0]?.deviceId || "");
          } else if (mics.length > 0) {
            setSelectedMicId(mics[0].deviceId);
          }
        }

        if (activeCamId && activeCamId !== "default") {
          setSelectedCameraId(activeCamId);
        } else {
          const cams = filtered.filter((d: MediaDeviceInfo) => d.kind === "videoinput");
          if (activeCamId === "default") {
            const defaultLabel = allDevices.find((d: MediaDeviceInfo) => d.deviceId === "default" && d.kind === "videoinput")?.label;
            const actualName = defaultLabel?.replace(/^Default\s*-\s*/, "") || "";
            const actual = cams.find((d: MediaDeviceInfo) => d.label === actualName);
            setSelectedCameraId(actual?.deviceId || cams[0]?.deviceId || "");
          } else if (cams.length > 0) {
            setSelectedCameraId(cams[0].deviceId);
          }
        }
      }

      // Set initial speaker if not already set
      const speakers = filtered.filter((d: MediaDeviceInfo) => d.kind === "audiooutput");
      if (!selectedSpeakerIdRef.current && speakers.length > 0) {
        setSelectedSpeakerId(speakers[0].deviceId);
      }

      console.log("[MEET LIVEKIT] Enumerated devices");
    } catch (e) {
      console.warn("[MEET LIVEKIT] Error enumerating devices:", e);
    }
  }, []);

  // --- Switch microphone ---
  const switchMicrophone = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.switchActiveDevice("audioinput", deviceId);
      setSelectedMicId(deviceId);
      updateLocalTracks(room);
      console.log("[MEET LIVEKIT] Switched microphone to:", deviceId);
    } catch (e) {
      console.error("[MEET LIVEKIT] Error switching microphone:", e);
      toast.error("Failed to switch microphone");
    }
  }, [updateLocalTracks]);

  // --- Switch camera ---
  const switchCamera = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.switchActiveDevice("videoinput", deviceId);
      setSelectedCameraId(deviceId);
      updateLocalTracks(room);
      console.log("[MEET LIVEKIT] Switched camera to:", deviceId);
    } catch (e) {
      console.error("[MEET LIVEKIT] Error switching camera:", e);
      toast.error("Failed to switch camera");
    }
  }, [updateLocalTracks]);

  // --- Switch speaker (Chromium only) ---
  const switchSpeaker = useCallback(async (deviceId: string) => {
    try {
      // Update speaker on all existing remote audio elements
      const promises: Promise<void>[] = [];
      remoteAudioEls.current.forEach((el) => {
        if (typeof (el as any).setSinkId === "function") {
          promises.push((el as any).setSinkId(deviceId));
        }
      });
      await Promise.all(promises);
      setSelectedSpeakerId(deviceId);
      console.log("[MEET LIVEKIT] Switched speaker to:", deviceId);
    } catch (e) {
      console.error("[MEET LIVEKIT] Error switching speaker:", e);
      toast.error("Failed to switch speaker. This feature requires Chrome or Edge.");
    }
  }, []);

  // --- Update a remote participant in the tracks map ---
  const updateRemoteParticipant = useCallback((participant: RemoteParticipant) => {
    const userId = participant.identity;
    if (!userId) return;

    // Skip audience/receive-only participants (workshop preview viewers)
    if (userId.startsWith("audience-")) {
      return;
    }

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo } = extractRemoteTracks(participant);

    // Play remote audio via a dedicated Audio element per user
    if (audioTrack && hasAudio) {
      let audioEl = remoteAudioEls.current.get(userId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        // Apply selected speaker if one has been chosen
        const speakerId = selectedSpeakerIdRef.current;
        if (speakerId && typeof (audioEl as any).setSinkId === "function") {
          (audioEl as any).setSinkId(speakerId).catch((e: any) =>
            console.warn("[MEET LIVEKIT] setSinkId failed for new audio element:", e)
          );
        }
        remoteAudioEls.current.set(userId, audioEl);
      }
      const stream = audioEl.srcObject as MediaStream | null;
      // Only update if the track changed
      if (!stream || stream.getAudioTracks()[0]?.id !== audioTrack.id) {
        audioEl.srcObject = new MediaStream([audioTrack]);
        audioEl.play().catch((e) => console.warn("[MEET LIVEKIT] Audio autoplay failed:", e));
      }
    } else {
      // Participant muted or no audio - clean up their audio element
      const audioEl = remoteAudioEls.current.get(userId);
      if (audioEl) {
        audioEl.srcObject = null;
        remoteAudioEls.current.delete(userId);
      }
    }

    // Store participant name from LiveKit participant (set via token)
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
    // Clean up audio element
    const audioEl = remoteAudioEls.current.get(userId);
    if (audioEl) {
      audioEl.srcObject = null;
      remoteAudioEls.current.delete(userId);
    }
    setRemoteUserTracks((prev) => {
      const updated = new Map(prev);
      updated.delete(userId);
      return updated;
    });
    setScreenSharerUserId((prev) => (prev === userId ? null : prev));
  }, []);

  // --- Leave call ---
  const leaveCall = useCallback(async () => {
    console.log("[MEET LIVEKIT] leaveCall called");
    const room = roomRef.current;
    if (room) {
      try {
        room.disconnect(true);
      } catch (e) {
        console.log("[MEET LIVEKIT] Error leaving call:", e);
      }
      roomRef.current = null;
    }

    setInCall(false);
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setLocalScreenTrack(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setRemoteUserTracks(new Map());
    // Clean up all remote audio elements
    remoteAudioEls.current.forEach((el) => { el.srcObject = null; });
    remoteAudioEls.current.clear();
    setUserInfoMap(new Map());
    setIsCloudRecording(false);
    setRecordingStartedByMe(false);
    setIsRecordingLoading(false);
    activeEgressIdRef.current = null;
    setChatMessages([]);
    setUnreadChatCount(0);
    setIsMicMuted(false);
    setIsCameraOff(false);
    setScreenSharerUserId(null);
    setActiveSpeakerId(null);
    setAvailableMicrophones([]);
    setAvailableCameras([]);
    setAvailableSpeakers([]);
    setSelectedMicId("");
    setSelectedCameraId("");
    setSelectedSpeakerId("");

    // Remove device change listener
    navigator.mediaDevices.removeEventListener("devicechange", enumerateDevices);

    console.log("[MEET LIVEKIT] Call cleanup complete");
  }, [enumerateDevices]);

  // --- Join call ---
  const joinCall = useCallback(async () => {
    if (!config || isJoining || inCall) {
      console.log("[MEET LIVEKIT] Cannot join:", { hasConfig: !!config, isJoining, inCall });
      return;
    }

    setIsJoining(true);
    console.log("[MEET LIVEKIT] joinCall called with config:", {
      serverUrl: config.serverUrl,
      roomName: config.roomName,
    });

    // Reset screen share state when joining (clear any stale state from previous sessions)
    setScreenSharerUserId(null);
    setServerScreenSharerUserId(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setLocalScreenTrack(null);
    setRemoteUserTracks(new Map());

    // Clean up existing room
    if (roomRef.current) {
      try {
        roomRef.current.disconnect(true);
      } catch (e) {
        console.log("[MEET LIVEKIT] Error cleaning up existing room:", e);
      }
      roomRef.current = null;
    }

    try {
      console.log("[MEET LIVEKIT] Creating LiveKit Room...");
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Set up event handlers BEFORE connecting

      // Remote participant connected
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log(`[MEET LIVEKIT] ParticipantConnected: ${participant.identity}`);
        updateRemoteParticipant(participant);
      });

      // Remote track subscribed (new track available)
      room.on(
        RoomEvent.TrackSubscribed,
        (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          console.log(`[MEET LIVEKIT] TrackSubscribed: ${participant.identity} source=${publication.source}`);
          updateRemoteParticipant(participant);
        }
      );

      // Remote track unsubscribed
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          console.log(`[MEET LIVEKIT] TrackUnsubscribed: ${participant.identity} source=${publication.source}`);
          updateRemoteParticipant(participant);
        }
      );

      // Remote track muted/unmuted
      room.on(
        RoomEvent.TrackMuted,
        (publication, participant: Participant) => {
          if (participant instanceof RemoteParticipant) {
            updateRemoteParticipant(participant);
          } else if (participant === room.localParticipant) {
            updateLocalTracks(room);
          }
        }
      );

      room.on(
        RoomEvent.TrackUnmuted,
        (publication, participant: Participant) => {
          if (participant instanceof RemoteParticipant) {
            updateRemoteParticipant(participant);
          } else if (participant === room.localParticipant) {
            updateLocalTracks(room);
          }
        }
      );

      // Local track published (after we enable mic/camera)
      room.on(
        RoomEvent.LocalTrackPublished,
        (publication: LocalTrackPublication, participant: LocalParticipant) => {
          console.log(`[MEET LIVEKIT] LocalTrackPublished: source=${publication.source}`);
          updateLocalTracks(room);
        }
      );

      room.on(
        RoomEvent.LocalTrackUnpublished,
        (publication: LocalTrackPublication, participant: LocalParticipant) => {
          console.log(`[MEET LIVEKIT] LocalTrackUnpublished: source=${publication.source}`);
          updateLocalTracks(room);
        }
      );

      // Participant disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        const userId = participant.identity;
        console.log(`[MEET LIVEKIT] ParticipantDisconnected: ${userId}`);
        if (userId) removeRemoteParticipant(userId);
      });

      // Active speaker detection
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        // Find first non-local active speaker
        let speakerUserId: string | null = null;
        for (const speaker of speakers) {
          if (speaker instanceof RemoteParticipant) {
            speakerUserId = speaker.identity || null;
            break;
          }
        }
        setActiveSpeakerId(speakerUserId);
      });

      // Chat & host control messages via DataChannel
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

          // Handle host unmute request
          if (decoded.type === "host-unmute-request") {
            const localIdentity = room.localParticipant?.identity;
            if (localIdentity && localIdentity === decoded.targetUserId) {
              room.localParticipant.setMicrophoneEnabled(true);
              setIsMicMuted(false);
              toast.info("The host has unmuted you");
            }
            return;
          }

          // Handle host kick
          if (decoded.type === "host-kick") {
            const localIdentity = room.localParticipant?.identity;
            if (localIdentity && localIdentity === decoded.targetUserId) {
              toast.error("You have been removed from the meeting by the host");
              setWasKicked(true);
              setTimeout(() => leaveCall(), 1500);
            }
            return;
          }

          if (!decoded.msg) return;
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
          // Not a valid JSON message, ignore
        }
      });

      // Room disconnected
      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.log("[MEET LIVEKIT] Room disconnected, reason:", reason);
        // Only handle unexpected disconnects - if leaveCall was called it will handle cleanup
        if (roomRef.current) {
          toast.error("Call disconnected unexpectedly");
          leaveCall();
        }
      });

      // Listen for device changes (headphones plugged/unplugged)
      navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);

      // Connect to the room
      console.log("[MEET LIVEKIT] Connecting to room:", config.serverUrl);
      await room.connect(config.serverUrl, config.token);
      console.log("[MEET LIVEKIT] Successfully connected to room:", room.name);

      // Enable microphone and camera
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);

      // Extract local tracks after enabling
      updateLocalTracks(room);

      // Non-host participants join muted by default
      if (!isHost) {
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMicMuted(true);
        console.log("[MEET LIVEKIT] Non-host participant joined muted");
      }

      // Process existing remote participants (skip audience/receive-only viewers)
      room.remoteParticipants.forEach((participant) => {
        if (!participant.identity.startsWith("audience-")) {
          updateRemoteParticipant(participant);
        }
      });

      setInCall(true);
      enumerateDevices();
      toast.success(isHost ? "Joined the meeting successfully!" : "Joined the meeting (muted by default)");
    } catch (error: any) {
      console.error("[MEET LIVEKIT] Join failed:", error);

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
          console.log("[MEET LIVEKIT] Error during cleanup:", e);
        }
        roomRef.current = null;
      }
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
    } finally {
      setIsJoining(false);
    }
  }, [config, isJoining, inCall, isHost, leaveCall, updateLocalTracks, updateRemoteParticipant, removeRemoteParticipant, enumerateDevices]);

  // --- Toggle microphone ---
  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return false;
    const local = room.localParticipant;
    const newState = !local.isMicrophoneEnabled;
    await local.setMicrophoneEnabled(newState);
    setIsMicMuted(!newState);
    console.log("[MEET LIVEKIT] Microphone toggled:", newState);
    return newState;
  }, []);

  // --- Toggle camera ---
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return false;
    const local = room.localParticipant;
    const newState = !local.isCameraEnabled;
    await local.setCameraEnabled(newState);
    setIsCameraOff(!newState);
    console.log("[MEET LIVEKIT] Camera toggled:", newState);
    return newState;
  }, []);

  // --- Toggle screen share ---
  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      console.error("[MEET LIVEKIT] No active room for screen share");
      return;
    }

    try {
      if (isScreenSharingRef.current) {
        console.log("[MEET LIVEKIT] Stopping screen share");
        await room.localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setLocalScreenTrack(null);
        console.log("[MEET LIVEKIT] Screen share stopped");
      } else {
        console.log("[MEET LIVEKIT] Starting screen share");
        await room.localParticipant.setScreenShareEnabled(true);
        // Track picked up via LocalTrackPublished event
        console.log("[MEET LIVEKIT] Screen share started");
      }
    } catch (error: any) {
      console.error("[MEET LIVEKIT] Error toggling screen share:", error);
      if (error.name === "NotAllowedError") {
        console.log("[MEET LIVEKIT] Screen share cancelled by user");
      } else {
        toast.error(`Screen share error: ${error.message}`);
      }
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      setLocalScreenTrack(null);
    }
  }, []);

  // Cleanup on unmount
  const shouldCleanupRef = useRef(false);

  useEffect(() => {
    shouldCleanupRef.current = inCall;
  }, [inCall]);

  useEffect(() => {
    return () => {
      if (shouldCleanupRef.current && roomRef.current) {
        console.log("[MEET LIVEKIT] Component unmounting while in call, cleaning up");
        try {
          roomRef.current.disconnect(true);
        } catch (e) {
          console.log("[MEET LIVEKIT] Error during unmount cleanup:", e);
        }
      }
    };
  }, []);

  // Sync server screen sharer to local state
  useEffect(() => {
    if (serverScreenSharerUserId !== null && screenSharerUserId !== serverScreenSharerUserId) {
      setScreenSharerUserId(serverScreenSharerUserId);
    } else if (serverScreenSharerUserId === null && screenSharerUserId !== null && !isScreenSharing) {
      setScreenSharerUserId(null);
    }
  }, [serverScreenSharerUserId, isScreenSharing, screenSharerUserId]);

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

  // --- Toggle cloud recording (via backend Egress API) ---
  const toggleCloudRecording = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room || isRecordingLoading) return isCloudRecording;

    const roomName = config?.roomName || room.name;
    if (!roomName) {
      toast.error("Cannot determine room name for recording");
      return isCloudRecording;
    }

    try {
      if (isCloudRecording) {
        if (!recordingStartedByMe) {
          toast.error("Only the person who started recording can stop it");
          return true;
        }
        setIsRecordingLoading(true);
        const egressId = activeEgressIdRef.current;
        if (egressId) {
          await fetch(`${API_URL}/livekit/recording/stop`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ egressId }),
          });
        }
        setIsCloudRecording(false);
        setRecordingStartedByMe(false);
        activeEgressIdRef.current = null;
        toast.info("Recording stopped");
        console.log("[MEET LIVEKIT] Stopped cloud recording");
        return false;
      } else {
        setIsRecordingLoading(true);
        const res = await fetch(`${API_URL}/livekit/recording/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName }),
        });
        const data = await res.json();
        if (data.egressId) {
          activeEgressIdRef.current = data.egressId;
          setIsCloudRecording(true);
          setRecordingStartedByMe(true);
          toast.success("Cloud recording started");
          console.log("[MEET LIVEKIT] Started cloud recording, egressId:", data.egressId);
          return true;
        } else {
          toast.error(data.error || "Failed to start recording");
          return false;
        }
      }
    } catch (error: any) {
      console.error("[MEET LIVEKIT] Error toggling cloud recording:", error);
      toast.error(`Recording error: ${error.message || "Failed to toggle recording"}`);
      return isCloudRecording;
    } finally {
      setIsRecordingLoading(false);
    }
  }, [config, isCloudRecording, recordingStartedByMe, isRecordingLoading]);

  // --- Mute a remote participant (host only) ---
  const muteParticipant = useCallback((targetUserId: string) => {
    const room = roomRef.current;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify({ type: "host-mute-request", targetUserId }));
    room.localParticipant.publishData(payload, { reliable: true });
    console.log("[MEET LIVEKIT] Sent mute request for:", targetUserId);
  }, []);

  // --- Unmute a remote participant (host only) ---
  const unmuteParticipant = useCallback((targetUserId: string) => {
    const room = roomRef.current;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify({ type: "host-unmute-request", targetUserId }));
    room.localParticipant.publishData(payload, { reliable: true });
    console.log("[MEET LIVEKIT] Sent unmute request for:", targetUserId);
  }, []);

  // --- Kick a remote participant (host only) ---
  const kickParticipant = useCallback((targetUserId: string) => {
    const room = roomRef.current;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify({ type: "host-kick", targetUserId }));
    room.localParticipant.publishData(payload, { reliable: true });
    console.log("[MEET LIVEKIT] Sent kick message for:", targetUserId);
  }, []);

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
    setServerScreenSharerUserId,
    joinCall,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
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
  };
}
