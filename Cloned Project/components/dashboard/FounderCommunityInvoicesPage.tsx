"use client";

/**
 * FounderInvoicesPage
 *
 * Shared founder-facing invoice list, parameterised by `itemType`:
 * `channel` (Communities), `workshop` (Live Streams), `course` (Courses),
 * or `product` (Digital Products). Renders identical UI across all four
 * — filters, table columns, pagination — with only the labels + item
 * dropdown swapped.
 *
 * BE: GET /feed/founder/invoices?orgId=&itemType=&... (feed.ts,
 * founder-gated). Response includes per-page invoices, total count for
 * pagination, and a flat `items[]` list that populates the item-filter
 * dropdown without a second call.
 *
 * Per-type wrappers pin the `itemType` + `itemLabel` props:
 *   - FounderCommunityOrdersPage → itemType="channel"
 *   - FounderLiveOrdersPage      → itemType="workshop"
 *   - FounderCourseOrdersPage    → itemType="course"
 *   - FounderProductOrdersPage   → itemType="product"
 *
 * Every filter uses the app's UI-kit primitives — Input for search +
 * dates, Select for status/item/currency/type. No unstyled HTML form
 * controls anywhere.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  X,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  CalendarDays,
  DollarSign,
  Repeat,
  User as UserIcon,
  Users as UsersIcon,
  Building2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { exportRowsAsCsv } from "@/lib/csvExport";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getFounderInvoices,
  getFounderItemUsers,
  type FounderChannelInvoiceRow,
  type FounderInvoicesFilters,
  type FounderInvoiceItemType,
  type ChannelInvoiceStatus,
  type FounderItemUserRow,
  type FounderItemUsersFilters,
  type FounderItemUserStatus,
} from "@/lib/feed-api";
import { UserActivityOverlay } from "@/components/dashboard/UserActivityOverlay";

const PAGE_SIZE = 25;

// Sentinel value for "no filter" — Radix Select can't accept an empty
// string as a valid item value, so we use "__all__" and translate to
// undefined at the API boundary.
const ANY = "__all__";

// Three real states the founder cares about. "Pending" is a UX bucket
// that maps to BOTH the DB `draft` and `pending` values (see the BE
// `if (status === "pending")` branch in feed.ts — it expands to
// `{ $in: ["draft", "pending"] }`). Cancelled + Paid map 1:1. The
// rarer refunded/failed/expired states are folded into "Any status"
// rather than getting their own chips.
const STATUS_OPTIONS: { value: ChannelInvoiceStatus | typeof ANY; label: string }[] = [
  { value: ANY, label: "Any status" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

const TYPE_OPTIONS: { value: "true" | "false" | typeof ANY; label: string }[] = [
  { value: ANY, label: "Any type" },
  { value: "true", label: "Recurring" },
  { value: "false", label: "One-time" },
];

const CURRENCY_OPTIONS: { value: "USD" | "INR" | typeof ANY; label: string }[] = [
  { value: ANY, label: "Any currency" },
  { value: "USD", label: "USD" },
  { value: "INR", label: "INR" },
];

// Read the current org id from where the rest of the dashboard reads it.
function readOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

function statusBadgeClass(status: ChannelInvoiceStatus) {
  switch (status) {
    case "paid":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "pending":
    case "draft":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "cancelled":
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
    case "failed":
    case "expired":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    case "refunded":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

// Amounts on Invoice are stored in the smallest unit (paise/cents) — see
// invoice.model.ts:113. `Intl.NumberFormat` handles the currency symbol
// per row's native currency, no manual $/₹ switching.
function formatMoney(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format((amountMinor || 0) / 100);
  } catch {
    return `${((amountMinor || 0) / 100).toFixed(2)} ${currency || ""}`.trim();
  }
}

function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(
    "en-US",
    opts ?? { month: "short", day: "numeric", year: "numeric" },
  );
}

function formatDateTime(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface FiltersState {
  search: string;
  debouncedSearch: string;
  status: ChannelInvoiceStatus | typeof ANY;
  itemId: string | typeof ANY;
  currency: "USD" | "INR" | typeof ANY;
  isRecurring: "true" | "false" | typeof ANY;
  from: string;
  to: string;
}

const INITIAL_FILTERS: FiltersState = {
  search: "",
  debouncedSearch: "",
  status: ANY,
  itemId: ANY,
  currency: ANY,
  isRecurring: ANY,
  from: "",
  to: "",
};

interface FounderInvoicesPageProps {
  itemType: FounderInvoiceItemType;
  // Singular label used in header + empty state + filter dropdown label.
  // e.g. "Community", "Live Stream", "Course", "Product".
  itemLabel: string;
  // Plural — used in the sub-header sentence.
  itemLabelPlural: string;
  // Which tab to open on mount. Defaults to "invoices". Set to "users"
  // when this component is mounted as a dedicated Customers page.
  initialTab?: "invoices" | "users";
  // When true, the invoices/users tab bar is hidden and the page renders
  // ONLY the initialTab's content. Used by dedicated Customers pages that
  // shouldn't expose the Invoices toggle.
  hideTabs?: boolean;
}

// ------- Users tab types + option lists -------
interface UsersFiltersState {
  search: string;
  debouncedSearch: string;
  status: FounderItemUserStatus | typeof ANY;
  itemId: string | typeof ANY;
  currency: "USD" | "INR" | typeof ANY;
  from: string;
  to: string;
}

const INITIAL_USERS_FILTERS: UsersFiltersState = {
  search: "",
  debouncedSearch: "",
  status: ANY,
  itemId: ANY,
  currency: ANY,
  from: "",
  to: "",
};

// Status options for the Users tab. For channels we surface membership
// states (active/cancelling/expired); the other three item types roll
// up invoice status (paid/refunded/pending).
const USER_STATUS_OPTIONS_CHANNEL: {
  value: FounderItemUserStatus | typeof ANY;
  label: string;
}[] = [
  { value: ANY, label: "Any status" },
  { value: "active", label: "Active" },
  { value: "cancelling", label: "Cancelling" },
  { value: "expired", label: "Expired" },
];

const USER_STATUS_OPTIONS_OTHER: {
  value: FounderItemUserStatus | typeof ANY;
  label: string;
}[] = [
  { value: ANY, label: "Any status" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "refunded", label: "Refunded" },
];

function userStatusBadgeClass(status: FounderItemUserRow["status"]) {
  switch (status) {
    case "active":
    case "paid":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "cancelling":
    case "pending":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "expired":
    case "refunded":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

export function FounderInvoicesPage({
  itemType,
  itemLabel,
  itemLabelPlural,
  initialTab = "invoices",
  hideTabs = false,
}: FounderInvoicesPageProps) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"invoices" | "users">(initialTab);
  const [invoices, setInvoices] = useState<FounderChannelInvoiceRow[]>([]);
  const [items, setItems] = useState<{ _id: string; title: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const allInvoices: any[] = [];
      let currentSkip = 0;
      const batchSize = 100;
      let hasMore = true;

      while (hasMore) {
        const apiFilters = {
          limit: batchSize,
          skip: currentSkip,
          search: filters.debouncedSearch || undefined,
          status: filters.status === ANY ? undefined : filters.status,
          itemId: filters.itemId === ANY ? undefined : filters.itemId,
          currency: filters.currency === ANY ? undefined : filters.currency,
          isRecurring: filters.isRecurring === ANY ? undefined : filters.isRecurring,
          from: filters.from || undefined,
          to: filters.to || undefined,
        };
        const res = await getFounderInvoices(orgId, itemType, apiFilters);
        allInvoices.push(...res.invoices);
        
        currentSkip += batchSize;
        hasMore = res.hasMore && res.invoices.length > 0;
      }
      
      const columns = [
        { header: "Invoice Number", accessor: (inv: any) => inv.invoiceNumber || "" },
        { header: "Customer Name", accessor: (inv: any) => inv.customerName || "" },
        { header: "Customer Email", accessor: (inv: any) => inv.customerEmail || "" },
        { header: "Customer ID", accessor: (inv: any) => inv.customerId || "" },
        { header: `${itemLabel} Title`, accessor: (inv: any) => inv.itemTitle || "" },
        { header: `${itemLabel} ID`, accessor: (inv: any) => inv.itemId || "" },
        { header: "Type", accessor: (inv: any) => inv.isRecurring ? `Recurring (${inv.recurringPeriod || ""})` : "One-time" },
        { header: "Cycle", accessor: (inv: any) => inv.recurringPaymentNumber || "" },
        { header: "Amount", accessor: (inv: any) => (inv.totalAmount || 0) / 100 },
        { header: "Currency", accessor: (inv: any) => inv.itemCurrency || "" },
        { header: "Payment Currency", accessor: (inv: any) => inv.paymentCurrency || "" },
        { header: "Status", accessor: (inv: any) => inv.status === "draft" ? "Pending" : inv.status },
        { header: "Payment Platform", accessor: (inv: any) => inv.paymentPlatform || "" },
        { header: "Created At", accessor: (inv: any) => formatDateTime(inv.createdAt) },
        { header: "Paid At", accessor: (inv: any) => formatDateTime(inv.paidAt) },
        { header: "Cancelled At", accessor: (inv: any) => formatDateTime(inv.cancelledAt) },
        { header: "Next Due Date", accessor: (inv: any) => formatDateTime(inv.nextDueDate) },
      ];
      
      const filename = `founder-${itemLabelPlural.toLowerCase()}-invoices-${Date.now()}`;
      exportRowsAsCsv(allInvoices, columns, filename);
      toast.success(`Successfully exported ${allInvoices.length} invoices to CSV.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to export invoices");
    } finally {
      setExporting(false);
    }
  }, [
    orgId,
    itemType,
    itemLabel,
    itemLabelPlural,
    filters.debouncedSearch,
    filters.status,
    filters.itemId,
    filters.currency,
    filters.isRecurring,
    filters.from,
    filters.to,
  ]);

  // Users tab state — kept fully independent from the invoices tab so
  // switching tabs preserves each side's pagination + filter selection.
  const [users, setUsers] = useState<FounderItemUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSkip, setUsersSkip] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersFilters, setUsersFilters] = useState<UsersFiltersState>(
    INITIAL_USERS_FILTERS,
  );
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  useEffect(() => {
    setOrgId(readOrgId());
  }, []);

  // Debounce search input so the BE isn't hit on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => ({ ...prev, debouncedSearch: prev.search }));
    }, 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Reset pagination when any filter changes.
  useEffect(() => {
    setSkip(0);
  }, [
    filters.debouncedSearch,
    filters.status,
    filters.itemId,
    filters.currency,
    filters.isRecurring,
    filters.from,
    filters.to,
  ]);

  // Dedupe items by title — the mobile app has occasionally created
  // duplicate channels with the same name (e.g. 3 x "Chamak Skin School"
  // during the `currency: "USD $"` bug). Instead of rendering three
  // identical entries in the dropdown, we group by title and emit ONE
  // entry whose value is a comma-joined list of the underlying IDs. The
  // BE splits and $ins that list so filtering by the deduped title still
  // returns invoices from every duplicate item. Applies to all item
  // types even though channels are the only known offender today.
  const itemOptions = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const it of items) {
      const titleKey = it.title || "Untitled";
      if (!groups.has(titleKey)) groups.set(titleKey, []);
      groups.get(titleKey)!.push(it._id);
    }
    return Array.from(groups.entries())
      .map(([title, ids]) => ({ title, value: ids.join(","), count: ids.length }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.debouncedSearch) n++;
    if (filters.status !== ANY) n++;
    if (filters.itemId !== ANY) n++;
    if (filters.currency !== ANY) n++;
    if (filters.isRecurring !== ANY) n++;
    if (filters.from) n++;
    if (filters.to) n++;
    return n;
  }, [filters]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const apiFilters: FounderInvoicesFilters = {
        limit: PAGE_SIZE,
        skip,
        search: filters.debouncedSearch || undefined,
        status: filters.status === ANY ? undefined : filters.status,
        itemId: filters.itemId === ANY ? undefined : filters.itemId,
        currency: filters.currency === ANY ? undefined : filters.currency,
        isRecurring: filters.isRecurring === ANY ? undefined : filters.isRecurring,
        from: filters.from || undefined,
        to: filters.to || undefined,
      };
      const res = await getFounderInvoices(orgId, itemType, apiFilters);
      setInvoices(res.invoices);
      setTotal(res.total);
      if (res.items.length) setItems(res.items);
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to load ${itemLabelPlural.toLowerCase()} invoices`);
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    orgId,
    itemType,
    itemLabelPlural,
    skip,
    filters.debouncedSearch,
    filters.status,
    filters.itemId,
    filters.currency,
    filters.isRecurring,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    // When the invoices tab is permanently hidden (hideTabs+initialTab=users
    // → dedicated Customers page), skip the invoices fetch entirely — the
    // data never renders. Saves a round-trip on the Customers page.
    if (hideTabs && activeTab !== "invoices") return;
    load();
  }, [load, hideTabs, activeTab]);

  // ------- Users tab: debounce, reset, load -------
  useEffect(() => {
    const id = setTimeout(() => {
      setUsersFilters((prev) => ({
        ...prev,
        debouncedSearch: prev.search,
      }));
    }, 350);
    return () => clearTimeout(id);
  }, [usersFilters.search]);

  useEffect(() => {
    setUsersSkip(0);
  }, [
    usersFilters.debouncedSearch,
    usersFilters.status,
    usersFilters.itemId,
    usersFilters.currency,
    usersFilters.from,
    usersFilters.to,
  ]);

  const loadUsers = useCallback(async () => {
    if (!orgId) return;
    setUsersLoading(true);
    try {
      const apiFilters: FounderItemUsersFilters = {
        limit: PAGE_SIZE,
        skip: usersSkip,
        q: usersFilters.debouncedSearch || undefined,
        status:
          usersFilters.status === ANY ? undefined : usersFilters.status,
        itemId: usersFilters.itemId === ANY ? undefined : usersFilters.itemId,
        currency:
          usersFilters.currency === ANY ? undefined : usersFilters.currency,
        from: usersFilters.from || undefined,
        to: usersFilters.to || undefined,
      };
      const res = await getFounderItemUsers(orgId, itemType, apiFilters);
      setUsers(res.users);
      setUsersTotal(res.total);
      if (res.items.length) setItems(res.items);
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to load ${itemLabelPlural.toLowerCase()} users`);
      setUsers([]);
      setUsersTotal(0);
    } finally {
      setUsersLoading(false);
    }
  }, [
    orgId,
    itemType,
    itemLabelPlural,
    usersSkip,
    usersFilters.debouncedSearch,
    usersFilters.status,
    usersFilters.itemId,
    usersFilters.currency,
    usersFilters.from,
    usersFilters.to,
  ]);

  // Only fire the users query when its tab is active — avoids a second
  // round-trip on every page load when the founder only wants invoices.
  useEffect(() => {
    if (activeTab === "users") loadUsers();
  }, [activeTab, loadUsers]);

  const clearAll = () => setFilters(INITIAL_FILTERS);
  const clearUsersAll = () => setUsersFilters(INITIAL_USERS_FILTERS);

  const usersActiveFilterCount = useMemo(() => {
    let n = 0;
    if (usersFilters.debouncedSearch) n++;
    if (usersFilters.status !== ANY) n++;
    if (usersFilters.itemId !== ANY) n++;
    if (usersFilters.currency !== ANY) n++;
    if (usersFilters.from) n++;
    if (usersFilters.to) n++;
    return n;
  }, [usersFilters]);

  const usersStatusOptions =
    itemType === "channel"
      ? USER_STATUS_OPTIONS_CHANNEL
      : USER_STATUS_OPTIONS_OTHER;

  const paidCount = useMemo(
    () => invoices.filter((i) => i.status === "paid").length,
    [invoices],
  );

  // Shared panel styling — subtle depth via drop shadow + hairline
  // white ring instead of harsh gray borders. Two elevation levels:
  //   `panelSurface`  hero cards (filters column, results column)
  //   `nestedSurface` inner containers (the table wrapper, empty state)
  // Both sit above the page bg (#0a0a0d) with a slightly-lifted fill so
  // the depth reads on dark themes where drop shadows are almost
  // invisible on their own.
  const panelSurface =
    "bg-[#131318] rounded-2xl ring-1 ring-inset ring-white/[0.04] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6),0_2px_4px_-2px_rgba(0,0,0,0.4)]";
  const nestedSurface =
    "bg-[#0f0f14] rounded-xl ring-1 ring-inset ring-white/[0.03]";
  const inputSurface =
    "bg-[#0c0c11] border-transparent ring-1 ring-inset ring-white/[0.05] text-white placeholder:text-[#5a5a72] focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-transparent shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]";
  const selectContentSurface =
    "bg-[#141419] border-transparent ring-1 ring-white/[0.06] text-white shadow-2xl shadow-black/60";
  // Compact label — tighter tracking + smaller bottom margin so five
  // stacked filter groups don't dominate the sidebar.
  const filterLabelClass =
    "block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b6b80] mb-1";

  const filtersPanel = (
    <div className={`${panelSurface} p-3.5`}>
      {/* Filters header — tightened: smaller icon square, smaller title */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-brand/10 flex items-center justify-center ring-1 ring-inset ring-brand/20">
            <Filter className="h-3 w-3 text-brand" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white">Filters</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-brand/15 text-brand text-[9px] font-bold ring-1 ring-inset ring-brand/25">
                {activeFilterCount}
              </span>
            )}
          </div>
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[10px] font-medium text-[#9fa0b8] hover:text-white transition-colors inline-flex items-center gap-0.5"
          >
            <X className="h-2.5 w-2.5" />
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {/* Search */}
        <div>
          <label className={filterLabelClass}>Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#5a5a72] pointer-events-none" />
            <Input
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Name, email, or invoice #"
              className={`${inputSurface} pl-7 pr-7 h-8 text-xs`}
            />
            {filters.search && (
              <button
                onClick={() =>
                  setFilters((prev) => ({ ...prev, search: "" }))
                }
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-md flex items-center justify-center text-[#5a5a72] hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className={filterLabelClass}>Status</label>
          <Select
            value={filters.status}
            onValueChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                status: v as ChannelInvoiceStatus | typeof ANY,
              }))
            }
          >
            <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent className={selectContentSurface}>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={o.value}
                  className="focus:bg-white/[0.06] focus:text-white"
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Item picker (Community / Live Stream / Course / Product) */}
        <div>
          <label className={filterLabelClass}>{itemLabel}</label>
          <Select
            value={filters.itemId}
            onValueChange={(v) =>
              setFilters((prev) => ({ ...prev, itemId: v }))
            }
          >
            <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
              <SelectValue placeholder={`All ${itemLabelPlural.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent className={`${selectContentSurface} max-h-72`}>
              <SelectItem value={ANY} className="focus:bg-white/[0.06] focus:text-white">
                All {itemLabelPlural.toLowerCase()}
              </SelectItem>
              {itemOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="focus:bg-white/[0.06] focus:text-white"
                >
                  <span className="flex items-center gap-1.5">
                    {opt.title}
                    {/* Duplicate-item pill — surfaces when the DB has
                        more than one row with this exact title (leftover
                        from the mobile "USD $" currency bug for
                        channels; harmless for other item types). Picking
                        this option still filters across ALL of the
                        underlying IDs. */}
                    {opt.count > 1 && (
                      <span
                        title={`${opt.count} ${itemLabelPlural.toLowerCase()} share this name — filtering across all of them.`}
                        className="text-[9px] font-semibold px-1 py-px rounded bg-amber-500/10 text-amber-400/80 ring-1 ring-inset ring-amber-500/20"
                      >
                        {opt.count} dupes
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type */}
        <div>
          <label className={filterLabelClass}>Type</label>
          <Select
            value={filters.isRecurring}
            onValueChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                isRecurring: v as "true" | "false" | typeof ANY,
              }))
            }
          >
            <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
              <SelectValue placeholder="Any type" />
            </SelectTrigger>
            <SelectContent className={selectContentSurface}>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={o.value}
                  className="focus:bg-white/[0.06] focus:text-white"
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div>
          <label className={filterLabelClass}>Currency</label>
          <Select
            value={filters.currency}
            onValueChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                currency: v as "USD" | "INR" | typeof ANY,
              }))
            }
          >
            <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
              <SelectValue placeholder="Any currency" />
            </SelectTrigger>
            <SelectContent className={selectContentSurface}>
              {CURRENCY_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={o.value}
                  className="focus:bg-white/[0.06] focus:text-white"
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range — From above, To below. The prior inline-prefix
            layout collided with the browser-native `dd/mm/yyyy`
            placeholder on empty state (the prefix and the placeholder
            overlapped inside the field). Stacked labels give the
            picker its full width and eliminate the overlap. */}
        <div>
          <label className={filterLabelClass}>Date range</label>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6b6b80] mb-1">
                From
              </label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, from: e.target.value }))
                }
                className={`${inputSurface} h-8 text-xs [color-scheme:dark]`}
              />
            </div>
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6b6b80] mb-1">
                To
              </label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, to: e.target.value }))
                }
                className={`${inputSurface} h-8 text-xs [color-scheme:dark]`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Users tab sidebar filters — same visual language as the invoices
  // sidebar, only the field set differs (no type/recurring toggle; status
  // options vary by itemType via `usersStatusOptions`).
  const usersFiltersPanel = (
    <div className={`${panelSurface} p-3.5`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-brand/10 flex items-center justify-center ring-1 ring-inset ring-brand/20">
            <Filter className="h-3 w-3 text-brand" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white">Filters</span>
            {usersActiveFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-brand/15 text-brand text-[9px] font-bold ring-1 ring-inset ring-brand/25">
                {usersActiveFilterCount}
              </span>
            )}
          </div>
        </div>
        {usersActiveFilterCount > 0 && (
          <button
            type="button"
            onClick={clearUsersAll}
            className="text-[10px] font-medium text-[#9fa0b8] hover:text-white transition-colors inline-flex items-center gap-0.5"
          >
            <X className="h-2.5 w-2.5" />
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {/* Search */}
        <div>
          <label className={filterLabelClass}>Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#5a5a72] pointer-events-none" />
            <Input
              value={usersFilters.search}
              onChange={(e) =>
                setUsersFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Name or email"
              className={`${inputSurface} pl-7 pr-7 h-8 text-xs`}
            />
            {usersFilters.search && (
              <button
                onClick={() =>
                  setUsersFilters((prev) => ({ ...prev, search: "" }))
                }
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-md flex items-center justify-center text-[#5a5a72] hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className={filterLabelClass}>Status</label>
          <Select
            value={usersFilters.status}
            onValueChange={(v) =>
              setUsersFilters((prev) => ({
                ...prev,
                status: v as FounderItemUserStatus | typeof ANY,
              }))
            }
          >
            <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent className={selectContentSurface}>
              {usersStatusOptions.map((o) => (
                <SelectItem
                  key={o.value}
                  value={o.value}
                  className="focus:bg-white/[0.06] focus:text-white"
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Item picker */}
        <div>
          <label className={filterLabelClass}>{itemLabel}</label>
          <Select
            value={usersFilters.itemId}
            onValueChange={(v) =>
              setUsersFilters((prev) => ({ ...prev, itemId: v }))
            }
          >
            <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
              <SelectValue placeholder={`All ${itemLabelPlural.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent className={`${selectContentSurface} max-h-72`}>
              <SelectItem value={ANY} className="focus:bg-white/[0.06] focus:text-white">
                All {itemLabelPlural.toLowerCase()}
              </SelectItem>
              {itemOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="focus:bg-white/[0.06] focus:text-white"
                >
                  <span className="flex items-center gap-1.5">
                    {opt.title}
                    {opt.count > 1 && (
                      <span className="text-[9px] font-semibold px-1 py-px rounded bg-amber-500/10 text-amber-400/80 ring-1 ring-inset ring-amber-500/20">
                        {opt.count} dupes
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div>
          <label className={filterLabelClass}>Currency</label>
          <Select
            value={usersFilters.currency}
            onValueChange={(v) =>
              setUsersFilters((prev) => ({
                ...prev,
                currency: v as "USD" | "INR" | typeof ANY,
              }))
            }
          >
            <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
              <SelectValue placeholder="Any currency" />
            </SelectTrigger>
            <SelectContent className={selectContentSurface}>
              {CURRENCY_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={o.value}
                  className="focus:bg-white/[0.06] focus:text-white"
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range — last activity */}
        <div>
          <label className={filterLabelClass}>Last activity</label>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6b6b80] mb-1">
                From
              </label>
              <Input
                type="date"
                value={usersFilters.from}
                onChange={(e) =>
                  setUsersFilters((prev) => ({ ...prev, from: e.target.value }))
                }
                className={`${inputSurface} h-8 text-xs [color-scheme:dark]`}
              />
            </div>
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6b6b80] mb-1">
                To
              </label>
              <Input
                type="date"
                value={usersFilters.to}
                onChange={(e) =>
                  setUsersFilters((prev) => ({ ...prev, to: e.target.value }))
                }
                className={`${inputSurface} h-8 text-xs [color-scheme:dark]`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    // Full-width layout — no max-w constraint. This page lives inside
    // the founder Communities:Orders slot which sits directly beneath a
    // narrow left sidebar, so containing to `max-w-[1600px]` was pushing
    // the invoice table into cramped territory on wide monitors. Let it
    // breathe.
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand/15 to-brand/[0.02] flex items-center justify-center shrink-0 ring-1 ring-inset ring-brand/15">
            {activeTab === "users" ? (
              <UsersIcon className="h-5 w-5 text-brand" />
            ) : (
              <FileText className="h-5 w-5 text-brand" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">
              {activeTab === "users"
                ? `${itemLabel} Customers`
                : `${itemLabel} Invoices`}
            </h1>
            <p className="text-sm text-[#9fa0b8] mt-1.5">
              {activeTab === "users"
                ? `Every buyer across your ${itemLabelPlural.toLowerCase()} — lifetime value, invoice count, first & last purchase.`
                : `Every customer invoice across your ${itemLabelPlural.toLowerCase()} — paid, pending, and cancelled.`}
            </p>
          </div>
        </div>
        {!loading && activeTab === "invoices" && (
          <div className="hidden sm:flex flex-col items-end shrink-0">
            <span className="font-mono text-xl font-black text-white leading-none">
              {total.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a5a72] mt-1">
              invoices
            </span>
          </div>
        )}
        {!usersLoading && activeTab === "users" && (
          <div className="hidden sm:flex flex-col items-end shrink-0">
            <span className="font-mono text-xl font-black text-white leading-none">
              {usersTotal.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a5a72] mt-1">
              users
            </span>
          </div>
        )}
      </div>

      {/* Tabs — Invoices (original view) and Users (buyer roll-up).
          Tabs live at the page level so each tab keeps its own filter
          sidebar. State is local; switching tabs never resets filters. */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "invoices" | "users")}
        className="w-full"
      >
        <TabsList
          className={
            hideTabs
              ? "hidden"
              : "mb-4 bg-[#131318] ring-1 ring-inset ring-white/[0.04] p-1 h-9"
          }
        >
          <TabsTrigger
            value="invoices"
            className="text-xs data-[state=active]:bg-brand/15 data-[state=active]:text-brand text-[#9fa0b8] px-3 h-7"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Invoices
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="text-xs data-[state=active]:bg-brand/15 data-[state=active]:text-brand text-[#9fa0b8] px-3 h-7"
          >
            <UsersIcon className="h-3.5 w-3.5 mr-1.5" />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-0">
      {/* Two-column layout: filters left (fixed narrow), results right
          (fluid). On mobile everything stacks vertically. `lg:sticky` on
          filters keeps them in view while scrolling long result sets.
          240px keeps the filter column compact — labels + h-8 inputs no
          longer need the extra breathing room a 300px column gave them. */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3 lg:gap-4 items-start">
        <aside className="lg:sticky lg:top-4">{filtersPanel}</aside>

        {/* Results column */}
        <section className={`${panelSurface} p-4`}>
          {/* Results header — inline stats stripe */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand" />
                Invoices
                {!loading && total > 0 && (
                  <span className="text-[11px] text-[#5a5a72] font-normal">
                    · Showing {skip + 1}–
                    {Math.min(skip + invoices.length, total)} of{" "}
                    {total.toLocaleString()}
                  </span>
                )}
              </h2>
              {!loading && (
                <p className="text-xs text-[#6b6b80] mt-1">
                  {paidCount > 0
                    ? `${paidCount} paid on this page`
                    : "Click any row to open the customer's invoice page."}
                </p>
              )}
            </div>
            {!loading && total > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="h-8 text-xs font-semibold px-3 ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.12] hover:bg-white/[0.03] text-[#c7c7da] hover:text-white shrink-0"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export to CSV
                  </>
                )}
              </Button>
            )}
          </div>

          {loading ? (
            <div className={`${nestedSurface} flex items-center justify-center py-24 text-gray-400 text-sm gap-2`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading invoices…
            </div>
          ) : invoices.length === 0 ? (
            <div className={`${nestedSurface} py-20 flex flex-col items-center gap-3 text-center px-4`}>
              <div className="h-12 w-12 rounded-2xl bg-[#161620] flex items-center justify-center ring-1 ring-inset ring-white/[0.03]">
                <FileText className="h-5 w-5 text-[#5a5a72]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  No invoices match these filters
                </p>
                <p className="text-xs text-[#5a5a72] mt-1">
                  Try clearing filters or adjusting the date range.
                </p>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAll}
                  className="mt-2 h-8 px-3 text-xs font-medium rounded-lg text-[#c7c7da] hover:text-white transition-colors ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.12] hover:bg-white/[0.03]"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className={`${nestedSurface} overflow-hidden`}>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/[0.04] hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                      Invoice
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                      Customer
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                      {itemLabel}
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                      Type
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                      Amount
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                      Created
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                      Open
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow
                      key={inv._id}
                      className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <TableCell className="py-3">
                        <div className="font-mono text-xs text-white font-semibold">
                          {inv.invoiceNumber}
                        </div>
                        {inv.recurringPaymentNumber && (
                          <div className="text-[10px] text-[#5a5a72] mt-0.5">
                            Cycle {inv.recurringPaymentNumber}
                            {inv.parentInvoiceId ? "" : " (root)"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-[#161620] flex items-center justify-center shrink-0 ring-1 ring-inset ring-white/[0.04]">
                            <UserIcon className="h-3.5 w-3.5 text-[#5a5a72]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-white font-medium truncate max-w-[180px]">
                              {inv.customerName || "—"}
                            </div>
                            <div className="text-[11px] text-[#5a5a72] truncate max-w-[180px]">
                              {inv.customerEmail || "—"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-[#5a5a72] shrink-0" />
                          <span className="text-sm text-[#c7c7da] truncate max-w-[160px]">
                            {inv.channelTitle || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#c7c7da]">
                          {inv.isRecurring ? (
                            <>
                              <Repeat className="h-3 w-3 text-blue-400" />
                              <span className="capitalize">
                                {inv.recurringPeriod || "recurring"}
                              </span>
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-3 w-3 text-emerald-400" />
                              <span>One-time</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono text-sm text-white">
                        {formatMoney(inv.totalAmount, inv.itemCurrency)}
                        {inv.paymentCurrency &&
                          inv.paymentCurrency !== inv.itemCurrency && (
                            <div className="text-[10px] text-[#5a5a72] font-sans font-normal mt-0.5">
                              Paid in {inv.paymentCurrency}
                            </div>
                          )}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize text-[10px] font-semibold px-2 py-0",
                            statusBadgeClass(inv.status),
                          )}
                        >
                          {/* Row-level relabel of "draft" → "Pending",
                              matching the STATUS_OPTIONS chip above and
                              the recurring-cycle timeline elsewhere. */}
                          {inv.status === "draft" ? "Pending" : inv.status}
                        </Badge>
                        {inv.cancelledAt && (
                          <div className="text-[10px] text-[#5a5a72] mt-0.5">
                            {formatDate(inv.cancelledAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                        {formatDate(inv.createdAt)}
                        {inv.paidAt && (
                          <div className="text-[10px] text-emerald-400/70 mt-0.5">
                            Paid {formatDate(inv.paidAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Link
                          href={`/invoice/${inv.invoiceNumber || inv._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[#5a5a72] hover:text-white hover:bg-white/[0.06] transition-colors"
                          aria-label="Open invoice"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination — borderless, ring-based buttons matching the
              softer treatment on the rest of the page. */}
          {!loading && invoices.length > 0 && (
            <div className="flex items-center justify-between mt-4 gap-2">
              <span className="text-[11px] text-[#6b6b80]">
                Page {Math.floor(skip / PAGE_SIZE) + 1} of{" "}
                {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={skip === 0}
                  onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                  className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg text-[#c7c7da] hover:text-white transition-colors ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.12] hover:bg-white/[0.03] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:ring-white/[0.05]"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={skip + invoices.length >= total}
                  onClick={() => setSkip(skip + PAGE_SIZE)}
                  className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg text-[#c7c7da] hover:text-white transition-colors ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.12] hover:bg-white/[0.03] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:ring-white/[0.05]"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
        </TabsContent>

        {/* ---------- Users tab ---------- */}
        <TabsContent value="users" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3 lg:gap-4 items-start">
            <aside className="lg:sticky lg:top-4">{usersFiltersPanel}</aside>

            <section className={`${panelSurface} p-4`}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-brand" />
                    Users
                    {!usersLoading && usersTotal > 0 && (
                      <span className="text-[11px] text-[#5a5a72] font-normal">
                        · Showing {usersSkip + 1}–
                        {Math.min(usersSkip + users.length, usersTotal)} of{" "}
                        {usersTotal.toLocaleString()}
                      </span>
                    )}
                  </h2>
                  {!usersLoading && (
                    <p className="text-xs text-[#6b6b80] mt-1">
                      {itemType === "channel"
                        ? "Everyone who's ever paid for one of your communities. Click a row for the full picture."
                        : `Everyone who's ever bought one of your ${itemLabelPlural.toLowerCase()}. Click a row for the full picture.`}
                    </p>
                  )}
                </div>
              </div>

              {usersLoading ? (
                <div className={`${nestedSurface} flex items-center justify-center py-24 text-gray-400 text-sm gap-2`}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading users…
                </div>
              ) : users.length === 0 ? (
                <div className={`${nestedSurface} py-20 flex flex-col items-center gap-3 text-center px-4`}>
                  <div className="h-12 w-12 rounded-2xl bg-[#161620] flex items-center justify-center ring-1 ring-inset ring-white/[0.03]">
                    <UsersIcon className="h-5 w-5 text-[#5a5a72]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      No users match these filters
                    </p>
                    <p className="text-xs text-[#5a5a72] mt-1">
                      Try clearing filters or widening the date range.
                    </p>
                  </div>
                  {usersActiveFilterCount > 0 && (
                    <button
                      onClick={clearUsersAll}
                      className="mt-2 h-8 px-3 text-xs font-medium rounded-lg text-[#c7c7da] hover:text-white transition-colors ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.12] hover:bg-white/[0.03]"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <div className={`${nestedSurface} overflow-hidden`}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-white/[0.04] hover:bg-transparent">
                        <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                          User
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                          {itemLabelPlural}
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                          Invoices
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                          Total paid
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                          Status
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                          Last activity
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow
                          key={u.userId}
                          onClick={() => setOpenUserId(u.userId)}
                          className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-[#161620] flex items-center justify-center shrink-0 ring-1 ring-inset ring-white/[0.04] overflow-hidden">
                                {u.profilePicture ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={u.profilePicture}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <UserIcon className="h-3.5 w-3.5 text-[#5a5a72]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm text-white font-medium truncate max-w-[220px]">
                                  {u.name || "—"}
                                </div>
                                <div className="text-[11px] text-[#5a5a72] truncate max-w-[220px]">
                                  {u.email || "—"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm text-white">
                            {u.itemCount}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm text-[#c7c7da]">
                            {u.invoiceCount}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm text-white">
                            {formatMoney(u.totalPaid, u.currency || "USD")}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize text-[10px] font-semibold px-2 py-0",
                                userStatusBadgeClass(u.status),
                              )}
                            >
                              {u.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                            {formatDate(u.lastActivityAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!usersLoading && users.length > 0 && (
                <div className="flex items-center justify-between mt-4 gap-2">
                  <span className="text-[11px] text-[#6b6b80]">
                    Page {Math.floor(usersSkip / PAGE_SIZE) + 1} of{" "}
                    {Math.max(1, Math.ceil(usersTotal / PAGE_SIZE))}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={usersSkip === 0}
                      onClick={() =>
                        setUsersSkip(Math.max(0, usersSkip - PAGE_SIZE))
                      }
                      className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg text-[#c7c7da] hover:text-white transition-colors ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.12] hover:bg-white/[0.03] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:ring-white/[0.05]"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={usersSkip + users.length >= usersTotal}
                      onClick={() => setUsersSkip(usersSkip + PAGE_SIZE)}
                      className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg text-[#c7c7da] hover:text-white transition-colors ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.12] hover:bg-white/[0.03] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:ring-white/[0.05]"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>

      {/* Full-screen per-user detail overlay — mounted at the page root
          so it takes over the whole viewport regardless of scroll state. */}
      {openUserId && orgId && (
        <UserActivityOverlay
          orgId={orgId}
          itemType={itemType}
          itemLabel={itemLabel}
          itemLabelPlural={itemLabelPlural}
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
        />
      )}
    </div>
  );
}
