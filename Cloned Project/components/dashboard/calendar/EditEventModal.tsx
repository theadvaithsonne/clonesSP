"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Loader2,
  Pencil,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendarUtils";

interface EditEventModalProps {
  open: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onEventUpdated: () => void;
}

export function EditEventModal({
  open,
  event,
  onClose,
  onEventUpdated,
}: EditEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isRepeating, setIsRepeating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Populate form when event changes
  useEffect(() => {
    if (event && open) {
      setTitle(event.title || "");
      setDescription((event as any).description || "");

      const start = new Date(event.startTime);
      const end = new Date(event.endTime);

      setStartDate(start.toISOString().split("T")[0]);
      setStartTime(start.toTimeString().substring(0, 5));
      setEndDate(end.toISOString().split("T")[0]);
      setEndTime(end.toTimeString().substring(0, 5));
      setIsRepeating(event.isRepeating || false);
    }
  }, [event, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!event) return;

    if (!title.trim()) {
      toast.error("Please enter an event title");
      return;
    }

    if (!startDate || !startTime || !endDate || !endTime) {
      toast.error("Please fill in all date and time fields");
      return;
    }

    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found");
      return;
    }

    // Combine date and time
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:00`);

    // Validate times
    if (endDateTime <= startDateTime) {
      toast.error("End time must be after start time");
      return;
    }

    setLoading(true);
    try {
      await api(
        `/events/${event._id}?orgId=${orgId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            isRepeating: isRepeating,
          }),
        },
        getToken()!
      );

      toast.success("Event updated successfully!");
      onEventUpdated();
      handleClose();
    } catch (error: any) {
      console.error("Failed to update event:", error);
      toast.error(error.message || "Failed to update event");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setIsRepeating(false);
    onClose();
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-2xl max-h-[70vh] overflow-y-auto bg-[#111116] border border-[#2a2a35] text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Pencil className="h-5 w-5 text-yellow-400" />
            </div>
            Edit Event
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Update event details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium text-white">
              Event Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team Standup, Project Review, etc."
              className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500"
              maxLength={200}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-sm font-medium text-white"
            >
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about the event..."
              className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500 resize-none"
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-400" />
                Start Date & Time *
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#1a1a20] border-[#2a2a35] text-white [color-scheme:dark]"
                  required
                />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-[#1a1a20] border-[#2a2a35] text-white [color-scheme:dark]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-400" />
                End Date & Time *
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[#1a1a20] border-[#2a2a35] text-white [color-scheme:dark]"
                  required
                />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-[#1a1a20] border-[#2a2a35] text-white [color-scheme:dark]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Repeat Event Toggle */}
          <div
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              isRepeating
                ? "bg-green-500/20 border-green-500/30"
                : "bg-[#1a1a20] border-[#2a2a35] hover:bg-white/5"
            )}
            onClick={() => setIsRepeating(!isRepeating)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isRepeating}
                onCheckedChange={(checked) => setIsRepeating(checked === true)}
                className="border-gray-600"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Repeat className={cn("h-4 w-4", isRepeating ? "text-green-400" : "text-gray-400")} />
              <div>
                <div className="text-sm font-medium text-white">Repeat Daily</div>
                <div className="text-xs text-gray-400">
                  This event will show every day at the same time
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="text-gray-400 hover:text-white hover:bg-white/10"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
