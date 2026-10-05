"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { API_URL } from "@/lib/api";
import { connectSocket } from "@/lib/socket";

export interface LiveWorkshopData {
  workshopId: string;
  title: string;
  thumbnail: string | null;
  hostName: string;
  hostProfilePicture: string | null;
  hostEmail: string;
  meetId: string;
  agoraChannel: string;
  startedAt: string;
  viewerCount: number;
  isScreenSharing: boolean;
  screenSharingByUid: number | null;
  webinarType?: "mediasoup" | "livekit";
}

export interface AudienceTokenData {
  token: string;
  roomUrl: string;
}

export interface UseWorkshopPreviewResult {
  liveWorkshop: LiveWorkshopData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  fetchAudienceToken: () => Promise<AudienceTokenData | null>;
  updateStatus: () => Promise<void>;
}

const POLL_INTERVAL = 30000; // 30 seconds
const STATUS_POLL_INTERVAL = 10000; // 10 seconds for status updates

export function useWorkshopPreview(orgId: string | null): UseWorkshopPreviewResult {
  const [liveWorkshop, setLiveWorkshop] = useState<LiveWorkshopData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLiveWorkshop = useCallback(async () => {
    if (!orgId) {
      setLiveWorkshop(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/workshop-preview/live?orgId=${orgId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch live workshop");
      }

      const data = await response.json();

      if (data.success && data.workshop) {
        setLiveWorkshop(data.workshop);
        setError(null);
      } else {
        // No live workshop - clear state
        setLiveWorkshop(null);
      }
    } catch (err) {
      console.error("[WorkshopPreview] Error fetching live workshop:", err);
      setError(err as Error);
      // Clear liveWorkshop on error to ensure we don't show stale data
      setLiveWorkshop(null);
    }
  }, [orgId]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchLiveWorkshop();
    setIsLoading(false);
  }, [fetchLiveWorkshop]);

  const fetchAudienceToken = useCallback(async (): Promise<AudienceTokenData | null> => {
    if (!liveWorkshop) {
      console.log("[WorkshopPreview] fetchAudienceToken: No live workshop");
      return null;
    }

    console.log("[WorkshopPreview] fetchAudienceToken: Requesting token for", {
      workshopId: liveWorkshop.workshopId,
      agoraChannel: liveWorkshop.agoraChannel,
    });

    try {
      const response = await fetch(`${API_URL}/workshop-preview/audience-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workshopId: liveWorkshop.workshopId,
          agoraChannel: liveWorkshop.agoraChannel,
        }),
      });

      console.log("[WorkshopPreview] fetchAudienceToken: Response status", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[WorkshopPreview] fetchAudienceToken: Error response", errorText);
        throw new Error("Failed to fetch audience token");
      }

      const data = await response.json();
      console.log("[WorkshopPreview] fetchAudienceToken: Response data", {
        success: data.success,
        roomUrl: data.roomUrl,
        hasToken: !!data.token,
      });

      if (data.success) {
        return {
          token: data.token,
          roomUrl: data.roomUrl,
        };
      }

      return null;
    } catch (err) {
      console.error("[WorkshopPreview] Error fetching audience token:", err);
      setError(err as Error);
      return null;
    }
  }, [liveWorkshop]);

  const updateStatus = useCallback(async () => {
    if (!liveWorkshop) return;

    try {
      const response = await fetch(`${API_URL}/workshop-preview/status/${liveWorkshop.meetId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        // Meeting might have ended
        if (response.status === 404) {
          setLiveWorkshop(null);
        }
        return;
      }

      const data = await response.json();

      if (data.success) {
        if (!data.isLive) {
          // Meeting ended
          setLiveWorkshop(null);
        } else {
          // Update viewer count and screen sharing state
          setLiveWorkshop((prev) =>
            prev
              ? {
                  ...prev,
                  viewerCount: data.viewerCount,
                  isScreenSharing: data.isScreenSharing,
                  screenSharingByUid: data.screenSharingByUid,
                }
              : null
          );
        }
      }
    } catch (err) {
      console.error("[WorkshopPreview] Error updating status:", err);
    }
  }, [liveWorkshop]);

  // Initial fetch
  useEffect(() => {
    if (orgId) {
      refetch();
    }
  }, [orgId, refetch]);

  // Set up polling for live workshop detection
  useEffect(() => {
    if (!orgId) return;

    pollIntervalRef.current = setInterval(fetchLiveWorkshop, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [orgId, fetchLiveWorkshop]);

  // Set up status polling when we have a live workshop
  useEffect(() => {
    if (!liveWorkshop) {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
        statusPollIntervalRef.current = null;
      }
      return;
    }

    statusPollIntervalRef.current = setInterval(updateStatus, STATUS_POLL_INTERVAL);

    return () => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
        statusPollIntervalRef.current = null;
      }
    };
  }, [liveWorkshop, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, []);

  // Listen for real-time socket events for workshop preview
  useEffect(() => {
    if (!orgId) return;

    const socket = connectSocket();

    // When a workshop goes live, refetch immediately
    const handleWorkshopLive = (data: { workshopId?: string; meetId?: string; title?: string }) => {
      console.log("[WorkshopPreview] Socket: Workshop went live", data);
      fetchLiveWorkshop();
    };

    // When a workshop ends, clear state immediately
    const handleWorkshopEnded = (data: { workshopId?: string; meetId?: string; title?: string }) => {
      console.log("[WorkshopPreview] Socket: Workshop ended", data);
      setLiveWorkshop(null);
    };

    socket.on("workshop:preview:live", handleWorkshopLive);
    socket.on("workshop:preview:ended", handleWorkshopEnded);

    return () => {
      socket.off("workshop:preview:live", handleWorkshopLive);
      socket.off("workshop:preview:ended", handleWorkshopEnded);
    };
  }, [orgId, fetchLiveWorkshop]);

  return {
    liveWorkshop,
    isLoading,
    error,
    refetch,
    fetchAudienceToken,
    updateStatus,
  };
}
