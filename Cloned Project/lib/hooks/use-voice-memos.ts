"use client";

// Lightweight React Query stand-in for voice memos. The Garage app
// doesn't ship @tanstack/react-query, so we hand-roll a list hook that
// (a) fetches on mount, (b) polls every 4s while any memo is still
// mid-pipeline (matches NC's cadence), and (c) exposes mutate-style
// helpers that optimistically refetch.
//
// Status semantics mirror NC: terminal = `ready` | `failed`.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  voiceMemosApi,
  type VoiceMemo,
  type MemoStatus,
  type SpeakerTimelineEntry,
  isMemoTerminal,
} from "@/lib/api/voice-memos";

const ACTIVE_POLL_MS = 4000;

interface UseVoiceMemosResult {
  memos: VoiceMemo[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upload: (input: {
    audio: Blob;
    title?: string;
    recordedAt?: string;
    meetingContext?: VoiceMemo["meeting_context"];
    speakerTimeline?: SpeakerTimelineEntry[];
  }) => Promise<{ memo_id: string }>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reprocess: (id: string) => Promise<void>;
}

export function useVoiceMemos(opts: {
  page?: number;
  pageSize?: number;
  status?: MemoStatus;
  enabled?: boolean;
} = {}): UseVoiceMemosResult {
  const { page = 1, pageSize = 20, status, enabled = true } = opts;
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live ref so the polling loop always sees the freshest list without
  // re-creating the interval on every render.
  const memosRef = useRef<VoiceMemo[]>([]);
  memosRef.current = memos;

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await voiceMemosApi.list({
        page,
        page_size: pageSize,
        status,
      });
      setMemos(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memos");
    } finally {
      setLoading(false);
    }
  }, [enabled, page, pageSize, status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Poll while at least one memo is still being processed.
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const anyActive = memosRef.current.some((m) => !isMemoTerminal(m.status));
      if (anyActive) refetch();
    };
    const id = window.setInterval(tick, ACTIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refetch]);

  const upload = useCallback<UseVoiceMemosResult["upload"]>(
    async (input) => {
      const result = await voiceMemosApi.upload(input);
      // Refetch so the new (pending) memo appears immediately.
      refetch();
      return { memo_id: result.memo_id };
    },
    [refetch],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      await voiceMemosApi.update(id, { title });
      refetch();
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      await voiceMemosApi.delete(id);
      // Optimistic local prune so the list updates instantly even if the
      // server is slow to respond on the follow-up GET.
      setMemos((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      refetch();
    },
    [refetch],
  );

  const reprocess = useCallback(
    async (id: string) => {
      await voiceMemosApi.reprocess(id);
      refetch();
    },
    [refetch],
  );

  return { memos, total, loading, error, refetch, upload, rename, remove, reprocess };
}
