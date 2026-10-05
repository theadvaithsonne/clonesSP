"use client";

import { useState, useCallback, useEffect } from "react";
import { connectSocket } from "@/lib/socket";

interface CommunityStreamState {
  isConnecting: boolean;
  channelId: string | null;
  channelTitle: string;
}

export function useCommunityStream(userId: string) {
  const [streamState, setStreamState] = useState<CommunityStreamState>({
    isConnecting: false,
    channelId: null,
    channelTitle: "",
  });

  const joinCommunityStream = useCallback((channelId: string, channelTitle: string) => {
    const spaceId = `community-stream:${channelId}`;

    setStreamState({
      isConnecting: true,
      channelId,
      channelTitle,
    });

    const socket = connectSocket();
    socket.emit("workspace:move-to-space", { spaceId });

    console.log("[CommunityStream] Joining stream:", { channelId, channelTitle, spaceId });
  }, []);

  const leaveCommunityStream = useCallback(() => {
    const socket = connectSocket();
    socket.emit("workspace:move-to-space", { spaceId: "lobby" });

    setStreamState({
      isConnecting: false,
      channelId: null,
      channelTitle: "",
    });

    console.log("[CommunityStream] Left stream");
  }, []);

  // Listen for LiveKit call events to track connection state
  useEffect(() => {
    if (!streamState.channelId) return;

    const socket = connectSocket();

    const handleLivekitCall = (data: { channel: string }) => {
      // Only handle community stream channels
      if (data.channel?.startsWith("community-stream:")) {
        console.log("[CommunityStream] LiveKit call established:", data.channel);
        setStreamState(prev => ({
          ...prev,
          isConnecting: false,
        }));
      }
    };

    const handleLeaveCall = () => {
      if (streamState.channelId) {
        console.log("[CommunityStream] Leave call received");
        setStreamState({
          isConnecting: false,
          channelId: null,
          channelTitle: "",
        });
      }
    };

    socket.on("livekit:init-call", handleLivekitCall);
    socket.on("livekit:join-call", handleLivekitCall);
    socket.on("livekit:leave-call", handleLeaveCall);

    return () => {
      socket.off("livekit:init-call", handleLivekitCall);
      socket.off("livekit:join-call", handleLivekitCall);
      socket.off("livekit:leave-call", handleLeaveCall);
    };
  }, [streamState.channelId]);

  return {
    streamState,
    joinCommunityStream,
    leaveCommunityStream,
    isInStream: !!streamState.channelId,
  };
}
