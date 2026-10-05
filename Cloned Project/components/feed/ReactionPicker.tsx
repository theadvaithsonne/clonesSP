"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReactionType,
  REACTION_TYPES,
  REACTION_EMOJIS,
} from "@/lib/feed-api";

interface ReactionPickerProps {
  userReaction: ReactionType | null | undefined;
  onReact: (reactionType: ReactionType) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function ReactionPicker({
  userReaction,
  onReact,
  disabled = false,
  children,
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 100); // 100ms delay before showing picker
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setHoveredReaction(null);
    }, 200); // 200ms delay before hiding
  }, []);

  const handleReactionClick = useCallback(
    (reactionType: ReactionType) => {
      if (disabled) return;
      onReact(reactionType);
      setIsOpen(false);
      setHoveredReaction(null);
    },
    [disabled, onReact]
  );

  const handleQuickClick = useCallback(() => {
    if (disabled) return;
    // If user already has a reaction, toggle it off by sending the same reaction
    // If no reaction, add 'love' as default
    if (userReaction) {
      onReact(userReaction); // This will toggle off the existing reaction
    } else {
      onReact("love"); // Add love as default when no reaction exists
    }
  }, [disabled, onReact, userReaction]);

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger element (children) */}
      <div onClick={handleQuickClick} className="cursor-pointer">
        {children}
      </div>

      {/* Reaction picker popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute bottom-full left-0 mb-2 z-50"
          >
            <div className="bg-[#111116] rounded-full px-2 py-1.5 shadow-lg border border-[#2a2a35] flex items-center gap-1">
              {REACTION_TYPES.map((type, index) => (
                <motion.button
                  key={type}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: index * 0.015,
                    duration: 0.1,
                    ease: "easeOut",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReactionClick(type);
                  }}
                  onMouseEnter={() => setHoveredReaction(type)}
                  onMouseLeave={() => setHoveredReaction(null)}
                  className={`relative p-1.5 rounded-full transition-all duration-150 ${
                    userReaction === type
                      ? "bg-brand/20 ring-2 ring-brand"
                      : "hover:bg-white/10"
                  }`}
                >
                  <motion.span
                    className="text-2xl block"
                    animate={{
                      scale: hoveredReaction === type ? 1.4 : 1,
                      y: hoveredReaction === type ? -8 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    {REACTION_EMOJIS[type]}
                  </motion.span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
