"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, ChevronDown, Loader2, Check, Smile, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { createQuotePost, type Post, type PostAttachment } from "@/lib/feed-api";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { toast } from "sonner";
import { QuotedPostPreview } from "./QuotedPostPreview";

interface Channel {
  channelId: string;
  channelTitle: string;
}

interface QuotePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: Channel[];
  orgId: string;
  user: {
    name: string;
    email?: string;
    profilePicture?: string;
  };
  quotedPost: Post;
  onPostCreated: () => void;
}

const MAX_CHAR_LIMIT = 280;

// Extract hashtags from text
const extractHashtags = (text: string): string[] => {
  const matches = [...text.matchAll(/#(\w+)/g)];
  const tags = matches.map((match) => match[1]);
  return [...new Set(tags)];
};

export function QuotePostModal({
  open,
  onOpenChange,
  channels,
  orgId,
  user,
  quotedPost,
  onPostCreated,
}: QuotePostModalProps) {
  const [content, setContent] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowChannelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset state when modal closes, pre-select channels when opens
  useEffect(() => {
    if (!open) {
      setContent("");
      setSelectedChannels([]);
      setShowEmojiPicker(false);
    } else {
      // Pre-select channels from the quoted post
      if (quotedPost.channelIds && quotedPost.channelIds.length > 0) {
        const channelIds = quotedPost.channelIds.map((ch: any) =>
          typeof ch === 'string' ? ch : ch.channelId || ch._id
        ).filter(Boolean);
        setSelectedChannels(channelIds);
      }
    }
  }, [open, quotedPost.channelIds]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleEmojiClick = (emoji: { emoji: string }) => {
    const cursor = textareaRef.current?.selectionStart || content.length;
    const newContent = content.slice(0, cursor) + emoji.emoji + content.slice(cursor);
    setContent(newContent);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleSubmit = async () => {
    if (!content.trim() || selectedChannels.length === 0) {
      toast.error("Please add content and select at least one channel");
      return;
    }

    setIsSubmitting(true);
    try {
      const tags = extractHashtags(content);

      await createQuotePost({
        orgId,
        content: content.trim(),
        channelIds: selectedChannels,
        quotedPostId: quotedPost._id,
        tags: tags.length > 0 ? tags : undefined,
      });

      toast.success("Quote posted successfully!");
      onPostCreated();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create quote post:", error);
      toast.error("Failed to post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingChars = MAX_CHAR_LIMIT - content.length;
  const isOverLimit = remainingChars < 0;
  const canPost = content.trim().length > 0 && selectedChannels.length > 0 && !isOverLimit;

  const getSelectedChannelNames = () => {
    if (selectedChannels.length === 0) return "Select channels";
    if (selectedChannels.length === 1) {
      const channel = channels.find((c) => c.channelId === selectedChannels[0]);
      return channel?.channelTitle || "Select channels";
    }
    return `${selectedChannels.length} channels selected`;
  };

  // Get quoted post author info
  const quotedAuthor = typeof quotedPost.authorId === 'object'
    ? quotedPost.authorId
    : { _id: quotedPost.authorId as string, name: 'Unknown', email: '' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#16181C] border-[#2a2a35] max-w-xl w-[95vw] sm:w-full p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a35]">
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 -m-2 rounded-full hover:bg-[#2a2a35] text-[#9fa0b8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <Button
            onClick={handleSubmit}
            disabled={!canPost || isSubmitting}
            className={cn(
              "rounded-full px-5 font-bold",
              canPost
                ? "bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white"
                : "bg-[#0E4E78] text-[#808080] cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Post"
            )}
          </Button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <div className="flex gap-3">
            {/* Avatar */}
            <Avatar className="w-10 h-10">
              <AvatarImage src={user.profilePicture} />
              <AvatarFallback className="bg-[#1a1a22] text-brand">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              {/* Channel Selector */}
              <div className="relative mb-3" ref={dropdownRef}>
                <button
                  onClick={() => setShowChannelDropdown(!showChannelDropdown)}
                  className="flex items-center gap-1 px-3 py-1 rounded-full border border-[#1D9BF0] text-[#1D9BF0] text-sm hover:bg-[#1D9BF0]/10 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px]">{getSelectedChannelNames()}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showChannelDropdown && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-[#1a1a22] border border-[#2a2a35] rounded-xl shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {/* Select All / Deselect All option */}
                    {channels.length > 1 && (
                      <>
                        <button
                          onClick={() => {
                            if (selectedChannels.length === channels.length) {
                              setSelectedChannels([]);
                            } else {
                              setSelectedChannels(channels.map(c => c.channelId));
                            }
                          }}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#2a2a35] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-[#1D9BF0]" />
                            <span className="text-sm text-[#1D9BF0] font-medium">
                              {selectedChannels.length === channels.length ? "Deselect All" : "Select All"}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                              selectedChannels.length === channels.length
                                ? "bg-[#1D9BF0] border-[#1D9BF0]"
                                : selectedChannels.length > 0
                                ? "border-[#1D9BF0] bg-transparent"
                                : "border-[#6E767D]"
                            )}
                          >
                            {selectedChannels.length === channels.length ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : selectedChannels.length > 0 ? (
                              <div className="w-2 h-0.5 bg-[#1D9BF0] rounded" />
                            ) : null}
                          </div>
                        </button>
                        <div className="mx-4 my-1 border-t border-[#2a2a35]" />
                      </>
                    )}
                    {channels.map((channel) => {
                      const isSelected = selectedChannels.includes(channel.channelId);
                      return (
                        <button
                          key={channel.channelId}
                          onClick={() => toggleChannel(channel.channelId)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#2a2a35] transition-colors"
                        >
                          <span className="text-sm text-white">{channel.channelTitle}</span>
                          <div
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                              isSelected
                                ? "bg-[#1D9BF0] border-[#1D9BF0]"
                                : "border-[#6E767D]"
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add a comment"
                className="w-full bg-transparent text-white text-xl placeholder:text-[#6E767D] resize-none outline-none min-h-[80px] max-h-[200px] overflow-y-auto"
                autoFocus
              />

              {/* Quoted Post Preview */}
              <div className="mt-3">
                <QuotedPostPreview
                  quotedPost={{
                    _id: quotedPost._id,
                    content: quotedPost.content,
                    authorId: quotedAuthor,
                    channelIds: quotedPost.channelIds,
                    likesCount: quotedPost.likesCount,
                    commentsCount: quotedPost.commentsCount,
                    createdAt: typeof quotedPost.createdAt === 'string'
                      ? quotedPost.createdAt
                      : quotedPost.createdAt.toISOString(),
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a35]">
          {/* Tools */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 rounded-full text-[#1D9BF0] hover:bg-[#1D9BF0]/10 transition-colors"
              >
                <Smile className="w-5 h-5" />
              </button>

              {showEmojiPicker && (
                <div className="absolute left-0 bottom-full mb-2 z-50">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme={Theme.DARK}
                    width={320}
                    height={320}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Character count */}
          <div className="flex items-center gap-3">
            {content.length > 0 && (
              <span
                className={cn(
                  "text-sm",
                  isOverLimit ? "text-red-500" : "text-[#6E767D]"
                )}
              >
                {content.length}
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
