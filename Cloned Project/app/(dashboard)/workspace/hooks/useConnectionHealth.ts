"use client";

import { useEffect, useRef, useCallback } from "react";
import { connectSocket } from "@/lib/socket";

/**
 * Workspace connection-health hook.
 *
 * The user-visible "you are disconnected / reconnecting" overlay was retired
 * with the presence-UI cleanup (the green-dot online indicator went away at
 * the same time). What remains is the *functional* heartbeat + silent rejoin
 * machinery — these still need to fire because the backend uses them for:
 *
 *   - `workspace:heartbeat`     → refreshes the Redis `workspace:user:${id}`
 *                                 TTL that knock routing reads, and touches
 *                                 `User.lastSeenAt` (throttled, 1/min) so
 *                                 other clients can render "Active X ago".
 *   - `workspace:rejoin`        → restores room membership after a socket
 *                                 reconnect so DM/knock/feed events route
 *                                 to this client again.
 *   - `workspace:request-sync`  → asks the server to re-emit roster state
 *                                 after a long tab-hidden gap.
 *
 * Everything that drove a banner / modal / "reconnecting…" state was removed.
 * `connectionState` / `isReconnecting` are returned as constants so the
 * caller signature stays stable; nothing in the UI consumes them any more.
 */

type ConnectionStateStub = "connected";

interface HeartbeatAckData {
  timestamp: number;
  presenceValid: boolean;
  userId: string;
  reason?: string;
}

interface RejoinResponse {
  success: boolean;
  user?: any;
  users?: any[];
  error?: string;
  timestamp: number;
}

interface UseConnectionHealthOptions {
  onRejoinSuccess?: (users: any[]) => void;
  onUsersSync?: (users: any[]) => void;
}

export function useConnectionHealth(options: UseConnectionHealthOptions = {}) {
  const { onRejoinSuccess, onUsersSync } = options;

  const lastVisibilityChangeRef = useRef<number>(Date.now());
  const hasJoinedWorkspaceRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 3;

  const rejoinWorkspace = useCallback(() => {
    const socket = connectSocket();
    if (!socket?.connected) return;

    reconnectAttemptRef.current += 1;
    if (reconnectAttemptRef.current > maxReconnectAttempts) {
      reconnectAttemptRef.current = 0;
      return;
    }

    socket.emit("workspace:rejoin", null, (response: RejoinResponse) => {
      if (response?.success) {
        reconnectAttemptRef.current = 0;
        hasJoinedWorkspaceRef.current = true;
        if (response.users && onRejoinSuccess) {
          onRejoinSuccess(response.users);
        }
      } else if (reconnectAttemptRef.current < maxReconnectAttempts) {
        setTimeout(() => rejoinWorkspace(), 2000);
      } else {
        reconnectAttemptRef.current = 0;
      }
    });
  }, [onRejoinSuccess]);

  const checkAndRejoinWorkspace = useCallback(() => {
    const socket = connectSocket();
    if (!socket?.connected) return;

    socket.emit(
      "workspace:check-presence",
      null,
      (response: { presenceValid: boolean; inWorkspaceRoom: boolean }) => {
        if (!response?.presenceValid || !response?.inWorkspaceRoom) {
          rejoinWorkspace();
        } else {
          socket.emit("workspace:request-sync");
        }
      }
    );
  }, [rejoinWorkspace]);

  const handleManualReconnect = useCallback(() => {
    const socket = connectSocket();
    reconnectAttemptRef.current = 0;
    if (!socket?.connected) {
      socket.connect();
      const onConnect = () => {
        socket.off("connect", onConnect);
        rejoinWorkspace();
      };
      socket.on("connect", onConnect);
    } else {
      rejoinWorkspace();
    }
  }, [rejoinWorkspace]);

  // Visibility-driven heartbeat refresh — keeps backend TTL alive after the
  // tab returns from background, and triggers a silent presence repair if
  // the user was away long enough that the server likely evicted them.
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      if (isVisible) {
        const hiddenDuration = Date.now() - lastVisibilityChangeRef.current;
        if (hiddenDuration > 5 * 60 * 1000) {
          checkAndRejoinWorkspace();
        } else if (hiddenDuration > 60 * 1000) {
          connectSocket()?.emit("workspace:heartbeat");
        }
      } else {
        lastVisibilityChangeRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [checkAndRejoinWorkspace]);

  // Socket lifecycle — silent: no UI state, just keep the workspace room
  // membership intact across reconnects so knock/chat events keep routing.
  useEffect(() => {
    const socket = connectSocket();

    const handleHeartbeatAck = (_data: HeartbeatAckData) => {
      // Backend ack carries presenceValid — we used to surface
      // "presence_expired" on false, but that drove the disconnected
      // overlay which is gone. The rejoin path below covers recovery
      // silently if presence ever drifts out of sync.
    };

    const handleConnect = () => {
      if (hasJoinedWorkspaceRef.current) {
        setTimeout(checkAndRejoinWorkspace, 500);
      }
    };

    const handleJoinConfirmed = (data: { success: boolean; isRejoin?: boolean }) => {
      if (data?.success) {
        hasJoinedWorkspaceRef.current = true;
        reconnectAttemptRef.current = 0;
      }
    };

    const handleFullSync = (data: {
      users: any[];
      selfPresenceValid: boolean;
      selfPresence: any;
    }) => {
      if (!data?.selfPresenceValid) {
        rejoinWorkspace();
      } else if (onUsersSync) {
        onUsersSync(data.users);
      }
    };

    socket.on("workspace:heartbeat-ack", handleHeartbeatAck);
    socket.on("connect", handleConnect);
    socket.on("workspace:join-confirmed", handleJoinConfirmed);
    socket.on("workspace:full-sync", handleFullSync);

    return () => {
      socket.off("workspace:heartbeat-ack", handleHeartbeatAck);
      socket.off("connect", handleConnect);
      socket.off("workspace:join-confirmed", handleJoinConfirmed);
      socket.off("workspace:full-sync", handleFullSync);
    };
  }, [checkAndRejoinWorkspace, rejoinWorkspace, onUsersSync]);

  useEffect(() => {
    return () => {
      hasJoinedWorkspaceRef.current = false;
    };
  }, []);

  // Caller signature preserved — values are constants now since no UI
  // consumes them. Drop the destructure at the callsite when convenient.
  const connectionState: ConnectionStateStub = "connected";
  const isReconnecting = false;

  return {
    connectionState,
    isReconnecting,
    handleManualReconnect,
    checkAndRejoinWorkspace,
  };
}
