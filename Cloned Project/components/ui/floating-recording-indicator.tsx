"use client";

import { useScreenRecording } from "@/lib/screen-recording-context";
import { Button } from "@/components/ui/button";
import { Square, Pause, Play, X, Monitor, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useRef, useState } from "react";

interface FloatingRecordingIndicatorProps {
  onOpenChat?: (type: "dm" | "group" | "post", id: string) => void;
}

export function FloatingRecordingIndicator({
  onOpenChat,
}: FloatingRecordingIndicatorProps) {
  const {
    state,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  } = useScreenRecording();

  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Don't show if not recording
  if (!state.isRecording) {
    return null;
  }

  return (
    <>
      {/* Invisible constraints container covering the viewport */}
      <div
        ref={constraintsRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
      />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          drag
          dragControls={dragControls}
          dragMomentum={false}
          dragElastic={0.1}
          dragConstraints={constraintsRef}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          className={cn(
            "fixed top-4 left-1/2 z-[9999] cursor-grab active:cursor-grabbing",
            isDragging && "cursor-grabbing"
          )}
          style={{ x: "-50%" }}
        >
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 bg-[#0e0e12]/95 backdrop-blur-xl border border-red-500/40 rounded-full shadow-2xl shadow-red-900/20 transition-shadow",
              isDragging && "shadow-red-900/40"
            )}
          >
            {/* Drag handle */}
            <div
              className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/50 -ml-1"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <GripHorizontal className="h-4 w-4" />
            </div>

            {/* Recording indicator dot */}
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                state.isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"
              )}
            />

            {/* Recording info */}
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-red-400" />
              <span className="text-sm text-white font-medium select-none">
                Recording
                {state.target?.name && (
                  <span className="text-gray-400 ml-1">
                    for {state.target.name}
                  </span>
                )}
              </span>
            </div>

            {/* Timer */}
            <span className="text-sm text-red-400 font-mono tabular-nums select-none">
              {formatTime(state.recordingTime)}
            </span>

            {/* Controls */}
            <div className="flex items-center gap-1 ml-2 border-l border-white/10 pl-3">
              {/* Pause/Resume */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={state.isPaused ? resumeRecording : pauseRecording}
                className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                title={state.isPaused ? "Resume" : "Pause"}
              >
                {state.isPaused ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
              </Button>

              {/* Stop */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={stopRecording}
                className="h-7 w-7 p-0 text-white hover:text-white hover:bg-white/10 rounded-full"
                title="Stop Recording"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>

              {/* Cancel */}
              {/* <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelRecording}
                className="h-7 w-7 p-0 text-white/70 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                title="Cancel Recording"
              >
                <X className="h-3.5 w-3.5" />
              </Button> */}
            </div>

            {/* Link to open the target chat (only for DM/Group, not for posts) */}
            {state.target && onOpenChat && state.target.type !== "post" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChat(state.target!.type, state.target!.id)}
                className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2 py-1 h-auto"
              >
                Open Chat
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
