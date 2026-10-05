"use client";

import { memo, useRef, useEffect } from "react";
import { PeerState } from "../types";

export const PeerAudio = memo(
  ({ peer, isLocal }: { peer: PeerState; isLocal: boolean }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const stream = peer.stream;
    const playAttemptsRef = useRef(0);
    const playRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
    const MAX_PLAY_ATTEMPTS = 5;
    const PLAY_RETRY_DELAY = 500;

    const attemptPlay = (element: HTMLAudioElement, stream: MediaStream) => {
      const audioTracks = stream.getAudioTracks();
      
      // Check if there are any active audio tracks
      if (audioTracks.length === 0) {
        console.log(`[PeerAudio] No audio tracks in stream for peer ${peer.id}`);
        return;
      }
      
      // Check if at least one track is enabled and not muted
      const hasActiveTrack = audioTracks.some(track => track.enabled && !track.muted && track.readyState === 'live');
      if (!hasActiveTrack) {
        console.log(`[PeerAudio] No active audio tracks for peer ${peer.id}`);
        return;
      }
      
      // Clear any existing retry timer
      if (playRetryTimerRef.current) {
        clearTimeout(playRetryTimerRef.current);
        playRetryTimerRef.current = null;
      }
      
      const playPromise = element.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => {
            console.log(`[PeerAudio] Successfully started playback for peer ${peer.id}`);
            playAttemptsRef.current = 0;
          })
          .catch((error) => {
            playAttemptsRef.current++;
            console.warn(`[PeerAudio] Play attempt ${playAttemptsRef.current} failed for peer ${peer.id}:`, error);
            
            // Retry if we haven't exceeded max attempts
            if (playAttemptsRef.current < MAX_PLAY_ATTEMPTS) {
              // Check if the stream is still valid
              if (element.srcObject === stream && stream.getAudioTracks().length > 0) {
                playRetryTimerRef.current = setTimeout(() => {
                  attemptPlay(element, stream);
                }, PLAY_RETRY_DELAY * playAttemptsRef.current); // Exponential backoff
              }
            } else {
              console.error(`[PeerAudio] Max play attempts reached for peer ${peer.id}`);
              playAttemptsRef.current = 0;
            }
          });
      }
    };

    useEffect(() => {
      const element = audioRef.current;
      if (!element) return;

      if (stream) {
        const audioTracks = stream.getAudioTracks();
        
        // Verify stream has audio tracks
        if (audioTracks.length === 0) {
          console.warn(`[PeerAudio] Stream for peer ${peer.id} has no audio tracks`);
          return;
        }
        
        // Check if stream has changed
        if (element.srcObject !== stream) {
          element.srcObject = stream;
          console.log(`[PeerAudio] Set stream for peer ${peer.id}, tracks: ${audioTracks.length}`);
        }
        
        element.muted = isLocal;
        
        // Reset play attempts when stream changes
        playAttemptsRef.current = 0;
        
        // Attempt to play with retry logic
        attemptPlay(element, stream);
        
        // Monitor track state changes
        const handleTrackEnded = () => {
          console.log(`[PeerAudio] Audio track ended for peer ${peer.id}`);
          element.pause();
        };
        
        const handleTrackEnabled = () => {
          console.log(`[PeerAudio] Audio track enabled for peer ${peer.id}`);
          attemptPlay(element, stream);
        };
        
        audioTracks.forEach((track) => {
          track.addEventListener('ended', handleTrackEnded);
          track.addEventListener('unmute', handleTrackEnabled);
          track.addEventListener('start', handleTrackEnabled);
        });
        
        return () => {
          audioTracks.forEach((track) => {
            track.removeEventListener('ended', handleTrackEnded);
            track.removeEventListener('unmute', handleTrackEnabled);
            track.removeEventListener('start', handleTrackEnabled);
          });
          
          if (playRetryTimerRef.current) {
            clearTimeout(playRetryTimerRef.current);
            playRetryTimerRef.current = null;
          }
          
          if (element && element.srcObject === stream) {
            element.pause();
            element.srcObject = null;
          }
        };
      } else if (element.srcObject) {
        element.pause();
        element.srcObject = null;
        playAttemptsRef.current = 0;
      }
    }, [stream, isLocal, peer.id]);

    return (
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="sr-only"
        data-peer-id={peer.id}
      />
    );
  }
);
PeerAudio.displayName = "PeerAudio";
