"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import {
  Users,
  X,
  Loader2,
  Mail,
  UserPlus,
  UserMinus,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendarUtils";

interface TeamMember {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
}

interface GuestInvitation {
  email: string;
  token?: string;
  status: 'pending' | 'joined';
}

interface EditMembersModalProps {
  open: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onMembersUpdated: () => void;
}

export function EditMembersModal({
  open,
  event,
  onClose,
  onMembersUpdated,
}: EditMembersModalProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [guestEmailInput, setGuestEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Original state to track changes
  const [originalMemberIds, setOriginalMemberIds] = useState<Set<string>>(new Set());
  const [originalGuestEmails, setOriginalGuestEmails] = useState<string[]>([]);

  // Fetch team members and initialize state when modal opens
  useEffect(() => {
    if (open && event) {
      fetchTeamMembers();

      // Initialize with current event members
      const currentMemberIds = ((event as any).invitedUserIds || []).map((u: any) => u._id || u);
      const currentGuests = ((event as any).guestInvitations || []).map((g: GuestInvitation) => g.email.toLowerCase());

      setSelectedMemberIds(new Set(currentMemberIds));
      setOriginalMemberIds(new Set(currentMemberIds));
      setGuestEmails(currentGuests);
      setOriginalGuestEmails(currentGuests);
    }
  }, [open, event]);

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
    setSelectedMemberIds((prev) => {
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

  const handleGuestEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addGuestEmail();
    }
  };

  // Calculate changes
  const changes = useMemo(() => {
    const addUserIds = Array.from(selectedMemberIds).filter(id => !originalMemberIds.has(id));
    const removeUserIds = Array.from(originalMemberIds).filter(id => !selectedMemberIds.has(id));
    const addGuestEmails = guestEmails.filter(e => !originalGuestEmails.includes(e));
    const removeGuestEmails = originalGuestEmails.filter(e => !guestEmails.includes(e));

    return {
      addUserIds,
      removeUserIds,
      addGuestEmails,
      removeGuestEmails,
      hasChanges: addUserIds.length > 0 || removeUserIds.length > 0 || addGuestEmails.length > 0 || removeGuestEmails.length > 0
    };
  }, [selectedMemberIds, originalMemberIds, guestEmails, originalGuestEmails]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!event) return;

    if (!changes.hasChanges) {
      toast.info("No changes to save");
      return;
    }

    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found");
      return;
    }

    setLoading(true);
    try {
      await api(
        `/events/${event._id}/members?orgId=${orgId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            addUserIds: changes.addUserIds,
            removeUserIds: changes.removeUserIds,
            addGuestEmails: changes.addGuestEmails,
            removeGuestEmails: changes.removeGuestEmails,
          }),
        },
        getToken()!
      );

      const messages: string[] = [];
      if (changes.addUserIds.length > 0) messages.push(`${changes.addUserIds.length} member(s) added`);
      if (changes.removeUserIds.length > 0) messages.push(`${changes.removeUserIds.length} member(s) removed`);
      if (changes.addGuestEmails.length > 0) messages.push(`${changes.addGuestEmails.length} guest(s) invited`);
      if (changes.removeGuestEmails.length > 0) messages.push(`${changes.removeGuestEmails.length} guest(s) removed`);

      toast.success(`Members updated: ${messages.join(", ")}`);
      onMembersUpdated();
      handleClose();
    } catch (error: any) {
      console.error("Failed to update members:", error);
      toast.error(error.message || "Failed to update members");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setGuestEmailInput("");
    onClose();
  };

  const filteredMembers = teamMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected members details
  const selectedMembersList = teamMembers.filter((m) => selectedMemberIds.has(m._id));

  // Categorize members for display
  const newMembers = selectedMembersList.filter(m => !originalMemberIds.has(m._id));
  const removedMembers = teamMembers.filter(m => originalMemberIds.has(m._id) && !selectedMemberIds.has(m._id));
  const newGuests = guestEmails.filter(e => !originalGuestEmails.includes(e));
  const removedGuests = originalGuestEmails.filter(e => !guestEmails.includes(e));

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-3xl bg-[#111116] border border-[#2a2a35] text-white !top-4 !bottom-4 !translate-y-0 !max-h-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            Edit Members
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Add or remove participants from "{event.title}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Changes Summary */}
          {changes.hasChanges && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="text-sm text-yellow-300 font-medium mb-2">Pending Changes:</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {newMembers.length > 0 && (
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                    +{newMembers.length} team member(s)
                  </Badge>
                )}
                {removedMembers.length > 0 && (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                    -{removedMembers.length} team member(s)
                  </Badge>
                )}
                {newGuests.length > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                    +{newGuests.length} guest(s)
                  </Badge>
                )}
                {removedGuests.length > 0 && (
                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                    -{removedGuests.length} guest(s) (will receive cancellation email)
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Team Members Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                Team Members ({selectedMemberIds.size})
              </Label>

              {/* Search */}
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members..."
                className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500"
              />

              {/* Current Members Pills */}
              {selectedMembersList.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-[#1a1a20] rounded-lg border border-[#2a2a35] max-h-[100px] overflow-y-auto">
                  <AnimatePresence>
                    {selectedMembersList.map((member) => {
                      const isNew = !originalMemberIds.has(member._id);
                      return (
                        <motion.div
                          key={member._id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <Badge
                            variant="secondary"
                            className={cn(
                              "pr-1",
                              isNew
                                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            )}
                          >
                            {member.name}
                            {isNew && <span className="ml-1 text-[10px]">(new)</span>}
                            <button
                              type="button"
                              onClick={() => toggleMember(member._id)}
                              className="ml-1 hover:bg-white/10 rounded p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {/* Member List */}
              <div className="h-[250px] rounded-lg border border-[#2a2a35] bg-[#1a1a20] overflow-y-auto">
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
                    {filteredMembers.map((member) => {
                      const isSelected = selectedMemberIds.has(member._id);
                      const isNew = isSelected && !originalMemberIds.has(member._id);
                      const isRemoved = !isSelected && originalMemberIds.has(member._id);

                      return (
                        <motion.div
                          key={member._id}
                          whileHover={{ scale: 1.01 }}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                            isSelected
                              ? isNew
                                ? "bg-green-500/20 border border-green-500/30"
                                : "bg-purple-500/20 border border-purple-500/30"
                              : isRemoved
                              ? "bg-red-500/10 border border-red-500/20"
                              : "hover:bg-white/5"
                          )}
                          onClick={() => toggleMember(member._id)}
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
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
                          {isSelected ? (
                            <UserMinus className="h-4 w-4 text-gray-400" />
                          ) : (
                            <UserPlus className="h-4 w-4 text-gray-400" />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* External Guests Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-400" />
                External Guests ({guestEmails.length})
              </Label>

              <p className="text-xs text-gray-400">
                New guests will receive an invitation email. Removed guests will receive a cancellation email.
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
                <div className="flex flex-wrap gap-2 p-3 bg-[#1a1a20] rounded-lg border border-[#2a2a35] max-h-[150px] overflow-y-auto">
                  <AnimatePresence>
                    {guestEmails.map((email) => {
                      const isNew = !originalGuestEmails.includes(email);
                      return (
                        <motion.div
                          key={email}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <Badge
                            variant="secondary"
                            className={cn(
                              "pr-1",
                              isNew
                                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            )}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            {email}
                            {isNew && <span className="ml-1 text-[10px]">(new)</span>}
                            <button
                              type="button"
                              onClick={() => removeGuestEmail(email)}
                              className="ml-1 hover:bg-white/10 rounded p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {/* Removed Guests Warning */}
              {removedGuests.length > 0 && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="text-xs text-orange-300 font-medium mb-2">
                    Guests to be removed (will receive cancellation email):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {removedGuests.map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="bg-red-500/20 text-red-300 border border-red-500/30 pr-1"
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        {email}
                        <button
                          type="button"
                          onClick={() => setGuestEmails(prev => [...prev, email])}
                          className="ml-1 hover:bg-white/10 rounded p-0.5"
                          title="Undo removal"
                        >
                          <UserPlus className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {guestEmails.length === 0 && removedGuests.length === 0 && (
                <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm border border-[#2a2a35] rounded-lg bg-[#1a1a20]">
                  No external guests
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
              disabled={loading || !changes.hasChanges}
              className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
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
