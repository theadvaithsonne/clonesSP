"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";
import { PeerState, RoomBooking } from "@/app/(dashboard)/workspace/types";
import { HqMeetingRoomCard } from "@/app/(dashboard)/workspace/components/HqMeetingRoomCard";
import { HqRoomSchedule } from "@/components/dashboard/HqRoomSchedule";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useWorkspaceLiveKit as useLiveKit } from "@/lib/workspace-livekit-context";
import DailyVideoPlayer from "@/app/(dashboard)/workspace/components/DailyVideoPlayer";
import { Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, PhoneOff, X, Clock, Users, Loader2, AlertTriangle, Check, CircleDot, Square, StickyNote, Plus, Bell, ChevronDown, ChevronRight, Calendar, Shield, Eye, Lock, ChevronLeft, Trash2, Info, Copy, ExternalLink } from "lucide-react";
import ConferenceMemoPanel from "@/components/dashboard/ConferenceMemoPanel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";

// $5/month per extra room. Mirrors CONFERENCE_ROOM_PRICE_CENTS in
// services/conferenceRoomBilling.ts on the BE.
const CONFERENCE_ROOM_PRICE_USD = 5;

// Conference room descriptor returned by GET /conference-rooms.
// `spaceId` is the synthetic `hq-room:<orgId>:<roomId>` string the
// realtime layer routes presence + LiveKit traffic through — the
// backend computes it so the client doesn't re-derive the convention.
interface ConferenceRoomDescriptor {
  _id: string;
  orgId: string;
  name: string;
  spaceId: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // When set, the room is cancelled but stays live through this date
  // (= end of the paid cycle). Founder paid for the cycle, so the room
  // doesn't vanish until then. UI surfaces "Cancels on {date}".
  scheduledDeactivationAt?: string | null;
}

interface ConferenceRoomPageProps {
  setActivePopover: (popover: string | null) => void;
}

// mm:ss for the live recording timer
function formatRecElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function ConferenceRoomPage({ setActivePopover }: ConferenceRoomPageProps) {
  const router = useRouter();
  const [me, setMe] = useState<string>("");
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>([]);
  const [currentRoomBooking, setCurrentRoomBooking] = useState<RoomBooking | null>(null);
  const [showRoomBookingModal, setShowRoomBookingModal] = useState(false);
  const [showRoomSchedule, setShowRoomSchedule] = useState(false);
  // Whether the right panel is visible (only after clicking Check Availability)
  const [showRightPanel, setShowRightPanel] = useState(false);
  // Whether to show the upgrade/payment modal for 3rd+ room
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [joiningSpaceId, setJoiningSpaceId] = useState<string | null>(null);

  // Multi-room state. `conferenceRooms` is the list fetched from
  // GET /conference-rooms?orgId=... — each entry carries its own
  // synthetic spaceId for join + presence routing. When the list is
  // empty we fall back to the legacy synthetic `hq-room:<orgId>` room
  // so orgs that haven't created any named rooms yet still see a
  // working Conference Room card.
  const [conferenceRooms, setConferenceRooms] = useState<ConferenceRoomDescriptor[]>([]);
  // Which room a booking-modal-open click is bound to. Stored as the
  // ConferenceRoom._id (or null for the legacy single-room shape).
  const [bookingForRoomId, setBookingForRoomId] = useState<string | null>(null);
  // "+ Create Room" modal state (founder-only).
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [createRoomName, setCreateRoomName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  // "Cancel Room" modal state (founder-only). `cancelTargetRoom` is
  // the room currently being confirmed for cancellation; null when the
  // modal is closed.
  const [cancelTargetRoom, setCancelTargetRoom] =
    useState<ConferenceRoomDescriptor | null>(null);
  const [cancellingRoom, setCancellingRoom] = useState(false);

  const { amIFounder } = useAmIFounder();

  // Booking Form State (integrated inline)
  const [bookingTitle, setBookingTitle] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStartTime, setBookingStartTime] = useState("");
  const [bookingEndTime, setBookingEndTime] = useState("");
  const [bookingDurationMinutes, setBookingDurationMinutes] = useState(30);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bookingLoading, setBookingLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  // Meeting options toggles
  const [meetingIsPublic, setMeetingIsPublic] = useState(true);
  const [meetingShowParticipants, setMeetingShowParticipants] = useState(false);
  const [meetingSendInvites, setMeetingSendInvites] = useState(true);
  const [showMeetingOptions, setShowMeetingOptions] = useState(false);

  // Daily Schedule panel state and hooks (declared at top level to prevent conditional rendering errors)
  const [selectedRoomForPanel, setSelectedRoomForPanel] = useState<string | null>(null);
  const [panelDate, setPanelDate] = useState<Date>(new Date());
  const [currentTimeOffset, setCurrentTimeOffset] = useState<number | null>(null);

  const panelDateStr = useMemo(
    () => panelDate.toISOString().split("T")[0],
    [panelDate]
  );

  const isToday = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return panelDateStr === today;
  }, [panelDateStr]);

  useEffect(() => {
    if (!isToday) {
      setCurrentTimeOffset(null);
      return;
    }

    const updateTimeOffset = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      const totalMinutesFromMidnight = hours * 60 + minutes;
      // Each hour row is exactly 52px, so 1 minute is 52/60 px
      const offset = totalMinutesFromMidnight * (52 / 60);
      setCurrentTimeOffset(offset);
    };

    updateTimeOffset();
    const interval = setInterval(updateTimeOffset, 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  const getBookingStyle = useCallback((booking: RoomBooking) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    
    // Calculate fractional start hours and end hours relative to local midnight
    const startHours = start.getHours() + start.getMinutes() / 60;
    
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const endHours = Math.min(24, startHours + diffHours);
    
    // Clamp display to 0 - 24
    const clampedStartHours = Math.max(0, Math.min(24, startHours));
    
    const topOffset = clampedStartHours * 52;
    const height = Math.max(0, (endHours - clampedStartHours) * 52);
    
    return {
      top: `${topOffset}px`,
      height: `${height}px`,
    };
  }, []);

  const [mySpaceId, setMySpaceId] = useState<string>("lobby");
  const [dailyMicMuted, setDailyMicMuted] = useState(false);
  const [dailyCameraOff, setDailyCameraOff] = useState(false);

  /** Bookings where current user is invited (for Invitations section) */
  const myInvitations = useMemo(() => {
    return roomBookings.filter((b) => {
      if (b.status !== "active") return false;
      const isInvited =
        b.creatorId._id === me ||
        b.invitedUserIds.some((u) => u._id === me);
      return isInvited;
    });
  }, [roomBookings, me]);

  /** Invitations sorted: currently active first, then upcoming */
  const sortedInvitations = useMemo(() => {
    const now = new Date();
    const active = myInvitations.filter(
      (b) => new Date(b.startTime) <= now && new Date(b.endTime) >= now
    );
    const upcoming = myInvitations.filter((b) => new Date(b.startTime) > now);
    return [...active, ...upcoming];
  }, [myInvitations]);

  /** Which room sections are collapsed in the invitation list */
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

  const {
    inCall,
    room,
    localVideoTrack,
    localScreenTrack,
    remoteUserTracks,
    isScreenSharing,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    userInfoMap,
    // Recording
    isCloudRecording,
    recordingStartedByMe,
    isRecordingLoading,
    toggleCloudRecording,
    recordingActive,
    recordingElapsed,
    isOwner,
    noteTakerActive,
  } = useLiveKit();

  // Memo panel state
  const [showMemo, setShowMemo] = useState(false);
  const [memoRecording, setMemoRecording] = useState(false);
  const nameByIdentity = useMemo(() => {
    const map = new Map<string, string>();
    userInfoMap.forEach((info, id) => map.set(id, info.name || info.email || id));
    return map;
  }, [userInfoMap]);

  const handleDailyMicToggle = async () => {
    const isEnabled = await toggleMicrophone();
    setDailyMicMuted(!isEnabled);
  };

  const handleDailyCameraToggle = async () => {
    const isEnabled = await toggleCamera();
    setDailyCameraOff(!isEnabled);
  };

  // Sync camera UI state with actual camera track state
  useEffect(() => {
    setDailyCameraOff(!localVideoTrack);
  }, [localVideoTrack]);

  // Track previous inCall value to detect call-end transitions
  const prevInCallRef = useRef(false);
  useEffect(() => {
    if (prevInCallRef.current && !inCall) {
      setMySpaceId("lobby");
      setDailyMicMuted(false);
      setDailyCameraOff(false);
    }
    prevInCallRef.current = inCall;
  }, [inCall]);

  // Get current user ID
  useEffect(() => {
    const userId = getUserIdFromToken();
    if (userId) setMe(userId);
  }, []);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null;

  const fetchTeamMembers = useCallback(async () => {
    if (!orgId) return;
    setFetchingMembers(true);
    try {
      const response = await api<{ members: any[] }>(
        `/team/list?orgId=${orgId}`,
        {},
        getToken()!
      );
      setTeamMembers(response.members || []);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setFetchingMembers(false);
    }
  }, [orgId]);

  const fetchExistingBookings = useCallback(async () => {
    if (!orgId || !bookingDate) return;
    try {
      const dayStart = new Date(bookingDate);
      const dayEnd = new Date(bookingDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const response = await api<{ bookings: any[] }>(
        `/room-bookings?orgId=${orgId}&startDate=${dayStart.toISOString()}&endDate=${dayEnd.toISOString()}`,
        {},
        getToken()!
      );
      setExistingBookings(response.bookings || []);
    } catch (error) {
      console.error("Failed to fetch existing bookings:", error);
    }
  }, [orgId, bookingDate]);

  // Fetch team members when entering booking mode
  useEffect(() => {
    if (showRoomBookingModal) {
      fetchTeamMembers();
      // Default: today, next hour rounded, 30 min duration
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const start = new Date(now.getTime() + 60 * 60 * 1000);

      setBookingDate(start.toISOString().split("T")[0]);
      setBookingStartTime(start.toTimeString().substring(0, 5));
      setBookingEndTime("");
      setBookingDurationMinutes(30);
      setBookingTitle("");
      setSelectedMembers(new Set());
      setMemberSearchQuery("");
      setMeetingIsPublic(true);
      setMeetingShowParticipants(false);
      setMeetingSendInvites(true);
      setShowMeetingOptions(false);
    }
  }, [showRoomBookingModal, fetchTeamMembers]);

  // Hide bottom tab when booking modal is open
  useEffect(() => {
    if (showRoomBookingModal) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [showRoomBookingModal]);

  // Fetch existing bookings when date changes
  useEffect(() => {
    if (showRoomBookingModal && bookingDate) {
      fetchExistingBookings();
    }
  }, [showRoomBookingModal, bookingDate, fetchExistingBookings]);

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const bookingConflict = useMemo(() => {
    if (!bookingDate || !bookingStartTime || !bookingEndTime) return null;
    const start = new Date(`${bookingDate}T${bookingStartTime}`);
    const end = new Date(`${bookingDate}T${bookingEndTime}`);
    if (end <= start) return null;

    return existingBookings.find((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return start < bEnd && end > bStart;
    });
  }, [bookingDate, bookingStartTime, bookingEndTime, existingBookings]);

  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return teamMembers;
    const q = memberSearchQuery.toLowerCase();
    return teamMembers.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
    );
  }, [teamMembers, memberSearchQuery]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bookingTitle.trim()) {
      toast.error("Please enter a booking title");
      return;
    }
    if (selectedMembers.size === 0) {
      toast.error("Please select at least one participant");
      return;
    }
    if (!bookingDate || !bookingStartTime || !bookingEndTime) {
      toast.error("Please fill in all date and time fields");
      return;
    }

    if (!orgId) {
      toast.error("Organization context not found");
      return;
    }

    const startDateTime = new Date(`${bookingDate}T${bookingStartTime}`);
    const endDateTime = new Date(`${bookingDate}T${bookingEndTime}`);

    if (endDateTime <= startDateTime) {
      toast.error("End time must be after start time");
      return;
    }
    if (startDateTime < new Date()) {
      toast.error("Start time must be in the future");
      return;
    }

    setBookingLoading(true);
    try {
      await api(
        `/room-bookings?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            // Bind the booking to the room the user clicked Book on.
            // null means the legacy single-room shape — backend treats
            // a missing conferenceRoomId as the org-wide path so old
            // queries keep working.
            ...(bookingForRoomId ? { conferenceRoomId: bookingForRoomId } : {}),
            title: bookingTitle.trim(),
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            invitedUserIds: Array.from(selectedMembers),
          }),
        },
        getToken()!
      );

      toast.success("Room booked successfully!");
      window.dispatchEvent(new Event("room-booking:created"));
      fetchRoomBookings();
      setShowRoomBookingModal(false);
    } catch (error: any) {
      if (error?.status === 409) {
        toast.error("Time slot conflicts with an existing booking");
      } else {
        toast.error(error?.message || "Failed to book room");
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Derived room info
  const hqRoomSpaceId = useMemo(() => {
    return orgId ? `hq-room:${orgId}` : null;
  }, [orgId]);

  const hqRoomOccupants = useMemo(() => {
    if (!hqRoomSpaceId) return [];
    // Include current user if they are in the hq room space
    const allUsers = Array.from(peers.values());
    return allUsers.filter((p) => p.spaceId === hqRoomSpaceId);
  }, [peers, hqRoomSpaceId]);

  // Fetch bookings function
  const fetchRoomBookings = useCallback(async () => {
    if (!orgId) return;
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
      console.error("[ConferenceRoomPage] Error fetching room bookings:", error);
    }
  }, [orgId]);

  // Fetch the org's conference rooms. Reused after every room
  // create/rename/delete so the grid refreshes.
  const fetchConferenceRooms = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await api<{ success: boolean; rooms: ConferenceRoomDescriptor[] }>(
        `/conference-rooms?orgId=${orgId}`,
        {},
        getToken()!,
      );
      setConferenceRooms(res.rooms || []);
    } catch (error) {
      console.error("[ConferenceRoomPage] Error fetching conference rooms:", error);
    }
  }, [orgId]);

  const createConferenceRoom = useCallback(async () => {
    if (!orgId) return;
    const name = createRoomName.trim();
    if (!name) {
      toast.error("Room name is required");
      return;
    }
    setCreatingRoom(true);
    try {
      const res = await api<{
        success: boolean;
        room: ConferenceRoomDescriptor;
        // Set when this room is the 2nd+ (= billable). FE redirects to
        // /invoice/<id> so founder can pay the prorated charge for the
        // partial cycle. Null for the free first room.
        proratedInvoiceId: string | null;
      }>(
        `/conference-rooms?orgId=${orgId}`,
        { method: "POST", body: JSON.stringify({ name }) },
        getToken()!,
      );
      toast.success(`"${name}" created`);
      setCreateRoomName("");
      setShowCreateRoomModal(false);
      await fetchConferenceRooms();
      if (res.proratedInvoiceId) {
        // Hand off to the existing invoice payment page (Razorpay /
        // Stripe / wallet / crypto).
        router.push(`/invoice/${res.proratedInvoiceId}`);
      }
    } catch (error: any) {
      // 409 path bubbles up here with the backend's specific message
      // (e.g. duplicate room name). Show it verbatim so founders
      // know the conflict, not just "Failed".
      const msg =
        error?.message ||
        error?.error ||
        "Failed to create conference room";
      toast.error(msg);
    } finally {
      setCreatingRoom(false);
    }
  }, [orgId, createRoomName, fetchConferenceRooms, router]);

  // Cancel a room. The BE decides:
  //  - Free included room (no parent invoice): immediate soft-delete.
  //  - Paid extra room: stays usable until `activeUntil` (end of paid
  //    cycle), then drops out via lazy prune. No refund.
  // Response shape tells us which path we hit so we can toast accordingly.
  const cancelConferenceRoom = useCallback(async () => {
    if (!orgId || !cancelTargetRoom) return;
    setCancellingRoom(true);
    try {
      const res = await api<{
        success: boolean;
        activeUntil: string | null;
        parentCancelled: boolean;
      }>(
        `/conference-rooms/${cancelTargetRoom._id}?orgId=${orgId}`,
        { method: "DELETE" },
        getToken()!,
      );
      if (res.activeUntil) {
        const dateStr = new Date(res.activeUntil).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        toast.success(
          `"${cancelTargetRoom.name}" cancelled · stays usable until ${dateStr}`,
        );
      } else {
        toast.success(`"${cancelTargetRoom.name}" removed`);
      }
      setCancelTargetRoom(null);
      await fetchConferenceRooms();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel room");
    } finally {
      setCancellingRoom(false);
    }
  }, [orgId, cancelTargetRoom, fetchConferenceRooms]);

  // Fetch bookings on load and setup socket updates
  useEffect(() => {
    if (!orgId) return;

    fetchConferenceRooms();
    fetchRoomBookings();
    const interval = setInterval(fetchRoomBookings, 60000);

    const socket = connectSocket();
    const handleBookingChange = () => fetchRoomBookings();
    socket.on("room-booking:created", handleBookingChange);
    socket.on("room-booking:updated", handleBookingChange);
    socket.on("room-booking:cancelled", handleBookingChange);
    socket.on("room-booking:ended", handleBookingChange);

    return () => {
      clearInterval(interval);
      socket.off("room-booking:created", handleBookingChange);
      socket.off("room-booking:updated", handleBookingChange);
      socket.off("room-booking:cancelled", handleBookingChange);
      socket.off("room-booking:ended", handleBookingChange);
    };
  }, [orgId, fetchRoomBookings, fetchConferenceRooms]);

  // Socket listener for presence (occupants)
  useEffect(() => {
    if (!me) return;

    const socket = connectSocket();

    // Map of enrichments from team list
    let teamMembersMap = new Map<string, any>();

    const enrichPeer = (peer: PeerState) => {
      const details = teamMembersMap.get(peer.id);
      if (details) {
        return {
          ...peer,
          name: details.name || peer.name,
          profilePicture: details.profilePicture || peer.profilePicture,
          guest: peer.guest ?? details.guest,
        };
      }
      return peer;
    };

    // Load team list to enrich names and avatars
    const loadTeamAndJoin = async () => {
      if (orgId) {
        try {
          const res = await api<{ members: any[] }>(
            "/team/list?orgId=" + orgId,
            {},
            getToken()!
          );
          if (res.members) {
            res.members.forEach((m) => {
              const id = m.id || m._id;
              if (id) teamMembersMap.set(id, m);
            });
          }
        } catch (e) {
          console.error("[ConferenceRoomPage] Error fetching team list:", e);
        }
      }

      // Emit join after fetching team members to ensure proper enrichment
      console.log("[ConferenceRoomPage] Emitting workspace:join");
      socket.emit("workspace:join");
    };

    loadTeamAndJoin();

    const handleUsers = (users: PeerState[]) => {
      const myUser = users.find((u) => u.id === me);
      if (myUser) {
        setMySpaceId(myUser.spaceId || "lobby");
      }

      setPeers(
        new Map(
          users.map((u) => [
            u.id,
            enrichPeer({
              ...u,
              isScreenSharing: !!u.isScreenSharing,
              isRecording: !!u.isRecording,
            }),
          ])
        )
      );
    };

    const handleUserJoined = (user: PeerState) => {
      if (user.id === me) {
        setMySpaceId(user.spaceId || "lobby");
      }
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(
          user.id,
          enrichPeer({
            ...user,
            isScreenSharing: !!user.isScreenSharing,
            isRecording: !!user.isRecording,
          })
        );
        return next;
      });
    };

    const handleUserLeft = ({ id }: any) => {
      setPeers((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    };

    const handleUserMovedSpace = ({ userId, spaceId }: any) => {
      if (userId === me) {
        setMySpaceId(spaceId);
        if (spaceId === "lobby") setJoiningSpaceId(null);
      }
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(userId);
        if (existing) {
          next.set(userId, { ...existing, spaceId });
        } else {
          // If we don't have the peer yet, create a placeholder that will be enriched
          next.set(
            userId,
            enrichPeer({
              id: userId,
              email: "",
              spaceId,
            })
          );
        }
        return next;
      });
    };

    const handlePresenceSync = (data: { presence?: Record<string, string> }) => {
      if (!data || !data.presence) return;
      if (data.presence[me]) {
        setMySpaceId(data.presence[me]);
      }
      setPeers((prev) => {
        const next = new Map(prev);
        Object.entries(data.presence || {}).forEach(([userId, spaceId]) => {
          const existing = next.get(userId);
          if (existing) {
            next.set(userId, { ...existing, spaceId });
          } else {
            next.set(
              userId,
              enrichPeer({
                id: userId,
                email: "",
                spaceId,
              })
            );
          }
        });
        return next;
      });
    };

    socket.on("workspace:users", handleUsers);
    socket.on("workspace:user-joined", handleUserJoined);
    socket.on("workspace:user-left", handleUserLeft);
    socket.on("workspace:user-moved-space", handleUserMovedSpace);
    socket.on("workspace:presence-sync", handlePresenceSync);

    return () => {
      socket.off("workspace:users", handleUsers);
      socket.off("workspace:user-joined", handleUserJoined);
      socket.off("workspace:user-left", handleUserLeft);
      socket.off("workspace:user-moved-space", handleUserMovedSpace);
      socket.off("workspace:presence-sync", handlePresenceSync);
    };
  }, [me, orgId]);

  // Join Room Handler — now accepts the target room's spaceId so the
  // grid can route each room's Join button to the right LiveKit room.
  // Falls back to the legacy hqRoomSpaceId for old call sites.
  // Two paths:
  //  1. Named room with an id  → open the standalone
  //     /meet/conference/<orgId>/<roomId> URL in a new tab. Matches
  //     NC's /meet/room/[id] flow: the meeting lives in its own tab
  //     so the workspace tab stays available for chat, docs, etc.,
  //     and closing the meeting tab is a clean disconnect. This is
  //     the path 95% of orgs are on now.
  //  2. Legacy single-room shape (id is null) → fall back to the
  //     original inline workspace:move-to-space socket flow. The
  //     standalone URL requires a roomId, so orgs that never
  //     migrated stay inline until they create a named room.
  const handleJoinRoom = useCallback(
    (spaceId?: string, roomId?: string | null) => {
      if (roomId && orgId) {
        window.open(
          `/meet/conference/${orgId}/${roomId}`,
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
      const target = spaceId || hqRoomSpaceId;
      if (!target) return;
      setJoiningSpaceId(target);
      connectSocket().emit("workspace:move-to-space", {
        spaceId: target,
      });
      toast.success("Joining Conference Room...");
    },
    [hqRoomSpaceId, orgId],
  );

  // List of rooms to render. When the org has created named rooms we
  // show those; otherwise we surface the legacy single-room shape so
  // orgs that haven't migrated still have a working card.
  const roomsToRender = useMemo<
    Array<{ id: string | null; name: string; spaceId: string }>
  >(() => {
    if (conferenceRooms.length > 0) {
      return conferenceRooms.map((r) => ({
        id: r._id,
        name: r.name,
        spaceId: r.spaceId,
      }));
    }
    return hqRoomSpaceId
      ? [{ id: null, name: "Conference Room", spaceId: hqRoomSpaceId }]
      : [];
  }, [conferenceRooms, hqRoomSpaceId]);

  // Per-room booking lookup. Bookings carry a conferenceRoomId on the
  // new flow; legacy ones don't. The legacy synthetic room consumes
  // any bookings without a conferenceRoomId so old data still renders.
  const bookingsByRoomKey = useMemo(() => {
    const map = new Map<string, RoomBooking[]>();
    for (const b of roomBookings) {
      const key = (b as any).conferenceRoomId
        ? String((b as any).conferenceRoomId)
        : "__legacy__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [roomBookings]);

  const occupantsBySpaceId = useMemo(() => {
    const map = new Map<string, PeerState[]>();
    for (const p of Array.from(peers.values())) {
      if (!p.spaceId) continue;
      if (!map.has(p.spaceId)) map.set(p.spaceId, []);
      map.get(p.spaceId)!.push(p);
    }
    return map;
  }, [peers]);

  const selectedRoomObj = useMemo(
    () => roomsToRender.find((r) => r.spaceId === selectedRoomForPanel) || roomsToRender[0] || null,
    [roomsToRender, selectedRoomForPanel]
  );

  /** Bookings for the selected room on the panel date */
  const panelRoomBookings = useMemo(() => {
    if (!selectedRoomObj) return [];
    const roomKey = selectedRoomObj.id || "__legacy__";
    const allForRoom = bookingsByRoomKey.get(roomKey) || [];
    return allForRoom.filter((b) => {
      const bDate = new Date(b.startTime).toISOString().split("T")[0];
      return bDate === panelDateStr;
    });
  }, [selectedRoomObj, bookingsByRoomKey, panelDateStr]);

  // Recovery: if user is in a conference-room space but LiveKit call
  // didn't connect, re-emit move-to-space to trigger a fresh
  // livekit:join-call from the backend. Works for any of the org's
  // conference rooms (multi-room) and the legacy synthetic room
  // (single-room) — we just check whether the user's current spaceId
  // matches any room we're rendering.
  const meetingRetryRef = useRef(false);
  const isInAnyConferenceRoom = useMemo(
    () => roomsToRender.some((r) => r.spaceId === mySpaceId),
    [roomsToRender, mySpaceId],
  );
  useEffect(() => {
    if (!isInAnyConferenceRoom) {
      meetingRetryRef.current = false;
      return;
    }
    if (inCall) {
      meetingRetryRef.current = false;
      return;
    }
    if (meetingRetryRef.current) return;

    const timeout = setTimeout(() => {
      if (!meetingRetryRef.current && isInAnyConferenceRoom) {
        meetingRetryRef.current = true;
        console.log("[ConferenceRoomPage] Recovery: re-requesting call for", mySpaceId);
        connectSocket().emit("workspace:move-to-space", { spaceId: mySpaceId });
      }
    }, 4000);
    return () => clearTimeout(timeout);
  }, [inCall, mySpaceId, isInAnyConferenceRoom]);

  // Participant helper for name & initials resolution
  const getParticipantInfo = useCallback((userId: string) => {
    const livekitInfo = userInfoMap.get(userId);
    if (livekitInfo) {
      return {
        displayName: livekitInfo.name || livekitInfo.email?.split("@")[0] || "Participant",
        initials: livekitInfo.name
          ? livekitInfo.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
          : livekitInfo.email?.charAt(0).toUpperCase() || "P"
      };
    }

    const peer = peers.get(userId);
    if (peer) {
      return {
        displayName: peer.name || peer.email?.split("@")[0] || "Participant",
        initials: peer.name
          ? peer.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
          : peer.email?.charAt(0).toUpperCase() || "P"
      };
    }

    return {
      displayName: "Participant",
      initials: "P"
    };
  }, [userInfoMap, peers]);

  if (inCall) {
    const totalParticipants = remoteUserTracks.size + 1; // +1 for local user

    // Screen sharing check
    const someoneIsScreenSharing = isScreenSharing || localScreenTrack || Array.from(remoteUserTracks.values()).some(t => t.hasScreenVideo || t.screenTrack);
    
    // Find the participant who is screen sharing (if any)
    let screenSharerId: string | null = null;
    let screenShareTrack: MediaStreamTrack | null = null;
    
    if (localScreenTrack) {
      screenSharerId = "local";
      screenShareTrack = localScreenTrack;
    } else {
      for (const [userId, tracks] of Array.from(remoteUserTracks.entries())) {
        if (tracks.screenTrack || tracks.hasScreenVideo) {
          screenSharerId = userId;
          screenShareTrack = tracks.screenTrack;
          break;
        }
      }
    }

    return (
      <div className="flex flex-col h-[calc(100vh-68px)] bg-[#0a0a0d] text-white overflow-hidden relative">
        {/* Call Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0e0e12]/80 border-b border-[#2a2a35] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-semibold text-white">Conference Call</h2>
            <span className="px-2 py-0.5 text-xs rounded bg-[#2a2a35] text-[#9fa0b8]">
              {totalParticipants} participant{totalParticipants > 1 ? "s" : ""}
            </span>
          </div>
          {recordingActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[11px] font-medium text-red-300 tabular-nums">
                REC {formatRecElapsed(recordingElapsed)}
              </span>
            </div>
          )}
        </div>

        {/* Recording banner — shown to ALL participants while recording */}
        {recordingActive && (
          <div className="flex-shrink-0 flex items-center justify-center gap-2 bg-red-500/10 border-b border-red-500/25 px-4 py-1.5">
            <span className="text-xs font-medium text-red-300">
              This conference is being recorded
            </span>
          </div>
        )}

        {/* Main video area */}
        <div className="flex-1 flex min-h-0 relative p-4 gap-4 overflow-hidden">
          {someoneIsScreenSharing && screenShareTrack ? (
            /* Screen Share Layout */
            <div className="flex-1 flex gap-4 h-full overflow-hidden">
              {/* Screen Share Element (Left/Middle) */}
              <div className="flex-grow bg-[#111116] rounded-xl border border-[#2a2a35] overflow-hidden relative flex items-center justify-center min-w-0">
                <DailyVideoPlayer videoTrack={screenShareTrack} isScreenShare />
                <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-blue-500/90 rounded-full text-xs font-semibold text-white shadow-lg flex items-center gap-1.5">
                  <ScreenShare className="w-3.5 h-3.5" />
                  {screenSharerId === "local" ? "Your Screen" : `${getParticipantInfo(screenSharerId!).displayName}'s Screen`}
                </div>
              </div>

              {/* Vertical Sidebar of Participant Videos (Right) */}
              <div className="w-64 flex flex-col gap-3 overflow-y-auto pr-1 flex-shrink-0">
                {/* Local user video card */}
                <div className="bg-[#111116] border border-[#2a2a35] rounded-xl overflow-hidden relative aspect-video flex-shrink-0">
                  <DailyVideoPlayer
                    videoTrack={localVideoTrack}
                    isLocal={true}
                    userName="You"
                    showMicMuted={dailyMicMuted}
                  />
                  {localScreenTrack && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-blue-500 rounded text-[10px] text-white font-medium">
                      Sharing Screen
                    </div>
                  )}
                </div>

                {/* Remote users video cards */}
                {Array.from(remoteUserTracks.entries()).map(([userId, tracks]) => {
                  const { displayName } = getParticipantInfo(userId);
                  const isThisUserScreenSharing = userId === screenSharerId;

                  return (
                    <div
                      key={userId}
                      className="bg-[#111116] border border-[#2a2a35] rounded-xl overflow-hidden relative aspect-video flex-shrink-0"
                    >
                      <DailyVideoPlayer
                        videoTrack={tracks.cameraTrack || null}
                        userName={displayName}
                        showMicMuted={!tracks.hasAudio}
                      />
                      {isThisUserScreenSharing && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-blue-500 rounded text-[10px] text-white font-medium">
                          Sharing Screen
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Normal Grid Layout */
            <div
              className={cn(
                "flex-1 grid gap-4 h-full w-full",
                (() => {
                  const tiles = totalParticipants + (noteTakerActive ? 1 : 0);
                  if (tiles === 1) return "grid-cols-1";
                  if (tiles === 2) return "grid-cols-2";
                  if (tiles <= 4) return "grid-cols-2 grid-rows-2";
                  if (tiles <= 6) return "grid-cols-3 grid-rows-2";
                  return "grid-cols-3 auto-rows-auto overflow-y-auto";
                })()
              )}
            >
              {/* Local Participant Card */}
              <div className="bg-[#111116] border border-[#2a2a35] rounded-xl overflow-hidden relative min-h-[180px]">
                <DailyVideoPlayer
                  videoTrack={localVideoTrack}
                  isLocal={true}
                  userName="You"
                  showMicMuted={dailyMicMuted}
                />
              </div>

              {/* Remote Participants Cards */}
              {Array.from(remoteUserTracks.entries()).map(([userId, tracks]) => {
                const { displayName } = getParticipantInfo(userId);

                return (
                  <div
                    key={userId}
                    className="bg-[#111116] border border-[#2a2a35] rounded-xl overflow-hidden relative min-h-[180px]"
                  >
                    <DailyVideoPlayer
                      videoTrack={tracks.cameraTrack || null}
                      userName={displayName}
                      showMicMuted={!tracks.hasAudio}
                    />
                  </div>
                );
              })}

              {/* Note Taker — synthetic tile while the bot is listening */}
              {noteTakerActive && (
                <div className="bg-[#111116] border border-[#2a2a35] rounded-xl overflow-hidden relative min-h-[180px] flex flex-col items-center justify-center gap-3">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/15">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-purple-500/30 animate-ping" />
                    <Mic className="relative h-6 w-6 text-purple-300" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-white">Note Taker</div>
                    <div className="text-[11px] text-purple-300 flex items-center justify-center gap-1 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                      Listening
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls Bar at the Bottom */}
        <div className="py-5 bg-[#0e0e12]/90 border-t border-[#2a2a35] flex justify-center items-center gap-4 relative">
          {/* Mute Mic */}
          <button
            onClick={handleDailyMicToggle}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer text-white",
              dailyMicMuted
                ? "bg-red-500 hover:bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                : "bg-[#2a2a35] hover:bg-[#383847] border border-[#3e3e50]"
            )}
            title={dailyMicMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {dailyMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={handleDailyCameraToggle}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer text-white",
              dailyCameraOff
                ? "bg-red-500 hover:bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                : "bg-[#2a2a35] hover:bg-[#383847] border border-[#3e3e50]"
            )}
            title={dailyCameraOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {dailyCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Toggle Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer text-white",
              isScreenSharing
                ? "bg-blue-500 hover:bg-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                : "bg-[#2a2a35] hover:bg-[#383847] border border-[#3e3e50]"
            )}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            {isScreenSharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
          </button>

          {/* Record (owner only) */}
          {isOwner && (
            <button
              onClick={() => toggleCloudRecording()}
              disabled={isRecordingLoading || (isCloudRecording && !recordingStartedByMe)}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer text-white disabled:opacity-50",
                isCloudRecording
                  ? "bg-red-500 hover:bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                  : "bg-[#2a2a35] hover:bg-[#383847] border border-[#3e3e50]"
              )}
              title={
                isRecordingLoading
                  ? "Please wait…"
                  : isCloudRecording
                    ? "Stop recording"
                    : "Record this conference"
              }
            >
              {isRecordingLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isCloudRecording ? (
                <Square className="w-5 h-5 fill-current" />
              ) : (
                <CircleDot className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Voice Memo (any logged-in participant) */}
          <button
            onClick={() => setShowMemo((v) => !v)}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer text-white",
              showMemo
                ? "bg-brand hover:opacity-90 text-brand-foreground"
                : "bg-[#2a2a35] hover:bg-[#383847] border border-[#3e3e50]"
            )}
            title="Record a voice memo of this call"
          >
            <StickyNote className="w-5 h-5" />
          </button>

          {/* Separation Line */}
          <div className="w-px h-8 bg-[#2a2a35]" />

          {/* End Call / Leave Call */}
          <button
            onClick={() => {
              leaveCall();
              setJoiningSpaceId(null);
            }}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium rounded-full cursor-pointer transition-all shadow-[0_4px_12px_rgba(220,38,38,0.3)] flex items-center gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Leave Room</span>
          </button>
        </div>

        {/* Voice Memo panel */}
        {showMemo && (
          <ConferenceMemoPanel
            room={room}
            spaceId={hqRoomSpaceId || ""}
            meetTitle="Conference Call"
            nameByIdentity={nameByIdentity}
            onClose={() => setShowMemo(false)}
            onRecordingChange={setMemoRecording}
          />
        )}
      </div>
    );
  }

  // ─── Schedule Meeting Modal ───────────────────────────────────────────────
  if (showRoomBookingModal) {
    // Duration options for the dropdown
    const durationOptions = [
      { label: "30 min", minutes: 30 },
      { label: "1 hour", minutes: 60 },
      { label: "1.5 hours", minutes: 90 },
      { label: "2 hours", minutes: 120 },
      { label: "3 hours", minutes: 180 },
    ];

    // Compute end time from start + duration
    const computedEndTime = (() => {
      if (!bookingStartTime || !bookingDate) return "";
      const [h, m] = bookingStartTime.split(":").map(Number);
      const start = new Date(bookingDate);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + bookingDurationMinutes * 60000);
      return end.toTimeString().substring(0, 5);
    })();

    // Sync computed end time
    if (computedEndTime && computedEndTime !== bookingEndTime) {
      setBookingEndTime(computedEndTime);
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-[520px] bg-[#111114] border border-[#2a2a2e] rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Modal header */}
          <div className="px-6 pt-6 pb-4 border-b border-[#1e1e22]">
            <h2 className="text-[18px] font-bold text-white">Schedule Meeting</h2>
          </div>

          <form
            onSubmit={(e) => {
              // Override end time with computed before submitting
              setBookingEndTime(computedEndTime || bookingEndTime);
              handleBookingSubmit(e);
            }}
            className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto"
          >
            {/* Meeting Title */}
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-[#888] uppercase tracking-wider">Meeting Title</label>
              <input
                value={bookingTitle}
                onChange={(e) => setBookingTitle(e.target.value)}
                placeholder="Enter meeting title"
                maxLength={200}
                className="w-full h-11 px-4 rounded-xl bg-[#1a1a1e] border border-[#2a2a2e] text-white placeholder-[#555] text-[14px] focus:outline-none focus:border-brand/60 transition-colors"
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" />
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#1a1a1e] border border-[#2a2a2e] text-white text-[14px] focus:outline-none focus:border-brand/60 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-[#888] uppercase tracking-wider">Start Time</label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" />
                <input
                  type="time"
                  value={bookingStartTime}
                  onChange={(e) => setBookingStartTime(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#1a1a1e] border border-[#2a2a2e] text-white text-[14px] focus:outline-none focus:border-brand/60 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-[#888] uppercase tracking-wider">Duration</label>
              <div className="relative">
                <select
                  value={bookingDurationMinutes}
                  onChange={(e) => setBookingDurationMinutes(Number(e.target.value))}
                  className="w-full h-11 px-4 pr-10 rounded-xl bg-[#1a1a1e] border border-[#2a2a2e] text-white text-[14px] focus:outline-none focus:border-brand/60 transition-colors appearance-none cursor-pointer"
                >
                  {durationOptions.map((opt) => (
                    <option key={opt.minutes} value={opt.minutes} className="bg-[#1a1a1e]">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" />
              </div>
            </div>

            {/* Invite Participants */}
            <div className="space-y-3">
              <label className="text-[12px] font-semibold text-[#888] uppercase tracking-wider">Invite Participants</label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" />
                <input
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Add participants..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#1a1a1e] border border-[#2a2a2e] text-white placeholder-[#555] text-[14px] focus:outline-none focus:border-brand/60 transition-colors"
                />
              </div>

              {/* Member dropdown */}
              {memberSearchQuery.trim() && filteredMembers.length > 0 && (
                <div className="rounded-xl border border-[#2a2a2e] bg-[#141416] overflow-hidden max-h-40 overflow-y-auto">
                  {fetchingMembers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-[#888]" />
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const memberId = member._id || member.id;
                      const isSelected = selectedMembers.has(memberId);
                      return (
                        <button
                          key={memberId}
                          type="button"
                          onClick={() => {
                            toggleMember(memberId);
                            setMemberSearchQuery("");
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left cursor-pointer hover:bg-white/5",
                            isSelected && "bg-brand/5"
                          )}
                        >
                          {member.profilePicture ? (
                            <img src={member.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-[11px] font-bold text-brand-foreground flex-shrink-0">
                              {(member.name || member.email).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-white font-medium truncate">{member.name}</p>
                            <p className="text-[11px] text-[#666] truncate">{member.email}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-brand flex-shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Selected participant chips */}
              {selectedMembers.size > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedMembers).map((memberId) => {
                    const member = teamMembers.find((m) => (m._id || m.id) === memberId);
                    if (!member) return null;
                    const initial = (member.name || member.email).charAt(0).toUpperCase();
                    return (
                      <div
                        key={memberId}
                        className="flex items-center gap-2 pl-1 pr-3.5 py-1 rounded-full bg-[#1e1e22] border border-[#2e2e34] cursor-pointer hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
                        onClick={() => toggleMember(memberId)}
                        title="Click to remove participant"
                      >
                        {member.profilePicture ? (
                          <img src={member.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-[10px] font-bold text-brand-foreground select-none">
                            {initial}
                          </div>
                        )}
                        <span className="text-[12px] text-white font-semibold group-hover:text-red-400 transition-colors">
                          {member.name?.split(" ")[0] || member.email}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Meeting Options */}
            <div className="space-y-4 font-sans border-t border-[#1e1e22] pt-4">
              <button
                type="button"
                onClick={() => setShowMeetingOptions((v) => !v)}
                className="flex items-center justify-between w-full text-left focus:outline-none cursor-pointer group"
              >
                <h3 className="text-[15px] font-bold text-white group-hover:text-white/80 transition-colors">Meeting Options</h3>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-[#888] transition-transform duration-200 group-hover:text-white/80",
                    showMeetingOptions ? "rotate-180" : ""
                  )}
                />
              </button>

              {showMeetingOptions && (
                <div className="space-y-4 pt-1">
                  {/* Public Meeting toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-white">Public Meeting</p>
                      <p className="text-[12px] text-[#666] mt-0.5">Anyone can join this meeting</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMeetingIsPublic((v) => !v)}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 focus:outline-none",
                        meetingIsPublic ? "bg-brand" : "bg-[#3a3a3e]"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                          meetingIsPublic ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Show Participants toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-white">Show Participants</p>
                      <p className="text-[12px] text-[#666] mt-0.5">Others can see who is attending</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMeetingShowParticipants((v) => !v)}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 focus:outline-none",
                        meetingShowParticipants ? "bg-brand" : "bg-[#3a3a3e]"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                          meetingShowParticipants ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Send Invites toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-white">Send Invites</p>
                      <p className="text-[12px] text-[#666] mt-0.5">Notify participants via email</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMeetingSendInvites((v) => !v)}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 focus:outline-none",
                        meetingSendInvites ? "bg-brand" : "bg-[#3a3a3e]"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                          meetingSendInvites ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Conflict warning */}
            {bookingConflict && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-brand/10 border border-brand/30">
                <AlertTriangle className="h-5 w-5 text-brand flex-shrink-0" />
                <p className="text-[13px] text-brand font-medium">
                  Time conflict detected: Conference room is already booked during this time
                </p>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#1e1e22] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowRoomBookingModal(false)}
              className="h-10 px-6 rounded-xl border border-[#2a2a2e] text-white text-[13px] font-medium hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                setBookingEndTime(computedEndTime || bookingEndTime);
                handleBookingSubmit(e as any);
              }}
              disabled={bookingLoading || !!bookingConflict || !bookingTitle.trim()}
              className="h-10 px-6 rounded-xl bg-brand hover:opacity-90 text-brand-foreground text-[13px] font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {bookingLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Booking...
                </>
              ) : (
                "Confirm Booking"
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Derived data for the customer view ────────────────────────────────────

  const toggleRoomExpand = (roomId: string) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  /** Hours to show in the daily schedule panel (24 Hours) */
  const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i);

  const formatHour = (h: number) => {
    if (h === 0) return "12:00 AM";
    if (h === 12) return "12:00 PM";
    return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
  };

  const isMyBooking = (b: RoomBooking) =>
    b.creatorId._id === me || b.invitedUserIds.some((u) => u._id === me);

  const panelTitle = selectedRoomObj?.name || "Conference Room";
  const panelSelectedRoomKey = selectedRoomObj?.id || "__legacy__";
  const panelCurrentBooking = (() => {
    const now = new Date();
    return (bookingsByRoomKey.get(panelSelectedRoomKey) || []).find(
      (b) => b.status === "active" && new Date(b.startTime) <= now && new Date(b.endTime) >= now
    ) || null;
  })();
  const panelIsAvailable = !panelCurrentBooking;

  const formatPanelDate = (d: Date) => {
    const today = new Date().toISOString().split("T")[0];
    const dateStr = d.toISOString().split("T")[0];
    if (today === dateStr) {
      return `Today, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatBookingTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <div className="flex h-full bg-[#0a0a0c] overflow-hidden">
      {/* ─── Main content area ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 min-w-0">

        {/* ── Invitations section ─────────────────────────────────── */}
        {sortedInvitations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-[#2a2a2e] bg-[#111113] overflow-hidden"
          >
            {/* Invitations header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-brand" />
                <h2 className="text-[16px] font-bold text-white">Invitations</h2>
              </div>
              <span className="text-[13px] text-[#666]">
                {roomsToRender.length} room{roomsToRender.length !== 1 ? "s" : ""} &bull; {sortedInvitations.length} meeting{sortedInvitations.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Individual invitation cards */}
            {sortedInvitations.slice(0, 3).map((booking) => {
              const now = new Date();
              const isActiveNow =
                new Date(booking.startTime) <= now && new Date(booking.endTime) >= now;
              const isStartingSoon =
                !isActiveNow &&
                new Date(booking.startTime).getTime() - now.getTime() < 15 * 60 * 1000;

              // Find which room this booking belongs to
              const bookingRoom = roomsToRender.find((r) => {
                const key = r.id || "__legacy__";
                return (bookingsByRoomKey.get(key) || []).some((b) => b._id === booking._id);
              });

              return (
                <div
                  key={booking._id}
                  className="mx-4 mb-3 p-4 rounded-xl bg-[#161618] border border-[#2a2a2e] flex items-center gap-4 animate-fade-in"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    isActiveNow
                      ? "border border-red-500/30 bg-red-950/20 text-red-500"
                      : "border border-brand/30 bg-[#242015] text-brand"
                  )}>
                    {isActiveNow ? (
                      <Clock className="w-4 h-4 text-red-500" />
                    ) : (
                      <Calendar className="w-4 h-4 text-brand" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn(
                        "text-[11px] font-bold uppercase tracking-wider",
                        isActiveNow ? "text-red-500" : "text-brand"
                      )}>
                        You&apos;re invited
                      </span>
                      {bookingRoom && (
                        <span className="text-[11px] text-[#888] font-medium">{bookingRoom.name}</span>
                      )}
                    </div>
                    <p className="text-[14px] font-bold text-white truncate">{booking.title}</p>
                    <p className="text-[12px] text-[#888] mt-0.5">Hosted by {booking.creatorId.name}</p>
                    {isActiveNow ? (
                      <p className="text-[12px] text-red-400 font-semibold mt-0.5">Starts now</p>
                    ) : (
                      <p className="text-[12px] text-[#888] mt-0.5">
                        {new Date(booking.startTime).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })} at {formatBookingTime(booking.startTime)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const room = bookingRoom;
                      if (room) handleJoinRoom(room.spaceId, room.id);
                    }}
                    className={cn(
                      "flex-shrink-0 h-9 px-4 rounded-xl text-[13px] font-bold transition-colors cursor-pointer shadow-sm",
                      isActiveNow
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-brand hover:opacity-90 text-brand-foreground"
                    )}
                  >
                    {isActiveNow
                      ? "Join Now"
                      : `Join at ${formatBookingTime(booking.startTime)}`}
                  </button>
                </div>
              );
            })}

            {/* Per-room collapsible meeting lists */}
            {roomsToRender.map((room) => {
              const roomKey = room.id || "__legacy__";
              const roomMeetings = (bookingsByRoomKey.get(roomKey) || []).filter(
                (b) => b.invitedUserIds.some((u) => u._id === me) || b.creatorId._id === me
              );
              if (roomMeetings.length === 0) return null;
              const isExpanded = expandedRooms.has(room.spaceId);
              const now = new Date();

              return (
                <div key={room.spaceId} className="border-t border-[#1e1e22]">
                  <button
                    onClick={() => toggleRoomExpand(room.spaceId)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#666]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#666]" />
                    )}
                    <span className="text-[14px] font-semibold text-white">{room.name}</span>
                    <span className="text-[12px] text-[#666] ml-1">{roomMeetings.length} meeting{roomMeetings.length !== 1 ? "s" : ""}</span>
                    <span className="ml-auto text-[12px] text-[#666]">Private</span>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-3">
                      {roomMeetings.map((b) => {
                        const isActiveNow =
                          new Date(b.startTime) <= now && new Date(b.endTime) >= now;
                        return (
                          <div key={b._id} className="flex items-start gap-4 py-3 border-b border-[#1e1e22] last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-white">{b.title}</p>
                              <p className="text-[12px] text-[#888] mt-0.5">Hosted by {b.creatorId.name}</p>
                              {isActiveNow ? (
                                <p className="text-[12px] text-red-400 font-semibold mt-0.5">Starts now</p>
                              ) : (
                                <p className="text-[12px] text-[#888] mt-0.5">
                                  {new Date(b.startTime).toLocaleDateString("en-US", {
                                    weekday: "short", month: "short", day: "numeric",
                                  })} at {formatBookingTime(b.startTime)}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleJoinRoom(room.spaceId, room.id)}
                              className={cn(
                                "flex-shrink-0 h-8 px-4 rounded-xl text-[12px] font-bold transition-colors cursor-pointer",
                                isActiveNow
                                  ? "bg-red-500 hover:bg-red-600 text-white"
                                  : "border border-brand text-brand hover:bg-brand/10"
                              )}
                            >
                              {isActiveNow ? "Join Now" : "Join"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── Room cards grid ─────────────────────────────────────── */}
        {roomsToRender.length === 0 ? (
          // 0 rooms: show the add card for founders, or empty state for members
          amIFounder ? (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(360px,360px))]">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="border-2 border-dashed border-[#2a2a2e] rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[240px] cursor-pointer hover:border-brand/40 transition-colors group col-span-full sm:col-span-1"
                onClick={() => {
                  setCreateRoomName("");
                  setShowCreateRoomModal(true);
                }}
              >
                <div className="w-12 h-12 rounded-full border border-[#3a3a3e] group-hover:border-brand/60 flex items-center justify-center transition-colors">
                  <Plus className="w-6 h-6 text-white group-hover:text-brand transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-[15px] font-bold text-white">Add Conference Room</p>
                  <p className="text-[12px] text-emerald-400 mt-0.5">Free • 2 free slots available</p>
                </div>
                <button
                  className="h-9 px-6 rounded-xl bg-brand hover:opacity-90 text-brand-foreground text-[13px] font-bold transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreateRoomName("");
                    setShowCreateRoomModal(true);
                  }}
                >
                  Create Room
                </button>
              </motion.div>
            </div>
          ) : (
            <div className="border border-dashed border-[#2a2a2e] rounded-2xl p-12 flex flex-col items-center text-center">
              <p className="text-[15px] font-semibold text-white">No conference rooms yet</p>
              <p className="text-[13px] text-[#666] mt-2 max-w-sm">
                Your founders haven&apos;t set up a conference room yet.
              </p>
            </div>
          )
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(360px,360px))]">
            {roomsToRender.map((room) => {
              const roomKey = room.id || "__legacy__";
              const cardBookings = bookingsByRoomKey.get(roomKey) || [];
              const now = new Date();
              const cardCurrentBooking =
                cardBookings.find(
                  (b) =>
                    b.status === "active" &&
                    new Date(b.startTime) <= now &&
                    new Date(b.endTime) >= now
                ) || null;
              const cardUpcoming = cardBookings.filter(
                (b) => b.status === "active" && new Date(b.startTime) > now
              );
              const cardOccupants = occupantsBySpaceId.get(room.spaceId) || [];
              // Today's bookings for the schedule bar
              const todayStr = now.toISOString().split("T")[0];
              const todayBookings = cardBookings.filter((b) => {
                const d = new Date(b.startTime).toISOString().split("T")[0];
                return d === todayStr && b.status === "active";
              });

              // Find the matching descriptor from `conferenceRooms` so
              // we can read scheduledDeactivationAt for the badge + pass
              // the full row to the cancel modal. roomsToRender may
              // include legacy synthetic rooms with no backing doc.
              const roomDescriptor = conferenceRooms.find(
                (cr) => cr._id === room.id,
              );
              const cancelsOn = roomDescriptor?.scheduledDeactivationAt
                ? new Date(roomDescriptor.scheduledDeactivationAt)
                : null;
              return (
                <div key={room.spaceId} className="relative group">
                  {/* Founder-only cancel button. Always visible (not
                      hover-gated) so it's discoverable on touch
                      devices too. Lowered opacity at rest, full on
                      hover/focus, and softly tinted red so it reads
                      as a destructive action without screaming. */}
                  {amIFounder && roomDescriptor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCancelTargetRoom(roomDescriptor);
                      }}
                      className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/70 backdrop-blur-sm border border-white/[0.1] text-[#9fa0b8] hover:text-red-400 hover:border-red-500/40 hover:bg-black/90 focus:opacity-100 focus:text-red-400 transition-all opacity-70 group-hover:opacity-100 flex items-center justify-center"
                      aria-label={`Cancel ${room.name}`}
                      title="Cancel room"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* "Cancels on X" badge for rooms scheduled to drop. */}
                  {cancelsOn && (
                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-medium text-amber-400 backdrop-blur-sm">
                      Cancels {cancelsOn.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                  {/* Open-in-new-tab + copy-share-link controls.
                      Standalone conference page lives at
                      /meet/conference/<orgId>/<roomId> (chrome-less,
                      shareable). Skipped for the legacy single-room
                      shape where room.id is null — that flow stays
                      inline-only until the org migrates to named
                      rooms. */}
                  {room.id && orgId && (
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/meet/conference/${orgId}/${room.id}`;
                          navigator.clipboard
                            .writeText(url)
                            .then(() => toast.success("Share link copied"))
                            .catch(() => toast.error("Couldn't copy link"));
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-sm text-white/80 hover:text-white transition"
                        title="Copy share link"
                        aria-label="Copy share link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={`/meet/conference/${orgId}/${room.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-sm text-white/80 hover:text-white transition"
                        title="Open in a new tab"
                        aria-label="Open in a new tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                  <HqMeetingRoomCard
                    name={room.name}
                    currentBooking={cardCurrentBooking}
                    upcomingBookings={cardUpcoming}
                    allDayBookings={todayBookings}
                    occupants={cardOccupants}
                    meId={me}
                    isJoining={joiningSpaceId === room.spaceId}
                    onJoin={() => handleJoinRoom(room.spaceId, room.id)}
                    onBookRoom={() => {
                      setBookingForRoomId(room.id);
                      setShowRoomBookingModal(true);
                    }}
                    onViewSchedule={() => {
                      setSelectedRoomForPanel(room.spaceId);
                      setShowRightPanel(true);
                    }}
                  />
                </div>
              );
            })}

            {/* Add Conference Room card (founder-only). 1 included free
                with every office; everything after is $5/mo per extra,
                billed on the rooms invoice (see services/conferenceRoom
                Billing.ts). No cap — founders can keep adding, the
                Create modal surfaces the billing notice when applicable. */}
            {amIFounder && (() => {
              const isFreeSlot = conferenceRooms.length < 1;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  className="border-2 border-dashed border-[#2a2a2e] rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[240px] cursor-pointer hover:border-brand/40 transition-colors group"
                  onClick={() => {
                    setCreateRoomName("");
                    setShowCreateRoomModal(true);
                  }}
                >
                  <div className="w-12 h-12 rounded-full border border-[#3a3a3e] group-hover:border-brand/60 flex items-center justify-center transition-colors">
                    <Plus className="w-6 h-6 text-white group-hover:text-brand transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-bold text-white">Add Conference Room</p>
                    {isFreeSlot ? (
                      <p className="text-[12px] text-emerald-400 mt-0.5">
                        Free • included with your office
                      </p>
                    ) : (
                      <p className="text-[12px] text-[#888] mt-0.5">
                        ${CONFERENCE_ROOM_PRICE_USD}/month per extra room
                      </p>
                    )}
                  </div>
                  <button
                    className="h-9 px-6 rounded-xl bg-brand hover:opacity-90 text-brand-foreground text-[13px] font-bold transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateRoomName("");
                      setShowCreateRoomModal(true);
                    }}
                  >
                    {isFreeSlot ? "Create Room" : "Add Room"}
                  </button>
                </motion.div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ─── Right panel: Daily Schedule (shown only after Check Availability is clicked) ── */}
      {showRightPanel && selectedRoomObj && (
        <div className="hidden lg:flex flex-col w-72 xl:w-80 border-l border-[#1e1e22] bg-[#0d0d0f] flex-shrink-0 overflow-hidden">
          {/* Panel header */}
          <div className="px-5 pt-5 pb-3 border-b border-[#1e1e22] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-[15px] font-bold text-white truncate">{panelTitle}</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {panelIsAvailable ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0d2117] border border-emerald-500/60 text-emerald-400 text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    AVAILABLE
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2a1a1a] border border-red-500/60 text-red-400 text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    IN USE
                  </span>
                )}
                {/* Close panel */}
                <button
                  onClick={() => setShowRightPanel(false)}
                  className="w-6 h-6 rounded-md hover:bg-white/5 flex items-center justify-center text-[#555] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Room tabs (if multiple rooms) */}
            {roomsToRender.length > 1 && (
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {roomsToRender.map((room) => (
                  <button
                    key={room.spaceId}
                    onClick={() => setSelectedRoomForPanel(room.spaceId)}
                    className={cn(
                      "flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                      (selectedRoomForPanel === room.spaceId ||
                        (!selectedRoomForPanel && roomsToRender[0]?.spaceId === room.spaceId))
                        ? "bg-brand text-brand-foreground"
                        : "bg-[#1a1a1e] text-[#888] hover:text-white"
                    )}
                  >
                    {room.name}
                  </button>
                ))}
              </div>
            )}

            {/* Date navigator */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const d = new Date(panelDate);
                  d.setDate(d.getDate() - 1);
                  setPanelDate(d);
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-[#666] hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[13px] font-semibold text-white">
                {formatPanelDate(panelDate)}
              </span>
              <button
                onClick={() => {
                  const d = new Date(panelDate);
                  d.setDate(d.getDate() + 1);
                  setPanelDate(d);
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-[#666] hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="relative">
              {/* Hour lines (background grid) */}
              {SCHEDULE_HOURS.map((hour) => (
                <div key={hour} className="flex items-start gap-3 h-[52px]">
                  <div className="w-16 flex-shrink-0 text-[11px] text-[#555] pt-1 text-right select-none font-medium">
                    {formatHour(hour)}
                  </div>
                  <div className="flex-1 border-t border-[#1e1e22] h-full" />
                </div>
              ))}

              {/* Bookings placed absolutely */}
              {panelRoomBookings.length === 0 && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
                  style={{ left: "76px", top: "40px" }}
                >
                  <p className="text-[12px] text-[#444] font-medium">No bookings</p>
                  <p className="text-[11px] text-[#333] mt-1">Room is free all day</p>
                </div>
              )}
              {panelRoomBookings.map((booking) => {
                const isMine = isMyBooking(booking);
                const style = getBookingStyle(booking);
                return (
                  <div
                    key={booking._id}
                    className={cn(
                      "absolute right-0 rounded-lg px-3 py-2 text-[12px] font-medium shadow-sm z-10 flex flex-col justify-center",
                      isMine
                        ? "bg-[#242015] border border-brand/80 text-brand"
                        : "bg-[#2a1a1a] border border-red-500/30 text-[#f87171]"
                    )}
                    style={{
                      top: style.top,
                      height: style.height,
                      left: "76px",
                    }}
                  >
                    <div className="truncate font-semibold text-[13px]">
                      {isMine
                        ? `Your booking · ${booking.title}`
                        : booking.title
                        ? `${booking.title} · ${booking.invitedUserIds.length} people`
                        : `Booked · Private`}
                    </div>
                    <div className="text-[11px] opacity-70 mt-0.5">
                      {formatBookingTime(booking.startTime)} – {formatBookingTime(booking.endTime)}
                    </div>
                  </div>
                );
              })}

              {/* Current time tracker line */}
              {currentTimeOffset !== null && (
                <div
                  className="absolute right-0 h-[2px] bg-brand z-20 pointer-events-none"
                  style={{ top: `${currentTimeOffset}px`, left: "76px" }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Room modal (founder-only) ───────────────────────── */}
      {showCreateRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111114] border border-[#2a2a2e] rounded-2xl p-5 sm:p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-bold text-white">Create Conference Room</h2>
              <button
                onClick={() => setShowCreateRoomModal(false)}
                className="text-[#666] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="text-[12px] text-[#888] font-medium">Room name</label>
              <input
                id="create-room-name"
                value={createRoomName}
                onChange={(e) => setCreateRoomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creatingRoom) createConferenceRoom();
                }}
                placeholder="e.g. Boardroom, Huddle Space, Pitch Room"
                maxLength={80}
                autoFocus
                className="w-full h-11 px-4 rounded-xl bg-[#1a1a1e] border border-[#2a2a2e] text-white text-[14px] placeholder-[#555] focus:outline-none focus:border-brand/60 transition-colors"
              />
              <p className="text-[11px] text-[#555]">Members will see this name on the conference room list.</p>

              {/* Billing notice — surfaces when adding this room will be
                  a paid extra (i.e. there's already at least one active
                  room). Founder sees the $5/mo cost AND the prorated
                  partial-cycle charge they'll be redirected to pay. */}
              {conferenceRooms.length >= 1 && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-[#c7c7da] leading-relaxed">
                    <div className="text-white font-medium mb-0.5">
                      This is a paid room.
                    </div>
                    Adds{" "}
                    <span className="text-white font-semibold">
                      ${CONFERENCE_ROOM_PRICE_USD}/month
                    </span>{" "}
                    to your office billing, starting next cycle. A prorated
                    charge for the rest of this month will be billed
                    immediately on a separate invoice — you'll be taken
                    to the payment page after creating.
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCreateRoomModal(false)}
                disabled={creatingRoom}
                className="h-9 px-5 rounded-xl border border-[#2a2a2e] text-[#888] hover:text-white text-[13px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={createConferenceRoom}
                disabled={creatingRoom || !createRoomName.trim()}
                className="h-9 px-5 rounded-xl bg-brand hover:opacity-90 text-brand-foreground text-[13px] font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {creatingRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Room"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Room confirmation modal (founder-only). The confirmation
          copy depends on whether the room is the free included one
          (immediate removal) or a paid extra (stays until cycle end,
          no refund). We compute the "is paid" guess on the client by
          checking if there's more than one active room — if there's
          only one, removing it can only mean cancelling the included
          slot. The BE response confirms which path actually ran. */}
      {cancelTargetRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Cancel "{cancelTargetRoom.name}"?
              </h2>
              <button
                onClick={() => setCancelTargetRoom(null)}
                className="text-[#6b6b7b] hover:text-white"
                aria-label="Close"
                disabled={cancellingRoom}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {conferenceRooms.length > 1 ? (
              // Paid-extra path. Founder already paid for the current
              // cycle; room stays usable until cycle end. No refund.
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[12px] text-[#c7c7da] leading-relaxed">
                    <div className="text-white font-medium mb-0.5">
                      You've already paid for this cycle.
                    </div>
                    The room will{" "}
                    <span className="text-white font-semibold">
                      stay usable until the end of the current billing cycle
                    </span>
                    , then automatically drop. No refund is issued. Your next
                    monthly bill will reflect one fewer room.
                  </div>
                </div>
                <p className="text-[11px] text-[#5a5a72]">
                  Existing bookings stay in the schedule until the room
                  deactivates — they just won't be joinable after that.
                </p>
              </div>
            ) : (
              // Free-included-room path. Removing the only room leaves
              // the org with no conference rooms (the legacy synthetic
              // fallback room will still render until they add one back).
              <div className="rounded-lg border border-red-500/30 bg-red-500/[0.05] p-3 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-[12px] text-[#c7c7da] leading-relaxed">
                  <div className="text-white font-medium mb-0.5">
                    This is your only conference room.
                  </div>
                  Removing it leaves you with zero rooms. You can add a new
                  one anytime (the first room is always free).
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <Button
                variant="ghost"
                onClick={() => setCancelTargetRoom(null)}
                disabled={cancellingRoom}
              >
                Keep room
              </Button>
              <Button
                onClick={cancelConferenceRoom}
                disabled={cancellingRoom}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {cancellingRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  "Cancel room"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Schedule Modal (legacy) ─────────────────────────────────── */}
      <HqRoomSchedule
        open={showRoomSchedule}
        onClose={() => setShowRoomSchedule(false)}
        bookings={roomBookings}
        onBookRoom={() => {
          setBookingForRoomId(null);
          setShowRoomSchedule(false);
          setShowRoomBookingModal(true);
        }}
        onRefresh={fetchRoomBookings}
      />

      {/* ─── Upgrade Modal (3rd+ room is paid) ──────────────────────── */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-sm bg-[#111114] border border-[#2a2a2e] rounded-2xl p-6 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-7 h-7 text-brand" />
            </div>
            <h2 className="text-[18px] font-bold text-white mb-2">Add More Rooms</h2>
            <p className="text-[13px] text-[#888] mb-1">
              You&apos;ve used your 2 free conference rooms.
            </p>
            <p className="text-[13px] text-[#888] mb-5">
              Upgrade to add unlimited conference rooms for your workspace.
            </p>
            <div className="bg-[#1a1a1e] rounded-xl p-4 mb-5 text-left">
              <p className="text-[12px] text-[#666] mb-1">Additional room</p>
              <p className="text-[22px] font-bold text-white">$29<span className="text-[14px] text-[#666] font-normal">/month</span></p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 h-10 rounded-xl border border-[#2a2a2e] text-[#888] hover:text-white text-[13px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.info("Payment coming soon!");
                  setShowUpgradeModal(false);
                }}
                className="flex-1 h-10 rounded-xl bg-brand hover:opacity-90 text-brand-foreground text-[13px] font-bold transition-colors cursor-pointer"
              >
                Upgrade Plan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
