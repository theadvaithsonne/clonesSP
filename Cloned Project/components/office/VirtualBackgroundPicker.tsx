'use client';

import { useRef } from 'react';
import { Ban, Loader2 } from 'lucide-react';
import type { BackgroundType } from '@/hooks/office/useVirtualBackground';

const PRESET_BACKGROUNDS = [
  { id: 'blur', label: 'Blur' },
  { id: 'office', label: 'Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=640&q=80' },
  { id: 'nature', label: 'Nature', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=640&q=80' },
  { id: 'gradient', label: 'Gradient', url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=640&q=80' },
  { id: 'city', label: 'City', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=640&q=80' },
];

interface VirtualBackgroundPickerProps {
  backgroundType: BackgroundType;
  backgroundImage: string;
  isProcessing: boolean;
  onSetBlur(): void;
  onSetImage(url: string): void;
  onRemove(): void;
}

export default function VirtualBackgroundPicker({
  backgroundType,
  backgroundImage,
  isProcessing,
  onSetBlur,
  onSetImage,
  onRemove,
}: VirtualBackgroundPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onSetImage(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        Virtual Background
      </p>

      {isProcessing && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Applying...
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {/* None */}
        <button
          onClick={onRemove}
          className={`flex flex-col items-center gap-1 rounded-lg p-2 text-xs transition ${
            backgroundType === 'none'
              ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40'
              : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
          }`}
        >
          <Ban className="h-5 w-5" />
          <span>None</span>
        </button>

        {/* Blur */}
        <button
          onClick={onSetBlur}
          className={`flex flex-col items-center gap-1 rounded-lg p-2 text-xs transition ${
            backgroundType === 'blur'
              ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40'
              : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
          }`}
        >
          <div className="h-5 w-5 rounded bg-gradient-to-br from-gray-400/40 to-gray-600/40 blur-[2px]" />
          <span>Blur</span>
        </button>

        {/* Upload */}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-lg p-2 text-xs bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] transition"
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
      <div className="grid grid-cols-3 gap-2">
        {PRESET_BACKGROUNDS.filter((b) => b.url).map((bg) => (
          <button
            key={bg.id}
            onClick={() => onSetImage(bg.url!)}
            className={`relative h-14 overflow-hidden rounded-lg transition ${
              backgroundType === 'image' && backgroundImage === bg.url
                ? 'ring-2 ring-purple-500'
                : 'ring-1 ring-white/10 hover:ring-white/20'
            }`}
          >
            <img
              src={bg.url}
              alt={bg.label}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5">
              {bg.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
