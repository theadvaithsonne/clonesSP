"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ReactionType,
  REACTION_TYPES,
  REACTION_EMOJIS,
  REACTION_LABELS,
  PostReaction,
  getPostReactions,
} from "@/lib/feed-api";

interface ReactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  initialByType?: Record<ReactionType, number>;
}

type TabType = "all" | ReactionType;

export function ReactionsModal({
  isOpen,
  onClose,
  postId,
  initialByType,
}: ReactionsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [reactions, setReactions] = useState<PostReaction[]>([]);
  const [byType, setByType] = useState<Record<ReactionType, number>>(
    initialByType || {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    }
  );
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // Fetch reactions when modal opens or tab changes
  const fetchReactions = useCallback(
    async (reset: boolean = false) => {
      if (!isOpen || !postId) return;

      setLoading(true);
      try {
        const newOffset = reset ? 0 : offset;
        const result = await getPostReactions(postId, {
          reactionType: activeTab === "all" ? undefined : activeTab,
          limit: LIMIT,
          offset: newOffset,
        });

        if (reset) {
          setReactions(result.reactions);
        } else {
          setReactions((prev) => [...prev, ...result.reactions]);
        }

        setByType(result.byType);
        setTotal(result.total);
        setHasMore(result.reactions.length === LIMIT);
        setOffset(newOffset + result.reactions.length);
      } catch (error) {
        console.error("Failed to fetch reactions:", error);
      } finally {
        setLoading(false);
      }
    },
    [isOpen, postId, activeTab, offset]
  );

  // Initial fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      setOffset(0);
      fetchReactions(true);
    }
  }, [isOpen, activeTab]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("all");
      setReactions([]);
      setOffset(0);
      setHasMore(true);
    }
  }, [isOpen]);

  // Load more function
  const loadMore = () => {
    if (!loading && hasMore) {
      fetchReactions(false);
    }
  };

  // Get total for all reactions
  const allTotal = Object.values(byType).reduce((sum, count) => sum + count, 0);

  // Get tabs to show (only show tabs with reactions)
  const tabs: { type: TabType; count: number }[] = [
    { type: "all", count: allTotal },
    ...REACTION_TYPES.filter((type) => byType[type] > 0).map((type) => ({
      type,
      count: byType[type],
    })),
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-[#1a1a2e] rounded-xl shadow-xl border border-[#2a2a4a] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#2a2a4a]">
                <h2 className="text-lg font-semibold text-white">Reactions</h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-[#2a2a4a] transition-colors"
                >
                  <X className="w-5 h-5 text-[#9fa0b8]" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 p-2 border-b border-[#2a2a4a] overflow-x-auto scrollbar-hide">
                {tabs.map(({ type, count }) => (
                  <button
                    key={type}
                    onClick={() => {
                      setActiveTab(type);
                      setOffset(0);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === type
                        ? "bg-brand text-brand-foreground"
                        : "bg-[#2a2a4a] text-[#9fa0b8] hover:bg-[#3a3a5a]"
                    }`}
                  >
                    {type === "all" ? (
                      "All"
                    ) : (
                      <span className="text-base">{REACTION_EMOJIS[type]}</span>
                    )}
                    <span>{count}</span>
                  </button>
                ))}
              </div>

              {/* Reactions list */}
              <div className="max-h-80 overflow-y-auto p-2">
                {loading && reactions.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-brand" />
                  </div>
                ) : reactions.length === 0 ? (
                  <div className="text-center py-8 text-[#9fa0b8]">
                    No reactions yet
                  </div>
                ) : (
                  <>
                    {reactions.map((reaction) => (
                      <div
                        key={`${reaction.user._id}-${reaction.reactionType}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#2a2a4a] transition-colors cursor-pointer"
                        onClick={() => {
                          if (reaction.user._id) {
                            window.dispatchEvent(
                              new CustomEvent("affiliate-profile:open", {
                                                    detail: { userId: reaction.user._id },
                              })
                            );
                            onClose();
                          }
                        }}
                      >
                        {/* Avatar with reaction badge */}
                        <div className="relative">
                          <Avatar className="w-10 h-10">
                            <AvatarImage
                              src={reaction.user.profilePicture}
                              alt={reaction.user.name}
                            />
                            <AvatarFallback className="bg-[#2a2a4a] text-white">
                              {reaction.user.name?.charAt(0)?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          {/* Reaction badge */}
                          <span className="absolute -bottom-1 -right-1 text-sm bg-[#1a1a2e] rounded-full">
                            {REACTION_EMOJIS[reaction.reactionType]}
                          </span>
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {reaction.user.name}
                          </p>
                          <p className="text-xs text-[#9fa0b8] truncate">
                            {reaction.user.email}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Load more button */}
                    {hasMore && (
                      <button
                        onClick={loadMore}
                        disabled={loading}
                        className="w-full py-2 mt-2 text-sm text-brand hover:bg-[#2a2a4a] rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          "Load more"
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
