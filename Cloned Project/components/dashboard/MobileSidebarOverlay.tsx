"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMobileSidebar } from "@/lib/mobile-sidebar-context";
import MainSidebar from "./MainSidebar";

interface MobileSidebarOverlayProps {
  // Props passed from layout for MainSidebar
  activePopover: string | null;
  setActivePopover: (popover: string | null) => void;
  activeContainer: string | null;
  setActiveContainer: (container: string | null) => void;
  teamforceSection?: string;
  setTeamforceSection?: (section: string) => void;
  dealsSection?:
    | "dashboard"
    | "leads"
    | "funnel"
    | "contacts"
    | "companies"
    | "products"
    | "cms";
  setDealsSection?: (
    section:
      | "dashboard"
      | "leads"
      | "funnel"
      | "contacts"
      | "companies"
      | "products"
      | "cms"
  ) => void;
  networkMailSection?: "template-library" | "campaigns" | "reports" | "settings";
  setNetworkMailSection?: (
    section: "template-library" | "campaigns" | "reports" | "settings"
  ) => void;
  thoughtsSection?: "all-notes" | "starred" | "templates" | "archive" | "trash" | "recovery";
  setThoughtsSection?: (
    section: "all-notes" | "starred" | "templates" | "archive" | "trash" | "recovery"
  ) => void;
  activeChatId: { type: "dm" | "group" | "global-dm"; id: string };
  setActiveChatId: (chatId: {
    type: "dm" | "group" | "global-dm";
    id: string;
  }) => void;
  setIsProfileOpen: (open: boolean) => void;
  setIsFirstTimeUser: (firstTime: boolean) => void;
  isActivityOpen: boolean;
  setIsActivityOpen: (open: boolean) => void;
  setIsAskCabinetOpen?: (open: boolean) => void;
  className?: string;
}

export default function MobileSidebarOverlay({
  activePopover,
  setActivePopover,
  activeContainer,
  setActiveContainer,
  teamforceSection,
  setTeamforceSection,
  dealsSection,
  setDealsSection,
  networkMailSection,
  setNetworkMailSection,
  thoughtsSection,
  setThoughtsSection,
  activeChatId,
  setActiveChatId,
  setIsProfileOpen,
  setIsFirstTimeUser,
  isActivityOpen,
  setIsActivityOpen,
  setIsAskCabinetOpen,
  className,
}: MobileSidebarOverlayProps) {
  const { isMobileSidebarOpen, closeMobileSidebar } = useMobileSidebar();

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (isMobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileSidebarOpen]);

  return (
    <AnimatePresence mode="wait">
      {isMobileSidebarOpen && (
        <motion.div
          className={`fixed inset-0 z-[1000] ${className || ""}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            onClick={closeMobileSidebar}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />

          {/* Combined sidebar content - exactly match MainSidebar width (272px) to avoid extra spacing/clipping */}
          <motion.div
            className="relative flex h-full w-[272px] bg-[#0a0a0d] overscroll-contain"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 350,
              mass: 0.8
            }}
          >


            {/* Main sidebar (right) - always expanded on mobile */}
            <div className="flex-1 overflow-hidden h-full">
              <MainSidebar
                collapsed={false}
                setCollapsed={() => {}} // No-op on mobile, always expanded
                activePopover={activePopover}
                setActivePopover={(popover) => {
                  setActivePopover(popover);
                  // Keep drawer open for taskroom workspace navigation on mobile
                  if (popover && popover !== "Taskroom" && popover !== "Taskroom") {
                    closeMobileSidebar();
                  }
                }}
                activeContainer={activeContainer}
                setActiveContainer={(container) => {
                  setActiveContainer(container);
                  if (container) {
                    closeMobileSidebar();
                  }
                }}
                teamforceSection={teamforceSection}
                setTeamforceSection={setTeamforceSection}
                dealsSection={dealsSection}
                setDealsSection={setDealsSection}
                networkMailSection={networkMailSection}
                setNetworkMailSection={setNetworkMailSection}
                thoughtsSection={thoughtsSection}
                setThoughtsSection={setThoughtsSection}
                activeChatId={activeChatId}
                setActiveChatId={(chatId) => {
                  setActiveChatId(chatId);
                  if (chatId.id) {
                    closeMobileSidebar();
                  }
                }}
                setIsProfileOpen={(open) => {
                  setIsProfileOpen(open);
                  if (open) {
                    closeMobileSidebar();
                  }
                }}
                setIsFirstTimeUser={setIsFirstTimeUser}
                isActivityOpen={isActivityOpen}
                setIsActivityOpen={(open) => {
                  setIsActivityOpen(open);
                  if (open) {
                    closeMobileSidebar();
                  }
                }}
                setIsAskCabinetOpen={(open) => {
                  setIsAskCabinetOpen?.(open);
                  if (open) {
                    closeMobileSidebar();
                  }
                }}
                onMobileClose={closeMobileSidebar}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
