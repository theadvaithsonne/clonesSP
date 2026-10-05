'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { useMediaDeviceSelect } from '@livekit/components-react';
import { cn } from '@/lib/utils';

/**
 * Chevron dropdown for switching mic / camera. Sits next to the main
 * Mic / Camera toggles in the control bar; opens a popover above with
 * one row per available device. Uses LiveKit's useMediaDeviceSelect
 * so switching kicks off the underlying MediaStream reconfiguration.
 *
 * Ported from NC's ControlBar DeviceList component with the same
 * label prettifier — browsers expose raw strings like
 * "Default - Microphone (Realtek)" or "camera2 0, facing front".
 */
function prettifyDeviceLabel(
  label: string,
  kind: MediaDeviceKind,
): string {
  const raw = (label || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (kind === 'videoinput') {
    if (/(facing\s+)?front|front[\s-]?camera|user/.test(lower))
      return 'Front Camera';
    if (/(facing\s+)?back|rear[\s-]?camera|environment/.test(lower))
      return 'Back Camera';
    if (/built[\s-]?in|integrated|facetime|webcam/.test(lower))
      return 'Built-in Camera';
    if (/external|usb/.test(lower)) return 'External Camera';
    return raw;
  }
  if (kind === 'audioinput') {
    if (/^default(\s|$)/i.test(raw)) return 'Default Microphone';
    if (/headphone|airpod|earbuds|earpods/.test(lower))
      return 'Headphone Mic';
    if (/bluetooth|bt\b/.test(lower)) return 'Bluetooth Mic';
    if (/built[\s-]?in|integrated/.test(lower))
      return 'Built-in Microphone';
    if (/microphone|mic\b/.test(lower)) return 'Microphone';
    return raw;
  }
  return raw;
}

export default function DeviceMenu({
  kind,
  ariaLabel,
}: {
  kind: 'audioinput' | 'videoinput';
  ariaLabel: string;
}) {
  const { devices, activeDeviceId, setActiveMediaDevice } =
    useMediaDeviceSelect({ kind });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click. Registered only while open to avoid
  // paying for a global listener at rest.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (devices.length === 0) return null;

  // Dedup-by-suffix: phones expose several "Back Camera"s (wide /
  // ultra / tele). Keep each as a distinct row (deviceId is unique)
  // but number the repeats so the list is scannable.
  const seen: Record<string, number> = {};
  const labels = devices.map((d) => {
    const base =
      prettifyDeviceLabel(d.label, kind) ||
      `Device ${d.deviceId.slice(0, 4)}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? `${base} ${seen[base]}` : base;
  });

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={ariaLabel}
        aria-label={ariaLabel}
        className={cn(
          'flex h-6 w-4 items-center justify-center rounded-full transition',
          open
            ? 'bg-white/[0.16] text-white'
            : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.16] hover:text-white',
        )}
      >
        <ChevronUp className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 min-w-[220px] rounded-xl border border-white/[0.08] bg-[#15151b] p-2 shadow-xl">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
            {kind === 'videoinput' ? 'Camera' : 'Microphone'}
          </p>
          <div className="flex flex-col gap-0.5">
            {devices.map((d, i) => (
              <button
                key={d.deviceId}
                onClick={() => {
                  setActiveMediaDevice(d.deviceId);
                  setOpen(false);
                }}
                className={cn(
                  'w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition',
                  d.deviceId === activeDeviceId
                    ? 'bg-white/[0.08] text-white'
                    : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200',
                )}
              >
                {labels[i]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
