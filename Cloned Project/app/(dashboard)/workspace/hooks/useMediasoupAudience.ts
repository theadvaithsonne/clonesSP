"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
} from "livekit-client";
import { connectWebinarSocket } from "@/lib/socket";
import { getToken } from "@/lib/auth";
import { API_URL } from "@/lib/api";

export interface RemoteTrack {
  odId: string;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  isScreenShare: boolean;
}

export interface UseMediasoupAudienceResult {
  join: (webinarId: string) => Promise<void>;
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

/**
 * Preview-audience hook.
 * Joins the Socket.IO webinar room as "pre-guest" (so the viewer appears in
 * the host's participant panel), then streams video/audio via LiveKit
 * (subscriber-only, canPublish=false) using the same room the host uses.
 */
export function useMediasoupAudience(): UseMediasoupAudienceResult {
  const lkRoomRef = useRef<Room | null>(null);
  const webinarIdRef = useRef<string>("");

  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [remoteTracks, setRemoteTracks] = useState<Map<string, RemoteTrack>>(new Map());
  const [userInfoMap, setUserInfoMap] = useState<Map<string, string>>(new Map());
  const [screenShareTrack, setScreenShareTrack] = useState<MediaStreamTrack | null>(null);
  const [cameraTrack, setCameraTrack] = useState<MediaStreamTrack | null>(null);
  const [audioTracks, setAudioTracks] = useState<MediaStreamTrack[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const isMutedRef = useRef(true);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Derive screenShareTrack, cameraTrack, audioTracks from remoteTracks
  useEffect(() => {
    let bestScreenShare: MediaStreamTrack | null = null;
    let bestCamera: MediaStreamTrack | null = null;
    const allAudioTracks: MediaStreamTrack[] = [];

    remoteTracks.forEach((track) => {
      if (track.isScreenShare && track.videoTrack) {
        bestScreenShare = track.videoTrack;
      } else if (!track.isScreenShare && track.videoTrack) {
        if (!bestCamera) bestCamera = track.videoTrack;
      }
      if (track.audioTrack) {
        allAudioTracks.push(track.audioTrack);
      }
    });

    setScreenShareTrack(bestScreenShare);
    setCameraTrack(bestCamera);
    setAudioTracks(allAudioTracks);
  }, [remoteTracks]);

  // Sync muted state to all audio elements
  useEffect(() => {
    audioElementsRef.current.forEach((el) => {
      el.muted = isMuted;
    });
  }, [isMuted]);

  // Process a LiveKit remote participant's tracks into remoteTracks state
  const processParticipant = useCallback((participant: RemoteParticipant) => {
    const identity = participant.identity;
    if (!identity) return;

    if (participant.name) {
      setUserInfoMap((prev) => {
        if (prev.get(identity) === participant.name) return prev;
        const updated = new Map(prev);
        updated.set(identity, participant.name!);
        return updated;
      });
    }

    const cameraPub = participant.getTrackPublication(Track.Source.Camera);
    const micPub = participant.getTrackPublication(Track.Source.Microphone);
    const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
    const screenAudioPub = participant.getTrackPublication(Track.Source.ScreenShareAudio);

    const videoTrack = cameraPub?.track?.mediaStreamTrack ?? null;
    const audioTrack = micPub?.track?.mediaStreamTrack ?? null;
    const screenVideoTrack = screenPub?.track?.mediaStreamTrack ?? null;
    const screenAudioTrack = screenAudioPub?.track?.mediaStreamTrack ?? null;

    // Screen share video
    if (screenVideoTrack) {
      setRemoteTracks((prev) => {
        const updated = new Map(prev);
        updated.set(`${identity}-screen`, {
          odId: identity,
          videoTrack: screenVideoTrack,
          audioTrack: null,
          isScreenShare: true,
        });
        return updated;
      });
    } else {
      setRemoteTracks((prev) => {
        const updated = new Map(prev);
        updated.delete(`${identity}-screen`);
        return updated;
      });
    }

    // Screen share audio
    if (screenAudioTrack) {
      let audioEl = audioElementsRef.current.get(`${identity}-screenAudio`);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.muted = isMutedRef.current;
        audioElementsRef.current.set(`${identity}-screenAudio`, audioEl);
      }
      audioEl.srcObject = new MediaStream([screenAudioTrack]);
      audioEl.play().catch(() => {});
    } else {
      const sEl = audioElementsRef.current.get(`${identity}-screenAudio`);
      if (sEl) {
        sEl.srcObject = null;
        audioElementsRef.current.delete(`${identity}-screenAudio`);
      }
    }

    // Camera + mic
    setRemoteTracks((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(identity) || {
        odId: identity,
        videoTrack: null,
        audioTrack: null,
        isScreenShare: false,
      };
      existing.videoTrack = videoTrack;
      existing.audioTrack = audioTrack;
      if (existing.videoTrack || existing.audioTrack) {
        updated.set(identity, { ...existing });
      } else if (!updated.has(`${identity}-screen`)) {
        updated.delete(identity);
      }
      return updated;
    });

    // Mic audio element
    if (audioTrack) {
      let audioEl = audioElementsRef.current.get(identity);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.muted = isMutedRef.current;
        audioElementsRef.current.set(identity, audioEl);
      }
      audioEl.srcObject = new MediaStream([audioTrack]);
      audioEl.play().catch(() => {});
    }
  }, []);

  const join = useCallback(async (webinarId: string) => {
    if (isJoined || isJoining) return;

    setIsJoining(true);
    setError(null);
    webinarIdRef.current = webinarId;

    try {
      // Step 1: Join Socket.IO room as "pre-guest" for participant-list presence
      const socket = connectWebinarSocket();
      const socketResponse = await new Promise<any>((resolve) => {
        socket.emit("webinar:joinRoom", { webinarId, role: "pre-guest" }, resolve);
      });
      if (!socketResponse?.success) {
        throw new Error(socketResponse?.error || "Failed to join webinar room");
      }
      if (socketResponse.peers) {
        const names = new Map<string, string>();
        (socketResponse.peers as any[]).forEach((p) => {
          if (p.name) names.set(p.socketId, p.name);
        });
        setUserInfoMap(names);
      }

      // Step 2: Get a LiveKit subscriber token for this webinar room
      const authToken = getToken();
      const tokenRes = await fetch(`${API_URL}/webinar/${webinarId}/livekit-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ role: "attendee" }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData?.success) {
        throw new Error(tokenData?.error || "Failed to get LiveKit token");
      }

      // Step 3: Connect to the LiveKit room as subscriber-only (canPublish=false)
      const room = new Room({ adaptiveStream: true, dynacast: true });
      lkRoomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (_t, _p, participant: RemoteParticipant) => {
        processParticipant(participant);
      });
      room.on(RoomEvent.TrackUnsubscribed, (_t, _p, participant: RemoteParticipant) => {
        processParticipant(participant);
      });
      room.on(RoomEvent.TrackMuted, (_p, participant: any) => {
        if (participant instanceof RemoteParticipant) processParticipant(participant);
      });
      room.on(RoomEvent.TrackUnmuted, (_p, participant: any) => {
        if (participant instanceof RemoteParticipant) processParticipant(participant);
      });
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        const id = participant.identity;
        setRemoteTracks((prev) => {
          const updated = new Map(prev);
          updated.delete(id);
          updated.delete(`${id}-screen`);
          return updated;
        });
        const audioEl = audioElementsRef.current.get(id);
        if (audioEl) { audioEl.srcObject = null; audioElementsRef.current.delete(id); }
        const sEl = audioElementsRef.current.get(`${id}-screenAudio`);
        if (sEl) { sEl.srcObject = null; audioElementsRef.current.delete(`${id}-screenAudio`); }
      });

      await room.connect(tokenData.livekitUrl, tokenData.token);

      // Process participants already in the room
      room.remoteParticipants.forEach((participant) => processParticipant(participant));

      setIsJoined(true);
      console.log("[PreviewAudience] Joined webinar via LiveKit:", webinarId);
    } catch (err) {
      console.error("[PreviewAudience] Failed to join:", err);
      setError(err as Error);
    } finally {
      setIsJoining(false);
    }
  }, [isJoined, isJoining, processParticipant]);

  const leave = useCallback(async () => {
    console.log("[PreviewAudience] Leaving...");

    if (lkRoomRef.current) {
      try { lkRoomRef.current.disconnect(true); } catch {}
      lkRoomRef.current = null;
    }

    audioElementsRef.current.forEach((el) => { el.srcObject = null; });
    audioElementsRef.current.clear();

    setIsJoined(false);
    setRemoteTracks(new Map());
    setUserInfoMap(new Map());
    setScreenShareTrack(null);
    setCameraTrack(null);
    setAudioTracks([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lkRoomRef.current) {
        try { lkRoomRef.current.disconnect(true); } catch {}
        lkRoomRef.current = null;
      }
      audioElementsRef.current.forEach((el) => { el.srcObject = null; });
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
