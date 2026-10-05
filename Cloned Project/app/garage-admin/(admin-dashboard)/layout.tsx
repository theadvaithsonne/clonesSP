"use client";

// Super-admin dashboard shell — matches Shorupan's Garage-Dashboard Figma:
//   • flat black chrome (no glass, no blobs)
//   • flush-left full-height sidebar, accordion groups (one open at a time),
//     text-only leaves with a thin left connector line, subtle rounded
//     "Users"-style active pill
//   • collapsed sidebar rail (60px) with hover flyout showing that group's
//     leaves — mirrors the NC sidebar-nav pattern
//   • dashboard-type switcher opens as a wide right-side sheet (not a
//     popup) with 4 cards (Admin / Support Agent / Garage Fulfillment /
//     NetworkChains), green-check on the selected one
// Non-super-admin viewers still get the legacy flat sidebar until their
// own translated design ships.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserPlus,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Settings,
  Mail,
  Settings2,
  Building2,
  Sparkles,
  Landmark,
  Wallet,
  ArrowUpRight,
  TicketPercent,
  Ticket,
  Percent,
  LifeBuoy,
  Crown,
  ShieldCheck,
  Search,
  Bot,
  BadgeCheck,
  Check,
  ChevronDown,
  Repeat2,
  KeyRound,
  PanelLeftClose,
  Menu,
  X,
  Tag,
  Radio,
  DollarSign,
  Bug,
  MonitorPlay,
  LineChart,
} from "lucide-react";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InviteAdminDialog from "@/components/garage-admin/InviteAdminDialog";
import {
  AdminVerifyGate,
  AdminVerifySkeleton,
} from "@/components/garage-admin/AdminVerifyGate";
import {
  getAdminVerifyChallenge,
  type AdminVerifyChallenge,
} from "@/lib/admin-api/admin-verify";
import {
  CitizensIcon,
  VaultsIcon,
  GaragePayIcon,
  PermissionsIcon,
  OthersIcon,
  MyCryptoOfficesIcon,
} from "@/components/garage-admin/sidebar-icons";
import { garageAdminApi } from "@/lib/api";
import {
  levelSatisfies,
  LEGACY_ADMIN_PERMISSIONS,
  landingPathForAdmin,
  SUPER_ADMIN_LANDING,
  type AdminPageLevel,
} from "@/lib/admin-api/permissions";
import { NC_FIRST_HREF } from "@/lib/nc-admin-first-route";
import {
  ContactsIcon,
  EarnGptIcon,
  AixonsIcon,
  CatchUpIcon,
  RevenueIcon,
  FunnelsIcon,
} from "@/components/nc-admin/nav-icons";

interface AdminInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Absent on info cached before page-RBAC shipped — treated as false. */
  isSuperAdmin?: boolean;
  /** Per-page levels. Ignored for super admins, who see everything. */
  permissions?: Record<string, AdminPageLevel>;
}

interface AdminDashboardLayoutProps {
  children: React.ReactNode;
}

// ── Dashboard types ────────────────────────────────────────────────────
// Four dashboards; only "admin" has content today, the rest render a
// coming-soon panel until their translated pages land. Choice persists.
type DashboardType = "admin" | "support" | "fulfillment" | "networkchains";

const DASHBOARD_TYPES: {
  id: DashboardType;
  label: string;
  icon: ComponentType<{ className?: string }>;
  ready: boolean;
}[] = [
  { id: "admin", label: "Admin", icon: BrandDot, ready: true },
  {
    id: "support",
    label: "Support Agent",
    icon: SupportAgentIcon,
    // Ready: it lands on the real /garage-admin/support dashboard (a route, so
    // the main column renders that page's content like any other admin page).
    ready: true,
  },
  {
    id: "fulfillment",
    label: "Garage Fulfillment",
    icon: FulfillmentIcon,
    ready: false,
  },
  {
    id: "networkchains",
    label: "NetworkChains",
    icon: NetworkChainsIcon,
    ready: true,
  },
];

// NetworkChains admin nav. NC's own sidebar (components/admin/admin-shell.tsx
// ADMIN_NAV in the NC repo) is a flat list of eleven top-level entries, each
// with its own icon — no accordion, no parent group. This mirrors that
// exactly rather than nesting them under one "NetworkChains" group, which
// would be a redesign of NC's own nav, not a port.
//
// These were superOnly while elevation required garage-super-admin. They are
// delegatable now: each carries its `networkchains`-group page key, so a role
// that is granted the page sees the entry and a role that is not never does.
// contacts-backend enforces the same grant on elevation.
const NC_NAV: NavLinkModel[] = [
  // Ordered to match NC's own sidebar (Users, EarnGPT, Offerings, Aixons,
  // Catch Up, Live Calls, Revenue, Funnels, AI Cost, Sentry, Replays).
  // Users is the first entry and is bound to NC_FIRST_HREF so the landing
  // route and the first entry can never drift apart.
  {
    kind: "link",
    key: "nc-users",
    label: "Users",
    href: NC_FIRST_HREF,
    icon: ContactsIcon,
    page: "nc_users",
  },
  {
    kind: "link",
    key: "nc-earngpt",
    label: "EarnGPT",
    href: "/garage-admin/networkchains/earngpt-learning",
    icon: EarnGptIcon,
    page: "nc_earngpt",
  },
  {
    kind: "link",
    key: "nc-offerings",
    label: "Offerings",
    href: "/garage-admin/networkchains/offerings",
    icon: Tag,
    page: "nc_offerings",
  },
  {
    kind: "link",
    key: "nc-aixons",
    label: "Aixons",
    href: "/garage-admin/networkchains/axons",
    icon: AixonsIcon,
    page: "nc_axons",
  },
  {
    kind: "link",
    key: "nc-catchup",
    label: "Catch Up",
    href: "/garage-admin/networkchains/meet",
    icon: CatchUpIcon,
    page: "nc_catchup",
  },
  {
    kind: "link",
    key: "nc-live-calls",
    label: "Live Calls",
    href: "/garage-admin/networkchains/meet/live",
    icon: Radio,
    page: "nc_live_calls",
  },
  {
    kind: "link",
    key: "nc-revenue",
    label: "Revenue",
    href: "/garage-admin/networkchains/subscriptions",
    icon: RevenueIcon,
    page: "nc_subscriptions",
  },
  {
    kind: "link",
    key: "nc-funnels",
    label: "Funnels",
    href: "/garage-admin/networkchains/funnels",
    icon: FunnelsIcon,
    page: "nc_funnels",
  },
  {
    kind: "link",
    key: "nc-ai-cost",
    label: "AI Cost",
    href: "/garage-admin/networkchains/ai-cost",
    icon: DollarSign,
    page: "nc_ai_cost",
  },
  {
    kind: "link",
    key: "nc-sentry",
    label: "Sentry",
    href: "/garage-admin/networkchains/sentry",
    icon: Bug,
    page: "nc_sentry",
  },
  {
    kind: "link",
    key: "nc-replays",
    label: "Replays",
    href: "/garage-admin/networkchains/posthog",
    icon: MonitorPlay,
    page: "nc_posthog",
  },
];

// The Garage Fulfillment brand mirrors the operator app's own nav
// (fulfillment.garage.app / garage-store-admin), but drives an embedded
// iframe rather than routing this app. Kept in this app so the admin panel
// supplies consistent sidebar chrome; the iframe renders each page in embed
// mode (?embed=1) so the fulfillment app's own sidebar stays hidden.
const FULFILLMENT_NAV: { title: string; items: { path: string; label: string }[] }[] = [
  {
    title: "Overview",
    items: [
      { path: "/home", label: "Home" },
      { path: "/analytics", label: "Analytics" },
    ],
  },
  {
    title: "Operations",
    items: [
      { path: "/orders", label: "All Purchases" },
      { path: "/warehouse/inbox", label: "Warehouse Inbox" },
      { path: "/warehouse/outbox", label: "Warehouse Outbox" },
      { path: "/warehouses", label: "Warehouses" },
    ],
  },
  {
    title: "Store",
    items: [
      { path: "/products", label: "Products" },
      { path: "/categories", label: "Categories" },
      { path: "/customers", label: "Customers" },
      { path: "/discounts", label: "Discounts" },
      { path: "/offers", label: "Offers" },
      { path: "/returns", label: "Returns" },
      { path: "/purchase-orders", label: "Purchase Orders" },
    ],
  },
  {
    title: "Content",
    items: [
      { path: "/blog", label: "Blog" },
      { path: "/pages", label: "Pages" },
      { path: "/menus", label: "Menus" },
    ],
  },
  {
    title: "Setup",
    items: [{ path: "/settings", label: "Settings" }],
  },
];

const DASHBOARD_STORAGE_KEY = "garage_admin_selected_dashboard";
const COLLAPSE_STORAGE_KEY = "garage_admin_sidebar_collapsed";
const OPEN_GROUP_STORAGE_KEY = "garage_admin_open_group";

/** Garage-Admin brand mark from Shorupan's Figma — a vertical yellow
 *  bar with three yellow dots (one left-bottom, two right-stacked).
 *  Inlined so it stays crisp at any size and doesn't flicker on load. */
function BrandDot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cx("h-4 w-auto", className)}
    >
      {/* fill="currentColor" so the parent can flip us yellow (active
          Select-Type row + header brand) or white (non-selected rows). */}
      <rect x="11.2499" y="0" width="5.92097" height="23.6839" fill="currentColor" />
      <circle cx="4.49007" cy="19.1938" r="4.49007" fill="currentColor" />
      <circle cx="24.3472" cy="4.97071" r="4.97069" fill="currentColor" />
      <circle cx="24.3472" cy="18.7132" r="4.97069" fill="currentColor" />
    </svg>
  );
}

/** Support-Agent icon — Figma-exported (a filled headset with a
 *  mic-boom endpoint). currentColor so the dashboard-type sheet's
 *  yellow accent flows through. */
function SupportAgentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 21 18"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M21 10.5885C21 13.4736 19.8559 16.0898 17.9991 18L14.6635 14.7273C14.0745 15.1032 13.1494 15.9198 11.6395 15.8311C11.5228 16.0347 11.2445 16.1776 10.9195 16.1776C10.4893 16.1776 10.1407 15.9268 10.1407 15.6173C10.1407 15.3082 10.4893 15.057 10.9195 15.057C11.2788 15.057 11.5812 15.2321 11.6705 15.4697C11.8071 15.4366 11.9409 15.3978 12.0729 15.3535C12.8318 15.099 13.5087 14.6657 14.0556 14.1021C14.9362 13.1972 15.4789 11.957 15.4789 10.5885C15.4789 7.81588 13.2494 5.56763 10.5 5.56763C7.75056 5.56763 5.5211 7.81588 5.5211 10.5885C5.5211 11.957 6.06376 13.1972 6.94444 14.1021L3.00086 18C1.14413 16.0898 0 13.4736 0 10.5885C0 4.74117 4.70108 0 10.5 0C16.2989 0 21 4.74117 21 10.5885Z" />
    </svg>
  );
}

/** Garage-Fulfillment icon — Figma-exported (a warehouse/dock silhouette
 *  with a peaked roof and stacked bays). */
function FulfillmentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 21 26"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.85608 0V3.2881L0 4.41374H0.00419475V26H20.9956V4.41374H21L19.1437 3.2881V0H1.85608ZM5.4983 24.3777H8.5395V21.1558H7.9038L8.39549 20.3401L8.5395 20.1008V16.6032H5.4983V21.8629L5.64267 22.1022L6.13416 22.918H5.4983V24.3777ZM2.01774 24.3777H5.05874V22.918H4.42304L4.91458 22.1022L5.05874 21.8629V20.0251H2.01774V24.3777ZM15.941 24.3777H18.9822V16.3502H15.941V17.9295L16.0854 18.1692L16.5767 18.9846H15.941V24.3777ZM12.4603 24.3777H15.5013V18.9846H14.8654L15.3568 18.1692L15.5013 17.9295V13.9736H12.4603V19.2284L12.6043 19.468L13.0957 20.284H12.4603V24.3777ZM8.97938 24.3777H12.0204V20.284H11.3847L11.8762 19.468L12.0204 19.2284V17.934H8.97938V20.1008L9.12355 20.3401L9.61508 21.1558H8.97938V24.3777ZM1.3377 4.41374L4.66787 2.39448L2.92024 0.857632H18.0795L16.3321 2.39448L19.6622 4.41374H1.3377ZM6.48121 5.7021C7.29431 5.7021 7.58907 6.73202 6.89796 7.13357V8.75974C6.89796 9.70149 7.30026 10.5577 7.9481 11.1791C9.35076 12.5234 11.649 12.5234 13.0515 11.1791C13.6995 10.5577 14.1016 9.70149 14.1016 8.75974V7.13357C13.4107 6.73202 13.7053 5.7021 14.5186 5.7021C15.3317 5.7021 15.6266 6.73202 14.9353 7.13357V8.75974C14.9353 9.92164 14.4395 10.9783 13.6409 11.7437C11.9129 13.4001 9.08704 13.4001 7.3589 11.7437C6.56014 10.9783 6.06441 9.92164 6.06441 8.75974V7.13357C5.37319 6.73202 5.66807 5.7021 6.48121 5.7021Z"
      />
    </svg>
  );
}

/** NetworkChains icon — Figma-exported (the NC "infinity-8" mark). */
function NetworkChainsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 13 30"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M7.28182 13.7012C7.36626 13.8327 7.45816 13.959 7.55688 14.0791C8.50395 15.0802 9.48229 16.0457 10.3946 17.0847C11.344 18.1592 12.0698 19.4312 12.5254 20.8189C13.6935 24.4014 12.2302 27.9414 9.20543 29.4122C7.37167 30.3052 5.49941 30.1535 3.73257 29.1417C2.02263 28.1627 0.917889 26.6415 0.43187 24.6468C-0.0457825 22.6822 0.309076 20.8507 1.28369 19.1324C1.92545 17.9988 2.75063 17.0141 3.66114 16.0341C3.97288 16.3888 4.27535 16.7319 4.57796 17.0769C4.82457 17.359 5.06295 17.648 5.3169 17.9225C5.47277 18.0907 5.45719 18.1989 5.31149 18.3844C4.71645 19.1422 4.07186 19.8747 3.58404 20.7038C2.83867 21.9747 2.72862 23.3373 3.40706 24.7154C4.10031 26.1244 5.79095 26.9382 7.25801 26.6811C9.63546 26.2626 10.8714 23.6495 9.77846 21.1658C9.16051 19.7625 8.21975 18.6155 7.19469 17.534C6.2063 16.4893 5.18587 15.4795 4.2204 14.4125C3.23291 13.3214 2.20321 12.2506 1.35332 11.0484C-1.5422 6.97395 0.418097 1.19089 5.24083 0.138461C6.89955 -0.219833 8.62545 0.123616 10.0461 1.09469C11.4667 2.06578 12.4682 3.58663 12.8344 5.32909C13.621 9.04981 11.526 12.4864 8.23713 13.4548C7.95023 13.5388 7.6614 13.6036 7.28182 13.7012ZM6.45665 10.8106C8.41231 10.9073 10.2414 9.13292 10.2461 6.88696C10.2555 6.09981 10.0428 5.32742 9.63521 4.66779C9.22757 4.00817 8.64335 3.49101 7.95641 3.18195C7.26947 2.87286 6.51096 2.7858 5.77704 2.93176C5.04313 3.07775 4.36687 3.45018 3.83413 4.00185C3.30139 4.55353 2.93597 5.25957 2.78448 6.03041C2.63285 6.80126 2.70197 7.6022 2.98295 8.3316C3.2638 9.06101 3.74403 9.68603 4.36249 10.1274C4.98096 10.5687 5.70973 10.8065 6.45665 10.8106Z" />
    </svg>
  );
}

export default function AdminDashboardLayout({
  children,
}: AdminDashboardLayoutProps) {
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // Step-up verification. `null` = not asked yet (the challenge call is in
  // flight), so the shell paints normally rather than flashing the gate at
  // every admin who will never see it.
  const [verifyChallenge, setVerifyChallenge] =
    useState<AdminVerifyChallenge | null>(null);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  /** Offices whose KYC packet is sitting in "submitted". Badges the nav so a
   *  reviewer sees there is work without opening the page. */
  const [pendingKyc, setPendingKyc] = useState(0);
  const [selectedDashboard, setSelectedDashboardState] =
    useState<DashboardType>("admin");
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Which accordion group is expanded. `null` = none. Active group's key
  // auto-fills this on first paint so the current section is visible.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Which fulfillment page the Garage Fulfillment brand's embed is showing.
  const [fulfillmentPath, setFulfillmentPath] = useState<string>("/home");
  const router = useRouter();
  const pathname = usePathname();
  const { query: search, setQuery: setSearch } = useAdminSearch();

  // Asked once per login: the answer re-mints the stored token with a
  // verified claim, so a refresh re-reads that token and the challenge
  // comes back `required: false`. A new login gets a fresh token without
  // the claim and is asked again.
  useEffect(() => {
    let cancelled = false;
    if (!localStorage.getItem("garage_admin_token")) return;
    getAdminVerifyChallenge().then((c) => {
      if (!cancelled) setVerifyChallenge(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    checkAuth();
    try {
      const stored = localStorage.getItem(DASHBOARD_STORAGE_KEY);
      if (stored && DASHBOARD_TYPES.some((d) => d.id === stored)) {
        // A stored "networkchains" is only meaningful on an NC route. On a
        // cold load anywhere else in /garage-admin, restoring it would leave
        // the NC-only sidebar over an Admin page — and an empty sidebar for
        // an admin holding no NC page at all. Correct it here,
        // at restore time: the pathname-keyed reset effect below cannot catch
        // this, because pathname never changes on a cold load.
        if (
          stored === "networkchains" &&
          !pathname.startsWith("/garage-admin/networkchains")
        ) {
          setSelectedDashboard("admin"); // persisting setter — localStorage must agree
        } else {
          setSelectedDashboardState(stored as DashboardType);
        }
      }
      const c = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (c === "1") setCollapsed(true);
      const og = localStorage.getItem(OPEN_GROUP_STORAGE_KEY);
      if (og) setOpenGroup(og);
    } catch {
      /* ignore */
    }
  }, []);

  // A deep link into /garage-admin/networkchains/* must show NC chrome even
  // when localStorage remembers "admin" from the last visit. Runs after the
  // localStorage restore effect above, so the URL wins — which is the intent.
  //
  // The inverse also has to hold: if the URL has left the NC section (e.g.
  // the header brand link back to /garage-admin/roles) but the type is
  // still "networkchains", the sidebar would otherwise keep rendering NC's
  // nav — and for an admin holding no NC page, it renders completely
  // empty. Reset through the persisting setter so
  // localStorage agrees with what's on screen. Only ever resets out of
  // "networkchains" — support/fulfillment selections are untouched.
  //
  // Deliberately keyed on `pathname` alone, not `selectedDashboard`: the
  // TypeSheet's onSelect already sets `selectedDashboard` synchronously,
  // one render before router.push's navigation actually lands. Depending
  // on `selectedDashboard` here would re-fire this effect on that
  // intermediate render — while the URL still hasn't caught up — and
  // immediately undo the switch into NetworkChains.
  useEffect(() => {
    if (pathname.startsWith("/garage-admin/networkchains")) {
      setSelectedDashboardState("networkchains");
    } else if (pathname.startsWith("/garage-admin/support")) {
      setSelectedDashboardState("support");
    } else if (
      selectedDashboard === "networkchains" ||
      selectedDashboard === "support"
    ) {
      setSelectedDashboard("admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (adminInfo?.role !== "garage-super-admin") return;
    let alive = true;
    import("@/lib/admin-api/withdrawals")
      .then((m) => m.getWithdrawalStats())
      .then((s) => {
        if (alive) setPendingWithdrawals(s.pending);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [adminInfo?.role, pathname]);

  // Re-counted on every navigation, like the withdrawals badge. Anyone who
  // can open the KYC page can see the count, so this is not super-only.
  useEffect(() => {
    if (!adminInfo) return;
    let alive = true;
    import("@/lib/admin-api/org-kyc")
      .then((m) => m.adminOrgKycApi.pendingCount())
      .then((n) => {
        if (alive) setPendingKyc(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [adminInfo, pathname]);

  const checkAuth = () => {
    const token = localStorage.getItem("garage_admin_token");
    const adminData = localStorage.getItem("garage_admin_info");
    if (!token || !adminData) {
      router.push("/garage-admin/login");
      return;
    }
    try {
      setAdminInfo(JSON.parse(adminData));
    } catch {
      router.push("/garage-admin/login");
      return;
    } finally {
      setLoading(false);
    }

    // The cached copy is what paints first, but it's also what a revoked
    // page would keep living in. Re-read the profile on every mount so a
    // permission change lands on the next navigation rather than the next
    // login. The backend gate is the real enforcement either way — this
    // only keeps the sidebar honest.
    garageAdminApi<{ data: AdminInfo }>("/garage-admin/profile", {
      method: "GET",
    })
      .then((res) => {
        if (!res?.data) return;
        setAdminInfo(res.data);
        try {
          localStorage.setItem(
            "garage_admin_info",
            JSON.stringify({
              ...res.data,
              // Keep the id key the rest of the console reads.
              id: (res.data as any).id,
            })
          );
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* stale cache still renders; the API gate still applies */
      });
  };

  const handleLogout = () => {
    localStorage.removeItem("garage_admin_token");
    localStorage.removeItem("garage_admin_info");
    router.push("/garage-admin/login");
  };

  const setSelectedDashboard = (id: DashboardType) => {
    setSelectedDashboardState(id);
    try {
      localStorage.setItem(DASHBOARD_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setOpenGroup((prev) => {
      const next = prev === key ? null : key;
      try {
        if (next) localStorage.setItem(OPEN_GROUP_STORAGE_KEY, next);
        else localStorage.removeItem(OPEN_GROUP_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#181818] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-dashed border-[#FBD10D]" />
          <p className="text-sm text-zinc-400">Loading Dashboard…</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = adminInfo?.role === "garage-super-admin";

  // Every leaf declares what it needs: a `page` key from the backend
  // catalogue, or `superOnly` for the surfaces that are never delegatable
  // (money out, vaults, OTP codes, admin management). Super admins see the
  // full tree; everyone else sees only what their role holds.
  const allGroups: NavGroupModel[] = [
    {
      kind: "group",
      key: "analytics",
      title: "Analytics",
      icon: LineChart,
      items: [
        // Paid sales per buyer per IST day. Registered in the backend
        // catalogue as `daily_reports`, so it is delegatable (view) unlike
        // the two chart pages below.
        {
          label: "Daily Reports",
          href: "/garage-admin/daily-reports",
          page: "daily_reports",
        },
        // Live analytics (components/analytics/* + /garage-admin/analytics/*).
        // No `page` permission key exists in the backend catalogue for these
        // yet, so they stay super-admin only until one is registered — same
        // as Rank Bonus below. The gate agrees: an unmapped /garage-admin
        // path is super-only by default.
        {
          label: "Traction",
          href: "/garage-admin/analytics/traction",
          superOnly: true,
        },
        {
          label: "Subscriptions",
          href: "/garage-admin/analytics/subscriptions",
          superOnly: true,
        },
      ],
    },
    {
      kind: "group",
      key: "citizens",
      title: "Citizens",
      icon: CitizensIcon,
      items: [
        { label: "Users", href: "/garage-admin/users", page: "users" },
        {
          // Purpose-built page (Figma frame 77:3) — everyone who bought
          // the $25 Unilevel Plus license, whether or not they later
          // became an active NC subscriber. The legacy
          // /garage-admin/unilevel-plus-licenses page stays reachable
          // by URL for now but is no longer sidebar-linked.
          label: "One Time Affiliates",
          href: "/garage-admin/one-time-affiliates",
          page: "one_time_affiliates",
        },
        {
          label: "NetworkChain Subs",
          href: "/garage-admin/networkchain-subs",
          page: "networkchain_subs",
        },
        // Monthly Bronze→Platinum rank bonus: who qualified, what it cost,
        // and per-person detail on why they hold the rank they do.
        {
          label: "Rank Bonus",
          href: "/garage-admin/rank-bonus",
          superOnly: true,
        },
        { label: "Founders", href: "/garage-admin/founders", page: "founders" },
        {
          label: "Companies",
          href: "/garage-admin/companies",
          page: "organizations",
          // Its sub-paths are separate entries below, not detail pages.
          exact: true,
        },
        // Split of the table above by office plan. Same page and same API
        // permission ("organizations"), so a role that can see Companies sees
        // both. Every company appears in exactly one of the two.
        {
          label: "Paid Companies",
          href: "/garage-admin/companies/paid",
          page: "organizations",
        },
        {
          label: "Free Companies",
          href: "/garage-admin/companies/free",
          page: "organizations",
        },
        {
          label: "All Organizations",
          href: "/garage-admin/organizations",
          page: "organizations",
        },
        // Office KYC — request identity documents from an office, review
        // what the founder uploads, verify. Its own page permission
        // ("org_kyc"), deliberately NOT part of "organizations": handing
        // someone an office listing is not the same as handing them
        // founders' PAN cards.
        {
          label: "Office KYC",
          href: "/garage-admin/kyc",
          page: "org_kyc",
          badge: pendingKyc || undefined,
        },
        {
          label: "Unilevel Plus Licenses",
          href: "/garage-admin/unilevel-plus-licenses",
          page: "unilevel_plus_licenses",
        },
        // Org taxonomy — CRUD on the category picker shown to
        // founders on office creation + ManageOrg edit. Slotted here
        // since it manages a per-Organization attribute.
        {
          label: "Categories",
          href: "/garage-admin/categories",
          page: "categories",
        },
      ],
    },
    {
      kind: "group",
      key: "vaults",
      title: "Vaults",
      icon: VaultsIcon,
      items: [
        // Figma renames — same pages that already existed under the old
        // Wallets / User Wallets labels. Kept the underlying routes so
        // no in-page code has to move.
        // Labels were swapped: /wallets is the org Aivatar (AI) wallet
        // manager, /user-wallets is the broad user×wallet list — so the
        // AI page is "Ai Vaults" and the all-encompassing one is "All Vaults".
        // Vaults move real money, so the whole group is super-admin only
        // and has no page key a role could be granted.
        {
          label: "Ai Vaults",
          href: "/garage-admin/wallets",
          superOnly: true,
        },
        {
          label: "All Vaults",
          href: "/garage-admin/user-wallets",
          superOnly: true,
        },
        {
          label: "Withdrawals",
          href: "/garage-admin/withdrawals",
          badge: pendingWithdrawals || undefined,
          superOnly: true,
        },
        // Sweeper — manual consolidation of settled crypto deposits
        // (BSC / Polygon / Ethereum / Bitcoin / Tron) into the
        // treasury hot wallet. Detection is automatic on the backend;
        // this tab exists only for the on-chain move step. Money-
        // adjacent, so super-admin only.
        {
          label: "Sweeper",
          href: "/garage-admin/sweeper",
          superOnly: true,
        },
      ],
    },
    {
      kind: "group",
      key: "garagepay",
      title: "GaragePay",
      icon: GaragePayIcon,
      items: [
        {
          // Changing the platform's cut is a super-admin decision.
          label: "Processing Fees",
          href: "/garage-admin/platform-fees",
          superOnly: true,
        },
        {
          label: "Coupons",
          href: "/garage-admin/platform-coupons",
          page: "platform_coupons",
        },
        {
          // Pays out of the platform store wallet on every referred signup,
          // with no per-payout approval. Same reasoning as Processing Fees:
          // super-admin only.
          label: "Referral Bonus",
          href: "/garage-admin/referral-bonus",
          superOnly: true,
        },
      ],
    },
    {
      // Admin management and the permission system itself. Delegating any
      // of this would let a role widen its own access, so both leaves are
      // super-admin only and neither has a page key.
      kind: "group",
      key: "permissions",
      title: "Permissions",
      icon: PermissionsIcon,
      items: [
        // One dedicated destination: invite/give admins a role + per-action
        // access AND define role templates, both on /garage-admin/roles.
        {
          label: "Roles & Access",
          href: "/garage-admin/roles",
          superOnly: true,
        },
        { label: "Invitees", href: "/garage-admin/invitees", superOnly: true },
      ],
    },
    {
      kind: "group",
      key: "others",
      title: "Others",
      icon: OthersIcon,
      items: [
        // Dialogs/banners shown to every visitor and every logged-in user, so
        // authoring is never delegated — same reasoning as the OTP pages below.
        {
          label: "Alerts & Promotions",
          href: "/garage-admin/announcements",
          superOnly: true,
        },
        {
          label: "Ai Providers",
          href: "/garage-admin/ai-providers",
          page: "ai_providers",
        },
        {
          label: "Coworking Spaces",
          href: "/garage-admin/coworking-spaces",
          page: "coworking_spaces",
        },
        {
          label: "Notifications",
          href: "/garage-admin/notifications",
          page: "admin_notifications",
        },
        {
          label: "Support Tickets",
          href: "/garage-admin/tickets",
          page: "support_tickets",
        },
        // Every active admin is a participant in every support chat, so this is
        // gated on the session alone (everyAdmin), not a delegatable page.
        {
          label: "Support Chats",
          href: "/garage-admin/support-chats",
          everyAdmin: true,
        },
        // Reading a live OTP is log-in-as-anyone, so both OTP pages stay
        // super-admin only and are absent from the delegatable catalogue.
        {
          label: "OTP Codes",
          href: "/garage-admin/otp-codes",
          superOnly: true,
        },
        // SMS verification codes, split out from the email ones so the phone
        // number is the thing you read rather than an address.
        {
          label: "Phone OTPs",
          href: "/garage-admin/phone-otp-codes",
          superOnly: true,
        },
      ],
    },
    {
      // Offices where Organization.officeCreatedFromCryptobrand === true.
      // Drills: offices → members → per-user multi-currency wallets +
      // manual admin top-ups (USD parent + INR / ETH / BTC siblings).
      kind: "group",
      key: "cryptobrand",
      title: "My Crypto Offices",
      icon: MyCryptoOfficesIcon,
      items: [
        {
          label: "My Crypto Offices",
          href: "/garage-admin/cryptobrand-offices",
          page: "store_wallets",
        },
      ],
    },
  ];

  // A leaf is visible if the admin is super, or holds at least "view" on
  // the page it maps to. superOnly leaves have no page key at all, so no
  // permission map can ever satisfy them. NetworkChains leaves are page-keyed
  // like any other, so a role granted `nc_*` pages sees exactly those.
  // An admin_info cached before this feature has no permissions key. The
  // profile refetch above is about to fill it in; until it lands, use the
  // same legacy default the backend applies so the sidebar doesn't blink
  // empty for someone who has always had those five pages.
  const effectivePermissions =
    adminInfo?.permissions ?? LEGACY_ADMIN_PERMISSIONS;

  // A leaf and a top-level link share the same permission shape
  // (superOnly / page), so one check serves both — canSeeLeaf is kept as
  // the name since it's the pre-existing, already-reviewed function; it now
  // also runs on NavLinkModel entries, which are structurally identical here.
  // The App Store review account must never see support chats — the backend
  // 403s it on every support-chats endpoint, so the page would only error.
  const APPLE_REVIEW_EMAIL = "applereview@yopmail.com";
  const canSeeLeaf = (leaf: NavLeaf) => {
    // everyAdmin is checked before the super-admin short-circuit so the review
    // account is excluded even if it were ever elevated.
    if (leaf.everyAdmin) return adminInfo?.email !== APPLE_REVIEW_EMAIL;
    if (isSuperAdmin) return true;
    if (leaf.superOnly || !leaf.page) return false;
    return levelSatisfies(effectivePermissions[leaf.page], "view");
  };

  // Whether to offer the NetworkChains dashboard type at all. Derived from
  // the nav rather than from the role: NC_NAV is page-keyed now, so "can see
  // at least one NC page" is exactly the condition under which the sidebar
  // would render something. Super admins pass via canSeeLeaf's short-circuit.
  // contacts-backend applies the same rule when minting the NC token, so this
  // hides a card that would otherwise lead to a 401.
  const canSeeNetworkChains = NC_NAV.some(canSeeLeaf);

  // NetworkChains has its own flat nav (NC_NAV — eleven top-level links, no
  // group) instead of the Citizens / Vaults / etc. groups the "admin"
  // dashboard type uses — selecting the dashboard type also selects which
  // source list feeds the sidebar. allGroups stays NavGroupModel[] here,
  // completely unchanged from before this port: the group render path below
  // never sees a link and never branches on `selectedDashboard`.
  const sourceGroups: NavEntry[] =
    selectedDashboard === "networkchains" ? NC_NAV : allGroups;

  const groups: NavEntry[] = sourceGroups
    .map((e) =>
      e.kind === "group" ? { ...e, items: e.items.filter(canSeeLeaf) } : e
    )
    .filter((e) => (e.kind === "group" ? e.items.length > 0 : canSeeLeaf(e)));

  // Direct-URL guard. The API gate is what actually protects the data —
  // this just avoids rendering a page that will only ever show errors.
  // Flatten every group's items plus every top-level link into one list of
  // hrefs, then prefer the LONGEST matching href — isLeafActive prefix-matches
  // (`/networkchains/meet` is itself a prefix of `/networkchains/meet/live`),
  // so without this, "Catch Up" and "Live Calls" would both resolve active on
  // the Live Calls route. That was already true when both were leaves in one
  // group; now that they're both top-level rows it would be far more visible,
  // so it's fixed here rather than carried forward. Admin's own leaves never
  // share overlapping href prefixes, so this is a no-op for that path — it
  // still lands on the single leaf `.find` used to return.
  const flatEntries: NavLeaf[] = sourceGroups.flatMap((e) =>
    e.kind === "group" ? e.items : [e]
  );
  const activeLeaf = flatEntries
    .filter((leaf) => isLeafActive(pathname, leaf))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const blocked = !!activeLeaf && !canSeeLeaf(activeLeaf);

  const activeGroupKey = groups.find(
    (e) => e.kind === "group" && e.items.some((i) => isLeafActive(pathname, i))
  )?.key;

  // Which group is currently "open" (expanded). Falls back to the active
  // group so the user's current section is always visible on first paint.
  // Top-level links never open/close (they have no accordion body), so this
  // persisted state is untouched by the new link entries.
  const effectiveOpenGroup =
    openGroup ?? activeGroupKey ?? null;

  const selectedMeta =
    DASHBOARD_TYPES.find((d) => d.id === selectedDashboard) ??
    DASHBOARD_TYPES[0];

  // While this is true the chrome is blurred and inert and the page itself
  // is swapped for a skeleton. The backend refuses every admin route in
  // this state regardless — the overlay is the way to get past it, not the
  // lock.
  const mustVerify = !!verifyChallenge?.required;

  // A fixed-height shell (not min-h-screen): the header and sidebar stay
  // put while only <main> scrolls. With min-h-screen the shell grew with
  // its content, so main's overflow-y-auto never engaged, the window
  // scrolled instead, and the sidebar scrolled out of view with it.
  return (
    <>
    <div
      className={cx(
        "flex h-[100dvh] flex-col overflow-hidden bg-[#181818] text-white",
        mustVerify && "pointer-events-none select-none blur-[6px]",
      )}
      aria-hidden={mustVerify || undefined}
    >
      {/* ═════════ HEADER ═════════
          Search sits in an absolutely-positioned wrapper so it stays
          centered against the viewport regardless of how wide the left
          brand cluster or the right invite/pill cluster grow. */}
      <header className="sticky top-0 z-40 flex h-[66px] shrink-0 items-center gap-4 border-b border-white/[0.06] bg-[#181818] px-4 md:px-5">
        {/* Brand + collapse toggle. When collapsed we swap to a pure
            hamburger ☰ per Frame 7 in the Figma. */}
        <div className="flex shrink-0 items-center gap-3">
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              className="flex h-8 w-8 items-center justify-center rounded text-zinc-200 hover:bg-white/[0.05] hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : (
            <>
              <Link
                href={isSuperAdmin ? SUPER_ADMIN_LANDING : "/garage-admin/roles"}
                className="flex items-center gap-2"
              >
                <BrandDot className="h-5 w-auto text-[#FBD10D]" />
                <span className="text-[16px] font-semibold tracking-tight text-white">
                  {selectedMeta.label}
                </span>
              </Link>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Collapse sidebar"
                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-white/[0.05] hover:text-white"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Absolutely-centered search — anchored to viewport center */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden w-full max-w-[464px] -translate-x-1/2 -translate-y-1/2 md:block">
          <div className="pointer-events-auto relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              placeholder="Search Anything.."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-full border border-white/[0.06] bg-[#0f0f0f] pl-11 pr-4 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-white/[0.12] focus:bg-[#141414]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right pill (avatar + name + role) */}
        <div className="ml-auto flex items-center gap-2">
          {/* Inviting admins is super-admin only — the endpoint rejects
              anyone else, so don't offer the button. */}
          {isSuperAdmin && (
            <InviteAdminDialog>
              <Button
                size="sm"
                className="hidden h-9 rounded-full bg-[#FBD10D] px-4 text-black hover:bg-[#f5c800] md:inline-flex"
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                Invite Admin
              </Button>
            </InviteAdminDialog>
          )}
          <RolePill
            adminInfo={adminInfo}
            selected={selectedDashboard}
            onOpenSheet={() => setTypeSheetOpen((v) => !v)}
            open={typeSheetOpen}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* ═════════ BODY ═════════ */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside
          className={cx(
            "shrink-0 border-r border-white/[0.06] bg-[#181818] transition-[width] duration-200 ease-out",
            collapsed ? "w-[60px]" : "w-[246px]"
          )}
        >
          <nav
            className={cx(
              "flex h-full flex-col overflow-y-auto overflow-x-visible py-3 scrollbar-hide",
              collapsed ? "items-center gap-1 px-2" : "gap-1 px-3"
            )}
          >
            {selectedMeta.ready ? (
              collapsed ? (
                groups.map((e) =>
                  e.kind === "group" ? (
                    <CollapsedGroupRail
                      key={e.key}
                      group={e}
                      pathname={pathname}
                    />
                  ) : (
                    <CollapsedLinkRail
                      key={e.key}
                      entry={e}
                      pathname={pathname}
                    />
                  )
                )
              ) : (
                groups.map((e) =>
                  e.kind === "group" ? (
                    <ExpandedGroup
                      key={e.key}
                      group={e}
                      pathname={pathname}
                      expanded={effectiveOpenGroup === e.key}
                      onToggle={() => toggleGroup(e.key)}
                    />
                  ) : (
                    <ExpandedLink key={e.key} entry={e} pathname={pathname} />
                  )
                )
              )
            ) : selectedDashboard === "fulfillment" && !collapsed ? (
              // Native admin sidebar for the embedded fulfillment app: each
              // item swaps the iframe's page rather than routing this app.
              <FulfillmentNav
                current={fulfillmentPath}
                onSelect={setFulfillmentPath}
              />
            ) : null}
          </nav>
        </aside>

        {/* MAIN COLUMN */}
        <main className="relative flex-1 overflow-y-auto">
          {!selectedMeta.ready ? (
            // Garage Fulfillment is the existing operator app at
            // fulfillment.garage.app (repo: garage-store-admin). Rather than
            // re-port 22 pages from a Next-16/React-19 app into this Next-15
            // panel — different stack, its own auth and backend — the brand
            // embeds that app whole, so all its pages (with its own sidebar)
            // live inside Garage Fulfillment. It carries its own login; a
            // token handoff for single-sign-on can come later.
            selectedDashboard === "fulfillment" ? (
              <FulfillmentEmbed path={fulfillmentPath} />
            ) : (
              <DashboardComingSoon meta={selectedMeta} />
            )
          ) : mustVerify ? (
            // Never render the real page behind the glass: it would fire
            // API calls the backend is refusing, and a blur doesn't stop
            // the DOM underneath from being read.
            <AdminVerifySkeleton />
          ) : blocked ? (
            <NoAccessPanel label={activeLeaf?.label} />
          ) : (
            // Content padding: 32px horizontal + 28px top + 32px bottom.
            // space-y-6 gives every direct child a consistent 24px gap so
            // pages that return a `<>` fragment (stats row + cards, no
            // wrapping div) automatically breathe between rows.
            <div className="space-y-6 px-8 pb-8 pt-7">{children}</div>
          )}
        </main>

        {/* SELECT TYPE — wide right-side sheet (~495px). Sits above the
            main column; clicking outside closes it. */}
        <TypeSheet
          open={typeSheetOpen}
          onClose={() => setTypeSheetOpen(false)}
          selected={selectedDashboard}
          canSeeNetworkChains={canSeeNetworkChains}
          onSelect={(id) => {
            setSelectedDashboard(id);
            setTypeSheetOpen(false);
            // The type is no longer client-only state: NC pages live at real
            // routes, so switching has to move the URL too. Without this a
            // refresh would land on an Admin route while showing NC chrome.
            if (id === "networkchains") {
              router.push(NC_FIRST_HREF);
            } else if (id === "support") {
              router.push("/garage-admin/support");
            } else if (
              pathname.startsWith("/garage-admin/networkchains") ||
              pathname.startsWith("/garage-admin/support")
            ) {
              // The super-admin landing is Analytics/Traction, which a delegated
              // admin can't open. Route through the same landing-page picker
              // login/accept-invite use so they land somewhere they can view.
              landingPathForAdmin(adminInfo || {}).then((path) =>
                router.push(path)
              );
            }
          }}
        />
      </div>

      {/* Legacy hidden invite trigger — pages still use
          document.querySelector("[data-invite-admin-trigger]") to open. */}
      {isSuperAdmin && (
        <InviteAdminDialog>
          <button data-invite-admin-trigger className="hidden" />
        </InviteAdminDialog>
      )}
    </div>

    {mustVerify && verifyChallenge && (
      <AdminVerifyGate
        challenge={verifyChallenge}
        adminName={adminInfo?.name}
        adminEmail={adminInfo?.email}
        // Reload rather than just dropping the overlay: hooks that fired
        // while the gate was up got 403s and cached them, and every one of
        // them has to re-ask with the newly verified token.
        onVerified={() => window.location.reload()}
      />
    )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Nav model + shared helpers
   ═══════════════════════════════════════════════════════════════════════ */

type NavLeaf = {
  label: string;
  href: string;
  badge?: number;
  /** Page key from the backend catalogue this leaf needs "view" on. */
  page?: string;
  /** Never delegatable — super admins only, no permission unlocks it. */
  superOnly?: boolean;
  /**
   * Visible to EVERY signed-in admin, with no page permission — the inverse of
   * `superOnly`. Support Chats uses this: every active admin is a participant
   * in every support chat, so the backend gates it on the session alone. The
   * App Store review account is still excluded (see canSeeLeaf).
   */
  everyAdmin?: boolean;
  /**
   * Highlight only on this exact path, not on sub-paths. Needed when a
   * sub-path is its OWN sidebar entry (Companies vs Paid/Free Companies):
   * the default prefix match exists for detail pages like /users/[userId],
   * and would otherwise light up the parent alongside the child.
   */
  exact?: boolean;
};
type NavGroupModel = {
  /** Discriminant — narrows `NavEntry` reliably under this repo's
   *  `strict: false` tsconfig (a boolean-literal-typed field would not). */
  kind: "group";
  key: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: NavLeaf[];
};
/** A single top-level sidebar row with its own icon — no accordion, no
 *  nested items. Used by NetworkChains' flat nav (NC_NAV): NC's own sidebar
 *  has no group headers at all, so its entries render at the same level as
 *  the Admin dashboard's group headers, not nested inside one. */
type NavLinkModel = {
  kind: "link";
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  superOnly?: boolean;
  page?: string;
  badge?: number;
  /** Same as NavLeaf.exact. Kept on both so the two shapes stay compatible
   *  where they are flattened into one list (the direct-URL guard). */
  exact?: boolean;
  /** Same as NavLeaf.everyAdmin — kept on both for the same reason as exact. */
  everyAdmin?: boolean;
};
type NavEntry = NavGroupModel | NavLinkModel;

function isLeafActive(pathname: string, leaf: NavLeaf) {
  if (leaf.exact) return pathname === leaf.href;
  return pathname === leaf.href || pathname.startsWith(leaf.href + "/");
}

function groupHasActive(pathname: string, group: NavGroupModel) {
  return group.items.some((l) => isLeafActive(pathname, l));
}

/** Tiny classname joiner. */
function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════════════════════════════════
   Expanded sidebar — group header (accordion trigger) + leaves list
   ═══════════════════════════════════════════════════════════════════════ */

function ExpandedGroup({
  group,
  pathname,
  expanded,
  onToggle,
}: {
  group: NavGroupModel;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = group.icon;
  const hasActive = groupHasActive(pathname, group);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cx(
          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] font-semibold transition-colors",
          hasActive ? "text-white" : "text-zinc-200 hover:text-white"
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-[#FBD10D]" />
        <span className="flex-1 text-left">{group.title}</span>
        <ChevronDown
          className={cx(
            "h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Accordion body — stays mounted, animates max-height + opacity */}
      <div
        className={cx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="ml-3 mt-0.5 mb-1 flex flex-col border-l border-white/[0.08] pl-1">
          {group.items.map((l) => (
            <LeafRow key={l.href} leaf={l} pathname={pathname} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LeafRow({
  leaf,
  pathname,
}: {
  leaf: NavLeaf;
  pathname: string;
}) {
  const active = isLeafActive(pathname, leaf);
  return (
    <Link
      href={leaf.href}
      className={cx(
        "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors",
        active
          ? "bg-[#1a1a1a] text-white"
          : "text-zinc-400 hover:bg-white/[0.03] hover:text-white"
      )}
    >
      <span className="flex-1 truncate">{leaf.label}</span>
      {typeof leaf.badge === "number" && leaf.badge > 0 && (
        <span className="rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#FBD10D]">
          {leaf.badge}
        </span>
      )}
    </Link>
  );
}

/** A top-level nav link (NetworkChains' flat rows). Sits at the same level as
 *  a group header — same padding/icon slot/font-weight as ExpandedGroup's
 *  trigger button — but uses the leaf's own active-pill treatment
 *  (bg-[#1a1a1a] on active) since a link has no accordion body to visually
 *  separate it from. No new colours or spacing are introduced. */
function ExpandedLink({
  entry,
  pathname,
}: {
  entry: NavLinkModel;
  pathname: string;
}) {
  const Icon = entry.icon;
  const active = isLeafActive(pathname, entry);
  return (
    <Link
      href={entry.href}
      className={cx(
        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] font-semibold transition-colors",
        active
          ? "bg-[#1a1a1a] text-white"
          : "text-zinc-200 hover:bg-white/[0.03] hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-[#FBD10D]" />
      <span className="flex-1 truncate text-left">{entry.label}</span>
      {typeof entry.badge === "number" && entry.badge > 0 && (
        <span className="rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#FBD10D]">
          {entry.badge}
        </span>
      )}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Collapsed sidebar rail — icon per group, hover flyout showing leaves.
   Flyout is `fixed` (coords captured on hover) so the nav's scroll can't
   clip it; kept as a DOM child of the rail item so cursor→flyout doesn't
   fire mouseleave.
   ═══════════════════════════════════════════════════════════════════════ */

function CollapsedGroupRail({
  group,
  pathname,
}: {
  group: NavGroupModel;
  pathname: string;
}) {
  const Icon = group.icon;
  const hasActive = groupHasActive(pathname, group);
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const onEnter = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top, left: r.right });
    setHovered(true);
  };

  const totalBadge = group.items.reduce(
    (n, i) => n + (i.badge || 0),
    0
  );

  return (
    <div
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={() => setHovered(false)}
      className="relative flex w-full justify-center"
    >
      <button
        type="button"
        title={group.title}
        className={cx(
          "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors",
          hasActive
            ? "bg-white/[0.06] text-[#FBD10D]"
            : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        {totalBadge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FBD10D] ring-2 ring-[#181818]" />
        )}
      </button>

      {hovered && (
        <div
          className="fixed z-[60] pl-3"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="min-w-[220px] rounded-xl border border-white/[0.08] bg-[#0e0e12] p-2 shadow-xl shadow-black/50">
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <Icon className="h-4 w-4 text-[#FBD10D]" />
              <span className="text-[13px] font-semibold text-white">
                {group.title}
              </span>
            </div>
            <div className="mt-1 flex flex-col">
              {group.items.map((l) => {
                const active = isLeafActive(pathname, l);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setHovered(false)}
                    className={cx(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                      active
                        ? "bg-white/[0.06] text-white"
                        : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <span className="flex-1 truncate">{l.label}</span>
                    {typeof l.badge === "number" && l.badge > 0 && (
                      <span className="rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#FBD10D]">
                        {l.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Collapsed rail for a top-level link — same wrapper, button sizing, and
 *  active/hover treatment as CollapsedGroupRail's icon button (including the
 *  native `title` tooltip), just without a hover flyout: a link has no child
 *  items to show, so clicking the icon navigates directly instead. */
function CollapsedLinkRail({
  entry,
  pathname,
}: {
  entry: NavLinkModel;
  pathname: string;
}) {
  const Icon = entry.icon;
  const active = isLeafActive(pathname, entry);

  return (
    <div className="relative flex w-full justify-center">
      <Link
        href={entry.href}
        title={entry.label}
        className={cx(
          "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors",
          active
            ? "bg-white/[0.06] text-[#FBD10D]"
            : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        {typeof entry.badge === "number" && entry.badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FBD10D] ring-2 ring-[#181818]" />
        )}
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Role pill (top-right) — opens the Select Type sheet from the sheet
   button; dropdown menu is retained for profile/settings/logout only.
   ═══════════════════════════════════════════════════════════════════════ */

function RolePill({
  adminInfo,
  selected,
  onOpenSheet,
  open,
  onLogout,
}: {
  adminInfo: AdminInfo | null;
  selected: DashboardType;
  onOpenSheet: () => void;
  open: boolean;
  onLogout: () => void;
}) {
  const initials = (
    adminInfo?.name?.trim().slice(0, 1) ||
    adminInfo?.email?.slice(0, 1) ||
    "?"
  ).toUpperCase();
  const selectedMeta =
    DASHBOARD_TYPES.find((d) => d.id === selected) ?? DASHBOARD_TYPES[0];
  const SelectedIcon = selectedMeta.icon;

  return (
    <div className="flex h-11 items-center gap-3 rounded-full border border-white/[0.06] bg-[#0f0f0f] pl-1.5 pr-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-[#1a1a22] text-xs font-medium text-zinc-200">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="hidden max-w-[120px] truncate text-sm font-medium text-zinc-100 sm:inline">
        {adminInfo?.name?.split(" ")[0] || "Admin"}
      </span>
      <span className="hidden h-4 w-px bg-white/[0.1] sm:inline-block" />
      <button
        type="button"
        onClick={onOpenSheet}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-200 hover:text-white"
      >
        <SelectedIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{selectedMeta.label}</span>
        <ChevronDown
          className={cx(
            "h-3.5 w-3.5 text-zinc-500 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="ml-1 rounded p-1 text-zinc-500 hover:text-white"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-52 border-white/[0.08] bg-[#0e0e12] text-zinc-200"
        >
          <div className="px-2 py-1.5 text-xs">
            <div className="truncate font-medium text-white">
              {adminInfo?.name || "—"}
            </div>
            <div className="truncate text-zinc-500">{adminInfo?.email}</div>
          </div>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem className="cursor-pointer focus:bg-white/[0.05]">
            <User className="mr-2 h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer focus:bg-white/[0.05]">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem
            onClick={onLogout}
            className="cursor-pointer text-red-400 focus:bg-white/[0.05] focus:text-red-300"
          >
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Select Type — wide right-side sheet (~495px). Click-outside + Esc close.
   Slides from the right edge of the main column, no dimming overlay,
   matches the Figma spec exactly.
   ═══════════════════════════════════════════════════════════════════════ */

function TypeSheet({
  open,
  onClose,
  selected,
  onSelect,
  canSeeNetworkChains,
}: {
  open: boolean;
  onClose: () => void;
  selected: DashboardType;
  onSelect: (id: DashboardType) => void;
  /** Whether any NetworkChains page is granted. An admin with none would
   *  land on a fully empty NoAccessPanel sidebar, so hide the card for them;
   *  admin/support/fulfillment stay visible to everyone. */
  canSeeNetworkChains: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Use capture + a tiny delay so the same click that opens the sheet
    // doesn't immediately close it.
    const t = window.setTimeout(
      () => window.addEventListener("mousedown", onDown, true),
      0
    );
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  return (
    <div
      ref={ref}
      aria-hidden={!open}
      className={cx(
        "absolute inset-y-0 right-0 z-30 w-full max-w-[520px] border-l border-white/[0.06] bg-[#181818] shadow-2xl shadow-black/60 transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex h-full flex-col p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Select Type</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {DASHBOARD_TYPES.filter(
            (d) => d.id !== "networkchains" || canSeeNetworkChains
          ).map((d) => {
            const Icon = d.icon;
            const active = d.id === selected;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d.id)}
                className={cx(
                  "flex h-[63px] items-center gap-4 rounded-xl border px-5 text-left transition-colors",
                  active
                    ? "border-white/[0.14] bg-[#141414] text-white"
                    : "border-white/[0.06] bg-[#0d0d0d] text-zinc-300 hover:border-white/[0.12] hover:bg-[#121212] hover:text-white"
                )}
              >
                <Icon
                  className={cx(
                    "h-5 w-5 shrink-0",
                    active ? "text-[#FBD10D]" : "text-white"
                  )}
                />
                <span className="flex-1 text-[15px] font-medium">
                  {d.label}
                </span>
                {active && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-black">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The Garage Fulfillment operator app (fulfillment.garage.app), embedded a
 *  page at a time and driven by the admin sidebar. `?embed=1` hides the
 *  fulfillment app's own chrome so only the page content shows inside the
 *  admin panel. Fills the main column (which is `relative`) edge to edge.
 *
 *  Keyed on `path` so switching pages remounts the iframe at the new URL —
 *  simpler and more reliable than reaching into the frame to navigate it. */
const FULFILLMENT_ORIGIN = "https://fulfillment.garage.app";

function FulfillmentEmbed({ path }: { path: string }) {
  const src = `${FULFILLMENT_ORIGIN}${path}?embed=1`;
  return (
    <iframe
      key={path}
      src={src}
      title="Garage Fulfillment"
      className="absolute inset-0 h-full w-full border-0"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  );
}

/** The Garage Fulfillment brand's sidebar — the operator app's own nav,
 *  rendered with this panel's styling so it reads as one product. Selecting
 *  an item swaps the embedded page rather than routing the admin app. */
function FulfillmentNav({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="space-y-5">
      {FULFILLMENT_NAV.map((section) => (
        <div key={section.title}>
          <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {section.title}
          </div>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = current === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => onSelect(item.path)}
                  className={cx(
                    "block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors",
                    active
                      ? "bg-[#FBD10D]/10 text-[#FBD10D]"
                      : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-page placeholder shown when a not-yet-built dashboard type is
 *  selected from the top-right sheet. */
function DashboardComingSoon({
  meta,
}: {
  meta: (typeof DASHBOARD_TYPES)[number];
}) {
  const Icon = meta.icon;
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-12 text-center">
      <div className="mb-5 rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/10 p-4">
        <Icon className="h-8 w-8 text-[#FBD10D]" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-white">
        {meta.label} Dashboard
      </h2>
      <p className="max-w-md text-sm text-zinc-400">
        This dashboard is being built. Switch back to <strong>Admin</strong>{" "}
        from the top-right pill. Your last selection is remembered next visit.
      </p>
    </div>
  );
}

/** Shown when an admin lands on a page their role doesn't hold. The API
 *  gate is the real enforcement — this is just a sane thing to render
 *  instead of a page full of 403s. */
function NoAccessPanel({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-12 text-center">
      <div className="mb-5 rounded-full border border-white/[0.08] bg-white/[0.03] p-4">
        <ShieldCheck className="h-8 w-8 text-zinc-400" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-white">
        No access to {label || "this section"}
      </h2>
      <p className="max-w-md text-sm text-zinc-400">
        Your role doesn&apos;t include this page. Ask a super admin to grant
        it from Permissions → Roles &amp; Access.
      </p>
    </div>
  );
}
