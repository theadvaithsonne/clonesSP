"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { FollowUpKnock } from "@/hooks/useFollowUpReminders";

interface FollowUpKnockCardProps {
  knock: FollowUpKnock | null;
  onDismiss: () => void;
}

export function FollowUpKnockCard({ knock, onDismiss }: FollowUpKnockCardProps) {
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (knock && knock.id !== prevIdRef.current) {
      prevIdRef.current = knock.id;
      try {
        const audio = new Audio("/knock.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
    }
  }, [knock?.id]);

  return (
    <AnimatePresence>
      {knock && (
      <motion.div
        className="fixed top-6 right-6 z-[1000] max-w-sm w-full"
        initial={{ opacity: 0, x: 400, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 400, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="bg-[#0e0e12]/95 backdrop-blur-xl border border-amber-500/30 rounded-xl shadow-2xl shadow-amber-900/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                  {knock.type === "exact" ? "Follow-up due now" : "Follow-up reminder"}
                </span>
              </div>
              <p className="text-white text-sm font-medium truncate">
                {knock.title}
              </p>
              {knock.subtitle && (
                <p className="text-amber-200/90 text-xs mt-0.5 truncate">
                  {knock.subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 hover:bg-white/10 rounded-full"
                onClick={onDismiss}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-gray-400" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
