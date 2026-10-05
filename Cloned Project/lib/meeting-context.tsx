"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useMeetLiveKit } from "@/app/meet/join/useMeetLiveKit";

export interface MeetConfig {
  serverUrl: string;
  token: string;
  roomName: string;
}

export interface MeetMeta {
  joinCode: string;
  meetTitle: string;
  displayName: string;
  participantId: string;
  affiliateId?: string;
}

interface MeetingContextValue extends ReturnType<typeof useMeetLiveKit> {
  meta: MeetMeta | null;
  isHost: boolean;
  minimized: boolean;
  joinMeeting: (config: MeetConfig, meta: MeetMeta, isHost: boolean) => Promise<void>;
  leaveMeeting: () => Promise<void>;
  minimize: () => void;
  expand: () => void;
}

const MeetingContext = createContext<MeetingContextValue | null>(null);

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeeting must be used within MeetingProvider");
  return ctx;
}

export function MeetingProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<MeetConfig | null>(null);
  const [meta, setMeta] = useState<MeetMeta | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const livekit = useMeetLiveKit(config, isHost);

  // Auto-join once config is set
  useEffect(() => {
    if (config && !livekit.inCall && !livekit.isJoining) {
      livekit.joinCall();
    }
  }, [config, livekit.inCall, livekit.isJoining, livekit.joinCall]);

  const joinMeeting = useCallback(
    async (newConfig: MeetConfig, newMeta: MeetMeta, host: boolean) => {
      setMeta(newMeta);
      setIsHost(host);
      setMinimized(false);
      setConfig(newConfig);
    },
    [],
  );

  const leaveMeeting = useCallback(async () => {
    // Close any open PiP via global helper
    if (typeof window !== "undefined") {
      const w = window as typeof window & { __closeMeetPip?: () => void };
      w.__closeMeetPip?.();
    }
    await livekit.leaveCall();
    setConfig(null);
    setMeta(null);
    setIsHost(false);
    setMinimized(false);
  }, [livekit.leaveCall]);

  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);

  const value = useMemo<MeetingContextValue>(
    () => ({
      ...livekit,
      meta,
      isHost,
      minimized,
      joinMeeting,
      leaveMeeting,
      minimize,
      expand,
    }),
    [livekit, meta, isHost, minimized, joinMeeting, leaveMeeting, minimize, expand],
  );

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>;
}
