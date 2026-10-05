"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Building2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Play,
  Power,
  PowerOff,
  Square,
  Users,
  X,
  MessageSquare,
  UserPlus,
  Trash2,
  Check,
  Globe,
  AtSign,
  MessageCircle,
  User,
  Share,
  LogOut,
  Settings,
  Rocket,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMobileSidebar } from "@/lib/mobile-sidebar-context";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { clearRevenueNetworkCache } from "@/lib/revenue-network-cache";
import { useRouter } from "next/navigation";

// Simple time ago formatter
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return "long ago";
}

type UserNotification = {
  _id: string;
  userId: string;
  orgId?: string;
  type:
    | "dm"
    | "group_message"
    | "knock"
    | "global_dm"
    | "post_mention"
    | "comment_mention";
  dmFrom?: string;
  dmFromName?: string;
  dmFromEmail?: string;
  dmFromPicture?: string;
  dmText?: string;
  dmConvId?: string;
  dmMessageId?: string;
  groupId?: string;
  groupName?: string;
  groupFrom?: string;
  groupFromName?: string;
  groupFromEmail?: string;
  groupFromPicture?: string;
  groupText?: string;
  groupMessageId?: string;
  knockFrom?: string;
  knockFromName?: string;
  knockFromEmail?: string;
  knockFromPicture?: string;
  knockSpaceId?: string;
  globalDmFrom?: string;
  globalDmFromName?: string;
  globalDmFromEmail?: string;
  globalDmFromPicture?: string;
  globalDmText?: string;
  globalDmConvId?: string;
  globalDmMessageId?: string;
  postId?: string;
  postAuthorId?: string;
  postAuthorName?: string;
  postAuthorEmail?: string;
  postAuthorPicture?: string;
  postContent?: string;
  channelId?: string;
  channelName?: string;
  commentId?: string;
  commentAuthorId?: string;
  commentAuthorName?: string;
  commentAuthorEmail?: string;
  commentAuthorPicture?: string;
  commentContent?: string;
  read: boolean;
  cleared: boolean;
  createdAt: string;
  updatedAt: string;
};

type TabType = "knocks" | "dms" | "groups" | "global" | "mentions";
type ViewType = "main" | "notifications" | "members";
type ActionTab = "global" | "office";

interface MobileActionSidebarProps {
  // Org Cabinet
  onOpenOrgCabinet?: () => void;
  // Clock in/out
  isClockedIn?: boolean | null;
  clockActionLoading?: boolean;
  onClockToggle?: () => void;
  // Recording
  isRecording?: boolean;
  shouldForceRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  // Status
  myStatus?: "available" | "busy" | "afk" | "offline";
  mySpaceId?: string;
  onStatusChange?: (status: "available" | "busy" | "afk") => void;
  // Todo
  onOpenTodo?: () => void;
  // Notifications
  onOpenNotifications?: () => void;
  // Members
  onOpenMembers?: () => void;
  membersCount?: number;
  // Floors
  onOpenFloors?: () => void;
  currentFloorName?: string;
  className?: string;
  // Whether user is founder (for showing certain menu options)
  amIFounder?: boolean;
}

export default function MobileActionSidebar({
  onOpenOrgCabinet,
  isClockedIn,
  clockActionLoading,
  onClockToggle,
  isRecording,
  shouldForceRecording,
  onStartRecording,
  onStopRecording,
  myStatus = "available",
  mySpaceId = "lobby",
  onStatusChange,
  onOpenTodo,
  onOpenNotifications,
  onOpenMembers,
  membersCount = 0,
  onOpenFloors,
  currentFloorName = "Show All",
  className,
  amIFounder = false,
}: MobileActionSidebarProps) {
  const { isMobileActionSidebarOpen, closeMobileActionSidebar } =
    useMobileSidebar();
  const router = useRouter();

  const [activeView, setActiveView] = useState<ViewType>("main");
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("knocks");
  const [actionTab, setActionTab] = useState<ActionTab>("global");

  // Reset view when sidebar closes
  useEffect(() => {
    if (!isMobileActionSidebarOpen) {
      setActiveView("main");
    }
  }, [isMobileActionSidebarOpen]);

  // Fetch notifications when notifications view is opened
  useEffect(() => {
    if (activeView === "notifications") {
      fetchNotifications();
    }
  }, [activeView]);

  // Fetch unread count on mount
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const url = orgId
        ? `/user-notifications?orgId=${orgId}`
        : "/user-notifications";
      const res = await api<{ notifications: UserNotification[] }>(
        url,
        {},
        getToken()!
      );
      setNotifications(res.notifications || []);

      // Auto-select tab with notifications
      const hasMentions = (res.notifications || []).some(
        (n) => n.type === "post_mention" || n.type === "comment_mention"
      );
      const hasKnocks = (res.notifications || []).some((n) => n.type === "knock");
      const hasDms = (res.notifications || []).some((n) => n.type === "dm");
      const hasGroups = (res.notifications || []).some((n) => n.type === "group_message");
      const hasGlobalDms = (res.notifications || []).some((n) => n.type === "global_dm");

      if (hasMentions) setActiveTab("mentions");
      else if (hasKnocks) setActiveTab("knocks");
      else if (hasDms) setActiveTab("dms");
      else if (hasGroups) setActiveTab("groups");
      else if (hasGlobalDms) setActiveTab("global");
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const url = orgId
        ? `/user-notifications/unread-count?orgId=${orgId}`
        : "/user-notifications/unread-count";
      const res = await api<{ count: number }>(url, {}, getToken()!);
      setUnreadCount(res.count || 0);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const handleClearNotification = async (notificationId: string) => {
    try {
      await api(
        `/user-notifications/${notificationId}`,
        { method: "DELETE" },
        getToken()!
      );
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
      fetchUnreadCount();
    } catch (error) {
      console.error("Failed to clear notification:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const url = orgId
        ? `/user-notifications?orgId=${orgId}`
        : "/user-notifications";
      await api(url, { method: "DELETE" }, getToken()!);
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to clear all notifications:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const url = orgId
        ? `/user-notifications/read-all?orgId=${orgId}`
        : "/user-notifications/read-all";
      await api(url, { method: "POST" }, getToken()!);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleAction = (action?: () => void) => {
    if (action) {
      action();
    }
    closeMobileActionSidebar();
  };

  // Profile handler - dispatches event to open profile modal
  const handleOpenProfile = () => {
    closeMobileActionSidebar();
    window.dispatchEvent(new CustomEvent("profile:open"));
  };

  // Invite handler - dispatches event to open invite modal (Invite Friend to Launch Office)
  const handleOpenInvite = () => {
    closeMobileActionSidebar();
    window.dispatchEvent(new CustomEvent("invite:open"));
  };

  // Manage Org handler - dispatches event to open manage org modal
  const handleOpenManageOrg = () => {
    closeMobileActionSidebar();
    window.dispatchEvent(new CustomEvent("manage-org:open"));
  };

  // Guest Funnel handler - dispatches event to open guest funnel modal
  const handleOpenGuestFunnel = () => {
    closeMobileActionSidebar();
    window.dispatchEvent(new CustomEvent("open:guest-funnel"));
  };

  // Invite Employees handler - dispatches event to open invite employees modal
  const handleOpenInviteEmployees = () => {
    closeMobileActionSidebar();
    window.dispatchEvent(new CustomEvent("invite-employees:open"));
  };

  // Logout handler
  const handleLogout = async () => {
    closeMobileActionSidebar();
    try {
      // Call logout API to instantly remove workspace presence
      await api("/auth/logout", {
        method: "POST",
      });
      console.log("[AUTH] Logout API called successfully");
    } catch (error) {
      console.error("[AUTH] Logout API error:", error);
      // Continue with logout even if API fails
    }

    // Clear token and caches, then redirect
    clearToken();
    clearRevenueNetworkCache();
    window.dispatchEvent(new CustomEvent("auth:logout"));
    router.replace("/login");
  };

  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter((notification) => {
    switch (activeTab) {
      case "mentions":
        return (
          notification.type === "post_mention" ||
          notification.type === "comment_mention"
        );
      case "knocks":
        return notification.type === "knock";
      case "dms":
        return notification.type === "dm";
      case "groups":
        return notification.type === "group_message";
      case "global":
        return notification.type === "global_dm";
      default:
        return true;
    }
  });

  // Get count per tab
  const knockCount = notifications.filter((n) => n.type === "knock").length;
  const dmCount = notifications.filter((n) => n.type === "dm").length;
  const groupCount = notifications.filter((n) => n.type === "group_message").length;
  const globalDmCount = notifications.filter((n) => n.type === "global_dm").length;
  const mentionCount = notifications.filter(
    (n) => n.type === "post_mention" || n.type === "comment_mention"
  ).length;

  const handleNotificationClick = (notification: UserNotification) => {
    handleClearNotification(notification._id);
    closeMobileActionSidebar();

    if (notification.type === "dm" && notification.dmFrom) {
      window.dispatchEvent(
        new CustomEvent("notification:open-dm", {
          detail: { userId: notification.dmFrom },
        })
      );
    } else if (notification.type === "group_message" && notification.groupId) {
      window.dispatchEvent(
        new CustomEvent("notification:open-group", {
          detail: { groupId: notification.groupId },
        })
      );
    } else if (notification.type === "global_dm" && notification.globalDmFrom) {
      window.dispatchEvent(
        new CustomEvent("notification:open-global-dm", {
          detail: { userId: notification.globalDmFrom },
        })
      );
    } else if (notification.type === "post_mention" && notification.postId) {
      window.dispatchEvent(
        new CustomEvent("notification:open-post", {
          detail: {
            postId: notification.postId,
            channelId: notification.channelId,
          },
        })
      );
    } else if (notification.type === "comment_mention" && notification.postId) {
      window.dispatchEvent(
        new CustomEvent("notification:open-post", {
          detail: {
            postId: notification.postId,
            channelId: notification.channelId,
            commentId: notification.commentId,
          },
        })
      );
    }
  };

  const renderNotification = (notification: UserNotification) => {
    const timeDisplay = timeAgo(new Date(notification.createdAt));

    if (notification.type === "dm") {
      return (
        <motion.div
          key={notification._id}
          className={cn(
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors cursor-pointer",
            !notification.read && "bg-blue-500/5"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-[#2f2f3b] flex-shrink-0">
              <AvatarImage src={notification.dmFromPicture} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                {notification.dmFromName?.charAt(0) ||
                  notification.dmFromEmail?.charAt(0) ||
                  "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-3 w-3 text-blue-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {notification.dmFromName || notification.dmFromEmail}
                </span>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-2">
                {notification.dmText}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">{timeDisplay}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClearNotification(notification._id);
              }}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      );
    }

    if (notification.type === "group_message") {
      return (
        <motion.div
          key={notification._id}
          className={cn(
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors cursor-pointer",
            !notification.read && "bg-purple-500/5"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-[#2f2f3b] flex-shrink-0">
              <AvatarImage src={notification.groupFromPicture} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                {notification.groupFromName?.charAt(0) ||
                  notification.groupFromEmail?.charAt(0) ||
                  "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-3 w-3 text-purple-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {notification.groupFromName || notification.groupFromEmail}
                </span>
                <span className="text-xs text-gray-500">in</span>
                <span className="text-xs text-purple-400 truncate">
                  {notification.groupName}
                </span>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-2">
                {notification.groupText}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">{timeDisplay}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClearNotification(notification._id);
              }}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      );
    }

    if (notification.type === "knock") {
      return (
        <motion.div
          key={notification._id}
          className={cn(
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors",
            !notification.read && "bg-yellow-500/5"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-[#2f2f3b] flex-shrink-0">
              <AvatarImage src={notification.knockFromPicture} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
                {notification.knockFromName?.charAt(0) ||
                  notification.knockFromEmail?.charAt(0) ||
                  "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {notification.knockFromName || notification.knockFromEmail}
                </span>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400">
                Knocked on your space{" "}
                {notification.knockSpaceId && (
                  <span className="text-yellow-400">
                    ({notification.knockSpaceId})
                  </span>
                )}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">{timeDisplay}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClearNotification(notification._id);
              }}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      );
    }

    if (notification.type === "global_dm") {
      return (
        <motion.div
          key={notification._id}
          className={cn(
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors cursor-pointer",
            !notification.read && "bg-emerald-500/5"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-emerald-500/30 flex-shrink-0">
              <AvatarImage src={notification.globalDmFromPicture} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                {notification.globalDmFromName?.charAt(0) ||
                  notification.globalDmFromEmail?.charAt(0) ||
                  "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {notification.globalDmFromName || notification.globalDmFromEmail}
                </span>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-2">
                {notification.globalDmText}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">{timeDisplay}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClearNotification(notification._id);
              }}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      );
    }

    if (notification.type === "post_mention") {
      return (
        <motion.div
          key={notification._id}
          className={cn(
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors cursor-pointer",
            !notification.read && "bg-orange-500/5"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-orange-500/30 flex-shrink-0">
              <AvatarImage src={notification.postAuthorPicture} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-amber-500 text-white">
                {notification.postAuthorName?.charAt(0) ||
                  notification.postAuthorEmail?.charAt(0) ||
                  "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <AtSign className="h-3 w-3 text-orange-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {notification.postAuthorName || notification.postAuthorEmail}
                </span>
                <span className="text-xs text-gray-500">mentioned you</span>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-2">
                {notification.postContent}
              </p>
              {notification.channelName && (
                <p className="text-[10px] text-orange-400/70 mt-0.5">
                  in {notification.channelName}
                </p>
              )}
              <p className="text-[10px] text-gray-600 mt-1">{timeDisplay}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClearNotification(notification._id);
              }}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      );
    }

    if (notification.type === "comment_mention") {
      return (
        <motion.div
          key={notification._id}
          className={cn(
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors cursor-pointer",
            !notification.read && "bg-pink-500/5"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-pink-500/30 flex-shrink-0">
              <AvatarImage src={notification.commentAuthorPicture} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                {notification.commentAuthorName?.charAt(0) ||
                  notification.commentAuthorEmail?.charAt(0) ||
                  "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="h-3 w-3 text-pink-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {notification.commentAuthorName || notification.commentAuthorEmail}
                </span>
                <span className="text-xs text-gray-500">mentioned you</span>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-pink-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-2">
                {notification.commentContent}
              </p>
              {notification.channelName && (
                <p className="text-[10px] text-pink-400/70 mt-0.5">
                  in {notification.channelName}
                </p>
              )}
              <p className="text-[10px] text-gray-600 mt-1">{timeDisplay}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClearNotification(notification._id);
              }}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <AnimatePresence mode="wait">
      {isMobileActionSidebarOpen && (
        <motion.div
          className={`fixed inset-0 z-[1000] ${className || ""}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            onClick={closeMobileActionSidebar}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />

          {/* Sidebar content - slides from right, 75% width */}
          <motion.div
            className="absolute right-0 top-0 h-full w-3/4 max-w-[320px] bg-[#0e0e12] border-l border-[#2a2a35] overflow-hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 350,
              mass: 0.8
            }}
          >
            {/* Sliding views container */}
            <div className="relative h-full w-full overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                {activeView === "main" && (
                  <motion.div
                    key="main"
                    className="absolute inset-0 flex flex-col"
                    initial={{ x: "-100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "-100%", opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  >
                    {/* Header */}
                    <div className="sticky top-0 z-10 px-4 py-4 border-b border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur flex items-center gap-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={closeMobileActionSidebar}
                        className="h-8 w-8 text-[#c7c7da] hover:text-white hover:bg-[#15151b]"
                        aria-label="Close actions"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <span className="text-white font-medium">Quick Actions</span>
                    </div>

                    {/* Action Tab Switcher */}
                    <div className="px-4 pt-3 pb-1">
                      <div className="flex bg-[#1a1a22] rounded-lg p-1 border border-[#2a2a35]">
                        <button
                          onClick={() => setActionTab("global")}
                          className={cn(
                            "flex-1 py-2 text-xs font-medium rounded-md transition-all",
                            actionTab === "global"
                              ? "bg-[#252530] text-white shadow-sm"
                              : "text-gray-400 hover:text-white"
                          )}
                        >
                          Global Actions
                        </button>
                        <button
                          onClick={() => setActionTab("office")}
                          className={cn(
                            "flex-1 py-2 text-xs font-medium rounded-md transition-all",
                            actionTab === "office"
                              ? "bg-[#252530] text-white shadow-sm"
                              : "text-gray-400 hover:text-white"
                          )}
                        >
                          Office Actions
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {actionTab === "global" ? (
                        <>
                          {/* Profile */}
                          <ActionButton
                            icon={<User className="h-5 w-5 text-cyan-400" />}
                            label="Profile"
                            description="View and edit your profile"
                            onClick={handleOpenProfile}
                          />

                          {/* Manage Org - Founders only */}
                          {amIFounder && (
                            <ActionButton
                              icon={<Settings className="h-5 w-5 text-gray-400" />}
                              label="Manage Org"
                              description="Organization settings"
                              onClick={handleOpenManageOrg}
                            />
                          )}

                          {/* Invite Friend to Launch Office */}
                          {/* <ActionButton
                            icon={<Rocket className="h-5 w-5 text-purple-400" />}
                            label="Invite Friend to Launch Office"
                            description="Refer a friend to start their office"
                            onClick={handleOpenInvite}
                          /> */}

                          {/* Get Your HQ Funnel Link */}
                          <ActionButton
                            icon={<Link2 className="h-5 w-5 text-yellow-400" />}
                            label="Get Your HQ Funnel Link"
                            description="Share your guest page link"
                            onClick={handleOpenGuestFunnel}
                          />

                          {/* Invite Employees - Founders only */}
                          {amIFounder && (
                            <ActionButton
                              icon={<Users className="h-5 w-5 text-blue-400" />}
                              label="Invite Employees"
                              description="Invite team members to join"
                              onClick={handleOpenInviteEmployees}
                            />
                          )}

                          {/* Logout */}
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border transition-all bg-[#1a1a22] border-[#2a2a35] hover:bg-red-500/10 hover:border-red-500/30 active:scale-[0.98]"
                          >
                            <div className="flex-shrink-0">
                              <LogOut className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="flex-1 text-left">
                              <span className="text-red-400 font-medium">Logout</span>
                              <p className="text-xs text-gray-400">Sign out of your account</p>
                            </div>
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Org Cabinet */}
                          {onOpenOrgCabinet && (
                            <ActionButton
                              icon={<Building2 className="h-5 w-5 text-orange-400" />}
                              label="Organization Cabinet"
                              description="Access shared files"
                              onClick={() => handleAction(onOpenOrgCabinet)}
                            />
                          )}

                          {/* Clock In/Out */}
                          {onClockToggle && (
                            <ActionButton
                              icon={
                                isClockedIn ? (
                                  <PowerOff className="h-5 w-5 text-green-400" />
                                ) : (
                                  <Power className="h-5 w-5 text-gray-400" />
                                )
                              }
                              label={isClockedIn ? "Clock Out" : "Clock In"}
                              description={isClockedIn ? "End your work session" : "Start your work session"}
                              onClick={() => handleAction(onClockToggle)}
                              disabled={isClockedIn === null || clockActionLoading}
                              active={!!isClockedIn}
                              activeColor="green"
                            />
                          )}

                          {/* Recording */}
                          <div className="space-y-2">
                            {shouldForceRecording && (
                              <Badge
                                variant="outline"
                                className="uppercase text-[10px] tracking-wide border-red-500/50 text-red-400 bg-red-500/10 px-2 py-0.5"
                              >
                                Recording always on
                              </Badge>
                            )}
                            {!isRecording ? (
                              <ActionButton
                                icon={<Play className="h-5 w-5 text-gray-400" />}
                                label="Start Recording"
                                description="Record your screen and audio"
                                onClick={() => handleAction(onStartRecording)}
                              />
                            ) : (
                              <ActionButton
                                icon={
                                  <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                  >
                                    <Square className="h-5 w-5 text-red-400" />
                                  </motion.div>
                                }
                                label="Stop Recording"
                                description="End the current recording"
                                onClick={() => handleAction(onStopRecording)}
                                active
                                activeColor="red"
                              />
                            )}
                          </div>

                          {/* Status Selector */}
                          <div className="bg-[#1a1a22] rounded-xl p-4 border border-[#2a2a35]">
                            <div className="flex items-center gap-2 mb-3">
                              <div
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  myStatus === "available"
                                    ? "bg-green-400"
                                    : myStatus === "busy"
                                    ? "bg-red-400"
                                    : myStatus === "afk"
                                    ? "bg-yellow-400"
                                    : "bg-gray-400"
                                )}
                              />
                              <span className="text-sm text-white font-medium">Status</span>
                              {mySpaceId !== "lobby" && (
                                <span className="text-xs text-gray-500 ml-auto">
                                  (In call)
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {(["available", "busy", "afk"] as const).map((status) => (
                                <Button
                                  key={status}
                                  onClick={() => {
                                    if (mySpaceId === "lobby" && onStatusChange) {
                                      onStatusChange(status);
                                    }
                                  }}
                                  variant="ghost"
                                  disabled={mySpaceId !== "lobby"}
                                  className={cn(
                                    "flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#252530]",
                                    status === myStatus && "bg-[#252530] ring-1 ring-white/20"
                                  )}
                                >
                                  {status === "available" ? (
                                    <Users className="h-4 w-4 text-green-400" />
                                  ) : status === "busy" ? (
                                    <Clock className="h-4 w-4 text-red-400" />
                                  ) : (
                                    <Coffee className="h-4 w-4 text-yellow-400" />
                                  )}
                                  <span className="text-xs text-white capitalize">
                                    {status}
                                  </span>
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Todo / Reminders - COMMENTED OUT
                          {onOpenTodo && (
                            <ActionButton
                              icon={<CheckSquare className="h-5 w-5 text-purple-400" />}
                              label="Reminders"
                              description="View your tasks and reminders"
                              onClick={() => handleAction(onOpenTodo)}
                            />
                          )}
                          */}

                          {/* Notifications - opens inline view */}
                          <ActionButton
                            icon={<Bell className="h-5 w-5 text-blue-400" />}
                            label="Notifications"
                            description="View your notifications"
                            onClick={() => setActiveView("notifications")}
                            badge={unreadCount > 0 ? String(unreadCount) : undefined}
                            badgeColor="blue"
                            showArrow
                          />

                          {/* Members */}
                          {onOpenMembers && (
                            <ActionButton
                              icon={<Users className="h-5 w-5 text-emerald-400" />}
                              label="Members"
                              description={`${membersCount} members online`}
                              onClick={() => handleAction(onOpenMembers)}
                              badge={membersCount > 0 ? String(membersCount) : undefined}
                              badgeColor="emerald"
                            />
                          )}

                          {/* Floors */}
                          {onOpenFloors && (
                            <ActionButton
                              icon={<Building2 className="h-5 w-5 text-blue-400" />}
                              label="Office Floors"
                              description={`Current: ${currentFloorName}`}
                              onClick={() => handleAction(onOpenFloors)}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeView === "notifications" && (
                  <motion.div
                    key="notifications"
                    className="absolute inset-0 flex flex-col"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  >
                    {/* Notifications Header */}
                    <div className="sticky top-0 z-10 border-b border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setActiveView("main")}
                            className="h-8 w-8 text-[#c7c7da] hover:text-white hover:bg-[#15151b]"
                            aria-label="Go back"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-blue-400" />
                            <span className="text-white font-medium">Notifications</span>
                            {unreadCount > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                                {unreadCount} new
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {notifications.length > 0 && (
                            <>
                              {unreadCount > 0 && (
                                <Button
                                  onClick={handleMarkAllRead}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[10px] hover:bg-blue-500/20 text-blue-400"
                                  title="Mark all as read"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                onClick={handleClearAll}
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[10px] hover:bg-red-500/20 text-red-400"
                                title="Clear all"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tabs */}
                      <div className="flex items-center gap-1 px-4 pb-3 overflow-x-auto">
                        <button
                          onClick={() => setActiveTab("knocks")}
                          className={cn(
                            "flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === "knocks"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          Knocks {knockCount > 0 && `(${knockCount})`}
                        </button>
                        <button
                          onClick={() => setActiveTab("dms")}
                          className={cn(
                            "flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === "dms"
                              ? "bg-blue-500/10 text-blue-400"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          DMs {dmCount > 0 && `(${dmCount})`}
                        </button>
                        <button
                          onClick={() => setActiveTab("groups")}
                          className={cn(
                            "flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === "groups"
                              ? "bg-purple-500/10 text-purple-400"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          Groups {groupCount > 0 && `(${groupCount})`}
                        </button>
                        <button
                          onClick={() => setActiveTab("global")}
                          className={cn(
                            "flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === "global"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          Global {globalDmCount > 0 && `(${globalDmCount})`}
                        </button>
                        <button
                          onClick={() => setActiveTab("mentions")}
                          className={cn(
                            "flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === "mentions"
                              ? "bg-orange-500/10 text-orange-400"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          Feed {mentionCount > 0 && `(${mentionCount})`}
                        </button>
                      </div>
                    </div>

                    {/* Notifications Content */}
                    <div className="flex-1 overflow-y-auto">
                      {notificationsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : filteredNotifications.length === 0 ? (
                        <div className="text-center py-12">
                          <Bell className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-sm text-gray-400">No notifications</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {notifications.length === 0
                              ? "You're all caught up!"
                              : `No ${
                                  activeTab === "mentions"
                                    ? "mention"
                                    : activeTab === "knocks"
                                    ? "knock"
                                    : activeTab === "dms"
                                    ? "DM"
                                    : activeTab === "groups"
                                    ? "group"
                                    : "global"
                                } notifications`}
                          </p>
                        </div>
                      ) : (
                        <div>
                          {filteredNotifications.map((notification) =>
                            renderNotification(notification)
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  activeColor?: "green" | "red" | "blue" | "emerald";
  badge?: string;
  badgeColor?: "green" | "red" | "blue" | "emerald";
  showArrow?: boolean;
}

function ActionButton({
  icon,
  label,
  description,
  onClick,
  disabled,
  active,
  activeColor = "blue",
  badge,
  badgeColor = "blue",
  showArrow,
}: ActionButtonProps) {
  const colorClasses = {
    green: "border-green-500/40 bg-green-500/10",
    red: "border-red-500/40 bg-red-500/10",
    blue: "border-blue-500/40 bg-blue-500/10",
    emerald: "border-emerald-500/40 bg-emerald-500/10",
  };

  const badgeColorClasses = {
    green: "bg-green-500/20 text-green-300",
    red: "bg-red-500/20 text-red-300",
    blue: "bg-blue-500/20 text-blue-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl border transition-all",
        "bg-[#1a1a22] border-[#2a2a35] hover:bg-[#252530] active:scale-[0.98]",
        active && colorClasses[activeColor],
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{label}</span>
          {badge && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                badgeColorClasses[badgeColor]
              )}
            >
              {badge}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{description}</span>
      </div>
      {showArrow && (
        <ChevronRight className="h-5 w-5 text-gray-500 flex-shrink-0" />
      )}
    </button>
  );
}
