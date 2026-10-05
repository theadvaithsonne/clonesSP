"use client";

import { useEffect, useState, useRef, useMemo, forwardRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Loader2,
  X,
  ChevronDown,
  Search,
  Lock,
  Info,
  Tv,
  GraduationCap,
  BookOpen,
  ShoppingBag,
  Sparkles,
  Phone,
  Zap,
  Building2,
  Layers,
  Network,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import type {
  CouponRule,
  CouponRuleProductType,
  CouponRuleScope,
} from "./CouponRulesTab";

interface EligibleItem {
  _id: string;
  productType: CouponRuleProductType;
  title: string;
  price: number;
  currency: string;
  image?: string;
  isRecurring: boolean;
  recurringDetail?: string;
}

interface CouponSummary {
  _id: string;
  code: string;
  name: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  currency?: "USD" | "INR";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where rules CRUD lives — e.g. "/garage-admin/coupon-rules" or "/org/{orgId}/coupon-rules". */
  rulesEndpoint: string;
  /** Unified items picker endpoint. */
  itemsEndpoint: string;
  /** Coupon list endpoint (filtered to scope-appropriate coupons). */
  couponsEndpoint: string;
  authToken: string;
  scope: CouponRuleScope;
  editingRule: CouponRule | null;
  onSaved: () => void;
}

const PRODUCT_LABEL: Record<CouponRuleProductType, string> = {
  channel: "Channel",
  course: "Course",
  workshop: "Workshop",
  product: "Product",
  service: "Service",
  call: "Call",
  office_plan: "Office Plan",
  unilevel_plus: "Unilevel Plus",
  third_party_subscription: "Third-party",
};

const PRODUCT_ICON: Record<CouponRuleProductType, React.ReactNode> = {
  channel: <Tv className="h-3 w-3" />,
  course: <GraduationCap className="h-3 w-3" />,
  workshop: <BookOpen className="h-3 w-3" />,
  product: <ShoppingBag className="h-3 w-3" />,
  service: <Sparkles className="h-3 w-3" />,
  call: <Phone className="h-3 w-3" />,
  office_plan: <Building2 className="h-3 w-3" />,
  unilevel_plus: <Layers className="h-3 w-3" />,
  third_party_subscription: <Network className="h-3 w-3" />,
};

export function CouponRuleEditor({
  open,
  onOpenChange,
  rulesEndpoint,
  itemsEndpoint,
  couponsEndpoint,
  authToken,
  editingRule,
  onSaved,
}: Props) {
  // Form state
  const [triggerQty, setTriggerQty] = useState<number>(1);
  const [rewardQty, setRewardQty] = useState<number>(1);
  const [selectedItem, setSelectedItem] = useState<EligibleItem | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponSummary | null>(
    null,
  );
  const [recurrence, setRecurrence] = useState<"once" | "every">("once");
  const [name, setName] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Picker data
  const [items, setItems] = useState<EligibleItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [coupons, setCoupons] = useState<CouponSummary[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);

  // Picker UI
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [couponPickerOpen, setCouponPickerOpen] = useState(false);
  const [couponSearch, setCouponSearch] = useState("");

  const itemPickerRef = useRef<HTMLDivElement>(null);
  const couponPickerRef = useRef<HTMLDivElement>(null);

  // Reset form when sheet opens
  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setTriggerQty(editingRule.triggerQuantity);
      setRewardQty(editingRule.rewardQuantity);
      setName(editingRule.name);
      setRecurrence(editingRule.recurrence);
    } else {
      setTriggerQty(1);
      setRewardQty(1);
      setName("");
      setRecurrence("once");
      setSelectedItem(null);
      setSelectedCoupon(null);
    }
  }, [open, editingRule]);

  // Fetch items + coupons when sheet opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setItemsLoading(true);
      try {
        const res = await fetch(`${API_URL}${itemsEndpoint}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          setItems(data.items || []);
        }
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();
    (async () => {
      setCouponsLoading(true);
      try {
        const res = await fetch(`${API_URL}${couponsEndpoint}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          const filtered = (data.coupons || [])
            .filter((c: any) => c.status === "active")
            .map((c: any) => ({
              _id: c._id,
              code: c.code,
              name: c.name,
              discountType: c.discountType,
              discountValue: c.discountValue,
              currency: c.currency,
            }));
          setCoupons(filtered);
        }
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setCouponsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, itemsEndpoint, couponsEndpoint, authToken]);

  // Hydrate selected item & coupon when editing (once items/coupons arrive)
  useEffect(() => {
    if (!editingRule) return;
    if (items.length && !selectedItem) {
      // Wildcard rules have no triggerItemId — match by sentinel (`*<type>`).
      const targetId =
        editingRule.triggerItemId || `*${editingRule.triggerProductType}`;
      const it = items.find((i) => i._id === targetId);
      if (it) setSelectedItem(it);
    }
    if (coupons.length && !selectedCoupon) {
      const c = coupons.find((cc) => cc._id === editingRule.rewardCouponId);
      if (c) setSelectedCoupon(c);
    }
  }, [editingRule, items, coupons, selectedItem, selectedCoupon]);

  // When the picked item is recurring, force trigger qty to 1
  useEffect(() => {
    if (selectedItem?.isRecurring) setTriggerQty(1);
  }, [selectedItem]);

  // Outside-click for both pickers
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        itemPickerRef.current &&
        !itemPickerRef.current.contains(e.target as Node)
      ) {
        setItemPickerOpen(false);
      }
      if (
        couponPickerRef.current &&
        !couponPickerRef.current.contains(e.target as Node)
      ) {
        setCouponPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.title.toLowerCase().includes(q));
  }, [items, itemSearch]);

  const filteredCoupons = useMemo(() => {
    const q = couponSearch.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [coupons, couponSearch]);

  const formatDiscount = (c: CouponSummary) => {
    const sym = c.currency === "INR" ? "₹" : "$";
    if (c.discountType === "fixed") {
      return `${sym}${(c.discountValue / 100).toFixed(2)} off`;
    }
    return `${c.discountValue}% off`;
  };

  const isValid =
    !!selectedItem && !!selectedCoupon && triggerQty >= 1 && rewardQty >= 1;

  const handleSubmit = async () => {
    if (!selectedItem || !selectedCoupon) {
      toast.error("Pick both an item and a coupon");
      return;
    }
    setSaving(true);
    try {
      // Wildcard sentinel ids start with "*" (e.g. "*third_party_subscription").
      // For those we omit `triggerItemId` so the backend stores a wildcard rule.
      const isWildcard = selectedItem._id.startsWith("*");
      const body: any = {
        triggerProductType: selectedItem.productType,
        triggerQuantity: selectedItem.isRecurring ? 1 : Math.max(1, triggerQty),
        rewardCouponId: selectedCoupon._id,
        rewardQuantity: Math.max(1, rewardQty),
        recurrence,
      };
      if (!isWildcard) body.triggerItemId = selectedItem._id;
      if (name.trim()) body.name = name.trim().slice(0, 100);

      let res: Response;
      if (editingRule) {
        const patchBody: any = {
          name: body.name,
          recurrence: body.recurrence,
          triggerQuantity: body.triggerQuantity,
          rewardQuantity: body.rewardQuantity,
        };
        res = await fetch(`${API_URL}${rulesEndpoint}/${editingRule._id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(patchBody),
        });
      } else {
        res = await fetch(`${API_URL}${rulesEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to save rule");
        return;
      }
      toast.success(editingRule ? "Rule updated" : "Rule created");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-[760px] w-full p-0 gap-0 flex flex-col bg-[#0a0a0e] border-l border-[#1a1a22]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 px-4 py-3 border-b border-[#1a1a22] bg-[#0a0a0e]">
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-base text-white">
              <Zap className="h-4 w-4 text-brand" />
              {editingRule ? "Edit Rule" : "New Rule"}
            </SheetTitle>
            <SheetDescription className="text-[11px] mt-0 text-[#9fa0b8] leading-tight">
              Reward customers automatically based on their purchases.
            </SheetDescription>
          </SheetHeader>
          <button
            onClick={() => !saving && onOpenChange(false)}
            disabled={saving}
            className="text-[#9fa0b8] hover:text-white transition-colors rounded-md p-1 hover:bg-[#1a1a22]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* WHEN */}
          <div className="rounded-xl bg-gradient-to-br from-[#0e0e12] to-[#0a0a0e] border border-[#2a2a35] p-3 transition-all duration-300 hover:border-brand/20">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand">
                When
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-brand/30 to-transparent" />
            </div>
            <div className="text-[13px] text-[#9fa0b8] flex flex-wrap items-center gap-1.5">
              <span>this user buys</span>
              <input
                type="number"
                min={1}
                value={triggerQty}
                onChange={(e) =>
                  setTriggerQty(Math.max(1, parseInt(e.target.value) || 1))
                }
                disabled={selectedItem?.isRecurring || saving}
                className={cn(
                  "h-8 w-12 text-center font-mono text-base font-semibold rounded-lg border-0 focus:outline-none focus:ring-2 transition-all tabular-nums",
                  selectedItem?.isRecurring
                    ? "bg-[#1a1a22] text-[#6b6b80] cursor-not-allowed"
                    : "bg-[#1a1a22] text-white focus:bg-[#1e1e28] focus:ring-brand/40",
                )}
              />
              <span>of</span>
              <ItemPickerChip
                ref={itemPickerRef}
                open={itemPickerOpen}
                onToggle={() => setItemPickerOpen((v) => !v)}
                onClose={() => setItemPickerOpen(false)}
                loading={itemsLoading}
                items={filteredItems}
                search={itemSearch}
                setSearch={setItemSearch}
                selected={selectedItem}
                onSelect={(it) => {
                  setSelectedItem(it);
                  setItemPickerOpen(false);
                }}
                disabled={!!editingRule || saving}
              />
            </div>
            {selectedItem?.isRecurring && (
              <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] animate-in fade-in slide-in-from-top-1 duration-200">
                <Lock className="h-2.5 w-2.5" />
                Subscriptions are purchased once — quantity locked to 1.
              </div>
            )}
          </div>

          {/* THEN */}
          <div className="rounded-xl bg-gradient-to-br from-[#0e0e12] to-[#0a0a0e] border border-[#2a2a35] p-3 transition-all duration-300 hover:border-brand/20">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand">
                Then give them
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-brand/30 to-transparent" />
            </div>
            <div className="text-[13px] text-[#9fa0b8] flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                min={1}
                value={rewardQty}
                onChange={(e) =>
                  setRewardQty(Math.max(1, parseInt(e.target.value) || 1))
                }
                disabled={saving}
                className="h-8 w-12 text-center font-mono text-base font-semibold rounded-lg bg-[#1a1a22] text-white focus:bg-[#1e1e28] focus:outline-none focus:ring-2 focus:ring-brand/40 transition-all tabular-nums"
              />
              <span>{rewardQty === 1 ? "use of" : "uses of"}</span>
              <CouponPickerChip
                ref={couponPickerRef}
                open={couponPickerOpen}
                onToggle={() => setCouponPickerOpen((v) => !v)}
                onClose={() => setCouponPickerOpen(false)}
                loading={couponsLoading}
                coupons={filteredCoupons}
                search={couponSearch}
                setSearch={setCouponSearch}
                selected={selectedCoupon}
                onSelect={(c) => {
                  setSelectedCoupon(c);
                  setCouponPickerOpen(false);
                }}
                formatDiscount={formatDiscount}
                disabled={!!editingRule || saving}
              />
            </div>
          </div>

          {/* HOW OFTEN */}
          <div className="rounded-xl bg-gradient-to-br from-[#0e0e12] to-[#0a0a0e] border border-[#2a2a35] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand">
                How often
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-brand/30 to-transparent" />
            </div>
            <div className="relative grid grid-cols-2 bg-[#1a1a22] rounded-lg p-0.5 gap-0">
              <span
                className={cn(
                  "absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-md bg-brand shadow-[0_2px_6px_color-mix(in_srgb,_var(--brand)_25%,_transparent)] transition-transform duration-300 ease-out",
                  recurrence === "every" && "translate-x-[calc(100%+0.125rem)]",
                )}
              />
              {(["once", "every"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecurrence(r)}
                  disabled={saving}
                  className={cn(
                    "relative z-10 h-7 rounded-md text-[11px] font-semibold transition-colors duration-200",
                    recurrence === r
                      ? "text-black"
                      : "text-[#9fa0b8] hover:text-white",
                  )}
                >
                  {r === "once" ? "One time" : "Every time"}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#6b6b80] mt-1.5 leading-snug">
              {recurrence === "once"
                ? "Fires once when the user first crosses the threshold."
                : "Fires every additional time the user crosses the threshold."}
            </p>
          </div>

          {/* Preview */}
          {selectedItem && selectedCoupon && (
            <div className="rounded-xl bg-brand/[0.04] border border-brand/20 px-3 py-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-2.5 w-2.5 text-brand" />
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand">
                  Preview
                </span>
              </div>
              <p className="text-[12px] text-[#e0e0e8] leading-snug">
                Buy{" "}
                <span className="font-semibold text-white">
                  {selectedItem.isRecurring ? 1 : triggerQty}
                </span>{" "}
                ×{" "}
                <span className="font-semibold text-white">
                  {selectedItem.title}
                </span>
                {" → "}
                Get{" "}
                <span className="font-semibold text-brand">
                  {rewardQty} use{rewardQty === 1 ? "" : "s"}
                </span>{" "}
                of{" "}
                <code className="font-mono font-semibold text-brand">
                  {selectedCoupon.code}
                </code>
                <span className="text-[#9fa0b8]">
                  {" "}
                  ({formatDiscount(selectedCoupon)}){" "}
                </span>
                <span className="text-[#9fa0b8]">·</span>{" "}
                <span className="text-[#9fa0b8]">
                  {recurrence === "once" ? "fires once" : "fires every time"}
                </span>
              </p>
            </div>
          )}

          {/* Optional name */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-[0.14em] text-[#6b6b80] font-bold">
              Internal name (optional)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-generated if left blank"
              disabled={saving}
              maxLength={100}
              className="placeholder:text-xs w-full h-8 px-2.5 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] focus:ring-2 focus:ring-brand/30 transition-all text-[12px]"
            />
          </div>

          <div className="rounded-lg bg-[#1a1a22] border border-[#2a2a35] px-2.5 py-2 flex items-start gap-2 text-[10px] text-[#9fa0b8] leading-snug">
            <Info className="h-3 w-3 text-brand shrink-0 mt-0.5" />
            <span>
              This rule applies only to purchases made{" "}
              <span className="text-white font-medium">after</span> it&apos;s
              created. Past customers won&apos;t be retroactively rewarded.
            </span>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#0a0a0e] p-4 border-t border-[#1a1a22] flex gap-2 justify-end">
          <button
            onClick={() => !saving && onOpenChange(false)}
            disabled={saving}
            className="h-10 px-4 rounded-lg bg-[#1a1a22] text-[#9fa0b8] hover:text-white hover:bg-[#1e1e28] transition-all active:scale-95 disabled:opacity-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="h-10 px-5 rounded-lg bg-brand text-brand-foreground font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-all active:scale-95 disabled:opacity-50 text-sm flex items-center"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                {editingRule ? "Saving..." : "Creating..."}
              </>
            ) : editingRule ? (
              "Save Rule"
            ) : (
              "Create Rule"
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================================================================
// Item picker chip
// =====================================================================

interface ItemPickerChipProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  loading: boolean;
  items: EligibleItem[];
  search: string;
  setSearch: (v: string) => void;
  selected: EligibleItem | null;
  onSelect: (it: EligibleItem) => void;
  disabled?: boolean;
}

const ItemPickerChip = forwardRef<HTMLDivElement, ItemPickerChipProps>(
  function ItemPickerChip(
    {
      open,
      onToggle,
      loading,
      items,
      search,
      setSearch,
      selected,
      onSelect,
      disabled,
    },
    ref,
  ) {
    return (
      <span
        ref={ref as unknown as React.Ref<HTMLSpanElement>}
        className="relative inline-flex align-middle"
      >
        <button
          type="button"
          onClick={() => !disabled && onToggle()}
          disabled={disabled}
          className={cn(
            "group inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#1a1a22] text-white text-[12px] font-medium transition-all max-w-[260px] border border-transparent",
            !disabled && "hover:bg-[#1e1e28] hover:border-brand/30",
            !disabled &&
              open &&
              "border-brand/40 bg-[#1e1e28] ring-2 ring-brand/20",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {selected ? (
            <>
              {selected.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.image}
                  alt=""
                  className="h-5 w-5 rounded object-cover shrink-0 ring-1 ring-[#2a2a35]"
                />
              ) : (
                <span className="h-5 w-5 rounded bg-[#0a0a0e] flex items-center justify-center text-brand shrink-0">
                  {PRODUCT_ICON[selected.productType]}
                </span>
              )}
              <span className="truncate">{selected.title}</span>
              {selected.isRecurring && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold shrink-0">
                  Recurring
                </span>
              )}
            </>
          ) : (
            <span className="text-[#6b6b80]">Select item…</span>
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-[#6b6b80] shrink-0 transition-transform duration-200",
              open && "rotate-180 text-brand",
            )}
          />
        </button>

        {open && !disabled && (
          <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-[360px] max-h-[340px] bg-[#0a0a0e] border border-[#2a2a35] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="relative p-2 border-b border-[#1a1a22]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b80]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                autoFocus
                className="w-full pl-7 h-8 text-sm rounded-md bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-[#6b6b80]" />
                </div>
              ) : items.length === 0 ? (
                <div className="p-4 text-xs text-[#6b6b80] text-center">
                  No items match
                </div>
              ) : (
                items.map((it) => (
                  <button
                    key={`${it.productType}-${it._id}`}
                    type="button"
                    onClick={() => onSelect(it)}
                    className={cn(
                      "w-full flex items-center gap-2.5 p-2.5 transition-all text-left group",
                      selected?._id === it._id
                        ? "bg-brand/10"
                        : "hover:bg-[#1a1a22]",
                    )}
                  >
                    <div className="h-8 w-8 rounded-md bg-[#1a1a22] flex-shrink-0 overflow-hidden flex items-center justify-center ring-1 ring-[#2a2a35] group-hover:ring-brand/30 transition">
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-brand">
                          {PRODUCT_ICON[it.productType]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate font-medium">
                        {it.title}
                      </div>
                      <div className="text-[11px] text-[#6b6b80] flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[#9fa0b8]">
                          {PRODUCT_ICON[it.productType]}
                          {PRODUCT_LABEL[it.productType]}
                        </span>
                        {it.recurringDetail && (
                          <>
                            <span>·</span>
                            <span>{it.recurringDetail}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {it.isRecurring && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold shrink-0">
                        Recurring
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </span>
    );
  },
);

// =====================================================================
// Coupon picker chip
// =====================================================================

interface CouponPickerChipProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  loading: boolean;
  coupons: CouponSummary[];
  search: string;
  setSearch: (v: string) => void;
  selected: CouponSummary | null;
  onSelect: (c: CouponSummary) => void;
  formatDiscount: (c: CouponSummary) => string;
  disabled?: boolean;
}

const CouponPickerChip = forwardRef<HTMLDivElement, CouponPickerChipProps>(
  function CouponPickerChip(
    {
      open,
      onToggle,
      loading,
      coupons,
      search,
      setSearch,
      selected,
      onSelect,
      formatDiscount,
      disabled,
    },
    ref,
  ) {
    return (
      <span
        ref={ref as unknown as React.Ref<HTMLSpanElement>}
        className="relative inline-flex align-middle"
      >
        <button
          type="button"
          onClick={() => !disabled && onToggle()}
          disabled={disabled}
          className={cn(
            "group inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#1a1a22] text-white text-[12px] font-medium transition-all max-w-[260px] border border-transparent",
            !disabled && "hover:bg-[#1e1e28] hover:border-brand/30",
            !disabled &&
              open &&
              "border-brand/40 bg-[#1e1e28] ring-2 ring-brand/20",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {selected ? (
            <>
              <span className="h-6 w-6 rounded-md bg-brand/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-3 w-3 text-brand" />
              </span>
              <code className="text-xs font-mono text-brand font-semibold">
                {selected.code}
              </code>
              <span className="text-[10px] text-[#9fa0b8] truncate">
                {formatDiscount(selected)}
              </span>
            </>
          ) : (
            <span className="text-[#6b6b80]">Select coupon…</span>
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-[#6b6b80] shrink-0 transition-transform duration-200",
              open && "rotate-180 text-brand",
            )}
          />
        </button>

        {open && !disabled && (
          <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-[340px] max-h-[340px] bg-[#0a0a0e] border border-[#2a2a35] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="relative p-2 border-b border-[#1a1a22]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b80]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name…"
                autoFocus
                className="w-full pl-7 h-8 text-sm rounded-md bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-[#6b6b80]" />
                </div>
              ) : coupons.length === 0 ? (
                <div className="p-4 text-xs text-[#6b6b80] text-center">
                  No active coupons. Create a coupon first.
                </div>
              ) : (
                coupons.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => onSelect(c)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2.5 p-3 transition-all text-left group",
                      selected?._id === c._id
                        ? "bg-brand/10"
                        : "hover:bg-[#1a1a22]",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Sparkles className="h-4 w-4 text-brand" />
                      </span>
                      <div className="flex flex-col items-start gap-0.5 min-w-0">
                        <code className="text-xs font-mono text-brand font-semibold">
                          {c.code}
                        </code>
                        <span className="text-[11px] text-[#9fa0b8] truncate max-w-[180px]">
                          {c.name}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-brand/10 text-brand font-semibold shrink-0">
                      {formatDiscount(c)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </span>
    );
  },
);
