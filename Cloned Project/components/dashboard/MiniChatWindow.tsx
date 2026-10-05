"use client";

import React from "react";
import { X, Star, ArrowUpRight, Minus, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import DMPage from "@/components/dashboard/DMPage";
import GroupPage from "@/components/dashboard/GroupChatPage";
import GlobalDMPage from "@/components/dashboard/GlobalDMPage";
import { useChat } from "@/lib/chat-context";

type ChatKind = "dm" | "group" | "global-dm";

interface MiniChatWindowProps {
  kind: ChatKind;
  /** For DM/global-dm: the other user's ID. For group: group ID. */
  targetId: string;
  /** Display name shown in the header */
  targetName: string;
  /** Avatar URL (optional) */
  targetAvatar?: string;
  /** Called when the × close button is pressed */
  onClose: () => void;
  /** Called when the ↗ expand button is pressed — open full chat */
  onExpand: () => void;
  isFavourite?: boolean;
  onToggleFavourite?: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

export default function MiniChatWindow({
  kind,
  targetId,
  targetName,
  targetAvatar,
  onClose,
  onExpand,
  isFavourite = false,
  onToggleFavourite,
  minimized = false,
  onToggleMinimize,
}: MiniChatWindowProps) {
  const { dmUnread, groupUnread, groupMentioned, globalDmUnread } = useChat();
  // "typing…" / "Priya is typing…", reported by the chat below.
  const [typingLabel, setTypingLabel] = React.useState<string | null>(null);

  let unreadCount = 0;
  if (kind === "dm") {
    unreadCount = dmUnread[targetId] || 0;
  } else if (kind === "group") {
    unreadCount = groupUnread[targetId] || 0;
  } else if (kind === "global-dm") {
    unreadCount = globalDmUnread[targetId] || 0;
  }
  const hasUnread = unreadCount > 0;

  const initials = targetName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col shadow-2xl overflow-hidden border border-[#2E2E2E] bg-[#0e0e12] pointer-events-auto"
      style={{
        width: minimized ? 260 : "min(480px, calc(100vw - 32px))",
        height: minimized ? 52 : "min(640px, calc(100vh - 80px))",
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div 
        onClick={onToggleMinimize}
        className="flex items-center gap-3 px-4 py-2 border-b border-[#2E2E2E] bg-[#111116] flex-shrink-0 cursor-pointer select-none"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {kind !== "group" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="cursor-pointer hover:opacity-85 transition-opacity">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={targetAvatar} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-[#1b1b24] border border-[#2f2f3b] text-white">
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-[#2c2c3a] focus:bg-[#2c2c3a] focus:text-white text-xs"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("affiliate-profile:open", {
                        detail: { userId: targetId },
                      })
                    );
                  }}
                >
                  View Profile
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Avatar className="h-9 w-9">
              <AvatarImage src={targetAvatar} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Name, with "typing…" under it (WhatsApp-style) */}
        <span className="flex-1 min-w-0 flex flex-col">
        <span className="min-w-0 text-[15px] font-semibold text-white/95 truncate flex items-center gap-2">
          <span className="truncate">{targetName}</span>
          {minimized && hasUnread && kind === "group" && groupMentioned[targetId] && (
            <span
              className="bg-brand text-brand-foreground text-[10.5px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0 min-w-[20px] text-center animate-pulse"
              title="You were mentioned"
              aria-label="You were mentioned"
            >
              @
            </span>
          )}
          {minimized && hasUnread && (
            <span className="bg-brand text-brand-foreground text-[10.5px] font-bold px-2 py-0.5 rounded-full leading-none shrink-0 min-w-[20px] text-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </span>
        {!minimized && typingLabel && (
          <span className="text-[11px] leading-tight text-brand truncate">
            {typingLabel}
          </span>
        )}
        </span>

        {/* Action buttons */}
        <div 
          className="flex items-center gap-0.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Favourite */}
          {!minimized && kind !== "group" && (
            <button
              type="button"
              onClick={onToggleFavourite}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
                isFavourite ? "text-amber-400" : "text-[#8888a0] hover:text-amber-400"
              )}
              title={isFavourite ? "Remove from favourites" : "Add to favourites"}
            >
              <Star className={cn("h-3.5 w-3.5", isFavourite && "fill-amber-400")} />
            </button>
          )}

          {/* Expand to full view */}
          {!minimized && (
            <button
              type="button"
              onClick={onExpand}
              className="h-7 w-7 flex items-center justify-center text-[#8888a0] hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Open full chat"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Minimize / Restore */}
          <button
            type="button"
            onClick={onToggleMinimize}
            className="h-7 w-7 flex items-center justify-center text-[#8888a0] hover:text-white rounded-lg transition-colors cursor-pointer"
            title={minimized ? "Restore" : "Minimize"}
          >
            {minimized ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center text-[#8888a0] hover:text-red-400 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Chat Container ── */}
      {!minimized && (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {kind === "dm" && (
            <DMPage
              id={targetId}
              isMini={true}
              onClose={onClose}
              onTypingLabelChange={setTypingLabel}
            />
          )}
          {kind === "group" && (
            <GroupPage
              id={targetId}
              isMini={true}
              onClose={onClose}
              onTypingLabelChange={setTypingLabel}
            />
          )}
          {kind === "global-dm" && (
            <GlobalDMPage
              id={targetId}
              isMini={true}
              onClose={onClose}
              onTypingLabelChange={setTypingLabel}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
