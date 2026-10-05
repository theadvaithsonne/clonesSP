"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Play, Loader2, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";

interface EventParticipant {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

interface EventCardProps {
  eventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  creator: EventParticipant;
  invitedUsers: EventParticipant[];
  occupants: any[];
  isActive: boolean;
  isLive: boolean;
  isRepeating?: boolean;
  isJoining?: boolean;
  meId: string;
  onJoin: () => void;
  onStartMeeting?: () => void;
}

export const EventCard = memo(function EventCard({
  eventId,
  title,
  startTime,
  endTime,
  creator,
  invitedUsers,
  occupants,
  isActive,
  isLive,
  isRepeating,
  isJoining,
  meId,
  onJoin,
  onStartMeeting,
}: EventCardProps) {
  const [isStarting, setIsStarting] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const now = new Date();
  const minutesUntilStart = Math.floor(
    (startTime.getTime() - now.getTime()) / 1000 / 60
  );
  const isStartingSoon = minutesUntilStart <= 15 && minutesUntilStart > 0;

  const amInEvent = occupants.some((p) => p.id === meId);
  const isHost = creator._id === meId;

  // Event is joinable if it's live OR if it's within the scheduled time
  const isJoinable = isLive || isActive;
  const canClickToJoin = !amInEvent && isJoinable && !isJoining;

  // Host can start the meeting if it's not already live
  const canStartMeeting = isHost && !isLive && !amInEvent;

  const handleStartMeeting = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canStartMeeting || isStarting) return;

    setIsStarting(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      await api(
        `/events/${eventId}/start?orgId=${orgId}`,
        { method: "PATCH" },
        getToken()!
      );
      toast.success("Meeting started! Joining...");
      onStartMeeting?.();
      onJoin();
    } catch (error: any) {
      console.error("Failed to start meeting:", error);
      toast.error(error.message || "Failed to start meeting");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <motion.div
      className={cn(
        "relative p-4 border rounded-lg bg-[#1a1a20]/50 backdrop-blur-sm shadow-lg w-[280px] min-h-[160px] group",
        amInEvent
          ? "border-purple-400/50"
          : isJoining
          ? "border-purple-400/40"
          : isLive
          ? "border-green-500/50"
          : isActive
          ? "border-purple-500/50"
          : isStartingSoon
          ? "border-indigo-400/50"
          : "border-purple-500/30",
        canClickToJoin &&
          "cursor-pointer hover:border-purple-500/50 hover:shadow-md"
      )}
      onClick={canClickToJoin ? onJoin : undefined}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ scale: canClickToJoin ? 1.02 : 1 }}
      layout
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Calendar
            className={cn(
              "h-4 w-4",
              isLive ? "text-green-400" : isActive ? "text-purple-400" : "text-indigo-400"
            )}
          />
          {isRepeating && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full">
              <Repeat className="h-2.5 w-2.5" />
              Daily
            </span>
          )}
          {isLive && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400 font-medium uppercase tracking-wide">
                Live
              </span>
            </div>
          )}
          {!isLive && isActive && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-[10px] text-purple-400 font-medium uppercase tracking-wide">
                In Progress
              </span>
            </div>
          )}
          {!isLive && !isActive && isStartingSoon && (
            <div className="text-[10px] text-indigo-200 font-medium uppercase tracking-wide">
              Starting in {minutesUntilStart}m
            </div>
          )}
        </div>
        <h2
          className={cn(
            "text-sm font-semibold truncate",
            isLive ? "text-green-300" : isActive ? "text-purple-300" : "text-indigo-300"
          )}
        >
          {title}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">by {creator.name}</p>
      </div>

      {/* Date & Time */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
        <Clock className="h-3.5 w-3.5" />
        <span>
          {formatDate(startTime)} · {formatTime(startTime)} - {formatTime(endTime)}
        </span>
      </div>

      {/* Status */}
      <p className="text-xs text-gray-400">
        {occupants.length > 0 ? (
          <>
            {occupants.length} member{occupants.length !== 1 ? "s" : ""} inside
          </>
        ) : (
          <>{invitedUsers.length} invited</>
        )}
      </p>

      {/* Participant Avatars */}
      <div className="absolute bottom-3 right-3 flex gap-1.5">
        {invitedUsers.slice(0, 3).map((user) => {
          const initials = (user.name || user.email).slice(0, 2).toUpperCase();

          return (
            <div
              key={user._id}
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center border border-[#3a3a45]",
                isLive
                  ? "bg-gradient-to-br from-green-500 to-green-600"
                  : isActive
                  ? "bg-gradient-to-br from-purple-500 to-purple-600"
                  : "bg-gradient-to-br from-indigo-500 to-indigo-600"
              )}
              title={user.name}
            >
              <span className="text-[10px] text-white font-medium">
                {initials}
              </span>
            </div>
          );
        })}
        {invitedUsers.length > 3 && (
          <div className="h-8 w-8 rounded-full bg-gray-600 border border-[#3a3a45] flex items-center justify-center">
            <span className="text-[8px] text-gray-300 font-medium">
              +{invitedUsers.length - 3}
            </span>
          </div>
        )}
      </div>

      {/* Start Meeting Button - Shows for host when not live */}
      {canStartMeeting && (
        <button
          onClick={handleStartMeeting}
          disabled={isStarting}
          className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-md text-green-400 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isStarting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {isStarting ? "Starting..." : "Start"}
        </button>
      )}

      {/* Loading Overlay - Shows while joining (persists until Daily call connects) */}
      {isJoining && (
        <div className="absolute inset-0 bg-black/70 rounded-lg flex items-center justify-center z-20">
          <Loader2 className="h-5 w-5 text-purple-400 animate-spin mr-2" />
          <span className="text-purple-300 font-medium text-sm">Joining...</span>
        </div>
      )}

      {/* Hover Overlay - Shows "Join Event" only when joinable and not in event */}
      {canClickToJoin && (
        <div className="absolute inset-0 bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
          <span className="text-white font-medium text-sm">Join Event</span>
        </div>
      )}

      {/* Waiting to Start Overlay - Shows when not joinable and not host */}
      {!amInEvent && !isJoinable && !isHost && (
        <div className="absolute inset-0 bg-black/30 rounded-lg flex items-start p-3 justify-end">
          <span className="text-gray-400 text-xs">Waiting to Start</span>
        </div>
      )}
    </motion.div>
  );
});
