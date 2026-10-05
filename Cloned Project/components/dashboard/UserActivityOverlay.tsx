"use client";

/**
 * UserActivityOverlay
 *
 * Full-viewport overlay that renders on top of the current founder
 * dashboard page. Opens when a founder clicks a row on the "Users" tab
 * of any of the four Orders pages (Communities / Live / Courses /
 * Products). Contents branch on `itemType`:
 *
 *   - itemType === "channel": three sub-tabs — Communities (from
 *     ChannelMembership), Invoices, Events (from ChannelMembershipEvent).
 *   - other itemTypes: two sub-tabs — {ItemLabel}s (grouped from
 *     invoices), Invoices. No events tab (only communities carry a
 *     membership event log today).
 *
 * All data comes from `/feed/founder/user-detail`, so the overlay makes
 * exactly one round-trip on open. Filters inside the sub-tabs operate
 * on the already-fetched data — no additional server round-trips.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  ExternalLink,
  User as UserIcon,
  Building2,
  FileText,
  Activity,
  Mail,
  Calendar,
  DollarSign,
  BadgeCheck,
  Repeat,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  getFounderUserDetail,
  type FounderInvoiceItemType,
  type FounderUserDetailResponse,
  type FounderUserDetailChannelItem,
  type FounderUserDetailPurchasedItem,
  type FounderUserDetailInvoice,
  type ChannelInvoiceStatus,
} from "@/lib/feed-api";

const ANY = "__all__";

// Shared surface classes — same visual language as the parent page so the
// overlay reads as an extension of the same UI, not a separate world.
const panelSurface =
  "bg-[#131318] rounded-2xl ring-1 ring-inset ring-white/[0.04] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6),0_2px_4px_-2px_rgba(0,0,0,0.4)]";
const nestedSurface =
  "bg-[#0f0f14] rounded-xl ring-1 ring-inset ring-white/[0.03]";
const inputSurface =
  "bg-[#0c0c11] border-transparent ring-1 ring-inset ring-white/[0.05] text-white placeholder:text-[#5a5a72] focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-transparent shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]";
const selectContentSurface =
  "bg-[#141419] border-transparent ring-1 ring-white/[0.06] text-white shadow-2xl shadow-black/60";
const filterLabelClass =
  "block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b6b80] mb-1";

function formatMoney(amountMinor: number, currency: string | null) {
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

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function membershipStatusBadgeClass(
  status: string | null | undefined,
): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "cancelled":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "expired":
    case "inactive":
    case "suspended":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

interface UserActivityOverlayProps {
  orgId: string;
  itemType: FounderInvoiceItemType;
  itemLabel: string; // e.g. "Community"
  itemLabelPlural: string; // e.g. "Communities"
  userId: string;
  onClose: () => void;
}

export function UserActivityOverlay({
  orgId,
  itemType,
  itemLabel,
  itemLabelPlural,
  userId,
  onClose,
}: UserActivityOverlayProps) {
  const [detail, setDetail] = useState<FounderUserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"items" | "invoices" | "events">("items");

  // Invoice sub-tab filters (operate client-side on already-fetched data
  // so the overlay stays snappy after the initial round-trip).
  const [invStatus, setInvStatus] = useState<ChannelInvoiceStatus | typeof ANY>(ANY);
  const [invItemId, setInvItemId] = useState<string | typeof ANY>(ANY);
  const [invCurrency, setInvCurrency] = useState<"USD" | "INR" | typeof ANY>(ANY);
  const [invFrom, setInvFrom] = useState("");
  const [invTo, setInvTo] = useState("");

  // Items sub-tab filters.
  const [itemsStatus, setItemsStatus] = useState<string | typeof ANY>(ANY);
  const [itemsItemId, setItemsItemId] = useState<string | typeof ANY>(ANY);

  // Load user detail.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFounderUserDetail(orgId, itemType, userId);
      setDetail(res);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load user detail");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, itemType, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Prevent body scroll while overlay is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const user = detail?.user;
  const invoices = detail?.invoices ?? [];
  const items = detail?.items ?? [];
  const events = detail?.events ?? [];

  // Item picker options — dedup by title, mirror the parent-page dedupe
  // UX. Feeds both sub-tab filters.
  const itemOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const inv of invoices) {
      if (inv.itemId && !set.has(inv.itemId)) {
        set.set(inv.itemId, inv.itemTitle || "Untitled");
      }
    }
    if (itemType === "channel") {
      for (const it of items as FounderUserDetailChannelItem[]) {
        if (it.itemId && !set.has(it.itemId)) set.set(it.itemId, it.itemTitle || "Untitled");
      }
    } else {
      for (const it of items as FounderUserDetailPurchasedItem[]) {
        if (it.itemId && !set.has(it.itemId)) set.set(it.itemId, it.itemTitle || "Untitled");
      }
    }
    return Array.from(set.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [invoices, items, itemType]);

  // Filtered invoices for the Invoices sub-tab.
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (invStatus !== ANY && inv.status !== invStatus) return false;
      if (invItemId !== ANY && inv.itemId !== invItemId) return false;
      if (invCurrency !== ANY && inv.itemCurrency !== invCurrency) return false;
      if (invFrom) {
        if (new Date(inv.createdAt) < new Date(invFrom)) return false;
      }
      if (invTo) {
        if (new Date(inv.createdAt) > new Date(invTo)) return false;
      }
      return true;
    });
  }, [invoices, invStatus, invItemId, invCurrency, invFrom, invTo]);

  // Filtered items for the Items sub-tab.
  const filteredItems = useMemo(() => {
    if (itemType === "channel") {
      return (items as FounderUserDetailChannelItem[]).filter((it) => {
        if (itemsItemId !== ANY && it.itemId !== itemsItemId) return false;
        if (itemsStatus !== ANY) {
          const effective = it.subscriptionStatus || it.status || "";
          if (effective !== itemsStatus) return false;
        }
        return true;
      });
    }
    return (items as FounderUserDetailPurchasedItem[]).filter((it) => {
      if (itemsItemId !== ANY && it.itemId !== itemsItemId) return false;
      if (itemsStatus !== ANY) {
        const effective = it.hasActivePaid ? "active" : "inactive";
        if (effective !== itemsStatus) return false;
      }
      return true;
    });
  }, [items, itemType, itemsItemId, itemsStatus]);

  // Top-line stats derived from the fetched invoices.
  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid");
    const totalsByCurrency = new Map<string, number>();
    for (const p of paid) {
      totalsByCurrency.set(
        p.itemCurrency,
        (totalsByCurrency.get(p.itemCurrency) || 0) + p.totalAmount,
      );
    }
    const firstActivity =
      invoices.length > 0
        ? invoices.reduce(
            (min, i) =>
              new Date(i.createdAt) < new Date(min) ? i.createdAt : min,
            invoices[0].createdAt,
          )
        : null;
    return {
      totalsByCurrency: Array.from(totalsByCurrency.entries()),
      itemCount: items.length,
      invoiceCount: invoices.length,
      paidCount: paid.length,
      firstActivity,
    };
  }, [invoices, items]);

  const itemsTabLabel =
    itemType === "channel" ? itemLabelPlural : itemLabelPlural;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        // Backdrop click closes; child click stops propagation.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 flex flex-col bg-[#0a0a0d]">
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.05] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-[#161620] flex items-center justify-center shrink-0 ring-1 ring-inset ring-white/[0.06] overflow-hidden">
                {user?.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profilePicture}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-5 w-5 text-[#5a5a72]" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">
                  {user?.name || "—"}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 text-[12px] text-[#9fa0b8]">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{user?.email || "—"}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-[#9fa0b8] hover:text-white hover:bg-white/[0.06] transition-colors ring-1 ring-inset ring-white/[0.05]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stat strip */}
          {!loading && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className={`${nestedSurface} p-3`}>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5a5a72]">
                  <DollarSign className="h-3 w-3" />
                  Total paid
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-white">
                  {stats.totalsByCurrency.length === 0
                    ? formatMoney(0, "USD")
                    : stats.totalsByCurrency
                        .map(([cur, amt]) => formatMoney(amt, cur))
                        .join(" · ")}
                </div>
              </div>
              <div className={`${nestedSurface} p-3`}>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5a5a72]">
                  <Building2 className="h-3 w-3" />
                  {itemsTabLabel}
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-white">
                  {stats.itemCount}
                </div>
              </div>
              <div className={`${nestedSurface} p-3`}>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5a5a72]">
                  <FileText className="h-3 w-3" />
                  Invoices
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-white">
                  {stats.invoiceCount}
                  {stats.paidCount !== stats.invoiceCount && (
                    <span className="ml-1 text-[10px] font-sans font-normal text-[#5a5a72]">
                      · {stats.paidCount} paid
                    </span>
                  )}
                </div>
              </div>
              <div className={`${nestedSurface} p-3`}>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5a5a72]">
                  <Calendar className="h-3 w-3" />
                  First activity
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {formatDate(stats.firstActivity)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {loading ? (
            <div className={`${nestedSurface} flex items-center justify-center py-32 text-gray-400 text-sm gap-2`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading activity…
            </div>
          ) : !detail?.user ? (
            <div className={`${nestedSurface} py-24 flex flex-col items-center gap-3 text-center px-4`}>
              <div className="h-12 w-12 rounded-2xl bg-[#161620] flex items-center justify-center ring-1 ring-inset ring-white/[0.03]">
                <UserIcon className="h-5 w-5 text-[#5a5a72]" />
              </div>
              <p className="text-sm font-semibold text-white">
                User not found or no data in this org
              </p>
            </div>
          ) : (
            <Tabs
              value={subTab}
              onValueChange={(v) =>
                setSubTab(v as "items" | "invoices" | "events")
              }
            >
              <TabsList className="mb-4 bg-[#131318] ring-1 ring-inset ring-white/[0.04] p-1 h-9">
                <TabsTrigger
                  value="items"
                  className="text-xs data-[state=active]:bg-brand/15 data-[state=active]:text-brand text-[#9fa0b8] px-3 h-7"
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  {itemsTabLabel}
                </TabsTrigger>
                <TabsTrigger
                  value="invoices"
                  className="text-xs data-[state=active]:bg-brand/15 data-[state=active]:text-brand text-[#9fa0b8] px-3 h-7"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Invoices
                </TabsTrigger>
                {itemType === "channel" && (
                  <TabsTrigger
                    value="events"
                    className="text-xs data-[state=active]:bg-brand/15 data-[state=active]:text-brand text-[#9fa0b8] px-3 h-7"
                  >
                    <Activity className="h-3.5 w-3.5 mr-1.5" />
                    Events
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ---------- Items sub-tab ---------- */}
              <TabsContent value="items" className="mt-0">
                <div className={`${panelSurface} p-4`}>
                  {/* Filters row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className={filterLabelClass}>{itemLabel}</label>
                      <Select
                        value={itemsItemId}
                        onValueChange={(v) => setItemsItemId(v)}
                      >
                        <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
                          <SelectValue placeholder={`Any ${itemLabel.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent className={`${selectContentSurface} max-h-72`}>
                          <SelectItem value={ANY} className="focus:bg-white/[0.06] focus:text-white">
                            Any {itemLabel.toLowerCase()}
                          </SelectItem>
                          {itemOptions.map((opt) => (
                            <SelectItem
                              key={opt.id}
                              value={opt.id}
                              className="focus:bg-white/[0.06] focus:text-white"
                            >
                              {opt.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={filterLabelClass}>Status</label>
                      <Select
                        value={itemsStatus}
                        onValueChange={(v) => setItemsStatus(v)}
                      >
                        <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
                          <SelectValue placeholder="Any status" />
                        </SelectTrigger>
                        <SelectContent className={selectContentSurface}>
                          <SelectItem value={ANY} className="focus:bg-white/[0.06] focus:text-white">
                            Any status
                          </SelectItem>
                          {itemType === "channel" ? (
                            <>
                              <SelectItem value="active" className="focus:bg-white/[0.06] focus:text-white">
                                Active
                              </SelectItem>
                              <SelectItem value="cancelled" className="focus:bg-white/[0.06] focus:text-white">
                                Cancelled
                              </SelectItem>
                              <SelectItem value="expired" className="focus:bg-white/[0.06] focus:text-white">
                                Expired
                              </SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="active" className="focus:bg-white/[0.06] focus:text-white">
                                Active
                              </SelectItem>
                              <SelectItem value="inactive" className="focus:bg-white/[0.06] focus:text-white">
                                Inactive
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {filteredItems.length === 0 ? (
                    <div className={`${nestedSurface} py-16 text-center text-sm text-[#6b6b80]`}>
                      No {itemsTabLabel.toLowerCase()} match these filters.
                    </div>
                  ) : itemType === "channel" ? (
                    <div className={`${nestedSurface} overflow-hidden`}>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-white/[0.04] hover:bg-transparent">
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              {itemLabel}
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Joined
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Status
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Last payment
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Next payment
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Cancelled
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(filteredItems as FounderUserDetailChannelItem[]).map(
                            (it) => (
                              <TableRow
                                key={it.itemId}
                                className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                              >
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5 text-[#5a5a72] shrink-0" />
                                    <span className="text-sm text-white font-medium truncate max-w-[220px]">
                                      {it.itemTitle || "—"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                  {formatDate(it.joinedAt)}
                                </TableCell>
                                <TableCell className="py-3">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "capitalize text-[10px] font-semibold px-2 py-0",
                                      membershipStatusBadgeClass(
                                        it.subscriptionStatus || it.status,
                                      ),
                                    )}
                                  >
                                    {it.subscriptionStatus || it.status || "—"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                  {formatDate(it.lastPaymentDate)}
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                  {formatDate(it.nextPaymentDate)}
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                  {formatDate(it.cancelledAt)}
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className={`${nestedSurface} overflow-hidden`}>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-white/[0.04] hover:bg-transparent">
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              {itemLabel}
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              First purchased
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Last purchased
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                              Invoices
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                              Total paid
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Access
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(filteredItems as FounderUserDetailPurchasedItem[]).map(
                            (it) => (
                              <TableRow
                                key={it.itemId}
                                className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                              >
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5 text-[#5a5a72] shrink-0" />
                                    <span className="text-sm text-white font-medium truncate max-w-[220px]">
                                      {it.itemTitle || "—"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                  {formatDate(it.firstPurchasedAt)}
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                  {formatDate(it.lastPurchasedAt)}
                                </TableCell>
                                <TableCell className="py-3 text-right font-mono text-sm text-[#c7c7da]">
                                  {it.invoiceCount}
                                </TableCell>
                                <TableCell className="py-3 text-right font-mono text-sm text-white">
                                  {formatMoney(it.totalPaid, it.currency)}
                                </TableCell>
                                <TableCell className="py-3">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "capitalize text-[10px] font-semibold px-2 py-0",
                                      it.hasActivePaid
                                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                        : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                                    )}
                                  >
                                    {it.hasActivePaid ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ---------- Invoices sub-tab ---------- */}
              <TabsContent value="invoices" className="mt-0">
                <div className={`${panelSurface} p-4`}>
                  {/* Filters row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                    <div>
                      <label className={filterLabelClass}>Status</label>
                      <Select
                        value={invStatus}
                        onValueChange={(v) =>
                          setInvStatus(v as ChannelInvoiceStatus | typeof ANY)
                        }
                      >
                        <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
                          <SelectValue placeholder="Any status" />
                        </SelectTrigger>
                        <SelectContent className={selectContentSurface}>
                          <SelectItem value={ANY} className="focus:bg-white/[0.06] focus:text-white">
                            Any status
                          </SelectItem>
                          <SelectItem value="paid" className="focus:bg-white/[0.06] focus:text-white">
                            Paid
                          </SelectItem>
                          <SelectItem value="pending" className="focus:bg-white/[0.06] focus:text-white">
                            Pending
                          </SelectItem>
                          <SelectItem value="cancelled" className="focus:bg-white/[0.06] focus:text-white">
                            Cancelled
                          </SelectItem>
                          <SelectItem value="refunded" className="focus:bg-white/[0.06] focus:text-white">
                            Refunded
                          </SelectItem>
                          <SelectItem value="failed" className="focus:bg-white/[0.06] focus:text-white">
                            Failed
                          </SelectItem>
                          <SelectItem value="expired" className="focus:bg-white/[0.06] focus:text-white">
                            Expired
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={filterLabelClass}>{itemLabel}</label>
                      <Select
                        value={invItemId}
                        onValueChange={(v) => setInvItemId(v)}
                      >
                        <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
                          <SelectValue placeholder={`Any ${itemLabel.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent className={`${selectContentSurface} max-h-72`}>
                          <SelectItem value={ANY} className="focus:bg-white/[0.06] focus:text-white">
                            Any {itemLabel.toLowerCase()}
                          </SelectItem>
                          {itemOptions.map((opt) => (
                            <SelectItem
                              key={opt.id}
                              value={opt.id}
                              className="focus:bg-white/[0.06] focus:text-white"
                            >
                              {opt.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={filterLabelClass}>Currency</label>
                      <Select
                        value={invCurrency}
                        onValueChange={(v) =>
                          setInvCurrency(v as "USD" | "INR" | typeof ANY)
                        }
                      >
                        <SelectTrigger className={`${inputSurface} h-8 text-xs w-full`}>
                          <SelectValue placeholder="Any currency" />
                        </SelectTrigger>
                        <SelectContent className={selectContentSurface}>
                          <SelectItem value={ANY} className="focus:bg-white/[0.06] focus:text-white">
                            Any currency
                          </SelectItem>
                          <SelectItem value="USD" className="focus:bg-white/[0.06] focus:text-white">
                            USD
                          </SelectItem>
                          <SelectItem value="INR" className="focus:bg-white/[0.06] focus:text-white">
                            INR
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={filterLabelClass}>From</label>
                      <Input
                        type="date"
                        value={invFrom}
                        onChange={(e) => setInvFrom(e.target.value)}
                        className={`${inputSurface} h-8 text-xs [color-scheme:dark]`}
                      />
                    </div>
                    <div>
                      <label className={filterLabelClass}>To</label>
                      <Input
                        type="date"
                        value={invTo}
                        onChange={(e) => setInvTo(e.target.value)}
                        className={`${inputSurface} h-8 text-xs [color-scheme:dark]`}
                      />
                    </div>
                  </div>

                  {filteredInvoices.length === 0 ? (
                    <div className={`${nestedSurface} py-16 text-center text-sm text-[#6b6b80]`}>
                      No invoices match these filters.
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
                              {itemLabel}
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                              Amount
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Status
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Generated
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Due
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                              Paid
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3 text-right">
                              Open
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInvoices.map((inv) => (
                            <TableRow
                              key={inv._id}
                              className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                            >
                              <TableCell className="py-3">
                                <div className="font-mono text-xs text-white font-semibold">
                                  {inv.invoiceNumber}
                                </div>
                                {inv.recurringPaymentNumber && (
                                  <div className="text-[10px] text-[#5a5a72] mt-0.5 flex items-center gap-1">
                                    <Repeat className="h-2.5 w-2.5" />
                                    Cycle {inv.recurringPaymentNumber}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="text-sm text-[#c7c7da] truncate max-w-[180px] block">
                                  {inv.itemTitle || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 text-right font-mono text-sm text-white">
                                {formatMoney(inv.totalAmount, inv.itemCurrency)}
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "capitalize text-[10px] font-semibold px-2 py-0",
                                    statusBadgeClass(inv.status),
                                  )}
                                >
                                  {inv.status === "draft" ? "Pending" : inv.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                {formatDate(inv.createdAt)}
                              </TableCell>
                              <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                {formatDate(inv.nextDueDate)}
                              </TableCell>
                              <TableCell className="py-3 text-[11px]">
                                {inv.paidAt ? (
                                  <span className="text-emerald-400/70 flex items-center gap-1">
                                    <BadgeCheck className="h-3 w-3" />
                                    {formatDate(inv.paidAt)}
                                  </span>
                                ) : inv.cancelledAt ? (
                                  <span className="text-rose-400/70 flex items-center gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Cancelled {formatDate(inv.cancelledAt)}
                                  </span>
                                ) : (
                                  <span className="text-[#5a5a72]">—</span>
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
                </div>
              </TabsContent>

              {/* ---------- Events sub-tab (channel only) ---------- */}
              {itemType === "channel" && (
                <TabsContent value="events" className="mt-0">
                  <div className={`${panelSurface} p-4`}>
                    {events.length === 0 ? (
                      <div className={`${nestedSurface} py-16 text-center text-sm text-[#6b6b80]`}>
                        No membership events recorded.
                      </div>
                    ) : (
                      <div className={`${nestedSurface} overflow-hidden`}>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-white/[0.04] hover:bg-transparent">
                              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                                Event
                              </TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                                {itemLabel}
                              </TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                                Period
                              </TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                                Access until
                              </TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80] py-3">
                                When
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {events.map((e) => (
                              <TableRow
                                key={e._id}
                                className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                              >
                                <TableCell className="py-3">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "capitalize text-[10px] font-semibold px-2 py-0",
                                      e.eventType === "unsubscribed"
                                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                        : "bg-rose-500/15 text-rose-300 border-rose-500/30",
                                    )}
                                  >
                                    {e.eventType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="text-sm text-[#c7c7da] truncate max-w-[220px] block">
                                    {e.channelTitle || "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8] capitalize">
                                  {e.subscriptionPeriod || "—"}
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                  {formatDate(e.accessUntil)}
                                </TableCell>
                                <TableCell className="py-3 text-[11px] text-[#9fa0b8]">
                                  {formatDate(e.occurredAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
