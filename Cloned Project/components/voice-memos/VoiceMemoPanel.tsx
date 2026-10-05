"use client";

// Voice memos panel — opened from the webinar ControlBar. Lets the
// presenter (or any participant) capture a personal voice memo, ship
// it to NetworkChain's voice-agent for transcription + summary, and
// browse their full memo history (across all webinars / meetings).
//
// Audio source: the local user's mic only — NOT the mixed webinar
// audio. Mixing all participants requires server-side egress, which
// is out of scope for this lightweight memo flow.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square, Pause, Play, Trash2, RefreshCw, X, Pencil, Loader2 } from "lucide-react";
import {
  formatElapsed,
  useVoiceRecorder,
} from "@/hooks/use-voice-recorder";
import { useVoiceMemos } from "@/lib/hooks/use-voice-memos";
import type { VoiceMemo } from "@/lib/api/voice-memos";
import VoiceMemoStatusBadge from "./VoiceMemoStatusBadge";

interface Props {
  webinarId: string;
  webinarTitle?: string;
  /** Stamped into NC's `meetingContext.participants` so transcripts
   *  can attribute speech if we ever expand to mixed-audio capture. */
  participants?: { identity: string; name?: string }[];
  onClose: () => void;
}

export default function VoiceMemoPanel({
  webinarId,
  webinarTitle,
  participants,
  onClose,
}: Props) {
  const recorder = useVoiceRecorder();
  const memos = useVoiceMemos({ pageSize: 20 });
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Reset stop-state buffer if the panel is reopened later.
  useEffect(() => () => recorder.reset(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStop() {
    const blob = await recorder.stop();
    if (!blob) {
      toast.error("Recording was empty");
      recorder.reset();
      return;
    }
    setUploading(true);
    try {
      await memos.upload({
        audio: blob,
        title: title.trim() || undefined,
        recordedAt: new Date().toISOString(),
        meetingContext: {
          roomId: webinarId,
          roomName: webinarTitle,
          participants: participants ?? [],
        },
      });
      toast.success("Memo uploaded — transcript on its way");
      setTitle("");
      recorder.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRename(memo: VoiceMemo) {
    const next = editValue.trim();
    if (!next || next === memo.title) {
      setEditingId(null);
      return;
    }
    try {
      await memos.rename(memo.id, next);
      toast.success("Renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setEditingId(null);
    }
  }

  async function handleDelete(memo: VoiceMemo) {
    if (!confirm("Delete this voice memo and its transcript?")) return;
    try {
      await memos.remove(memo.id);
      toast.success("Memo deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="w-[22rem] max-w-[90vw] rounded-xl border border-white/[0.08] bg-[#0e0e12] p-4 shadow-2xl text-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Voice memos</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Recorder */}
      <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Memo title (optional)"
          disabled={recorder.state === "recording" || recorder.state === "paused"}
          className="w-full bg-transparent text-sm placeholder-gray-500 border-b border-white/[0.06] py-1.5 mb-3 outline-none focus:border-blue-500/40"
        />

        <div className="flex items-center gap-3">
          {recorder.state === "idle" || recorder.state === "stopped" ? (
            <button
              onClick={() => {
                recorder.reset();
                recorder.start().catch(() => {
                  toast.error("Microphone permission denied");
                });
              }}
              disabled={uploading}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 transition"
              title="Start recording"
            >
              <Mic className="h-5 w-5" />
            </button>
          ) : (
            <>
              <button
                onClick={handleStop}
                disabled={uploading}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 transition"
                title="Stop & upload"
              >
                <Square className="h-5 w-5" />
              </button>
              {recorder.state === "recording" ? (
                <button
                  onClick={recorder.pause}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600"
                  title="Pause"
                >
                  <Pause className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={recorder.resume}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600"
                  title="Resume"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          <div className="flex-1">
            <div className="text-xs text-gray-300 font-mono">
              {formatElapsed(recorder.elapsedSeconds)}
              {recorder.state === "paused" && " (paused)"}
              {uploading && " — uploading…"}
            </div>
            {/* Level meter */}
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-75"
                style={{ width: `${Math.round(recorder.level * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {recorder.error && (
          <p className="mt-2 text-[11px] text-red-400">{recorder.error}</p>
        )}
      </div>

      {/* List */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">
            Your memos {memos.total > 0 ? `(${memos.total})` : ""}
          </span>
          {memos.loading && (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
          )}
        </div>

        {memos.error ? (
          <p className="text-xs text-red-400">{memos.error}</p>
        ) : memos.memos.length === 0 && !memos.loading ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            No memos yet. Tap the mic to record one.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto pr-1 space-y-2">
            {memos.memos.map((memo) => (
              <li
                key={memo.id}
                className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editingId === memo.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleRename(memo)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(memo);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-full bg-black/40 text-sm border border-white/10 rounded px-1.5 py-0.5 outline-none focus:border-blue-500/40"
                      />
                    ) : (
                      <div className="text-sm font-medium truncate">
                        {memo.title || `Memo ${memo.id.slice(-6)}`}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <VoiceMemoStatusBadge status={memo.status} />
                      {memo.duration_seconds != null && (
                        <span className="text-[10px] text-gray-500">
                          {formatElapsed(Math.round(memo.duration_seconds))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingId(memo.id);
                        setEditValue(memo.title ?? "");
                      }}
                      className="p-1 text-gray-400 hover:text-white"
                      title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {memo.status === "failed" && (
                      <button
                        onClick={() => memos.reprocess(memo.id)}
                        className="p-1 text-gray-400 hover:text-white"
                        title="Retry"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(memo)}
                      className="p-1 text-gray-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {memo.summary && (
                  <p className="mt-2 text-xs text-gray-400 line-clamp-3">
                    {memo.summary}
                  </p>
                )}
                {memo.status === "failed" && memo.error_message && (
                  <p className="mt-1 text-[11px] text-red-400 truncate">
                    {memo.error_message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
