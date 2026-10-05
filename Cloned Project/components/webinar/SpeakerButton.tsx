"use client";

import { useCallback, useEffect, useState } from "react";
import { Volume2, VolumeX, Check, Loader2, ChevronUp } from "lucide-react";
import useWebinarStore from "@/store/webinarStore";
import {
  GLASS_MENU,
  GLASS_CAPTION,
  GLASS_SPLIT_IDLE,
  GLASS_SPLIT_MUTED,
  GLASS_SPLIT_SHELL,
} from "./glass";

interface Props {
  listDevices: () => Promise<{
    videoinput: MediaDeviceInfo[];
    audioinput: MediaDeviceInfo[];
    audiooutput?: MediaDeviceInfo[];
  }>;
  onPickOutputDevice: (id: string) => Promise<void> | void;
  /**
   * Whether the output-device dropdown is open. Controlled by the control
   * bar so only one popover in the bar can be open at a time, and so the
   * auto-hide timer stays pinned while the menu is on screen.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Speaker split-button for the control bar, shown to everyone (presenters and
 * attendees). The main face toggles the LOCAL speaker mute — it silences every
 * RemoteAudio playback element and nothing else, fully independent of the mic
 * button. The chevron pops the audio-output device picker.
 *
 * Firefox / some mobile Safari builds can't switch output sinks; there the
 * device list comes back empty and the popover just says so.
 *
 * The bar floats over the bottom of the video stage, so the picker opens
 * upwards (and the chevron points up to match).
 */
export default function SpeakerButton({
  listDevices,
  onPickOutputDevice,
  open,
  onOpenChange,
}: Props) {
  const speakerMuted = useWebinarStore((s) => s.speakerMuted);
  const setSpeakerMuted = useWebinarStore((s) => s.setSpeakerMuted);
  const setOpen = onOpenChange;
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const [revealing, setRevealing] = useState(false);
  const [revealDenied, setRevealDenied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const out = await listDevices();
      setOutputs(out.audiooutput || []);
    } catch {
      setOutputs([]);
    } finally {
      setLoading(false);
    }
  }, [listDevices]);

  // Browsers only expose device *labels* once the origin has been granted
  // mic/cam permission. An attendee never turns on a mic, so their speaker
  // list is stuck showing anonymous "Output" entries forever. This does a
  // one-shot getUserMedia(audio) purely to unlock the labels, then stops the
  // track immediately — nothing is ever published or recorded.
  const hasLabels = outputs.some((d) => !!d.label);
  const revealLabels = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    setRevealing(true);
    setRevealDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      await refresh();
    } catch {
      setRevealDenied(true);
    } finally {
      setRevealing(false);
    }
  }, [refresh]);

  // Lazily fetch + live-refresh only while open (devicechange = plug/unplug).
  useEffect(() => {
    if (!open) return;
    refresh();
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", refresh);
      return () =>
        navigator.mediaDevices.removeEventListener("devicechange", refresh);
    }
  }, [open, refresh]);

  const pick = async (id: string) => {
    setBusy(true);
    try {
      await onPickOutputDevice(id);
      setActiveId(id);
      // Keep the popover open so the user can A/B between outputs.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div
        className={`${GLASS_SPLIT_SHELL} ${speakerMuted ? GLASS_SPLIT_MUTED : GLASS_SPLIT_IDLE}`}
      >
        <button
          type="button"
          onClick={() => setSpeakerMuted(!speakerMuted)}
          className={`flex h-10 sm:h-11 items-center justify-center pl-3 pr-1 sm:pl-3.5 sm:pr-1.5 transition-colors duration-150 ${
            speakerMuted
              ? "text-red-300 hover:bg-red-500/25"
              : "text-white hover:bg-white/[0.12]"
          }`}
          title={speakerMuted ? "Unmute speaker" : "Mute speaker"}
        >
          {speakerMuted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex h-10 sm:h-11 items-center justify-center pl-0.5 pr-2.5 sm:pr-3 transition-colors duration-150 ${
            speakerMuted
              ? "text-red-300 hover:bg-red-500/25"
              : "text-white hover:bg-white/[0.12]"
          }`}
          title="Choose speaker"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className={GLASS_CAPTION}>
        {speakerMuted ? "Sound Off" : "Speaker"}
      </span>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="menu"
            // Floats out of flow above the button — see MediaSplitButton: a
            // menu left in normal flow grows this flex item and breaks the
            // control bar's single-row layout.
            className={`${GLASS_MENU} pointer-events-auto absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 p-2`}
          >
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Speaker
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-white/60" />
              </div>
            ) : outputs.length === 0 ? (
              <p className="px-2 py-3 text-xs text-white/50">
                Your browser doesn&apos;t allow switching speakers here.
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {outputs.map((d, i) => (
                  <button
                    key={d.deviceId || `out-${i}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={activeId === d.deviceId}
                    onClick={() => pick(d.deviceId)}
                    disabled={busy}
                    className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition disabled:opacity-50 ${
                      activeId === d.deviceId
                        ? "bg-blue-500/25 text-blue-200"
                        : "text-white/80 hover:bg-white/[0.1]"
                    }`}
                  >
                    <span className="truncate">
                      {d.label ||
                        (d.deviceId === "default" || !d.deviceId
                          ? "System default"
                          : `Speaker ${i + 1}`)}
                    </span>
                    {activeId === d.deviceId && (
                      <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-blue-200" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {/* Device names are hidden until the origin has mic/cam
                permission — offer a one-tap unlock instead of a dead-end
                note that never comes true for a view-only attendee. */}
            {outputs.length > 0 && !hasLabels && (
              <div className="px-2 pt-2 mt-1 border-t border-white/[0.1]">
                <button
                  type="button"
                  onClick={revealLabels}
                  disabled={revealing}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-blue-200 transition hover:bg-white/[0.1] disabled:opacity-50"
                >
                  {revealing && <Loader2 className="h-3 w-3 animate-spin" />}
                  {revealing ? "Requesting…" : "Show device names"}
                </button>
                <p className="px-1 pt-1 text-[10px] leading-snug text-white/45">
                  {revealDenied
                    ? "Permission denied — names stay hidden, but you can still pick an output above."
                    : "Grants a one-time mic check to read your speaker names. Nothing is recorded or shared."}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
