"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

export interface UseVoiceRecorderResult {
  state: RecorderState;
  /** Elapsed recording time in seconds (excludes paused time). */
  elapsedSeconds: number;
  /** 0–1 RMS level for UI meters. Updates at animation-frame rate. */
  level: number;
  /** The finalized Blob after `stop()`. Null until the first recording. */
  blob: Blob | null;
  /** Mime type the browser actually used (e.g. "audio/webm;codecs=opus"). */
  mimeType: string | null;
  error: string | null;
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

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const tickLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    setLevel(Math.min(1, rms * 3));
    rafRef.current = requestAnimationFrame(tickLevel);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mime = pickMimeType();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      rafRef.current = requestAnimationFrame(tickLevel);

      const startedAt = Date.now();
      let accumulated = 0;
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(
          Math.floor((accumulated + (Date.now() - startedAt)) / 1000),
        );
      }, 250);

      recorder.start(250);
      setMimeType(recorder.mimeType || mime || null);
      setElapsedSeconds(0);
      setBlob(null);
      setState("recording");

      recorder.onpause = () => {
        accumulated += Date.now() - startedAt;
      };
    } catch (err) {
      cleanup();
      setState("idle");
      const message =
        err instanceof Error ? err.message : "Microphone access failed";
      setError(message);
      throw err;
    }
  }, [cleanup, tickLevel]);

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
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
        cleanup();
        resolve(finalBlob);
      };
      try {
        recorder.stop();
      } catch {
        cleanup();
        resolve(null);
      }
    });
  }, [cleanup, mimeType]);

  const reset = useCallback(() => {
    cleanup();
    chunksRef.current = [];
    setBlob(null);
    setMimeType(null);
    setElapsedSeconds(0);
    setLevel(0);
    setError(null);
    setState("idle");
  }, [cleanup]);

  return {
    state,
    elapsedSeconds,
    level,
    blob,
    mimeType,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}

export function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
