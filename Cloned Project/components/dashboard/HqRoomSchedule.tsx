"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  Clock,
  Users,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoomBooking } from "@/app/(dashboard)/workspace/types";

interface HqRoomScheduleProps {
  open: boolean;
  onClose: () => void;
  bookings: RoomBooking[];
  onBookRoom: () => void;
  onRefresh: () => void;
}

export function HqRoomSchedule({
  open,
  onClose,
  bookings,
  onBookRoom,
  onRefresh,
}: HqRoomScheduleProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const meId = typeof window !== "undefined" ? localStorage.getItem("garage_user_id") : null;

  const handleCancel = async (bookingId: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    setCancellingId(bookingId);
    try {
      await api(
        `/room-bookings/${bookingId}/cancel?orgId=${orgId}`,
        { method: "PATCH" },
        getToken()!
      );
      toast.success("Booking cancelled");
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Group bookings by date
  const grouped = bookings.reduce<Record<string, RoomBooking[]>>((acc, b) => {
    const dateKey = new Date(b.startTime).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(b);
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-[#111116] border-l-[#2a2a35] text-white w-80 sm:w-96">
        <SheetHeader className="pb-4 border-b border-[#2a2a35]">
          <SheetTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cyan-400" />
            Room Schedule
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Button
            onClick={() => {
              onClose();
              onBookRoom();
            }}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Book a Slot
          </Button>

          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No upcoming bookings</p>
              <p className="text-xs text-gray-500 mt-1">
                Book a time slot to reserve the room
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {Object.entries(grouped).map(([dateKey, dateBookings]) => (
                <div key={dateKey}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    {formatDate(dateBookings[0].startTime)}
                  </p>
                  <div className="space-y-2">
                    {dateBookings.map((booking) => {
                      const isCreator = booking.creatorId._id === meId;
                      const now = new Date();
                      const isActive =
                        new Date(booking.startTime) <= now &&
                        new Date(booking.endTime) >= now;

                      return (
                        <div
                          key={booking._id}
                          className={cn(
                            "p-3 rounded-lg border",
                            isActive
                              ? "bg-cyan-500/5 border-cyan-500/30"
                              : "bg-[#1a1a20] border-[#2a2a35]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {booking.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Clock className="h-3 w-3 text-gray-500" />
                                <span className="text-xs text-gray-400">
                                  {formatTime(booking.startTime)} -{" "}
                                  {formatTime(booking.endTime)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Users className="h-3 w-3 text-gray-500" />
                                <span className="text-xs text-gray-400">
                                  {booking.invitedUserIds.length} participant
                                  {booking.invitedUserIds.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-1">
                                by {booking.creatorId.name}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {isActive && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full font-medium">
                                  Active
                                </span>
                              )}
                              {isCreator && (
                                <button
                                  onClick={() => handleCancel(booking._id)}
                                  disabled={cancellingId === booking._id}
                                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                                  title="Cancel booking"
                                >
                                  {cancellingId === booking._id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
