"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useMultibandTrackVolume,
  useParticipants,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import type { LocalAudioTrack } from "livekit-client";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  Loader2,
  Copy,
  Check,
  Camera as CameraIcon,
  MessageSquare,
  Users,
  Smile,
  Minimize2,
  CircleDot,
  Square,
  Bot,
  Hand,
  DoorOpen,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";
import { OFFICE_CONFERENCE_ROOM_ID } from "@/lib/chat-markers";
import VideoGrid from "@/components/office/VideoGrid";
import MeetSidebar from "@/components/office/MeetSidebar";
import EmojiReactionOverlay from "@/components/office/EmojiReactionOverlay";
import { useMeetChat } from "@/hooks/office/useMeetChat";
import {
  useEmojiReactions,
  REACTION_EMOJIS,
} from "@/hooks/office/useEmojiReactions";
import { useCallTimer } from "@/hooks/office/useCallTimer";
import { useRecording } from "@/hooks/office/useRecording";
import { useHostControls } from "@/hooks/office/useHostControls";
import { useVirtualBackground } from "@/hooks/office/useVirtualBackground";
import { useAccessControl } from "@/hooks/office/useAccessControl";
import type { AccessPolicy } from "@/hooks/office/useAccessControl";
import { useConferenceRecordings } from "@/hooks/office/useConferenceRecordings";
import { useHandRaise } from "@/hooks/office/useHandRaise";
import { useMemoRecorder } from "@/hooks/office/useMemoRecorder";
import { useVoiceMemos } from "@/hooks/office/useVoiceMemos";
import KickDialog from "@/components/office/KickDialog";
import MeetHeader from "@/components/office/MeetHeader";
import VirtualBackgroundPicker from "@/components/office/VirtualBackgroundPicker";
import AccessControlModal from "@/components/office/AccessControlModal";
import RecordingsPanel from "@/components/office/RecordingsPanel";
import MemosPanel from "@/components/office/MemosPanel";
import DeviceMenu from "@/components/office/DeviceMenu";
import { CopilotProvider } from "@/lib/copilot/context";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Standalone, full-page conference call.
//
// Architecture mirrors NC's /meet/room/[roomId] surface:
//   1. Pre-join lobby (camera preview + mic test, name confirmation).
//   2. On Join → emit `workspace:move-to-space` with the synthetic
//      spaceId `hq-room:<orgId>:<roomId>`; the Garage backend mints a
//      LiveKit token + URL and replies via `livekit:join-call`.
//   3. Mount <LiveKitRoom token={...} serverUrl={...}> and render NC's
//      VideoGrid inside (along with a controls bar + leave button).
//
// What's deliberately NOT in this skeleton (lands in stage 3):
//   - MeetSidebar (chat + people tabs)
//   - EmojiReactionOverlay
//   - Recording start/stop (NC's useRecording hits /meet/recording/*
//     which Garage doesn't expose; needs backend alias before wiring)
//   - Host controls (kick / mute) — same backend-dependency reason
//   - Virtual background picker
//
// Each of those gets its own commit so this one stays reviewable.

// Backend payload shape (from src/realtime/socket.ts on garagenew-backend).
// The same backend emits TWO event names with this same shape, depending on
// whether the joining user is the first in the room:
//
//   livekit:init-call  — you're the first one (emit ~line 2925)
//   livekit:join-call  — someone else is already there (emit ~line 2882)
//
// Subscribe to both; otherwise the very first person to open the URL hangs
// on "Connecting…" forever. Field is `serverUrl`, not `livekitServerUrl`.
interface JoinPayload {
  token: string;
  serverUrl: string;
  roomName: string;
  channel?: string;
  meetingType?: string;
  isOwner?: boolean;
  // Access-control policy — server-side truth for who can unmute /
  // present without asking. First joiner may see a permissive default
  // (host hasn't opened the pre-join modal yet); subsequent joiners
  // see whatever the host committed. Both flags default to true.
  policy?: { allowUnmute: boolean; allowPresent: boolean };
}

export default function ConferenceCallStandalone({
  orgId,
  roomId,
}: {
  orgId: string;
  roomId: string;
}) {
  const router = useRouter();
  const me = useMemo(() => getUserIdFromToken() || "", []);
  const [phase, setPhase] = useState<"prejoin" | "joining" | "in-call" | "error">(
    "prejoin",
  );
  const [error, setError] = useState<string>("");
  const [roomDisplayName, setRoomDisplayName] = useState("Conference Room");
  const [joinPayload, setJoinPayload] = useState<JoinPayload | null>(null);
  const [copied, setCopied] = useState(false);

  // Auth gate. Share-link recipients without a session land on /login
  // with a next param that bounces back here after auth.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!getToken()) {
      router.replace(
        `/login?next=${encodeURIComponent(
          `/meet/conference/${orgId}/${roomId}`,
        )}`,
      );
    }
  }, [orgId, roomId, router]);

  // Fetch room name for the header (best-effort; falls back silently).
  useEffect(() => {
    // The office default room has no ConferenceRoom record to look up.
    if (roomId === OFFICE_CONFERENCE_ROOM_ID) {
      setRoomDisplayName("Conference Room");
      return;
    }
    if (!getToken()) return;
    api<{ success: boolean; rooms: Array<{ _id: string; name: string }> }>(
      `/conference-rooms?orgId=${orgId}`,
      {},
      getToken()!,
    )
      .then((res) => {
        const found = res.rooms?.find((r) => r._id === roomId);
        if (found?.name) setRoomDisplayName(found.name);
      })
      .catch(() => {});
  }, [orgId, roomId]);

  // ── Join handoff via the existing Garage socket flow ───────────
  // Two-step handshake (mirrors the dashboard WorkspaceClient at
  // app/(dashboard)/workspace/WorkspaceClient.tsx ~line 2738):
  //
  //   1. Emit `workspace:join` — the realtime backend creates the
  //      WorkspaceUser record (a getWorkspaceUser hit returns null
  //      without this; the move-to-space handler silently no-ops on a
  //      null user → frozen on "Connecting…"). Wait for
  //      `workspace:join-confirmed`.
  //   2. Emit `workspace:move-to-space` with the hq-room spaceId. The
  //      backend mints a LiveKit token + emits init-call (first
  //      joiner) or join-call (joining an active room) with the
  //      payload we need to mount <LiveKitRoom>.
  //
  // Skipping step 1 was the original bug — share-link recipients land
  // on this page WITHOUT visiting /workspace first, so they never get
  // registered as workspace users. Symptoms: the backend logs
  //   [WORKSPACE] User <id> attempting to move to space: hq-room:…
  // and then nothing — no booking-gate log, no LiveKit init-call, no
  // join-error. Confirmed against prod logs.
  // Listener refs — captured so the teardown in handleLeave can strip
  // them off the shared socket. Prior versions left them attached and
  // that was the *actual* root cause of the intermittent "Connecting
  // to <room>…" hang: every remount added a new join-confirmed
  // listener; when the event finally fired, N handlers emitted
  // workspace:move-to-space in the same tick. The first was accepted
  // and each subsequent one hit the multi-device gate on the backend
  // ('already on web') and got replied to with call-answered-elsewhere
  // — which we weren't listening for either. Result: init-call/join-
  // call never fires again, page hangs. Kill both problems here.
  const listenerHandleRef = useRef<null | {
    off: () => void;
    clearTimeout: () => void;
  }>(null);
  const teardownListeners = useCallback(() => {
    listenerHandleRef.current?.off();
    listenerHandleRef.current?.clearTimeout();
    listenerHandleRef.current = null;
  }, []);

  const handleJoin = useCallback(() => {
    if (!getToken()) return;
    // Guard against a stale prior attempt still holding listeners
    // (e.g. user hit "Try again" from the error screen — same tab,
    // same shared socket).
    teardownListeners();
    setPhase("joining");
    setError("");
    const socket = connectSocket();

    // The office default room joins the legacy org-wide space so members can
    // meet without a founder-created named room. Server-side booking access
    // still gates who may enter.
    const spaceId =
      roomId === OFFICE_CONFERENCE_ROOM_ID
        ? `hq-room:${orgId}`
        : `hq-room:${orgId}:${roomId}`;
    const onJoinCall = (payload: JoinPayload) => {
      if (!payload?.token || !payload?.serverUrl) return;
      teardownListeners();
      setJoinPayload(payload);
      setPhase("in-call");
    };
    const onJoinError = (data: { error?: string }) => {
      teardownListeners();
      setError(data?.error || "Couldn't join the room");
      setPhase("error");
    };
    // Multi-device gate. The backend rejects a join when the caller's
    // userId already has a live call on another device / tab and emits
    // this event on the *new* socket. Without a handler the page just
    // sits on "Connecting…" forever. Surface it as a proper error so
    // the user knows to close the other tab.
    const onCallAnsweredElsewhere = (data: { answeredOn?: string }) => {
      teardownListeners();
      setError(
        `You're already in this meeting on ${data?.answeredOn || "another device"}. Close it there and try again.`,
      );
      setPhase("error");
    };
    const onJoinConfirmed = () => {
      // Workspace user record now exists on the server. Safe to ask
      // for the conference room — the move-to-space handler will see
      // the user and enter the hq-room branch.
      socket.emit("workspace:move-to-space", { spaceId });
    };

    // Subscribe to BOTH init-call and join-call (backend emits init-
    // call for the first joiner and join-call for everyone after).
    // socket.io registers duplicates by default — the teardown above
    // + the guard at the top of handleJoin keep this idempotent.
    socket.on("livekit:init-call", onJoinCall);
    socket.on("livekit:join-call", onJoinCall);
    socket.on("livekit:join-error", onJoinError);
    socket.on("livekit:call-answered-elsewhere", onCallAnsweredElsewhere);
    socket.on("workspace:join-confirmed", onJoinConfirmed);

    // Safety net: if none of the above fire within 20s, escalate to
    // the error screen so the user can retry instead of staring at
    // "Connecting…" indefinitely. 20s is generous enough that a slow
    // network / cold LiveKit worker still resolves normally.
    const joinTimeout = setTimeout(() => {
      teardownListeners();
      setError(
        "Timed out waiting for the meeting to start. Try again.",
      );
      setPhase("error");
    }, 20_000);

    listenerHandleRef.current = {
      off: () => {
        socket.off("livekit:init-call", onJoinCall);
        socket.off("livekit:join-call", onJoinCall);
        socket.off("livekit:join-error", onJoinError);
        socket.off(
          "livekit:call-answered-elsewhere",
          onCallAnsweredElsewhere,
        );
        socket.off("workspace:join-confirmed", onJoinConfirmed);
      },
      clearTimeout: () => window.clearTimeout(joinTimeout),
    };

    // Two-step handshake. join-confirmed fires the move-to-space.
    socket.emit("workspace:join");
  }, [orgId, roomId, teardownListeners]);

  // Component-unmount safety: if the user navigates away mid-connect,
  // strip any listeners we registered so the next mount starts clean.
  useEffect(() => teardownListeners, [teardownListeners]);

  const handleLeave = useCallback(() => {
    setPhase("prejoin");
    setJoinPayload(null);
    router.push("/workspace");
  }, [router]);

  const handleCopyLink = useCallback(async () => {
    try {
      const url =
        typeof window !== "undefined"
          ? window.location.href
          : `/meet/conference/${orgId}/${roomId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Share link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  }, [orgId, roomId]);

  // ── Render ─────────────────────────────────────────────────────
  if (phase === "prejoin") {
    return (
      <PreJoinLobby
        roomName={roomDisplayName}
        onJoin={handleJoin}
        onCopyLink={handleCopyLink}
        copied={copied}
      />
    );
  }

  if (phase === "joining") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0d] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        <p className="text-sm text-white/60">Connecting to {roomDisplayName}…</p>
      </div>
    );
  }

  if (phase === "error" || !joinPayload) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0d] text-white px-6 text-center">
        <p className="text-lg font-semibold">Couldn't join the room</p>
        <p className="text-sm text-white/60 max-w-md">
          {error || "An unknown error occurred. Try again."}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setPhase("prejoin")}
            className="rounded-full bg-white/10 hover:bg-white/20 px-4 py-2 text-sm transition"
          >
            Back to lobby
          </button>
          <button
            onClick={() => router.push("/workspace")}
            className="rounded-full bg-amber-500 hover:bg-amber-600 px-4 py-2 text-sm text-black font-semibold transition"
          >
            Go to workspace
          </button>
        </div>
      </div>
    );
  }

  // In-call: wrap NC's VideoGrid in a LiveKitRoom so it can use
  // useRoomContext + useParticipants under the hood. The in-call
  // chrome (header / sidebar / reactions) lives in InCallView —
  // it needs to run UNDER LiveKitRoom so useMeetChat and
  // useEmojiReactions can read the room context.
  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0a0d] text-white">
      <LiveKitRoom
        token={joinPayload.token}
        serverUrl={joinPayload.serverUrl}
        connect
        audio={true}
        video={true}
        onDisconnected={handleLeave}
        className="contents"
      >
        <InCallView
          roomDisplayName={roomDisplayName}
          roomName={joinPayload.roomName}
          conferenceRoomId={roomId}
          isHost={!!joinPayload.isOwner}
          initialPolicy={joinPayload.policy}
          localUserId={me}
          onLeave={handleLeave}
          onCopyLink={handleCopyLink}
          copied={copied}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

// In-call chrome — runs inside <LiveKitRoom> so the chat + reactions
// hooks (which use useRoomContext under the hood) have a Room to bind
// to. Without this split the hooks would throw "must be used within a
// LiveKitRoom" at mount.
function InCallView({
  roomDisplayName,
  roomName,
  conferenceRoomId,
  isHost,
  initialPolicy,
  localUserId,
  onLeave,
  onCopyLink,
  copied,
}: {
  roomDisplayName: string;
  // The LiveKit room name (from joinPayload.roomName) — needed by
  // useRecording to hit /livekit/recording/start with the right key.
  // Distinct from `roomDisplayName` which is the human label.
  roomName: string;
  // The Mongo ConferenceRoom._id from the URL. Used to fetch the
  // recordings list — the backend groups by hq-room:<orgId>:<roomId>
  // and this half of the tuple is not derivable from roomName.
  conferenceRoomId: string;
  // Server-attested owner flag from the join payload. Only owners
  // see kick controls in the People list.
  isHost: boolean;
  // Server-side snapshot of the access-control policy at join time.
  // Non-hosts render mic/present buttons gated on this. Undefined means
  // no policy has been set — treat as fully permissive.
  initialPolicy?: AccessPolicy;
  // Local user's identity — needed to filter incoming permission
  // grant/deny events to just our own request.
  localUserId: string;
  onLeave: () => void;
  onCopyLink: () => void;
  copied: boolean;
}) {
  // Call timer — starts as soon as InCallView mounts (i.e. LiveKitRoom
  // has connected). Renders 'mm:ss' or 'hh:mm:ss' depending on length.
  const { formatted: callDuration } = useCallTimer(true);

  // Host controls — kick + mute via NC's vendored useHostControls hook
  // (patched to hit Garage's /livekit/kick + /livekit/mute in stage 4b).
  // Only wired when isHost is true; non-owners get the same MeetSidebar
  // but without kick / mute affordances.
  const { kickParticipant, kicking, muteParticipant } = useHostControls();
  const [kickTarget, setKickTarget] = useState<
    { identity: string; name: string } | null
  >(null);

  const handleKick = useCallback(
    (identity: string, name: string) => {
      setKickTarget({ identity, name });
    },
    [],
  );
  const confirmKick = useCallback(async () => {
    if (!kickTarget) return;
    try {
      await kickParticipant(roomName, kickTarget.identity);
      toast.success(`${kickTarget.name} removed from call`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove participant");
    } finally {
      setKickTarget(null);
    }
  }, [kickTarget, kickParticipant, roomName]);
  const cancelKick = useCallback(() => setKickTarget(null), []);

  // Force-mute a participant's microphone. Fired inline from the
  // People-list row (no confirmation modal — muting is less
  // destructive than removing). Sidebar looks up the trackSid from
  // the participant's mic publication at click time and passes it
  // through, so we just relay to the backend.
  const handleMute = useCallback(
    async (identity: string, trackSid: string, name: string) => {
      try {
        await muteParticipant(roomName, identity, trackSid);
        toast.success(`${name} muted`);
      } catch (err: any) {
        toast.error(err?.message || "Failed to mute participant");
      }
    },
    [muteParticipant, roomName],
  );

  // Access control — policy + participant permission requests. The
  // hook owns the room-level policy state, the local participant's
  // outbound request (spinner on the mic / share button), and — for
  // hosts — the queue of inbound requests. Backend endpoints in
  // src/routes/livekitRecording.ts (`/livekit/policy`, `/livekit/
  // permission/*`) and socket events in socket.ts drive it.
  const {
    policy,
    setRoomPolicy,
    pending: pendingRequests,
    myPending,
    requestPermission,
    grantPermission,
    denyPermission,
  } = useAccessControl({
    roomName,
    isHost,
    initialPolicy,
    localUserId,
  });

  // Host-only pre-join modal for the FIRST joiner. If the host reloads
  // mid-meeting, the socket payload already carries the policy they
  // set earlier — skip the modal. If they joined fresh and no policy
  // exists yet, show the modal so they can lock the room down before
  // anyone else joins. The "Skip" button just closes without writing —
  // the fully-permissive default holds.
  const [policyModalOpen, setPolicyModalOpen] = useState<boolean>(
    isHost && !initialPolicy,
  );
  const handleConfirmPolicy = useCallback(
    async (next: AccessPolicy) => {
      try {
        await setRoomPolicy(next);
        toast.success("Meeting access set");
      } catch (err: any) {
        toast.error(err?.message || "Couldn't save access settings");
        throw err;
      } finally {
        setPolicyModalOpen(false);
      }
    },
    [setRoomPolicy],
  );

  // Toast the host when a new request arrives. Fire only on the
  // moment of arrival (compare pending queue length delta).
  const prevPendingCount = useRef<number>(0);
  useEffect(() => {
    if (!isHost) return;
    if (pendingRequests.length > prevPendingCount.current) {
      const latest = pendingRequests[pendingRequests.length - 1];
      const what =
        latest.kind === "both"
          ? "unmute + present"
          : latest.kind === "unmute"
            ? "unmute"
            : "present";
      toast.message(`${latest.name} wants to ${what}`, {
        action: {
          label: "See",
          onClick: () => {
            setSidebarTab("people");
            setSidebarOpen(true);
          },
        },
      });
    }
    prevPendingCount.current = pendingRequests.length;
  }, [pendingRequests, isHost]);

  // Handler that the gated mic / screen-share buttons invoke when the
  // action is denied by policy. Sends the request to the backend and
  // shows a "waiting for host" toast.
  const handleRequestPermission = useCallback(
    async (kind: "unmute" | "present") => {
      try {
        await requestPermission(kind);
        toast.message("Request sent to host");
      } catch (err: any) {
        toast.error(err?.message || "Couldn't send request");
      }
    },
    [requestPermission],
  );

  // Host actions from the People tab.
  const handleGrant = useCallback(
    async (userId: string, kind: "unmute" | "present" | "both") => {
      try {
        await grantPermission(userId, kind);
        toast.success("Permission granted");
      } catch (err: any) {
        toast.error(err?.message || "Couldn't grant permission");
      }
    },
    [grantPermission],
  );
  const handleDeny = useCallback(
    async (userId: string) => {
      try {
        await denyPermission(userId);
      } catch (err: any) {
        toast.error(err?.message || "Couldn't deny request");
      }
    },
    [denyPermission],
  );

  // Recordings — one hook per room. Populates the sidebar tab; refreshes
  // when a recording stops so the newly-uploaded file appears without
  // manual action.
  const {
    recordings,
    loading: recordingsLoading,
    error: recordingsError,
    refresh: refreshRecordings,
    remove: removeRecording,
  } = useConferenceRecordings({ roomId: conferenceRoomId });

  // Hand-raise. Ephemeral — broadcast via LiveKit DataChannel, no
  // backend involvement. Host sees the raised badge in the People
  // tab and can force-lower.
  const {
    raisedIds,
    myHand,
    toggle: toggleHand,
    lower: lowerHand,
  } = useHandRaise();

  // Voice memos — records the local user's mic to a Blob, uploads
  // via /voice-memos (backend proxies to NC's voice-agent for
  // transcription + title generation). List is scoped to this room
  // via meeting_context.roomId. Recorder state + list state live at
  // InCallView so the MemosPanel below is stateless.
  const memoRecorder = useMemoRecorder();
  const {
    memos,
    loading: memosLoading,
    error: memosError,
    uploading: memoUploading,
    refresh: refreshMemos,
    upload: uploadMemo,
    remove: removeMemo,
  } = useVoiceMemos({ roomId: conferenceRoomId });
  const memoParticipants = useParticipants();
  const handleSaveMemo = useCallback(
    async (title: string) => {
      if (!memoRecorder.blob) return;
      const participants = memoParticipants.map((p) => ({
        identity: p.identity,
        name: p.name || undefined,
      }));
      await uploadMemo({
        blob: memoRecorder.blob,
        title: title || undefined,
        roomName: roomDisplayName,
        participants,
      });
      memoRecorder.reset();
    },
    [memoRecorder, memoParticipants, uploadMemo, roomDisplayName],
  );

  // End meeting for everyone. Host-only. Backend calls LiveKit
  // deleteRoom which force-disconnects every participant and stops
  // any active egress via the room_finished webhook. We confirm
  // client-side (no confirm modal component to reuse right now; a
  // window.confirm is fine for a destructive host action).
  const [endingMeeting, setEndingMeeting] = useState(false);
  const handleEndMeeting = useCallback(async () => {
    if (endingMeeting) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "End the meeting for everyone? Recording (if any) will stop.",
      )
    ) {
      return;
    }
    setEndingMeeting(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/livekit/end-meeting`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roomName }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to end meeting");
      }
      toast.success("Meeting ended");
      // Our own onDisconnected handler will fire when LiveKit
      // notices the room is gone. Kick it manually as a fallback.
      onLeave();
    } catch (err: any) {
      toast.error(err?.message || "Couldn't end meeting");
    } finally {
      setEndingMeeting(false);
    }
  }, [endingMeeting, roomName, onLeave]);

  // Virtual background — blur or custom image, applied to the local
  // camera track before publish. Pure client (BodyPix segmentation).
  const {
    backgroundType,
    backgroundImage,
    isProcessing: bgProcessing,
    setBlur,
    setImage,
    removeBackground,
  } = useVirtualBackground();
  const [bgPickerOpen, setBgPickerOpen] = useState(false);

  // Recording — lifted up so both the vendored MeetHeader's recording
  // pill and the bottom-bar RecordingButton read the same state. If
  // the hook were called in both places we'd get two independent
  // useState instances that never sync.
  const {
    recording,
    start: startRec,
    stop: stopRec,
    error: recError,
  } = useRecording(roomName);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  useEffect(() => {
    if (!recording) {
      setRecElapsed(0);
      return;
    }
    setRecElapsed(0);
    const t = setInterval(() => setRecElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => {
    if (recError) toast.error(recError);
  }, [recError]);
  const handleRecordStart = useCallback(async () => {
    setRecordingLoading(true);
    try {
      await startRec();
    } finally {
      setRecordingLoading(false);
    }
  }, [startRec]);
  const handleRecordStop = useCallback(async () => {
    setRecordingLoading(true);
    try {
      await stopRec();
    } finally {
      setRecordingLoading(false);
    }
  }, [stopRec]);

  // PiP — lifted up so MeetHeader.onOpenPip and the bottom-bar PiP
  // button drive the same window. Chrome's Document PiP API is
  // feature-detected; unsupported browsers get a disabled button.
  const [pipSupported, setPipSupported] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const pipWinRef = useRef<Window | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPipSupported("documentPictureInPicture" in window);
  }, []);
  const handleOpenPip = useCallback(async () => {
    if (!pipSupported || pipOpen) return;
    try {
      const w: Window = await (
        window as any
      ).documentPictureInPicture.requestWindow({ width: 380, height: 260 });
      const style = w.document.createElement("style");
      style.textContent = `
        html, body { margin: 0; height: 100%; background: #0a0a0d; color: #fff;
          font-family: system-ui, sans-serif; }
        .pip-root { display: flex; flex-direction: column; height: 100%; }
        .pip-header { display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .pip-header-dot { width: 8px; height: 8px; border-radius: 999px;
          background: #34d399; }
        .pip-header-label { font-size: 12px; font-weight: 600;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pip-grid { flex: 1; display: grid; gap: 4px; padding: 4px;
          overflow: hidden; grid-auto-rows: 1fr; }
        .pip-tile { position: relative; overflow: hidden; border-radius: 8px;
          background: #15151b; display: flex; align-items: center;
          justify-content: center; }
        .pip-tile video { width: 100%; height: 100%; object-fit: cover; }
        .pip-tile-fallback { width: 36px; height: 36px; border-radius: 999px;
          background: #2a2a35; display: flex; align-items: center;
          justify-content: center; font-size: 14px; font-weight: 600; }
        .pip-tile-name { position: absolute; left: 6px; bottom: 6px;
          background: rgba(0,0,0,0.55); padding: 2px 6px; border-radius: 4px;
          font-size: 10px; max-width: calc(100% - 12px);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pip-empty { flex: 1; display: flex; align-items: center;
          justify-content: center; font-size: 12px; color: #9BA1A6; }
      `;
      w.document.head.appendChild(style);
      w.document.title = "Conference — Garage";
      w.addEventListener("pagehide", () => {
        pipWinRef.current = null;
        setPipWin(null);
        setPipOpen(false);
      });
      pipWinRef.current = w;
      setPipWin(w);
      setPipOpen(true);
    } catch (err) {
      console.warn("[ConferenceCall] Failed to open PiP:", err);
      toast.error("Couldn't open picture-in-picture window");
    }
  }, [pipOpen, pipSupported]);
  const handleClosePip = useCallback(() => {
    pipWinRef.current?.close();
    pipWinRef.current = null;
    setPipWin(null);
    setPipOpen(false);
  }, []);
  // Chat — DataChannel-backed, lives across the LiveKit room.
  // unreadCount drives the header badge; markChatHidden / clearUnread
  // is wired by the sidebar so opening the chat tab clears the count.
  const {
    chatMessages,
    sendMessage,
    isSending,
    unreadCount,
    clearUnread,
    markChatHidden,
  } = useMeetChat();

  // Emoji reactions — fly-in overlay on top of the video grid,
  // broadcast via DataChannel.
  const { reactions, sendReaction } = useEmojiReactions();

  // Sidebar — closed by default on narrow viewports.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const [sidebarTab, setSidebarTab] = useState<"people" | "chat" | "memo" | "recordings" | "memos">(
    "people",
  );

  // Emoji picker — opens inline above the smile button.
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleOpenChat = useCallback(() => {
    setSidebarTab("chat");
    setSidebarOpen(true);
    clearUnread();
  }, [clearUnread]);

  const handleOpenPeople = useCallback(() => {
    setSidebarTab("people");
    setSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
    markChatHidden();
  }, [markChatHidden]);

  return (
    <CopilotProvider>
      {/* Header — vendored NC MeetHeader now. Renders the meeting
          title, server-anchored call duration, recording pill (via
          useIsRecording), connection status, host badge, note-taker
          toggle, EarnGPT Copilot toggle (stubbed to no-op —
          CopilotProvider is a shim), and the sidebar-open button
          with unread-chat badge. onLeave / onOpenPip are wired to
          the lifted state above.
          Copy-link is a small extra button rendered alongside since
          NC's header doesn't carry it — the wrapper below composes. */}
      <div className="flex items-stretch border-b border-[#2a2a35] bg-[#111116]">
        <div className="flex-1 min-w-0">
          <MeetHeader
            roomId={roomName}
            roomName={roomName}
            meetingTitle={roomDisplayName}
            connected={true}
            isHost={isHost}
            isMeetingHost={isHost}
            recording={recording}
            recElapsed={recElapsed}
            isPipSupported={pipSupported}
            onOpenPip={pipOpen ? handleClosePip : handleOpenPip}
            onLeave={onLeave}
            sidebarOpen={sidebarOpen}
            onOpenSidebar={handleOpenPeople}
            unreadChatCount={unreadCount}
          />
        </div>
        {/* Copy-link side button removed — moved into the bottom
            control bar so meeting actions live in one place. */}
      </div>

      {/* Body — video area + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Video grid (NC component) */}
          <div className="relative flex-1 overflow-hidden p-2 sm:p-3">
            <VideoGrid
              isHost={false}
              onKickParticipant={() => {}}
              onMuteParticipant={() => {}}
              isBackgroundProcessing={false}
            />
            {/* Emoji reactions float over the video grid */}
            <EmojiReactionOverlay reactions={reactions} />
          </div>

          {/* Bottom control bar. items-end so every button (with or
              without a label underneath) aligns cleanly at the same
              bottom edge — matches NC's ControlBar layout. */}
          <div className="relative flex items-end justify-center gap-3 border-t border-white/[0.06] px-4 py-3">
            {/* Emoji picker — appears above the smile button when open */}
            {pickerOpen && (
              <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-[#15151b] border border-white/[0.08] px-3 py-2 shadow-xl">
                {REACTION_EMOJIS.map((reaction) => (
                  <button
                    key={reaction.key}
                    type="button"
                    onClick={() => {
                      // Wire payload is the literal emoji glyph, not the key —
                      // the overlay renders {r.emoji} directly, and the hook's
                      // onMessage handler reads data.emoji 1:1. Sending key
                      // ('thumbsup') would make 'thumbsup' fly across the
                      // video grid instead of 👍.
                      sendReaction(reaction.char);
                      setPickerOpen(false);
                    }}
                    className="text-xl hover:scale-125 transition-transform"
                    title={`Send ${reaction.label}`}
                  >
                    {reaction.char}
                  </button>
                ))}
              </div>
            )}
            {/* Mic / Camera / Screen-share — LiveKit's TrackToggle
                drives setMicrophoneEnabled / setCameraEnabled
                under the hood, so the buttons stay in sync with
                whatever state the room actually has (including the
                room kicking us off camera for permissions etc). */}
            {/* Mic + device picker chevron. Grouped in a flex so the
                chevron sits flush against the toggle like NC. Wrapper
                also owns the NC-style text label underneath. */}
            <Labeled label="Mic">
              <div className="flex items-center gap-1">
                <ControlIconToggle
                  source={Track.Source.Microphone}
                  title={
                    !isHost && !policy.allowUnmute
                      ? myPending
                        ? "Waiting for host approval…"
                        : "Ask host to unmute"
                      : "Mute / unmute"
                  }
                  OnIcon={<Mic className="h-5 w-5 -translate-y-1" />}
                  OffIcon={<MicOff className="h-5 w-5" />}
                  locked={!isHost && !policy.allowUnmute}
                  pending={myPending === "unmute" || myPending === "both"}
                  onLockedClick={() => handleRequestPermission("unmute")}
                  activeOverlay={<LocalMicLevelBars />}
                />
                <DeviceMenu kind="audioinput" ariaLabel="Choose microphone" />
              </div>
            </Labeled>
            <Labeled label="Camera">
              <div className="flex items-center gap-1">
                <ControlIconToggle
                  source={Track.Source.Camera}
                  title="Camera on / off"
                  OnIcon={<Video className="h-5 w-5" />}
                  OffIcon={<VideoOff className="h-5 w-5" />}
                />
                <DeviceMenu kind="videoinput" ariaLabel="Choose camera" />
              </div>
            </Labeled>
            <Labeled label="Share">
              <ControlIconToggle
                source={Track.Source.ScreenShare}
                title={
                  !isHost && !policy.allowPresent
                    ? myPending
                      ? "Waiting for host approval…"
                      : "Ask host to present"
                    : "Share screen / stop sharing"
                }
                OnIcon={<ScreenShareOff className="h-5 w-5" />}
                OffIcon={<ScreenShare className="h-5 w-5" />}
                locked={!isHost && !policy.allowPresent}
                pending={myPending === "present" || myPending === "both"}
                onLockedClick={() => handleRequestPermission("present")}
                highlightWhenActive
              />
            </Labeled>
            {/* Virtual background picker — opens above the button. The
                actual segmentation happens in useVirtualBackground
                (BodyPix, pure client-side). backgroundType stays
                'blur' / 'image' / 'none' across the picker's open/close
                so the user sees which option is currently active. */}
            <Labeled label="Effects">
              <div className="relative">
                {bgPickerOpen && (
                  <div className="absolute bottom-[62px] left-1/2 -translate-x-1/2 min-w-[240px] rounded-2xl bg-[#15151b] border border-white/[0.08] p-3 shadow-xl">
                    <VirtualBackgroundPicker
                      backgroundType={backgroundType}
                      backgroundImage={backgroundImage}
                      isProcessing={bgProcessing}
                      onSetBlur={setBlur}
                      onSetImage={setImage}
                      onRemove={removeBackground}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setBgPickerOpen((v) => !v)}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full transition",
                    bgPickerOpen || backgroundType !== "none"
                      ? "bg-amber-500 text-black"
                      : "bg-white/[0.10] hover:bg-white/[0.16] text-white",
                  )}
                  title="Virtual background"
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </Labeled>
            {/* Picture-in-picture — pops the video grid into a
                floating browser window. Gated on Chromium support.
                Shares state with the header PiP button so clicking
                either one flips both indicators. */}
            {pipSupported && (
              <Labeled label="Mini">
                <button
                  type="button"
                  onClick={pipOpen ? handleClosePip : handleOpenPip}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full transition",
                    pipOpen
                      ? "bg-amber-500 text-black"
                      : "bg-white/[0.10] hover:bg-white/[0.16] text-white",
                  )}
                  title={pipOpen ? "Exit picture-in-picture" : "Picture-in-picture"}
                >
                  <Minimize2 className="h-5 w-5" />
                </button>
              </Labeled>
            )}
            {/* Recording start/stop button. State + handlers are
                lifted to InCallView so MeetHeader's recording pill
                stays in sync. */}
            <Labeled label={recording ? "Stop" : "Record"}>
              <button
                type="button"
                onClick={recording ? handleRecordStop : handleRecordStart}
                disabled={recordingLoading}
                title={recording ? "Stop recording" : "Start recording"}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition",
                  recording
                    ? "bg-red-500/90 hover:bg-red-600 text-white"
                    : "bg-white/[0.10] hover:bg-white/[0.16] text-white",
                  recordingLoading && "opacity-50",
                )}
              >
                {recordingLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : recording ? (
                  <Square className="h-4 w-4 fill-current" />
                ) : (
                  <CircleDot className="h-5 w-5" />
                )}
              </button>
            </Labeled>
            <Labeled label="React">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition",
                  pickerOpen
                    ? "bg-amber-500 text-black"
                    : "bg-white/[0.10] hover:bg-white/[0.16] text-white",
                )}
                title="Send a reaction"
              >
                <Smile className="h-5 w-5" />
              </button>
            </Labeled>
            {/* Raise hand — ephemeral, broadcast via DataChannel.
                Amber-filled when raised. Everyone in the room sees a
                ✋ badge appear next to the raiser's name in the People
                tab; host can force-lower from there. */}
            <Labeled label={myHand ? "Lower" : "Raise"}>
              <button
                type="button"
                onClick={toggleHand}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition",
                  myHand
                    ? "bg-amber-500 text-black"
                    : "bg-white/[0.10] hover:bg-white/[0.16] text-white",
                )}
                title={myHand ? "Lower hand" : "Raise hand"}
              >
                <Hand className="h-5 w-5" />
              </button>
            </Labeled>
            {/* Copy invite link — used to sit next to the header as a
                side button; moved into the control bar so it lives
                where users expect meeting actions. */}
            <Labeled label="Invite">
              <button
                type="button"
                onClick={onCopyLink}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.10] hover:bg-white/[0.16] text-white transition"
              title={copied ? "Copied!" : "Copy invite link"}
            >
                {copied ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </Labeled>
            {/* End meeting — host-only destructive action. Backend
                POST /livekit/end-meeting calls LiveKit deleteRoom
                which force-disconnects everyone and stops the egress
                via the room_finished webhook. window.confirm gate
                inside handleEndMeeting; no modal component reused. */}
            {isHost && (
              <Labeled label="End meeting">
                <button
                  type="button"
                  onClick={handleEndMeeting}
                  disabled={endingMeeting}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-300 transition",
                    endingMeeting && "opacity-60",
                  )}
                  title="End meeting for everyone"
                >
                  {endingMeeting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <DoorOpen className="h-5 w-5" />
                  )}
                </button>
              </Labeled>
            )}
            <Labeled label="Leave">
              <button
                type="button"
                onClick={onLeave}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white transition"
                title="Leave"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </Labeled>
          </div>
        </div>

        {/* Sidebar — chat + people (memo tab disabled, see Stage 1 notes) */}
        <MeetSidebar
          isOpen={sidebarOpen}
          onClose={handleCloseSidebar}
          isHost={isHost}
          onKick={isHost ? handleKick : undefined}
          onMute={isHost ? handleMute : undefined}
          pendingRequests={isHost ? pendingRequests : []}
          onGrantPermission={isHost ? handleGrant : undefined}
          onDenyPermission={isHost ? handleDeny : undefined}
          raisedHands={raisedIds}
          onLowerHand={isHost ? lowerHand : undefined}
          accessPolicy={isHost ? policy : undefined}
          onSetAccessPolicy={
            isHost
              ? async (next) => {
                  try {
                    await setRoomPolicy(next);
                  } catch (err: any) {
                    toast.error(err?.message || "Couldn't update policy");
                    throw err;
                  }
                }
              : undefined
          }
          recordingsSlot={
            <RecordingsPanel
              recordings={recordings}
              loading={recordingsLoading}
              error={recordingsError}
              onRefresh={refreshRecordings}
              onDelete={removeRecording}
            />
          }
          memosSlot={
            <MemosPanel
              memos={memos}
              loading={memosLoading}
              error={memosError}
              uploading={memoUploading}
              onRefresh={refreshMemos}
              onDelete={removeMemo}
              recorderState={memoRecorder.state}
              elapsed={memoRecorder.elapsed}
              recorderError={memoRecorder.error}
              onStart={memoRecorder.start}
              onPause={memoRecorder.pause}
              onResume={memoRecorder.resume}
              onStop={memoRecorder.stop}
              onReset={memoRecorder.reset}
              onSave={handleSaveMemo}
            />
          }
          chatMessages={chatMessages}
          onSendMessage={sendMessage}
          isSending={isSending}
          unreadCount={unreadCount}
          onChatViewed={clearUnread}
          onChatHidden={markChatHidden}
          activeTab={sidebarTab}
          onActiveTabChange={(tab) => setSidebarTab(tab)}
        />
      </div>

      {/* Kick confirmation modal — mounted at InCallView level so it
          overlays everything including the sidebar. Vendored from NC
          in stage 1. */}
      <KickDialog
        open={!!kickTarget}
        participantName={kickTarget?.name || ""}
        loading={kicking}
        onConfirm={confirmKick}
        onCancel={cancelKick}
      />

      {/* PiP mirror portal — LiveKit context reaches through, so
          tiles subscribe to the same tracks without cloning. */}
      {pipOpen && pipWin && createPortal(<PipMirror />, pipWin.document.body)}

      {/* Host-only pre-meeting access-control modal. Shown for the
          first joiner when no policy has been set yet; commits via
          POST /livekit/policy → broadcasts livekit:policy-updated to
          everyone in the room. Skip = leave defaults permissive. */}
      {isHost && (
        <AccessControlModal
          open={policyModalOpen}
          initial={policy}
          onConfirm={handleConfirmPolicy}
          onSkip={() => setPolicyModalOpen(false)}
        />
      )}
    </CopilotProvider>
  );
}

// Mic / Camera / Screen-share toggle. Drives the call's local
// participant directly via setMicrophoneEnabled / setCameraEnabled /
// setScreenShareEnabled. Initial state mirrors the prop value when
// the call connects; subsequent toggles update local state +
// pubsub via LiveKit.
// Audio-driven three-band level meter drawn INSIDE the local mic
// button. Uses LiveKit's useMultibandTrackVolume so bar heights
// respond to the actual voice signal, not just "am I speaking".
// Ported verbatim from NC's ControlBar.MicLevelBars.
//
// The 80 ms update interval is a deliberate ceiling — fast enough to
// feel reactive but slow enough that React isn't re-rendering the
// button on every animation frame. Bands are lo/mid/hi so the three
// bars move out of phase and read as audio rather than three synced
// bouncers.
function MicLevelBars({ track }: { track: LocalAudioTrack | undefined }) {
  const levels = useMultibandTrackVolume(track, {
    bands: 3,
    updateInterval: 80,
    loPass: 100,
    hiPass: 600,
  });
  if (!track || levels.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex items-end justify-center gap-[3px]">
      {levels.map((lvl, i) => {
        // Quiet keeps a 2 px baseline so the indicator is visible;
        // shout caps at 9 px so the bars never collide with the mic
        // icon (h-5 = 20 px, centered in a 48 px button).
        const h = Math.round(2 + Math.min(1, lvl * 2.5) * 7);
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-current opacity-90 transition-[height] duration-75 ease-out"
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

// Wraps MicLevelBars with the plumbing to fetch the LOCAL mic track
// off the current participant. Rendered inside the mic ControlIcon
// Toggle only.
//
// Uses useLocalParticipant()'s `microphoneTrack` field directly - the
// hook keeps this ref reactive so bars mount as soon as the pub
// arrives. Previously I was calling localParticipant.getTrackPubli
// cation(Microphone) on the raw participant object, which is a
// snapshot: if the mic publishes AFTER the button mounts (very
// common on connect — audio publish lags a beat behind camera), the
// snapshot stayed undefined and the bars never appeared. Also `.track`
// on the publication is the base Track class; `.audioTrack` is the
// typed helper that returns the LocalAudioTrack when kind is audio.
// The multiband analyser needs the audio-specific interface to attach.
function LocalMicLevelBars() {
  const { microphoneTrack } = useLocalParticipant();
  const track =
    (microphoneTrack?.audioTrack as LocalAudioTrack | undefined) ?? undefined;
  return <MicLevelBars track={track} />;
}

// Small NC-style wrapper that puts a compact text label under a
// control-bar button. Matches the pattern in NC's ControlBar (see
// components/office/ControlBar.tsx around line 369):
//   <div className="flex flex-col items-center gap-1">
//     <button>...</button>
//     <span className="text-[10px] text-gray-500">Mic</span>
//   </div>
// Extracted so every call site stays a one-liner and label sizing
// stays consistent across the whole bar.
function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span className="text-[9px] font-medium text-gray-500 sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

function ControlIconToggle({
  source,
  title,
  OnIcon,
  OffIcon,
  locked = false,
  pending = false,
  onLockedClick,
  highlightWhenActive = false,
  activeOverlay,
}: {
  source: Track.Source;
  title: string;
  OnIcon: React.ReactNode;
  OffIcon: React.ReactNode;
  // Access-control gate. When true the button no longer toggles the
  // track — clicking sends a permission request via onLockedClick. The
  // participant's token forbids publishing this source anyway (LiveKit
  // would reject the publish attempt), so we surface the "ask the
  // host" flow up front instead of letting the SDK throw.
  locked?: boolean;
  // Currently waiting for the host to approve the last request for
  // this source. Renders a spinner over the icon and blocks re-click.
  pending?: boolean;
  onLockedClick?: () => void;
  // Flip the visual semantics: when the track is currently ACTIVE,
  // paint the button amber (loud, "you're doing this now") instead
  // of the default plain look. Used by screen share so users can
  // tell at a glance they're broadcasting; mic / cam stay in the
  // classic "red = muted, plain = on" world.
  highlightWhenActive?: boolean;
  // Absolutely-positioned decoration drawn INSIDE the button while
  // the track is active — used by the mic button to render
  // audio-driven level bars over the icon. Rendered as a sibling of
  // the icon so it can occupy any corner without disturbing the
  // centering. Ignored while locked / pending / disabled.
  activeOverlay?: React.ReactNode;
}) {
  const { localParticipant } = useLocalParticipant();
  const readEnabled = useCallback(() => {
    const pub =
      source === Track.Source.Microphone
        ? localParticipant.getTrackPublication(Track.Source.Microphone)
        : source === Track.Source.Camera
          ? localParticipant.getTrackPublication(Track.Source.Camera)
          : localParticipant.getTrackPublication(Track.Source.ScreenShare);
    return !!pub?.track && !pub.isMuted;
  }, [localParticipant, source]);
  const [enabled, setEnabled] = useState<boolean>(readEnabled);
  const [busy, setBusy] = useState(false);

  // Keep `enabled` in sync with the LiveKit-side truth. Critical for
  // screen share: the browser's own "Stop sharing" bar unpublishes
  // the track without going through handleToggle, so without this
  // effect the button would keep showing "sharing" after the user
  // hit the browser stop bar. Also covers mic/cam mute events fired
  // by force-mute from the host, camera device switches, etc.
  useEffect(() => {
    const resync = () => setEnabled(readEnabled());
    const p: any = localParticipant;
    p?.on?.("trackPublished", resync);
    p?.on?.("trackUnpublished", resync);
    p?.on?.("trackMuted", resync);
    p?.on?.("trackUnmuted", resync);
    return () => {
      p?.off?.("trackPublished", resync);
      p?.off?.("trackUnpublished", resync);
      p?.off?.("trackMuted", resync);
      p?.off?.("trackUnmuted", resync);
    };
  }, [localParticipant, readEnabled]);

  const handleToggle = useCallback(async () => {
    if (busy) return;
    if (locked) {
      // Don't attempt to toggle — LiveKit will reject publish anyway.
      // Route through the caller's request-permission handler instead.
      if (!pending) onLockedClick?.();
      return;
    }
    setBusy(true);
    const next = !enabled;
    try {
      if (source === Track.Source.Microphone) {
        await localParticipant.setMicrophoneEnabled(next);
      } else if (source === Track.Source.Camera) {
        await localParticipant.setCameraEnabled(next);
      } else if (source === Track.Source.ScreenShare) {
        await localParticipant.setScreenShareEnabled(next);
      }
      setEnabled(next);
    } catch (err) {
      console.warn("[ConferenceCall] track toggle failed:", err);
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, localParticipant, source, locked, pending, onLockedClick]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy || pending}
      title={title}
      className={cn(
        // `relative` is critical — without it the activeOverlay
        // (mic level bars) positions against the nearest positioned
        // ancestor (the whole control bar), pushing bars far below
        // the icon. Was making the bars land ~50 px under the button.
        "relative flex h-12 w-12 items-center justify-center rounded-full transition",
        locked
          ? pending
            ? "bg-white/[0.06] text-white/60"
            : "bg-white/[0.06] hover:bg-amber-500/20 hover:text-amber-300 text-white/70"
          : enabled
            ? highlightWhenActive
              // Screen-share style: amber-filled + subtle glow ring
              // makes it unmistakable you're actively broadcasting.
              ? "bg-amber-500 text-black ring-2 ring-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:bg-amber-400"
              : "bg-white/[0.10] hover:bg-white/[0.16] text-white"
            : "bg-red-500/90 hover:bg-red-600 text-white",
        busy && "opacity-50",
      )}
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : locked ? (
        OffIcon
      ) : enabled ? (
        <>
          {OnIcon}
          {activeOverlay}
        </>
      ) : (
        OffIcon
      )}
    </button>
  );
}

// Note-taker (transcription bot) toggle. Detects bot presence via
// participant identity prefix (the bot joins with identity
// 'notetaker-*'; see BotManager.join on garagenew-backend), and hits
// /livekit/notetaker/start | /stop to attach or detach it.
//
// HQ conference rooms auto-attach the bot for the owner on join —
// this button is for stopping (privacy / re-record after stop) and
// re-starting after that. Non-owners see the button too but their
// action is gated at the backend by requireAuth; a hard host-only
// gate would require piping isHost down (small follow-up).
function NotetakerToggle({ roomName }: { roomName: string }) {
  const participants = useParticipants();
  const botPresent = participants.some((p) =>
    (p.identity || "").startsWith("notetaker-"),
  );
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    const action = botPresent ? "stop" : "start";
    try {
      const tk = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/livekit/notetaker/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
          },
          body: JSON.stringify({ roomName }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.error || `Failed to ${action} note-taker`);
      toast.success(
        action === "start" ? "Note-taker joining…" : "Note-taker leaving…",
      );
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${botPresent ? "stop" : "start"} note-taker`);
    } finally {
      setLoading(false);
    }
  }, [botPresent, loading, roomName]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      title={botPresent ? "Stop note-taker" : "Start note-taker"}
      className={cn(
        "relative flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition",
        botPresent
          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
          : "bg-white/[0.06] hover:bg-white/[0.12] text-white border border-transparent",
        loading && "opacity-50",
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bot className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {botPresent ? "Notes on" : "Take notes"}
      </span>
    </button>
  );
}

// Recording start/stop button. Backed by NC's vendored useRecording
// hook (patched to hit Garage's /livekit/recording/* endpoints instead
// of NC's /meet/recording/*). Renders a red pulsing dot while active
// and shows a busy spinner during the start/stop round-trip.
function RecordingButton({ roomName }: { roomName: string }) {
  const { recording, start, stop, error } = useRecording(roomName);
  const [busy, setBusy] = useState(false);

  const handleToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (recording) {
        await stop();
      } else {
        await start();
      }
    } finally {
      setBusy(false);
    }
  }, [busy, recording, start, stop]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      title={recording ? "Stop recording" : "Start recording"}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition",
        recording
          ? "bg-red-500/90 hover:bg-red-600 text-white"
          : "bg-white/[0.10] hover:bg-white/[0.16] text-white",
        busy && "opacity-50",
      )}
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : recording ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <CircleDot className="h-5 w-5" />
      )}
    </button>
  );
}

// Picture-in-Picture button + live video mirror.
//
// Uses Chrome's Document Picture-in-Picture API to pop a small
// window that stays on top when the user switches tabs. The video
// content inside the PiP window is rendered via React.createPortal
// straight into the PiP window's <body>. Because createPortal keeps
// the child inside the same React tree, our <PipMirror> still sits
// under the <LiveKitRoom> provider from the main call — LiveKit's
// context (Room, participants, tracks) reaches through, so we don't
// have to clone tracks or wire a second connection.
//
// Feature-detects the API and greys the button on Firefox / Safari
// where documentPictureInPicture isn't implemented yet.
function PipButton() {
  const [pipSupported, setPipSupported] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const pipWinRef = useRef<Window | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPipSupported("documentPictureInPicture" in window);
  }, []);

  const handleOpen = useCallback(async () => {
    if (!pipSupported || pipOpen) return;
    try {
      const w: Window = await (window as any).documentPictureInPicture.requestWindow({
        width: 380,
        height: 260,
      });
      // Inline the styles the PiP mirror needs. Tailwind isn't
      // available inside the PiP window because it's a new document
      // with no linked stylesheet, so everything the mirror uses is
      // spelled out here.
      const style = w.document.createElement("style");
      style.textContent = `
        html, body { margin: 0; height: 100%; background: #0a0a0d;
          color: #fff; font-family: system-ui, sans-serif; }
        .pip-root { display: flex; flex-direction: column; height: 100%; }
        .pip-header { display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .pip-header-dot { width: 8px; height: 8px; border-radius: 999px;
          background: #34d399; }
        .pip-header-label { font-size: 12px; font-weight: 600;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pip-grid { flex: 1; display: grid; gap: 4px; padding: 4px;
          overflow: hidden; grid-auto-rows: 1fr; }
        .pip-tile { position: relative; overflow: hidden; border-radius: 8px;
          background: #15151b; display: flex; align-items: center;
          justify-content: center; }
        .pip-tile video { width: 100%; height: 100%; object-fit: cover; }
        .pip-tile-fallback { width: 36px; height: 36px; border-radius: 999px;
          background: #2a2a35; display: flex; align-items: center;
          justify-content: center; font-size: 14px; font-weight: 600; }
        .pip-tile-name { position: absolute; left: 6px; bottom: 6px;
          background: rgba(0,0,0,0.55); padding: 2px 6px; border-radius: 4px;
          font-size: 10px; max-width: calc(100% - 12px);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pip-empty { flex: 1; display: flex; align-items: center;
          justify-content: center; font-size: 12px; color: #9BA1A6; }
      `;
      w.document.head.appendChild(style);
      // Set a document title so the tab-strip in PiP shows something
      // meaningful.
      w.document.title = "Conference — Garage";
      w.addEventListener("pagehide", () => {
        pipWinRef.current = null;
        setPipWin(null);
        setPipOpen(false);
      });
      pipWinRef.current = w;
      setPipWin(w);
      setPipOpen(true);
    } catch (err) {
      console.warn("[ConferenceCall] Failed to open PiP:", err);
      toast.error("Couldn't open picture-in-picture window");
    }
  }, [pipOpen, pipSupported]);

  const handleClose = useCallback(() => {
    pipWinRef.current?.close();
    pipWinRef.current = null;
    setPipWin(null);
    setPipOpen(false);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={pipOpen ? handleClose : handleOpen}
        disabled={!pipSupported}
        title={
          !pipSupported
            ? "Picture-in-picture not supported in this browser"
            : pipOpen
              ? "Close picture-in-picture"
              : "Open in picture-in-picture window"
        }
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition",
          pipOpen
            ? "bg-amber-500 text-black"
            : "bg-white/[0.10] hover:bg-white/[0.16] text-white",
          !pipSupported && "opacity-40 cursor-not-allowed",
        )}
      >
        <Minimize2 className="h-5 w-5" />
      </button>

      {/* Portal the mirror into the PiP window's body. Rendering here
          keeps the child inside the same React tree, so it inherits
          the <LiveKitRoom> provider from the main InCallView and can
          subscribe to the same tracks without cloning. */}
      {pipOpen && pipWin && createPortal(<PipMirror />, pipWin.document.body)}
    </>
  );
}

// Live grid rendered inside the PiP window. Uses @livekit/components-
// react's useTracks to pull camera + screen-share tracks and
// useParticipants for their metadata. Kept small — cameras only, up
// to 4 tiles; screen-share hijacks the whole grid if present.
function PipMirror() {
  const participants = useParticipants();
  const trackRefs = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: true },
  );

  // If someone's sharing, only show that. Otherwise up to 4 camera tiles.
  const screenShare = trackRefs.find(
    (t) => t.source === Track.Source.ScreenShare,
  );
  const cameraTracks = trackRefs
    .filter((t) => t.source === Track.Source.Camera)
    .slice(0, 4);
  const showList = screenShare ? [screenShare] : cameraTracks;

  return (
    <div className="pip-root">
      <div className="pip-header">
        <div className="pip-header-dot" />
        <div className="pip-header-label">
          {participants.length}{" "}
          {participants.length === 1 ? "participant" : "participants"}
        </div>
      </div>
      {showList.length === 0 ? (
        <div className="pip-empty">
          Call is running — cameras are off
        </div>
      ) : (
        <div
          className="pip-grid"
          style={{
            gridTemplateColumns:
              showList.length === 1
                ? "1fr"
                : showList.length === 2
                  ? "1fr 1fr"
                  : "1fr 1fr",
          }}
        >
          {showList.map((t) => {
            const name =
              t.participant.name ||
              t.participant.identity ||
              "Participant";
            const initial = name.charAt(0).toUpperCase();
            // withPlaceholder: false above guarantees `publication`
            // is present at runtime; the type system still returns
            // the wider TrackReferenceOrPlaceholder union though, so
            // guard here to satisfy <VideoTrack /> which wants the
            // narrower TrackReference.
            const hasPub = "publication" in t && !!t.publication;
            return (
              <div className="pip-tile" key={`${t.participant.identity}-${t.source}`}>
                {hasPub && <VideoTrack trackRef={t as any} />}
                <div className="pip-tile-fallback" style={{ position: "absolute" }}>
                  {initial}
                </div>
                <div className="pip-tile-name">{name}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HeaderIconButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-full transition",
        active
          ? "bg-amber-500 text-black"
          : "bg-white/[0.06] hover:bg-white/[0.12] text-white",
      )}
    >
      {children}
    </button>
  );
}

// ── Pre-join lobby ──────────────────────────────────────────────
// Local camera/mic preview before the user actually joins the
// LiveKit room — gives them a chance to verify lighting, mic level,
// device choices. Uses a raw getUserMedia stream so we don't have to
// boot a LiveKit connection just to preview.
function PreJoinLobby({
  roomName,
  onJoin,
  onCopyLink,
  copied,
}: {
  roomName: string;
  onJoin: () => void;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [deviceError, setDeviceError] = useState<string>("");

  // Acquire camera + mic for the preview.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camOn ? { width: { ideal: 1280 } } : false,
          audio: micOn,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setDeviceError("");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't access devices";
        setDeviceError(message);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [camOn, micOn]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#0a0a0d] text-white px-4 py-6">
      <div className="w-full max-w-2xl space-y-4">
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-wider text-white/40">
            You're about to join
          </p>
          <h1 className="text-2xl font-bold">{roomName}</h1>
        </div>

        {/* Camera preview */}
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#15151b] flex items-center justify-center border border-white/[0.08]">
          {camOn && !deviceError ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/40">
              <CameraIcon className="h-10 w-10" />
              <p className="text-sm">
                {deviceError ||
                  (camOn ? "Loading camera…" : "Camera is off")}
              </p>
            </div>
          )}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <PreJoinToggle
              on={micOn}
              onToggle={() => setMicOn((v) => !v)}
              OnIcon={<Mic className="h-4 w-4" />}
              OffIcon={<MicOff className="h-4 w-4" />}
              title={micOn ? "Mic on" : "Mic off"}
            />
            <PreJoinToggle
              on={camOn}
              onToggle={() => setCamOn((v) => !v)}
              OnIcon={<Video className="h-4 w-4" />}
              OffIcon={<VideoOff className="h-4 w-4" />}
              title={camOn ? "Camera on" : "Camera off"}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            type="button"
            onClick={onJoin}
            className="flex-1 w-full sm:w-auto h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 transition"
          >
            Join Conference
          </button>
          <button
            type="button"
            onClick={onCopyLink}
            className="flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] px-4 h-11 text-sm transition"
            title="Copy share link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>Copy link</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PreJoinToggle({
  on,
  onToggle,
  OnIcon,
  OffIcon,
  title,
}: {
  on: boolean;
  onToggle: () => void;
  OnIcon: React.ReactNode;
  OffIcon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full transition",
        on
          ? "bg-white/[0.12] text-white hover:bg-white/[0.2]"
          : "bg-red-500/90 text-white hover:bg-red-600",
      )}
    >
      {on ? OnIcon : OffIcon}
    </button>
  );
}
