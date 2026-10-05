'use client';

import { useState } from 'react';
import {
  Loader2,
  Mic,
  Pause,
  Play,
  Save,
  Square,
  Trash2,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { VoiceMemo } from '@/hooks/office/useVoiceMemos';
import type { MemoState } from '@/hooks/office/useMemoRecorder';

interface Props {
  memos: VoiceMemo[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  onRefresh(): void;
  onDelete(id: string): Promise<void>;

  recorderState: MemoState;
  elapsed: number;
  recorderError: string | null;
  onStart(): Promise<void>;
  onPause(): void;
  onResume(): void;
  onStop(): Promise<Blob | null>;
  onReset(): void;
  onSave(title: string): Promise<void>;
}

/**
 * Voice memo sidebar tab. Records a personal audio note during the
 * meeting (local mic only), uploads via /voice-memos, then lists
 * the memos from THIS room with playback + delete.
 *
 * Transcription / title generation happens upstream in NC's voice-
 * agent — the memo status field flips from 'processing' to 'ready'
 * once it lands, and the transcript / title appear in the row.
 */
export default function MemosPanel({
  memos,
  loading,
  error,
  uploading,
  onRefresh,
  onDelete,

  recorderState,
  elapsed,
  recorderError,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onSave,
}: Props) {
  const [title, setTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isRecording = recorderState === 'recording';
  const isPaused = recorderState === 'paused';
  const hasBlob = recorderState === 'stopped';

  const handleToggle = async () => {
    if (isRecording || isPaused) {
      await onStop();
    } else {
      await onStart();
    }
  };

  const handleSave = async () => {
    try {
      await onSave(title.trim());
      setTitle('');
      toast.success('Memo saved');
    } catch (err: any) {
      toast.error(err?.message || "Couldn't save memo");
    }
  };

  const handleDelete = async (memo: VoiceMemo) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete "${memo.title || 'Untitled memo'}"?`)
    ) {
      return;
    }
    setDeletingId(memo.id);
    try {
      await onDelete(memo.id);
      toast.success('Memo deleted');
    } catch (err: any) {
      toast.error(err?.message || "Couldn't delete memo");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Recorder — sticks to the top of the tab */}
      <div className="border-b border-white/[0.06] p-4 space-y-3">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleToggle}
            disabled={uploading}
            className={cn(
              'relative flex h-14 w-14 items-center justify-center rounded-full transition',
              isRecording || isPaused
                ? 'bg-red-500/90 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:bg-red-600'
                : 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400',
              uploading && 'opacity-60',
            )}
            aria-label={isRecording ? 'Stop memo' : 'Start memo'}
          >
            {isRecording && (
              <span className="absolute inset-0 rounded-full bg-red-400/25 animate-ping" />
            )}
            {isRecording || isPaused ? (
              <Square className="relative h-5 w-5 text-white" fill="currentColor" />
            ) : (
              <Mic className="relative h-5 w-5 text-white" />
            )}
          </button>
          <div className="text-center">
            <div className="font-mono text-lg text-white">
              {formatElapsed(elapsed)}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              {recorderState === 'idle' && 'Tap to record a memo'}
              {isRecording && 'Recording your microphone…'}
              {isPaused && 'Paused'}
              {hasBlob && 'Ready to save'}
            </div>
          </div>
          {(isRecording || isPaused) && (
            <button
              type="button"
              onClick={isRecording ? onPause : onResume}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-gray-300 hover:bg-white/[0.06]"
            >
              {isRecording ? (
                <>
                  <Pause className="h-3 w-3" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" /> Resume
                </>
              )}
            </button>
          )}
        </div>

        {recorderError && (
          <p className="text-center text-[11px] text-red-400">{recorderError}</p>
        )}

        {hasBlob && (
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-amber-400/60 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReset}
                disabled={uploading}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={uploading}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-amber-400',
                  uploading && 'opacity-60',
                )}
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save memo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            {memos.length} memo{memos.length === 1 ? '' : 's'}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded-md p-1 text-gray-500 transition hover:bg-white/[0.06] hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {error && (
          <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] p-2 text-[11px] text-red-300">
            {error}
          </div>
        )}

        {!loading && memos.length === 0 && !error && (
          <div className="flex flex-col items-center gap-1 py-8 text-center text-gray-500">
            <Mic className="h-5 w-5 text-white/20" />
            <p className="text-[11px]">No memos yet</p>
          </div>
        )}

        {memos.map((memo) => (
          <MemoRow
            key={memo.id}
            memo={memo}
            deleting={deletingId === memo.id}
            onDelete={() => handleDelete(memo)}
          />
        ))}
      </div>
    </div>
  );
}

function MemoRow({
  memo,
  deleting,
  onDelete,
}: {
  memo: VoiceMemo;
  deleting: boolean;
  onDelete(): void;
}) {
  const date = new Date(memo.created_at);
  const dateStr = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const processing = memo.status !== 'ready' && memo.status !== 'failed';
  return (
    <div className="mb-1.5 rounded-lg px-3 py-2 transition hover:bg-white/[0.03]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-white">
            {memo.title || 'Untitled memo'}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
            <span>{dateStr}</span>
            {memo.duration_seconds != null && (
              <>
                <span>•</span>
                <span>{formatElapsed(memo.duration_seconds)}</span>
              </>
            )}
            {processing && (
              <>
                <span>•</span>
                <span className="text-amber-300">Processing…</span>
              </>
            )}
            {memo.status === 'failed' && (
              <>
                <span>•</span>
                <span className="text-red-300">Failed</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete memo"
          className={cn(
            'shrink-0 rounded-md p-1.5 text-gray-500 transition',
            deleting
              ? 'opacity-50'
              : 'hover:bg-white/[0.06] hover:text-red-400',
          )}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {memo.audio_url && (
        <audio
          src={memo.audio_url}
          controls
          preload="metadata"
          className="mt-1.5 h-8 w-full"
        />
      )}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
