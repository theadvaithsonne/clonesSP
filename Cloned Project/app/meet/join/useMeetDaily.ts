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

interface MeetDailyConfig {
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

export function useMeetDaily(config: MeetDailyConfig | null, isHost: boolean = false) {
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

  // Audio elements for remote participants (managed outside React state to avoid re-renders)
  const remoteAudioEls = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Name map from Daily's participant.user_name (set via meeting token)
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

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; senderName: string; msg: string; time: string }>>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatIdCounter = useRef(0);

  // Server-authoritative screen sharer userId setter (for external polling)
  const [serverScreenSharerUserId, setServerScreenSharerUserId] = useState<string | null>(null);

  // --- Update local tracks from the local participant ---
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

  // --- Enumerate available devices ---
  const enumerateDevices = useCallback(async () => {
    const co = callObjectRef.current;
    if (!co) return;

    try {
      const { devices } = await co.enumerateDevices();

      // Filter out "default" pseudo-devices to avoid duplicate entries
      // (browser lists e.g. "Default - AirPods" AND "AirPods" for the same device)
      const filtered = devices.filter((d: MediaDeviceInfo) => d.deviceId !== "default");

      setAvailableMicrophones(filtered.filter((d: MediaDeviceInfo) => d.kind === "audioinput"));
      setAvailableCameras(filtered.filter((d: MediaDeviceInfo) => d.kind === "videoinput"));
      setAvailableSpeakers(filtered.filter((d: MediaDeviceInfo) => d.kind === "audiooutput"));

      // Get current input devices to set selected state
      const inputDevices = await co.getInputDevices();
      const micId = (inputDevices as any).mic?.deviceId;
      const camId = (inputDevices as any).camera?.deviceId;
      // If the returned ID is "default", resolve to the actual device by label
      if (micId) {
        if (micId === "default") {
          const defaultLabel = devices.find((d: MediaDeviceInfo) => d.deviceId === "default" && d.kind === "audioinput")?.label;
          const actualName = defaultLabel?.replace(/^Default\s*-\s*/, "") || "";
          const actual = filtered.find((d: MediaDeviceInfo) => d.kind === "audioinput" && d.label === actualName);
          setSelectedMicId(actual?.deviceId || filtered.find((d: MediaDeviceInfo) => d.kind === "audioinput")?.deviceId || "");
        } else {
          setSelectedMicId(micId);
        }
      }
      if (camId) {
        if (camId === "default") {
          const defaultLabel = devices.find((d: MediaDeviceInfo) => d.deviceId === "default" && d.kind === "videoinput")?.label;
          const actualName = defaultLabel?.replace(/^Default\s*-\s*/, "") || "";
          const actual = filtered.find((d: MediaDeviceInfo) => d.kind === "videoinput" && d.label === actualName);
          setSelectedCameraId(actual?.deviceId || filtered.find((d: MediaDeviceInfo) => d.kind === "videoinput")?.deviceId || "");
        } else {
          setSelectedCameraId(camId);
        }
      }

      // Get current output device (speaker) to set selected state
      const speakers = filtered.filter((d: MediaDeviceInfo) => d.kind === "audiooutput");
      try {
        const outputDevice = await (co as any).getOutputDevice();
        const speakerId = outputDevice?.deviceId;
        if (speakerId && speakerId !== "default") {
          setSelectedSpeakerId(speakerId);
        } else if (speakers.length > 0) {
          setSelectedSpeakerId(speakers[0].deviceId);
        }
      } catch {
        if (speakers.length > 0) {
          setSelectedSpeakerId(speakers[0].deviceId);
        }
      }

      console.log("[MEET DAILY] Enumerated devices");
    } catch (e) {
      console.warn("[MEET DAILY] Error enumerating devices:", e);
    }
  }, []);

  // --- Switch microphone ---
  const switchMicrophone = useCallback(async (deviceId: string) => {
    const co = callObjectRef.current;
    if (!co) return;

    try {
      await co.setInputDevicesAsync({ audioDeviceId: deviceId });
      setSelectedMicId(deviceId);
      updateLocalTracks(co);
      console.log("[MEET DAILY] Switched microphone to:", deviceId);
    } catch (e) {
      console.error("[MEET DAILY] Error switching microphone:", e);
      toast.error("Failed to switch microphone");
    }
  }, [updateLocalTracks]);

  // --- Switch camera ---
  const switchCamera = useCallback(async (deviceId: string) => {
    const co = callObjectRef.current;
    if (!co) return;

    try {
      await co.setInputDevicesAsync({ videoDeviceId: deviceId });
      setSelectedCameraId(deviceId);
      updateLocalTracks(co);
      console.log("[MEET DAILY] Switched camera to:", deviceId);
    } catch (e) {
      console.error("[MEET DAILY] Error switching camera:", e);
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
      console.log("[MEET DAILY] Switched speaker to:", deviceId);
    } catch (e) {
      console.error("[MEET DAILY] Error switching speaker:", e);
      toast.error("Failed to switch speaker. This feature requires Chrome or Edge.");
    }
  }, []);

  // --- Update a remote participant in the tracks map ---
  const updateRemoteParticipant = useCallback((participant: DailyParticipant) => {
    const userId = participant.user_id;
    if (!userId || participant.local) return;

    // Skip audience/receive-only participants (workshop preview viewers)
    // They join with audioSource: false, videoSource: false and userId starting with "audience-"
    if (userId.startsWith("audience-")) {
      return;
    }

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo } = extractTracks(participant);

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
            console.warn("[MEET DAILY] setSinkId failed for new audio element:", e)
          );
        }
        remoteAudioEls.current.set(userId, audioEl);
      }
      const stream = audioEl.srcObject as MediaStream | null;
      // Only update if the track changed
      if (!stream || stream.getAudioTracks()[0]?.id !== audioTrack.id) {
        audioEl.srcObject = new MediaStream([audioTrack]);
        audioEl.play().catch((e) => console.warn("[MEET DAILY] Audio autoplay failed:", e));
      }
    } else {
      // Participant muted or no audio — clean up their audio element
      const audioEl = remoteAudioEls.current.get(userId);
      if (audioEl) {
        audioEl.srcObject = null;
        remoteAudioEls.current.delete(userId);
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
    console.log("[MEET DAILY] leaveCall called");
    const co = callObjectRef.current;
    if (co) {
      try {
        await co.leave();
        co.destroy();
      } catch (e) {
        console.log("[MEET DAILY] Error leaving call:", e);
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
    // Clean up all remote audio elements
    remoteAudioEls.current.forEach((el) => { el.srcObject = null; });
    remoteAudioEls.current.clear();
    setUserInfoMap(new Map());
    setIsCloudRecording(false);
    setRecordingStartedByMe(false);
    setIsRecordingLoading(false);
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

    console.log("[MEET DAILY] Call cleanup complete");
  }, [enumerateDevices]);

  // --- Join call ---
  const joinCall = useCallback(async () => {
    if (!config || isJoining || inCall) {
      console.log("[MEET DAILY] Cannot join:", { hasConfig: !!config, isJoining, inCall });
      return;
    }

    setIsJoining(true);
    console.log("[MEET DAILY] joinCall called with config:", {
      roomUrl: config.roomUrl,
      roomName: config.roomName,
    });

    // Reset screen share state when joining (clear any stale state from previous sessions)
    setScreenSharerUserId(null);
    setServerScreenSharerUserId(null);
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
        console.log("[MEET DAILY] Error cleaning up existing call:", e);
      }
      callObjectRef.current = null;
    }

    try {
      console.log("[MEET DAILY] Creating Daily call object...");
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
        console.log(`[MEET DAILY] participant-joined: ${p.user_id || p.session_id}`);
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
        console.log(`[MEET DAILY] participant-left: ${userId}`);
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

        // Handle host unmute request
        if (event.data.type === "host-unmute-request") {
          const local = callObject.participants()?.local;
          if (local && local.user_id === event.data.targetUserId) {
            callObject.setLocalAudio(true);
            setIsMicMuted(false);
            toast.info("The host has unmuted you");
          }
          return;
        }

        // Handle host kick
        if (event.data.type === "host-kick") {
          const local = callObject.participants()?.local;
          if (local && local.user_id === event.data.targetUserId) {
            toast.error("You have been removed from the meeting by the host");
            setWasKicked(true);
            setTimeout(() => leaveCall(), 1500);
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

      // Cloud recording events
      callObject.on("recording-started", () => {
        setIsCloudRecording(true);
      });
      callObject.on("recording-stopped", () => {
        setIsCloudRecording(false);
        setRecordingStartedByMe(false);
        toast.info("Recording stopped");
      });
      callObject.on("recording-error", (event: any) => {
        setIsCloudRecording(false);
        setRecordingStartedByMe(false);
        toast.error(`Recording error: ${event?.errorMsg || "Unknown error"}`);
      });

      callObject.on("error", (event?: DailyEventObjectFatalError) => {
        console.error("[MEET DAILY] Fatal error:", event);
        toast.error(`Call error: ${event?.errorMsg || "Unknown error"}`);
        leaveCall();
      });

      // Active speaker detection
      callObject.on("active-speaker-change", (event: any) => {
        if (!event?.activeSpeaker?.peerId) return;
        const peerId = event.activeSpeaker.peerId;
        const allParticipants = callObject.participants();
        let speakerUserId: string | null = null;

        for (const p of Object.values(allParticipants)) {
          if (p.session_id === peerId) {
            if (!p.local) {
              speakerUserId = p.user_id || null;
            }
            break;
          }
        }

        setActiveSpeakerId(speakerUserId);
      });

      // Listen for device changes (headphones plugged/unplugged)
      navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);

      // Join
      console.log("[MEET DAILY] Joining room:", config.roomUrl);
      await callObject.join({
        url: config.roomUrl,
        token: config.token,
      });
      console.log("[MEET DAILY] Successfully joined room");

      // Extract local tracks
      updateLocalTracks(callObject);

      // Non-host participants join muted by default
      if (!isHost) {
        callObject.setLocalAudio(false);
        setIsMicMuted(true);
        console.log("[MEET DAILY] Non-host participant joined muted");
      }

      // Process existing remote participants (skip audience/receive-only viewers)
      const participants = callObject.participants();
      Object.values(participants).forEach((p) => {
        if (!p.local && p.user_id && !p.user_id.startsWith("audience-")) {
          updateRemoteParticipant(p);
        }
      });

      setInCall(true);
      enumerateDevices();
      toast.success(isHost ? "Joined the meeting successfully!" : "Joined the meeting (muted by default)");
    } catch (error: any) {
      console.error("[MEET DAILY] Join failed:", error);

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
          console.log("[MEET DAILY] Error during cleanup:", e);
        }
        callObjectRef.current = null;
      }
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
    } finally {
      setIsJoining(false);
    }
  }, [config, isJoining, inCall, leaveCall, updateLocalTracks, updateRemoteParticipant, removeRemoteParticipant, enumerateDevices]);

  // --- Toggle microphone ---
  const toggleMicrophone = useCallback(async () => {
    const co = callObjectRef.current;
    if (!co) return false;
    const local = co.participants()?.local;
    if (!local) return false;
    const newState = !local.audio;
    co.setLocalAudio(newState);
    setIsMicMuted(!newState);
    console.log("[MEET DAILY] Microphone toggled:", newState);
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
    console.log("[MEET DAILY] Camera toggled:", newState);
    return newState;
  }, []);

  // --- Toggle screen share ---
  const toggleScreenShare = useCallback(async () => {
    const co = callObjectRef.current;
    if (!co) {
      console.error("[MEET DAILY] No active call object for screen share");
      return;
    }

    try {
      if (isScreenSharingRef.current) {
        console.log("[MEET DAILY] Stopping screen share");
        co.stopScreenShare();
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setLocalScreenTrack(null);
        console.log("[MEET DAILY] Screen share stopped");
      } else {
        console.log("[MEET DAILY] Starting screen share");
        await co.startScreenShare();
        // Track picked up via participant-updated event
        console.log("[MEET DAILY] Screen share started");
      }
    } catch (error: any) {
      console.error("[MEET DAILY] Error toggling screen share:", error);
      if (error.name === "NotAllowedError") {
        console.log("[MEET DAILY] Screen share cancelled by user");
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
      if (shouldCleanupRef.current && callObjectRef.current) {
        console.log("[MEET DAILY] Component unmounting while in call, cleaning up");
        try {
          callObjectRef.current.leave();
          callObjectRef.current.destroy();
        } catch (e) {
          console.log("[MEET DAILY] Error during unmount cleanup:", e);
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

  // --- Toggle cloud recording (only starter can stop) ---
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
        return false;
      } else {
        setIsRecordingLoading(true);
        await co.startRecording({ type: "cloud" });
        setRecordingStartedByMe(true);
        toast.success("Cloud recording started");
        return true;
      }
    } catch (error: any) {
      toast.error(`Recording error: ${error.message || "Failed to toggle recording"}`);
      return isCloudRecording;
    } finally {
      setIsRecordingLoading(false);
    }
  }, [isCloudRecording, recordingStartedByMe, isRecordingLoading]);

  // --- Mute a remote participant (host only) ---
  const muteParticipant = useCallback((targetUserId: string) => {
    const co = callObjectRef.current;
    if (!co) return;
    co.sendAppMessage({ type: "host-mute-request", targetUserId }, "*");
    console.log("[MEET DAILY] Sent mute request for:", targetUserId);
  }, []);

  // --- Unmute a remote participant (host only) ---
  const unmuteParticipant = useCallback((targetUserId: string) => {
    const co = callObjectRef.current;
    if (!co) return;
    co.sendAppMessage({ type: "host-unmute-request", targetUserId }, "*");
    console.log("[MEET DAILY] Sent unmute request for:", targetUserId);
  }, []);

  // --- Kick a remote participant (host only) ---
  const kickParticipant = useCallback((targetUserId: string) => {
    const co = callObjectRef.current;
    if (!co) return;
    co.sendAppMessage({ type: "host-kick", targetUserId }, "*");
    console.log("[MEET DAILY] Sent kick message for:", targetUserId);
  }, []);

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
