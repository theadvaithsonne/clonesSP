"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  isAuthenticated as checkWorkspaceAuth,
  getUserDataFromToken,
} from "@/lib/auth";
import GuestJoinFlow from "./GuestJoinFlow";
import {
  Building2,
  Sun,
  Moon,
  X,
  Menu,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";

interface GuestNavbarOrganization {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  branding?: {
    primaryColor?: string;
  };
}

interface NavItem {
  label: string;
  href: string;
}

interface OrgStatus {
  isMember: boolean;
  requestStatus: "pending" | "approved" | "rejected" | null;
  office_public?: boolean;
}

interface GuestNavbarProps {
  organization: GuestNavbarOrganization;
  slug: string;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  brandColor: string;
  /** Custom nav links (anchors like "#channels"). If omitted, all default links are shown as full URLs. */
  navItems?: NavItem[];
  /** Override: called when the CTA join/apply button is clicked. If omitted, navigates to office page. */
  onApplyClick?: () => void;
  /** Override: is the current user a member of this org */
  isMember?: boolean;
  /** Override: current join request status */
  requestStatus?: "pending" | "approved" | "rejected" | null;
  /** Override: is the org public */
  officePublic?: boolean;
  /** Override: has guest limit been reached */
  guestLimitReached?: boolean;
  /** Override: is the user authenticated */
  isAuthenticatedProp?: boolean;
  /** Override: guest email */
  guestEmailProp?: string | null;
  /** Override: is the user a workspace user */
  isWorkspaceUserProp?: boolean;
  /** Override: workspace org ID */
  workspaceOrgIdProp?: string | null;
  /** Override: is join in progress */
  joiningOrg?: boolean;
}

const defaultNavLinks: NavItem[] = [
  { label: "Communities", href: "#channels" },
  { label: "Live Streams", href: "#webinars" },
  { label: "Courses", href: "#courses" },
  { label: "1 on 1\u2019s", href: "#calls" },
  { label: "Digital Products", href: "#products" },
  { label: "Services", href: "#services" },
  { label: "Members", href: "#community" },
];

function getStatusBadge(status: "pending" | "approved" | "rejected") {
  const config = {
    pending: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      icon: <Clock className="h-3.5 w-3.5" />,
      label: "Pending Review",
    },
    approved: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: "Approved",
    },
    rejected: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/20",
      icon: <XCircle className="h-3.5 w-3.5" />,
      label: "Not Approved",
    },
  };

  const c = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

export default function GuestNavbar({
  organization,
  slug,
  theme,
  setTheme,
  brandColor,
  navItems,
  onApplyClick,
  isMember: isMemberProp,
  requestStatus: requestStatusProp,
  officePublic: officePublicProp,
  guestLimitReached: guestLimitProp,
  isAuthenticatedProp,
  guestEmailProp,
  isWorkspaceUserProp,
  workspaceOrgIdProp,
  joiningOrg: joiningOrgProp,
}: GuestNavbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [joinFlowOpen, setJoinFlowOpen] = useState(false);

  // Whether parent is managing state (GuestOfficePage passes overrides)
  const isManaged = onApplyClick !== undefined;

  // Preserve referCode across navigations
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";

  // ── Internal state (only used when NOT managed) ────────────────
  const [_isAuthenticated, _setIsAuthenticated] = useState(false);
  const [_guestEmail, _setGuestEmail] = useState<string | null>(null);
  const [_isWorkspaceUser, _setIsWorkspaceUser] = useState(false);
  const [_workspaceOrgId, _setWorkspaceOrgId] = useState<string | null>(null);
  const [_orgStatus, _setOrgStatus] = useState<OrgStatus | null>(null);
  const [_guestLimitReached, _setGuestLimitReached] = useState(false);

  const officeUrl = `/guest/${slug}${referSuffix}`;

  // Check auth state on mount (only when self-managed)
  useEffect(() => {
    if (isManaged) return;

    if (checkWorkspaceAuth()) {
      const userData = getUserDataFromToken();
      if (userData.userId && userData.email) {
        _setIsAuthenticated(true);
        _setIsWorkspaceUser(true);
        _setGuestEmail(userData.email);
        _setWorkspaceOrgId(userData.orgId);
        return;
      }
    }

    const storedUserId = localStorage.getItem("guest_user_id");
    const storedEmail = localStorage.getItem("guest_email");
    if (storedUserId && storedEmail) {
      _setIsAuthenticated(true);
      _setGuestEmail(storedEmail);
    }
  }, [isManaged]);

  // Fetch org membership status (only when self-managed)
  useEffect(() => {
    if (isManaged || !slug) return;

    async function fetchOrgStatus() {
      try {
        const storedUserId = localStorage.getItem("guest_user_id");
        let userId: string | null = null;

        if (checkWorkspaceAuth()) {
          const userData = getUserDataFromToken();
          userId = userData.userId;
        } else if (storedUserId) {
          userId = storedUserId;
        }

        const url = userId
          ? `/guest-auth/hq-by-slug/${slug}?userId=${userId}`
          : `/guest-auth/hq-by-slug/${slug}`;

        const response = await api<{
          ok: boolean;
          organization: {
            _id: string;
            isMember: boolean;
            requestStatus: "pending" | "approved" | "rejected" | null;
            office_public?: boolean;
          };
        }>(url, { method: "GET" });

        if (response.ok && response.organization) {
          _setOrgStatus({
            isMember: response.organization.isMember,
            requestStatus: response.organization.requestStatus,
            office_public: response.organization.office_public,
          });
        }
      } catch {
        // Silently fail
      }
    }

    async function checkGuestLimit() {
      try {
        const response = await api<{
          ok: boolean;
          limitReached: boolean;
        }>(`/guest-auth/guest-limit-status?orgId=${organization._id}`);

        if (response.ok) {
          _setGuestLimitReached(response.limitReached);
        }
      } catch {
        // Silently fail
      }
    }

    fetchOrgStatus();
    checkGuestLimit();
  }, [isManaged, slug, organization._id]);

  // ── Resolved values (use prop overrides or internal state) ─────
  const isAuthenticated = isManaged ? (isAuthenticatedProp ?? false) : _isAuthenticated;
  const guestEmail = isManaged ? (guestEmailProp ?? null) : _guestEmail;
  const isWorkspaceUser = isManaged ? (isWorkspaceUserProp ?? false) : _isWorkspaceUser;
  const workspaceOrgId = isManaged ? (workspaceOrgIdProp ?? null) : _workspaceOrgId;
  const requestStatus = isManaged ? (requestStatusProp ?? null) : (_orgStatus?.requestStatus ?? null);
  const officePublic = isManaged ? (officePublicProp ?? false) : (_orgStatus?.office_public ?? false);
  const guestLimitReached = isManaged ? (guestLimitProp ?? false) : _guestLimitReached;
  const joiningOrg = joiningOrgProp ?? false;

  const isMember = isManaged
    ? (isMemberProp ?? false)
    : (_orgStatus?.isMember || (_isWorkspaceUser && _workspaceOrgId === organization._id));

  // ── Fetch available sections (only when self-managed / detail pages) ──
  const [availableSections, setAvailableSections] = useState<NavItem[] | null>(null);

  useEffect(() => {
    if (navItems !== undefined || !slug) return;

    async function loadSections() {
      try {
        // Fetch items and calls in parallel
        const [itemsResponse, callsResponse] = await Promise.all([
          api<{
            ok: boolean;
            products?: any[];
            courses?: any[];
            workshops?: any[];
            channels?: any[];
            services?: any[];
            members?: any[];
          }>(`/guest-auth/hq-items/${slug}`, { method: "GET" }),
          organization._id
            ? api<{ success?: boolean; calls?: any[] }>(`/public/calls/${organization._id}`, { method: "GET" }).catch(() => ({ calls: [] as any[] }))
            : Promise.resolve({ calls: [] as any[] }),
        ]);

        if (itemsResponse.ok) {
          const items: NavItem[] = [];
          if ((itemsResponse.channels?.length ?? 0) > 0) items.push({ label: "Communities", href: "#channels" });
          if ((itemsResponse.workshops?.length ?? 0) > 0) items.push({ label: "Live Streams", href: "#webinars" });
          if ((itemsResponse.courses?.length ?? 0) > 0) items.push({ label: "Courses", href: "#courses" });
          if ((callsResponse.calls?.length ?? 0) > 0) items.push({ label: "1 on 1\u2019s", href: "#calls" });
          if ((itemsResponse.products?.length ?? 0) > 0) items.push({ label: "Digital Products", href: "#products" });
          if ((itemsResponse.services?.length ?? 0) > 0) items.push({ label: "Services", href: "#services" });
          items.push({ label: "Members", href: "#community" });
          setAvailableSections(items);
        }
      } catch {
        // Fallback to defaults on error
      }
    }

    loadSections();
  }, [navItems, slug, organization._id]);

  // ── Nav links ──────────────────────────────────────────────────
  // When navItems is provided (GuestOfficePage), use them as-is (anchor links).
  // When not provided (detail pages), build full URLs to the office page using fetched sections.
  const resolvedNavItems = navItems ?? availableSections ?? defaultNavLinks;
  const useAnchorLinks = navItems !== undefined;

  function handleCTAClick() {
    if (onApplyClick) {
      onApplyClick();
    } else {
      // Open join flow directly on this page
      setJoinFlowOpen(true);
    }
  }

  function handleJoinFlowStatusChange() {
    // Re-fetch org status and guest limit when join flow changes status
    if (!isManaged && slug) {
      (async () => {
        try {
          const storedUserId = localStorage.getItem("guest_user_id");
          let userId: string | null = null;
          if (checkWorkspaceAuth()) {
            const userData = getUserDataFromToken();
            userId = userData.userId;
          } else if (storedUserId) {
            userId = storedUserId;
          }
          const url = userId
            ? `/guest-auth/hq-by-slug/${slug}?userId=${userId}`
            : `/guest-auth/hq-by-slug/${slug}`;
          const response = await api<{
            ok: boolean;
            organization: {
              _id: string;
              isMember: boolean;
              requestStatus: "pending" | "approved" | "rejected" | null;
              office_public?: boolean;
            };
          }>(url, { method: "GET" });
          if (response.ok && response.organization) {
            _setOrgStatus({
              isMember: response.organization.isMember,
              requestStatus: response.organization.requestStatus,
              office_public: response.organization.office_public,
            });
          }
        } catch {}
      })();
    }
  }

  function renderNavLink(item: NavItem, mobile = false) {
    const mobileClass = `block w-full text-center px-6 py-4 rounded-xl text-lg font-medium transition-colors ${
      theme === "dark"
        ? "text-white hover:bg-zinc-800"
        : "text-zinc-900 hover:bg-zinc-100"
    }`;
    const desktopClass = `text-sm brand-hover ${
      theme === "dark" ? "text-zinc-400" : "text-zinc-600"
    } transition-colors`;

    if (useAnchorLinks) {
      return (
        <a
          key={item.href}
          href={item.href}
          onClick={mobile ? () => setIsMobileMenuOpen(false) : undefined}
          className={mobile ? mobileClass : desktopClass}
        >
          {item.label}
        </a>
      );
    }

    return (
      <a
        key={item.href}
        href={`${officeUrl}${item.href}`}
        onClick={mobile ? () => setIsMobileMenuOpen(false) : undefined}
        className={mobile ? mobileClass : desktopClass}
      >
        {item.label}
      </a>
    );
  }

  // ── Logo (shared between header and mobile overlay) ────────────
  function renderLogo(showNameOnMobile = false) {
    return (
      <>
        {organization.icon ? (
          <img
            src={organization.icon}
            alt={organization.name}
            className="h-9 w-9 rounded-lg object-cover"
          />
        ) : (
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: brandColor }}
          >
            <Building2 className="h-5 w-5 text-black" />
          </div>
        )}
        <span
          className={`font-semibold ${showNameOnMobile ? "" : "text-lg hidden sm:block"} ${
            theme === "dark" ? "text-white" : "text-zinc-900"
          }`}
        >
          {organization.name}
        </span>
      </>
    );
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 backdrop-blur-md border-b ${
          theme === "dark"
            ? "bg-zinc-900/80 border-zinc-800"
            : "bg-white/80 border-zinc-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Name */}
            {useAnchorLinks ? (
              <div className="flex items-center gap-3">
                {renderLogo()}
              </div>
            ) : (
              <Link href={officeUrl} className="flex items-center gap-3">
                {renderLogo()}
              </Link>
            )}

            {/* Nav Links - Hidden on mobile */}
            <nav className="hidden md:flex items-center gap-8">
              {resolvedNavItems.map((item) => renderNavLink(item))}
            </nav>

            {/* CTA Button */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle - Desktop only */}
              <button
                onClick={() =>
                  setTheme(theme === "dark" ? "light" : "dark")
                }
                className={`hidden md:block p-2 rounded-lg transition-colors ${
                  theme === "dark"
                    ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900"
                }`}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>

              {/* Auth badge */}
              {isAuthenticated && guestEmail && (
                <span className="hidden sm:inline-flex items-center gap-1.5 p-1.5 rounded-full text-sm font-medium bg-emerald-500 text-black relative cursor-default group/badge">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover/badge:opacity-100 transition-opacity duration-200 shadow-lg z-50">
                    {guestEmail}
                  </span>
                </span>
              )}

              {/* CTA: Status badge, Closed, or Join button */}
              {!isMember && (
                <>
                  {requestStatus ? (
                    getStatusBadge(requestStatus)
                  ) : guestLimitReached ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-zinc-800 text-zinc-500">
                      <XCircle className="h-4 w-4" />
                      Closed
                    </span>
                  ) : (
                    <Button
                      onClick={handleCTAClick}
                      disabled={joiningOrg}
                      className="text-black font-medium h-auto min-h-[40px] px-3 sm:px-5 py-2 rounded-full disabled:opacity-70 hover:opacity-90 max-w-[190px] sm:max-w-[240px] whitespace-normal text-center leading-tight text-xs sm:text-sm"
                      style={{ backgroundColor: brandColor }}
                    >
                      {joiningOrg ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {officePublic
                        ? `Join ${organization.name}'s Office`
                        : `Request To Join ${organization.name}`}
                      <ArrowLeft className="h-4 w-4 ml-2 rotate-180 flex-shrink-0" />
                    </Button>
                  )}
                </>
              )}

              {/* Member: Go to Workspace */}
              {isMember && (
                <Button
                  onClick={() => router.push("/workspace")}
                  className="text-black font-medium h-auto min-h-[40px] px-3 sm:px-5 py-2 rounded-full hover:opacity-90 max-w-[190px] sm:max-w-[240px] whitespace-normal text-center leading-tight text-xs sm:text-sm"
                  style={{ backgroundColor: brandColor }}
                >
                  Go To {organization.name}&apos;s Office
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180 flex-shrink-0" />
                </Button>
              )}

              {/* Hamburger Menu - Mobile only */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className={`md:hidden p-2 rounded-lg transition-colors ${
                  theme === "dark"
                    ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900"
                }`}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay - Full Screen */}
      {isMobileMenuOpen && (
        <div
          className={`fixed top-0 left-0 right-0 bottom-0 z-[9999] md:hidden ${
            theme === "dark" ? "bg-zinc-900" : "bg-white"
          }`}
          style={{ minHeight: "100dvh" }}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 h-16 border-b ${
              theme === "dark" ? "border-zinc-800" : "border-zinc-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {renderLogo(true)}
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className={`p-2 rounded-lg transition-colors ${
                theme === "dark"
                  ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  : "hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Nav Links - Centered */}
          <nav className="flex flex-col items-center justify-center px-6 py-8 space-y-2">
            {resolvedNavItems.map((item) => renderNavLink(item, true))}
          </nav>

          {/* Theme Toggle - Mobile */}
          <div className="flex justify-center">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                theme === "dark"
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  Dark Mode
                </>
              )}
            </button>
          </div>

          {/* CTA Button at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 p-6"
            style={{
              paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
            }}
          >
            {/* Auth badge on mobile */}
            {isAuthenticated && guestEmail && (
              <div className="flex items-center justify-center gap-2 mb-4 px-3 py-2 rounded-full bg-emerald-500 text-black text-sm font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{guestEmail}</span>
              </div>
            )}
            {isMember ? (
              <Button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  router.push("/workspace");
                }}
                className="w-full text-black font-semibold h-auto min-h-[56px] py-3 rounded-full text-base hover:opacity-90 whitespace-normal text-center leading-tight"
                style={{ backgroundColor: brandColor }}
              >
                Go To {organization.name}&apos;s Office
                <ArrowLeft className="h-5 w-5 ml-2 rotate-180 flex-shrink-0" />
              </Button>
            ) : !requestStatus && !guestLimitReached ? (
              <Button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleCTAClick();
                }}
                disabled={joiningOrg}
                className="w-full text-black font-semibold h-auto min-h-[56px] py-3 rounded-full text-base disabled:opacity-70 hover:opacity-90 whitespace-normal text-center leading-tight"
                style={{ backgroundColor: brandColor }}
              >
                {joiningOrg ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2 flex-shrink-0" />
                ) : null}
                {officePublic
                  ? `See ${organization.name}'s Office`
                  : `Request To Join ${organization.name}`}
                <ArrowRight className="h-5 w-5 ml-2 flex-shrink-0" />
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* GuestJoinFlow for self-managed mode (detail pages) */}
      {!isManaged && (
        <GuestJoinFlow
          organization={organization}
          slug={slug}
          brandColor={brandColor}
          isOpen={joinFlowOpen}
          onClose={() => setJoinFlowOpen(false)}
          onStatusChange={handleJoinFlowStatusChange}
        />
      )}
    </>
  );
}
