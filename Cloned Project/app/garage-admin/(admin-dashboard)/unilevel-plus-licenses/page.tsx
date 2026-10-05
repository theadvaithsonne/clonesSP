"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { invoiceUrl } from "@/lib/admin-domain";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crown,
  Ticket,
  Archive,
  DollarSign,
  Building2,
  Search,
  Users,
  Send,
  Copy,
  SlidersHorizontal,
  X,
  UserCheck,
  UserX,
  Trophy,
  Receipt,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface OfficeMembership {
  id: string;
  name: string;
  icon?: string | null;
  role: "founder" | "stakeholder";
  fullAccess: boolean;
  joinedAt: string;
}

interface UplineInfo {
  id: string;
  name: string | null;
  email: string | null;
}

interface PurchaseTimelineEntry {
  date: string;
  type: "purchased" | "reserve";
}

interface LicenseHolder {
  id: string;
  name: string | null;
  email: string | null;
  profilePicture?: string | null;
  createdAt: string;
  country: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  upline: UplineInfo | null;
  licensesPurchased: number;
  licensesInReserve: number;
  licensesAssigned: number;
  licensesExpired: number;
  totalSpent: number;
  currency: string;
  firstPurchasedAt: string;
  purchaseTimeline: PurchaseTimelineEntry[];
  totalDirects: number;
  directsWithLicense: number;
  directsWithoutLicense: number;
  fourLicenseMilestoneDate: string | null;
  organizations: OfficeMembership[];
  paymentHistory: PaymentHistoryEntry[];
}

interface PaymentHistoryEntry {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  paymentCurrency: string;
  paymentMethod: string | null;
  paymentPlatform: string | null;
  paidAt: string;
  invoiceUrl: string | null;
  couponCode: string | null;
  discount: number;
  quantity: number;
}

interface Filters {
  purchasedRange: string;
  reserveRange: string;
  assignedRange: string;
  registrationFrom: string;
  registrationTo: string;
  purchaseDateFrom: string;
  purchaseDateTo: string;
  country: string;
  uplineId: string;
}

const EMPTY_FILTERS: Filters = {
  purchasedRange: "",
  reserveRange: "",
  assignedRange: "",
  registrationFrom: "",
  registrationTo: "",
  purchaseDateFrom: "",
  purchaseDateTo: "",
  country: "",
  uplineId: "",
};

const NUMERIC_BUCKETS = [
  { label: "Any", value: "" },
  { label: "0", value: "0-0" },
  { label: "1–5", value: "1-5" },
  { label: "6–10", value: "6-10" },
  { label: "11–20", value: "11-20" },
  { label: "21–50", value: "21-50" },
  { label: "51+", value: "51-Infinity" },
];

const ASSIGNED_BUCKETS = [
  { label: "Any", value: "" },
  { label: "0", value: "0-0" },
  { label: "1–5", value: "1-5" },
  { label: "3", value: "3-3" },
  { label: "6–10", value: "6-10" },
  { label: "11–20", value: "11-20" },
  { label: "21–50", value: "21-50" },
  { label: "51+", value: "51-Infinity" },
];

const matchesBucket = (value: number, bucket: string): boolean => {
  if (!bucket) return true;
  const [minStr, maxStr] = bucket.split("-");
  const min = Number(minStr);
  const max = maxStr === "Infinity" ? Infinity : Number(maxStr);
  return value >= min && value <= max;
};

const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `$${(amount || 0).toFixed(0)}`;
  }
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

const initialOf = (h: LicenseHolder) =>
  (h.name?.trim()?.[0] || h.email?.trim()?.[0] || "?").toUpperCase();

export default function UnilevelPlusLicensesPage() {
  const [holders, setHolders] = useState<LicenseHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Shared header search — filters this table (debounced). Backend for
  // /unilevel-plus-license-holders lives in garageAdmin.ts (owned elsewhere),
  // so the whole dataset is fetched once and filtered client-side here rather
  // than via a ?q= server param.
  const { query: headerSearch } = useAdminSearch();
  const [debouncedHeaderSearch, setDebouncedHeaderSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHeaderSearch(headerSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [headerSearch]);

  const updateFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((v) => v !== "").length;
  }, [filters]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await garageAdminApi<{ data: LicenseHolder[] }>(
          "/garage-admin/unilevel-plus-license-holders",
          { method: "GET" }
        );
        setHolders(res?.data || []);
      } catch (err) {
        console.error("Error loading license holders:", err);
        toast.error("Failed to load Unilevel Plus license holders");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Close filter panel when clicking outside
  // Must ignore Radix portaled elements (Select dropdowns render outside the ref)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Ignore clicks inside the panel ref
      if (filterPanelRef.current?.contains(target)) return;
      // Ignore clicks on Radix portaled dropdowns (rendered outside the DOM tree)
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      setFiltersOpen(false);
    };
    if (filtersOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filtersOpen]);

  const stats = useMemo(() => {
    const totalHolders = holders.length;
    const totalActive = holders.reduce(
      (sum, h) => sum + (h.licensesPurchased || 0),
      0
    );
    const totalReserve = holders.reduce(
      (sum, h) => sum + (h.licensesInReserve || 0),
      0
    );
    const totalLicenses = totalActive + totalReserve;
    const totalRevenue = holders.reduce(
      (sum, h) => sum + (h.totalSpent || 0),
      0
    );
    const currency = holders.find((h) => h.currency)?.currency || "USD";
    return { totalHolders, totalActive, totalReserve, totalLicenses, totalRevenue, currency };
  }, [holders]);

  /* Derive unique countries and uplines from the dataset for dropdown options */
  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    holders.forEach((h) => { if (h.country) set.add(h.country); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [holders]);

  const uplineOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    holders.forEach((h) => {
      if (h.upline?.id && !map.has(h.upline.id)) {
        map.set(h.upline.id, {
          id: h.upline.id,
          name: h.upline.name || "Unknown",
          email: h.upline.email || "",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [holders]);

  const filtered = useMemo(() => {
    return holders.filter((h) => {
      // Text search — local box (name/email) plus the shared header search.
      // Header search matches name / email (phone isn't in this payload), so
      // both are applied and must pass.
      const name = (h.name || "").toLowerCase();
      const email = (h.email || "").toLowerCase();
      const q = query.trim().toLowerCase();
      if (q && !name.includes(q) && !email.includes(q)) return false;
      const hq = debouncedHeaderSearch.toLowerCase();
      if (hq && !name.includes(hq) && !email.includes(hq)) return false;
      // Numeric bucket filters
      if (!matchesBucket(h.licensesPurchased, filters.purchasedRange)) return false;
      if (!matchesBucket(h.licensesInReserve, filters.reserveRange)) return false;
      if (!matchesBucket(h.licensesAssigned, filters.assignedRange)) return false;
      // Date filters — registration
      if (filters.registrationFrom) {
        if (new Date(h.createdAt) < new Date(filters.registrationFrom)) return false;
      }
      if (filters.registrationTo) {
        const to = new Date(filters.registrationTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(h.createdAt) > to) return false;
      }
      // Date filters — first purchase
      if (filters.purchaseDateFrom) {
        if (new Date(h.firstPurchasedAt) < new Date(filters.purchaseDateFrom)) return false;
      }
      if (filters.purchaseDateTo) {
        const to = new Date(filters.purchaseDateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(h.firstPurchasedAt) > to) return false;
      }
      // Country
      if (filters.country && (h.country || "") !== filters.country) return false;
      // Upline
      if (filters.uplineId && (h.upline?.id || "") !== filters.uplineId) return false;
      return true;
    });
  }, [holders, query, filters, debouncedHeaderSearch]);

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-[#FBD10D] rounded-full animate-spin" />
          <p className="text-sm text-gray-300">
            Loading Unilevel Plus license holders…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          label="Total Licenses"
          value={stats.totalLicenses.toLocaleString()}
          hint=""
          icon={<Crown className="h-4 w-4" />}
          accent="#FBD10D"
        />
        <StatCard
          label="Active Licenses"
          value={stats.totalActive.toLocaleString()}
          hint="Sum of purchased licenses"
          icon={<Ticket className="h-4 w-4" />}
          accent="#FBA70A"
        />
        <StatCard
          label="In Reserve"
          value={stats.totalReserve.toLocaleString()}
          hint="Available for assignment"
          icon={<Archive className="h-4 w-4" />}
          accent="#F5C518"
        />
        <StatCard
          label="Total Revenue"
          value={formatMoney(stats.totalRevenue, stats.currency)}
          hint="Across all active purchases"
          icon={<DollarSign className="h-4 w-4" />}
          accent="#34D399"
        />
      </div>

      {/* Holder list — vertical breathing handled by the layout's
          space-y-6 on the content wrapper, so no per-card mt needed. */}
      <Card className="bg-[#111116] border-gray-800" ref={filterPanelRef}>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Ticket className="h-5 w-5 text-[#FBD10D]" />
                Unilevel Plus License Holders
              </CardTitle>
              <CardDescription className="text-gray-400">
                Every user holding at least one Unilevel Plus license — expand a
                row to see their offices and roles.
              </CardDescription>
            </div>

            {/* Filter button + Search — same line, right side */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <button
                onClick={() => setFiltersOpen((p) => !p)}
                className={`shrink-0 inline-flex items-center gap-2 px-3 h-9 rounded-lg border text-sm font-medium transition-all duration-200 cursor-pointer ${
                  filtersOpen
                    ? "bg-[#FBD10D]/15 border-[#FBD10D]/50 text-[#FBD10D]"
                    : activeFilterCount > 0
                    ? "bg-[#FBD10D]/10 border-[#FBD10D]/30 text-[#FBD10D]"
                    : "bg-[#1a1a22] border-[#2a2a35] text-gray-400 hover:text-white hover:border-[#3a3a45]"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] rounded-full bg-[#FBD10D] text-black text-[10px] font-bold px-1 leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <Input
                  placeholder="Search by name or email"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-gray-500 focus-visible:ring-[#FBD10D]/40 focus-visible:ring-[3px] focus-visible:border-[#FBD10D]/60"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter dropdown panel */}
          {filtersOpen && (
            <div className="rounded-xl border border-[#2a2a35] bg-[#0c0c10]/95 backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 mb-4">
              {/* Numeric filters */}
              <div className="p-4 pb-3">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">Licenses</div>
                <div className="grid grid-cols-3 gap-3">
                  <FilterField label="Purchased" value={filters.purchasedRange} onChange={(v) => updateFilter("purchasedRange", v)} options={NUMERIC_BUCKETS} />
                  <FilterField label="In Reserve" value={filters.reserveRange} onChange={(v) => updateFilter("reserveRange", v)} options={NUMERIC_BUCKETS} />
                  <FilterField label="Assigned" value={filters.assignedRange} onChange={(v) => updateFilter("assignedRange", v)} options={ASSIGNED_BUCKETS} />
                </div>
              </div>

              <div className="h-px bg-[#1e1e28]" />

              {/* Date range */}
              <div className="p-4 pb-3">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">Date Range</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-gray-500 mb-1 block">From</span>
                    <Input
                      type="date"
                      value={filters.registrationFrom}
                      onChange={(e) => updateFilter("registrationFrom", e.target.value)}
                      className="bg-[#15151d] border-[#2a2a35] text-white text-xs h-9 w-full focus-visible:ring-[#FBD10D]/30 focus-visible:border-[#FBD10D]/50 [color-scheme:dark] rounded-lg"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 mb-1 block">To</span>
                    <Input
                      type="date"
                      value={filters.registrationTo}
                      onChange={(e) => updateFilter("registrationTo", e.target.value)}
                      className="bg-[#15151d] border-[#2a2a35] text-white text-xs h-9 w-full focus-visible:ring-[#FBD10D]/30 focus-visible:border-[#FBD10D]/50 [color-scheme:dark] rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-[#1e1e28]" />

              {/* Country & Upline */}
              <div className="p-4 pb-3">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">Person</div>
                <div className="grid grid-cols-2 gap-3">
                  <FilterField
                    label="Country"
                    value={filters.country}
                    onChange={(v) => updateFilter("country", v)}
                    options={[{ label: "All Countries", value: "" }, ...countryOptions.map((c) => ({ label: c, value: c }))]}
                  />
                  <FilterField
                    label="Upline"
                    value={filters.uplineId}
                    onChange={(v) => updateFilter("uplineId", v)}
                    options={[
                      { label: "All Uplines", value: "" },
                      ...uplineOptions.map((u) => ({ label: u.name + (u.email ? ` (${u.email})` : ""), value: u.id })),
                    ]}
                  />
                </div>
              </div>

              {/* Footer */}
              {activeFilterCount > 0 && (
                <>
                  <div className="h-px bg-[#1e1e28]" />
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-gray-500">
                      <span className="text-white font-medium">{filtered.length}</span> of {holders.length} holders
                    </span>
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                      Clear all
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Results summary when filters are active but panel closed */}
          {activeFilterCount > 0 && !filtersOpen && (
            <div className="text-xs text-gray-500 mb-3">
              Showing <span className="text-white font-medium">{filtered.length}</span> of{" "}
              <span className="text-gray-400">{holders.length}</span> holders
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState query={query} totalHolders={stats.totalHolders} />
          ) : (
            <Accordion type="multiple" className="w-full space-y-2">
              {filtered.map((h) => (
                <HolderRow key={h.id} holder={h} />
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ---------- Pieces ---------- */

function FilterField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-gray-500 mb-1 block">{label}</span>
      <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="bg-[#15151d] border-[#2a2a35] text-white hover:bg-[#1c1c26] h-9 text-xs w-full rounded-lg transition-colors">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#15151d] border-[#2a2a35] text-white max-h-60">
          {options.map((o) => (
            <SelectItem key={o.value || "__all__"} value={o.value || "__all__"} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="bg-[#111116] border-gray-800 relative overflow-hidden">
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}66, transparent)`,
        }}
      />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-300">
          {label}
        </CardTitle>
        <span
          className="inline-flex items-center justify-center h-8 w-8 rounded-md"
          style={{
            backgroundColor: `${accent}1a`,
            color: accent,
            border: `1px solid ${accent}33`,
          }}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-white tracking-tight">
          {value}
        </div>
        <p className="text-xs text-gray-400 mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}

function HolderRow({ holder }: { holder: LicenseHolder }) {
  const totalLicenses =
    holder.licensesPurchased + holder.licensesInReserve + holder.licensesAssigned;

  return (
    <AccordionItem
      value={holder.id}
      className="border border-[#2a2a35] rounded-xl bg-[#0e0e12] data-[state=open]:bg-[#11111a] data-[state=open]:border-[#FBD10D]/30 transition-colors"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[#15151b]/60 rounded-xl data-[state=open]:rounded-b-none">
        <div className="flex flex-1 items-center gap-4 pr-3 min-w-0">
          {/* Avatar */}
          <Avatar className="h-11 w-11 shrink-0 border border-[#FBD10D]/30 bg-gradient-to-br from-[#FBD10D] to-[#FBA70A]">
            {holder.profilePicture ? (
              <AvatarImage src={holder.profilePicture} alt={holder.name || ""} />
            ) : null}
            <AvatarFallback className="bg-transparent text-black font-semibold text-sm">
              {initialOf(holder)}
            </AvatarFallback>
          </Avatar>

          {/* Identity */}
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-white truncate">
                {holder.name || "Unnamed user"}
              </div>
              {holder.name && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigator.clipboard.writeText(holder.name as string);
                    toast.success("Name copied");
                  }}
                  className="shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="text-xs text-gray-400 truncate">
                {holder.email || "—"}
              </div>
              {holder.email && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigator.clipboard.writeText(holder.email as string);
                    toast.success("Email copied");
                  }}
                  className="shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </div>

          {/* Stat pills */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <StatPill
              label="Purchased"
              value={holder.licensesPurchased}
              accent="#FBD10D"
            />
            <StatPill
              label="Reserve"
              value={holder.licensesInReserve}
              accent="#FBA70A"
            />
            <StatPill
              label="Assigned"
              value={holder.licensesAssigned}
              accent="#9fa0b8"
            />
          </div>

          {/* Total spent */}
          <div className="hidden lg:flex flex-col items-end shrink-0 min-w-[88px]">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              Spent
            </span>
            <span className="text-sm font-semibold text-emerald-300">
              {formatMoney(holder.totalSpent, holder.currency)}
            </span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4 pt-0">
        {/* Mobile-only stat strip */}
        <div className="md:hidden flex flex-wrap gap-2 pb-3 pt-1">
          <StatPill label="Purchased" value={holder.licensesPurchased} accent="#FBD10D" />
          <StatPill label="Reserve" value={holder.licensesInReserve} accent="#FBA70A" />
          <StatPill label="Assigned" value={holder.licensesAssigned} accent="#9fa0b8" />
          <span className="ml-auto text-sm font-semibold text-emerald-300">
            {formatMoney(holder.totalSpent, holder.currency)}
          </span>
        </div>

        {/* Compact info grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1.5 text-xs mb-3 mt-1">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 shrink-0">Upline</span>
              <span className="text-white truncate font-medium">
                {holder.upline?.name || "—"}
              </span>
              {holder.upline?.name && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigator.clipboard.writeText(holder.upline!.name as string);
                    toast.success("Upline name copied");
                  }}
                  className="shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                </div>
              )}
            </div>
            {holder.upline?.email && (
              <div className="flex items-center gap-1.5 pl-[52px]">
                <span className="text-gray-400 truncate text-[11px]">
                  {holder.upline.email}
                </span>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigator.clipboard.writeText(holder.upline!.email as string);
                    toast.success("Upline email copied");
                  }}
                  className="shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-gray-500 shrink-0">Location</span>
            <span className="text-white truncate">
              {[holder.city, holder.state, holder.country].filter(Boolean).join(", ") || "—"}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-gray-500 shrink-0">Signed up</span>
            <span className="text-white">{formatDate(holder.createdAt)}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-gray-500 shrink-0">1st purchase</span>
            <span className="text-white">{formatDate(holder.firstPurchasedAt)}</span>
          </div>
        </div>

        {/* Directs + milestone — single compact row */}
        <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
          <span className="text-gray-500">Directs:</span>
          <span className="inline-flex items-center gap-1 text-white font-medium tabular-nums">
            <Users className="h-3 w-3 text-gray-500" /> {holder.totalDirects}
          </span>
          <span className="text-gray-600">·</span>
          <span className="inline-flex items-center gap-1 text-emerald-400 tabular-nums">
            <UserCheck className="h-3 w-3" /> {holder.directsWithLicense} licensed
          </span>
          <span className="text-gray-600">·</span>
          <span className="inline-flex items-center gap-1 text-rose-400 tabular-nums">
            <UserX className="h-3 w-3" /> {holder.directsWithoutLicense} unlicensed
          </span>
          {holder.fourLicenseMilestoneDate && (
            <>
              <span className="text-gray-600">·</span>
              <span className="inline-flex items-center gap-1 text-[#FBD10D]">
                <Trophy className="h-3 w-3" /> 4 licenses on {formatDate(holder.fourLicenseMilestoneDate)}
              </span>
            </>
          )}
        </div>

        {/* Purchase timeline — compact inline */}
        {holder.purchaseTimeline && holder.purchaseTimeline.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
            <span className="text-gray-500 shrink-0">Purchases:</span>
            {holder.purchaseTimeline.map((entry, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  entry.type === "purchased"
                    ? "bg-[#FBD10D]/10 text-[#FBD10D]"
                    : "bg-[#FBA70A]/10 text-[#FBA70A]"
                }`}
              >
                {entry.type === "purchased" ? "P" : "R"} {formatDate(entry.date)}
                {idx === 3 && <Trophy className="h-2.5 w-2.5 ml-0.5" />}
              </span>
            ))}
          </div>
        )}

        {/* Meta + Offices */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400 mb-3">
          <span className="inline-flex items-center gap-1">
            <Send className="h-3 w-3" /> {holder.licensesAssigned} assigned out
          </span>
          <span className="inline-flex items-center gap-1">
            <Archive className="h-3 w-3" /> {totalLicenses} total
          </span>
        </div>

        {holder.organizations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {holder.organizations.map((org) => (
              <OfficeRow key={org.id} org={org} />
            ))}
          </div>
        )}

        {/* Payment History */}
        {holder.paymentHistory && holder.paymentHistory.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-3.5 w-3.5 text-[#FBD10D]" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Payments</span>
              <span className="text-[10px] text-gray-500 font-medium">({holder.paymentHistory.length})</span>
            </div>
            <div className="space-y-1">
              {holder.paymentHistory.map((payment) => (
                <PaymentRow key={payment.invoiceId} payment={payment} />
              ))}
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1a22] border border-[#2a2a35] px-2.5 py-1 text-xs">
      <span className="font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </span>
      <span className="text-gray-400">{label}</span>
    </span>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  razorpay: "Razorpay",
  stripe: "Stripe",
  openmoney: "OpenMoney",
  square: "Square",
  phonepe: "PhonePe",
  paytm: "Paytm",
  crypto_wallet: "Crypto",
  store_wallet: "Store Wallet",
  affiliate_wallet: "Affiliate Wallet",
};

function PaymentRow({ payment }: { payment: PaymentHistoryEntry }) {
  const platformLabel = PLATFORM_LABELS[payment.paymentPlatform || ""] || payment.paymentPlatform || "—";

  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#0b0b0d] border border-[#1e1e28] px-3 py-2 text-xs hover:border-[#2a2a35] transition-colors">
      {/* Invoice # */}
      <span className="text-gray-400 font-mono text-[10px] shrink-0">
        {payment.invoiceNumber}
      </span>

      <span className="text-gray-600">·</span>

      {/* Amount */}
      <span className="text-emerald-300 font-semibold tabular-nums shrink-0">
        {formatMoney(payment.amount / 100, payment.currency)}
      </span>

      <span className="text-gray-600">·</span>

      {/* Platform */}
      <span className="text-gray-400 shrink-0">
        via <span className="text-gray-300">{platformLabel}</span>
      </span>

      <span className="text-gray-600">·</span>

      {/* Date */}
      <span className="text-gray-500 tabular-nums shrink-0">
        {formatDate(payment.paidAt)}
      </span>

      {/* Coupon badge */}
      {payment.couponCode && (
        <>
          <span className="text-gray-600">·</span>
          <span className="text-[9px] font-medium rounded px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400">
            {payment.couponCode}
          </span>
        </>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Invoice link */}
      <a
        href={payment.invoiceUrl || invoiceUrl(payment.invoiceId)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-[10px] text-[#FBD10D] hover:text-[#FBD10D]/80 transition-colors shrink-0"
      >
        <ExternalLink className="h-3 w-3" />
        Invoice
      </a>
    </div>
  );
}


function OfficeRow({ org }: { org: OfficeMembership }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2a2a35] bg-[#0b0b0d] hover:border-[#FBD10D]/30 transition-colors p-3">
      <div className="h-9 w-9 shrink-0 rounded-md bg-[#15151b] border border-[#2a2a35] overflow-hidden flex items-center justify-center">
        {org.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.icon}
            alt={org.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Building2 className="h-4 w-4 text-[#FBD10D]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">
          {org.name}
        </div>
        <div className="text-[11px] text-gray-500">
          Joined {formatDate(org.joinedAt)}
        </div>
      </div>
      <RoleBadge role={org.role} fullAccess={org.fullAccess} />
    </div>
  );
}

function RoleBadge({
  role,
  fullAccess,
}: {
  role: "founder" | "stakeholder";
  fullAccess: boolean;
}) {
  if (role === "founder") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[#FBD10D]/15 text-[#FBD10D] border border-[#FBD10D]/30">
        <Crown className="h-3 w-3" />
        Founder
      </span>
    );
  }
  if (fullAccess) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[#FBA70A]/15 text-[#FBA70A] border border-[#FBA70A]/30">
        Full-access
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[#15151b] text-gray-300 border border-[#2a2a35]">
      Member
    </span>
  );
}

function EmptyState({
  query,
  totalHolders,
}: {
  query: string;
  totalHolders: number;
}) {
  if (totalHolders === 0) {
    return (
      <div className="text-center py-14">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#FBD10D]/10 border border-[#FBD10D]/30 mb-4">
          <Ticket className="h-5 w-5 text-[#FBD10D]" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">
          No license holders yet
        </h3>
        <p className="text-sm text-gray-400">
          Once users purchase Unilevel Plus, they&apos;ll show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="text-center py-12">
      <Search className="h-8 w-8 text-gray-500 mx-auto mb-3" />
      <h3 className="text-base font-semibold text-white mb-1">
        No matches for &ldquo;{query}&rdquo;
      </h3>
      <p className="text-sm text-gray-400">Try a different name or email.</p>
    </div>
  );
}
