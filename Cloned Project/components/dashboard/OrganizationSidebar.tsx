"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  getToken,
  getUserIdFromToken,
  saveToken,
  saveOrgId,
  clearToken,
} from "@/lib/auth";
import { clearRevenueNetworkCache, getPageCache, setPageCache } from "@/lib/revenue-network-cache";
import { connectSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Badge as BadgeIcon,
  Plus,
  LogOut,
  MessageCircleQuestion,
  Compass,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function SidebarTooltipButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
    setHover(true);
  }, []);

  return (
    <div
      ref={btnRef}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
    >
      <Button
        size="sm"
        variant="outline"
        className="w-full h-10 bg-transparent border-[#2a2a35] text-[#c7c7da] hover:bg-[#15151b] hover:text-white hover:border-brand-2/50 flex items-center justify-center transition-transform duration-150 hover:scale-110"
        onClick={onClick}
      >
        {children}
      </Button>
      {hover &&
        typeof window !== "undefined" &&
        createPortal(
          <span
            style={{ top: pos.top, left: pos.left }}
            className="fixed -translate-y-1/2 px-2 py-1 rounded bg-brand-2 text-xs text-brand-foreground font-medium whitespace-nowrap pointer-events-none z-[9999] shadow-lg"
          >
            {label}
          </span>,
          document.body
        )}
    </div>
  );
}

function OrgItemWithTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
    setHover(true);
  }, []);

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {hover &&
        typeof window !== "undefined" &&
        createPortal(
          <span
            style={{ top: pos.top, left: pos.left }}
            className="fixed -translate-y-1/2 px-2 py-1 rounded bg-brand-2 text-xs text-brand-foreground font-medium whitespace-nowrap pointer-events-none z-[9999] shadow-lg"
          >
            {label}
          </span>,
          document.body
        )}
    </div>
  );
}

export type Organization = {
  id: string;
  name: string;
  role: "founder" | "stakeholder";
  joinedAt: string;
  icon?: string;
  parent?: boolean;
};

export type UserWithOrgs = {
  id: string;
  email: string;
  name?: string;
  organizations: Organization[];
};

interface OrganizationSidebarProps {
  collapsed: boolean;
  setActivePopover?: (popover: string | null) => void;
  // Mobile: callback to close the mobile sidebar overlay
  onMobileClose?: () => void;
}

export default function OrganizationSidebar({
  collapsed,
  setActivePopover,
  onMobileClose,
}: OrganizationSidebarProps) {
  const [user, setUser] = useState<UserWithOrgs | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const router = useRouter();

  // Get current organization ID from token
  const getCurrentOrgId = (): string | null => {
    if (typeof window === "undefined") return null;
    const tok = getToken();
    if (!tok) return null;
    try {
      const payload = JSON.parse(
        atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      return payload.orgId || null;
    } catch {
      return null;
    }
  };

  // Fetch user organizations (stale-while-revalidate)
  const fetchUserOrganizations = useCallback(async (bustCache = false) => {
    const userId = getUserIdFromToken();
    if (!userId) {
      router.push("/login");
      return;
    }

    const cacheKey = `org-sidebar:me:${userId}`;

    // Show cached data immediately
    if (!bustCache) {
      const cached = getPageCache<UserWithOrgs>(cacheKey);
      if (cached) {
        setUser(cached);
        setCurrentOrgId(getCurrentOrgId());
        setLoading(false);
        // Revalidate silently in background
        api<{ user: UserWithOrgs }>("/auth/me", {}, getToken()!)
          .then((res) => {
            setUser(res.user);
            setPageCache(cacheKey, res.user);
          })
          .catch(() => {/* silent — cached data still shown */});
        return;
      }
    } else {
      // Bust cache entry so next load fetches fresh
      setPageCache(cacheKey, null as unknown as UserWithOrgs);
    }

    try {
      setLoading(true);
      const response = await api<{ user: UserWithOrgs }>("/auth/me", {}, getToken()!);
      setUser(response.user);
      setCurrentOrgId(getCurrentOrgId());
      setPageCache(cacheKey, response.user);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast.error("Failed to load organizations");
      router.push("/login");
      clearToken();
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Switch organization
  const switchOrganization = async (orgId: string) => {
    if (!user) return;

    setSwitchingOrg(orgId);
    try {
      const response = await api<{
        token: string;
        currentOrg: {
          id: string;
          name: string;
          role: string;
          joinedAt: string;
        };
      }>("/auth/select-org", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          orgId: orgId,
        }),
      });

      saveToken(response.token);
      saveOrgId(orgId);
      clearRevenueNetworkCache(); // Clear cached storeId when switching orgs
      setCurrentOrgId(orgId);
      toast.success(`Switched to ${response.currentOrg.name}!`);

      // Reconnect socket with new token
      connectSocket();

      // Dispatch custom events to refresh all data
      window.dispatchEvent(
        new CustomEvent("org:switched", {
          detail: { orgId, orgName: response.currentOrg.name },
        })
      );

      // Reload the page to refresh all data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error switching organization:", error);
      toast.error("Failed to switch organization");
      setSwitchingOrg(null);
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      // Call logout API to instantly remove workspace presence
      await api("/auth/logout", {
        method: "POST",
      });
      console.log("[AUTH] Logout API called successfully");
    } catch (error) {
      console.error("[AUTH] Logout API error:", error);
      // Continue with logout even if API fails
    }

    // Clear token and caches, then redirect
    clearToken();
    clearRevenueNetworkCache(); // Clear cached storeId on logout
    toast.success("Logged out successfully!");
    router.push("/login");
  };

  useEffect(() => {
    fetchUserOrganizations();

    // Listen for organization updates — bust cache so fresh data is loaded
    const handleOrgUpdate = () => {
      fetchUserOrganizations(true);
    };

    window.addEventListener("org:updated", handleOrgUpdate);

    return () => {
      window.removeEventListener("org:updated", handleOrgUpdate);
    };
  }, [fetchUserOrganizations]);

  if (loading) {
    return (
      <aside className="relative border-r border-[#2a2a35] bg-[#0e0e12]">
        <div className="py-3 px-2 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-md">
              <div className="h-7 w-7 rounded-full bg-gray-800 animate-pulse shrink-0" />
              {!collapsed && (
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded bg-gray-800 animate-pulse" style={{ width: `${50 + (i % 3) * 15}%` }} />
                  <div className="h-2.5 w-16 rounded bg-gray-800 animate-pulse" />
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  if (!user || user.organizations.length === 0) {
    return null;
  }

  const getRoleIcon = (role: "founder" | "stakeholder") => {
    return role === "founder" ? Crown : BadgeIcon;
  };

  const getRoleLabel = (role: "founder" | "stakeholder") => {
    return role === "founder" ? "Founder" : "Stakeholder";
  };

  const getRoleBadgeColor = (role: "founder" | "stakeholder") => {
    return role === "founder"
      ? "bg-brand-2/20 text-brand-2 border-brand-2/30"
      : "bg-[#6366f1]/20 text-[#6366f1] border-[#6366f1]/30";
  };

  return (
    <>
      {/* Full Screen Loader */}
      <AnimatePresence>
        {switchingOrg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#0b0b0d]/95 backdrop-blur-lg flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="w-16 h-16 border-4 border-brand-2/30 border-t-brand-2 rounded-full mx-auto mb-6"
              />
              <h3 className="text-xl font-semibold text-white mb-2">
                Switching Organization
              </h3>
              <p className="text-[#9fa0b8] text-sm">
                Loading your new workspace...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className={`relative border-r border-[#2a2a35] bg-[#0e0e12] ${onMobileClose ? "h-full" : ""}`}>
        {/* Header */}
        {/* <div className="sticky top-0 z-10 px-3 pt-4 pb-3 border-b border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <Building2 className="h-5 w-5 text-brand-2 flex-shrink-0" />
              <div className="text-sm font-semibold text-white">
                Organizations
              </div>
            </div>
          )}
          {collapsed && (
            <Building2 className="h-5 w-5 text-brand-2 mx-auto" />
          )}
        </div> */}

        {/* Organizations List */}
        <div
          className={`py-3 space-y-2 overflow-y-auto overscroll-contain scrollbar-hide ${onMobileClose ? "h-full" : "fixed"}`}
          style={onMobileClose ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {
            width: collapsed ? 62 : 272,
            height: "calc(100vh - 60px)",
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div className="px-2 space-y-1">
            {user.organizations.map((org) => {
              const RoleIcon = getRoleIcon(org.role);
              const isCurrentOrg = currentOrgId === org.id;
              const isSwitching = switchingOrg === org.id;

              return (
                <OrgItemWithTooltip
                  key={org.id}
                  label={org.name}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "group cursor-pointer flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-all duration-200",
                      isCurrentOrg
                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a] shadow-lg"
                        : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white hover:border hover:border-[#2a2a35]",
                      collapsed ? "justify-center" : "",
                      isSwitching && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() =>
                      !isSwitching && !isCurrentOrg && switchOrganization(org.id)
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-7 w-7 border border-[#2f2f3b] bg-[#1b1b24]">
                          <AvatarImage src={org.icon || ""} />
                          <AvatarFallback className="text-xs text-white font-medium">
                            {org.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isCurrentOrg && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-2 rounded-full border border-[#0e0e12]" />
                        )}
                      </div>

                      {!collapsed && (
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {org.name}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <RoleIcon className="h-3 w-3 text-[#9fa0b8]" />
                            <span className="text-xs text-[#9fa0b8]">
                              {getRoleLabel(org.role)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {!collapsed && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSwitching ? (
                          <Loader2 className="h-4 w-4 animate-spin text-brand-2" />
                        ) : isCurrentOrg ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-2 py-0.5 font-medium",
                              getRoleBadgeColor(org.role)
                            )}
                          >
                            Current
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-[#9fa0b8] opacity-0 group-hover:opacity-100 transition-opacity">
                            Switch
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                </OrgItemWithTooltip>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="px-2 space-y-2">
            {/* Create New Organization Button — routes through the plan
                picker for consistency with the sidebar "Launch An Office"
                button. office-payment handles the logged-out case via its
                own /login redirect.
                TODO re-enable rooms billing — office-creation entry hidden
                while Conference Rooms billing is paused. Restore both the
                expanded and collapsed variants below when rooms billing
                is switched back on. */}
            {/* {!collapsed ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full bg-transparent border-[#2a2a35] text-[#c7c7da] hover:bg-[#15151b] hover:text-white hover:border-brand-2/50"
                onClick={() =>
                  router.push("/office-payment?newOffice=true")
                }
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create New
              </Button>
            ) : (
              <SidebarTooltipButton
                label="Create New Office"
                onClick={() =>
                  router.push("/office-payment?newOffice=true")
                }
              >
                <Plus className="h-4 w-4" />
              </SidebarTooltipButton>
            )} */}

            {/* Discover HQs Button */}
            {collapsed ? (
              <SidebarTooltipButton
                label="Garage Search"
                onClick={() => window.open("https://www.garage.app/", "_blank")}
              >
                <Compass className="h-4 w-4" />
              </SidebarTooltipButton>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full bg-transparent border-[#2a2a35] text-[#c7c7da] hover:bg-[#15151b] hover:text-white hover:border-brand-2/50"
                onClick={() => window.open("https://www.garage.app/", "_blank")}
              >
                <Compass className="h-4 w-4 mr-1.5" />
                Discover
              </Button>
            )}

            {/* My Requests Button */}
            {collapsed ? (
              <SidebarTooltipButton
                label="Join Requests"
                onClick={() => router.push("/my-requests")}
              >
                <Clock className="h-4 w-4" />
              </SidebarTooltipButton>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full bg-transparent border-[#2a2a35] text-[#c7c7da] hover:bg-[#15151b] hover:text-white hover:border-brand-2/50"
                onClick={() => router.push("/my-requests")}
              >
                <Clock className="h-4 w-4 mr-1.5" />
                My Requests
              </Button>
            )}

            {/* Support Ticket Button */}
            {/* {collapsed ? (
              <SidebarTooltipButton
                label="Support"
                onClick={() => setActivePopover?.("Support")}
              >
                <MessageCircleQuestion className="h-4 w-4" />
              </SidebarTooltipButton>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full bg-transparent border-[#2a2a35] text-[#c7c7da] hover:bg-[#15151b] hover:text-white hover:border-brand-2/50"
                onClick={() => setActivePopover?.("Support")}
              >
                <MessageCircleQuestion className="h-4 w-4 mr-1.5" />
                Support
              </Button>
            )} */}
          </div>
        </div>
      </aside>
    </>
  );
}
