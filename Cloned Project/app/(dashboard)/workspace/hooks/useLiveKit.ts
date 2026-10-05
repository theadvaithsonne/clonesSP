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
  ConnectionState,
} from "livekit-client";
import { connectSocket } from "@/lib/socket";
import { toast } from "sonner";

// Remote user tracks - same interface as useDaily for seamless swap
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
export interface LiveKitChatMessage {
  id: string;
  sender: string; // "local" or participant identity
  senderName: string;
  msg: string;
  time: string;
}

// Re-export for backward compatibility (WorkspaceClient may import DailyChatMessage)
export type DailyChatMessage = LiveKitChatMessage;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
    hasScreenVideo,
  };
}

export function useLiveKit() {
  const roomRef = useRef<Room | null>(null);
  // Reactive mirror of roomRef so consumers (e.g. the conference memo recorder)
  // can read the live Room and re-render when it connects/disconnects.
  const [room, setRoom] = useState<Room | null>(null);
  const isLeavingRef = useRef(false);
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
  const activeEgressIdRef = useRef<string | null>(null);
  const currentRoomNameRef = useRef<string>("");
  // Room-wide recording flag (synced to all participants via DataChannel) +
  // elapsed timer — drives the "being recorded" banner for everyone, not just
  // the person who started. These are NEW fields; existing consumers (workspace
  // knock/floor calls) ignore them, so their behaviour is unchanged.
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const recordingStartTsRef = useRef<number | null>(null);
  const recordingNotifiedRef = useRef(false);
  // Whether the local user owns this room (conference booking creator). Server
  // sets it on the join/init-call payload; false for non-conference calls.
  const [isOwner, setIsOwner] = useState(false);

  // Note-taker bot presence. The bot joins with metadata { isBot:true }; we
  // hide it from the participant grid/audio and surface a "Listening" tile.
  // Additive — non-conference calls have no bot, so noteTakerActive stays false.
  const [noteTakerActive, setNoteTakerActive] = useState(false);
  const botIdentitiesRef = useRef<Set<string>>(new Set());

  // Chat state
  const [chatMessages, setChatMessages] = useState<LiveKitChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatIdCounter = useRef(0);

  // Audio element refs for cleanup
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    console.log("[LIVEKIT] inCall state changed:", inCall);
  }, [inCall]);

  // Tick the REC timer while recording is active (driven by recordingActive,
  // which is synced across the room via the recording-state broadcast).
  useEffect(() => {
    if (!recordingActive) {
      recordingStartTsRef.current = null;
      setRecordingElapsed(0);
      return;
    }
    if (recordingStartTsRef.current == null) recordingStartTsRef.current = Date.now();
    const tick = () => {
      if (recordingStartTsRef.current != null) {
        setRecordingElapsed(Math.max(0, Math.floor((Date.now() - recordingStartTsRef.current) / 1000)));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [recordingActive]);

  // --- Update local tracks from the room's local participant ---
  const updateLocalTracks = useCallback((room: Room) => {
    const local = room.localParticipant;
    if (!local) return;

    const cameraPub = local.getTrackPublication(Track.Source.Camera);
    const micPub = local.getTrackPublication(Track.Source.Microphone);
    const screenPub = local.getTrackPublication(Track.Source.ScreenShare);

    setLocalVideoTrack(cameraPub?.track?.mediaStreamTrack ?? null);
    setLocalAudioTrack(micPub?.track?.mediaStreamTrack ?? null);

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

  // --- Update a remote participant in the tracks map ---
  const updateRemoteParticipant = useCallback((participant: RemoteParticipant) => {
    const userId = participant.identity;
    if (!userId) return;

    // Skip audience/receive-only participants (workshop preview viewers)
    if (userId.startsWith("audience-")) return;

    // Detect the note-taker bot (metadata { isBot:true } or the well-known
    // identity). Hide it from the grid/audio and flag noteTakerActive so the
    // conference can render a synthetic "Listening" tile instead.
    let isBot = userId === "notetaker-bot";
    if (!isBot && participant.metadata) {
      try {
        isBot = !!JSON.parse(participant.metadata)?.isBot;
      } catch {
        /* non-JSON metadata — ignore */
      }
    }
    if (isBot) {
      botIdentitiesRef.current.add(userId);
      setNoteTakerActive(true);
      return;
    }

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo, hasScreenVideo } = extractRemoteTracks(participant);

    // Play audio track directly via HTMLAudioElement
    if (audioTrack && hasAudio) {
      try {
        // Reuse or create audio element for this participant
        let audioEl = audioElementsRef.current.get(userId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioElementsRef.current.set(userId, audioEl);
        }
        audioEl.srcObject = new MediaStream([audioTrack]);
        audioEl.play().catch((e) => console.warn("[LIVEKIT] Audio autoplay failed:", e));
      } catch (e) {
        console.warn("[LIVEKIT] Error playing remote audio:", e);
      }
    }

    // Store participant name in userInfoMap
    if (participant.name) {
      setUserInfoMap((prev) => {
        const existing = prev.get(userId);
        if (existing?.name === participant.name) return prev;
        const updated = new Map(prev);
        updated.set(userId, {
          name: participant.name,
          email: existing?.email || "",
        });
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
      return updated;
    });
  }, []);

  // --- Remove a remote participant from the tracks map ---
  const removeRemoteParticipant = useCallback((userId: string) => {
    // If the note-taker bot left, drop the "Listening" indicator.
    if (botIdentitiesRef.current.has(userId)) {
      botIdentitiesRef.current.delete(userId);
      setNoteTakerActive(botIdentitiesRef.current.size > 0);
      return;
    }
    setRemoteUserTracks((prev) => {
      const updated = new Map(prev);
      updated.delete(userId);
      return updated;
    });

    // Clean up audio element
    const audioEl = audioElementsRef.current.get(userId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      audioElementsRef.current.delete(userId);
    }
  }, []);

  // --- Leave call and clean up ---
  const leaveCall = useCallback(async () => {
    if (isLeavingRef.current) {
      console.log("[LIVEKIT] leaveCall already in progress, skipping");
      return;
    }
    isLeavingRef.current = true;
    console.log("[LIVEKIT] leaveCall called");

    const room = roomRef.current;
    if (room) {
      roomRef.current = null;
      setRoom(null);
      try {
        room.disconnect(true);
        console.log("[LIVEKIT] Disconnected from room");
      } catch (e) {
        console.log("[LIVEKIT] Error disconnecting:", e);
      }
    }

    // Clean up all audio elements
    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElementsRef.current.clear();

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
    activeEgressIdRef.current = null;
    currentRoomNameRef.current = "";
    setRecordingActive(false);
    setRecordingElapsed(0);
    recordingStartTsRef.current = null;
    recordingNotifiedRef.current = false;
    setIsOwner(false);
    setNoteTakerActive(false);
    botIdentitiesRef.current.clear();
    setChatMessages([]);
    setUnreadChatCount(0);

    // Move user back to lobby
    const socket = connectSocket();
    socket.emit("workspace:move-to-space", { spaceId: "lobby" });
    socket.emit("livekit:screen-share-state", { isSharing: false });
    console.log("[LIVEKIT] Moved user back to lobby and cleared screen share state");

    isLeavingRef.current = false;
  }, []);

  // --- Main socket event listener effect ---
  useEffect(() => {
    const socket = connectSocket();
    console.log("[LIVEKIT] Setting up event listeners on socket:", socket.id);

    const handleJoinCall = async (data: {
      serverUrl: string;
      token: string;
      roomName?: string;
      meetingType?: string;
      partnerId?: string;
      hostId?: string;
      isOwner?: boolean;
      participants?: Array<{ userId: string; name?: string; email: string }>;
    }) => {
      try {
        // Community-stream rooms have their own dedicated hook
        // (`useCommunityStreamLiveKit`) that runs the avatar-world / proximity-audio
        // experience. The workspace's main LiveKit hook must NOT touch those
        // rooms — otherwise both hooks race to connect, the workspace's main
        // call UI takes over, and the avatar overlay never gets to render.
        // Symmetric with the filter the community-stream hook applies.
        if (data.roomName?.startsWith("community-stream:")) {
          console.log(
            "[LIVEKIT] Ignoring community-stream room; handled by useCommunityStreamLiveKit:",
            data.roomName
          );
          return;
        }

        console.log("[LIVEKIT] handleJoinCall called with data:", {
          serverUrl: data.serverUrl,
          roomName: data.roomName,
          meetingType: data.meetingType,
          hasParticipants: !!data.participants,
          participantsCount: data.participants?.length,
        });

        if (!data.serverUrl || !data.token) {
          console.error("[LIVEKIT] No serverUrl or token provided in join-call event.", data);
          toast.error("Failed to join call: meeting room is not ready. Please try again.");
          return;
        }

        // Detect 1-on-1 knock call
        const is1on1KnockCall = !data.meetingType && !!(data.partnerId || data.hostId);
        setIs1on1Call(is1on1KnockCall);

        // Store room name for recording API
        if (data.roomName) {
          currentRoomNameRef.current = data.roomName;
        }

        // Room ownership (conference booking creator) — gates the record/notes controls.
        setIsOwner(!!data.isOwner);

        // Store participant info
        if (data.participants && data.participants.length > 0) {
          setUserInfoMap((prev) => {
            const merged = new Map(prev);
            data.participants!.forEach((p) => {
              merged.set(p.userId, { name: p.name, email: p.email });
            });
            return merged;
          });
          console.log("[LIVEKIT] Stored user info for participants:", data.participants.length);
        }

        // Reset leaving guard
        isLeavingRef.current = false;

        // Clean up any existing room
        if (roomRef.current) {
          console.log("[LIVEKIT] Existing room found, cleaning up...");
          try {
            roomRef.current.disconnect(true);
          } catch (e) {
            console.log("[LIVEKIT] Error cleaning up existing room:", e);
          }
          roomRef.current = null;
        }

        // Create LiveKit Room
        console.log("[LIVEKIT] Creating LiveKit Room...");
        const room = new Room({
          // pixelDensity 'screen' scales each remote video to the tile's on-
          // screen size × device DPR — stops decoding a full-res stream into a
          // tiny/retina tile (big CPU + bandwidth win in crowded rooms).
          adaptiveStream: { pixelDensity: "screen" },
          dynacast: true,
        });
        roomRef.current = room;
        setRoom(room);

        // --- Set up Room event handlers BEFORE connecting ---

        // Remote participant connected
        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          console.log(`[LIVEKIT] ParticipantConnected: ${participant.identity}`);
          updateRemoteParticipant(participant);
        });

        // Remote track subscribed (new track available)
        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            console.log(`[LIVEKIT] TrackSubscribed: ${participant.identity} source=${publication.source}`);
            updateRemoteParticipant(participant);
          }
        );

        // Remote track unsubscribed
        room.on(
          RoomEvent.TrackUnsubscribed,
          (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            console.log(`[LIVEKIT] TrackUnsubscribed: ${participant.identity} source=${publication.source}`);
            updateRemoteParticipant(participant);
          }
        );

        // Remote track muted/unmuted
        room.on(
          RoomEvent.TrackMuted,
          (publication, participant: Participant) => {
            if (participant instanceof RemoteParticipant) {
              updateRemoteParticipant(participant);
            }
          }
        );

        room.on(
          RoomEvent.TrackUnmuted,
          (publication, participant: Participant) => {
            if (participant instanceof RemoteParticipant) {
              updateRemoteParticipant(participant);
            }
          }
        );

        // Local track published (after we enable mic/camera)
        room.on(
          RoomEvent.LocalTrackPublished,
          (publication: LocalTrackPublication, participant: LocalParticipant) => {
            console.log(`[LIVEKIT] LocalTrackPublished: source=${publication.source}`);
            updateLocalTracks(room);
          }
        );

        room.on(
          RoomEvent.LocalTrackUnpublished,
          (publication: LocalTrackPublication, participant: LocalParticipant) => {
            console.log(`[LIVEKIT] LocalTrackUnpublished: source=${publication.source}`);
            updateLocalTracks(room);
          }
        );

        // Participant disconnected
        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          const userId = participant.identity;
          console.log(`[LIVEKIT] ParticipantDisconnected: ${userId}`);
          removeRemoteParticipant(userId);

          // For 1-on-1 calls, auto-leave when the other person leaves
          if (is1on1KnockCall) {
            const remainingRemote = Array.from(room.remoteParticipants.values());
            if (remainingRemote.length === 0) {
              console.log("[LIVEKIT] 1-on-1 call ended, other user left - auto-leaving");
              leaveCall();
            }
          }
        });

        // Chat: listen for incoming data messages
        room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
          try {
            const decoded = JSON.parse(new TextDecoder().decode(payload));

            // Recording-state broadcast (host → everyone): drives the
            // "being recorded" banner + REC timer for all participants.
            if (decoded?.type === "recording-state") {
              const active = !!decoded.active;
              setRecordingActive(active);
              if (active) {
                recordingStartTsRef.current = decoded.startedAt || Date.now();
                if (!recordingNotifiedRef.current) {
                  recordingNotifiedRef.current = true;
                  toast.info("This conference is being recorded");
                }
              } else {
                recordingStartTsRef.current = null;
                recordingNotifiedRef.current = false;
              }
              return;
            }

            if (!decoded?.msg) return;

            const time = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            chatIdCounter.current += 1;
            const senderName = participant?.name || participant?.identity || "Unknown";
            setChatMessages((prev) => [
              ...prev,
              {
                id: `msg-${chatIdCounter.current}`,
                sender: participant?.identity || "unknown",
                senderName,
                msg: decoded.msg,
                time,
              },
            ]);
            setUnreadChatCount((prev) => prev + 1);
          } catch (e) {
            // Not a chat message, ignore
          }
        });

        // Room disconnected
        room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          console.log("[LIVEKIT] Room disconnected, reason:", reason);
          if (!isLeavingRef.current) {
            // Unexpected disconnect
            toast.error("Call disconnected unexpectedly");
            leaveCall();
          }
        });

        // Connect to the room
        console.log("[LIVEKIT] Connecting to room:", data.serverUrl, "token length:", data.token?.length);
        console.log("[LIVEKIT] Room state before connect:", room.state);
        await room.connect(data.serverUrl, data.token);
        console.log("[LIVEKIT] Successfully connected to room:", room.name, "state:", room.state);

        // Enable microphone (and camera for non-knock calls)
        await room.localParticipant.setMicrophoneEnabled(true);
        if (!is1on1KnockCall) {
          await room.localParticipant.setCameraEnabled(true);
        }

        // Extract local tracks after enabling
        updateLocalTracks(room);

        // Process any remote participants already in the room
        room.remoteParticipants.forEach((participant) => {
          if (!participant.identity.startsWith("audience-")) {
            updateRemoteParticipant(participant);
          }
        });

        setInCall(true);
      } catch (error: any) {
        console.error("[LIVEKIT] Join failed:", error);

        if (error.name === "NotAllowedError" || error.message?.includes("permission")) {
          toast.error("Camera/microphone permission denied. Please allow access and try again.");
        } else if (error.name === "NotFoundError") {
          toast.error("Camera or microphone not found. Please check your devices.");
        } else {
          toast.error(`Failed to join call: ${error.message || "Unknown error"}`);
        }

        // Clean up on error
        if (roomRef.current) {
          try {
            roomRef.current.disconnect(true);
          } catch (e) {
            console.log("[LIVEKIT] Error during cleanup:", e);
          }
          roomRef.current = null;
          setRoom(null);
        }
      }
    };

    const handleInitCall = (data: any) => {
      console.log("[LIVEKIT] Received livekit:init-call on socket:", socket.id);
      handleJoinCall(data);
    };

    const handleJoinCallEvent = (data: any) => {
      console.log("[LIVEKIT] Received livekit:join-call with data:", data);
      handleJoinCall(data);
    };

    const handleLeaveCall = (data?: { roomName?: string }) => {
      // Community-stream leaves are handled by useCommunityStreamLiveKit.
      // If this event is for a community-stream room (or we're holding one
      // because of a transient state), skip: otherwise the workspace hook
      // would emit `workspace:move-to-space → lobby` and yank the user out
      // of the community-stream space the dedicated hook is still rendering.
      const targetRoom = data?.roomName || currentRoomNameRef.current || "";
      if (targetRoom.startsWith("community-stream:")) {
        console.log(
          "[LIVEKIT] Ignoring community-stream leave; handled by useCommunityStreamLiveKit:",
          targetRoom
        );
        return;
      }
      console.log("[LIVEKIT] Received livekit:leave-call event");
      leaveCall();
    };

    const handleParticipantsUpdate = (data: {
      channel?: string;
      roomName?: string;
      participants: Array<{ userId: string; name?: string; email: string }>;
    }) => {
      // Same separation as handleJoinCall — community-stream participant
      // lists belong to the community-stream hook's userInfoMap, not the
      // workspace's. Merging them here pollutes the workspace's UI with
      // names from a parallel room.
      if (data.roomName?.startsWith("community-stream:")) {
        return;
      }

      console.log("[LIVEKIT] Received livekit:participants-update:", data);

      if (data.participants && data.participants.length > 0) {
        setUserInfoMap((prev) => {
          const merged = new Map(prev);
          data.participants.forEach((p) => {
            merged.set(p.userId, { name: p.name, email: p.email });
          });
          return merged;
        });
      }
    };

    const handleCallAnsweredElsewhere = (data: {
      roomName?: string;
      channel?: string;
      answeredOn: string;
      message: string;
    }) => {
      console.log("[LIVEKIT] Call answered elsewhere:", data);

      if (roomRef.current) {
        console.log("[LIVEKIT] Already in a call, ignoring answered-elsewhere");
        return;
      }

      toast.info(data.message || "Call answered on another device", {
        duration: 4000,
      });
    };

    const handleJoinError = (data: { error: string; spaceId?: string }) => {
      console.error("[LIVEKIT] Join error from server:", data);
      toast.error(data.error || "Failed to join meeting room.");
      socket.emit("workspace:move-to-space", { spaceId: "lobby" });
    };

    socket.on("livekit:init-call", handleInitCall);
    socket.on("livekit:join-call", handleJoinCallEvent);
    socket.on("livekit:leave-call", handleLeaveCall);
    socket.on("livekit:participants-update", handleParticipantsUpdate);
    socket.on("livekit:call-answered-elsewhere", handleCallAnsweredElsewhere);
    socket.on("livekit:join-error", handleJoinError);

    return () => {
      console.log("[LIVEKIT] Cleaning up useEffect, removing event listeners");
      socket.off("livekit:init-call", handleInitCall);
      socket.off("livekit:join-call", handleJoinCallEvent);
      socket.off("livekit:leave-call", handleLeaveCall);
      socket.off("livekit:participants-update", handleParticipantsUpdate);
      socket.off("livekit:call-answered-elsewhere", handleCallAnsweredElsewhere);
      socket.off("livekit:join-error", handleJoinError);

      if (roomRef.current) {
        console.log("[LIVEKIT] Room exists, leaving on cleanup");
        leaveCall();
      }
    };
  }, [leaveCall, updateLocalTracks, updateRemoteParticipant, removeRemoteParticipant]);

  // --- Emit leave on page unload ---
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomRef.current) {
        console.log("[LIVEKIT] beforeunload: emitting leave events");
        const socket = connectSocket();
        socket.emit("livekit:leave-call", {});
        socket.emit("workspace:move-to-space", { spaceId: "lobby" });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // --- Toggle microphone ---
  const toggleMicrophone = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room) return false;

    const local = room.localParticipant;
    const isEnabled = local.isMicrophoneEnabled;
    await local.setMicrophoneEnabled(!isEnabled);
    console.log("[LIVEKIT] Microphone toggled:", !isEnabled);

    // Update local tracks after toggle
    updateLocalTracks(room);
    return !isEnabled;
  }, [updateLocalTracks]);

  // --- Toggle camera ---
  const toggleCamera = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room) return false;

    const local = room.localParticipant;
    const isEnabled = local.isCameraEnabled;
    await local.setCameraEnabled(!isEnabled);
    console.log("[LIVEKIT] Camera toggled:", !isEnabled);

    updateLocalTracks(room);
    return !isEnabled;
  }, [updateLocalTracks]);

  // --- Toggle screen share ---
  const toggleScreenShare = useCallback(async (): Promise<void> => {
    const room = roomRef.current;
    if (!room) {
      console.error("[LIVEKIT] No active room for screen share");
      return;
    }

    const socket = connectSocket();

    try {
      if (isScreenSharingRef.current) {
        console.log("[LIVEKIT] Stopping screen share");
        await room.localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setLocalScreenTrack(null);
        socket.emit("livekit:screen-share-state", { isSharing: false });
      } else {
        console.log("[LIVEKIT] Starting screen share");
        await room.localParticipant.setScreenShareEnabled(true);
        // Track will be picked up via LocalTrackPublished event
        socket.emit("livekit:screen-share-state", { isSharing: true });
      }
    } catch (error: any) {
      console.error("[LIVEKIT] Error toggling screen share:", error);

      if (error.name === "NotAllowedError" || error.code === "PERMISSION_DENIED") {
        console.log("[LIVEKIT] Screen share cancelled by user");
      } else {
        toast.error(`Screen share error: ${error.message}`);
      }

      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      setLocalScreenTrack(null);
      socket.emit("livekit:screen-share-state", { isSharing: false });
    }
  }, []);

  // --- Toggle cloud recording (via backend Egress API) ---
  const toggleCloudRecording = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room || isRecordingLoading) return isCloudRecording;

    const roomName = currentRoomNameRef.current || room.name;
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
        // Broadcast stop so everyone's banner/timer clears.
        setRecordingActive(false);
        recordingStartTsRef.current = null;
        recordingNotifiedRef.current = false;
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ type: "recording-state", active: false })),
          { reliable: true }
        );
        toast.info("Recording stopped");
        console.log("[LIVEKIT] Stopped cloud recording");
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
          // Broadcast start so all participants show the banner/timer.
          const startedAt = Date.now();
          recordingStartTsRef.current = startedAt;
          recordingNotifiedRef.current = true; // starter already knows
          setRecordingActive(true);
          room.localParticipant.publishData(
            new TextEncoder().encode(
              JSON.stringify({ type: "recording-state", active: true, startedAt })
            ),
            { reliable: true }
          );
          toast.success("Cloud recording started");
          console.log("[LIVEKIT] Started cloud recording, egressId:", data.egressId);
          return true;
        } else {
          toast.error(data.error || "Failed to start recording");
          return false;
        }
      }
    } catch (error: any) {
      console.error("[LIVEKIT] Error toggling cloud recording:", error);
      toast.error(`Recording error: ${error.message || "Failed to toggle recording"}`);
      return isCloudRecording;
    } finally {
      setIsRecordingLoading(false);
    }
  }, [isCloudRecording, recordingStartedByMe, isRecordingLoading]);

  // --- Send chat message via DataChannel ---
  const sendChatMessage = useCallback((msg: string) => {
    const room = roomRef.current;
    if (!room || !msg.trim()) return;

    const payload = new TextEncoder().encode(JSON.stringify({ msg: msg.trim() }));
    room.localParticipant.publishData(payload, { reliable: true });

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
    console.log("[LIVEKIT] Chat message sent:", msg.trim());
  }, []);

  // --- Clear unread chat count ---
  const clearUnreadChat = useCallback(() => {
    setUnreadChatCount(0);
  }, []);

  return {
    inCall,
    room,
    localVideoTrack,
    localScreenTrack,
    remoteUserTracks,
    isScreenSharing,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    userInfoMap,
    localScreenShareUid: null as null, // Compat stub
    is1on1Call,
    // Cloud recording
    isCloudRecording,
    recordingStartedByMe,
    isRecordingLoading,
    toggleCloudRecording,
    recordingActive,
    recordingElapsed,
    isOwner,
    noteTakerActive,
    // Chat
    chatMessages,
    unreadChatCount,
    sendChatMessage,
    clearUnreadChat,
  };
}
