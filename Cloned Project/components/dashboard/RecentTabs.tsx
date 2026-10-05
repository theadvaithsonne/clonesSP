"use client";

import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface RecentTabsProps {
  tabs: string[];
  activeTab: string | null;
  /** Display name for a tab id; defaults to the id itself. */
  getTabLabel?: (tab: string) => string;
  onSelect: (tab: string) => void;
  onClose: (tab: string) => void;
}

export const RecentTabs = React.memo(function RecentTabs({
  tabs,
  activeTab,
  getTabLabel,
  onSelect,
  onClose,
}: RecentTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-0 px-2 sm:px-4 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <AnimatePresence initial={false}>
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <motion.div
              key={tab}
              layout
              initial={false}
              exit={{ opacity: 0, width: 0, x: -8 }}
              animate={{ opacity: 1, width: "auto" }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative flex-shrink-0"
            >
              <button
                onClick={() => onSelect(tab)}
                className={cn(
                  "group relative flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-medium whitespace-nowrap select-none transition-colors duration-150",
                  isActive ? "text-white" : "text-[#52526a] hover:text-[#9898b0]"
                )}
              >
                <span>{getTabLabel ? getTabLabel(tab) : tab}</span>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab);
                  }}
                  className={cn(
                    "rounded p-0.5 transition-all duration-150",
                    isActive
                      ? "text-[#52526a] hover:text-white hover:bg-white/10"
                      : "text-transparent group-hover:text-[#52526a] hover:text-white hover:bg-white/10"
                  )}
                >
                  <X className="h-2.5 w-2.5" />
                </span>

                {/* Sliding underline indicator */}
                {isActive && (
                  <motion.span
                    layoutId="active-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  />
                )}
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
