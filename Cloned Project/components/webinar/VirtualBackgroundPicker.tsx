"use client";

import { useRef } from "react";
import { Ban, Loader2, X } from "lucide-react";
import type { BackgroundType } from "@/hooks/webinar/useVirtualBackground";

const PRESET_BACKGROUNDS = [
  {
    id: "office",
    label: "Office",
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=640&q=80",
  },
  {
    id: "nature",
    label: "Nature",
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=640&q=80",
  },
  {
    id: "gradient",
    label: "Gradient",
    url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=640&q=80",
  },
  {
    id: "city",
    label: "City",
    url: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=640&q=80",
  },
];

interface VirtualBackgroundPickerProps {
  backgroundType: BackgroundType;
  backgroundImage: string;
  isProcessing: boolean;
  onSetBlur(): void;
  onSetImage(url: string): void;
  onRemove(): void;
  /**
   * Dismiss the popover. Called by the header's X and immediately after any
   * option is picked — the effect lands on the video behind the picker, so
   * leaving it open just hides the result the user is trying to judge.
   * Optional so the component still renders standalone.
   */
  onClose?(): void;
}

export default function VirtualBackgroundPicker({
  backgroundType,
  backgroundImage,
  isProcessing,
  onSetBlur,
  onSetImage,
  onRemove,
  onClose,
}: VirtualBackgroundPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onSetImage(url);
    onClose?.();
  }

  // Selection handlers all fire-and-close. The background work itself is
  // async inside useVirtualBackground; closing doesn't cancel it.
  const pickNone = () => {
    onRemove();
    onClose?.();
  };
  const pickBlur = () => {
    onSetBlur();
    onClose?.();
  };
  const pickImage = (url: string) => {
    onSetImage(url);
    onClose?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Virtual Background
        </p>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Applying…
            </span>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close virtual background picker"
              className="shrink-0 rounded-md p-0.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* None */}
        <button
          onClick={pickNone}
          className={`flex flex-col items-center gap-1 rounded-lg p-2 text-xs transition ${
            backgroundType === "none"
              ? "bg-white/15 text-white ring-1 ring-white/30"
              : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
          }`}
        >
          <Ban className="h-5 w-5" />
          <span>None</span>
        </button>

        {/* Blur */}
        <button
          onClick={pickBlur}
          className={`flex flex-col items-center gap-1 rounded-lg p-2 text-xs transition ${
            backgroundType === "blur"
              ? "bg-white/15 text-white ring-1 ring-white/30"
              : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
          }`}
        >
          <div className="h-5 w-5 rounded bg-gradient-to-br from-white/25 to-zinc-700/40 blur-[2px]" />
          <span>Blur</span>
        </button>

        {/* Upload */}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-lg bg-white/[0.04] p-2 text-xs text-zinc-400 transition hover:bg-white/[0.08]"
        >
          <span className="text-lg leading-5">+</span>
          <span>Upload</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Preset images */}
      <div className="grid grid-cols-2 gap-2">
        {PRESET_BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            onClick={() => pickImage(bg.url)}
            className={`relative h-14 overflow-hidden rounded-lg transition ${
              backgroundType === "image" && backgroundImage === bg.url
                ? "ring-2 ring-white"
                : "ring-1 ring-white/10 hover:ring-white/20"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bg.url}
              alt={bg.label}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] text-white">
              {bg.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
