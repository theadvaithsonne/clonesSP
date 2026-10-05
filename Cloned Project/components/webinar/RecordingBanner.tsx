"use client";

// Recording banner — shown to ALL participants while the host has
// recording active. The Zustand `isRecording` flag is already kept in
// sync via the existing `webinar:recordingStarted/Stopped` socket
// broadcast in app/webinar/[id]/page.tsx, so this component just
// subscribes and renders.

import useWebinarStore from "@/store/webinarStore";
import { Circle } from "lucide-react";

export default function RecordingBanner() {
  const isRecording = useWebinarStore((s) => s.isRecording);
  if (!isRecording) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-red-600/15 border-b border-red-500/30 text-red-300 px-3 py-1.5 text-xs font-medium">
      <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
      <span>This webinar is being recorded</span>
    </div>
  );
}
