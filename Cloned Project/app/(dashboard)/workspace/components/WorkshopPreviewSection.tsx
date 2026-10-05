"use client";

import { memo, useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useWorkshopPreview, LiveWorkshopData } from "../hooks/useWorkshopPreview";
import { useLiveKitAudience } from "../hooks/useLiveKitAudience";
import { useMediasoupAudience } from "../hooks/useMediasoupAudience";
import { WorkshopPreviewCard } from "./WorkshopPreviewCard";
import { WorkshopPreviewFullscreen } from "./WorkshopPreviewFullscreen";

interface WorkshopPreviewSectionProps {
  orgId: string | null;
}

export const WorkshopPreviewSection = memo(({ orgId }: WorkshopPreviewSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedWorkshopId, setConnectedWorkshopId] = useState<string | null>(null);

  const {
    liveWorkshop,
    isLoading,
    fetchAudienceToken,
  } = useWorkshopPreview(orgId);

  // Call both hooks (React rules of hooks — can't conditionally call)
  const livekit = useLiveKitAudience();
  const mediasoup = useMediasoupAudience();

  // Choose based on workshop type (default to mediasoup for webinars)
  const isMediasoup = (liveWorkshop as any)?.webinarType === "mediasoup" || !(liveWorkshop as any)?.webinarType;
  const audience = isMediasoup ? mediasoup : livekit;

  const {
    leave,
    isJoined,
    isJoining,
    isMuted,
    setMuted,
    screenShareTrack,
    cameraTrack,
    remoteTracks,
    error: dailyError,
  } = audience;

  // Debug logging for track state
  useEffect(() => {
    console.log("[WorkshopPreview] Track state:", {
      isJoined,
      isJoining,
      isConnecting,
      hasCameraTrack: !!cameraTrack,
      hasScreenShareTrack: !!screenShareTrack,
      remoteTracksSize: remoteTracks.size,
      dailyError: dailyError?.message,
    });
  }, [isJoined, isJoining, isConnecting, cameraTrack, screenShareTrack, remoteTracks, dailyError]);

  // Connect to workshop (Mediasoup or LiveKit based on type)
  const connectToWorkshop = useCallback(async (workshop: LiveWorkshopData) => {
    if (isConnecting || connectedWorkshopId === workshop.workshopId) return;

    console.log("[WorkshopPreview] Connecting to workshop:", workshop.title, "type:", isMediasoup ? "mediasoup" : "livekit");
    setIsConnecting(true);
    try {
      if (isMediasoup) {
        // Mediasoup: join with workshopId (no token needed — socket auth handles it)
        await mediasoup.join(workshop.workshopId);
        setConnectedWorkshopId(workshop.workshopId);
      } else {
        // LiveKit: fetch audience token and join
        const tokenData = await fetchAudienceToken();
        if (tokenData) {
          await livekit.join(tokenData.roomUrl, tokenData.token);
          setConnectedWorkshopId(workshop.workshopId);
        } else {
          console.error("[WorkshopPreview] No token data received!");
        }
      }
      console.log("[WorkshopPreview] Connected to workshop:", workshop.title);
    } catch (err) {
      console.error("[WorkshopPreview] Failed to connect:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, connectedWorkshopId, isMediasoup, mediasoup, livekit, fetchAudienceToken]);

  // Auto-connect when we have a live workshop
  useEffect(() => {
    if (liveWorkshop && !isJoined && !isConnecting && connectedWorkshopId !== liveWorkshop.workshopId) {
      connectToWorkshop(liveWorkshop);
    }
  }, [liveWorkshop, isJoined, isConnecting, connectedWorkshopId, connectToWorkshop]);

  // Disconnect when workshop ends
  useEffect(() => {
    if (!liveWorkshop && isJoined) {
      console.log("[WorkshopPreview] Workshop ended, leaving channel");
      leave();
      setConnectedWorkshopId(null);
      setIsExpanded(false);
    }
  }, [liveWorkshop, isJoined, leave]);

  // Handle ESC key to close fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Cleanup on unmount - use ref to avoid triggering on dependency changes
  const isJoinedRef = useRef(isJoined);
  const leaveRef = useRef(leave);

  useEffect(() => {
    isJoinedRef.current = isJoined;
    leaveRef.current = leave;
  }, [isJoined, leave]);

  useEffect(() => {
    return () => {
      console.log("[WorkshopPreview] Component unmounting, isJoined:", isJoinedRef.current);
      if (isJoinedRef.current) {
        leaveRef.current();
      }
    };
  }, []); // Empty deps - only runs on unmount

  // Don't render if no live workshop or still loading initial
  if (!liveWorkshop) {
    return null;
  }

  const handleToggleMute = () => {
    setMuted(!isMuted);
  };

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
    // Re-mute when closing fullscreen
    setMuted(true);
  };

  return (
    <>
      {/* Preview Card */}
      <AnimatePresence>
        {!isExpanded && (
          <WorkshopPreviewCard
            workshop={liveWorkshop}
            screenShareTrack={screenShareTrack}
            cameraTrack={cameraTrack}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onExpand={handleExpand}
            isConnecting={isConnecting || isJoining}
          />
        )}
      </AnimatePresence>

      {/* Fullscreen View */}
      <AnimatePresence>
        {isExpanded && (
          <WorkshopPreviewFullscreen
            workshop={liveWorkshop}
            screenShareTrack={screenShareTrack}
            cameraTrack={cameraTrack}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </>
  );
});
WorkshopPreviewSection.displayName = "WorkshopPreviewSection";
