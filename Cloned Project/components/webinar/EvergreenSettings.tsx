"use client";

// Evergreen configuration panel for the host: upload a video, script the chat,
// and turn scheduled playback on.
//
// Additive — a webinar that never opens this keeps `evergreen.enabled === false`
// and behaves exactly as a normal live webinar. Enabling is deliberately
// guarded (video + duration + a valid recurrence), and the backend enforces the
// same rules, so a half-configured webinar can never go "live" playing nothing.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ChatLine {
  atSec: number;
  name: string;
  message: string;
}
interface Recording {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  probeUrl: string;
}
interface Evergreen {
  enabled?: boolean;
  source?: "upload" | "recording";
  videoUrl?: string;
  videoS3Key?: string;
  /** Set optimistically after an attach; the server reports videoS3Key on load. */
  hasVideo?: boolean;
  durationSec?: number;
  joinWindowMin?: number | null;
  loop?: boolean;
  simulatedChat?: ChatLine[];
}

/** "1:05:30" from seconds — hosts think in timestamps, not raw seconds. */
function clock(total?: number): string {
  if (!total) return "—";
  const s = Math.floor(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** "mm:ss" / "h:mm:ss" -> seconds. Returns null when unparseable. */
function parseClock(v: string): number | null {
  const parts = v.trim().split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export default function EvergreenSettings({ workshopId }: { workshopId: string }) {
  const [eg, setEg] = useState<Evergreen | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<{ videoUrl: string; simulatedChat: ChatLine[] } | null>(null);
  const [previewAt, setPreviewAt] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const authed = useCallback(
    (path: string, init: RequestInit = {}) =>
      fetch(`${API_URL}/evergreen/${workshopId}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken() || ""}`,
          ...(init.headers || {}),
        },
      }),
    [workshopId]
  );

  useEffect(() => {
    authed("")
      .then((r) => r.json())
      .then((d) => setEg(d?.evergreen || { enabled: false }))
      .catch(() => setEg({ enabled: false }));
    // Past recordings of this same webinar. Empty for one that has never run
    // live, which is the common case — the picker hides itself then.
    authed("/recordings")
      .then((r) => r.json())
      .then((d) => setRecordings(d?.recordings || []))
      .catch(() => setRecordings([]));
  }, [authed]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await authed("", { method: "PATCH", body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Update failed");
      setEg(data.evergreen);
      return true;
    } catch (e) {
      // Surface the backend's own reason — it's the one that knows WHY
      // enabling was refused (missing video, bad recurrence…).
      toast.error(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Read duration in the browser before uploading: the clock is meaningless
  // without it, and the server has no cheap way to probe the file.
  const readDuration = (src: File | string) =>
    new Promise<number>((resolve, reject) => {
      const objectUrl = typeof src === "string" ? null : URL.createObjectURL(src);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        Number.isFinite(v.duration) && v.duration > 0
          ? resolve(v.duration)
          : reject(new Error("Couldn't read the video length"));
      };
      v.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error("Couldn't read that video"));
      };
      v.src = objectUrl || (src as string);
    });

  const openPreview = async () => {
    setBusy(true);
    try {
      const res = await authed("/preview").then((r) => r.json());
      if (!res.success) throw new Error(res.error || "Couldn't build a preview");
      setPreviewAt(0);
      setPreview({ videoUrl: res.videoUrl, simulatedChat: res.simulatedChat || [] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build a preview");
    } finally {
      setBusy(false);
    }
  };

  const useRecording = async (rec: Recording) => {
    setBusy(true);
    try {
      const durationSec = await readDuration(rec.probeUrl);
      const res = await authed("/use-recording", {
        method: "POST",
        body: JSON.stringify({ fileId: rec.id, durationSec }),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.error || "Couldn't use that recording");
      setEg((p) => ({
        ...(p || {}),
        source: "recording",
        durationSec: Math.round(durationSec),
        hasVideo: true,
      }));
      setPicking(false);
      toast.success("Recording attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't use that recording");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setUploadPct(0);
    try {
      const durationSec = await readDuration(file);

      const signed = await authed("/upload-url", {
        method: "POST",
        body: JSON.stringify({ contentType: file.type, fileName: file.name }),
      }).then((r) => r.json());
      if (!signed.success) throw new Error(signed.error || "Couldn't start the upload");

      // XHR rather than fetch purely for upload progress — a webinar recording
      // is large enough that a silent bar would look frozen.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) =>
          e.lengthComputable && setUploadPct(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      const attached = await authed("/attach", {
        method: "POST",
        body: JSON.stringify({ key: signed.key, durationSec }),
      }).then((r) => r.json());
      if (!attached.success) throw new Error(attached.error || "Couldn't attach the video");

      setEg((p) => ({
        ...(p || {}),
        source: "upload",
        durationSec: Math.round(durationSec),
        videoS3Key: signed.key,
        hasVideo: true,
      }));
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  };

  if (!eg) {
    return (
      <div className="flex items-center gap-2 p-4 text-[13px] text-[#9fa0b8]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const hasVideo = !!(eg.videoUrl || eg.videoS3Key || eg.hasVideo);
  const chat = eg.simulatedChat || [];

  const setChat = (next: ChatLine[]) =>
    patch({ simulatedChat: [...next].sort((a, b) => a.atSec - b.atSec) });

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-[#2a2a35] bg-[#131316]/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-white">Scheduled (evergreen) playback</h3>
          <p className="mt-1 text-[12px] leading-snug text-[#9fa0b8]">
            Play a pre-recorded video on this webinar&apos;s schedule. Everyone who joins a
            session sees the same moment, like a broadcast.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!eg.enabled}
          disabled={busy || (!eg.enabled && !hasVideo)}
          onClick={() => patch({ enabled: !eg.enabled })}
          title={!hasVideo ? "Upload a video first" : undefined}
          className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
            eg.enabled ? "bg-brand" : "bg-[#2a2a35]"
          }`}
        >
          <span
            className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
              eg.enabled ? "translate-x-[18px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </div>

      {/* Video */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9fa0b8]">Video</p>
        {hasVideo ? (
          <div className="flex items-center justify-between rounded-xl border border-[#2a2a35] bg-[#131316] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] text-white">
                {eg.source === "recording" ? "Recorded session" : "Uploaded video"}
              </p>
              <p className="text-[11px] text-[#9fa0b8]">Length {clock(eg.durationSec)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={openPreview}
                className="rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-brand-foreground hover:brightness-95 disabled:opacity-50"
              >
                Preview
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="rounded-full bg-[#1a1a22] px-3 py-1.5 text-[12px] text-white hover:bg-[#22222c]"
              >
                Replace
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#2a2a35] px-3 py-6 text-[13px] text-[#9fa0b8] hover:border-brand/60 hover:text-white disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Upload a video
          </button>
        )}
        {/* Only offered when this webinar has actually been recorded live —
            otherwise there is nothing to choose and the row is noise. */}
        {!!recordings?.length && (
          <div className="mt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPicking((v) => !v)}
              className="text-[12px] font-medium text-brand hover:opacity-80 disabled:opacity-50"
            >
              {picking ? "Hide past recordings" : `Use a past recording (${recordings.length})`}
            </button>
            {picking && (
              <div className="mt-2 flex flex-col gap-1.5">
                {recordings.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    disabled={busy}
                    onClick={() => useRecording(rec)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#2a2a35] bg-[#131316] px-3 py-2 text-left hover:border-brand/60 disabled:opacity-50"
                  >
                    <span className="min-w-0 truncate text-[12px] text-white">{rec.name}</span>
                    <span className="shrink-0 text-[11px] text-[#9fa0b8]">
                      {new Date(rec.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {uploadPct !== null && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1a1a22]">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${uploadPct}%` }} />
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </div>

      {/* Loop. On unless deliberately turned off, including for webinars
          configured before the field existed — the backend reads it as
          `!== false`. */}
      <label className="flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-[13px] text-white">Repeat for the whole session</span>
          <span className="block text-[11px] text-[#9fa0b8]">
            Plays the video on repeat until the session&apos;s end time. Off means the
            session ends when the video does.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={eg.loop !== false}
          disabled={busy}
          onClick={() => patch({ loop: eg.loop === false })}
          className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
            eg.loop !== false ? "bg-brand" : "bg-[#2a2a35]"
          }`}
        >
          <span
            className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
              eg.loop !== false ? "translate-x-[18px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </label>

      {/* Join window */}
      <label className="flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-[13px] text-white">Late-join cutoff</span>
          <span className="block text-[11px] text-[#9fa0b8]">
            Minutes after start people can still join. Blank = anytime.
          </span>
        </span>
        <input
          type="number"
          min={0}
          defaultValue={eg.joinWindowMin ?? ""}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            patch({ joinWindowMin: raw === "" ? null : Number(raw) });
          }}
          className="w-20 rounded-lg border border-[#2a2a35] bg-[#131316] px-2.5 py-1.5 text-right text-[13px] text-white outline-none focus:border-brand/60"
        />
      </label>

      {/* Scripted chat */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9fa0b8]">
          Scripted chat
        </p>
        <p className="mb-2 text-[11px] text-[#9fa0b8]">
          Messages you write, shown at a fixed point in the video. Every viewer sees the
          same ones at the same moment; real attendee chat still appears alongside.
        </p>
        <div className="flex flex-col gap-2">
          {chat.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                defaultValue={clock(line.atSec)}
                onBlur={(e) => {
                  const secs = parseClock(e.target.value);
                  if (secs === null) return toast.error("Use mm:ss or h:mm:ss");
                  const next = [...chat];
                  next[i] = { ...line, atSec: secs };
                  setChat(next);
                }}
                className="w-20 rounded-lg border border-[#2a2a35] bg-[#131316] px-2 py-1.5 text-[12px] tabular-nums text-white outline-none focus:border-brand/60"
              />
              <input
                defaultValue={line.name}
                placeholder="Name"
                onBlur={(e) => {
                  const next = [...chat];
                  next[i] = { ...line, name: e.target.value };
                  setChat(next);
                }}
                className="w-28 rounded-lg border border-[#2a2a35] bg-[#131316] px-2 py-1.5 text-[12px] text-white outline-none focus:border-brand/60"
              />
              <input
                defaultValue={line.message}
                placeholder="Message"
                onBlur={(e) => {
                  const next = [...chat];
                  next[i] = { ...line, message: e.target.value };
                  setChat(next);
                }}
                className="min-w-0 flex-1 rounded-lg border border-[#2a2a35] bg-[#131316] px-2 py-1.5 text-[12px] text-white outline-none focus:border-brand/60"
              />
              <button
                type="button"
                onClick={() => setChat(chat.filter((_, j) => j !== i))}
                aria-label="Remove message"
                className="shrink-0 rounded-md p-1.5 text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => setChat([...chat, { atSec: 0, name: "", message: "" }])}
            className="self-start rounded-full bg-[#1a1a22] px-3 py-1.5 text-[12px] text-white hover:bg-[#22222c] disabled:opacity-50"
          >
            Add message
          </button>
        </div>
      </div>

      {/* Preview: what an attendee sees, minus the clock. The scripted chat
          is revealed against the video's own currentTime, so the timings can
          be checked here instead of during the real session. */}
      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-4 md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0 flex-1">
              <video
                src={preview.videoUrl}
                controls
                autoPlay
                onTimeUpdate={(e) => setPreviewAt(e.currentTarget.currentTime)}
                className="w-full rounded-xl bg-black"
              />
              <p className="mt-2 text-[11px] text-[#9fa0b8]">
                Preview only — the real session starts on the webinar&apos;s schedule and
                everyone joining sees the same moment.
              </p>
            </div>
            <div className="flex w-full flex-col md:w-64">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9fa0b8]">
                Scripted chat
              </p>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {preview.simulatedChat.filter((m) => m.atSec <= previewAt).length === 0 ? (
                  <p className="text-[12px] text-[#9fa0b8]">Nothing scripted yet.</p>
                ) : (
                  preview.simulatedChat
                    .filter((m) => m.atSec <= previewAt)
                    .map((m, i) => (
                      <p key={i} className="text-[12px] leading-snug text-white">
                        <span className="font-semibold text-brand">{m.name}</span>{" "}
                        {m.message}
                      </p>
                    ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="mt-3 rounded-full bg-[#1a1a22] px-3 py-2 text-[12px] text-white hover:bg-[#22222c]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
