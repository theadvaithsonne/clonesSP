'use client';

import { useState } from 'react';
import {
  CircleDot,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ConferenceRecording } from '@/hooks/office/useConferenceRecordings';

interface Props {
  recordings: ConferenceRecording[];
  loading: boolean;
  error: string | null;
  onRefresh(): void;
  onDelete?(id: string): Promise<void>;
}

/**
 * Recordings panel for the conference sidebar. Renders the list of
 * past recordings for THIS room. Clicking a row opens an inline
 * <video> player modal streaming from the presigned URL; a download
 * button pulls the MP4 directly. No editing / deleting from here —
 * this is a read-only surface.
 */
export default function RecordingsPanel({
  recordings,
  loading,
  error,
  onRefresh,
  onDelete,
}: Props) {
  const [playing, setPlaying] = useState<ConferenceRecording | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (rec: ConferenceRecording) => {
    if (!onDelete || deletingId) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete "${rec.name}"? This can't be undone.`)
    ) {
      return;
    }
    setDeletingId(rec.id);
    try {
      await onDelete(rec.id);
      toast.success('Recording deleted');
    } catch (err: any) {
      toast.error(err?.message || "Couldn't delete recording");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <div className="mb-2 flex items-center justify-between px-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
          {recordings.length} recording{recordings.length === 1 ? '' : 's'}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-md p-1 text-gray-500 transition hover:bg-white/[0.06] hover:text-white"
          title="Refresh"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
          />
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading && recordings.length === 0 && (
        <div className="flex items-center justify-center py-10 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && recordings.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-500">
          <CircleDot className="h-6 w-6 text-white/20" />
          <p className="text-xs">No recordings yet</p>
          <p className="text-[10px] text-white/40">
            Start a recording from the control bar — it'll show up here
            when the call ends.
          </p>
        </div>
      )}

      {recordings.map((rec) => (
        <RecordingRow
          key={rec.id}
          rec={rec}
          onPlay={() => setPlaying(rec)}
          onDelete={onDelete ? () => handleDelete(rec) : undefined}
          deleting={deletingId === rec.id}
        />
      ))}

      {playing && (
        <PlayerModal
          recording={playing}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}

function RecordingRow({
  rec,
  onPlay,
  onDelete,
  deleting,
}: {
  rec: ConferenceRecording;
  onPlay(): void;
  onDelete?(): void;
  deleting?: boolean;
}) {
  const date = new Date(rec.createdAt);
  const dateStr = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const duration = rec.durationSeconds
    ? formatDuration(rec.durationSeconds)
    : null;

  return (
    <div
      onClick={onPlay}
      className="mb-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/[0.04]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
        <Play className="h-4 w-4 fill-current" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white">{rec.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
          <span>{dateStr}</span>
          <span>•</span>
          <span>{rec.sizeMB} MB</span>
          {duration && (
            <>
              <span>•</span>
              <span>{duration}</span>
            </>
          )}
        </div>
      </div>
      <a
        href={rec.downloadUrl || '#'}
        onClick={(e) => e.stopPropagation()}
        download={rec.name}
        title="Download"
        className={cn(
          'shrink-0 rounded-md p-1.5 text-gray-500 transition',
          rec.downloadUrl
            ? 'hover:bg-white/[0.06] hover:text-white'
            : 'cursor-not-allowed opacity-40',
        )}
      >
        <Download className="h-3.5 w-3.5" />
      </a>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          title="Delete recording"
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
      )}
    </div>
  );
}

function PlayerModal({
  recording,
  onClose,
}: {
  recording: ConferenceRecording;
  onClose(): void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e12]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {recording.name}
            </div>
            <div className="text-[11px] text-white/40">
              {new Date(recording.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={recording.downloadUrl || '#'}
              download={recording.name}
              className="rounded-md p-2 text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="rounded-md p-2 text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {recording.playUrl ? (
          <video
            src={recording.playUrl}
            controls
            autoPlay
            className="max-h-[75vh] w-full bg-black"
          />
        ) : (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">
            Playback URL unavailable — try downloading instead.
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
