// Garage 2.0-frontend/app/(dashboard)/layout.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useState, useCallback, Suspense, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  clearToken,
  getOrgId,
  getToken,
  getUserIdFromToken,
  isTokenExpired,
  saveOrgId,
} from "@/lib/auth";
import { getEmployee } from "@/components/dashboard/inlineApps/teamforce/api";

import { ChatProvider, useChat } from "@/lib/chat-context";
import { WorkspaceLiveKitProvider } from "@/lib/workspace-livekit-context";
import WorkspacePipBridge from "@/components/dashboard/WorkspacePipBridge";
import { dmConvId, groupConvId, globalDmConvId } from "@/lib/conv";
import { connectSocket } from "@/lib/socket";
import InviteMemberDialog from "@/components/dashboard/InviteMemberDialog";
import CreateGroupDialog from "@/components/dashboard/CreateGroupDialog";
import { WebRTCProvider, useWebRTC } from "@/lib/webrtc-context";
import { ScreenRecordingProvider } from "@/lib/screen-recording-context";
import { FloatingRecordingIndicator } from "@/components/ui/floating-recording-indicator";
import IncomingCallDialog from "@/components/dashboard/IncomingCallDialog";
import VideoCallOverlay from "@/components/dashboard/VideoCallOverlay";
import AudioCallOverlay from "@/components/dashboard/AudioCallOverlay";
import AppIcon from "@/components/dashboard/AppIcon";
import DashboardPage from "@/components/dashboard/DashboardPage";
import MarketplacePage, { CATALOG } from "@/components/dashboard/Marketplace";
import BackOfficeLockedOverlay from "@/components/dashboard/BackOfficeLockedOverlay";
import { useCanUpgrade } from "@/components/dashboard/UpgradeToProModal";
import DMPage from "@/components/dashboard/DMPage";
import GroupPage from "@/components/dashboard/GroupChatPage";
import GlobalDMPage from "@/components/dashboard/GlobalDMPage";
import Image from "next/image";
import { toast } from "sonner";
// Full Add Lead modal is mounted inside Deals inline app (no navigation).
import {
  SidebarCollapseProvider,
  useSidebarCollapse,
} from "@/lib/sidebar-collapse-context";
import InvitesPage from "@/components/dashboard/InviteePage";
import AppContainer from "@/components/dashboard/AppContainer";
import TasksPage from "@/components/dashboard/TasksPage";
import { ProfilePopover } from "@/components/shared/ProfilePopover";
import { useAuthStore } from "@/store/authStore";
import { AffiliateProfileOverlay } from "@/components/affiliate/globe";
import WelcomeModal from "@/components/dashboard/WelcomeModal";
import PhoneVerifyBanner from "@/components/shared/PhoneVerifyBanner";
import OrgKycBanner from "@/components/shared/OrgKycBanner";
import AnnouncementHost from "@/components/announcements/AnnouncementHost";
import MainSidebar from "@/components/dashboard/MainSidebar";
import MobileHeader from "@/components/dashboard/MobileHeader";
import MobileSidebarOverlay from "@/components/dashboard/MobileSidebarOverlay";
import MobileRightPanelOverlay from "@/components/dashboard/MobileRightPanelOverlay";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getUserDataFromToken } from "@/lib/auth";
import { usePresenceTracking } from "@/lib/hooks/usePresenceTracking";
import { MobileSidebarProvider } from "@/lib/mobile-sidebar-context";
import { WhitelabelProvider } from "@/lib/whitelabel-context";
import { BrandColorProvider } from "@/lib/brand-color-context";
import { SellablePublishedHost } from "@/components/shared/SellablePublishedModal";
import ProjectMangement from '@/components/athena/ProjectMangement'
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { canSendDocuments, isDocusignAdminUser } from "@/lib/docusign/access";
import { RecentTabs } from '@/components/dashboard/RecentTabs'
import AppTabBar from "@/components/dashboard/AppTabBar";
import { BAT246_HOME_PATH } from "@/lib/bat246Office";
import SidebarContextMenu, { OFFICE_PAGE, type NavNode, type NavPageState } from "@/components/dashboard/SidebarContextMenu";
import SidePeekPanel, { type SidePeek } from "@/components/dashboard/SidePeekPanel";
import { useNavigationHistory } from "@/lib/hooks/useNavigationHistory";
import { isFounderPage, type TabSet } from "@/lib/founderPages";
import NotificationPage from "@/components/dashboard/NotificationPage";
import RightPanel from "@/components/dashboard/RightPanel";

import Overview from './taskroom/overview/page'
import AllTaskroom from './taskroom/all-taskrooms/page'
import AssingToMe from './taskroom/assigned-to-me/page'
export type Member = {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  role: "founder" | "stakeholder";
  profilePicture?: string;
};
export type Group = {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  unread?: number;
};

const TASKROOM_BOTTOM_NAV_MAP: Record<string, string> = {
  People: "WorkspacePeople",
  Setting: "WorkspaceSettings",
  TimeSheets: "TimeSheets",
  AssignedToMe: "AssignedToMe",
  AllTasks: "AllTasks",
  Dashboard: "DashMangement",
  ImportExport: "ImportExport",
};

/**
 * Storefront item type → the popover that is that type's Discover section.
 *
 * Used by the `?openApp=discover` deep link (see the effect in LayoutInner),
 * which is how a buyer who just joined an org lands on the thing they clicked
 * on garage.app — inside the workspace, in the section it belongs to, rather
 * than on the public guest page for an office they're now a member of.
 */
const DISCOVER_POPOVER: Record<string, string> = {
  channel: "Communities:Discover",
  course: "Learn",
  workshop: "Live:Discover",
  product: "Products:Browse",
  service: "Services:Browse",
  call: "1:1 Calls:calls",
};

/**
 * `?openApp=<slug>` → the panel it opens.
 *
 * The dashboard is ONE route whose sections are React state, not URLs — there
 * is no /taskroom or /events to link to, so a plain path either 404s or drops
 * the user on the bare workspace. This map is what gives those panels an
 * addressable link. Values are `activePopover` names; the sync effect further
 * down turns the four inline-app names (Deals / Notes / Network Mail /
 * Teamforce) into their container, so popover alone is enough here.
 *
 * Main consumer: announcement CTAs — see DEEP_LINK_TARGETS in
 * lib/announcements.ts, which must only ever offer slugs that exist here.
 */
const OPEN_APP_POPOVER: Record<string, string> = {
  taskroom: "Taskroom",
  deals: "Deals",
  mail: "Network Mail",
  notes: "Notes",
  thoughts: "Notes",
  orders: "Orders",
  vault: "Vault",
  feeds: "Feeds",
  communities: "Communities:Discover",
  drops: "Drops:Feed",
  learn: "Learn",
  courses: "Learn",
  // "Events" in the product are live sessions / webinars.
  events: "Live:Discover",
  live: "Live:Discover",
  "live-enrolled": "Live:Enrolled",
  recordings: "Live:Recorded",
  store: "Products:Browse",
  products: "Products:Browse",
  services: "Services:Browse",
  calls: "1:1 Calls:calls",
  teamforce: "Teamforce",
  // Garage Jobs member side; CandidateJobsApp reads jobId/ref/apply itself.
  jobs: "Job Board",
};

// Pages the deep-link effect opens from a slug it handles itself, rather
// than through OPEN_APP_POPOVER.
const OPEN_APP_SLUG_EXTRA: Record<string, string> = {
  "Teamforce:dashboard": "teamforce",
  Whitelabel: "whitelabel",
  GaragePay: "garagepay",
  Cabinet: "cabinet",
  Support: "support",
  "Live:Recording": "recordings",
};

// A `?openApp=` URL that reopens this page in a fresh browser tab, for the
// sidebar's right-click menu. Null when the page has no slug.
const openAppLinkFor = (popover: string): string | null => {
  const slug =
    OPEN_APP_SLUG_EXTRA[popover] ??
    Object.keys(OPEN_APP_POPOVER).find((key) => OPEN_APP_POPOVER[key] === popover);
  return slug ? `${window.location.origin}/workspace?openApp=${slug}` : null;
};

// Pages the side peek can't show beside the main view: shared stores or live
// connections (Taskroom, Conference, Deskstream), DocuSign's deep-link state,
// the events console (it drives the bottom bar), autoplaying Drops, and the
// inline apps, which render through AppContainer rather than getActiveComp.
const NO_SIDE_PEEK = new Set(["Taskroom", "docusign", "Conference", "Deskstream", "Deals", "Notes", "Network Mail"]);

const canSidePeek = (popover: string): boolean =>
  !NO_SIDE_PEEK.has(popover) &&
  !popover.startsWith("Teamforce") &&
  !popover.startsWith("Founder:Events") &&
  !popover.startsWith("Drops") &&
  popover !== "Content:Drops" &&
  popover !== "Founder:Content:Drops";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const normalizeTab = (tabName: string | null): string => {
  if (!tabName) return "Community";

  // Founder console: one tab per section (Founder:Live:Orders -> Founder:Live).
  // Recordings, articles and analytics sit under Content, as in getPageGroup.
  if (tabName.startsWith("Founder:")) {
    if (tabName === "Founder:Live:Recordings" || tabName === "Founder:Articles" || tabName === "Founder:Analytics") {
      return "Founder:Content";
    }
    return tabName.split(":").slice(0, 2).join(":");
  }

  if (tabName === "Live:Recording" || tabName === "Live:Recorded") {
    return "Content";
  }

  if (tabName.startsWith("1:1 Calls:")) {
    return "1:1 Calls";
  }
  if (tabName.startsWith("Office Settings:")) {
    return "Office Settings";
  }

  // 1. First split by ':' to handle sub-tabs
  let base = tabName;
  if (tabName !== "1:1 Calls" && tabName.includes(":")) {
    base = tabName.split(":")[0];
  }

  // 2. Map aliases to standard tab names
  switch (base) {
    case "Long Form Videos":
    case "Drops":
      return "Content";
    case "Learn":
      return "Courses";
    case "Live Streams":
      return "Live";
    case "Digital Products":
      return "Products";
    case "Job Marketplace":
      return "Marketplace";
    case "My Jobs":
      return "Jobs";
    case "My Ai Employees":
      return "Ai Employees";
    case "Notification":
      return "Notifications";
    case "Clipping":
      return "Content Rewards";
    case "Communities":
    case "ReservedCommunities":
    case "Feeds":
    case "Org Cabinet":
    case "OfficeStream":
    case "Conference":
    case "Conference:Notes":
      return "Community";
    case "Thoughts":
      return "Notes";
    case "Taskroom":
      return "Taskroom";
    default:
      return base;
  }
};

// Founder tab ids keep the "Founder:" prefix so they never share a
// lastActiveSubpages slot with the customer tab of the same name. This is
// the name the tab bar shows for them.
const FOUNDER_TAB_LABELS: Record<string, string> = {
  "Founder:Communities": "Community",
  "Founder:Live": "Live Streams",
  "Founder:Content": "Content",
  "Founder:Courses": "Courses",
  "Founder:Calls": "1:1 Calls",
  "Founder:Products": "Products",
  "Founder:Events": "Events",
  "Founder:Services": "Services",
  "Founder:Jobs": "Jobs",
};

const getTabLabel = (tab: string): string =>
  FOUNDER_TAB_LABELS[tab] ?? (tab.startsWith("Founder:") ? tab.slice("Founder:".length) : tab);

// Tabs that group several pages without being a page themselves open the
// same page the sidebar item does.
const TAB_DEFAULT_PAGE: Record<string, string> = {
  "Founder:Content": "Founder:Content:Videos",
};

// The sidebar's global pages (listed under every menu) and notifications.
// Opening one keeps whichever tab set is showing.
const SHARED_TABS = new Set([
  "Orders",
  "GaragePay",
  "Vault",
  "Rank Bonus",
  "Support",
  "Auction",
  "1Network",
  "Notifications",
]);

// Which tab set a page belongs to; null means keep the current one.
const getTabSet = (popover: string | null, pathname: string | null): TabSet | null => {
  if (!popover) {
    // No popover on /workspace is the Community home. Elsewhere nothing is
    // open, except Coverfi, which sits in the Founders menu.
    if (pathname === "/workspace") return "main";
    return pathname?.startsWith("/coverfi") ? "founders" : null;
  }
  if (isFounderPage(popover)) return "founders";
  return SHARED_TABS.has(normalizeTab(popover)) ? null : "main";
};

// Page tabs. Navigating keeps one tab per section (the ids above), which
// follows you around inside it. "Open in new tab" in the sidebar's right-click
// menu instead opens a tab pinned to one page, so every page can have its own
// tab even while its section's tab is open. Its id is the page (or
// OFFICE_PAGE, the Community home, which has no popover) behind this prefix.
const PAGE_TAB_PREFIX = "@page:";
const isPageTab = (tab: string) => tab.startsWith(PAGE_TAB_PREFIX);
const pageTabFor = (page: string) => PAGE_TAB_PREFIX + page;
const pageOfTab = (tab: string) => tab.slice(PAGE_TAB_PREFIX.length);
const sectionOfPage = (page: string) => normalizeTab(page === OFFICE_PAGE ? null : page);

const recentTabsKey = (set: TabSet, orgId: string | null): string => {
  const base = set === "founders" ? "garage_recent_founder_tabs" : "garage_recent_tabs";
  return orgId ? `${base}_${orgId}` : base;
};

const pageTabLabelsKey = (orgId: string | null): string =>
  orgId ? `garage_page_tab_labels_${orgId}` : "garage_page_tab_labels";

// What each page tab is called, as the sidebar row that opened it named it.
const loadPageTabLabels = (orgId: string | null): Record<string, string> => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(pageTabLabelsKey(orgId)) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

// An org's saved tabs (sessionStorage), per set. Sessions from before the
// split keep founder pages in the main list, the console ones collapsed into
// a single "Founder" tab: drop that one and move the rest over.
const loadRecentTabs = (orgId: string | null): Record<TabSet, string[]> => {
  const load = (set: TabSet): string[] => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(recentTabsKey(set, orgId)) || "[]");
      return Array.isArray(parsed)
        ? parsed.map((t) => (isPageTab(t) ? t : normalizeTab(t))).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  };
  const isFounderTab = (t: string) => isFounderPage(isPageTab(t) ? pageOfTab(t) : t);
  const main = load("main");
  return {
    main: Array.from(new Set(main.filter((t) => t !== "Founder" && !isFounderTab(t)))),
    founders: Array.from(new Set([...load("founders"), ...main.filter(isFounderTab)])),
  };
};

const isVideoSizingPage = (popover: string | null) => {
  if (!popover) return false;
  return [
    "Content:AllVideos",
    "Content",
    "Long Form Videos",
    "Content:Videos",
    "Content:Playlists",
    "Content:Drops",
    "Drops",
    "Drops:Feed",
    "Drops:Uploads",
    "Live:Recording",
    "Live:Recorded",
    "Recorded Live Stream"
  ].includes(popover);
};

// Which pillar a console section belongs to. Mirrors the events module's own
// grouping — if a section moves pillar, change it in both places.
const EVENT_SECTION_PILLAR: Record<string, "plan" | "sell" | "reach"> = {
  overview: "plan",
  agenda: "plan",
  speakers: "plan",
  sponsors: "plan",
  tickets: "sell",
  registrations: "sell",
  coupons: "sell",
  website: "reach",
  campaigns: "reach",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <WebRTCProvider>
        <ScreenRecordingProvider>
          {/* Shared workspace LiveKit instance so the HQ conference
              room call survives navigation between WorkspaceClient
              and ConferenceRoomPage (both consume the same hook).
              Mounted here (above SidebarCollapseProvider) so it
              encompasses every (dashboard) child — the call doesn't
              evaporate when the user jumps from /workspace to
              /conference-room or any other dashboard route. */}
          <WorkspaceLiveKitProvider>
            <SidebarCollapseProvider>
              <MobileSidebarProvider>
                <WhitelabelProvider>
                  {/* Paints --brand from the selected office's
                      branding.primaryColor, so the tab bar, sidebars
                      and right panel carry the office colour instead
                      of Garage yellow. Inside WhitelabelProvider —
                      it defers to the domain lookup's colours on a
                      white-label host. */}
                  <BrandColorProvider>
                    {/* LayoutInner calls useSearchParams() — wrap in
                        Suspense so any page under (dashboard) can still
                        be statically prerendered (Next 15 requirement). */}
                    <Suspense fallback={null}>
                      <LayoutInner>{children}</LayoutInner>
                    </Suspense>
                    {/* Persistent in-app PiP for the workspace call.
                        Mounted INSIDE WorkspaceLiveKitProvider so it
                        can see the shared call state; renders a
                        compact floating pill whenever the user is in
                        a workspace call but viewing a non-workspace
                        URL. The lift to a provider (f5af85ba +
                        ff2a831b) is what makes this possible — the
                        call survives navigation now. */}
                    <WorkspacePipBridge />
                    {/* "Published — now share it" popup that every
                        sellable create flow opens via
                        showSellablePublished(). Inside BrandColorProvider
                        so it paints in the office's colour. */}
                    <SellablePublishedHost />
                  </BrandColorProvider>
                </WhitelabelProvider>
              </MobileSidebarProvider>
            </SidebarCollapseProvider>
          </WorkspaceLiveKitProvider>
        </ScreenRecordingProvider>
      </WebRTCProvider>
    </ChatProvider>
  );
}

import { useHydration } from "@/lib/hooks/useHydration";
import CalendarPage from "@/components/dashboard/CalendarPage";
import CabinetPage from "@/components/dashboard/CabinetPage";
import OrganizationCabinetPage from "@/components/dashboard/OrganizationCabinetPage";
import dynamic from "next/dynamic";
// react-pdf touches browser-only globals (document, DOMMatrix) at module load time,
// so this must never be evaluated during SSR — same reason WorkspaceClient is loaded
// this way (see app/(dashboard)/workspace/loader.tsx).
// The loading fallback matters here: this chunk carries react-pdf + pdfjs-dist, so it is one
// of the larger ones in the app. Without it the DocuSign tab (and the ?openApp=docusign email
// deep link) renders nothing at all while it downloads.
const DocusignPage = dynamic(() => import("@/components/dashboard/docusign/DocusignPage"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#7a7a90]" />
    </div>
  ),
});
// Garage Jobs founder console — one client module for every Founder:Jobs page.
const FounderJobsApp = dynamic(() => import("@/components/dashboard/jobs/founder/FounderJobsApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#7a7a90]" />
    </div>
  ),
});
// Garage Jobs member side (Job Board) — Discover, job, apply, applications, saved.
const CandidateJobsApp = dynamic(() => import("@/components/dashboard/jobs/candidate/CandidateJobsApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#7a7a90]" />
    </div>
  ),
});
import FounderCabinetPage from "@/components/dashboard/FounderCabinetPage";
import BettyDashboardPage from "@/components/dashboard/BettyDashboardPage";
import FounderLeaveDashboard from "@/components/dashboard/FounderLeaveDashboard";
// ActivityPage (realtime "Team Activity" panel) hidden at user request.
// Import + render commented for revert; state is left in place so the
// other sidebar children that still receive `isActivityOpen` as a prop
// keep typechecking (the panel just never opens).
// import ActivityPage from "@/components/dashboard/ActivityPage";
import AskCabinetSidebar from "@/components/dashboard/AskCabinetSidebar";
import EventsApp from "@/components/dashboard/inlineApps/events/EventsApp";
import EventsBrowse from "@/components/dashboard/inlineApps/events/EventsBrowse";
import EventsPurchases from "@/components/dashboard/inlineApps/events/EventsPurchases";
import DeskstreamPage from "@/components/dashboard/DeskstreamPage";
import AuctionPage from "./auction/page";
import {
  FeedPage,
  WorkshopsPage,
  CoursesPage,
  ContentPage,
  ProductsPage,
  ServicesPage,
  CallsPage,
  OrdersPage,
  FounderCommunityOrdersPage,
  FounderLiveOrdersPage,
  FounderCourseOrdersPage,
  FounderProductOrdersPage,
  FounderProductCustomersPage,
  FounderUnsubLogPage,
  WalletPage,
  AffiliatePage,
  ChannelsPage,
  CustomersPage,
  RecordedLiveStreamPage,
  DropsPage,
  AllVideosPage,
  ContentAnalyticsPage,
  ContentRewardsPage,
  ContentRewardsAffiliatePage,
  AffiliateLeaderboardPage,
} from "@/components/dashboard/RevenueNetworkPages";
import RankBonusPage from "@/components/dashboard/RankBonusPage";
import PendingRequestsPage from "@/components/dashboard/PendingRequestsPage";
import InitialSetupPage from "@/components/dashboard/InitialSetupPage";
import DomainManagementPage from "@/components/dashboard/DomainManagementPage";
import SupportTicketsPage from "@/components/dashboard/SupportTicketsPage";
import CoworkingSpacesPage from "@/components/dashboard/CoworkingSpacesPage";
import AIProvidersPage from "@/components/dashboard/AIProvidersPage";
import ManagementPage from "@/components/dashboard/ManagementPage";
import WhitelabelPage from "@/components/dashboard/WhitelabelPage";
import WhitelabelGate from "@/components/dashboard/WhitelabelGate";
import AccessInboxModal from "@/components/dashboard/teamAccess/AccessInboxModal";
import AIManagementPage from "@/components/dashboard/AIManagementPage";
import { TestimonialsPage } from "@/components/dashboard/TestimonialsPage";
import { ArticlesPage } from "@/components/dashboard/ArticlesPage";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X, Rss, Radio, CalendarDays, ArrowLeft, ClipboardCheck, Users, SquarePen, Bookmark, LogOut, LogIn, Coffee, Video, Gift, Calendar, CheckCircle, ListMusic, Zap, FileText, BarChart3, BookOpen, ShoppingBag, Briefcase, ClipboardList, Phone, CreditCard, RefreshCw, CalendarClock, TicketCheck, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Building2, UserPlus, Clock, Tag, Globe, Palette, Mail, LayoutDashboard, LayoutGrid, TrendingUp, Users2, Building, Package, Star, LayoutTemplate, Archive, History, Settings, Send, Cloud, Mailbox, Contact, Compass, ClipboardClock, Folder, FolderOpen, FolderPlus, Plus, PlusCircle, Search, Umbrella, Voicemail, Camera, Tv, ListVideo, Play, PieChart, Filter, Gauge, Layers, Pencil, Upload, Download, Lock, UserRoundCog, Eye, EyeOff, ExternalLink, Inbox, UserCheck } from "lucide-react";
import { WorkspaceToolbar } from "./workspace/components/WorkspaceToolbar";
import { getOrgChannels, getSubscribedChannels, type Channel, type SubscribedChannel } from "@/lib/feed-api";
import { OfficeSubscriptionLock } from "@/components/dashboard/OfficeSubscriptionLock"; 
import ConferenceRoomPage from "@/components/dashboard/ConferenceRoomPage";
import ConferenceNotesPage from "@/components/dashboard/ConferenceNotesPage";
import { useWhitelabelContext } from "@/lib/whitelabel-context";
import { GuestFunnelDialog } from "@/components/shared/GuestFunnelDialog";
import { GlobalKnockRing } from "@/components/dashboard/GlobalKnockRing";
import { ManageOrgPopover } from "@/components/shared/ManageOrgPopover";
import { ReferFounderDialog } from "@/components/shared/ReferFounderDialog";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const isHydrated = useHydration();
  const { isWhitelabel, isLoading: whitelabelLoading } = useWhitelabelContext();

  // Track user presence (online/offline status)
  usePresenceTracking();

  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [meId, setMeId] = useState("");
  const [showCommunitiesMenuPopover, setShowCommunitiesMenuPopover] = useState(false);
  const [showFeedsDropdownPopover, setShowFeedsDropdownPopover] = useState(false);
  const [showLiveStreamsMenuPopover, setShowLiveStreamsMenuPopover] = useState(false);
  const [showVideosMenuPopover, setShowVideosMenuPopover] = useState(false);
  // "Create Live Stream" splits into Instant vs Schedule.
  const [showCreateStreamMenuPopover, setShowCreateStreamMenuPopover] = useState(false);
  const [feedsTabCoords, setFeedsTabCoords] = useState<{ left: number; bottom: number } | null>(null);
  const [communitiesTabCoords, setCommunitiesTabCoords] = useState<{ left: number; bottom: number } | null>(null);
  const [liveStreamsTabCoords, setLiveStreamsTabCoords] = useState<{ left: number; bottom: number } | null>(null);
  const [videosTabCoords, setVideosTabCoords] = useState<{ left: number; bottom: number } | null>(null);
  const [createStreamTabCoords, setCreateStreamTabCoords] = useState<{ left: number; bottom: number } | null>(null);

  const updatePopupCoords = useCallback(() => {
    if (typeof window === "undefined") return;

    // Bail out when the measured position is unchanged. Without this every
    // scroll/resize event writes five brand-new objects and re-renders the
    // whole dashboard layout, which is what made the dock dropdowns flicker.
    const measure = (
      id: string,
      setter: React.Dispatch<React.SetStateAction<{ left: number; bottom: number } | null>>
    ) => {
      const el = document.getElementById(id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = {
        left: rect.left + rect.width / 2,
        bottom: window.innerHeight - rect.top + 16,
      };
      setter((prev) =>
        prev && prev.left === next.left && prev.bottom === next.bottom ? prev : next
      );
    };

    measure("bottom-nav-tab-Feeds", setFeedsTabCoords);
    measure("bottom-nav-tab-CommunitiesMenu", setCommunitiesTabCoords);
    measure("bottom-nav-tab-LiveStreamsMenu", setLiveStreamsTabCoords);
    measure("bottom-nav-tab-VideosMenu", setVideosTabCoords);
    measure("bottom-nav-tab-CreateWebinar", setCreateStreamTabCoords);
  }, []);

  // Measure synchronously before paint. A setTimeout here meant the popover's
  // first frame used the previous tab's coordinates (or none at all) and then
  // jumped into place. useLayoutEffect is a no-op on the server, so fall back
  // to useEffect there to avoid React's SSR warning.
  useIsomorphicLayoutEffect(() => {
    if (showFeedsDropdownPopover || showCommunitiesMenuPopover || showLiveStreamsMenuPopover || showVideosMenuPopover || showCreateStreamMenuPopover) {
      updatePopupCoords();
      window.addEventListener("resize", updatePopupCoords);
      window.addEventListener("scroll", updatePopupCoords, true);
      return () => {
        window.removeEventListener("resize", updatePopupCoords);
        window.removeEventListener("scroll", updatePopupCoords, true);
      };
    }
  }, [showFeedsDropdownPopover, showCommunitiesMenuPopover, showLiveStreamsMenuPopover, showVideosMenuPopover, showCreateStreamMenuPopover, updatePopupCoords]);

  const [feedsSearchQuery, setFeedsSearchQuery] = useState("");
  const [feedsChannels, setFeedsChannels] = useState<Channel[]>([]);
  const [subscribedChannels, setSubscribedChannels] = useState<SubscribedChannel[]>([]);
  const [feedsSubscribedChannelId, setFeedsSubscribedChannelId] = useState<string | null>(null);
  const [feedsFavourites, setFeedsFavourites] = useState<string[]>([]);
  const [dmNotification, setDmNotification] = useState<{
    show: boolean;
    senderName: string;
    message: string;
    senderId: string;
  }>({ show: false, senderName: "", message: "", senderId: "" });

  const [groupNotification, setGroupNotification] = useState<{
    show: boolean;
    senderName: string;
    message: string;
    groupId: string;
    groupName: string;
  }>({ show: false, senderName: "", message: "", groupId: "", groupName: "" });

  const [globalDmNotification, setGlobalDmNotification] = useState<{
    show: boolean;
    senderName: string;
    message: string;
    senderId: string;
  }>({ show: false, senderName: "", message: "", senderId: "" });

  const [mentionNotification, setMentionNotification] = useState<{
    show: boolean;
    type: "post_mention" | "comment_mention";
    authorName: string;
    authorPicture?: string;
    message: string;
    postId: string;
    channelId?: string;
    commentId?: string;
  }>({
    show: false,
    type: "post_mention",
    authorName: "",
    message: "",
    postId: "",
  });

  // Initialize meId
  useEffect(() => {
    const id = getUserIdFromToken() || "";
    setMeId(id);
  }, []);

  // Notification sound helper
  const playNotificationSound = () => {
    try {
      // Play custom notification sound from public folder
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.5; // 50% volume
      audio
        .play()
        .then(() => {
          console.log("[Dashboard] Notification sound played");
        })
        .catch((error) => {
          console.error(
            "[Dashboard] Failed to play notification sound:",
            error
          );
          // Fallback to beep sound if file doesn't exist
          try {
            const audioContext = new (window.AudioContext ||
              (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = "sine";

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
              0.01,
              audioContext.currentTime + 0.5
            );

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
          } catch (fallbackError) {
            console.error(
              "[Dashboard] Fallback sound also failed:",
              fallbackError
            );
          }
        });
    } catch (error) {
      console.error("[Dashboard] Failed to create audio element:", error);
    }
  };

  // Load favorites from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const favs = localStorage.getItem("feeds:favourites");
        if (favs) {
          setFeedsFavourites(JSON.parse(favs));
        }
      } catch (err) {
        console.error("Failed to load feeds:favourites", err);
      }
    }
  }, []);

  // Save favorites helper
  const toggleFeedFavourite = (channelId: string) => {
    setFeedsFavourites((prev) => {
      const next = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      localStorage.setItem("feeds:favourites", JSON.stringify(next));
      return next;
    });
  };

  // Fetch channels for layout popover switcher
  useEffect(() => {
    const orgId = typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null;
    if (!orgId) return;

    const fetchChannels = async () => {
      try {
        const [allChannelsData, subscribedData] = await Promise.all([
          getOrgChannels(orgId),
          getSubscribedChannels(orgId).catch(() => ({ channels: [], isFounder: false }))
        ]);
        setFeedsChannels(allChannelsData.channels || []);
        setSubscribedChannels(subscribedData.channels || []);
      } catch (err) {
        console.error("Error fetching channels for feeds popover:", err);
      }
    };

    fetchChannels();
    // Re-fetch when popover opens to keep it fresh
    if (showFeedsDropdownPopover) {
      fetchChannels();
    }
  }, [showFeedsDropdownPopover]);

  // Sync feedsSubscribedChannelId with page selection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const initialChannel = sessionStorage.getItem("feed:selected-channel-id");
      if (initialChannel) {
        setFeedsSubscribedChannelId(initialChannel);
      }
    }

    const handleChannelChanged = (event: CustomEvent<{ channelId: string }>) => {
      const { channelId } = event.detail;
      if (channelId && channelId !== feedsSubscribedChannelId) {
        setFeedsSubscribedChannelId(channelId);
      }
    };

    window.addEventListener("feed:channel-changed" as any, handleChannelChanged);
    return () => {
      window.removeEventListener("feed:channel-changed" as any, handleChannelChanged);
    };
  }, [feedsSubscribedChannelId]);

  const handleSelectFeedChannel = (channelId: string) => {
    setFeedsSubscribedChannelId(channelId);
    sessionStorage.setItem("feed:selected-channel-id", channelId);
    window.dispatchEvent(new CustomEvent("feed:switch-channel", { detail: { channelId } }));
    setShowFeedsDropdownPopover(false);
  };

  const formatMemberCount = (count?: number) => {
    if (!count) return "0 members";
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k members`;
    }
    return `${count} member${count !== 1 ? "s" : ""}`;
  };

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      console.log(
        "[Dashboard] Initial notification permission:",
        Notification.permission
      );

      if (Notification.permission === "default") {
        console.log("[Dashboard] Requesting notification permission...");
        Notification.requestPermission().then((permission) => {
          console.log(
            "[Dashboard] Notification permission response:",
            permission
          );
          if (permission === "granted") {
            console.log("[Dashboard] ✅ Notifications are now enabled!");
          } else if (permission === "denied") {
            console.warn(
              "[Dashboard] ❌ Notifications were denied. Please enable them in browser settings."
            );
          }
        });
      } else if (Notification.permission === "granted") {
        console.log("[Dashboard] ✅ Notifications are already enabled");
      } else if (Notification.permission === "denied") {
        console.warn(
          "[Dashboard] ⚠️ Notifications are blocked. Please enable them in browser settings."
        );
      }
    } else {
      console.warn("[Dashboard] ⚠️ Browser notifications are not supported");
    }
  }, []);

  // Global DM notification listener
  useEffect(() => {
    if (!meId) return;

    const socket = connectSocket();

    const handleDMMessage = (message: any) => {
      console.log("[Dashboard] DM message received:", message);

      // Only show notification if message is not from me
      if (message.from !== meId) {
        // Find sender info from members
        const sender = members.find((m) => (m._id || m.id) === message.from);
        const senderName = sender?.name || sender?.email || "Someone";
        const messagePreview = message.text
          ? message.text.length > 50
            ? message.text.substring(0, 50) + "..."
            : message.text
          : message.attachments && message.attachments.length > 0
            ? `Sent ${message.attachments.length} file${message.attachments.length > 1 ? "s" : ""
            }`
            : "New message";

        console.log("[Dashboard] Showing notification toast:", {
          senderName,
          messagePreview,
        });

        // Show toast notification (disabled as requested)
        /*
        setDmNotification({
          show: true,
          senderName,
          message: messagePreview,
          senderId: message.from,
        });
        */

        // Auto-close after 5 seconds
        setTimeout(() => {
          setDmNotification((prev) => ({ ...prev, show: false }));
        }, 5000);

        // Show browser notification (always, regardless of tab focus)
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            console.log("[Dashboard] Showing browser notification for DM:", {
              senderName,
              messagePreview,
            });

            const notification = new Notification(senderName, {
              body: messagePreview,
              icon: sender?.profilePicture || undefined,
              badge: "/logo.svg",
              tag: `dm-${message.convId || message.from}`,
              requireInteraction: false,
              silent: false, // Play system sound
            });

            // Play custom notification sound
            playNotificationSound();

            // Auto-close notification after 5 seconds
            setTimeout(() => {
              notification.close();
            }, 5000);

            // Click handler to focus the window
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch (error) {
            console.error(
              "[Dashboard] Failed to show browser notification:",
              error
            );
          }
        } else {
          console.log(
            "[Dashboard] Browser notification not shown. Permission:",
            typeof window !== "undefined" && "Notification" in window
              ? Notification.permission
              : "N/A"
          );
        }
      }
    };

    const handleGroupMessage = (message: any) => {
      console.log("[Dashboard] Group message received:", message);

      // Only show notification if message is not from me. Group events
      // ("X added Y") have no sender and never notify — the server doesn't
      // push them either.
      if (message.from !== meId && message.type !== "system") {
        // Find sender info from members
        const sender = members.find((m) => (m._id || m.id) === message.from);
        const senderName = sender?.name || sender?.email || "Someone";

        // Find group info
        const group = groups.find((g) => g.id === message.groupId);
        const groupName = group?.name || "a group";

        const messagePreview = message.text
          ? message.text.length > 50
            ? message.text.substring(0, 50) + "..."
            : message.text
          : message.attachments && message.attachments.length > 0
            ? `Sent ${message.attachments.length} file${message.attachments.length > 1 ? "s" : ""
            }`
            : "New message";

        console.log("[Dashboard] Showing group notification toast:", {
          senderName,
          groupName,
          messagePreview,
        });

        // Show toast notification (disabled as requested)
        /*
        setGroupNotification({
          show: true,
          senderName,
          message: messagePreview,
          groupId: message.groupId,
          groupName,
        });
        */

        // Auto-close after 5 seconds
        setTimeout(() => {
          setGroupNotification((prev) => ({ ...prev, show: false }));
        }, 5000);

        // Show browser notification (always, regardless of tab focus)
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            const isMentioned = message.mentions?.includes(meId);
            const notificationTitle = isMentioned
              ? `${senderName} mentioned you in ${groupName}`
              : `${senderName} in ${groupName}`;

            console.log("[Dashboard] Showing browser notification for group:", {
              senderName,
              groupName,
              messagePreview,
              isMentioned,
            });

            const notification = new Notification(notificationTitle, {
              body: messagePreview,
              icon: sender?.profilePicture || undefined,
              badge: "/logo.svg",
              tag: `group-${message.groupId}`,
              requireInteraction: false,
              silent: false, // Play system sound
            });

            // Play custom notification sound
            playNotificationSound();

            // Auto-close notification after 5 seconds
            setTimeout(() => {
              notification.close();
            }, 5000);

            // Click handler to focus the window
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch (error) {
            console.error(
              "[Dashboard] Failed to show browser notification:",
              error
            );
          }
        } else {
          console.log(
            "[Dashboard] Browser notification not shown. Permission:",
            typeof window !== "undefined" && "Notification" in window
              ? Notification.permission
              : "N/A"
          );
        }
      }
    };

    const handleGlobalDMMessage = (message: any) => {
      console.log("[Dashboard] Global DM message received:", message);

      // Only show notification if message is not from me
      if (message.from !== meId) {
        // Use fromName if available, otherwise fallback
        const senderName = message.fromName || message.fromEmail || "Someone";
        const messagePreview = message.text
          ? message.text.length > 50
            ? message.text.substring(0, 50) + "..."
            : message.text
          : message.attachments && message.attachments.length > 0
            ? `Sent ${message.attachments.length} file${message.attachments.length > 1 ? "s" : ""
            }`
            : "New message";

        console.log("[Dashboard] Showing global DM notification toast:", {
          senderName,
          messagePreview,
        });

        // Show toast notification (disabled as requested)
        /*
        setGlobalDmNotification({
          show: true,
          senderName,
          message: messagePreview,
          senderId: message.from,
        });
        */

        // Auto-close after 5 seconds
        setTimeout(() => {
          setGlobalDmNotification((prev) => ({ ...prev, show: false }));
        }, 5000);

        // Show browser notification
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            console.log(
              "[Dashboard] Showing browser notification for global DM:",
              {
                senderName,
                messagePreview,
              }
            );

            const notification = new Notification(`🌐 ${senderName}`, {
              body: messagePreview,
              icon: message.fromPicture || undefined,
              badge: "/logo.svg",
              tag: `global-dm-${message.convId || message.from}`,
              requireInteraction: false,
              silent: false,
            });

            // Play custom notification sound
            playNotificationSound();

            // Auto-close notification after 5 seconds
            setTimeout(() => {
              notification.close();
            }, 5000);

            // Click handler to focus the window
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch (error) {
            console.error(
              "[Dashboard] Failed to show browser notification:",
              error
            );
          }
        }
      }
    };

    socket.on("dm:message", handleDMMessage);
    socket.on("group:message", handleGroupMessage);
    socket.on("global-dm:message", handleGlobalDMMessage);

    // Handle real-time mention notifications (post/comment mentions)
    const handleMentionNotification = (data: {
      type: string;
      priority?: string;
      title?: string;
      message?: string;
      data?: {
        postId?: string;
        commentId?: string;
        channelId?: string;
        channelName?: string;
        authorId?: string;
        authorName?: string;
        authorPicture?: string;
      };
    }) => {
      if (data.type === "post_mention" || data.type === "comment_mention") {
        playNotificationSound();

        // Show custom toast notification
        setMentionNotification({
          show: true,
          type: data.type as "post_mention" | "comment_mention",
          authorName: data.data?.authorName || "Someone",
          authorPicture: data.data?.authorPicture,
          message: data.message || "",
          postId: data.data?.postId || "",
          channelId: data.data?.channelId,
          commentId: data.data?.commentId,
        });

        // Auto-close after 6 seconds
        setTimeout(() => {
          setMentionNotification((prev) => ({ ...prev, show: false }));
        }, 6000);

        // Refresh notifications hub
        window.dispatchEvent(new CustomEvent("notifications:refresh"));
      }
    };

    socket.on("notification:new", handleMentionNotification);

    return () => {
      socket.off("dm:message", handleDMMessage);
      socket.off("group:message", handleGroupMessage);
      socket.off("global-dm:message", handleGlobalDMMessage);
      socket.off("notification:new", handleMentionNotification);
    };
  }, [meId, members, groups]);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Bat246 board detail page (/games/bat246/<24-hex boardId>) is a full-bleed
  // game board — hide the common Garage shell (left sidebar + top tab bar)
  // only for this exact route. Other bat246 routes (boards list, dashboard,
  // etc.) use plain non-hex path segments, so they never match.
  const isBat246BoardPage = /^\/games\/bat246\/[0-9a-fA-F]{24}$/.test(pathname || "");

  // Board Buttons doc page is public (shareable link, no login required) but
  // should still look like a normal in-app page for users who already have a
  // session — so the shell is only hidden here when there's no valid token.
  // hasValidSession starts false (matches the SSR/pre-hydration render, since
  // localStorage isn't readable server-side) and flips true just after mount
  // if a real session is found, same pattern the auth guard below uses.
  const BAT246_DOC_PUBLIC_PATH = "/games/bat246/documentation/board-button-details";
  const isBat246PublicDocPage = pathname === BAT246_DOC_PUBLIC_PATH;

  // Public, no-login DocuSign self-sign page (external recipient, no account) — same "public
  // page living inside this layout" pattern as the bat246 doc page above, so its own link can
  // reuse the docusign backend's existing FRONTEND_URL base (which already points under
  // /workspace) instead of needing a separate top-level route and its own base URL.
  const isPublicEsignSignPage = /^\/workspace\/sign\/[^/]+$/.test(pathname || "");

  const [hasValidSession, setHasValidSession] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasValidSession(!!getToken() && !isTokenExpired());
  }, [pathname]);
  const hideDashboardChrome = isBat246BoardPage || ((isBat246PublicDocPage || isPublicEsignSignPage) && !hasValidSession);

  // BAT 246 boards list, while still onboarding: collapse the left sidebar
  // (not the full hideDashboardChrome — that removes the sidebar entirely,
  // this just narrows it) and hide the top AppTabBar, so the Path to
  // BAT 246 Distributor card isn't competing with unrelated Garage chrome
  // for a brand-new BAT246 signup's attention. Reverts to the normal shell
  // once they're a qualified distributor (or on any other page).
  const isBat246BoardsListPage = pathname === "/games/bat246/boards";
  const [bat246Qualified, setBat246Qualified] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isBat246BoardsListPage) return;
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/bat246/distributor/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setBat246Qualified(!!d?.isQualified);
      })
      .catch(() => {
        if (!cancelled) setBat246Qualified(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isBat246BoardsListPage]);
  // Unknown/loading counts as "still onboarding" too — avoids a flash of
  // the full chrome while the qualification check is in flight.
  const bat246OnboardingActive = isBat246BoardsListPage && bat246Qualified !== true;

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [activePopover, setActivePopover] = useState<string | null>("Feeds");
  const activePopoverRef = useRef<string | null>("Feeds");
  useEffect(() => {
    activePopoverRef.current = activePopover;
  }, [activePopover]);

  // ?openApp=docusign&documentId=...&mode=sign|edit|external-edit (the "Review & Sign" /
  // notification CTA in docusign emails) — seeds DocusignPage's initial view instead of
  // always landing on its documents list.
  const [docusignDeepLink, setDocusignDeepLink] = useState<{ mode: "sign" | "edit" | "external-edit"; documentId: string } | null>(null);

  // DocusignPage only reads the deep link when it mounts, so it is dropped once the DocuSign
  // app is closed — otherwise reopening it later from the sidebar would jump straight back into
  // the same document. Keyed on the transition away from "docusign" (not just "isn't docusign"):
  // on the first render both this and the ?openApp handler run in the same commit, and a plain
  // check would clear the link in the same breath it was set.
  const prevPopoverForDeepLinkRef = useRef(activePopover);
  useEffect(() => {
    if (prevPopoverForDeepLinkRef.current === "docusign" && activePopover !== "docusign") setDocusignDeepLink(null);
    prevPopoverForDeepLinkRef.current = activePopover;
  }, [activePopover]);

  // Deep-link support: ?openApp=teamforce (used by the Teamforce onboarding
  // email) opens Teamforce directly on load. Fires once per mount.
  const openAppHandledRef = useRef(false);
  useEffect(() => {
    if (openAppHandledRef.current) return;
    if (searchParams.get("openApp") === "teamforce") {
      openAppHandledRef.current = true;
      // Pin the active org to the one this link was generated for — without
      // this, a stale/different org already in localStorage (e.g. GARAGE HQ,
      // auto-joined on signup) would silently win, and the onboarding form
      // would save the employee's profile under the wrong organization.
      const linkOrgId = searchParams.get("orgId");
      if (linkOrgId) saveOrgId(linkOrgId);
      setActivePopover("Teamforce:dashboard");
      return;
    }

    // Bare ?orgId=... (e.g. the "Go to X's office" CTA on the storefront)
    // pins the active org before any org-scoped data loads. The channels,
    // peers, and floors effects elsewhere in this layout all read
    // garage_org_id directly from localStorage synchronously on mount, so a
    // plain saveOrgId() here would still let them fire once with the stale
    // org first — reload instead, mirroring how /select-organization always
    // lands on a fresh /workspace load after switching.
    const linkOrgId = searchParams.get("orgId");
    if (linkOrgId && linkOrgId !== getOrgId()) {
      openAppHandledRef.current = true;
      saveOrgId(linkOrgId);
      const url = new URL(window.location.href);
      url.searchParams.delete("orgId");
      window.location.replace(url.toString());
      return;
    }

    const openApp = searchParams.get("openApp");

    // ?openApp=whitelabel — the "Upgrade for $600/year" CTA on the public
    // whitelabel marketing site. Lands on the same pitch card the sidebar's
    // Earn → Whitelabel entry opens. WhitelabelPage does the founder check
    // itself (useAmIFounder): founders get the upgrade button, everyone else
    // gets the read-only "Founders only" note, matching the server-side
    // `requireFounder` on the purchase endpoint.
    if (openApp === "whitelabel") {
      openAppHandledRef.current = true;
      setActivePopover("Whitelabel");
      return;
    }

    // ?openApp=garagepay — the CTA in every coupon / reward email.
    //
    // GaragePay is an in-app tab, not a route, so there is no URL that lands
    // on it directly. The coupon emails were pointing at
    // `/revenue-network/wallet?tab=rewards`, which is not a user-facing page
    // at all (only an API route and a garage-admin page live under that path),
    // so every "View in Rewards" button 404'd.
    //
    // `?tab=` is already honoured — WalletPageInternal reads it straight off
    // window.location.search — so opening the app is the only missing half.
    if (openApp === "garagepay" || openApp === "wallet") {
      openAppHandledRef.current = true;
      setActivePopover("GaragePay");
      return;
    }

    const noteId = searchParams.get("noteId");
    if ((openApp === "note" || openApp === "thoughts") && noteId) {
      openAppHandledRef.current = true;
      try {
        sessionStorage.setItem("thoughts:inline-pending-note-id", noteId);
      } catch {
        // ignore storage errors
      }
      setActiveContainer("thoughts");
      setThoughtsSection("all-notes");
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("thoughts:open-note", { detail: { noteId } })
        );
      }, 0);
      return;
    }

    // ?openApp=course&courseId=... (storefront "Continue learning" CTA) —
    // jumps straight to that course's learn view instead of the course list.
    // courses:tab-clicked (dispatched below) resets viewingCourse on every
    // popover change, so courses:open-course must fire after it settles.
    const courseId = searchParams.get("courseId");
    if (openApp === "course" && courseId) {
      openAppHandledRef.current = true;
      try {
        sessionStorage.setItem("courses:inline-pending-course-id", courseId);
      } catch {
        // ignore storage errors
      }
      setActivePopover("Courses:Enrolled");
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("courses:open-course", { detail: { courseId } })
        );
      }, 0);
      return;
    }

    // ?openApp=webinar&tab=enrolled (or ?tab=Live:Enrolled) — the "View
    // enrolled webinar" CTA on the public pre-join page. An upcoming session
    // has no room to enter yet, so the link lands on the viewer's enrolled
    // list instead of a stream that isn't running.
    const tab = searchParams.get("tab");
    if (openApp === "webinar" || (tab && tab.startsWith("Live:"))) {
      openAppHandledRef.current = true;
      setActivePopover(
        tab && tab.startsWith("Live:")
          ? tab
          : tab === "enrolled"
            ? "Live:Enrolled"
            : "Live:Discover"
      );
      return;
    }

    // ?openApp=channel&channelId=... (storefront "Go to community" CTA) —
    // reuses the existing Feeds channel-switch plumbing (same mechanism the
    // Feeds popover itself uses), just triggered from a deep link instead of
    // a click.
    const channelId = searchParams.get("channelId");
    if (openApp === "channel" && channelId) {
      openAppHandledRef.current = true;
      try {
        sessionStorage.setItem("feed:selected-channel-id", channelId);
      } catch {
        // ignore storage errors
      }
      setActivePopover("Feeds");
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("feed:switch-channel", { detail: { channelId } })
        );
      }, 0);
      return;
    }

    // ?openApp=cabinet — where a bought digital product is delivered. The
    // storefront's product deep link lands here because a product has no
    // per-item view of its own once it's owned; the files are the thing.
    if (openApp === "cabinet") {
      openAppHandledRef.current = true;
      setActivePopover("Cabinet");
      return;
    }

    // ?openApp=support — a shareable link to the Support (tickets) app, which
    // otherwise is only reachable from the sidebar.
    if (openApp === "support") {
      openAppHandledRef.current = true;
      setActivePopover("Support");
      return;
    }

    // ?openApp=docusign&documentId=...&mode=sign|edit|external-edit — the "Review & Sign"
    // link in docusign notification emails (sent/signed/completed); external-edit opens an
    // external (sent-to-an-email) document in its editor.
    {
      const docusignDocumentId = searchParams.get("documentId");
      const docusignMode = searchParams.get("mode");
      if (
        openApp === "docusign" &&
        docusignDocumentId &&
        (docusignMode === "sign" || docusignMode === "edit" || docusignMode === "external-edit")
      ) {
        openAppHandledRef.current = true;
        setDocusignDeepLink({ mode: docusignMode, documentId: docusignDocumentId });
        setActivePopover("docusign");
        return;
      }
    }

    // ?openApp=discover&itemType=…&itemId=… — a storefront deep link for
    // something the buyer doesn't have yet (anything paid, plus services and
    // calls, which are booked rather than opened).
    //
    // They've just been joined to the org, so this stays inside the workspace:
    // the item's own Discover section, with its purchase/enrol flow opened on
    // that item. The hosted /guest pages are the shopfront for non-members and
    // would put a brand-new member back outside the office they just joined.
    if (openApp === "discover") {
      openAppHandledRef.current = true;
      const itemType = searchParams.get("itemType") || "";
      const itemId = searchParams.get("itemId");
      const popover = DISCOVER_POPOVER[itemType];
      if (!popover) return;
      setActivePopover(popover);
      if (!itemId) return;
      // Services also leave a note behind before the dispatch below: the page
      // reads it on mount, so the deep link still opens the service even if
      // its listener isn't registered yet when the event fires.
      if (itemType === "service") {
        try {
          sessionStorage.setItem("services:pending-service-id", itemId);
        } catch {
          // ignore storage errors — the event below is the primary path
        }
      }
      // After the popover has mounted and its own tab-change handlers have
      // settled — same ordering the course deep link above relies on.
      setTimeout(() => {
        switch (itemType) {
          case "channel":
            window.dispatchEvent(
              new CustomEvent("community:subscribe-request", {
                detail: { channelId: itemId },
              })
            );
            break;
          case "course":
            window.dispatchEvent(
              new CustomEvent("courses:open-course", {
                // Not the learn view — they haven't bought it yet. This opens
                // the course's own sales/detail page.
                detail: { courseId: itemId, goToLearning: false },
              })
            );
            break;
          case "workshop":
            window.dispatchEvent(
              new CustomEvent("workshop:register-request", {
                detail: { workshopId: itemId },
              })
            );
            break;
          case "service":
            window.dispatchEvent(
              new CustomEvent("services:open-service", {
                detail: { serviceId: itemId },
              })
            );
            break;
          // Products and calls have no per-item open event yet, so they land on
          // their Discover list rather than on the item. Better an honest list
          // than a dispatch nothing listens for.
          default:
            break;
        }
      }, 0);
      return;
    }

    // Anything else is a plain panel name (OPEN_APP_POPOVER above). Handled
    // last so every branch with its own extra params — course, channel,
    // docusign, discover — still wins over the generic mapping.
    if (openApp) {
      const panel = OPEN_APP_POPOVER[openApp];
      if (panel) {
        openAppHandledRef.current = true;
        setActivePopover(panel);
      }
    }
  }, [searchParams]);

  // ?completeProfile=true — set by a storefront deep link whose join reported
  // the account has no profile yet (see lib/deeplink.ts). This only OPENS the
  // prompt; it deliberately does not navigate or clear the rest of the query,
  // so the deep-link effect above still runs and the target community/course
  // keeps loading behind the modal. Closing it leaves the user on that
  // content rather than bouncing them anywhere.
  const completeProfileHandledRef = useRef(false);
  useEffect(() => {
    if (completeProfileHandledRef.current) return;
    if (searchParams.get("completeProfile") !== "true") return;
    completeProfileHandledRef.current = true;
    setIsFirstTimeUser(true);
    setIsProfileOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (activePopover && ["Learn", "Courses", "Courses:Enrolled", "Courses:Analytics", "Courses:Reserves"].includes(activePopover)) {
      window.dispatchEvent(new CustomEvent("courses:tab-clicked", { detail: { value: activePopover } }));
    }
  }, [activePopover]);
  const previousPopoverRef = useRef<string | null>("Feeds");
  const popoverScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (popoverScrollRef.current) {
      popoverScrollRef.current.scrollTop = 0;
    }
  }, [activePopover]);

  const activeSpaceId = useTaskroomWorkspacetore((s) => s.activeSpaceId);
  const projectActiveItem = useTaskroomWorkspacetore((s) => s.projectActiveItem);
  const setProjectActiveItem = useTaskroomWorkspacetore((s) => s.setProjectActiveItem);
  const currentWorkspace = useTaskroomWorkspacetore((s) => s.currentWorkspace);
  const currentSpaceId = activeSpaceId || searchParams.get("spaceId");
  const workspaceRole = (
    (currentWorkspace as any)?.MemberDetail?.role || ""
  ).toLowerCase();
  const canManageWorkspaceSettings =
    workspaceRole === "admin" ||
    workspaceRole === "owner" ||
    !!(currentWorkspace as any)?.MemberDetail?.isOwner;

  // Docusign's dock tabs (below) and DocusignPage.tsx are different parts of the React
  // tree, so they share state through the docusign store instead of a prop — the same
  // reason Taskroom's dock reads projectActiveItem off useTaskroomWorkspacetore above.
  const docusignMe = useDocusignStore((s) => s.me);
  const docusignActiveTab = useDocusignStore((s) => s.activeTab);
  const setDocusignActiveTab = useDocusignStore((s) => s.setActiveTab);
  const docusignIsAdmin = isDocusignAdminUser(docusignMe);
  const docusignCanSend = canSendDocuments(docusignMe);

  useEffect(() => {
    if (activePopover && activePopover !== "Org Cabinet" && activePopover !== "Deskstream" && activePopover !== "Cabinet" && activePopover !== "Notifications" && activePopover !== "Notification") {
      previousPopoverRef.current = activePopover;
    }
  }, [activePopover]);

  useEffect(() => {
    if (activePopover === "Founder:Communities:Create") {
      setActivePopover("Founder:Communities");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("channels:open-create-modal"));
      }, 50);
    }
    // Same shape for Events: the sidebar's "Create Event" is a shortcut into
    // the module's own modal, not a separate page.
    if (activePopover === "Founder:Events:Create") {
      setActivePopover("Founder:Events");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("events:open-create-modal"));
      }, 50);
    }
  }, [activePopover]);
  const [dynamicBreadcrumbs, setDynamicBreadcrumbs] = useState<{ label: string; key?: string }[]>([]);
  const [tabTrail, setTabTrail] = useState<string[]>([]);

  const { canGoBack, canGoForward, goBack, goForward } = useNavigationHistory(
    activePopover,
    setActivePopover
  );

  // Track tab history trail for breadcrumbs
  useEffect(() => {
    if (!activePopover) {
      setTabTrail([]);
      return;
    }

    setTabTrail((prev) => {
      const index = prev.indexOf(activePopover);
      if (index !== -1) {
        // Truncate to the revisited tab
        return prev.slice(0, index + 1);
      } else {
        // Append the new tab and enforce a limit of 3 tabs in the trail
        const newTrail = [...prev, activePopover];
        if (newTrail.length > 3) {
          newTrail.shift();
        }
        return newTrail;
      }
    });
  }, [activePopover]);

  // Listen to dynamic breadcrumb updates
  useEffect(() => {
    const handleSetBreadcrumbs = (event: CustomEvent<{ items: { label: string; key?: string }[] }>) => {
      if (event?.detail && event.detail.items) {
        setDynamicBreadcrumbs(event.detail.items);
      }
    };

    window.addEventListener("workspace:set-breadcrumbs", handleSetBreadcrumbs as EventListener);
    return () => {
      window.removeEventListener("workspace:set-breadcrumbs", handleSetBreadcrumbs as EventListener);
    };
  }, []);

  // Reset dynamic breadcrumbs on activePopover change
  useEffect(() => {
    setDynamicBreadcrumbs([]);
  }, [activePopover]);

  console.log("activePopover", activePopover)
  // Helper to get organization-scoped storage keys
  const getRecentTabsKey = (set: TabSet = "main") =>
    recentTabsKey(set, typeof window === "undefined" ? null : localStorage.getItem("garage_org_id"));

  const getLastActiveSubpagesKey = () => {
    if (typeof window === "undefined") return "garage_last_active_subpages";
    const orgId = localStorage.getItem("garage_org_id");
    return orgId ? `garage_last_active_subpages_${orgId}` : "garage_last_active_subpages";
  };

  // 1. Lazy-load from sessionStorage only once on mount. Founder pages have
  // their own list, shown in place of the main one while a founder page is open.
  const [recentTabs, setRecentTabs] = useState<Record<TabSet, string[]>>(() =>
    typeof window === "undefined"
      ? { main: [], founders: [] }
      : loadRecentTabs(localStorage.getItem("garage_org_id"))
  );

  // The set showing follows the open page, the same way the sidebar switches
  // to its Founders menu. Shared pages keep whichever set is already showing.
  const [tabSet, setTabSet] = useState<TabSet>("main");
  const pageTabSet = getTabSet(activePopover, pathname);
  if (pageTabSet && pageTabSet !== tabSet) setTabSet(pageTabSet);

  // Last main-set page open, to return to when the last founder tab closes.
  const lastMainPageRef = useRef<string | null>(null);

  const [pageTabLabels, setPageTabLabels] = useState<Record<string, string>>(() =>
    typeof window === "undefined" ? {} : loadPageTabLabels(localStorage.getItem("garage_org_id"))
  );

  // The page on screen, as page tabs name it: the Office home has no popover.
  const currentPage = activePopover ?? (pathname === "/workspace" ? OFFICE_PAGE : null);

  // The tab last clicked, and the page it opened. A page tab and its
  // section's tab can both hold the page on screen, so which one is lit
  // can't be read off the page alone; this holds until the page changes.
  const [tabSelection, setTabSelection] = useState<{ tab: string; page: string | null } | null>(null);

  const activeTab = useMemo(() => {
    const tabs = recentTabs[tabSet];
    if (tabSelection && tabSelection.page === currentPage && tabs.includes(tabSelection.tab)) {
      return tabSelection.tab;
    }
    // Reached some other way: a page's own tab wins over its section's.
    if (currentPage && tabs.includes(pageTabFor(currentPage))) return pageTabFor(currentPage);
    return normalizeTab(activePopover);
  }, [recentTabs, tabSet, tabSelection, currentPage, activePopover]);

  const tabLabel = useCallback(
    (tab: string) => {
      if (!isPageTab(tab)) return getTabLabel(tab);
      const page = pageOfTab(tab);
      const section = sectionOfPage(page);
      const name = pageTabLabels[tab] || (page === OFFICE_PAGE ? "Office" : page.split(":").pop() || page);
      // A section's own page needs no section name in front of it.
      return section === page || name === getTabLabel(section) ? name : `${getTabLabel(section)} · ${name}`;
    },
    [pageTabLabels]
  );

  const [lastActiveSubpages, setLastActiveSubpages] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const key = orgId ? `garage_last_active_subpages_${orgId}` : "garage_last_active_subpages";
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Track the last active popover for each parent tab. That includes the
  // tab's own root page: founder tabs are their root page, and the
  // "Founder:Events:Create" shortcut redirects to it, so skipping the root
  // left the tab reopening the create modal. A page showing in its own page
  // tab doesn't count: that would move where its section's tab reopens.
  useEffect(() => {
    if (activePopover && activePopover !== "" && !isPageTab(activeTab)) {
      const parent = normalizeTab(activePopover);
      setLastActiveSubpages((prev) => {
        if (prev[parent] === activePopover) return prev;
        const next = { ...prev, [parent]: activePopover };
        sessionStorage.setItem(getLastActiveSubpagesKey(), JSON.stringify(next));
        return next;
      });
    }
  }, [activePopover, activeTab]);

  // 2. Track recently opened pages (max 5 per set, deduplicated) + Cache to sessionStorage
  useEffect(() => {
    if ((activePopover && activePopover !== "") || pathname === "/workspace") {
      if (getTabSet(activePopover, pathname) === "main") lastMainPageRef.current = activePopover;
      // Showing in its own page tab: no section tab to add.
      if (isPageTab(activeTab)) return;
      const parent = normalizeTab(activePopover);
      setRecentTabs((prev) => {
        // Tab already exists — don't reorder, just let the underline move to it
        if (prev[tabSet].includes(parent)) return prev;
        // New tab — add it (capped at 5), most recent first
        const newTabs = [parent, ...prev[tabSet]].slice(0, 5);
        sessionStorage.setItem(getRecentTabsKey(tabSet), JSON.stringify(newTabs));
        return { ...prev, [tabSet]: newTabs };
      });
    }
  }, [activePopover, pathname, tabSet, activeTab]);

  // The page a tab opens: a page tab its own page; a section's tab where the
  // user last was inside it, else its default.
  const pageForTab = useCallback(
    (tab: string) =>
      isPageTab(tab) ? pageOfTab(tab) : lastActiveSubpages[tab] || TAB_DEFAULT_PAGE[tab] || tab,
    [lastActiveSubpages]
  );

  // Put a page on screen by its page-tab name (OFFICE_PAGE is no popover).
  const showPage = useCallback(
    (page: string | null) => {
      if (page === OFFICE_PAGE) {
        setActivePopover(null);
        if (pathname !== "/workspace") router.push("/workspace");
      } else {
        setActivePopover(page);
      }
    },
    [pathname, router]
  );

  // 3. Stable callbacks for React.memo
  const handleTabSelect = useCallback((tab: string) => {
    const subpage = pageForTab(tab);
    setTabSelection({ tab, page: subpage });
    showPage(subpage);

    if (["Learn", "Courses", "Courses:Enrolled", "Courses:Analytics", "Courses:Reserves"].includes(subpage)) {
      window.dispatchEvent(new CustomEvent("courses:tab-clicked", { detail: { value: subpage } }));
    }

    window.dispatchEvent(
      new CustomEvent("workspace:breadcrumb-click", {
        detail: { label: subpage, key: "root", index: -1 },
      })
    );
  }, [pageForTab, showPage]);

  const handleTabClose = useCallback((tab: string) => {
    const tabs = recentTabs[tabSet];
    const closedIndex = tabs.indexOf(tab);
    if (closedIndex === -1) return;
    const newTabs = tabs.filter((t) => t !== tab);
    sessionStorage.setItem(getRecentTabsKey(tabSet), JSON.stringify(newTabs));
    setRecentTabs((prev) => ({ ...prev, [tabSet]: newTabs }));

    if (isPageTab(tab)) {
      setPageTabLabels((prev) => {
        const next = { ...prev };
        delete next[tab];
        sessionStorage.setItem(pageTabLabelsKey(localStorage.getItem("garage_org_id")), JSON.stringify(next));
        return next;
      });
    }

    // Chrome behavior: if active tab closed, go to the right tab.
    // If there is no right tab, go to the left tab.
    if (tab === activeTab) {
      if (newTabs.length === 0) {
        // Closing the last founder tab switches back to the main tabs.
        showPage(tabSet === "founders" ? lastMainPageRef.current : null);
        return;
      }
      // After filtering, the tab that was "to the right" is now at `closedIndex`
      // If we closed the last tab on the right, `closedIndex` is out of bounds, so go left.
      const nextTab = newTabs[closedIndex] ?? newTabs[closedIndex - 1] ?? newTabs[0];
      const nextPage = pageForTab(nextTab);
      setTabSelection({ tab: nextTab, page: nextPage });
      showPage(nextPage);
    }
  }, [recentTabs, tabSet, activeTab, pageForTab, showPage]);

  // Sidebar right-click menu (SidebarContextMenu). A page's tab goes in the
  // set that page belongs to, which may not be the one showing.
  const setForPage = useCallback(
    (page: string): TabSet => (page === OFFICE_PAGE ? "main" : getTabSet(page, pathname) ?? tabSet),
    [pathname, tabSet]
  );

  // "Close tab" closes the page's own tab if it has one, else its section's.
  const closableTabFor = useCallback(
    (page: string): string | null => {
      const tabs = recentTabs[tabSet];
      if (tabs.includes(pageTabFor(page))) return pageTabFor(page);
      const section = sectionOfPage(page);
      return setForPage(page) === tabSet && tabs.includes(section) ? section : null;
    },
    [recentTabs, tabSet, setForPage]
  );

  const getNavPageState = useCallback(
    (popover: string): NavPageState => {
      const closable = closableTabFor(popover);
      return {
        label: closable ? tabLabel(closable) : "",
        open: recentTabs[setForPage(popover)].includes(pageTabFor(popover)),
        closable: !!closable,
        peek:
          popover === OFFICE_PAGE || !canSidePeek(popover)
            ? "unsupported"
            : popover === activePopover
              ? "current"
              : "ok",
      };
    },
    [closableTabFor, tabLabel, recentTabs, setForPage, activePopover]
  );

  // "Open in new tab": a tab pinned to this page, added without switching to
  // it — the way a browser opens a background tab.
  const openTabInBackground = useCallback(
    (popover: string, label: string) => {
      const tab = pageTabFor(popover);
      const set = setForPage(popover);
      if (recentTabs[set].includes(tab)) return;

      setRecentTabs((prev) => {
        if (prev[set].includes(tab)) return prev;
        // Past 5, drop the oldest tabs, but never the one on screen.
        const newTabs = [tab, ...prev[set]];
        for (let i = newTabs.length - 1; newTabs.length > 5 && i > 0; i--) {
          if (newTabs[i] !== activeTab) newTabs.splice(i, 1);
        }
        sessionStorage.setItem(getRecentTabsKey(set), JSON.stringify(newTabs));
        return { ...prev, [set]: newTabs };
      });
      setPageTabLabels((prev) => {
        const next = { ...prev, [tab]: label };
        sessionStorage.setItem(pageTabLabelsKey(localStorage.getItem("garage_org_id")), JSON.stringify(next));
        return next;
      });
      // Opened for the page already on screen: the tab it's in stays lit.
      if (popover === currentPage) setTabSelection({ tab: activeTab, page: currentPage });

      // The other set's tab bar isn't showing, so nothing visibly appears.
      if (set !== tabSet) {
        toast.success(`Opened ${label} in a new tab`, {
          description:
            set === "founders"
              ? "It shows in the tab bar when you open a Founders page."
              : "It shows in the tab bar when you leave the Founders pages.",
        });
      }
    },
    [recentTabs, tabSet, setForPage, activeTab, currentPage]
  );

  const closeNavTab = useCallback(
    (popover: string) => {
      const tab = closableTabFor(popover);
      if (tab) handleTabClose(tab);
    },
    [closableTabFor, handleTabClose]
  );

  const handleDynamicBreadcrumbClick = useCallback((item: { label: string; key?: string }, index: number) => {
    window.dispatchEvent(
      new CustomEvent("workspace:breadcrumb-click", {
        detail: { label: item.label, key: item.key, index },
      })
    );
  }, []);

  const [activeContainer, setActiveContainer] = useState<string | null>(null);

  // Teamforce inline app — lifted section state (driven by BackOffice sidebar nav)
  const [teamforceSection, setTeamforceSection] = useState<string>("dashboard");
  const [dealsSection, setDealsSection] = useState<
    "dashboard" | "leads" | "funnel" | "contacts" | "companies" | "products" | "cms"
  >("dashboard");
  const [networkMailSection, setNetworkMailSection] = useState<
    "template-library" | "campaigns" | "reports" | "settings"
  >("template-library");
  const [thoughtsSection, setThoughtsSection] = useState<
    "all-notes" | "starred" | "templates" | "archive" | "trash" | "recovery"
  >("all-notes");
  // Events module: "list" on the catalogue, otherwise the open event's PLAN /
  // SELL / REACH section. The module owns the state and broadcasts it here so
  // the floating bottom bar can render the matching tab set.
  const [eventsSection, setEventsSection] = useState<string>("list");
  // The open event's contextual actions ("Add speaker", "Publish", …). The
  // events console used to render these as a strip above every page; it now
  // hands them here so they ride in this bar alongside the section tabs.
  const [eventsActions, setEventsActions] = useState<
    Array<{
      id: string;
      label: string;
      icon: string;
      disabled?: boolean;
      title?: string;
    }>
  >([]);

  // Synchronize inline apps (Teamforce, Deals, Notes, Network Mail) activePopover and activeContainer.
  useEffect(() => {
    const isTeamforcePopover =
      activePopover &&
      (activePopover === "Teamforce" || activePopover.startsWith("Teamforce:"));

    if (isTeamforcePopover) {
      if (activeContainer !== "teamforce") {
        setActiveContainer("teamforce");
      }
      if (activePopover.includes(":")) {
        const section = activePopover.split(":")[1];
        setTeamforceSection(section);
      }
    } else if (activePopover === "Deals") {
      if (activeContainer !== "deals") setActiveContainer("deals");
    } else if (activePopover === "Notes") {
      if (activeContainer !== "thoughts") setActiveContainer("thoughts");
    } else if (activePopover === "Network Mail") {
      if (activeContainer !== "network-mail") setActiveContainer("network-mail");
    } else if (
      activePopover != null &&
      (activeContainer === "teamforce" ||
        activeContainer === "deals" ||
        activeContainer === "thoughts" ||
        activeContainer === "network-mail")
    ) {
      setActiveContainer(null);
    }
  }, [activePopover]);

  useEffect(() => {
    const isTeamforcePopover =
      activePopover &&
      (activePopover === "Teamforce" || activePopover.startsWith("Teamforce:"));

    if (activeContainer === "teamforce") {
      if (!isTeamforcePopover) {
        setActivePopover(`Teamforce:${teamforceSection || "dashboard"}`);
      }
    } else if (activeContainer === "deals") {
      if (activePopover !== "Deals") setActivePopover("Deals");
    } else if (activeContainer === "thoughts") {
      if (activePopover !== "Notes") setActivePopover("Notes");
    } else if (activeContainer === "network-mail") {
      if (activePopover !== "Network Mail") setActivePopover("Network Mail");
    } else if (
      isTeamforcePopover ||
      activePopover === "Deals" ||
      activePopover === "Notes" ||
      activePopover === "Network Mail"
    ) {
      setActivePopover(null);
    }
  }, [activeContainer]);

  const [activeChatId, setActiveChatId] = useState<{
    type: "dm" | "group" | "global-dm";
    id: string;
  }>({ type: "dm", id: "" });

  const isChatOpen = activeChatId.id !== "" && !!activeChatId.id;

  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isAskCabinetOpen, setIsAskCabinetOpen] = useState(false);
  const [isBottomNavCollapsed, setIsBottomNavCollapsed] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [garagePayActiveTab, setGaragePayActiveTab] = useState<"one_time" | "recurring">("one_time");
  // Set when the GaragePay sidebar dropdown asks for a specific sub-tab, so the
  // reset-on-open effect below doesn't stomp that choice back to one_time.
  const pendingGaragePayTab = useRef<"one_time" | "recurring" | null>(null);

  useEffect(() => {
    if (activePopover === "Orders") {
      setGaragePayActiveTab(pendingGaragePayTab.current ?? "one_time");
      pendingGaragePayTab.current = null;
    }
  }, [activePopover]);

  // GaragePay sidebar dropdown: opens the panel on the requested sub-tab.
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const tab = (e as CustomEvent<"one_time" | "recurring">).detail;
      if (tab !== "one_time" && tab !== "recurring") return;
      pendingGaragePayTab.current = tab;
      setGaragePayActiveTab(tab);
      setActivePopover("Orders");
    };
    window.addEventListener("garagepay:open", handleOpen);
    return () => window.removeEventListener("garagepay:open", handleOpen);
  }, []);

  useEffect(() => {
    const handleHideTab = () => setIsFormOpen(true);
    const handleShowTab = () => setIsFormOpen(false);

    window.addEventListener("bottom-tab:hide", handleHideTab);
    window.addEventListener("bottom-tab:show", handleShowTab);
    return () => {
      window.removeEventListener("bottom-tab:hide", handleHideTab);
      window.removeEventListener("bottom-tab:show", handleShowTab);
    };
  }, []);

  useEffect(() => {
    if (isBottomNavCollapsed) {
      setShowCommunitiesMenuPopover(false);
    }
  }, [isBottomNavCollapsed]);

  // Synchronize new post composer popover and layout popovers to ensure only one is open at once
  useEffect(() => {
    const handleOpenNewPost = () => {
      setShowCommunitiesMenuPopover(false);
      setShowFeedsDropdownPopover(false);
      setShowLiveStreamsMenuPopover(false);
      setShowVideosMenuPopover(false);
      setShowCreateStreamMenuPopover(false);
    };
    window.addEventListener("feed:open-new-post", handleOpenNewPost);
    return () => {
      window.removeEventListener("feed:open-new-post", handleOpenNewPost);
    };
  }, []);

  useEffect(() => {
    if (showFeedsDropdownPopover || showCommunitiesMenuPopover || showLiveStreamsMenuPopover || showVideosMenuPopover || showCreateStreamMenuPopover) {
      window.dispatchEvent(new CustomEvent("feed:close-new-post"));
    }
  }, [showFeedsDropdownPopover, showCommunitiesMenuPopover, showLiveStreamsMenuPopover, showVideosMenuPopover, showCreateStreamMenuPopover]);

  // (Add Lead modal is handled by Deals inline app)

  // The bottom-nav ResizeObserver that used to live here was removed: its only
  // output (bottomNavHeight) was never read, and because the effect re-ran on
  // every dropdown open it forced an extra full re-render of this layout right
  // as the dropdown started animating — dropped frames that read as a flicker.


  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [affiliateProfileUserId, setAffiliateProfileUserId] = useState<string | null>(null);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Mobile "Grow Your Network" dialog state
  const [isGrowNetworkOpen, setIsGrowNetworkOpen] = useState(false);
  // Set when the dialog was opened from a specific office rather than from the
  // footer button — an office card on an affiliate profile, say — so the lobby
  // link points at THAT office instead of the one the viewer is sitting in.
  const [growNetworkOffice, setGrowNetworkOffice] = useState<{
    slug?: string | null;
    name?: string | null;
    orgId?: string | null;
  } | null>(null);
  const [isGrowNetworkFooterVisible, setIsGrowNetworkFooterVisible] = useState(true);
  const [isMobilePostComposerOpen, setIsMobilePostComposerOpen] = useState(false);
  const [mobileAffiliateId, setMobileAffiliateId] = useState<string>("");
  const [mobileBrandColor, setMobileBrandColor] = useState<string>("");

  // Mobile menu dialogs state (for options from the hidden three-dot menu)
  const [isMobileManageOrgOpen, setIsMobileManageOrgOpen] = useState(false);
  const [isMobileReferFounderOpen, setIsMobileReferFounderOpen] = useState(false);
  const [isMobileInviteEmployeesOpen, setIsMobileInviteEmployeesOpen] = useState(false);

  const { collapsed, toggle, setCollapsed } = useSidebarCollapse();
  const { amIFounder, userData: founderData, loading: founderLoading } = useAmIFounder();
  // Founder's current office plan slug — drives BackOffice tab locking.
  // Non-founders return null (no plan), so the check falls through to
  // rendering MarketplacePage normally (they're consumers, not gated by
  // their own founder's plan choice at this tab).
  const { planSlug } = useCanUpgrade();

  // Redirect founder to Founder:Communities by default instead of Feeds on login/org change
  const lastRedirectedTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (founderLoading) return;
    const token = getToken();
    if (!token) return;

    // Don't stomp full-bleed routes (e.g. a board page reached via hard
    // refresh) — those clear activePopover themselves via pathname below,
    // and this effect can otherwise race ahead of that and reopen Communities.
    const isFullBleedRoute =
      pathname?.includes("/cabinet/editor/") ||
      pathname?.includes("/meet/") ||
      pathname?.includes("/games/") ||
      pathname?.includes("/coverfi") ||
      pathname?.includes("/thoughts") ||
      // Public DocuSign self-sign page — a founder landing here (e.g. testing their own
      // sent document) must see the sign form, not get bounced into Founder:Communities.
      pathname?.includes("/workspace/sign/");

    if (lastRedirectedTokenRef.current !== token) {
      lastRedirectedTokenRef.current = token;
      if (amIFounder && activePopover === "Feeds" && !isFullBleedRoute) {
        setActivePopover("Founder:Communities");
      }
    }
  }, [amIFounder, founderLoading, activePopover, pathname]);

  // Whether the current user still needs to complete Teamforce's first-time
  // onboarding form — used to hide the Teamforce dock (Dashboard/Employees/
  // Departments/etc.) since they should only see the onboarding form itself.
  const [tfNeedsOnboarding, setTfNeedsOnboarding] = useState(false);
  // Founder or Teamforce admin — gates Add Employee / Bulk Assign dock actions.
  const [tfHasWriteAccess, setTfHasWriteAccess] = useState(false);
  useEffect(() => {
    if (founderLoading) return;
    if (amIFounder) {
      setTfNeedsOnboarding(false);
      setTfHasWriteAccess(true);
      return;
    }
    const uid = getUserIdFromToken();
    if (!uid) return;
    getEmployee(uid)
      .then((d) => {
        const isAdmin = d.teamforceRole === "admin";
        setTfHasWriteAccess(isAdmin);
        setTfNeedsOnboarding(!isAdmin && !d.hasProfile);
      })
      .catch(() => { });
  }, [amIFounder, founderLoading]);

  // TeamforceApp fires this the moment a first-time user saves the
  // onboarding form, so the dock updates immediately instead of waiting for
  // a full page refresh to re-run the getEmployee() check above.
  useEffect(() => {
    const handler = () => setTfNeedsOnboarding(false);
    window.addEventListener("teamforce:onboarding-complete", handler);
    return () => window.removeEventListener("teamforce:onboarding-complete", handler);
  }, []);

  // "Take to Taskroom" in a service engagement: the store has already selected
  // the room, so the shell only has to switch containers. Taskroom is
  // popover-driven rather than routed, which is why this needs an event.
  useEffect(() => {
    const handler = () => {
      setActivePopover("Taskroom");
      setProjectActiveItem("DashMangement");
    };
    window.addEventListener("service:open-taskroom", handler);
    return () => window.removeEventListener("service:open-taskroom", handler);
  }, [setProjectActiveItem]);

  // Inline Teamforce sections (e.g. Invite / Bulk Assign / Update Info) can
  // ask the shell to switch the active Teamforce:* popover section.
  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent<{ section?: string }>).detail?.section;
      if (!section) return;
      setActivePopover(`Teamforce:${section}`);
    };
    window.addEventListener("teamforce:navigate", handler);
    return () => window.removeEventListener("teamforce:navigate", handler);
  }, []);

  // Teamforce's Employees > Bulk Assign screen temporarily wants every
  // section visible in the dock (including ones normally hidden behind a
  // feature flag) so admins can jump around while editing. EmployeesSection
  // dispatches this event on enter/exit and always resets it on unmount.
  const [tfBulkEditMode, setTfBulkEditMode] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      setTfBulkEditMode(!!detail?.active);
    };
    window.addEventListener("teamforce:bulk-edit-mode", handler);
    return () => window.removeEventListener("teamforce:bulk-edit-mode", handler);
  }, []);

  // True while Teamforce shows an employee-details page (clicked a name).
  // Admins/founders only see "Update Profile" in the dock during this view.
  const [tfEmployeeDetail, setTfEmployeeDetail] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      setTfEmployeeDetail(!!detail?.active);
    };
    window.addEventListener("teamforce:employee-detail", handler);
    return () => window.removeEventListener("teamforce:employee-detail", handler);
  }, []);

  // True while Teamforce Attendance shows the Self Attendance tab — the dock
  // then swaps its action items for Clock In / Clock Out / Breaks / Apply
  // Leave. AttendanceSection dispatches this and resets it on unmount.
  const [tfSelfAttendance, setTfSelfAttendance] = useState<{
    active: boolean;
    clockedIn: boolean;
  }>({ active: false, clockedIn: false });
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean; clockedIn?: boolean }>)
        .detail;
      setTfSelfAttendance({
        active: !!detail?.active,
        clockedIn: !!detail?.clockedIn,
      });
    };
    window.addEventListener("teamforce:self-attendance", handler);
    return () => window.removeEventListener("teamforce:self-attendance", handler);
  }, []);
  useEffect(() => {
    const v = localStorage.getItem("dashboard.sidebar.collapsed");
    if (v === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("dashboard.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
  // Auto-collapse on the BAT 246 boards page while still onboarding — see
  // bat246OnboardingActive above. Only forces closed, never forces open —
  // if they'd previously pinned it open there'd be nothing to fight here
  // anyway since this only fires true while genuinely still onboarding.
  useEffect(() => {
    if (bat246OnboardingActive) setCollapsed(true);
  }, [bat246OnboardingActive, setCollapsed]);
  // The BAT 246 hub is the post-login landing page, and its sidebar must be
  // visible there — the collapse above is persisted, so without this a visit
  // to the boards list leaves it hidden here too. Re-opens on arrival only
  // (the user can still collapse it), and not below the auto-collapse
  // breakpoint in the resize effect further down.
  useEffect(() => {
    if (pathname === BAT246_HOME_PATH && window.innerWidth >= 1024) {
      setCollapsed(false);
    }
  }, [pathname, setCollapsed]);

  // Right panel collapse state (persisted) — default to collapsed (closed)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<boolean>(() => true);
  const [infoTint, setInfoTint] = useState(false);
  useEffect(() => {
    const v = localStorage.getItem("dashboard.rightpanel.collapsed");
    if (v === "0") setRightPanelCollapsed(false);
  }, []);
  useEffect(() => {
    localStorage.setItem("dashboard.rightpanel.collapsed", rightPanelCollapsed ? "1" : "0");
  }, [rightPanelCollapsed]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).rightPanelCollapsed = rightPanelCollapsed;
    }
  }, [rightPanelCollapsed]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).members = members;
    }
  }, [members]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).groups = groups;
    }
  }, [groups]);

  // Automatically close the right panel when a chat is opened or switched
  useEffect(() => {
    if (isChatOpen) {
      setRightPanelCollapsed(true);
    }
  }, [activeChatId.id, isChatOpen]);

  // Auto-collapse sidebars at small screen widths to prevent squeezing layout
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1200) {
        setRightPanelCollapsed(true);
      }
      if (width < 1024) {
        setCollapsed(true);
      }
    };

    // Check on mount
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setCollapsed, setRightPanelCollapsed]);
  console.log("popover", activeContainer)
  // Determine which page group we're currently on
  const getPageGroup = (popover: string | null): string => {
    console.log("Determining page group for popover:", popover, "and activeContainer:", activeContainer);
    if (activeContainer === "teamforce") return "teamforce";
    if (popover === "Taskroom") return "Taskroom";
    if (popover === "Cabinet") return "cabinet";
    if (popover === "docusign") return "docusign";
    if (popover === "Orders") return "garagepay";
    if (activeContainer === "deals") return "deals";
    if (activeContainer === "thoughts") return "thoughts";
    if (activeContainer === "network-mail") return "network-mail";
    // /coverfi is a dedicated route — activePopover is always null there, so
    // this has to be checked before the `!popover` fallthrough below,
    // otherwise the dock falls back to the Communities group.
    if (pathname?.startsWith("/coverfi")) return "office-settings";
    if (!popover || popover === "OfficeStream") return "communities";
    if (popover === "Feeds") return "communities";
    if (popover === "Communities" || popover === "Community" || popover === "ReservedCommunities" || popover === "Communities:Discover" || popover === "Communities:My" || popover === "Conference" || popover === "Conference:Notes") return "communities";
    if (popover === "Org Cabinet") return "communities";
    if (popover === "Live:Recording" || popover === "Live:Recorded") return "content";
    if (popover === "Live" || popover === "Live Streams" || popover.startsWith("Live:")) return "live";
    if (popover === "Content" || popover === "Long Form Videos" || popover.startsWith("Content:")) return "content";
    if (popover === "Courses" || popover === "Learn" || popover.startsWith("Courses:")) return "courses";
    if (popover === "Products" || popover === "Digital Products" || popover.startsWith("Products:")) return "products";
    if (popover === "Services" || popover.startsWith("Services:")) return "services";
    if (popover === "Drops" || popover.startsWith("Drops:")) return "content";
    if (popover === "1:1 Calls" || popover.startsWith("1:1 Calls:")) return "1:1 Calls";
    if (
      (popover && (popover === "Office Settings" || popover.startsWith("Office Settings:"))) ||
      (pathname?.startsWith("/coverfi"))
    ) return "office-settings";
    // Founder-specific page groups
    if (popover && (popover.startsWith("Founder:Content") || popover === "Founder:Live:Recordings" || popover === "Founder:Articles" || popover === "Founder:Analytics")) return "founder-content";
    if (popover && popover.startsWith("Founder:Communities")) return "founder-communities";
    if (popover && popover.startsWith("Founder:Live")) return "founder-live";
    if (popover && popover.startsWith("Founder:Courses")) return "founder-courses";
    if (popover && popover.startsWith("Founder:Calls")) return "founder-calls";
    if (popover && popover.startsWith("Founder:Events")) return "founder-events";
    if (popover === "Events" || popover.startsWith("Events:")) return "events-browse";
    if (popover && popover.startsWith("Founder:Products")) return "founder-products";
    if (popover && popover.startsWith("Founder:Services")) return "founder-services";

    return "default";
  };


  const pageGroup = getPageGroup(activePopover);

  useEffect(() => {
    if (
      pageGroup === "Taskroom" &&
      projectActiveItem === "WorkspaceSettings" &&
      !canManageWorkspaceSettings
    ) {
      setProjectActiveItem("WorkspacePeople");
    }
  }, [
    pageGroup,
    projectActiveItem,
    canManageWorkspaceSettings,
    setProjectActiveItem,
  ]);

  const bottomNavTabs = useMemo(() => {


    switch (pageGroup) {


      case "Taskroom": {
        const tabs = [];
        if (currentSpaceId) {
          if (projectActiveItem === "WorkspacePeople") {
            tabs.push({ id: "InvitePeople", label: "Invite People", icon: UserPlus, value: "Taskroom:InvitePeople" });
          } else {
            tabs.push({ id: "AddTask", label: "Add Task", icon: PlusCircle, value: "Taskroom:AddTask" });
          }
          tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        }
        tabs.push(
          { id: "Dashboard", label: "Dashboard", icon: LayoutGrid, value: "Dashboard" },
          { id: "People", label: "People", icon: Users, value: "People" },
        );
        if (canManageWorkspaceSettings) {
          tabs.push({ id: "Setting", label: "Setting", icon: Settings, value: "Setting" });
        }
        tabs.push(
          { id: "TimeSheets", label: "TimeSheets", icon: ClipboardClock, value: "TimeSheets" },
          { id: "AssignedToMe", label: "Assigned", icon: UserCheck, value: "AssignedToMe" },
          { id: "AllTasks", label: "All", icon: ClipboardList, value: "AllTasks" }
          // { id: "ImportExport", label: "Import/Export", icon: FolderOpen, value: "ImportExport" },
        );
        return tabs;
      }
      case "cabinet":
        return [
          { id: "FileUpload", label: "File Upload", icon: Upload, value: "Cabinet:Upload" },
          { id: "CreateFolder", label: "Create Folder", icon: FolderPlus, value: "Cabinet:CreateFolder" },
        ];
      case "communities": {
        const tabs = [];
        if (activePopover === "Feeds") {
          tabs.push({ id: "NewPost", label: "New Post", icon: PlusCircle, value: "Feeds:NewPost" });
          tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        }
        tabs.push(
          { id: "Feeds", label: "Feeds", icon: SquarePen, value: "Feeds" },
          { id: "Office", label: "Office", icon: LogOut, value: "OfficeStream" },
          { id: "OrgCabinet", label: "Cabinet", icon: Cloud, value: "Org Cabinet" },
          { id: "Conference", label: "Conference", icon: Contact, value: "Conference" },
          {
            id: "CommunitiesMenu",
            label:
              activePopover === "Communities:Discover" || activePopover === "Communities" || activePopover === "Community"
                ? "Discover"
                : activePopover === "Communities:My"
                  ? "My Communities"
                  : activePopover === "ReservedCommunities"
                    ? "My Reserves"
                    : "Communities",
            icon: Users,
            value: "CommunitiesMenu",
          },
        );
        return tabs;
      }
      case "live":
      case "content":
        return [
          { id: "LiveStreamsMenu", label: "Live Stream", icon: Tv, value: "LiveStreamsMenu" },
          { id: "VideosMenu", label: "Videos", icon: Video, value: "VideosMenu" },
          { id: "Articles", label: "Articles", icon: FileText, value: "Content:Articles" },
          { id: "Analytics", label: "Analytics", icon: BarChart3, value: "Content:Analytics" },
        ];
      case "courses":
        return [
          { id: "Discover", label: "Discover", icon: BookOpen, value: "Learn" },
          { id: "Enrolled", label: "Enrolled", icon: CheckCircle, value: "Courses:Enrolled" },
          { id: "Analytics", label: "Analytics", icon: BarChart3, value: "Courses:Analytics" },
          { id: "Reserves", label: "Reserves", icon: Gift, value: "Courses:Reserves" },
        ];
      case "products":
        return [
          { id: "Browse", label: amIFounder ? "All Products" : "Discover", icon: amIFounder ? ShoppingBag : Compass, value: "Products:Browse" },
          { id: "Orders", label: amIFounder ? "Orders" : "Orders", icon: amIFounder ? ClipboardList : ShoppingBag, value: "Products:Orders" },
          { id: "Reserves", label: amIFounder ? "Reserves" : "My Reserves", icon: Gift, value: "Products:Reserves" },
        ];
      case "services":
        return [
          { id: "Browse", label: amIFounder ? "All Services" : "Browse", icon: Briefcase, value: "Services:Browse" },
          { id: "Optins", label: amIFounder ? "Opt-ins" : "My Services", icon: ClipboardList, value: "Services:Optins" },
        ];
      case "drops":
        return [
          { id: "Feed", label: "Feed", icon: Zap, value: "Drops:Feed" },
          { id: "Uploads", label: "My Uploads", icon: Video, value: "Drops:Uploads" },
          { id: "Content", label: "Content", icon: Video, value: "Content:Videos" },
        ];
      case "1:1 Calls":
        return [
          { id: "Browse", label: amIFounder ? "All Calls" : "Browse", icon: Phone, value: "1:1 Calls:calls" },
          { id: "Purchases", label: amIFounder ? "Purchases" : "My Calls", icon: amIFounder ? Users : CreditCard, value: amIFounder ? "1:1 Calls:purchases" : "1:1 Calls:mycalls" },
          { id: "Bookings", label: amIFounder ? "Bookings" : "Scheduled", icon: amIFounder ? Calendar : CalendarClock, value: "1:1 Calls:bookings" },
          { id: "Reserves", label: "Reserves", icon: TicketCheck, value: "1:1 Calls:reserves" },
        ];
      case "teamforce": {
        // First-time onboarding: no dock at all — only the onboarding form.
        if (tfNeedsOnboarding) return [];
        const tabs = [];
        // Self Attendance tab: dock actions become the attendance quick
        // actions (Clock In / Clock Out / Breaks / Apply Leave) instead of
        // the usual Add Employee / Bulk Assign / Update Profile.
        if (tfSelfAttendance.active) {
          tabs.push(
            tfSelfAttendance.clockedIn
              ? { id: "TFClockOut", label: "Clock Out", icon: LogOut, value: "tf-attendance:clock-out" }
              : { id: "TFClockIn", label: "Clock In", icon: LogIn, value: "tf-attendance:clock-in" },
            { id: "TFBreak", label: "Breaks Off", icon: Coffee, value: "tf-attendance:break" },
            { id: "TFApplyLeave", label: "Apply Leave", icon: Plus, value: "tf-attendance:apply-leave" },
          );
        } else {
          // Recruitment section: Create Request action first (before Add Employee)
          if (activePopover === "Teamforce:recruitment" && tfHasWriteAccess) {
            tabs.push({ id: "TFCreateRequest", label: "Create Request", icon: PlusCircle, value: "tf-recruitment:create" });
          }
          // Departments section: Add Department action first (before Add Employee)
          if (activePopover === "Teamforce:departments" && tfHasWriteAccess) {
            tabs.push({ id: "TFAddDepartment", label: "Add Department", icon: PlusCircle, value: "tf-department:create" });
          }
          // Branches section: Add Branch action first (before Add Employee)
          if (activePopover === "Teamforce:branches" && tfHasWriteAccess) {
            tabs.push({ id: "TFAddBranch", label: "Add Branch", icon: PlusCircle, value: "tf-branch:create" });
          }
          // Action items (like Taskroom "Add Task") — Add Employee / Bulk Assign
          // only for founders & Teamforce admins; Update Profile for everyone.
          if (tfHasWriteAccess) {
            tabs.push({ id: "TFAddEmployee", label: "Add Employee", icon: UserPlus, value: "invite-employee" });
            tabs.push({ id: "TFBulkAssign", label: "Bulk Assign", icon: Layers, value: "bulk-assign" });
          }
          // Employees/managers always get Update Profile; admins & founders
          // only while viewing an employee's details page.
          if (!tfHasWriteAccess || tfEmployeeDetail) {
            tabs.push({ id: "TFUpdateInfo", label: "Update Profile", icon: Pencil, value: "update-info" });
          }
        }
        tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        tabs.push(
          { id: "TFDashboard", label: "Dashboard", icon: LayoutDashboard, value: "dashboard" },
          { id: "TFEmployees", label: "Employees", icon: Users, value: "employees" },
          { id: "TFDepartments", label: "Departments", icon: Building, value: "departments" },
          { id: "TFBranches", label: "Branches", icon: Building2, value: "branches" },
          { id: "TFAttendance", label: "Attendance", icon: Calendar, value: "attendance" },
        );
        // Recruitment is admin/founder-only.
        if (tfHasWriteAccess) {
          tabs.push({ id: "TFRecruitment", label: "Recruitment", icon: UserPlus, value: "recruitment" });
        }
        tabs.push({ id: "TFSettings", label: "Settings", icon: Settings, value: "settings" });
        return tabs;
      }
      case "deals": {
        const addLabel =
          dealsSection === "funnel"
            ? "Add Funnel"
            : dealsSection === "contacts"
              ? "Add Contact"
              : dealsSection === "companies"
                ? "Add Company"
                : dealsSection === "products"
                  ? "Add Product"
                  : dealsSection === "cms"
                    ? "New Page"
                    : "Add Lead";
        return [
          { id: "AddLead", label: addLabel, icon: PlusCircle, value: "add-lead" },
          { id: "Divider", label: "", icon: X, value: "Divider", isDivider: true },
          { id: "Dashboard", label: "Dashboard", icon: Gauge, value: "dashboard" },
          { id: "Leads", label: "Leads", icon: Users, value: "leads" },
          { id: "Funnels", label: "Funnels", icon: Filter, value: "funnel" },
          { id: "Contact", label: "Contact", icon: Contact, value: "contacts" },
          { id: "Companies", label: "Companies", icon: Building2, value: "companies" },
          { id: "Products", label: "Product", icon: Package, value: "products" },
          { id: "CMS", label: "CMS", icon: LayoutTemplate, value: "cms" },
        ];
      }
      case "thoughts":
        return [
          { id: "Add Page", label: "Add Page", icon: FileText, value: "add-page" },
          { id: "Import", label: "Import", icon: FolderOpen, value: "import" },
        ];
      case "network-mail":
        return [
          { id: "NewCampaign", label: "New Campaign", icon: PlusCircle, value: "NetworkMail:NewCampaign" },
          { id: "Divider", label: "", icon: X, value: "Divider", isDivider: true },
          { id: "Template Library", label: "Template Library", icon: LayoutDashboard, value: "template-library" },
          { id: "Campaigns", label: "Campaigns", icon: Send, value: "campaigns" },
          // { id: "Reports", label: "Reports", icon: BarChart3, value: "reports" },
          // { id: "Settings", label: "Settings", icon: Settings, value: "settings" },
        ];
      case "office-settings":
        return [
          { id: "Coupons", label: "Coupons", icon: Tag, value: "Office Settings:coupons" },
          { id: "Invitees", label: "Invitees", icon: UserPlus, value: "Office Settings:invitees" },
          // Kept in step with the sidebar's Office Settings section. The two
          // navigation surfaces had drifted: Domains, Branding and the email
          // setup page were reachable from one and invisible from the other.
          { id: "Domains", label: "Domains", icon: Globe, value: "Office Settings:domain" },
          { id: "Branding", label: "Branding", icon: Palette, value: "Office Settings:branding" },
          { id: "EmailSetup", label: "Email Setup", icon: Mail, value: "NetworkMail" },
          { id: "Coverfi", label: "Coverfi", icon: Umbrella, value: "coverfi" },
          { id: "TeamAccess", label: "Team & Access", icon: UserRoundCog, value: "Office Settings:team-access" },
        ];
      // ========== Founder-specific page groups ==========
      case "founder-communities": {
        const tabs = [];
        if (activePopover === "Founder:Communities") {
          tabs.push({ id: "CreateCommunity", label: "Create Community", icon: PlusCircle, value: "Founder:Communities:Create" });
          tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        } else if (activePopover === "Founder:Communities:Cabinet") {
          // The founder cabinet has no in-page Upload / New Folder buttons —
          // both write actions live here.
          tabs.push({ id: "UploadFile", label: "Upload File", icon: PlusCircle, value: "Founder:Communities:Upload" });
          tabs.push({ id: "NewFolder", label: "New Folder", icon: FolderPlus, value: "Founder:Communities:NewFolder" });
          tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        }

        tabs.push(
          { id: "Communities", label: "Communities", icon: Users, value: "Founder:Communities" },
          { id: "Members", label: "Members", icon: LayoutGrid, value: "Founder:Communities:Members" },
          { id: "Cabinet", label: "Cabinet", icon: Folder, value: "Founder:Communities:Cabinet" },
          { id: "Orders", label: "Orders", icon: ShoppingBag, value: "Founder:Communities:Orders" },
          { id: "UnsubLog", label: "Unsub Log", icon: History, value: "Founder:Communities:UnsubLog" }
        );
        return tabs;
      }

      case "founder-events": {
        // The catalogue only needs create + back.
        if (eventsSection === "list") {
          return [
            { id: "CreateEvent", label: "Create Event", icon: PlusCircle, value: "evt:create" },
            { id: "Divider", label: "", icon: X, value: "Divider", isDivider: true },
            { id: "Events", label: "Events", icon: CalendarDays, value: "evt:list" },
          ];
        }

        // Inside an event the bar mirrors the sidebar: it shows the pages of
        // whichever pillar the current section belongs to. The pillar itself is
        // chosen in the sidebar, so the bar never has to be a menu of menus.
        const pillar = EVENT_SECTION_PILLAR[eventsSection] || "plan";
        const pillarPages: Record<string, Array<{ id: string; label: string; icon: any; value: string }>> = {
          plan: [
            { id: "evt:overview", label: "Overview", icon: Gauge, value: "evt:overview" },
            { id: "evt:agenda", label: "Agenda", icon: CalendarClock, value: "evt:agenda" },
            { id: "evt:speakers", label: "Speakers", icon: Users, value: "evt:speakers" },
            { id: "evt:sponsors", label: "Sponsors", icon: Building2, value: "evt:sponsors" },
          ],
          sell: [
            { id: "evt:tickets", label: "Tickets", icon: TicketCheck, value: "evt:tickets" },
            { id: "evt:registrations", label: "Registrations", icon: ClipboardList, value: "evt:registrations" },
            { id: "evt:coupons", label: "Promotions", icon: Tag, value: "evt:coupons" },
          ],
          reach: [
            { id: "evt:website", label: "Event Website", icon: LayoutTemplate, value: "evt:website" },
            { id: "evt:campaigns", label: "Email Campaigns", icon: Mail, value: "evt:campaigns" },
          ],
        };

        // The console's own actions lead the bar. Publish is always last in
        // the list it sends, so its position never shifts between sections.
        const EVENT_ACTION_ICONS: Record<string, any> = {
          plus: PlusCircle,
          download: Download,
          external: ExternalLink,
          layers: Layers,
          publish: Eye,
          unpublish: EyeOff,
        };
        const actionTabs = eventsActions.map((a) => ({
          id: `evt:action:${a.id}`,
          label: a.label,
          icon: EVENT_ACTION_ICONS[a.icon] || PlusCircle,
          value: `evt:action:${a.id}`,
          disabled: a.disabled,
          title: a.title,
        }));

        // Navigation first, then this section's action, then the pages —
        // same reading order as the catalogue bar, where "Events" also leads.
        return [
          { id: "EvtBack", label: "Events", icon: ArrowLeft, value: "evt:list" },
          ...(actionTabs.length
            ? [
              { id: "EvtActionDivider", label: "", icon: X, value: "Divider", isDivider: true },
              ...actionTabs,
            ]
            : []),
          { id: "Divider", label: "", icon: X, value: "Divider", isDivider: true },
          ...pillarPages[pillar],
        ];
      }

      case "events-browse":
        return [
          { id: "Discover", label: "Discover", icon: Compass, value: "Events" },
          { id: "Purchases", label: "Purchases", icon: CreditCard, value: "Events:Purchases" },
        ];

      case "founder-content":
        return [
          { id: "LiveStreamsMenu", label: "Live Stream", icon: Tv, value: "LiveStreamsMenu" },
          { id: "VideosMenu", label: "Videos", icon: Video, value: "VideosMenu" },
          { id: "Articles", label: "Articles", icon: FileText, value: "Founder:Content:Articles" },
          { id: "Analytics", label: "Analytics", icon: BarChart3, value: "Founder:Content:Analytics" },
          { id: "Rewards", label: "Content Rewards", icon: Gift, value: "Founder:Content:Rewards" },
        ];

      case "founder-live": {
        const tabs = [];
        if (activePopover === "Founder:Live") {
          tabs.push({ id: "CreateWebinar", label: "Create Live Stream", icon: PlusCircle, value: "Founder:Live:Create" });
          tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        }
        tabs.push(
          { id: "LiveStreams", label: "Live Streams", icon: Video, value: "Founder:Live" },
          { id: "Attendees", label: "Attendees", icon: Users, value: "Founder:Live:Attendees" },
          { id: "Orders", label: "Orders", icon: ClipboardList, value: "Founder:Live:Orders" },
          // No Trash tab: deleted live streams stay in the main table with a
          // "Deleted" status badge instead of moving to a page of their own.
          { id: "UnsubLog", label: "Unsub Log", icon: History, value: "Founder:Live:UnsubLog" }
        );
        return tabs;
      }

      case "founder-courses": {
        const tabs = [];
        if (activePopover === "Founder:Courses") {
          tabs.push({ id: "CreateCourse", label: "Create Course", icon: PlusCircle, value: "Founder:Courses:Create" });
          tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        }
        tabs.push(
          { id: "Courses", label: "My Courses", icon: BookOpen, value: "Founder:Courses" },
          { id: "Students", label: "Students", icon: Users, value: "Founder:Courses:Students" },
          { id: "Orders", label: "Orders", icon: ClipboardList, value: "Founder:Courses:Orders" },
          { id: "UnsubLog", label: "Unsub Log", icon: History, value: "Founder:Courses:UnsubLog" }
        );
        return tabs;
      }
      case "founder-calls":
        return [
          { id: "Calls", label: "Calls", icon: Phone, value: "Founder:Calls" },
          { id: "Purchases", label: "Purchases", icon: CreditCard, value: "Founder:Calls:Purchases" },
          { id: "Bookings", label: "Bookings", icon: Calendar, value: "Founder:Calls:Bookings" },
          { id: "Customers", label: "Customers", icon: Users, value: "Founder:Calls:Customers" },
          { id: "Orders", label: "Orders", icon: ClipboardList, value: "Founder:Calls:Orders" },
        ];
      case "founder-products": {
        const tabs = [];
        if (activePopover === "Founder:Products") {
          tabs.push({ id: "AddProduct", label: "Add Product", icon: PlusCircle, value: "Founder:Products:Add" });
          tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        }
        tabs.push(
          { id: "Products", label: "Products", icon: ShoppingBag, value: "Founder:Products" },
          { id: "Orders", label: "Orders", icon: ClipboardList, value: "Founder:Products:Orders" },
          { id: "Customers", label: "Customers", icon: Users, value: "Founder:Products:Customers" }
          // Digital Products Unsub Log — commented out per founder request.
          // Re-enable when refund reporting is ready to surface.
          // ,{ id: "UnsubLog", label: "Unsub Log", icon: History, value: "Founder:Products:UnsubLog" }
        );
        return tabs;
      }
      case "founder-services": {
        const tabs = [];
        if (activePopover === "Founder:Services") {
          tabs.push({ id: "CreateService", label: "Create Service", icon: PlusCircle, value: "Founder:Services:Create" });
          tabs.push({ id: "Divider", label: "", icon: X, value: "Divider", isDivider: true });
        }
        tabs.push(
          { id: "Services", label: "Services", icon: Briefcase, value: "Founder:Services" },
          { id: "Optins", label: "Opt-Ins", icon: ClipboardList, value: "Founder:Services:Optins" },
          { id: "Customers", label: "Customers", icon: Users, value: "Founder:Services:Customers" },
          { id: "Orders", label: "Orders", icon: ClipboardList, value: "Founder:Services:Orders" },
        );
        return tabs;
      }
      case "garagepay":
        return [
          { id: "one_time", label: "One-time", icon: CreditCard, value: "garagepay:one_time" },
          { id: "recurring", label: "Recurring", icon: RefreshCw, value: "garagepay:recurring" },
        ];
      case "docusign": {
        const tabs = [];
        // Senders get everything for sending their own documents; Dashboard and Admin are
        // founder/admin only (lib/docusign/access.ts).
        if (docusignCanSend) {
          tabs.push(
            { id: "DocusignAdd", label: "Internal document", icon: Plus, value: "docusign:add-document" },
            { id: "DocusignSendEmail", label: "External document", icon: Send, value: "docusign:send-email" },
            { id: "DocusignDivider", label: "", icon: X, value: "Divider", isDivider: true },
          );
          if (docusignIsAdmin) tabs.push({ id: "DocusignDashboard", label: "Dashboard", icon: LayoutGrid, value: "Dashboard" });
          tabs.push(
            { id: "DocusignAgreements", label: "Internal Agreements", icon: Inbox, value: "Agreements" },
            { id: "DocusignExternal", label: "External Agreements", icon: Mail, value: "External" },
            { id: "DocusignTemplates", label: "Templates", icon: LayoutTemplate, value: "Templates" },
          );
          if (docusignIsAdmin) tabs.push({ id: "DocusignAdmin", label: "Admin", icon: Settings, value: "Admin" });
        } else {
          tabs.push({ id: "DocusignAssigned", label: "Assigned to Me", icon: UserCheck, value: "Assigned" });
        }
        return tabs;
      }
      default:
        return [
          { id: "Office", label: "Office", icon: LogOut, value: "OfficeStream" },
          { id: "Feeds", label: "Feeds", icon: SquarePen, value: "Feeds" },
          { id: "Communities", label: "Communities", icon: Bookmark, value: "Communities" },
          { id: "Drops", label: "Drops", icon: Zap, value: "Drops:Feed" },
        ];
    }
  }, [pageGroup, amIFounder, activePopover, currentSpaceId, projectActiveItem, canManageWorkspaceSettings, tfNeedsOnboarding, tfBulkEditMode, tfHasWriteAccess, tfEmployeeDetail, tfSelfAttendance, dealsSection, eventsSection, eventsActions, docusignIsAdmin, docusignCanSend, docusignActiveTab]);

  const handleBottomTabClick = (value: string) => {
    console.log("Bottom tab clicked:", activeContainer);
    // Re-clicking a services nav item always lands on the card list, never on a
    // detail view left open from a previous visit.
    if (value === "Services" || value === "Services:Browse" || value === "Founder:Services") {
      window.dispatchEvent(new CustomEvent("services:show-list"));
    }
    // Same for Events: Discover from inside an open event goes back to the list.
    if (value === "Events") {
      window.dispatchEvent(new CustomEvent("events:show-discover"));
    }
    if (["Learn", "Courses", "Courses:Enrolled", "Courses:Analytics", "Courses:Reserves"].includes(value)) {
      window.dispatchEvent(new CustomEvent("courses:tab-clicked", { detail: { value } }));
    }
    if (value === "garagepay:one_time") {
      setGaragePayActiveTab("one_time");
      window.dispatchEvent(new CustomEvent("garagepay:set-tab", { detail: "one_time" }));
      return;
    }
    if (value === "garagepay:recurring") {
      setGaragePayActiveTab("recurring");
      window.dispatchEvent(new CustomEvent("garagepay:set-tab", { detail: "recurring" }));
      return;
    }
    if (value === "Founder:Courses:Create") {
      window.dispatchEvent(new CustomEvent("courses:open-create-modal"));
      return;
    }
    if (value === "Founder:Products:Add") {
      window.dispatchEvent(new CustomEvent("products:open-create-modal"));
      return;
    }
    if (value === "Founder:Services:Create") {
      window.dispatchEvent(new CustomEvent("services:open-create-modal"));
      return;
    }
    if (value === "Founder:Communities:Create") {
      window.dispatchEvent(new CustomEvent("channels:open-create-modal"));
      return;
    }
    // Every events tab is an in-module navigation, not a popover change.
    if (value.startsWith("evt:")) {
      // …except the console's contextual actions, which are commands.
      if (value.startsWith("evt:action:")) {
        const id = value.slice("evt:action:".length);
        if (eventsActions.find((a) => a.id === id)?.disabled) return;
        window.dispatchEvent(new CustomEvent("events:action", { detail: { id } }));
        return;
      }
      const section = value.slice(4);
      if (section === "create") {
        window.dispatchEvent(new CustomEvent("events:open-create-modal"));
        return;
      }
      window.dispatchEvent(
        new CustomEvent("events:navigate", { detail: { section } })
      );
      return;
    }
    if (value === "Founder:Events:Create") {
      window.dispatchEvent(new CustomEvent("events:open-create-modal"));
      return;
    }
    // Not a direct action any more — it opens a drop-up so the founder can
    // pick between going live now and scheduling for later.
    if (value === "Founder:Live:Create") {
      setShowCreateStreamMenuPopover((prev) => !prev);
      setShowLiveStreamsMenuPopover(false);
      setShowVideosMenuPopover(false);
      setShowCommunitiesMenuPopover(false);
      setShowFeedsDropdownPopover(false);
      return;
    }
    if (value === "Founder:Communities:Upload") {
      if (activePopover !== "Founder:Communities:Cabinet") {
        setActivePopover("Founder:Communities:Cabinet");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("cabinet:trigger-upload"));
        }, 300);
      } else {
        window.dispatchEvent(new CustomEvent("cabinet:trigger-upload"));
      }
      return;
    }
    if (value === "Founder:Communities:NewFolder") {
      // Same shape as the Upload tab above: open the cabinet first when it is
      // not already on screen, then let it open its own dialog.
      if (activePopover !== "Founder:Communities:Cabinet") {
        setActivePopover("Founder:Communities:Cabinet");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("cabinet:trigger-new-folder"));
        }, 300);
      } else {
        window.dispatchEvent(new CustomEvent("cabinet:trigger-new-folder"));
      }
      return;
    }
    if (value === "Cabinet:Upload") {
      if (activePopover !== "Cabinet") {
        setActivePopover("Cabinet");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("cabinet:trigger-upload"));
        }, 300);
      } else {
        window.dispatchEvent(new CustomEvent("cabinet:trigger-upload"));
      }
      return;
    }
    if (value === "Cabinet:CreateFolder") {
      if (activePopover !== "Cabinet") {
        setActivePopover("Cabinet");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("cabinet:trigger-create-folder"));
        }, 300);
      } else {
        window.dispatchEvent(new CustomEvent("cabinet:trigger-create-folder"));
      }
      return;
    }
    if (value === "Feeds:NewPost") {
      if (activePopover !== "Feeds") {
        setActivePopover("Feeds");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("feed:open-new-post"));
        }, 150);
      } else {
        window.dispatchEvent(new CustomEvent("feed:open-new-post"));
      }
      return;
    }
    if (value === "Taskroom:InvitePeople") {
      if (activePopover !== "Taskroom") {
        setActivePopover("Taskroom");
        setProjectActiveItem("WorkspacePeople");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("taskroom:open-invite-people"));
        }, 150);
      } else {
        if (projectActiveItem !== "WorkspacePeople") {
          setProjectActiveItem("WorkspacePeople");
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("taskroom:open-invite-people"));
          }, 150);
        } else {
          window.dispatchEvent(new CustomEvent("taskroom:open-invite-people"));
        }
      }
      return;
    }
    if (value === "Taskroom:AddTask") {
      if (activePopover !== "Taskroom") {
        setActivePopover("Taskroom");
        setProjectActiveItem("DashMangement");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("taskroom:open-create-task"));
        }, 150);
      } else {
        if (projectActiveItem !== "DashMangement") {
          setProjectActiveItem("DashMangement");
        }
        window.dispatchEvent(new CustomEvent("taskroom:open-create-task"));
      }
      return;
    }
    if (value === "NetworkMail:NewCampaign") {
      const needsSectionSwitch = networkMailSection !== "campaigns";
      const needsContainerSwitch =
        activeContainer !== "network-mail" || activePopover !== "Network Mail";

      if (needsContainerSwitch) {
        setActivePopover("Network Mail");
        setActiveContainer("network-mail");
        setNetworkMailSection("campaigns");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("network-mail:open-create-campaign"));
        }, 150);
      } else if (needsSectionSwitch) {
        setNetworkMailSection("campaigns");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("network-mail:open-create-campaign"));
        }, 150);
      } else {
        window.dispatchEvent(new CustomEvent("network-mail:open-create-campaign"));
      }
      return;
    }
    if (value === "CommunitiesMenu") {
      setShowCommunitiesMenuPopover((prev) => !prev);
      setShowFeedsDropdownPopover(false);
      setShowLiveStreamsMenuPopover(false);
      setShowVideosMenuPopover(false);
      setShowCreateStreamMenuPopover(false);
      return;
    }
    if (value === "LiveStreamsMenu") {
      setShowLiveStreamsMenuPopover((prev) => !prev);
      setShowVideosMenuPopover(false);
      setShowCommunitiesMenuPopover(false);
      setShowFeedsDropdownPopover(false);
      setShowCreateStreamMenuPopover(false);
      return;
    }
    if (value === "VideosMenu") {
      setShowVideosMenuPopover((prev) => !prev);
      setShowLiveStreamsMenuPopover(false);
      setShowCommunitiesMenuPopover(false);
      setShowFeedsDropdownPopover(false);
      setShowCreateStreamMenuPopover(false);
      return;
    }
    if (value === "Feeds") {
      setShowFeedsDropdownPopover((prev) => !prev);
      setShowCommunitiesMenuPopover(false);
      setShowLiveStreamsMenuPopover(false);
      setShowVideosMenuPopover(false);
      setShowCreateStreamMenuPopover(false);
      if (activePopover !== "Feeds") {
        setActivePopover("Feeds");
        setActiveContainer(null);
        setActiveChatId({ type: "dm", id: "" });
      }
      return;
    }
    setShowCommunitiesMenuPopover(false);
    setShowFeedsDropdownPopover(false);
    setShowLiveStreamsMenuPopover(false);
    setShowVideosMenuPopover(false);
    setShowCreateStreamMenuPopover(false);

    if (activeContainer === "teamforce") {
      // Recruitment "Create Request" — forwarded to RecruitmentSection.
      if (value === "tf-recruitment:create") {
        window.dispatchEvent(new CustomEvent("teamforce:create-recruitment"));
        return;
      }
      // Departments "Add Department" — forwarded to DepartmentsSection.
      if (value === "tf-department:create") {
        window.dispatchEvent(new CustomEvent("teamforce:create-department"));
        return;
      }
      // Branches "Add Branch" — forwarded to BranchesSection.
      if (value === "tf-branch:create") {
        window.dispatchEvent(new CustomEvent("teamforce:create-branch"));
        return;
      }
      // Self Attendance quick actions — forwarded to AttendanceSection,
      // no section change.
      if (value.startsWith("tf-attendance:")) {
        window.dispatchEvent(
          new CustomEvent("teamforce:attendance-action", {
            detail: { action: value.slice("tf-attendance:".length) },
          })
        );
        return;
      }
      // Admin/founder on an employee-details page: "Update Profile" edits the
      // employee being viewed (not self) — handled inside TeamforceApp.
      if (value === "update-info" && tfEmployeeDetail && tfHasWriteAccess) {
        window.dispatchEvent(new CustomEvent("teamforce:edit-current-employee"));
        return;
      }
      setActivePopover("Teamforce:" + value);
      return;
    }
    if (activeContainer === "deals") {
      if (value === "add-lead") {
        const openEvent =
          dealsSection === "funnel"
            ? "deals:open-add-funnel"
            : dealsSection === "contacts"
              ? "deals:open-add-contact"
              : dealsSection === "companies"
                ? "deals:open-add-company"
                : dealsSection === "products"
                  ? "deals:open-add-product"
                  : dealsSection === "cms"
                    ? "deals:open-new-cms-page"
                    : dealsSection === "leads"
                      ? "deals:open-add-lead"
                      : "deals:open-add-lead-request";
        window.dispatchEvent(new CustomEvent(openEvent));
        return;
      }
      const navigateDeals = () => {
        window.dispatchEvent(
          new CustomEvent("deals:inline-navigate", {
            detail: { section: value },
          })
        );
      };
      if (value === "cms") {
        void import("@/lib/cms/accessGate").then(({ requestCmsAccess }) => {
          requestCmsAccess(navigateDeals);
        });
        return;
      }
      navigateDeals();
      return;
    }
    if (activeContainer === "thoughts") {
      window.dispatchEvent(
        new CustomEvent("thoughts:inline-navigate", {
          detail: { section: value },
        })
      );
      return;
    }
    if (activeContainer === "network-mail") {
      window.dispatchEvent(
        new CustomEvent("network-mail:inline-navigate", {
          detail: { section: value },
        })
      );
      return;
    }
    if (activePopover === "Taskroom" || pageGroup === "Taskroom") {
      const mapped = TASKROOM_BOTTOM_NAV_MAP[value];
      if (mapped) {
        if (mapped === "WorkspaceSettings" && !canManageWorkspaceSettings) {
          return;
        }
        setProjectActiveItem(mapped);
        setActivePopover("Taskroom");
        return;
      }
    }
    if (pageGroup === "docusign") {
      if (value === "docusign:add-document") {
        window.dispatchEvent(new CustomEvent("docusign:open-upload"));
        return;
      }
      if (value === "docusign:send-email") {
        window.dispatchEvent(new CustomEvent("docusign:open-external-upload"));
        return;
      }
      setDocusignActiveTab(value);
      return;
    }
    if (value === "coverfi") {
      setActivePopover(null);
      setActiveContainer(null);
      if (pathname !== "/coverfi") {
        router.push("/coverfi");
      }
      return;
    }
    setActiveContainer(null);
    setActiveChatId({ type: "dm", id: "" });
    if (value === "OfficeStream") {
      setActivePopover(null);
      if (pathname !== "/workspace") {
        router.push("/workspace");
      }
    } else {
      setActivePopover(value);
    }
  };

  const isTabActive = (tabId: string, tabValue: string) => {
    if (tabValue === "coverfi") {
      return pathname?.startsWith("/coverfi") ?? false;
    }
    if (activeContainer === "teamforce") {
      return teamforceSection === tabValue;
    }
    if (activeContainer === "deals") {
      return dealsSection === tabValue;
    }
    if (activeContainer === "thoughts") {
      return thoughtsSection === tabValue;
    }
    if (activeContainer === "network-mail") {
      return networkMailSection === tabValue;
    }
    if (pageGroup === "Taskroom") {
      const mapped = TASKROOM_BOTTOM_NAV_MAP[tabValue];
      if (mapped) {
        return (projectActiveItem ?? "WorkspacePeople") === mapped;
      }
    }
    if (pageGroup === "docusign") {
      return docusignActiveTab === tabValue;
    }
    if (pageGroup === "garagepay") {
      return tabId === garagePayActiveTab;
    }
    if (pageGroup === "founder-events" && tabValue.startsWith("evt:")) {
      return eventsSection === tabValue.slice(4);
    }

    if (tabValue === "CommunitiesMenu") {
      return (
        activePopover === "Communities:Discover" ||
        activePopover === "Communities:My" ||
        activePopover === "ReservedCommunities"
      );
    }
    if (tabValue === "LiveStreamsMenu") {
      return (
        activePopover === "Live:Discover" ||
        activePopover === "Live:Enrolled" ||
        activePopover === "Live:Reserves" ||
        activePopover === "Founder:Live" ||
        activePopover === "Founder:Live:Attendees" ||
        activePopover === "Founder:Live:Orders"
      );
    }
    if (tabValue === "VideosMenu") {
      return (
        activePopover === "Live:Recording" ||
        activePopover === "Live:Recorded" ||
        activePopover === "Drops:Feed" ||
        activePopover === "Drops" ||
        activePopover === "Content:Playlists" ||
        activePopover === "Content:AllVideos" ||
        activePopover === "Founder:Live:Recordings" ||
        activePopover === "Founder:Content:Videos" ||
        activePopover === "Founder:Content:Drops" ||
        activePopover === "Founder:Content:Playlists"
      );
    }

    return activePopover === tabValue || (tabId === "Office" && pathname === "/workspace" && !activePopover);
  };

  // Track last visited pathname globally (used by Deals entry guards)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname) return;
    try {
      sessionStorage.setItem("app:lastPathname", pathname);
    } catch {
      // ignore
    }
  }, [pathname]);

  // Auth guard: redirect to login if token is missing/expired
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === BAT246_DOC_PUBLIC_PATH) return; // public doc page — viewable without a session
    if (isPublicEsignSignPage) return; // external signer — viewable without a session, see above
    const token = getToken();
    if (!token || isTokenExpired()) {
      toast.error("Your session expired. Redirecting to sign in…");
      clearToken();
      const fullPath = pathname + (window.location.search || "");
      const redirect = fullPath
        ? `?error=session_expired&redirect=${encodeURIComponent(fullPath)}`
        : "?error=session_expired";
      router.replace(`/login${redirect}`);
      return;
    }
  }, [pathname, router]);

  // Clear activePopover when navigating to specific pages that need full screen or dedicated routing
  useEffect(() => {
    if (
      pathname?.includes("/cabinet/editor/") ||
      pathname?.includes("/meet/") ||
      pathname?.includes("/games/") ||
      pathname?.includes("/coverfi") ||
      pathname?.includes("/thoughts") ||
      // Public, no-login DocuSign self-sign page — activePopover defaults to "Feeds" and
      // otherwise wins over `children` below (see the ternary around line 3787), so without
      // this the actual routed page (app/(dashboard)/workspace/sign/[token]) never renders,
      // popover UI shows instead. isPublicEsignSignPage (above) only affects chrome visibility.
      pathname?.includes("/workspace/sign/")
    ) {
      setActivePopover(null);
      setActiveContainer(null);
      if (pathname?.includes("/games/")) {
        setRightPanelCollapsed(true);
      }
    }
  }, [pathname]);

  // Open the Orders popover when arrived via a deep link — e.g. after a crypto
  // payment redirect (/workspace?open=orders or /workspace?invoice=<id>).
  // Purely additive: only acts when the param is present; never overrides
  // normal navigation/defaults.
  // `open=product-orders` lands on Digital Products → Orders. Used by the
  // "View Order" CTA in the post-purchase product email, which should show the
  // buyer their purchase and its download links rather than the invoice doc.
  // `&order=<id>` scrolls to and highlights that order once the list loads.
  // Stashed rather than passed as a prop because ProductsPage mounts after this
  // runs, and the orders fetch is async — same handoff the note/course deep
  // links above use. The seller's office arrives as `&orgId=`, handled by the
  // deep-link effect near the top of this component (it pins the org and
  // reloads, so by the time we get here the orders fetch is already scoped
  // to the office the purchase was made in).
  useEffect(() => {
    if (searchParams?.get("open") === "product-orders") {
      const orderId = searchParams.get("order");
      if (orderId) {
        try {
          sessionStorage.setItem("products:pending-order-id", orderId);
        } catch {
          // ignore storage errors
        }
      }
      setActivePopover("Products:Orders");
      return;
    }
    if (searchParams?.get("open") === "orders" || searchParams?.get("invoice")) {
      setActivePopover("Orders");
    }
  }, [searchParams]);

  const { incomingCall, answerCall, declineCall } = useWebRTC();

  // Function to close chat popover
  const closeChat = () => {
    setActiveChatId({ type: "dm", id: "" });
  };

  // Find caller info from the members list
  const caller = useMemo(() => {
    if (!incomingCall) return null;
    return members.find((m) => (m.id || m._id) === incomingCall.from);
  }, [incomingCall, members]);

  // fetch members
  async function loadMembers() {
    try {
      // Get organization ID from token
      const userData = getUserDataFromToken();
      const orgId = localStorage.getItem("garage_org_id");

      console.log("🏢 Organization ID:", orgId);
      console.log("🔍 Loading members for organization:", orgId);

      const res = await api<{ members: Member[] }>(
        "/team/list?orgId=" + orgId,
        {},
        getToken()!
      );
      setMembers(res.members || []);

      console.log("✅ Members loaded:", res.members?.length || 0, "members");
    } finally {
      setLoadingMembers(false);
    }
  }

  // fetch groups
  async function loadGroups() {
    try {
      // Must be org-scoped — without orgId the API falls back to the
      // token's org, which goes stale the moment you switch orgs.
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setGroups([]);
        return;
      }
      const res = await api<{ groups: Group[] }>(
        `/groups?orgId=${orgId}`,
        {},
        getToken()!
      );
      setGroups(res.groups || []);
    } finally {
      setLoadingGroups(false);
    }
  }

  // Check if user needs to complete profile
  async function checkProfileStatus() {
    try {
      const res = await api<{ profileComplete: boolean }>(
        `/profile/status?userId=${meId}`,
        {},
        getToken()!
      );
      setProfileComplete(res.profileComplete);

      // If user is a stakeholder and profile is not complete, show profile popover
      if (!amIFounder && !res.profileComplete) {
        setIsFirstTimeUser(true);
        setIsProfileOpen(true);
      }
    } catch (error) {
      console.error("Error checking profile status:", error);
      // If profile doesn't exist and user is stakeholder, show profile popover
      if (!amIFounder) {
        setIsFirstTimeUser(true);
        setIsProfileOpen(true);
      }
    }
  }

  // Fetch affiliate ID and org details for mobile "Grow Your Network" feature
  const [mobileOrgDetails, setMobileOrgDetails] = useState<{ name: string; slug?: string } | null>(null);

  useEffect(() => {
    async function fetchMobileAffiliateData() {
      try {
        const response = await api<{
          success: boolean;
          affiliateId: string | null;
        }>("/affiliate/my-affiliate-id", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (response.success && response.affiliateId) {
          setMobileAffiliateId(response.affiliateId);
        }
      } catch (err) {
        console.error("Error fetching affiliate ID:", err);
      }
    }

    async function fetchOrgDetails() {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) return;

        const response = await api<{
          organization: { name: string; slug?: string };
        }>(`/org/${orgId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (response.organization) {
          setMobileOrgDetails(response.organization);
        }
      } catch (err) {
        console.error("Error fetching org details:", err);
      }
    }

    async function fetchBrandColor() {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) return;

        const res = await api<{ branding?: { primaryColor?: string } }>(
          `/org/${orgId}/branding`
        );
        if (res.branding?.primaryColor) {
          setMobileBrandColor(res.branding.primaryColor);
        }
      } catch {
        // ignore — will use default primary color
      }
    }

    fetchMobileAffiliateData();
    fetchOrgDetails();
    fetchBrandColor();
  }, []);

  useEffect(() => {
    loadMembers();
    loadGroups();

    const onTeamReload = () => loadMembers();
    const onGroupsReload = () => loadGroups();
    const onOrgSwitched = (event?: CustomEvent<{ orgId: string }>) => {
      // Refresh all data when organization is switched
      loadMembers();
      loadGroups();
      loadMyApps();

      // Reset tabs and last active subpages for the switched organization
      const newOrgId = event?.detail?.orgId || localStorage.getItem("garage_org_id");
      const subpagesKey = newOrgId ? `garage_last_active_subpages_${newOrgId}` : "garage_last_active_subpages";

      setRecentTabs(loadRecentTabs(newOrgId));
      setPageTabLabels(loadPageTabLabels(newOrgId));
      setTabSelection(null);

      try {
        const savedSubpages = sessionStorage.getItem(subpagesKey);
        setLastActiveSubpages(savedSubpages ? JSON.parse(savedSubpages) : {});
      } catch {
        setLastActiveSubpages({});
      }

      // Reset to default page view
      setActivePopover("Feeds");
    };

    // Handle notification clicks to open chats
    const onOpenDM = (event: CustomEvent) => {
      const { userId } = event.detail;
      if (userId) {
        setActiveChatId({ type: "dm", id: userId });
      }
    };

    const onOpenGroup = (event: CustomEvent) => {
      const { groupId } = event.detail;
      if (groupId) {
        setActiveChatId({ type: "group", id: groupId });
      }
    };

    const onOpenGlobalDM = (event: CustomEvent) => {
      const { userId } = event.detail;
      if (userId) {
        setActiveChatId({ type: "global-dm", id: userId });
      }
    };

    // Handle notification click to open feed post with highlight
    const onOpenPost = (event: CustomEvent) => {
      const { postId, channelId, commentId } = event.detail;
      if (postId) {
        // Navigate to feed page and trigger post highlight
        setActivePopover("Feeds");
        // Small delay to ensure Feed page is rendered, then dispatch highlight event
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("feed:highlight-post", {
              detail: { postId, channelId, commentId },
            })
          );
        }, 300);
      }
    };

    // Knock a user from anywhere (e.g. feed user popup). Close popover + inline
    // apps so the workspace knocking UI underneath is visible; WorkspaceClient
    // picks up the pending knock (event when mounted, sessionStorage on nav).
    const onKnockUser = () => {
      setActivePopover(null);
      setActiveContainer(null);
      if (!window.location.pathname.startsWith("/workspace")) {
        router.push("/workspace");
      }
    };

    // Profile event (from MobileActionSidebar)
    const onProfileOpen = () => {
      setIsProfileOpen(true);
      setIsFirstTimeUser(false);
    };

    // Affiliate profile overlay event
    const onAffiliateProfileOpen = (e: CustomEvent<{ userId: string | null }>) => {
      const id = e.detail?.userId;
      setAffiliateProfileUserId(id || null);
    };

    // Mobile menu event handlers (for options from the hidden three-dot menu)
    const onGuestFunnelOpen = (
      e: CustomEvent<{ orgSlug?: string; orgName?: string; orgId?: string }>
    ) => {
      const slug = e.detail?.orgSlug;
      // Cleared when opened without one, or the office it was last launched
      // from would leak into the next visit.
      setGrowNetworkOffice(
        slug
          ? {
            slug,
            name: e.detail?.orgName ?? null,
            orgId: e.detail?.orgId ?? null,
          }
          : null
      );
      setIsGrowNetworkOpen(true);
    };
    const onManageOrgOpen = () => {
      setIsMobileManageOrgOpen(true);
    };
    const onReferFounderOpen = () => {
      setIsMobileReferFounderOpen(true);
    };
    const onInviteEmployeesOpen = () => {
      setIsMobileInviteEmployeesOpen(true);
    };

    const onMobileComposerVisibility = (
      event: CustomEvent<{ visible?: boolean }>
    ) => {
      setIsMobilePostComposerOpen(Boolean(event.detail?.visible));
    };

    const onOpenInformation = () => {
      setRightPanelCollapsed(false);
      const savedInfoWidth = localStorage.getItem("dashboard.rightpanel.infowidth");
      setRightPanelWidth(savedInfoWidth ? parseInt(savedInfoWidth, 10) : 450); // Open wider for information tab
    };

    const onOpenVideoPlayer = () => {
      setRightPanelCollapsed(false);
      if (isVideoSizingPage(activePopoverRef.current)) {
        const targetWidth = typeof window !== "undefined" ? Math.max(620, Math.floor(window.innerWidth * 0.35)) : 620;
        setRightPanelWidth(targetWidth);
      } else {
        const savedInfoWidth = localStorage.getItem("dashboard.rightpanel.infowidth");
        setRightPanelWidth(savedInfoWidth ? parseInt(savedInfoWidth, 10) : 420);
      }
    };

    const onOpenDropsFeed = () => {
      setRightPanelCollapsed(false);
      const targetWidth = typeof window !== "undefined" ? Math.max(540, Math.floor(window.innerWidth * 0.35) - 80) : 540;
      setRightPanelWidth(targetWidth);
    };

    const onCloseInformation = () => {
      setRightPanelCollapsed(true);
    };

    const handleToggleTint = (e: Event) => {
      const customEvent = e as CustomEvent<{ tint: boolean }>;
      const isTint = Boolean(customEvent.detail?.tint);
      setInfoTint(isTint);
      if (!isTint) {
        // Restore standard width from localStorage or default 360
        const saved = localStorage.getItem("dashboard.rightpanel.width");
        setRightPanelWidth(saved ? parseInt(saved, 10) : 360);
      } else {
        // Switch to info width
        const savedInfoWidth = localStorage.getItem("dashboard.rightpanel.infowidth");
        setRightPanelWidth(savedInfoWidth ? parseInt(savedInfoWidth, 10) : 450);
      }
    };

    const handleSetActivePopover = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActivePopover(customEvent.detail);
      }
    };

    window.addEventListener("team:reload", onTeamReload as any);
    window.addEventListener("groups:reload", onGroupsReload as any);
    window.addEventListener("org:switched", onOrgSwitched as any);
    window.addEventListener("notification:open-dm", onOpenDM as any);
    window.addEventListener("notification:open-group", onOpenGroup as any);
    window.addEventListener(
      "notification:open-global-dm",
      onOpenGlobalDM as any
    );
    window.addEventListener("notification:open-post", onOpenPost as any);
    window.addEventListener("workspace:knock-user", onKnockUser as any);
    window.addEventListener("profile:open", onProfileOpen as any);
    window.addEventListener("affiliate-profile:open" as any, onAffiliateProfileOpen);
    // Mobile menu events
    window.addEventListener("open:guest-funnel", onGuestFunnelOpen as any);
    window.addEventListener("manage-org:open", onManageOrgOpen as any);
    window.addEventListener("invite:open", onReferFounderOpen as any);
    window.addEventListener("invite-employees:open", onInviteEmployeesOpen as any);
    window.addEventListener(
      "feed:mobile-composer-visibility",
      onMobileComposerVisibility as EventListener
    );
    window.addEventListener("right-panel:open-information", onOpenInformation);
    window.addEventListener("right-panel:open-video-player", onOpenVideoPlayer);
    window.addEventListener("right-panel:open-playlist", onOpenVideoPlayer);
    window.addEventListener("right-panel:open-drops-feed", onOpenDropsFeed);
    window.addEventListener("right-panel:close", onCloseInformation);
    window.addEventListener("right-panel:toggle-tint", handleToggleTint);
    window.addEventListener("layout:set-active-popover", handleSetActivePopover as EventListener);
    return () => {
      window.removeEventListener("team:reload", onTeamReload as any);
      window.removeEventListener("groups:reload", onGroupsReload as any);
      window.removeEventListener("org:switched", onOrgSwitched as any);
      window.removeEventListener("notification:open-dm", onOpenDM as any);
      window.removeEventListener("notification:open-group", onOpenGroup as any);
      window.removeEventListener(
        "notification:open-global-dm",
        onOpenGlobalDM as any
      );
      window.removeEventListener("notification:open-post", onOpenPost as any);
      window.removeEventListener("workspace:knock-user", onKnockUser as any);
      window.removeEventListener("profile:open", onProfileOpen as any);
      window.removeEventListener("affiliate-profile:open" as any, onAffiliateProfileOpen);
      // Mobile menu events
      window.removeEventListener("open:guest-funnel", onGuestFunnelOpen as any);
      window.removeEventListener("manage-org:open", onManageOrgOpen as any);
      window.removeEventListener("invite:open", onReferFounderOpen as any);
      window.removeEventListener("invite-employees:open", onInviteEmployeesOpen as any);
      window.removeEventListener(
        "feed:mobile-composer-visibility",
        onMobileComposerVisibility as EventListener
      );
      window.removeEventListener("right-panel:open-information", onOpenInformation);
      window.removeEventListener("right-panel:open-video-player", onOpenVideoPlayer);
      window.removeEventListener("right-panel:open-playlist", onOpenVideoPlayer);
      window.removeEventListener("right-panel:open-drops-feed", onOpenDropsFeed);
      window.removeEventListener("right-panel:close", onCloseInformation);
      window.removeEventListener("right-panel:toggle-tint", handleToggleTint);
      window.removeEventListener("layout:set-active-popover", handleSetActivePopover as EventListener);
    };
  }, []);

  // Check profile status when members are loaded
  useEffect(() => {
    if (members.length > 0 && meId) {
      checkProfileStatus();
    }
  }, [members, meId]);

  // Deals inline mobile nav — switch section without closing the overlay.
  useEffect(() => {
    const onDealsInlineNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        section?: "dashboard" | "leads" | "funnel" | "contacts" | "companies" | "products" | "cms";
      }>;
      const section = customEvent.detail?.section;
      if (!section) return;
      setDealsSection(section);
      setActiveContainer("deals");
    };

    window.addEventListener("deals:inline-navigate", onDealsInlineNavigate as EventListener);
    return () => {
      window.removeEventListener("deals:inline-navigate", onDealsInlineNavigate as EventListener);
    };
  }, []);

  // Events module → bottom bar. The module tells us whether it is showing the
  // catalogue or an open event, and which section is active.
  useEffect(() => {
    const onEventsState = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      if (!section) return;
      setEventsSection(section);
    };
    window.addEventListener("events:state", onEventsState as EventListener);
    return () =>
      window.removeEventListener("events:state", onEventsState as EventListener);
  }, []);

  // Events console → bottom bar actions. Sent on every section change and
  // cleared to [] when the console unmounts, so the catalogue never inherits a
  // stale "Add speaker".
  useEffect(() => {
    const onEventsActions = (event: Event) => {
      const next = (event as CustomEvent<{ actions?: any[] }>).detail?.actions;
      setEventsActions(Array.isArray(next) ? next : []);
    };
    window.addEventListener("events:actions", onEventsActions as EventListener);
    return () =>
      window.removeEventListener("events:actions", onEventsActions as EventListener);
  }, []);

  // Thoughts inline nav — switch section without closing the overlay.
  useEffect(() => {
    const onThoughtsInlineNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        section?: "all-notes" | "starred" | "templates" | "archive" | "trash" | "recovery";
      }>;
      const section = customEvent.detail?.section;
      if (!section) return;
      setThoughtsSection(section);
      setActiveContainer("thoughts");
    };

    window.addEventListener("thoughts:inline-navigate", onThoughtsInlineNavigate as EventListener);
    return () => {
      window.removeEventListener("thoughts:inline-navigate", onThoughtsInlineNavigate as EventListener);
    };
  }, []);

  // Network Mail inline nav — switch section without closing the overlay.
  useEffect(() => {
    const onNetworkMailInlineNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        section?: "template-library" | "campaigns" | "reports" | "settings";
      }>;
      const section = customEvent.detail?.section;
      if (!section) return;
      setNetworkMailSection(section);
      setActiveContainer("network-mail");
    };

    window.addEventListener("network-mail:inline-navigate", onNetworkMailInlineNavigate as EventListener);
    return () => {
      window.removeEventListener("network-mail:inline-navigate", onNetworkMailInlineNavigate as EventListener);
    };
  }, []);

  // Open Deals lead details in inline container (Teamforce-like UX).
  useEffect(() => {
    const onOpenDealsLeadInline = (event: Event) => {
      const customEvent = event as CustomEvent<{ leadId?: string }>;
      const leadId = customEvent.detail?.leadId;
      if (!leadId) return;

      try {
        sessionStorage.setItem("deals:inline-pending-lead-id", String(leadId));
      } catch {
        // ignore storage errors
      }

      setActivePopover("Deals");
      setDealsSection("leads");
      setActiveContainer("deals");

      // If deals container is already mounted, notify it immediately.
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("deals:inline-open-lead", {
            detail: { leadId: String(leadId) },
          })
        );
      }, 0);
    };

    window.addEventListener(
      "deals:open-lead-inline",
      onOpenDealsLeadInline as EventListener
    );
    return () => {
      window.removeEventListener(
        "deals:open-lead-inline",
        onOpenDealsLeadInline as EventListener
      );
    };
  }, []);

  // Apps (subscribed)
  const [appsMy, setAppsMy] = useState<
    { id: string; name: string; url: string }[]
  >([]);

  const [adminApps, setAdminApps] = useState<
    { id: string; name: string; url: string }[]
  >([]);

  const [loadingApps, setLoadingApps] = useState(true);

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

  const others = useMemo(
    () => members.filter((m) => (m._id ?? m.id) && (m._id ?? m.id) !== meId),
    [members, meId]
  );

  const sidebarWidth = collapsed ? 0 : 272;
  const orgSidebarWidth = 62; // Always collapsed size for organization sidebar
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 360;
    try {
      const saved = localStorage.getItem("dashboard.rightpanel.width");
      return saved ? parseInt(saved, 10) : 360;
    } catch {
      return 360;
    }
  });
  const [isRightPanelDragging, setIsRightPanelDragging] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !isVideoSizingPage(activePopover)) {
      const saved = localStorage.getItem("dashboard.rightpanel.width");
      setRightPanelWidth(saved ? parseInt(saved, 10) : 360);
    }
  }, [activePopover]);

  const me = useMemo(
    () => members.find((m) => (m._id ?? m.id) === meId),
    [members, meId]
  );

  // `me` above is an ORG MEMBER row — it carries no phone/phoneVerified.
  // Those live on the auth user, which is persisted to localStorage and so
  // goes stale; refresh it once per mount from /auth/me.
  const authUser = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (members?.length > 0) {
      if (amIFounder) {
        const admin_apps = CATALOG
          // Exclude Teamforce — it's shown in the BackOffice Apps tab instead
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

  const handleOpenAppContainer = useCallback((appId: string) => {
    setActiveContainer(appId);
    if (appId === "deals") {
      setActivePopover("Deals");
    } else if (appId === "thoughts") {
      setActivePopover("Notes");
    } else if (appId === "network-mail") {
      setActivePopover("Network Mail");
    } else if (appId === "teamforce") {
      setActivePopover("Teamforce:dashboard");
    } else {
      setActivePopover("");
    }
  }, []);

  // The active page is rendered here rather than through `children`, so without
  // this memo every unrelated state change in this layout — opening a bottom-dock
  // dropdown, measuring its coordinates — re-rendered the whole page underneath
  // it mid-animation. That full re-render is what flickered.
  const activeComp = useMemo(
    () =>
      activePopover
        ? getActiveComp(
          activePopover,
          setActivePopover,
          amIFounder,
          planSlug,
          handleOpenAppContainer,
          previousPopoverRef.current,
          garagePayActiveTab,
          docusignDeepLink
        )
        : null,
    [activePopover, amIFounder, planSlug, handleOpenAppContainer, garagePayActiveTab, docusignDeepLink]
  );

  // Sidebar right-click menu: go to a page the way clicking its row does.
  // Section headers' menus list the pages under them through this.
  const openNavPage = useCallback(
    ({ popover, href }: Pick<NavNode, "popover" | "href">) => {
      setActiveContainer(null);
      setActiveChatId({ type: "dm", id: "" });
      setActivePopover(href || popover === OFFICE_PAGE ? null : popover ?? null);
      const target = href ?? "/workspace";
      if (pathname !== target) router.push(target);
    },
    [pathname, router]
  );

  // "Open in side peek": a second page in a panel beside the current one.
  const [sidePeek, setSidePeek] = useState<SidePeek | null>(null);
  const sidePeekPopover = sidePeek?.popover ?? null;

  const openSidePeek = useCallback((popover: string, label: string) => {
    const title = getTabLabel(normalizeTab(popover));
    setSidePeek({ popover, title, subtitle: label !== title ? label : undefined });
  }, []);

  const closeSidePeek = useCallback(() => setSidePeek(null), []);

  // Pages navigate through the setActivePopover they're given. Inside the
  // peek that moves the peek — except to a page it can't show, which opens
  // in the main view instead.
  const navigateSidePeek = useCallback((popover: string | null) => {
    if (!popover) {
      setSidePeek(null);
    } else if (!canSidePeek(popover)) {
      setSidePeek(null);
      setActivePopover(popover);
    } else {
      setSidePeek({ popover, title: getTabLabel(normalizeTab(popover)) });
    }
  }, []);

  const openAppFromSidePeek = useCallback(
    (appId: string) => {
      setSidePeek(null);
      handleOpenAppContainer(appId);
    },
    [handleOpenAppContainer]
  );

  const sidePeekComp = useMemo(
    () =>
      sidePeekPopover
        ? getActiveComp(sidePeekPopover, navigateSidePeek, amIFounder, planSlug, openAppFromSidePeek, null, "one_time", null)
        : null,
    [sidePeekPopover, navigateSidePeek, amIFounder, planSlug, openAppFromSidePeek]
  );

  // Never the same page twice: once the main view shows it, the peek goes.
  useEffect(() => {
    if (sidePeekPopover && sidePeekPopover === activePopover) setSidePeek(null);
  }, [activePopover, sidePeekPopover]);

  if (!isHydrated) {
    return (
      <div className="w-full h-screen bg-[#0a0a0d] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // function getActiveComp(val: string) {
  //   switch (val) {
  //     case "Dashboard":
  //       return <DashboardPage />;
  //     case "Marketplace":
  //       return <MarketplacePage />;
  //     case "Invitees":
  //       return <InvitesPage />;
  //     case "Floor Roster":
  //       return <FloorRosterPage />;
  //     case "Tasks":
  //       return <TasksPage />;
  //     case "Calendar": // Add this case
  //       return <CalendarPage onClose={() => setActivePopover(null)} />;
  //     case "Profile":
  //       return <></>; // Profile is handled by ProfilePopover component
  //     default:
  //       return <></>;
  //   }
  const filteredAll = feedsChannels.filter((c) =>
    c.title.toLowerCase().includes(feedsSearchQuery.toLowerCase())
  );

  return (
    <>
      {/* GLOBAL MODALS AND OVERLAYS */}
      <VideoCallOverlay />
      <AudioCallOverlay />
      <FloatingRecordingIndicator
        onOpenChat={(type, id) => {
          // Only handle DM and group types, not posts
          if (type === "dm" || type === "group") {
            setActiveChatId({ type, id });
          }
        }}
      />
      <IncomingCallDialog
        open={!!incomingCall}
        callerName={caller?.name || caller?.email}
        callType={incomingCall?.callType}
        onAccept={answerCall}
        onDecline={declineCall}
      />

      {/* Profile Popover */}
      {me && (
        <ProfilePopover
          isOpen={isProfileOpen}
          onClose={() => {
            setIsProfileOpen(false);
            setIsFirstTimeUser(false);
          }}
          user={{
            id: meId,
            email: me.email,
            name: me.name,
            // From the AUTH user, not the member row — Member has no phone
            // fields at all, so reading them there made this always false
            // and re-asked people who had already verified.
            phone: authUser?.phone ?? null,
            phoneVerified: !!authUser?.phoneVerified,
          }}
          isFirstTimeUser={isFirstTimeUser}
          onProfileComplete={() => {
            setProfileComplete(true);
            setIsFirstTimeUser(false);
            setIsProfileOpen(false);
            toast.success("Profile completed successfully!");
            // The generic "Welcome to Garage!" pitch (Unilevel Plus
            // affiliate upsell) doesn't apply to someone completing their
            // profile as part of the BAT246 office funnel — they land
            // straight on Path to BAT 246 Distributor instead, which is
            // its own onboarding. Suppressed on any /games/bat246/* route,
            // and also whenever the CURRENT org is BAT246 itself (e.g. a
            // BAT246 member sitting in the generic /workspace view via
            // "Switch Offices" — same BAT246_ORG_ID constant used
            // elsewhere in this file/MainSidebar/RightPanel/etc.).
            const currentOrgId =
              typeof window !== "undefined"
                ? localStorage.getItem("garage_org_id")
                : null;
            const inBat246Office =
              pathname?.startsWith("/games/bat246") ||
              currentOrgId === "6a0d34e677323d1b81c6469b";
            if (!inBat246Office) {
              setShowWelcomeModal(true);
            }
          }}
        />
      )}

      {/* Welcome Modal - shown after first-time profile completion */}
      <WelcomeModal
        open={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onGoToWallet={() => {
          setShowWelcomeModal(false);
          setActivePopover("Vault");
        }}
      />

      {/* Alerts & Promotions — whatever the super admin published for the
          post-login surface (/garage-admin/announcements). Self-gating:
          renders nothing when there is none live, or when this browser
          already dismissed it. */}
      <AnnouncementHost surface="post-login" />

      {/* Right-click menu for sidebar pages ("Open in new tab", "Copy
          link", …). Rows opt in with a data-nav-popover attribute. */}
      <SidebarContextMenu
        getPageState={getNavPageState}
        getLink={openAppLinkFor}
        onOpen={openNavPage}
        onOpenInNewTab={openTabInBackground}
        onOpenInSidePeek={openSidePeek}
        onCloseTab={closeNavTab}
      />

      {/* Affiliate Profile Overlay */}
      {affiliateProfileUserId && (
        <AffiliateProfileOverlay
          userId={affiliateProfileUserId}
          onClose={() => setAffiliateProfileUserId(null)}
          onViewProfile={(uid) => setAffiliateProfileUserId(uid)}
        />
      )}

      {/* Office Subscription Lock - shows overlay for founders without active subscription */}
      <OfficeSubscriptionLock>
        {/* Phone verification soft-gate banner */}
        <PhoneVerifyBanner />

        {/* Office KYC nudge — founders only, and only when an admin has
            actually asked this office for documents. Self-gating. */}
        <OrgKycBanner />

        {/* Mobile Header - fixed at top, only on mobile, hidden when chat is open (and on the bat246 board page) */}
        {!isChatOpen && !hideDashboardChrome && <MobileHeader className="md:hidden" me={me} />}

        {/* Mobile Sidebar Overlay - only on mobile */}
        <MobileSidebarOverlay
          className="md:hidden"
          activePopover={activePopover}
          setActivePopover={setActivePopover}

          activeContainer={activeContainer}
          setActiveContainer={setActiveContainer}
          teamforceSection={teamforceSection}
          setTeamforceSection={setTeamforceSection}
          dealsSection={dealsSection}
          setDealsSection={setDealsSection}
          networkMailSection={networkMailSection}
          setNetworkMailSection={setNetworkMailSection}
          thoughtsSection={thoughtsSection}
          setThoughtsSection={setThoughtsSection}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          setIsProfileOpen={setIsProfileOpen}
          setIsFirstTimeUser={setIsFirstTimeUser}
          isActivityOpen={isActivityOpen}
          setIsActivityOpen={setIsActivityOpen}
          setIsAskCabinetOpen={setIsAskCabinetOpen}
        />

        {/* Mobile Right Panel Overlay - only on mobile (triple dot menu) */}
        <MobileRightPanelOverlay
          className="md:hidden"
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          setActivePopover={setActivePopover}
        />

        {/* Main Layout Container */}
        <div
          className={`relative h-dvh bg-[#0a0a0d] text-white ${isRightPanelDragging ? '' : 'transition-all ease-in-out duration-150'} ${isChatOpen ? 'pt-0' : 'pt-14'} md:pt-0 md:grid overflow-hidden`}
          style={{
            gridTemplateColumns: hideDashboardChrome ? "1fr" : `${sidebarWidth}px 1fr`,
            ...({ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties),
          }}
        >

          {/* MAIN SIDEBAR - Hidden on mobile, and on the bat246 board page */}
          {!hideDashboardChrome && (
            <div className="hidden md:contents">
              <MainSidebar
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                activePopover={activePopover}
                setActivePopover={setActivePopover}
                activeContainer={activeContainer}
                setActiveContainer={setActiveContainer}
                teamforceSection={teamforceSection}
                setTeamforceSection={setTeamforceSection}
                dealsSection={dealsSection}
                setDealsSection={setDealsSection}
                networkMailSection={networkMailSection}
                setNetworkMailSection={setNetworkMailSection}
                thoughtsSection={thoughtsSection}
                setThoughtsSection={setThoughtsSection}
                activeChatId={activeChatId}
                setActiveChatId={setActiveChatId}
                setIsProfileOpen={setIsProfileOpen}
                setIsFirstTimeUser={setIsFirstTimeUser}
                isActivityOpen={isActivityOpen}
                setIsActivityOpen={setIsActivityOpen}
                setIsAskCabinetOpen={setIsAskCabinetOpen}
              />
            </div>
          )}

          {/* MAIN CONTENT - Rendered only ONCE */}
          <div className={`relative min-w-0 h-full flex flex-col bg-[#0a0a0d] overflow-hidden`}>

            {/* Global Top Navbar - Mobile View (hidden on the bat246 board page) */}
            {!hideDashboardChrome && (
              <div className="sticky top-0 z-10 flex md:hidden items-center h-[73px] bg-[#0a0a0d] border-b border-[#2E2E2E] px-4 gap-4 flex-shrink-0">

                <div className="flex-1 min-w-0 overflow-hidden">
                  {(activePopover || pathname === "/workspace") ? (
                    <RecentTabs
                      tabs={recentTabs[tabSet]}
                      activeTab={activeTab}
                      getTabLabel={tabLabel}
                      onSelect={handleTabSelect}
                      onClose={handleTabClose}
                    />
                  ) : (
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider pl-2">Workspace</span>
                  )}
                </div>
                <WorkspaceToolbar />
              </div>
            )}

            {/* Global Top Navbar - Desktop View (hidden on the bat246 board
                page, and on the BAT 246 boards list while still onboarding
                — see bat246OnboardingActive) */}
            {!hideDashboardChrome && !bat246OnboardingActive && (
              <AppTabBar
                className="hidden md:flex"
                tabs={recentTabs[tabSet]}
                tabSet={tabSet}
                activeTab={activeTab}
                getTabLabel={tabLabel}
                onSelectTab={handleTabSelect}
                onCloseTab={handleTabClose}
                onNewTab={handleTabSelect}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onBack={goBack}
                onForward={goForward}
                collapsed={collapsed}
                onToggleSidebar={() => setCollapsed(!collapsed)}
                onToggleRightPanel={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                rightPanelCollapsed={rightPanelCollapsed}
                me={me}
              >
                <WorkspaceToolbar />
              </AppTabBar>
            )}

            {/* Content Body Container */}
            <div
              className={`@container relative min-w-0 flex-1 min-h-0 flex flex-col scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isChatOpen
                ? "overflow-hidden pb-0"
                : (activePopover === "Vault" || activePopover === "GaragePay")
                  ? "overflow-auto pb-0"
                  : activePopover === "Taskroom"
                    ? "overflow-hidden pb-0"
                    : "overflow-auto pb-0"
                }`}
            >
              {activePopover ? (
                <div ref={popoverScrollRef} className="flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {activeComp}
                </div>
              ) : (
                children
              )}

              {/* Tint Overlay removed from here */}

              {activeContainer !== "" && activeContainer && (
                <div className="absolute z-[400] top-0 left-0 w-full backdrop-blur-lg bg-black/80 h-full transition-all ease-in-out duration-150">
                  <AppContainer
                    id={activeContainer}
                    isFounder={amIFounder}
                    adminApps={adminApps}
                    onClose={() => setActiveContainer(null)}
                    teamforceSection={teamforceSection}
                    dealsSection={dealsSection}
                    networkMailSection={networkMailSection}
                    thoughtsSection={thoughtsSection}
                  />
                </div>
              )}

              {activeChatId.id !== "" && activeChatId.id && (
                <div className="absolute z-[600] top-0 left-0 right-0 h-full transition-all ease-in-out duration-150 overscroll-contain">
                  <div className="w-full h-full bg-[#181818] overscroll-contain">
                    {activeChatId.type === "dm" ? (
                      <DMPage id={activeChatId.id} onClose={closeChat} />
                    ) : activeChatId.type === "group" ? (
                      <GroupPage id={activeChatId.id} onClose={closeChat} />
                    ) : (
                      <GlobalDMPage id={activeChatId.id} onClose={closeChat} />
                    )}
                  </div>
                </div>
              )}

              {/* ActivityPage panel — disabled at user request. Wrapped in
                  `false &&` so the JSX stays in source for an easy revert. */}
              {false && isActivityOpen && (
                <div className="absolute z-[600] top-0 left-0 right-0 h-full transition-all ease-in-out duration-150">
                  <div className="w-full md:w-[450px] h-full backdrop-blur-lg bg-black/80">
                    {/* <ActivityPage onClose={() => setIsActivityOpen(false)} /> */}
                  </div>
                  <div
                    className="hidden md:block absolute top-0 left-[450px] right-0 h-full cursor-pointer"
                    onClick={() => setIsActivityOpen(false)}
                    title="Click to close activity"
                  />
                </div>
              )}

              {isAskCabinetOpen && (
                <div className="absolute z-[600] top-0 left-0 right-0 h-full transition-all ease-in-out duration-150">
                  <div className="w-full md:w-[450px] h-full backdrop-blur-lg bg-black/80">
                    <AskCabinetSidebar
                      onClose={() => setIsAskCabinetOpen(false)}
                    />
                  </div>
                  <div
                    className="hidden md:block absolute top-0 left-[450px] right-0 h-full cursor-pointer"
                    onClick={() => setIsAskCabinetOpen(false)}
                    title="Click to close Ask Cabinet"
                  />
                </div>
              )}

            </div>

            {/* Global Glassmorphic Floating Bottom Navigation Bar */}
            {/* Whitelabel is a single centered checkout card — the dock
                would float over its CTA and fine print, so it's hidden
                there and comes back on every other view. */}
            {!pathname.startsWith("/games/bat246") && !isFormOpen && activePopover !== "1Network" && activePopover !== "Vault" && activePopover !== "GaragePay" && activePopover !== "Whitelabel" && !activePopover?.startsWith("Founder:Jobs") && activePopover !== "Job Board" && !activePopover?.startsWith("Job Board:") && (
              <>
                {showCommunitiesMenuPopover && (
                  <div
                    className="fixed inset-0 z-[540] pointer-events-auto cursor-default"
                    onClick={() => setShowCommunitiesMenuPopover(false)}
                  />
                )}
                {showFeedsDropdownPopover && (
                  <div
                    className="fixed inset-0 z-[540] pointer-events-auto cursor-default"
                    onClick={() => setShowFeedsDropdownPopover(false)}
                  />
                )}
                {showLiveStreamsMenuPopover && (
                  <div
                    className="fixed inset-0 z-[540] pointer-events-auto cursor-default"
                    onClick={() => setShowLiveStreamsMenuPopover(false)}
                  />
                )}
                {showVideosMenuPopover && (
                  <div
                    className="fixed inset-0 z-[540] pointer-events-auto cursor-default"
                    onClick={() => setShowVideosMenuPopover(false)}
                  />
                )}
                {showCreateStreamMenuPopover && (
                  <div
                    className="fixed inset-0 z-[540] pointer-events-auto cursor-default"
                    onClick={() => setShowCreateStreamMenuPopover(false)}
                  />
                )}

                <AnimatePresence>
                  {showFeedsDropdownPopover && feedsTabCoords && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, x: "-50%" }}
                      exit={{ opacity: 0, y: 8, x: "-50%" }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      onClick={(e) => e.stopPropagation()}
                      className="fixed z-[600] w-[350px] p-5 flex flex-col gap-4 rounded-[20px] sm:rounded-[24px] pointer-events-auto"
                      style={{
                        left: `${feedsTabCoords.left}px`,
                        bottom: `${feedsTabCoords.bottom}px`,
                        backdropFilter: "blur(20px) saturate(180%)",
                        WebkitBackdropFilter: "blur(20px) saturate(180%)",
                        // Keep the blurred panel on its own compositor layer for
                        // the whole open/close animation. Without it Chrome
                        // re-rasterises the backdrop mid-animation and the panel
                        // (and the page behind it) flashes.
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        background: "rgba(30, 30, 30, 0.65)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12)"
                      }}
                    >
                      <div className="flex items-center justify-between text-white pt-0.5">
                        <span className="font-semibold text-[15px] tracking-wide text-white/95">Switch between Communities</span>
                        <button
                          type="button"
                          onClick={() => setShowFeedsDropdownPopover(false)}
                          className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white/30">
                            <X className="w-2.5 h-2.5 stroke-[2.5]" />
                          </div>
                        </button>
                      </div>

                      <div className="relative border-b border-white/[0.08] pb-4">
                        <Search className="absolute left-1 top-[40%] -translate-y-1/2 w-5 h-5 text-white/50" />
                        <input
                          type="text"
                          value={feedsSearchQuery}
                          onChange={(e) => setFeedsSearchQuery(e.target.value)}
                          placeholder="Search communities..."
                          className="w-full pl-8 pr-2 py-1.5 bg-transparent text-[15px] text-white placeholder-white/45 focus:outline-none transition-colors"
                        />
                      </div>

                      <div className="flex flex-col gap-3 max-h-[240px] overflow-y-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="text-[13px] font-semibold text-white/40 px-1 tracking-wide">All Communities</div>
                        <div className="flex flex-col">
                          {filteredAll.length === 0 ? (
                            <div className="text-xs text-white/30 px-1 py-1">No communities found</div>
                          ) : (
                            filteredAll.map((channel) => {
                              const isSelected = feedsSubscribedChannelId === channel._id;
                              const isSubscribed = subscribedChannels.some((sc) => sc.channelId === channel._id);
                              return (
                                <div
                                  key={channel._id}
                                  className={cn(
                                    "flex items-center justify-between px-1 py-2.5 rounded-lg transition-colors cursor-pointer hover:bg-white/[0.04]",
                                    isSelected && "bg-white/[0.06]"
                                  )}
                                  onClick={() => handleSelectFeedChannel(channel._id)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={cn("text-[15px] font-semibold tracking-wide transition-colors truncate", isSelected ? "text-brand" : "text-white/90")}>
                                      {channel.title}
                                    </span>
                                    {!isSubscribed && (
                                      <Lock className="w-3.5 h-3.5 text-white/40 shrink-0" />
                                    )}
                                  </div>
                                  <span className="text-[13px] text-white/40 tracking-wide shrink-0 ml-2">
                                    {formatMemberCount(channel.memberCount)}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showCommunitiesMenuPopover && communitiesTabCoords && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, x: "-50%" }}
                      exit={{ opacity: 0, y: 8, x: "-50%" }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="fixed z-[600] flex flex-col items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 pointer-events-auto w-max rounded-[20px] sm:rounded-[24px]"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        left: `${communitiesTabCoords.left}px`,
                        bottom: `${communitiesTabCoords.bottom}px`,
                        backdropFilter: "blur(20px) saturate(180%)",
                        WebkitBackdropFilter: "blur(20px) saturate(180%)",
                        // Keep the blurred panel on its own compositor layer for
                        // the whole open/close animation. Without it Chrome
                        // re-rasterises the backdrop mid-animation and the panel
                        // (and the page behind it) flashes.
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        background: "rgba(30, 30, 30, 0.65)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12)"
                      }}
                    >
                      {/* Discover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBottomTabClick("Communities:Discover");
                          setShowCommunitiesMenuPopover(false);
                        }}
                        className={cn(
                          "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                          activePopover === "Communities:Discover"
                            ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                            : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                        )}
                      >
                        <Compass className={`${activePopover === "Communities:Discover" ? "text-white" : "text-white/50 group-hover:text-white/80"
                          } h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0`} />
                        <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Discover</span>
                      </button>

                      {/* My Community */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBottomTabClick("Communities:My");
                          setShowCommunitiesMenuPopover(false);
                        }}
                        className={cn(
                          "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                          activePopover === "Communities:My"
                            ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                            : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                        )}
                      >
                        <Users className={`${activePopover === "Communities:My" ? "text-white" : "text-white/50 group-hover:text-white/80"
                          } h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0`} />
                        <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">My Communities</span>
                      </button>

                      {/* My Reserves */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBottomTabClick("ReservedCommunities");
                          setShowCommunitiesMenuPopover(false);
                        }}
                        className={cn(
                          "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                          activePopover === "ReservedCommunities"
                            ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                            : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                        )}
                      >
                        <Gift className={`${activePopover === "ReservedCommunities" ? "text-white" : "text-white/50 group-hover:text-white/80"
                          } h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0`} />
                        <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">My Reserves</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Create Live Stream → Instant | Schedule */}
                <AnimatePresence>
                  {showCreateStreamMenuPopover && createStreamTabCoords && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, x: "-50%" }}
                      exit={{ opacity: 0, y: 8, x: "-50%" }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="fixed z-[600] flex flex-col items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 pointer-events-auto w-max rounded-[20px] sm:rounded-[24px]"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        left: `${createStreamTabCoords.left}px`,
                        bottom: `${createStreamTabCoords.bottom}px`,
                        backdropFilter: "blur(20px) saturate(180%)",
                        WebkitBackdropFilter: "blur(20px) saturate(180%)",
                        // Keep the blurred panel on its own compositor layer for
                        // the whole open/close animation. Without it Chrome
                        // re-rasterises the backdrop mid-animation and the panel
                        // (and the page behind it) flashes.
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        background: "rgba(30, 30, 30, 0.65)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12)"
                      }}
                    >
                      {/* Instant — go live right now */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCreateStreamMenuPopover(false);
                          window.dispatchEvent(new CustomEvent("workshops:open-instant-modal"));
                        }}
                        className="group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                      >
                        <Zap className="h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0 text-white/50 group-hover:text-white/80" />
                        <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Instant</span>
                      </button>

                      {/* Schedule — the existing full create form */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCreateStreamMenuPopover(false);
                          window.dispatchEvent(new CustomEvent("workshops:open-create-modal"));
                        }}
                        className="group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                      >
                        <Calendar className="h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0 text-white/50 group-hover:text-white/80" />
                        <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Schedule</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showLiveStreamsMenuPopover && liveStreamsTabCoords && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, x: "-50%" }}
                      exit={{ opacity: 0, y: 8, x: "-50%" }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="fixed z-[600] flex flex-col items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 pointer-events-auto w-max rounded-[20px] sm:rounded-[24px]"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        left: `${liveStreamsTabCoords.left}px`,
                        bottom: `${liveStreamsTabCoords.bottom}px`,
                        backdropFilter: "blur(20px) saturate(180%)",
                        WebkitBackdropFilter: "blur(20px) saturate(180%)",
                        // Keep the blurred panel on its own compositor layer for
                        // the whole open/close animation. Without it Chrome
                        // re-rasterises the backdrop mid-animation and the panel
                        // (and the page behind it) flashes.
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        background: "rgba(30, 30, 30, 0.65)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12)"
                      }}
                    >
                      {(() => {
                        const isFounderContentMode = amIFounder && (activePopover?.startsWith("Founder:") || pageGroup === "founder-content");
                        if (isFounderContentMode) {
                          return (
                            <>
                              {/* My Live streams */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBottomTabClick("Founder:Live");
                                  setShowLiveStreamsMenuPopover(false);
                                }}
                                className={cn(
                                  "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                  activePopover === "Founder:Live"
                                    ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                    : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                                )}
                              >
                                <Video className={cn(
                                  "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                  activePopover === "Founder:Live" ? "text-white" : "text-white/50 group-hover:text-white/80"
                                )} />
                                <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">My Live streams</span>
                              </button>

                              {/* Attendees */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBottomTabClick("Founder:Live:Attendees");
                                  setShowLiveStreamsMenuPopover(false);
                                }}
                                className={cn(
                                  "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                  activePopover === "Founder:Live:Attendees"
                                    ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                    : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                                )}
                              >
                                <Users className={cn(
                                  "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                  activePopover === "Founder:Live:Attendees" ? "text-white" : "text-white/50 group-hover:text-white/80"
                                )} />
                                <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Attendees</span>
                              </button>

                              {/* Orders */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBottomTabClick("Founder:Live:Orders");
                                  setShowLiveStreamsMenuPopover(false);
                                }}
                                className={cn(
                                  "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                  activePopover === "Founder:Live:Orders"
                                    ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                    : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                                )}
                              >
                                <ShoppingBag className={cn(
                                  "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                  activePopover === "Founder:Live:Orders" ? "text-white" : "text-white/50 group-hover:text-white/80"
                                )} />
                                <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Orders</span>

                              </button>
                            </>
                          );
                        }
                        return (
                          <>
                            {/* Discover */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBottomTabClick("Live:Discover");
                                setShowLiveStreamsMenuPopover(false);
                              }}
                              className={cn(
                                "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                activePopover === "Live:Discover"
                                  ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                  : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <Compass className={cn(
                                "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                activePopover === "Live:Discover" ? "text-white" : "text-white/50 group-hover:text-white/80"
                              )} />
                              <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Discover</span>
                            </button>

                            {/* Enrolled */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBottomTabClick("Live:Enrolled");
                                setShowLiveStreamsMenuPopover(false);
                              }}
                              className={cn(
                                "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                activePopover === "Live:Enrolled"
                                  ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                  : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <Calendar className={cn(
                                "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                activePopover === "Live:Enrolled" ? "text-white" : "text-white/50 group-hover:text-white/80"
                              )} />
                              <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Enrolled</span>
                            </button>

                            {/* My Reserves */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBottomTabClick("Live:Reserves");
                                setShowLiveStreamsMenuPopover(false);
                              }}
                              className={cn(
                                "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                activePopover === "Live:Reserves"
                                  ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                  : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <Gift className={cn(
                                "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                activePopover === "Live:Reserves" ? "text-white" : "text-white/50 group-hover:text-white/80"
                              )} />
                              <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">My Reserves</span>
                            </button>
                          </>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showVideosMenuPopover && videosTabCoords && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, x: "-50%" }}
                      exit={{ opacity: 0, y: 8, x: "-50%" }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="fixed z-[600] flex flex-col items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 pointer-events-auto w-max rounded-[20px] sm:rounded-[24px]"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        left: `${videosTabCoords.left}px`,
                        bottom: `${videosTabCoords.bottom}px`,
                        backdropFilter: "blur(20px) saturate(180%)",
                        WebkitBackdropFilter: "blur(20px) saturate(180%)",
                        // Keep the blurred panel on its own compositor layer for
                        // the whole open/close animation. Without it Chrome
                        // re-rasterises the backdrop mid-animation and the panel
                        // (and the page behind it) flashes.
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        background: "rgba(30, 30, 30, 0.65)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12)"
                      }}

                    >
                      {(() => {
                        const isFounderContentMode = amIFounder && (activePopover?.startsWith("Founder:") || pageGroup === "founder-content");
                        if (isFounderContentMode) {
                          return (
                            <>
                              {/* My Recordings */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBottomTabClick("Founder:Live:Recordings");
                                  setShowVideosMenuPopover(false);
                                }}
                                className={cn(
                                  "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                  activePopover === "Founder:Live:Recordings"
                                    ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                    : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                                )}
                              >
                                <ListVideo className={`${activePopover === "Founder:Live:Recordings" ? "text-white" : "text-white/50 group-hover:text-white/80"
                                  } h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0`} />
                                <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">My Recordings</span>
                              </button>

                              {/* My Videos */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBottomTabClick("Founder:Content:Videos");
                                  setShowVideosMenuPopover(false);
                                }}
                                className={cn(
                                  "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                  activePopover === "Founder:Content:Videos"
                                    ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                    : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                                )}
                              >
                                <Video className={`${activePopover === "Founder:Content:Videos" ? "text-white" : "text-white/50 group-hover:text-white/80"
                                  } h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0`} />
                                <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">My Videos</span>
                              </button>

                              {/* My Drops */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBottomTabClick("Founder:Content:Drops");
                                  setShowVideosMenuPopover(false);
                                }}
                                className={cn(
                                  "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                  activePopover === "Founder:Content:Drops"
                                    ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                    : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                                )}
                              >
                                <Camera className={`${activePopover === "Founder:Content:Drops" ? "text-white" : "text-white/50 group-hover:text-white/80"
                                  } h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0`} />
                                <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">My Drops</span>
                              </button>

                              {/* My Playlists */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBottomTabClick("Founder:Content:Playlists");
                                  setShowVideosMenuPopover(false);
                                }}
                                className={cn(
                                  "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                  activePopover === "Founder:Content:Playlists"
                                    ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                    : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                                )}
                              >
                                <ListVideo className={cn(
                                  "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                  activePopover === "Founder:Content:Playlists" ? "text-white" : "text-white/50 group-hover:text-white/80"
                                )} />
                                <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">My Playlists</span>
                              </button>
                            </>
                          );
                        }
                        return (
                          <>
                            {/* All Videos */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBottomTabClick("Content:AllVideos");
                                setShowVideosMenuPopover(false);
                              }}
                              className={cn(
                                "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                activePopover === "Content:AllVideos"
                                  ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                  : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <Play className={cn(
                                "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                activePopover === "Content:AllVideos" ? "text-white" : "text-white/50 group-hover:text-white/80"
                              )} />
                              <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">All Videos</span>
                            </button>

                            {/* Recordings */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBottomTabClick("Live:Recording");
                                setShowVideosMenuPopover(false);
                              }}
                              className={cn(
                                "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                (activePopover === "Live:Recording" || activePopover === "Live:Recorded")
                                  ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                  : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <Voicemail className={cn(
                                "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                (activePopover === "Live:Recording" || activePopover === "Live:Recorded") ? "text-white" : "text-white/50 group-hover:text-white/80"
                              )} />
                              <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Recordings</span>
                            </button>

                            {/* Drops */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBottomTabClick("Drops:Feed");
                                setShowVideosMenuPopover(false);
                              }}
                              className={cn(
                                "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                (activePopover === "Drops" || activePopover === "Drops:Feed")
                                  ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                  : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <Camera className={cn(
                                "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                (activePopover === "Drops" || activePopover === "Drops:Feed") ? "text-white" : "text-white/50 group-hover:text-white/80"
                              )} />
                              <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Drops</span>
                            </button>

                            {/* Playlists */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBottomTabClick("Content:Playlists");
                                setShowVideosMenuPopover(false);
                              }}
                              className={cn(
                                "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                activePopover === "Content:Playlists"
                                  ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                  : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <ListVideo className={cn(
                                "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                activePopover === "Content:Playlists" ? "text-white" : "text-white/50 group-hover:text-white/80"
                              )} />
                              <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Playlists</span>
                            </button>

                            {/* Videos */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBottomTabClick("Content:Videos");
                                setShowVideosMenuPopover(false);
                              }}
                              className={cn(
                                "group w-full px-3 sm:px-[14px] md:px-[16px] lg:px-[18px] py-2 sm:py-2.5 md:py-3 flex items-center justify-start gap-2.5 sm:gap-3 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer",
                                activePopover === "Content:Videos"
                                  ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                  : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <Video className={cn(
                                "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px] transition-all duration-300 shrink-0",
                                activePopover === "Content:Videos" ? "text-white" : "text-white/50 group-hover:text-white/80"
                              )} />
                              <span className="text-[12px] sm:text-[13px] md:text-[14px] font-medium tracking-wide transition-colors duration-300">Videos</span>
                            </button>
                          </>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  className={`absolute z-[550] bottom-6 left-1/2 hidden md:flex items-center justify-center w-full px-4 pointer-events-none ${activeContainer === "teamforce"
                      ? "max-w-[calc(100%-32px)] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
                      : pageGroup === "founder-communities"
                        ? "max-w-[calc(100%-32px)] sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
                        : "max-w-[calc(100%-32px)] sm:max-w-md md:max-w-lg lg:max-w-xl"
                    }`}
                  initial={{ x: "-50%", y: 50, opacity: 0 }}
                  animate={isBottomNavCollapsed
                    ? { x: "60vw", opacity: 0, scale: 0.95, pointerEvents: "none" }
                    : { x: "-50%", y: 0, opacity: 1, scale: 1, pointerEvents: "auto" }
                  }
                  transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: isBottomNavCollapsed ? 0.95 : 0.5 }}
                >
                  <div
                    id="global-bottom-nav"
                    className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 pointer-events-auto rounded-[20px] sm:rounded-[24px]"
                    style={{
                      // Docusign scrolls full-page PDF canvases directly behind this dock; a live
                      // blur+saturate over that moving content is re-run every frame and can make
                      // the whole view drop to blank, so it gets a solid background there instead.
                      ...(pageGroup === "docusign"
                        ? { background: "rgba(30, 30, 30, 0.92)" }
                        : {
                            backdropFilter: "blur(20px) saturate(180%)",
                            WebkitBackdropFilter: "blur(20px) saturate(180%)",
                            background: "rgba(30, 30, 30, 0.6)",
                          }),
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12)"
                    }}
                  >
                    <div className="flex items-center gap-0.5 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0">
                      {bottomNavTabs.map((tab) => {
                        if ('isDivider' in tab && tab.isDivider) {
                          return (
                            <div
                              key={tab.id}
                              className="h-8 w-[1px] bg-white/20 mx-1 sm:mx-1.5 self-center shrink-0"
                            />
                          );
                        }

                        const active = isTabActive(tab.id, tab.value);
                        const Icon = tab.icon;

                        const isDealsFooter = pageGroup === "deals";

                        // Only the events console marks tabs disabled today —
                        // Publish stays visible but inert until its checklist
                        // passes, so the founder can see the blocker's tooltip.
                        const tabDisabled = 'disabled' in tab && !!tab.disabled;

                        const buttonEl = (
                          <button
                            key={tab.id}
                            id={`bottom-nav-tab-${tab.id}`}
                            onClick={() => handleBottomTabClick(tab.value)}
                            disabled={tabDisabled}
                            title={('title' in tab && tab.title) ? String(tab.title) : undefined}
                            className={`group shrink-0 ${tabDisabled ? "opacity-40 cursor-not-allowed" : ""} ${(activeContainer === "teamforce" || pageGroup === "founder-communities")
                              ? "px-[8px] sm:px-[12px] md:px-[14px] lg:px-[16px] py-2 sm:py-2.5"
                              : "px-2.5 sm:px-[18px] md:px-[20px] lg:px-[24px] py-2 sm:py-2.5 md:py-3"
                              } flex flex-col items-center justify-center gap-1 sm:gap-1.5 rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer ${active
                                ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-white"
                                : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.03]"
                              }`}
                          >
                            <div className="relative">
                              <Icon
                                className={`${isDealsFooter
                                    ? "h-[15px] w-[15px]"
                                    : (activeContainer === "teamforce" || pageGroup === "founder-communities")
                                      ? "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px]"
                                      : "h-[16px] w-[16px] sm:h-[18px] w-[18px] md:h-[20px] w-[20px] lg:h-[22px] w-[22px]"
                                  } transition-all duration-300 ${active ? "scale-105 text-white" : "text-white/50 group-hover:text-white/80"
                                  }`}
                              />
                              {tab.id === "CommunitiesMenu" && (
                                showCommunitiesMenuPopover ? (
                                  <ChevronDown className="absolute -top-1 -right-4 h-3 w-3 text-white/50 group-hover:text-white/80 transition-all" />
                                ) : (
                                  <ChevronUp className="absolute -top-1 -right-4 h-3 w-3 text-white/50 group-hover:text-white/80 transition-all" />
                                )
                              )}
                              {tab.id === "LiveStreamsMenu" && (
                                showLiveStreamsMenuPopover ? (
                                  <ChevronDown className="absolute -top-1 -right-4 h-3 w-3 text-white/50 group-hover:text-white/80 transition-all" />
                                ) : (
                                  <ChevronUp className="absolute -top-1 -right-4 h-3 w-3 text-white/50 group-hover:text-white/80 transition-all" />
                                )
                              )}
                              {tab.id === "VideosMenu" && (
                                showVideosMenuPopover ? (
                                  <ChevronDown className="absolute -top-1 -right-4 h-3 w-3 text-white/50 group-hover:text-white/80 transition-all" />
                                ) : (
                                  <ChevronUp className="absolute -top-1 -right-4 h-3 w-3 text-white/50 group-hover:text-white/80 transition-all" />
                                )
                              )}
                              {tab.id === "CreateWebinar" && (
                                showCreateStreamMenuPopover ? (
                                  <ChevronDown className="absolute -top-1 -right-4 h-3 w-3 text-white/50 group-hover:text-white/80 transition-all" />
                                ) : (
                                  <ChevronUp className="absolute -top-1 -right-4 h-3 w-3 text-white/50 group-hover:text-white/80 transition-all" />
                                )
                              )}
                              {tab.id === "Feeds" && (
                                <ChevronUp className="absolute -top-1 -right-3 h-2.5 w-2.5 text-white/50 group-hover:text-white/80 transition-all" />
                              )}
                            </div>
                            <span className={`${(activeContainer === "teamforce" || pageGroup === "founder-communities")
                              ? "text-[11px] sm:text-[12px]"
                              : "text-[11px] sm:text-[13px] md:text-[14px]"
                              } font-medium tracking-wide transition-colors duration-300 whitespace-nowrap ${activeContainer === "teamforce" ? "hidden sm:block" : ""}`}>{tab.label}</span>
                          </button>
                        );

                        return buttonEl;
                      })}
                    </div>{/* /scrollable-tabs */}

                    {/* Collapse Button */}
                    <button
                      type="button"
                      onClick={() => setIsBottomNavCollapsed(true)}
                      className="px-2.5 sm:px-4 py-2 sm:py-2.5 md:py-3 flex items-center justify-center rounded-[16px] sm:rounded-[20px] transition-all duration-300 cursor-pointer text-white/60 hover:text-white hover:bg-white/[0.03] border border-transparent ml-1"
                      title="Collapse Menu"
                    >
                      <ChevronRight className="h-4 w-4 sm:h-[18px] sm:w-[18px] md:h-5 w-5" />
                    </button>
                  </div>
                </motion.div>

                {/* Reappear / Expand Button */}
                <motion.button
                  type="button"
                  onClick={() => setIsBottomNavCollapsed(false)}
                  initial={{ x: 50, opacity: 0, scale: 0.8 }}
                  animate={isBottomNavCollapsed
                    ? { x: 0, opacity: 1, scale: 1, pointerEvents: "auto" }
                    : { x: 50, opacity: 0, scale: 0.8, pointerEvents: "none" }
                  }
                  transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: isBottomNavCollapsed ? 0.95 : 0.5 }}
                  className="absolute right-0 bottom-6 z-[500] flex items-center justify-center h-10 w-6 sm:h-12 sm:w-7 md:h-14 md:w-8 bg-[#161b26]/75 backdrop-blur-[24px] border border-r-0 border-white/[0.15] shadow-lg rounded-l-xl cursor-pointer text-white/60 hover:text-white"
                  title="Expand Menu"
                >
                  <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </motion.button>
              </>
            )}

            {/* Tint Overlay when Right Panel is open */}
            {!rightPanelCollapsed && (
              <div
                onClick={() => setRightPanelCollapsed(true)}
                className="fixed inset-0 w-screen h-screen bg-black/60 backdrop-blur-[2px] z-[560] transition-all pointer-events-auto cursor-pointer"
              />
            )}
          </div>

          {/* RIGHT PANEL - Hidden on mobile */}
          <div className="hidden md:contents">
            <RightPanel
              collapsed={rightPanelCollapsed}
              setCollapsed={setRightPanelCollapsed}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              setActivePopover={setActivePopover}
              activePopover={activePopover}
              width={rightPanelWidth}
              setWidth={setRightPanelWidth}
              isDragging={isRightPanelDragging}
              setIsDragging={setIsRightPanelDragging}
              onClose={() => setRightPanelCollapsed(true)}
            />
          </div>

          {/* Side peek — a page opened beside this one from the sidebar's
              right-click menu. Takes the right panel's slot, or sits beside
              the right panel when both are open; full screen on mobile. */}
          <SidePeekPanel
            peek={sidePeek}
            // A peeked page can open the right panel (videos, playlists,
            // "Learn more"); the peek then sits to its left.
            rightOffset={rightPanelCollapsed ? 0 : rightPanelWidth}
            tabOpen={sidePeekPopover ? getNavPageState(sidePeekPopover).open : false}
            onClose={closeSidePeek}
            onOpenFullPage={() => {
              if (!sidePeekPopover) return;
              setSidePeek(null);
              openNavPage({ popover: sidePeekPopover });
            }}
            onOpenInNewTab={() => sidePeek && openTabInBackground(sidePeek.popover, sidePeek.subtitle ?? sidePeek.title)}
          >
            {sidePeekComp}
          </SidePeekPanel>
        </div >
      </OfficeSubscriptionLock >


      {/* Incoming knock ring on non-workspace pages (WorkspaceClient owns it on /workspace) */}
      <GlobalKnockRing myName={members.find((m) => (m._id || m.id) === meId)?.name} />

      {/* Module-access invites waiting on this member. Self-opens for a new
          offer and can be reopened from the notification row or the sidebar
          badge — the 24h window is too short to bury behind navigation. */}
      <AccessInboxModal />

      {/* DM Notification Toast */}
      <AnimatePresence>
        {
          dmNotification.show && (
            <motion.div
              className="fixed top-6 right-6 z-[9999] max-w-sm w-full"
              initial={{ opacity: 0, x: 400, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 400, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div
                className="bg-[#0e0e12]/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl shadow-yellow-900/20 p-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  // Open DM with this user
                  setActiveChatId({ type: "dm", id: dmNotification.senderId });
                  setDmNotification((prev) => ({ ...prev, show: false }));
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-primary uppercase tracking-wide">
                      New Message
                    </span>
                  </div>
                  <X
                    className="h-4 w-4 text-primary cursor-pointer hover:opacity-80"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDmNotification((prev) => ({ ...prev, show: false }));
                    }}
                  />
                </div>
                <p className="text-white text-sm font-semibold">
                  {dmNotification.senderName}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {dmNotification.message}
                </p>
              </div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* Group Notification Toast */}
      <AnimatePresence>
        {
          groupNotification.show && (
            <motion.div
              className="fixed top-6 right-6 z-[9999] max-w-sm w-full"
              initial={{ opacity: 0, x: 400, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 400, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div
                className="bg-[#0e0e12]/95 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-900/20 p-4 cursor-pointer hover:border-purple-500/50 transition-colors"
                onClick={() => {
                  // Open group chat
                  setActiveChatId({
                    type: "group",
                    id: groupNotification.groupId,
                  });
                  setGroupNotification((prev) => ({ ...prev, show: false }));
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                      Group Message
                    </span>
                  </div>
                  <X
                    className="h-4 w-4 text-purple-400 cursor-pointer hover:text-purple-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGroupNotification((prev) => ({ ...prev, show: false }));
                    }}
                  />
                </div>
                <p className="text-white text-sm font-semibold">
                  {groupNotification.senderName} • {groupNotification.groupName}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {groupNotification.message}
                </p>
              </div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* Global DM Notification Toast */}
      <AnimatePresence>
        {
          globalDmNotification.show && (
            <motion.div
              className="fixed top-6 right-6 z-[9999] max-w-sm w-full"
              initial={{ opacity: 0, x: 400, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 400, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div
                className="bg-[#0e0e12]/95 backdrop-blur-xl border border-emerald-500/30 rounded-xl shadow-2xl shadow-emerald-900/20 p-4 cursor-pointer hover:border-emerald-500/50 transition-colors"
                onClick={() => {
                  // Open global DM with this user
                  setActiveChatId({
                    type: "global-dm",
                    id: globalDmNotification.senderId,
                  });
                  setGlobalDmNotification((prev) => ({ ...prev, show: false }));
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
                      Global Message
                    </span>
                  </div>
                  <X
                    className="h-4 w-4 text-emerald-400 cursor-pointer hover:text-emerald-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGlobalDmNotification((prev) => ({
                        ...prev,
                        show: false,
                      }));
                    }}
                  />
                </div>
                <p className="text-white text-sm font-semibold">
                  {globalDmNotification.senderName}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {globalDmNotification.message}
                </p>
              </div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* Mention Notification Toast - Top Left */}
      <AnimatePresence>
        {
          mentionNotification.show && (
            <motion.div
              className="fixed top-6 right-6 z-[9999] max-w-sm w-full"
              initial={{ opacity: 0, x: -400, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -400, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div
                className={`bg-[#0e0e12]/95 backdrop-blur-xl border rounded-xl shadow-2xl p-4 cursor-pointer transition-colors ${mentionNotification.type === "comment_mention"
                  ? "border-pink-500/30 shadow-pink-900/20 hover:border-pink-500/50"
                  : "border-orange-500/30 shadow-orange-900/20 hover:border-orange-500/50"
                  }`}
                onClick={() => {
                  // Navigate to feed page and highlight the post
                  window.dispatchEvent(
                    new CustomEvent("notification:open-post", {
                      detail: {
                        postId: mentionNotification.postId,
                        channelId: mentionNotification.channelId,
                        commentId: mentionNotification.commentId,
                      },
                    })
                  );
                  setMentionNotification((prev) => ({ ...prev, show: false }));
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${mentionNotification.type === "comment_mention"
                      ? "bg-gradient-to-br from-pink-500 to-rose-500"
                      : "bg-gradient-to-br from-orange-500 to-amber-500"
                      }`}
                  >
                    {mentionNotification.authorPicture ? (
                      <Image
                        src={mentionNotification.authorPicture}
                        alt={mentionNotification.authorName}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-sm font-semibold">
                        {mentionNotification.authorName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full animate-pulse ${mentionNotification.type === "comment_mention"
                            ? "bg-pink-400"
                            : "bg-orange-400"
                            }`}
                        ></div>
                        <span
                          className={`text-xs font-medium uppercase tracking-wide ${mentionNotification.type === "comment_mention"
                            ? "text-pink-400"
                            : "text-orange-400"
                            }`}
                        >
                          {mentionNotification.type === "comment_mention"
                            ? "Comment Mention"
                            : "Post Mention"}
                        </span>
                      </div>
                      <X
                        className={`h-4 w-4 cursor-pointer ${mentionNotification.type === "comment_mention"
                          ? "text-pink-400 hover:text-pink-300"
                          : "text-orange-400 hover:text-orange-300"
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMentionNotification((prev) => ({
                            ...prev,
                            show: false,
                          }));
                        }}
                      />
                    </div>
                    <p className="text-white text-sm font-semibold">
                      {mentionNotification.authorName} mentioned you
                    </p>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {mentionNotification.message}
                    </p>
                    <p
                      className={`text-xs mt-2 ${mentionNotification.type === "comment_mention"
                        ? "text-pink-400/70"
                        : "text-orange-400/70"
                        }`}
                    >
                      Click to view
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* Mobile Sticky Footer - Grow Your Network (hidden when chat is open,
          inline app is active, or on any BAT246 route — it covers the
          Pay With B2 Coins button there, same pathname check already used
          elsewhere in this file to suppress other things on /games/bat246/*). */}
      {
        isGrowNetworkFooterVisible && !isChatOpen && !isMobilePostComposerOpen && !activeContainer &&
        !pathname?.startsWith("/games/bat246") && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-[650]">
            <div
              className={`relative flex items-stretch shadow-lg ${!mobileBrandColor ? "bg-gradient-to-r from-primary to-secondary shadow-primary/20" : ""}`}
              style={
                mobileBrandColor
                  ? {
                    background: `linear-gradient(to right, ${mobileBrandColor}, ${mobileBrandColor}dd)`,
                    boxShadow: `0 -4px 20px ${mobileBrandColor}33`,
                  }
                  : undefined
              }
            >
              <button
                onClick={() => setIsGrowNetworkOpen(true)}
                className="flex-1 text-black font-semibold py-3 px-4 flex items-center justify-center gap-2"
              >
                <Users className="h-5 w-5" />
                Grow Your Network
              </button>
              <button
                onClick={() => setIsGrowNetworkFooterVisible(false)}
                className="px-3 flex items-center justify-center text-black/60 hover:text-black transition-colors"
                aria-label="Close grow your network banner"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )
      }

      {/* Mobile Guest Funnel Dialog */}
      <GuestFunnelDialog
        isOpen={isGrowNetworkOpen}
        onClose={() => {
          setIsGrowNetworkOpen(false);
          setGrowNetworkOffice(null);
        }}
        affiliateId={mobileAffiliateId}
        orgName={
          growNetworkOffice?.name ||
          mobileOrgDetails?.name ||
          founderData?.orgName ||
          null
        }
        orgSlug={growNetworkOffice?.slug || mobileOrgDetails?.slug || null}
        orgId={
          growNetworkOffice?.orgId ||
          (typeof window !== "undefined"
            ? localStorage.getItem("garage_org_id")
            : null)
        }
      />

      {/* Mobile Manage Org Popover */}
      <ManageOrgPopover
        isOpen={isMobileManageOrgOpen}
        onClose={() => setIsMobileManageOrgOpen(false)}
      />

      {/* Mobile Refer Founder Dialog */}
      <ReferFounderDialog
        isOpen={isMobileReferFounderOpen}
        onClose={() => setIsMobileReferFounderOpen(false)}
        affiliateId={mobileAffiliateId}
      />

      {/* Mobile Invite Employees Dialog */}
      <InviteMemberDialog
        open={isMobileInviteEmployeesOpen}
        onOpenChange={setIsMobileInviteEmployeesOpen}
        onInvited={() => {
          window.dispatchEvent(new CustomEvent("team:reload"));
        }}
      />
    </>
  );
}

function getActiveComp(
  val: string,
  setActivePopover: (popover: string | null) => void,
  amIFounder?: boolean,
  planSlug?: string | null,
  onOpenApp?: (appId: string) => void,
  previousPopover?: string | null,
  garagePayTab?: "one_time" | "recurring",
  docusignDeepLink?: { mode: "sign" | "edit" | "external-edit"; documentId: string } | null
) {
  // Garage Jobs founder console picks its own page from the key.
  if (val === "Founder:Jobs" || val.startsWith("Founder:Jobs:")) {
    return <FounderJobsApp page={val} onNavigate={setActivePopover} />;
  }
  // Garage Jobs member side picks its own screen from the key.
  if (val === "Job Board" || val.startsWith("Job Board:")) {
    return <CandidateJobsApp page={val} onNavigate={setActivePopover} />;
  }
  switch (val) {
    // case "Overview":
    //   return <Overview />;
    // case "All Taskrooms":
    //   return <AllTaskroom />;
    // case "Assigned to Me":
    //   return <AssingToMe />;
    case "Taskroom":
      return (
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <ProjectMangement setActivePopover={setActivePopover} />
        </div>
      );

    case "Directory":
      return <DashboardPage />;
    case "BackOffice":
      // Starter plan founders see a locked upsell instead of the marketplace.
      // Non-founders (planSlug null) fall through to the normal render — the
      // gate applies only when the current viewer is on Starter themselves.
      return planSlug === "starter" && amIFounder
        ? <BackOfficeLockedOverlay />
        : <MarketplacePage onOpenApp={onOpenApp} />;
    case "Spaces":
      return <CoworkingSpacesPage />;
    case "Invitees":
      return <InvitesPage />;
    case "Calendar":
      return <CalendarPage />;
    case "Cabinet":
      return <CabinetPage />;
    case "docusign":
      return <DocusignPage initialView={docusignDeepLink || undefined} />;
    case "Org Cabinet":
      return <OrganizationCabinetPage onClose={() => setActivePopover(previousPopover || null)} />;
    case "Analytics":
      return <BettyDashboardPage />;
    // Email Setup and Domain Management are whitelabel-only surfaces:
    // without the add-on the founder gets the pitch page instead.
    case "NetworkMail":
      return (
        <WhitelabelGate>
          <InitialSetupPage />
        </WhitelabelGate>
      );
    case "Domain Management":
      return (
        <WhitelabelGate>
          <DomainManagementPage />
        </WhitelabelGate>
      );
    case "Leave Management":
      return <FounderLeaveDashboard />;
    case "Pending Requests":
      return <PendingRequestsPage />;
    case "Deskstream":
      return <DeskstreamPage onClose={() => setActivePopover(previousPopover || null)} />;
    case "Feeds":
      return <FeedPage />;
    case "Live":
    case "Live Streams":
    case "Live:Upcoming":
    case "Live:Discover":
      return <WorkshopsPage initialTab="discover" />;
    case "Live:Enrolled":
      return <WorkshopsPage initialTab="enrolled" />;
    case "Live:Completed":
      return <WorkshopsPage initialTab="completed" />;
    case "Live:Recorded":
    case "Live:Recording":
      return <RecordedLiveStreamPage />;
    case "Live:Reserves":
      return <WorkshopsPage initialTab="reserves" />;
    case "Courses":
    case "Learn":
      return <CoursesPage />;
    case "Courses:Analytics":
      return <CoursesPage initialSection="analytics" />;
    case "Courses:Enrolled":
      return <CoursesPage initialSection="enrolled" />;
    case "Courses:Reserves":
      return <CoursesPage initialSection="reserves" />;
    case "Content":
    case "Long Form Videos":
    case "Content:Videos":
      return <ContentPage initialSection="videos" />;
    case "Content:Playlists":
      return <ContentPage initialSection="playlists" />;
    case "Content:Drops":
    case "Drops":
    case "Drops:Feed":
      return <DropsPage initialTab="feed" />;
    case "Drops:Uploads":
      return <DropsPage initialTab="uploads" />;
    case "Content:AllVideos":
      return <AllVideosPage />;
    case "Content:Articles":
      return <ArticlesPage />;
    case "Content:Analytics":
      return <ContentAnalyticsPage />;
    case "Recorded Live Stream":
      return <RecordedLiveStreamPage />;
    case "Articles":
      return <ArticlesPage />;
    case "Products":
    case "Digital Products":
    case "Products:Browse":
      return <ProductsPage initialTab="products" />;
    case "Products:Orders":
      return <ProductsPage initialTab="orders" />;
    case "Products:Reserves":
      return <ProductsPage initialTab="reserves" />;
    case "Services":
    case "Services:Browse":
      return <ServicesPage initialTab="services" />;
    case "Services:Optins":
      return <ServicesPage initialTab={amIFounder ? "optins" : "myservices"} />;
    case "1:1 Calls":
    case "1:1 Calls:calls":
      return <CallsPage initialTab="calls" setActivePopover={setActivePopover} />;
    case "1:1 Calls:purchases":
      return <CallsPage initialTab="purchases" setActivePopover={setActivePopover} />;
    case "1:1 Calls:mycalls":
      return <CallsPage initialTab="mycalls" setActivePopover={setActivePopover} />;
    case "1:1 Calls:bookings":
      return <CallsPage initialTab="bookings" setActivePopover={setActivePopover} />;
    case "1:1 Calls:reserves":
      return <CallsPage initialTab="reserves" setActivePopover={setActivePopover} />;
    case "Orders":
      return <OrdersPage initialInvoiceTab={garagePayTab ?? "one_time"} />;
    case "GaragePay":
    case "Vault":
      return <WalletPage />;
    case "Rank Bonus":
      return <RankBonusPage />;
    case "1Network":
      return <AffiliatePage />;
    case "Leaderboard":
      return <AffiliateLeaderboardPage />;
    case "Auction":
      return <AuctionPage />;
    case "Community":
    case "Communities":
    case "Communities:Discover":
      return <ChannelsPage initialView="main" />;
    case "Communities:My":
      return <ChannelsPage initialView="my-communities" />;
    case "ReservedCommunities":
      return <ChannelsPage initialView="reserves" />;
    case "Conference":
      return <ConferenceRoomPage setActivePopover={setActivePopover} />;
    case "Conference:Notes":
      return <ConferenceNotesPage />;
    case "Networks Manager":
      return <CustomersPage />;
    case "Support":
      return <SupportTicketsPage />;
    case "AI Providers":
      return <AIProvidersPage />;
    case "Ai Employees":
    case "My Ai Employees":
      return <AIManagementPage defaultTab="my-ai-agent" />;
    case "Tasks":
    case "My Tasks":
      return <AIManagementPage defaultTab="ai-tasks" />;
    case "Jobs":
    case "My Jobs":
      return <AIManagementPage defaultTab="ai-jobs" />;
    case "Marketplace":
    case "Job Marketplace":
      return <AIManagementPage defaultTab="ai-marketplace" />;
    case "Context Library":
      return <AIManagementPage defaultTab="ai-contexts" />;
    case "Integrations":
      return <AIManagementPage defaultTab="ai-integrations" />;
    case "Billing":
      // Billing hosts the pay-as-you-go wallet: top-up, credits,
      // payment methods, usage, and billing history. Kept visible
      // regardless of SUBSCRIPTIONS_ENABLED because users still need
      // to add credits to their wallet even in pure pay-as-you-go mode.
      return <AIManagementPage defaultTab="billing" />;
    case "Office Settings":
    case "Office Settings:invitees":
    case "Office Settings:pending-requests":
    case "Office Settings:coupons":
    case "Office Settings:domain":
    case "Office Settings:branding":
    // Team & Access is founder-only server-side (`requireOrgAdmin` on every
    // /rbac founder route); the page renders the 403 as a locked empty state.
    case "Office Settings:team-access":
      return <ManagementPage activePopover={val} setActivePopover={setActivePopover} />;
    // Whitelabel add-on checkout — entered from the sidebar's Earn
    // dropdown. Purchase is founder-only server-side; the page renders a
    // read-only explanation for everyone else.
    case "Whitelabel":
      return <WhitelabelPage setActivePopover={setActivePopover} />;
    case "Testimonials":
      return <TestimonialsPage />;
    case "Content Analytics":
      return <ContentAnalyticsPage />;
    case "Content Rewards":
    case "Clipping":
      return amIFounder ? <ContentRewardsPage /> : <ContentRewardsAffiliatePage />;
    // ========== Founder-specific views (management/admin) ==========
    case "Founder:Communities":
      return <ChannelsPage initialView="main" viewRole="founder" />;
    case "Founder:Communities:Orders":
      // All four founder Orders pages (Communities / Live Streams / Courses
      // / Digital Products) render the shared Bigin-style data grid,
      // founderGrid/orders/FounderOrdersTable — only `itemType` differs.
      // Same data as before: `/feed/founder/invoices?itemType=channel`.
      // Services + Calls still use OrdersPage: they show the founder's OWN
      // purchases, and the endpoint has no `service`/`call` itemType.
      return <FounderCommunityOrdersPage />;
    case "Founder:Communities:UnsubLog":
      // Founder-facing log of every ChannelMembershipEvent for
      // COMMUNITIES ONLY (channel unsubs). Workshop unsubs moved to
      // Founder:Live:UnsubLog. Fed by services/feed.ts:unsubscribeFromChannel
      // (writes an "unsubscribed" event) and the sweeper in index.ts
      // (writes an "expired" event at nextPaymentDate).
      return (
        <FounderUnsubLogPage
          itemKind="channel"
          itemLabel="Community"
          itemLabelPlural="Communities"
        />
      );
    case "Founder:Communities:Members":
      return <ChannelsPage initialView="members" viewRole="founder" />;
    case "Founder:Communities:Cabinet":
      return <FounderCabinetPage onClose={() => setActivePopover(previousPopover || null)} />;
    case "Founder:Live":
      return <WorkshopsPage initialTab="upcoming" viewRole="founder" />;
    case "Founder:Live:Attendees":
      return <WorkshopsPage initialTab="attendees" viewRole="founder" />;
    case "Founder:Live:Orders":
      // Per-item-type refactor 2026-07-11: was <OrdersPage initialType=
      // "workshop" hideTabs /> which showed the founder's OWN orders.
      // Now serves the org-wide view of every customer's workshop
      // invoice, backed by `/feed/founder/invoices?itemType=workshop`.
      return <FounderLiveOrdersPage />;
    case "Founder:Live:UnsubLog":
      return (
        <FounderUnsubLogPage
          itemKind="workshop"
          itemLabel="Live Stream"
          itemLabelPlural="Live Streams"
        />
      );

    case "Founder:Live:Recordings":
      return <RecordedLiveStreamPage viewRole="founder" />;
    case "Founder:Content:Videos":
      return <ContentPage initialSection="videos" viewRole="founder" />;
    case "Founder:Content:Drops":
      return <DropsPage initialTab="uploads" viewRole="founder" />;
    case "Founder:Content:Playlists":
      return <ContentPage initialSection="playlists" viewRole="founder" />;
    case "Founder:Content:Articles":
      return <ArticlesPage viewRole="founder" />;
    case "Founder:Content:Analytics":
      return <ContentAnalyticsPage />;
    case "Founder:Content:Rewards":
      return <ContentRewardsPage />;
    case "Founder:Courses":
      return <CoursesPage viewRole="founder" initialSection="courses" />;
    case "Founder:Courses:Students":
      return <CoursesPage viewRole="founder" initialSection="students" />;
    case "Founder:Courses:Orders":
      // Per-item-type refactor 2026-07-11 — see Founder:Communities:Orders.
      return <FounderCourseOrdersPage />;
    case "Founder:Courses:UnsubLog":
      // Courses have no cancel/unsub flow in the codebase today, so
      // the page shows an empty-state placeholder. The nav entry stays
      // for consistency across the four per-type sections; when a
      // cancel flow ships this page automatically starts populating.
      return (
        <FounderUnsubLogPage
          itemKind="course"
          itemLabel="Course"
          itemLabelPlural="Courses"
        />
      );
    case "Founder:Calls":
      return <CallsPage initialTab="calls" setActivePopover={setActivePopover} viewRole="founder" />;
    case "Founder:Calls:Customers":
      return <CallsPage initialTab="purchases" setActivePopover={setActivePopover} viewRole="founder" />;
    case "Founder:Calls:Purchases":
    case "Founder:Calls:Orders":
      return <OrdersPage initialType="call" hideTabs={true} />;
    case "Founder:Calls:Bookings":
      return <CallsPage initialTab="bookings" setActivePopover={setActivePopover} viewRole="founder" />;
    // Events module. `Founder:Events:Create` is an action, not a page — it
    // resolves to this same view with the create modal opened, exactly like
    // Communities / Products / Services.
    case "Founder:Events":
      return (
        <EventsApp
          onClose={() => setActivePopover(null)}
          showClose={false}
          onNavigatePopover={setActivePopover}
        />
      );
    // Attendee-facing Events. No founder controls — browse, buy, and see
    // what you bought.
    case "Events":
    case "Events:Discover":
      return <EventsBrowse onOpenPurchases={() => setActivePopover("Events:Purchases")} />;
    case "Events:Purchases":
      return <EventsPurchases onDiscover={() => setActivePopover("Events")} />;
    case "Founder:Products":
      return <ProductsPage initialTab="products" viewRole="founder" />;
    case "Founder:Products:Customers":
      // Renders the same buyers/customers roll-up the Orders page's Users
      // tab shows, but as a dedicated page (no Invoices toggle). Parity
      // with Community Members / Live Attendees / Course Students.
      return <FounderProductCustomersPage />;
    case "Founder:Products:Orders":
      // Per-item-type refactor 2026-07-11 — see Founder:Communities:Orders.
      return <FounderProductOrdersPage />;
    // Digital Products Unsub Log — commented out per founder request.
    // Re-enable this case + the sidebar/bottom-nav entries when refund
    // reporting is ready to surface. The BE route /feed/founder/product-
    // refunds and the FounderUnsubLogPage `product` branch are still
    // wired and functional, they just have no entry point in the nav.
    // case "Founder:Products:UnsubLog":
    //   return (
    //     <FounderUnsubLogPage
    //       itemKind="product"
    //       itemLabel="Digital Product"
    //       itemLabelPlural="Digital Products"
    //     />
    //   );
    case "Founder:Services":
      return <ServicesPage initialTab="services" viewRole="founder" />;
    case "Founder:Services:Customers":
      return <ServicesPage initialTab="optins" viewRole="founder" />;
    case "Founder:Services:Optins":
      return <ServicesPage initialTab="optins" viewRole="founder" />;
    case "Founder:Services:Orders":
      return <OrdersPage initialType="service" hideTabs={true} />;
    case "Profile":
      return <></>; // Profile is handled by ProfilePopover component
    case "Notifications":
    case "Notification":
      return <NotificationPage onClose={() => setActivePopover(previousPopover || null)} />;
    default:
      return <></>;
  }
}
