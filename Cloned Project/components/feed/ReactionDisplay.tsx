"use client";

import { useMemo } from "react";
import {
  ReactionsCount,
  ReactionType,
  REACTION_EMOJIS,
  getTopReactions,
} from "@/lib/feed-api";

interface ReactionDisplayProps {
  reactionsCount: ReactionsCount | undefined;
  likesCount?: number; // Fallback for backward compatibility
  onClick?: () => void;
  className?: string;
}

export function ReactionDisplay({
  reactionsCount,
  likesCount = 0,
  onClick,
  className = "",
}: ReactionDisplayProps) {
  // Get total count (prefer reactionsCount.total, fallback to likesCount)
  const totalCount = reactionsCount?.total ?? likesCount;

  // Get top 3 reaction types sorted by count
  const topReactions = useMemo(() => {
    return getTopReactions(reactionsCount, 3);
  }, [reactionsCount]);

  if (totalCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 hover:underline transition-colors text-[#9fa0b8] hover:text-white ${className}`}
      title="View reactions"
    >
      {/* Reaction emojis (stacked) */}
      {topReactions.length > 0 ? (
        <div className="flex items-center -space-x-1">
          {topReactions.map((type, index) => (
            <span
              key={type}
              className="text-sm"
              style={{ zIndex: topReactions.length - index }}
            >
              {REACTION_EMOJIS[type]}
            </span>
          ))}
        </div>
      ) : (
        // Fallback: show thumbs up if we only have likesCount
        <span className="text-sm">{REACTION_EMOJIS.like}</span>
      )}

      {/* Total count */}
      <span className="text-sm">{totalCount}</span>
    </button>
  );
}

interface ReactionSummaryProps {
  reactionsCount: ReactionsCount | undefined;
  likesCount?: number;
  userReaction?: ReactionType | null;
  onClick?: () => void;
}

export function ReactionSummary({
  reactionsCount,
  likesCount = 0,
  userReaction,
  onClick,
}: ReactionSummaryProps) {
  const totalCount = reactionsCount?.total ?? likesCount;
  const topReactions = useMemo(() => getTopReactions(reactionsCount, 3), [reactionsCount]);

  if (totalCount === 0) {
    return null;
  }

  // Build display text (e.g., "You and 5 others" or "6 reactions")
  const getDisplayText = () => {
    if (userReaction && totalCount > 1) {
      return `You and ${totalCount - 1} other${totalCount - 1 === 1 ? "" : "s"}`;
    }
    if (userReaction && totalCount === 1) {
      return "You";
    }
    return totalCount.toString();
  };

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[#9fa0b8] hover:text-white hover:underline transition-colors"
      title="View reactions"
    >
      {topReactions.length > 0 ? (
        <div className="flex items-center -space-x-1">
          {topReactions.map((type, index) => (
            <span
              key={type}
              className="text-sm bg-[#1a1a2e] rounded-full"
              style={{ zIndex: topReactions.length - index }}
            >
              {REACTION_EMOJIS[type]}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm">{REACTION_EMOJIS.like}</span>
      )}
      <span className="text-sm">{getDisplayText()}</span>
    </button>
  );
}
