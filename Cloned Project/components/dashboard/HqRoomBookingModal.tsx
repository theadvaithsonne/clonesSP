"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import {
  Clock,
  Users,
  X,
  Loader2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
}

interface ExistingBooking {
  _id: string;
  title: string;
  startTime: string;
  endTime: string;
  creatorId: { _id: string; name: string };
}

interface HqRoomBookingModalProps {
  open: boolean;
  onClose: () => void;
  onBookingCreated: () => void;
}

export function HqRoomBookingModal({
  open,
  onClose,
  onBookingCreated,
}: HqRoomBookingModalProps) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      // Default: today, next hour rounded, 1 hour duration
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const start = new Date(now.getTime() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      setStartDate(start.toISOString().split("T")[0]);
      setStartTime(start.toTimeString().substring(0, 5));
      setEndTime(end.toTimeString().substring(0, 5));
      setTitle("");
      setSelectedMembers(new Set());
      setSearchQuery("");
    }
  }, [open]);

  // Fetch existing bookings when date changes
  useEffect(() => {
    if (open && startDate) {
      fetchExistingBookings();
    }
  }, [open, startDate]);

  const fetchTeamMembers = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    setFetchingMembers(true);
    try {
      const response = await api<{ members: TeamMember[] }>(
        `/team/list?orgId=${orgId}`,
        {},
        getToken()!
      );
      setTeamMembers(response.members || []);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setFetchingMembers(false);
    }
  };

  const fetchExistingBookings = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId || !startDate) return;

    try {
      const dayStart = new Date(startDate);
      const dayEnd = new Date(startDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const response = await api<{ bookings: ExistingBooking[] }>(
        `/room-bookings?orgId=${orgId}&startDate=${dayStart.toISOString()}&endDate=${dayEnd.toISOString()}`,
        {},
        getToken()!
      );
      setExistingBookings(response.bookings || []);
    } catch (error) {
      console.error("Failed to fetch existing bookings:", error);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  // Detect conflict with existing bookings
  const conflict = useMemo(() => {
    if (!startDate || !startTime || !endTime) return null;
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);
    if (end <= start) return null;

    return existingBookings.find((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return start < bEnd && end > bStart;
    });
  }, [startDate, startTime, endTime, existingBookings]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return teamMembers;
    const q = searchQuery.toLowerCase();
    return teamMembers.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
    );
  }, [teamMembers, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a booking title");
      return;
    }
    if (selectedMembers.size === 0) {
      toast.error("Please select at least one participant");
      return;
    }
    if (!startDate || !startTime || !endTime) {
      toast.error("Please fill in all date and time fields");
      return;
    }

    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found");
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${startDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      toast.error("End time must be after start time");
      return;
    }
    if (startDateTime < new Date()) {
      toast.error("Start time must be in the future");
      return;
    }

    setLoading(true);
    try {
      await api(
        `/room-bookings?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            invitedUserIds: Array.from(selectedMembers),
          }),
        },
        getToken()!
      );

      toast.success("Room booked successfully!");
      window.dispatchEvent(new Event("room-booking:created"));
      onBookingCreated();
      onClose();
    } catch (error: any) {
      if (error?.status === 409) {
        toast.error("Time slot conflicts with an existing booking");
      } else {
        toast.error(error?.message || "Failed to book room");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px] bg-[#111116] border-[#2a2a35] text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Book Conference Room</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-300">
              Meeting Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sprint Planning, Team Standup"
              className="bg-[#1a1a20] border-[#2a2a35] text-white"
              maxLength={200}
            />
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Date & Time
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="bg-[#1a1a20] border-[#2a2a35] text-white"
              />
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-[#1a1a20] border-[#2a2a35] text-white"
              />
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-[#1a1a20] border-[#2a2a35] text-white"
              />
            </div>
            <p className="text-xs text-gray-500">Date · Start time · End time</p>
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-400 font-medium">Time slot conflict</p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  &quot;{conflict.title}&quot; is booked from{" "}
                  {formatTime(conflict.startTime)} to {formatTime(conflict.endTime)}
                </p>
              </div>
            </div>
          )}

          {/* Existing bookings timeline for selected date */}
          {existingBookings.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Existing bookings on this date:</p>
              <div className="space-y-1">
                {existingBookings.map((b) => (
                  <div
                    key={b._id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-[#1a1a20] rounded text-xs"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                    <span className="text-gray-300 truncate">{b.title}</span>
                    <span className="text-gray-500 ml-auto flex-shrink-0">
                      {formatTime(b.startTime)} - {formatTime(b.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team members */}
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Participants ({selectedMembers.size} selected)
            </Label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="bg-[#1a1a20] border-[#2a2a35] text-white"
            />
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-[#2a2a35] p-2">
              {fetchingMembers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">
                  No members found
                </p>
              ) : (
                filteredMembers.map((member) => {
                  const memberId = member._id || member.id;
                  const isSelected = selectedMembers.has(memberId);
                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => toggleMember(memberId)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left",
                        isSelected
                          ? "bg-cyan-500/10 border border-cyan-500/30"
                          : "hover:bg-[#2a2a35] border border-transparent"
                      )}
                    >
                      {member.profilePicture ? (
                        <img
                          src={member.profilePicture}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-medium text-white">
                          {(member.name || member.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{member.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {member.email}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !!conflict}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                "Book Room"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
