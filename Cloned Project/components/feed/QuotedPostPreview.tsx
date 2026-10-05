"use client";

import { cn } from "@/lib/utils";
import type { QuotedPost, PostAuthor, PostChannel } from "@/lib/feed-api";

interface QuotedPostPreviewProps {
  quotedPost: QuotedPost | {
    _id: string;
    content: string;
    authorId: PostAuthor;
    channelIds: PostChannel[];
    likesCount: number;
    commentsCount: number;
    createdAt: string;
  };
  onClick?: () => void;
  compact?: boolean;
}

export function QuotedPostPreview({
  quotedPost,
  onClick,
  compact = false,
}: QuotedPostPreviewProps) {
  const author = quotedPost.authorId;
  const authorName = typeof author === 'object' ? author.name : 'Unknown';
  const authorAvatar = typeof author === 'object' ? author.profilePicture : undefined;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Truncate content for preview
  const truncatedContent = quotedPost.content.length > 200
    ? quotedPost.content.substring(0, 200) + "..."
    : quotedPost.content;

  return (
    <div
      onClick={onClick}
      className={cn(
        "border border-[#2a2a35] rounded-none p-3 bg-[#0e0e12] transition-colors touch-manipulation",
        onClick && "cursor-pointer hover:bg-[#16181C] active:bg-[#16181C]"
      )}
    >
      {/* Author Info */}
      <div className="flex items-center gap-2 mb-2">
        {authorAvatar ? (
          <img
            src={authorAvatar}
            alt={authorName}
            className={cn(
              "rounded-full object-cover",
              compact ? "w-5 h-5" : "w-6 h-6"
            )}
          />
        ) : (
          <div
            className={cn(
              "rounded-full bg-[#1a1a22] flex items-center justify-center text-brand font-semibold",
              compact ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs"
            )}
          >
            {authorName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className={cn(
          "font-semibold text-white",
          compact ? "text-xs" : "text-sm"
        )}>
          {authorName}
        </span>
        <span className="text-[#6E767D] text-xs">·</span>
        <span className="text-[#6E767D] text-xs">
          {formatDate(quotedPost.createdAt)}
        </span>
      </div>

      {/* Content */}
      <p className={cn(
        "text-white whitespace-pre-wrap",
        compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed"
      )}>
        {truncatedContent}
      </p>

      {/* Channel badges */}
      {quotedPost.channelIds && quotedPost.channelIds.length > 0 && !compact && (
        <div className="flex items-center gap-2 mt-2">
          {quotedPost.channelIds.slice(0, 2).map((channel) => (
            <span
              key={channel._id}
              className="px-2 py-0.5 bg-[#1a1a22] rounded-full text-[10px] text-[#9fa0b8]"
            >
              {channel.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
