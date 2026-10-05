import { useState, useRef, useCallback } from 'react';
import { PeerState } from '../types';
import { isScreenTrack } from '../utils';
import { connectSocket } from '@/lib/socket';

export function useScreenShare(
  localStream: MediaStream | null,
  me: string,
  updatePeerState: (peerId: string, data: Partial<PeerState>) => void,
  getVideoSender: (
    peerId: string,
    pc: RTCPeerConnection
  ) => RTCRtpSender | null,
  getSenderEntry: (peerId: string) => {
    audio?: RTCRtpSender;
    video?: RTCRtpSender;
  },
  bumpLocalStreamVersion: () => void,
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>,
  cameraTrackRef: React.MutableRefObject<MediaStreamTrack | null>
) {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const isScreenSharingRef = useRef(false);
  const [watchingScreenShare, setWatchingScreenShare] =
    useState<PeerState | null>(null);
  const screenShareContainerRef = useRef<HTMLDivElement | null>(null);
  const watchingScreenShareRef = useRef<PeerState | null>(null);
  const [isScreenShareFullscreenActive, setIsScreenShareFullscreenActive] =
    useState(false);

  const closeWatchingScreenShare = useCallback(() => {
    if (typeof document !== 'undefined') {
      const container = screenShareContainerRef.current;
      if (container && document.fullscreenElement === container) {
        void document.exitFullscreen().catch(() => {});
      }
    }

    setIsScreenShareFullscreenActive(false);
    setWatchingScreenShare(null);
  }, []);

  const toggleScreenShareViewFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    const container = screenShareContainerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (error) {
      console.error('Failed to toggle screen share fullscreen:', error);
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!localStream) return;

    const screenTrack = localStream.getVideoTracks().find(isScreenTrack);
    if (screenTrack) {
      screenTrack.onended = null;
      screenTrack.stop();
      localStream.removeTrack(screenTrack);
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];

      if (!cameraTrack) {
        throw new Error('Camera track unavailable');
      }

      cameraStream.getAudioTracks().forEach((track) => track.stop());

      cameraTrackRef.current = cameraTrack;
      localStream.addTrack(cameraTrack);

      await Promise.all(
        Array.from(peerConnections.current.entries()).map(
          async ([peerId, pc]) => {
            const sender = getVideoSender(peerId, pc);
            if (sender) {
              await sender.replaceTrack(cameraTrack);
              // Reset encoding parameters to prevent blurry video
              const params = sender.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = 1_500_000;
                params.degradationPreference = 'maintain-resolution';
                await sender.setParameters(params);
              }
            } else {
              const newSender = pc.addTrack(cameraTrack, localStream);
              getSenderEntry(peerId).video = newSender;
            }
          }
        )
      );
    } catch (err) {
      console.error('Failed to get camera after screen share:', err);
      await Promise.all(
        Array.from(peerConnections.current.entries()).map(
          async ([peerId, pc]) => {
            const sender = getVideoSender(peerId, pc);
            if (sender) {
              try {
                await sender.replaceTrack(null);
              } catch (e) {
                console.error(
                  `Failed to replace track with null for ${peerId}`,
                  e
                );
              }
            }
          }
        )
      );
    } finally {
      bumpLocalStreamVersion();
      setIsScreenSharing(false);
      updatePeerState(me, { isScreenSharing: false });
      connectSocket().emit('workspace:screen-share-state', {
        isSharing: false,
      });
    }
  }, [
    localStream,
    getVideoSender,
    getSenderEntry,
    bumpLocalStreamVersion,
    updatePeerState,
    me,
    peerConnections,
    cameraTrackRef,
  ]);

  const startScreenShare = useCallback(async () => {
    if (!localStream) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        throw new Error('Screen track unavailable');
      }

      screenStream.getAudioTracks().forEach((track) => track.stop());

      const cameraTracks = localStream
        .getVideoTracks()
        .filter((track) => !isScreenTrack(track));
      cameraTracks.forEach((track) => {
        track.stop();
        localStream.removeTrack(track);
      });
      if (cameraTracks.length) {
        cameraTrackRef.current = null;
      }

      localStream.addTrack(screenTrack);

      await Promise.all(
        Array.from(peerConnections.current.entries()).map(
          async ([peerId, pc]) => {
            const sender = getVideoSender(peerId, pc);
            if (sender) {
              await sender.replaceTrack(screenTrack);
            } else {
              const newSender = pc.addTrack(screenTrack, localStream);
              getSenderEntry(peerId).video = newSender;
            }
          }
        )
      );

      bumpLocalStreamVersion();
      screenTrack.onended = () => {
        void stopScreenShare();
      };

      setIsScreenSharing(true);
      updatePeerState(me, { isScreenSharing: true });
      connectSocket().emit('workspace:screen-share-state', {
        isSharing: true,
      });
    } catch (err) {
      console.error('Error starting screen share:', err);
    }
  }, [
    localStream,
    getVideoSender,
    getSenderEntry,
    bumpLocalStreamVersion,
    stopScreenShare,
    updatePeerState,
    me,
    peerConnections,
    cameraTrackRef,
  ]);

  return {
    isScreenSharing,
    isScreenSharingRef,
    watchingScreenShare,
    screenShareContainerRef,
    watchingScreenShareRef,
    isScreenShareFullscreenActive,
    closeWatchingScreenShare,
    toggleScreenShareViewFullscreen,
    startScreenShare,
    stopScreenShare,
    setWatchingScreenShare,
    setIsScreenSharing,
    setIsScreenShareFullscreenActive,
  };
}
