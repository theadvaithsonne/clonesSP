"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUserIdFromToken, getToken, getOrgId } from "@/lib/auth";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { connectSocket } from "@/lib/socket";
import { fetchAndCacheRevenueNetworkData } from "@/lib/revenue-network-cache";
import { cn } from "@/lib/utils";
import {
  Bell,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock,
  Coffee,
  DoorClosed,
  DoorOpen,
  GripVertical,
  Link2,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  PictureInPicture2,
  PhoneOff,
  Play,
  Send,
  Square,
  ScreenShare,
  ScreenShareOff,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { EventCard } from "./components/EventCard";
import { PeerAudio } from "./components/PeerAudio";
import { UserSpaceCard } from "./components/UserSpaceCard";
import { useLocalMedia } from "./hooks/useLocalMedia";
import { useWebRTC } from "./hooks/useWebRTC";
// Lifted to a (dashboard)-scoped provider so the HQ conference call
// state survives navigation between this page and ConferenceRoomPage
// — required for persistent PiP. `useWorkspaceLiveKit` returns the
// exact same shape useLiveKit() does, so this is a drop-in alias and
// no logic below changes. See lib/workspace-livekit-context.tsx.
import { useWorkspaceLiveKit as useLiveKit } from "@/lib/workspace-livekit-context";
import { useScreenShare } from "./hooks/useScreenShare";
import { useFloors } from "./hooks/useFloors";
import { useKnocking } from "./hooks/useKnocking";
import { useStatus } from "./hooks/useStatus";
import { useRecording } from "./hooks/useRecording";
import { useConnectionHealth } from "./hooks/useConnectionHealth";
// `DisconnectedOverlay` removed with the presence-UI cleanup.
import { RecordingControls } from "./components/RecordingControls";
import { DraggableCameraBubble } from "./components/DraggableCameraBubble";
import { TodoMenu } from "@/components/dashboard/TodoMenu";
import NotificationsHub from "@/components/dashboard/NotificationsHub";
import MobileActionSidebar from "@/components/dashboard/MobileActionSidebar";
import { PeerState, RoomBooking } from "./types";
import { HqMeetingRoomCard } from "./components/HqMeetingRoomCard";
import { HqRoomBookingModal } from "@/components/dashboard/HqRoomBookingModal";
import { HqRoomSchedule } from "@/components/dashboard/HqRoomSchedule";
import {
  getPreferredScreenTrack,
  isLiveCameraTrack,
  isScreenTrack,
} from "./utils";
import BookingDialog from "@/components/dashboard/BookingDialog";
import OrganizationCabinetPage from "@/components/dashboard/OrganizationCabinetPage";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Power, PowerOff } from "lucide-react";
import DailyVideoPlayer from "./components/DailyVideoPlayer";
import { WorkshopPreviewSection } from "./components/WorkshopPreviewSection";
import { NetworkStatsCard } from "./components/NetworkStatsCard";
import CommunityDropdown from "./components/CommunityDropdown";
import { OfficeStreamSection } from "./components/OfficeStreamSection";
import { getChannelSubscribers } from "@/lib/feed-api";

// ── AI Agent card for OfficeStream — always shown as online ──────────────────
function AgentWorkspaceCard({ agent }: { agent: { agentId: string; name: string; role?: string; emoji?: string } }) {
  const initials = (agent.name || "A").slice(0, 2).toUpperCase();
  const handleOpenDM = () => {
    window.dispatchEvent(
      new CustomEvent("notification:open-dm", {
        detail: { userId: `openclaw_agent_${agent.agentId}` },
      })
    );
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative bg-[#111118] border border-[#2a2a35] rounded-xl p-3 flex flex-col gap-2 w-[160px] min-h-[140px] cursor-default select-none"
    >
      {/* Avatar */}
      <div className="flex flex-col items-center gap-2 flex-1">
        <div className="relative">
          <div className={`w-14 h-14 rounded-full bg-brand/20 border-2 border-brand/40 flex items-center justify-center ${agent.emoji ? "text-2xl" : "text-brand text-lg font-bold"}`}>
            {agent.emoji || initials}
          </div>
          {/* Online dot */}
          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#111118]" />
        </div>
        <div className="text-center">
          <div className="text-xs font-medium text-white truncate max-w-[120px]">{agent.name}</div>
          <div className="text-[9px] text-[#9fa0b8] truncate max-w-[120px] mt-0.5">{agent.role || "AI Employee"}</div>
        </div>
      </div>
      {/* DM button */}
      <button
        onClick={handleOpenDM}
        className="w-full flex items-center justify-center gap-1 py-1 rounded-md bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-[10px] border border-violet-500/30 transition-colors"
      >
        Message
      </button>
    </motion.div>
  );
}

// Component to handle video element updates with useEffecttt
function VideoElementWithEffect({
  stream,
  isLocal,
  hasScreenShare,
}: {
  stream?: MediaStream;
  isLocal: boolean;
  hasScreenShare: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    if (stream) {
      if (element.srcObject !== stream) {
        element.srcObject = stream;
        element.play().catch((err) => {
          console.error("Failed to play video:", err);
        });
      }
    } else {
      element.srcObject = null;
    }
  }, [stream]);

  if (hasScreenShare) {
    return (
      <div className="w-full h-full aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-contain bg-black"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

// Component for fullscreen screen share video
function FullscreenScreenShareVideo({ stream }: { stream?: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    if (stream) {
      if (element.srcObject !== stream) {
        element.srcObject = stream;
        element.play().catch((err) => {
          console.error("Failed to play screen share video:", err);
        });
      }
    } else {
      element.srcObject = null;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="max-w-full max-h-full object-contain"
      style={{ maxHeight: "calc(100vh - 120px)" }}
    />
  );
}

export default function WorkspaceClient() {
  const me = getUserIdFromToken()!;
  const { amIFounder, isGarageHQ, userData } = useAmIFounder();
  const amIGuest = userData.guest === true;

  // Community filtering state for guest users
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [communityMemberIds, setCommunityMemberIds] = useState<Set<string> | null>(null);

  const {
    inCall,
    localVideoTrack,
    localScreenTrack,
    isScreenSharing: isDailyScreenSharing,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare: toggleDailyScreenShare,
    userInfoMap,
    remoteUserTracks,
    localScreenShareUid,
    // Cloud recording
    isCloudRecording,
    recordingStartedByMe,
    isRecordingLoading,
    toggleCloudRecording,
    is1on1Call,
    // Chat
    chatMessages,
    unreadChatCount,
    sendChatMessage,
    clearUnreadChat,
  } = useLiveKit();

  // Debug: Log userInfoMap whenever it changes
  useEffect(() => {
    console.log("[WorkspaceClient] userInfoMap changed:", {
      userInfoMapSize: userInfoMap.size,
      userInfoMapEntries: Array.from(userInfoMap.entries()),
    });
  }, [userInfoMap]);

  // State for Daily call controls
  const [dailyMicMuted, setDailyMicMuted] = useState(false);
  const [dailyCameraOff, setDailyCameraOff] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Ref to store knock notification audio for looping
  const knockAudioRef = useRef<HTMLAudioElement | null>(null);
  // Ref to the incoming-knock browser Notification so it can be closed when
  // the knock is handled (accepted/declined) on another device
  const knockNotificationRef = useRef<Notification | null>(null);

  // OfficeStream 4-quadrant expanded section state
  const [expandedSection, setExpandedSection] = useState<
    "ai" | "team" | "customers" | "affiliates" | null
  >(null);
  // Paginates the expanded "View All" list — render up to this many cards
  // and reveal a "Show more" button when the underlying list is larger.
  // Reset whenever the user opens a different section so each tab starts
  // fresh instead of inheriting the prior section's scroll depth.
  const EXPANDED_PAGE_SIZE = 50;
  const [expandedLimit, setExpandedLimit] = useState(EXPANDED_PAGE_SIZE);
  useEffect(() => {
    setExpandedLimit(EXPANDED_PAGE_SIZE);
  }, [expandedSection]);

  // OrgId for workshop preview
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  useEffect(() => {
    const orgId = localStorage.getItem("garage_org_id");
    setCurrentOrgId(orgId);
  }, []);

  // Debug: Log inCall value
  console.log(
    "[WorkspaceClient] Component render - inCall:",
    inCall,
    "remoteUserTracks size:",
    remoteUserTracks.size,
    "localVideoTrack:",
    !!localVideoTrack
  );

  // Debug: Log remoteUserTracks changes
  useEffect(() => {
    console.log("[WorkspaceClient] remoteUserTracks changed:", {
      count: remoteUserTracks.size,
      users: Array.from(remoteUserTracks.entries()).map(([userId, tracks]) => ({
        userId,
        hasAudio: !!tracks.audioTrack,
        hasVideo: !!tracks.cameraTrack,
        hasScreen: !!tracks.screenTrack,
      })),
    });
  }, [remoteUserTracks]);

  // Track previous inCall value to detect call-end transitions
  const prevInCallRef = useRef(false);
  useEffect(() => {
    console.log("[WorkspaceClient] inCall value changed to:", inCall);

    // Call just ended (true → false): reset local state back to lobby
    // This covers both manual end-call and auto-leave (other person left)
    if (prevInCallRef.current && !inCall) {
      console.log("[WorkspaceClient] Call ended, resetting to lobby");
      setMySpaceId("lobby");
      setIsCallMinimized(false);
      setDailyMicMuted(false);
      setDailyCameraOff(false);
    }

    prevInCallRef.current = inCall;
  }, [inCall]);

  // Request notification permission when component mounts
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch((err) => {
          console.error("Failed to request notification permission:", err);
        });
      }
    }
  }, []);

  const [mySpaceId, setMySpaceId] = useState("lobby");
  const [joiningSpaceId, setJoiningSpaceId] = useState<string | null>(null);

  // Personal AI agents — always shown as "online" in the workspacee
  const [personalAgents, setPersonalAgents] = useState<{ agentId: string; name: string; role?: string; emoji?: string }[]>([]);
  const orgId = getOrgId();
  useEffect(() => {
    const url = new URL("/api/openclaw/agent", window.location.origin);
    if (orgId) url.searchParams.set("org_id", orgId);

    fetch(url.toString(), { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((d) =>
        setPersonalAgents(
          (d.agents || []).map((a: any) => ({ agentId: a.agent_id, name: a.name, role: a.role || "", emoji: a.emoji || "" }))
        )
      )
      .catch(() => {});

    const handler = (e: CustomEvent) => {
      const agents: { agent_id: string; name: string }[] = e.detail?.agents || [];
      setPersonalAgents(agents.map((a: any) => ({ agentId: a.agent_id, name: a.name, role: a.role || "", emoji: a.emoji || "" })));
    };
    window.addEventListener("openclaw:agents-updated", handler as EventListener);
    return () => window.removeEventListener("openclaw:agents-updated", handler as EventListener);
  }, [orgId]);

  const {
    localStream,
    localStreamVersion,
    cameraTrackRef,
    meDetails,
    bumpLocalStreamVersion,
  } = useLocalMedia(me);

  const {
    peers,
    peerConnections,
    trackSenders,
    makingOfferRef,
    setupPeerConnection,
    updatePeerState,
    setPeers,
    removePeerConnection,
  } = useWebRTC(me, localStream, cameraTrackRef);

  const getVideoSender = useCallback(
    (peerId: string, pc: RTCPeerConnection) => {
      const entry = trackSenders.current.get(peerId);
      if (entry?.video && pc.getSenders().includes(entry.video)) {
        return entry.video;
      }
      const fallback = pc
        .getSenders()
        .find((sender) => sender.track?.kind === "video");
      if (fallback) {
        if (entry) {
          entry.video = fallback;
        } else {
          trackSenders.current.set(peerId, { video: fallback });
        }
        return fallback;
      }
      return null;
    },
    [trackSenders]
  );

  const getSenderEntry = useCallback(
    (peerId: string) => {
      let entry = trackSenders.current.get(peerId);
      if (!entry) {
        entry = {};
        trackSenders.current.set(peerId, entry);
      }
      return entry;
    },
    [trackSenders]
  );

  const {
    isScreenSharing,
    isScreenSharingRef,
    watchingScreenShare,
    screenShareContainerRef,
    watchingScreenShareRef,
    isScreenShareFullscreenActive,
    closeWatchingScreenShare,
    toggleScreenShareViewFullscreen,
    startScreenShare,
    stopScreenShare,
    setWatchingScreenShare,
    setIsScreenSharing,
    setIsScreenShareFullscreenActive,
  } = useScreenShare(
    localStream,
    me,
    updatePeerState,
    getVideoSender,
    getSenderEntry,
    bumpLocalStreamVersion,
    peerConnections,
    cameraTrackRef
  );

  const {
    floors,
    showFloorsPopover,
    loadingFloors,
    selectedFloorId,
    myFloorId,
    teamMembers,
    handleFloorsButtonClick,
    setSelectedFloorId,
    setShowFloorsPopover,
    isFloorTransitioning,
    floorTransitionDirection,
    handleFloorChange,
  } = useFloors(me, amIFounder);

  // Fetch community (channel) subscriber IDs when a guest selects a community
  useEffect(() => {
    if (!amIGuest || !selectedCommunityId) {
      setCommunityMemberIds(null);
      return;
    }
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    getChannelSubscribers(selectedCommunityId, orgId, { limit: 100 })
      .then((data) => {
        const ids = new Set(
          data.subscribers.map((s) => String(s.user._id))
        );
        setCommunityMemberIds(ids);
      })
      .catch(() => {
        // On error (e.g. 403 not subscribed), show no members rather than all
        setCommunityMemberIds(new Set());
      });
  }, [selectedCommunityId, amIGuest]);

  const {
    myStatus,
    showStatusSelector,
    handleStatusChange,
    setShowStatusSelector,
  } = useStatus();

  const {
    isRecording,
    toggleRecording,
    startRecording,
    stopRecording,
    recordingPreviewStream,
    // New recording controls
    isRecordingMicOn,
    isRecordingCameraOn,
    toggleRecordingMic,
    toggleRecordingCamera,
    recordingCameraStream,
    recordingDuration,
    updateCameraBubblePosition,
  } = useRecording(me, mySpaceId, localStream, peers, updatePeerState);

  const autoRecordingEnabled = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_HQ_FORCE_RECORDING;
    if (!raw) return false; // Default to off when not explicitly enabled
    const normalized = raw.toLowerCase();
    return !["0", "false", "off", "no"].includes(normalized);
  }, []);

  const shouldForceRecording = useMemo(
    () => autoRecordingEnabled && isGarageHQ,
    [autoRecordingEnabled, isGarageHQ]
  );

  const localPeerState: PeerState | undefined = useMemo(
    () =>
      me && localStream && meDetails
        ? {
          id: me,
          stream: localStream,
          email: meDetails.email || "",
          name: meDetails.name || meDetails.email,
          profilePicture: meDetails.profilePicture,
          spaceId: mySpaceId,
          status: myStatus,
          isScreenSharing,
          isRecording,
        }
        : undefined,
    [
      me,
      localStream,
      mySpaceId,
      meDetails,
      myStatus,
      localStreamVersion,
      isScreenSharing,
      isRecording,
    ]
  );

  const {
    knockRequest,
    knockDeclinedToast,
    joiningSpace,
    knockingId,
    handleKnock,
    handleCancelKnock,
    handleKnockResponse: originalHandleKnockResponse,
    setKnockingId,
    setJoiningSpace,
    setKnockDeclinedToast,
    setKnockRequest,
  } = useKnocking(me, localPeerState);

  // Mirror knockingId in a ref so socket handlers (registered once) can tell
  // whether THIS device initiated the outbound knock — knock-accepted is also
  // broadcast to the knocker's other devices, which must not show the
  // "Joining..." overlay (the call only opens on the initiating device).
  const knockingIdRef = useRef<string | null>(null);
  useEffect(() => {
    knockingIdRef.current = knockingId;
  }, [knockingId]);

  // Knock initiated from outside the workspace (e.g. feed user popup).
  // The roster may not include the target yet (or the target is offline and
  // rings via push) — handleKnock only needs the id, and the knocking overlay
  // resolves the name from `peers` reactively.
  const knockUserById = useCallback(
    (userId: string) => {
      if (!userId || userId === me) return;
      const peer = peers.get(userId);
      handleKnock(peer ?? ({ id: userId } as PeerState));
    },
    [peers, me, handleKnock]
  );

  // Mounted case: feed dispatches this event directly.
  useEffect(() => {
    const onKnockUser = (event: Event) => {
      const userId = (event as CustomEvent<{ userId?: string }>).detail
        ?.userId;
      try {
        sessionStorage.removeItem("workspace:pending-knock");
      } catch {}
      if (userId) knockUserById(userId);
    };
    window.addEventListener("workspace:knock-user", onKnockUser);
    return () =>
      window.removeEventListener("workspace:knock-user", onKnockUser);
  }, [knockUserById]);

  // Navigation case: the workspace wasn't mounted when the knock was
  // requested, so the layout navigated here with the target stashed in
  // sessionStorage.
  const pendingKnockConsumedRef = useRef(false);
  useEffect(() => {
    if (pendingKnockConsumedRef.current) return;
    let userId: string | null = null;
    try {
      userId = sessionStorage.getItem("workspace:pending-knock");
      if (userId) sessionStorage.removeItem("workspace:pending-knock");
    } catch {}
    if (!userId) return;
    pendingKnockConsumedRef.current = true;
    knockUserById(userId);
  }, [knockUserById]);

  // Connection health monitoring for auto-reconnect on visibility change
  const handleRejoinSuccess = useCallback(
    (users: any[]) => {
      console.log(
        "[WORKSPACE] Rejoin success, updating peers with",
        users.length,
        "users"
      );
      const otherUsers = users.filter((u: any) => u.id !== me);
      setPeers(
        new Map(
          otherUsers.map((u: any) => [
            u.id,
            {
              ...u,
              isScreenSharing: !!u.isScreenSharing,
              isRecording: !!u.isRecording,
            },
          ])
        )
      );
      // "You're back online!" toast retired with the presence-UI cleanup —
      // we no longer surface online/offline state to the user, so the
      // recovery toast would be confusing context. Rejoin still happens
      // silently above.
    },
    [me, setPeers]
  );

  const handleUsersSync = useCallback(
    (users: any[]) => {
      console.log("[WORKSPACE] Users sync received, updating peers");
      const otherUsers = users.filter((u: any) => u.id !== me);
      setPeers(
        new Map(
          otherUsers.map((u: any) => [
            u.id,
            {
              ...u,
              isScreenSharing: !!u.isScreenSharing,
              isRecording: !!u.isRecording,
            },
          ])
        )
      );
    },
    [me, setPeers]
  );

  const { connectionState, isReconnecting, handleManualReconnect } =
    useConnectionHealth({
      onRejoinSuccess: handleRejoinSuccess,
      onUsersSync: handleUsersSync,
    });

  // Wrapper for handleKnockResponse to stop audio before responding
  const handleKnockResponse = useCallback(
    (accepted: boolean) => {
      // Stop knock notification audio
      if (knockAudioRef.current) {
        knockAudioRef.current.pause();
        knockAudioRef.current.currentTime = 0;
        knockAudioRef.current = null;
      }
      // Call original handler
      originalHandleKnockResponse(accepted);
    },
    [originalHandleKnockResponse]
  );

  // Clear knocking state and joining indicator when call starts
  useEffect(() => {
    if (inCall) {
      console.log("[WorkspaceClient] Call started, clearing knocking state");
      setKnockingId(null);
      setJoiningSpace(null);
      setJoiningSpaceId(null);
      // Reset Daily control states
      setDailyMicMuted(false);
      setDailyCameraOff(false);
    }
  }, [inCall, setKnockingId, setJoiningSpace]);

  // Safety timeout: clear joining indicator if call doesn't start within 15s
  useEffect(() => {
    if (!joiningSpaceId) return;
    const timeout = setTimeout(() => {
      setJoiningSpaceId(null);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [joiningSpaceId]);

  // Recovery: if user is in a meeting space but LiveKit call didn't connect,
  // re-emit move-to-space to trigger a fresh livekit:join-call from the backend.
  // This handles cases where the socket reconnected and the original event was lost.
  const meetingRetryRef = useRef(false);
  useEffect(() => {
    if (inCall || mySpaceId === "lobby") {
      meetingRetryRef.current = false;
      return;
    }
    // User is in a meeting space but inCall is false
    const isMeetingSpace =
      mySpaceId.startsWith("booking:") ||
      mySpaceId.startsWith("event:") ||
      mySpaceId.startsWith("community-stream:") ||
      mySpaceId.startsWith("hq-room:");
    if (!isMeetingSpace) return;
    if (meetingRetryRef.current) return; // already retried once

    const timeout = setTimeout(() => {
      if (!meetingRetryRef.current) {
        meetingRetryRef.current = true;
        console.log("[WorkspaceClient] Recovery: re-requesting Daily call for", mySpaceId);
        connectSocket().emit("workspace:move-to-space", { spaceId: mySpaceId });
      }
    }, 4000);
    return () => clearTimeout(timeout);
  }, [inCall, mySpaceId]);

  // Handlers for Daily call controls
  const handleDailyMicToggle = async () => {
    const isEnabled = await toggleMicrophone();
    setDailyMicMuted(!isEnabled);
  };

  const handleDailyCameraToggle = async () => {
    const isEnabled = await toggleCamera();
    setDailyCameraOff(!isEnabled);
  };

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput("");
  };

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Clear unread count when chat is opened
  useEffect(() => {
    if (isChatOpen) clearUnreadChat();
  }, [isChatOpen, clearUnreadChat]);

  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [showScreenShareOverrideDialog, setShowScreenShareOverrideDialog] =
    useState(false);
  const [overrideSharer, setOverrideSharer] = useState<PeerState | null>(null);
  const [pendingScreenShareAction, setPendingScreenShareAction] = useState<
    null | "start"
  >(null);
  const [autoRecordingTriggered, setAutoRecordingTriggered] = useState(false);
  const [showFocusReminder, setShowFocusReminder] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [pipError, setPipError] = useState<string | null>(null);
  const [pipPosition, setPipPosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - 280 : 0,
    y: typeof window !== "undefined" ? window.innerHeight - 280 : 0,
  });
  const [isPipDragging, setIsPipDragging] = useState(false);
  const pipDragStartRef = useRef({ x: 0, y: 0 });
  const pipPositionStartRef = useRef({ x: 0, y: 0 });
  const [showTodoMenu, setShowTodoMenu] = useState(false);
  const [showNotificationsHub, setShowNotificationsHub] = useState(false);
  const [showMembersPopover, setShowMembersPopover] = useState(false);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const notificationsHubRef = useRef<HTMLDivElement>(null);
  const [bookingTarget, setBookingTarget] = useState<PeerState | null>(null);
  const [showOrgCabinet, setShowOrgCabinet] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState<boolean | null>(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);

  // Events state
  const [events, setEvents] = useState<any[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);

  // HQ Room Booking state
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>([]);
  const [currentRoomBooking, setCurrentRoomBooking] = useState<RoomBooking | null>(null);
  const [showRoomBookingModal, setShowRoomBookingModal] = useState(false);
  const [showRoomSchedule, setShowRoomSchedule] = useState(false);
  const [isMeetingViewFullscreen, setIsMeetingViewFullscreen] = useState(false);
  const [fullscreenScreenSharePeer, setFullscreenScreenSharePeer] = useState<
    string | null
  >(null);

  // Track remote screen sharers in Daily calls (userId -> isSharing)
  const [remoteScreenSharers, setRemoteScreenSharers] = useState<
    Set<string>
  >(new Set());

  // Auto-managed screen share view state (switches automatically when someone shares)
  const [showScreenShareView, setShowScreenShareView] = useState(false);

  // Load initial clocked-in state from Betty time tracking
  useEffect(() => {
    (async () => {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        const res = await api<{ success: boolean; history: any[] }>(
          `/betty/time-tracking?orgId=${orgId}`
        );
        const active = (res.history || []).find((r: any) => !r.clockOutTime);
        setIsClockedIn(Boolean(active));
      } catch (e) {
        setIsClockedIn(false);
      }
    })();
  }, []);

  // Fetch events and keep track of active ones
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) {
          console.log(
            "[WorkspaceClient] No orgId found, skipping events fetch"
          );
          return;
        }

        console.log("[WorkspaceClient] Fetching events for orgId:", orgId);
        const res = await api<{ events: any[] }>(`/events?orgId=${orgId}`);

        const now = new Date();
        const allEvents = res.events || [];

        console.log("[WorkspaceClient] Fetched events:", allEvents);

        // Helper to check if event time matches today (for repeating events)
        const isActiveToday = (event: any) => {
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);

          // Get today's date parts
          const todayStart = new Date(now);
          todayStart.setHours(
            eventStart.getHours(),
            eventStart.getMinutes(),
            0,
            0
          );

          const todayEnd = new Date(now);
          todayEnd.setHours(eventEnd.getHours(), eventEnd.getMinutes(), 0, 0);

          return { todayStart, todayEnd };
        };

        // Filter events - keep repeating events always, non-repeating only if not expired
        const nonExpiredEvents = allEvents.filter((event: any) => {
          // Repeating events are always shown
          if (event.isRepeating) {
            return true;
          }
          // Non-repeating events: hide if expired
          const endTime = new Date(event.endTime);
          return endTime >= now;
        });

        // Filter active events (started but not ended)
        const active = nonExpiredEvents.filter((event: any) => {
          if (event.isRepeating) {
            // For repeating events, check if current time is within today's event window
            const { todayStart, todayEnd } = isActiveToday(event);
            return todayStart <= now && todayEnd >= now;
          }
          // Non-repeating events: check actual times
          const startTime = new Date(event.startTime);
          const endTime = new Date(event.endTime);
          return startTime <= now && endTime >= now;
        });

        console.log(
          "[WorkspaceClient] Setting events:",
          nonExpiredEvents.length,
          "active:",
          active.length
        );
        setEvents(nonExpiredEvents);
        setActiveEvents(active);
      } catch (error) {
        console.error("Failed to fetch events:", error);
      }
    };

    fetchEvents();

    // Refresh events every minute to update active status
    const interval = setInterval(fetchEvents, 60000);

    // Listen for event creation (local custom event)
    const handleEventCreated = () => {
      console.log(
        "[WorkspaceClient] Event created (custom event), refreshing..."
      );
      fetchEvents();
    };
    window.addEventListener("event:created", handleEventCreated);

    // Listen for event creation from Socket.IO (real-time from other users)
    const socket = connectSocket();
    const handleSocketEventCreated = ({
      event: newEvent,
      orgId: eventOrgId,
    }: any) => {
      console.log(
        "[WorkspaceClient] Received event:created from socket",
        newEvent
      );
      const currentOrgId = localStorage.getItem("garage_org_id");
      if (eventOrgId === currentOrgId) {
        fetchEvents();
      }
    };
    socket.on("event:created", handleSocketEventCreated);

    // Listen for event:started (when host starts the meeting)
    const handleEventStarted = ({
      eventId,
      event: updatedEvent,
      orgId: eventOrgId,
    }: any) => {
      console.log(
        "[WorkspaceClient] Received event:started from socket",
        eventId,
        updatedEvent
      );
      const currentOrgId = localStorage.getItem("garage_org_id");
      if (eventOrgId === currentOrgId) {
        // Update the event in state to reflect isLive = true
        setEvents((prev) =>
          prev.map((e) =>
            e._id === eventId
              ? {
                ...e,
                isLive: true,
                liveStartedAt: updatedEvent.liveStartedAt,
              }
              : e
          )
        );
      }
    };
    socket.on("event:started", handleEventStarted);

    // Listen for event:ended (when host ends the meeting)
    const handleEventEnded = ({
      eventId,
      event: updatedEvent,
      orgId: eventOrgId,
    }: any) => {
      console.log(
        "[WorkspaceClient] Received event:ended from socket",
        eventId,
        updatedEvent
      );
      const currentOrgId = localStorage.getItem("garage_org_id");
      if (eventOrgId === currentOrgId) {
        // Update the event in state to reflect isLive = false
        setEvents((prev) =>
          prev.map((e) =>
            e._id === eventId ? { ...e, isLive: false, status: "completed" } : e
          )
        );
      }
    };
    socket.on("event:ended", handleEventEnded);

    // Listen for event:member-removed (when current user is removed from an event)
    const handleMemberRemoved = ({
      eventId,
      userId,
      orgId: eventOrgId,
    }: any) => {
      console.log(
        "[WorkspaceClient] Received event:member-removed from socket",
        eventId,
        userId
      );
      const currentOrgId = localStorage.getItem("garage_org_id");
      const currentUserId = localStorage.getItem("garage_user_id");

      // Only remove if the current user is the one being removed
      if (eventOrgId === currentOrgId && userId === currentUserId) {
        // Remove the event from state immediately
        setEvents((prev) => prev.filter((e) => e._id !== eventId));
        toast.info("You have been removed from an event");
      }
    };
    socket.on("event:member-removed", handleMemberRemoved);

    // Listen for event:members-updated (when event members are updated)
    const handleMembersUpdated = ({
      eventId,
      event: updatedEvent,
      orgId: eventOrgId,
    }: any) => {
      console.log(
        "[WorkspaceClient] Received event:members-updated from socket",
        eventId
      );
      const currentOrgId = localStorage.getItem("garage_org_id");
      if (eventOrgId === currentOrgId) {
        // Update the event in state with new member list
        setEvents((prev) =>
          prev.map((e) => (e._id === eventId ? { ...e, ...updatedEvent } : e))
        );
      }
    };
    socket.on("event:members-updated", handleMembersUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener("event:created", handleEventCreated);
      socket.off("event:created", handleSocketEventCreated);
      socket.off("event:started", handleEventStarted);
      socket.off("event:ended", handleEventEnded);
      socket.off("event:member-removed", handleMemberRemoved);
      socket.off("event:members-updated", handleMembersUpdated);
    };
  }, []);

  // --- HQ Room Bookings fetch + socket listeners ---
  useEffect(() => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    const fetchRoomBookings = async () => {
      try {
        const res = await api<{ bookings: RoomBooking[] }>(
          `/room-bookings?orgId=${orgId}`,
          {},
          getToken()!
        );
        const bookings = res.bookings || [];
        setRoomBookings(bookings);
        const now = new Date();
        const current = bookings.find(
          (b) =>
            b.status === "active" &&
            new Date(b.startTime) <= now &&
            new Date(b.endTime) >= now
        );
        setCurrentRoomBooking(current || null);
      } catch (error) {
        console.error("[WorkspaceClient] Error fetching room bookings:", error);
      }
    };

    fetchRoomBookings();
    const interval = setInterval(fetchRoomBookings, 60000);

    const socket = connectSocket();
    const handleBookingChange = () => fetchRoomBookings();
    socket.on("room-booking:created", handleBookingChange);
    socket.on("room-booking:updated", handleBookingChange);
    socket.on("room-booking:cancelled", handleBookingChange);
    socket.on("room-booking:ended", handleBookingChange);

    // Handle auto-kick
    socket.on("room-booking:auto-kick", (data: any) => {
      toast.info(data?.message || "Your booking time has ended.");
    });

    // Handle join errors (e.g., access denied to HQ room)
    socket.on("livekit:join-error", (data: any) => {
      toast.error(data?.error || "Failed to join the room");
      setJoiningSpaceId(null);
    });

    window.addEventListener("room-booking:created", handleBookingChange);

    return () => {
      clearInterval(interval);
      socket.off("room-booking:created", handleBookingChange);
      socket.off("room-booking:updated", handleBookingChange);
      socket.off("room-booking:cancelled", handleBookingChange);
      socket.off("room-booking:ended", handleBookingChange);
      socket.off("room-booking:auto-kick");
      socket.off("livekit:join-error");
      window.removeEventListener("room-booking:created", handleBookingChange);
    };
  }, []);

  const handleClockToggle = useCallback(async () => {
    if (clockActionLoading) return;
    setClockActionLoading(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      if (isClockedIn) {
        await api(`/betty/clock-out?orgId=${orgId}`, { method: "POST" });
        setIsClockedIn(false);
        toast.success("Clocked out");
      } else {
        await api(`/betty/clock-in?orgId=${orgId}`, { method: "POST" });
        setIsClockedIn(true);
        toast.success("Clocked in");
      }
    } catch (err: any) {
      toast.error(err?.message || "Clock action failed");
    } finally {
      setClockActionLoading(false);
    }
  }, [isClockedIn, clockActionLoading]);

  const audioPeers = useMemo(() => {
    const uniquePeers = new Map<string, PeerState>();
    peers.forEach((peer) => uniquePeers.set(peer.id, peer));
    if (localPeerState) {
      uniquePeers.set(localPeerState.id, localPeerState);
    }
    const result = Array.from(uniquePeers.values());
    console.log(
      "[WORKSPACE] audioPeers computed, total:",
      result.length,
      "peers map size:",
      peers.size
    );
    return result;
  }, [peers, localPeerState]);

  const activeScreenSharer = useMemo(() => {
    const participants = new Map(peers);
    if (localPeerState) {
      participants.set(localPeerState.id, localPeerState);
    }
    return Array.from(participants.values()).find((peer) => {
      if (peer.spaceId !== mySpaceId) return false;
      if (peer.isScreenSharing) return true;
      const screenTrack = getPreferredScreenTrack(peer.stream);
      return Boolean(screenTrack);
    });
  }, [peers, localPeerState, mySpaceId]);

  const toggleScreenShare = useCallback(async () => {
    if (!localStream) return;

    if (isScreenSharingRef.current) {
      await stopScreenShare();
      return;
    }

    if (activeScreenSharer && activeScreenSharer.id !== me) {
      setPendingScreenShareAction("start");
      setOverrideSharer(activeScreenSharer);
      setShowScreenShareOverrideDialog(true);
      return;
    }

    await startScreenShare();
  }, [localStream, stopScreenShare, activeScreenSharer, me, startScreenShare]);

  const handleConfirmScreenShareOverride = useCallback(() => {
    const action = pendingScreenShareAction;
    setShowScreenShareOverrideDialog(false);
    setPendingScreenShareAction(null);
    if (action === "start") {
      setOverrideSharer(null);
      void startScreenShare();
    }
  }, [pendingScreenShareAction, startScreenShare]);

  const handleCancelScreenShareOverride = useCallback(() => {
    setShowScreenShareOverrideDialog(false);
    setPendingScreenShareAction(null);
    setOverrideSharer(null);
  }, []);

  useEffect(() => {
    if (
      showScreenShareOverrideDialog &&
      (!activeScreenSharer || activeScreenSharer.id === me)
    ) {
      setShowScreenShareOverrideDialog(false);
      setPendingScreenShareAction(null);
      setOverrideSharer(null);
    }
  }, [showScreenShareOverrideDialog, activeScreenSharer, me]);

  const toggleTrack = useCallback(
    async (kind: "audio" | "video") => {
      if (!localStream) return;

      if (kind === "audio") {
        const track = localStream.getAudioTracks()[0];
        if (track) {
          track.enabled = !track.enabled;
          setIsMuted(!track.enabled);
          return;
        }
        // No audio track yet — `useLocalMedia` no longer grabs the mic
        // on mount, so the FIRST mic toggle is where we request it.
        // This is the user-initiated permission prompt we want.
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const newAudioTrack = micStream.getAudioTracks()[0];
          if (!newAudioTrack) {
            throw new Error("Microphone track unavailable");
          }
          // Discard extras (defensive — shouldn't normally happen).
          micStream
            .getAudioTracks()
            .forEach((t) => t !== newAudioTrack && t.stop());
          localStream.addTrack(newAudioTrack);
          bumpLocalStreamVersion();
          setIsMuted(false);
        } catch (err) {
          console.error(
            "[Workspace] Failed to acquire microphone on toggle:",
            err
          );
          toast.error(
            "Couldn't access microphone. Check browser permissions."
          );
        }
        return;
      }

      if (isScreenSharingRef.current) {
        await toggleScreenShare();
        return;
      }

      const liveCameraTracks = localStream
        .getVideoTracks()
        .filter(isLiveCameraTrack);
      const staleCameraTracks = localStream
        .getVideoTracks()
        .filter(
          (track) => !isScreenTrack(track) && track.readyState !== "live"
        );

      staleCameraTracks.forEach((track) => {
        localStream.removeTrack(track);
      });

      if (staleCameraTracks.length) {
        bumpLocalStreamVersion();
      }

      if (liveCameraTracks.length) {
        const [cameraTrack, ...extraCameraTracks] = liveCameraTracks;
        cameraTrackRef.current = null;
        cameraTrack.stop();
        localStream.removeTrack(cameraTrack);

        extraCameraTracks.forEach((track) => {
          track.stop();
          localStream.removeTrack(track);
        });

        await Promise.all(
          Array.from(peerConnections.current.entries()).map(
            async ([peerId, pc]) => {
              const sender = getVideoSender(peerId, pc);
              if (!sender) return;

              try {
                await sender.replaceTrack(null);
              } catch (err) {
                console.error(
                  `Failed to pause camera track for peer ${peerId}:`,
                  err
                );
              }
            }
          )
        );

        bumpLocalStreamVersion();
        setIsVideoOff(true);
      } else {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
          });
          const newTrack = newStream.getVideoTracks()[0];

          if (!newTrack) {
            throw new Error("Camera track unavailable");
          }

          newStream.getVideoTracks().forEach((track) => {
            if (track !== newTrack) {
              track.stop();
            }
          });
          newStream.getAudioTracks().forEach((track) => track.stop());

          cameraTrackRef.current = newTrack;
          localStream.addTrack(newTrack);

          await Promise.all(
            Array.from(peerConnections.current.entries()).map(
              async ([peerId, pc]) => {
                const sender = getVideoSender(peerId, pc);
                if (sender) {
                  try {
                    await sender.replaceTrack(newTrack);
                    // Reset encoding parameters to prevent blurry video
                    // after bandwidth estimator dropped during camera-off
                    const params = sender.getParameters();
                    if (params.encodings && params.encodings.length > 0) {
                      params.encodings[0].maxBitrate = 1_500_000; // 1.5 Mbps for 720p
                      params.degradationPreference = "maintain-resolution";
                      await sender.setParameters(params);
                    }
                  } catch (err) {
                    console.error(
                      `Failed to resume camera track for peer ${peerId}:`,
                      err
                    );
                  }
                } else {
                  const newSender = pc.addTrack(newTrack, localStream);
                  getSenderEntry(peerId).video = newSender;
                }
              }
            )
          );

          bumpLocalStreamVersion();
          setIsVideoOff(false);
        } catch (err) {
          console.error("Error getting camera:", err);
          setIsVideoOff(true);
        }
      }
    },
    [
      localStream,
      toggleScreenShare,
      getVideoSender,
      getSenderEntry,
      bumpLocalStreamVersion,
      isScreenSharingRef,
      cameraTrackRef,
      peerConnections,
    ]
  );

  const selectedFloor = useMemo(() => {
    if (!selectedFloorId || floors.length === 0) return null;
    return floors.find((f) => f.id === selectedFloorId);
  }, [selectedFloorId, floors]);

  // HQ Room occupants
  const hqRoomSpaceId = useMemo(() => {
    const orgId = typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null;
    return orgId ? `hq-room:${orgId}` : null;
  }, []);

  const hqRoomOccupants = useMemo(() => {
    if (!hqRoomSpaceId) return [];
    const allUsersMap = new Map(peers);
    if (localPeerState) allUsersMap.set(localPeerState.id, localPeerState);
    return Array.from(allUsersMap.values()).filter((p) => p.spaceId === hqRoomSpaceId);
  }, [peers, localPeerState, hqRoomSpaceId]);

  const handleJoinMeetingRoom = useCallback((spaceId: string) => {
    if (spaceId) {
      setJoiningSpaceId(spaceId);
      connectSocket().emit("workspace:move-to-space", {
        spaceId,
      });
    }
  }, []);

  const spacesToRender = useMemo(() => {
    const onlinePeersMap = new Map(peers);
    if (localPeerState) {
      onlinePeersMap.set(localPeerState.id, localPeerState);
    }

    const allTeamUsers: PeerState[] = Array.from(teamMembers.entries()).map(
      ([userId, memberDetails]) => {
        if (onlinePeersMap.has(userId)) {
          // For online users, merge profilePicture, guest status, and
          // lastSeenAt from teamMembers — the socket-derived peer object
          // doesn't carry any of those (only the /team/list payload does).
          const onlinePeer = onlinePeersMap.get(userId)!;
          return {
            ...onlinePeer,
            profilePicture:
              memberDetails.profilePicture || onlinePeer.profilePicture,
            guest: onlinePeer.guest ?? memberDetails.guest,
            lastSeenAt: memberDetails.lastSeenAt ?? null,
          };
        } else {
          return {
            id: userId,
            email: memberDetails.email,
            name: memberDetails.name,
            profilePicture: memberDetails.profilePicture,
            spaceId: "lobby",
            status: "offline",
            isScreenSharing: false,
            isRecording: false,
            guest: memberDetails.guest,
            lastSeenAt: memberDetails.lastSeenAt ?? null,
          };
        }
      }
    );

    // Sort users: online users first, then offline users
    allTeamUsers.sort((a, b) => {
      const aIsOnline = a.status !== "offline";
      const bIsOnline = b.status !== "offline";
      if (aIsOnline && !bIsOnline) return -1;
      if (!aIsOnline && bIsOnline) return 1;
      return 0;
    });

    const allPeers = allTeamUsers;

    const isPeerVisibleOnCurrentFloor = (peer: PeerState): boolean => {
      if (!selectedFloorId) return true; // Show all when no floor selected
      if (selectedFloorId === "FOUNDERS_FLOOR") {
        return teamMembers.get(peer.id)?.role === "founder";
      }
      if (selectedFloorId) {
        const floor = floors.find((f) => f.id === selectedFloorId);
        if (floor) {
          const isPeerOnFloor = floor.members.some((m) => m.id === peer.id);
          const isPeerFounder = teamMembers.get(peer.id)?.role === "founder";
          return isPeerOnFloor && !isPeerFounder;
        }
      }
      return false;
    };

    const spaces = new Map<string, PeerState[]>();
    allPeers.forEach((peer) => {
      if (!spaces.has(peer.spaceId)) {
        spaces.set(peer.spaceId, []);
      }
      spaces.get(peer.spaceId)!.push(peer);
    });

    const usersInPrivateMeetings = new Set<string>();
    const usersInPublicMeetings = new Set<string>();
    const usersInBookingMeetings = new Set<string>(); // New set for booking meetings
    const usersInEventMeetings = new Set<string>(); // Track users in event meetings

    for (const [spaceId, occupants] of spaces.entries()) {
      if (
        spaceId !== "lobby" &&
        !spaceId.startsWith("booking:") && // Exclude booking meetings from private
        !spaceId.startsWith("event:") && // Exclude event meetings from private
        !spaceId.startsWith("hq-room:") && // Exclude HQ room from private
        occupants.length > 1
      ) {
        occupants.forEach((p) => usersInPrivateMeetings.add(p.id));
      }
      if (spaceId.startsWith("booking:") && occupants.length > 0) {
        // Track booking meetings
        occupants.forEach((p) => usersInBookingMeetings.add(p.id));
      }
      if (spaceId.startsWith("event:") && occupants.length > 0) {
        // Track event meetings - users here are shown in EventCard, not as individual lobby cards
        occupants.forEach((p) => usersInEventMeetings.add(p.id));
      }
      if (spaceId.startsWith("hq-room:") && occupants.length > 0) {
        occupants.forEach((p) => usersInPublicMeetings.add(p.id));
      }
    }

    const cards = [];

    // Render private room cards
    for (const [spaceId, occupants] of spaces.entries()) {
      if (
        spaceId !== "lobby" &&
        !spaceId.startsWith("booking:") &&
        !spaceId.startsWith("event:") &&
        !spaceId.startsWith("hq-room:") &&
        occupants.length > 1
      ) {
        const owner = allPeers.find((p) => p.id === spaceId) || occupants[0];
        const isVisible = occupants.some(isPeerVisibleOnCurrentFloor);
        if (isVisible) {
          cards.push({
            key: `room-${spaceId}`,
            owner,
            occupants,
          });
        }
      }
    }

    // Render booking meeting room cards
    for (const [spaceId, occupants] of spaces.entries()) {
      if (spaceId.startsWith("booking:") && occupants.length > 0) {
        const isVisible = occupants.some(isPeerVisibleOnCurrentFloor);
        if (isVisible) {
          cards.push({
            key: `booking-room-${spaceId}`,
            // For bookings, there isn't a single "owner", so we can style it differently
            owner: {
              id: spaceId,
              name: "Scheduled Meeting",
              email: "",
              spaceId,
              isBooking: true,
            },
            occupants,
          });
        }
      }
    }

    // Render individual lobby cards
    allPeers.forEach((peer) => {
      if (isPeerVisibleOnCurrentFloor(peer)) {
        cards.push({
          key: `lobby-${peer.id}`,
          owner: {
            ...peer,
            isBusyInPrivateMeeting: usersInPrivateMeetings.has(peer.id),
            isBusyInPublicMeeting: usersInPublicMeetings.has(peer.id),
            isBusyInBookingMeeting: usersInBookingMeetings.has(peer.id),
            isBusyInEventMeeting: usersInEventMeetings.has(peer.id), // Add event meeting status
          },
          occupants: [peer],
        });
      }
    });

    return cards;
  }, [localPeerState, peers, selectedFloorId, floors, amIFounder, teamMembers]);

  // Separate spaces into guests and non-guests for the show-all tab layout
  // Guests are further split into customers (no referrals) and affiliates (has referrals)
  // When a community is selected, only show guests who are members of that community
  const { guestSpaces, nonGuestSpaces, customerSpaces, affiliateSpaces } =
    useMemo(() => {
      const guests: typeof spacesToRender = [];
      const nonGuests: typeof spacesToRender = [];
      const customers: typeof spacesToRender = [];
      const affiliates: typeof spacesToRender = [];

      spacesToRender.forEach((space) => {
        // Check if the owner is a guest
        const isOwnerGuest = space.owner.guest === true;
        if (isOwnerGuest) {
          // If a community is selected, only include guests who are members of it
          if (communityMemberIds && !communityMemberIds.has(space.owner.id)) {
            return;
          }
          guests.push(space);
          // Check downlineCount to determine if customer or affiliate
          const memberDetails = teamMembers.get(space.owner.id);
          const downlineCount = memberDetails?.downlineCount || 0;
          if (downlineCount > 0) {
            affiliates.push(space);
          } else {
            customers.push(space);
          }
        } else {
          nonGuests.push(space);
        }
      });

      return {
        guestSpaces: guests,
        nonGuestSpaces: nonGuests,
        customerSpaces: customers,
        affiliateSpaces: affiliates,
      };
    }, [spacesToRender, teamMembers, communityMemberIds]);

  // `lastSeenAt` is now carried on every `PeerState` produced by useFloors
  // → allTeamUsers → spacesToRender → owner, so each <UserSpaceCard> reads
  // it directly from `owner.lastSeenAt`. The separate `/users/last-seen`
  // batch path was removed — it duplicated data already present in the
  // `/team/list` payload the sidebar uses.

  const leavePrivateSpace = useCallback(() => {
    setMySpaceId("lobby");
    updatePeerState(me, { spaceId: "lobby" });
    connectSocket().emit("workspace:move-to-space", { spaceId: "lobby" });
  }, [me, updatePeerState]);

  // Reset local space state without emitting socket event
  // (leaveCall() already emits workspace:move-to-space)
  const resetLocalSpaceState = useCallback(() => {
    setMySpaceId("lobby");
    updatePeerState(me, { spaceId: "lobby" });
  }, [me, updatePeerState]);

  // End a knock call (audio-only) from the workspace card
  const handleEndKnockCall = useCallback(async () => {
    // Reset local state immediately for responsive UI
    resetLocalSpaceState();
    // Then await full cleanup (leaveCall also moves to lobby on backend)
    await leaveCall();
  }, [leaveCall, resetLocalSpaceState]);

  const endMeetingForAll = useCallback(() => {
    setMySpaceId("lobby");
    updatePeerState(me, { spaceId: "lobby" });
    connectSocket().emit("workspace:end-meeting");
  }, [me, updatePeerState]);

  const isInMeeting = useMemo(() => {
    if (mySpaceId === "lobby") return false;
    if (mySpaceId.startsWith("booking:")) return true; // Booking meetings count as being in a meeting
    if (mySpaceId.startsWith("event:")) return true; // Event meetings count as being in a meeting
    if (mySpaceId.startsWith("community-stream:")) return true; // Community streams count as being in a meeting
    if (mySpaceId.startsWith("hq-room:")) return true; // HQ room counts as being in a meeting
    if (mySpaceId !== me) return true;
    const occupantsInMySpace = audioPeers.filter(
      (p) => p.spaceId === mySpaceId
    );
    return occupantsInMySpace.some((p) => p.id !== me);
  }, [mySpaceId, me, audioPeers]);

  const amIHost = useMemo(() => {
    if (!isInMeeting || mySpaceId !== me) return false;
    const occupantsInMySpace = audioPeers.filter((p) => p.spaceId === me);
    return occupantsInMySpace.length > 1;
  }, [isInMeeting, mySpaceId, me, audioPeers]);

  const participantsInCurrentSpace = useMemo(() => {
    return audioPeers.filter((peer) => peer.spaceId === mySpaceId);
  }, [audioPeers, mySpaceId]);

  const activeRecorder = useMemo(() => {
    return participantsInCurrentSpace.find((peer) => peer.isRecording);
  }, [participantsInCurrentSpace]);

  const activeRecorderName = useMemo(() => {
    if (!activeRecorder) return null;
    return activeRecorder.name || activeRecorder.email || "Someone";
  }, [activeRecorder]);

  // State for recording banner visibility
  const [showFullRecordingBanner, setShowFullRecordingBanner] = useState(true);

  // Auto-hide banner after 2 seconds
  useEffect(() => {
    if (activeRecorder) {
      setShowFullRecordingBanner(true);
      const timer = setTimeout(() => {
        setShowFullRecordingBanner(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [activeRecorder]);

  const screenShareVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  useEffect(() => {
    watchingScreenShareRef.current = watchingScreenShare;
  }, [watchingScreenShare]);

  useEffect(() => {
    const videoElement = screenShareVideoRef.current;
    if (!videoElement) return;

    const screenTrack = getPreferredScreenTrack(
      watchingScreenShare?.stream ?? null,
      watchingScreenShare?.isScreenSharing
    );

    if (watchingScreenShare?.stream && screenTrack) {
      if (videoElement.srcObject !== watchingScreenShare.stream) {
        videoElement.srcObject = watchingScreenShare.stream;
      }
    } else if (videoElement.srcObject) {
      videoElement.srcObject = null;
    }
  }, [watchingScreenShare]);

  useEffect(() => {
    if (!watchingScreenShare?.stream) return;
    const screenTrack = getPreferredScreenTrack(
      watchingScreenShare.stream,
      watchingScreenShare.isScreenSharing
    );
    if (!screenTrack) {
      closeWatchingScreenShare();
      return;
    }

    const handleEnded = () => {
      closeWatchingScreenShare();
    };

    screenTrack.addEventListener("ended", handleEnded);
    return () => {
      screenTrack.removeEventListener("ended", handleEnded);
    };
  }, [watchingScreenShare, closeWatchingScreenShare]);

  // Clean up Daily screen share state when call ends
  useEffect(() => {
    if (!inCall) {
      // Clear all remote screen sharers when the call ends
      setRemoteScreenSharers((prev) => {
        if (prev.size > 0) {
          console.log(
            "[WorkspaceClient] Call ended, clearing all Daily screen share state"
          );
          return new Set();
        }
        return prev;
      });
      // Also reset the manual screen share view toggle
      setShowScreenShareView(false);
    }
  }, [inCall]);

  // Reset screen share view toggle when no one is screen sharing anymore
  useEffect(() => {
    const someoneIsScreenSharing =
      isDailyScreenSharing ||
      localScreenTrack ||
      remoteScreenSharers.size > 0;
    if (!someoneIsScreenSharing) {
      setShowScreenShareView(false);
    }
  }, [isDailyScreenSharing, localScreenTrack, remoteScreenSharers.size]);

  // Auto-toggle screen share view ON when ANYONE starts screen sharing
  useEffect(() => {
    const someoneIsSharing =
      isDailyScreenSharing || localScreenTrack || remoteScreenSharers.size > 0;
    if (someoneIsSharing) {
      setShowScreenShareView(true);
    }
  }, [isDailyScreenSharing, localScreenTrack, remoteScreenSharers.size]);

  // Sync remoteScreenSharers from Daily SDK track state (fallback for socket event timing)
  useEffect(() => {
    remoteUserTracks.forEach((tracks, userId) => {
      if (tracks.hasScreenVideo && !remoteScreenSharers.has(userId)) {
        setRemoteScreenSharers((prev) => {
          const newSet = new Set(prev);
          newSet.add(userId);
          return newSet;
        });
      } else if (!tracks.hasScreenVideo && !tracks.screenTrack && remoteScreenSharers.has(userId)) {
        setRemoteScreenSharers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    });
  }, [remoteUserTracks, remoteScreenSharers]);

  // Sync camera UI state with actual camera track state
  useEffect(() => {
    // Camera is off when localVideoTrack is null (no camera track)
    const isCameraOff = !localVideoTrack;
    setDailyCameraOff(isCameraOff);
  }, [localVideoTrack]);

  // useEffect(() => {
  //   if (!watchingScreenShare) return;

  //   const handleKeyDown = (event: KeyboardEvent) => {
  //     if (event.key === 'Escape') {
  //       event.preventDefault();
  //       closeWatchingScreenShare();
  //     }
  //   };

  //   window.addEventListener('keydown', handleKeyDown);
  //   return () => window.removeEventListener('keydown', handleKeyDown);
  // }, [watchingScreenShare, closeWatchingScreenShare]);

  useEffect(() => {
    if (!watchingScreenShare) return;

    const videoNode = screenShareVideoRef.current;
    if (!videoNode) return;

    try {
      videoNode.disablePictureInPicture = false;
    } catch (error) {
      console.warn("Unable to update disablePictureInPicture flag", error);
    }

    const doc = document as Document & {
      pictureInPictureElement?: Element | null;
      exitPictureInPicture?: () => Promise<void>;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (
          (doc.pictureInPictureElement ?? null) !== videoNode &&
          typeof videoNode.requestPictureInPicture === "function"
        ) {
          videoNode.requestPictureInPicture().catch(() => undefined);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [watchingScreenShare]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      const container = screenShareContainerRef.current;
      const isActive = !!container && document.fullscreenElement === container;
      setIsScreenShareFullscreenActive(isActive);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [watchingScreenShare]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const docSupport =
      "pictureInPictureEnabled" in document
        ? Boolean((document as any).pictureInPictureEnabled)
        : false;
    const videoProto = window.HTMLVideoElement?.prototype as any;
    const methodSupport = Boolean(
      videoProto && videoProto.requestPictureInPicture
    );

    setPipSupported(docSupport || methodSupport);
  }, []);

  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video) return;

    if (recordingPreviewStream) {
      if (video.srcObject !== recordingPreviewStream) {
        video.srcObject = recordingPreviewStream;
      }
    } else if (video.srcObject) {
      video.srcObject = null;
    }
  }, [recordingPreviewStream]);

  useEffect(() => {
    if (!recordingPreviewStream) {
      setPipError(null);
      setIsPiPActive(false);
    }
  }, [recordingPreviewStream]);

  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video) return;

    const handleLeave = () => setIsPiPActive(false);
    video.addEventListener("leavepictureinpicture", handleLeave);
    return () =>
      video.removeEventListener("leavepictureinpicture", handleLeave);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const doc = document as any;
    if (!recordingPreviewStream && doc.pictureInPictureElement) {
      doc.exitPictureInPicture?.().catch(() => undefined);
    }
  }, [recordingPreviewStream]);

  useEffect(() => {
    if (!watchingScreenShare && typeof document !== "undefined") {
      const container = screenShareContainerRef.current;
      if (container && document.fullscreenElement === container) {
        void document.exitFullscreen().catch(() => { });
      }
      setIsScreenShareFullscreenActive(false);
    }
  }, [watchingScreenShare]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setShowFloorsPopover(false);
    };

    if (showFloorsPopover) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showFloorsPopover]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setShowMembersPopover(false);
    };

    if (showMembersPopover) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showMembersPopover]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationsHubRef.current &&
        !notificationsHubRef.current.contains(event.target as Node)
      ) {
        setShowNotificationsHub(false);
      }
    };

    if (showNotificationsHub) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showNotificationsHub]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setShowStatusSelector(false);
    };

    if (showStatusSelector) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showStatusSelector]);

  useEffect(() => {
    if (!shouldForceRecording) return;
    if (autoRecordingTriggered) return;
    if (!localStream) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    )
      return;

    setAutoRecordingTriggered(true);
    void startRecording().catch((error) => {
      console.error("Auto-start recording failed:", error);
    });
  }, [
    shouldForceRecording,
    autoRecordingTriggered,
    localStream,
    startRecording,
  ]);

  // Removed restriction that prevented recording in non-HQ workspaces
  // Users can now record in any workspace

  useEffect(() => {
    if (!shouldForceRecording) {
      setAutoRecordingTriggered(false);
    }
  }, [shouldForceRecording]);

  useEffect(() => {
    return () => {
      if (autoRecordingEnabled && isRecording) {
        stopRecording();
      }
    };
  }, [autoRecordingEnabled, isRecording, stopRecording]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBlur = () => {
      if (isInMeeting || isRecording) {
        setShowFocusReminder(true);
      }
    };

    const handleFocus = () => setShowFocusReminder(false);

    const handleVisibility = () => {
      if (
        document.visibilityState === "hidden" &&
        (isInMeeting || isRecording)
      ) {
        setShowFocusReminder(true);
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isInMeeting, isRecording]);

  useEffect(() => {
    if (!isInMeeting && !isRecording) {
      setShowFocusReminder(false);
    }
  }, [isInMeeting, isRecording]);

  // Listen for custom event to join a space (e.g., from Calendar)
  useEffect(() => {
    const handleJoinSpaceEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ spaceId: string }>;
      const { spaceId } = customEvent.detail;
      if (spaceId) {
        connectSocket().emit("workspace:move-to-space", { spaceId });
      }
    };

    window.addEventListener("workspace:join-space", handleJoinSpaceEvent);
    return () => {
      window.removeEventListener("workspace:join-space", handleJoinSpaceEvent);
    };
  }, []);

  useEffect(() => {
    if (!localStream) return;
    const socket = connectSocket();

    // Queue for ICE candidates that arrive before remote description is set
    const pendingCandidates = new Map<string, RTCIceCandidate[]>();

    const handleSignal = async ({ from, signal }: any) => {
      try {
        const pc = setupPeerConnection(from);

        if (signal.sdp) {
          const sdp = new RTCSessionDescription(signal.sdp);

          // Set remote description
          await pc.setRemoteDescription(sdp);
          console.log(
            `[Workspace] Set remote ${sdp.type} from ${from}, signaling state: ${pc.signalingState}`
          );

          // Process any pending ICE candidates now that remote description is set
          const candidates = pendingCandidates.get(from);
          if (candidates && candidates.length > 0) {
            console.log(
              `[Workspace] Processing ${candidates.length} pending ICE candidates for ${from}`
            );
            for (const candidate of candidates) {
              try {
                await pc.addIceCandidate(candidate);
              } catch (err) {
                console.error(
                  `[Workspace] Failed to add queued ICE candidate for ${from}:`,
                  err
                );
              }
            }
            pendingCandidates.delete(from);
          }

          // Handle offer by creating and sending answer
          if (sdp.type === "offer") {
            try {
              // Check if we already have a local description (avoid duplicate answers)
              if (pc.localDescription) {
                console.log(
                  `[Workspace] Already have local description for ${from}, skipping answer`
                );
                return;
              }

              const answer = await pc.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              });
              await pc.setLocalDescription(answer);

              console.log(
                `[Workspace] Created and set local answer for ${from}`
              );

              if (pc.localDescription) {
                socket.emit("workspace:signal", {
                  to: from,
                  from: me,
                  signal: { sdp: pc.localDescription },
                });
              }
            } catch (err) {
              console.error(
                `[Workspace] Failed to create answer for ${from}:`,
                err
              );
            }
          }
        } else if (signal.candidate) {
          const candidate = new RTCIceCandidate(signal.candidate);

          // Only add ICE candidate if remote description is set
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(candidate);
              console.log(`[Workspace] Added ICE candidate from ${from}`);
            } catch (err) {
              console.error(
                `[Workspace] Failed to add ICE candidate from ${from}:`,
                err
              );
            }
          } else {
            // Queue the candidate until remote description is set
            console.log(
              `[Workspace] Queuing ICE candidate from ${from} (waiting for remote description)`
            );
            if (!pendingCandidates.has(from)) {
              pendingCandidates.set(from, []);
            }
            pendingCandidates.get(from)!.push(candidate);
          }
        }
      } catch (err) {
        console.error(
          `[Workspace] Error handling signal from ${signal?.from || "unknown"
          }:`,
          err
        );
      }
    };
    // Stop the looping knock ringtone and close the browser notification
    const stopKnockRing = () => {
      if (knockAudioRef.current) {
        knockAudioRef.current.pause();
        knockAudioRef.current.currentTime = 0;
        knockAudioRef.current = null;
      }
      if (knockNotificationRef.current) {
        knockNotificationRef.current.close();
        knockNotificationRef.current = null;
      }
    };
    const handleKnockAccepted = ({
      by,
      byName,
    }: {
      by: string;
      byName: string;
    }) => {
      console.log("[WorkspaceClient] >>> workspace:knock-accepted received!", { by, byName });
      stopKnockRing();
      // Only the device that initiated the knock joins the call — the backend
      // broadcasts knock-accepted to all of the knocker's devices, but
      // livekit:join-call only goes to the originating one.
      if (knockingIdRef.current === by) {
        setJoiningSpace({ id: by, name: byName });
      }
      setKnockingId(null);
    };
    const handleKnockDeclined = () => {
      stopKnockRing();
      setKnockingId(null);
      setKnockDeclinedToast(true);
      setTimeout(() => setKnockDeclinedToast(false), 4000);
    };
    const handleKnockCancelled = () => {
      stopKnockRing();
      // Clear the knock request when the sender cancels it
      setKnockRequest(null);
    };
    // Target is offline with no push token — clear the knocking overlay so it
    // doesn't hang forever
    const handleKnockUnreachable = ({ targetId }: { targetId: string }) => {
      setKnockingId((cur) => (cur === targetId ? null : cur));
      toast.error("This person is offline and can't be reached right now.");
    };
    // Another of MY devices accepted/declined this knock — dismiss the ring here
    const handleKnockHandled = ({
      from,
      action,
    }: {
      from: string;
      action: "accepted" | "declined";
    }) => {
      console.log(
        `[WorkspaceClient] Knock from ${from} was ${action} on another device — dismissing ring`
      );
      stopKnockRing();
      setKnockRequest(null);
    };
    // I answered a call on another device — clear any lingering knock/joining UI
    const handleCallAnsweredElsewhereUI = () => {
      stopKnockRing();
      setKnockRequest(null);
      setKnockingId(null);
      setJoiningSpace(null);
    };
    const handleRenegotiationNeeded = async ({
      from,
      offer,
    }: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      try {
        const pc = peerConnections.current.get(from);
        if (!pc) {
          console.error(
            `[Workspace] No peer connection found for renegotiation from ${from}`
          );
          return;
        }

        // Check signaling state before setting remote description
        if (pc.signalingState === "closed") {
          console.error(
            `[Workspace] Peer connection closed for ${from}, cannot renegotiate`
          );
          return;
        }

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(answer);

        if (pc.localDescription) {
          socket.emit("renegotiation-accepted", {
            to: from,
            answer: pc.localDescription,
          });
          console.log(`[Workspace] Sent renegotiation answer to ${from}`);
        }
      } catch (err) {
        console.error(
          `[Workspace] Error handling renegotiation from ${from}:`,
          err
        );
      }
    };

    const handleRenegotiationAccepted = async ({
      from,
      answer,
    }: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      try {
        const pc = peerConnections.current.get(from);
        if (!pc) {
          console.error(
            `[Workspace] No peer connection found for renegotiation acceptance from ${from}`
          );
          return;
        }

        if (pc.signalingState === "closed") {
          console.error(
            `[Workspace] Peer connection closed for ${from}, cannot accept renegotiation`
          );
          return;
        }

        await pc.setRemoteDescription(answer);
        console.log(
          `[Workspace] Set remote description for renegotiation from ${from}`
        );
      } catch (err) {
        console.error(
          `[Workspace] Error accepting renegotiation from ${from}:`,
          err
        );
      }
    };

    const handleScreenShareState = ({
      userId: sharerId,
      isSharing,
    }: {
      userId: string;
      isSharing: boolean;
    }) => {
      if (sharerId === me) {
        setIsScreenSharing(isSharing);
      }

      updatePeerState(sharerId, { isScreenSharing: isSharing });

      if (!isSharing && watchingScreenShareRef.current?.id === sharerId) {
        closeWatchingScreenShare();
      }
    };

    const handleRecordingStateChange = ({
      userId,
      isRecording,
    }: {
      userId: string;
      isRecording: boolean;
    }) => {
      updatePeerState(userId, { isRecording });
    };

    const handleDailyScreenShareState = ({
      userId,
      isSharing,
    }: {
      userId: string;
      isSharing: boolean;
    }) => {
      console.log("[WorkspaceClient] Daily screen share state changed:", {
        userId,
        isSharing,
      });

      // Only track remote screen sharers (not ourselves)
      if (userId === me) return;

      setRemoteScreenSharers((prev) => {
        const newSet = new Set(prev);
        if (isSharing) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });

      // Also update peer state to keep consistency
      updatePeerState(userId, { isScreenSharing: isSharing });
    };

    // Handle full participants update (for event meetings screen share state sync)
    const handleDailyParticipantsUpdate = (data: {
      channel: string;
      participants?: Array<{
        userId: string;
        isScreenSharing?: boolean;
      }>;
    }) => {
      console.log("[WorkspaceClient] Daily participants update:", data);

      if (data.participants) {
        // Update screen sharers set from participants data
        const newSharers = new Set<string>();
        data.participants.forEach((p) => {
          if (p.isScreenSharing && p.userId !== me) {
            newSharers.add(p.userId);
          }
          // Also update peer state for each participant
          if (p.userId !== me) {
            updatePeerState(p.userId, { isScreenSharing: !!p.isScreenSharing });
          }
        });
        setRemoteScreenSharers(newSharers);
        console.log(
          "[WorkspaceClient] Updated screen sharers from participants:",
          Array.from(newSharers)
        );
      }
    };

    socket.on("workspace:users", (users: PeerState[]) => {
      console.log(
        "[WORKSPACE] Received initial workspace:users, count:",
        users.length,
        users
      );
      // Filter out current user - we don't add ourselves to the peers map
      const otherUsers = users.filter((u) => u.id !== me);
      console.log(
        "[WORKSPACE] Filtered initial users to other users:",
        otherUsers.length
      );
      setPeers(
        new Map(
          otherUsers.map((u) => [
            u.id,
            {
              ...u,
              isScreenSharing: !!u.isScreenSharing,
              isRecording: !!u.isRecording,
            },
          ])
        )
      );
    });
    socket.on("workspace:user-joined", (user: PeerState) => {
      console.log("[WORKSPACE] Received workspace:user-joined event:", user);
      // Don't add ourselves to the peers map
      if (user.id === me) {
        console.log("[WORKSPACE] Ignoring user-joined for self");
        return;
      }
      setPeers((prev) => {
        const newPeers = new Map(prev).set(user.id, {
          ...user,
          isScreenSharing: !!user.isScreenSharing,
          isRecording: !!user.isRecording,
        });
        console.log(
          "[WORKSPACE] Updated peers map, total users:",
          newPeers.size
        );
        return newPeers;
      });
      // Dispatch event for Betty
      if (amIFounder) {
        const event = new CustomEvent("betty:message", {
          detail: { text: `${user.name || user.email} just came online.` },
        });
        window.dispatchEvent(event);
      }
    });
    socket.on("workspace:user-left", ({ id }: any) => {
      // Dispatch event for Betty BEFORE removing the user
      if (amIFounder) {
        setPeers((prev) => {
          const user = prev.get(id);
          if (user) {
            const event = new CustomEvent("betty:message", {
              detail: { text: `${user.name || user.email} went offline.` },
            });
            window.dispatchEvent(event);
          }
          const n = new Map(prev);
          n.delete(id);
          return n;
        });
      }

      peerConnections.current.get(id)?.close();
      peerConnections.current.delete(id);
      trackSenders.current.delete(id);
      makingOfferRef.current.delete(id);

      // Clean up pending ICE candidates for this peer
      pendingCandidates.delete(id);

      if (!amIFounder) {
        // If not founder, just update state without event
        setPeers((prev) => {
          const n = new Map(prev);
          n.delete(id);
          return n;
        });
      }
      if (watchingScreenShareRef.current?.id === id) {
        closeWatchingScreenShare();
      }

      // Clean up Daily screen share state if this user was sharing
      setRemoteScreenSharers((prev) => {
        if (prev.has(id)) {
          const newSet = new Set(prev);
          newSet.delete(id);
          console.log(
            `[WorkspaceClient] Cleaned up Daily screen share state for left user ${id}`
          );
          return newSet;
        }
        return prev;
      });
    });
    socket.on("workspace:user-moved-space", ({ userId, spaceId }) => {
      if (userId === me) {
        setMySpaceId(spaceId);
        // Clear joining state if returning to lobby (error/leave)
        if (spaceId === "lobby") setJoiningSpaceId(null);
      } else updatePeerState(userId, { spaceId });
    });
    socket.on("workspace:user-status-changed", ({ userId, status }) => {
      updatePeerState(userId, { status });
      // Dispatch event for Betty
      if (amIFounder) {
        setPeers((prev) => {
          const user = prev.get(userId);
          if (user) {
            let statusText = "";
            if (status === "busy") statusText = "is now busy.";
            else if (status === "afk") statusText = "is now away.";
            else if (status === "available") statusText = "is now available.";

            if (statusText) {
              const event = new CustomEvent("betty:message", {
                detail: { text: `${user.name || user.email} ${statusText}` },
              });
              window.dispatchEvent(event);
            }
          }
          return prev; // No need to change the peers map here, just read from it
        });
      }
    });
    socket.on("workspace:join-space", ({ spaceId }) =>
      socket.emit("workspace:move-to-space", { spaceId })
    );
    // if (!enableDaily) {
    //   socket.on("workspace:signal", handleSignal);
    //   socket.on("renegotiation-needed", handleRenegotiationNeeded);
    //   socket.on("renegotiation-accepted", handleRenegotiationAccepted);
    // }
    const handleKnockRequestEvent = (data: {
      from: string;
      fromName: string;
      fromProfilePicture?: string;
    }) => {
      setKnockRequest(data);

      // Play knock notification sound in loop (regardless of browser
      // notification permission — the in-page knock panel always shows)
      try {
        // Stop any existing knock audio
        if (knockAudioRef.current) {
          knockAudioRef.current.pause();
          knockAudioRef.current.currentTime = 0;
        }

        const audio = new Audio("/knock.mp3");
        audio.volume = 0.5;
        audio.loop = true; // Enable looping
        knockAudioRef.current = audio;

        audio.play().catch((error) => {
          console.error(
            "[WorkspaceClient] Failed to play knock sound:",
            error
          );
          // Fallback to beep (non-looping for fallback)
          try {
            const audioContext = new (window.AudioContext ||
              (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = "sine";

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
              0.01,
              audioContext.currentTime + 0.5
            );

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
          } catch (fallbackError) {
            console.error(
              "[WorkspaceClient] Fallback sound also failed:",
              fallbackError
            );
          }
        });
      } catch (soundError) {
        console.error(
          "[WorkspaceClient] Failed to create audio element:",
          soundError
        );
      }

      // Show browser notification for knock request
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        data?.from &&
        data?.fromName
      ) {
        try {
          console.log(
            "[WorkspaceClient] Showing knock request notification:",
            data
          );

          const notification = new Notification("🚪 Someone is knocking", {
            body: `${data.fromName} wants to join your space`,
            icon: data.fromProfilePicture || undefined,
            badge: "/logo.svg",
            tag: `knock-${data.from}`,
            requireInteraction: true, // Keep notification until user interacts
            silent: false,
          });
          // Keep a ref so the notification can be closed when the knock is
          // handled here or on another device
          knockNotificationRef.current = notification;

          // Click handler to focus the window
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (error) {
          console.error(
            "[WorkspaceClient] Failed to show knock notification:",
            error
          );
        }
      }
    };
    socket.on("workspace:knock-request", handleKnockRequestEvent);
    socket.on("workspace:knock-accepted", handleKnockAccepted);
    socket.on("workspace:knock-declined", handleKnockDeclined);
    socket.on("workspace:knock-cancelled", handleKnockCancelled);
    socket.on("workspace:knock-unreachable", handleKnockUnreachable);
    socket.on("workspace:knock-handled", handleKnockHandled);
    socket.on("livekit:call-answered-elsewhere", handleCallAnsweredElsewhereUI);
    socket.on("workspace:screen-share-state", handleScreenShareState);
    socket.on("workspace:user-recording-changed", handleRecordingStateChange);
    socket.on("livekit:screen-share-state", handleDailyScreenShareState);
    socket.on("livekit:participants-update", handleDailyParticipantsUpdate);

    // Handle LiveKit call events to clear knocking state and initialize screen share state
    const handleDailyCallJoin = (data: {
      participants?: Array<{ userId: string; isScreenSharing?: boolean }>;
    }) => {
      // Clear knocking overlay immediately when call event arrives
      setKnockingId(null);

      // Clear stale screen share state when joining a new call
      setRemoteScreenSharers(new Set());

      // If participants data includes screen share status, initialize it
      if (data.participants) {
        const sharers = data.participants
          .filter((p) => p.isScreenSharing && p.userId !== me)
          .map((p) => p.userId);
        if (sharers.length > 0) {
          setRemoteScreenSharers(new Set(sharers));
          console.log(
            "[WorkspaceClient] Initialized screen sharers from participants:",
            sharers
          );
        }
      }
    };
    socket.on("livekit:init-call", handleDailyCallJoin);
    socket.on("livekit:join-call", handleDailyCallJoin);

    // Handle presence sync broadcasts (self-healing mechanism)
    const handlePresenceSync = (data: {
      users: PeerState[];
      timestamp: number;
    }) => {
      console.log(
        "[WORKSPACE] Received presence-sync, reconciling:",
        data.users.length,
        "users"
      );
      // Filter out current user - we don't add ourselves to the peers map
      const otherUsers = data.users.filter((u) => u.id !== me);
      console.log("[WORKSPACE] Filtered to other users:", otherUsers.length);
      setPeers(
        new Map(
          otherUsers.map((u) => [
            u.id,
            {
              ...u,
              isScreenSharing: !!u.isScreenSharing,
              isRecording: !!u.isRecording,
            },
          ])
        )
      );
    };

    socket.on("workspace:presence-sync", handlePresenceSync);

    // Handle join confirmation (ensures we're actually online)
    let joinConfirmed = false;
    let joinRetryTimeout: NodeJS.Timeout | null = null;

    const handleJoinConfirmed = (data: {
      success: boolean;
      user: any;
      timestamp: number;
    }) => {
      console.log("[WORKSPACE] Join confirmed by server:", data);
      joinConfirmed = true;
      if (joinRetryTimeout) {
        clearTimeout(joinRetryTimeout);
        joinRetryTimeout = null;
      }

      // Knock accepted on another page: the layout's GlobalKnockRing stashed
      // the accept and navigated here. Emit it only now — the backend's
      // knock-accept handler silently no-ops unless we're in workspace
      // presence, which this confirmation guarantees. The ts guard voids
      // stale entries so a leftover accept can't yank the knocker into a
      // call long after they gave up.
      try {
        const raw = sessionStorage.getItem("workspace:pending-knock-accept");
        if (raw) {
          sessionStorage.removeItem("workspace:pending-knock-accept");
          const pending = JSON.parse(raw) as { from?: string; ts?: number };
          if (pending?.from && Date.now() - (pending.ts ?? 0) < 15_000) {
            console.log(
              "[WORKSPACE] Emitting knock-accept stashed by GlobalKnockRing for",
              pending.from
            );
            socket.emit("workspace:knock-accept", {
              targetId: pending.from,
              byName: localPeerState?.name || "A colleague",
              by: me,
            });
          }
        }
      } catch {}

      // Pre-fetch and cache Revenue Network data (storeId, customerId) for faster page loads
      fetchAndCacheRevenueNetworkData();
    };

    socket.on("workspace:join-confirmed", handleJoinConfirmed);

    // Emit workspace:join with retry logic
    console.log("[WORKSPACE] Emitting workspace:join");
    socket.emit("workspace:join");

    // If no confirmation in 3 seconds, retry once
    joinRetryTimeout = setTimeout(() => {
      if (!joinConfirmed) {
        console.warn("[WORKSPACE] No join confirmation received, retrying...");
        socket.emit("workspace:join");

        // If still no confirmation after second attempt, request full sync
        setTimeout(() => {
          if (!joinConfirmed) {
            console.warn(
              "[WORKSPACE] Join still not confirmed, requesting sync"
            );
            socket.emit("workspace:request-sync");
          }
        }, 3000);
      }
    }, 3000);

    // Heartbeat to keep presence alive (every 4 minutes)
    const heartbeatInterval = setInterval(() => {
      socket.emit("workspace:heartbeat");
      console.log("[WORKSPACE] Heartbeat sent");
    }, 4 * 60 * 1000); // 4 minutes

    socket.on("workspace:heartbeat-ack", (data: { timestamp: number }) => {
      console.log("[WORKSPACE] Heartbeat acknowledged");
    });
    return () => {
      // CRITICAL: Emit workspace:leave to instantly remove presence
      console.log("[WORKSPACE] Component unmounting, emitting workspace:leave");
      socket.emit("workspace:leave");

      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      // Clear join retry timeout
      if (joinRetryTimeout) {
        clearTimeout(joinRetryTimeout);
      }

      // Stop knock notification audio on cleanup
      if (knockAudioRef.current) {
        knockAudioRef.current.pause();
        knockAudioRef.current.currentTime = 0;
        knockAudioRef.current = null;
      }

      socket.off("workspace:users");
      socket.off("workspace:user-joined");
      socket.off("workspace:user-left");
      socket.off("workspace:user-moved-space");
      socket.off("workspace:user-status-changed");
      socket.off("workspace:join-space");
      socket.off("workspace:join-confirmed");
      socket.off("workspace:heartbeat-ack");
      socket.off("workspace:presence-sync");
      // if (!enableDaily) {
      //   socket.off("workspace:signal");
      //   socket.off("renegotiation-needed");
      //   socket.off("renegotiation-accepted");
      // }
      // Pass the handlers — the dashboard layout's GlobalKnockRing also
      // listens on knock-request/cancelled and a bare off() would remove
      // its listeners too, killing knock rings on every other page
      socket.off("workspace:knock-request", handleKnockRequestEvent);
      socket.off("workspace:knock-accepted");
      socket.off("workspace:knock-declined");
      socket.off("workspace:knock-cancelled", handleKnockCancelled);
      socket.off("workspace:knock-unreachable", handleKnockUnreachable);
      socket.off("workspace:knock-handled", handleKnockHandled);
      // Pass the handler — useLiveKit also listens on this event and a bare
      // off() would remove its listener too
      socket.off("livekit:call-answered-elsewhere", handleCallAnsweredElsewhereUI);
      socket.off("workspace:screen-share-state");
      socket.off("workspace:user-recording-changed");
      socket.off("livekit:screen-share-state");
      socket.off("livekit:participants-update");
      socket.off("livekit:init-call");
      socket.off("livekit:join-call");

      // Clean up pending ICE candidates
      pendingCandidates.clear();
    };
  }, [
    me,
    amIFounder,
    setupPeerConnection,
    localStream,
    closeWatchingScreenShare,
    setKnockDeclinedToast,
    setKnockRequest,
    setJoiningSpace,
    setKnockingId,
    updatePeerState,
    setPeers,
    peerConnections,
    trackSenders,
    makingOfferRef,
    watchingScreenShareRef,
    setIsScreenSharing,
    // enableDaily,
  ]);

  useEffect(() => {
    if (joiningSpace && mySpaceId === joiningSpace.id) {
      setJoiningSpace(null);
    }
  }, [mySpaceId, joiningSpace, setJoiningSpace]);

  useEffect(() => {
    if (mySpaceId !== "lobby") {
      setShowStatusSelector(false);
    }
  }, [mySpaceId, setShowStatusSelector]);

  useEffect(() => {
    if (mySpaceId !== "lobby") {
      setShowTodoMenu(false);
    }
  }, [mySpaceId]);

  // Exit fullscreen view when leaving meeting
  useEffect(() => {
    if (!isInMeeting && isMeetingViewFullscreen) {
      setIsMeetingViewFullscreen(false);
    }
  }, [isInMeeting, isMeetingViewFullscreen]);

  // Exit fullscreen screen share when peer stops sharing
  useEffect(() => {
    if (!fullscreenScreenSharePeer) return;

    const peer = participantsInCurrentSpace.find(
      (p) => p.id === fullscreenScreenSharePeer
    );

    if (!peer || !peer.isScreenSharing) {
      setFullscreenScreenSharePeer(null);
    }
  }, [fullscreenScreenSharePeer, participantsInCurrentSpace]);

  useEffect(() => {
    // if (enableDaily) return; // Daily path handles media routing; skip mesh offers
    if (!localStream || mySpaceId === "lobby") {
      peerConnections.current.forEach((pc, peerId) => {
        pc.close();
        makingOfferRef.current.delete(peerId);
      });
      peerConnections.current.clear();
      trackSenders.current.clear();
      makingOfferRef.current.clear();
      return;
    }
    const socket = connectSocket();
    const peersInMySpace = Array.from(peers.values()).filter(
      (p) => p.spaceId === mySpaceId && p.id !== me
    );

    // Staggered connection establishment for multiple peers
    // Process peers in batches to avoid overwhelming the system
    const BATCH_SIZE = 3; // Connect to 3 peers at a time
    const DELAY_BETWEEN_BATCHES = 500; // 500ms between batches

    const peersToConnect = peersInMySpace.filter(
      (peer) => !peerConnections.current.has(peer.id)
    );

    const timeoutIds: NodeJS.Timeout[] = [];

    // Group peers into batches
    for (let i = 0; i < peersToConnect.length; i += BATCH_SIZE) {
      const batch = peersToConnect.slice(i, i + BATCH_SIZE);
      const delay = i * DELAY_BETWEEN_BATCHES;

      const timeoutId = setTimeout(() => {
        batch.forEach((peer) => {
          if (!peerConnections.current.has(peer.id)) {
            try {
              const pc = setupPeerConnection(peer.id);
              // Only the peer with smaller ID creates the offer (to avoid duplicate offers)
              if (me < peer.id) {
                pc.createOffer()
                  .then((offer) => {
                    if (
                      pc.signalingState === "stable" ||
                      pc.signalingState === "have-local-offer"
                    ) {
                      return pc.setLocalDescription(offer);
                    }
                    return Promise.resolve();
                  })
                  .then(() => {
                    if (pc.localDescription) {
                      socket.emit("workspace:signal", {
                        to: peer.id,
                        from: me,
                        signal: { sdp: pc.localDescription },
                      });
                    }
                  })
                  .catch((err) => {
                    console.error(
                      `[Workspace] Failed to create offer for ${peer.id}:`,
                      err
                    );
                  });
              }
            } catch (err) {
              console.error(
                `[Workspace] Failed to setup peer connection for ${peer.id}:`,
                err
              );
            }
          }
        });
      }, delay);

      timeoutIds.push(timeoutId);
    }

    // Clean up connections for peers no longer in the space
    peerConnections.current.forEach((pc, peerId) => {
      if (!peersInMySpace.some((p) => p.id === peerId)) {
        if (removePeerConnection) {
          removePeerConnection(peerId);
        } else {
          pc.close();
          peerConnections.current.delete(peerId);
          trackSenders.current.delete(peerId);
          makingOfferRef.current.delete(peerId);
        }
      }
    });

    // Cleanup function to clear timeouts if component unmounts or dependencies change
    return () => {
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [
    peers,
    mySpaceId,
    localStream,
    me,
    setupPeerConnection,
    peerConnections,
    makingOfferRef,
    trackSenders,
    removePeerConnection,
  ]);

  useEffect(() => {
    if (mySpaceId === "lobby" && isScreenSharingRef.current) {
      console.log("Workspace: Moved to lobby, stopping screen share.");
      stopScreenShare();
    }
  }, [mySpaceId, stopScreenShare, isScreenSharingRef]);

  const handleEnterPiP = useCallback(async () => {
    if (typeof document === "undefined") return;
    if (!pipSupported) return;
    const video = pipVideoRef.current;
    if (!video || !recordingPreviewStream) return;

    setPipError(null);

    try {
      const doc = document as any;
      if (doc.pictureInPictureElement) {
        await doc.exitPictureInPicture();
      }

      await video.requestPictureInPicture();
      setIsPiPActive(true);
    } catch (err) {
      console.error("Failed to enter PiP:", err);
      setPipError("Picture-in-picture is blocked by your browser.");
    }
  }, [pipSupported, recordingPreviewStream]);

  const handleExitPiP = useCallback(async () => {
    if (typeof document === "undefined") return;
    const doc = document as any;
    if (!doc.pictureInPictureElement) return;
    try {
      await doc.exitPictureInPicture();
      setIsPiPActive(false);
    } catch (err) {
      console.error("Failed to exit PiP:", err);
    }
  }, []);

  // PIP Preview drag handlers
  const handlePipMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsPipDragging(true);
      pipDragStartRef.current = { x: e.clientX, y: e.clientY };
      pipPositionStartRef.current = { ...pipPosition };
    },
    [pipPosition]
  );

  const handlePipMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPipDragging) return;

      const deltaX = e.clientX - pipDragStartRef.current.x;
      const deltaY = e.clientY - pipDragStartRef.current.y;

      const newX = pipPositionStartRef.current.x + deltaX;
      const newY = pipPositionStartRef.current.y + deltaY;

      // Keep within viewport bounds (264 = width of PIP container)
      const maxX = window.innerWidth - 280;
      const maxY = window.innerHeight - 220;

      setPipPosition({
        x: Math.max(16, Math.min(newX, maxX)),
        y: Math.max(16, Math.min(newY, maxY)),
      });
    },
    [isPipDragging]
  );

  const handlePipMouseUp = useCallback(() => {
    setIsPipDragging(false);
  }, []);

  // Effect to handle PIP drag events
  useEffect(() => {
    if (isPipDragging) {
      window.addEventListener("mousemove", handlePipMouseMove);
      window.addEventListener("mouseup", handlePipMouseUp);
      return () => {
        window.removeEventListener("mousemove", handlePipMouseMove);
        window.removeEventListener("mouseup", handlePipMouseUp);
      };
    }
  }, [isPipDragging, handlePipMouseMove, handlePipMouseUp]);

  // Initialize PIP position when component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPipPosition({
        x: window.innerWidth - 280,
        y: window.innerHeight - 280,
      });
    }
  }, []);

  // Helper function to get participant info for a Daily remote user (shared across all layouts)
  // With Daily, remoteUserTracks is already keyed by userId (string), so no UID mapping needed
  const getParticipantInfo = useCallback(
    (userId: string, otherParticipants: any[]) => {
      console.log(
        `[WORKSPACE] getParticipantInfo called for userId ${userId}`,
        {
          otherParticipantsCount: otherParticipants.length,
          userInfoMapSize: userInfoMap.size,
        }
      );

      // Step 1: Get user info from userInfoMap (stable mapping)
      const userInfo = userInfoMap.get(userId);

      if (userInfo) {
        const participant = participantsInCurrentSpace.find(
          (p) => p.id === userId
        );
        const result = {
          participant: participant || {
            id: userId,
            email: userInfo.email,
            name: userInfo.name,
          },
          displayName:
            userInfo.name || userInfo.email?.split("@")[0] || "Participant",
          initials: userInfo.name
            ? userInfo.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
            : userInfo.email?.charAt(0).toUpperCase() || "P",
        };
        console.log(`[WORKSPACE] Using userInfoMap lookup result:`, result);
        return result;
      }

      // Fallback: Try to find participant from participantsInCurrentSpace
      const participant = participantsInCurrentSpace.find(
        (p) => p.id === userId
      );

      if (participant) {
        console.log(
          `[WORKSPACE] Found participant from space list for userId ${userId}:`,
          participant
        );
        return {
          participant,
          displayName:
            participant.name ||
            participant.email?.split("@")[0] ||
            "Participant",
          initials: participant.name
            ? participant.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
            : "P",
        };
      }

      // Fallback: For 1:1 calls, there's only one other participant
      if (otherParticipants.length === 1) {
        const singleParticipant = otherParticipants[0];
        console.log(
          `[WORKSPACE] 1:1 call - using single participant:`,
          singleParticipant
        );
        return {
          participant: singleParticipant,
          displayName:
            singleParticipant?.name ||
            singleParticipant?.email?.split("@")[0] ||
            "Participant",
          initials: singleParticipant?.name
            ? singleParticipant.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
            : "P",
        };
      }

      // Show "Connecting..." until mapping arrives
      console.warn(
        `[WORKSPACE] Could not find participant for userId ${userId}. Showing "Connecting..." until mapping arrives.`
      );
      return {
        participant: null,
        displayName: "Connecting...",
        initials: "...",
      };
    },
    [userInfoMap, participantsInCurrentSpace]
  );

  return (
    <>
      {/* Network-status overlay removed with the presence-UI cleanup —
          users no longer see a "you are disconnected" modal. Chat / knock
          components surface their own send-failure toasts when relevant. */}

      {/* Loom-style Recording Controls - shown when recording */}
      <AnimatePresence>
        {isRecording && (
          <RecordingControls
            isRecordingMicOn={isRecordingMicOn}
            isRecordingCameraOn={isRecordingCameraOn}
            onMicToggle={toggleRecordingMic}
            onCameraToggle={toggleRecordingCamera}
            onStopRecording={stopRecording}
            recordingDuration={recordingDuration}
          />
        )}
      </AnimatePresence>

      {/* Draggable Camera Bubble - shown when recording camera is on */}
      <DraggableCameraBubble
        stream={recordingCameraStream}
        isVisible={isRecording && isRecordingCameraOn}
        onPositionChange={updateCameraBubblePosition}
      />

      <BookingDialog
        targetUser={bookingTarget}
        onClose={() => setBookingTarget(null)}
      />

      {/* HQ Room Booking Modal */}
      <HqRoomBookingModal
        open={showRoomBookingModal}
        onClose={() => setShowRoomBookingModal(false)}
        onBookingCreated={() => {}}
      />

      {/* HQ Room Schedule */}
      <HqRoomSchedule
        open={showRoomSchedule}
        onClose={() => setShowRoomSchedule(false)}
        bookings={roomBookings}
        onBookRoom={() => {
          setShowRoomSchedule(false);
          setShowRoomBookingModal(true);
        }}
        onRefresh={() => {
          window.dispatchEvent(new Event("room-booking:created"));
        }}
      />

      {/* Full Screen Knocking Overlay */}
      <AnimatePresence>
        {knockingId && (
          <motion.div
            key="knocking-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex flex-col items-center gap-6"
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, -5, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-24 h-24 rounded-full bg-purple-500/20 border-2 border-purple-500/50 flex items-center justify-center"
              >
                <DoorClosed className="w-12 h-12 text-purple-400" />
              </motion.div>

              <div className="text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Knocking...
                </h2>
                <p className="text-gray-400">
                  Waiting for{" "}
                  <span className="text-purple-400 font-medium">
                    {peers.get(knockingId)?.name ||
                      peers.get(knockingId)?.email ||
                      "user"}
                  </span>{" "}
                  to respond
                </p>
              </div>

              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="w-3 h-3 rounded-full bg-purple-500"
                  />
                ))}
              </div>

              <Button
                variant="destructive"
                size="lg"
                className="mt-4"
                onClick={() => {
                  const knockedPeer = peers.get(knockingId);
                  if (knockedPeer) {
                    handleCancelKnock(knockedPeer);
                  }
                }}
              >
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording banner commented out
      <AnimatePresence>
        {activeRecorder && (
          <div
            key="recording-banner"
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 group pointer-events-none"
            onMouseEnter={() => setShowFullRecordingBanner(true)}
            onMouseLeave={() => setShowFullRecordingBanner(false)}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 transition-all duration-300 group-hover:opacity-0 pointer-events-auto"
              style={{
                opacity: showFullRecordingBanner ? 0 : 1,
              }}
            >
              <div className="w-48 h-6 bg-red-600/40 backdrop-blur-md border border-t-0 border-red-400/20 rounded-b-2xl flex items-center justify-center gap-2 cursor-pointer">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>

            <div
              className="bg-red-600/90 backdrop-blur-md border border-red-400/60 rounded-b-2xl rounded-t-none px-6 py-4 flex items-center gap-3 transition-all duration-300 ease-out shadow-lg pointer-events-auto cursor-pointer"
              style={{
                transform: showFullRecordingBanner
                  ? "translateY(0)"
                  : "translateY(-100%)",
                opacity: showFullRecordingBanner ? 1 : 0,
              }}
              role="status"
              aria-live="polite"
            >
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-medium whitespace-nowrap">
                {activeRecorder.id === me
                  ? "You are recording this workspace. Everyone wearing the red banner has been notified."
                  : `${activeRecorderName ?? "Someone"
                  } is recording this workspace.`}
              </span>
            </div>
          </div>
        )}
      </AnimatePresence>
      */}

      {recordingPreviewStream && (
        <div
          className="fixed z-40 flex flex-col gap-2 w-64 select-none"
          style={{
            left: pipPosition.x,
            top: pipPosition.y,
            cursor: isPipDragging ? "grabbing" : "grab",
          }}
        >
          <div
            className="relative border border-white/15 rounded-xl overflow-hidden shadow-xl bg-black/80"
            onMouseDown={handlePipMouseDown}
          >
            <video
              ref={pipVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-36 object-contain bg-black pointer-events-none"
            />
            <div className="absolute top-2 left-2 flex items-center gap-2 text-xs font-semibold pointer-events-none">
              <span className="uppercase px-2 py-0.5 rounded-full bg-red-500 text-white">
                Rec
              </span>
              <span className="text-white/80">Screen preview</span>
            </div>
            <div className="absolute top-2 right-2 text-white/40 pointer-events-none">
              <GripVertical className="h-4 w-4" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleEnterPiP}
              variant="secondary"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10"
              disabled={!pipSupported}
            >
              <PictureInPicture2 className="h-4 w-4 mr-2" />
              {isPiPActive ? "PiP Active" : "Open PiP"}
            </Button>
            {isPiPActive && (
              <Button
                onClick={handleExitPiP}
                variant="ghost"
                className="w-12 h-10 text-white/80 hover:text-white"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {pipError && (
            <p className="text-xs text-red-300 bg-red-900/40 border border-red-500/40 rounded-lg px-3 py-2">
              {pipError}
            </p>
          )}
          {!pipSupported && (
            <p className="text-xs text-yellow-200 bg-yellow-900/40 border border-yellow-600/40 rounded-lg px-3 py-2">
              Your browser does not support picture-in-picture.
            </p>
          )}
        </div>
      )}

      <Dialog
        open={showScreenShareOverrideDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowScreenShareOverrideDialog(false);
            setPendingScreenShareAction(null);
            setOverrideSharer(null);
          }
        }}
      >
        <DialogContent
          className="bg-[#0e0e12]/95 text-white border border-[#2a2a35]"
          showCloseButton={false}
        >
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>Override screen share?</DialogTitle>
            <DialogDescription className="text-gray-300">
              {overrideSharer
                ? `${overrideSharer.name || overrideSharer.email
                } is already sharing their screen. Starting your screen share will replace theirs for everyone in the room.`
                : "Another participant is already sharing. Starting your screen share will replace theirs for everyone in the room."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 sm:justify-end">
            <Button
              variant="ghost"
              className="bg-transparent hover:bg-white/10 text-gray-300"
              onClick={handleCancelScreenShareOverride}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              onClick={handleConfirmScreenShareOverride}
            >
              Start sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="sr-only" aria-hidden="true">
        {audioPeers.map((peer) => (
          <PeerAudio
            key={`peer-audio-${peer.id}`}
            peer={peer}
            isLocal={peer.id === me}
          />
        ))}
      </div>
      {joiningSpace && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-4 text-white animate-in fade-in">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Joining {joiningSpace.name}'s room...</p>
        </div>
      )}

      <AnimatePresence>
        {isFloorTransitioning && (
          <motion.div
            className="fixed inset-0 z-40 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-blue-400/60 rounded-full"
                  initial={{
                    x: Math.random() * window.innerWidth,
                    y:
                      floorTransitionDirection === "up"
                        ? window.innerHeight + 20
                        : -20,
                    opacity: 0,
                  }}
                  animate={{
                    y:
                      floorTransitionDirection === "up"
                        ? -20
                        : window.innerHeight + 20,
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 0.8,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Incoming knock request panel */}
      <AnimatePresence>
        {knockRequest && (
          <motion.div
            className="fixed top-6 right-6 z-[1000] max-w-sm w-full"
            initial={{ opacity: 0, x: 400, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 400, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="bg-[#0e0e12]/95 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-900/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                      Knock Request
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium">
                    <span className="text-purple-300">
                      {knockRequest.fromName || "Someone"}
                    </span>{" "}
                    wants to join your room
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    onClick={() => handleKnockResponse(true)}
                    size="sm"
                    className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 rounded-full"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleKnockResponse(false)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-red-600/20 rounded-full"
                  >
                    <X className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Knock declined toast */}
      <AnimatePresence>
        {knockDeclinedToast && (
          <motion.div
            className="fixed top-6 right-6 z-[1000] max-w-sm w-full"
            initial={{ opacity: 0, x: 400, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 400, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="bg-[#0e0e12]/95 backdrop-blur-xl border border-red-500/30 rounded-xl shadow-2xl shadow-red-900/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                    Knock Declined
                  </span>
                </div>
                <X
                  className="h-4 w-4 text-red-400 cursor-pointer hover:text-red-300"
                  onClick={() => setKnockDeclinedToast(false)}
                />
              </div>
              <p className="text-white text-sm font-medium mt-1">
                Your knock request was declined.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {watchingScreenShare && (
        <div
          ref={screenShareContainerRef}
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
        >
          <Button
            onClick={closeWatchingScreenShare}
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 rounded-full w-12 h-12 text-white bg-white/20 hover:bg-white/30 z-50 shadow-lg"
            aria-label="Close screen share"
          >
            <X />
          </Button>
          <Button
            onClick={() => void toggleScreenShareViewFullscreen()}
            size="icon"
            variant="ghost"
            className="absolute top-4 right-20 rounded-full w-12 h-12 text-white bg-white/10 hover:bg-white/20 z-50 shadow-lg"
            aria-label={
              isScreenShareFullscreenActive
                ? "Exit fullscreen"
                : "Enter fullscreen"
            }
          >
            {isScreenShareFullscreenActive ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <video
            ref={screenShareVideoRef}
            autoPlay
            className="w-full h-full object-contain"
            onDoubleClick={(event) => {
              event.preventDefault();
              void toggleScreenShareViewFullscreen();
            }}
          />
        </div>
      )}

      <div className="w-full h-full bg-[#0a0a0d] flex flex-col relative overflow-hidden text-white select-none">
        <motion.div
          className="flex-1 p-4 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          animate={{
            opacity: isFloorTransitioning ? 0.7 : 1,
            scale: isFloorTransitioning ? 0.98 : 1,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="p-4">

            {/* Network Stats Section - Shows business network metrics */}
            {!selectedFloorId && <NetworkStatsCard orgId={currentOrgId} />}

            <div className="flex flex-wrap items-center justify-center gap-4">

              {/* Event Cards and divider - hidden for guest users */}
              {!amIGuest && (
                <>
                  {!selectedFloorId &&
                    events.map((event: any) => {
                      const now = new Date();
                      const startTime = new Date(event.startTime);
                      const endTime = new Date(event.endTime);
                      const isActive = startTime <= now && endTime >= now;
                      const isLive = event.isLive === true;

                      console.log(
                        "[WorkspaceClient] Rendering event:",
                        event.title,
                        "isActive:",
                        isActive,
                        "isLive:",
                        isLive
                      );

                      // Get occupants for this event space
                      const eventSpaceId = `event:${event._id}`;
                      const eventOccupants = Array.from(peers.values()).filter(
                        (p) => p.spaceId === eventSpaceId
                      );
                      if (localPeerState?.spaceId === eventSpaceId) {
                        eventOccupants.push(localPeerState);
                      }

                      return (
                        <EventCard
                          key={`event-${event._id}`}
                          eventId={event._id}
                          title={event.title}
                          startTime={startTime}
                          endTime={endTime}
                          creator={event.creatorId}
                          invitedUsers={event.invitedUserIds || []}
                          occupants={eventOccupants}
                          isActive={isActive}
                          isLive={isLive}
                          isRepeating={event.isRepeating}
                          meId={me}
                          isJoining={joiningSpaceId === eventSpaceId}
                          onJoin={() => {
                            setJoiningSpaceId(eventSpaceId);
                            connectSocket().emit("workspace:move-to-space", {
                              spaceId: eventSpaceId,
                            });
                          }}
                        />
                      );
                    })}

                  {/* Horizontal divider after conference/event cards removed */}
                </>
              )}

              {/* Show-all tab: 4-quadrant layout (iOS folder style) */}
              {(guestSpaces.length > 0 || nonGuestSpaces.length > 0 || personalAgents.length > 0) ? (
                <>
                  {/* Expanded section view — shows full cards for one category */}
                  {expandedSection ? (
                    <div className="w-full">
                      {/* Header row: Back + Title + Online/All toggle */}
                      <div className="flex items-center gap-4 mb-4">
                        <button
                          onClick={() => {
                            setExpandedSection(null);
                            setSelectedFloorId(null);
                          }}
                          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Back
                        </button>

                        {/* Online/All toggle removed with the presence
                            cleanup — the expanded view always shows the
                            full list, paginated via "Show more" below. */}
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-200">
                          {expandedSection === "ai" && "AI Employees"}
                          {expandedSection === "team" && "Team"}
                          {expandedSection === "customers" && "Customers"}
                          {expandedSection === "affiliates" && "Affiliates"}
                        </h3>

                        {expandedSection === "team" && (
                          <div className="relative">
                            <motion.div
                              animate={{
                                scale: isFloorTransitioning ? 1.05 : 1,
                                rotateZ: isFloorTransitioning
                                  ? floorTransitionDirection === "up"
                                    ? 2
                                    : -2
                                  : 0,
                              }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                            >
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFloorsButtonClick();
                                }}
                                variant="ghost"
                                className={cn(
                                  "h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border rounded-full transition-all duration-300",
                                  isFloorTransitioning
                                    ? "border-blue-400/50 bg-blue-500/10 hover:bg-blue-500/20"
                                    : "border-[#2a2a35] hover:bg-[#1a1a20]"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <motion.div
                                    animate={{
                                      rotate: isFloorTransitioning ? 360 : 0,
                                    }}
                                    transition={{ duration: 0.6, ease: "easeInOut" }}
                                  >
                                    <Building2
                                      className={cn(
                                        "h-3 w-3",
                                        isFloorTransitioning ? "text-blue-300" : "text-blue-400"
                                      )}
                                    />
                                  </motion.div>
                                  <span className="text-white">
                                    {selectedFloorId === "FOUNDERS_FLOOR"
                                      ? "Founders Floor"
                                      : selectedFloorId
                                        ? floors.find((f) => f.id === selectedFloorId)?.name ||
                                        "Floor"
                                        : "Show All"}
                                  </span>
                                  <ChevronDown
                                    className={cn(
                                      "h-3 w-3 text-gray-400 transition-transform duration-200",
                                      showFloorsPopover && "rotate-180"
                                    )}
                                  />
                                </div>
                              </Button>
                            </motion.div>

                            <AnimatePresence>
                              {showFloorsPopover && (
                                <motion.div
                                  className="absolute top-full mt-2 right-0 bg-[#0e0e12]/95 backdrop-blur-xl border border-[#2a2a35] rounded-xl shadow-lg p-3 min-w-[280px] max-w-[400px] max-h-[400px] overflow-y-auto z-50"
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                  transition={{ duration: 0.2, ease: "easeOut" }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <h3 className="text-sm font-semibold text-white">
                                        Office Floors
                                      </h3>
                                      <p className="text-xs text-gray-400">
                                        {selectedFloorId === "FOUNDERS_FLOOR"
                                          ? "Viewing: Founders Floor"
                                          : selectedFloorId
                                            ? `Viewing: ${floors.find((f) => f.id === selectedFloorId)
                                              ?.name || "Unknown"
                                            }`
                                            : "Viewing: All Floors"}
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() => setShowFloorsPopover(false)}
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 hover:bg-white/10"
                                    >
                                      <X className="h-3 w-3 text-gray-400" />
                                    </Button>
                                  </div>

                                  {loadingFloors ? (
                                    <div className="flex items-center justify-center py-8">
                                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                      <span className="ml-2 text-sm text-gray-400">
                                        Loading floors...
                                      </span>
                                    </div>
                                  ) : floors.length === 0 ? (
                                    <div className="text-center py-8">
                                      <Building2 className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                                      <p className="text-sm text-gray-400">
                                        No floors configured
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <motion.div
                                        className={cn(
                                          "border rounded-lg p-3 transition-colors cursor-pointer",
                                          !selectedFloorId
                                            ? "bg-purple-500/20 border-purple-400/50"
                                            : "bg-[#1a1a20]/50 border-[#2a2a35] hover:bg-[#1a1a20]/70"
                                        )}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2 }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleFloorChange(null)}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div>
                                              <h4 className="text-sm font-medium text-white">
                                                Show All Floors
                                              </h4>
                                              <p className="text-xs text-gray-400">
                                                View everyone
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </motion.div>

                                      <motion.div
                                        className={cn(
                                          "border rounded-lg p-3 transition-colors cursor-pointer",
                                          selectedFloorId === "FOUNDERS_FLOOR"
                                            ? "bg-yellow-500/20 border-yellow-400/50"
                                            : "bg-[#1a1a20]/50 border-[#2a2a35] hover:bg-[#1a1a20]/70"
                                        )}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2 }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleFloorChange("FOUNDERS_FLOOR")}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div>
                                              <h4 className="text-sm font-medium text-white">
                                                Founders Floor
                                              </h4>
                                              <p className="text-xs text-gray-400">
                                                Leadership team
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </motion.div>

                                      {floors.map((floor) => {
                                        const isSelected = selectedFloorId === floor.id;
                                        return (
                                          <motion.div
                                            key={floor.id}
                                            className={cn(
                                              "border rounded-lg p-3 transition-colors cursor-pointer",
                                              isSelected
                                                ? "bg-blue-500/20 border-blue-400/50"
                                                : "bg-[#1a1a20]/50 border-[#2a2a35] hover:bg-[#1a1a20]/70"
                                            )}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.2 }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleFloorChange(floor.id)}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2 flex-1">
                                                <div>
                                                  <h4 className="text-sm font-medium text-white">
                                                    {floor.name}
                                                  </h4>
                                                  <p className="text-xs text-gray-400">
                                                    Level {floor.level}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                            {floor.departments.length > 0 && (
                                              <div className="mt-2 flex flex-wrap gap-1">
                                                {floor.departments
                                                  .slice(0, 4)
                                                  .map((dept, index) => (
                                                    <span
                                                      key={index}
                                                      className="text-xs px-2 py-1 rounded-full bg-[#2a2a35] text-gray-300"
                                                    >
                                                      {dept.name}
                                                    </span>
                                                  ))}
                                                {floor.departments.length > 4 && (
                                                  <span className="text-xs px-2 py-1 rounded-full bg-[#2a2a35] text-gray-500">
                                                    +{floor.departments.length - 4} more
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </motion.div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {/* AI Employees expanded (always online) */}
                        {expandedSection === "ai" &&
                          personalAgents.map((agent) => (
                            <AgentWorkspaceCard
                              key={`agent-exp-${agent.agentId}`}
                              agent={agent}
                            />
                          ))}

                        {/* Team expanded */}
                        {expandedSection === "team" && (() => {
                          // Pagination — show up to `expandedLimit` cards
                          // and reveal "Show more" if the source list is
                          // larger. Resets to PAGE_SIZE when the user
                          // switches sections (effect above).
                          const visible = nonGuestSpaces.slice(0, expandedLimit);
                          const remaining = Math.max(
                            0,
                            nonGuestSpaces.length - visible.length
                          );
                          return (
                            <>
                              <AnimatePresence mode="popLayout">
                                {visible.map(({ key, owner, occupants }) => (
                                  <motion.div
                                    key={key}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <UserSpaceCard
                                      owner={owner}
                                      occupants={occupants}
                                      meId={me}
                                      mySpaceId={mySpaceId}
                                      onKnock={handleKnock}
                                      onCancelKnock={handleCancelKnock}
                                      knockingId={knockingId}
                                      onWatchScreenShare={setWatchingScreenShare}
                                      onBook={() => setBookingTarget(owner)}
                                      isInKnockCall={inCall && is1on1Call}
                                      isMicMuted={dailyMicMuted}
                                      onToggleMic={handleDailyMicToggle}
                                      onEndCall={handleEndKnockCall}
                                    />
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                              {remaining > 0 && (
                                <div className="col-span-full flex justify-center py-4">
                                  <button
                                    onClick={() =>
                                      setExpandedLimit((n) => n + EXPANDED_PAGE_SIZE)
                                    }
                                    className="px-4 py-2 rounded-md text-xs font-medium bg-[#1a1a24] border border-[#2a2a35] text-gray-300 hover:bg-[#22222d] hover:border-[#3a3a45] transition-colors"
                                  >
                                    Show {Math.min(remaining, EXPANDED_PAGE_SIZE)} more
                                    <span className="text-gray-500 ml-1">({remaining} left)</span>
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* Customers expanded */}
                        {expandedSection === "customers" && (() => {
                          const visible = customerSpaces.slice(0, expandedLimit);
                          const remaining = Math.max(
                            0,
                            customerSpaces.length - visible.length
                          );
                          return (
                            <>
                              <AnimatePresence mode="popLayout">
                                {visible.map(({ key, owner, occupants }) => (
                                  <motion.div
                                    key={key}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <UserSpaceCard
                                      owner={owner}
                                      occupants={occupants}
                                      meId={me}
                                      mySpaceId={mySpaceId}
                                      onKnock={handleKnock}
                                      onCancelKnock={handleCancelKnock}
                                      knockingId={knockingId}
                                      onWatchScreenShare={setWatchingScreenShare}
                                      onBook={() => setBookingTarget(owner)}
                                    />
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                              {remaining > 0 && (
                                <div className="col-span-full flex justify-center py-4">
                                  <button
                                    onClick={() =>
                                      setExpandedLimit((n) => n + EXPANDED_PAGE_SIZE)
                                    }
                                    className="px-4 py-2 rounded-md text-xs font-medium bg-[#1a1a24] border border-[#2a2a35] text-gray-300 hover:bg-[#22222d] hover:border-[#3a3a45] transition-colors"
                                  >
                                    Show {Math.min(remaining, EXPANDED_PAGE_SIZE)} more
                                    <span className="text-gray-500 ml-1">({remaining} left)</span>
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* Affiliates expanded */}
                        {expandedSection === "affiliates" && (() => {
                          const visible = affiliateSpaces.slice(0, expandedLimit);
                          const remaining = Math.max(
                            0,
                            affiliateSpaces.length - visible.length
                          );
                          return (
                            <>
                              <AnimatePresence mode="popLayout">
                                {visible.map(({ key, owner, occupants }) => (
                                  <motion.div
                                    key={key}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <UserSpaceCard
                                      owner={owner}
                                      occupants={occupants}
                                      meId={me}
                                      mySpaceId={mySpaceId}
                                      onKnock={handleKnock}
                                      onCancelKnock={handleCancelKnock}
                                      knockingId={knockingId}
                                      onWatchScreenShare={setWatchingScreenShare}
                                      onBook={() => setBookingTarget(owner)}
                                    />
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                              {remaining > 0 && (
                                <div className="col-span-full flex justify-center py-4">
                                  <button
                                    onClick={() =>
                                      setExpandedLimit((n) => n + EXPANDED_PAGE_SIZE)
                                    }
                                    className="px-4 py-2 rounded-md text-xs font-medium bg-[#1a1a24] border border-[#2a2a35] text-gray-300 hover:bg-[#22222d] hover:border-[#3a3a45] transition-colors"
                                  >
                                    Show {Math.min(remaining, EXPANDED_PAGE_SIZE)} more
                                    <span className="text-gray-500 ml-1">({remaining} left)</span>
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* 4-quadrant grid — each section shows real interactive cards */
                    <div className="grid grid-cols-2 gap-4 w-full" style={{ minHeight: 0 }}>
                      {/* Bottom-left: Customers */}
                      {(() => {
                        const MAX_PREVIEW = 7;
                        const previewCustomers = customerSpaces.slice(0, MAX_PREVIEW);
                        const overflow = Math.max(0, customerSpaces.length - MAX_PREVIEW);
                        const previewPeople = previewCustomers.map((s) => ({
                          key: s.key,
                          id: s.owner.id,
                          name: s.owner.name || s.owner.email || "?",
                          profilePicture: s.owner.profilePicture,
                        }));
                        return (
                          <OfficeStreamSection
                            title="Customers"
                            totalCount={customerSpaces.length}
                            previewCount={previewCustomers.length}
                            overflowCount={overflow}
                            onViewAll={() => setExpandedSection("customers")}
                            previewPeople={previewPeople}
                          >
                            {previewCustomers.map(({ key, owner, occupants }) => (
                              <UserSpaceCard
                                key={key}
                                owner={owner}
                                occupants={occupants}
                                meId={me}
                                mySpaceId={mySpaceId}
                                onKnock={handleKnock}
                                onCancelKnock={handleCancelKnock}
                                knockingId={knockingId}
                                onWatchScreenShare={setWatchingScreenShare}
                                onBook={() => setBookingTarget(owner)}
                              />
                            ))}
                          </OfficeStreamSection>
                        );
                      })()}

                      {/* Bottom-right: Affiliates */}
                      {(() => {
                        const MAX_PREVIEW = 7;
                        const previewAffiliates = affiliateSpaces.slice(0, MAX_PREVIEW);
                        const overflow = Math.max(0, affiliateSpaces.length - MAX_PREVIEW);
                        const previewPeople = previewAffiliates.map((s) => ({
                          key: s.key,
                          id: s.owner.id,
                          name: s.owner.name || s.owner.email || "?",
                          profilePicture: s.owner.profilePicture,
                        }));
                        return (
                          <OfficeStreamSection
                            title="Affiliates"
                            totalCount={affiliateSpaces.length}
                            previewCount={previewAffiliates.length}
                            overflowCount={overflow}
                            onViewAll={() => setExpandedSection("affiliates")}
                            previewPeople={previewPeople}
                          >
                            {previewAffiliates.map(({ key, owner, occupants }) => (
                              <UserSpaceCard
                                key={key}
                                owner={owner}
                                occupants={occupants}
                                meId={me}
                                mySpaceId={mySpaceId}
                                onKnock={handleKnock}
                                onCancelKnock={handleCancelKnock}
                                knockingId={knockingId}
                                onWatchScreenShare={setWatchingScreenShare}
                                onBook={() => setBookingTarget(owner)}
                              />
                            ))}
                          </OfficeStreamSection>
                        );
                      })()}

                      {/* Top-right: Team */}
                      {!amIGuest && (() => {
                        const MAX_PREVIEW = 7;
                        // Live presence filter removed with the presence
                        // cleanup. Preview shows the first MAX_PREVIEW
                        // members in insertion order (sorted upstream);
                        // the "View All" sheet paginates the rest.
                        const previewTeam = nonGuestSpaces.slice(0, MAX_PREVIEW);
                        const overflow = Math.max(0, nonGuestSpaces.length - MAX_PREVIEW);
                        const previewPeople = previewTeam.map((s) => ({
                          key: s.key,
                          id: s.owner.id,
                          name: s.owner.name || s.owner.email || "?",
                          profilePicture: s.owner.profilePicture,
                        }));
                        return (
                          <OfficeStreamSection
                            title="Team"
                            totalCount={nonGuestSpaces.length}
                            previewCount={previewTeam.length}
                            overflowCount={overflow}
                            onViewAll={() => setExpandedSection("team")}
                            previewPeople={previewPeople}
                          >
                            {previewTeam.map(({ key, owner, occupants }) => (
                              <UserSpaceCard
                                key={key}
                                owner={owner}
                                occupants={occupants}
                                meId={me}
                                mySpaceId={mySpaceId}
                                onKnock={handleKnock}
                                onCancelKnock={handleCancelKnock}
                                knockingId={knockingId}
                                onWatchScreenShare={setWatchingScreenShare}
                                onBook={() => setBookingTarget(owner)}
                                isInKnockCall={inCall && is1on1Call}
                                isMicMuted={dailyMicMuted}
                                onToggleMic={handleDailyMicToggle}
                                onEndCall={handleEndKnockCall}
                              />
                            ))}
                          </OfficeStreamSection>
                        );
                      })()}

                      {/* Top-left: AI Employees */}
                      {!amIGuest && (() => {
                        const MAX_PREVIEW = 7;
                        const totalAgents = personalAgents.length;
                        const previewAgents = personalAgents.slice(0, MAX_PREVIEW);
                        const overflow = Math.max(0, totalAgents - MAX_PREVIEW);
                        const previewPeople = personalAgents.map((a) => ({
                          key: `agent-p-${a.agentId}`,
                          name: a.name,
                          isAgent: true,
                        }));
                        return (
                          <OfficeStreamSection
                            title="AI Employees"
                            totalCount={totalAgents}
                            previewCount={previewAgents.length}
                            overflowCount={overflow}
                            onViewAll={() => setExpandedSection("ai")}
                            previewPeople={previewPeople}
                          >
                            {previewAgents.map((agent) => (
                              <AgentWorkspaceCard key={`agent-q-${agent.agentId}`} agent={agent} />
                            ))}
                          </OfficeStreamSection>
                        );
                      })()}
                    </div>
                  )}
                </>
              ) : (
                spacesToRender.length === 0 &&
                personalAgents.length === 0 &&
                !loadingFloors && (
                  <motion.p
                    className="text-gray-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    The office is quiet...
                  </motion.p>
                )
              )}
            </div>
          </div>
        </motion.div>

        {/* Fullscreen Meeting View */}
        <AnimatePresence>
          {isMeetingViewFullscreen && isInMeeting && (
            <motion.div
              className="fixed inset-0 bg-[#0a0a0d] z-[200] flex items-center justify-center p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-full h-full flex flex-col">
                {/* Meeting participants grid */}
                <div className="flex-1 grid gap-4 overflow-auto p-4">
                  {(() => {
                    // const gridSize = participantsInCurrentSpace.length;
                    let gridCols = "grid-cols-4";

                    // if (gridSize === 2) gridCols = "grid-cols-2";
                    // else if (gridSize === 3) gridCols = "grid-cols-2";
                    // else if (gridSize === 4) gridCols = "grid-cols-2";
                    // else if (gridSize <= 6) gridCols = "grid-cols-3";
                    // else if (gridSize <= 9) gridCols = "grid-cols-3";
                    // else gridCols = "grid-cols-4";

                    return (
                      <div
                        className={`grid ${gridCols} gap-4 w-full h-[200px] max-w-[1800px] mx-auto`}
                      >
                        {participantsInCurrentSpace.map((peer) => {
                          const isLocal = peer.id === me;
                          const hasScreenShare = peer.isScreenSharing;
                          const screenTrack = peer.stream
                            ? getPreferredScreenTrack(peer.stream)
                            : null;

                          // Show button for any peer who is screen sharing
                          const shouldShowFullscreenButton = hasScreenShare;

                          return (
                            <motion.div
                              key={peer.id}
                              className={cn(
                                "relative rounded-xl overflow-hidden bg-[#0e0e12] border-2",
                                isLocal && "border-purple-500",
                                !isLocal && "border-[#2a2a35]"
                              )}
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.3 }}
                              whileHover={{ scale: 1.02 }}
                            >
                              {/* Video element */}
                              <VideoElementWithEffect
                                stream={peer.stream}
                                isLocal={isLocal}
                                hasScreenShare={
                                  !!(hasScreenShare && screenTrack)
                                }
                              />

                              {/* User info overlay */}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center font-semibold overflow-hidden">
                                    {peer.profilePicture ? (
                                      <img
                                        src={peer.profilePicture}
                                        alt={peer.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span>
                                        {(peer.name ||
                                          peer.email)[0].toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">
                                      {isLocal
                                        ? "You"
                                        : peer.name || peer.email}
                                    </p>
                                    {hasScreenShare && (
                                      <p className="text-blue-400 text-xs">
                                        Sharing screen
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* You badge */}
                              {isLocal && (
                                <div className="absolute top-2 left-2 px-2 py-1 bg-purple-500 rounded-full text-xs font-medium">
                                  You
                                </div>
                              )}

                              {/* Screen Share Fullscreen Button */}
                              {shouldShowFullscreenButton && (
                                <Button
                                  onClick={() =>
                                    setFullscreenScreenSharePeer(peer.id)
                                  }
                                  size="icon"
                                  className="absolute top-2 right-2 w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-full shadow-lg"
                                  title="Fullscreen screen share"
                                >
                                  <Maximize2 className="h-5 w-5 text-white" />
                                </Button>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Exit fullscreen button */}
                <div className="absolute top-4 right-4">
                  <Button
                    onClick={() => setIsMeetingViewFullscreen(false)}
                    size="icon"
                    variant="ghost"
                    className="rounded-full w-10 h-10 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Screen Share Overlay */}
        <AnimatePresence>
          {fullscreenScreenSharePeer && (
            <motion.div
              className="fixed inset-0 bg-black z-[220] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="relative w-full h-full flex items-center justify-center p-4">
                {/* Screen Share Video */}
                {(() => {
                  const peer = participantsInCurrentSpace.find(
                    (p) => p.id === fullscreenScreenSharePeer
                  );
                  if (!peer || !peer.stream) return null;

                  return <FullscreenScreenShareVideo stream={peer.stream} />;
                })()}

                {/* Close Button */}
                <Button
                  onClick={() => setFullscreenScreenSharePeer(null)}
                  size="icon"
                  className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md border border-white/20"
                >
                  <X className="h-6 w-6 text-white" />
                </Button>

                {/* Owner Info */}
                {(() => {
                  const peer = participantsInCurrentSpace.find(
                    (p) => p.id === fullscreenScreenSharePeer
                  );
                  if (!peer) return null;

                  return (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md rounded-full px-6 py-3 border border-white/20">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center font-semibold overflow-hidden">
                          {peer.profilePicture ? (
                            <img
                              src={peer.profilePicture}
                              alt={peer.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>
                              {(peer.name || peer.email)[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {peer.name || peer.email} is sharing
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={cn(
            "absolute top-6 right-6 z-30 flex gap-2 pointer-events-auto",
            "hidden md:flex", // Hide on mobile, show on desktop
            isMeetingViewFullscreen && "z-[60]"
          )}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >


          {/* Clock In/Out Button - COMMENTED OUT
          <Button
            onClick={(e) => {
              e.stopPropagation();
              void handleClockToggle();
            }}
            variant="ghost"
            className={cn(
              "h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border rounded-full",
              isClockedIn
                ? "border-green-500/40 hover:bg-green-500/20"
                : "border-[#2a2a35] hover:bg-[#1a1a20]"
            )}
            disabled={isClockedIn === null || clockActionLoading}
            title={isClockedIn ? "Clock out" : "Clock in"}
          >
            <div className="flex items-center gap-2">
              {isClockedIn ? (
                <PowerOff className="h-3 w-3 text-green-400" />
              ) : (
                <Power className="h-3 w-3 text-gray-300" />
              )}
              <span className="text-white">
                {isClockedIn ? "Clock out" : "Clock in"}
              </span>
            </div>
          </Button>
          */}

          {/* Recording Controls - COMMENTED OUT
          <div className="flex items-center gap-1">
            {shouldForceRecording && (
              <Badge
                variant="outline"
                className="uppercase text-[10px] tracking-wide border-red-500/50 text-red-400 bg-red-500/10 px-2 py-0.5"
              >
                Always on
              </Badge>
            )}

            {!isRecording ? (
              <Button
                onClick={startRecording}
                variant="ghost"
                className={cn(
                  "h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border rounded-full",
                  "border-[#2a2a35] hover:bg-[#1a1a20]"
                )}
                title={
                  shouldForceRecording
                    ? "HQ policy: recording should be enabled in this space."
                    : "Start Recording"
                }
              >
                <div className="flex items-center gap-2">
                  <Play className="h-3 w-3 text-gray-300" />
                  <span className="text-white">Record</span>
                </div>
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                variant="ghost"
                className="h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border border-red-500/40 hover:bg-red-500/20 rounded-full"
                title="Stop Recording"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                    }}
                  >
                    <Square className="h-3 w-3 text-red-400" />
                  </motion.div>
                  <span className="text-white">Stop</span>
                </div>
              </Button>
            )}
          </div>
          */}

          {/* Status selector ("Available / Busy / AFK" pill) — hidden at
              user request along with the rest of the live-presence affordances.
              Wrapped in `{false && (...)}` instead of removed so the underlying
              myStatus/handleStatusChange wiring stays intact for an easy revert. */}
          {false && (
          <div className="relative">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (mySpaceId === "lobby") {
                  setShowStatusSelector(!showStatusSelector);
                }
              }}
              variant="ghost"
              disabled={mySpaceId !== "lobby"}
              className={cn(
                "h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border border-[#2a2a35] hover:bg-[#1a1a20] rounded-full",
                mySpaceId !== "lobby" &&
                "opacity-50 cursor-not-allowed hover:bg-[#0e0e12]/80"
              )}
              title={
                mySpaceId !== "lobby"
                  ? "Status cannot be changed during a call"
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    myStatus === "available"
                      ? "bg-green-400"
                      : myStatus === "busy"
                        ? "bg-red-400"
                        : "bg-yellow-400"
                  )}
                />
                <span className="text-white capitalize">{myStatus}</span>
              </div>
            </Button>

            <AnimatePresence>
              {showStatusSelector && mySpaceId === "lobby" && (
                <motion.div
                  className="absolute top-full mt-2 right-0 bg-[#0e0e12]/95 backdrop-blur-xl border border-[#2a2a35] rounded-xl shadow-lg p-2 min-w-[140px]"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(["available", "busy", "afk"] as const).map((status) => (
                    <Button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-2 h-8 text-sm hover:bg-[#1a1a20]",
                        status === myStatus && "bg-[#1a1a20]"
                      )}
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          status === "available"
                            ? "bg-green-400"
                            : status === "busy"
                              ? "bg-red-400"
                              : "bg-yellow-400"
                        )}
                      />
                      {status === "available" ? (
                        <Users className="h-4 w-4 text-green-400" />
                      ) : status === "busy" ? (
                        <Clock className="h-4 w-4 text-red-400" />
                      ) : (
                        <Coffee className="h-4 w-4 text-yellow-400" />
                      )}
                      <span className="text-white capitalize">{status}</span>
                    </Button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}

          {/* Todo Button (Reminders) - COMMENTED OUT
          <div className="relative">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setShowTodoMenu(!showTodoMenu);
              }}
              variant="ghost"
              className="h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border border-[#2a2a35] hover:bg-[#1a1a20] rounded-full"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="h-3 w-3 text-purple-400" />
                <span className="text-white">Reminders</span>
              </div>
            </Button>
          </div>
          */}



          {/* Members Button — hidden at user request, parallel to the
              WorkspaceToolbar Members pill we hid earlier. Wrapped in
              `{false && (...)}` so the popover JSX + state hooks stay in
              source for a one-line revert. */}
          {false && (
          <div className="relative">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setShowMembersPopover(!showMembersPopover);
              }}
              variant="ghost"
              className={cn(
                "h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border rounded-full transition-all duration-300",
                showMembersPopover
                  ? "border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "border-[#2a2a35] hover:bg-[#1a1a20]"
              )}
            >
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-emerald-400" />
                <span className="text-white">
                  Members
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                    {
                      Array.from(teamMembers.entries()).filter(
                        ([userId]) => peers.has(userId) || userId === me
                      ).length
                    }
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-gray-400 transition-transform duration-200",
                    showMembersPopover && "rotate-180"
                  )}
                />
              </div>
            </Button>

            <AnimatePresence>
              {showMembersPopover && (
                <motion.div
                  className="absolute top-full mt-2 right-0 bg-[#0e0e12]/95 backdrop-blur-xl border border-[#2a2a35] rounded-xl shadow-lg p-2 min-w-[200px] max-w-[240px] max-h-[400px] overflow-y-auto"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-xs font-medium text-gray-400">
                      Members
                    </h3>
                    <Button
                      onClick={() => setShowMembersPopover(false)}
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 hover:bg-white/10"
                    >
                      <X className="h-2.5 w-2.5 text-gray-500" />
                    </Button>
                  </div>

                  {teamMembers.size === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-500">No members</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {/* Active Members */}
                      {Array.from(teamMembers.entries())
                        .filter(
                          ([userId]) => peers.has(userId) || userId === me
                        )
                        .map(([userId, member]) => {
                          const peer = peers.get(userId);
                          const isMe = userId === me;
                          const status = isMe
                            ? myStatus
                            : peer?.status || "offline";

                          return (
                            <div
                              key={userId}
                              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white/5 transition-colors"
                            >
                              <div className="relative flex-shrink-0">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold text-[10px] overflow-hidden">
                                  {member.profilePicture ? (
                                    <img
                                      src={member.profilePicture}
                                      alt={member.name || member.email}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    (
                                      member.name?.charAt(0) ||
                                      member.email?.charAt(0) ||
                                      "?"
                                    ).toUpperCase()
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0e0e12]",
                                    status === "available"
                                      ? "bg-emerald-400"
                                      : status === "busy"
                                        ? "bg-red-400"
                                        : status === "afk"
                                          ? "bg-yellow-400"
                                          : status === "mobile"
                                            ? "bg-cyan-400"
                                            : "bg-gray-500"
                                  )}
                                />
                              </div>
                              <span className="text-xs text-white truncate flex-1">
                                {member.name || member.email.split("@")[0]}
                              </span>
                              {member.role === "founder" && (
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}

                      {/* Offline Members */}
                      {Array.from(teamMembers.entries())
                        .filter(
                          ([userId]) => !peers.has(userId) && userId !== me
                        )
                        .map(([userId, member]) => {
                          return (
                            <div
                              key={userId}
                              className="flex items-center gap-2 p-1.5 rounded-md opacity-40"
                            >
                              <div className="relative flex-shrink-0">
                                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 font-semibold text-[10px] overflow-hidden">
                                  {member.profilePicture ? (
                                    <img
                                      src={member.profilePicture}
                                      alt={member.name || member.email}
                                      className="w-full h-full object-cover grayscale opacity-50"
                                    />
                                  ) : (
                                    (
                                      member.name?.charAt(0) ||
                                      member.email?.charAt(0) ||
                                      "?"
                                    ).toUpperCase()
                                  )}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-600 border border-[#0e0e12]" />
                              </div>
                              <span className="text-xs text-gray-500 truncate flex-1">
                                {member.name || member.email.split("@")[0]}
                              </span>
                              {member.role === "founder" && (
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}

          {/* Communities Dropdown (guest only) - hidden at user request */}
          {false && amIGuest && (
            <CommunityDropdown
              selectedCommunityId={selectedCommunityId}
              onCommunityChange={setSelectedCommunityId}
              teamMembers={teamMembers}
            />
          )}
        </motion.div>

        {/* WebRTC floating control bar - commented out
        <motion.div
          className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 p-3 bg-[#0e0e12] backdrop-blur-md border border-[#2a2a35] rounded-full shadow-lg z-50",
            isMeetingViewFullscreen && "z-[240]"
          )}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => toggleTrack("audio")}
              size="icon"
              variant="ghost"
              className={cn(
                "rounded-full w-12 h-12 text-white hover:!bg-white/10 transition-all duration-300",
                isMuted && "!bg-red-500 hover:!bg-red-600"
              )}
            >
              <motion.div
                animate={{ rotate: isMuted ? [0, -10, 10, -10, 10, 0] : 0 }}
                transition={{ duration: 0.5 }}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </motion.div>
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => toggleTrack("video")}
              size="icon"
              variant="ghost"
              className={cn(
                "rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300",
                isVideoOff && "bg-red-500 hover:bg-red-600"
              )}
            >
              <motion.div
                animate={{ rotate: isVideoOff ? [0, -10, 10, -10, 10, 0] : 0 }}
                transition={{ duration: 0.5 }}
              >
                {isVideoOff ? <VideoOff /> : <Video />}
              </motion.div>
            </Button>
          </motion.div>

          {isInMeeting && (
            <>
              <div className="flex gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={toggleScreenShare}
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300",
                      isScreenSharing && "bg-blue-500 hover:bg-blue-600"
                    )}
                  >
                    <motion.div
                      animate={{
                        scale: isScreenSharing ? [1, 1.1, 1] : 1,
                        rotate: isScreenSharing ? [0, 5, -5, 0] : 0,
                      }}
                      transition={{
                        duration: 0.6,
                        repeat: isScreenSharing ? Infinity : 0,
                      }}
                    >
                      {isScreenSharing ? <ScreenShareOff /> : <ScreenShare />}
                    </motion.div>
                  </Button>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() =>
                      setIsMeetingViewFullscreen(!isMeetingViewFullscreen)
                    }
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300",
                      isMeetingViewFullscreen &&
                        "bg-purple-500 hover:bg-purple-600"
                    )}
                    title={
                      isMeetingViewFullscreen
                        ? "Exit Fullscreen View"
                        : "Enter Fullscreen View"
                    }
                  >
                    {isMeetingViewFullscreen ? <Minimize2 /> : <Maximize2 />}
                  </Button>
                </motion.div>
              </div>

              <div className="w-px h-8 bg-gray-600" />
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={leavePrivateSpace}
                  size="icon"
                  className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700 text-white transition-all duration-300"
                  aria-label="Leave Call"
                >
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <PhoneOff className="h-6 w-6" />
                  </motion.div>
                </Button>
              </motion.div>
            </>
          )}
        </motion.div>
*/}
      </div>

      <AnimatePresence>
        {showFocusReminder && (
          <motion.div
            key="meeting-focus-reminder"
            className="fixed bottom-6 right-6 z-[90] max-w-xs w-full"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="bg-[#0e0e12]/95 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl shadow-black/40 p-4 flex gap-3 items-center text-white">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center text-lg font-semibold">
                  {participantsInCurrentSpace.length || 1}
                </div>
                {(isRecording || shouldForceRecording) && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wide text-purple-300/80">
                  You're still in the room
                </div>
                <div className="text-sm font-medium truncate">
                  {participantsInCurrentSpace
                    .filter((peer) => peer.id !== me)
                    .map((peer) => peer.name || peer.email)
                    .slice(0, 2)
                    .join(", ") || "Team members"}
                  {participantsInCurrentSpace.length > 2 && "…"}
                </div>
                <div className="mt-1 text-[11px] text-[#9fa0b8]">
                  {shouldForceRecording
                    ? "Recording is enforced for HQ sessions."
                    : isRecording
                      ? "Recording is still running."
                      : "Microphone and speakers stay live."}
                </div>
              </div>
              <div className="flex flex-col gap-1 items-stretch">
                <Button
                  size="sm"
                  className="h-8 px-3 bg-purple-600 hover:bg-purple-500"
                  onClick={() => {
                    setShowFocusReminder(false);
                    if (typeof window !== "undefined" && window.focus) {
                      window.focus();
                    }
                  }}
                >
                  Return
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setShowFocusReminder(false)}
                  aria-label="Dismiss reminder"
                >
                  <X className="h-4 w-4 text-[#9fa0b8]" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TodoMenu isOpen={showTodoMenu} onClose={() => setShowTodoMenu(false)} />

      {/* Mobile Action Sidebar - only on mobile */}
      <MobileActionSidebar
        className="md:hidden"
        onOpenOrgCabinet={() => setShowOrgCabinet(true)}
        isClockedIn={isClockedIn}
        clockActionLoading={clockActionLoading}
        onClockToggle={handleClockToggle}
        isRecording={isRecording}
        shouldForceRecording={shouldForceRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        myStatus={myStatus}
        mySpaceId={mySpaceId}
        onStatusChange={handleStatusChange}
        onOpenTodo={() => setShowTodoMenu(true)}
        onOpenNotifications={() => setShowNotificationsHub(true)}
        onOpenMembers={() => setShowMembersPopover(true)}
        membersCount={
          Array.from(teamMembers.entries()).filter(
            ([userId]) => peers.has(userId) || userId === me
          ).length
        }
        onOpenFloors={() => handleFloorsButtonClick()}
        currentFloorName={
          selectedFloorId === "FOUNDERS_FLOOR"
            ? "Founders Floor"
            : selectedFloorId
              ? floors.find((f) => f.id === selectedFloorId)?.name || "Floor"
              : "Show All"
        }
        amIFounder={amIFounder}
      />

      {/* Organization Cabinet Modal */}
      {showOrgCabinet && (
        <OrganizationCabinetPage onClose={() => setShowOrgCabinet(false)} />
      )}

      {/* Daily Video Call Overlay — skip for audio-only knock calls and conference room (handled on the conference page) */}
      {inCall && !isCallMinimized && !is1on1Call && !mySpaceId.startsWith("hq-room:") && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex flex-col p-4 gap-4">
          {/* Meeting Header */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 group">
            {/* Notch (visible when not hovered) - iPhone style */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 transition-all duration-300 group-hover:opacity-0">
              <div className="w-48 h-6 bg-black/40 backdrop-blur-md border border-t-0 border-gray-200/10 rounded-b-2xl flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <div className="w-2 h-2 bg-green-400 rounded-full" />
              </div>
            </div>

            {/* Full bar (slides down on hover) */}
            <div className="bg-[#0e0e12]/80 backdrop-blur-md border border-[#2a2a35] rounded-b-2xl rounded-t-none px-6 py-4 flex items-center gap-3 -translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white font-medium">
                {mySpaceId.startsWith("booking:")
                    ? "Scheduled Meeting"
                    : mySpaceId.startsWith("event:")
                      ? "Event Meeting"
                      : mySpaceId.startsWith("community-stream:")
                        ? "Community Stream"
                        : mySpaceId.startsWith("hq-room:")
                          ? "Conference Room"
                          : "1-on-1 Call"}
              </span>
              <div className="text-gray-400 text-sm">
                {remoteUserTracks.size + 1} participant
                {remoteUserTracks.size !== 0 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Minimize Button */}
          <Button
            onClick={() => {
              setIsCallMinimized(true);
            }}
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 z-10 rounded-full w-12 h-12 text-white bg-white/10 hover:bg-white/20"
            aria-label="Minimize call"
          >
            <Minimize2 className="h-6 w-6" />
          </Button>

          {/* Video Layout - Changes based on screen sharing */}
          {(() => {
            const otherParticipants = participantsInCurrentSpace.filter(
              (p) => p.id !== me
            );

            // Check if anyone is screen sharing (local or remote)
            const someoneIsScreenSharing =
              isDailyScreenSharing ||
              localScreenTrack ||
              remoteScreenSharers.size > 0;

            // Find the remote user who is screen sharing (if any)
            // With Daily, remoteUserTracks is keyed by userId directly
            let remoteScreenSharerUserId: string | null = null;

            if (remoteScreenSharers.size > 0) {
              // Get the userId of the person sharing (there should only be one)
              remoteScreenSharerUserId = Array.from(remoteScreenSharers)[0];
            }

            // Debug: log screen share rendering state
            const remoteTracksForSharer = remoteScreenSharerUserId
              ? remoteUserTracks.get(remoteScreenSharerUserId)
              : null;
            console.log("[SCREEN-SHARE-RENDER]", {
              someoneIsScreenSharing,
              showScreenShareView,
              isDailyScreenSharing,
              hasLocalScreenTrack: !!localScreenTrack,
              remoteScreenSharerUserId,
              remoteScreenSharersArray: Array.from(remoteScreenSharers),
              remoteTracksForSharer: remoteTracksForSharer ? {
                hasScreenTrack: !!remoteTracksForSharer.screenTrack,
                hasScreenVideo: remoteTracksForSharer.hasScreenVideo,
                screenTrackReadyState: remoteTracksForSharer.screenTrack?.readyState,
                screenTrackEnabled: remoteTracksForSharer.screenTrack?.enabled,
                screenTrackMuted: remoteTracksForSharer.screenTrack?.muted,
                screenTrackId: remoteTracksForSharer.screenTrack?.id,
              } : "NO_TRACKS_FOUND",
              allRemoteUserTrackKeys: Array.from(remoteUserTracks.keys()),
            });

            // Only show screen share layout if:
            // 1. Someone is screen sharing AND
            // 2. Screen share view is active (auto-enabled when sharing starts)
            if (!someoneIsScreenSharing || !showScreenShareView) {
              // Normal grid mode - return null to fall through to the else block below
              return null;
            }

            return (
              /* Screen Share Mode: Main screen (middle) + vertical user list (right) - auto-enabled */
              <div className="flex-1 flex gap-4 h-full max-h-[calc(100vh-8rem)] overflow-hidden">
                {/* Main Screen Share Area (Middle) - fixed height, object-contain, centered */}
                <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative min-h-0">
                  {localScreenTrack ? (
                    // Local user is screen sharing
                    <div className="w-full h-full flex items-center justify-center">
                      <DailyVideoPlayer
                        videoTrack={localScreenTrack}
                        isScreenShare
                      />
                      <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-blue-500/90 rounded-full text-sm font-medium text-white shadow-lg">
                        <ScreenShare className="inline-block w-4 h-4 mr-2" />
                        Your Screen
                      </div>
                    </div>
                  ) : remoteScreenSharerUserId &&
                    remoteUserTracks.get(remoteScreenSharerUserId)
                      ?.screenTrack ? (
                    // Remote user is screen sharing - get screen track from remoteUserTracks
                    <div className="w-full h-full flex items-center justify-center">
                      <DailyVideoPlayer
                        videoTrack={
                          remoteUserTracks.get(remoteScreenSharerUserId)
                            ?.screenTrack || null
                        }
                        isScreenShare
                      />
                      <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-blue-500/90 rounded-full text-sm font-medium text-white shadow-lg">
                        <ScreenShare className="inline-block w-4 h-4 mr-2" />
                        {(() => {
                          // Use getParticipantInfo for stable name resolution via userInfoMap
                          const otherParticipants = participantsInCurrentSpace.filter(
                            (p) => p.id !== me
                          );
                          const { displayName } = getParticipantInfo(
                            remoteScreenSharerUserId!,
                            otherParticipants
                          );
                          return displayName;
                        })()}
                        's Screen
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-white">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                          <ScreenShare className="w-8 h-8 text-blue-400" />
                        </div>
                        <p className="text-lg">Loading screen share...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Vertical User List (Right Sidebar) - fixed height, scrollable */}
                <div
                  className="w-72 flex flex-col gap-3 overflow-y-auto py-2 pr-1 flex-shrink-0 max-h-full [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-600/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500/70"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(156, 163, 175, 0.5) transparent",
                    scrollBehavior: "smooth",
                  }}
                >
                  {/* Local User Video (Camera) - Always show local user card */}
                  <div
                    className="bg-gray-800 rounded-lg overflow-hidden relative h-44 flex-shrink-0"
                    style={{ isolation: "isolate" }}
                  >
                    <div className="w-full h-full">
                      <DailyVideoPlayer
                        videoTrack={localVideoTrack}
                        isLocal={true}
                        userName="You"
                        showMicMuted={dailyMicMuted}
                      />
                    </div>
                    {/* Show indicator if this user is screen sharing */}
                    {(isDailyScreenSharing || localScreenTrack) && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500 rounded-full text-xs text-white font-medium">
                        Sharing Screen
                      </div>
                    )}
                  </div>

                  {/* Remote User Videos - Show all participants including screen sharer */}
                  {Array.from(remoteUserTracks.entries()).map(([userId, tracks]) => {
                    // Use helper function to get participant info
                    const { participant, displayName, initials } =
                      getParticipantInfo(userId, otherParticipants);

                    // Check if this user is the one screen sharing
                    const isThisUserScreenSharing =
                      remoteScreenSharers.has(userId);

                    return (
                      <div
                        key={userId}
                        className="bg-gray-900 rounded-lg overflow-hidden relative h-44 flex-shrink-0"
                        style={{ isolation: "isolate" }}
                      >
                        {/* Show the camera video (DailyVideoPlayer handles camera off state) */}
                        <div className="w-full h-full">
                          <DailyVideoPlayer
                            videoTrack={tracks.cameraTrack || null}
                            userName={displayName}
                            showMicMuted={!tracks.hasAudio}
                          />
                        </div>
                        {/* Show "Sharing Screen" badge if this user is screen sharing */}
                        {isThisUserScreenSharing && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500 rounded-full text-xs text-white font-medium">
                            Sharing Screen
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {remoteUserTracks.size === 0 && (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                      Waiting for others...
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Normal Grid Mode: All participants in grid */}
          {/* Show grid when: no one is screen sharing OR screen share view is not toggled on */}
          {((!isDailyScreenSharing &&
            !localScreenTrack &&
            remoteScreenSharers.size === 0) ||
            !showScreenShareView) && (
              <div
                className={cn(
                  "flex-1 grid gap-4",
                  // Adaptive grid: fit viewport up to 16, scroll at 17+
                  (() => {
                    const total = remoteUserTracks.size + 1; // +1 for local
                    if (total <= 1) return "grid-cols-1 auto-rows-fr";
                    if (total <= 4) return "grid-cols-2 auto-rows-fr";
                    if (total <= 6) return "grid-cols-3 auto-rows-fr";
                    if (total <= 9) return "grid-cols-3 auto-rows-fr";
                    if (total <= 16) return "grid-cols-4 auto-rows-fr";
                    // 17+: cap at 4 cols, allow vertical scroll
                    return "grid-cols-4 auto-rows-[minmax(180px,1fr)] overflow-y-auto";
                  })()
                )}
              >
                {/* Local User Video (Self View) */}
                <div
                  className="bg-gray-800 rounded-lg overflow-hidden relative"
                  style={{ isolation: "isolate" }}
                >
                  <div className="w-full h-full">
                    <DailyVideoPlayer
                      videoTrack={localVideoTrack}
                      isLocal={true}
                      userName="You"
                      showMicMuted={dailyMicMuted}
                    />
                  </div>
                </div>

                {/* Remote User Videos */}
                {Array.from(remoteUserTracks.entries()).map(([userId, tracks]) => {
                  console.log(
                    "[WorkspaceClient] Rendering DailyVideoPlayer for remote user:",
                    userId,
                    "hasCameraTrack:",
                    !!tracks.cameraTrack
                  );

                  // With Daily, remoteUserTracks is already keyed by userId
                  const otherParticipants = participantsInCurrentSpace.filter(
                    (p) => p.id !== me
                  );
                  const { displayName, initials } = getParticipantInfo(
                    userId,
                    otherParticipants
                  );
                  console.log("[WorkspaceClient] getParticipantInfo returned:", {
                    displayName,
                    initials,
                  });

                  return (
                    <div
                      key={userId}
                      className="bg-gray-900 rounded-lg overflow-hidden relative"
                      style={{ isolation: "isolate" }}
                    >
                      <div className="w-full h-full">
                        <DailyVideoPlayer
                          videoTrack={tracks.cameraTrack || null}
                          userName={displayName}
                          showMicMuted={!tracks.hasAudio}
                        />
                      </div>
                    </div>
                  );
                })}

                {remoteUserTracks.size === 0 && (
                  <div className="col-span-full flex items-center justify-center text-white text-lg">
                    Waiting for others to join...
                  </div>
                )}
              </div>
            )}

          {/* Call Controls */}

          <motion.div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 p-3 bg-[#0e0e12] backdrop-blur-md border border-[#2a2a35] rounded-full shadow-lg"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
          >
            {/* Microphone Toggle */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleDailyMicToggle}
                size="icon"
                variant="ghost"
                className={cn(
                  "rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300",
                  dailyMicMuted && "bg-red-500 hover:bg-red-600!"
                )}
              >
                <motion.div
                  animate={{
                    rotate: dailyMicMuted ? [0, -10, 10, -10, 10, 0] : 0,
                  }}
                  transition={{ duration: 0.5 }}
                >
                  {dailyMicMuted ? <MicOff /> : <Mic />}
                </motion.div>
              </Button>
            </motion.div>

            {/* Camera Toggle */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleDailyCameraToggle}
                size="icon"
                variant="ghost"
                className={cn(
                  "rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300",
                  dailyCameraOff && "bg-red-500 hover:bg-red-600!"
                )}
                title={dailyCameraOff ? "Turn on camera" : "Turn off camera"}
              >
                <motion.div
                  animate={{
                    rotate: dailyCameraOff ? [0, -10, 10, -10, 10, 0] : 0,
                  }}
                  transition={{ duration: 0.5 }}
                >
                  {dailyCameraOff ? <VideoOff /> : <Video />}
                </motion.div>
              </Button>
            </motion.div>

            {/* Screen Share Toggle */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={toggleDailyScreenShare}
                size="icon"
                variant="ghost"
                className={cn(
                  "rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300",
                  isDailyScreenSharing && "bg-blue-500 hover:bg-blue-600"
                )}
                title={
                  isDailyScreenSharing
                    ? "Stop screen sharing"
                    : "Share your screen"
                }
              >
                <motion.div
                  animate={{
                    scale: isDailyScreenSharing ? [1, 1.1, 1] : 1,
                    rotate: isDailyScreenSharing ? [0, 5, -5, 0] : 0,
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: isDailyScreenSharing ? Infinity : 0,
                  }}
                >
                  {isDailyScreenSharing ? <ScreenShareOff /> : <ScreenShare />}
                </motion.div>
              </Button>
            </motion.div>

            <div className="w-px h-8 bg-gray-600/50" />

            {/* Cloud Recording Toggle */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={toggleCloudRecording}
                size="icon"
                variant="ghost"
                disabled={isRecordingLoading}
                className={cn(
                  "rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300",
                  isRecordingLoading && "opacity-60 cursor-not-allowed",
                  isCloudRecording && recordingStartedByMe && !isRecordingLoading && "bg-red-500/80 hover:bg-red-600",
                  isCloudRecording && !recordingStartedByMe && "bg-red-500/40 cursor-not-allowed"
                )}
                title={
                  isRecordingLoading
                    ? "Please wait..."
                    : isCloudRecording && recordingStartedByMe
                      ? "Stop recording"
                      : isCloudRecording
                        ? "Recording in progress (started by another participant)"
                        : "Start cloud recording"
                }
              >
                {isRecordingLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                  </motion.div>
                ) : isCloudRecording ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Square className="h-5 w-5 fill-current" />
                  </motion.div>
                ) : (
                  <CircleDot className="h-5 w-5" />
                )}
              </Button>
            </motion.div>

            {/* Chat Toggle */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setIsChatOpen((v) => !v)}
                size="icon"
                variant="ghost"
                className={cn(
                  "rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300 relative",
                  isChatOpen && "bg-blue-500/80 hover:bg-blue-600"
                )}
                title={isChatOpen ? "Close chat" : "Open chat"}
              >
                <MessageSquare className="h-5 w-5" />
                {unreadChatCount > 0 && !isChatOpen && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
                    {unreadChatCount > 9 ? "9+" : unreadChatCount}
                  </span>
                )}
              </Button>
            </motion.div>

            {/* Copy Link Button - Only for event hosts */}
            {(() => {
              if (!mySpaceId.startsWith("event:")) return null;
              const eventId = mySpaceId.replace("event:", "");
              const currentEvent = events.find((e: any) => e._id === eventId);
              if (!currentEvent) return null;
              const isHost =
                currentEvent.creatorId?._id === me ||
                currentEvent.creatorId === me;
              if (!isHost) return null;

              return (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => {
                      const joinCode = currentEvent.publicJoinCode;
                      if (joinCode) {
                        const link = `${window.location.origin}/guest/event-join?code=${joinCode}`;
                        navigator.clipboard.writeText(link);
                        toast.success("Guest invite link copied to clipboard!");
                      } else {
                        toast.error("No invite link available for this event");
                      }
                    }}
                    size="icon"
                    variant="ghost"
                    className="rounded-full w-12 h-12 text-white hover:bg-white/10 transition-all duration-300"
                    title="Copy guest invite link"
                  >
                    <Link2 className="h-5 w-5" />
                  </Button>
                </motion.div>
              );
            })()}

            <div className="w-px h-8 bg-gray-600/50" />

            {/* End Call Button */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={async () => {
                  // If host is leaving an event call, notify backend to end the event
                  if (mySpaceId.startsWith("event:")) {
                    const eventId = mySpaceId.replace("event:", "");
                    const currentEvent = events.find((e: any) => e._id === eventId);
                    const isHost =
                      currentEvent?.creatorId?._id === me ||
                      currentEvent?.creatorId === me;
                    if (isHost && currentEvent?.isLive) {
                      try {
                        const orgId = localStorage.getItem("garage_org_id");
                        await api(
                          `/events/${eventId}/end?orgId=${orgId}`,
                          { method: "PATCH" },
                          getToken()!
                        );
                        console.log("[WorkspaceClient] Event ended by host:", eventId);
                      } catch (err) {
                        console.error("[WorkspaceClient] Failed to end event:", err);
                      }
                    }
                  }
                  leaveCall();
                  resetLocalSpaceState();
                  setIsCallMinimized(false);
                  setIsChatOpen(false);
                }}
                size="icon"
                className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700 text-white transition-all duration-300"
                aria-label="End Call"
              >
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <PhoneOff className="h-6 w-6" />
                </motion.div>
              </Button>
            </motion.div>
          </motion.div>

          {/* Chat Panel */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                className="absolute bottom-24 right-6 w-80 h-96 bg-[#0e0e12]/95 backdrop-blur-md border border-[#2a2a35] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[10000]"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                {/* Chat Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a35]">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">In-call Chat</span>
                  </div>
                  <Button
                    onClick={() => setIsChatOpen(false)}
                    size="icon"
                    variant="ghost"
                    className="rounded-full w-7 h-7 text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                      <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                      <p>No messages yet</p>
                      <p className="text-xs mt-1">Send a message to start chatting</p>
                    </div>
                  )}
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[85%]",
                        msg.sender === "local" ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-medium text-gray-400">
                          {msg.senderName}
                        </span>
                        <span className="text-[10px] text-gray-600">{msg.time}</span>
                      </div>
                      <div
                        className={cn(
                          "px-3 py-1.5 rounded-2xl text-sm break-words",
                          msg.sender === "local"
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-[#1e1e28] text-gray-200 rounded-bl-md"
                        )}
                      >
                        {msg.msg}
                      </div>
                    </div>
                  ))}
                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Input */}
                <form
                  onSubmit={handleSendChat}
                  className="flex items-center gap-2 px-3 py-3 border-t border-[#2a2a35]"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-[#1a1a24] border border-[#2a2a35] rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!chatInput.trim()}
                    className="rounded-full w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Minimized Call View - Draggable (skip for knock calls) */}
      <AnimatePresence>
        {inCall && isCallMinimized && !is1on1Call && !mySpaceId.startsWith("hq-room:") && (
          <motion.div
            className="fixed bottom-4 right-4 z-[9999] w-80 bg-black/90 rounded-lg overflow-hidden shadow-2xl border border-gray-700 p-4 cursor-grab active:cursor-grabbing select-none"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            dragConstraints={{
              top:
                -(typeof window !== "undefined" ? window.innerHeight : 800) +
                250,
              left:
                -(typeof window !== "undefined" ? window.innerWidth : 1200) +
                340,
              right: 0,
              bottom: 0,
            }}
            whileDrag={{
              scale: 1.02,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div className="relative w-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-white text-xs font-medium">
                    {remoteUserTracks.size + 1} participant
                    {remoteUserTracks.size !== 0 ? "s" : ""}
                  </span>
                </div>
                <Button
                  onClick={() => setIsCallMinimized(false)}
                  size="icon"
                  variant="ghost"
                  className="rounded-full w-7 h-7 text-white bg-white/10 hover:bg-white/20"
                  aria-label="Restore call"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Circular Participant Videos */}
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                {(() => {
                  const allParticipants: Array<{
                    id: string;
                    videoTrack: MediaStreamTrack | null;
                    isLocal: boolean;
                    displayName: string;
                    initials: string;
                    showMicMuted: boolean;
                  }> = [];

                  // Add local user first
                  // Get local user initials from participant data
                  const localParticipant = participantsInCurrentSpace.find(
                    (p) => p.id === me
                  );
                  const localInitials = localParticipant?.name
                    ? localParticipant.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                    : "Me";
                  allParticipants.push({
                    id: me,
                    videoTrack: localVideoTrack || null,
                    isLocal: true,
                    displayName: "You",
                    initials: localInitials,
                    showMicMuted: dailyMicMuted,
                  });

                  // Add remote users - remoteUserTracks is keyed by userId directly
                  const otherParticipants = participantsInCurrentSpace.filter(
                    (p) => p.id !== me
                  );
                  Array.from(remoteUserTracks.entries()).forEach(([userId, tracks]) => {
                    const { participant, displayName, initials } =
                      getParticipantInfo(userId, otherParticipants);

                    allParticipants.push({
                      id: participant?.id || `remote-${userId}`,
                      videoTrack: tracks.cameraTrack || null,
                      isLocal: false,
                      displayName,
                      initials,
                      showMicMuted: !tracks.hasAudio,
                    });
                  });

                  const maxVisible = 4;
                  const visibleParticipants = allParticipants.slice(
                    0,
                    maxVisible
                  );
                  const remainingCount = allParticipants.length - maxVisible;

                  return (
                    <>
                      {visibleParticipants.map((participant) => (
                        <div
                          key={participant.id}
                          className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-700 bg-gray-800 flex-shrink-0"
                        >
                          {participant.videoTrack ? (
                            <div className="w-full h-full rounded-full overflow-hidden">
                              <DailyVideoPlayer
                                videoTrack={participant.videoTrack}
                                isLocal={participant.isLocal}
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-full">
                              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-xs text-white font-semibold">
                                {participant.initials}
                              </div>
                            </div>
                          )}
                          {/* Mic muted indicator */}
                          {participant.showMicMuted && (
                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                              <MicOff className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          {/* Local user badge */}
                          {participant.isLocal && (
                            <div className="absolute top-0 left-0 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-[8px] font-bold">
                                You
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {remainingCount > 0 && (
                        <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-semibold">
                            +{remainingCount}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-700">
                <Button
                  onClick={handleDailyMicToggle}
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "rounded-full w-8 h-8 text-white hover:bg-white/10",
                    dailyMicMuted && "bg-red-500 hover:bg-red-600"
                  )}
                  aria-label={dailyMicMuted ? "Unmute" : "Mute"}
                >
                  {dailyMicMuted ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleDailyCameraToggle}
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "rounded-full w-8 h-8 text-white hover:bg-white/10",
                    dailyCameraOff && "bg-red-500 hover:bg-red-600"
                  )}
                  aria-label={
                    dailyCameraOff ? "Turn on camera" : "Turn off camera"
                  }
                >
                  {dailyCameraOff ? (
                    <VideoOff className="h-4 w-4" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={async () => {
                    // If host is leaving an event call, notify backend to end the event
                    if (mySpaceId.startsWith("event:")) {
                      const eventId = mySpaceId.replace("event:", "");
                      const currentEvent = events.find((e: any) => e._id === eventId);
                      const isHost =
                        currentEvent?.creatorId?._id === me ||
                        currentEvent?.creatorId === me;
                      if (isHost && currentEvent?.isLive) {
                        try {
                          const orgId = localStorage.getItem("garage_org_id");
                          await api(
                            `/events/${eventId}/end?orgId=${orgId}`,
                            { method: "PATCH" },
                            getToken()!
                          );
                          console.log("[WorkspaceClient] Event ended by host (minimized):", eventId);
                        } catch (err) {
                          console.error("[WorkspaceClient] Failed to end event:", err);
                        }
                      }
                    }
                    leaveCall();
                    resetLocalSpaceState();
                    setIsCallMinimized(false);
                  }}
                  size="icon"
                  className="rounded-full w-8 h-8 bg-red-600 hover:bg-red-700 text-white"
                  aria-label="End call"
                >
                  <PhoneOff className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
