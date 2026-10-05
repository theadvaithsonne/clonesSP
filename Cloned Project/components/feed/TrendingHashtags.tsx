"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Hash, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTrendingTags, type TrendingTag } from "@/lib/feed-api";

interface TrendingHashtagsProps {
  orgId: string;
  onTagClick?: (tag: string) => void;
  limit?: number;
  className?: string;
}

export function TrendingHashtags({
  orgId,
  onTagClick,
  limit = 10,
  className,
}: TrendingHashtagsProps) {
  const [trending, setTrending] = useState<TrendingTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      fetchTrending();
    }
  }, [orgId]);

  const fetchTrending = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { trending } = await getTrendingTags(orgId, { limit });
      setTrending(trending);
    } catch (err) {
      console.error("Failed to fetch trending tags:", err);
      setError("Failed to load trending");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  if (error) {
    return null;
  }

  return (
    <div className={cn("bg-[#16181C] rounded-2xl overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a35]">
        <TrendingUp className="w-5 h-5 text-[#1D9BF0]" />
        <h2 className="text-lg font-bold text-white">Trending</h2>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#1D9BF0] animate-spin" />
        </div>
      ) : trending.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <Hash className="w-8 h-8 text-[#6E767D] mx-auto mb-2" />
          <p className="text-[#9fa0b8] text-sm">No trending topics yet</p>
        </div>
      ) : (
        <div>
          {trending.map((tag, index) => (
            <motion.button
              key={tag.tag}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onTagClick?.(tag.tag)}
              className="w-full flex items-start justify-between px-4 py-3 hover:bg-[#1e1e28] transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6E767D] mb-0.5">
                  {index + 1} · Trending
                </p>
                <p className="text-[15px] font-bold text-white group-hover:text-[#1D9BF0] transition-colors truncate">
                  #{tag.tag}
                </p>
                <p className="text-xs text-[#6E767D] mt-0.5">
                  {formatCount(tag.count)} {tag.count === 1 ? "post" : "posts"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6E767D] mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Show more */}
      {trending.length > 0 && (
        <button
          onClick={() => onTagClick?.("")}
          className="w-full px-4 py-3 text-[#1D9BF0] text-[15px] hover:bg-[#1e1e28] transition-colors text-left"
        >
          Show more
        </button>
      )}
    </div>
  );
}
