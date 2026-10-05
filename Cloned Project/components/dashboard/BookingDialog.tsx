"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { Calendar, Clock, Loader2, AlertCircle } from "lucide-react";
import { PeerState } from "@/app/(dashboard)/workspace/types";

interface BookingDialogProps {
  targetUser: PeerState | null;
  onClose: () => void;
}

export default function BookingDialog({
  targetUser,
  onClose,
}: BookingDialogProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [title, setTitle] = useState("Catch up");
  const [hasAvailability, setHasAvailability] = useState(true);

  const fetchSlots = useCallback(async () => {
    if (!targetUser) return;
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found.");
      return;
    }

    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const res = await api<{ availableSlots: string[]; hasAvailability?: boolean }>(
        `/calendar/${targetUser.id}/slots?date=${date}&orgId=${orgId}`,
        {},
        getToken()!
      );
      setAvailableSlots(res.availableSlots);
      // If backend sends hasAvailability flag, use it; otherwise infer from slots
      if (res.hasAvailability !== undefined) {
        setHasAvailability(res.hasAvailability);
      } else {
        // Fallback: assume no availability if no slots on a weekday
        const selectedDate = new Date(date);
        const dayOfWeek = selectedDate.getUTCDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        setHasAvailability(res.availableSlots.length > 0 || !isWeekday);
      }
    } catch (error) {
      toast.error("Failed to fetch available slots.");
      setAvailableSlots([]);
      setHasAvailability(false);
    } finally {
      setLoadingSlots(false);
    }
  }, [targetUser, date]);

  useEffect(() => {
    if (targetUser) {
      fetchSlots();
    }
  }, [targetUser, date, fetchSlots]);

  const handleBooking = async () => {
    if (!targetUser || !selectedSlot || !title) return;
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found.");
      return;
    }

    setBooking(true);
    try {
      await api(
        `/calendar/bookings?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            bookedWithId: targetUser.id,
            startTime: selectedSlot,
            title: title,
          }),
        },
        getToken()!
      );
      toast.success(`Meeting booked with ${targetUser.name}!`);
      onClose();
    } catch (error) {
      toast.error("Failed to create booking.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <Dialog open={!!targetUser} onOpenChange={onClose}>
      <DialogContent className="border border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur-xl max-w-md mx-auto">
        <DialogHeader className="space-y-3 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center text-brand-foreground font-semibold">
              {targetUser?.name?.charAt(0) || "?"}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">
                Book a Meeting
              </DialogTitle>
              <DialogDescription className="text-[#9fa0b8]">
                Schedule with {targetUser?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Meeting Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">
              Meeting Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#1a1a22]/50 border-[#2a2a35] text-white placeholder:text-[#9fa0b8] focus:border-brand/50 focus:ring-brand/20"
              placeholder="Enter meeting title..."
            />
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">
              Select Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-[#1a1a22]/50 border-[#2a2a35] text-white pl-10 focus:border-brand/50 focus:ring-brand/20"
              />
            </div>
          </div>

          {/* Available Slots */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#9fa0b8]" />
              <h4 className="text-sm font-medium text-white/90">
                Available Time Slots
              </h4>
            </div>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-brand" />
                <span className="ml-2 text-[#9fa0b8]">Loading slots...</span>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#2a2a35] scrollbar-track-transparent">
                {availableSlots.length > 0 ? (
                  availableSlots.map((slot) => (
                    <Button
                      key={slot}
                      variant="ghost"
                      onClick={() => setSelectedSlot(slot)}
                      className={`w-20 h-20 rounded-full text-xs font-medium transition-all duration-200 flex flex-col items-center justify-center border-0 ${
                        selectedSlot === slot
                          ? "bg-gradient-to-br from-brand to-brand-2 text-brand-foreground hover:from-brand-2 hover:to-brand shadow-lg scale-105"
                          : "bg-[#1a1a22]/40 text-white hover:bg-[#1a1a22]/60 hover:text-brand hover:scale-105"
                      }`}
                    >
                      <Clock className="h-5 w-5 mb-2" />
                      <span className="text-[11px] leading-tight font-medium">
                        {new Date(slot).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </Button>
                  ))
                ) : (
                  <div className="col-span-4 flex flex-col items-center justify-center py-6 text-center">
                    {!hasAvailability ? (
                      <>
                        <AlertCircle className="h-8 w-8 text-orange-400/70 mb-2" />
                        <p className="text-sm text-white font-medium">
                          {targetUser?.name} hasn't set their availability yet
                        </p>
                        <p className="text-xs text-[#9fa0b8]/70 mt-1">
                          They need to configure their working hours in the Calendar settings
                        </p>
                      </>
                    ) : (
                      <>
                        <Calendar className="h-8 w-8 text-[#9fa0b8]/50 mb-2" />
                        <p className="text-sm text-[#9fa0b8]">
                          No available slots on this day
                        </p>
                        <p className="text-xs text-[#9fa0b8]/70 mt-1">
                          All time slots are booked. Try selecting a different date
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Book Button */}
          <Button
            onClick={handleBooking}
            disabled={!selectedSlot || booking || !title}
            className="w-full h-11 bg-gradient-to-r from-brand to-brand-2 hover:from-brand-2 hover:to-brand text-brand-foreground font-semibold border border-brand-2/30 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#2a2a35] disabled:text-[#9fa0b8] disabled:border-[#2a2a35] transition-all duration-200"
          >
            {booking ? (
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin h-4 w-4" />
                <span>Booking...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Book Meeting</span>
              </div>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
