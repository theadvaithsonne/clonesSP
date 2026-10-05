'use client';
import { useMemo } from 'react';
import type { Participant } from 'livekit-client';

/** Computes responsive CSS grid columns based on participant count. */
export function useVideoGrid(participants: Participant[]) {
  const count = participants.length;

  const gridStyle = useMemo<React.CSSProperties>(() => {
    const rows = Math.ceil(count / 2);
    const base = { gridAutoRows: '1fr' };
    if (count <= 1) return { ...base, gridTemplateColumns: '1fr' };
    if (count <= 4) return { ...base, gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: `repeat(${rows}, 1fr)` };
    return { ...base, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' };
  }, [count]);

  return { gridStyle, count };
}
