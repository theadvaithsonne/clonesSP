"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Link2, Copy, Check, Twitter, Facebook, Linkedin, Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPostShareLink } from "@/lib/feed-api";
import { toast } from "sonner";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  orgId: string;
  postContent?: string;
}

export function ShareModal({
  open,
  onOpenChange,
  postId,
  orgId,
  postContent,
}: ShareModalProps) {
  const [shareLink, setShareLink] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && postId && orgId) {
      fetchShareLink();
    }
  }, [open, postId, orgId]);

  const fetchShareLink = async () => {
    setIsLoading(true);
    try {
      const { shareLink } = await getPostShareLink(postId, orgId);
      setShareLink(shareLink);
    } catch (error) {
      console.error("Failed to get share link:", error);
      // Fallback to window location
      setShareLink(`${window.location.origin}/post/${postId}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const truncatedContent = postContent
    ? postContent.length > 100
      ? postContent.substring(0, 100) + "..."
      : postContent
    : "";

  const shareOptions = [
    {
      name: "Copy Link",
      icon: copied ? Check : Copy,
      color: copied ? "text-green-400" : "text-[#9fa0b8]",
      bgColor: copied ? "bg-green-400/10" : "bg-[#1a1a22]",
      onClick: handleCopyLink,
    },
    {
      name: "Twitter",
      icon: Twitter,
      color: "text-[#1D9BF0]",
      bgColor: "bg-[#1D9BF0]/10",
      onClick: () => {
        const text = encodeURIComponent(truncatedContent || "Check this out!");
        const url = encodeURIComponent(shareLink);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
      },
    },
    {
      name: "Facebook",
      icon: Facebook,
      color: "text-[#1877F2]",
      bgColor: "bg-[#1877F2]/10",
      onClick: () => {
        const url = encodeURIComponent(shareLink);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
      },
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      color: "text-[#0A66C2]",
      bgColor: "bg-[#0A66C2]/10",
      onClick: () => {
        const url = encodeURIComponent(shareLink);
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
      },
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "text-[#25D366]",
      bgColor: "bg-[#25D366]/10",
      onClick: () => {
        const text = encodeURIComponent(`${truncatedContent}\n\n${shareLink}`);
        window.open(`https://wa.me/?text=${text}`, "_blank");
      },
    },
    {
      name: "Email",
      icon: Mail,
      color: "text-[#EA4335]",
      bgColor: "bg-[#EA4335]/10",
      onClick: () => {
        const subject = encodeURIComponent("Check this out!");
        const body = encodeURIComponent(`${truncatedContent}\n\n${shareLink}`);
        window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#16181C] border-[#2a2a35] max-w-sm p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a2a35]">
          <h2 className="text-lg font-bold text-white">Share Post</h2>
        </div>

        {/* Share Link Preview */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 p-3 bg-[#0e0e12] border border-[#2a2a35] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-[#1D9BF0]/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-[#1D9BF0]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">
                {isLoading ? "Loading..." : shareLink}
              </p>
            </div>
          </div>
        </div>

        {/* Share Options Grid */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-3 gap-3">
            {shareOptions.map((option) => (
              <button
                key={option.name}
                onClick={option.onClick}
                disabled={isLoading}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl transition-colors",
                  option.bgColor,
                  "hover:bg-opacity-20"
                )}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    option.bgColor
                  )}
                >
                  <option.icon className={cn("w-6 h-6", option.color)} />
                </div>
                <span className="text-xs text-[#9fa0b8]">{option.name}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
