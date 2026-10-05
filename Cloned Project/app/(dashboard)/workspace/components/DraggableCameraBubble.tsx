"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DraggableCameraBubbleProps {
  stream: MediaStream | null;
  isVisible: boolean;
  onPositionChange?: (x: number, y: number, size: number) => void;
}

export function DraggableCameraBubble({ stream, isVisible, onPositionChange }: DraggableCameraBubbleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 20, y: typeof window !== "undefined" ? window.innerHeight - 200 : 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const sizeMap = {
    small: 100,
    medium: 150,
    large: 200,
  };

  const currentSize = sizeMap[size];

  // Report position changes to parent
  useEffect(() => {
    if (onPositionChange && isVisible) {
      onPositionChange(position.x, position.y, currentSize);
    }
  }, [position.x, position.y, currentSize, onPositionChange, isVisible]);

  // Attach video stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch((err) => {
      console.error("Failed to play camera bubble video:", err);
    });

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  // Initialize position when component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPosition({ x: 20, y: window.innerHeight - 200 });
    }
  }, []);

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
    const maxX = window.innerWidth - currentSize - 20;
    const maxY = window.innerHeight - currentSize - 20;

    setPosition({
      x: Math.max(20, Math.min(newX, maxX)),
      y: Math.max(20, Math.min(newY, maxY)),
    });
  }, [isDragging, currentSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle double-click to cycle sizes
  const handleDoubleClick = useCallback(() => {
    setSize((prev) => {
      if (prev === "small") return "medium";
      if (prev === "medium") return "large";
      return "small";
    });
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
    <AnimatePresence>
      {isVisible && stream && (
        <motion.div
          ref={bubbleRef}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: currentSize,
            height: currentSize,
            zIndex: 10000,
            cursor: isDragging ? "grabbing" : "grab",
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          className="select-none"
        >
          <div
            className="w-full h-full rounded-full overflow-hidden shadow-2xl border-4 border-white/20 bg-black"
            style={{
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }} // Mirror effect
            />
          </div>

          {/* Recording indicator ring */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: "3px solid rgba(239, 68, 68, 0.6)",
              animation: "pulse-ring 2s ease-in-out infinite",
            }}
          />

          {/* Size hint on hover */}
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-white/60 bg-black/60 px-2 py-0.5 rounded">
              Double-click to resize
            </span>
          </div>

          <style jsx>{`
            @keyframes pulse-ring {
              0%, 100% {
                opacity: 0.6;
                transform: scale(1);
              }
              50% {
                opacity: 0.3;
                transform: scale(1.02);
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
