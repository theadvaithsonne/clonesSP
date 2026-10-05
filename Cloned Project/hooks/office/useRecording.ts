'use client';
import { useState, useRef, useCallback } from 'react';
import { getToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.networkchains.com';

export function useRecording(roomName: string | undefined) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const egressIdRef = useRef<string | null>(null);

  const start = useCallback(async () => {
    if (!roomName) {
      setError('Room name not available');
      return;
    }
    setError('');
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/livekit/recording/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomName }),
      });
      const data = await res.json();
      if (res.status === 409) {
        egressIdRef.current = data.egressId;
        setRecording(true);
        return;
      }
      if (!res.ok) throw new Error(data.message || 'Failed to start recording');
      egressIdRef.current = data.egressId;
      setRecording(true);
    } catch (e: any) {
      const msg = e?.message?.includes('room does not exist')
        ? 'Cannot record — join the room first with audio/video'
        : e?.message || 'Failed to start recording';
      setError(msg);
      setRecording(false);
    }
  }, [roomName]);

  const stop = useCallback(async () => {
    if (!recording || !egressIdRef.current) return;
    try {
      const token = getToken();
      await fetch(`${API_URL}/livekit/recording/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ egressId: egressIdRef.current }),
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to stop recording');
    } finally {
      setRecording(false);
      egressIdRef.current = null;
    }
  }, [recording]);

  return { recording, start, stop, error };
}
