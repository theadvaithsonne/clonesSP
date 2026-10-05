// hooks/use-chat.ts
import { useEffect, useState, useCallback } from "react";
import { socketService } from "../services/chat-service";
import { Socket } from "socket.io-client";

export interface UseChatReturn {
  socket: Socket | null;
  connected: boolean;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
}

export function useChat(): UseChatReturn {
  const [connected, setConnected] = useState(socketService.connected);
  const [connecting, setConnecting] = useState(socketService.connecting);

  const handleConnected = useCallback(() => {
    console.log("[useChat] Socket connected");
    setConnected(true);
    setConnecting(false);
  }, []);

  const handleDisconnected = useCallback((reason: string) => {
    console.log("[useChat] Socket disconnected:", reason);
    setConnected(false);
    setConnecting(false);
  }, []);

  const handleConnectError = useCallback((err: any) => {
    console.error("[useChat] Connect error:", err);
    setConnecting(false);
  }, []);

  useEffect(() => {
    if (!socketService.connected && !socketService.connecting) {
      socketService.connect();
    }

    socketService.on("connected", handleConnected);
    socketService.on("disconnected", handleDisconnected);
    socketService.on("connect_error", handleConnectError);

    setConnected(socketService.connected);
    setConnecting(socketService.connecting);

    return () => {
      socketService.off("connected", handleConnected);
      socketService.off("disconnected", handleDisconnected);
      socketService.off("connect_error", handleConnectError);
    };
  }, [handleConnected, handleDisconnected, handleConnectError]);

  const connect = useCallback(() => {
    socketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    socketService.disconnect();
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketService.emit(event, data);
  }, []);

  return {
    socket: socketService.socket,
    connected,
    connecting,
    connect,
    disconnect,
    emit,
  };
}