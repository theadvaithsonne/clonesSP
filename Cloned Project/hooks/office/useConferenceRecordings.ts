'use client';

import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { connectSocket } from '@/lib/socket';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.networkchains.com';

export interface ConferenceRecording {
  id: string;
  name: string;
  size: number;
  sizeMB: string;
  createdAt: string;
  durationSeconds: number | null;
  spaceId: string | null;
  downloadUrl: string;
  streamUrl: string;
  playUrl: string;
}

/**
 * Loads the recording history for one conference room. Refetches when
 * the room's recording stops (livekit:recording-stopped socket event)
 * so the newly-uploaded file appears without a manual refresh.
 */
export function useConferenceRecordings({
  roomId,
  enabled = true,
}: {
  roomId: string;
  enabled?: boolean;
}) {
  const [recordings, setRecordings] = useState<ConferenceRecording[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/livekit/conference/recordings?roomId=${encodeURIComponent(roomId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to load recordings');
      }
      const data = await res.json();
      setRecordings(data?.recordings ?? []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  }, [roomId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A recording just landed → re-list. The backend emits this event
  // from the egress webhook after the OrganizationFile row is
  // committed, so by the time we refetch the new row is queryable.
  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket();
    const onReady = () => {
      // Best-effort — the event fires per-egress and the payload
      // shape varies, so we just refetch unconditionally.
      refresh();
    };
    socket.on('livekit:recording-stopped', onReady);
    socket.on('livekit:recording-ready', onReady);
    return () => {
      socket.off('livekit:recording-stopped', onReady);
      socket.off('livekit:recording-ready', onReady);
    };
  }, [refresh, enabled]);

  const remove = useCallback(
    async (id: string) => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      // Optimistic — drop the row from the list before the round-trip
      // so the UI feels responsive. On error we refetch to restore
      // whatever the server actually still has.
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      const res = await fetch(
        `${API_URL}/livekit/conference/recordings/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Roll back by refetching the canonical list.
        refresh();
        throw new Error(data?.error || 'Failed to delete recording');
      }
    },
    [refresh],
  );

  return { recordings, loading, error, refresh, remove };
}
