"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type {
  LocalAudioTrack,
  Participant,
  RemoteAudioTrack,
} from "livekit-client";

export type MeetMemoState = "idle" | "recording" | "paused" | "stopped";

export interface MemoParticipant {
  identity: string;
  name?: string;
}

export interface SpeakerTimelineEntry {
  /** Offset in ms from recording start. */
  tMs: number;
  /** Active-speaker identities at this moment. */
  speakers: string[];
}

export interface UseMeetMemoRecorderResult {
  state: MeetMemoState;
  elapsedSeconds: number;
  /** Most recent active-speaker identities, for the UI indicator. */
  activeSpeakerIdentities: string[];
  /** Cumulative set of identities that have spoken during this take. */
  heardSpeakers: string[];
  blob: Blob | null;
  mimeType: string | null;
  error: string | null;
  /** Snapshot of meeting metadata captured when recording started. */
  meetingContext: {
    roomId: string;
    roomName?: string;
    participants: MemoParticipant[];
  } | null;
  timeline: SpeakerTimelineEntry[];
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<Blob | null>;
  reset: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

interface AttachedSource {
  identity: string;
  sourceNode: MediaStreamAudioSourceNode;
  /** Reference so we can disconnect when the track ends. */
  stream: MediaStream;
}

/**
 * In-meet memo recorder.
 *
 * Mixes every participant's mic track (local + remote) into a single
 * stream via Web Audio, runs MediaRecorder on it, and in parallel
 * subscribes to `RoomEvent.ActiveSpeakersChanged` to build a speaker
 * timeline. Upload handlers receive both the Blob and the timeline so
 * the backend can produce speaker-attributed transcripts.
 *
 * NOTE: this runs entirely on the recording user's browser. Other
 * participants are NOT notified — the product decision is that consent
 * is handled outside this flow (T&Cs, org policy). If that changes,
 * broadcast a data-channel event from `start()` / `stop()` and render
 * an indicator on other clients.
 */
export function useMeetMemoRecorder(
  room: Room | null,
): UseMeetMemoRecorderResult {
  const [state, setState] = useState<MeetMemoState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeSpeakerIdentities, setActiveSpeakerIdentities] = useState<string[]>([]);
  const [heardSpeakers, setHeardSpeakers] = useState<string[]>([]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meetingContext, setMeetingContext] =
    useState<UseMeetMemoRecorderResult["meetingContext"]>(null);
  const [timeline, setTimeline] = useState<SpeakerTimelineEntry[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const attachedRef = useRef<Map<string, AttachedSource>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const accumulatedPauseRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const heardRef = useRef<Set<string>>(new Set());
  const timelineRef = useRef<SpeakerTimelineEntry[]>([]);
  const roomListenersRef = useRef<(() => void) | null>(null);

  const stopTracking = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (roomListenersRef.current) {
      roomListenersRef.current();
      roomListenersRef.current = null;
    }
    for (const src of attachedRef.current.values()) {
      try {
        src.sourceNode.disconnect();
      } catch {
        /* noop */
      }
    }
    attachedRef.current.clear();
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    destinationRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const attachParticipantAudio = useCallback(
    (participant: Participant) => {
      const audioCtx = audioContextRef.current;
      const dest = destinationRef.current;
      if (!audioCtx || !dest) return;

      for (const pub of participant.getTrackPublications()) {
        if (pub.source !== Track.Source.Microphone) continue;
        const track = pub.track as LocalAudioTrack | RemoteAudioTrack | undefined;
        const mediaStreamTrack = track?.mediaStreamTrack;
        if (!mediaStreamTrack) continue;
        if (attachedRef.current.has(participant.identity)) continue;

        const stream = new MediaStream([mediaStreamTrack]);
        const src = audioCtx.createMediaStreamSource(stream);
        src.connect(dest);
        attachedRef.current.set(participant.identity, {
          identity: participant.identity,
          sourceNode: src,
          stream,
        });
      }
    },
    [],
  );

  const detachParticipantAudio = useCallback((identity: string) => {
    const entry = attachedRef.current.get(identity);
    if (!entry) return;
    try {
      entry.sourceNode.disconnect();
    } catch {
      /* noop */
    }
    attachedRef.current.delete(identity);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!room) {
      setError("No active meeting");
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();
      audioContextRef.current = audioCtx;
      destinationRef.current = dest;

      // Attach the local participant + all remote participants known
      // right now. New participants joining later are handled by the
      // room event listeners below.
      attachParticipantAudio(room.localParticipant);
      room.remoteParticipants.forEach((p) => attachParticipantAudio(p));

      const mime = pickMimeType();
      const recorder = mime
        ? new MediaRecorder(dest.stream, { mimeType: mime })
        : new MediaRecorder(dest.stream);
      mediaRecorderRef.current = recorder;

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Snapshot the participant list at start. Late-joiners still get
      // attached (above) but the participant map we send to the backend
      // is fixed at start — late joiners will show up as raw identities
      // in the attributed transcript if they speak during this take.
      const participants: MemoParticipant[] = [
        {
          identity: room.localParticipant.identity,
          name: room.localParticipant.name,
        },
        ...Array.from(room.remoteParticipants.values()).map((p) => ({
          identity: p.identity,
          name: p.name,
        })),
      ];
      setMeetingContext({
        roomId: room.name,
        roomName: room.name,
        participants,
      });
      timelineRef.current = [];
      heardRef.current = new Set();
      setTimeline([]);
      setHeardSpeakers([]);
      setActiveSpeakerIdentities([]);
      setBlob(null);

      // Wire up the LiveKit event listeners. We want:
      //  - TrackSubscribed / LocalTrackPublished: attach new audio sources
      //    as participants unmute or join
      //  - TrackUnsubscribed / LocalTrackUnpublished: detach sources
      //  - ActiveSpeakersChanged: append a timeline entry
      const onActiveSpeakers = (speakers: Participant[]) => {
        const now = Date.now() - startedAtRef.current - accumulatedPauseRef.current;
        const ids = speakers.map((s) => s.identity);
        timelineRef.current.push({ tMs: Math.max(0, now), speakers: ids });
        setTimeline([...timelineRef.current]);
        setActiveSpeakerIdentities(ids);
        let changed = false;
        for (const id of ids) {
          if (!heardRef.current.has(id)) {
            heardRef.current.add(id);
            changed = true;
          }
        }
        if (changed) setHeardSpeakers(Array.from(heardRef.current));
      };

      const onParticipantConnected = (p: Participant) => attachParticipantAudio(p);
      const onParticipantDisconnected = (p: Participant) =>
        detachParticipantAudio(p.identity);
      const onTrackSubscribed = (
        _t: unknown,
        _pub: unknown,
        p: Participant,
      ) => attachParticipantAudio(p);
      const onTrackPublished = (_pub: unknown, p: Participant) =>
        attachParticipantAudio(p);

      room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
      room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackPublished, onTrackPublished);

      roomListenersRef.current = () => {
        room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
        room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
        room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
        room.off(RoomEvent.TrackPublished, onTrackPublished);
      };

      startedAtRef.current = Date.now();
      accumulatedPauseRef.current = 0;
      setElapsedSeconds(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(
          Math.floor(
            (Date.now() - startedAtRef.current - accumulatedPauseRef.current) /
              1000,
          ),
        );
      }, 250);

      recorder.start(250);
      setMimeType(recorder.mimeType || mime || null);
      setState("recording");
    } catch (err) {
      stopTracking();
      setState("idle");
      const message =
        err instanceof Error ? err.message : "Failed to start memo recording";
      setError(message);
      throw err;
    }
  }, [attachParticipantAudio, detachParticipantAudio, room, stopTracking]);

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    pausedAtRef.current = Date.now();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    if (pausedAtRef.current) {
      accumulatedPauseRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
    }
    recorder.resume();
    setState("recording");
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const finalBlob = new Blob(chunksRef.current, { type });
        setBlob(finalBlob);
        setState("stopped");
        stopTracking();
        resolve(finalBlob);
      };
      try {
        recorder.stop();
      } catch {
        stopTracking();
        resolve(null);
      }
    });
  }, [mimeType, stopTracking]);

  const reset = useCallback(() => {
    stopTracking();
    chunksRef.current = [];
    timelineRef.current = [];
    heardRef.current = new Set();
    setBlob(null);
    setMimeType(null);
    setElapsedSeconds(0);
    setActiveSpeakerIdentities([]);
    setHeardSpeakers([]);
    setTimeline([]);
    setMeetingContext(null);
    setError(null);
    setState("idle");
  }, [stopTracking]);

  return {
    state,
    elapsedSeconds,
    activeSpeakerIdentities,
    heardSpeakers,
    blob,
    mimeType,
    error,
    meetingContext,
    timeline,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
