"use client";

import { useState, useEffect } from "react";
import {
  X,
  Mail,
  MapPin,
  Building2,
  Users,
  UserPlus,
  Calendar,
  ChevronRight,
  Loader2,
  Search,
  Copy,
  Check,
  Clock,
  Hash,
  ArrowLeft,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  AffiliateUser,
  AffiliateOffice,
  DirectChildrenResponse,
  UserInfoResponse,
  getLocationString,
} from "./types";

interface AffiliateProfileOverlayProps {
  userId: string;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
}

type TabType = "details" | "downlines";

export function AffiliateProfileOverlay({
  userId,
  onClose,
  onViewProfile,
}: AffiliateProfileOverlayProps) {
  const [currentUserId, setCurrentUserId] = useState<string>(userId);
  const [history, setHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [user, setUser] = useState<AffiliateUser | null>(null);
  const [downlines, setDownlines] = useState<AffiliateUser[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingDownlines, setIsLoadingDownlines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downlineSearch, setDownlineSearch] = useState("");
  const [copiedField, setCopiedField] = useState<"name" | "affiliate" | "email" | null>(null);

  // Sync currentUserId and reset history when the prop userId changes from outside
  useEffect(() => {
    setCurrentUserId(userId);
    setHistory([]);
  }, [userId]);

  // Reset downlines search and tab on currentUserId changes
  useEffect(() => {
    setDownlines([]);
    setActiveTab("details");
    setDownlineSearch("");
  }, [currentUserId]);

  const handleNavigate = (newId: string) => {
    setHistory((prev) => [...prev, currentUserId]);
    setCurrentUserId(newId);
  };

  const handleGoBack = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prevUserId = newHistory.pop()!;
    setHistory(newHistory);
    setCurrentUserId(prevUserId);
  };

  /**
   * Hands an office off to the Grow Your Network panel with its lobby already
   * picked, instead of printing a link to copy here.
   *
   * No affiliate id is sent: the panel is the viewer's own share panel, so it
   * falls back to the viewer's code. The office only decides which lobby the
   * link points at, never who gets credited for it.
   */
  const handleGrowNetwork = (office: AffiliateOffice) => {
    // The right panel is desktop-only (`hidden md:contents` in the dashboard
    // layout), so below that breakpoint this has to go to the dialog the mobile
    // footer button opens instead — same links, different surface.
    const isDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches;

    window.dispatchEvent(
      isDesktop
        ? new CustomEvent("right-panel:open-information", {
            detail: {
              type: "grow_network",
              growNetwork: {
                kind: "hq",
                hqSlug: office.slug,
                hqLabel: office.name,
              },
            },
          })
        : new CustomEvent("open:guest-funnel", {
            detail: {
              orgSlug: office.slug,
              orgName: office.name,
              orgId: office.orgId,
            },
          })
    );
    // The overlay sits over both surfaces, so leaving it open would hide the
    // thing this button just opened.
    onClose();
  };

  const handleCopyText = async (text: string, field: "name" | "affiliate" | "email") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const filteredDownlines = downlines.filter((d) =>
    d.name.toLowerCase().includes(downlineSearch.toLowerCase())
  );

  // Fetch user details
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoadingUser(true);
      setError(null);
      try {
        const orgId = localStorage.getItem("garage_org_id");
        const response = await api<UserInfoResponse>(
          `/affiliate/user-info/${currentUserId}${orgId ? `?orgId=${orgId}` : ""}`
        );
        if (response.success && response.user) {
          const validOffices = (response.user.offices || []).filter(
            (o) =>
              o &&
              o.name &&
              typeof o.name === "string" &&
              o.name.trim() !== "" &&
              o.name.toLowerCase() !== "unknown" &&
              o.name.toLowerCase() !== "unknown organization"
          );
          setUser({
            ...response.user,
            offices: validOffices,
            officesJoined: validOffices.length,
            hasChildren: response.user.directReferrals > 0,
          });
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError("Failed to load user profile");
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUser();
  }, [currentUserId]);

  // Fetch downlines when tab changes to "downlines"
  useEffect(() => {
    if (activeTab === "downlines" && downlines.length === 0 && user?.hasChildren) {
      const fetchDownlines = async () => {
        setIsLoadingDownlines(true);
        try {
          const orgId = localStorage.getItem("garage_org_id");
          const response = await api<DirectChildrenResponse>(
            `/affiliate/direct-children/${currentUserId}${orgId ? `?orgId=${orgId}` : ""}`
          );
          if (response.success) {
            setDownlines(
              response.children.map((child) => ({
                ...child,
                hasChildren: child.directReferrals > 0,
              }))
            );
          }
        } catch (err) {
          console.error("Error fetching downlines:", err);
        } finally {
          setIsLoadingDownlines(false);
        }
      };

      fetchDownlines();
    }
  }, [activeTab, currentUserId, downlines.length, user?.hasChildren]);

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[950]"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[420px] z-[1000] shadow-2xl animate-slide-in-right flex flex-col overflow-hidden border-l border-white/[0.06] bg-[#0c0c0e]">
        {/* Back Button */}
        {history.length > 0 && (
          <button
            onClick={handleGoBack}
            className="absolute top-4 left-4 z-10 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-white/10 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>

        {/* Content */}
        {isLoadingUser ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
            <p className="text-xs text-zinc-500">Loading profile...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <X className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        ) : user ? (
          <>
            {/* Hero Header */}
            <div className="relative flex-shrink-0">
              {/* Gradient Banner */}
              <div className="h-28 bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10" />
              </div>

              {/* Avatar */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-12">
                <div className="relative">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-[88px] h-[88px] rounded-full object-cover ring-4 ring-[#0c0c0e] shadow-lg shadow-brand/10"
                    />
                  ) : (
                    <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] flex items-center justify-center text-zinc-950 text-3xl font-bold ring-4 ring-[#0c0c0e] shadow-lg shadow-brand/20">
                      {user.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div
                    className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-[3px] border-[#0c0c0e] ${user.status === "active" ? "bg-emerald-400" : "bg-zinc-600"
                      }`}
                  />
                </div>
              </div>
            </div>

            {/* Name & Badges */}
            <div className="pt-14 pb-4 px-6 text-center flex-shrink-0 flex flex-col items-center">
              <div className="flex items-center justify-center gap-1.5 max-w-full group/name">
                <h3 className="text-lg font-semibold text-white truncate">
                  {user.name}
                </h3>
                <button
                  type="button"
                  onClick={() => handleCopyText(user.name, "name")}
                  className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all flex-shrink-0 opacity-40 group-hover/name:opacity-100 focus:opacity-100 active:scale-90"
                  title="Copy Name"
                >
                  {copiedField === "name" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    user.guest
                      ? "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/20"
                      : user.userType === "founder"
                        ? "bg-brand/15 text-brand ring-1 ring-brand/20"
                        : "bg-brand/15 text-brand ring-1 ring-brand/20"
                  }`}
                >
                  {user.guest
                    ? "Guest"
                    : user.userType === "founder"
                      ? "Founder"
                      : "Stakeholder"}
                </span>
                {user.affiliateId && (
                  <button
                    type="button"
                    onClick={() => handleCopyText(user.affiliateId!, "affiliate")}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-500 bg-zinc-800/60 ring-1 ring-zinc-700/30 hover:bg-zinc-700/80 hover:text-zinc-300 active:scale-95 transition-all group"
                    title="Copy Affiliate ID"
                  >
                    <Hash className="w-2.5 h-2.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                    <span>{user.affiliateId}</span>
                    {copiedField === "affiliate" ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Pill Tabs */}
            <div className="px-4 pb-3 flex-shrink-0">
              <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-lg">
                <button
                  onClick={() => setActiveTab("details")}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all duration-200 ${activeTab === "details"
                    ? "bg-zinc-700/80 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab("downlines")}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all duration-200 ${activeTab === "downlines"
                    ? "bg-zinc-700/80 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                  Downlines ({user.directReferrals})
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {activeTab === "details" ? (
                <div className="space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <StatCard
                      icon={<UserPlus className="w-3.5 h-3.5" />}
                      label="Referrals"
                      value={user.directReferrals.toString()}
                      color="emerald"
                    />
                    <StatCard
                      icon={<Users className="w-3.5 h-3.5" />}
                      label="Downline"
                      value={(user.totalReferrals ?? 0).toString()}
                      color="amber"
                    />
                    <StatCard
                      icon={<Clock className="w-3.5 h-3.5" />}
                      label="Joined"
                      value={getTimeAgo(user.joinedAt)}
                      color="amber"
                    />
                  </div>

                  {/* Offices Founded */}
                  {user.offices &&
                    user.offices.filter((o) => o.role === "founder").length > 0 && (
                      <div className="space-y-1.5">
                        <SectionLabel>
                          Offices Founded
                          <span className="ml-1.5 text-[10px] text-zinc-600 font-normal">
                            {user.offices.filter((o) => o.role === "founder").length}
                          </span>
                        </SectionLabel>
                        <div className="space-y-2">
                          {user.offices
                            .filter((o) => o.role === "founder")
                            .map((office) => (
                              <OfficeCard
                                key={office.orgId}
                                office={office}
                                onGrowNetwork={handleGrowNetwork}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Contact */}
                  <div className="space-y-1.5">
                    <SectionLabel>Contact</SectionLabel>
                    <div className="rounded-xl bg-zinc-800/30 ring-1 ring-white/[0.04] divide-y divide-white/[0.04] overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-white/[0.02] transition-colors group/row">
                        <a
                          href={`mailto:${user.email}`}
                          className="flex items-center gap-3 flex-1 min-w-0"
                        >
                          <Mail className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                          <span className="text-xs text-zinc-300 truncate hover:text-white transition-colors">
                            {user.email}
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopyText(user.email, "email");
                          }}
                          className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 opacity-40 group-hover/row:opacity-100 focus:opacity-100 transition-opacity"
                          title="Copy Email"
                        >
                          {copiedField === "email" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 px-3.5 py-2.5">
                        <MapPin className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        <span className="text-xs text-zinc-300">
                          {getLocationString(user.location)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 px-3.5 py-2.5">
                        <Calendar className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        <span className="text-xs text-zinc-300">
                          {formatDate(user.joinedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Offices Joined */}
                  {user.offices && user.offices.length > 0 && (
                    <div className="space-y-1.5">
                      <SectionLabel>
                        Offices Joined
                        <span className="ml-1.5 text-[10px] text-zinc-600 font-normal">
                          {user.offices.length}
                        </span>
                      </SectionLabel>
                      <div className="space-y-2">
                        {user.offices.map((office) => (
                          <OfficeCard
                            key={office.orgId}
                            office={office}
                            onGrowNetwork={handleGrowNetwork}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Referrer */}
                  {user.referrer && (
                    <div className="space-y-1.5">
                      <SectionLabel>Referred By</SectionLabel>
                      <div
                        onClick={() => handleNavigate(user.referrer!.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800/30 ring-1 ring-white/[0.04] hover:ring-brand/20 hover:bg-zinc-800/50 transition-all group cursor-pointer"
                      >
                        {user.referrer.avatar ? (
                          <img
                            src={user.referrer.avatar}
                            alt={user.referrer.name}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] flex items-center justify-center text-brand-foreground text-sm font-medium ring-1 ring-white/10 shrink-0">
                            {user.referrer.name?.charAt(0) || "?"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
                          <div className="flex items-center gap-1.5 group/name">
                            <span className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors truncate">
                              {user.referrer.name}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(user.referrer!.name, "name");
                              }}
                              className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all flex-shrink-0 opacity-40 group-hover/name:opacity-100 focus:opacity-100 active:scale-90"
                              title="Copy Name"
                            >
                              {copiedField === "name" ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          {user.referrer.email && (
                            <div className="flex items-center gap-1.5 group/email">
                              <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors truncate">
                                {user.referrer.email}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(user.referrer!.email!, "email");
                                }}
                                className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all flex-shrink-0 opacity-40 group-hover/email:opacity-100 focus:opacity-100 active:scale-90"
                                title="Copy Email"
                              >
                                {copiedField === "email" ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-brand transition-colors shrink-0" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Downlines Tab */
                <div>
                  {isLoadingDownlines ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-brand animate-spin" />
                    </div>
                  ) : downlines.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-zinc-600" />
                      </div>
                      <p className="text-sm text-zinc-500">No downlines yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Search downlines..."
                          value={downlineSearch}
                          onChange={(e) => setDownlineSearch(e.target.value)}
                          className="w-full pl-8 pr-8 py-2 bg-zinc-800/30 ring-1 ring-white/[0.04] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-brand/30 transition-all"
                        />
                        {downlineSearch && (
                          <button
                            onClick={() => setDownlineSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-700 rounded-sm transition-colors"
                          >
                            <X className="w-3 h-3 text-zinc-400" />
                          </button>
                        )}
                      </div>

                      {/* List */}
                      {filteredDownlines.length === 0 ? (
                        <div className="text-center py-8">
                          <Search className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
                          <p className="text-xs text-zinc-500">No results</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {filteredDownlines.map((downline) => (
                            <button
                              key={downline.id}
                              onClick={() => handleNavigate(downline.id)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/20 ring-1 ring-transparent hover:ring-white/[0.06] hover:bg-zinc-800/40 transition-all group"
                            >
                              {downline.avatar ? (
                                <img
                                  src={downline.avatar}
                                  alt={downline.name}
                                  className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] flex items-center justify-center text-brand-foreground text-xs font-medium ring-1 ring-white/10">
                                  {downline.name?.charAt(0) || "?"}
                                </div>
                              )}
                              <div className="flex-1 text-left min-w-0">
                                <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                                  {downline.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] text-zinc-600">
                                    {downline.directReferrals} referrals
                                  </span>
                                  <span
                                    className={`inline-block w-1.5 h-1.5 rounded-full ${downline.status === "active"
                                      ? "bg-emerald-400"
                                      : "bg-zinc-600"
                                      }`}
                                  />
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

/* ---- Sub-components ---- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-0.5">
      {children}
    </h4>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "emerald" | "purple" | "amber";
}) {
  const colors = {
    emerald: {
      iconBg: "bg-emerald-500/10",
      iconText: "text-emerald-400",
      ring: "ring-emerald-500/10",
    },
    purple: {
      iconBg: "bg-brand/10",
      iconText: "text-brand",
      ring: "ring-brand/10",
    },
    amber: {
      iconBg: "bg-brand/10",
      iconText: "text-brand",
      ring: "ring-brand/10",
    },
  };

  const c = colors[color];

  return (
    <div className={`p-3 rounded-xl bg-zinc-800/30 ring-1 ${c.ring} space-y-2`}>
      <div
        className={`w-7 h-7 rounded-lg ${c.iconBg} flex items-center justify-center ${c.iconText}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function OfficeCard({
  office,
  onGrowNetwork,
}: {
  office: AffiliateOffice;
  onGrowNetwork: (office: AffiliateOffice) => void;
}) {
  // The card used to print www.garage.app/hq/<slug>?ref=<id> with a copy
  // button. Sharing now goes through Grow Your Network instead, which builds
  // the same link for this office but also carries the QR, the share sheet and
  // the other landing pages — and keeps one place responsible for what a share
  // link looks like.
  return (
    <div className="p-3 rounded-xl bg-zinc-800/30 ring-1 ring-white/[0.04] space-y-2">
      <div className="flex items-center gap-3">
        {office.icon ? (
          <img
            src={office.icon}
            alt={office.name}
            className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center ring-1 ring-white/10">
            <Building2 className="w-4 h-4 text-zinc-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">
            {office.name}
          </p>
          <p className="text-[10px] text-zinc-500 capitalize">
            {office.guest ? "Guest" : office.role}
          </p>
        </div>
      </div>

      {office.slug && (
        <button
          type="button"
          onClick={() => onGrowNetwork(office)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-700/30 hover:bg-zinc-700/50 ring-1 ring-white/[0.04] hover:ring-brand/20 transition-all group cursor-pointer"
        >
          <TrendingUp className="w-3.5 h-3.5 text-zinc-500 group-hover:text-brand flex-shrink-0 transition-colors" />
          <span className="flex-1 text-[11px] font-medium text-zinc-300 group-hover:text-white text-left transition-colors">
            Grow Your Network
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-brand flex-shrink-0 transition-colors" />
        </button>
      )}
    </div>
  );
}
