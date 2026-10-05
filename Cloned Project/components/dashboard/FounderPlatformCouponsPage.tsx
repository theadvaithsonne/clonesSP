"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { CouponAssignmentSheet } from "@/components/dashboard/CouponAssignmentSheet";
import { CouponRulesTab } from "@/components/dashboard/CouponRulesTab";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  TicketPercent,
  Plus,
  Loader2,
  Power,
  PowerOff,
  Edit2,
  Copy,
  Check,
  Tv,
  GraduationCap,
  BookOpen,
  ShoppingBag,
  Sparkles,
  Phone,
  Calendar,
  Users,
  Eye,
  ExternalLink,
  Gift,
  X,
  Receipt,
  Mail,
  User as UserIcon,
  Clock,
  CircleDot,
  Search,
  Zap,
  Activity,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProductType =
  | "channel"
  | "course"
  | "workshop"
  | "product"
  | "service"
  | "call";

type DiscountType = "fixed" | "percent";
type RedemptionStatus = "active" | "exhausted" | "cancelled";

interface PlatformCoupon {
  _id: string;
  code: string;
  name: string;
  description?: string;
  productType: ProductType;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  currency?: "USD" | "INR";
  cycleCount?: number;
  status: "active" | "inactive" | "expired";
  validFrom: string;
  validUntil?: string;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  currentUsageCount: number;
  minOrderAmount?: number;
  specificItemIds?: string[];
  createdAt: string;
}

interface EligibleItem {
  _id: string;
  title: string;
  price: number;
  currency: string;
  image?: string;
  isRecurring: boolean;
  recurringDetail?: string;
  status?: string;
}

interface PopulatedUser {
  _id: string;
  email: string;
  name?: string;
  profilePicture?: string;
}
interface PopulatedInvoice {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  discount: number;
  itemCurrency: string;
  paidAt?: string;
  status: string;
}
interface Redemption {
  _id: string;
  couponCode: string;
  productType: ProductType;
  cycleCount: number;
  cyclesApplied: number;
  status: RedemptionStatus;
  discountType: DiscountType;
  discountValue: number;
  createdAt: string;
  userId: PopulatedUser | null;
  invoiceId: PopulatedInvoice | null;
  parentInvoiceId: PopulatedInvoice | null;
}

interface ProductMeta {
  label: string;
  icon: React.ReactNode;
  isSubscription: boolean;
  accent: string;
}

const PRODUCT_META: Record<string, ProductMeta> = {
  channel: {
    label: "Channel",
    icon: <Tv className="h-3.5 w-3.5" />,
    isSubscription: true,
    accent: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  course: {
    label: "Course",
    icon: <GraduationCap className="h-3.5 w-3.5" />,
    isSubscription: false,
    accent: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  workshop: {
    label: "Workshop",
    icon: <BookOpen className="h-3.5 w-3.5" />,
    isSubscription: true,
    accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  product: {
    label: "Product",
    icon: <ShoppingBag className="h-3.5 w-3.5" />,
    isSubscription: false,
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  service: {
    label: "Service",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    isSubscription: false,
    accent: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  },
  call: {
    label: "Call",
    icon: <Phone className="h-3.5 w-3.5" />,
    isSubscription: false,
    accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
};

const UNKNOWN_PRODUCT_META: ProductMeta = {
  label: "Other",
  icon: <Gift className="h-3.5 w-3.5" />,
  isSubscription: false,
  accent: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

function getProductMeta(t: string | undefined | null): ProductMeta {
  if (!t) return UNKNOWN_PRODUCT_META;
  return PRODUCT_META[t] || UNKNOWN_PRODUCT_META;
}

const REDEMPTION_STATUS_META: Record<
  RedemptionStatus,
  { label: string; dot: string; text: string }
> = {
  active: { label: "Active", dot: "bg-amber-400", text: "text-amber-400" },
  exhausted: {
    label: "Exhausted",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
  },
  cancelled: { label: "Cancelled", dot: "bg-zinc-400", text: "text-zinc-400" },
};

function formatUSD(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function initials(nameOrEmail: string): string {
  const s = (nameOrEmail || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function FounderPlatformCouponsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<PlatformCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [detailsCoupon, setDetailsCoupon] = useState<PlatformCoupon | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [editing, setEditing] = useState<PlatformCoupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ProductType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [assignCoupon, setAssignCoupon] = useState<PlatformCoupon | null>(null);

  // Tab switcher: Coupons (existing UI) | Rules (Phase 7+)
  const [pageTab, setPageTab] = useState<"coupons" | "rules">("coupons");

  // Multi-step coupon-creation state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [eligibleItems, setEligibleItems] = useState<EligibleItem[]>([]);
  const [eligibleItemsLoading, setEligibleItemsLoading] = useState(false);
  const [eligibleItemsError, setEligibleItemsError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<EligibleItem | null>(null);
  const [itemSearch, setItemSearch] = useState("");

  const [form, setForm] = useState<{
    code: string;
    name: string;
    description: string;
    productType: ProductType;
    discountType: DiscountType;
    discountValue: string;
    maxDiscountAmount: string;
    currency: "USD" | "INR";
    cycleCount: string;
    validFrom: string;
    validUntil: string;
    maxUsageCount: string;
    maxUsagePerUser: string;
    minOrderAmount: string;
  }>({
    code: "",
    name: "",
    description: "",
    productType: "course",
    discountType: "percent",
    discountValue: "",
    maxDiscountAmount: "",
    currency: "USD",
    cycleCount: "1",
    validFrom: "",
    validUntil: "",
    maxUsageCount: "",
    maxUsagePerUser: "",
    minOrderAmount: "",
  });

  // Recurrence is now driven by the selected item's `isSubscription` flag,
  // not by the product type alone. Falls back to PRODUCT_META only when no
  // item is yet selected (e.g. legacy coupons being edited without item info).
  const isSubscriptionProduct = selectedItem
    ? selectedItem.isRecurring
    : getProductMeta(form.productType).isSubscription;

  // Extract orgId from JWT
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.orgId) setOrgId(payload.orgId);
    } catch {
      /* noop */
    }
  }, []);

  const fetchCoupons = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const token = getToken();
      if (!token) return;
      const q = filterType === "all" ? "" : `?productType=${filterType}`;
      const resp = await api<{
        success: boolean;
        coupons: PlatformCoupon[];
        total: number;
      }>(`/org/${orgId}/platform-coupons${q}`, {}, token);
      setCoupons(resp.coupons || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, filterType]);

  const resetForm = () => {
    setForm({
      code: "",
      name: "",
      description: "",
      productType: "course",
      discountType: "percent",
      discountValue: "",
      maxDiscountAmount: "",
      currency: "USD",
      cycleCount: "1",
      validFrom: "",
      validUntil: "",
      maxUsageCount: "",
      maxUsagePerUser: "",
      minOrderAmount: "",
    });
    setEditing(null);
    setStep(1);
    setSelectedItem(null);
    setEligibleItems([]);
    setEligibleItemsError(null);
    setItemSearch("");
  };

  const openCreate = () => {
    resetForm();
    setEditSheetOpen(true);
  };

  // Fetch eligible items whenever the user lands on step 2 with a productType
  useEffect(() => {
    if (!editSheetOpen || step !== 2 || !orgId) return;
    const ac = new AbortController();
    (async () => {
      setEligibleItemsLoading(true);
      setEligibleItemsError(null);
      try {
        const token = getToken();
        if (!token) return;
        const resp = await api<{ success: boolean; items: EligibleItem[] }>(
          `/org/${orgId}/coupon-eligible-items?productType=${form.productType}`,
          { signal: ac.signal as any },
          token
        );
        setEligibleItems(resp.items || []);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setEligibleItemsError(err?.message || "Failed to load items");
        }
      } finally {
        setEligibleItemsLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSheetOpen, step, form.productType, orgId]);

  const openEdit = async (c: PlatformCoupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      name: c.name,
      description: c.description || "",
      productType: c.productType,
      discountType: c.discountType,
      discountValue:
        c.discountType === "fixed"
          ? String(c.discountValue / 100)
          : String(c.discountValue),
      maxDiscountAmount: c.maxDiscountAmount
        ? String(c.maxDiscountAmount / 100)
        : "",
      currency: c.currency || "USD",
      cycleCount: c.cycleCount ? String(c.cycleCount) : "1",
      validFrom: c.validFrom
        ? new Date(c.validFrom).toISOString().slice(0, 16)
        : "",
      validUntil: c.validUntil
        ? new Date(c.validUntil).toISOString().slice(0, 16)
        : "",
      maxUsageCount: c.maxUsageCount ? String(c.maxUsageCount) : "",
      maxUsagePerUser: c.maxUsagePerUser ? String(c.maxUsagePerUser) : "",
      minOrderAmount: c.minOrderAmount ? String(c.minOrderAmount / 100) : "",
    });
    setStep(3);
    setEditSheetOpen(true);

    // Try to hydrate the linked item so cycleCount visibility is correct
    const linkedItemId = c.specificItemIds?.[0];
    if (linkedItemId && orgId) {
      try {
        const token = getToken();
        if (!token) return;
        const resp = await api<{ success: boolean; items: EligibleItem[] }>(
          `/org/${orgId}/coupon-eligible-items?productType=${c.productType}`,
          {},
          token
        );
        const found = (resp.items || []).find((i) => i._id === linkedItemId);
        if (found) setSelectedItem(found);
      } catch {
        /* ignore — falls back to PRODUCT_META heuristic */
      }
    } else {
      setSelectedItem(null);
    }
  };

  const openDetails = async (c: PlatformCoupon) => {
    if (!orgId) return;
    setDetailsCoupon(c);
    setDetailsSheetOpen(true);
    setRedemptions([]);
    setRedemptionsLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const resp = await api<{
        success: boolean;
        redemptions: Redemption[];
      }>(`/org/${orgId}/platform-coupons/${c._id}/redemptions`, {}, token);
      setRedemptions(resp.redemptions || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load redemptions");
    } finally {
      setRedemptionsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!orgId) return;
    if (!editing && !selectedItem) {
      toast.error("Pick an item before saving the coupon");
      return;
    }
    if (!form.code || !form.name || !form.discountValue) {
      toast.error("Code, name, and discount value are required");
      return;
    }
    const discountValue = parseFloat(form.discountValue);
    if (
      form.discountType === "fixed" &&
      (!Number.isFinite(discountValue) || discountValue <= 0)
    ) {
      toast.error("Fixed amount must be positive");
      return;
    }
    if (
      form.discountType === "percent" &&
      (discountValue < 1 || discountValue > 100)
    ) {
      toast.error("Percent must be between 1 and 100");
      return;
    }
    if (
      isSubscriptionProduct &&
      (!form.cycleCount || parseInt(form.cycleCount) < 1)
    ) {
      toast.error("Cycle count required for subscription coupons");
      return;
    }

    setSaving(true);
    try {
      const token = getToken();
      if (!token) return;
      const body: any = {
        code: form.code.toUpperCase(),
        name: form.name,
        description: form.description || undefined,
        productType: form.productType,
        discountType: form.discountType,
        discountValue:
          form.discountType === "fixed"
            ? Math.round(discountValue * 100)
            : discountValue,
        maxDiscountAmount:
          form.discountType === "percent" && form.maxDiscountAmount
            ? Math.round(parseFloat(form.maxDiscountAmount) * 100)
            : undefined,
        currency: form.currency,
        cycleCount: isSubscriptionProduct ? parseInt(form.cycleCount) : undefined,
        validFrom: form.validFrom
          ? new Date(form.validFrom).toISOString()
          : undefined,
        validUntil: form.validUntil
          ? new Date(form.validUntil).toISOString()
          : undefined,
        maxUsageCount: form.maxUsageCount
          ? parseInt(form.maxUsageCount)
          : undefined,
        maxUsagePerUser: form.maxUsagePerUser
          ? parseInt(form.maxUsagePerUser)
          : undefined,
        minOrderAmount: form.minOrderAmount
          ? Math.round(parseFloat(form.minOrderAmount) * 100)
          : undefined,
        specificItemIds: selectedItem ? [selectedItem._id] : undefined,
      };

      if (editing) {
        const patchBody = { ...body };
        delete patchBody.code;
        delete patchBody.productType;
        delete patchBody.specificItemIds;
        await api(
          `/org/${orgId}/platform-coupons/${editing._id}`,
          { method: "PATCH", body: JSON.stringify(patchBody) },
          token
        );
        toast.success("Coupon updated");
      } else {
        await api(
          `/org/${orgId}/platform-coupons`,
          { method: "POST", body: JSON.stringify(body) },
          token
        );
        toast.success("Coupon created");
      }

      setEditSheetOpen(false);
      resetForm();
      fetchCoupons();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (c: PlatformCoupon) => {
    if (!orgId) return;
    try {
      const token = getToken();
      if (!token) return;
      const action = c.status === "active" ? "deactivate" : "activate";
      await api(
        `/org/${orgId}/platform-coupons/${c._id}/${action}`,
        { method: "POST" },
        token
      );
      toast.success(`Coupon ${action}d`);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const formatDiscount = (c: PlatformCoupon): string => {
    if (c.discountType === "fixed") return `${formatUSD(c.discountValue)} off`;
    const cap = c.maxDiscountAmount
      ? ` up to ${formatUSD(c.maxDiscountAmount)}`
      : "";
    return `${c.discountValue}%${cap}`;
  };

  // Top-of-page stats
  const topStats = useMemo(() => {
    const active = coupons.filter((c) => c.status === "active").length;
    const totalRedemptions = coupons.reduce(
      (s, c) => s + (c.currentUsageCount || 0),
      0
    );
    return { total: coupons.length, active, totalRedemptions };
  }, [coupons]);

  // Client-side search (filters on top of product-type filter from server)
  const visibleCoupons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [coupons, searchQuery]);

  const detailsStats = useMemo(() => {
    if (!redemptions.length) {
      return { totalRedemptions: 0, uniqueUsers: 0, totalSaved: 0 };
    }
    const uniqueUsers = new Set(
      redemptions.map((r) => r.userId?._id).filter(Boolean)
    ).size;
    const totalSaved = redemptions.reduce((sum, r) => {
      const inv = r.parentInvoiceId || r.invoiceId;
      return sum + (inv?.discount || 0);
    }, 0);
    return {
      totalRedemptions: redemptions.length,
      uniqueUsers,
      totalSaved,
    };
  }, [redemptions]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Page tabs: Coupons | Rules */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e0e12] border border-[#2a2a35] w-fit">
        {(["coupons", "rules"] as const).map((t) => {
          const active = pageTab === t;
          return (
            <button
              key={t}
              onClick={() => setPageTab(t)}
              className={cn(
                "px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 capitalize",
                active
                  ? "bg-brand text-brand-foreground"
                  : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
              )}
            >
              {t === "coupons" ? "Coupons" : "Rules"}
            </button>
          );
        })}
      </div>

      {pageTab === "rules" && (
        <CouponRulesTab
          scope="organization"
          rulesEndpoint={orgId ? `/org/${orgId}/coupon-rules` : ""}
          itemsEndpoint={
            orgId ? `/org/${orgId}/coupon-eligible-items/all` : ""
          }
          couponsEndpoint={orgId ? `/org/${orgId}/platform-coupons` : ""}
          authToken={getToken() || ""}
        />
      )}

      {pageTab === "coupons" && (
      <Card className="bg-[#0e0e12] border-[#2a2a35] shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <TicketPercent className="h-5 w-5 text-brand" />
              Coupons
            </CardTitle>
            <CardDescription className="text-[#9fa0b8]">
              Discount codes for your channels, courses, workshops, products, services, and calls
            </CardDescription>
          </div>
          <Button
            onClick={openCreate}
            className="bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-all duration-200 active:scale-95 shadow-none hover:shadow-[0_0_24px_color-mix(in_srgb,_var(--brand)_25%,_transparent)] group"
          >
            <Plus className="h-4 w-4 mr-1.5 transition-transform duration-300 group-hover:rotate-90" />
            New Coupon
          </Button>
        </CardHeader>
        <CardContent>
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl bg-[#1a1a22] p-3.5 transition-all duration-300 hover:bg-[#1e1e28]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">
                <Layers className="h-3 w-3 text-brand" />
                Total Coupons
              </div>
              <div className="text-2xl font-semibold mt-1.5 text-white tabular-nums">
                {topStats.total}
              </div>
            </div>
            <div className="rounded-xl bg-[#1a1a22] p-3.5 transition-all duration-300 hover:bg-[#1e1e28]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">
                <Zap className="h-3 w-3 text-emerald-400" />
                Active
              </div>
              <div className="text-2xl font-semibold mt-1.5 text-white tabular-nums">
                {topStats.active}
              </div>
            </div>
            <div className="rounded-xl bg-[#1a1a22] p-3.5 transition-all duration-300 hover:bg-[#1e1e28]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">
                <Activity className="h-3 w-3 text-blue-400" />
                Total Redemptions
              </div>
              <div className="text-2xl font-semibold mt-1.5 text-white tabular-nums">
                {topStats.totalRedemptions}
              </div>
            </div>
          </div>

          {/* Search + Filter pills */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b80]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code, name…"
                className="w-full pl-8 h-8 text-xs rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors"
              />
            </div>
            <span className="text-xs text-[#6b6b80]">Filter:</span>
            {(
              [
                "all",
                "channel",
                "course",
                "workshop",
                "product",
                "service",
                "call",
              ] as const
            ).map((t) => {
              const active = filterType === t;
              return (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  data-active={active}
                  className={cn(
                    "h-7 px-3 text-xs rounded-full transition-all duration-200",
                    active
                      ? "bg-brand text-brand-foreground font-medium"
                      : "bg-[#1a1a22] text-[#9fa0b8] hover:text-white hover:bg-[#1e1e28] active:scale-95"
                  )}
                >
                  {t === "all" ? "All" : getProductMeta(t).label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-lg bg-[#1a1a22] animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="h-4 w-20 bg-[#2a2a35] rounded" />
                  <div className="h-4 w-28 bg-[#2a2a35] rounded" />
                  <div className="h-4 w-16 bg-[#2a2a35] rounded" />
                  <div className="h-4 w-12 bg-[#2a2a35] rounded" />
                  <div className="h-4 w-16 bg-[#2a2a35] rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <div className="flex flex-col items-center py-20 animate-in fade-in duration-500">
              <div className="p-4 rounded-full bg-[#1a1a22] mb-3 animate-pulse">
                <TicketPercent className="h-7 w-7 text-[#6b6b80]" />
              </div>
              <p className="text-sm font-medium text-[#9fa0b8]">No coupons yet</p>
              <p className="text-xs text-[#6b6b80] mt-1">
                Create your first coupon to reward your customers
              </p>
            </div>
          ) : visibleCoupons.length === 0 ? (
            <div className="flex flex-col items-center py-16 animate-in fade-in duration-500">
              <Search className="h-7 w-7 text-[#6b6b80] mb-3" />
              <p className="text-sm text-[#9fa0b8]">No coupons match your search</p>
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-brand hover:text-brand/80 mt-1 transition-colors"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-[#0a0a0d] p-1">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-[#1a1a22]">
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">Code</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">Product</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">Discount</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">Cycles</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">Usage</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">Valid</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">Status</TableHead>
                    <TableHead className="text-right text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCoupons.map((c, idx) => {
                    const meta = getProductMeta(c.productType);
                    return (
                      <TableRow
                        key={c._id}
                        className="group animate-in fade-in slide-in-from-bottom-1 duration-300 hover:bg-[#1a1a22] transition-all relative border-b border-[#1a1a22]/60 [&_td]:relative"
                        style={{
                          animationDelay: `${Math.min(idx, 12) * 30}ms`,
                          animationFillMode: "both",
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <code className="font-mono text-sm font-semibold text-white tracking-wide">
                              {c.code}
                            </code>
                            <button
                              onClick={() => copyCode(c.code)}
                              className="text-[#6b6b80] hover:text-brand transition-all duration-150 active:scale-90"
                              title="Copy"
                            >
                              {copiedCode === c.code ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-xs text-[#6b6b80] mt-0.5 max-w-[180px] truncate">
                            {c.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-normal transition-opacity hover:opacity-80",
                              meta.accent
                            )}
                          >
                            {meta.icon}
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-white">
                            {formatDiscount(c)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-white">
                          {meta.isSubscription ? c.cycleCount ?? 1 : <span className="text-[#6b6b80]">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-white">
                          {c.currentUsageCount}
                          {c.maxUsageCount ? (
                            <span className="text-[#6b6b80]">
                              {" "}
                              / {c.maxUsageCount}
                            </span>
                          ) : (
                            ""
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-[#9fa0b8]">
                          {c.validUntil
                            ? `Until ${new Date(c.validUntil).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}`
                            : "No expiry"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium capitalize transition-colors",
                              c.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-zinc-500/10 text-zinc-400"
                            )}
                          >
                            {c.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAssignCoupon(c);
                                setAssignSheetOpen(true);
                              }}
                              title="Gift to users"
                              className="h-8 w-8 p-0 text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22] transition-colors"
                            >
                              <Gift className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDetails(c)}
                              title="View redemptions"
                              className="h-8 w-8 p-0 text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22] transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(c)}
                              title="Edit"
                              className="h-8 w-8 p-0 text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22] transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleStatus(c)}
                              title={
                                c.status === "active" ? "Deactivate" : "Activate"
                              }
                              className="h-8 w-8 p-0 text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22] transition-colors"
                            >
                              {c.status === "active" ? (
                                <PowerOff className="h-3.5 w-3.5" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* ============ CREATE / EDIT SHEET ============ */}
      <Sheet
        open={editSheetOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setEditSheetOpen(open);
            if (!open) resetForm();
          }
        }}
      >
        <SheetContent
          side="right"
          className="sm:max-w-[540px] w-full p-0 gap-0 flex flex-col bg-[#0a0a0e] border-l border-[#1a1a22]"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-2 p-5 border-b border-[#1a1a22] bg-[#0a0a0e]">
            <SheetHeader className="p-0">
              <SheetTitle className="flex items-center gap-2 text-lg text-white">
                <TicketPercent className="h-4 w-4 text-brand" />
                {editing ? "Edit Coupon" : "New Coupon"}
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5 text-[#9fa0b8]">
                {editing
                  ? "Structural fields lock once a coupon has been redeemed."
                  : "Create a discount code for your own products."}
              </SheetDescription>
            </SheetHeader>
            <button
              onClick={() => !saving && setEditSheetOpen(false)}
              className="text-[#9fa0b8] hover:text-white transition-colors rounded-md p-1 hover:bg-[#1a1a22]"
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stepper */}
          {!editing && (
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#1a1a22] text-[11px]">
              {[
                { n: 1, label: "Type" },
                { n: 2, label: "Item" },
                { n: 3, label: "Details" },
              ].map(({ n, label }, i, arr) => (
                <div key={n} className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center font-semibold text-[10px] transition-colors",
                      step >= (n as 1 | 2 | 3)
                        ? "bg-brand text-brand-foreground"
                        : "bg-[#1a1a22] text-[#6b6b80]"
                    )}
                  >
                    {n}
                  </div>
                  <span
                    className={cn(
                      "uppercase tracking-wider font-medium",
                      step === n ? "text-brand" : "text-[#6b6b80]"
                    )}
                  >
                    {label}
                  </span>
                  {i < arr.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-px",
                        step > (n as 1 | 2 | 3) ? "bg-brand/40" : "bg-[#1a1a22]"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Step 1: Pick product type */}
            {step === 1 && !editing && (
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">
                    What kind of item is this coupon for?
                  </Label>
                  <p className="text-xs text-[#6b6b80] mt-1">
                    You'll pick a specific item next.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      "channel",
                      "course",
                      "workshop",
                      "product",
                      "service",
                      "call",
                    ] as const
                  ).map((t) => {
                    const meta = PRODUCT_META[t];
                    const active = form.productType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, productType: t })}
                        className={cn(
                          "flex items-center gap-1.5 p-2.5 rounded-lg transition-all duration-200",
                          active
                            ? "bg-brand/10 text-brand"
                            : "bg-[#1a1a22] text-[#9fa0b8] hover:bg-[#1e1e28] hover:text-white"
                        )}
                      >
                        {meta.icon}
                        <span className="text-[11px] font-medium">
                          {meta.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Pick a specific item */}
            {step === 2 && !editing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">
                      Pick a {PRODUCT_META[form.productType].label.toLowerCase()}
                    </Label>
                    <p className="text-xs text-[#6b6b80] mt-1">
                      The coupon will only work for the item you select here.
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b80]" />
                  <input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-8 h-9 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
                  />
                </div>
                {eligibleItemsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-[#6b6b80]" />
                  </div>
                ) : eligibleItemsError ? (
                  <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 text-xs text-red-400">
                    {eligibleItemsError}
                  </div>
                ) : eligibleItems.length === 0 ? (
                  <div className="rounded-lg bg-[#1a1a22] p-6 text-center">
                    <p className="text-sm text-[#9fa0b8]">
                      No {PRODUCT_META[form.productType].label.toLowerCase()}s found in your office.
                    </p>
                    <p className="text-xs text-[#6b6b80] mt-1">
                      Create one first, then come back here to make a coupon for it.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {eligibleItems
                      .filter((it) =>
                        itemSearch.trim()
                          ? it.title
                              .toLowerCase()
                              .includes(itemSearch.trim().toLowerCase())
                          : true
                      )
                      .map((it) => {
                        const sym = it.currency === "INR" ? "₹" : "$";
                        return (
                          <button
                            key={it._id}
                            type="button"
                            onClick={() => {
                              setSelectedItem(it);
                              // If we move to step 3 from a recurring item,
                              // ensure cycleCount has a sensible default
                              if (it.isRecurring && (!form.cycleCount || form.cycleCount === "0")) {
                                setForm((f) => ({ ...f, cycleCount: "1" }));
                              }
                              // Default coupon currency to the item's currency
                              if (it.currency === "INR" || it.currency === "USD") {
                                setForm((f) => ({ ...f, currency: it.currency as "USD" | "INR" }));
                              }
                              setStep(3);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left",
                              "bg-[#1a1a22] hover:bg-[#1e1e28]"
                            )}
                          >
                            <div className="h-12 w-12 rounded-md bg-[#0a0a0e] flex-shrink-0 overflow-hidden flex items-center justify-center">
                              {it.image ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={it.image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                PRODUCT_META[form.productType].icon
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate">
                                {it.title}
                              </div>
                              <div className="text-xs text-[#9fa0b8]">
                                {sym}
                                {it.price.toFixed(2)} {it.currency}
                                {it.recurringDetail ? ` · ${it.recurringDetail}` : ""}
                              </div>
                            </div>
                            {it.isRecurring && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium shrink-0">
                                Recurring
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: details form (also the only step in edit mode) */}
            {step === 3 && (
              <>
                {/* Selected item summary */}
                {selectedItem && (
                  <div className="rounded-lg bg-[#1a1a22] p-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-[#0a0a0e] overflow-hidden flex items-center justify-center shrink-0">
                      {selectedItem.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={selectedItem.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        PRODUCT_META[form.productType].icon
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {selectedItem.title}
                      </div>
                      <div className="text-[11px] text-[#9fa0b8]">
                        {PRODUCT_META[form.productType].label}
                        {selectedItem.recurringDetail ? ` · ${selectedItem.recurringDetail}` : ""}
                      </div>
                    </div>
                    {selectedItem.isRecurring && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium shrink-0">
                        Recurring
                      </span>
                    )}
                  </div>
                )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">Code</Label>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="LAUNCH50"
                  maxLength={20}
                  disabled={!!editing}
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors font-mono tracking-wide text-sm disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">Name</Label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Launch Week 50% Off"
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">Description (optional)</Label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Internal note"
                className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">Discount Type</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["percent", "fixed"] as const).map((t) => {
                    const active = form.discountType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, discountType: t })}
                        className={cn(
                          "h-10 rounded-lg text-xs capitalize font-medium transition-all duration-200",
                          active
                            ? "bg-brand/10 text-brand"
                            : "bg-[#1a1a22] text-[#9fa0b8] hover:bg-[#1e1e28] hover:text-white"
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">
                  {form.discountType === "fixed"
                    ? `Amount (${form.currency})`
                    : "Percent (%)"}
                </Label>
                <input
                  type="number"
                  step={form.discountType === "fixed" ? "0.01" : "1"}
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm({ ...form, discountValue: e.target.value })
                  }
                  placeholder={form.discountType === "fixed" ? "5.00" : "50"}
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">
                Currency
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["USD", "INR"] as const).map((c) => {
                  const active = form.currency === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, currency: c })}
                      className={cn(
                        "h-10 rounded-lg text-xs font-medium transition-all duration-200",
                        active
                          ? "bg-brand/10 text-brand"
                          : "bg-[#1a1a22] text-[#9fa0b8] hover:bg-[#1e1e28] hover:text-white"
                      )}
                    >
                      {c === "USD" ? "🇺🇸 USD" : "🇮🇳 INR"}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#6b6b80]">
                Fixed amounts and caps are auto-converted when applied to invoices in a different currency.
              </p>
            </div>

            {form.discountType === "percent" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">
                  Max Discount Cap ({form.currency}, optional)
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={form.maxDiscountAmount}
                  onChange={(e) =>
                    setForm({ ...form, maxDiscountAmount: e.target.value })
                  }
                  placeholder="e.g. 10.00 — leave empty for flat %"
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
                />
              </div>
            )}

            {isSubscriptionProduct && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200 bg-brand/[0.04] rounded-lg p-3">
                <Label className="text-[11px] uppercase tracking-wider font-medium flex items-center gap-1 text-brand">
                  <Clock className="h-3 w-3" /> Applies for N billing cycles
                </Label>
                <input
                  type="number"
                  value={form.cycleCount}
                  onChange={(e) =>
                    setForm({ ...form, cycleCount: e.target.value })
                  }
                  placeholder="9"
                  min={1}
                  className="w-full h-10 px-3 rounded-lg bg-[#0a0a0e] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#0e0e12] transition-colors text-sm"
                />
                <p className="text-[11px] text-[#6b6b80]">
                  Discount applies to the first N billing cycles of each
                  redeemed subscription.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Valid From
                </Label>
                <input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) =>
                    setForm({ ...form, validFrom: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Valid Until (optional)
                </Label>
                <input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) =>
                    setForm({ ...form, validUntil: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" /> Max Total
                </Label>
                <input
                  type="number"
                  value={form.maxUsageCount}
                  onChange={(e) =>
                    setForm({ ...form, maxUsageCount: e.target.value })
                  }
                  placeholder="∞"
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">Per User</Label>
                <input
                  type="number"
                  value={form.maxUsagePerUser}
                  onChange={(e) =>
                    setForm({ ...form, maxUsagePerUser: e.target.value })
                  }
                  placeholder="1"
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">Min Order</Label>
                <input
                  type="number"
                  step="0.01"
                  value={form.minOrderAmount}
                  onChange={(e) =>
                    setForm({ ...form, minOrderAmount: e.target.value })
                  }
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
                />
              </div>
            </div>
              </>
            )}
          </div>

          <SheetFooter className="border-t border-[#1a1a22] flex-row gap-2 sm:justify-end sticky bottom-0 bg-[#0a0a0e] p-4">
            {step > 1 && !editing ? (
              <button
                onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3)}
                disabled={saving}
                className="h-10 px-4 rounded-lg bg-[#1a1a22] text-[#9fa0b8] hover:text-white hover:bg-[#1e1e28] transition-all active:scale-95 disabled:opacity-50 text-sm font-medium"
              >
                Back
              </button>
            ) : (
              <button
                onClick={() => setEditSheetOpen(false)}
                disabled={saving}
                className="h-10 px-4 rounded-lg bg-[#1a1a22] text-[#9fa0b8] hover:text-white hover:bg-[#1e1e28] transition-all active:scale-95 disabled:opacity-50 text-sm font-medium"
              >
                Cancel
              </button>
            )}

            {step === 1 && !editing && (
              <button
                onClick={() => setStep(2)}
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-brand text-brand-foreground font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-all active:scale-95 disabled:opacity-50 text-sm"
              >
                Continue
              </button>
            )}
            {step === 2 && !editing && (
              <button
                disabled
                className="h-10 px-5 rounded-lg bg-[#1a1a22] text-[#6b6b80] text-sm cursor-not-allowed"
              >
                Pick an item
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-brand text-brand-foreground font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-all active:scale-95 disabled:opacity-50 text-sm flex items-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {editing ? "Saving..." : "Creating..."}
                  </>
                ) : editing ? (
                  "Save Changes"
                ) : (
                  "Create Coupon"
                )}
              </button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ============ DETAILS SHEET ============ */}
      <Sheet
        open={detailsSheetOpen}
        onOpenChange={(open) => {
          setDetailsSheetOpen(open);
          if (!open) {
            setDetailsCoupon(null);
            setRedemptions([]);
          }
        }}
      >
        <SheetContent
          side="right"
          className="sm:max-w-[640px] w-full p-0 gap-0 flex flex-col bg-[#0a0a0e] border-l border-[#1a1a22]"
        >
          {detailsCoupon && (
            <>
              <div className="sticky top-0 z-10 border-b border-[#1a1a22] bg-[#0a0a0e] p-5">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="min-w-0">
                    <SheetHeader className="p-0">
                      <SheetTitle className="flex items-center gap-2 text-lg text-white">
                        <code className="font-mono tracking-wide">
                          {detailsCoupon.code}
                        </code>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-normal",
                            getProductMeta(detailsCoupon.productType).accent
                          )}
                        >
                          {getProductMeta(detailsCoupon.productType).icon}
                          {getProductMeta(detailsCoupon.productType).label}
                        </span>
                      </SheetTitle>
                      <SheetDescription className="text-xs mt-1 text-[#9fa0b8]">
                        {detailsCoupon.name} · {formatDiscount(detailsCoupon)}
                        {detailsCoupon.cycleCount &&
                          detailsCoupon.cycleCount > 1 && (
                            <> · {detailsCoupon.cycleCount} cycles</>
                          )}
                      </SheetDescription>
                    </SheetHeader>
                  </div>
                  <button
                    onClick={() => setDetailsSheetOpen(false)}
                    className="text-[#9fa0b8] hover:text-white transition-colors rounded-md p-1 hover:bg-[#1a1a22]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#1a1a22] p-3.5 transition-all hover:bg-[#1e1e28]">
                    <div className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">
                      Redemptions
                    </div>
                    <div className="text-xl font-semibold mt-1.5 text-emerald-400">
                      {detailsStats.totalRedemptions}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#1a1a22] p-3.5 transition-all hover:bg-[#1e1e28]">
                    <div className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">
                      Users
                    </div>
                    <div className="text-xl font-semibold mt-1.5 text-blue-400">
                      {detailsStats.uniqueUsers}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#1a1a22] p-3.5 transition-all hover:bg-[#1e1e28]">
                    <div className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">
                      Saved
                    </div>
                    <div className="text-xl font-semibold mt-1.5 text-brand">
                      {formatUSD(detailsStats.totalSaved)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <h3 className="text-xs font-semibold text-[#6b6b80] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Receipt className="h-3 w-3" />
                  Redemptions ({redemptions.length})
                </h3>

                {redemptionsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-[#6b6b80]" />
                  </div>
                ) : redemptions.length === 0 ? (
                  <div className="flex flex-col items-center py-16 animate-in fade-in duration-500">
                    <div className="p-3 rounded-full bg-[#1a1a22] mb-3 animate-pulse">
                      <UserIcon className="h-5 w-5 text-[#6b6b80]" />
                    </div>
                    <p className="text-sm text-[#9fa0b8]">No one has used this coupon yet</p>
                    <p className="text-xs text-[#6b6b80] mt-1">
                      Redemptions will appear here in real time
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {redemptions.map((r, idx) => {
                      const invoice = r.parentInvoiceId || r.invoiceId;
                      const user = r.userId;
                      const statusMeta = REDEMPTION_STATUS_META[r.status];
                      const saved = invoice?.discount || 0;
                      return (
                        <div
                          key={r._id}
                          className="group rounded-xl bg-[#1a1a22] p-3.5 transition-all duration-200 hover:bg-[#1e1e28] animate-in fade-in slide-in-from-bottom-1"
                          style={{
                            animationDelay: `${Math.min(idx, 12) * 30}ms`,
                            animationFillMode: "both",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 h-9 w-9 rounded-full bg-[#0a0a0e] flex items-center justify-center">
                              {user?.profilePicture ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={user.profilePicture}
                                  alt=""
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-[10px] font-semibold text-brand">
                                  {initials(user?.name || user?.email || "?")}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white truncate">
                                  {user?.name || "Unnamed user"}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium">
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      statusMeta.dot
                                    )}
                                  />
                                  <span className={statusMeta.text}>
                                    {statusMeta.label}
                                  </span>
                                  {r.cycleCount > 1 && (
                                    <span className="text-[#6b6b80]">
                                      · {r.cyclesApplied}/{r.cycleCount}
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-xs text-[#6b6b80] mt-0.5">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {user?.email || "—"}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 mt-2 text-xs">
                                {invoice ? (
                                  <a
                                    href={`/invoice/${invoice.invoiceNumber}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#9fa0b8] hover:text-brand transition-colors font-mono"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Receipt className="h-3 w-3" />
                                    {invoice.invoiceNumber}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-[#6b6b80]">
                                    No invoice linked
                                  </span>
                                )}
                                {saved > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                                    <CircleDot className="h-2.5 w-2.5" />
                                    {formatUSD(saved)} saved
                                  </span>
                                )}
                                <span className="text-[#6b6b80] ml-auto">
                                  {new Date(r.createdAt).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ============ ASSIGNMENT (GIFT) SHEET ============ */}
      <CouponAssignmentSheet
        open={assignSheetOpen}
        onOpenChange={(open) => {
          setAssignSheetOpen(open);
          if (!open) setAssignCoupon(null);
        }}
        couponId={assignCoupon?._id || null}
        couponCode={assignCoupon?.code}
        couponName={assignCoupon?.name}
        endpointBase={`/org/${orgId}/platform-coupons/:id`}
        authToken={getToken() || ""}
        scope="org"
        orgId={orgId || undefined}
      />
    </div>
  );
}
