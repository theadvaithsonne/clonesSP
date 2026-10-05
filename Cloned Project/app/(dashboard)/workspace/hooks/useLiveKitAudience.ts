"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  Participant,
  DisconnectReason,
} from "livekit-client";

export interface RemoteTrack {
  odId: string;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  isScreenShare: boolean;
}

export interface UseLiveKitAudienceResult {
  join: (serverUrl: string, token: string) => Promise<void>;
  leave: () => Promise<void>;
  isJoined: boolean;
  isJoining: boolean;
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  remoteTracks: Map<string, RemoteTrack>;
  userInfoMap: Map<string, string>;
  screenShareTrack: MediaStreamTrack | null;
  cameraTrack: MediaStreamTrack | null;
  audioTracks: MediaStreamTrack[];
  error: Error | null;
}

export function useLiveKitAudience(): UseLiveKitAudienceResult {
  const roomRef = useRef<Room | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Muted by default for preview
  const [remoteTracks, setRemoteTracks] = useState<Map<string, RemoteTrack>>(new Map());
  const [userInfoMap, setUserInfoMap] = useState<Map<string, string>>(new Map());
  const [screenShareTrack, setScreenShareTrack] = useState<MediaStreamTrack | null>(null);
  const [cameraTrack, setCameraTrack] = useState<MediaStreamTrack | null>(null);
  const [audioTracks, setAudioTracks] = useState<MediaStreamTrack[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const isMutedRef = useRef(true);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Update derived tracks when remoteTracks change
  useEffect(() => {
    let bestScreenShare: MediaStreamTrack | null = null;
    let bestCamera: MediaStreamTrack | null = null;
    const allAudioTracks: MediaStreamTrack[] = [];

    console.log("[LiveKitAudience] Processing remote tracks:", remoteTracks.size);

    remoteTracks.forEach((track, odId) => {
      console.log("[LiveKitAudience] Track:", odId, "isScreenShare:", track.isScreenShare, "hasVideo:", !!track.videoTrack, "hasAudio:", !!track.audioTrack);

      if (track.isScreenShare && track.videoTrack) {
        bestScreenShare = track.videoTrack;
      } else if (!track.isScreenShare && track.videoTrack) {
        if (!bestCamera) {
          bestCamera = track.videoTrack;
        }
      }
      if (track.audioTrack) {
        allAudioTracks.push(track.audioTrack);
      }
    });

    console.log("[LiveKitAudience] Derived tracks - screenShare:", !!bestScreenShare, "camera:", !!bestCamera, "audioTracks:", allAudioTracks.length);

    setScreenShareTrack(bestScreenShare);
    setCameraTrack(bestCamera);
    setAudioTracks(allAudioTracks);
  }, [remoteTracks]);

  // Handle audio muting
  useEffect(() => {
    audioElementsRef.current.forEach((audioEl) => {
      audioEl.muted = isMuted;
    });
  }, [isMuted]);

  // Helper to process a remote participant's tracks
  const processParticipant = useCallback((participant: RemoteParticipant) => {
    const userId = participant.identity;
    if (!userId) return;

    // Store participant name from LiveKit participant
    if (participant.name) {
      setUserInfoMap((prev) => {
        if (prev.get(userId) === participant.name) return prev;
        const updated = new Map(prev);
        updated.set(userId, participant.name!);
        return updated;
      });
    }

    // Extract tracks from publications
    const cameraPub = participant.getTrackPublication(Track.Source.Camera);
    const micPub = participant.getTrackPublication(Track.Source.Microphone);
    const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);

    const videoTrack = cameraPub?.track?.mediaStreamTrack ?? null;
    const hasVideo = !!videoTrack;

    const audioTrack = micPub?.track?.mediaStreamTrack ?? null;
    const hasAudio = !!audioTrack;

    const screenVideoTrack = screenPub?.track?.mediaStreamTrack ?? null;
    const hasScreenVideo = !!screenVideoTrack;

    // Handle screen share as a separate entry
    if (screenVideoTrack && hasScreenVideo) {
      setRemoteTracks((prev) => {
        const updated = new Map(prev);
        updated.set(`${userId}-screen`, {
          odId: userId,
          videoTrack: screenVideoTrack,
          audioTrack: null,
          isScreenShare: true,
        });
        return updated;
      });
    } else {
      setRemoteTracks((prev) => {
        const updated = new Map(prev);
        if (updated.has(`${userId}-screen`)) {
          updated.delete(`${userId}-screen`);
        }
        return updated;
      });
    }

    // Handle camera/audio
    setRemoteTracks((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(userId) || {
        odId: userId,
        videoTrack: null,
        audioTrack: null,
        isScreenShare: false,
      };

      existing.videoTrack = hasVideo ? videoTrack : null;
      existing.audioTrack = hasAudio ? audioTrack : null;

      if (existing.videoTrack || existing.audioTrack) {
        updated.set(userId, existing);
      } else if (!updated.has(`${userId}-screen`)) {
        updated.delete(userId);
      }

      return updated;
    });

    // Play audio via HTMLAudioElement
    if (audioTrack && hasAudio) {
      if (!audioElementsRef.current.has(userId)) {
        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.muted = isMutedRef.current;
        audioElementsRef.current.set(userId, audioEl);
      }
      const audioEl = audioElementsRef.current.get(userId)!;
      audioEl.srcObject = new MediaStream([audioTrack]);
      audioEl.play().catch((e) => console.warn("[LiveKitAudience] Audio play failed:", e));
    }
  }, []);

  const join = useCallback(async (serverUrl: string, token: string) => {
    if (isJoined || isJoining) {
      console.log("[LiveKitAudience] Already joined or joining");
      return;
    }

    if (!serverUrl) {
      console.error("[LiveKitAudience] Missing serverUrl");
      setError(new Error("Missing server URL"));
      return;
    }
    if (!token) {
      console.error("[LiveKitAudience] Missing token");
      setError(new Error("Missing LiveKit token"));
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      console.log("[LiveKitAudience] Creating LiveKit Room (subscriber-only)...");
      // Create room - audience joins in subscriber-only mode
      // The backend generates tokens with canPublish: false,
      // so the room will not allow publishing even if we tried.
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Set up event listeners BEFORE connecting

      // Remote participant connected
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log("[LiveKitAudience] ParticipantConnected:", participant.identity);
        processParticipant(participant);
      });

      // Remote track subscribed
      room.on(
        RoomEvent.TrackSubscribed,
        (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          console.log("[LiveKitAudience] TrackSubscribed:", participant.identity, "source:", publication.source);
          processParticipant(participant);
        }
      );

      // Remote track unsubscribed
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          console.log("[LiveKitAudience] TrackUnsubscribed:", participant.identity, "source:", publication.source);
          processParticipant(participant);
        }
      );

      // Remote track muted/unmuted
      room.on(RoomEvent.TrackMuted, (publication, participant: Participant) => {
        if (participant instanceof RemoteParticipant) {
          processParticipant(participant);
        }
      });

      room.on(RoomEvent.TrackUnmuted, (publication, participant: Participant) => {
        if (participant instanceof RemoteParticipant) {
          processParticipant(participant);
        }
      });

      // Participant disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        const userId = participant.identity;
        console.log("[LiveKitAudience] ParticipantDisconnected:", userId);
        if (userId) {
          setRemoteTracks((prev) => {
            const updated = new Map(prev);
            updated.delete(userId);
            updated.delete(`${userId}-screen`);
            return updated;
          });
          // Clean up audio element
          const audioEl = audioElementsRef.current.get(userId);
          if (audioEl) {
            audioEl.srcObject = null;
            audioElementsRef.current.delete(userId);
          }
        }
      });

      // Room disconnected
      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.log("[LiveKitAudience] Room disconnected, reason:", reason);
      });

      // Connect as audience (subscriber-only, no local media published)
      console.log("[LiveKitAudience] Connecting to room:", serverUrl);
      await room.connect(serverUrl, token);
      console.log("[LiveKitAudience] Successfully connected to room:", room.name);

      // Process existing remote participants
      room.remoteParticipants.forEach((participant) => {
        processParticipant(participant);
      });

      setIsJoined(true);
      console.log("[LiveKitAudience] Join complete!");
    } catch (err) {
      console.error("[LiveKitAudience] Failed to join:", err);
      setError(err as Error);

      if (roomRef.current) {
        try {
          roomRef.current.disconnect(true);
        } catch (e) {
          console.error("[LiveKitAudience] Error disconnecting during cleanup:", e);
        }
        roomRef.current = null;
      }
    } finally {
      setIsJoining(false);
    }
  }, [isJoined, isJoining, processParticipant]);

  const leave = useCallback(async () => {
    if (!roomRef.current) return;

    console.log("[LiveKitAudience] Leaving room...");

    try {
      // Clean up audio elements
      audioElementsRef.current.forEach((audioEl) => {
        audioEl.srcObject = null;
      });
      audioElementsRef.current.clear();

      roomRef.current.disconnect(true);
      console.log("[LiveKitAudience] Left room");
    } catch (err) {
      console.error("[LiveKitAudience] Error leaving:", err);
    } finally {
      roomRef.current = null;
      setIsJoined(false);
      setRemoteTracks(new Map());
      setUserInfoMap(new Map());
      setScreenShareTrack(null);
      setCameraTrack(null);
      setAudioTracks([]);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        console.log("[LiveKitAudience] Cleanup: leaving room on unmount");
        try {
          roomRef.current.disconnect(true);
        } catch (e) {}
        roomRef.current = null;
      }
      // Clean up audio elements
      audioElementsRef.current.forEach((audioEl) => {
        audioEl.srcObject = null;
      });
      audioElementsRef.current.clear();
    };
  }, []);

  return {
    join,
    leave,
    isJoined,
    isJoining,
    isMuted,
    setMuted: setIsMuted,
    remoteTracks,
    userInfoMap,
    screenShareTrack,
    cameraTrack,
    audioTracks,
    error,
  };
}
