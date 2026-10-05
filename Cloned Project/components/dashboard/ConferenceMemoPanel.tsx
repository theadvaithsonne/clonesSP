"use client";

import { useEffect, useState } from "react";
import type { Room } from "livekit-client";
import { CheckCircle2, Mic, Pause, Play, Square, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useMeetMemoRecorder } from "@/lib/hooks/use-meet-memo-recorder";
import { useVoiceMemos } from "@/lib/hooks/use-voice-memos";
import { formatElapsed } from "@/hooks/use-voice-recorder";

interface SessionMemo {
  localId: string;
  memoId?: string;
  title?: string;
  uploadedAt: Date;
}

interface ConferenceMemoPanelProps {
  room: Room | null;
  /** hq-room:<orgId> — used as the memo's roomId. */
  spaceId: string;
  /** Friendly room/booking title for the memo. */
  meetTitle: string;
  /** identity → display name, for the live speaker chips. */
  nameByIdentity: Map<string, string>;
  onClose: () => void;
  /** Fired when recording starts/stops so the parent can block PiP/minimize. */
  onRecordingChange?: (active: boolean) => void;
}

/**
 * In-conference voice-memo panel. Mixes every participant's mic (via
 * useMeetMemoRecorder) and uploads with a speaker timeline so the backend can
 * produce a speaker-attributed transcript. Available to any logged-in
 * participant. Recording is silent to others (consent handled by org policy).
 */
export default function ConferenceMemoPanel({
  room,
  spaceId,
  meetTitle,
  nameByIdentity,
  onClose,
  onRecordingChange,
}: ConferenceMemoPanelProps) {
  const recorder = useMeetMemoRecorder(room);
  const { upload } = useVoiceMemos({ enabled: false });

  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessionMemos, setSessionMemos] = useState<SessionMemo[]>([]);

  const isRecording = recorder.state === "recording";
  const isPaused = recorder.state === "paused";
  const hasRecording = recorder.state === "stopped" && recorder.blob !== null;

  // If the call ends mid-record, flush the recorder.
  useEffect(() => {
    if (!room && recorder.state !== "idle") recorder.reset();
  }, [room, recorder]);

  // Surface live/paused recording state to the parent (blocks PiP/minimize).
  useEffect(() => {
    onRecordingChange?.(isRecording || isPaused);
  }, [isRecording, isPaused, onRecordingChange]);

  const handleStart = async () => {
    try {
      setTitle("");
      await recorder.start();
    } catch {
      /* surfaced via recorder.error */
    }
  };

  const handleSave = async () => {
    if (!recorder.blob || !recorder.meetingContext) return;
    const localId = `${Date.now()}`;
    setSaving(true);
    try {
      const response = await upload({
        audio: recorder.blob,
        title: title.trim() || undefined,
        meetingContext: {
          ...recorder.meetingContext,
          roomId: spaceId,
          roomName: meetTitle,
        },
        speakerTimeline: recorder.timeline,
      });
      setSessionMemos((prev) => [
        { localId, memoId: response.memo_id, title: title.trim() || undefined, uploadedAt: new Date() },
        ...prev,
      ]);
      recorder.reset();
      setTitle("");
      toast.success("Memo saved — transcribing in the background");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save memo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 w-80 h-[28rem] bg-[#0e0e12]/95 backdrop-blur-md border border-[#2a2a35] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[10000]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a35]">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-brand" />
          <span className="text-sm font-medium text-white">Voice Memo</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-full w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!room ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-500 p-6">
          <Mic className="h-8 w-8 opacity-30" />
          <p className="text-xs text-center">Memos are available once you&apos;ve joined the call.</p>
        </div>
      ) : (
        <>
          {/* Recorder controls */}
          <div className="border-b border-[#2a2a35] p-4 space-y-3">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={isRecording ? () => recorder.stop() : handleStart}
                disabled={saving}
                className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
                  isRecording
                    ? "bg-red-500/90 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                    : "bg-gradient-to-br from-brand to-brand-2"
                } ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
                aria-label={isRecording ? "Stop memo" : "Start memo"}
              >
                {isRecording && recorder.activeSpeakerIdentities.length > 0 && (
                  <span className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
                )}
                {isRecording ? (
                  <Square className="relative h-6 w-6 text-white" fill="currentColor" />
                ) : (
                  <Mic className="relative h-6 w-6 text-white" />
                )}
              </button>

              <div className="text-center">
                <div className="font-mono text-xl text-white">{formatElapsed(recorder.elapsedSeconds)}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {recorder.state === "idle" && "Tap to record a memo of this call"}
                  {isRecording && "Recording — captures every participant's mic"}
                  {isPaused && "Paused"}
                  {hasRecording && "Ready to save"}
                </div>
              </div>

              {(isRecording || isPaused) && (
                <button
                  type="button"
                  onClick={() => (isRecording ? recorder.pause() : recorder.resume())}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:bg-white/[0.06]"
                >
                  {isRecording ? (
                    <><Pause className="h-3.5 w-3.5" /> Pause</>
                  ) : (
                    <><Play className="h-3.5 w-3.5" /> Resume</>
                  )}
                </button>
              )}
            </div>

            {recorder.error && <div className="text-xs text-red-400 text-center">{recorder.error}</div>}

            {/* Live-speaking indicator */}
            {(isRecording || isPaused) && recorder.heardSpeakers.length > 0 && (
              <div className="rounded-lg border border-[#2a2a35] bg-[#1a1a24] p-3 space-y-1.5">
                <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  Speakers in this memo
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recorder.heardSpeakers.map((id) => {
                    const active = recorder.activeSpeakerIdentities.includes(id);
                    return (
                      <span
                        key={id}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
                          active
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : "bg-white/[0.04] text-gray-400 border border-white/[0.06]"
                        }`}
                      >
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
                        {nameByIdentity.get(id) || id}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save flow */}
            {hasRecording && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Optional title (e.g. 'Q2 planning')"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-[#2a2a35] bg-[#1a1a24] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brand/50"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { recorder.reset(); setTitle(""); }}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#2a2a35] px-3 py-2 text-xs text-gray-400 hover:bg-white/[0.04]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-brand to-brand-2 px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {saving ? "Saving…" : "Save memo"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Session history */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500 px-1">This call</div>
            {sessionMemos.length === 0 ? (
              <p className="text-xs text-gray-600 px-1 py-3">Memos you save in this call will appear here.</p>
            ) : (
              sessionMemos.map((m) => (
                <div key={m.localId} className="rounded-lg border border-[#2a2a35] bg-[#1a1a24] p-2.5">
                  <div className="text-sm text-white truncate">{m.title || "Untitled memo"}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Saved · transcribing in the background
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
