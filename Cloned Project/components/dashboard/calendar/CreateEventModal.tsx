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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Users,
  X,
  Loader2,
  Plus,
  Mail,
  UserPlus,
  Repeat,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TeamMember {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
}

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

export function CreateEventModal({
  open,
  onClose,
  onEventCreated,
}: CreateEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set()
  );
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [guestEmailInput, setGuestEmailInput] = useState("");
  const [isRepeating, setIsRepeating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch team members
  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      // Set default date/time to current time + 1 hour
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const startDateTime = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 hour

      setStartDate(startDateTime.toISOString().split("T")[0]);
      setStartTime(startDateTime.toTimeString().substring(0, 5));
      setEndDate(endDateTime.toISOString().split("T")[0]);
      setEndTime(endDateTime.toTimeString().substring(0, 5));
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found");
      return;
    }

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

  const addGuestEmail = () => {
    const email = guestEmailInput.trim().toLowerCase();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Check for duplicates
    if (guestEmails.includes(email)) {
      toast.error("This email is already added");
      return;
    }

    setGuestEmails((prev) => [...prev, email]);
    setGuestEmailInput("");
  };

  const removeGuestEmail = (email: string) => {
    setGuestEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleGuestEmailKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addGuestEmail();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter an event title");
      return;
    }

    if (selectedMembers.size === 0 && guestEmails.length === 0) {
      toast.error(
        "Please select at least one internal participant or add a guest email"
      );
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

    if (startDateTime < new Date()) {
      toast.error("Start time must be in the future");
      return;
    }

    setLoading(true);
    try {
      await api(
        `/events?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            invitedUserIds: Array.from(selectedMembers),
            guestEmails: guestEmails,
            isRepeating: isRepeating,
          }),
        },
        getToken()!
      );

      const message =
        guestEmails.length > 0
          ? `Event created! Invitations sent to ${
              guestEmails.length
            } external guest${guestEmails.length > 1 ? "s" : ""}.`
          : "Event created successfully!";
      toast.success(message);

      // Dispatch custom event to refresh workspace
      window.dispatchEvent(new CustomEvent("event:created"));

      onEventCreated();
      handleClose();
    } catch (error: any) {
      console.error("Failed to create event:", error);
      toast.error(error.message || "Failed to create event");
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
    setSelectedMembers(new Set());
    setGuestEmails([]);
    setGuestEmailInput("");
    setIsRepeating(false);
    setSearchQuery("");
    onClose();
  };

  // Calculate end time as 1 hour after start time
  const updateEndTimeFromStart = (newStartDate: string, newStartTime: string) => {
    if (newStartDate && newStartTime) {
      const startDateTime = new Date(`${newStartDate}T${newStartTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 hour
      setEndDate(endDateTime.toISOString().split("T")[0]);
      setEndTime(endDateTime.toTimeString().substring(0, 5));
    }
  };

  const handleStartDateChange = (newDate: string) => {
    setStartDate(newDate);
    updateEndTimeFromStart(newDate, startTime);
  };

  const handleStartTimeChange = (newTime: string) => {
    setStartTime(newTime);
    updateEndTimeFromStart(startDate, newTime);
  };

  const filteredMembers = teamMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMembersList = teamMembers.filter((m) =>
    selectedMembers.has(m._id)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-4xl max-h-[70vh] overflow-y-auto bg-[#111116] border border-[#2a2a35] text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Plus className="h-5 w-5 text-yellow-400" />
            </div>
            Create New Event
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Schedule a meeting with multiple team members
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
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="bg-[#1a1a20] border-[#2a2a35] text-white [color-scheme:dark]"
                  required
                />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
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
                  min={startDate || new Date().toISOString().split("T")[0]}
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
              <Repeat
                className={cn(
                  "h-4 w-4",
                  isRepeating ? "text-green-400" : "text-gray-400"
                )}
              />
              <div>
                <div className="text-sm font-medium text-white">
                  Repeat Daily
                </div>
                <div className="text-xs text-gray-400">
                  This event will show every day at the same time
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            {/* Participants */}
            <div className="space-y-3 w-full">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-yellow-400" />
                  Invite Participants * ({selectedMembers.size} selected)
                </Label>
              </div>

              {/* Search */}
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members..."
                className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500"
              />

              {/* Selected Members Pills */}
              {selectedMembersList.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-[#1a1a20] rounded-lg border border-[#2a2a35]">
                  <AnimatePresence>
                    {selectedMembersList.map((member) => (
                      <motion.div
                        key={member._id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge
                          variant="secondary"
                          className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 pr-1 hover:bg-yellow-500/30"
                        >
                          {member.name}
                          <button
                            type="button"
                            onClick={() => toggleMember(member._id)}
                            className="ml-1 hover:bg-yellow-500/20 rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Member List */}
              <div className="h-[150px] rounded-lg border border-[#2a2a35] bg-[#1a1a20] overflow-y-auto">
                {fetchingMembers ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    No team members found
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredMembers.map((member) => (
                      <motion.div
                        key={member._id}
                        whileHover={{ scale: 1.01 }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                          selectedMembers.has(member._id)
                            ? "bg-yellow-500/20 border border-yellow-500/30"
                            : "hover:bg-white/5"
                        )}
                        onClick={() => toggleMember(member._id)}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedMembers.has(member._id)}
                            onCheckedChange={() => toggleMember(member._id)}
                            className="border-gray-600"
                          />
                        </div>
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-medium text-sm">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {member.name}
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              {member.email}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-xs border-gray-600 text-gray-400"
                          >
                            {member.role}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* External Guests */}
            <div className="space-y-3 w-full">
              {/* <div className="flex items-center gap-2">
                <div className="h-px bg-[#2a2a35] flex-1" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  Or
                </span>
                <div className="h-px bg-[#2a2a35] flex-1" />
              </div> */}

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-400" />
                  Invite External Guests ({guestEmails.length} added)
                </Label>
              </div>

              <p className="text-xs text-gray-400">
                Add email addresses of people outside your workspace. They'll
                receive an invitation link to join the meeting.
              </p>

              {/* Guest Email Input */}
              <div className="flex gap-2">
                <Input
                  value={guestEmailInput}
                  onChange={(e) => setGuestEmailInput(e.target.value)}
                  onKeyDown={handleGuestEmailKeyDown}
                  placeholder="guest@example.com"
                  type="email"
                  className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500 flex-1"
                />
                <Button
                  type="button"
                  onClick={addGuestEmail}
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>

              {/* Guest Email Pills */}
              {guestEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-[#1a1a20] rounded-lg border border-[#2a2a35]">
                  <AnimatePresence>
                    {guestEmails.map((email) => (
                      <motion.div
                        key={email}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge
                          variant="secondary"
                          className="bg-blue-500/20 text-blue-300 border border-blue-500/30 pr-1 hover:bg-blue-500/30"
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          {email}
                          <button
                            type="button"
                            onClick={() => removeGuestEmail(email)}
                            className="ml-1 hover:bg-blue-500/20 rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
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
              disabled={
                loading ||
                (selectedMembers.size === 0 && guestEmails.length === 0)
              }
              className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
