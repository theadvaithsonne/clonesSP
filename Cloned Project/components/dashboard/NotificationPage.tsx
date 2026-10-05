"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, getUserDataFromToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  MessageSquare,
  Users,
  UserPlus,
  Check,
  Globe,
  AtSign,
  MessageCircle,
  Search,
  Inbox,
  Sparkles,
  Briefcase,
  CheckSquare,
  User,
  DoorOpen,
  TrendingUp,
  KeyRound,
} from "lucide-react";
import { openAccessInbox } from "@/components/dashboard/teamAccess/AccessInboxModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import {
  getLeadNotifications,
  markNotificationsAsRead,
  removeNotification,
  clearAllNotifications,
} from "@/utils/leadNotifications";
import MissedCallsPanel from "@/components/dashboard/MissedCallsPanel";

// Helper to extract string ID from potentially nested MongoDB ObjectId formats
function getNotificationId(id: any): string {
  if (!id) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object") {
    if (id.$oid) return String(id.$oid);
    if (id.id) return String(id.id);
    if (id._id) return String(id._id);
    if (id.oid) return String(id.oid);
    if (id.toString && typeof id.toString === "function") {
      const str = id.toString();
      if (str && str !== "[object Object]") return str;
    }
  }
  return String(id);
}

// Simple time ago formatter
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "1m";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
}

function highlightMention(text: string, usersMap?: Record<string, string>): React.ReactNode {
  if (!text) return "";
  
  // Collect all unique user names from usersMap
  const userNames = usersMap 
    ? Array.from(new Set(Object.values(usersMap)))
        .filter(name => typeof name === "string" && name.trim().length > 0)
        .map(name => name.trim())
    : [];
    
  // Add "you" as a default tag name
  userNames.push("you");
  
  // Sort names by length descending so that multi-word names (e.g. "Triple H")
  // are matched in their entirety before their prefixes (e.g. "Triple")
  userNames.sort((a, b) => b.length - a.length);
  
  // Escape names for regular expressions
  const escapedNames = userNames.map(name => 
    name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  );
  
  // Match @ followed by one of the names, e.g. /(@(?:Triple H|Abhishek Sawant|you))\b/gi
  const regex = new RegExp(`(@(?:${escapedNames.join("|")}))`, "gi");
  
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.toLowerCase().startsWith("@")) {
          return (
            <span key={index} className="text-[#facc15] font-semibold">
              {part}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

function toTitleCase(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getEntityName(entityType: string, data: any): string {
  if (!data) return "";
  const type = entityType.toLowerCase();
  if (type === "lead" || type === "leads") {
    return data.leadName || data.name || "";
  }
  if (type === "task" || type === "tasks" || type === "activity" || type === "activities") {
    return data.title || data.description || "";
  }
  if (type === "company" || type === "companies") {
    return data.companyName || data.name || "";
  }
  if (type === "contact" || type === "contacts") {
    if (data.firstName || data.lastName) {
      return `${data.firstName || ""} ${data.lastName || ""}`.trim();
    }
    return data.name || data.email || "";
  }
  if (type === "funnel" || type === "funnels") {
    return data.funnelName || data.name || "";
  }
  if (type === "product" || type === "products") {
    return data.name || data.productName || "";
  }
  return data.name || data.title || "";
}

function formatAuditNotification(n: UserNotification, usersMap: Record<string, string>): string {
  const entityType = (n.entityType || "record").toLowerCase();
  const action = (n.action || "").toLowerCase();
  
  const data = n.newData || n.oldData;
  const entityName = getEntityName(entityType, data);
  const entityNameStr = entityName ? `"${entityName}"` : "";

  let actionVerb = action;
  if (action === "create") actionVerb = "created";
  else if (action === "update") actionVerb = "updated";
  else if (action === "delete") actionVerb = "deleted";

  let typePretty = entityType;
  if (entityType === "task") typePretty = "Task";
  else if (entityType === "lead") typePretty = "Lead";
  else if (entityType === "funnel") typePretty = "Funnel";
  else if (entityType === "contact") typePretty = "Contact";
  else if (entityType === "company") typePretty = "Company";
  else if (entityType === "product") typePretty = "Product";
  else if (entityType === "activity") typePretty = "Activity";
  else if (entityType === "note") typePretty = "Note";

  const leadName = n.leadName || n.newData?.leadName || n.oldData?.leadName || "";

  let displayAction = actionVerb;
  if (action === "update" && n.changes && typeof n.changes === "object") {
    const changedFields = Object.keys(n.changes);
    if (entityType === "task" && changedFields.includes("isCompleted")) {
      const isCompleted = n.newData?.isCompleted;
      if (isCompleted === true) {
        displayAction = "marked as completed";
      } else if (isCompleted === false) {
        displayAction = "marked as incomplete";
      }
    }
  }

  const actorName = n.userName || (n.userId ? usersMap[n.userId] : "") || "";
  const byActor = actorName ? ` by ${actorName}` : "";

  let resultStr = "";
  if (entityType !== "lead" && entityType !== "leads" && leadName) {
    resultStr = `${typePretty} ${entityNameStr} ${displayAction} for "${leadName}"${byActor}`;
  } else {
    resultStr = `${typePretty} ${entityNameStr} ${displayAction}${byActor}`;
  }

  if (action === "update" && displayAction === "updated" && n.changes && typeof n.changes === "object") {
    const changedFields = Object.keys(n.changes);
    if (changedFields.length > 0) {
      resultStr += `: ${changedFields.join(", ")}`;
    }
  }

  const fallbackDesc = n.description || "Change recorded in CRM";
  return resultStr.trim() || fallbackDesc;
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
    | "reserve_offer"
    | "deals_lead"
    | "deals_audit"
    | "permission_grant";
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
  // Module RBAC grant fields — the offer expires 24h after grantExpiresAt's
  // sibling createdAt, so the row is only actionable inside that window.
  grantId?: string;
  grantModule?: string;
  grantModuleLabel?: string;
  grantExpiresAt?: string;
  grantedByName?: string;
  // Reserve offer fields
  reserveOfferId?: string;
  reserveItemType?: "course" | "channel" | "workshop" | "call" | "product";
  reserveItemName?: string;
  reservePriceUsd?: number;
  // Common
  read: boolean;
  cleared: boolean;
  createdAt: string;
  updatedAt: string;
 
  // New Deals fields
  isDeals?: boolean;
  isLocal?: boolean;
  app?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  userName?: string;
  userEmail?: string;
  leadId?: string;
  leadName?: string;
  estimatedValue?: number;
  source?: string;
  stage?: string;
  message?: string;
  changes?: any;
  oldData?: any;
  newData?: any;
};

type TabType = "all" | "knocks" | "dms" | "groups" | "global" | "mentions" | "rewards" | "backoffice_apps" | "chats" | "feed" | "communities" | "apps";

export default function NotificationPage({
  onClose,
  isMini = false,
}: {
  onClose: () => void;
  isMini?: boolean;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 30;

  useEffect(() => {
    const fetchUsersAndEmployees = async () => {
      const uMap: Record<string, string> = {};

      // 1. Fetch Users
      try {
        const res = await authenticatedFetch(buildExternalUrl("/users?limit=1000"), {
          method: "GET",
        });
        if (res.ok) {
          const data = await res.json();
          const list = data?.data?.users || data?.users || data?.data || data || [];
          list.forEach((user: any) => {
            const id = getNotificationId(user._id || user.id);
            const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "";
            if (id && name) {
              uMap[id] = name;
            }
          });
        }
      } catch (e) {
        console.error("Failed to fetch users for notifications:", e);
      }

      // 2. Fetch Employees
      try {
        const empRes = await authenticatedFetch(buildExternalUrl("/employees"), {
          method: "GET",
        });
        if (empRes.ok) {
          const data = await empRes.json();
          const list = Array.isArray(data) ? data : (data?.data || data?.employees || []);
          list.forEach((emp: any) => {
            const id = getNotificationId(emp._id || emp.id);
            const name = emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email || "";
            if (id && name) {
              uMap[id] = name;
            }
          });
        }
      } catch (e) {
        console.error("Failed to fetch employees for notifications:", e);
      }

      setUsersMap(uMap);
    };

    fetchUsersAndEmployees();
  }, []);

  const fetchNotifications = async (
    currentOffset: number = 0,
    isLoadMore: boolean = false,
    silent: boolean = false
  ) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else if (!silent) {
      setLoading(true);
      setOffset(0);
    }
    try {
      // 1. Fetch HQ notifications
      const orgId = localStorage.getItem("garage_org_id");
      const url = orgId
        ? `/user-notifications?orgId=${orgId}&limit=${LIMIT}&offset=${currentOffset}`
        : `/user-notifications?limit=${LIMIT}&offset=${currentOffset}`;
      
      let hqNotifs: UserNotification[] = [];
      let hqHasMore = false;
      try {
        const res = await api<{ notifications: UserNotification[], pagination?: any }>(
          url,
          {},
          getToken()!
        );
        hqNotifs = (res.notifications || []).map((n: any) => {
          const mapped = { ...n, _id: getNotificationId(n._id || n.id) };
          if (mapped.type === "new_facebook_lead" || mapped.isDeals || mapped.app === "deals") {
            mapped.type = "deals_lead";
            mapped.isDeals = true;
            mapped.leadId = n.lead?.id || n.entityId || "";
            mapped.leadName = n.lead?.name || n.leadName || n.title || "Deals Notification";
            mapped.source = n.lead?.source || n.source || "";
            mapped.stage = n.lead?.stage || n.stage || "";
            mapped.message = n.message || n.title || "";
          }
          return mapped;
        });
        if (res.pagination) {
          const { offset: resOffset, limit: resLimit, total: resTotal } = res.pagination;
          hqHasMore = (resOffset + resLimit) < resTotal;
        }
      } catch (err) {
        console.error("Failed to fetch HQ notifications:", err);
      }

      // 2. Fetch Deals Lead Notifications (localStorage)
      let mappedLeadNotifs: UserNotification[] = [];
      if (currentOffset === 0) {
        const leadNotifs = getLeadNotifications();
        mappedLeadNotifs = leadNotifs.map((ln) => ({
          _id: getNotificationId(ln.id),
          userId: "",
          type: "deals_lead",
          createdAt: ln.timestamp,
          updatedAt: ln.timestamp,
          read: ln.read,
          cleared: false,
          isDeals: true,
          isLocal: true,
          leadId: ln.leadId,
          leadName: ln.leadName,
          estimatedValue: ln.estimatedValue,
          source: ln.source,
          stage: ln.stage,
          message: ln.message,
        }));
      }

      // 3. Fetch Deals Audit Logs (API)
      let mappedAuditNotifs: UserNotification[] = [];
      let auditHasMore = false;
      try {
        const userEmail = getUserDataFromToken().email;
        const emailQuery = userEmail ? `&assignedToEmail=${encodeURIComponent(userEmail)}` : "";
        const auditResponse = await authenticatedFetch(
          buildExternalUrl(`/crm/audit-logs?limit=${LIMIT}&skip=${currentOffset}${emailQuery}`),
          { method: "GET" }
        );
        if (auditResponse.ok) {
          const auditData = await auditResponse.json();
          const auditLogs = auditData.logs || auditData.data || auditData || [];

          if (auditData.pagination) {
            auditHasMore = auditData.pagination.hasMore;
          } else {
            auditHasMore = auditLogs.length === LIMIT;
          }

          // Get last seen timestamp for read/unread computation
          const lastSeenRaw = localStorage.getItem("crm:last-seen-audit-log");
          const lastSeenTs = lastSeenRaw ? Date.parse(lastSeenRaw) : 0;

          // Get local list of read audit logs
          const readAuditLogs: string[] = JSON.parse(
            localStorage.getItem("crm:read-audit-logs") || "[]"
          );

          // Get local list of cleared/deleted audit log IDs
          const clearedAuditIds: string[] = JSON.parse(
            localStorage.getItem("crm:cleared-audit-logs") || "[]"
          );

          mappedAuditNotifs = auditLogs
            .filter((log: any) => log && log._id && !clearedAuditIds.includes(getNotificationId(log._id)))
            .map((log: any) => {
              const logId = getNotificationId(log._id);
              const logTime = log.createdAt || log.timestamp || new Date().toISOString();
              const logTs = Date.parse(logTime);
              const isRead = (!Number.isNaN(logTs) && logTs <= lastSeenTs) || readAuditLogs.includes(logId);

              return {
                _id: logId,
                userId: log.userId || "",
                type: "deals_audit",
                createdAt: logTime,
                updatedAt: logTime,
                read: isRead,
                cleared: false,
                isDeals: true,
                app: log.app || "deals",
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                description: log.description,
                userName: log.userName,
                userEmail: log.userEmail,
                changes: log.changes,
                oldData: log.oldData,
                newData: log.newData,
                leadId: log.leadId || log.newData?.leadId || log.oldData?.leadId || (log.entityType === "lead" ? log.entityId : ""),
                leadName: log.leadName || log.newData?.leadName || log.oldData?.leadName || "",
              };
            });
        }
      } catch (error) {
        console.error("Failed to fetch deals audit logs:", error);
      }

      // Combine and sort all notifications by createdAt descending
      const newItems = [...hqNotifs, ...mappedLeadNotifs, ...mappedAuditNotifs];
      setNotifications((prev) => {
        const combined = isLoadMore ? [...prev, ...newItems] : newItems;
        const seenIds = new Set();
        const deduped = combined.filter((item) => {
          const key = getNotificationId(item._id);
          if (seenIds.has(key)) return false;
          seenIds.add(key);
          return true;
        });
        deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return deduped;
      });
      setHasMore(hqHasMore || auditHasMore);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleLoadMore = () => {
    const nextOffset = offset + LIMIT;
    setOffset(nextOffset);
    fetchNotifications(nextOffset, true);
  };

  const fetchUnreadCount = async () => {
    try {
      // 1. Fetch server unread count
      const orgId = localStorage.getItem("garage_org_id");
      const url = orgId
        ? `/user-notifications/unread-count?orgId=${orgId}`
        : "/user-notifications/unread-count";
      const res = await api<{ count: number }>(url, {}, getToken()!);
      const hqUnread = res.count || 0;

      // 2. Fetch local lead unread count
      const leadUnread = getLeadNotifications().filter((n) => !n.read).length;

      // 3. Fetch local audit log unread count
      let auditUnread = 0;
      try {
        const userEmail = getUserDataFromToken().email;
        const emailQuery = userEmail ? `&assignedToEmail=${encodeURIComponent(userEmail)}` : "";
        const auditResponse = await authenticatedFetch(
          buildExternalUrl(`/crm/audit-logs?limit=30${emailQuery}`),
          { method: "GET" }
        );
        if (auditResponse.ok) {
          const auditData = await auditResponse.json();
          const auditLogs = auditData.logs || auditData.data || auditData || [];

          const lastSeenRaw = localStorage.getItem("crm:last-seen-audit-log");
          const lastSeenTs = lastSeenRaw ? Date.parse(lastSeenRaw) : 0;

          const readAuditLogs: string[] = JSON.parse(
            localStorage.getItem("crm:read-audit-logs") || "[]"
          );

          const clearedAuditIds: string[] = JSON.parse(
            localStorage.getItem("crm:cleared-audit-logs") || "[]"
          );

          auditUnread = auditLogs.filter((log: any) => {
            if (!log || !log._id) return false;
            const logId = getNotificationId(log._id);
            if (clearedAuditIds.includes(logId) || readAuditLogs.includes(logId)) return false;
            const logTime = log.createdAt || log.timestamp;
            const logTs = logTime ? Date.parse(logTime) : NaN;
            return !Number.isNaN(logTs) && logTs > lastSeenTs;
          }).length;
        }
      } catch (e) {
        console.error(e);
      }

      setUnreadCount(hqUnread + leadUnread + auditUnread);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  // Listen for refresh events
  useEffect(() => {
    const handleNotificationRefresh = () => {
      fetchUnreadCount();
      fetchNotifications(0, false, true);
    };

    window.addEventListener("notifications:refresh", handleNotificationRefresh);
    window.addEventListener("leadNotificationAdded", handleNotificationRefresh);
    window.addEventListener("leadNotificationsRead", handleNotificationRefresh);
    window.addEventListener("leadNotificationsCleared", handleNotificationRefresh);
    window.addEventListener("crm:auditLogs:refresh", handleNotificationRefresh);

    return () => {
      window.removeEventListener(
        "notifications:refresh",
        handleNotificationRefresh
      );
      window.removeEventListener(
        "leadNotificationAdded",
        handleNotificationRefresh
      );
      window.removeEventListener(
        "leadNotificationsRead",
        handleNotificationRefresh
      );
      window.removeEventListener(
        "leadNotificationsCleared",
        handleNotificationRefresh
      );
      window.removeEventListener(
        "crm:auditLogs:refresh",
        handleNotificationRefresh
      );
    };
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    const stringId = getNotificationId(notificationId);
    const target = notifications.find((n) => getNotificationId(n._id) === stringId);
    if (target) {
      if (target.type === "deals_lead" && target.isLocal) {
        markNotificationsAsRead([stringId]);
        setNotifications((prev) =>
          prev.map((n) => (getNotificationId(n._id) === stringId ? { ...n, read: true } : n))
        );
        fetchUnreadCount();
        window.dispatchEvent(new CustomEvent("leadNotificationsRead"));
        return;
      } else if (target.type === "deals_audit") {
        const readAuditLogs = JSON.parse(localStorage.getItem("crm:read-audit-logs") || "[]");
        if (!readAuditLogs.includes(stringId)) {
          readAuditLogs.push(stringId);
          localStorage.setItem("crm:read-audit-logs", JSON.stringify(readAuditLogs));
        }
        setNotifications((prev) =>
          prev.map((n) => (getNotificationId(n._id) === stringId ? { ...n, read: true } : n))
        );
        fetchUnreadCount();
        window.dispatchEvent(new CustomEvent("crm:auditLogs:refresh"));
        return;
      }
    }

    try {
      await api(
        `/user-notifications/${stringId}/read`,
        { method: "POST" },
        getToken()!
      );
      setNotifications((prev) =>
        prev.map((n) => (getNotificationId(n._id) === stringId ? { ...n, read: true } : n))
      );
      fetchUnreadCount();
      window.dispatchEvent(new CustomEvent("notifications:refresh"));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleClearNotification = async (notificationId: string) => {
    const stringId = getNotificationId(notificationId);
    const target = notifications.find((n) => getNotificationId(n._id) === stringId);
    if (target) {
      if (target.type === "deals_lead" && target.isLocal) {
        removeNotification(stringId);
        setNotifications((prev) => prev.filter((n) => getNotificationId(n._id) !== stringId));
        fetchUnreadCount();
        window.dispatchEvent(new CustomEvent("leadNotificationRemoved"));
        return;
      } else if (target.type === "deals_audit") {
        const clearedAuditLogs = JSON.parse(
          localStorage.getItem("crm:cleared-audit-logs") || "[]"
        );
        if (!clearedAuditLogs.includes(stringId)) {
          clearedAuditLogs.push(stringId);
          localStorage.setItem("crm:cleared-audit-logs", JSON.stringify(clearedAuditLogs));
        }
        setNotifications((prev) => prev.filter((n) => getNotificationId(n._id) !== stringId));
        fetchUnreadCount();
        window.dispatchEvent(new CustomEvent("crm:auditLogs:refresh"));
        return;
      }
    }

    try {
      await api(
        `/user-notifications/${stringId}`,
        { method: "DELETE" },
        getToken()!
      );
      setNotifications((prev) => prev.filter((n) => getNotificationId(n._id) !== stringId));
      fetchUnreadCount();
      window.dispatchEvent(new CustomEvent("notifications:refresh"));
    } catch (error) {
      console.error("Failed to clear notification:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      // 1. Clear lead notifications from localStorage
      clearAllNotifications();

      // 2. Clear all visible audit logs
      const currentAuditIds = notifications
        .filter((n) => n.type === "deals_audit")
        .map((n) => getNotificationId(n._id));
      const clearedAuditLogs = JSON.parse(
        localStorage.getItem("crm:cleared-audit-logs") || "[]"
      );
      const newCleared = Array.from(new Set([...clearedAuditLogs, ...currentAuditIds]));
      localStorage.setItem("crm:cleared-audit-logs", JSON.stringify(newCleared));

      // 3. Clear standard notifications from server
      const orgId = localStorage.getItem("garage_org_id");
      const url = orgId
        ? `/user-notifications?orgId=${orgId}`
        : "/user-notifications";
      await api(url, { method: "DELETE" }, getToken()!);

      setNotifications([]);
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent("notifications:refresh"));
      window.dispatchEvent(new CustomEvent("crm:auditLogs:refresh"));
    } catch (error) {
      console.error("Failed to clear all notifications:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // 1. Mark lead notifications as read
      markNotificationsAsRead();

      // 2. Mark audit logs as read by saving latest timestamp
      const newestAudit = notifications.find((n) => n.type === "deals_audit");
      const latestRaw = newestAudit?.createdAt;
      if (latestRaw) {
        localStorage.setItem("crm:last-seen-audit-log", latestRaw);
      }

      // Also mark all in readAuditLogs list
      const allAuditIds = notifications
        .filter((n) => n.type === "deals_audit")
        .map((n) => getNotificationId(n._id));
      const readAuditLogs = JSON.parse(localStorage.getItem("crm:read-audit-logs") || "[]");
      const updatedReadAuditLogs = Array.from(new Set([...readAuditLogs, ...allAuditIds]));
      localStorage.setItem("crm:read-audit-logs", JSON.stringify(updatedReadAuditLogs));

      // 3. Mark standard notifications as read
      const orgId = localStorage.getItem("garage_org_id");
      const url = orgId
        ? `/user-notifications/read-all?orgId=${orgId}`
        : "/user-notifications/read-all";
      await api(url, { method: "POST" }, getToken()!);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent("notifications:refresh"));
      window.dispatchEvent(new CustomEvent("crm:auditLogs:refresh"));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // Get counts per category
  const stats = useMemo(() => {
    const counts = {
      all: 0,
      knocks: 0,
      dms: 0,
      groups: 0,
      global: 0,
      mentions: 0,
      rewards: 0,
      backoffice_apps: 0,
      chats: 0,
      feed: 0,
      communities: 0,
      apps: 0,
    };

    notifications.forEach((n) => {
      if (!n.read) {
        counts.all++;
        if (n.type === "knock") counts.knocks++;
        else if (n.type === "dm") counts.dms++;
        else if (n.type === "group_message") counts.groups++;
        else if (n.type === "global_dm") counts.global++;
        else if (n.type === "post_mention" || n.type === "comment_mention") counts.mentions++;
        else if (n.type === "coupon_gift" || n.type === "reserve_offer") counts.rewards++;
        else if (n.type === "deals_lead" || n.type === "deals_audit") counts.backoffice_apps++;

        // Mini panel categories
        if (n.type === "dm" || n.type === "global_dm") {
          counts.chats++;
        } else if (n.type === "post_mention" || n.type === "comment_mention") {
          counts.feed++;
        } else if (n.type === "group_message") {
          counts.communities++;
        } else if (
          n.type === "deals_lead" ||
          n.type === "deals_audit" ||
          n.type === "coupon_gift" ||
          n.type === "reserve_offer" ||
          n.type === "knock" ||
          n.type === "permission_grant"
        ) {
          counts.apps++;
        }
      }
    });

    return counts;
  }, [notifications]);



  // Filter & Search notifications
  const filteredNotifications = useMemo(() => {
    let result = notifications;

    // 1. Tab filtering
    if (activeTab !== "all") {
      result = result.filter((notification) => {
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
          case "backoffice_apps":
            return (
              notification.type === "deals_lead" ||
              notification.type === "deals_audit"
            );
          // New mini filter cases
          case "chats":
            return (
              notification.type === "dm" ||
              notification.type === "global_dm"
            );
          case "feed":
            return (
              notification.type === "post_mention" ||
              notification.type === "comment_mention"
            );
          case "communities":
            return notification.type === "group_message";
          case "apps":
            return (
              notification.type === "deals_lead" ||
              notification.type === "deals_audit" ||
              notification.type === "coupon_gift" ||
              notification.type === "reserve_offer" ||
              notification.type === "knock" ||
              notification.type === "permission_grant"
            );
          default:
            return true;
        }
      });
    }

    // 2. Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) => {
        const name = (
          n.dmFromName ||
          n.groupFromName ||
          n.knockFromName ||
          n.globalDmFromName ||
          n.postAuthorName ||
          n.commentAuthorName ||
          n.giftFromName ||
          n.leadName ||
          n.userName ||
          ""
        ).toLowerCase();
        const email = (
          n.dmFromEmail ||
          n.groupFromEmail ||
          n.knockFromEmail ||
          n.globalDmFromEmail ||
          n.postAuthorEmail ||
          n.commentAuthorEmail ||
          n.userEmail ||
          ""
        ).toLowerCase();
        const text = (
          n.dmText ||
          n.groupText ||
          n.globalDmText ||
          n.postContent ||
          n.commentContent ||
          n.giftMessage ||
          n.couponCode ||
          n.couponName ||
          n.reserveItemName ||
          n.description ||
          n.message ||
          n.action ||
          ""
        ).toLowerCase();
        return name.includes(q) || email.includes(q) || text.includes(q);
      });
    }

    return result;
  }, [notifications, activeTab, searchQuery]);

  // Group notifications into Unread vs Earlier
  const groupedNotifications = useMemo(() => {
    const unread: UserNotification[] = [];
    const read: UserNotification[] = [];

    filteredNotifications.forEach((n) => {
      if (!n.read) unread.push(n);
      else read.push(n);
    });

    return { unread, read };
  }, [filteredNotifications]);

  const categories = [
    { id: "all", label: "All Inbox" },
    { id: "knocks", label: "Knocks" },
    { id: "dms", label: "DMs" },
    { id: "groups", label: "Groups" },
    { id: "global", label: "Global" },
    { id: "mentions", label: "Feed" },
    { id: "rewards", label: "Rewards" },
    { id: "backoffice_apps", label: "Backoffice Apps" },
  ] as const;

  const renderRow = (n: UserNotification) => {
    const timeDisplay = timeAgo(new Date(n.createdAt));
    let authorName = "";
    let authorPicture = "";
    let fallbackText = "?";
    let iconElement: React.ReactNode = null;
    let cardTitle = "";
    let cardBody = "";
    let clickHandler: (() => void) | undefined = undefined;
    let badgeStyle = "";
    let badgeText = "";
    let userId: string | undefined = undefined;

    switch (n.type) {
      case "deals_lead":
        authorName = n.leadName || "New Lead";
        authorPicture = "/deals.png";
        fallbackText = "💼";
        iconElement = <Briefcase className="h-3.5 w-3.5" />;
        cardTitle = `${n.source || "Facebook"} Lead: ${n.leadName}`;
        cardBody = n.message || `New lead received in stage ${n.stage || "Prospects"}${n.estimatedValue ? ` (Value: ₹${n.estimatedValue.toLocaleString()})` : ""}`;
        badgeText = "Deals • Lead";
        badgeStyle = "text-cyan-400 bg-cyan-500/5 border border-cyan-500/10";
        break;
      case "deals_audit":
        authorName = n.userName || "Deals Activity";
        authorPicture = "/deals.png";
        fallbackText = "⚙️";
        iconElement = <CheckSquare className="h-3.5 w-3.5" />;
        cardTitle = `${toTitleCase(n.action || "Activity")} • ${toTitleCase(n.entityType || "CRM")}`;
        cardBody = formatAuditNotification(n, usersMap);
        badgeText = "Deals • Activity";
        badgeStyle = "text-cyan-400 bg-cyan-500/5 border border-cyan-500/10";
        break;
      case "dm":
        authorName = n.dmFromName || n.dmFromEmail || "Someone";
        authorPicture = n.dmFromPicture || "";
        userId = n.dmFrom;
        fallbackText = authorName.charAt(0);
        iconElement = <MessageSquare className="h-3.5 w-3.5" />;
        cardTitle = `${authorName}`;
        cardBody = n.dmText || "";
        badgeText = "DM";
        badgeStyle = "text-indigo-400 bg-indigo-500/5 border border-indigo-500/10";
        clickHandler = () => {
          if (n.dmFrom) {
            handleClearNotification(n._id);
            window.dispatchEvent(new CustomEvent("notification:open-dm", { detail: { userId: n.dmFrom } }));
            onClose();
          }
        };
        break;
      case "group_message":
        authorName = n.groupFromName || n.groupFromEmail || "Someone";
        authorPicture = n.groupFromPicture || "";
        userId = n.groupFrom;
        fallbackText = authorName.charAt(0);
        iconElement = <Users className="h-3.5 w-3.5" />;
        cardTitle = `${authorName} in #${n.groupName}`;
        cardBody = n.groupText || "";
        badgeText = "Group";
        badgeStyle = "text-purple-400 bg-purple-500/5 border border-purple-500/10";
        clickHandler = () => {
          if (n.groupId) {
            handleClearNotification(n._id);
            window.dispatchEvent(new CustomEvent("notification:open-group", { detail: { groupId: n.groupId } }));
            onClose();
          }
        };
        break;
      case "knock":
        authorName = n.knockFromName || n.knockFromEmail || "Someone";
        authorPicture = n.knockFromPicture || "";
        userId = n.knockFrom;
        fallbackText = authorName.charAt(0);
        iconElement = <UserPlus className="h-3.5 w-3.5" />;
        cardTitle = `${authorName} knocked`;
        cardBody = `Requested entry to workspace space ${n.knockSpaceId ? `"${n.knockSpaceId}"` : ""}`;
        badgeText = "Knock";
        badgeStyle = "text-amber-400 bg-amber-500/5 border border-amber-500/10";
        clickHandler = () => {
          handleClearNotification(n._id);
        };
        break;
      case "global_dm":
        authorName = n.globalDmFromName || n.globalDmFromEmail || "Someone";
        authorPicture = n.globalDmFromPicture || "";
        userId = n.globalDmFrom;
        fallbackText = authorName.charAt(0);
        iconElement = <Globe className="h-3.5 w-3.5" />;
        cardTitle = `${authorName}`;
        cardBody = n.globalDmText || "";
        badgeText = "Global";
        badgeStyle = "text-emerald-400 bg-emerald-500/5 border border-emerald-500/10";
        clickHandler = () => {
          if (n.globalDmFrom) {
            handleClearNotification(n._id);
            window.dispatchEvent(new CustomEvent("notification:open-global-dm", { detail: { userId: n.globalDmFrom } }));
            onClose();
          }
        };
        break;
      case "post_mention":
        authorName = n.postAuthorName || n.postAuthorEmail || "Someone";
        authorPicture = n.postAuthorPicture || "";
        userId = n.postAuthorId;
        fallbackText = authorName.charAt(0);
        iconElement = <AtSign className="h-3.5 w-3.5" />;
        cardTitle = `${authorName} mentioned you`;
        cardBody = n.postContent || "";
        if (n.channelName) cardTitle += ` in ${n.channelName}`;
        badgeText = "Feed";
        badgeStyle = "text-pink-400 bg-pink-500/5 border border-pink-500/10";
        clickHandler = () => {
          if (n.postId) {
            handleClearNotification(n._id);
            window.dispatchEvent(new CustomEvent("notification:open-post", { detail: { postId: n.postId, channelId: n.channelId } }));
            onClose();
          }
        };
        break;
      case "comment_mention":
        authorName = n.commentAuthorName || n.commentAuthorEmail || "Someone";
        authorPicture = n.commentAuthorPicture || "";
        userId = n.commentAuthorId;
        fallbackText = authorName.charAt(0);
        iconElement = <MessageCircle className="h-3.5 w-3.5" />;
        cardTitle = `${authorName} mentioned you in comment`;
        cardBody = n.commentContent || "";
        if (n.channelName) cardTitle += ` in ${n.channelName}`;
        badgeText = "Comment";
        badgeStyle = "text-pink-400 bg-pink-500/5 border border-pink-500/10";
        clickHandler = () => {
          if (n.postId) {
            handleClearNotification(n._id);
            window.dispatchEvent(new CustomEvent("notification:open-post", { detail: { postId: n.postId, channelId: n.channelId, commentId: n.commentId } }));
            onClose();
          }
        };
        break;
      case "coupon_gift":
        authorName = n.giftFromName || "Garage Reward";
        authorPicture = n.giftFromPicture || "";
        userId = n.giftFromUserId;
        fallbackText = "🎁";
        iconElement = <Sparkles className="h-3.5 w-3.5" />;
        cardTitle = n.giftFromType === "user" ? `${authorName} gifted you a coupon` : `Reward from ${authorName}`;
        cardBody = `Code: ${n.couponCode} ${n.couponName ? `(${n.couponName})` : ""} ${n.giftMessage ? ` - "${n.giftMessage}"` : ""}`;
        badgeText = "Reward";
        badgeStyle = "text-yellow-400 bg-yellow-500/5 border border-yellow-500/10";
        clickHandler = () => {
          handleClearNotification(n._id);
          router.push("/revenue-network/wallet?tab=rewards");
          onClose();
        };
        break;
      case "reserve_offer":
        authorName = n.giftFromName || "Steward";
        authorPicture = n.giftFromPicture || "";
        userId = n.giftFromUserId;
        fallbackText = "📦";
        iconElement = <Sparkles className="h-3.5 w-3.5" />;
        cardTitle = `Reserve offer from ${authorName}`;
        cardBody = `${n.reserveItemName} ${n.reservePriceUsd ? `· $${n.reservePriceUsd.toFixed(2)}` : ""} ${n.giftMessage ? ` - "${n.giftMessage}"` : ""}`;
        badgeText = "Reserve";
        badgeStyle = "text-yellow-400 bg-yellow-500/5 border border-yellow-500/10";
        const routes: Record<string, string> = {
          course: "/courses",
          channel: "/channels",
          workshop: "/workshops",
          call: "/calls",
          product: "/products",
        };
        clickHandler = () => {
          handleClearNotification(n._id);
          router.push(routes[n.reserveItemType || ""] || "/revenue-network/wallet");
          onClose();
        };
        break;
      case "permission_grant":
        authorName = n.grantedByName || "A founder";
        fallbackText = authorName.charAt(0);
        iconElement = <KeyRound className="h-3.5 w-3.5" />;
        cardTitle = `${authorName} gave you ${n.grantModuleLabel || "module"} admin`;
        cardBody =
          "Accept within 24 hours to turn the access on — it stays off until you do.";
        badgeText = "Access";
        badgeStyle = "text-brand bg-brand/5 border border-brand/20";
        // Accept/decline lives in the access inbox so there is exactly one
        // place that talks to /rbac/grants/:id/accept.
        clickHandler = () => {
          openAccessInbox();
          onClose();
        };
        break;
    }

    if (isMini) {
      // Determine card content and details
      const isSystemNotification = n.type === "deals_lead" || n.type === "deals_audit";
      
      let badgeIcon: React.ReactNode = null;
      let systemIcon: React.ReactNode = null;
      let formattedTitle: React.ReactNode = null;
      let highlightBody = false;

      // Handle card content based on type
      switch (n.type) {
        case "knock":
          badgeIcon = <DoorOpen className="h-2 w-2 text-[#facc15]" />;
          formattedTitle = (
            <span className="text-white text-xs font-normal">
              <strong className="font-semibold text-white">{authorName}</strong> knocked you
            </span>
          );
          cardBody = `Missed Knock · OfficeStream — ${n.knockSpaceId || "The Lab"}`;
          break;
        case "dm":
        case "global_dm":
          badgeIcon = <MessageSquare className="h-2 w-2 text-white" />;
          formattedTitle = (
            <span className="text-white text-xs font-normal">
              <strong className="font-semibold text-white">{authorName}</strong> sent you a DM
            </span>
          );
          highlightBody = true;
          break;
        case "group_message":
          badgeIcon = <Users className="h-2 w-2 text-white" />;
          formattedTitle = (
            <span className="text-white text-xs font-normal">
              <strong className="font-semibold text-white">{authorName}</strong> in <strong className="font-semibold text-white">#{n.groupName}</strong>
            </span>
          );
          highlightBody = true;
          break;
        case "post_mention":
        case "comment_mention":
          badgeIcon = <User className="h-2 w-2 text-white" />;
          formattedTitle = (
            <span className="text-white text-xs font-normal">
              <strong className="font-semibold text-white">{authorName}</strong> mentioned you in <strong className="font-semibold text-white">{n.channelName || "Founders Affiliate Hub"}</strong>
            </span>
          );
          highlightBody = true; // For highlightMention
          break;
        case "coupon_gift":
        case "reserve_offer":
          badgeIcon = <Sparkles className="h-2 w-2 text-yellow-400" />;
          formattedTitle = (
            <span className="text-white text-xs font-normal">
              Reward from <strong className="font-semibold text-white">{authorName}</strong>
            </span>
          );
          break;
        case "permission_grant":
          badgeIcon = <KeyRound className="h-2 w-2 text-brand" />;
          formattedTitle = (
            <span className="text-white text-xs font-normal">
              <strong className="font-semibold text-white">{authorName}</strong> gave you{" "}
              <strong className="font-semibold text-brand">
                {n.grantModuleLabel || "module"}
              </strong>{" "}
              admin
            </span>
          );
          cardBody = "Tap to accept — expires 24h after it was sent";
          break;
        case "deals_lead":
          systemIcon = <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />;
          formattedTitle = (
            <span className="text-white text-xs font-normal">
              Deal <strong className="font-semibold text-white">{n.leadName || "Acme Corp"}</strong> moved to <strong className="font-semibold text-emerald-400">{n.stage || "Negotiation"}</strong>
            </span>
          );
          const dealValue = n.estimatedValue || n.newData?.estimatedValue || 24000;
          const dealUser = n.userName || n.newData?.userName || "Priya Nair";
          cardBody = `Deals · $${dealValue.toLocaleString()} · by ${dealUser}`;
          break;
        case "deals_audit":
          const isTask = (n.entityType || "").toLowerCase() === "task";
          systemIcon = isTask ? (
            <CheckSquare className="h-4.5 w-4.5 text-white" />
          ) : (
            <Briefcase className="h-4.5 w-4.5 text-cyan-400" />
          );
          formattedTitle = (
            <span className="text-white text-xs font-normal">
              <strong className="font-semibold text-white">{authorName || "Sarah Kim"}</strong> assigned you a task
            </span>
          );
          if (isTask) {
            const taskTitle = n.newData?.title || n.newData?.description || n.description || "Q3 launch checklist";
            cardBody = `Taskrooms · "${taskTitle}" — Due Fri`;
          }
          break;
      }

      const initials = getInitials(authorName);

      return (
        <motion.div
          key={n._id}
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.15 }}
          onClick={clickHandler}
          className={cn(
            "group flex flex-col gap-2.5 p-3 rounded-2xl transition-all duration-150 text-left relative shadow-sm",
            n.type === "knock"
              ? "bg-gradient-to-br from-[#1c1a16] to-[#121214] border border-amber-500/20 hover:border-amber-500/35 hover:shadow-amber-500/5"
              : "bg-[#141416] border border-[#222226] hover:bg-[#1a1a20]",
            clickHandler ? "cursor-pointer" : "cursor-default"
          )}
        >
          {/* Card row layout */}
          <div className="flex items-start gap-2.5 w-full">
            {/* Left element: Avatar or System Icon */}
            {isSystemNotification ? (
              <div className="w-9 h-9 rounded-xl bg-[#1c1c24] border border-[#2e2e38] flex items-center justify-center flex-shrink-0 shadow-inner">
                {systemIcon}
              </div>
            ) : (
              <div
                className={cn(
                  "relative flex-shrink-0",
                  userId && "cursor-pointer hover:opacity-85 transition-opacity"
                )}
                onClick={(e) => {
                  if (userId) {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("affiliate-profile:open", {
                        detail: { userId },
                      })
                    );
                  }
                }}
              >
                {authorPicture && (authorPicture.startsWith("/") || authorPicture.startsWith("http")) ? (
                  <img
                    src={authorPicture}
                    alt={authorName}
                    className="w-9 h-9 rounded-full object-cover border border-white/[0.06] shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className={cn(
                    "w-9 h-9 rounded-full text-black font-bold flex items-center justify-center text-xs shadow select-none",
                    n.type === "knock"
                      ? "bg-gradient-to-br from-amber-400 to-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.25)] border border-amber-300/20"
                      : "bg-[#facc15]"
                  )}>
                    {initials}
                  </div>
                )}
                {badgeIcon && (
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 bg-[#121216] border w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-md",
                    n.type === "knock" ? "border-amber-500/35 text-amber-400" : "border-[#222228] text-white"
                  )}>
                    {badgeIcon}
                  </div>
                )}
              </div>
            )}

            {/* Content Column: Title, Body and Action Buttons */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5 pr-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 leading-snug">
                  {formattedTitle || <span className="text-white text-xs font-semibold">{cardTitle}</span>}
                </div>
                {/* Time Display, Yellow Unread Dot, and X Button */}
                <div className="flex items-center gap-2 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] text-neutral-500 font-normal shrink-0">
                    {timeDisplay}
                  </span>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] shrink-0" />
                  )}
                  <button
                    onClick={() => handleClearNotification(n._id)}
                    className="text-neutral-500 hover:text-white p-1 rounded hover:bg-white/5 transition-all flex items-center justify-center h-5 w-5 cursor-pointer shrink-0"
                    title="Delete notification"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
              
              <p className="text-[11px] text-neutral-400 font-normal leading-normal mt-0.5 break-words">
                {highlightBody ? highlightMention(cardBody, usersMap) : cardBody}
              </p>

              {/* Action buttons (for all Knocks) */}
              {n.type === "knock" && (
                <div className="flex items-center gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleClearNotification(n._id)}
                    className="bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold px-4 py-1.5 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={n._id}
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.15 }}
        onClick={clickHandler}
        className={cn(
          "group flex items-center justify-between gap-4 py-3 px-3 border-b border-white/[0.04] bg-[#0d0d10]/20 hover:bg-white/[0.02] transition-colors duration-150 text-left",
          clickHandler ? "cursor-pointer" : "cursor-default"
        )}
      >
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          {/* Blue Dot Unread Indicator */}
          <div className="w-1.5 flex-shrink-0 flex items-center justify-center">
            {!n.read && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            )}
          </div>

          <Avatar className="w-8 h-8 border border-white/[0.06] flex-shrink-0">
            <AvatarImage src={authorPicture} />
            <AvatarFallback className="text-[10px] font-semibold text-neutral-300 bg-neutral-800">
              {fallbackText}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs tracking-wide truncate font-medium", !n.read ? "text-white" : "text-neutral-400")}>
                {cardTitle}
              </span>
              <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded", badgeStyle)}>
                {badgeText}
              </span>
            </div>
            <p className={cn("text-xs truncate max-w-xl md:max-w-2xl mt-0.5 leading-relaxed font-normal", !n.read ? "text-neutral-300" : "text-neutral-500")}>
              {cardBody}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Time stamp */}
          <span className="text-[10px] text-neutral-500 tracking-wide font-normal">
            {timeDisplay}
          </span>

          {/* Row actions */}
          <div className="flex items-center gap-1 w-14 justify-end">
            {!n.read && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAsRead(n._id);
                }}
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-neutral-800 text-neutral-500 hover:text-white rounded-md transition-all flex items-center justify-center"
                title="Mark as read"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClearNotification(n._id);
              }}
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-neutral-800 text-neutral-500 hover:text-white rounded-md transition-all flex items-center justify-center"
              title="Delete notification"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  if (isMini) {
    const miniCategories = [
      { id: "all", label: "All" },
      { id: "knocks", label: "Knocks" },
      { id: "dms", label: "DMs" },
      { id: "groups", label: "Groups" },
      { id: "global", label: "Global" },
      { id: "mentions", label: "Feed" },
      { id: "rewards", label: "Rewards" },
      { id: "backoffice_apps", label: "Backoffice Apps" },
    ] as const;

    return (
      <div className="w-full h-full flex flex-col bg-transparent overflow-hidden px-3">
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-3 pt-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white tracking-tight">Unread</span>
            {stats.all > 0 && (
              <span className="bg-[#facc15] text-black text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center justify-center">
                {stats.all}
              </span>
            )}
          </div>
          {stats.all > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-[#60a5fa] hover:text-[#3b82f6] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Categories Tabs bar */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 pb-3.5 flex-shrink-0">
          {miniCategories.map((cat) => {
            const count = stats[cat.id];
            const isActive = activeTab === cat.id;
            const labelText = count > 0 ? `${cat.label} ${count}` : cat.label;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all rounded-full shrink-0 flex items-center gap-1 border cursor-pointer",
                  isActive
                    ? "border-[#facc15] text-[#facc15] bg-[#facc15]/10 font-bold"
                    : "bg-[#1c1c24] text-[#8888a0] border-transparent hover:text-white"
                )}
              >
                <span>{labelText}</span>
              </button>
            );
          })}
        </div>

        {/* List Feed Area */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2 scrollbar-hide pb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <p className="text-xs text-neutral-500 font-normal">Loading updates...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Inbox className="h-7 w-7 text-neutral-600 mb-2.5" />
              <h3 className="text-xs font-semibold text-neutral-300">All caught up</h3>
              <p className="text-[11px] text-neutral-500 mt-1">
                {searchQuery
                  ? "No matching notifications."
                  : `No new updates.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Unread Section */}
              {groupedNotifications.unread.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1">
                    NEW · Today
                  </div>
                  <div className="flex flex-col gap-3">
                    <AnimatePresence initial={false}>
                      {groupedNotifications.unread.map((n) => renderRow(n))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Read Section */}
              {groupedNotifications.read.length > 0 && (
                <div className="flex flex-col gap-2.5 mt-2">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1">
                    Earlier
                  </div>
                  <div className="flex flex-col gap-3">
                    <AnimatePresence initial={false}>
                      {groupedNotifications.read.map((n) => renderRow(n))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-60px)] bg-[#08080a] flex justify-center p-6 overflow-hidden">
      
      {/* Main Notification Feed (centered, max-w-5xl) */}
      <div className="w-full max-w-5xl flex-1 min-w-0 flex flex-col h-full bg-transparent">
        
        {/* Header toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2 tracking-wide">
              Notifications
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5 font-normal">
              Inbox updates and knocks history.
            </p>
          </div>

          {/* Search bar & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-[#111114]/60 border-white/[0.06] hover:border-white/[0.1] focus:border-neutral-500/50 focus:ring-0 text-xs text-white placeholder-neutral-500 rounded-lg h-8 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {filteredNotifications.length > 0 && (
              <div className="flex items-center gap-1">
                {groupedNotifications.unread.length > 0 && (
                  <Button
                    onClick={handleMarkAllRead}
                    variant="ghost"
                    className="h-8 text-xs px-2.5 hover:bg-neutral-800 text-neutral-300 font-medium rounded-lg transition-all"
                  >
                    Mark read
                  </Button>
                )}
                <Button
                  onClick={handleClearAll}
                  variant="ghost"
                  className="h-8 text-xs px-2.5 hover:bg-neutral-800 text-neutral-400 hover:text-white font-medium rounded-lg transition-all"
                >
                  Clear page
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Missed calls — sits between the header toolbar and the
            categories tab bar so it's the first thing users see when
            they open Notifications. Renders nothing when there are no
            missed calls, so it doesn't crowd the page for users who
            never miss anything. Backend: 2e58110 (MissedCall model +
            routes), mobile companion: 73e4cde on garage-chat. */}
        <div className="pt-4">
          <MissedCallsPanel />
        </div>

        {/* Categories Tabs bar */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-3 border-b border-white/[0.04] flex-shrink-0">
          {categories.map((cat) => {
            const count = stats[cat.id];
            const isActive = activeTab === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium tracking-wide transition-all rounded-lg shrink-0 flex items-center gap-1.5",
                  isActive
                    ? "bg-neutral-800 text-white font-semibold"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.01]"
                )}
              >
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] font-bold rounded-full min-w-[14px] text-center",
                    isActive ? "text-neutral-300" : "text-neutral-500"
                  )}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List Feed Area */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-0 py-4 scrollbar-thin scrollbar-thumb-neutral-800/40">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <p className="text-xs text-neutral-500 font-normal">Loading updates...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Inbox className="h-8 w-8 text-neutral-600 mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300">All caught up</h3>
              <p className="text-xs text-neutral-500 mt-1">
                {searchQuery
                  ? "No notifications match your search query."
                  : `No new updates in this category.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Unread Section */}
              {groupedNotifications.unread.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2 mb-2 flex items-center gap-1.5">
                    <span>Unread</span>
                    <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                  <div className="border border-white/[0.04] rounded-xl divide-y divide-white/[0.04] overflow-hidden bg-neutral-900/10">
                    <AnimatePresence initial={false}>
                      {groupedNotifications.unread.map((n) => renderRow(n))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Read Section */}
              {groupedNotifications.read.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2 mb-2">
                    Earlier
                  </div>
                  <div className="border border-white/[0.04] rounded-xl divide-y divide-white/[0.04] overflow-hidden bg-neutral-900/10">
                    <AnimatePresence initial={false}>
                      {groupedNotifications.read.map((n) => renderRow(n))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {hasMore && (
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    variant="outline"
                    className="border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02] text-xs text-neutral-400 hover:text-white rounded-lg px-6 h-9 transition-colors"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
