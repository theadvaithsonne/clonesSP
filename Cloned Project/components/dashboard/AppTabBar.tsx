"use client";

import React, { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import NewTabPicker from "./NewTabPicker";
import { useChat } from "@/lib/chat-context";
import type { TabSet } from "@/lib/founderPages";

interface AppTabBarProps {
  className?: string;
  tabs: string[];
  /** Which set `tabs` is — the "+" picker offers that set's pages. */
  tabSet?: TabSet;
  activeTab: string | null;
  /** Display name for a tab id; defaults to the id itself. */
  getTabLabel?: (tab: string) => string;
  onSelectTab: (tab: string) => void;
  onCloseTab: (tab: string) => void;
  onNewTab: (tab: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onToggleRightPanel?: () => void;
  rightPanelCollapsed?: boolean;
  me?: {
    id?: string;
    _id?: string;
    profilePicture?: string;
    name?: string;
    email?: string;
  } | null;
  children?: React.ReactNode;
}

export default function AppTabBar({
  className,
  tabs,
  tabSet = "main",
  activeTab,
  getTabLabel,
  onSelectTab,
  onCloseTab,
  onNewTab,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  collapsed,
  onToggleSidebar,
  onToggleRightPanel,
  rightPanelCollapsed,
  me,
  children,
}: AppTabBarProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  const { dmUnread, groupUnread, globalDmUnread } = useChat();

  const totalUnreadCount = 
    Object.values(dmUnread).reduce((a, b) => a + b, 0) +
    Object.values(groupUnread).reduce((a, b) => a + b, 0) +
    Object.values(globalDmUnread).reduce((a, b) => a + b, 0);

  const hasUnread = totalUnreadCount > 0;

  const handleOpenPicker = () => {
    if (plusButtonRef.current) {
      setTriggerRect(plusButtonRef.current.getBoundingClientRect());
    }
    setIsPickerOpen(true);
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center h-[48px] bg-[#0a0a0d] border-b border-[#2E2E2E] px-3 gap-2 flex-shrink-0 w-full select-none overflow-hidden",
        className
      )}
    >
      {/* 1. Sidebar Toggle Button */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="h-8 w-8 flex items-center justify-center text-[#c7c7da] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/[0.04] rounded-lg transition-all duration-150 cursor-pointer flex-shrink-0"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="2" y="2" width="14" height="14" rx="2" />
          <path d="M6 2v14" />
        </svg>
      </button>

      {/* 2. Navigation Arrows (Left/Right) */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={onBack}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-lg transition-all duration-150",
            canGoBack
              ? "text-white/60 hover:text-white hover:bg-white/5 cursor-pointer"
              : "text-white/20 cursor-not-allowed"
          )}
          title="Go back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={onForward}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-lg transition-all duration-150",
            canGoForward
              ? "text-white/60 hover:text-white hover:bg-white/5 cursor-pointer"
              : "text-white/20 cursor-not-allowed"
          )}
          title="Go forward"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 3. Tab Pills */}
      <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-1">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <AnimatePresence initial={false}>
            {tabs.map((tab, index) => {
              const isActive = tab === activeTab;
              return (
                <React.Fragment key={tab}>
                  {index > 0 && (
                    <div className="h-3.5 w-[1px] bg-white/10 mx-0.5 flex-shrink-0 self-center" />
                  )}
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: "auto" }}
                    exit={{ opacity: 0, scale: 0.95, width: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="relative flex-shrink-0 group"
                  >
                    <button
                      onClick={() => onSelectTab(tab)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-lg select-none transition-all duration-200 cursor-pointer h-7 border border-transparent whitespace-nowrap",
                        isActive
                          ? "bg-brand text-brand-foreground hover:opacity-90"
                          : "text-[#8888a0] hover:text-white hover:bg-white/5"
                      )}
                    >
                      <span>{getTabLabel ? getTabLabel(tab) : tab}</span>
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tab);
                        }}
                        className={cn(
                          "rounded-md p-0.5 transition-all duration-150 flex items-center justify-center",
                          isActive
                            ? "text-brand-foreground/60 hover:text-brand-foreground hover:bg-brand-foreground/10"
                            : "text-transparent group-hover:text-[#8888a0] hover:text-white hover:bg-white/10"
                        )}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </button>
                  </motion.div>
                </React.Fragment>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Separator line & Plus (+) button */}
        {tabs.length > 0 && (
          <div className="h-4 w-[1px] bg-white/15 mx-1 flex-shrink-0" />
        )}

        {/* 4. Plus (+) Add Tab Button */}
        {tabs.length < 5 && (
          <button
            ref={plusButtonRef}
            type="button"
            onClick={handleOpenPicker}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[#8888a0] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/[0.04] transition-all cursor-pointer flex-shrink-0"
            title="Open new tab view"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 5. Searchable Tab Picker (Portal) */}
      <NewTabPicker
        tabSet={tabSet}
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(tabName) => {
          onNewTab(tabName);
          setIsPickerOpen(false);
        }}
        triggerRect={triggerRect}
      />

      {/* 6. Right Aligned Children (WorkspaceToolbar) + Right Panel Toggle */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {children}
        <button
          type="button"
          onClick={() => {
            const userId = me?.id || me?._id;
            if (userId) {
              window.dispatchEvent(
                new CustomEvent("affiliate-profile:open", {
                  detail: { userId },
                })
              );
            }
          }}
          className="h-8 w-8 flex items-center justify-center text-[#c7c7da] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/[0.04] rounded-lg transition-all duration-150 cursor-pointer flex-shrink-0"
          title="View my network profile"
        >
          <User className="h-4.5 w-4.5" />
        </button>
        {onToggleRightPanel && (
          <button
            type="button"
            onClick={onToggleRightPanel}
            className="h-8 w-8 flex items-center justify-center text-[#c7c7da] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/[0.04] rounded-lg transition-all duration-150 cursor-pointer flex-shrink-0"
            title={rightPanelCollapsed ? "Expand right panel" : "Collapse right panel"}
            aria-label={rightPanelCollapsed ? "Expand right panel" : "Collapse right panel"}
          >
            <div className="relative">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="2" y="2" width="14" height="14" rx="2" />
                <path d="M12 2v14" />
              </svg>
              {rightPanelCollapsed && hasUnread && (
                <span className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-[#0a0a0d] animate-pulse" />
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
