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
import { connectSocket } from "@/lib/socket";

export interface RemoteUserTracks {
  odId: string;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  hasAudio: boolean;
  hasVideo: boolean;
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

/**
 * Dedicated LiveKit hook for Community Stream
 * Completely separate from the workspace useLiveKit hook to avoid conflicts
 */
export function useCommunityStreamLiveKit() {
  const roomRef = useRef<Room | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [inCall, setInCall] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const isScreenSharingRef = useRef(false);
  const currentRoomNameRef = useRef<string | null>(null);

  const [userInfoMap, setUserInfoMap] = useState<Map<string, { name?: string; email: string }>>(new Map());
  const [remoteUserTracks, setRemoteUserTracks] = useState<Map<string, RemoteUserTracks>>(new Map());

  // Leave call and cleanup
  const leaveCall = useCallback(async () => {
    console.log("[COMMUNITY-STREAM-LIVEKIT] leaveCall called");
    const room = roomRef.current;
    if (room) {
      try {
        room.disconnect(true);
      } catch (e) {
        console.log("[COMMUNITY-STREAM-LIVEKIT] Error disconnecting:", e);
      }
      roomRef.current = null;
    }

    // Notify server
    const socket = connectSocket();
    socket.emit("workspace:move-to-space", { spaceId: "lobby" });
    socket.emit("livekit:screen-share-state", { isSharing: false });

    setInCall(false);
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setLocalScreenTrack(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setRemoteUserTracks(new Map());
    setUserInfoMap(new Map());
    currentRoomNameRef.current = null;
  }, []);

  // Toggle microphone
  const toggleMicrophone = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room) return false;

    const local = room.localParticipant;
    const isEnabled = local.isMicrophoneEnabled;
    await local.setMicrophoneEnabled(!isEnabled);
    return !isEnabled;
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room) return false;

    const local = room.localParticipant;
    const isEnabled = local.isCameraEnabled;
    await local.setCameraEnabled(!isEnabled);
    return !isEnabled;
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const socket = connectSocket();

    if (isScreenSharingRef.current) {
      await room.localParticipant.setScreenShareEnabled(false);
      setLocalScreenTrack(null);
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      socket.emit("livekit:screen-share-state", { isSharing: false });
    } else {
      try {
        await room.localParticipant.setScreenShareEnabled(true);
        // Track will be picked up via LocalTrackPublished event
        socket.emit("livekit:screen-share-state", { isSharing: true });
      } catch (error) {
        console.error("[COMMUNITY-STREAM-LIVEKIT] Error starting screen share:", error);
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
      }
    }
  }, []);

  // Update local tracks from the room's local participant
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

  // Update remote participant
  const updateRemoteParticipant = useCallback((participant: RemoteParticipant) => {
    const userId = participant.identity;
    if (!userId) return;

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo } = extractRemoteTracks(participant);

    // Audio NOT auto-played for community stream
    // Proximity plugin controls audio playback

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

  // Remove remote participant
  const removeRemoteParticipant = useCallback((userId: string) => {
    setRemoteUserTracks((prev) => {
      const updated = new Map(prev);
      updated.delete(userId);
      return updated;
    });
  }, []);

  // Listen for LiveKit events from socket (ONLY for community-stream channels)
  useEffect(() => {
    const socket = connectSocket();
    console.log("[COMMUNITY-STREAM-LIVEKIT] Setting up socket listeners");

    const handleJoin = async (data: {
      serverUrl: string;
      token: string;
      roomName: string;
      meetingType?: string;
      participants?: Array<{ userId: string; name?: string; email: string }>;
    }) => {
      // ONLY handle community-stream rooms
      if (!data.roomName?.startsWith("community-stream:")) {
        console.log("[COMMUNITY-STREAM-LIVEKIT] Ignoring non-community-stream room:", data.roomName);
        return;
      }

      console.log("[COMMUNITY-STREAM-LIVEKIT] Joining room:", data.roomName);

      try {
        // Store participants info
        if (data.participants && data.participants.length > 0) {
          setUserInfoMap((prev) => {
            const merged = new Map(prev);
            data.participants!.forEach((p) => {
              merged.set(p.userId, { name: p.name, email: p.email });
            });
            return merged;
          });
        }

        // Clean up existing room
        if (roomRef.current) {
          try {
            roomRef.current.disconnect(true);
          } catch (e) {}
          roomRef.current = null;
        }

        // Create LiveKit Room
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;
        currentRoomNameRef.current = data.roomName;

        // Set up event handlers BEFORE connecting

        // Remote participant connected
        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          console.log(`[COMMUNITY-STREAM-LIVEKIT] ParticipantConnected: ${participant.identity}`);
          updateRemoteParticipant(participant);
        });

        // Remote track subscribed
        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            console.log(`[COMMUNITY-STREAM-LIVEKIT] TrackSubscribed: ${participant.identity} source=${publication.source}`);
            updateRemoteParticipant(participant);
          }
        );

        // Remote track unsubscribed
        room.on(
          RoomEvent.TrackUnsubscribed,
          (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            console.log(`[COMMUNITY-STREAM-LIVEKIT] TrackUnsubscribed: ${participant.identity} source=${publication.source}`);
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

        // Local track published (after enabling mic/camera)
        room.on(
          RoomEvent.LocalTrackPublished,
          (publication: LocalTrackPublication, participant: LocalParticipant) => {
            console.log(`[COMMUNITY-STREAM-LIVEKIT] LocalTrackPublished: source=${publication.source}`);
            updateLocalTracks(room);
          }
        );

        room.on(
          RoomEvent.LocalTrackUnpublished,
          (publication: LocalTrackPublication, participant: LocalParticipant) => {
            console.log(`[COMMUNITY-STREAM-LIVEKIT] LocalTrackUnpublished: source=${publication.source}`);
            updateLocalTracks(room);
          }
        );

        // Participant disconnected
        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          const userId = participant.identity;
          console.log(`[COMMUNITY-STREAM-LIVEKIT] ParticipantDisconnected: ${userId}`);
          if (userId) removeRemoteParticipant(userId);
        });

        // Room disconnected
        room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          console.log("[COMMUNITY-STREAM-LIVEKIT] Room disconnected, reason:", reason);
        });

        // Connect to the room
        await room.connect(data.serverUrl, data.token);
        console.log("[COMMUNITY-STREAM-LIVEKIT] Connected to room successfully");

        // Enable microphone and camera
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);

        // Extract local tracks after enabling
        updateLocalTracks(room);

        setInCall(true);
        console.log("[COMMUNITY-STREAM-LIVEKIT] Published local tracks");
      } catch (error: any) {
        console.error("[COMMUNITY-STREAM-LIVEKIT] Failed to join call:", error);
        if (roomRef.current) {
          try {
            roomRef.current.disconnect(true);
          } catch (e) {}
          roomRef.current = null;
        }
        setInCall(false);
      }
    };

    const handleLeave = () => {
      // Only handle if we're in a community stream call
      if (!currentRoomNameRef.current?.startsWith("community-stream:")) {
        return;
      }
      console.log("[COMMUNITY-STREAM-LIVEKIT] Received leave-call event");
      leaveCall();
    };

    const handleParticipantsUpdate = (data: {
      roomName?: string;
      channel?: string;
      participants: Array<{ userId: string; name?: string; email: string }>;
    }) => {
      // Only handle community-stream
      const name = data.roomName || data.channel;
      if (!name?.startsWith("community-stream:")) {
        return;
      }

      console.log("[COMMUNITY-STREAM-LIVEKIT] Participants update:", data);

      setUserInfoMap((prev) => {
        const merged = new Map(prev);
        data.participants.forEach((p) => {
          merged.set(p.userId, { name: p.name, email: p.email });
        });
        return merged;
      });
    };

    socket.on("livekit:init-call", handleJoin);
    socket.on("livekit:join-call", handleJoin);
    socket.on("livekit:leave-call", handleLeave);
    socket.on("livekit:participants-update", handleParticipantsUpdate);

    return () => {
      socket.off("livekit:init-call", handleJoin);
      socket.off("livekit:join-call", handleJoin);
      socket.off("livekit:leave-call", handleLeave);
      socket.off("livekit:participants-update", handleParticipantsUpdate);
    };
  }, [leaveCall, updateLocalTracks, updateRemoteParticipant, removeRemoteParticipant]);

  return {
    localVideoTrack,
    localAudioTrack,
    localScreenTrack,
    inCall,
    isScreenSharing,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    userInfoMap,
    remoteUserTracks,
  };
}
