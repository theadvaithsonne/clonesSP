"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMobileSidebar } from "@/lib/mobile-sidebar-context";
import RightPanel from "./RightPanel";

interface MobileRightPanelOverlayProps {
  activeChatId: { type: "dm" | "group" | "global-dm"; id: string };
  setActiveChatId: (v: {
    type: "dm" | "group" | "global-dm";
    id: string;
  }) => void;
  setActivePopover: (v: string | null) => void;
  className?: string;
}

export default function MobileRightPanelOverlay({
  activeChatId,
  setActiveChatId,
  setActivePopover,
  className,
}: MobileRightPanelOverlayProps) {
  const { isMobileActionSidebarOpen, closeMobileActionSidebar } = useMobileSidebar();

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (isMobileActionSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileActionSidebarOpen]);

  return (
    <AnimatePresence mode="wait">
      {isMobileActionSidebarOpen && (
        <motion.div
          className={`fixed inset-0 z-[1000] ${className || ""}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            onClick={closeMobileActionSidebar}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />

          {/* Right sidebar content - 75% width on mobile */}
          <motion.div
            className="absolute right-0 top-0 h-full w-3/4 max-w-[320px] bg-[#0e0e12] overscroll-contain border-l border-[#2a2a35] flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 350,
              mass: 0.8
            }}
          >
            <div className="flex-1 overflow-hidden h-full">
              <RightPanel
                collapsed={false}
                setCollapsed={() => {}} // No-op on mobile
                activeChatId={activeChatId}
                setActiveChatId={(chatId) => {
                  setActiveChatId(chatId);
                  if (chatId.id) {
                    closeMobileActionSidebar();
                  }
                }}
                setActivePopover={setActivePopover}
                onClose={closeMobileActionSidebar}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
