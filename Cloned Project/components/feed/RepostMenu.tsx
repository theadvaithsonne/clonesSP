"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Repeat2, Quote, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RepostMenuProps {
  postId: string;
  isReposted: boolean;
  repostCount: number;
  onRepost: (postId: string) => void;
  onQuote: (postId: string) => void;
  onUndoRepost?: (postId: string) => void;
}

export function RepostMenu({
  postId,
  isReposted,
  repostCount,
  onRepost,
  onQuote,
  onUndoRepost,
}: RepostMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleRepost = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    onRepost(postId);
  };

  const handleQuote = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    onQuote(postId);
  };

  const handleUndoRepost = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    onUndoRepost?.(postId);
  };

  const handleToggleMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={handleToggleMenu}
        onTouchEnd={handleToggleMenu}
        className={cn(
          "flex items-center gap-2 transition-colors touch-manipulation",
          isReposted ? "text-green-400" : "text-[#9fa0b8] hover:text-green-400"
        )}
      >
        <Repeat2 className="h-5 w-5" />
        <span className="text-sm">{repostCount}</span>
      </button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bottom-full mb-2 w-48 bg-[#16181C] border border-[#2a2a35] rounded-xl shadow-xl overflow-hidden z-50"
          >
            {/* Repost / Undo Repost */}
            {isReposted ? (
              <button
                onClick={handleUndoRepost}
                onTouchEnd={handleUndoRepost}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-white hover:bg-[#2a2a35] active:bg-[#2a2a35] transition-colors touch-manipulation"
              >
                <Undo2 className="w-5 h-5 text-[#9fa0b8]" />
                <span>Undo Repost</span>
              </button>
            ) : (
              <button
                onClick={handleRepost}
                onTouchEnd={handleRepost}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-white hover:bg-[#2a2a35] active:bg-[#2a2a35] transition-colors touch-manipulation"
              >
                <Repeat2 className="w-5 h-5 text-[#9fa0b8]" />
                <span>Repost</span>
              </button>
            )}

            {/* Quote */}
            <button
              onClick={handleQuote}
              onTouchEnd={handleQuote}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-white hover:bg-[#2a2a35] active:bg-[#2a2a35] transition-colors border-t border-[#2a2a35] touch-manipulation"
            >
              <Quote className="w-5 h-5 text-[#9fa0b8]" />
              <span>Quote</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
