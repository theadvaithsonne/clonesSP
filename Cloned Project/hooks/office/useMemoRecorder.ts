'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type MemoState = 'idle' | 'recording' | 'paused' | 'stopped';

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const t of candidates) {
    // MediaRecorder.isTypeSupported was added in all evergreen
    // browsers years ago; still, guard for the rare case that it
    // isn't there and just take the first candidate.
    if ((MediaRecorder as any).isTypeSupported?.(t)) return t;
  }
  return '';
}

/**
 * Minimal MediaRecorder wrapper for a personal voice memo captured
 * during the meeting. Records the *local* user's mic only — NC's
 * variant additionally mixes remote participant audio + tracks
 * active-speaker attribution, but that requires the full voice-
 * agent stack. This version keeps the scope tight: press record →
 * blob comes out → parent uploads it.
 *
 * Returns start / pause / resume / stop / reset and the current
 * elapsed seconds so the UI can render a timer without a second
 * hook.
 */
export function useMemoRecorder() {
  const [state, setState] = useState<MemoState>('idle');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTsRef = useRef<number>(0);
  const accruedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    accruedRef.current = 0;
    startTsRef.current = 0;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      const mt = pickMimeType();
      const rec = new MediaRecorder(stream, mt ? { mimeType: mt } : undefined);
      setMimeType(mt || rec.mimeType || 'audio/webm');
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = mt || rec.mimeType || 'audio/webm';
        const combined = new Blob(chunksRef.current, { type });
        setBlob(combined);
        setState('stopped');
      };
      rec.onerror = (ev: any) => {
        setError(ev?.error?.message || 'Recorder error');
        setState('stopped');
      };
      recorderRef.current = rec;
      rec.start(1000); // 1s timeslices so we always have partial data
      startTsRef.current = Date.now();
      accruedRef.current = 0;
      setState('recording');
      timerRef.current = setInterval(() => {
        const live = Date.now() - startTsRef.current;
        setElapsed(Math.floor((accruedRef.current + live) / 1000));
      }, 250);
    } catch (err: any) {
      setError(err?.message || 'Microphone access denied');
      setState('idle');
      cleanup();
    }
  }, [cleanup]);

  const pause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.pause();
    accruedRef.current += Date.now() - startTsRef.current;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume();
    startTsRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const live = Date.now() - startTsRef.current;
      setElapsed(Math.floor((accruedRef.current + live) / 1000));
    }, 250);
    setState('recording');
  }, []);

  const stop = useCallback(async () => {
    return new Promise<Blob | null>((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        resolve(blob);
        return;
      }
      // Capture the current stop handler so we can resolve exactly
      // when the blob is ready, without racing against React state.
      const priorOnStop = rec.onstop;
      rec.onstop = (ev) => {
        priorOnStop?.call(rec, ev);
        // The `onstop` we set in start() already committed the blob
        // to state; read the chunks directly here to resolve.
        const type = mimeType || rec.mimeType || 'audio/webm';
        resolve(new Blob(chunksRef.current, { type }));
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  }, [blob, mimeType]);

  const reset = useCallback(() => {
    cleanup();
    setBlob(null);
    setElapsed(0);
    setError(null);
    setState('idle');
    setMimeType(null);
  }, [cleanup]);

  return { state, elapsed, blob, mimeType, error, start, pause, resume, stop, reset };
}
