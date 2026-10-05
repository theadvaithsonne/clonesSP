"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Square, Trash2, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoMessageRecorderProps {
  onRecordingComplete: (file: File) => void;
  onSend?: (file: File) => void;
  // Max length in seconds (default 60). Recording auto-stops at this limit.
  maxSeconds?: number;
  className?: string;
}

const PREFERRED_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

function pickMime(): string {
  for (const t of PREFERRED_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "video/webm";
}

export function VideoMessageRecorder({
  onRecordingComplete,
  onSend,
  maxSeconds = 60,
  className,
}: VideoMessageRecorderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = () => {
    stopTimer();
    stopStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setElapsed(0);
    setIsRecording(false);
    chunksRef.current = [];
    recorderRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Beforeunload warning while recording or unsent preview
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (isRecording || blob) {
        e.preventDefault();
        e.returnValue = "You have an unsent video clip. Leave anyway?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [isRecording, blob]);

  const openAndStart = async () => {
    setError(null);
    setIsOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;
      // Wait a tick for the video element to mount, then attach
      requestAnimationFrame(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          liveVideoRef.current.muted = true;
          liveVideoRef.current.play().catch(() => {});
        }
      });
    } catch (err: any) {
      setError(
        err?.name === "NotAllowedError"
          ? "Camera/microphone permission was denied."
          : "Unable to access camera."
      );
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickMime();
    const rec = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const out = new Blob(chunksRef.current, { type: mime });
      setBlob(out);
      const url = URL.createObjectURL(out);
      setPreviewUrl(url);
      stopStream();
    };
    rec.start();
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        if (next >= maxSeconds) stopRecording();
        return next;
      });
    }, 1000);
  };

  const stopRecording = () => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const close = () => {
    reset();
    setIsOpen(false);
  };

  const handleSend = () => {
    if (!blob) return;
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([blob], `video-note-${Date.now()}.${ext}`, {
      type: blob.type,
    });
    if (onSend) onSend(file);
    else onRecordingComplete(file);
    close();
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openAndStart}
        className={cn(
          "h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#363649] rounded-md",
          className
        )}
        title="Record video message"
      >
        <Video className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#15151b] border border-[#2E2E2E] rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#2E2E2E]">
          <div className="flex items-center gap-2 text-white text-xs font-medium">
            <Video className="h-3.5 w-3.5 text-rose-400" />
            Video message
          </div>
          <button
            type="button"
            onClick={close}
            className="h-6 w-6 flex items-center justify-center rounded text-[#9fa0b8] hover:text-white hover:bg-[#2E2E2E]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="aspect-video bg-black flex items-center justify-center relative">
          {error ? (
            <div className="text-xs text-red-300 px-4 text-center">{error}</div>
          ) : previewUrl ? (
            <video
              ref={previewVideoRef}
              src={previewUrl}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}
          {isRecording && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-white font-mono">
                {fmt(elapsed)} / {fmt(maxSeconds)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[#2E2E2E]">
          {previewUrl ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                  openAndStart();
                }}
                className="text-xs text-[#c7c7da] hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Retake
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSend}
                className="text-xs bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_83%,white)]"
              >
                <Send className="h-3.5 w-3.5 mr-1" /> Send
              </Button>
            </>
          ) : isRecording ? (
            <Button
              type="button"
              size="sm"
              onClick={stopRecording}
              className="text-xs bg-red-500 text-white hover:bg-red-600"
            >
              <Square className="h-3.5 w-3.5 mr-1 fill-current" /> Stop
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={startRecording}
              disabled={!!error || !streamRef.current}
              className="text-xs bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white mr-1.5" /> Record
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
