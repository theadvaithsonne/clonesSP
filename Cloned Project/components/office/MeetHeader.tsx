'use client';

import { useEffect, useRef, useState } from 'react';
import { PanelRight, Bot, Loader2, Sparkles, Square, Minimize2 } from 'lucide-react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth';
import { useCopilot } from '@/lib/copilot/context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.networkchains.com';

interface MeetHeaderProps {
  roomId: string;
  /** Full LiveKit room name (e.g. "meet-<roomId>"). Needed for the
   *  note-taker start/stop endpoints. */
  roomName: string;
  /** Title from the scheduled meeting (when this room corresponds to
   *  one). Falls back to the generic "Meeting" label. */
  meetingTitle?: string;
  /** ISO string for when the MeetSession started — anchored on the
   *  server so every participant's call-duration timer matches. */
  meetingStartedAt?: string;
  connected: boolean;
  isHost: boolean;
  /** The actual meeting host (scheduled owner / instant-room creator). Only
   *  this person may run/stop the note-taker. Distinct from `isHost`, which is
   *  permissive in instant meetings. */
  isMeetingHost?: boolean;
  recording: boolean;
  recElapsed: number;
  isPipSupported: boolean;
  onOpenPip(): void;
  onLeave(): void;
  sidebarOpen?: boolean;
  onOpenSidebar?(): void;
  unreadChatCount?: number;
}

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Total elapsed time in the meeting. Prefers the server-supplied
 * `meetingStartedAt` so every participant's number is identical;
 * falls back to the local participant's joinedAt for instant rooms
 * the backend hasn't told us about yet (very brief window before the
 * token response lands).
 */
function useCallElapsed(meetingStartedAt?: string): number {
  const room = useRoomContext();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const computeStart = (): number => {
      if (meetingStartedAt) {
        const t = Date.parse(meetingStartedAt);
        if (!Number.isNaN(t)) return t;
      }
      const joined = room?.localParticipant?.joinedAt;
      return joined ? joined.getTime() : Date.now();
    };
    let startedAt = computeStart();
    setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));

    const id = window.setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    // Re-anchor on reconnect so a brief disconnect doesn't reset the
    // timer or leave it stuck on the stale start.
    const onReconnected = () => {
      startedAt = computeStart();
    };
    room?.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      window.clearInterval(id);
      room?.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room, meetingStartedAt]);

  return seconds;
}

export default function MeetHeader({
  roomId,
  roomName,
  meetingTitle,
  meetingStartedAt,
  connected,
  isHost,
  isMeetingHost = false,
  recording,
  recElapsed,
  isPipSupported,
  onOpenPip,
  onLeave,
  sidebarOpen = true,
  onOpenSidebar,
  unreadChatCount = 0,
}: MeetHeaderProps) {
  const minutes = Math.floor(recElapsed / 60);
  const seconds = (recElapsed % 60).toString().padStart(2, '0');

  // LiveKit auto-syncs egress state to every participant. This flips
  // true the moment the host's manual recording (LiveKit egress)
  // starts, and false when it stops — irrespective of the host-only
  // `recording` prop which is local to the host's useRecording hook.
  //
  // Note-taker-bot presence is intentionally NOT a recording trigger:
  // the bot auto-joins every meet from the moment the host arrives,
  // so keying the pill on it kept "Recording" stuck on permanently
  // for everyone. The bot still surfaces as a participant with a
  // "Bot" badge in the People list, which is a more honest indicator
  // of "transcript will be generated" than a pulsing red pill.
  // Subscribe to RoomEvent.RecordingStatusChanged directly. We were
  // using @livekit/components-react's useIsRecording(), but in some
  // sessions it kept returning `true` after egress ended — the fallback
  // event handler here keeps the pill in lockstep with what LiveKit
  // actually broadcasts (Room.isRecording is the source of truth).
  const room = useRoomContext();
  const [liveKitRecording, setLiveKitRecording] = useState(false);
  useEffect(() => {
    if (!room) {
      setLiveKitRecording(false);
      return;
    }
    setLiveKitRecording(!!room.isRecording);
    const onChange = (isRec: boolean) => setLiveKitRecording(!!isRec);
    room.on(RoomEvent.RecordingStatusChanged, onChange);
    return () => {
      room.off(RoomEvent.RecordingStatusChanged, onChange);
    };
  }, [room]);

  // LiveKit's egress takes ~10-17s to actually flip room.isRecording
  // back to false after a stop request. The host already sees their
  // local `recording` state turn false the instant they click Stop,
  // but everyone else (and the host's own pill if it's keyed on
  // liveKitRecording) keeps showing "Recording" for the whole egress
  // finalisation window. We hide the pill optimistically by setting
  // hostStopping when:
  //   (a) Host's local `recording` flips false while LiveKit still
  //       reports recording — covers the host's own view.
  //   (b) Any participant publishes a `meet:recording-stopping` data
  //       channel hint — covers every other viewer (host's client
  //       sends this when stop is clicked, see meet/room page).
  const wasRecordingRef = useRef(recording);
  const [hostStopping, setHostStopping] = useState(false);
  useEffect(() => {
    if (wasRecordingRef.current && !recording && liveKitRecording) {
      setHostStopping(true);
    }
    wasRecordingRef.current = recording;
  }, [recording, liveKitRecording]);

  useEffect(() => {
    if (!room) return;
    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== 'meet-control') return;
      try {
        const text = new TextDecoder().decode(payload);
        const obj = JSON.parse(text);
        if (obj?.type === 'meet:recording-stopping') {
          setHostStopping(true);
        }
      } catch {
        /* malformed payload — ignore */
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  // Drop the "Stopping…" state the moment LiveKit confirms egress ended.
  useEffect(() => {
    if (!liveKitRecording) setHostStopping(false);
  }, [liveKitRecording]);
  // Final safety net — even if LiveKit somehow never fires the false
  // event, hide the pill after a generous timeout so it doesn't get
  // wedged on indefinitely.
  useEffect(() => {
    if (!hostStopping) return;
    const id = window.setTimeout(() => setHostStopping(false), 30_000);
    return () => window.clearTimeout(id);
  }, [hostStopping]);

  const someoneIsRecording = recording || (liveKitRecording && !hostStopping);
  const callElapsed = useCallElapsed(meetingStartedAt);

  // Note-taker is opt-in. Detect bot presence via LiveKit participants
  // so the toggle reflects current state for both the host AND any
  // non-host who joined later (read-only view for them).
  const participants = useParticipants();
  const noteTakerActive = participants.some((p) =>
    (p.identity || '').startsWith('notetaker-'),
  );

  // Host's display name (from the host participant's metadata), used to title
  // the room "<Host>'s Catch Up". Resolves for guests too once the host is in
  // the room; empty until then.
  const hostName = (() => {
    for (const p of participants) {
      try {
        const meta = p.metadata ? JSON.parse(p.metadata) : {};
        if (meta?.isHost || meta?.role === 'host') {
          const n = String(meta.displayName || p.name || '').trim();
          if (n) return n;
        }
      } catch { /* ignore malformed metadata */ }
    }
    return '';
  })();
  // Scheduled meetings keep their explicit title; instant rooms become
  // "<Host>'s Catch Up" (falling back to "Catch Up" before the host is known).
  const displayTitle = meetingTitle || (hostName ? `${hostName}'s Catch Up` : 'Catch Up');
  const [noteTakerLoading, setNoteTakerLoading] = useState(false);

  const callNoteTakerEndpoint = async (action: 'start' | 'stop') => {
    setNoteTakerLoading(true);
    try {
      const tk = getToken();
      const res = await fetch(`${API_URL}/livekit/notetaker/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
        },
        body: JSON.stringify({ roomName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to ${action} note-taker`);
      toast.success(action === 'start' ? 'Note-taker joining…' : 'Note-taker leaving…');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to ${action} note-taker`,
      );
    } finally {
      setNoteTakerLoading(false);
    }
  };

  return (
    // Single row on every viewport. On mobile the status pills collapse to
    // their dots (text is `hidden sm:inline`) and host tools are icon-only, so
    // it never wraps into a second row that would eat video height.
    <div className="flex flex-nowrap items-center justify-between gap-2 border-b border-[#2a2a35] bg-[#111116] px-3 sm:px-4 py-2.5">
      {/* Left — title only. The back-out arrow was removed; users
          leave via the red end-call button in the ControlBar. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-white truncate">
            {displayTitle}
          </span>
          <span className="text-[10px] text-gray-400 truncate hidden sm:block">
            {roomId}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {/* Call duration — total time in the room. Visible on every
            viewport (the previous `hidden xs:flex` gate evaluated as
            `hidden` on mobile because Tailwind has no xs breakpoint
            configured, hiding the timer entirely on phones). */}
        {connected && (
          <span
            className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-gray-300 tabular-nums"
            title="Call duration"
          >
            {formatHMS(callElapsed)}
          </span>
        )}

        {/* Recording indicator — visible to EVERY participant whenever
            LiveKit egress is active (auto-synced via useIsRecording).
            Host additionally sees an elapsed timer next to it. */}
        {someoneIsRecording && (
          <span
            className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] font-semibold text-red-400"
            title="This meeting is being recorded"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            <span className="hidden sm:inline">
              {recording ? `REC ${minutes}:${seconds}` : 'Recording'}
            </span>
          </span>
        )}

        {/* Connection status */}
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
            connected
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-green-400' : 'bg-gray-400 animate-pulse'
            }`}
          />
          <span className="hidden sm:inline">{connected ? 'Connected' : 'Connecting…'}</span>
        </span>

        {/* Host badge */}
        {isHost && (
          <span className="hidden sm:flex items-center rounded-full bg-purple-500/20 px-2.5 py-1 text-[10px] font-medium text-purple-400">
            Host
          </span>
        )}

        {/* Note-taker toggle — meeting-host ONLY (not just isHost, which is
            permissive in instant meetings). Participants never see it, so they
            can neither start nor stop the note-taker. Start dispatches the bot;
            Stop pulls it from the room. */}
        {isMeetingHost && connected && (
          <button
            onClick={() =>
              callNoteTakerEndpoint(noteTakerActive ? 'stop' : 'start')
            }
            disabled={noteTakerLoading}
            className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
              noteTakerActive
                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.1]'
            }`}
            title={
              noteTakerActive
                ? 'Stop note-taker (will finalise transcript & summary)'
                : 'Start note-taker — records & transcribes the meeting'
            }
          >
            {noteTakerLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Bot className="h-3 w-3" />
            )}
            {noteTakerActive ? 'Stop notes' : 'Take notes'}
          </button>
        )}

        {/* Copilot toggle — host-only. Spawns the floating Cluely-style
            AI overlay over the video grid. */}
        {isHost && connected && <CopilotToggle />}

        {/* Picture-in-picture — pops the live video grid into a
            floating browser window so the user can keep the meeting
            visible while switching tabs. Gated on
            document.documentPictureInPicture support (Chromium only
            as of writing; hidden on Safari / Firefox).
            NOTE: the vendored NC copy of this component had this
            button moved to their ControlBar, but Garage's bottom bar
            doesn't own the PiP action here — restoring it in the
            header keeps the feature reachable on every viewport. */}
        {isPipSupported && connected && (
          <button
            onClick={onOpenPip}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600"
            title="Picture-in-picture"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        )}

        {/* Open sidebar button (shown when collapsed) */}
        {!sidebarOpen && (
          <button
            onClick={onOpenSidebar}
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600"
            title="Open panel"
          >
            <PanelRight className="h-4 w-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/** Header toggle for the Cluely-style copilot overlay. Reads/writes
 *  `useCopilot()` from the surrounding CopilotProvider. */
function CopilotToggle() {
  const { status, start, stop } = useCopilot();
  const isLive = status === 'live' || status === 'starting';
  const isStarting = status === 'starting';

  const onClick = () => {
    if (isLive) stop().catch(() => {});
    else start().catch(() => {});
  };

  return (
    <button
      onClick={onClick}
      disabled={isStarting}
      className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
        isLive
          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 ring-1 ring-red-500/40'
          : 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.1]'
      }`}
      title={
        isLive
          ? 'Stop copilot — closes the AI overlay'
          : 'Start copilot — opens the AI overlay with live suggestions'
      }
    >
      {isStarting ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isLive ? (
        <Square className="h-3 w-3" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      {isLive ? 'Stop EarnGPT Live' : 'EarnGPT Live'}
    </button>
  );
}
