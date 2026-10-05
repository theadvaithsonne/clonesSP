"use client";

import { useState, useEffect } from "react";
import type { RemoteUserTracks } from "./useCommunityStreamLiveKit";
import { RADIUS_CIRCLE_SIZE } from "./useAvatarPositions";

// Proximity audio uses world coordinates (absolute pixels)
// Two users can hear each other when their circles overlap
// Circle overlap occurs when distance between centers < RADIUS_CIRCLE_SIZE (300px)

interface Position {
  x: number; // World X in pixels
  y: number; // World Y in pixels
}

function calculateOverlap(
  myPos: Position,
  otherPos: Position
): boolean {
  // Both positions are now in absolute world coordinates (pixels)
  // No conversion needed - just calculate Euclidean distance
  const dx = myPos.x - otherPos.x;
  const dy = myPos.y - otherPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Circles overlap when distance < sum of radii (150 + 150 = 300)
  return distance < RADIUS_CIRCLE_SIZE;
}

export function useProximityAudio(
  meId: string,
  positions: Map<string, Position>,
  remoteUserTracks: Map<string, RemoteUserTracks>,
  containerRef: React.RefObject<HTMLDivElement>,
  inCall: boolean
) {
  const [overlappingUsers, setOverlappingUsers] = useState<Set<string>>(
    new Set()
  );

  // Main effect: calculate overlaps and control audio
  useEffect(() => {
    if (!inCall) {
      // Not in call - stop all audio
      remoteUserTracks.forEach((tracks) => {
        tracks.audioTrack?.stop();
      });
      setOverlappingUsers(new Set());
      return;
    }

    const myPosition = positions.get(meId);

    if (!myPosition) {
      // No position for self yet - stop all audio
      remoteUserTracks.forEach((tracks) => {
        tracks.audioTrack?.stop();
      });
      setOverlappingUsers(new Set());
      return;
    }

    const newOverlapping = new Set<string>();

    remoteUserTracks.forEach((tracks, odId) => {
      if (odId === meId) return; // Skip self

      const otherPosition = positions.get(odId);

      if (!otherPosition) {
        // No position for this user - stop their audio
        tracks.audioTrack?.stop();
        return;
      }

      // Calculate overlap using world coordinates directly
      const isOverlapping = calculateOverlap(myPosition, otherPosition);

      if (isOverlapping) {
        newOverlapping.add(odId);
        // Play audio if available and user has audio enabled
        if (tracks.audioTrack && tracks.hasAudio) {
          tracks.audioTrack.play();
        }
      } else {
        // Immediately stop audio when not overlapping
        tracks.audioTrack?.stop();
      }
    });

    setOverlappingUsers(newOverlapping);
  }, [meId, positions, remoteUserTracks, inCall]);

  // Cleanup effect: stop all audio when hook unmounts
  useEffect(() => {
    return () => {
      remoteUserTracks.forEach((tracks) => {
        tracks.audioTrack?.stop();
      });
    };
  }, [remoteUserTracks]);

  return {
    overlappingUsers,
  };
}
