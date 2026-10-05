"use client";

// "Which mic?" prompt, shown on join when the machine has more than one.
//
// Bat246/gotobigwin only — see the caller in WebinarRoomClient. Their hosts
// present from setups with a headset, an interface and the built-in mic all
// connected, and the browser's default is regularly the wrong one; they were
// going live on the laptop mic without noticing. Everywhere else the default
// is nearly always right and a modal on every join would be noise, so the
// split-button dropdown in the control bar stays the way to change it.

import { useCallback, useEffect, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { realAudioInputs, micLabel } from "@/lib/webinar/mic-devices";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listDevices: () => Promise<{ audioinput: MediaDeviceInfo[] }>;
  /** Switches the published mic track. Same handler the control bar uses. */
  onPickDevice: (deviceId: string) => Promise<void> | void;
}

export default function MicPickerDialog({
  open,
  onOpenChange,
  listDevices,
  onPickDevice,
}: Props) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { audioinput } = await listDevices();
      const list = realAudioInputs(audioinput);
      setMics(list);
      // Preselect whatever the browser is already using, so confirming
      // without touching anything is a no-op rather than a switch.
      setSelected((prev) =>
        prev && list.some((d) => d.deviceId === prev)
          ? prev
          : list[0]?.deviceId ?? ""
      );
    } catch {
      setMics([]);
    } finally {
      setLoading(false);
    }
  }, [listDevices]);

  // Re-read while open so plugging a headset in mid-prompt updates the list.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    refresh();
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
  }, [open, refresh]);

  const confirm = async () => {
    // No selection, or the one already in use: close without switching.
    if (!selected || selected === mics[0]?.deviceId) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await onPickDevice(selected);
    } finally {
      // Close either way — a failed switch leaves the current mic live, and
      // trapping the host in a modal mid-webinar is worse than the wrong mic.
      setBusy(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Choose your microphone
          </DialogTitle>
          <DialogDescription>
            More than one mic is connected. Pick the one you want to be heard
            on — you can change it later from the mic button.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Looking for microphones…
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label="Microphone"
            className="flex max-h-[240px] flex-col gap-1 overflow-y-auto py-1"
          >
            {mics.map((device, i) => {
              const active = device.deviceId === selected;
              return (
                <button
                  key={device.deviceId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(device.deviceId)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "border-brand bg-brand/10"
                      : "border-border hover:bg-muted/60"
                  }`}
                >
                  <span className="truncate">{micLabel(device, i)}</span>
                  {i === 0 && (
                    <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                      Default
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Use this mic
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
