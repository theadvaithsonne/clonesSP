"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Square, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecordingControlsProps {
  isRecordingMicOn: boolean;
  isRecordingCameraOn: boolean;
  onMicToggle: () => void;
  onCameraToggle: () => void;
  onStopRecording: () => void;
  recordingDuration: number;
}

export function RecordingControls({
  isRecordingMicOn,
  isRecordingCameraOn,
  onMicToggle,
  onCameraToggle,
  onStopRecording,
  recordingDuration,
}: RecordingControlsProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const controlsWidth = 280; // Approximate width of the controls bar
  const leftOffset = 150; // How much left from center
  const [position, setPosition] = useState({
    x: typeof window !== "undefined" ? (window.innerWidth - controlsWidth) / 2 - leftOffset : 200,
    y: typeof window !== "undefined" ? window.innerHeight - 100 : 500
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  // Initialize position to bottom left-of-center on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPosition({
        x: (window.innerWidth - controlsWidth) / 2 - leftOffset,
        y: window.innerHeight - 100,
      });
    }
  }, []);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const newX = positionStartRef.current.x + deltaX;
    const newY = positionStartRef.current.y + deltaY;

    // Keep within viewport bounds
    const maxX = window.innerWidth - 200;
    const maxY = window.innerHeight - 60;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <motion.div
      ref={controlsRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 10001,
        cursor: isDragging ? "grabbing" : "default",
      }}
      className="select-none"
    >
      <div className="bg-black/90 backdrop-blur-lg rounded-full px-3 py-2 flex items-center gap-2 shadow-2xl border border-white/10">
        {/* Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          <GripHorizontal className="w-4 h-4 text-white/60" />
        </div>

        {/* Recording indicator with duration */}
        <div className="flex items-center gap-2 px-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-medium tabular-nums">
            {formatDuration(recordingDuration)}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/20" />

        {/* Mic Toggle */}
        <Button
          onClick={onMicToggle}
          size="icon"
          variant="ghost"
          className={cn(
            "rounded-full w-9 h-9 text-white hover:bg-white/10 transition-all",
            !isRecordingMicOn && "bg-red-500/80 hover:bg-red-500"
          )}
        >
          {isRecordingMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </Button>

        {/* Camera Toggle */}
        <Button
          onClick={onCameraToggle}
          size="icon"
          variant="ghost"
          className={cn(
            "rounded-full w-9 h-9 text-white hover:bg-white/10 transition-all",
            !isRecordingCameraOn && "bg-red-500/80 hover:bg-red-500"
          )}
        >
          {isRecordingCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </Button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/20" />

        {/* Stop Recording Button */}
        <Button
          onClick={onStopRecording}
          size="icon"
          variant="ghost"
          className="rounded-full w-9 h-9 bg-red-500 hover:bg-red-600 text-white transition-all"
        >
          <Square className="w-4 h-4 fill-current" />
        </Button>
      </div>
    </motion.div>
  );
}
