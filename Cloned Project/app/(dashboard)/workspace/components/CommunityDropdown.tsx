"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Users, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  getOrgChannels,
  getChannelSubscribers,
  type Channel,
} from "@/lib/feed-api";

interface TeamMemberInfo {
  role: string;
  name: string;
  email: string;
  profilePicture?: string;
  guest?: boolean;
  downlineCount?: number;
}

interface CommunityDropdownProps {
  selectedCommunityId: string | null;
  onCommunityChange: (id: string | null) => void;
  teamMembers: Map<string, TeamMemberInfo>;
}

export default function CommunityDropdown({
  selectedCommunityId,
  onCommunityChange,
  teamMembers,
}: CommunityDropdownProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestCounts, setGuestCounts] = useState<Map<string, number>>(
    new Map()
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch channels list
  useEffect(() => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    setLoading(true);
    getOrgChannels(orgId)
      .then((data) => setChannels(data.channels || []))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  // Compute guest-only counts for each channel
  useEffect(() => {
    if (channels.length === 0 || teamMembers.size === 0) return;
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    const fetchCounts = async () => {
      const counts = new Map<string, number>();

      await Promise.all(
        channels.map(async (channel) => {
          try {
            const data = await getChannelSubscribers(channel._id, orgId, {
              limit: 100,
            });
            const guestCount = data.subscribers.filter((s) => {
              const member = teamMembers.get(String(s.user._id));
              return member?.guest === true;
            }).length;
            counts.set(channel._id, guestCount);
          } catch {
            counts.set(channel._id, 0);
          }
        })
      );

      setGuestCounts(counts);
    };

    fetchCounts();
  }, [channels, teamMembers]);

  // Close popover on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopover]);

  const selectedChannel = channels.find((c) => c._id === selectedCommunityId);

  // Total guest count across all team members
  const totalGuestCount = useMemo(() => {
    let count = 0;
    teamMembers.forEach((member) => {
      if (member.guest === true) count++;
    });
    return count;
  }, [teamMembers]);

  return (
    <div className="relative" ref={popoverRef}>
      <Button
        onClick={(e) => {
          e.stopPropagation();
          setShowPopover((prev) => !prev);
        }}
        variant="ghost"
        className="h-7 text-[12px] px-3 bg-[#0e0e12]/80 backdrop-blur-md border border-[#2a2a35] hover:bg-[#1a1a20] rounded-full transition-all duration-300"
      >
        <div className="flex items-center gap-2">
          <Users className="h-3 w-3 text-purple-400" />
          <span className="text-white">
            {selectedChannel ? selectedChannel.title : "Show All"}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-gray-400 transition-transform duration-200",
              showPopover && "rotate-180"
            )}
          />
        </div>
      </Button>

      <AnimatePresence>
        {showPopover && (
          <motion.div
            className="absolute top-full mt-2 right-0 bg-[#0e0e12]/95 backdrop-blur-xl border border-[#2a2a35] rounded-xl shadow-lg p-3 min-w-[280px] max-w-[400px] max-h-[400px] overflow-y-auto"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Communities
                </h3>
                <p className="text-xs text-gray-400">
                  {selectedChannel
                    ? `Viewing: ${selectedChannel.title}`
                    : "Viewing: All Communities"}
                </p>
              </div>
              <Button
                onClick={() => setShowPopover(false)}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-white/10"
              >
                <X className="h-3 w-3 text-gray-400" />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-sm text-gray-400">
                  Loading communities...
                </span>
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No communities found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Show All option */}
                <motion.div
                  className={cn(
                    "border rounded-lg p-3 transition-colors cursor-pointer",
                    !selectedCommunityId
                      ? "bg-purple-500/20 border-purple-400/50"
                      : "bg-[#1a1a20]/50 border-[#2a2a35] hover:bg-[#1a1a20]/70"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onCommunityChange(null);
                    setShowPopover(false);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="text-sm font-medium text-white">
                          Show All
                        </h4>
                        <p className="text-xs text-gray-400">
                          {totalGuestCount}{" "}
                          {totalGuestCount === 1 ? "member" : "members"}
                        </p>
                      </div>
                      {!selectedCommunityId && (
                        <div
                          className="w-2 h-2 bg-purple-400 rounded-full"
                          title="Currently viewing"
                        />
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Channel list */}
                {channels.map((channel) => {
                  const isSelected = selectedCommunityId === channel._id;
                  const count = guestCounts.get(channel._id);
                  return (
                    <motion.div
                      key={channel._id}
                      className={cn(
                        "border rounded-lg p-3 transition-colors cursor-pointer",
                        isSelected
                          ? "bg-blue-500/20 border-blue-400/50"
                          : "bg-[#1a1a20]/50 border-[#2a2a35] hover:bg-[#1a1a20]/70"
                      )}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onCommunityChange(channel._id);
                        setShowPopover(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <h4 className="text-sm font-medium text-white">
                              {channel.title}
                            </h4>
                            <p className="text-xs text-gray-400">
                              {count != null ? count : "..."}{" "}
                              {count === 1 ? "member" : "members"}
                            </p>
                          </div>
                          {isSelected && (
                            <div
                              className="w-2 h-2 bg-blue-400 rounded-full"
                              title="Currently viewing"
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
