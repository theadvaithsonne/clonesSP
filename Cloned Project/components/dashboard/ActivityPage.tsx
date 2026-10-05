"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Users,
  FileText,
  Clock,
  RefreshCw,
  Filter,
  Search,
  Wifi,
  WifiOff,
  LogIn,
  LogOut,
  ClipboardCheck,
  Calendar,
  UserCheck,
  Bot,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type ActivityType =
  | "login"
  | "logout"
  | "online"
  | "offline"
  | "task_created"
  | "task_completed"
  | "task_assigned"
  | "booking_created"
  | "booking_cancelled"
  | "message_sent"
  | "file_uploaded"
  | "profile_updated"
  | "floor_assigned"
  | "group_joined"
  | "group_left"
  | "system";

type UserActivity = {
  _id: string;
  userId: {
    _id: string;
    name?: string;
    email: string;
  };
  orgId: string;
  type: ActivityType;
  title: string;
  description: string;
  metadata: any;
  category:
    | "auth"
    | "task"
    | "booking"
    | "communication"
    | "file"
    | "profile"
    | "system"
    | "presence";
  priority: "low" | "medium" | "high";
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
};

const getIconForType = (type: ActivityType) => {
  switch (type) {
    case "login":
      return <LogIn className="h-4 w-4 text-green-400" />;
    case "logout":
      return <LogOut className="h-4 w-4 text-red-400" />;
    case "online":
      return <Wifi className="h-4 w-4 text-green-400" />;
    case "offline":
      return <WifiOff className="h-4 w-4 text-gray-400" />;
    case "task_created":
    case "task_completed":
    case "task_assigned":
      return <ClipboardCheck className="h-4 w-4 text-blue-400" />;
    case "booking_created":
    case "booking_cancelled":
      return <Calendar className="h-4 w-4 text-purple-400" />;
    case "message_sent":
      return <UserCheck className="h-4 w-4 text-yellow-400" />;
    case "file_uploaded":
      return <FileText className="h-4 w-4 text-orange-400" />;
    case "profile_updated":
      return <Users className="h-4 w-4 text-cyan-400" />;
    case "floor_assigned":
      return <Activity className="h-4 w-4 text-pink-400" />;
    case "group_joined":
    case "group_left":
      return <Users className="h-4 w-4 text-indigo-400" />;
    case "system":
    default:
      return <Bot className="h-4 w-4 text-gray-400" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case "auth":
      return "border-l-green-500";
    case "task":
      return "border-l-blue-500";
    case "booking":
      return "border-l-purple-500";
    case "communication":
      return "border-l-yellow-500";
    case "file":
      return "border-l-orange-500";
    case "profile":
      return "border-l-cyan-500";
    case "presence":
      return "border-l-emerald-500";
    case "system":
      return "border-l-gray-500";
    default:
      return "border-l-gray-500";
  }
};

export default function ActivityPage({ onClose }: { onClose?: () => void }) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const activitiesEndRef = useRef<HTMLDivElement>(null);

  // Load activities from database
  const loadActivities = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    try {
      setLoading(true);
      const res = await api<{ activities: UserActivity[] }>(
        `/user-activity/org?orgId=${orgId}`,
        {},
        getToken()!
      );
      console.log("Loaded activities:", res.activities); // Debug log
      setActivities(res.activities || []);
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load unread count
  const loadUnreadCount = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    try {
      const res = await api<{ count: number }>(
        `/user-activity/org/unread-count?orgId=${orgId}`,
        {},
        getToken()!
      );
      setUnreadCount(res.count || 0);
    } catch (error) {
      console.error("Failed to load unread count:", error);
    }
  };

  // Mark activities as read
  const markAsRead = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    try {
      await api(
        `/user-activity/read`,
        { method: "POST", body: JSON.stringify({ orgId }) },
        getToken()!
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark activities as read:", error);
    }
  };

  // Load activities on mount
  useEffect(() => {
    loadActivities();
    loadUnreadCount();
  }, []);

  // Mark as read when opened
  useEffect(() => {
    if (unreadCount > 0) {
      markAsRead();
    }
  }, [unreadCount]);

  // Socket connection for real-time updates
  useEffect(() => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    const socket = connectSocket();

    // Join organization room for activity updates
    socket.emit("activity:join", { orgId });

    // Listen for real-time activity updates
    const handleSocketActivity = (data: { activity: UserActivity }) => {
      console.log("New activity received:", data.activity); // Debug log
      setActivities((prev) => [data.activity, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("activity:new", handleSocketActivity);

    return () => {
      socket.emit("activity:leave", { orgId });
      socket.off("activity:new", handleSocketActivity);
    };
  }, []);

  // Auto-scroll to the latest activity
  useEffect(() => {
    setTimeout(
      () => activitiesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );
  }, [activities]);

  // Filter activities based on search and filters
  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      searchQuery === "" ||
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (activity.userId.name &&
        activity.userId.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase())) ||
      activity.userId.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === "all" || activity.category === filterCategory;
    const matchesPriority =
      filterPriority === "all" || activity.priority === filterPriority;

    return matchesSearch && matchesCategory && matchesPriority;
  });

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "auth", label: "Authentication" },
    { value: "presence", label: "Presence" },
    { value: "task", label: "Tasks" },
    { value: "booking", label: "Bookings" },
    { value: "communication", label: "Communication" },
    { value: "file", label: "Files" },
    { value: "profile", label: "Profile" },
    { value: "system", label: "System" },
  ];

  const priorities = [
    { value: "all", label: "All Priorities" },
    { value: "high", label: "High Priority" },
    { value: "medium", label: "Medium Priority" },
    { value: "low", label: "Low Priority" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0e0e12]">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a35] bg-[#111116]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-purple-400" />
            <h1 className="text-md font-semibold text-white">Team Activity</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={loadActivities}
              disabled={loading}
              variant="outline"
              size="sm"
              className="bg-transparent !text-sm border-[#2a2a35] text-gray-400 hover:text-white hover:bg-[#2a2a35]"
            >
              <RefreshCw
                className={cn("h-3 w-3 mr-1", loading && "animate-spin")}
              />
              Refresh
            </Button>
            {onClose && (
              <Button
                onClick={onClose}
                variant="outline"
                size="sm"
                className="bg-transparent border-[#2a2a35] text-gray-400 hover:text-white hover:bg-[#2a2a35]"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 !text-sm h-10 bg-[#0e0e12] border-[#2a2a35] text-white placeholder-gray-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-[#0e0e12] border border-[#2a2a35] rounded-md text-white text-sm"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-[#0e0e12] border border-[#2a2a35] rounded-md text-white text-sm"
          >
            {priorities.map((pri) => (
              <option key={pri.value} value={pri.value}>
                {pri.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Activities List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-400">Loading activities...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Activity className="h-8 w-8 mb-2" />
            <p>No activities found</p>
            {searchQuery ||
            filterCategory !== "all" ||
            filterPriority !== "all" ? (
              <p className="text-sm">Try adjusting your filters</p>
            ) : (
              <p className="text-sm">
                Activities will appear here as they happen
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity) => (
              <motion.div
                key={activity._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "p-4 rounded-lg border-l-4 bg-[#111116] hover:bg-[#1a1a1f] transition-colors",
                  getCategoryColor(activity.category),
                  !activity.isRead && "ring-1 ring-purple-400/30"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 flex-shrink-0 mt-1 rounded-full bg-[#2a2a35] flex items-center justify-center">
                    {getIconForType(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-medium text-white truncate">
                        {activity.title}
                      </h3>
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          activity.priority === "high"
                            ? "bg-red-500/20 text-red-400"
                            : activity.priority === "medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-gray-500/20 text-gray-400"
                        )}
                      >
                        {activity.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed mb-3">
                      {activity.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(activity.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {activity.userId && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-[10px] font-medium">
                            {(
                              activity.userId.name ||
                              activity.userId.email ||
                              "U"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <span>
                            {activity.userId.name ||
                              activity.userId.email ||
                              "Unknown User"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            <div ref={activitiesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
