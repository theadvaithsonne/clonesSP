'use client';
import { useState, useCallback } from 'react';
import type { LocalParticipant } from 'livekit-client';
import { toast } from 'sonner';

/** Web screen capture (`getDisplayMedia`) exists only on desktop browsers and a
 *  few Android builds — iOS Safari/WebView has no API for it at all. Check
 *  before attempting so we can explain instead of silently failing. */
function screenShareSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

/** Manages screen share state for a LiveKit local participant. */
export function useScreenShare(localParticipant: LocalParticipant | undefined) {
  const [sharing, setSharing] = useState(false);

  const startShare = useCallback(async () => {
    if (!localParticipant) return;
    if (!screenShareSupported()) {
      toast.error(
        "Your browser can't share your screen. On a phone or tablet, use the NetworkChains app — or share from a computer.",
      );
      return;
    }
    try {
      await localParticipant.setScreenShareEnabled(true, { audio: true });
      setSharing(true);
    } catch (err) {
      // User dismissed the OS "choose what to share" picker — expected, stay quiet.
      const name = (err as { name?: string } | undefined)?.name;
      if (name === 'NotAllowedError' || name === 'AbortError') {
        setSharing(false);
        return;
      }
      toast.error("Couldn't start screen sharing on this device.");
      setSharing(false);
    }
  }, [localParticipant]);

  const stopShare = useCallback(async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch {
      /* already stopped / track gone — ignore */
    }
    setSharing(false);
  }, [localParticipant]);

  const toggle = useCallback(async () => {
    sharing ? await stopShare() : await startShare();
  }, [sharing, startShare, stopShare]);

  return {
    sharing,
    startShare,
    stopShare,
    toggle,
    supported: screenShareSupported(),
  };
}
