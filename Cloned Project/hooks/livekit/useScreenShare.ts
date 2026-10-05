'use client';
import { useState, useCallback } from 'react';
import type { LocalParticipant } from 'livekit-client';

/** Manages screen share state for a LiveKit local participant. */
export function useScreenShare(localParticipant: LocalParticipant | undefined) {
  const [sharing, setSharing] = useState(false);

  const startShare = useCallback(async () => {
    if (!localParticipant) return;
    await localParticipant.setScreenShareEnabled(true);
    setSharing(true);
  }, [localParticipant]);

  const stopShare = useCallback(async () => {
    if (!localParticipant) return;
    await localParticipant.setScreenShareEnabled(false);
    setSharing(false);
  }, [localParticipant]);

  const toggle = useCallback(async () => {
    sharing ? await stopShare() : await startShare();
  }, [sharing, startShare, stopShare]);

  return { sharing, startShare, stopShare, toggle };
}
