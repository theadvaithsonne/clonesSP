"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Bell, Users, CheckSquare, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { connectSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import NotificationsHub from "@/components/dashboard/NotificationsHub";
import { TodoMenu } from "@/components/dashboard/TodoMenu";

interface TeamMember {
  role: string;
  name: string;
  email: string;
  profilePicture?: string;
  guest?: boolean;
}

interface PeerState {
  id: string;
  email: string;
  name: string;
  spaceId: string;
  status: "available" | "busy" | "afk";
  isScreenSharing?: boolean;
  profilePicture?: string;
}

interface WorkspaceToolbarProps {
  className?: string;
}

export function WorkspaceToolbar({ className }: WorkspaceToolbarProps) {
  // Popover states
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showReminders, setShowReminders] = useState(false);

  // Members data (fetched independently)
  const [teamMembers, setTeamMembers] = useState<Map<string, TeamMember>>(
    new Map()
  );
  const [onlinePeers, setOnlinePeers] = useState<Map<string, PeerState>>(
    new Map()
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<"available" | "busy" | "afk">(
    "available"
  );

  // Refs for Members button + portal positioning
  const membersButtonRef = useRef<HTMLDivElement>(null);
  const membersDropdownRef = useRef<HTMLDivElement>(null);
  const [membersRect, setMembersRect] = useState<DOMRect | null>(null);
  // Refs for Notifications button + portal positioning
  const notificationsButtonRef = useRef<HTMLDivElement>(null);
  const [notificationsRect, setNotificationsRect] = useState<DOMRect | null>(null);

  // Notification unread count (rendered on the bell button, not inside the portaled hub)
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        const url = orgId
          ? `/user-notifications/unread-count?orgId=${orgId}`
          : "/user-notifications/unread-count";
        const res = await api<{ count: number }>(url, {}, getToken()!);
        setUnreadCount(res.count || 0);
      } catch {}
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);

    const handleRefresh = () => fetchUnreadCount();
    window.addEventListener("notifications:refresh", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications:refresh", handleRefresh);
    };
  }, []);

  // Fetch team members on mount
  const fetchTeamMembers = useCallback(async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    try {
      const response = await api<{ members: any[] }>(
        `/team/list?orgId=${orgId}`,
        {},
        getToken()!
      );

      const membersMap = new Map<string, TeamMember>();
      response.members.forEach((member) => {
        const id = member._id ?? member.id;
        membersMap.set(id, {
          role: member.role || "user",
          name: member.name || "",
          email: member.email || "",
          profilePicture: member.profilePicture || "",
          guest: member.guest || false,
        });
      });
      setTeamMembers(membersMap);
    } catch (error) {
      console.error("[WorkspaceToolbar] Failed to fetch team members:", error);
    }
  }, []);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  // Subscribe to socket for online status
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    // Get current user ID from socket
    const userId = (socket as any).userId;
    if (userId) {
      setCurrentUserId(userId);
    }

    // Handle initial users list
    const handleUsers = (users: PeerState[]) => {
      const peersMap = new Map<string, PeerState>();
      users.forEach((user) => {
        peersMap.set(user.id, user);
      });
      setOnlinePeers(peersMap);
    };

    // Handle full sync response (from workspace:request-sync)
    const handleFullSync = (data: { users: PeerState[] }) => {
      const peersMap = new Map<string, PeerState>();
      data.users.forEach((user) => {
        peersMap.set(user.id, user);
      });
      setOnlinePeers(peersMap);
    };

    // Handle user joined
    const handleUserJoined = (user: PeerState) => {
      setOnlinePeers((prev) => {
        const newMap = new Map(prev);
        newMap.set(user.id, user);
        return newMap;
      });
    };

    // Handle user left
    const handleUserLeft = ({ id }: { id: string }) => {
      setOnlinePeers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    };

    // Handle status change
    const handleStatusChange = ({
      userId,
      status,
    }: {
      userId: string;
      status: "available" | "busy" | "afk";
    }) => {
      if (userId === currentUserId) {
        setMyStatus(status);
      }
      setOnlinePeers((prev) => {
        const newMap = new Map(prev);
        const peer = newMap.get(userId);
        if (peer) {
          newMap.set(userId, { ...peer, status });
        }
        return newMap;
      });
    };

    socket.on("workspace:users", handleUsers);
    socket.on("workspace:full-sync", handleFullSync);
    socket.on("workspace:user-joined", handleUserJoined);
    socket.on("workspace:user-left", handleUserLeft);
    socket.on("workspace:user-status-changed", handleStatusChange);

    // Request current online users (this doesn't join the workspace, just gets the list)
    socket.emit("workspace:request-sync");

    return () => {
      socket.off("workspace:users", handleUsers);
      socket.off("workspace:full-sync", handleFullSync);
      socket.off("workspace:user-joined", handleUserJoined);
      socket.off("workspace:user-left", handleUserLeft);
      socket.off("workspace:user-status-changed", handleStatusChange);
    };
  }, [currentUserId]);

  // Recompute position whenever showMembers opens
  useLayoutEffect(() => {
    if (showMembers && membersButtonRef.current) {
      setMembersRect(membersButtonRef.current.getBoundingClientRect());
    }
  }, [showMembers]);

  // Recompute position whenever showNotifications opens
  useLayoutEffect(() => {
    if (showNotifications && notificationsButtonRef.current) {
      setNotificationsRect(notificationsButtonRef.current.getBoundingClientRect());
    }
  }, [showNotifications]);

  // Click outside handler for portalled Members dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        membersButtonRef.current &&
        !membersButtonRef.current.contains(target) &&
        membersDropdownRef.current &&
        !membersDropdownRef.current.contains(target)
      ) {
        setShowMembers(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate online members count
  const onlineCount = Array.from(teamMembers.entries()).filter(
    ([userId]) => onlinePeers.has(userId) || userId === currentUserId
  ).length;

  return (
    <div
      className={cn(
        "hidden md:flex items-center gap-2 pointer-events-auto px-4 py-2 flex-shrink-0",
        className
      )}
    >
      {/* Reminders Button - COMMENTED OUT
      <div className="relative">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setShowReminders(!showReminders);
          }}
          variant="ghost"
          className="h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border border-[#2a2a35] hover:bg-[#1a1a20] rounded-full"
        >
          <div className="flex items-center gap-2">
            <CheckSquare className="h-3 w-3 text-purple-400" />
            <span className="text-white">Reminders</span>
          </div>
        </Button>

        {typeof document !== "undefined" &&
          createPortal(
            <TodoMenu
              isOpen={showReminders}
              onClose={() => setShowReminders(false)}
            />,
            document.body
          )}
      </div>
      */}



      {/* Members header pill (button + popover) — hidden at user request.
          Wrapped in `{false && (...)}` instead of removed so the underlying
          state, fetchTeamMembers effect, and portal markup stay in source
          for an easy revert. */}
      {false && (
      <div className="relative" ref={membersButtonRef}>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setShowMembers(!showMembers);
          }}
          variant="ghost"
          className={cn(
            "h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border rounded-full transition-all duration-300",
            showMembers
              ? "border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "border-[#2a2a35] hover:bg-[#1a1a20]"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3 text-emerald-400" />
            <span className="text-white">
              Members
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                {onlineCount}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-gray-400 transition-transform duration-200",
                showMembers && "rotate-180"
              )}
            />
          </div>
        </Button>

        {/* Render Members dropdown via portal to escape ANY parent stacking context
            (backdrop-blur / transform / opacity / will-change on ancestors all
            trap z-index — createPortal on document.body bypasses them entirely) */}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {showMembers && membersRect && (
                <motion.div
                  ref={membersDropdownRef}
                  style={{
                    position: "fixed",
                    top: membersRect.bottom + 8,
                    right: window.innerWidth - membersRect.right,
                    zIndex: 99999,
                  }}
                  className="bg-[#0e0e12]/95 backdrop-blur-xl border border-[#2a2a35] rounded-xl shadow-2xl p-2 min-w-[200px] max-w-[240px] max-h-[400px] overflow-y-auto"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-xs font-medium text-gray-400">Members</h3>
                    <Button
                      onClick={() => setShowMembers(false)}
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
                          ([userId]) =>
                            onlinePeers.has(userId) || userId === currentUserId
                        )
                        .map(([userId, member]) => {
                          const peer = onlinePeers.get(userId);
                          const isMe = userId === currentUserId;
                          const status = isMe
                            ? myStatus
                            : peer?.status || "available";

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
                          ([userId]) =>
                            !onlinePeers.has(userId) && userId !== currentUserId
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
            </AnimatePresence>,
            document.body
          )}
      </div>
      )}
    </div>
  );
}
