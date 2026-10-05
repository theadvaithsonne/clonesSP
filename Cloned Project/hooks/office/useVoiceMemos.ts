'use client';

import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.networkchains.com';

// Trimmed VoiceMemo shape — mirrors NC's /voice-memos response but
// only the fields the sidebar tab actually renders. See NC's
// lib/types/voice-agent.ts for the full shape.
export interface VoiceMemo {
  id: string;
  title: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  status: 'pending' | 'transcribing' | 'processing' | 'ready' | 'failed';
  created_at: string;
  meeting_context?: {
    roomId?: string;
    roomName?: string;
  } | null;
}

interface Options {
  roomId: string;
}

/**
 * Voice-memo list + upload for one meeting room. Backed by
 * /voice-memos which Garage's backend proxies to NC's voice-agent
 * service (transcription, title, summary all happen upstream).
 *
 * List is filtered client-side by meeting_context.roomId so each
 * conference room only shows its own memos.
 */
export function useVoiceMemos({ roomId }: Options) {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/voice-memos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to load memos');
      }
      const data = await res.json();
      const list: VoiceMemo[] = Array.isArray(data)
        ? data
        : data?.memos ?? [];
      // Scope to this room only. Legacy memos without a
      // meeting_context are hidden — they belong to freestanding
      // recordings, not to any meeting.
      setMemos(list.filter((m) => m.meeting_context?.roomId === roomId));
    } catch (err: any) {
      setError(err?.message || 'Failed to load memos');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (opts: {
      blob: Blob;
      title?: string;
      roomName?: string;
      participants?: Array<{ identity: string; name?: string }>;
    }) => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      setUploading(true);
      try {
        const fd = new FormData();
        const filename = `memo_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        fd.append('audio', opts.blob, filename);
        if (opts.title) fd.append('title', opts.title);
        fd.append('recorded_at', new Date().toISOString());
        fd.append(
          'meeting_context',
          JSON.stringify({
            roomId,
            roomName: opts.roomName,
            participants: opts.participants ?? [],
          }),
        );
        const res = await fetch(`${API_URL}/voice-memos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to save memo');
        }
        // Upstream returns a shell record; the transcription result
        // arrives later. Refetch to pick it up.
        await refresh();
      } finally {
        setUploading(false);
      }
    },
    [roomId, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      setMemos((prev) => prev.filter((m) => m.id !== id));
      const res = await fetch(`${API_URL}/voice-memos/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        refresh();
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete memo');
      }
    },
    [refresh],
  );

  return { memos, loading, error, uploading, refresh, upload, remove };
}
