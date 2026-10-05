import { useEffect, useState } from "react";
import { notificationSocketService } from "./notification-socket-service";

type SocketStatus = {
  connected: boolean;
  reconnecting: boolean;
  connecting: boolean;
  error: string | null;
};

export function useNotificationSocketStatus(): SocketStatus & { socketId: string | null } {
  const [status, setStatus] = useState<SocketStatus & { socketId: string | null }>({
    connected: notificationSocketService.connected,
    reconnecting: notificationSocketService.reconnecting,
    connecting: notificationSocketService.connecting,
    error: notificationSocketService.error,
    socketId: notificationSocketService.socketId,
  });

  useEffect(() => {
    const handleConnected = () => {
      setStatus(prev => ({
        ...prev,
        connected: true,
        reconnecting: false,
        connecting: false,
        error: null,
      }));
    };

    const handleDisconnected = () => {
      setStatus((prev) => ({
        ...prev,
        connected: false,
        socketId: null,
      }));
    };

    const handleReconnecting = () => {
      setStatus((prev) => ({
        ...prev,
        reconnecting: true,
        connected: false,
      }));
    };

    const handleReconnect = () => {
      setStatus((prev) => ({
        ...prev,
        reconnecting: false,
        connected: true,
      }));
    };

    const handleConnectError = (err: { message?: string }) => {
      setStatus((prev) => ({
        ...prev,
        connecting: false,
        reconnecting: true,
        connected: false,
        error: err?.message || "Connection failed",
      }));
    };

    const handleSocketId = (id: string) => {
      setStatus((prev) => ({
        ...prev,
        socketId: id,
      }));
    }

    // Subscribe to socket events
    notificationSocketService.on("connected", handleConnected);
    notificationSocketService.on("disconnected", handleDisconnected);
    notificationSocketService.on("reconnecting", handleReconnecting);
    notificationSocketService.on("reconnect", handleReconnect);
    notificationSocketService.on("connect_error", handleConnectError);
    notificationSocketService.on("your-id", handleSocketId);

    // Sync initial state in case socket is already connected
    setStatus({
      connected: notificationSocketService.connected,
      reconnecting: notificationSocketService.reconnecting,
      connecting: notificationSocketService.connecting,
      error: notificationSocketService.error,
      socketId: notificationSocketService.socketId,
    });

    return () => {
      notificationSocketService.off("connected", handleConnected);
      notificationSocketService.off("disconnected", handleDisconnected);
      notificationSocketService.off("reconnecting", handleReconnecting);
      notificationSocketService.off("reconnect", handleReconnect);
      notificationSocketService.off("connect_error", handleConnectError);
      notificationSocketService.off("your-id", handleSocketId);
    };
  }, []);

  return status;
}


