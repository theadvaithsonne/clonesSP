"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import DailyIframe, {
  DailyCall,
  DailyParticipant,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
} from "@daily-co/daily-js";
import { connectSocket } from "@/lib/socket";

export interface RemoteUserTracks {
  odId: string;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  hasAudio: boolean;
  hasVideo: boolean;
}

// Helper to extract tracks from a DailyParticipant
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

/**
 * Dedicated Daily.co hook for Community Stream
 * Completely separate from the workspace useDaily hook to avoid conflicts
 */
export function useCommunityStreamDaily() {
  const callObjectRef = useRef<DailyCall | null>(null);
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
    console.log("[COMMUNITY-STREAM-DAILY] leaveCall called");
    const co = callObjectRef.current;
    if (co) {
      try {
        await co.leave();
        co.destroy();
      } catch (e) {
        console.log("[COMMUNITY-STREAM-DAILY] Error leaving call:", e);
      }
      callObjectRef.current = null;
    }

    // Notify server
    const socket = connectSocket();
    socket.emit("workspace:move-to-space", { spaceId: "lobby" });
    socket.emit("daily:screen-share-state", { isSharing: false });

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
    const co = callObjectRef.current;
    if (!co) return false;
    const local = co.participants()?.local;
    if (!local) return false;
    const newState = !local.audio;
    co.setLocalAudio(newState);
    return newState;
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(async (): Promise<boolean> => {
    const co = callObjectRef.current;
    if (!co) return false;
    const local = co.participants()?.local;
    if (!local) return false;
    const newState = !local.video;
    co.setLocalVideo(newState);
    return newState;
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    const co = callObjectRef.current;
    if (!co) return;

    const socket = connectSocket();

    if (isScreenSharingRef.current) {
      co.stopScreenShare();
      setLocalScreenTrack(null);
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      socket.emit("daily:screen-share-state", { isSharing: false });
    } else {
      try {
        await co.startScreenShare();
        // Track picked up via participant-updated
        socket.emit("daily:screen-share-state", { isSharing: true });
      } catch (error) {
        console.error("[COMMUNITY-STREAM-DAILY] Error starting screen share:", error);
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
      }
    }
  }, []);

  // Update local tracks from local participant
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

  // Update remote participant
  const updateRemoteParticipant = useCallback((participant: DailyParticipant) => {
    const userId = participant.user_id;
    if (!userId || participant.local) return;

    const { cameraTrack, screenTrack, audioTrack, hasAudio, hasVideo } = extractTracks(participant);

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

  // Listen for Daily events from socket (ONLY for community-stream channels)
  useEffect(() => {
    const socket = connectSocket();
    console.log("[COMMUNITY-STREAM-DAILY] Setting up socket listeners");

    const handleJoin = async (data: {
      roomUrl: string;
      token: string;
      roomName: string;
      meetingType?: string;
      participants?: Array<{ userId: string; name?: string; email: string }>;
    }) => {
      // ONLY handle community-stream rooms
      if (!data.roomName?.startsWith("community-stream:")) {
        console.log("[COMMUNITY-STREAM-DAILY] Ignoring non-community-stream room:", data.roomName);
        return;
      }

      console.log("[COMMUNITY-STREAM-DAILY] Joining room:", data.roomName);

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

        // Clean up existing call object
        if (callObjectRef.current) {
          try {
            await callObjectRef.current.leave();
            callObjectRef.current.destroy();
          } catch (e) {}
          callObjectRef.current = null;
        }

        // Create Daily call object
        const callObject = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: true,
        });
        callObjectRef.current = callObject;
        currentRoomNameRef.current = data.roomName;

        // Set up event handlers
        callObject.on("participant-joined", (event?: DailyEventObjectParticipant) => {
          if (!event || event.participant.local) return;
          updateRemoteParticipant(event.participant);
        });

        callObject.on("participant-updated", (event?: DailyEventObjectParticipant) => {
          if (!event) return;
          if (event.participant.local) {
            updateLocalTracks(callObject);
          } else {
            updateRemoteParticipant(event.participant);
          }
        });

        callObject.on("participant-left", (event?: DailyEventObjectParticipantLeft) => {
          if (!event) return;
          const userId = event.participant.user_id || event.participant.session_id;
          if (userId) removeRemoteParticipant(userId);
        });

        // Join
        await callObject.join({ url: data.roomUrl, token: data.token });
        console.log("[COMMUNITY-STREAM-DAILY] Joined room successfully");

        // Extract local tracks
        updateLocalTracks(callObject);

        setInCall(true);
        console.log("[COMMUNITY-STREAM-DAILY] Published local tracks");
      } catch (error: any) {
        console.error("[COMMUNITY-STREAM-DAILY] Failed to join call:", error);
        callObjectRef.current = null;
        setInCall(false);
      }
    };

    const handleLeave = () => {
      // Only handle if we're in a community stream call
      if (!currentRoomNameRef.current?.startsWith("community-stream:")) {
        return;
      }
      console.log("[COMMUNITY-STREAM-DAILY] Received leave-call event");
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

      console.log("[COMMUNITY-STREAM-DAILY] Participants update:", data);

      setUserInfoMap((prev) => {
        const merged = new Map(prev);
        data.participants.forEach((p) => {
          merged.set(p.userId, { name: p.name, email: p.email });
        });
        return merged;
      });
    };

    socket.on("daily:init-call", handleJoin);
    socket.on("daily:join-call", handleJoin);
    socket.on("daily:leave-call", handleLeave);
    socket.on("daily:participants-update", handleParticipantsUpdate);

    return () => {
      socket.off("daily:init-call", handleJoin);
      socket.off("daily:join-call", handleJoin);
      socket.off("daily:leave-call", handleLeave);
      socket.off("daily:participants-update", handleParticipantsUpdate);
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
