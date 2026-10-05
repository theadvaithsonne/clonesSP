"use client";

import { Play, Pause, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface GlobeControlsProps {
  isSpinning: boolean;
  onToggleSpin: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function GlobeControls({
  isSpinning,
  onToggleSpin,
  onZoomIn,
  onZoomOut,
  onResetView,
}: GlobeControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Spin Control */}
      <button
        onClick={onToggleSpin}
        className="w-10 h-10 rounded-lg bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-brand-2 hover:border-brand-2/50 transition-all duration-200"
        title={isSpinning ? "Pause rotation" : "Start rotation"}
      >
        {isSpinning ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>

      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        className="w-10 h-10 rounded-lg bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-brand-2 hover:border-brand-2/50 transition-all duration-200"
        title="Zoom in"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        className="w-10 h-10 rounded-lg bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-brand-2 hover:border-brand-2/50 transition-all duration-200"
        title="Zoom out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      {/* Reset View */}
      <button
        onClick={onResetView}
        className="w-10 h-10 rounded-lg bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-brand-2 hover:border-brand-2/50 transition-all duration-200"
        title="Reset view"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
}
