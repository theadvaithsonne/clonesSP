"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";

interface BettyAssistantProps {
  collapsed: boolean;
  isActivityOpen: boolean;
  setIsActivityOpen: (open: boolean) => void;
  setIsAskCabinetOpen: (open: boolean) => void;
}

export function BettyAssistant({
  collapsed,
  isActivityOpen,
  setIsActivityOpen,
  setIsAskCabinetOpen,
}: BettyAssistantProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  // Load unread count
  const loadUnreadCount = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    try {
      const res = await api<{ count: number }>(
        `/user-activity/unread-count?orgId=${orgId}`,
        {},
        getToken()!
      );
      setUnreadCount(res.count || 0);
    } catch (error) {
      console.error("Failed to load unread count:", error);
    }
  };

  // Load unread count on mount
  useEffect(() => {
    loadUnreadCount();
  }, []);

  // Listen for new activity events to update unread count
  useEffect(() => {
    const handleNewActivity = () => {
      setUnreadCount((prev) => prev + 1);
    };

    window.addEventListener("activity:new", handleNewActivity);
    return () => {
      window.removeEventListener("activity:new", handleNewActivity);
    };
  }, []);

  // Socket connection for real-time updates
  useEffect(() => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    const socket = connectSocket();

    // Join organization room for activity updates
    socket.emit("activity:join", { orgId });

    // Listen for real-time activity updates
    const handleSocketActivity = () => {
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("activity:new", handleSocketActivity);

    return () => {
      socket.emit("activity:leave", { orgId });
      socket.off("activity:new", handleSocketActivity);
    };
  }, []);

  const handleClick = () => {
    setIsActivityOpen(true);
    setIsAskCabinetOpen(false);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group cursor-pointer flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors",
        isActivityOpen
          ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
          : "text-[#c7c7da] hover:bg-[#15151b]",
        collapsed ? "justify-center" : ""
      )}
      title="Activity Tracker"
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <Avatar className="h-7 w-7 border border-[#2f2f3b] bg-[#1b1b24]">
            <AvatarFallback className="text-xs text-yellow-300 font-medium bg-gradient-to-br from-yellow-500/20 to-yellow-600/30">
              <Activity className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-yellow-500 rounded-full border-2 border-[#0e0e12] flex items-center justify-center">
              <span className="text-[9px] text-black font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </span>
          )}
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-xs truncate w-32">Activity</div>
          </div>
        )}
      </div>
    </div>
  );
}
