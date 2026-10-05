"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Track, type LocalVideoTrack, type Room } from "livekit-client";
import useWebinarStore from "@/store/webinarStore";

export type BackgroundType = "none" | "blur" | "image";

/**
 * Replace the video track on the webinarStore's localStream so the host's
 * own preview tile reflects the processor output (blur / virtual bg).
 *
 * LiveKit swaps the LocalVideoTrack's underlying MediaStreamTrack when a
 * processor is attached. The webinar store still holds a reference to the
 * ORIGINAL MediaStreamTrack (built from getUserMedia at startMedia time),
 * which is why the local tile appears unaffected. We rebuild a fresh
 * MediaStream pairing the new (processed) video track with the existing
 * mic track and push it into the store so VideoGrid re-renders.
 */
function syncLocalStreamWithProcessedTrack(
  newVideoTrack: MediaStreamTrack | null
) {
  const store = useWebinarStore.getState();
  const prev = store.localStream;
  const audioTrack = prev?.getAudioTracks()[0] ?? null;
  const tracks: MediaStreamTrack[] = [];
  if (newVideoTrack) tracks.push(newVideoTrack);
  if (audioTrack) tracks.push(audioTrack);
  store.setLocalStream(tracks.length ? new MediaStream(tracks) : null);
}

/**
 * Webinar virtual background hook. Mirrors NetworkChain's meet hook but
 * works against the imperative LiveKit `Room` we hold inside
 * `useWebinarLiveKit` (Garage doesn't wrap the webinar in a `<LiveKitRoom>`
 * provider, so `useLocalParticipant()` from `@livekit/components-react`
 * isn't available here).
 *
 * Pass a `getRoom` accessor that returns the current Room or null. The hook
 * polls the camera track lazily — if it isn't published yet when the user
 * picks a background, it stores the choice and applies it once the camera
 * comes online.
 */
export function useVirtualBackground(getRoom: () => Room | null) {
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("none");
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const processorRef = useRef<unknown>(null);
  const pendingRef = useRef<{ type: BackgroundType; imageUrl?: string } | null>(
    null
  );

  const getLiveVideoTrack = useCallback((): LocalVideoTrack | null => {
    const room = getRoom();
    if (!room) return null;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as LocalVideoTrack | undefined;
    if (
      track &&
      track.mediaStreamTrack &&
      track.mediaStreamTrack.readyState === "live"
    ) {
      return track;
    }
    return null;
  }, [getRoom]);

  const clearProcessor = useCallback(async () => {
    const room = getRoom();
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as LocalVideoTrack | undefined;
    if (track) {
      try {
        await track.stopProcessor();
      } catch {
        /* ignore — track may already be stopped */
      }
      // After stopProcessor, the track's mediaStreamTrack reverts to the
      // raw camera. Sync the store so the local preview goes back to
      // unprocessed video.
      if (track.mediaStreamTrack) {
        syncLocalStreamWithProcessedTrack(track.mediaStreamTrack);
      }
    }
    processorRef.current = null;
  }, [getRoom]);

  const applyToTrack = useCallback(
    async (type: BackgroundType, imageUrl?: string) => {
      setIsProcessing(true);
      try {
        await clearProcessor();

        if (type === "none") {
          setBackgroundType("none");
          setBackgroundImage("");
          return;
        }

        const track = getLiveVideoTrack();
        if (!track) {
          // Camera not live yet — remember the choice and turn the camera on.
          pendingRef.current = { type, imageUrl };
          setBackgroundType(type);
          if (imageUrl) setBackgroundImage(imageUrl);
          const room = getRoom();
          if (room) {
            await room.localParticipant.setCameraEnabled(true);
          }
          return;
        }

        const { BackgroundBlur, VirtualBackground } = await import(
          "@livekit/track-processors"
        );

        let processor: unknown;
        if (type === "blur") {
          processor = BackgroundBlur(10);
        } else if (type === "image" && imageUrl) {
          processor = VirtualBackground(imageUrl);
        }

        if (processor) {
          processorRef.current = processor;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await track.setProcessor(processor as any);
          setBackgroundType(type);
          if (imageUrl) setBackgroundImage(imageUrl);
          // After setProcessor, track.mediaStreamTrack now points to the
          // processor output (the raw camera goes through MediaPipe →
          // canvas → captureStream). Push the new track into the store so
          // the local preview tile renders the blurred / replaced video.
          if (track.mediaStreamTrack) {
            syncLocalStreamWithProcessedTrack(track.mediaStreamTrack);
          }
        }
      } catch (err) {
        console.error("[VirtualBackground] apply failed:", err);
      } finally {
        setIsProcessing(false);
      }
    },
    [getLiveVideoTrack, clearProcessor, getRoom]
  );

  const setBlur = useCallback(() => applyToTrack("blur"), [applyToTrack]);
  const setImage = useCallback(
    (url: string) => applyToTrack("image", url),
    [applyToTrack]
  );
  const removeBackground = useCallback(
    () => applyToTrack("none"),
    [applyToTrack]
  );

  // Re-apply pending or current background once the camera track goes live.
  // We poll briefly because the imperative Room doesn't expose a
  // CameraEnabled change event the same way `useLocalParticipant` does.
  useEffect(() => {
    if (backgroundType === "none" && !pendingRef.current) return;

    let attempts = 0;
    const intervalId = setInterval(async () => {
      attempts++;
      if (attempts > 20) {
        clearInterval(intervalId);
        return;
      }
      const track = getLiveVideoTrack();
      if (!track) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((track as any).getProcessor?.()) {
        clearInterval(intervalId);
        return;
      }
      const pending = pendingRef.current;
      const typeToApply = pending?.type ?? backgroundType;
      const imageToApply =
        pending?.imageUrl ?? (backgroundImage || undefined);
      pendingRef.current = null;
      clearInterval(intervalId);
      if (typeToApply !== "none") {
        await applyToTrack(typeToApply, imageToApply);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [backgroundType, backgroundImage, getLiveVideoTrack, applyToTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearProcessor();
    };
  }, [clearProcessor]);

  return {
    backgroundType,
    backgroundImage,
    isProcessing,
    setBlur,
    setImage,
    removeBackground,
  };
}
