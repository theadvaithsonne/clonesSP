"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { clearToken, getOrgId, getToken, getUserIdFromToken, getUserDataFromToken } from "@/lib/auth";
import AccountSwitcher from "@/components/shared/AccountSwitcher";
import { setAccountPicture } from "@/lib/accounts";
import { signOutActiveAccount } from "@/lib/account-session";
import { clearRevenueNetworkCache, getRevenueNetworkData, getEcommerceStoreSlug } from "@/lib/revenue-network-cache";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Plus,
  ChevronLeft,
  Bell,
  TrendingUp,
  UserPlus,
  LayoutDashboard,
  Package,
  Users2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Home,
  ShoppingBag,
  Network,
  Share,
  Building,
  ClipboardCheck,
  ClipboardList,
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
  Star,
  LoaderCircle,
  Headphones,
  Rocket,
  Globe,
  Crown,
  Landmark,
  Compass,
  ImageIcon,
  Briefcase,
  Contact,
  Clock,
  Zap,
  ChartColumn,
  UserCheck,
  FolderOpen,
  Phone,
  Quote,
  Receipt,
  Play,
  BarChart3,
  Radio,
  PlaySquare,
  Gift,
  Umbrella,
  Gamepad2,
  Gavel,
  Trophy,
  IndianRupee,
  Tv,
  ListVideo,
  Camera,
  Voicemail,
  BookOpen,
  BookMarked,
  ShoppingCart,
  CreditCard,
  Palette,
  Mail,
  Tag,
  X,
  History,
  UserRoundCog,
  Ticket,
  CalendarDays,
  Gauge,
  CalendarClock,
  Mic2,
  TicketCheck,
  LayoutTemplate,
  Megaphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { dmConvId, groupConvId, globalDmConvId } from "@/lib/conv";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import InviteMemberDialog from "@/components/dashboard/InviteMemberDialog";
import CreateGroupDialog from "@/components/dashboard/CreateGroupDialog";
import { useCanUpgrade } from "@/components/dashboard/UpgradeToProModal";
import AppIcon from "@/components/dashboard/AppIcon";
import { toast } from "sonner";
import Image from "next/image";
import MarketplacePage, { CATALOG } from "@/components/dashboard/Marketplace";
import { Bot } from "lucide-react";
import { BriefcaseBusiness, HandCoins, UserSearch } from "lucide-react";
import { Bookmark } from "lucide-react";
import { useChat } from "@/lib/chat-context";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useModuleAccess } from "@/lib/hooks/useModuleAccess";
import { isFounderPage } from "@/lib/founderPages";
import { navGroup, OFFICE_PAGE, type NavNode } from "@/components/dashboard/SidebarContextMenu";
import { openAccessInbox } from "@/components/dashboard/teamAccess/AccessInboxModal";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { ManageOrgPopover } from "@/components/shared/ManageOrgPopover";
import { ReferFounderDialog } from "@/components/shared/ReferFounderDialog";
import { GuestFunnelDialog } from "@/components/shared/GuestFunnelDialog";
import { EnrollDownlineSheet } from "@/components/dashboard/EnrollDownlineSheet";
import { RatingsReviewsDialog } from "@/components/reviews";
import { LastSeen } from "@/components/shared/LastSeen";
// BettyAssistant (Activity tracker button) hidden at user request — the
// realtime "Team Activity" feed it powers is being retired. Import left
// commented for one-line revert.
// import { BettyAssistant } from "./BettyAssistant";
import { connectSocket } from "@/lib/socket";
import { useWhitelabelContext } from "@/lib/whitelabel-context";
import {
  BAT246_DISPLAY_NAME,
  BAT246_HOME_PATH,
  BAT246_LOGO_SRC,
  useIsBat246Office,
} from "@/lib/bat246Office";
import { getAffiliateWalletBalance } from "@/lib/feed-api";
import DashboardLayout from "@/app/(dashboard)/layout";
import BackOfficeAppSideBar from "./backOfficeAppSideBar";
import { getEmployee } from "./inlineApps/teamforce/api";
import { ALLOWED_AI_OFFICE_EMAILS } from "@/lib/aiOfficeConfig";
import { isJobsAllowed } from "@/lib/jobsConfig";

export type Member = {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  role: "founder" | "stakeholder";
  profilePicture?: string;
  /** ISO date from the backend's `lastSeenAt` projection. Powers the
   *  "Active X ago" affordance that replaced the green-dot presence UI. */
  lastSeenAt?: string | null;
};

export type Group = {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  unread?: number;
};

interface MainSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  activePopover: string | null;
  setActivePopover: (popover: string | null) => void;
  activeContainer: string | null;
  setActiveContainer: (container: string | null) => void;
  // Teamforce inline app — section nav lifted from the inline app to the layout
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
  // new: ask cabinet sidebar toggle from layout
  setIsAskCabinetOpen?: (open: boolean) => void;
  // Mobile: callback to close the mobile sidebar overlay
  onMobileClose?: () => void;
}

const getLeftTabWidth = (tabId: string, numTabs: number) => {
  const containerContentWidth = 248; // 256px container width - 4px border - 4px padding
  const gaps = 2 * (numTabs - 1);
  const inactiveWidths = 32 * (numTabs - 1);
  return containerContentWidth - inactiveWidths - gaps;
};

interface CollapsibleSectionProps {
  isExpanded: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pending-invoice count on GaragePay and its One-time / Recurring rows.
 * A soft tinted pill rather than a solid red blob, so it reads as a count
 * alongside the muted sidebar text instead of shouting over it.
 */
function PendingCountPill({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#ef4444]/15 px-1.5 text-[10px] font-semibold leading-none tabular-nums text-[#ff7a7a] ring-1 ring-inset ring-[#ef4444]/30",
        className
      )}
    >
      {count}
    </span>
  );
}

function CollapsibleSection({ isExpanded, children, className }: CollapsibleSectionProps) {
  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className={cn("overflow-hidden relative pl-6 mt-1 flex flex-col gap-1", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Pages under each section header, for the header's right-click menu
// (SidebarContextMenu). Keep in step with the rows each header expands to.
const CONFERENCE_PAGES: NavNode[] = [
  { label: "Room", popover: "Conference" },
  { label: "Notes", popover: "Conference:Notes" },
];
const COMMUNITIES_PAGES: NavNode[] = [
  { label: "Discover", popover: "Communities:Discover" },
  { label: "My Communities", popover: "Communities:My" },
  { label: "My Reserves", popover: "ReservedCommunities" },
];
const COMMUNITY_PAGES: NavNode[] = [
  { label: "Feeds", popover: "Feeds" },
  { label: "Office", popover: OFFICE_PAGE },
  { label: "Cabinet", popover: "Org Cabinet" },
  { label: "Conference", children: CONFERENCE_PAGES },
  { label: "Communities", children: COMMUNITIES_PAGES },
];
const LIVE_STREAM_PAGES: NavNode[] = [
  { label: "Discover", popover: "Live:Discover" },
  { label: "Enrolled", popover: "Live:Enrolled" },
  { label: "My Reserves", popover: "Live:Reserves" },
];
const VIDEO_PAGES: NavNode[] = [
  { label: "All Videos", popover: "Content:AllVideos" },
  { label: "Recordings", popover: "Live:Recording" },
  { label: "Drops", popover: "Drops:Feed" },
  { label: "Playlists", popover: "Content:Playlists" },
  { label: "Videos", popover: "Content:Videos" },
];
const COURSE_PAGES: NavNode[] = [
  { label: "Discover", popover: "Learn" },
  { label: "Enrolled", popover: "Courses:Enrolled" },
  { label: "Analytics", popover: "Courses:Analytics" },
  { label: "Reserves", popover: "Courses:Reserves" },
];
const CONTENT_PAGES: NavNode[] = [
  { label: "Videos", children: VIDEO_PAGES },
  { label: "Courses", children: COURSE_PAGES },
  { label: "Articles", popover: "Content:Articles" },
  { label: "Analytics", popover: "Content:Analytics" },
];
const PRODUCT_PAGES: NavNode[] = [
  { label: "Discover", popover: "Products:Browse" },
  { label: "Orders", popover: "Products:Orders" },
  { label: "My Reserves", popover: "Products:Reserves" },
];
const SERVICE_PAGES: NavNode[] = [
  { label: "Discover", popover: "Services:Browse" },
  { label: "My Services", popover: "Services:Optins" },
];
const EVENT_PAGES: NavNode[] = [
  { label: "Discover", popover: "Events" },
  { label: "Purchases", popover: "Events:Purchases" },
];
// Garage Jobs member side. "Jobs" itself is the AI Office's page key, so these
// pages live under "Job Board".
const JOB_BOARD_PAGES: NavNode[] = [
  { label: "Discover", popover: "Job Board" },
  { label: "My Applications", popover: "Job Board:Applications" },
  { label: "Saved", popover: "Job Board:Saved" },
];
const FOUNDER_COMMUNITY_PAGES: NavNode[] = [
  { label: "My Communities", popover: "Founder:Communities" },
  { label: "Members", popover: "Founder:Communities:Members" },
  { label: "Orders", popover: "Founder:Communities:Orders" },
  { label: "Cabinet", popover: "Founder:Communities:Cabinet" },
  { label: "Unsub Log", popover: "Founder:Communities:UnsubLog" },
];
const FOUNDER_LIVE_PAGES: NavNode[] = [
  { label: "My Live streams", popover: "Founder:Live" },
  { label: "Attendees", popover: "Founder:Live:Attendees" },
  { label: "Orders", popover: "Founder:Live:Orders" },
  { label: "Unsub Log", popover: "Founder:Live:UnsubLog" },
];
const FOUNDER_VIDEO_PAGES: NavNode[] = [
  { label: "My Recordings", popover: "Founder:Live:Recordings" },
  { label: "My Videos", popover: "Founder:Content:Videos" },
  { label: "My Drops", popover: "Founder:Content:Drops" },
  { label: "My Playlists", popover: "Founder:Content:Playlists" },
];
const FOUNDER_COURSE_PAGES: NavNode[] = [
  { label: "My Courses", popover: "Founder:Courses" },
  { label: "Students", popover: "Founder:Courses:Students" },
  { label: "Orders", popover: "Founder:Courses:Orders" },
  { label: "Unsub Log", popover: "Founder:Courses:UnsubLog" },
];
// Founder-only; no RBAC module covers them.
const FOUNDER_CONTENT_EXTRA_PAGES: NavNode[] = [
  { label: "Articles", popover: "Founder:Content:Articles" },
  { label: "Analytics", popover: "Founder:Content:Analytics" },
  { label: "Content Rewards", popover: "Founder:Content:Rewards" },
];
const FOUNDER_PRODUCT_PAGES: NavNode[] = [
  { label: "Products", popover: "Founder:Products" },
  { label: "Orders", popover: "Founder:Products:Orders" },
  { label: "Customers", popover: "Founder:Products:Customers" },
];
// The PLAN / SELL / REACH pages need an open event, so only the list.
const FOUNDER_EVENT_PAGES: NavNode[] = [{ label: "My Events", popover: "Founder:Events" }];
const FOUNDER_SERVICE_PAGES: NavNode[] = [
  { label: "Services", popover: "Founder:Services" },
  { label: "Opt-Ins", popover: "Founder:Services:Optins" },
  { label: "Customers", popover: "Founder:Services:Customers" },
  { label: "Orders", popover: "Founder:Services:Orders" },
];
// Founder-only; no RBAC module covers Garage Jobs.
const FOUNDER_JOBS_PAGES: NavNode[] = [
  { label: "Overview", popover: "Founder:Jobs" },
  { label: "Postings", popover: "Founder:Jobs:Postings" },
  { label: "Applications", popover: "Founder:Jobs:Applications" },
  { label: "Talent Pool", popover: "Founder:Jobs:TalentPool" },
  { label: "Referral Payouts", popover: "Founder:Jobs:Payouts" },
  { label: "Settings", popover: "Founder:Jobs:Settings" },
];
const OFFICE_SETTINGS_PAGES: NavNode[] = [
  { label: "Coupons", popover: "Office Settings:coupons" },
  { label: "Invitees", popover: "Office Settings:invitees" },
  { label: "Team & Access", popover: "Office Settings:team-access" },
  { label: "Coverfi", href: "/coverfi" },
  { label: "Domains", popover: "Office Settings:domain" },
  { label: "Branding", popover: "Office Settings:branding" },
  { label: "Email Setup", popover: "NetworkMail" },
];

// Events console navigation. Mirrors EVENT_SECTION_PILLAR in
// app/(dashboard)/layout.tsx, which drives the bottom bar off the same
// sections — if a page moves pillar, change it in both places.
const EVENT_PILLARS: Array<{
  key: "plan" | "sell" | "reach";
  label: string;
  icon: any;
  pages: Array<{ section: string; label: string; icon: any }>;
}> = [
  {
    key: "plan",
    label: "Plan",
    icon: ClipboardCheck,
    pages: [
      { section: "overview", label: "Overview", icon: Gauge },
      { section: "agenda", label: "Agenda", icon: CalendarClock },
      { section: "speakers", label: "Speakers", icon: Mic2 },
      { section: "sponsors", label: "Sponsors & Exhibitors", icon: Building2 },
    ],
  },
  {
    key: "sell",
    label: "Sell",
    icon: ShoppingBag,
    pages: [
      { section: "tickets", label: "Tickets", icon: TicketCheck },
      { section: "registrations", label: "Registrations", icon: ClipboardList },
      { section: "coupons", label: "Promotions", icon: Tag },
    ],
  },
  {
    key: "reach",
    label: "Reach",
    icon: Megaphone,
    pages: [
      { section: "website", label: "Event Website", icon: LayoutTemplate },
      { section: "campaigns", label: "Email Campaigns", icon: Mail },
    ],
  },
];

/** Which pillar owns a section — used to auto-open the right group. */
const EVENT_SECTION_TO_PILLAR: Record<string, "plan" | "sell" | "reach"> =
  Object.fromEntries(
    EVENT_PILLARS.flatMap((p) => p.pages.map((pg) => [pg.section, p.key]))
  ) as Record<string, "plan" | "sell" | "reach">;

export default function MainSidebar({
  collapsed,
  setCollapsed,
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
  onMobileClose,
}: MainSidebarProps) {
  const {
    isWhitelabel,
    orgIcon: whitelabelOrgIcon,
    orgName: whitelabelOrgName,
    isLoading: whitelabelLoading,
  } = useWhitelabelContext();
  console.log("activePopover", activePopover);
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Apps (subscribed)
  const [appsMy, setAppsMy] = useState<
    { id: string; name: string; url: string }[]
  >([]);

  const [adminApps, setAdminApps] = useState<
    { id: string; name: string; url: string }[]
  >([]);

  const [loadingApps, setLoadingApps] = useState(true);

  const [isManageOrgOpen, setIsManageOrgOpen] = useState(false);

  const [isReferFounderOpen, setIsReferFounderOpen] = useState(false);
  const [isGuestFunnelOpen, setIsGuestFunnelOpen] = useState(false);
  const [isEnrollDownlineOpen, setIsEnrollDownlineOpen] = useState(false);
  const [isInviteEmployeesOpen, setIsInviteEmployeesOpen] = useState(false);
  const [isRatingsReviewsOpen, setIsRatingsReviewsOpen] = useState(false);

  const [isAffiliate, setIsAffiliate] = useState(false);

  const [affiliateId, setAffiliateId] = useState<string>("");
  const [orgSlug, setOrgSlug] = useState<string>("");
  const [orgWhiteLogo, setOrgWhiteLogo] = useState<string>("");
  const [orgColoredLogo, setOrgColoredLogo] = useState<string>("");
  const [orgWhiteIcon, setOrgWhiteIcon] = useState<string>("");
  const [orgColoredIcon, setOrgColoredIcon] = useState<string>("");
  const [orgIcon, setOrgIcon] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("Garage");

  const [isMembersExpanded, setIsMembersExpanded] = useState(false);
  const [isGroupsExpanded, setIsGroupsExpanded] = useState(false);
  const [isGarageSaleExpanded, setIsGarageSaleExpanded] = useState(false);
  const [isContentRewardsExpanded, setIsContentRewardsExpanded] =
    useState(false);
  const [isGaragePayExpanded, setIsGaragePayExpanded] = useState(false);
  // Which GaragePay sub-tab is showing in the panel. Mirrors OrdersPage's own
  // `invoiceTab` so the sidebar sub-item highlight stays correct no matter
  // whether the tab was switched from here, the bottom tab picker, or the
  // panel's own tab bar (all three funnel through `garagepay:set-tab`).
  const [garagePayTab, setGaragePayTab] = useState<"one_time" | "recurring">("one_time");
  const [isAivatarsExpanded, setIsAivatarsExpanded] = useState(false);
  const [isAppsExpanded, setIsAppsExpanded] = useState(false);
  const [isAppsExpandedTaskRooms, setIsAppsExpandedTaskRooms] = useState(false);
  const [isAppsExpandedDeals, setIsAppsExpandedDeals] = useState(false);
  const [isAppsExpandedTeamforce, setIsAppsExpandedTeamforce] = useState(false);
  const [tfHasWriteAccess, setTfHasWriteAccess] = useState(false);
  const [tfHasRecruitmentAccess, setTfHasRecruitmentAccess] = useState(false);
  const [isRevenueNetworkExpanded, setIsRevenueNetworkExpanded] =
    useState(false);
  const [isNetworksExpanded, setIsNetworksExpanded] = useState(false);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [isFoundersToolsExpanded, setIsFoundersToolsExpanded] = useState(false);
  const [isCommunityExpanded, setIsCommunityExpanded] = useState(false);
  const [isCommunitiesDropdownExpanded, setIsCommunitiesDropdownExpanded] = useState(false);
  const [isConferenceDropdownExpanded, setIsConferenceDropdownExpanded] = useState(false);
  const [isLiveStreamsExpanded, setIsLiveStreamsExpanded] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [isVideosExpanded, setIsVideosExpanded] = useState(false);
  const [isCoursesExpanded, setIsCoursesExpanded] = useState(false);
  const [isCallsExpanded, setIsCallsExpanded] = useState(false);
  const [isProductsExpanded, setIsProductsExpanded] = useState(false);
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);
  // Attendee Events (Discover / Purchases) — not the founder console below.
  const [isEventsBrowseExpanded, setIsEventsBrowseExpanded] = useState(false);
  const [isJobBoardExpanded, setIsJobBoardExpanded] = useState(false);
  // Events lives in the Founder tab beside the other module consoles.
  const [isEventsExpanded, setIsEventsExpanded] = useState(false);
  // Which events page is open ("list" on the catalogue). Broadcast by the
  // module so the sidebar tree and the bottom bar highlight the same thing.
  const [eventsSection, setEventsSection] = useState<string>("list");
  // Collapsed pillars, by key. Empty = all three open, which is the state a
  // founder wants the first time; collapsing is for narrowing focus later.
  const [collapsedPillars, setCollapsedPillars] = useState<string[]>([]);
  const [isOfficeSettingsExpanded, setIsOfficeSettingsExpanded] = useState(false);
  // Founder-specific dropdown expansion states
  const [isFounderCommunitiesExpanded, setIsFounderCommunitiesExpanded] = useState(false);
  const [isFounderLiveExpanded, setIsFounderLiveExpanded] = useState(false);
  const [isFounderCoursesExpanded, setIsFounderCoursesExpanded] = useState(false);
  const [isFounderCallsExpanded, setIsFounderCallsExpanded] = useState(false);
  const [isFounderProductsExpanded, setIsFounderProductsExpanded] = useState(false);
  const [isFounderServicesExpanded, setIsFounderServicesExpanded] = useState(false);
  const [isFounderJobsExpanded, setIsFounderJobsExpanded] = useState(false);
  const [isFounderContentExpanded, setIsFounderContentExpanded] = useState(false);
  const [isFounderVideosExpanded, setIsFounderVideosExpanded] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  // `activeUserIds` was the live online roster; removed with the green-dot
  // presence UI. Members now show "Active X ago" via `<LastSeen />` instead.
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [isRefreshingMembers, setIsRefreshingMembers] = useState(false);
  const [isRefreshingGroups, setIsRefreshingGroups] = useState(false);
  const [personalAgents, setPersonalAgents] = useState<
    { agentId: string; name: string; role?: string; emoji?: string }[]
  >([]);
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<
    "customers" | "employees" | "aiOffice" | "founders" | "chat" | "group" | "global-dm" | "backOfficeAppMenu" | "lobby"
  >("customers");

  const [tabTransitionDuration, setTabTransitionDuration] = useState(100);

  // Mutually exclusive toggle helpers for the 4 main customer/member dropdowns
  const toggleCommunity = useCallback(() => {
    setIsCommunityExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsContentExpanded(false);
        setIsProductsExpanded(false);
        setIsLiveStreamsExpanded(false);
        setIsCoursesExpanded(false);
        setIsVideosExpanded(false);
        // Only keep communities dropdown open if we are on one of its pages
        const isSubActive = activePopover && [
          "Communities", "ReservedCommunities", "Communities:Discover", "Communities:My"
        ].includes(activePopover);
        if (!isSubActive) {
          setIsCommunitiesDropdownExpanded(false);
        }
        const isConferenceActive = activePopover && [
          "Conference", "Conference:Notes"
        ].includes(activePopover);
        if (!isConferenceActive) {
          setIsConferenceDropdownExpanded(false);
        }
      } else {
        setIsCommunitiesDropdownExpanded(false);
        setIsConferenceDropdownExpanded(false);
      }
      return nextVal;
    });
  }, [activePopover]);

  const toggleContent = useCallback(() => {
    setIsContentExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsCommunityExpanded(false);
        setIsProductsExpanded(false);
        setIsLiveStreamsExpanded(false);
        // Only keep sub-menus open if we are actively on their pages
        const isCoursesActive = activePopover && (
          activePopover === "Learn" ||
          activePopover === "Courses" ||
          activePopover.startsWith("Courses:")
        );
        const isVideosActive = activePopover && (
          activePopover === "Content:Videos" ||
          activePopover === "Content:Playlists" ||
          activePopover === "Drops" ||
          activePopover.startsWith("Drops:") ||
          activePopover === "Live:Recording" ||
          activePopover === "Live:Recorded"
        );
        if (!isCoursesActive) {
          setIsCoursesExpanded(false);
        }
        if (!isVideosActive) {
          setIsVideosExpanded(false);
        }
      } else {
        setIsCoursesExpanded(false);
        setIsVideosExpanded(false);
      }
      return nextVal;
    });
  }, [activePopover]);

  // Keep the GaragePay sub-item highlight in sync when the tab is switched
  // from somewhere else (bottom tab picker).
  useEffect(() => {
    const handleSetTab = (e: Event) => {
      const tab = (e as CustomEvent<"one_time" | "recurring">).detail;
      if (tab === "one_time" || tab === "recurring") setGaragePayTab(tab);
    };
    window.addEventListener("garagepay:set-tab", handleSetTab);
    return () => window.removeEventListener("garagepay:set-tab", handleSetTab);
  }, []);

  // Leaving the panel drops back to One-time, matching the layout's own
  // reset when GaragePay is reopened from anywhere else.
  useEffect(() => {
    if (activePopover !== "Orders") setGaragePayTab("one_time");
  }, [activePopover]);

  const toggleGaragePay = useCallback(() => {
    setIsGaragePayExpanded((prev) => !prev);
  }, []);

  const toggleProducts = useCallback(() => {
    setIsProductsExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsCommunityExpanded(false);
        setIsContentExpanded(false);
        setIsLiveStreamsExpanded(false);
        setIsCoursesExpanded(false);
        setIsVideosExpanded(false);
      }
      return nextVal;
    });
  }, []);

  // Courses now lives inside the Content dropdown (sibling of Videos)
  const toggleCourses = useCallback(() => {
    setIsCoursesExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsVideosExpanded(false);
      }
      return nextVal;
    });
  }, []);

  // Mutually exclusive toggle helpers for the 4 main founder dropdowns + Office Settings
  const toggleFounderCommunities = useCallback(() => {
    setIsFounderCommunitiesExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsFounderContentExpanded(false);
        setIsFounderProductsExpanded(false);
        setIsFounderLiveExpanded(false);
        setIsFounderCoursesExpanded(false);
        setIsFounderVideosExpanded(false);
        setIsOfficeSettingsExpanded(false);
      }
      return nextVal;
    });
  }, []);

  const toggleFounderContent = useCallback(() => {
    setIsFounderContentExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsFounderCommunitiesExpanded(false);
        setIsFounderProductsExpanded(false);
        setIsFounderLiveExpanded(false);
        setIsOfficeSettingsExpanded(false);
        // Only keep sub-menus open if we are actively on their pages
        const isCoursesActive = activePopover && activePopover.startsWith("Founder:Courses");
        const isVideosActive = activePopover && (
          activePopover === "Founder:Live:Recordings" ||
          activePopover === "Founder:Content:Videos" ||
          activePopover === "Founder:Content:Drops" ||
          activePopover === "Founder:Content:Playlists"
        );
        if (!isCoursesActive) {
          setIsFounderCoursesExpanded(false);
        }
        if (!isVideosActive) {
          setIsFounderVideosExpanded(false);
        }
      } else {
        setIsFounderCoursesExpanded(false);
        setIsFounderVideosExpanded(false);
      }
      return nextVal;
    });
  }, [activePopover]);

  const toggleFounderProducts = useCallback(() => {
    setIsFounderProductsExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsFounderCommunitiesExpanded(false);
        setIsFounderContentExpanded(false);
        setIsFounderLiveExpanded(false);
        setIsFounderCoursesExpanded(false);
        setIsFounderVideosExpanded(false);
        setIsOfficeSettingsExpanded(false);
      }
      return nextVal;
    });
  }, []);

  // Founder Courses now lives inside the Content dropdown (sibling of Videos)
  const toggleFounderCourses = useCallback(() => {
    setIsFounderCoursesExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsFounderVideosExpanded(false);
      }
      return nextVal;
    });
  }, []);

  const toggleOfficeSettings = useCallback(() => {
    setIsOfficeSettingsExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsFounderCommunitiesExpanded(false);
        setIsFounderContentExpanded(false);
        setIsFounderProductsExpanded(false);
        setIsFounderLiveExpanded(false);
        setIsFounderCoursesExpanded(false);
        setIsFounderVideosExpanded(false);
      }
      return nextVal;
    });
  }, []);

  // Live Streams is now a top-level dropdown (sibling of Community/Content/Products)
  const toggleLiveStreams = useCallback(() => {
    setIsLiveStreamsExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsCommunityExpanded(false);
        setIsContentExpanded(false);
        setIsProductsExpanded(false);
        setIsVideosExpanded(false);
        setIsCoursesExpanded(false);
      }
      return nextVal;
    });
  }, []);

  const toggleVideos = useCallback(() => {
    setIsVideosExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsCoursesExpanded(false);
      }
      return nextVal;
    });
  }, []);

  // Founder Live Streams is now a top-level dropdown
  const toggleFounderLive = useCallback(() => {
    setIsFounderLiveExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsFounderCommunitiesExpanded(false);
        setIsFounderContentExpanded(false);
        setIsFounderProductsExpanded(false);
        setIsOfficeSettingsExpanded(false);
        setIsFounderVideosExpanded(false);
        setIsFounderCoursesExpanded(false);
      }
      return nextVal;
    });
  }, []);

  const toggleFounderVideos = useCallback(() => {
    setIsFounderVideosExpanded((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setIsFounderCoursesExpanded(false);
      }
      return nextVal;
    });
  }, []);

  // Auto-switch to back-office (Athena) when arriving via a shared-task deep link.
  // TaskroomWorkspace only mounts when activeWorkspaceView === "backOfficeAppMenu";
  // its own useEffect then reads ?shareTask and flips activePopover to "Taskroom".
  const sidebarSearchParams = useSearchParams();
  console.log("cxzcnzxczxczxc", activeWorkspaceView)
  useEffect(() => {

    // intentionally mount-only — re-firing on every searchParams change would
    // hijack the sidebar after the user navigates within the workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-switch workspace category view based on activePopover
  useEffect(() => {
    if (!activePopover) return;
    setTabTransitionDuration(100);
    if (sidebarSearchParams.get("shareTask")) {
      // setTabTransitionDuration(100);
      // setActiveWorkspaceView("backOfficeAppMenu");
      setActivePopover("Taskroom");
      setActiveWorkspaceView("employees");
      return
    }
    if (isFounderPage(activePopover)) {
      setActiveWorkspaceView("founders");
      // Auto-expand the correct founder dropdown
      if (activePopover.startsWith("Founder:Communities")) {
        setIsFounderCommunitiesExpanded(true);
        setIsFounderContentExpanded(false);
        setIsFounderLiveExpanded(false);
        setIsFounderProductsExpanded(false);
        setIsOfficeSettingsExpanded(false);
      }
      // Live Streams is top-level; Content holds Videos + Courses
      if (activePopover.startsWith("Founder:Live") && activePopover !== "Founder:Live:Recordings") {
        setIsFounderLiveExpanded(true);
        setIsFounderCommunitiesExpanded(false);
        setIsFounderContentExpanded(false);
        setIsFounderProductsExpanded(false);
        setIsOfficeSettingsExpanded(false);
      }
      if (activePopover === "Founder:Live:Recordings" || activePopover.startsWith("Founder:Content") || activePopover.startsWith("Founder:Courses") || activePopover === "Founder:Articles" || activePopover === "Founder:Analytics") {
        setIsFounderContentExpanded(true);
        setIsFounderCommunitiesExpanded(false);
        setIsFounderLiveExpanded(false);
        setIsFounderProductsExpanded(false);
        setIsOfficeSettingsExpanded(false);
      }
      if (activePopover === "Founder:Live:Recordings" || activePopover === "Founder:Content:Videos" || activePopover === "Founder:Content:Drops" || activePopover === "Founder:Content:Playlists") {
        setIsFounderVideosExpanded(true);
        setIsFounderCoursesExpanded(false);
      }
      if (activePopover.startsWith("Founder:Courses")) {
        setIsFounderCoursesExpanded(true);
        setIsFounderVideosExpanded(false);
      }
      if (activePopover.startsWith("Founder:Calls")) setIsFounderCallsExpanded(true);
      if (activePopover.startsWith("Founder:Products")) {
        setIsFounderProductsExpanded(true);
        setIsFounderCommunitiesExpanded(false);
        setIsFounderContentExpanded(false);
        setIsFounderLiveExpanded(false);
        setIsOfficeSettingsExpanded(false);
      }
      if (activePopover.startsWith("Founder:Services")) setIsFounderServicesExpanded(true);
      if (activePopover.startsWith("Founder:Jobs")) setIsFounderJobsExpanded(true);
      if (activePopover.startsWith("Office Settings:") || activePopover === "Office Settings") {
        setIsOfficeSettingsExpanded(true);
        setIsFounderCommunitiesExpanded(false);
        setIsFounderContentExpanded(false);
        setIsFounderLiveExpanded(false);
        setIsFounderProductsExpanded(false);
      }
    } else if ([
      "Communities", "Community", "Live Streams", "Live",
      "Long Form Videos", "Content", "Learn", "Courses",
      "Digital Products", "Products", "Services", "Feeds",
      "ReservedCommunities", "Courses:Reserves", "1:1 Calls",
      "Org Cabinet"
    ].includes(activePopover) ||
      activePopover.startsWith("Live:") ||
      activePopover.startsWith("Content:") ||
      activePopover.startsWith("Courses:") ||
      activePopover.startsWith("Products:") ||
      activePopover.startsWith("Services:") ||
      activePopover.startsWith("Drops:") ||
      activePopover.startsWith("1:1 Calls:") ||
      activePopover === "Drops" ||
      activePopover === "Job Board" ||
      activePopover.startsWith("Job Board:")
    ) {
      setActiveWorkspaceView("customers");

    } else if ([
      "Overview", "All Taskrooms", "Assigned to Me", "Taskroom",
      "Directory", "BackOffice", "Spaces", "Invitees", "Calendar",
      "Cabinet", "Analytics", "NetworkMail", "Network Mail", "Deals", "Notes",
      "Domain Management", "Leave Management", "Pending Requests",
      "Deskstream"
    ].includes(activePopover) || (activePopover && (activePopover === "Teamforce" || activePopover.startsWith("Teamforce:")))) {
      setActiveWorkspaceView("employees");
    } else if ([
      "AI Providers", "Ai Employees", "My Ai Employees",
      "Tasks", "My Tasks", "Jobs", "My Jobs",
      "Marketplace", "Job Marketplace", "Context Library",
      "Integrations", "Billing"
    ].includes(activePopover)) {
      setActiveWorkspaceView("aiOffice");
    }
  }, [activePopover]);

  // Global DM state
  const [globalDmUsers, setGlobalDmUsers] = useState<
    Array<{
      _id: string;
      name?: string;
      email: string;
      profilePicture?: string;
      city?: string;
      state?: string;
      country?: string;
    }>
  >([]);
  const [isLoadingGlobalDmUsers, setIsLoadingGlobalDmUsers] = useState(false);
  const [globalDmSearchQuery, setGlobalDmSearchQuery] = useState("");
  const [isGlobalDmExpanded, setIsGlobalDmExpanded] = useState(false);
  const [isRefreshingGlobalDm, setIsRefreshingGlobalDm] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const pathname = usePathname();

  // Auto-expand dropdowns when activePopover corresponds to any of their sub-pages
  useEffect(() => {
    let isCommunity = false;
    let isContent = false;
    let isLive = false;
    let isProducts = false;

    if (
      activePopover && [
        "Communities", "Community", "ReservedCommunities", "Feeds", "OfficeStream", "Org Cabinet", "Conference", "Conference:Notes", "Communities:Discover", "Communities:My"
      ].includes(activePopover)
    ) {
      isCommunity = true;
    }
    if (
      activePopover && (
        activePopover === "Long Form Videos" ||
        activePopover === "Content" ||
        activePopover.startsWith("Content:") ||
        activePopover === "Drops" ||
        activePopover.startsWith("Drops:") ||
        activePopover === "Live:Recording" ||
        activePopover === "Live:Recorded" ||
        activePopover === "Learn" ||
        activePopover === "Courses" ||
        activePopover.startsWith("Courses:")
      )
    ) {
      isContent = true;
    }
    if (
      activePopover && (
        activePopover === "Live Streams" ||
        activePopover === "Live" ||
        (activePopover.startsWith("Live:") && activePopover !== "Live:Recording" && activePopover !== "Live:Recorded")
      )
    ) {
      isLive = true;
    }
    if (
      activePopover && (
        activePopover === "Digital Products" ||
        activePopover === "Products" ||
        activePopover.startsWith("Products:")
      )
    ) {
      isProducts = true;
    }

    if (isCommunity) {
      setIsCommunityExpanded(true);
      setIsContentExpanded(false);
      setIsLiveStreamsExpanded(false);
      setIsProductsExpanded(false);
    } else if (isLive) {
      setIsLiveStreamsExpanded(true);
      setIsCommunityExpanded(false);
      setIsContentExpanded(false);
      setIsProductsExpanded(false);
    } else if (isContent) {
      setIsContentExpanded(true);
      setIsCommunityExpanded(false);
      setIsLiveStreamsExpanded(false);
      setIsProductsExpanded(false);
    } else if (isProducts) {
      setIsProductsExpanded(true);
      setIsCommunityExpanded(false);
      setIsContentExpanded(false);
      setIsLiveStreamsExpanded(false);
    }

    if (
      activePopover && (
        activePopover === "Content:Videos" ||
        activePopover === "Content:Playlists" ||
        activePopover === "Content:AllVideos" ||
        activePopover === "Drops" ||
        activePopover.startsWith("Drops:") ||
        activePopover === "Live:Recording" ||
        activePopover === "Live:Recorded"
      )
    ) {
      setIsVideosExpanded(true);
      setIsCoursesExpanded(false);
    }
    if (
      activePopover && (
        activePopover === "Learn" ||
        activePopover === "Courses" ||
        activePopover.startsWith("Courses:")
      )
    ) {
      setIsCoursesExpanded(true);
      setIsVideosExpanded(false);
    }
    if (
      activePopover && [
        "Communities", "ReservedCommunities", "Communities:Discover", "Communities:My"
      ].includes(activePopover)
    ) {
      setIsCommunitiesDropdownExpanded(true);
    }
    if (
      activePopover && [
        "Conference", "Conference:Notes"
      ].includes(activePopover)
    ) {
      setIsConferenceDropdownExpanded(true);
    }
    if (
      activePopover && (
        activePopover === "1:1 Calls" ||
        activePopover.startsWith("1:1 Calls:")
      )
    ) {
      setIsCallsExpanded(true);
    }
    if (
      activePopover && (
        activePopover === "Services" ||
        activePopover.startsWith("Services:")
      )
    ) {
      setIsServicesExpanded(true);
    }
    if (activePopover === "Events" || activePopover?.startsWith("Events:")) {
      setIsEventsBrowseExpanded(true);
    }
    if (activePopover === "Job Board" || activePopover?.startsWith("Job Board:")) {
      setIsJobBoardExpanded(true);
    }
    if (activePopover?.startsWith("Founder:Events")) {
      setIsEventsExpanded(true);
    }
    if (
      (activePopover && (
        activePopover === "Office Settings" ||
        activePopover.startsWith("Office Settings:")
      )) || (pathname?.startsWith("/coverfi"))
    ) {
      setIsOfficeSettingsExpanded(true);
    }
  }, [activePopover, pathname]);
  // Events module → sidebar. The module owns its own navigation state and
  // broadcasts it, so the tree highlights the page actually on screen even when
  // it was reached from the bottom bar or from inside the console.
  useEffect(() => {
    const onEventsState = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      if (section) setEventsSection(section);
    };
    window.addEventListener("events:state", onEventsState as EventListener);
    return () =>
      window.removeEventListener("events:state", onEventsState as EventListener);
  }, []);

  const router = useRouter();
  const meId = getUserIdFromToken() || "";
  const { amIFounder, userData, loading: userDataLoading } = useAmIFounder();

  const isStakeholder = userData?.membershipRole === "stakeholder" && !userData?.guest;

  const isAiOfficeAllowed = !!(userData?.email && ALLOWED_AI_OFFICE_EMAILS.includes(userData.email.toLowerCase()));
  // Garage Jobs is limited to an allow-list while it rolls out (lib/jobsConfig).
  const isJobsAllowedUser = isJobsAllowed(userData?.email);

  // Module RBAC: a non-founder who ACCEPTED a module grant gets that module's
  // admin console. `can()` already folds in the founder bypass, so it reads
  // true for founders on every module.
  const {
    can: canModuleConsole,
    hasAnyModule,
    pendingCount: accessInvitesPending,
  } = useModuleAccess();

  // The "Founders" tab hosts every module console, so it has to open up for
  // delegated module admins too — otherwise an accepted grant has nowhere to land.
  const canSeeFounderTab = amIFounder || hasAnyModule;

  // BAT 246 office: the sidebar is BAT 246 only (see lib/bat246Office.ts).
  // One tab hides the switcher, and the fallback effect below pins
  // activeWorkspaceView to it.
  const isBat246Office = useIsBat246Office();

  const workspaceTabs = useMemo(() => {
    if (isBat246Office) {
      return [{ id: "customers", label: "Customers", icon: Building2 }];
    }

    if (amIFounder) {
      const tabs = [
        { id: "customers", label: "Customers", icon: Building2 },
        { id: "employees", label: "Employees", icon: User },
        { id: "founders", label: "Founders", icon: Crown }
      ];
      if (isAiOfficeAllowed) {
        tabs.splice(2, 0, { id: "aiOffice", label: "AI Office", icon: Bot });
      }
      return tabs;
    }

    if (isStakeholder) {
      const tabs = [
        { id: "customers", label: "Customers", icon: Building2 },
        { id: "employees", label: "Employees", icon: User }
      ];
      if (canSeeFounderTab) {
        tabs.push({ id: "founders", label: "Admin", icon: Crown });
      }
      return tabs;
    }

    // Default for guest/other (not founder, not stakeholder)
    return [
      { id: "customers", label: "Customers", icon: Building2 }
    ];
  }, [isBat246Office, amIFounder, isStakeholder, isAiOfficeAllowed, canSeeFounderTab]);

  // Safe fallback if active Workspace view becomes restricted due to role change or links
  useEffect(() => {
    if (!userDataLoading) {
      const allowedTabIds = workspaceTabs.map((t) => t.id);
      if (!allowedTabIds.includes(activeWorkspaceView as any)) {
        setActiveWorkspaceView("customers");
      }
    }
  }, [activeWorkspaceView, workspaceTabs, userDataLoading]);

  // Navigate to workspace before opening a popover if we're on a games page,
  // so the URL doesn't stay stuck at /games/bat246/...
  const setActivePopoverNav = useCallback((popover: string | null) => {
    if (popover && pathname?.startsWith("/games/")) {
      router.push("/workspace");
    }
    setActivePopover(popover);
  }, [pathname, setActivePopover, router]);

  // Open the GaragePay panel straight onto One-time or Recurring. The panel
  // may not be mounted yet, so the layout picks the tab up from the
  // `garagepay:open` event and hands it to OrdersPage as a prop; the
  // `garagepay:set-tab` event covers the already-open case.
  const openGaragePayTab = useCallback(
    (tab: "one_time" | "recurring") => {
      setGaragePayTab(tab);
      setIsGaragePayExpanded(true);
      setActiveContainer && setActiveContainer(null);
      setActivePopoverNav("Orders");
      window.dispatchEvent(new CustomEvent("garagepay:open", { detail: tab }));
      window.dispatchEvent(new CustomEvent("garagepay:set-tab", { detail: tab }));
    },
    [setActiveContainer, setActivePopoverNav]
  );

  const {
    canUpgrade,
    canDowngrade,
    downgradeScheduledAt,
    planSlug,
    isTrial,
    trialDaysRemaining,
    upgradeHref,
  } = useCanUpgrade();
  const orgId = getOrgId();

  // Auto-switch workspace tab to "customers" when on bat246 pages (Bat246 nav is in that tab)
  useEffect(() => {
    if (pathname?.startsWith("/games/bat246")) {
      setTabTransitionDuration(100);
      setActiveWorkspaceView("customers");
    }
  }, [pathname]);

  // Auto-switch workspace tab to "founders" when on coverfi pages
  useEffect(() => {
    if (pathname?.startsWith("/coverfi")) {
      setTabTransitionDuration(100);
      setActiveWorkspaceView("founders");
    }
  }, [pathname]);

  // Teamforce write & recruitment access check
  useEffect(() => {
    if (userDataLoading) return;
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
  }, [amIFounder, userDataLoading]);

  // Pending invoice count for GaragePay sidebar badge
  const [pendingInvoiceCount, setPendingInvoiceCount] = useState(0);
  // Split of the above by invoice type, for the One-time / Recurring rows.
  // Null until known (or if the lookup fails — the total still shows).
  const [pendingInvoiceSplit, setPendingInvoiceSplit] = useState<{ oneTime: number; recurring: number } | null>(null);

  // Fetch affiliate ID from API
  const fetchAffiliateId = async () => {
    try {
      const response = await api<{
        success: boolean;
        affiliateId: string | null;
        hasAffiliateId: boolean;
      }>("/affiliate/my-affiliate-id", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (response.success && response.affiliateId) {
        console.log("✅ Affiliate ID fetched:", response.affiliateId);
        setAffiliateId(response.affiliateId);
      } else {
        console.log("⚠️ No affiliate ID found for user");
        setAffiliateId("");
      }
    } catch (error) {
      console.error("Error fetching affiliate ID:", error);
      setAffiliateId("");
    }
  };

  // Fetch organization slug for public testimonials link
  const fetchOrgSlug = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    try {
      const response = await api<{
        org: {
          slug?: string;
          name: string;
          white_logo?: string;
          colored_logo?: string;
          icon?: string;
          white_icon?: string;
          colored_icon?: string;
        };
        membership: {
          role: string;
          joinedAt: string;
        };
      }>(`/org/${orgId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (response.org?.slug) {
        setOrgSlug(response.org.slug);
        localStorage.setItem("garage_org_slug", response.org.slug);
        console.log("✅ Organization slug fetched:", response.org.slug);
      } else {
        console.log("⚠️ No slug found for organization");
      }
      if (response.org?.white_logo) {
        setOrgWhiteLogo(response.org.white_logo);
      }
      if (response.org?.colored_logo) {
        setOrgColoredLogo(response.org.colored_logo);
      }
      if (response.org?.icon) {
        setOrgIcon(response.org.icon);
      }
      if (response.org?.white_icon) {
        setOrgWhiteIcon(response.org.white_icon);
      }
      if (response.org?.colored_icon) {
        setOrgColoredIcon(response.org.colored_icon);
      }
      if (response.org?.name) {
        setOrgName(response.org.name);
      }
    } catch (error) {
      console.error("Error fetching organization slug:", error);
    }
  };

  const sidebarWidth = collapsed ? 62 : 272;

  // fetch members
  async function loadMembers() {
    const orgId = localStorage.getItem("garage_org_id");
    try {
      const res = await api<{ members: Member[] }>(
        "/team/list?orgId=" + orgId,
        {},
        getToken()!,
      );
      // console.log("zzzzzzzzzzzzzzz", res.members);
      setMembers(res.members || []);
    } finally {
      setLoadingMembers(false);
    }
  }

  // fetch groups
  async function loadGroups() {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      // Bail rather than sending the literal string "null" as orgId.
      if (!orgId) {
        setGroups([]);
        return;
      }
      const res = await api<{ groups: Group[] }>(
        `/groups?orgId=${orgId}`,
        {},
        getToken()!,
      );
      setGroups(res.groups || []);
    } finally {
      setLoadingGroups(false);
    }
  }

  // Refresh members with animation
  async function handleRefreshMembers() {
    setIsRefreshingMembers(true);
    try {
      await loadMembers();
      toast.success("Members list refreshed");
    } catch (error) {
      toast.error("Failed to refresh members");
    } finally {
      setTimeout(() => setIsRefreshingMembers(false), 600); // Keep animation for smooth effect
    }
  }

  // Load global DM conversations (users with existing conversations + search)
  async function loadGlobalDmUsers(search?: string) {
    setIsLoadingGlobalDmUsers(true);
    try {
      // First get conversations to show existing chats
      const convRes = await api<{
        conversations: Array<{
          otherId: string;
          otherUser: {
            _id: string;
            name?: string;
            email: string;
            profilePicture?: string;
            city?: string;
            state?: string;
            country?: string;
          } | null;
        }>;
      }>("/global-dm/conversations", {}, getToken()!);

      let users = (convRes.conversations || [])
        .filter((c) => c.otherUser)
        .map((c) => c.otherUser!);

      // If searching, also search for new users
      if (search && search.trim()) {
        const searchRes = await api<{
          users: Array<{
            _id: string;
            name?: string;
            email: string;
            profilePicture?: string;
            city?: string;
            state?: string;
            country?: string;
          }>;
        }>(
          `/users/discover?search=${encodeURIComponent(search)}&limit=20`,
          {},
          getToken()!,
        );

        // Merge search results with existing conversations, avoiding duplicates
        const existingIds = new Set(users.map((u) => u._id));
        const newUsers = (searchRes.users || []).filter(
          (u) => !existingIds.has(u._id),
        );
        users = [...users, ...newUsers];
      }

      setGlobalDmUsers(users);
    } catch (error) {
      console.error("Failed to load global DM users:", error);
    } finally {
      setIsLoadingGlobalDmUsers(false);
    }
  }

  // Refresh global DM users
  async function handleRefreshGlobalDm() {
    setIsRefreshingGlobalDm(true);
    try {
      await loadGlobalDmUsers(globalDmSearchQuery);
      toast.success("Global chats refreshed");
    } catch (error) {
      toast.error("Failed to refresh global chats");
    } finally {
      setTimeout(() => setIsRefreshingGlobalDm(false), 600);
    }
  }

  // Refresh groups with animation
  async function handleRefreshGroups() {
    setIsRefreshingGroups(true);
    try {
      await loadGroups();
      toast.success("Groups list refreshed");
    } catch (error) {
      toast.error("Failed to refresh groups");
    } finally {
      setTimeout(() => setIsRefreshingGroups(false), 600); // Keep animation for smooth effect
    }
  }

  async function loadMyApps() {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{
        apps: { id: string; name: string; url: string }[];
      }>(`/apps/my?orgId=${orgId}`, {}, getToken()!);
      setAppsMy(res.apps || []);
    } finally {
      setLoadingApps(false);
    }
  }

  useEffect(() => {
    loadMembers();
    loadGroups();
    fetchAffiliateId();
    fetchOrgSlug();
    getAffiliateWalletBalance()
      .then((res) => setIsAffiliate(!!res.hasPurchasedUnilevelPlus))
      .catch(() => { });

    const onTeamReload = () => loadMembers();
    const onGroupsReload = () => loadGroups();
    const onOrgSwitched = () => {
      // Refresh all data when organization is switched
      loadMembers();
      loadGroups();
      loadMyApps();
      fetchAffiliateId();
      fetchOrgSlug();
      getAffiliateWalletBalance()
        .then((res) => setIsAffiliate(!!res.hasPurchasedUnilevelPlus))
        .catch(() => { });
      // Global DM persists across orgs, no need to reload
    };
    // Listen for invite:open event from MobileActionSidebar
    const onReferFounderOpen = () => {
      setIsReferFounderOpen(true);
    };

    // Listen for open:guest-funnel event from mobile sticky footer
    const onGuestFunnelOpen = () => {
      setIsGuestFunnelOpen(true);
    };

    // Listen for manage-org:open event from MobileActionSidebar
    const onManageOrgOpen = () => {
      setIsManageOrgOpen(true);
    };

    // Listen for invite-employees:open event from MobileActionSidebar
    const onInviteEmployeesOpen = () => {
      setIsInviteEmployeesOpen(true);
    };

    window.addEventListener("team:reload", onTeamReload as any);
    window.addEventListener("groups:reload", onGroupsReload as any);
    window.addEventListener("org:switched", onOrgSwitched as any);
    window.addEventListener("invite:open", onReferFounderOpen as any);
    window.addEventListener("open:guest-funnel", onGuestFunnelOpen as any);
    window.addEventListener("manage-org:open", onManageOrgOpen as any);
    window.addEventListener(
      "invite-employees:open",
      onInviteEmployeesOpen as any,
    );
    return () => {
      window.removeEventListener("team:reload", onTeamReload as any);
      window.removeEventListener("groups:reload", onGroupsReload as any);
      window.removeEventListener("org:switched", onOrgSwitched as any);
      window.removeEventListener("invite:open", onReferFounderOpen as any);
      window.removeEventListener("open:guest-funnel", onGuestFunnelOpen as any);
      window.removeEventListener("manage-org:open", onManageOrgOpen as any);
      window.removeEventListener(
        "invite-employees:open",
        onInviteEmployeesOpen as any,
      );
    };
  }, []);

  // Listen for TaskroomWorkspace back button to return to employees view
  useEffect(() => {
    const onSwitchToEmployees = () => {
      setTabTransitionDuration(100);
      setActiveWorkspaceView("employees");
    };
    window.addEventListener("sidebar:switch-to-employees", onSwitchToEmployees as any);
    return () => {
      window.removeEventListener("sidebar:switch-to-employees", onSwitchToEmployees as any);
    };
  }, []);

  console.log("pathname", pathname);
  // Fetch personal OpenClaw agents (controls sidebar contacts)
  useEffect(() => {
    const url = new URL("/api/openclaw/agent", window.location.origin);
    if (orgId) url.searchParams.set("org_id", orgId);

    fetch(url.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setPersonalAgents(
          (d.agents || []).map((a: any) => ({
            agentId: a.agent_id,
            name: a.name || "My Agent",
            role: a.role || "",
            emoji: a.emoji || "",
          })),
        );
      })
      .catch(() => { });

    const onAgentsUpdate = (e: CustomEvent) => {
      const agents = e.detail?.agents || [];
      setPersonalAgents(
        agents.map((a: any) => ({
          agentId: a.agent_id,
          name: a.name || "My Agent",
          role: a.role || "",
          emoji: a.emoji || "",
        })),
      );
    };
    window.addEventListener(
      "openclaw:agents-updated",
      onAgentsUpdate as EventListener,
    );
    return () =>
      window.removeEventListener(
        "openclaw:agents-updated",
        onAgentsUpdate as EventListener,
      );
  }, [orgId]);

  // Load global DM users when tab is active or search changes
  useEffect(() => {
    if (activeWorkspaceView === "global-dm") {
      loadGlobalDmUsers(globalDmSearchQuery);
    }
  }, [activeWorkspaceView, globalDmSearchQuery]);

  useEffect(() => {
    loadMyApps();
    const onAppsReload = () => loadMyApps();
    const onOrgSwitched = () => loadMyApps();
    window.addEventListener("apps:reload", onAppsReload as any);
    window.addEventListener("org:switched", onOrgSwitched as any);
    return () => {
      window.removeEventListener("apps:reload", onAppsReload as any);
      window.removeEventListener("org:switched", onOrgSwitched as any);
    };
  }, []);

  // Live workspace-presence listeners were removed with the green-dot UI.
  // The "Active X ago" affordance reads `lastSeenAt` from the regular
  // members payload — no socket subscription needed.

  // Fetch pending invoice count + listen for new invoice events.
  // The count surfaces as a red badge on the GaragePay nav item.
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const res = await fetch(`${apiUrl}/api/invoices/my/pending-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const total = data.count || 0;
          setPendingInvoiceCount(total);
          if (total === 0) {
            setPendingInvoiceSplit({ oneTime: 0, recurring: 0 });
            return;
          }
          // pending-count is draft + pending with no type split. /my/list
          // filters by type and one exact status and reports `total`, so two
          // limit=1 reads give the recurring share; the rest is one-time.
          const recurringTotal = async (status: "draft" | "pending") => {
            const r = await fetch(
              `${apiUrl}/api/invoices/my/list?invoiceType=recurring&status=${status}&limit=1`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!r.ok) throw new Error(String(r.status));
            const d = await r.json();
            return Number(d.total ?? d.pagination?.total ?? 0);
          };
          try {
            const [draft, pending] = await Promise.all([recurringTotal("draft"), recurringTotal("pending")]);
            const recurring = Math.min(total, draft + pending);
            setPendingInvoiceSplit({ oneTime: total - recurring, recurring });
          } catch (err) {
            console.warn("[GaragePay] could not split pending invoices by type:", err);
            setPendingInvoiceSplit(null);
          }
        }
      } catch {
        // Silently ignore
      }
    };

    fetchPendingCount();
    // Poll every 60 seconds
    const interval = setInterval(fetchPendingCount, 60000);

    // Listen for socket event when cron generates a new invoice
    const socket = connectSocket();
    const handlePendingInvoice = () => {
      fetchPendingCount();
    };
    socket.on("invoice:pending", handlePendingInvoice);

    return () => {
      clearInterval(interval);
      socket.off("invoice:pending", handlePendingInvoice);
    };
  }, []);

  // Fetch unread notifications count + listen for notification refresh events
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        const url = orgId
          ? `/user-notifications/unread-count?orgId=${orgId}`
          : "/user-notifications/unread-count";
        const res = await api<{ count: number }>(url, {}, getToken()!);
        setUnreadNotificationsCount(res.count || 0);
      } catch (error) {
        console.error("Failed to fetch unread notifications count:", error);
      }
    };

    fetchUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    const handleRefresh = () => fetchUnreadCount();
    window.addEventListener("notifications:refresh", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications:refresh", handleRefresh);
    };
  }, []);

  // Listen for notification events to switch workspace view
  useEffect(() => {
    const handleOpenDM = (event: CustomEvent) => {
      // Switch to chat view when DM is opened from notifications or user card
      setTabTransitionDuration(100);
      setActiveWorkspaceView("chat");
      // Also set the active chat
      if (event.detail?.userId) {
        setActiveChatId({ type: "dm", id: event.detail.userId });
      }
    };

    const handleOpenGroup = (event: CustomEvent) => {
      // Switch to group view when group is opened from notifications
      setTabTransitionDuration(100);
      setActiveWorkspaceView("group");
      // Also set the active chat
      if (event.detail?.groupId) {
        setActiveChatId({ type: "group", id: event.detail.groupId });
      }
    };

    window.addEventListener(
      "notification:open-dm",
      handleOpenDM as EventListener,
    );
    window.addEventListener(
      "notification:open-group",
      handleOpenGroup as EventListener,
    );

    return () => {
      window.removeEventListener(
        "notification:open-dm",
        handleOpenDM as EventListener,
      );
      window.removeEventListener(
        "notification:open-group",
        handleOpenGroup as EventListener,
      );
    };
  }, [setActiveChatId]);

  const {
    dmUnread: contextDmUnread,
    groupUnread: contextGroupUnread,
    globalDmUnread: contextGlobalDmUnread,
    dmLastMessageTime,
    groupLastMessageTime,
    globalDmLastMessageTime,
  } = useChat();

  // Calculate total unread counts for tabs
  const totalDmUnread = useMemo(() => {
    return Object.values(contextDmUnread).reduce(
      (sum, count) => sum + (count || 0),
      0,
    );
  }, [contextDmUnread]);

  const totalGroupUnread = useMemo(() => {
    return Object.values(contextGroupUnread).reduce(
      (sum, count) => sum + (count || 0),
      0,
    );
  }, [contextGroupUnread]);

  const totalGlobalDmUnread = useMemo(() => {
    return Object.values(contextGlobalDmUnread).reduce(
      (sum, count) => sum + (count || 0),
      0,
    );
  }, [contextGlobalDmUnread]);

  // Sync groups state with context unread counts
  // This ensures g.unread stays in sync with contextGroupUnread from chat-context
  useEffect(() => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        unread: contextGroupUnread[g.id] ?? 0,
      })),
    );
  }, [contextGroupUnread]);

  const others = useMemo(() => {
    const seen = new Set<string>();
    return members
      .filter((m) => {
        const id = (m._id ?? m.id) as string | undefined;
        if (!id || id === meId) return false;
        if (seen.has(id)) return false; // deduplicate
        seen.add(id);
        return true;
      })
      .filter((m) => {
        if (!memberSearchQuery.trim()) return true;
        const query = memberSearchQuery.toLowerCase();
        return (
          m.name?.toLowerCase().includes(query) ||
          m.email?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aId = (a._id ?? a.id) as string;
        const bId = (b._id ?? b.id) as string;
        const aTime = dmLastMessageTime[aId] || 0;
        const bTime = dmLastMessageTime[bId] || 0;

        // Sort by last message time (most recent first)
        if (aTime !== bTime) {
          return bTime - aTime;
        }

        // If no messages, sort alphabetically
        const aName = (a.name || a.email || "").toLowerCase();
        const bName = (b.name || b.email || "").toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [members, meId, dmLastMessageTime, memberSearchQuery]);

  const me = useMemo(
    () => members.find((m) => (m._id ?? m.id) === meId),
    [members, meId],
  );

  const sortedGroups = useMemo(
    () =>
      groups
        .filter((g) => {
          if (!groupSearchQuery.trim()) return true;
          const query = groupSearchQuery.toLowerCase();
          return (
            g.name?.toLowerCase().includes(query) ||
            g.description?.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          const aTime = groupLastMessageTime[a.id] || 0;
          const bTime = groupLastMessageTime[b.id] || 0;

          // Sort by last message time (most recent first)
          if (aTime !== bTime) {
            return bTime - aTime;
          }

          // If no messages, sort alphabetically by name
          const aName = (a.name || "").toLowerCase();
          const bName = (b.name || "").toLowerCase();
          return aName.localeCompare(bName);
        }),
    [groups, groupLastMessageTime, groupSearchQuery],
  );

  // Sort global DM users by last message time
  const sortedGlobalDmUsers = useMemo(
    () =>
      globalDmUsers
        .filter((u) => u._id !== meId) // Exclude self
        .sort((a, b) => {
          const aTime = globalDmLastMessageTime[a._id] || 0;
          const bTime = globalDmLastMessageTime[b._id] || 0;

          // Sort by last message time (most recent first)
          if (aTime !== bTime) {
            return bTime - aTime;
          }

          // If no messages, sort alphabetically
          const aName = (a.name || a.email || "").toLowerCase();
          const bName = (b.name || b.email || "").toLowerCase();
          return aName.localeCompare(bName);
        }),
    [globalDmUsers, meId, globalDmLastMessageTime],
  );

  // console.log("zzzzzzzzzzzzzzz", me);
  useEffect(() => {
    if (members?.length > 0) {
      if (amIFounder) {
        const admin_apps = CATALOG
          // Exclude Teamforce — it's shown in the BackOffice Apps tab (5th tab) instead
          ?.filter((item) => item.appId !== "teamforce")
          .map((item) => ({
            id: item.appId,
            name: item.name,
            url: item.url,
          }));
        setAdminApps(admin_apps);
      }
    }
  }, [members, amIFounder]);

  const handlePasswordSubmit = () => {
    if (passwordInput === "1122") {
      setTabTransitionDuration(100);
      setActiveWorkspaceView("backOfficeAppMenu");
      setShowPasswordDialog(false);
      setPasswordInput("");
    } else {
      toast.error("Incorrect password");
    }
  };

  // Vaults + GaragePay. Shared by the normal nav lists and the BAT 246
  // sidebar, which otherwise shows only its own entry.
  const walletNavItems = (
    <>
      <SidebarItem
        href="#"
        label="Vaults"
        active={activePopover === "GaragePay" || activePopover === "Vault"}
        collapsed={collapsed}
        icon={
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.6088 15.5471L13.6121 15.5447C13.5194 15.2974 13.484 15.0323 13.5084 14.7693C13.5328 14.5063 13.6165 14.2523 13.7531 14.0263L13.7408 14.014C13.3684 13.6402 12.9928 13.2694 12.625 12.8913C12.5577 12.822 12.4917 12.7787 12.4199 12.7627C12.0664 12.9848 11.6577 13.1035 11.2403 13.1053C10.8228 13.1072 10.4131 12.9921 10.0577 12.7732C9.98379 12.796 9.91575 12.845 9.84542 12.9186C9.53323 13.2457 9.21569 13.5683 8.888 13.8792C8.84016 13.9236 8.79509 13.971 8.75305 14.0209C8.89806 14.2464 8.98928 14.5023 9.01966 14.7687C9.05003 15.0351 9.01875 15.3049 8.92824 15.5573C8.93166 15.5601 8.93496 15.5632 8.9385 15.5657C9.29183 15.8278 9.70067 16.0195 10.041 16.2961C10.1969 16.4237 10.3714 16.5265 10.5585 16.601C10.7563 16.4521 10.998 16.3732 11.2455 16.3765C11.4931 16.3799 11.7325 16.4655 11.9262 16.6197C12.4888 16.2649 13.0497 15.9073 13.6088 15.5471Z" fill="currentColor"/>
            <path d="M15.9539 13.132C16.2194 12.7138 16.482 12.2938 16.7498 11.877C16.8127 11.779 16.8807 11.6833 16.9357 11.5834C16.7776 11.3928 16.6874 11.1551 16.6791 10.9077C16.6709 10.6602 16.7451 10.417 16.8901 10.2163C16.8884 10.2132 16.8868 10.2098 16.8849 10.2067C16.5848 9.68429 16.2387 9.1886 15.9298 8.67091C15.9163 8.64812 15.9026 8.6268 15.8888 8.60697C15.635 8.70075 15.3629 8.73438 15.094 8.70523C14.825 8.67608 14.5664 8.58494 14.3387 8.43896C14.3356 8.44147 14.3324 8.44375 14.3295 8.44626C13.9361 8.79686 13.5789 9.18792 13.2018 9.55732C13.1678 9.58947 13.1383 9.62604 13.1141 9.66606C13.3427 10.0237 13.4648 10.439 13.4661 10.8634C13.4675 11.2879 13.348 11.704 13.1217 12.063C13.1341 12.1459 13.1648 12.2276 13.2077 12.2759C13.5287 12.6382 13.8924 12.9622 14.2215 13.3178C14.2598 13.36 14.3008 13.3997 14.3441 13.4367C14.5681 13.3016 14.8195 13.2184 15.0799 13.1933C15.3403 13.1682 15.603 13.2018 15.8486 13.2916C15.8791 13.2498 15.9124 13.1973 15.9539 13.132Z" fill="currentColor"/>
            <path d="M10.5609 5.2539C10.0138 5.57509 9.48261 5.92557 8.94851 6.26956C8.91055 6.29395 8.86462 6.32188 8.82553 6.35231C8.88969 6.57926 8.90734 6.81683 8.87741 7.05077C8.84748 7.28471 8.7706 7.51019 8.65137 7.71367C8.67892 7.74921 8.70885 7.81431C9.11822 8.19865 9.50381 8.57501 9.87903 8.96128C9.90397 8.98734 9.93133 9.01097 9.96075 9.03183C10.3371 8.77185 10.7842 8.6336 11.2416 8.63574C11.6991 8.63788 12.1448 8.78031 12.5188 9.0438C12.5689 9.01284 12.6145 8.97497 12.6541 8.93131C12.972 8.59461 13.297 8.26362 13.636 7.94835C13.6793 7.90883 13.72 7.86657 13.758 7.82184C13.6326 7.59735 13.5582 7.34798 13.5402 7.09148C13.5222 6.83498 13.5609 6.57765 13.6537 6.33784C13.6042 6.29626 13.5512 6.25912 13.4952 6.22682C13.1161 6.00103 12.7467 5.75871 12.3761 5.51901C12.1954 5.40219 12.0202 5.27008 11.829 5.19189C11.6517 5.31337 11.4432 5.38119 11.2284 5.38726C11.0136 5.39332 10.8017 5.33737 10.6178 5.22609C10.5981 5.23385 10.5791 5.24315 10.5609 5.2539Z" fill="currentColor"/>
            <path d="M9.29351 12.2744C9.3285 12.2357 9.35494 12.1744 9.3701 12.1082C9.12681 11.7422 8.99678 11.3126 8.99627 10.8731C8.99576 10.4337 9.1248 10.0038 9.36725 9.63724C9.34622 9.60682 9.32212 9.57863 9.29533 9.55312C8.91669 9.18566 8.55903 8.79562 8.16808 8.44297C8.12374 8.40297 8.06322 8.37458 7.99711 8.35498C7.5971 8.57795 7.12562 8.63524 6.68385 8.51455C6.64052 8.56481 6.60202 8.61904 6.56885 8.67651C6.29633 9.1281 6.00978 9.57125 5.72301 10.0141C5.66112 10.1096 5.59707 10.2034 5.54749 10.3006C5.67629 10.4847 5.74663 10.7033 5.74934 10.9279C5.75204 11.1526 5.68698 11.3728 5.56264 11.5599C5.56504 11.5646 5.56743 11.5693 5.57005 11.5737C5.89888 12.1295 6.25712 12.6679 6.59506 13.2182C6.61906 13.2581 6.64689 13.2955 6.67815 13.33C6.91443 13.2425 7.16682 13.207 7.41807 13.226C7.66931 13.2451 7.91349 13.3181 8.13389 13.4402C8.53669 13.0686 8.92604 12.6806 9.29351 12.2744Z" fill="currentColor"/>
            <path d="M11.7537 1.79579C11.7537 1.30009 11.7582 0.804173 11.7521 0.308594C11.7582 0.804287 11.754 1.30021 11.7533 1.79579C11.7533 1.92515 11.7492 2.05463 11.754 2.18331C11.7492 2.05452 11.7533 1.92504 11.7537 1.79579Z" fill="currentColor"/>
            <path d="M10.7753 1.78484C10.7761 2.17305 10.7686 2.56137 10.7784 2.94936C10.7686 2.56183 10.776 2.17305 10.7756 1.78484C10.7756 1.29963 10.7701 0.814309 10.7774 0.329102C10.7701 0.814309 10.7753 1.29963 10.7753 1.78484Z" fill="currentColor"/>
            <path d="M5.29425 3.39058C5.38609 3.53493 5.44363 3.69842 5.46244 3.86848C5.48125 4.03854 5.46083 4.21065 5.40276 4.37159C5.70195 4.67398 5.99761 4.97989 6.31242 5.26484C6.31962 5.2713 6.32724 5.27727 6.33522 5.28274C6.6554 5.11521 7.01967 5.05111 7.37781 5.09929C7.73595 5.14746 8.07033 5.30554 8.33486 5.55173C8.49044 5.52437 8.63314 5.44025 8.78348 5.31716C8.84981 5.2629 8.93062 5.22689 9.00004 5.17628C9.35519 4.91846 9.76837 4.73701 10.0913 4.441C10.0543 4.19963 10.0972 3.95278 10.2136 3.73809C10.3299 3.52339 10.5133 3.35264 10.7357 3.25187C10.7655 3.15385 10.7798 3.0518 10.7782 2.94937C10.7684 2.56184 10.7758 2.17306 10.7751 1.78485C10.7751 1.29964 10.7701 0.814318 10.7773 0.329112C10.7807 0.0985328 10.6925 -0.0108866 10.4535 0.000853151C9.90469 0.0279801 9.35474 0.0374403 8.80639 0.0771048C8.68033 0.0861091 8.53341 0.159055 8.44234 0.249213C7.38895 1.29166 6.34445 2.3438 5.29425 3.39058Z" fill="currentColor"/>
            <path d="M11.7742 3.31417C11.9389 3.41363 12.0752 3.55396 12.1697 3.72156C12.2643 3.88916 12.3139 4.07835 12.3139 4.27079C12.3139 4.29358 12.3131 4.31638 12.3117 4.33918C12.3595 4.40916 12.4118 4.47287 12.4769 4.51812C12.9806 4.86861 13.4996 5.19892 14.0286 5.50974C14.0856 5.5429 14.1653 5.56137 14.246 5.56399C14.4927 5.38226 14.7828 5.26858 15.0873 5.23435C15.3918 5.20012 15.6999 5.24655 15.9808 5.36897C16.0738 5.34926 16.1657 5.30834 16.2238 5.25568C16.5401 4.96891 16.8361 4.65991 17.1368 4.35593C17.0775 4.20076 17.0535 4.03434 17.0665 3.86875C17.0795 3.70315 17.1292 3.54252 17.212 3.39851C16.1738 2.35435 15.141 1.30472 14.0981 0.265239C14.0001 0.167445 13.8416 0.0885721 13.7053 0.0780861C13.1582 0.0363699 12.6082 0.0277076 12.0595 0.00126453C11.8368 -0.00944946 11.7493 0.0906238 11.7517 0.309007C11.7579 0.8047 11.7537 1.30062 11.7533 1.7962C11.7533 1.92557 11.7489 2.05505 11.7533 2.18373C11.7679 2.55906 11.71 2.94841 11.7742 3.31417Z" fill="currentColor"/>
            <path d="M21.0968 4.28663C20.4791 4.28948 19.8563 4.24264 19.2446 4.29871C19.1978 4.44363 19.122 4.57747 19.0217 4.69204C18.9214 4.80662 18.7988 4.89951 18.6614 4.96503C18.5239 5.03055 18.3746 5.06732 18.2224 5.07308C18.0703 5.07885 17.9185 5.05348 17.7765 4.99854C17.4469 5.29853 17.148 5.63887 16.8444 5.96736C16.8171 5.99875 16.7957 6.03481 16.7812 6.07382C16.9699 6.38999 17.054 6.75774 17.0212 7.12453C16.9885 7.49132 16.8406 7.83836 16.5988 8.11608C16.604 8.12497 16.6096 8.13398 16.6154 8.1431C16.9599 8.67754 17.2921 9.21985 17.6334 9.75646L17.6386 9.76456C17.6908 9.75708 17.7434 9.75327 17.7961 9.75316C17.9586 9.7529 18.1192 9.78822 18.2666 9.85665C18.2766 9.84719 18.2867 9.83739 18.297 9.82725C19.1291 8.99748 19.9583 8.1646 20.7843 7.32861C20.8928 7.21816 21.0009 7.06862 21.027 6.92239C21.1693 6.13844 21.2858 5.34948 21.4113 4.56303C21.4238 4.32538 21.2856 4.28572 21.0968 4.28663Z" fill="currentColor"/>
            <path d="M2.39773 4.30026C2.52983 4.30026 2.66194 4.30311 2.79392 4.30026C2.66194 4.30266 2.52983 4.29958 2.39773 4.29969C2.09592 4.29969 1.79365 4.31109 1.4924 4.29639C1.79342 4.312 2.09592 4.30026 2.39773 4.30026Z" fill="currentColor"/>
            <path d="M4.20497 9.80849C4.23141 9.83482 4.25706 9.85818 4.28191 9.8787C4.39461 9.84168 4.5125 9.82287 4.63114 9.82296C4.67988 9.82296 4.72858 9.82612 4.77691 9.83243C4.80367 9.79904 4.82859 9.76422 4.85157 9.72813C5.18416 9.21181 5.52325 8.69857 5.827 8.16549C5.85029 8.12242 5.86667 8.07595 5.87555 8.0278C5.61898 7.75582 5.45645 7.40868 5.41189 7.03744C5.36733 6.6662 5.44308 6.29045 5.62799 5.96547L5.62492 5.9616C5.36276 5.66206 5.0638 5.39512 4.789 5.10676C4.76871 5.08544 4.74819 5.0647 4.72768 5.04418C4.58542 5.09487 4.43438 5.11622 4.28365 5.10696C4.13292 5.09769 3.98563 5.058 3.85066 4.99027C3.71569 4.92255 3.59583 4.82819 3.4983 4.71289C3.40078 4.59759 3.32762 4.46373 3.28323 4.31939C3.1396 4.3014 2.99478 4.29477 2.85011 4.29956C2.83126 4.30017 2.81227 4.30063 2.79312 4.30093C2.66113 4.30332 2.52903 4.30025 2.39693 4.30093C2.09511 4.30093 1.79284 4.31233 1.49159 4.29751C1.21884 4.28383 1.11364 4.39451 1.15262 4.6603C1.26056 5.39535 1.35642 6.13234 1.48077 6.86465C1.50767 7.02319 1.605 7.19314 1.71898 7.30996C2.54065 8.14965 3.3719 8.97998 4.20497 9.80849Z" fill="currentColor"/>
            <path d="M14.818 16.6244C14.5645 16.5602 14.3288 16.4398 14.1283 16.272C14.0923 16.2837 14.0579 16.2996 14.0257 16.3195C13.5951 16.5847 13.1735 16.8645 12.7433 17.1307C12.6048 17.2164 12.4631 17.2972 12.3444 17.3981C12.3471 17.4299 12.3486 17.4619 12.3486 17.4944C12.3487 17.6959 12.2943 17.8937 12.1911 18.0667C12.088 18.2398 11.9399 18.3818 11.7627 18.4776C11.7372 18.5418 11.7228 18.6099 11.72 18.679C11.7034 19.8199 11.7109 20.9612 11.7124 22.1024C11.7124 22.2057 11.7252 22.3091 11.7359 22.4706C11.8487 22.4199 11.9048 22.4088 11.9416 22.3761C12.8588 21.5631 13.7786 20.753 14.6827 19.9256C14.7841 19.8327 14.8367 19.6406 14.8391 19.4924C14.8531 18.5884 14.8491 17.6838 14.845 16.7797C14.8445 16.7268 14.8354 16.6744 14.818 16.6244Z" fill="currentColor"/>
            <path d="M10.113 17.494C10.113 17.456 10.1149 17.4179 10.1187 17.3801C10.104 17.3668 10.0883 17.3545 10.072 17.3432C9.57458 17.0028 9.05917 16.6885 8.5514 16.363C8.509 16.3359 8.46808 16.3093 8.42693 16.2871C8.21288 16.4726 7.95682 16.603 7.68094 16.6671C7.66772 16.7218 7.66208 16.7781 7.66419 16.8343C7.68482 17.6955 7.67969 18.5578 7.66692 19.4194C7.66293 19.6904 7.74568 19.9006 7.94355 20.0754C8.78205 20.8165 9.62067 21.5574 10.4594 22.298C10.5285 22.3589 10.6143 22.4006 10.7671 22.4997C10.7777 22.2852 10.7893 22.16 10.7899 22.0347C10.7914 21.0006 10.7865 19.9665 10.7931 18.9323C10.794 18.7888 10.797 18.6474 10.7757 18.5143C10.5785 18.4264 10.411 18.2832 10.2934 18.1022C10.1758 17.9212 10.1131 17.7099 10.113 17.494Z" fill="currentColor"/>
            <path d="M1.36804 3.35971C1.98238 3.34888 2.599 3.3825 3.2113 3.34831C3.29417 3.34369 3.37671 3.33433 3.45852 3.32027C3.56254 3.18167 3.69743 3.0692 3.85247 2.99178C4.00752 2.91437 4.17847 2.87414 4.35177 2.87427C4.37943 2.87427 4.40682 2.87526 4.43395 2.87724C4.46867 2.84859 4.50252 2.81876 4.5355 2.78776C5.31147 2.05545 6.05005 1.28324 6.80276 0.526655C6.87411 0.454279 6.93714 0.373468 7.03539 0.260743C6.92768 0.240113 6.87765 0.218457 6.83023 0.223358C4.95107 0.416324 3.09173 0.722926 1.26432 1.20836C1.03921 1.26809 0.947797 1.40611 0.959194 1.6335C0.98199 2.09625 1.00821 2.55912 1.01516 3.02222C1.01903 3.27194 1.12013 3.3637 1.36804 3.35971Z" fill="currentColor"/>
            <path d="M21.1161 1.17718C19.4734 0.878785 17.8321 0.573094 16.189 0.27675C15.9725 0.237769 15.7493 0.239707 15.454 0.216797C15.5286 0.333055 15.5458 0.373745 15.5748 0.40281C16.3913 1.22346 17.185 2.06906 18.0394 2.84777C18.0864 2.84183 18.1337 2.83886 18.1811 2.83887C18.3627 2.83875 18.5416 2.88294 18.7022 2.96759C18.8629 3.05224 19.0004 3.1748 19.103 3.32465C19.1291 3.32853 19.1551 3.33191 19.1809 3.3348C19.8305 3.4074 20.4943 3.35155 21.1521 3.35759C21.3623 3.35964 21.4738 3.28977 21.4796 3.06364C21.491 2.61126 21.5052 2.15831 21.54 1.7073C21.5645 1.38291 21.4196 1.23246 21.1161 1.17718Z" fill="currentColor"/>
            <path d="M5.50498 14.5095C5.53955 14.5072 5.57354 14.4995 5.60574 14.4867C5.67314 14.2507 5.78967 14.0316 5.94768 13.8437C5.94172 13.8267 5.93409 13.8102 5.92488 13.7946C5.5687 13.2031 5.19656 12.6206 4.82009 12.0419C4.6231 12.0754 4.42073 12.0557 4.2339 11.9849C4.11638 12.0953 4.004 12.2116 3.89196 12.3276C3.20273 13.0395 3.24445 12.7888 3.62217 13.7372C3.85788 14.3289 4.16186 14.7092 4.76321 14.5122C5.07529 14.5119 5.29082 14.5218 5.50498 14.5095Z" fill="currentColor"/>
            <path d="M17.4904 14.5117C17.5401 14.5132 17.5898 14.5147 17.6394 14.5147C17.6819 14.5147 17.7244 14.5135 17.767 14.5123C17.7244 14.5135 17.6818 14.5147 17.6394 14.5147C17.5898 14.5147 17.5401 14.5131 17.4904 14.5117Z" fill="currentColor"/>
            <path d="M19.0084 12.7288C18.7663 12.4984 18.5379 12.2537 18.2993 12.0196C18.2634 11.9839 18.2256 11.9501 18.1861 11.9185C18.0614 11.9648 17.9295 11.9885 17.7965 11.9883C17.7678 11.9883 17.7395 11.9873 17.7114 11.9851C17.6878 12.0159 17.6637 12.0507 17.6386 12.0901C17.3195 12.5902 17.0076 13.0944 16.6891 13.5946C16.6449 13.6639 16.6024 13.7291 16.5738 13.7967C16.7485 14.0004 16.8738 14.2416 16.9398 14.5017C17.0109 14.5232 17.092 14.5288 17.1868 14.5179C17.2429 14.5118 17.2993 14.509 17.3557 14.5094C17.384 14.5094 17.4127 14.5094 17.4407 14.5106L17.4904 14.5119C17.5401 14.5134 17.5898 14.5149 17.6394 14.5149C17.6819 14.5149 17.7244 14.5137 17.767 14.5125L17.8097 14.5112C17.9038 14.5067 17.9982 14.5089 18.092 14.518C18.3823 14.5522 18.5548 14.4382 18.6633 14.1652C18.7906 13.8454 18.9514 13.5383 19.0975 13.2264C19.1847 13.0394 19.1657 12.8785 19.0084 12.7288Z" fill="currentColor"/>
            <path d="M16.9163 15.4451C16.8353 15.7073 16.6937 15.9468 16.503 16.1443C16.3122 16.3417 16.0778 16.4915 15.8185 16.5816C15.7787 16.6505 15.7501 16.7224 15.7463 16.7916C15.7192 17.2745 15.7342 17.7604 15.7381 18.2445C15.7389 18.3448 15.7609 18.445 15.7738 18.5452L15.8613 18.5712C16.6452 17.6197 17.3431 16.6102 17.9724 15.4377C17.56 15.4375 17.2364 15.4272 16.9163 15.4451Z" fill="currentColor"/>
            <path d="M6.74167 16.6261C6.47061 16.5371 6.22543 16.3831 6.02751 16.1776C5.82959 15.9721 5.68492 15.7213 5.60611 15.447C5.59865 15.445 5.59102 15.4437 5.58331 15.4432C5.26542 15.4245 4.94571 15.4352 4.5159 15.4352C5.16809 16.6061 5.85367 17.6223 6.67408 18.6231C6.72321 18.4969 6.75102 18.4585 6.75136 18.4197C6.75581 17.8384 6.76481 17.2571 6.75011 16.6772C6.7495 16.6599 6.74666 16.6427 6.74167 16.6261Z" fill="currentColor"/>
            <path d="M20.3683 9.03784C19.8651 9.53934 19.3611 10.0398 18.8672 10.5502C18.9376 10.7862 18.9283 11.0388 18.8409 11.269C18.9986 11.5502 19.3239 11.7084 19.521 11.9615L19.6448 11.951L20.5893 9.01424L20.4981 8.96729C20.4541 8.99042 20.4017 9.00456 20.3683 9.03784Z" fill="currentColor"/>
            <path d="M3.58025 11.3212C3.48945 11.0696 3.49159 10.7938 3.58629 10.5436C3.11818 10.0181 2.6006 9.53619 2.09932 9.04016C2.08428 9.02523 2.04427 9.03548 1.93793 9.02979L2.855 11.8944L2.99599 11.9195C3.1893 11.7191 3.41691 11.5389 3.58025 11.3212Z" fill="currentColor"/>
          </svg>
        }
        popover={true}
        activePopover={activePopover}
        setActivePopover={setActivePopoverNav}
        setActiveContainer={setActiveContainer}
        navPopover="GaragePay"
        onClick={() => {
          setActiveContainer && setActiveContainer(null);
          setActivePopoverNav("GaragePay");
        }}
      />

      {/* GaragePay. Collapsed rail keeps the single icon button;
          expanded rail is a dropdown with the two invoice
          surfaces — One-time and Recurring. */}
      {collapsed ? (
        <SidebarItem
          href="#"
          label="GaragePay"
          active={activePopover === "Orders"}
          collapsed={collapsed}
          icon={
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.5075 0V23.7757L13.1819 24.2243V4.1064L21.5327 6.43566V18.8756V21.5327L24 20.7045V4.60676L10.5075 0Z" fill="currentColor"/>
              <path d="M8.07476 5.41776L9.26527 5.74558V2.6399L5.40042 1.32861V22.8958L8.07476 23.3444V5.41776Z" fill="currentColor"/>
              <path d="M2.70884 6.90132L4.08914 7.2809V4.17522L0 2.79492V21.9984L2.67433 22.4297L2.70884 6.90132Z" fill="currentColor"/>
            </svg>
          }
          // Pending invoice count. SidebarItem renders this as
          // a red pill next to the label (or a red dot when
          // the sidebar is collapsed). Replaces the top-level
          // "Pending Invoices" banner we used to render above.
          badge={pendingInvoiceCount > 0 ? String(pendingInvoiceCount) : undefined}
          popover={true}
          activePopover={activePopover}
          setActivePopover={setActivePopoverNav}
          setActiveContainer={setActiveContainer}
          navPopover="Orders"
          onClick={() => {
            setActiveContainer && setActiveContainer(null);
            setActivePopoverNav("Orders");
          }}
        />
      ) : (
        <div className="flex flex-col">
          <button
            onClick={toggleGaragePay}
            title="GaragePay"
            className={cn(
              "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
              activePopover === "Orders"
                ? "text-white"
                : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
            )}
          >
            <div className="flex items-center gap-2">
              <svg
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  activePopover === "Orders" ? "text-white" : "text-[#c7c7da] group-hover:text-white"
                )}
                viewBox="0 0 24 25"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M10.5075 0V23.7757L13.1819 24.2243V4.1064L21.5327 6.43566V18.8756V21.5327L24 20.7045V4.60676L10.5075 0Z" fill="currentColor"/>
                <path d="M8.07476 5.41776L9.26527 5.74558V2.6399L5.40042 1.32861V22.8958L8.07476 23.3444V5.41776Z" fill="currentColor"/>
                <path d="M2.70884 6.90132L4.08914 7.2809V4.17522L0 2.79492V21.9984L2.67433 22.4297L2.70884 6.90132Z" fill="currentColor"/>
              </svg>
              <span className="font-medium">GaragePay</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Total pending invoices while collapsed. Expanded,
                  the count moves onto the One-time / Recurring rows. */}
              {pendingInvoiceCount > 0 && !isGaragePayExpanded && (
                <PendingCountPill count={pendingInvoiceCount} />
              )}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                  isGaragePayExpanded ? "transform rotate-180" : ""
                )}
              />
            </div>
          </button>

          <CollapsibleSection isExpanded={isGaragePayExpanded}>
            {/* Vertical line connecting nested items */}
            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

            <button
              onClick={() => openGaragePayTab("one_time")}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative w-full text-left cursor-pointer",
                activePopover === "Orders" && garagePayTab === "one_time"
                  ? "bg-[#1a1a22] text-[#c7c7da] border border-[#3b3b4a]"
                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
              )}
            >
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <span>One-time</span>
              {!!pendingInvoiceSplit?.oneTime && (
                <PendingCountPill count={pendingInvoiceSplit.oneTime} className="ml-auto" />
              )}
            </button>

            <button
              onClick={() => openGaragePayTab("recurring")}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative w-full text-left cursor-pointer",
                activePopover === "Orders" && garagePayTab === "recurring"
                  ? "bg-[#1a1a22] text-[#c7c7da] border border-[#3b3b4a]"
                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
              )}
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span>Recurring</span>
              {!!pendingInvoiceSplit?.recurring && (
                <PendingCountPill count={pendingInvoiceSplit.recurring} className="ml-auto" />
              )}
            </button>
          </CollapsibleSection>
        </div>
      )}
    </>
  );

  return (
    <aside
      className={cn(
        "relative border-r border-[#2E2E2E] bg-[#0a0a0d] h-full flex flex-col overflow-hidden transition-all duration-150",
        collapsed ? "w-0 border-r-0" : "w-[272px]"
      )}
      style={{ width: collapsed ? 0 : 272 }}
    >
      {/* header */}
      <div className="sticky top-0 z-10 px-3 h-[48px] border-b border-[#2E2E2E] bg-[#0a0a0d]/95 backdrop-blur flex items-center justify-between gap-2">
        {!collapsed && (
          <>
            {/*
              On a white-label domain this is branding, not a switcher.
              /select-organization lists every office the visitor belongs to,
              which has no place on a client's site — so the link points at
              the workspace instead and the chevron below is dropped. The logo
              and name stay: removing the element would take the client's
              branding with it.
            */}
            <Link
              href={isWhitelabel ? "/workspace" : "/select-organization"}
              className="flex items-center min-w-0"
              title={isWhitelabel ? undefined : "Switch Workspace"}
              aria-label={isWhitelabel ? undefined : "Switch Workspace"}
            >
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer min-w-0 select-none">
                {whitelabelLoading ? (
                  <div className="h-[22px] w-[22px] bg-white/10 animate-pulse rounded flex-shrink-0" />
                ) : (
                  <div className="h-[22px] w-[22px] rounded flex items-center justify-center overflow-hidden flex-shrink-0 bg-white/[0.03]">
                    <img
                      src={isBat246Office ? BAT246_LOGO_SRC : (isWhitelabel && whitelabelOrgIcon) || orgColoredIcon || orgIcon || orgWhiteIcon || orgColoredLogo || orgWhiteLogo || "/logo-icon.svg"}
                      alt="Organization Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                <span className="text-sm font-bold text-white/90 truncate max-w-[120px]">
                  {isBat246Office ? BAT246_DISPLAY_NAME : isWhitelabel && whitelabelOrgName ? whitelabelOrgName : (orgName || "Garage")}
                </span>
                {/* The chevron advertises a switcher; there isn't one here. */}
                {!isWhitelabel && (
                  <ChevronDown className="h-3.5 w-3.5 text-[#8888a0] flex-shrink-0" />
                )}
                {/* Plan badge (TRIAL / PRO / BASIC) — commented out per
                    founder request; upgrade signalling is handled elsewhere.
                {!isWhitelabel && planSlug && (
                  <span
                    className={cn(
                      "text-[8px] px-1 py-0.5 rounded font-medium flex-shrink-0 ml-1.5",
                      isTrial
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : planSlug === "pro"
                          ? "bg-brand/15 text-brand border border-brand/30"
                          : "bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/30",
                    )}
                  >
                    {isTrial ? `TRIAL` : planSlug === "pro" ? "PRO" : "BASIC"}
                  </span>
                )}
                */}
              </div>
            </Link>

            {!isBat246Office && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-[#2a2a35] hover:border-[#3b3b4a] bg-[#111116] hover:bg-[#1a1a22] active:bg-[#20202a] text-white text-xs font-bold transition-all cursor-pointer select-none ml-2 shrink-0"
                >
                  <span>Earn</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#8888a0] flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 bg-[#1a1a22] border-[#2a2a35] text-[#c7c7da] z-[9999] p-1.5 shadow-xl"
                align="end"
              >
                <DropdownMenuItem
                  className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
                  onClick={() => {
                    // Deliberately leaves activeContainer/activePopover alone:
                    // clearing them would drop the user back on the office
                    // stream. This only opens the right panel.
                    window.dispatchEvent(
                      new CustomEvent("right-panel:open-information", {
                        detail: {
                          type: "grow_network",
                          affiliateId: affiliateId,
                        },
                      })
                    );
                  }}
                >
                  <TrendingUp className="h-4 w-4 mr-2 text-white stroke-[2.5]" />
                  Grow Your Network
                </DropdownMenuItem>
                {/* TODO re-enable rooms billing — office-creation entry
                    hidden while Conference Rooms billing is paused. When
                    rooms billing is switched back on, restore this
                    DropdownMenuItem so founders can launch new offices
                    from the sidebar again. */}
                {/*
                  Launching a new office is a Garage action, not a client
                  one: on a white-label domain the site is that single
                  office, so offering to create another breaks the illusion.
                  Still available on my.garage.app.
                */}
                {!isWhitelabel && (
                  <DropdownMenuItem
                    className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
                    onClick={() => {
                      setActiveContainer && setActiveContainer(null);
                      setActivePopoverNav(null);
                      router.push("/office-payment?newOffice=true");
                    }}
                  >
                    <Building className="h-4 w-4 mr-2 text-white stroke-[2]" />
                    Launch An Office
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
                  onClick={() => {
                    setActiveContainer && setActiveContainer(null);
                    setActivePopoverNav(null);
                    setIsEnrollDownlineOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2 text-white stroke-[2.5]" />
                  Enroll a Downline
                </DropdownMenuItem>

                {/*
                  Whitelabel checkout. Founder-only because
                  POST /whitelabel-addon/purchase is gated by
                  `requireFounder`, and hidden on a white-label domain —
                  that office already has the add-on, and offering to buy
                  it on the client's own site breaks the illusion.
                */}
                {amIFounder && !isWhitelabel && (
                  <DropdownMenuItem
                    className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
                    onClick={() => {
                      setActiveContainer && setActiveContainer(null);
                      setActivePopoverNav("Whitelabel");
                    }}
                  >
                    <Globe className="h-4 w-4 mr-2 text-white stroke-[2]" />
                    Whitelabel
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </>
        )}
      </div>

      {/* contents (scroll area). Keep width in sync with column size */}
      <div
        className="flex-1 py-3 space-y-6 overflow-y-auto overscroll-contain scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* workspace nav */}
        <nav className="px-2 flex flex-col gap-1.5">
          <SidebarHeader top collapsed={collapsed}>
            Workspace
          </SidebarHeader>

          {/* Workspace Category Switcher */}
          {!collapsed && workspaceTabs.length > 1 && (
            <div className={cn(
              "mb-4 flex w-full items-center bg-[#111116] border-2 border-[#2a2a35] rounded-lg p-0.5 select-none gap-0.5 overflow-hidden"
            )}>
              {workspaceTabs.map((tab) => {
                const isActive = activeWorkspaceView === tab.id;
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setTabTransitionDuration(400);
                      setActiveWorkspaceView(tab.id as any);
                    }}
                    className={cn(
                      "relative flex items-center h-8 rounded-md cursor-pointer overflow-hidden select-none justify-center",
                      isActive
                        ? "text-brand-foreground font-medium"
                        : "text-[#c7c7da] hover:bg-[#1a1a22] hover:text-white w-8 flex-shrink-0"
                    )}
                    style={{
                      width: isActive ? getLeftTabWidth(tab.id, workspaceTabs.length) : 32,
                      transition: `width ${tabTransitionDuration}ms cubic-bezier(0.16, 1, 0.3, 1), padding ${tabTransitionDuration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                    }}
                    title={tab.label}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeWorkspaceTabIndicator"
                        className="absolute inset-0 bg-brand rounded-md shadow-sm"
                        transition={
                          tabTransitionDuration === 400
                            ? { type: "spring", stiffness: 180, damping: 24, mass: 1 }
                            : { type: "spring", stiffness: 700, damping: 38, mass: 0.5 }
                        }
                        style={{ zIndex: 0 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
                      <IconComponent className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-75",
                        isActive ? "text-brand-foreground" : "text-[#c7c7da]"
                      )} />
                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.span
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={
                              tabTransitionDuration === 400
                                ? { type: "spring", stiffness: 180, damping: 24, mass: 1 }
                                : { type: "spring", stiffness: 700, damping: 38, mass: 0.5 }
                            }
                            className="text-[11px] sm:text-xs tracking-wide"
                          >
                            {tab.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Collapsed Category Switcher */}
          {collapsed && workspaceTabs.length > 1 && (
            <div className="flex flex-col items-center gap-2 py-2 mb-3 bg-[#111116] border-2 border-[#2a2a35] rounded-lg">
              {workspaceTabs.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeWorkspaceView === tab.id;
                return (
                  <Button
                    key={tab.id}
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setTabTransitionDuration(100);
                      setActiveWorkspaceView(tab.id as any);
                    }}
                    className={cn(
                      "h-8 w-8 rounded-md",
                      isActive
                        ? "bg-brand text-brand-foreground hover:bg-brand hover:text-brand-foreground"
                        : "text-[#c7c7da] hover:bg-[#1a1a22] hover:text-white"
                    )}
                    title={tab.label}
                  >
                    <IconComponent className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          )}

          {/* Trial Banner - hidden. Re-enable by removing the false && */}
          {false && isTrial && trialDaysRemaining !== null && !collapsed && (
            <Link
              href="/office-payment"
              className="mb-3 px-2 py-2 rounded-lg bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 hover:border-amber-500/50 transition-all group w-full block"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/20">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-amber-300">
                    Pro Trial
                  </p>
                  <p className="text-[10px] text-amber-400/70">
                    {trialDaysRemaining === 1
                      ? "Ends tomorrow"
                      : `${trialDaysRemaining} days remaining`}
                  </p>
                </div>
                <div className="text-[10px] text-amber-400 group-hover:text-amber-300 transition-colors">
                  Upgrade →
                </div>
              </div>
            </Link>
          )}

          {/* Pending Invoices banner removed — the count now surfaces
              as a red badge on the GaragePay nav item below. See
              SidebarItem `badge` prop where GaragePay is rendered. */}

          {/* BAT 246 office — this is the whole sidebar: its own entry plus
              Vaults and GaragePay. */}
          {isBat246Office && (
            <div className="space-y-1">
              <SidebarItem
                href={BAT246_HOME_PATH}
                label={BAT246_DISPLAY_NAME}
                active={!activePopover && !!pathname?.startsWith(BAT246_HOME_PATH)}
                collapsed={collapsed}
                icon={<img src={BAT246_LOGO_SRC} alt="" className="h-4 w-4 object-contain" />}
                activePopover={activePopover}
                setActivePopover={setActivePopoverNav}
                setActiveChatId={setActiveChatId}
                setActiveContainer={setActiveContainer}
              />
              {walletNavItems}
            </div>
          )}

          {/* Category-specific Navigation Lists */}
          {!isBat246Office && (activeWorkspaceView === "customers" ||
            activeWorkspaceView === "employees" ||
            activeWorkspaceView === "aiOffice" ||
            activeWorkspaceView === "founders" ||
            activeWorkspaceView === "lobby") && (
              <>
                {(activeWorkspaceView === "customers" || activeWorkspaceView === "lobby") && (
                  <div className="space-y-1">
                    {collapsed ? (
                      <SidebarItem
                        href="/revenue-network/channels"
                        label="Community"
                        active={activePopover === "Communities" || activePopover === "Community" || activePopover === "ReservedCommunities" || activePopover === "Communities:Discover" || activePopover === "Communities:My" || activePopover === "Conference" || activePopover === "Feeds" || activePopover === "OfficeStream" || activePopover === "Org Cabinet" || (!activePopover && pathname === "/workspace")}
                        collapsed={collapsed}
                        icon={<Users2 className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Communities:Discover"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Communities:Discover");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Community", COMMUNITY_PAGES)}
                          onClick={toggleCommunity}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "Communities" ||
                              activePopover === "Community" ||
                              activePopover === "ReservedCommunities" ||
                              activePopover === "Communities:Discover" ||
                              activePopover === "Communities:My" ||
                              activePopover === "Conference" ||
                              activePopover === "Conference:Notes" ||
                              activePopover === "Feeds" ||
                              activePopover === "OfficeStream" ||
                              activePopover === "Org Cabinet" ||
                              (!activePopover && pathname === "/workspace"))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Community"
                        >
                          <div className="flex items-center gap-2">
                            <Users2 className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "Communities" ||
                                activePopover === "Community" ||
                                activePopover === "ReservedCommunities" ||
                                activePopover === "Communities:Discover" ||
                                activePopover === "Communities:My" ||
                                activePopover === "Conference" ||
                                activePopover === "Conference:Notes" ||
                                activePopover === "Feeds" ||
                                activePopover === "OfficeStream" ||
                                activePopover === "Org Cabinet" ||
                                (!activePopover && pathname === "/workspace"))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">Community</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isCommunityExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>

                        <CollapsibleSection isExpanded={isCommunityExpanded}>
                            {/* Vertical line connecting nested items */}
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            {/* Sub-item: Feeds */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Feeds"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Feeds");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Feeds"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Rss className="h-3.5 w-3.5 shrink-0" />
                              <span>Feeds</span>
                            </Link>

                            {/* Sub-item: Office */}
                            <Link
                              href="/workspace"
                              data-nav-popover={OFFICE_PAGE}
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav(null); // Office Stream maps to null activePopover
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                (!activePopover && pathname === "/workspace")
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Briefcase className="h-3.5 w-3.5 shrink-0" />
                              <span>Office</span>
                            </Link>

                            {/* Sub-item: Cabinet */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Org Cabinet"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Org Cabinet");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Org Cabinet"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Folder className="h-3.5 w-3.5 shrink-0" />
                              <span>Cabinet</span>
                            </Link>

                            {/* Nested group: Conference dropdown */}
                            <div className="flex flex-col relative">
                              <button
                                data-nav-group={navGroup("Conference", CONFERENCE_PAGES)}
                                onClick={() => setIsConferenceDropdownExpanded(!isConferenceDropdownExpanded)}
                                className={cn(
                                  "flex items-center justify-between w-full rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer group/sub",
                                  (activePopover === "Conference" ||
                                    activePopover === "Conference:Notes")
                                    ? "text-white"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Contact className="h-3.5 w-3.5 shrink-0" />
                                  <span>Conference</span>
                                </div>
                                <ChevronDown
                                  className={cn(
                                    "h-3 w-3 text-[#9fa0b8] transition-transform duration-200",
                                    isConferenceDropdownExpanded ? "transform rotate-180" : ""
                                  )}
                                />
                              </button>

                              <CollapsibleSection isExpanded={isConferenceDropdownExpanded} className="pl-4">
                                  {/* Inner vertical guide line */}
                                  <div className="absolute left-[7px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                                  {/* Sub-item: Room */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Conference"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Conference");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Conference"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Video className="h-3.5 w-3.5 shrink-0" />
                                    <span>Room</span>
                                  </Link>

                                  {/* Sub-item: Notes */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Conference:Notes"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Conference:Notes");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Conference:Notes"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    <span>Notes</span>
                                  </Link>
                              </CollapsibleSection>
                            </div>

                            {/* Nested group: Communities dropdown */}
                            <div className="flex flex-col relative">
                              <button
                                data-nav-group={navGroup("Communities", COMMUNITIES_PAGES)}
                                onClick={() => setIsCommunitiesDropdownExpanded(!isCommunitiesDropdownExpanded)}
                                className={cn(
                                  "flex items-center justify-between w-full rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer group/sub",
                                  (activePopover === "Communities" ||
                                    activePopover === "Communities:Discover" ||
                                    activePopover === "Communities:My" ||
                                    activePopover === "ReservedCommunities")
                                    ? "text-white"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Users className="h-3.5 w-3.5 shrink-0" />
                                  <span>Communities</span>
                                </div>
                                <ChevronDown
                                  className={cn(
                                    "h-3 w-3 text-[#9fa0b8] transition-transform duration-200",
                                    isCommunitiesDropdownExpanded ? "transform rotate-180" : ""
                                  )}
                                />
                              </button>

                              <CollapsibleSection isExpanded={isCommunitiesDropdownExpanded} className="pl-4">
                                  {/* Inner vertical guide line */}
                                  <div className="absolute left-[7px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                                  {/* Discover */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Communities:Discover"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Communities:Discover");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      (activePopover === "Communities" || activePopover === "Communities:Discover")
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Compass className="h-3.5 w-3.5 shrink-0" />
                                    <span>Discover</span>
                                  </Link>

                                  {/* My Communities */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Communities:My"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Communities:My");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Communities:My"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Users className="h-3.5 w-3.5 shrink-0" />
                                    <span>My Communities</span>
                                  </Link>

                                  {/* My Reserves */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="ReservedCommunities"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("ReservedCommunities");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "ReservedCommunities"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Gift className="h-3.5 w-3.5 shrink-0" />
                                    <span>My Reserves</span>
                                  </Link>
                              </CollapsibleSection>
                            </div>
                        </CollapsibleSection>
                      </div>
                    )}

                    {/* ========== Live Streams (top-level) ========== */}
                    {collapsed ? (
                      <SidebarItem
                        href="/revenue-network/content"
                        label="Live Streams"
                        active={activePopover === "Live Streams" || activePopover === "Live" || (activePopover ? (activePopover.startsWith("Live:") && activePopover !== "Live:Recording" && activePopover !== "Live:Recorded") : false)}
                        collapsed={collapsed}
                        icon={<Tv className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Live:Discover"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Live:Discover");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Live Streams", LIVE_STREAM_PAGES)}
                          onClick={toggleLiveStreams}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "Live Streams" ||
                              activePopover === "Live" ||
                              (activePopover ? (activePopover.startsWith("Live:") && activePopover !== "Live:Recording" && activePopover !== "Live:Recorded") : false))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Live Streams"
                        >
                          <div className="flex items-center gap-2">
                            <Tv className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "Live Streams" ||
                                activePopover === "Live" ||
                                (activePopover ? (activePopover.startsWith("Live:") && activePopover !== "Live:Recording" && activePopover !== "Live:Recorded") : false))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">Live Streams</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isLiveStreamsExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>

                        <CollapsibleSection isExpanded={isLiveStreamsExpanded}>
                            {/* Vertical line connecting nested items */}
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            {/* Discover */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Live:Discover"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Live:Discover");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Live:Discover"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Compass className="h-3.5 w-3.5 shrink-0" />
                              <span>Discover</span>
                            </Link>

                            {/* Enrolled */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Live:Enrolled"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Live:Enrolled");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Live:Enrolled"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>Enrolled</span>
                            </Link>

                            {/* Reserves */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Live:Reserves"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Live:Reserves");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Live:Reserves"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Gift className="h-3.5 w-3.5 shrink-0" />
                              <span>My Reserves</span>
                            </Link>
                        </CollapsibleSection>
                      </div>
                    )}

                    {collapsed ? (
                      <SidebarItem
                        href="/revenue-network/content"
                        label="Content"
                        active={activePopover === "Long Form Videos" || activePopover === "Content" || (activePopover ? activePopover.startsWith("Content:") : false) || activePopover === "Live:Recording" || activePopover === "Live:Recorded" || activePopover === "Drops" || (activePopover ? activePopover.startsWith("Drops:") : false) || activePopover === "Learn" || activePopover === "Courses" || (activePopover ? activePopover.startsWith("Courses:") : false)}
                        collapsed={collapsed}
                        icon={<Play className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Content:AllVideos"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Content:AllVideos");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Content", CONTENT_PAGES)}
                          onClick={toggleContent}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "Long Form Videos" ||
                              activePopover === "Content" ||
                              (activePopover ? activePopover.startsWith("Content:") : false) ||
                              activePopover === "Live:Recording" ||
                              activePopover === "Live:Recorded" ||
                              activePopover === "Drops" ||
                              (activePopover ? activePopover.startsWith("Drops:") : false) ||
                              activePopover === "Learn" ||
                              activePopover === "Courses" ||
                              (activePopover ? activePopover.startsWith("Courses:") : false))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Content"
                        >
                          <div className="flex items-center gap-2">
                            <Play className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "Long Form Videos" ||
                                activePopover === "Content" ||
                                (activePopover ? activePopover.startsWith("Content:") : false) ||
                                activePopover === "Live:Recording" ||
                                activePopover === "Live:Recorded" ||
                                activePopover === "Drops" ||
                                (activePopover ? activePopover.startsWith("Drops:") : false) ||
                                activePopover === "Learn" ||
                                activePopover === "Courses" ||
                                (activePopover ? activePopover.startsWith("Courses:") : false))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">Content</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isContentExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>

                        <CollapsibleSection isExpanded={isContentExpanded}>
                            {/* Vertical line connecting nested items */}
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            {/* Nested group: Videos dropdown */}
                            <div className="flex flex-col relative">
                              <button
                                data-nav-group={navGroup("Videos", VIDEO_PAGES)}
                                onClick={toggleVideos}
                                className={cn(
                                  "flex items-center justify-between w-full rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer group/sub",
                                  (activePopover === "Content:Videos" || activePopover === "Content:Playlists" || activePopover === "Drops:Feed" || activePopover === "Live:Recording" || activePopover === "Live:Recorded" || activePopover === "Content:AllVideos")
                                    ? "text-white"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Video className="h-3.5 w-3.5 shrink-0" />
                                  <span>Videos</span>
                                </div>
                                <ChevronDown
                                  className={cn(
                                    "h-3 w-3 text-[#9fa0b8] transition-transform duration-200",
                                    isVideosExpanded ? "transform rotate-180" : ""
                                  )}
                                />
                              </button>

                              <CollapsibleSection isExpanded={isVideosExpanded} className="pl-4">
                                  {/* Inner vertical guide line */}
                                  <div className="absolute left-[7px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                                  {/* All Videos */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Content:AllVideos"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Content:AllVideos");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Content:AllVideos"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Play className="h-3.5 w-3.5 shrink-0" />
                                    <span>All Videos</span>
                                  </Link>

                                  {/* Recordings */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Live:Recording"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Live:Recording");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      (activePopover === "Live:Recorded" || activePopover === "Live:Recording")
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Voicemail className="h-3.5 w-3.5 shrink-0" />
                                    <span>Recordings</span>
                                  </Link>

                                  {/* Drops */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Drops:Feed"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Drops:Feed");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      (activePopover === "Drops" || activePopover === "Drops:Feed")
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Camera className="h-3.5 w-3.5 shrink-0" />
                                    <span>Drops</span>
                                  </Link>

                                  {/* Playlists */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Content:Playlists"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Content:Playlists");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Content:Playlists"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <ListVideo className="h-3.5 w-3.5 shrink-0" />
                                    <span>Playlists</span>
                                  </Link>

                                  {/* Videos */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Content:Videos"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Content:Videos");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Content:Videos"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Video className="h-3.5 w-3.5 shrink-0" />
                                    <span>Videos</span>
                                  </Link>
                              </CollapsibleSection>
                            </div>

                            {/* Nested group: Courses dropdown */}
                            <div className="flex flex-col relative">
                              <button
                                data-nav-group={navGroup("Courses", COURSE_PAGES)}
                                onClick={toggleCourses}
                                className={cn(
                                  "flex items-center justify-between w-full rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer group/sub",
                                  (activePopover === "Learn" ||
                                    activePopover === "Courses" ||
                                    (activePopover ? activePopover.startsWith("Courses:") : false))
                                    ? "text-white"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                  <span>Courses</span>
                                </div>
                                <ChevronDown
                                  className={cn(
                                    "h-3 w-3 text-[#9fa0b8] transition-transform duration-200",
                                    isCoursesExpanded ? "transform rotate-180" : ""
                                  )}
                                />
                              </button>

                              <CollapsibleSection isExpanded={isCoursesExpanded} className="pl-4">
                                  {/* Inner vertical guide line */}
                                  <div className="absolute left-[7px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                                  {/* Discover */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Learn"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Learn");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Learn"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Compass className="h-3.5 w-3.5 shrink-0" />
                                    <span>Discover</span>
                                  </Link>

                                  {/* Enrolled Courses */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Courses:Enrolled"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Courses:Enrolled");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Courses:Enrolled"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <BookMarked className="h-3.5 w-3.5 shrink-0" />
                                    <span>Enrolled</span>
                                  </Link>

                                  {/* Analytics */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Courses:Analytics"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Courses:Analytics");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Courses:Analytics"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    <span>Analytics</span>
                                  </Link>

                                  {/* My Reserves */}
                                  <Link
                                    href="/workspace"
                                    data-nav-popover="Courses:Reserves"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveContainer && setActiveContainer(null);
                                      setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                      setActivePopoverNav("Courses:Reserves");
                                      if (pathname !== "/workspace") {
                                        router.push("/workspace");
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                      activePopover === "Courses:Reserves"
                                        ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                        : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                    )}
                                  >
                                    <Gift className="h-3.5 w-3.5 shrink-0" />
                                    <span>Reserves</span>
                                  </Link>
                              </CollapsibleSection>
                            </div>

                            {/* Sub-item: Articles */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Content:Articles"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Content:Articles");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Content:Articles"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span>Articles</span>
                            </Link>

                            {/* Sub-item: Analytics */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Content:Analytics"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Content:Analytics");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Content:Analytics"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                              <span>Analytics</span>
                             </Link>
                            </CollapsibleSection>
                      </div>
                    )}

                    {collapsed ? (
                      <SidebarItem
                        href="/revenue-network/products"
                        label="Digital Products"
                        active={activePopover === "Digital Products" || activePopover === "Products" || (activePopover ? activePopover.startsWith("Products:") : false)}
                        collapsed={collapsed}
                        icon={<ShoppingBag className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Products:Browse"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Products:Browse");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Digital Products", PRODUCT_PAGES)}
                          onClick={toggleProducts}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "Digital Products" ||
                              activePopover === "Products" ||
                              (activePopover ? activePopover.startsWith("Products:") : false))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Digital Products"
                        >
                          <div className="flex items-center gap-2">
                            <ShoppingBag className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "Digital Products" ||
                                activePopover === "Products" ||
                                (activePopover ? activePopover.startsWith("Products:") : false))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">Digital Products</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isProductsExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>

                        <CollapsibleSection isExpanded={isProductsExpanded}>
                            {/* Vertical line connecting nested items */}
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            {/* Sub-item: Discover */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Products:Browse"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Products:Browse");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Products:Browse"
                                  ? "bg-[#1a1a22] text-[#c7c7da] border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Compass className="h-3.5 w-3.5 shrink-0" />
                              <span>Discover</span>
                            </Link>

                            {/* Sub-item: Orders */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Products:Orders"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Products:Orders");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Products:Orders"
                                  ? "bg-[#1a1a22] text-[#c7c7da] border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                              <span>Orders</span>
                            </Link>

                            {/* Sub-item: My Reserves */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Products:Reserves"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Products:Reserves");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Products:Reserves"
                                  ? "bg-[#1a1a22] text-[#c7c7da] border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Gift className="h-3.5 w-3.5 shrink-0" />
                              <span>My Reserves</span>
                            </Link>
                          </CollapsibleSection>
                      </div>
                    )}

                    {/* {collapsed ? (
                      <SidebarItem
                        href="/revenue-network/calls"
                        label="1:1 Calls"
                        active={activePopover === "1:1 Calls" || (activePopover ? activePopover.startsWith("1:1 Calls:") : false)}
                        collapsed={collapsed}
                        icon={<Phone className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("1:1 Calls:calls");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          onClick={() => {
                            setIsCallsExpanded(!isCallsExpanded);
                          }}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "1:1 Calls" ||
                              (activePopover ? activePopover.startsWith("1:1 Calls:") : false))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="1:1 Calls"
                        >
                          <div className="flex items-center gap-2">
                            <Phone className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "1:1 Calls" ||
                                (activePopover ? activePopover.startsWith("1:1 Calls:") : false))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">1:1 Calls</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isCallsExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>

                        {isCallsExpanded && (
                          <div className="relative pl-6 mt-1 flex flex-col gap-1">
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            <Link
                              href="/workspace"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("1:1 Calls:calls");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "1:1 Calls:calls"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Compass className="h-3.5 w-3.5 shrink-0" />
                              <span>Discover</span>
                            </Link>

                            <Link
                              href="/workspace"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav(amIFounder ? "1:1 Calls:purchases" : "1:1 Calls:mycalls");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                (activePopover === "1:1 Calls:purchases" || activePopover === "1:1 Calls:mycalls")
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Headphones className="h-3.5 w-3.5 shrink-0" />
                              <span>My Calls</span>
                            </Link>

                            <Link
                              href="/workspace"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("1:1 Calls:bookings");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "1:1 Calls:bookings"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>Schedule</span>
                            </Link>

                            <Link
                              href="/workspace"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("1:1 Calls:reserves");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "1:1 Calls:reserves"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Gift className="h-3.5 w-3.5 shrink-0" />
                              <span>Reserves</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    )} */}



                    {collapsed ? (
                      <SidebarItem
                        href="/revenue-network/services"
                        label="Services"
                        active={activePopover === "Services" || (activePopover ? activePopover.startsWith("Services:") : false)}
                        collapsed={collapsed}
                        icon={<Briefcase className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Services:Browse"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Services:Browse");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Services", SERVICE_PAGES)}
                          onClick={() => {
                            setIsServicesExpanded(!isServicesExpanded);
                          }}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "Services" ||
                              (activePopover ? activePopover.startsWith("Services:") : false))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Services"
                        >
                          <div className="flex items-center gap-2">
                            <Briefcase className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "Services" ||
                                (activePopover ? activePopover.startsWith("Services:") : false))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">Services</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isServicesExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>

                        {isServicesExpanded && (
                          <div className="relative pl-6 mt-1 flex flex-col gap-1">
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            <Link
                              href="/workspace"
                              data-nav-popover="Services:Browse"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Services:Browse");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Services:Browse"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Compass className="h-3.5 w-3.5 shrink-0" />
                              <span>Discover</span>
                            </Link>

                            <Link
                              href="/workspace"
                              data-nav-popover="Services:Optins"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Services:Optins");
                                if (pathname !== "/workspace") {
                                  router.push("/workspace");
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Services:Optins"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <CreditCard className="h-3.5 w-3.5 shrink-0" />
                              <span>My Services</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Events (attendee view). Discover + Purchases only — the
                        founder console lives in the Founder tab. */}
                    {collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Events"
                        active={activePopover === "Events" || (activePopover ? activePopover.startsWith("Events:") : false)}
                        collapsed={collapsed}
                        icon={<Ticket className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Events"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Events");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Events", EVENT_PAGES)}
                          onClick={() => setIsEventsBrowseExpanded(!isEventsBrowseExpanded)}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "Events" ||
                              (activePopover ? activePopover.startsWith("Events:") : false))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Events"
                        >
                          <div className="flex items-center gap-2">
                            <Ticket className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "Events" ||
                                (activePopover ? activePopover.startsWith("Events:") : false))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">Events</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isEventsBrowseExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>

                        {isEventsBrowseExpanded && (
                          <div className="relative pl-6 mt-1 flex flex-col gap-1">
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            {[
                              { value: "Events", label: "Discover", icon: Compass },
                              { value: "Events:Purchases", label: "Purchases", icon: CreditCard },
                            ].map((item) => (
                              <Link
                                key={item.value}
                                href="/workspace"
                                data-nav-popover={item.value}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setActiveContainer && setActiveContainer(null);
                                  setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                  setActivePopoverNav(item.value);
                                  if (pathname !== "/workspace") {
                                    router.push("/workspace");
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                  (activePopover === item.value ||
                                    (item.value === "Events" && activePopover === "Events:Discover"))
                                    ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                <item.icon className="h-3.5 w-3.5 shrink-0" />
                                <span>{item.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Jobs (member view) — Garage Jobs job board. Page keys
                        use "Job Board" because "Jobs" belongs to the AI Office. */}
                    {isJobsAllowedUser && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Jobs"
                        active={activePopover === "Job Board" || (activePopover ? activePopover.startsWith("Job Board:") : false)}
                        collapsed={collapsed}
                        icon={<BriefcaseBusiness className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Job Board"
                        onClick={() => {
                          setActiveContainer?.(null);
                          setActivePopoverNav("Job Board");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Jobs", JOB_BOARD_PAGES)}
                          onClick={() => setIsJobBoardExpanded(!isJobBoardExpanded)}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "Job Board" ||
                              (activePopover ? activePopover.startsWith("Job Board:") : false))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Jobs"
                        >
                          <div className="flex items-center gap-2">
                            <BriefcaseBusiness className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "Job Board" ||
                                (activePopover ? activePopover.startsWith("Job Board:") : false))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">Jobs</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isJobBoardExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>

                        {isJobBoardExpanded && (
                          <div className="relative pl-6 mt-1 flex flex-col gap-1">
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            {[
                              { value: "Job Board", label: "Discover", icon: Compass },
                              { value: "Job Board:Applications", label: "My Applications", icon: ClipboardList },
                              { value: "Job Board:Saved", label: "Saved", icon: Bookmark },
                            ].map((item) => (
                              <Link
                                key={item.value}
                                href="/workspace"
                                data-nav-popover={item.value}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setActiveContainer?.(null);
                                  setActiveChatId?.({ type: "dm", id: "" });
                                  setActivePopoverNav(item.value);
                                  if (pathname !== "/workspace") {
                                    router.push("/workspace");
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                  (activePopover === item.value ||
                                    (item.value === "Job Board" &&
                                      (activePopover === "Job Board:Job" || activePopover === "Job Board:Apply")))
                                    ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                <item.icon className="h-3.5 w-3.5 shrink-0" />
                                <span>{item.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}


                {activeWorkspaceView === "employees" && (
                  <div className="px-2 -mt-4">
                    <BackOfficeAppSideBar
                      setActivePopover={setActivePopoverNav}
                      activePopover={activePopover}
                      setActiveContainer={setActiveContainer}
                      activeContainer={activeContainer}
                      teamforceSection={teamforceSection}
                      setTeamforceSection={setTeamforceSection}
                      dealsSection={dealsSection}
                      setDealsSection={setDealsSection}
                      networkMailSection={networkMailSection}
                      setNetworkMailSection={setNetworkMailSection}
                      thoughtsSection={thoughtsSection}
                      setThoughtsSection={setThoughtsSection}
                    />
                  </div>
                )}

                {activeWorkspaceView === "aiOffice" && amIFounder && isAiOfficeAllowed && (
                  <div className="space-y-1">
                    <SidebarItem
                      href="#"
                      label="Ai Employees"
                      active={activePopover === "My Ai Employees" || activePopover === "Ai Employees"}
                      collapsed={collapsed}
                      icon={<Bot className="h-4 w-4" />}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                      navPopover="My Ai Employees"
                      onClick={() => {
                        setActiveContainer && setActiveContainer(null);
                        setActivePopoverNav("My Ai Employees");
                      }}
                    />

                    <SidebarItem
                      href="#"
                      label="Tasks"
                      active={activePopover === "My Tasks" || activePopover === "Tasks"}
                      collapsed={collapsed}
                      icon={<ClipboardCheck className="h-4 w-4" />}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                      navPopover="My Tasks"
                      onClick={() => {
                        setActiveContainer && setActiveContainer(null);
                        setActivePopoverNav("My Tasks");
                      }}
                    />

                    <SidebarItem
                      href="#"
                      label="Jobs"
                      active={activePopover === "My Jobs" || activePopover === "Jobs"}
                      collapsed={collapsed}
                      icon={<Briefcase className="h-4 w-4" />}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                      navPopover="My Jobs"
                      onClick={() => {
                        setActiveContainer && setActiveContainer(null);
                        setActivePopoverNav("My Jobs");
                      }}
                    />

                    <SidebarItem
                      href="#"
                      label="Marketplace"
                      active={activePopover === "Job Marketplace" || activePopover === "Marketplace"}
                      collapsed={collapsed}
                      icon={<ShoppingBag className="h-4 w-4" />}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                      navPopover="Job Marketplace"
                      onClick={() => {
                        setActiveContainer && setActiveContainer(null);
                        setActivePopoverNav("Job Marketplace");
                      }}
                    />

                    <SidebarItem
                      href="#"
                      label="Context Library"
                      active={activePopover === "Context Library"}
                      collapsed={collapsed}
                      icon={<Folder className="h-4 w-4" />}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                    />

                    <SidebarItem
                      href="#"
                      label="Integrations"
                      active={activePopover === "Integrations"}
                      collapsed={collapsed}
                      icon={<Zap className="h-4 w-4" />}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                    />

                    {amIFounder && (
                      <SidebarItem
                        href="#"
                        label="Billing"
                        active={activePopover === "Billing"}
                        collapsed={collapsed}
                        icon={<Wallet className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Billing"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Billing");
                        }}
                      />
                    )}
                  </div>
                )}

                {activeWorkspaceView === "founders" && (
                  <div className="space-y-1">
                    {/* ========== Communities (Founder) ==========
                        Unlocked for founders and for members holding the
                        `community` module. */}
                    {canModuleConsole("community") && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Community"
                        active={activePopover?.startsWith("Founder:Communities") || false}
                        collapsed={collapsed}
                        icon={<Rss className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Founder:Communities"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Founder:Communities");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Community", FOUNDER_COMMUNITY_PAGES)}
                          onClick={toggleFounderCommunities}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            activePopover?.startsWith("Founder:Communities")
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Community"
                        >
                          <div className="flex items-center gap-2">
                            <Rss className={cn("h-4 w-4 shrink-0 transition-colors", activePopover?.startsWith("Founder:Communities") ? "text-white" : "text-[#c7c7da] group-hover:text-white")} />
                            <span className="font-medium">Community</span>
                          </div>
                          <ChevronDown className={cn("h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200", isFounderCommunitiesExpanded ? "transform rotate-180" : "")} />
                        </button>
                        <CollapsibleSection isExpanded={isFounderCommunitiesExpanded}>
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
                            {[{ label: "My Communities", popover: "Founder:Communities", icon: <Rss className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Members", popover: "Founder:Communities:Members", icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Orders", popover: "Founder:Communities:Orders", icon: <Receipt className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Cabinet", popover: "Founder:Communities:Cabinet", icon: <Folder className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Unsub Log", popover: "Founder:Communities:UnsubLog", icon: <History className="h-3.5 w-3.5 shrink-0" /> },
                            ].map((item) => (
                              <Link key={item.popover} href="/workspace" data-nav-popover={item.popover} onClick={(e) => { e.preventDefault(); setActiveContainer && setActiveContainer(null); setActiveChatId && setActiveChatId({ type: "dm", id: "" }); setActivePopoverNav(item.popover); }}
                                className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative", activePopover === item.popover ? "bg-[#1a1a22] text-white border border-[#3b3b4a]" : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent")}>
                                {item.icon}<span>{item.label}</span>
                              </Link>
                            ))}
                        </CollapsibleSection>
                      </div>
                    ))}

                    {/* ========== Live Streams (Founder, top-level) ========== */}
                    {canModuleConsole("live_streams") && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Live Streams"
                        active={(activePopover?.startsWith("Founder:Live") && activePopover !== "Founder:Live:Recordings") || false}
                        collapsed={collapsed}
                        icon={<Tv className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Founder:Live"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Founder:Live");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Live Streams", FOUNDER_LIVE_PAGES)}
                          onClick={toggleFounderLive}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover?.startsWith("Founder:Live") && activePopover !== "Founder:Live:Recordings")
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Live Streams"
                        >
                          <div className="flex items-center gap-2">
                            <Tv
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                (activePopover?.startsWith("Founder:Live") && activePopover !== "Founder:Live:Recordings")
                                  ? "text-white"
                                  : "text-[#c7c7da] group-hover:text-white"
                              )}
                            />
                            <span className="font-medium">Live Streams</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isFounderLiveExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>
                        <CollapsibleSection isExpanded={isFounderLiveExpanded}>
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
                            {[
                              { label: "My Live streams", popover: "Founder:Live", icon: <Video className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Attendees", popover: "Founder:Live:Attendees", icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Orders", popover: "Founder:Live:Orders", icon: <ShoppingBag className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Unsub Log", popover: "Founder:Live:UnsubLog", icon: <History className="h-3.5 w-3.5 shrink-0" /> },
                            ].map((item) => (
                              <Link
                                key={item.popover}
                                href="/workspace"
                                data-nav-popover={item.popover}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setActiveContainer && setActiveContainer(null);
                                  setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                  setActivePopoverNav(item.popover);
                                }}
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                  activePopover === item.popover
                                    ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                {item.icon}
                                <span>{item.label}</span>
                              </Link>
                            ))}
                        </CollapsibleSection>
                      </div>
                    ))}

                    {/* ========== Content (Founder) ==========
                        Courses is the only RBAC module inside this group; the
                        rest (videos, articles, analytics, rewards) stays
                        founder-only, so a courses admin sees the group with
                        just their sub-tree in it. */}
                    {(amIFounder || canModuleConsole("courses")) && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Content"
                        active={
                          activePopover?.startsWith("Founder:Content") ||
                          activePopover === "Founder:Live:Recordings" ||
                          activePopover?.startsWith("Founder:Courses") ||
                          activePopover === "Founder:Articles" ||
                          activePopover === "Founder:Analytics" ||
                          false
                        }
                        collapsed={collapsed}
                        icon={<PlaySquare className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Founder:Content:Videos"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Founder:Content:Videos");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Content", [
                            ...(amIFounder ? [{ label: "Videos", children: FOUNDER_VIDEO_PAGES }] : []),
                            ...(canModuleConsole("courses") ? [{ label: "Courses", children: FOUNDER_COURSE_PAGES }] : []),
                            ...(amIFounder ? FOUNDER_CONTENT_EXTRA_PAGES : []),
                          ])}
                          onClick={toggleFounderContent}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover?.startsWith("Founder:Content") ||
                              activePopover === "Founder:Live:Recordings" ||
                              activePopover?.startsWith("Founder:Courses") ||
                              activePopover === "Founder:Articles" ||
                              activePopover === "Founder:Analytics")
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Content"
                        >
                          <div className="flex items-center gap-2">
                            <PlaySquare
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                (activePopover?.startsWith("Founder:Content") ||
                                  activePopover === "Founder:Live:Recordings" ||
                                  activePopover?.startsWith("Founder:Courses") ||
                                  activePopover === "Founder:Articles" ||
                                  activePopover === "Founder:Analytics")
                                  ? "text-white"
                                  : "text-[#c7c7da] group-hover:text-white"
                              )}
                            />
                            <span className="font-medium">Content</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isFounderContentExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>
                        <CollapsibleSection isExpanded={isFounderContentExpanded}>
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            {/* Nested group: Videos (founder-only — not an RBAC module) */}
                            {amIFounder && (
                            <div className="flex flex-col relative">
                              <button
                                data-nav-group={navGroup("Videos", FOUNDER_VIDEO_PAGES)}
                                onClick={toggleFounderVideos}
                                className={cn(
                                  "flex items-center justify-between w-full rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer group/sub",
                                  (activePopover === "Founder:Live:Recordings" ||
                                    activePopover === "Founder:Content:Videos" ||
                                    activePopover === "Founder:Content:Drops" ||
                                    activePopover === "Founder:Content:Playlists")
                                    ? "text-white"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Video className="h-3.5 w-3.5 shrink-0" />
                                  <span>Videos</span>
                                </div>
                                <ChevronDown
                                  className={cn(
                                    "h-3 w-3 text-[#9fa0b8] transition-transform duration-200",
                                    isFounderVideosExpanded ? "transform rotate-180" : ""
                                  )}
                                />
                              </button>

                              <CollapsibleSection isExpanded={isFounderVideosExpanded} className="pl-4">
                                  <div className="absolute left-[7px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
                                  {[
                                    { label: "My Recordings", popover: "Founder:Live:Recordings", icon: <ListVideo className="h-3.5 w-3.5 shrink-0" /> },
                                    { label: "My Videos", popover: "Founder:Content:Videos", icon: <Video className="h-3.5 w-3.5 shrink-0" /> },
                                    { label: "My Drops", popover: "Founder:Content:Drops", icon: <Camera className="h-3.5 w-3.5 shrink-0" /> },
                                    { label: "My Playlists", popover: "Founder:Content:Playlists", icon: <ListVideo className="h-3.5 w-3.5 shrink-0" /> },
                                  ].map((item) => (
                                    <Link
                                      key={item.popover}
                                      href="/workspace"
                                      data-nav-popover={item.popover}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setActiveContainer && setActiveContainer(null);
                                        setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                        setActivePopoverNav(item.popover);
                                      }}
                                      className={cn(
                                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                        activePopover === item.popover
                                          ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                          : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                      )}
                                    >
                                      {item.icon}
                                      <span>{item.label}</span>
                                    </Link>
                                  ))}
                              </CollapsibleSection>
                            </div>
                            )}

                            {/* Nested group: Courses */}
                            {canModuleConsole("courses") && (
                            <div className="flex flex-col relative">
                              <button
                                data-nav-group={navGroup("Courses", FOUNDER_COURSE_PAGES)}
                                onClick={toggleFounderCourses}
                                className={cn(
                                  "flex items-center justify-between w-full rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer group/sub",
                                  activePopover?.startsWith("Founder:Courses")
                                    ? "text-white"
                                    : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                                  <span>Courses</span>
                                </div>
                                <ChevronDown
                                  className={cn(
                                    "h-3 w-3 text-[#9fa0b8] transition-transform duration-200",
                                    isFounderCoursesExpanded ? "transform rotate-180" : ""
                                  )}
                                />
                              </button>

                              <CollapsibleSection isExpanded={isFounderCoursesExpanded} className="pl-4">
                                  <div className="absolute left-[7px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
                                  {[
                                    { label: "My Courses", popover: "Founder:Courses", icon: <GraduationCap className="h-3.5 w-3.5 shrink-0" /> },
                                    { label: "Students", popover: "Founder:Courses:Students", icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
                                    { label: "Orders", popover: "Founder:Courses:Orders", icon: <Receipt className="h-3.5 w-3.5 shrink-0" /> },
                                    { label: "Unsub Log", popover: "Founder:Courses:UnsubLog", icon: <History className="h-3.5 w-3.5 shrink-0" /> },
                                  ].map((item) => (
                                    <Link
                                      key={item.popover}
                                      href="/workspace"
                                      data-nav-popover={item.popover}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setActiveContainer && setActiveContainer(null);
                                        setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                        setActivePopoverNav(item.popover);
                                      }}
                                      className={cn(
                                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                        activePopover === item.popover
                                          ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                          : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                      )}
                                    >
                                      {item.icon}
                                      <span>{item.label}</span>
                                    </Link>
                                  ))}
                              </CollapsibleSection>
                            </div>
                            )}

                            {/* Articles / Analytics / Rewards are founder-only —
                                no RBAC module covers them. */}
                            {amIFounder && (
                            <>
                            {/* Sub-item: Articles */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Founder:Content:Articles"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Founder:Content:Articles");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Founder:Content:Articles"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span>Articles</span>
                            </Link>

                            {/* Sub-item: Analytics */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Founder:Content:Analytics"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Founder:Content:Analytics");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Founder:Content:Analytics"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                              <span>Analytics</span>
                            </Link>

                            {/* Sub-item: Content Rewards */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Founder:Content:Rewards"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Founder:Content:Rewards");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Founder:Content:Rewards"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Gift className="h-3.5 w-3.5 shrink-0" />
                              <span>Content Rewards</span>
                            </Link>
                            </>
                            )}
                        </CollapsibleSection>
                      </div>
                    ))}

                    {/* ========== 1:1 Calls (Founder) ========== */}
                    {/* {collapsed ? (
                      <SidebarItem
                        href="#"
                        label="1:1 Calls"
                        active={activePopover?.startsWith("Founder:Calls") || false}
                        collapsed={collapsed}
                        icon={<Phone className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Founder:Calls");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          onClick={() => setIsFounderCallsExpanded(!isFounderCallsExpanded)}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            activePopover?.startsWith("Founder:Calls")
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="1:1 Calls"
                        >
                          <div className="flex items-center gap-2">
                            <Phone className={cn("h-4 w-4 shrink-0 transition-colors", activePopover?.startsWith("Founder:Calls") ? "text-white" : "text-[#c7c7da] group-hover:text-white")} />
                            <span className="font-medium">1:1 Calls</span>
                          </div>
                          <ChevronDown className={cn("h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200", isFounderCallsExpanded ? "transform rotate-180" : "")} />
                        </button>
                        {isFounderCallsExpanded && (
                          <div className="relative pl-6 mt-1 flex flex-col gap-1">
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
                            {[{ label: "Calls", popover: "Founder:Calls", icon: <Phone className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Purchases", popover: "Founder:Calls:Purchases", icon: <CreditCard className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Bookings", popover: "Founder:Calls:Bookings", icon: <Calendar className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Customers", popover: "Founder:Calls:Customers", icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Orders", popover: "Founder:Calls:Orders", icon: <Receipt className="h-3.5 w-3.5 shrink-0" /> },
                            ].map((item) => (
                              <Link key={item.popover} href="/workspace" onClick={(e) => { e.preventDefault(); setActiveContainer && setActiveContainer(null); setActiveChatId && setActiveChatId({ type: "dm", id: "" }); setActivePopoverNav(item.popover); }}
                                className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative", activePopover === item.popover ? "bg-[#1a1a22] text-white border border-[#3b3b4a]" : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent")}>
                                {item.icon}<span>{item.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )} */}

                    {/* ========== Digital Products (Founder) ========== */}
                    {canModuleConsole("digital_products") && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Digital Products"
                        active={activePopover?.startsWith("Founder:Products") || false}
                        collapsed={collapsed}
                        icon={<ShoppingBag className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Founder:Products"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Founder:Products");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Digital Products", FOUNDER_PRODUCT_PAGES)}
                          onClick={toggleFounderProducts}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            activePopover?.startsWith("Founder:Products")
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Digital Products"
                        >
                          <div className="flex items-center gap-2">
                            <ShoppingBag className={cn("h-4 w-4 shrink-0 transition-colors", activePopover?.startsWith("Founder:Products") ? "text-white" : "text-[#c7c7da] group-hover:text-white")} />
                            <span className="font-medium">Digital Products</span>
                          </div>
                          <ChevronDown className={cn("h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200", isFounderProductsExpanded ? "transform rotate-180" : "")} />
                        </button>
                        <CollapsibleSection isExpanded={isFounderProductsExpanded}>
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
                            {[{ label: "Products", popover: "Founder:Products", icon: <ShoppingBag className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Orders", popover: "Founder:Products:Orders", icon: <Receipt className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Customers", popover: "Founder:Products:Customers", icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
                              // Digital Products Unsub Log — commented out per founder request.
                              // Re-enable when refund reporting is ready to surface.
                              // { label: "Unsub Log", popover: "Founder:Products:UnsubLog", icon: <History className="h-3.5 w-3.5 shrink-0" /> },
                            ].map((item) => (
                              <Link key={item.popover} href="/workspace" data-nav-popover={item.popover} onClick={(e) => { e.preventDefault(); setActiveContainer && setActiveContainer(null); setActiveChatId && setActiveChatId({ type: "dm", id: "" }); setActivePopoverNav(item.popover); }}
                                className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative", activePopover === item.popover ? "bg-[#1a1a22] text-white border border-[#3b3b4a]" : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent")}>
                                {item.icon}<span>{item.label}</span>
                              </Link>
                            ))}
                        </CollapsibleSection>
                      </div>
                    ))}

                    {/* ========== Events (Founder) ========== */}
                    {/* Events rides the live_streams module on the backend —
                        whoever can run a webinar can run the conference — so
                        the console gate uses the same key. */}
                    {canModuleConsole("live_streams") && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Events"
                        active={activePopover?.startsWith("Founder:Events") || false}
                        collapsed={collapsed}
                        icon={<Ticket className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Founder:Events"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Founder:Events");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Events", FOUNDER_EVENT_PAGES)}
                          onClick={() => setIsEventsExpanded(!isEventsExpanded)}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            activePopover?.startsWith("Founder:Events")
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Events"
                        >
                          <div className="flex items-center gap-2">
                            <Ticket className={cn("h-4 w-4 shrink-0 transition-colors", activePopover?.startsWith("Founder:Events") ? "text-white" : "text-[#c7c7da] group-hover:text-white")} />
                            <span className="font-medium">Events</span>
                          </div>
                          <ChevronDown className={cn("h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200", isEventsExpanded ? "transform rotate-180" : "")} />
                        </button>
                        {isEventsExpanded && (
                          <div className="relative pl-6 mt-1 flex flex-col gap-1">
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />

                            {/* Creating an event is a bottom-bar action, not a
                                sidebar destination — same as Create Community. */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Founder:Events"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Founder:Events");
                                window.dispatchEvent(
                                  new CustomEvent("events:navigate", { detail: { section: "list" } })
                                );
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Founder:Events" && eventsSection === "list"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                              <span>My Events</span>
                            </Link>

                            {/* PLAN / SELL / REACH. Each collapses on its own.
                                Clicking a page with no event open opens the
                                picker rather than doing nothing — see
                                EventPickerModal. */}
                            {EVENT_PILLARS.map((pillar) => {
                              const PillarIcon = pillar.icon;
                              const openPillar =
                                !collapsedPillars.includes(pillar.key) ||
                                EVENT_SECTION_TO_PILLAR[eventsSection] === pillar.key;
                              return (
                                <div key={pillar.key} className="mt-1.5 first:mt-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCollapsedPillars((prev) =>
                                        prev.includes(pillar.key)
                                          ? prev.filter((k) => k !== pillar.key)
                                          : [...prev, pillar.key]
                                      )
                                    }
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#61627a] transition-colors hover:bg-[#15151b] hover:text-[#9fa0b8]"
                                  >
                                    <PillarIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="flex-1 text-left">{pillar.label}</span>
                                    <ChevronDown
                                      className={cn(
                                        "h-3 w-3 shrink-0 transition-transform duration-200",
                                        openPillar ? "" : "-rotate-90"
                                      )}
                                    />
                                  </button>

                                  {openPillar &&
                                    pillar.pages.map((page) => {
                                      const PageIcon = page.icon;
                                      const active =
                                        activePopover === "Founder:Events" &&
                                        eventsSection === page.section;
                                      return (
                                        <button
                                          key={page.section}
                                          type="button"
                                          title={page.label}
                                          onClick={() => {
                                            setActiveContainer && setActiveContainer(null);
                                            setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                            setActivePopoverNav("Founder:Events");
                                            window.dispatchEvent(
                                              new CustomEvent("events:navigate", {
                                                detail: { section: page.section },
                                              })
                                            );
                                          }}
                                          className={cn(
                                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative text-left",
                                            active
                                              ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                              : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                                          )}
                                        >
                                          <PageIcon
                                            className={cn(
                                              "h-3.5 w-3.5 shrink-0",
                                              active ? "text-brand" : "text-[#61627a]"
                                            )}
                                          />
                                          <span className="truncate">{page.label}</span>
                                        </button>
                                      );
                                    })}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* ========== Services (Founder) ========== */}
                    {canModuleConsole("services") && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Services"
                        active={activePopover?.startsWith("Founder:Services") || false}
                        collapsed={collapsed}
                        icon={<Briefcase className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Founder:Services"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Founder:Services");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Services", FOUNDER_SERVICE_PAGES)}
                          onClick={() => setIsFounderServicesExpanded(!isFounderServicesExpanded)}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            activePopover?.startsWith("Founder:Services")
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Services"
                        >
                          <div className="flex items-center gap-2">
                            <Briefcase className={cn("h-4 w-4 shrink-0 transition-colors", activePopover?.startsWith("Founder:Services") ? "text-white" : "text-[#c7c7da] group-hover:text-white")} />
                            <span className="font-medium">Services</span>
                          </div>
                          <ChevronDown className={cn("h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200", isFounderServicesExpanded ? "transform rotate-180" : "")} />
                        </button>
                        {isFounderServicesExpanded && (
                          <div className="relative pl-6 mt-1 flex flex-col gap-1">
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
                            {[{ label: "Services", popover: "Founder:Services", icon: <Briefcase className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Opt-Ins", popover: "Founder:Services:Optins", icon: <ClipboardCheck className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Customers", popover: "Founder:Services:Customers", icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Orders", popover: "Founder:Services:Orders", icon: <Receipt className="h-3.5 w-3.5 shrink-0" /> },
                            ].map((item) => (
                              <Link key={item.popover} href="/workspace" data-nav-popover={item.popover} onClick={(e) => { e.preventDefault(); setActiveContainer && setActiveContainer(null); setActiveChatId && setActiveChatId({ type: "dm", id: "" }); setActivePopoverNav(item.popover); }}
                                className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative", activePopover === item.popover ? "bg-[#1a1a22] text-white border border-[#3b3b4a]" : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent")}>
                                {item.icon}<span>{item.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* ========== Jobs (Founder) ==========
                        Garage Jobs hiring console. Founder-only: no module
                        permission covers it. The wizard, job and scorecard
                        pages sit under Postings. */}
                    {amIFounder && isJobsAllowedUser && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Jobs"
                        active={activePopover?.startsWith("Founder:Jobs") || false}
                        collapsed={collapsed}
                        icon={<BriefcaseBusiness className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Founder:Jobs"
                        onClick={() => {
                          setActiveContainer?.(null);
                          setActivePopoverNav("Founder:Jobs");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Jobs", FOUNDER_JOBS_PAGES)}
                          onClick={() => setIsFounderJobsExpanded(!isFounderJobsExpanded)}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            activePopover?.startsWith("Founder:Jobs")
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Jobs"
                        >
                          <div className="flex items-center gap-2">
                            <BriefcaseBusiness className={cn("h-4 w-4 shrink-0 transition-colors", activePopover?.startsWith("Founder:Jobs") ? "text-white" : "text-[#c7c7da] group-hover:text-white")} />
                            <span className="font-medium">Jobs</span>
                          </div>
                          <ChevronDown className={cn("h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200", isFounderJobsExpanded ? "transform rotate-180" : "")} />
                        </button>
                        {isFounderJobsExpanded && (
                          <div className="relative pl-6 mt-1 flex flex-col gap-1">
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
                            {[{ label: "Overview", popover: "Founder:Jobs", icon: <LayoutDashboard className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Postings", popover: "Founder:Jobs:Postings", icon: <FileText className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Applications", popover: "Founder:Jobs:Applications", icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Talent Pool", popover: "Founder:Jobs:TalentPool", icon: <UserSearch className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Referral Payouts", popover: "Founder:Jobs:Payouts", icon: <HandCoins className="h-3.5 w-3.5 shrink-0" /> },
                              { label: "Settings", popover: "Founder:Jobs:Settings", icon: <Settings className="h-3.5 w-3.5 shrink-0" /> },
                            ].map((item) => {
                              const isActive =
                                activePopover === item.popover ||
                                (item.popover === "Founder:Jobs:Postings" &&
                                  (activePopover === "Founder:Jobs:New" ||
                                    activePopover === "Founder:Jobs:Job" ||
                                    activePopover === "Founder:Jobs:Scorecard"));
                              return (
                                <Link key={item.popover} href="/workspace" data-nav-popover={item.popover} onClick={(e) => { e.preventDefault(); setActiveContainer?.(null); setActiveChatId?.({ type: "dm", id: "" }); setActivePopoverNav(item.popover); }}
                                  className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative", isActive ? "bg-[#1a1a22] text-white border border-[#3b3b4a]" : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent")}>
                                  {item.icon}<span>{item.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* ========== Coverfi (Founder) ========== */}
                    {/* <SidebarItem
                      href="/coverfi"
                      label="Coverfi"
                      active={pathname?.startsWith("/coverfi") ?? false}
                      collapsed={collapsed}
                      icon={<Umbrella className="h-4 w-4"}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                    /> */}

                    {/* ========== Coupons (Founder top-level) ========== */}
                    {/* <SidebarItem
                      href="#"
                      label="Coupons"
                      active={activePopover === "Office Settings:coupons"}
                      collapsed={collapsed}
                      icon={<Tag className="h-4 w-4"}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                      onClick={() => {
                        setActiveContainer && setActiveContainer(null);
                        setActivePopoverNav("Office Settings:coupons");
                      }}
                    /> */}

                    {/* Divider before admin items */}
                    {/* <div className="my-2 border-t border-[#2a2a35] opacity-40 mx-2" /> */}

                    {/* ========== Networks Manager (existing) ========== */}
                    {/* <SidebarItem
                      href="#"
                      label="Networks Manager"
                      active={activePopover === "Networks Manager"}
                      collapsed={collapsed}
                      icon={<Network className="h-4 w-4" />}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                      onClick={() => {
                        setActiveContainer && setActiveContainer(null);
                        setActivePopoverNav("Networks Manager");
                      }}
                    /> */}

                    {/* ========== Branding (Founder top-level) ========== */}
                    {/* <SidebarItem
                      href="#"
                      label="Branding"
                      active={activePopover === "Office Settings:branding"}
                      collapsed={collapsed}
                      icon={<Palette className="h-4 w-4"}
                      popover={true}
                      activePopover={activePopover}
                      setActivePopover={setActivePopoverNav}
                      setActiveChatId={setActiveChatId}
                      setActiveContainer={setActiveContainer}
                      onClick={() => {
                        setActiveContainer && setActiveContainer(null);
                        setActivePopoverNav("Office Settings:branding");
                      }}
                    /> */}

                     {/* ========== Office Settings (existing) ==========
                         Founder-only: every /rbac founder route and the rest of
                         Office Settings sit behind `requireOrgAdmin`. */}
                    {amIFounder && (collapsed ? (
                      <SidebarItem
                        href="#"
                        label="Office Settings"
                        active={activePopover === "Office Settings" || (activePopover ? activePopover.startsWith("Office Settings:") : false) || (pathname?.startsWith("/coverfi") ?? false)}
                        collapsed={collapsed}
                        icon={<Settings className="h-4 w-4" />}
                        popover={true}
                        activePopover={activePopover}
                        setActivePopover={setActivePopoverNav}
                        setActiveChatId={setActiveChatId}
                        setActiveContainer={setActiveContainer}
                        navPopover="Office Settings:invitees"
                        onClick={() => {
                          setActiveContainer && setActiveContainer(null);
                          setActivePopoverNav("Office Settings:invitees");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <button
                          data-nav-group={navGroup("Office Settings", OFFICE_SETTINGS_PAGES)}
                          onClick={toggleOfficeSettings}
                          className={cn(
                            "flex items-center justify-between w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer group",
                            (activePopover === "Office Settings" || (activePopover ? activePopover.startsWith("Office Settings:") : false) || (pathname?.startsWith("/coverfi") ?? false))
                              ? "text-white"
                              : "text-[#c7c7da] hover:bg-[#15151b] hover:text-white border border-transparent"
                          )}
                          title="Office Settings"
                        >
                          <div className="flex items-center gap-2">
                            <Settings className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              (activePopover === "Office Settings" || (activePopover ? activePopover.startsWith("Office Settings:") : false) || (pathname?.startsWith("/coverfi") ?? false))
                                ? "text-white"
                                : "text-[#c7c7da] group-hover:text-white"
                            )} />
                            <span className="font-medium">Office Settings</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-[#9fa0b8] transition-transform duration-200",
                              isOfficeSettingsExpanded ? "transform rotate-180" : ""
                            )}
                          />
                        </button>
 
                        <CollapsibleSection isExpanded={isOfficeSettingsExpanded}>
                            {/* Vertical line connecting nested items */}
                            <div className="absolute left-[15px] top-0 bottom-[10px] w-[1px] bg-[#2a2a35]" />
 
                            {/* Sub-item: Coupons */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Office Settings:coupons"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Office Settings:coupons");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Office Settings:coupons"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Tag className="h-3.5 w-3.5 shrink-0" />
                              <span>Coupons</span>
                            </Link>
 
 
                            {/* Sub-item: Invitees */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Office Settings:invitees"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Office Settings:invitees");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Office Settings:invitees"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <UserPlus className="h-3.5 w-3.5 shrink-0" />
                              <span>Invitees</span>
                            </Link>

                            {/* Sub-item: Team & Access (module RBAC delegation) */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Office Settings:team-access"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Office Settings:team-access");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Office Settings:team-access"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <UserRoundCog className="h-3.5 w-3.5 shrink-0" />
                              <span>Team &amp; Access</span>
                            </Link>

                            {/* Sub-item: Coverfi */}
                            <Link
                              href="/coverfi"
                              onClick={() => {
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav(null);
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                (pathname?.startsWith("/coverfi") || activePopover === "Office Settings:coverfi")
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Umbrella className="h-3.5 w-3.5 shrink-0" />
                              <span>Coverfi</span>
                            </Link>

                            {/* Sub-item: Pending Requests (commented out) */}
                            {/* <Link
                              href="/workspace"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Office Settings:pending-requests");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Office Settings:pending-requests"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>Pending Requests</span>
                            </Link> */}
 
                            {/* Sub-item: Domains — white-label custom app domains */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Office Settings:domain"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Office Settings:domain");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Office Settings:domain"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Globe className="h-3.5 w-3.5 shrink-0" />
                              <span>Domains</span>
                            </Link>

                            {/* Sub-item: Branding — white-label colour/logo */}
                            <Link
                              href="/workspace"
                              data-nav-popover="Office Settings:branding"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("Office Settings:branding");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "Office Settings:branding"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Palette className="h-3.5 w-3.5 shrink-0" />
                              <span>Branding</span>
                            </Link>

                            {/* Sub-item: Email Setup — the NetworkMail domain
                                and mailbox setup page. layout.tsx has always
                                rendered it for "NetworkMail", but nothing ever
                                navigated there, so the page (and the
                                white-label sending domain card on it) was
                                unreachable from the UI. */}
                            <Link
                              href="/workspace"
                              data-nav-popover="NetworkMail"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveContainer && setActiveContainer(null);
                                setActiveChatId && setActiveChatId({ type: "dm", id: "" });
                                setActivePopoverNav("NetworkMail");
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors relative",
                                activePopover === "NetworkMail"
                                  ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                                  : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white border border-transparent"
                              )}
                            >
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span>Email Setup</span>
                            </Link>
                        </CollapsibleSection>
                      </div>
                    ))}
                  </div>
                )}

                {/* Divider */}
                <div className="my-3 border-t border-[#2a2a35] opacity-40 mx-2" />

                {/* Standard Global Pages */}
                <div className="space-y-1">
                  {/* Module-access invites waiting on me. Only rendered while
                      the 24h window is open — it disappears once answered. */}
                  {accessInvitesPending > 0 && (
                    <button
                      onClick={openAccessInbox}
                      title={`${accessInvitesPending} access invite${accessInvitesPending === 1 ? "" : "s"} waiting`}
                      className={cn(
                        "flex items-center w-full rounded-md px-2 py-2 text-sm transition-colors cursor-pointer border border-brand/25 bg-brand/[0.07] text-brand hover:bg-brand/15",
                        collapsed ? "justify-center" : "justify-between gap-2"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <UserRoundCog className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="font-medium">Access invites</span>}
                      </div>
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-foreground">
                        {accessInvitesPending}
                      </span>
                    </button>
                  )}

                  {/* 1Network hidden from the sidebar. The popover and its
                      route are untouched — restore by uncommenting.
                  <SidebarItem
                    href="#"
                    label="1Network"
                    active={activePopover === "1Network"}
                    collapsed={collapsed}
                    icon={
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.5719 4.41397H8.90225V7.35234H20.5719C20.8373 7.35234 21.0616 7.57664 21.0616 7.84207V8.12249H21.0639V19.4746C22.7212 19.2347 24 17.8086 24 16.0859V7.84207C24 5.95185 22.4621 4.41397 20.5719 4.41397Z" fill="currentColor"/>
                        <path d="M16.162 0.000141144H7.91815C6.02793 0.000141144 4.49005 1.53802 4.49005 3.42831V6.86242V12.6074V15.104H7.42841V12.6074V6.86242V3.42831C7.42841 3.16287 7.65271 2.9385 7.91815 2.9385H16.162C16.1665 2.9385 16.1708 2.93981 16.1753 2.93994H19.5513C19.3129 1.28076 17.886 0.000141144 16.162 0.000141144Z" fill="currentColor"/>
                        <path d="M3.42816 19.4482H15.0978V16.5098H3.42816C3.16273 16.5098 2.93842 16.2856 2.93842 16.0201V15.7397H2.93613V4.38761C1.27878 4.62754 0 6.05353 0 7.77627V16.0201C0 17.9104 1.53794 19.4482 3.42816 19.4482Z" fill="currentColor"/>
                        <path d="M7.83807 23.8618H16.0819C17.9721 23.8618 19.51 22.3239 19.51 20.4337V16.9995V11.2546V8.75795H16.5716V11.2546V16.9995V20.4337C16.5716 20.6991 16.3473 20.9234 16.0819 20.9234H7.83807C7.8335 20.9234 7.82924 20.9221 7.82473 20.922H4.44882C4.68712 22.5811 6.11402 23.8618 7.83807 23.8618Z" fill="currentColor"/>
                      </svg>
                    }
                    popover={true}
                    activePopover={activePopover}
                    setActivePopover={setActivePopoverNav}
                    setActiveContainer={setActiveContainer}
                  /> */}

                  {walletNavItems}

                  {/* Rank Bonus hidden from the sidebar. NetworkChain monthly
                      rank bonus — the member's own standing, team activity and
                      payout history. Read-only; the admin surface lives at
                      /garage-admin/rank-bonus. Restore by uncommenting.
                  <SidebarItem
                    href="#"
                    label="Rank Bonus"
                    active={activePopover === "Rank Bonus"}
                    collapsed={collapsed}
                    icon={<Trophy className="h-4 w-4 shrink-0" />}
                    popover={true}
                    activePopover={activePopover}
                    setActivePopover={setActivePopoverNav}
                    setActiveContainer={setActiveContainer}
                    onClick={() => {
                      setActiveContainer && setActiveContainer(null);
                      setActivePopoverNav("Rank Bonus");
                    }}
                  /> */}

                  {/* <SidebarItem
                    href="#"
                    label="Support"
                    active={activePopover === "Support"}
                    collapsed={collapsed}
                    icon={<Headphones className="h-4 w-4" />}
                    popover={true}
                    activePopover={activePopover}
                    setActivePopover={setActivePopoverNav}
                    setActiveContainer={setActiveContainer}
                  /> */}

                  {/* <SidebarItem
                    href="/auction"
                    label="Auction"
                    active={activePopover === "Auction"}
                    collapsed={collapsed}
                    icon={<Gavel className="h-4 w-4" />}
                    popover={true}
                    activePopover={activePopover}
                    setActivePopover={setActivePopoverNav}
                    setActiveChatId={setActiveChatId}
                    setActiveContainer={setActiveContainer}
                    onClick={() => {
                      setActiveContainer && setActiveContainer(null);
                      setActivePopoverNav("Auction");
                    }}
                  /> */}
                </div>
              </>
            )}
        </nav>

        {/* Engage Section */}
        {/* {activeWorkspaceView === "lobby" && (
          <div className="px-2">
            <div className="flex items-center justify-between px-2">
              {collapsed ? (
                <div className="h-[0.1px] w-full mb-4 bg-[white]/20 mx-auto" />
              ) : (
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#7c8aff]">
                  Engage
                </div>
              )}
              {!collapsed && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setIsRevenueNetworkExpanded(!isRevenueNetworkExpanded)
                  }
                  className="h-6 w-6 text-[#9fa0b8] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                  title={
                    isRevenueNetworkExpanded
                      ? "Collapse Engage"
                      : "Expand Engage"
                  }
                  aria-label={
                    isRevenueNetworkExpanded
                      ? "Collapse Engage"
                      : "Expand Engage"
                  }
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-300 ease-in-out ${isRevenueNetworkExpanded ? "rotate-0" : "rotate-180"
                      }`}
                  />
                </Button>
              )}
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isRevenueNetworkExpanded
                ? "max-h-[1000px] opacity-100"
                : "max-h-0 opacity-0"
                }`}
            >
              <div className="space-y-1">


              </div>
            </div>
          </div>
        )} */}

        {/* Tools Section */}
        {/* {activeWorkspaceView === "lobby" && (
          <div className="px-2">
            <div className="flex items-center justify-between px-2">
              {collapsed ? (
                <div className="h-[0.1px] w-full mb-4 bg-[white]/20 mx-auto" />
              ) : (
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#7c8aff]">
                  My Tools
                </div>
              )}
              {!collapsed && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                  className="h-6 w-6 text-[#9fa0b8] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                  title={isToolsExpanded ? "Collapse Tools" : "Expand Tools"}
                  aria-label={
                    isToolsExpanded ? "Collapse Tools" : "Expand Tools"
                  }
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-300 ease-in-out ${isToolsExpanded ? "rotate-0" : "rotate-180"
                      }`}
                  />
                </Button>
              )}
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isToolsExpanded
                ? "max-h-[1000px] opacity-100"
                : "max-h-0 opacity-0"
                }`}
            >
              <div className="space-y-1">

              </div>
            </div>
          </div>
        )} */}

        {/* Founders Tools Section - Founder only */}
        {/* {activeWorkspaceView === "lobby" && amIFounder && (
          <div className="px-2">

          </div>
        )} */}
        {/* members */}
        {!isBat246Office && activeWorkspaceView === "chat" && (
          <div className="px-2 -mt-4">
            <div className="flex items-center justify-between px-2 mb-2">
              {collapsed ? (
                <div className="h-[0.1px] w-full mb-4 bg-[white]/20 mx-auto" />
              ) : (
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#7c8aff]">
                  Co-Chats
                </div>
              )}
              {!collapsed && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleRefreshMembers}
                    disabled={isRefreshingMembers}
                    className="h-6 w-6 text-[#9fa0b8] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                    title="Refresh members"
                    aria-label="Refresh members"
                  >
                    <RefreshCw
                      className={`h-3 w-3 transition-transform duration-500 ${isRefreshingMembers ? "animate-spin" : ""
                        }`}
                    />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsMembersExpanded(!isMembersExpanded)}
                    className="h-6 w-6 text-[#9fa0b8] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                    title={
                      isMembersExpanded ? "Collapse members" : "Expand members"
                    }
                    aria-label={
                      isMembersExpanded ? "Collapse members" : "Expand members"
                    }
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-300 ease-in-out ${isMembersExpanded ? "rotate-0" : "rotate-180"
                        }`}
                    />
                  </Button>
                </div>
              )}
            </div>
            {/* Search Input */}
            {!collapsed && isMembersExpanded && (
              <div className="px-2 mb-2 transition-all duration-300 ease-in-out">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9fa0b8]" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#15151b] border border-[#2a2a35] rounded-md text-[#c7c7da] placeholder:text-[#9fa0b8] focus:outline-none focus:border-[#363649] transition-colors"
                  />
                </div>
              </div>
            )}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isMembersExpanded ? "opacity-100" : "max-h-0 opacity-0"
                }`}
            >
              <div className="space-y-1">
                {/* BettyAssistant render hidden along with the Activity
                    feature retirement — see import comment above. */}
                {false && amIFounder && (
                  <div className="">
                    {/* <BettyAssistant
                      collapsed={collapsed}
                      isActivityOpen={isActivityOpen}
                      setIsActivityOpen={setIsActivityOpen}
                      setIsAskCabinetOpen={setIsAskCabinetOpen}
                    /> */}
                  </div>
                )}
                {/* Ask Cabinet launcher (MonitorToPurchase) - COMMENTED OUT
                <div className="">
                  <div
                    onClick={() =>
                      setIsAskCabinetOpen && setIsAskCabinetOpen(true)
                    }
                    className={[
                      "group cursor-pointer flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors",
                      "text-[#c7c7da] hover:bg-[#15151b]",
                      collapsed ? "justify-center" : "",
                    ].join(" ")}
                    title="Ask Cabinet"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Image
                          src="/Group 3.png"
                          alt="MonitorToPurchase"
                          width={28}
                          height={28}
                          className="rounded-full border border-[#2f2f3b]"
                        />
                      </div>
                      {!collapsed && (
                        <div className="leading-tight">
                          <div className="text-xs truncate w-32">
                            MonitorToPurchase
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                */}
                {/* AI agents removed from sidebar chat list — they're accessible
                    from the dedicated Aivatar page instead. Removed because
                    non-founder users could see them here without authorization. */}
                {others.map((m, idx) => (
                  <MemberRow
                    key={m._id || m.id || m.email || `member-${idx}`}
                    m={m}
                    meId={meId}
                    pathname={pathname}
                    collapsed={collapsed}
                    setActiveChatId={setActiveChatId}
                    activeChatId={activeChatId}
                    onSelect={() => setMemberSearchQuery("")}
                  />
                ))}
                {!loadingMembers && others.length === 0 && !collapsed && (
                  <div className="text-xs text-[#9fa0b8] px-2 py-1">
                    No members yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* groups */}
        {!isBat246Office && activeWorkspaceView === "group" && (
          <div className="px-2 -mt-4">
            <div className="flex items-center justify-between px-2 mb-2">
              {collapsed ? (
                <div className="h-[0.1px] w-full mb-4 bg-[white]/20 mx-auto" />
              ) : (
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#7c8aff]">
                  Groups
                </div>
              )}
              {!collapsed && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleRefreshGroups}
                    disabled={isRefreshingGroups}
                    className="h-6 w-6 text-[#9fa0b8] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                    title="Refresh groups"
                    aria-label="Refresh groups"
                  >
                    <RefreshCw
                      className={`h-3 w-3 transition-transform duration-500 ${isRefreshingGroups ? "animate-spin" : ""
                        }`}
                    />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsGroupsExpanded(!isGroupsExpanded)}
                    className="h-6 w-6 text-[#9fa0b8] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                    title={
                      isGroupsExpanded ? "Collapse groups" : "Expand groups"
                    }
                    aria-label={
                      isGroupsExpanded ? "Collapse groups" : "Expand groups"
                    }
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-300 ease-in-out ${isGroupsExpanded ? "rotate-0" : "rotate-180"
                        }`}
                    />
                  </Button>
                  <CreateGroupDialog
                    onCreated={() => {
                      loadGroups();
                      window.dispatchEvent(new CustomEvent("groups:reload"));
                    }}
                  />
                </div>
              )}
            </div>
            {/* Search Input */}
            {!collapsed && isGroupsExpanded && (
              <div className="px-2 mb-2 transition-all duration-300 ease-in-out">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9fa0b8]" />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#15151b] border border-[#2a2a35] rounded-md text-[#c7c7da] placeholder:text-[#9fa0b8] focus:outline-none focus:border-[#363649] transition-colors"
                  />
                </div>
              </div>
            )}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isGroupsExpanded ? "opacity-100" : "max-h-0 opacity-0"
                }`}
            >
              <div className="space-y-1">
                {sortedGroups.map((g) => (
                  <GroupRow
                    key={g.id}
                    g={g}
                    pathname={pathname}
                    collapsed={collapsed}
                    setActiveChatId={setActiveChatId}
                    activeChatId={activeChatId}
                    onSelect={() => setGroupSearchQuery("")}
                  />
                ))}
                {!loadingGroups && sortedGroups.length === 0 && !collapsed && (
                  <div className="text-xs text-[#9fa0b8] px-2 py-1">
                    No groups yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* global dm */}
        {!isBat246Office && activeWorkspaceView === "global-dm" && (
          <div className="px-2 -mt-4">
            <div className="flex items-center justify-between px-2 mb-2">
              {collapsed ? (
                <div className="h-[0.1px] w-full mb-4 bg-[white]/20 mx-auto" />
              ) : (
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#7c8aff]">
                  Global Chats
                </div>
              )}
              {!collapsed && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleRefreshGlobalDm}
                    disabled={isRefreshingGlobalDm}
                    className="h-6 w-6 text-[#9fa0b8] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                    title="Refresh global chats"
                    aria-label="Refresh global chats"
                  >
                    <RefreshCw
                      className={`h-3 w-3 transition-transform duration-500 ${isRefreshingGlobalDm ? "animate-spin" : ""
                        }`}
                    />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsGlobalDmExpanded(!isGlobalDmExpanded)}
                    className="h-6 w-6 text-[#9fa0b8] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md transition-all duration-200"
                    title={
                      isGlobalDmExpanded ? "Collapse chats" : "Expand chats"
                    }
                    aria-label={
                      isGlobalDmExpanded ? "Collapse chats" : "Expand chats"
                    }
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-300 ease-in-out ${isGlobalDmExpanded ? "rotate-0" : "rotate-180"
                        }`}
                    />
                  </Button>
                </div>
              )}
            </div>
            {/* Search Input */}
            {!collapsed && isGlobalDmExpanded && (
              <div className="px-2 mb-2 transition-all duration-300 ease-in-out">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9fa0b8]" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={globalDmSearchQuery}
                    onChange={(e) => setGlobalDmSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#15151b] border border-[#2a2a35] rounded-md text-[#c7c7da] placeholder:text-[#9fa0b8] focus:outline-none focus:border-[#363649] transition-colors"
                  />
                </div>
              </div>
            )}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isGlobalDmExpanded ? "opacity-100" : "max-h-0 opacity-0"
                }`}
            >
              <div className="space-y-1">
                {isLoadingGlobalDmUsers && sortedGlobalDmUsers.length === 0 && (
                  <div className="text-xs text-[#9fa0b8] px-2 py-1">
                    Loading...
                  </div>
                )}
                {sortedGlobalDmUsers.map((user) => {
                  const unreadCount = contextGlobalDmUnread[user._id] || 0;
                  const isActive =
                    activeChatId.type === "global-dm" &&
                    activeChatId.id === user._id;
                  return (
                    <div
                      key={user._id}
                      onClick={() => {
                        setActiveChatId({ type: "global-dm", id: user._id });
                        setGlobalDmSearchQuery("");
                      }}
                      className={[
                        "group cursor-pointer flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors",
                        isActive
                          ? "bg-emerald-600/20 text-emerald-400"
                          : "text-[#c7c7da] hover:bg-[#15151b]",
                        collapsed ? "justify-center" : "",
                      ].join(" ")}
                      title={user.name || user.email}
                      aria-label={user.name || user.email}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          {user.profilePicture ? (
                            <Image
                              src={user.profilePicture}
                              alt={user.name || user.email}
                              width={28}
                              height={28}
                              className="rounded-full border border-emerald-500/30 object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-medium border border-emerald-500/30">
                              {(user.name || user.email || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                        </div>
                        {!collapsed && (
                          <div className="leading-tight">
                            <div className="text-xs truncate w-32">
                              {user.name || user.email?.split("@")[0]}
                            </div>
                            {user.city && (
                              <div className="text-[10px] text-[#9fa0b8] truncate w-32">
                                {user.city}
                                {user.state && `, ${user.state}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {!collapsed && unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-medium bg-emerald-500 text-white rounded-full">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                      {collapsed && unreadCount > 0 && (
                        <span className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full" />
                      )}
                    </div>
                  );
                })}
                {!isLoadingGlobalDmUsers &&
                  sortedGlobalDmUsers.length === 0 &&
                  !collapsed && (
                    <div className="text-xs text-[#9fa0b8] px-2 py-1">
                      {globalDmSearchQuery
                        ? "No users found. Try a different search."
                        : "No conversations yet. Search to find users."}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* backOfficeAppMenu */}
        {!isBat246Office && activeWorkspaceView === "backOfficeAppMenu" && (
          <div className="px-2 -mt-4">
            <BackOfficeAppSideBar
              setActivePopover={setActivePopoverNav}
              activePopover={activePopover}
              setActiveContainer={setActiveContainer}
              activeContainer={activeContainer}
              teamforceSection={teamforceSection}
              setTeamforceSection={setTeamforceSection}
              dealsSection={dealsSection}
              setDealsSection={setDealsSection}
              networkMailSection={networkMailSection}
              setNetworkMailSection={setNetworkMailSection}
              thoughtsSection={thoughtsSection}
              setThoughtsSection={setThoughtsSection}
            />
          </div>
        )}
      </div>

      {/* Manage Organization Popover */}
      <ManageOrgPopover
        isOpen={isManageOrgOpen}
        onClose={() => setIsManageOrgOpen(false)}
      />

      {/* Refer Founder Dialog */}
      <ReferFounderDialog
        isOpen={isReferFounderOpen}
        onClose={() => setIsReferFounderOpen(false)}
        affiliateId={affiliateId}
      />

      {/* Guest Funnel Dialog */}
      <GuestFunnelDialog
        isOpen={isGuestFunnelOpen}
        onClose={() => setIsGuestFunnelOpen(false)}
        affiliateId={affiliateId}
        orgName={userData.orgName}
        orgId={typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null}
      />

      {/* Enroll a Downline — slide-in card. Self-fetches the caller's
          offices via /auth/me on open, so the sidebar stays dumb. */}
      <EnrollDownlineSheet
        open={isEnrollDownlineOpen}
        onOpenChange={setIsEnrollDownlineOpen}
        defaultOrgId={
          typeof window !== "undefined"
            ? localStorage.getItem("garage_org_id")
            : null
        }
      />

      {/* Invite Employees Dialog */}
      <InviteMemberDialog
        open={isInviteEmployeesOpen}
        onOpenChange={setIsInviteEmployeesOpen}
        onInvited={() => {
          loadMembers();
          window.dispatchEvent(new CustomEvent("team:reload"));
        }}
      />
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md bg-[#111116] border-[#e5e7eb29] text-white">
          <DialogHeader>
            <DialogTitle>Enter Password</DialogTitle>
            <DialogDescription className="text-slate-400">
              Please enter the password to access BackOffice Apps.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePasswordSubmit();
                }}
                placeholder="Enter password..."
                className="w-full px-3 py-2 rounded-md bg-[#1a1a24] text-white border border-[#e5e7eb29] focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowPasswordDialog(false)}
              className="bg-transparent text-slate-400 hover:bg-[#1a1a24] hover:text-white border border-[#e5e7eb29]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePasswordSubmit}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan-switch hyperlink — sits above the user box, only when the
          viewer's subscription actually supports the action. `canUpgrade`
          covers Basic + Starter sources; the /upgrade page decides which
          endpoint to call (Basic → /upgrade/initiate, Starter → /subscribe).
          `canDowngrade` fires only for paid Pro subs with no scheduled
          downgrade yet. When a downgrade IS already scheduled we render a
          third read-only variant so the founder sees the effective date
          without a click. Hidden when the sidebar is collapsed. */}
      {!collapsed && !isBat246Office && (canUpgrade || canDowngrade || downgradeScheduledAt) && (
        <div className="px-3 pt-2 pb-1 bg-[#0a0a0d] flex-shrink-0">
          {canUpgrade ? (
            <Link
              href={upgradeHref}
              className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-[#15151b] transition-colors"
            >
              <span className="text-[11px] text-[#9fa0b8] group-hover:text-white transition-colors">
                {/* An org with no subscription has no plan to name — saying
                    "On current plan" there is worse than saying nothing. */}
                {planSlug ? (
                  <>
                    On <span className="capitalize">{planSlug}</span> plan ·{" "}
                  </>
                ) : (
                  <>No active plan · </>
                )}
                <span className="text-brand font-medium underline decoration-brand/40 underline-offset-2 group-hover:decoration-brand">
                  Upgrade to Pro
                </span>
              </span>
              <ChevronRight className="w-3 h-3 text-[#6b6b80] group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
            </Link>
          ) : downgradeScheduledAt ? (
            <Link
              href="/downgrade"
              className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-[#15151b] transition-colors"
            >
              <span className="text-[11px] text-[#9fa0b8] group-hover:text-white transition-colors">
                Downgrading{" "}
                <span className="text-emerald-400 font-medium underline decoration-emerald-400/30 underline-offset-2 group-hover:decoration-emerald-400">
                  {new Date(downgradeScheduledAt).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </span>
              <ChevronRight className="w-3 h-3 text-[#6b6b80] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ) : (
            <Link
              href="/downgrade"
              className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-[#15151b] transition-colors"
            >
              <span className="text-[11px] text-[#9fa0b8] group-hover:text-white transition-colors">
                On Pro plan ·{" "}
                <span className="text-[#c7c7da] font-medium underline decoration-[#3a3a48] underline-offset-2 group-hover:decoration-[#9fa0b8]">
                  Switch to Starter
                </span>
              </span>
              <ChevronRight className="w-3 h-3 text-[#6b6b80] group-hover:text-[#9fa0b8] group-hover:translate-x-0.5 transition-all" />
            </Link>
          )}
        </div>
      )}

      {/* user menu at the bottom */}
      {/* The rule above the user menu runs straight into the Live Streams
          grid's footer rule, so it uses the same #2E2E2E as the aside and the
          tab bar — at #2a2a35 the seam visibly changed colour at the sidebar
          edge. */}
      <div className={cn("border-t border-[#2E2E2E] bg-[#0a0a0d] flex-shrink-0 z-[50]", collapsed ? "p-1.5" : "p-2")}>
        <UserMenu
          setIsProfileOpen={setIsProfileOpen}
          setIsFirstTimeUser={setIsFirstTimeUser}
          members={members}
          setIsManageOrgOpen={setIsManageOrgOpen}
          amIFounder={amIFounder}
          setIsReferFounderOpen={setIsReferFounderOpen}
          setIsGuestFunnelOpen={setIsGuestFunnelOpen}
          setIsInviteEmployeesOpen={setIsInviteEmployeesOpen}
          setIsRatingsReviewsOpen={setIsRatingsReviewsOpen}
          setActivePopover={setActivePopover}
          affiliateId={affiliateId}
          me={userData}
          collapsed={collapsed}
        />
      </div>

      {/* Ratings & Reviews — rate the offices you've joined, and (for founders)
          moderate every review across the office's products. Mounted at the
          sidebar root rather than inside UserMenu so it outlives the dropdown
          that opened it. */}
      <RatingsReviewsDialog
        open={isRatingsReviewsOpen}
        onClose={() => setIsRatingsReviewsOpen(false)}
        amIFounder={amIFounder}
        orgId={userData?.orgId ?? null}
      />
    </aside>
  );
}

/* ========= helpers ========= */

function SidebarHeader({
  children,
  collapsed,
  top = false,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  top?: boolean;
}) {
  return top ? (
    <></>
  ) : collapsed ? (
    <div className="h-[0.1px] w-full mb-4 bg-[white]/20 mx-auto" />
  ) : (
    <div
      className={[
        "text-[11px] uppercase tracking-wider font-semibold text-[#7c8aff] px-2 mb-1",
        collapsed ? "text-center px-0" : "",
      ].join(" ")}
    >
      {children}
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
  navPopover,
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
  /** Page a custom `onClick` opens, for the right-click menu (SidebarContextMenu). */
  navPopover?: string;
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
          <span className="h-1.5 w-1.5 rounded-full bg-brand opacity-50" />
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
      // Without an onClick the row opens the popover named by its label.
      data-nav-popover={navPopover ?? (onClick ? undefined : label)}
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
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors relative",
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
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      )}
      {!collapsed && (
        <span className="flex items-center justify-between w-full min-w-0">
          <span className="truncate">{label}</span>
          {badge && (
            <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
              {badge}
            </span>
          )}
        </span>
      )}
      {collapsed && badge && (
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0e0e12] pointer-events-none" />
      )}
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
        "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors relative",
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
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      )}
      {!collapsed && (
        <span className="flex items-center justify-between w-full min-w-0">
          <span className="truncate">{label}</span>
          {badge && (
            <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
              {badge}
            </span>
          )}
        </span>
      )}
      {collapsed && badge && (
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0e0e12] pointer-events-none" />
      )}
    </Link>
  );
}

function MemberRow({
  m,
  meId,
  pathname,
  collapsed,
  setActiveChatId,
  activeChatId,
  onSelect,
}: {
  m: Member;
  meId: string;
  pathname: string | null;
  collapsed: boolean;
  setActiveChatId: (v: {
    type: "dm" | "group" | "global-dm";
    id: string;
  }) => void;
  activeChatId: { type: "dm" | "group" | "global-dm"; id: string };
  onSelect?: () => void;
}) {
  const otherId = (m._id ?? m.id) as string | undefined;
  const { activeConvId, dmUnread } = useChat();

  const convId = otherId ? dmConvId(meId, otherId) : undefined;
  const routeActive = otherId
    ? pathname?.startsWith(`/dashboard/dm/${otherId}`)
    : false;
  const isActive = convId ? activeConvId === convId || !!routeActive : false;
  const count = otherId ? dmUnread[otherId] : 0;

  // Debug logging
  if (otherId && dmUnread[otherId]) {
    console.log("[MemberRow] Rendering with unread count:", {
      otherId,
      name: m.name || m.email,
      count,
      dmUnread,
    });
  }

  const initials = (
    m.name?.trim().slice(0, 1) ||
    m.email?.slice(0, 1) ||
    "?"
  ).toUpperCase();

  const href = otherId ? `/dashboard/dm/${otherId}` : "/dashboard";

  return (
    <div
      onClick={() => {
        if (otherId) {
          if (activeChatId.id === otherId) {
            setActiveChatId({
              type: "dm",
              id: "",
            });
          } else {
            setActiveChatId({ type: "dm", id: otherId });
          }
          onSelect?.();
        }
      }}
      className={[
        "group cursor-pointer flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors",
        isActive
          ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
          : "text-[#c7c7da] hover:bg-[#15151b]",
        collapsed ? "justify-center" : "",
      ].join(" ")}
      title={m.name || m.email}
      aria-label={m.name || m.email}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <Avatar
            className="h-7 w-7 border border-[#2f2f3b] bg-[#1b1b24] cursor-pointer hover:opacity-85 transition-opacity"
            onClick={(e) => {
              if (otherId) {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("affiliate-profile:open", {
                    detail: { userId: otherId },
                  })
                );
              }
            }}
          >
            <AvatarImage src={m.profilePicture || ""} />
            <AvatarFallback className="bg-brand text-xs text-brand-foreground font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* Green-dot online indicator removed — replaced by the
              "Active X ago" line under the member name (see below). */}
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-xs truncate w-32">{m.name || m.email}</div>
            {/* "Active X ago" replaces the old green-dot indicator. Drifts
                forward in place via the LastSeen component's internal timer. */}
            <LastSeen
              date={m.lastSeenAt}
              className="text-[10px] text-[#6b6b80] truncate block"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {count && !collapsed ? (
          <span
            className={[
              "rounded-full bg-brand/10 text-white text-[10px]",
              collapsed
                ? "-right-1 -top-1 min-w-[16px] h-[16px] px-1"
                : "-right-2 -bottom-2 min-w-[18px] h-[18px] px-1.5",
            ].join(" ")}
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-[#3d3d51] text-[#c9c9ee] bg-transparent"
            >
              {getBadge(m.role)}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

const getBadge = (role: string) => {
  switch (role) {
    case "founder":
      return "FND";
    case "stakeholder":
      return "STK";
  }
};

function GroupRow({
  g,
  pathname,
  collapsed,
  setActiveChatId,
  activeChatId,
  onSelect,
}: {
  g: Group;
  pathname: string | null;
  collapsed: boolean;
  setActiveChatId: (v: {
    type: "dm" | "group" | "global-dm";
    id: string;
  }) => void;
  activeChatId: { type: "dm" | "group" | "global-dm"; id: string };
  onSelect?: () => void;
}) {
  const { activeConvId, groupUnread, groupMentioned } = useChat();
  const convId = groupConvId(g.id);
  const routeActive = pathname?.startsWith(`/dashboard/g/${g.id}`);
  const isActive = activeConvId === convId || !!routeActive;
  const count = groupUnread[g.id] ?? g.unread ?? 0;

  const initials = (g.name?.trim().slice(0, 1) || "?").toUpperCase();
  return (
    <div
      onClick={() => {
        if (activeChatId.id === g.id) {
          setActiveChatId({ type: "group", id: "" });
        } else {
          setActiveChatId({ type: "group", id: g.id });
        }
        onSelect?.();
      }}
      className={[
        "group cursor-pointer flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors",
        isActive
          ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
          : "text-[#c7c7da] hover:bg-[#15151b]",
        collapsed ? "justify-center" : "",
      ].join(" ")}
      title={g.name}
      aria-label={g.name}
    >
      <div className="flex items-center gap-2 justify-between w-full">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar className="h-7 w-7 border border-[#2f2f3b] bg-[#1b1b24]">
              <AvatarImage src={g.picture || undefined} />
              <AvatarFallback className="text-xs text-brand-foreground font-medium bg-gradient-to-br from-brand to-brand-2">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          {!collapsed && <div className="text-sm">{g.name}</div>}
        </div>
        {count && !collapsed ? (
          <span className="flex items-center gap-1">
            {/* WhatsApp-style "@": an unread message here tags me */}
            {groupMentioned[g.id] && (
              <span
                className="rounded-full bg-brand/10 text-brand text-[10px] font-bold min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center"
                title="You were mentioned"
                aria-label="You were mentioned"
              >
                @
              </span>
            )}
            <span
              className={[
                "rounded-full bg-brand/10 text-white text-[10px]",
                collapsed
                  ? "-right-1 -top-1 min-w-[16px] h-[16px] px-1"
                  : "-right-2 -bottom-2 min-w-[18px] h-[18px] px-1.5",
              ].join(" ")}
            >
              {count > 99 ? "99+" : count}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function UserMenu({
  setIsProfileOpen,
  setIsFirstTimeUser,
  members,
  setIsManageOrgOpen,
  amIFounder,
  setIsReferFounderOpen,
  setIsGuestFunnelOpen,
  setIsInviteEmployeesOpen,
  setIsRatingsReviewsOpen,
  setActivePopover,
  affiliateId,
  me,
  collapsed = false,
}: {
  setIsProfileOpen: (open: boolean) => void;
  setIsFirstTimeUser: (firstTime: boolean) => void;
  members: Member[];
  setIsManageOrgOpen: (open: boolean) => void;
  amIFounder: boolean;
  setIsReferFounderOpen: (open: boolean) => void;
  setIsGuestFunnelOpen: (open: boolean) => void;
  setIsInviteEmployeesOpen: (open: boolean) => void;
  setIsRatingsReviewsOpen: (open: boolean) => void;
  setActivePopover: (popover: string | null) => void;
  affiliateId: string;
  me: any;
  collapsed?: boolean;
}) {
  const router = useRouter();
  const meId = getUserIdFromToken() || "";
  // const me = members.find((m) => (m._id ?? m.id) === meId);
  const { isAdmin } = useIsAdmin();

  const initials = (
    me?.name?.trim().slice(0, 1) ||
    me?.email?.slice(0, 1) ||
    "?"
  ).toUpperCase();

  const [isOpen, setIsOpen] = useState(false);

  // Put this account's face in the switcher.
  //
  // The ledger is seeded from the JWT, which carries userId, name and email
  // but no picture — so every row rendered as initials. The sidebar has
  // already resolved the picture to draw the chip above, so file it against
  // the account that is live right now. Each account records its own on the
  // way past, which is why a second account shows initials only until the
  // first time it is used.
  useEffect(() => {
    const picture = me?.profilePicture;
    if (picture) setAccountPicture(meId, picture);
  }, [me?.profilePicture, meId]);

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(open) => {
        console.log("[UserMenu] DropdownMenu onOpenChange:", open);
        setIsOpen(open);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full text-left flex items-center gap-2.5 rounded-lg p-1.5 transition-all duration-150 outline-none hover:bg-[#15151b] cursor-pointer",
            collapsed ? "justify-center" : ""
          )}
          aria-label="User menu"
          onClick={(e) => {
            console.log("[UserMenu] Button clicked!", e);
            setIsOpen(true);
          }}
          onTouchEnd={(e) => {
            console.log("[UserMenu] Button touched!", e);
            e.preventDefault();
            setIsOpen(true);
          }}
        >
          <Avatar className="h-9 w-9 border border-[#2f2f3b] bg-[#1b1b24] flex-shrink-0">
            <AvatarImage src={me?.profilePicture || ""} />
            <AvatarFallback className="bg-brand text-sm text-brand-foreground font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 flex flex-col justify-center text-left">
                <span className="text-sm font-semibold text-white truncate leading-snug">
                  {me?.name || me?.email?.split("@")[0] || "User"}
                </span>
                <span className="text-xs text-[#6a6a7a] truncate leading-tight">
                  {me?.email || ""}
                </span>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-[#6a6a7a] flex-shrink-0 ml-auto" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align={collapsed ? "center" : "start"}
        className="w-52 bg-[#1a1a22] border-[#2a2a35] text-[#c7c7da] z-[9999] p-1.5 shadow-xl"
        sideOffset={12}
        forceMount={isOpen ? true : undefined}
        onCloseAutoFocus={(e) => {
          console.log("[UserMenu] DropdownMenuContent onCloseAutoFocus");
          e.preventDefault();
        }}
        style={{ pointerEvents: "auto" }}
      >
        <DropdownMenuItem
          className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
          onClick={() => {
            setIsProfileOpen(true);
            setIsFirstTimeUser(false);
          }}
        >
          <User className="h-4 w-4 mr-2" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
          onClick={() => {
            router.push("/my-requests");
          }}
        >
          <Clock className="h-4 w-4 mr-2" />
          Join Requests
        </DropdownMenuItem>
        <DropdownMenuItem
          className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
          onClick={() => {
            setIsRatingsReviewsOpen(true);
          }}
        >
          <Star className="h-4 w-4 mr-2" />
          Ratings &amp; Reviews
        </DropdownMenuItem>
        {amIFounder && (
          <DropdownMenuItem
            className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
            onClick={() => {
              setIsManageOrgOpen(true);
            }}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Org
          </DropdownMenuItem>
        )}
        {/* <DropdownMenuItem
          className="hover:bg-[#15151b] hover:text-white focus:bg-[#15151b] focus:text-white cursor-pointer"
          onClick={() => {
            setIsReferFounderOpen(true);
          }}
        >
          <Rocket className="h-4 w-4 mr-2" />
          Invite Friend to Launch Office
        </DropdownMenuItem> */}
        {/* Signed-in accounts + "Add account". Sits with Logout because
            switching and signing out are the same decision from the user's
            side — which account am I using — and this menu is where the chip
            in the sidebar already points. */}
        <DropdownMenuSeparator className="bg-[#2a2a35]" />
        <AccountSwitcher onAction={() => setIsOpen(false)} />
        <DropdownMenuSeparator className="bg-[#2a2a35]" />
        <DropdownMenuItem
          className="hover:bg-[#15151b] focus:bg-[#15151b] cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300"
          onClick={async () => {
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
            window.dispatchEvent(new CustomEvent("auth:logout"));
            // Other accounts on this browser stay signed in — this hands over
            // to one of them, and only lands on /login when this was the last.
            signOutActiveAccount("/login");
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
