"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  X,
  MessageSquare,
  Users,
  UserPlus,
  Trash2,
  Check,
  Globe,
  AtSign,
  MessageCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
    | "comment_mention"
    | "coupon_gift"
    | "reserve_offer";
  // DM fields
  dmFrom?: string;
  dmFromName?: string;
  dmFromEmail?: string;
  dmFromPicture?: string;
  dmText?: string;
  dmConvId?: string;
  dmMessageId?: string;
  // Group fields
  groupId?: string;
  groupName?: string;
  groupFrom?: string;
  groupFromName?: string;
  groupFromEmail?: string;
  groupFromPicture?: string;
  groupText?: string;
  groupMessageId?: string;
  // Knock fields
  knockFrom?: string;
  knockFromName?: string;
  knockFromEmail?: string;
  knockFromPicture?: string;
  knockSpaceId?: string;
  // Global DM fields
  globalDmFrom?: string;
  globalDmFromName?: string;
  globalDmFromEmail?: string;
  globalDmFromPicture?: string;
  globalDmText?: string;
  globalDmConvId?: string;
  globalDmMessageId?: string;
  // Post mention fields
  postId?: string;
  postAuthorId?: string;
  postAuthorName?: string;
  postAuthorEmail?: string;
  postAuthorPicture?: string;
  postContent?: string;
  channelId?: string;
  channelName?: string;
  // Comment mention fields
  commentId?: string;
  commentAuthorId?: string;
  commentAuthorName?: string;
  commentAuthorEmail?: string;
  commentAuthorPicture?: string;
  commentContent?: string;
  // Coupon gift fields
  couponCode?: string;
  couponName?: string;
  assignmentId?: string;
  giftFromUserId?: string;
  giftFromName?: string;
  giftFromPicture?: string;
  giftFromType?: "garage_admin" | "founder" | "user";
  giftOrgName?: string;
  giftMessage?: string;
  // Reserve offer fields (paid reserve assign — recipient inbox).
  // Reuses giftFromUserId/Name/Picture/Message for the sender.
  reserveOfferId?: string;
  reserveItemType?: "course" | "channel" | "workshop" | "call" | "product";
  reserveItemName?: string;
  reservePriceUsd?: number;
  // Common
  read: boolean;
  cleared: boolean;
  createdAt: string;
  updatedAt: string;
};

type TabType = "knocks" | "dms" | "groups" | "global" | "mentions" | "rewards";

export default function NotificationsHub({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("knocks");
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const fetchNotifications = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
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
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      if (!silent) setLoading(false);
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

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      setHasAutoSelected(false); // Reset flag when opening
    }
  }, [isOpen]);

  // Auto-select tab with notifications when first opened
  useEffect(() => {
    if (isOpen && notifications.length > 0 && !hasAutoSelected) {
      const hasMentions = notifications.some(
        (n) => n.type === "post_mention" || n.type === "comment_mention"
      );
      const hasKnocks = notifications.some((n) => n.type === "knock");
      const hasDms = notifications.some((n) => n.type === "dm");
      const hasGroups = notifications.some((n) => n.type === "group_message");
      const hasGlobalDms = notifications.some((n) => n.type === "global_dm");
      const hasRewards = notifications.some(
        (n) => n.type === "coupon_gift" || n.type === "reserve_offer"
      );

      if (hasRewards) {
        setActiveTab("rewards");
      } else if (hasMentions) {
        setActiveTab("mentions");
      } else if (hasKnocks) {
        setActiveTab("knocks");
      } else if (hasDms) {
        setActiveTab("dms");
      } else if (hasGroups) {
        setActiveTab("groups");
      } else if (hasGlobalDms) {
        setActiveTab("global");
      }

      setHasAutoSelected(true); // Mark as auto-selected
    }
  }, [isOpen, notifications, hasAutoSelected]);

  useEffect(() => {
    // Fetch unread count on mount and every 30 seconds
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Separate effect for listening to notification refresh events
  useEffect(() => {
    const handleNotificationRefresh = () => {
      console.log("[NotificationsHub] Received notification refresh event");
      fetchUnreadCount();
      fetchNotifications(true);
    };

    window.addEventListener("notifications:refresh", handleNotificationRefresh);

    return () => {
      window.removeEventListener(
        "notifications:refresh",
        handleNotificationRefresh
      );
    };
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api(
        `/user-notifications/${notificationId}/read`,
        { method: "POST" },
        getToken()!
      );
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
      );
      fetchUnreadCount();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
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
      case "rewards":
        return (
          notification.type === "coupon_gift" ||
          notification.type === "reserve_offer"
        );
      default:
        return true;
    }
  });

  // Get count per tab
  const mentionCount = notifications.filter(
    (n) => n.type === "post_mention" || n.type === "comment_mention"
  ).length;
  const knockCount = notifications.filter((n) => n.type === "knock").length;
  const dmCount = notifications.filter((n) => n.type === "dm").length;
  const groupCount = notifications.filter(
    (n) => n.type === "group_message"
  ).length;
  const globalDmCount = notifications.filter(
    (n) => n.type === "global_dm"
  ).length;
  const rewardCount = notifications.filter(
    (n) => n.type === "coupon_gift" || n.type === "reserve_offer"
  ).length;

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
          onClick={() => {
            if (notification.dmFrom) {
              handleClearNotification(notification._id);
              // Dispatch custom event to open DM chat
              window.dispatchEvent(
                new CustomEvent("notification:open-dm", {
                  detail: { userId: notification.dmFrom },
                })
              );
              onClose();
            }
          }}
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
          onClick={() => {
            if (notification.groupId) {
              handleClearNotification(notification._id);
              // Dispatch custom event to open group chat
              window.dispatchEvent(
                new CustomEvent("notification:open-group", {
                  detail: { groupId: notification.groupId },
                })
              );
              onClose();
            }
          }}
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
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors relative",
            "bg-gradient-to-br from-[#1c1a16] to-[#121214] border-b border-amber-500/10 hover:border-amber-500/25"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
        >
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <Avatar className="w-8 h-8 border border-white/[0.06] flex-shrink-0">
                <AvatarImage src={notification.knockFromPicture} />
                <AvatarFallback className="text-xs bg-gradient-to-br from-amber-400 to-[#facc15] text-black font-semibold shadow-[0_0_8px_rgba(250,204,21,0.25)] border border-amber-300/20">
                  {notification.knockFromName?.charAt(0) ||
                    notification.knockFromEmail?.charAt(0) ||
                    "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-[#121216] border border-amber-500/35 w-4 h-4 rounded-full flex items-center justify-center shadow-md text-amber-400">
                <UserPlus className="h-2.5 w-2.5" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-white truncate">
                  {notification.knockFromName || notification.knockFromEmail}
                </span>
                {!notification.read && (
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-normal">
                Knocked on your space{" "}
                {notification.knockSpaceId && (
                  <span className="text-amber-400 font-medium">
                    ({notification.knockSpaceId})
                  </span>
                )}
              </p>
              <p className="text-[10px] text-neutral-600 mt-1">{timeDisplay}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClearNotification(notification._id);
              }}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-white/5 opacity-60 hover:opacity-100 transition-all flex-shrink-0 cursor-pointer"
            >
              <X className="h-3 w-3 text-neutral-400 hover:text-white" />
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
          onClick={() => {
            if (notification.globalDmFrom) {
              handleClearNotification(notification._id);
              // Dispatch custom event to open Global DM chat
              window.dispatchEvent(
                new CustomEvent("notification:open-global-dm", {
                  detail: { userId: notification.globalDmFrom },
                })
              );
              onClose();
            }
          }}
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
                  {notification.globalDmFromName ||
                    notification.globalDmFromEmail}
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
          onClick={() => {
            if (notification.postId) {
              handleClearNotification(notification._id);
              // Dispatch custom event to open feed post
              window.dispatchEvent(
                new CustomEvent("notification:open-post", {
                  detail: {
                    postId: notification.postId,
                    channelId: notification.channelId,
                  },
                })
              );
              onClose();
            }
          }}
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
          onClick={() => {
            if (notification.postId) {
              handleClearNotification(notification._id);
              // Dispatch custom event to open feed post with comment
              window.dispatchEvent(
                new CustomEvent("notification:open-post", {
                  detail: {
                    postId: notification.postId,
                    channelId: notification.channelId,
                    commentId: notification.commentId,
                  },
                })
              );
              onClose();
            }
          }}
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
                  {notification.commentAuthorName ||
                    notification.commentAuthorEmail}
                </span>
                <span className="text-xs text-gray-500">
                  mentioned you in a comment
                </span>
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

    if (notification.type === "coupon_gift") {
      return (
        <motion.div
          key={notification._id}
          className={cn(
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors cursor-pointer",
            !notification.read && "bg-brand/5"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          onClick={() => {
            handleClearNotification(notification._id);
            router.push("/revenue-network/wallet?tab=rewards");
            onClose();
          }}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-brand/30 flex-shrink-0">
              <AvatarImage src={notification.giftFromPicture} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-brand to-amber-500 text-brand-foreground">
                {notification.giftFromName?.charAt(0) || "🎁"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-white truncate">
                  {notification.giftFromType === "user"
                    ? `${notification.giftFromName} gifted you a coupon`
                    : `Reward from ${notification.giftFromName}`}
                </span>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono text-brand">
                  {notification.couponCode}
                </code>
                {notification.couponName && (
                  <span className="text-[11px] text-gray-400 truncate">
                    · {notification.couponName}
                  </span>
                )}
              </div>
              {notification.giftMessage && (
                <p className="text-[11px] text-gray-400 italic line-clamp-2 mt-1">
                  "{notification.giftMessage}"
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

    if (notification.type === "reserve_offer") {
      // Resolved offers (server emits one on approve/reject too) carry their
      // outcome in giftMessage. We render the same card shape either way —
      // clicking still deep-links to the matching reserve panel.
      const reserveRoutes: Record<string, string> = {
        course: "/courses",
        channel: "/channels",
        workshop: "/workshops",
        call: "/calls",
        product: "/products",
      };
      const dest =
        reserveRoutes[notification.reserveItemType || ""] ||
        "/revenue-network/wallet";
      return (
        <motion.div
          key={notification._id}
          className={cn(
            "border-b border-[#2a2a35] p-3 hover:bg-white/5 transition-colors cursor-pointer",
            !notification.read && "bg-brand/5"
          )}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          onClick={() => {
            handleClearNotification(notification._id);
            router.push(dest);
            onClose();
          }}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-amber-500/30 flex-shrink-0">
              <AvatarImage src={notification.giftFromPicture} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-amber-400 to-amber-600 text-black">
                {notification.giftFromName?.charAt(0) || "📦"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-white truncate">
                  {notification.giftFromName} sent you a reserve offer
                </span>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white truncate">
                  {notification.reserveItemName}
                </span>
                {typeof notification.reservePriceUsd === "number" && (
                  <span className="text-[11px] font-semibold text-brand tabular-nums">
                    · ${notification.reservePriceUsd.toFixed(2)}
                  </span>
                )}
              </div>
              {notification.giftMessage && (
                <p className="text-[11px] text-gray-400 italic line-clamp-2 mt-1">
                  "{notification.giftMessage}"
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
    <>
      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute top-full right-0 mt-2 z-[9999] bg-[#0e0e12]/95 backdrop-blur-xl border border-[#2a2a35] rounded-xl shadow-lg w-[400px] max-h-[400px] overflow-hidden flex flex-col"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-[#2a2a35]">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {notifications.length > 0 && (
                    <>
                      {unreadCount > 0 && (
                        <Button
                          onClick={handleMarkAllRead}
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] hover:bg-blue-500/20 text-blue-400"
                          title="Mark all as read"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        onClick={handleClearAll}
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] hover:bg-red-500/20 text-red-400"
                        title="Clear all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={onClose}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-white/10"
                  >
                    <X className="h-3 w-3 text-gray-400" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 px-3 pb-2">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveTab("knocks");
                  }}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === "knocks"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  Knocks {knockCount > 0 && `(${knockCount})`}
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveTab("dms");
                  }}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === "dms"
                      ? "bg-blue-500/10 text-blue-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  DMs {dmCount > 0 && `(${dmCount})`}
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveTab("groups");
                  }}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === "groups"
                      ? "bg-purple-500/10 text-purple-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  Groups {groupCount > 0 && `(${groupCount})`}
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveTab("global");
                  }}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === "global"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  Global {globalDmCount > 0 && `(${globalDmCount})`}
                </button>

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveTab("mentions");
                  }}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === "mentions"
                      ? "bg-orange-500/10 text-orange-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  Feed {mentionCount > 0 && `(${mentionCount})`}
                </button>

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveTab("rewards");
                  }}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === "rewards"
                      ? "bg-brand/10 text-brand"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  Rewards {rewardCount > 0 && `(${rewardCount})`}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {loading ? (
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
    </>
  );
}
