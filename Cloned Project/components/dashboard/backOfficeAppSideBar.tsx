"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskroomSidebar } from "./taskroomSiderBar";
import { TaskroomWorkspace } from "./TaskroomWorkspace";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { useUserStore } from "@/store/athena/userStore";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getUserIdFromToken } from "@/lib/auth";
import { getEmployee } from "./inlineApps/teamforce/api";
import { toast } from "sonner";
import {
  LogOut,
  Plus,
  ChevronLeft,
  TrendingUp,
  UserPlus,
  LayoutDashboard,
  Package,
  Users2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Home,
  ShoppingBag,
  Network,
  Share,
  Building,
  ClipboardCheck,
  User,
  Settings,
  MoreVertical,
  Calendar,
  Folder,
  FileText,
  Monitor,
  Rss,
  Wrench,
  GraduationCap,
  Wallet,
  Search,
  RefreshCw,
  Users,
  MessageSquare,
  Video,
  Box,
  Group,
  UsersIcon,
  Building2,
  Sparkles,
  Rocket,
  Globe,
  Landmark,
  Compass,
  ImageIcon,
  Briefcase,
  Clock,
  Zap,
  ChartColumn,
  UserCheck,
  FolderOpen,
  Phone,
  Quote,
  Receipt,
  Umbrella,
  ShieldCheck,
  Mail,
  UserCircle,
  MapPin,
  BarChart3,
  Send,
  Star,
  Archive,
  History,
  Hash,
  BadgePercent,
  Trash2,
  LayoutTemplate,
  Cloud,
  Mailbox,
  FileSignature,
} from "lucide-react";

const Calendar12Icon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <text
      x="12"
      y="18"
      fontSize="8.5"
      fontWeight="bold"
      textAnchor="middle"
      fill="currentColor"
      stroke="none"
    >
      12
    </text>
  </svg>
);

const NotesIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="M9 14h6" />
    <path d="M9 18h6" />
  </svg>
);

// ── Sidebar items
const sidebarItems = [
  {
    id: "taskroomsworkspace",
    label: "Taskroom",
    iconSrc: "/appicons/taskroom-icon.png",
  },
];

function TaskroomsContent({
  setActivePopover,
}: {
  setActivePopover: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white/50">Taskrooms</h1>
      <div className="bg-[#15151b] p-6 rounded-lg border border-[#1e1e2e]">
        <p className="text-[#a0a0c0]">
          Your task rooms overview, list, or kanban board goes here...
        </p>
      </div>
    </div>
  );
}

function DealsContent() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white/50">Deals</h1>
      <div className="bg-[#15151b] p-6 rounded-lg border border-[#1e1e2e]">
        <p className="text-[#a0a0c0]">
          Deals pipeline, funnel, or list view goes here...
        </p>
      </div>
    </div>
  );
}

// ── Main Component
export default function BackOfficeAppSidebar({
  setActivePopover,
  activePopover,
  setActiveContainer,
  activeContainer,
  teamforceSection,
  setTeamforceSection,
  dealsSection,
  setDealsSection,
  networkMailSection,
  setNetworkMailSection,
  thoughtsSection,
  setThoughtsSection,
}: {
  setActivePopover: (value: string | null) => void;
  activePopover: string | null;
  setActiveContainer?: (value: string | null) => void;
  activeContainer?: string;
  teamforceSection?: string;
  setTeamforceSection?: (section: string) => void;
  dealsSection?: string;
  setDealsSection?: (
    section:
      | "dashboard"
      | "leads"
      | "funnel"
      | "contacts"
      | "companies"
      | "products"
      | "cms",
  ) => void;
  networkMailSection?: string;
  setNetworkMailSection?: (
    section: "template-library" | "campaigns" | "reports" | "settings",
  ) => void;
  thoughtsSection?: string;
  setThoughtsSection?: (
    section: "all-notes" | "starred" | "templates" | "archive" | "trash" | "recovery",
  ) => void;
}) {
  const [activeItem, setActiveItem] = useState<string>("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isAppsExpanded, setIsAppsExpanded] = useState(false);
  const [isAppsExpandedTaskRooms, setIsAppsExpandedTaskRooms] = useState(false);
  const [isAppsExpandedCoverfi, setIsAppsExpandedCoverfi] = useState(
    pathname?.startsWith("/coverfi") ?? false,
  );
  const [isAppsExpandedThoughts, setIsAppsExpandedThoughts] = useState(
    (pathname?.startsWith("/thoughts") || activeContainer === "thoughts") ?? false,
  );
  const [hasManuallyCollapsedThoughts, setHasManuallyCollapsedThoughts] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Teamforce write access — only admins/founders see the Settings tab.
  const { amIFounder, loading: founderLoading, userData } = useAmIFounder();
  const [tfHasWriteAccess, setTfHasWriteAccess] = useState(false);
  // Recruitment access — founder, admin, or manager (managesTeam=true)
  const [tfHasRecruitmentAccess, setTfHasRecruitmentAccess] = useState(false);
  const { fetchWorkspacesAndSpaceAndRoomsAndKanbanBoard } = useTaskroomWorkspacetore();
  const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);
  useEffect(() => {
    if (founderLoading) return;
    if (amIFounder) {
      setTfHasWriteAccess(true);
      setTfHasRecruitmentAccess(true);
      return;
    }
    const uid = getUserIdFromToken();
    if (!uid) return;
    getEmployee(uid)
      .then((d) => {
        if (d.teamforceRole === "admin") setTfHasWriteAccess(true);
        if (d.teamforceRole === "admin" || d.profile?.managesTeam === true) {
          setTfHasRecruitmentAccess(true);
        }
      })
      .catch(() => { });
  }, [amIFounder, founderLoading]);

  // Listen for tags update event from notes pages
  useEffect(() => {
    const handleTagsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      setTags(customEvent.detail || []);
    };

    window.addEventListener("thoughts_tags_updated", handleTagsUpdate as EventListener);

    return () => {
      window.removeEventListener("thoughts_tags_updated", handleTagsUpdate as EventListener);
    };
  }, []);

  // Clear selected tag when navigating away from Thoughts pages
  useEffect(() => {
    if (!pathname?.startsWith("/thoughts")) {
      setSelectedTag(null);
      setTags([]);
    }
  }, [pathname]);

  // Auto-expand thoughts sidebar category when thoughts app is open
  useEffect(() => {
    if (!hasManuallyCollapsedThoughts && (activeContainer === "thoughts" || pathname?.startsWith("/thoughts"))) {
      setIsAppsExpandedThoughts(true);
    }
  }, [activeContainer, pathname, hasManuallyCollapsedThoughts]);

  const handleTagClick = (tag: string) => {
    if (activeContainer !== "thoughts" && !pathname?.startsWith("/thoughts")) {
      setActivePopover?.("");
      setThoughtsSection?.("all-notes");
      setActiveContainer?.("thoughts");
    }

    if (selectedTag === tag) {
      setSelectedTag(null);
      window.dispatchEvent(new CustomEvent("thoughts_tag_filter", { detail: null }));
    } else {
      setSelectedTag(tag);
      window.dispatchEvent(new CustomEvent("thoughts_tag_filter", { detail: tag }));
    }
  };

  // Sync active item with current URL / Taskroom navigation
  useEffect(() => {
    const path = pathname.split("/").pop();
    const shareTaskId = searchParams.get("shareTask");

    if (["taskrooms", "deals", "taskroomsworkspace"].includes(path || "")) {
      setActiveItem(path || "");
      return;
    }

    if (!shareTaskId) {
      setActiveItem("");
    }
  }, [pathname, searchParams, activePopover]);

  // Listen for custom events to change active item from popovers
  useEffect(() => {
    const handleSetActiveItem = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setActiveItem(customEvent.detail);
    };
    window.addEventListener("sidebar:set-active-item", handleSetActiveItem);
    return () => {
      window.removeEventListener(
        "sidebar:set-active-item",
        handleSetActiveItem,
      );
    };
  }, []);


  console.log("activePopover", activePopover)
  // Handle navigation + state update
  const handleNavigation = async (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (
      params.has("workspaceId") ||
      params.has("spaceId") ||
      params.has("roomId") ||
      params.has("shareTask")
    ) {
      params.delete("workspaceId");
      params.delete("spaceId");
      params.delete("roomId");
      params.delete("shareTask");
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    }

    setActivePopover("Taskroom");
    if (activePopover !== "Taskroom") {
      useTaskroomWorkspacetore.setState({
        wsrKLoading: true,
        currentWorkspace: null,
        currentRoomDetail: null,
        activeSpaceId: null,
        columns: [],
        projectActiveItem: "DashMangement",
      });
      useTaskroomWorkspacetore.getState().setCurrentRoomDetail(null);
      useWorkspaceStore.setState({ currentWorkspace: null });
      try {
        await fetchUserProfile();
        const profileLoaded = useUserStore.getState().isUserProfileFetched;
        if (!profileLoaded) {
          useTaskroomWorkspacetore.setState({ wsrKLoading: false });
          toast("Failed to fetch user profile before loading workspaces");
          return;
        }

        await fetchWorkspacesAndSpaceAndRoomsAndKanbanBoard();
      } catch (error) {
        useTaskroomWorkspacetore.setState({ wsrKLoading: false });
        console.error("Failed to load user profile or workspaces:", error);
      }
    }
  };

  console.log("activeItemxxx", activeItem);

  // Helper to render the right content
  const renderContent = () => {
    switch (activeItem) {
      case "taskroomsworkspace":
        return (
          <></>
          // <TaskroomWorkspace
          //   setActivePopover={setActivePopover}
          //   setActiveItem={setActiveItem}
          // />
        );
      case "Athena":
        return (
          <>
          </>
          // <TaskroomSidebar
          //   setActivePopover={setActivePopover}
          //   setActiveItem={setActiveItem}
          // />
        );

      default:
        return (
          <aside className="w-full bg-transparent flex flex-col h-full">
            <div className="pb-2 px-2 pt-3 text-xs font-semibold text-white/40 uppercase tracking-wider">
              BackOffice Apps
            </div>
            {/* <div
              onClick={() => router.push("/workspace?workspaceId=69e8905f14aa09a0282d73ff&spaceId=69e8906014aa09a0282d7405&roomId=69f05e0face425783b941724&shareTask=6a009304776c9713e9330ffa")}
            >zcxzczxczxczxc</div> */}
            <nav className="flex-1 space-y-1 p-0">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  data-nav-popover="Taskroom"
                  onClick={() => handleNavigation(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2 cursor-pointer rounded-md py-2 px-2 text-sm transition-colors border",
                    activeItem === item.id
                      ? "bg-[#1a1a22] text-white border-[#3b3b4a]"
                      : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border-transparent",
                  )}
                >
                  <Image
                    src={item.iconSrc}
                    alt={item.label}
                    width={12}
                    height={12}
                    className="h-[12px] w-[12px] brightness-0 invert"
                  />
                  <span>{item.label}</span>
                  {/* <ChevronRight className="ml-auto h-4 w-4 opacity-60" /> */}
                </button>
              ))}
            </nav>

            {/* Teamforce HR */}
            <div
              data-nav-popover="Teamforce:dashboard"
              className={cn(
                "flex cursor-pointer items-center gap-2 px-2 rounded-md py-2 text-sm transition-colors border",
                activeContainer === "teamforce"
                  ? "bg-[#1a1a22] text-white border-[#3b3b4a]"
                  : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border-transparent",
              )}
              onClick={() => {
                if (activeContainer === "teamforce") {
                  setActiveContainer?.(null);
                  setActivePopover?.(null);
                } else {
                  setActiveContainer?.("teamforce");
                  setActivePopover?.("Teamforce:dashboard");
                }
              }}
            >
              <Briefcase className="h-[14px] w-[14px]" />
              <span>Teamforce</span>
            </div>

            {/* <div
              className="flex cursor-pointer items-center justify-between px-2 hover:bg-[#15151b] hover:text-white/50"
              onClick={() =>
                setIsAppsExpandedTaskRooms(!isAppsExpandedTaskRooms)
              }
            >
              <div className="flex cursor-pointer items-center gap-2 rounded-md  py-2 text-sm transition-colors text-white/50  ">
                <Image
                  src="/taskroom.png"
                  alt=""
                  width={14}
                  height={14}
                  className="h-[14px] w-[14px]"
                />
                Taskrooms
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white/50 hover:text-white/50 hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                title={
                  isAppsExpandedTaskRooms ? "Collapse apps" : "Expand apps"
                }
                aria-label={
                  isAppsExpandedTaskRooms ? "Collapse apps" : "Expand apps"
                }
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-300 ease-in-out ${
                    !isAppsExpandedTaskRooms ? "rotate-0" : "rotate-180"
                  }`}
                />
              </Button>
            </div> */}
            {isAppsExpandedTaskRooms && (
              <>
                <SidebarItem
                  href="/taskroom/overview"
                  label="Overview"
                  active={pathname === "/taskroom/overview"}
                  collapsed={false}
                  icon={<ChartColumn className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/taskroom/all-taskrooms"
                  label="All Taskrooms"
                  active={pathname === "/taskroom/all-taskrooms"}
                  collapsed={false}
                  icon={<FolderOpen className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/taskroom/assigned-to-me"
                  label="Assigned to Me"
                  active={pathname === "/taskroom/assigned-to-me"}
                  collapsed={false}
                  icon={<UserCheck className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
              </>
            )}

            <div
              data-nav-popover="Deals"
              className={cn(
                "flex cursor-pointer items-center gap-2 px-2 rounded-md py-2 text-sm transition-colors border",
                activeContainer === "deals"
                  ? "bg-[#1a1a22] text-white border-[#3b3b4a]"
                  : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border-transparent",
              )}
              onClick={() => {
                if (activeContainer === "deals") {
                  setActiveContainer?.(null);
                  setActivePopover?.(null);
                } else {
                  setActiveContainer?.("deals");
                  setActivePopover?.("Deals");
                }
              }}
            >
              <BadgePercent className="h-[14px] w-[14px]" />
              <span>Deals</span>
            </div>
            <div
              data-nav-popover="Notes"
              className={cn(
                "flex cursor-pointer items-center gap-2 px-2 rounded-md py-2 text-sm transition-colors border",
                activeContainer === "thoughts"
                  ? "bg-[#1a1a22] text-white border-[#3b3b4a]"
                  : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border-transparent",
              )}
              onClick={() => {
                if (activeContainer === "thoughts") {
                  setActiveContainer?.(null);
                  setActivePopover?.(null);
                } else {
                  setActiveContainer?.("thoughts");
                  setActivePopover?.("Notes");
                }
              }}
            >
              <NotesIcon className="h-[14px] w-[14px] opacity-80" />
              <span>Notes</span>
            </div>

            {/*

            {amIFounder && (
              <>
            <div
              className={cn(
                "flex cursor-pointer items-center justify-between px-2 transition-colors",
                pathname?.startsWith("/coverfi")
                  ? "bg-[#15151b] text-white/50"
                  : "hover:bg-[#15151b] hover:text-white/50",
              )}
              onClick={() => setIsAppsExpandedCoverfi(!isAppsExpandedCoverfi)}
            >
              <div className="flex cursor-pointer items-center gap-2 rounded-md py-2 text-sm transition-colors text-white/50">
                <Umbrella className="h-[14px] w-[14px]" />
                Coverfi
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white/50 hover:text-white/50 hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                title={isAppsExpandedCoverfi ? "Collapse apps" : "Expand apps"}
                aria-label={
                  isAppsExpandedCoverfi ? "Collapse apps" : "Expand apps"
                }
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-300 ease-in-out ${
                    !isAppsExpandedCoverfi ? "rotate-0" : "rotate-180"
                  }`}
                />
              </Button>
            </div>
            {isAppsExpandedCoverfi && (
              <div className="space-y-0.5 pb-1">
                <SidebarItem
                  href="/coverfi"
                  label="Dashboard"
                  active={pathname === "/coverfi"}
                  collapsed={false}
                  icon={<LayoutDashboard className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/brokerage"
                  label="My Brokerage"
                  active={pathname?.startsWith("/coverfi/brokerage") ?? false}
                  collapsed={false}
                  icon={<Building2 className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/insurance-companies"
                  label="Insurance Companies"
                  active={pathname === "/coverfi/insurance-companies"}
                  collapsed={false}
                  icon={<Umbrella className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/products"
                  label="Products"
                  active={
                    pathname === "/coverfi/products" ||
                    (pathname?.startsWith("/coverfi/products/") &&
                      !pathname.startsWith("/coverfi/products/categories") &&
                      !pathname.startsWith("/coverfi/products/filters")) ||
                    false
                  }
                  collapsed={false}
                  icon={<ShieldCheck className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/companies"
                  label="Companies"
                  active={pathname?.startsWith("/coverfi/companies") ?? false}
                  collapsed={false}
                  icon={<Briefcase className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/corporate"
                  label="Corporate"
                  active={pathname?.startsWith("/coverfi/corporate") ?? false}
                  collapsed={false}
                  icon={<Landmark className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/communication/templates"
                  label="Communication"
                  active={
                    pathname?.startsWith("/coverfi/communication") ?? false
                  }
                  collapsed={false}
                  icon={<Mail className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/roles"
                  label="Roles"
                  active={pathname === "/coverfi/roles"}
                  collapsed={false}
                  icon={<UserCircle className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/office-locations"
                  label="Office Locations"
                  active={pathname === "/coverfi/office-locations"}
                  collapsed={false}
                  icon={<MapPin className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
                <SidebarItem
                  href="/coverfi/policy-settings"
                  label="Policy Settings"
                  active={pathname === "/coverfi/policy-settings"}
                  collapsed={false}
                  icon={<Settings className="h-4 w-4 ml-2" />}
                  activePopover={null}
                  setActivePopover={setActivePopover}
                />
              </div>
            )}
              </>
            )}
            */}

            <div
              data-nav-popover="Network Mail"
              className={cn(
                "flex cursor-pointer items-center gap-2 px-2 rounded-md py-2 text-sm transition-colors border",
                activeContainer === "network-mail"
                  ? "bg-[#1a1a22] text-white border-[#3b3b4a]"
                  : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border-transparent",
              )}
              onClick={() => {
                if (activeContainer === "network-mail") {
                  setActiveContainer?.(null);
                  setActivePopover?.(null);
                } else {
                  setActiveContainer?.("network-mail");
                  setActivePopover?.("Network Mail");
                }
              }}
            >
              <Mailbox className="h-[14px] w-[14px]" />
              <span>Network Mail</span>
            </div>
            {/* <SidebarItem
              href="#"
              label="Calendar"
              active={activePopover === "Calendar"}
              collapsed={false}
              icon={<Calendar12Icon className="h-4 w-4" />}
              popover={true}
              setActivePopover={setActivePopover}
              setActiveContainer={setActiveContainer}
              activePopover={activePopover}
            /> */}
            <SidebarItem
              href="#"
              label="Cabinet"
              active={activePopover === "Cabinet"}
              collapsed={false}
              icon={<Cloud className="h-4 w-4" />}
              popover={true}
              setActivePopover={setActivePopover}
              setActiveContainer={setActiveContainer}
              activePopover={activePopover}
            />

            {/*  */}
            <SidebarItem
              href="#"
              label="docusign"
              active={activePopover === "docusign"}
              collapsed={false}
              icon={<FileSignature className="h-4 w-4" />}
              popover={true}
              setActivePopover={setActivePopover}
              setActiveContainer={setActiveContainer}
              activePopover={activePopover}
            />

            {/* <SidebarItem
              href="#"
              label="Directory"
              active={activePopover === "Directory"}
              collapsed={false}
              icon={<Home className="h-4 w-4" />}
              popover={true}
              activePopover={activePopover}
              setActivePopover={setActivePopover}
            /> */}
          </aside>
        );
    }
  };

  return (
    <div className="flex flex-1 text-[#c7c7da] h-full">
      <main className="flex-1 overflow-auto">{renderContent()}</main>
    </div>
  );
}

function SidebarItem({
  href,
  label,
  active,
  collapsed,
  popover = false,
  icon,
  setActivePopover,
  activePopover,
  setActiveChatId,
  setActiveContainer,
  onClick,
  disabled,
  badge,
}: {
  href: string;
  label: string;
  active?: boolean;
  collapsed: boolean;
  icon?: React.ReactNode;
  popover?: boolean;
  setActivePopover: (v: string | null) => void;
  activePopover?: string | null;
  setActiveContainer?: (v: string | null) => void;
  setActiveChatId?: (v: {
    type: "dm" | "group" | "global-dm";
    id: string;
  }) => void;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  if (disabled) {
    return (
      <div
        className={[
          "flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-default",
          "text-[#6b6b80]",
          collapsed ? "justify-center" : "",
        ].join(" ")}
        title={label}
        aria-label={label}
      >
        {icon ? (
          <span className="shrink-0 opacity-50">{icon}</span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-primary opacity-50" />
        )}
        {!collapsed && (
          <span className="flex items-center gap-2">
            {label}
            {badge && (
              <span className="text-[9px] font-medium uppercase tracking-wider bg-[#2a2a3a] text-[#8b8ba0] px-1.5 py-0.5 rounded">
                {badge}
              </span>
            )}
          </span>
        )}
      </div>
    );
  }

  return popover ? (
    <div
      // Opens the popover named by its label, for SidebarContextMenu.
      data-nav-popover={onClick ? undefined : label}
      onClick={(e) => {
        e.preventDefault();
        if (onClick) {
          onClick();
        } else if (setActivePopover) {
          setActiveContainer && setActiveContainer(null);

          if (activePopover === label) {
            setActivePopover(null);
          } else {
            setActivePopover(label);
          }
        }
      }}
      className={[
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
        active
          ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
          : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white",
        collapsed ? "justify-center" : "",
      ].join(" ")}
      title={label}
      aria-label={label}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      )}
      {!collapsed && <span>{label}</span>}
    </div>
  ) : (
    <Link
      href={href}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
          return;
        }
        setActivePopover && setActivePopover(null);
        setActiveContainer && setActiveContainer(null);
        setActiveChatId &&
          setActiveChatId({
            id: "",
            type: "dm",
          });
      }}
      className={[
        "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
        active
          ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
          : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white",
        collapsed ? "justify-center" : "",
      ].join(" ")}
      title={label}
      aria-label={label}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      )}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
