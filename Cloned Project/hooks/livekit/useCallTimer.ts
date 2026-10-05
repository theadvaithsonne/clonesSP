'use client';
import { useState, useEffect, useRef } from 'react';

/** Tracks elapsed call duration. Returns formatted string "mm:ss" or "hh:mm:ss". */
export function useCallTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
      setSeconds(0);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatted = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return { seconds, formatted };
}
