'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { LocalVideoTrack } from 'livekit-client';

export type BackgroundType = 'none' | 'blur' | 'image';

export function useVirtualBackground() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('none');
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const processorRef = useRef<any>(null);
  // Pending background to apply once camera becomes active
  const pendingRef = useRef<{ type: BackgroundType; imageUrl?: string } | null>(null);

  const getLiveVideoTrack = useCallback((): LocalVideoTrack | null => {
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as LocalVideoTrack | undefined;
    // Only return the track if it has a live underlying MediaStreamTrack
    if (track && track.mediaStreamTrack && track.mediaStreamTrack.readyState === 'live') {
      return track;
    }
    return null;
  }, [localParticipant]);

  const clearProcessor = useCallback(async () => {
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as LocalVideoTrack | undefined;
    if (track) {
      try {
        await track.stopProcessor();
      } catch {}
    }
    processorRef.current = null;
  }, [localParticipant]);

  const applyToTrack = useCallback(
    async (type: BackgroundType, imageUrl?: string) => {
      setIsProcessing(true);
      try {
        await clearProcessor();

        if (type === 'none') {
          setBackgroundType('none');
          setBackgroundImage('');
          return;
        }

        const track = getLiveVideoTrack();
        if (!track) {
          // Camera not ready yet — store as pending and enable camera
          pendingRef.current = { type, imageUrl };
          setBackgroundType(type);
          if (imageUrl) setBackgroundImage(imageUrl);
          await localParticipant.setCameraEnabled(true);
          return;
        }

        const { BackgroundBlur, VirtualBackground } = await import(
          '@livekit/track-processors'
        );

        let processor;
        if (type === 'blur') {
          processor = BackgroundBlur(10);
        } else if (type === 'image' && imageUrl) {
          processor = VirtualBackground(imageUrl);
        }

        if (processor) {
          processorRef.current = processor;
          await track.setProcessor(processor);
          setBackgroundType(type);
          if (imageUrl) setBackgroundImage(imageUrl);
        }
      } catch (err) {
        console.error('Failed to apply virtual background:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [getLiveVideoTrack, clearProcessor, localParticipant],
  );

  const setBlur = useCallback(() => applyToTrack('blur'), [applyToTrack]);

  const setImage = useCallback(
    (url: string) => applyToTrack('image', url),
    [applyToTrack],
  );

  const removeBackground = useCallback(
    () => applyToTrack('none'),
    [applyToTrack],
  );

  // When camera becomes enabled, apply pending or re-apply existing background
  useEffect(() => {
    if (!isCameraEnabled) return;

    const pending = pendingRef.current;
    const typeToApply = pending?.type ?? backgroundType;
    if (typeToApply === 'none') return;

    const imageToApply = pending?.imageUrl ?? (backgroundImage || undefined);
    pendingRef.current = null;

    // Delay slightly so the new track's MediaStreamTrack is live
    const timer = setTimeout(async () => {
      const track = getLiveVideoTrack();
      if (track && !track.getProcessor()) {
        await applyToTrack(typeToApply, imageToApply);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [isCameraEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearProcessor();
    };
  }, []);

  return {
    backgroundType,
    backgroundImage,
    isProcessing,
    setBlur,
    setImage,
    removeBackground,
  };
}
