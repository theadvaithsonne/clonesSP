"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import DailyIframe, {
  DailyCall,
  DailyParticipant,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
} from "@daily-co/daily-js";

export interface RemoteTrack {
  odId: string;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  isScreenShare: boolean;
}

export interface UseDailyAudienceResult {
  join: (roomUrl: string, token: string) => Promise<void>;
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

export function useDailyAudience(): UseDailyAudienceResult {
  const callObjectRef = useRef<DailyCall | null>(null);
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

    console.log("[DailyAudience] Processing remote tracks:", remoteTracks.size);

    remoteTracks.forEach((track, odId) => {
      console.log("[DailyAudience] Track:", odId, "isScreenShare:", track.isScreenShare, "hasVideo:", !!track.videoTrack, "hasAudio:", !!track.audioTrack);

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

    console.log("[DailyAudience] Derived tracks - screenShare:", !!bestScreenShare, "camera:", !!bestCamera, "audioTracks:", allAudioTracks.length);

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

  // Helper to process a participant's tracks
  const processParticipant = useCallback((participant: DailyParticipant) => {
    if (participant.local) return;
    const userId = participant.user_id || participant.session_id;
    if (!userId) return;

    // Store user_name from Daily participant (set via meeting token)
    if (participant.user_name) {
      setUserInfoMap((prev) => {
        if (prev.get(userId) === participant.user_name) return prev;
        const updated = new Map(prev);
        updated.set(userId, participant.user_name!);
        return updated;
      });
    }

    const tracks = participant.tracks;

    // Check for screen share track
    const screenVideoTrack = tracks?.screenVideo?.persistentTrack ?? null;
    const hasScreenVideo = tracks?.screenVideo?.state === "playable";

    // Check for camera track
    const videoTrack = tracks?.video?.persistentTrack ?? null;
    const hasVideo = tracks?.video?.state === "playable";

    // Check for audio track
    const audioTrack = tracks?.audio?.persistentTrack ?? null;
    const hasAudio = tracks?.audio?.state === "playable";

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

    // Play audio
    if (audioTrack && hasAudio) {
      if (!audioElementsRef.current.has(userId)) {
        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.muted = isMutedRef.current;
        audioElementsRef.current.set(userId, audioEl);
      }
      const audioEl = audioElementsRef.current.get(userId)!;
      audioEl.srcObject = new MediaStream([audioTrack]);
      audioEl.play().catch((e) => console.warn("[DailyAudience] Audio play failed:", e));
    }
  }, []);

  const join = useCallback(async (roomUrl: string, token: string) => {
    if (isJoined || isJoining) {
      console.log("[DailyAudience] Already joined or joining");
      return;
    }

    if (!roomUrl) {
      console.error("[DailyAudience] Missing roomUrl");
      setError(new Error("Missing room URL"));
      return;
    }
    if (!token) {
      console.error("[DailyAudience] Missing token");
      setError(new Error("Missing Daily token"));
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      console.log("[DailyAudience] Creating Daily call object...");
      // Create in receive-only mode (no local audio/video)
      const callObject = DailyIframe.createCallObject({
        audioSource: false,
        videoSource: false,
      });

      callObjectRef.current = callObject;

      // Set up event listeners BEFORE joining
      callObject.on("participant-joined", (event?: DailyEventObjectParticipant) => {
        if (!event) return;
        console.log("[DailyAudience] participant-joined:", event.participant.user_id || event.participant.session_id);
        processParticipant(event.participant);
      });

      callObject.on("participant-updated", (event?: DailyEventObjectParticipant) => {
        if (!event) return;
        processParticipant(event.participant);
      });

      callObject.on("participant-left", (event?: DailyEventObjectParticipantLeft) => {
        if (!event) return;
        const userId = event.participant.user_id || event.participant.session_id;
        console.log("[DailyAudience] participant-left:", userId);
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

      // Join as audience (no local media)
      console.log("[DailyAudience] Joining room:", roomUrl);
      await callObject.join({
        url: roomUrl,
        token,
      });
      console.log("[DailyAudience] Successfully joined room");

      // Process existing remote participants
      const participants = callObject.participants();
      Object.values(participants).forEach((p) => {
        processParticipant(p);
      });

      setIsJoined(true);
      console.log("[DailyAudience] Join complete!");
    } catch (err) {
      console.error("[DailyAudience] Failed to join:", err);
      setError(err as Error);

      if (callObjectRef.current) {
        try {
          await callObjectRef.current.leave();
          callObjectRef.current.destroy();
        } catch (e) {
          console.error("[DailyAudience] Error leaving during cleanup:", e);
        }
        callObjectRef.current = null;
      }
    } finally {
      setIsJoining(false);
    }
  }, [isJoined, isJoining, processParticipant]);

  const leave = useCallback(async () => {
    if (!callObjectRef.current) return;

    console.log("[DailyAudience] Leaving room...");

    try {
      // Clean up audio elements
      audioElementsRef.current.forEach((audioEl) => {
        audioEl.srcObject = null;
      });
      audioElementsRef.current.clear();

      await callObjectRef.current.leave();
      callObjectRef.current.destroy();
      console.log("[DailyAudience] Left room");
    } catch (err) {
      console.error("[DailyAudience] Error leaving:", err);
    } finally {
      callObjectRef.current = null;
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
      if (callObjectRef.current) {
        console.log("[DailyAudience] Cleanup: leaving room on unmount");
        callObjectRef.current.leave().catch(console.error);
        try {
          callObjectRef.current.destroy();
        } catch (e) {}
        callObjectRef.current = null;
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
