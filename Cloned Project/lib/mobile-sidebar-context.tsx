"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type MobileSidebarContextType = {
  // Left sidebar (navigation)
  isMobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  // Right sidebar (actions)
  isMobileActionSidebarOpen: boolean;
  openMobileActionSidebar: () => void;
  closeMobileActionSidebar: () => void;
  toggleMobileActionSidebar: () => void;
};

const MobileSidebarContext = createContext<MobileSidebarContextType | null>(
  null
);

export function MobileSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileActionSidebarOpen, setIsMobileActionSidebarOpen] = useState(false);

  // Left sidebar controls
  const openMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(true);
    setIsMobileActionSidebarOpen(false); // Close right sidebar when opening left
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
    setIsMobileActionSidebarOpen(false);
  }, []);

  // Right sidebar controls
  const openMobileActionSidebar = useCallback(() => {
    setIsMobileActionSidebarOpen(true);
    setIsMobileSidebarOpen(false); // Close left sidebar when opening right
  }, []);

  const closeMobileActionSidebar = useCallback(() => {
    setIsMobileActionSidebarOpen(false);
  }, []);

  const toggleMobileActionSidebar = useCallback(() => {
    setIsMobileActionSidebarOpen((prev) => !prev);
    setIsMobileSidebarOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isMobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      isMobileActionSidebarOpen,
      openMobileActionSidebar,
      closeMobileActionSidebar,
      toggleMobileActionSidebar,
    }),
    [
      isMobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      isMobileActionSidebarOpen,
      openMobileActionSidebar,
      closeMobileActionSidebar,
      toggleMobileActionSidebar,
    ]
  );

  return (
    <MobileSidebarContext.Provider value={value}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar() {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) {
    throw new Error(
      "useMobileSidebar must be used within <MobileSidebarProvider>"
    );
  }
  return ctx;
}
