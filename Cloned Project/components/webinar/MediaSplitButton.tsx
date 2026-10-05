"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronUp, Check, Loader2 } from "lucide-react";
import {
  GLASS_MENU,
  GLASS_CAPTION,
  GLASS_SPLIT_IDLE,
  GLASS_SPLIT_MUTED,
  GLASS_SPLIT_SHELL,
} from "./glass";

interface Props {
  kind: "audio" | "video";
  enabled: boolean;
  onToggle: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  /** Caption shown under the button when the track is live (e.g. "Mic"). */
  onLabel: string;
  /** Caption shown under the button when the track is muted (e.g. "Unmute"). */
  offLabel: string;
  listDevices: () => Promise<{
    videoinput: MediaDeviceInfo[];
    audioinput: MediaDeviceInfo[];
    audiooutput?: MediaDeviceInfo[];
  }>;
  onPickDevice: (id: string) => Promise<void> | void;
  /**
   * Whether the device dropdown is open. Controlled by the control bar so
   * only one popover in the whole bar can be open at a time, and so the
   * auto-hide timer can keep the bar pinned while a menu is on screen.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bat246/gotobigwin only — adds a visible divider between the toggle
   *  half and the chevron half so the two targets read as distinct
   *  controls (they otherwise share the same red tint while muted,
   *  making the tiny chevron an easy accidental target). */
  emphasizeSplit?: boolean;
}

/**
 * Zoom-style split control: the main face is the existing mute/unmute (or
 * cam on/off) button; the trailing chevron pops a device list so a user
 * with multiple mics/cams can switch without leaving the bar. Replaces the
 * standalone "Devices" cog button — putting the dropdown directly on the
 * relevant control matches the screenshot the team referenced and removes
 * one click from the common path.
 *
 * The bar floats over the bottom of the video stage, so the dropdown opens
 * upwards (and the chevron points up to match).
 */
export default function MediaSplitButton({
  kind,
  enabled,
  onToggle,
  onIcon,
  offIcon,
  onLabel,
  offLabel,
  listDevices,
  onPickDevice,
  open,
  onOpenChange,
  emphasizeSplit = false,
}: Props) {
  const setOpen = onOpenChange;
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // Tracked locally — we don't get authoritative "currently active deviceId"
  // back from LiveKit's setAudio/VideoDevice helpers, so this just remembers
  // whatever the user last picked from this dropdown.
  const [activeId, setActiveId] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const out = await listDevices();
      setDevices(kind === "audio" ? out.audioinput : out.videoinput);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [listDevices, kind]);

  // Lazily fetch (and live-refresh) only while the dropdown is open. The
  // browser fires `devicechange` when something is plugged/unplugged.
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
      await onPickDevice(id);
      setActiveId(id);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const off = !enabled;
  const caption = enabled ? onLabel : offLabel;
  const noun = kind === "audio" ? "microphone" : "camera";

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div
        className={`${GLASS_SPLIT_SHELL} ${off ? GLASS_SPLIT_MUTED : GLASS_SPLIT_IDLE}`}
      >
        <button
          type="button"
          onClick={onToggle}
          // `relative` so the in-icon MicLevelMeter (absolutely positioned
          // 3-band bars) anchors INSIDE the mic button, not on the outer
          // column wrapper where it would render below the caption.
          className={`relative flex h-10 sm:h-11 items-center justify-center pl-3 pr-1 sm:pl-3.5 sm:pr-1.5 transition-colors duration-150 ${
            off
              ? "text-red-300 hover:bg-red-500/25"
              : "text-white hover:bg-white/[0.12]"
          }`}
          title={off ? offLabel : onLabel}
        >
          {off ? offIcon : onIcon}
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex h-10 sm:h-11 items-center justify-center transition-colors duration-150 ${
            emphasizeSplit
              ? "pl-2 pr-3 sm:pl-2.5 sm:pr-3.5 border-l border-white/25"
              : "pl-0.5 pr-2.5 sm:pr-3"
          } ${
            off
              ? "text-red-300 hover:bg-red-500/25"
              : "text-white hover:bg-white/[0.12]"
          }`}
          title={`${noun} options`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <ChevronUp className={emphasizeSplit ? "h-4.5 w-4.5" : "h-3.5 w-3.5"} />
        </button>
      </div>
      <span className={GLASS_CAPTION}>{caption}</span>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="menu"
            // Floats out of flow above the button: the column below is a flex
            // item in the control bar's single row, so anything left in normal
            // flow here would grow the bar and shove every control upward.
            className={`${GLASS_MENU} pointer-events-auto absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 p-2`}
          >
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Select {noun}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-white/60" />
              </div>
            ) : devices.length === 0 ? (
              <p className="px-2 py-3 text-xs text-white/50">
                No {noun} detected
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {devices.map((d) => (
                  <button
                    key={d.deviceId}
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
                        `${kind === "audio" ? "Microphone" : "Camera"} ${d.deviceId.slice(0, 6)}`}
                    </span>
                    {activeId === d.deviceId && (
                      <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-blue-200" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <p className="px-2 pt-1.5 text-[10px] text-white/45">
              Labels appear after camera/microphone permission is granted.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
