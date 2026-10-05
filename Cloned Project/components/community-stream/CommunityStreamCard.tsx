"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Video, Users } from "lucide-react";
import { CommunityStreamParticipant } from "./types";

interface CommunityStreamCardProps {
  channelTitle: string;
  occupants: CommunityStreamParticipant[];
  meId: string;
  isInStream: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

export const CommunityStreamCard = memo(({
  channelTitle,
  occupants,
  meId,
  isInStream,
  onJoin,
  onLeave,
}: CommunityStreamCardProps) => {
  const amInRoom = isInStream || occupants.some((p) => p.id === meId);

  return (
    <motion.div
      className={cn(
        "relative p-4 border rounded-lg bg-gradient-to-br from-purple-900/20 to-purple-950/40 backdrop-blur-sm shadow-lg w-[280px] min-h-[160px] group",
        amInRoom ? "border-purple-400/50" : "border-purple-500/30",
        !amInRoom && "cursor-pointer hover:border-purple-500/50 hover:shadow-md"
      )}
      onClick={!amInRoom ? onJoin : undefined}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ scale: !amInRoom ? 1.02 : 1 }}
      layout
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Video className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-purple-300 truncate">
            {channelTitle}
          </h3>
          <p className="text-xs text-gray-400">Community Stream</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Users className="w-3.5 h-3.5" />
        <span>{occupants.length} participant{occupants.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Participant avatars */}
      <div className="absolute bottom-3 right-3 flex gap-1.5">
        {occupants.slice(0, 3).map((participant) => {
          const initials = (participant.name || participant.email)
            ?.slice(0, 2)
            .toUpperCase() || "?";
          const isLocal = participant.id === meId;

          return (
            <div
              key={participant.id}
              className={cn(
                "h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-medium overflow-hidden",
                isLocal
                  ? "border-purple-400 bg-purple-500"
                  : "border-gray-600 bg-gray-700"
              )}
            >
              {participant.profilePicture ? (
                <img
                  src={participant.profilePicture}
                  alt={participant.name || participant.email}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-[10px]">{initials}</span>
              )}
            </div>
          );
        })}
        {occupants.length > 3 && (
          <div className="h-8 w-8 rounded-full bg-gray-600 border border-gray-500 flex items-center justify-center">
            <span className="text-[8px] text-gray-300 font-medium">
              +{occupants.length - 3}
            </span>
          </div>
        )}
      </div>

      {!amInRoom && (
        <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
          <span className="text-white font-medium text-sm">Join Stream</span>
        </div>
      )}
    </motion.div>
  );
});

CommunityStreamCard.displayName = "CommunityStreamCard";
