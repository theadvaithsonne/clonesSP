import { useCallback, useRef, useState } from 'react';
import { connectSocket } from '@/lib/socket';
import { PeerState } from '../types';
import { isScreenTrack } from '../utils';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers for better connectivity with remote users
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    // Backup TURN servers
    { urls: 'turn:freeturn.tel:3478', username: 'free', credential: 'free' },
    { urls: 'turn:freeturn.tel:3478?transport=tcp', username: 'free', credential: 'free' },
  ],
  iceCandidatePoolSize: 10, // Pre-gather ICE candidates for faster connection
};

export function useWebRTC(
  me: string,
  localStream: MediaStream | null,
  cameraTrackRef: React.MutableRefObject<MediaStreamTrack | null>
) {
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const trackSenders = useRef<
    Map<string, { audio?: RTCRtpSender; video?: RTCRtpSender }>
  >(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const reconnectTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  const iceRestartTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const iceCandidateQueuesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const iceCandidateTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_BASE = 1000; // Start with 1 second

  const updatePeerState = useCallback(
    (peerId: string, data: Partial<PeerState>) => {
      setPeers((prev) => {
        const existing = prev.get(peerId);
        const next = new Map(prev);
        next.set(peerId, {
          id: peerId,
          email: existing?.email ?? '',
          name: existing?.name,
          spaceId: existing?.spaceId ?? 'lobby',
          ...existing,
          ...data,
        });
        return next;
      });
    },
    []
  );

  const getSenderEntry = useCallback((peerId: string) => {
    let entry = trackSenders.current.get(peerId);
    if (!entry) {
      entry = {};
      trackSenders.current.set(peerId, entry);
    }
    return entry;
  }, []);

  // Cleanup function for peer connection
  const cleanupPeerConnection = useCallback((peerId: string) => {
    // Clear reconnect timers
    const reconnectTimer = reconnectTimersRef.current.get(peerId);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimersRef.current.delete(peerId);
    }
    // Clear ICE restart timers
    const iceRestartTimer = iceRestartTimersRef.current.get(peerId);
    if (iceRestartTimer) {
      clearTimeout(iceRestartTimer);
      iceRestartTimersRef.current.delete(peerId);
    }
    // Clear ICE candidate batching
    const iceCandidateTimer = iceCandidateTimersRef.current.get(peerId);
    if (iceCandidateTimer) {
      clearTimeout(iceCandidateTimer);
      iceCandidateTimersRef.current.delete(peerId);
    }
    iceCandidateQueuesRef.current.delete(peerId);
    // Reset reconnect attempts
    reconnectAttemptsRef.current.delete(peerId);
  }, []);

  // ICE restart function
  const restartICE = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    if (pc.connectionState === 'closed' || pc.signalingState === 'closed') {
      return;
    }

    console.log(`[WebRTC] Attempting ICE restart for ${peerId}`);
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
        console.log(`[WebRTC] Signaling state not stable for ICE restart: ${pc.signalingState}`);
        return;
      }
      await pc.setLocalDescription(offer);
      
      if (pc.localDescription) {
        connectSocket().emit('workspace:signal', {
          to: peerId,
          from: me,
          signal: { sdp: pc.localDescription },
        });
      }
    } catch (err) {
      console.error(`[WebRTC] ICE restart failed for ${peerId}:`, err);
    }
  }, [me]);

  // Connection recovery with exponential backoff
  const attemptReconnect = useCallback(async (peerId: string) => {
    const attempts = reconnectAttemptsRef.current.get(peerId) || 0;
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[WebRTC] Max reconnect attempts reached for ${peerId}`);
      updatePeerState(peerId, { connectionStatus: 'failed' });
      return;
    }

    reconnectAttemptsRef.current.set(peerId, attempts + 1);
    const delay = RECONNECT_DELAY_BASE * Math.pow(2, attempts);
    
    console.log(`[WebRTC] Scheduling reconnect attempt ${attempts + 1} for ${peerId} in ${delay}ms`);
    
    const timer = setTimeout(async () => {
      const pc = peerConnections.current.get(peerId);
      if (!pc || pc.connectionState === 'closed') {
        reconnectTimersRef.current.delete(peerId);
        return;
      }

      if (pc.iceConnectionState === 'failed' || pc.connectionState === 'disconnected') {
        await restartICE(peerId, pc);
      }
      reconnectTimersRef.current.delete(peerId);
    }, delay);

    reconnectTimersRef.current.set(peerId, timer);
  }, [restartICE, updatePeerState]);

  const setupPeerConnection = useCallback(
    (peerId: string) => {
      if (peerConnections.current.has(peerId)) {
        const existing = peerConnections.current.get(peerId)!;
        // If connection is closed, create a new one
        if (existing.connectionState === 'closed') {
          existing.close();
          peerConnections.current.delete(peerId);
        } else {
          return existing;
        }
      }
      
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current.set(peerId, pc);
      reconnectAttemptsRef.current.set(peerId, 0);
      
      if (localStream) {
        const senderEntry = getSenderEntry(peerId);
        localStream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, localStream);
          if (track.kind === 'video') {
            senderEntry.video = sender;
            if (!isScreenTrack(track)) {
              cameraTrackRef.current = track;
            }
          } else if (track.kind === 'audio') {
            senderEntry.audio = sender;
          }
        });
      }
      
      // Improved ICE candidate handling with batching
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          let queue = iceCandidateQueuesRef.current.get(peerId);
          if (!queue) {
            queue = [];
            iceCandidateQueuesRef.current.set(peerId, queue);
          }
          queue.push(event.candidate);
          
          // Batch ICE candidates to reduce signaling traffic
          if (!iceCandidateTimersRef.current.has(peerId)) {
            const timer = setTimeout(() => {
              const candidateQueue = iceCandidateQueuesRef.current.get(peerId);
              if (candidateQueue && candidateQueue.length > 0) {
                // Send all queued candidates at once
                candidateQueue.forEach((candidate) => {
                  connectSocket().emit('workspace:signal', {
                    to: peerId,
                    from: me,
                    signal: { candidate },
                  });
                });
                candidateQueue.length = 0; // Clear array
              }
              iceCandidateTimersRef.current.delete(peerId);
            }, 100); // Batch every 100ms
            iceCandidateTimersRef.current.set(peerId, timer);
          }
        } else {
          // Null candidate means ICE gathering is complete - flush immediately
          const candidateQueue = iceCandidateQueuesRef.current.get(peerId);
          const candidateTimer = iceCandidateTimersRef.current.get(peerId);
          
          if (candidateTimer) {
            clearTimeout(candidateTimer);
            iceCandidateTimersRef.current.delete(peerId);
          }
          
          if (candidateQueue && candidateQueue.length > 0) {
            candidateQueue.forEach((candidate) => {
              connectSocket().emit('workspace:signal', {
                to: peerId,
                from: me,
                signal: { candidate },
              });
            });
            candidateQueue.length = 0; // Clear array
          }
        }
      };
      
      pc.onnegotiationneeded = async () => {
        if (!pc.remoteDescription) {
          return;
        }
        if (pc.signalingState !== 'stable') return;
        if (makingOfferRef.current.get(peerId)) return;

        makingOfferRef.current.set(peerId, true);
        try {
          const offer = await pc.createOffer();
          if (pc.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);
          const localDescription = pc.localDescription;
          if (!localDescription) return;
          connectSocket().emit('renegotiation-needed', {
            to: peerId,
            from: me,
            offer: localDescription,
          });
        } catch (err) {
          console.error(`Failed to renegotiate with ${peerId}:`, err);
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      };
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received track from ${peerId}:`, event.track.kind, event.track.label);
        const track = event.track;

        // Get or create merged stream for this peer
        setPeers((prev) => {
          const existing = prev.get(peerId);
          let mergedStream = existing?.stream;
          
          if (!mergedStream) {
            mergedStream = new MediaStream();
          }

          // Check if track of same kind already exists
          const existingTrackOfSameKind = mergedStream.getTracks().find(
            t => t.kind === track.kind
          );
          
          if (existingTrackOfSameKind && existingTrackOfSameKind.id !== track.id) {
            // Replace existing track of same kind
            mergedStream.removeTrack(existingTrackOfSameKind);
          }
          
          // Add new track if not already present
          if (!mergedStream.getTracks().find(t => t.id === track.id)) {
            mergedStream.addTrack(track);
            console.log(`[WebRTC] Added ${track.kind} track to merged stream for ${peerId}. Total tracks:`, mergedStream.getTracks().map(t => t.kind));
          }

          // Create new stream object to trigger React re-render
          const updatedStream = new MediaStream(mergedStream.getTracks());
          
          const next = new Map(prev);
          next.set(peerId, {
            id: peerId,
            email: existing?.email ?? '',
            name: existing?.name,
            spaceId: existing?.spaceId ?? 'lobby',
            ...existing,
            stream: updatedStream,
          });
          
          return next;
        });

        const refreshPeer = () => {
          setPeers((prev) => {
            const existing = prev.get(peerId);
            if (!existing?.stream) return prev;
            
            const stream = existing.stream;
            const next = new Map(prev);
            next.set(peerId, { ...existing, stream: new MediaStream(stream.getTracks()) });
            return next;
          });
        };

        if (track) {
          const handleMute = () => {
            console.log(`[WebRTC] Track ${track.kind} muted for ${peerId}`);
            refreshPeer();
          };
          const handleUnmute = () => {
            console.log(`[WebRTC] Track ${track.kind} unmuted for ${peerId}`);
            refreshPeer();
          };
          const handleEnded = () => {
            console.log(`[WebRTC] Track ${track.kind} ended for ${peerId}`);
            setPeers((prev) => {
              const existing = prev.get(peerId);
              if (!existing?.stream) return prev;
              
              const stream = existing.stream;
              stream.removeTrack(track);
              
              const next = new Map(prev);
              if (stream.getTracks().length === 0) {
                next.set(peerId, { ...existing, stream: undefined });
              } else {
                next.set(peerId, { ...existing, stream: new MediaStream(stream.getTracks()) });
              }
              return next;
            });
            track.removeEventListener('mute', handleMute);
            track.removeEventListener('unmute', handleUnmute);
          };

          track.addEventListener('mute', handleMute);
          track.addEventListener('unmute', handleUnmute);
          track.addEventListener('ended', handleEnded, { once: true });

          pc.addEventListener('connectionstatechange', () => {
            if (
              pc.connectionState === 'closed' ||
              pc.connectionState === 'failed'
            ) {
              track.removeEventListener('mute', handleMute);
              track.removeEventListener('unmute', handleUnmute);
              track.removeEventListener('ended', handleEnded);
            }
          }, { once: true });
        }
      };
      // Enhanced connection state change handler with recovery
      pc.addEventListener('connectionstatechange', () => {
        const state = pc.connectionState;
        console.log(`[WebRTC] Connection state changed to ${state} for ${peerId}`);
        updatePeerState(peerId, { connectionStatus: state });
        
        if (state === 'failed') {
          makingOfferRef.current.delete(peerId);
          console.error(`[WebRTC] Connection failed for ${peerId}, attempting recovery`);
          attemptReconnect(peerId);
        } else if (state === 'closed') {
          makingOfferRef.current.delete(peerId);
          cleanupPeerConnection(peerId);
        } else if (state === 'disconnected') {
          // Attempt recovery for disconnected state
          const existingTimer = reconnectTimersRef.current.get(peerId);
          if (!existingTimer) {
            setTimeout(() => {
              if (pc.connectionState === 'disconnected') {
                attemptReconnect(peerId);
              }
            }, 2000); // Wait 2 seconds before attempting reconnect
          }
        } else if (state === 'connected') {
          // Reset reconnect attempts on successful connection
          reconnectAttemptsRef.current.set(peerId, 0);
          cleanupPeerConnection(peerId);
        }
      });

      // Enhanced ICE connection state handler with automatic restart
      pc.addEventListener('iceconnectionstatechange', () => {
        const state = pc.iceConnectionState;
        console.log(`[WebRTC] ICE connection state changed to ${state} for ${peerId}`);
        
        if (state === 'failed') {
          console.error(`[WebRTC] ICE connection failed for ${peerId} - attempting ICE restart`);
          // Clear any existing ICE restart timer
          const existingTimer = iceRestartTimersRef.current.get(peerId);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }
          
          // Attempt ICE restart after a short delay
          const timer = setTimeout(() => {
            if (pc.iceConnectionState === 'failed' && pc.connectionState !== 'closed') {
              restartICE(peerId, pc);
            }
            iceRestartTimersRef.current.delete(peerId);
          }, 1000);
          
          iceRestartTimersRef.current.set(peerId, timer);
        } else if (state === 'disconnected') {
          // Attempt recovery for ICE disconnected state
          const existingTimer = iceRestartTimersRef.current.get(peerId);
          if (!existingTimer) {
            const timer = setTimeout(() => {
              if (pc.iceConnectionState === 'disconnected' && pc.connectionState !== 'closed') {
                restartICE(peerId, pc);
              }
              iceRestartTimersRef.current.delete(peerId);
            }, 3000); // Wait 3 seconds for ICE disconnected before restarting
            iceRestartTimersRef.current.set(peerId, timer);
          }
        } else if (state === 'connected' || state === 'completed') {
          // Clear any pending ICE restart timers
          cleanupPeerConnection(peerId);
        }
      });

      pc.addEventListener('icegatheringstatechange', () => {
        console.log(`[WebRTC] ICE gathering state changed to ${pc.iceGatheringState} for ${peerId}`);
      });
      
      return pc;
    },
    [me, localStream, getSenderEntry, updatePeerState, cameraTrackRef, cleanupPeerConnection, restartICE, attemptReconnect]
  );

  // Cleanup function to remove a peer connection
  const removePeerConnection = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(peerId);
    }
    cleanupPeerConnection(peerId);
    trackSenders.current.delete(peerId);
    makingOfferRef.current.delete(peerId);
  }, [cleanupPeerConnection]);

  return {
    peers,
    peerConnections,
    trackSenders,
    makingOfferRef,
    setupPeerConnection,
    updatePeerState,
    setPeers,
    removePeerConnection,
  };
}
