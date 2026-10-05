"use client";

import { memo, useMemo } from "react";
import { PeerState, RoomBooking } from "../types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Lock, Users, Eye } from "lucide-react";

interface HqMeetingRoomCardProps {
  name?: string;
  currentBooking: RoomBooking | null;
  upcomingBookings: RoomBooking[];
  /** All bookings for today (for the schedule bar) */
  allDayBookings?: RoomBooking[];
  occupants: PeerState[];
  meId: string;
  isJoining?: boolean;
  /** Max participant capacity (defaults to 30) */
  maxParticipants?: number;
  onJoin: () => void;
  onBookRoom: () => void;
  onViewSchedule: () => void;
}

/** Convert a Date to fractional position within a day window (9 AM – 6 PM = 0 to 1) */
function timeToFraction(date: Date, windowStart = 9, windowEnd = 18): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, Math.min(1, (hours - windowStart) / (windowEnd - windowStart)));
}

export const HqMeetingRoomCard = memo(function HqMeetingRoomCard({
  name = "Conference Room",
  currentBooking,
  upcomingBookings,
  allDayBookings = [],
  occupants,
  meId,
  isJoining,
  maxParticipants = 30,
  onJoin,
  onBookRoom,
  onViewSchedule,
}: HqMeetingRoomCardProps) {
  const isInUse = !!currentBooking;
  const isAvailable = !isInUse;

  const amInvited = useMemo(() => {
    if (!currentBooking) return false;
    return (
      currentBooking.creatorId._id === meId ||
      currentBooking.invitedUserIds.some((u) => u._id === meId)
    );
  }, [currentBooking, meId]);

  /** Format time to e.g. "4:30 PM" */
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  /** Today's bookings — used for the schedule bar */
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const todayBookings = useMemo(() => {
    return allDayBookings.filter((b) => {
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      return start <= todayEnd && end >= todayStart;
    });
  }, [allDayBookings, todayStart, todayEnd]);

  /** Is the room fully booked today (no gaps in 9 AM–6 PM window)? */
  const isFullyBookedToday = useMemo(() => {
    if (todayBookings.length === 0) return false;
    // Simplified: if there are bookings covering the whole window
    const totalMinutes = todayBookings.reduce((acc, b) => {
      const s = new Date(b.startTime);
      const e = new Date(b.endTime);
      return acc + (e.getTime() - s.getTime()) / 60000;
    }, 0);
    return totalMinutes >= 540; // 9 hours = fully booked
  }, [todayBookings]);

  /** Find the next free window today after now */
  const nextFreeWindow = useMemo(() => {
    const now = new Date();
    const windowEndHour = 18;
    const windowEnd = new Date();
    windowEnd.setHours(windowEndHour, 0, 0, 0);

    if (now >= windowEnd) return null;

    const sortedBookings = [...todayBookings].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    let freeStart = now;
    for (const b of sortedBookings) {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      if (bEnd <= freeStart) continue;
      if (bStart > freeStart) {
        // There's a gap here
        return { start: freeStart, end: bStart };
      }
      freeStart = bEnd;
    }

    if (freeStart < windowEnd) {
      return { start: freeStart, end: windowEnd };
    }
    return null;
  }, [todayBookings]);

  /** Current time fractional position (for the needle) */
  const nowFraction = useMemo(() => {
    return timeToFraction(new Date());
  }, []);

  const participantCount = occupants.length;
  const isPrivate = !!(currentBooking); // treat booked rooms as private for display
  const isParticipantListVisible = true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="bg-[#161618] border border-[#2a2a2e] rounded-2xl p-5 flex flex-col gap-4 w-full"
    >
      {/* Header row: room name + status badge */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-white truncate">{name}</h3>
        {isInUse ? (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2a1a1a] border border-red-500/60 text-red-400 text-[11px] font-semibold whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            IN USE
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0d2117] border border-emerald-500/60 text-emerald-400 text-[11px] font-semibold whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            AVAILABLE
          </span>
        )}
      </div>

      {/* Current booking info */}
      {isInUse && currentBooking && (
        <div className="space-y-0.5">
          <p className="text-[13px] text-white/80 font-medium">
            Current: {currentBooking.title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-[#888]">
              Hosted by {currentBooking.creatorId.name}
            </span>
            <span className="text-red-400 text-[11px] font-medium">
              Ends at {formatTime(currentBooking.endTime)}
            </span>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-white">
            {participantCount}/{maxParticipants}
          </span>
          <span className="text-[10px] text-[#666] mt-0.5">Participants</span>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-white">
            <Lock className="w-3.5 h-3.5" />
            <span className="text-[13px] font-semibold">Private</span>
          </div>
          <span className="text-[10px] text-[#666] mt-0.5">Visibility</span>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-white">
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[13px] font-semibold">Visible</span>
          </div>
          <span className="text-[10px] text-[#666] mt-0.5">Participant List</span>
        </div>
      </div>

      {/* Today's schedule bar */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-[#666] tracking-widest uppercase">
          Today&apos;s Schedule
        </p>
        <div className="relative h-7 bg-[#0e0e10] rounded-lg overflow-hidden border border-[#222]">
          {/* Booking blocks */}
          {todayBookings.map((b) => {
            const left = timeToFraction(new Date(b.startTime)) * 100;
            const right = timeToFraction(new Date(b.endTime)) * 100;
            const width = Math.max(right - left, 2);
            return (
              <div
                key={b._id}
                className="absolute top-0 h-full bg-red-500/80 rounded-sm"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })}
          {/* Now needle */}
          <div
            className="absolute top-0 h-full w-[2px] bg-white/60 z-10"
            style={{ left: `${nowFraction * 100}%` }}
          />
        </div>
        {/* Footer text */}
        {isFullyBookedToday ? (
          <p className="text-[12px] text-red-400 font-medium">Fully booked today</p>
        ) : nextFreeWindow ? (
          <p className="text-[12px] text-[#888]">
            Next free:{" "}
            {nextFreeWindow.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
            {" – "}
            {nextFreeWindow.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </p>
        ) : (
          <p className="text-[12px] text-emerald-400">Available all day</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-auto pt-1">
        {isAvailable ? (
          // Room is free — primary action is booking
          <button
            onClick={onBookRoom}
            className="flex-1 h-9 rounded-xl bg-brand hover:bg-brand-2 text-brand-foreground text-[13px] font-bold transition-colors cursor-pointer"
          >
            Book Now
          </button>
        ) : amInvited ? (
          // Room is in use AND current user is invited/host
          <button
            onClick={onJoin}
            disabled={isJoining}
            className="flex-1 h-9 rounded-xl bg-brand hover:bg-brand-2 text-brand-foreground text-[13px] font-bold transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isJoining ? "Joining…" : "Join Now"}
          </button>
        ) : (
          // Room is in use but user is NOT invited — no primary join action
          <button
            disabled
            className="flex-1 h-9 rounded-xl bg-[#1a1a1e] border border-[#2a2a2e] text-[#555] text-[13px] font-medium cursor-not-allowed"
          >
            In Use
          </button>
        )}
        <button
          onClick={onViewSchedule}
          className="flex-1 h-9 rounded-xl border border-[#3a3a3e] hover:border-brand/50 text-white hover:text-brand text-[13px] font-medium transition-colors cursor-pointer bg-transparent"
        >
          Check Availability
        </button>
      </div>
    </motion.div>
  );
});
