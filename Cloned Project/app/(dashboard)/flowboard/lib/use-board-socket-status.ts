import { useEffect, useState } from "react";
import { boardSocketService } from "./board-socket-service";

type BoardSocketStatus = {
  connected: boolean;
  reconnecting: boolean;
  connecting: boolean;
  error: string | null;
};

export function useBoardSocketStatus(): BoardSocketStatus {
  const [status, setStatus] = useState<BoardSocketStatus>({
    connected: boardSocketService.connected,
    reconnecting: boardSocketService.reconnecting,
    connecting: boardSocketService.connecting,
    error: boardSocketService.error,
  });

  useEffect(() => {
    const handleConnected = () => {
      setStatus({
        connected: true,
        reconnecting: false,
        connecting: false,
        error: null,
      });
    };

    const handleDisconnected = () => {
      setStatus((prev) => ({
        ...prev,
        connected: false,
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

    boardSocketService.on("connected", handleConnected);
    boardSocketService.on("disconnected", () => handleDisconnected());
    boardSocketService.on("reconnecting", () => handleReconnecting());
    boardSocketService.on("reconnect", () => handleReconnect());
    boardSocketService.on("connect_error", (err) => handleConnectError(err));

    setStatus({
      connected: boardSocketService.connected,
      reconnecting: boardSocketService.reconnecting,
      connecting: boardSocketService.connecting,
      error: boardSocketService.error,
    });

    return () => {
      boardSocketService.off("connected", handleConnected);
      boardSocketService.off("disconnected", handleDisconnected);
      boardSocketService.off("reconnecting", handleReconnecting);
      boardSocketService.off("reconnect", handleReconnect);
      boardSocketService.off("connect_error", handleConnectError);
    };
  }, []);

  return status;
}


