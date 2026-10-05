"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tag,
  Plus,
  Percent,
  Users,
  Trash2,
  Edit2,
  Power,
  PowerOff,
  Copy,
  Check,
  Loader2,
  Tv,
  BookOpen,
  GraduationCap,
  Ticket,
  ShoppingBag,
  Sparkles,
  Calendar,
  Infinity,
  Target,
  TrendingUp,
  Clock,
  Zap,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Coupon {
  _id: string;
  code: string;
  discountValue: number;
  scope: "global" | "organization";
  applicableTo: string[];
  specificItemIds?: string[];
  validFrom: string;
  validUntil?: string;
  status: "active" | "inactive" | "expired";
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  currentUsageCount: number;
  minOrderAmount?: number;
  createdAt: string;
}

interface AvailableItem {
  _id: string;
  name: string;
}

interface AvailableItemsResponse {
  success: boolean;
  items: Record<string, AvailableItem[]>;
}

interface NewCouponForm {
  code: string;
  discountValue: number;
  applicableTo: string[];
  specificItemIds: string[];
  targetSpecificItems: boolean;
  validFrom: string;
  validUntil: string;
  maxUsageCount: string;
  maxUsagePerUser: string;
  minOrderAmount: string;
}

// Founders can create coupons for all sellable items (works for both one-time and subscriptions)
const ITEM_TYPES = [
  { value: "channel", label: "Channels", icon: Tv, description: "Premium content channels" },
  { value: "course", label: "Courses", icon: BookOpen, description: "Educational courses" },
  { value: "workshop", label: "Workshops", icon: GraduationCap, description: "Live workshops" },
  { value: "product", label: "Products", icon: ShoppingBag, description: "Digital & physical products" },
  // Events use `event_ticket`, matching the invoice line item — the coupon
  // targets the EVENT, and every tier and add-on under it is covered.
  { value: "event_ticket", label: "Events", icon: Ticket, description: "Event tickets & add-ons" },
];

// Quick preset discount values
const DISCOUNT_PRESETS = [10, 15, 20, 25, 30, 50];

export default function FounderCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<Record<string, AvailableItem[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  const [form, setForm] = useState<NewCouponForm>({
    code: "",
    discountValue: 10,
    applicableTo: [],
    specificItemIds: [],
    targetSpecificItems: false,
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: "",
    maxUsageCount: "",
    maxUsagePerUser: "1",
    minOrderAmount: "",
  });

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setOrgId(payload.orgId);
      } catch (e) {
        console.error("Error parsing token:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (orgId) {
      loadCoupons();
    }
  }, [orgId]);

  const loadCoupons = async () => {
    try {
      const token = getToken();
      if (!token || !orgId) return;

      const response = await api<{ coupons: Coupon[]; total: number }>(
        `/org/${orgId}/coupons`,
        { method: "GET" },
        token
      );
      setCoupons(response?.coupons || []);
    } catch (error) {
      console.error("Error loading coupons:", error);
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableItems = async (types: string[]) => {
    if (types.length === 0 || !orgId) {
      setAvailableItems({});
      return;
    }
    setLoadingItems(true);
    try {
      const token = getToken();
      if (!token) return;

      const response = await api<AvailableItemsResponse>(
        `/org/${orgId}/coupons/available-items?types=${types.join(",")}`,
        { method: "GET" },
        token
      );
      setAvailableItems(response?.items || {});
    } catch (error) {
      console.error("Error loading available items:", error);
      toast.error("Failed to load available items");
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    if (form.discountValue <= 0 || form.discountValue > 100) {
      toast.error("Discount must be between 1 and 100%");
      return;
    }
    if (form.applicableTo.length === 0) {
      toast.error("Please select at least one item type");
      return;
    }

    setSubmitting(true);
    try {
      const token = getToken();
      if (!token || !orgId) return;

      const payload = {
        code: form.code.toUpperCase().trim(),
        name: form.code.toUpperCase().trim(),
        discountValue: form.discountValue,
        applicableTo: form.applicableTo,
        specificItemIds: form.targetSpecificItems && form.specificItemIds.length > 0
          ? form.specificItemIds
          : undefined,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
        maxUsageCount: form.maxUsageCount ? parseInt(form.maxUsageCount) : undefined,
        maxUsagePerUser: form.maxUsagePerUser ? parseInt(form.maxUsagePerUser) : undefined,
        minOrderAmount: form.minOrderAmount ? parseInt(form.minOrderAmount) * 100 : undefined,
      };

      if (editingCoupon) {
        await api(
          `/org/${orgId}/coupons/${editingCoupon._id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
          token
        );
        toast.success("Coupon updated successfully");
      } else {
        await api(
          `/org/${orgId}/coupons`,
          { method: "POST", body: JSON.stringify(payload) },
          token
        );
        toast.success("Coupon created successfully");
      }

      setDialogOpen(false);
      setEditingCoupon(null);
      resetForm();
      loadCoupons();
    } catch (error: any) {
      console.error("Error saving coupon:", error);
      toast.error(error.message || "Failed to save coupon");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      const token = getToken();
      if (!token || !orgId) return;

      const newStatus = coupon.status === "active" ? "inactive" : "active";
      await api(
        `/org/${orgId}/coupons/${coupon._id}`,
        { method: "PATCH", body: JSON.stringify({ status: newStatus }) },
        token
      );
      toast.success(`Coupon ${newStatus === "active" ? "activated" : "deactivated"}`);
      loadCoupons();
    } catch (error) {
      console.error("Error toggling coupon status:", error);
      toast.error("Failed to update coupon status");
    }
  };

  const handleDelete = async (couponId: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;

    try {
      const token = getToken();
      if (!token || !orgId) return;

      await api(`/org/${orgId}/coupons/${couponId}`, { method: "DELETE" }, token);
      toast.success("Coupon deleted successfully");
      loadCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      toast.error("Failed to delete coupon");
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    const hasSpecificItems = coupon.specificItemIds && coupon.specificItemIds.length > 0;
    setForm({
      code: coupon.code,
      discountValue: coupon.discountValue,
      applicableTo: coupon.applicableTo,
      specificItemIds: coupon.specificItemIds || [],
      targetSpecificItems: hasSpecificItems,
      validFrom: coupon.validFrom.split("T")[0],
      validUntil: coupon.validUntil?.split("T")[0] || "",
      maxUsageCount: coupon.maxUsageCount?.toString() || "",
      maxUsagePerUser: coupon.maxUsagePerUser?.toString() || "1",
      minOrderAmount: coupon.minOrderAmount ? (coupon.minOrderAmount / 100).toString() : "",
    });
    if (hasSpecificItems) {
      loadAvailableItems(coupon.applicableTo);
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setForm({
      code: "",
      discountValue: 10,
      applicableTo: [],
      specificItemIds: [],
      targetSpecificItems: false,
      validFrom: new Date().toISOString().split("T")[0],
      validUntil: "",
      maxUsageCount: "",
      maxUsagePerUser: "1",
      minOrderAmount: "",
    });
    setAvailableItems({});
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleApplicableTo = (value: string) => {
    setForm((prev) => {
      // Single select: if already selected, deselect; otherwise select only this one
      const newApplicableTo = prev.applicableTo.includes(value)
        ? []
        : [value];

      return {
        ...prev,
        applicableTo: newApplicableTo,
        specificItemIds: [],
      };
    });
    setAvailableItems({});
  };

  const toggleSpecificItem = (itemId: string) => {
    setForm((prev) => ({
      ...prev,
      specificItemIds: prev.specificItemIds.includes(itemId)
        ? prev.specificItemIds.filter((id) => id !== itemId)
        : [...prev.specificItemIds, itemId],
    }));
  };

  const handleTargetSpecificItemsToggle = (enabled: boolean) => {
    setForm((prev) => ({
      ...prev,
      targetSpecificItems: enabled,
      specificItemIds: enabled ? prev.specificItemIds : [],
    }));
    if (enabled && form.applicableTo.length > 0) {
      loadAvailableItems(form.applicableTo);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-brand/20 border-t-brand animate-spin" />
            <Tag className="w-5 h-5 text-brand absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-[#9fa0b8]">Loading your coupons...</p>
        </div>
      </div>
    );
  }

  const activeCoupons = coupons.filter((c) => c.status === "active").length;
  const totalUsage = coupons.reduce((sum, c) => sum + c.currentUsageCount, 0);
  const avgDiscount = coupons.length > 0
    ? Math.round(coupons.reduce((sum, c) => sum + c.discountValue, 0) / coupons.length)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20">
              <Gift className="w-6 h-6 text-brand" />
            </div>
            Discount Coupons
          </h1>
          <p className="text-[#9fa0b8] mt-1">
            Create and manage promotional codes for your products
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingCoupon(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground font-semibold h-11 px-5 shadow-lg shadow-brand/20">
              <Plus className="w-5 h-5 mr-2" />
              Create Coupon
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-[#0e0e12] border-[#1a1a22] text-white max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand/10">
                  {editingCoupon ? <Edit2 className="w-5 h-5 text-brand" /> : <Sparkles className="w-5 h-5 text-brand" />}
                </div>
                {editingCoupon ? "Edit Coupon" : "Create New Coupon"}
              </DialogTitle>
              <DialogDescription className="text-[#9fa0b8]">
                {editingCoupon
                  ? "Update the coupon details below."
                  : "Set up a discount code that customers can use at checkout."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Coupon Code Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-brand" />
                  Coupon Code
                </Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                  placeholder="e.g., SUMMER20, WELCOME, VIP50"
                  className="bg-[#1a1a22] border-[#2a2a35] text-white text-lg font-mono uppercase tracking-wider h-12"
                  maxLength={20}
                />
                <p className="text-xs text-[#6b6b80]">
                  3-20 characters. Letters, numbers, underscores, and hyphens only.
                </p>
              </div>

              {/* Discount Value Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Percent className="w-4 h-4 text-brand" />
                  Discount Percentage
                </Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {DISCOUNT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm({ ...form, discountValue: preset })}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        form.discountValue === preset
                          ? "bg-brand text-brand-foreground"
                          : "bg-[#1a1a22] text-[#9fa0b8] hover:bg-[#2a2a35] border border-[#2a2a35]"
                      )}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: parseInt(e.target.value) || 0 })}
                    className="bg-[#1a1a22] border-[#2a2a35] text-white text-lg font-semibold h-12 pr-12"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b80] font-medium">%</div>
                </div>
              </div>

              {/* Applicable Items Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-brand" />
                  Applies To
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {ITEM_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = form.applicableTo.includes(type.value);
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => toggleApplicableTo(type.value)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                          isSelected
                            ? "border-brand bg-brand/10"
                            : "border-[#2a2a35] bg-[#1a1a22] hover:border-[#3a3a45]"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          isSelected ? "bg-brand/20" : "bg-[#2a2a35]"
                        )}>
                          <Icon className={cn("w-4 h-4", isSelected ? "text-brand" : "text-[#6b6b80]")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium text-sm", isSelected ? "text-brand" : "text-white")}>
                            {type.label}
                          </p>
                          <p className="text-xs text-[#6b6b80] truncate">{type.description}</p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-brand flex-shrink-0 mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#6b6b80] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-brand" />
                  Works for both one-time purchases and subscriptions
                </p>
              </div>

              {/* Specific Items Targeting (Optional) */}
              {form.applicableTo.length > 0 && (
                <div className="space-y-3 p-4 rounded-xl border border-[#2a2a35] bg-[#1a1a22]/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[#6b6b80]" />
                      <Label className="text-sm text-[#9fa0b8] font-medium">Target Specific Items (Optional)</Label>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTargetSpecificItemsToggle(!form.targetSpecificItems)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        form.targetSpecificItems ? "bg-brand" : "bg-[#2a2a35]"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          form.targetSpecificItems ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-[#6b6b80]">
                    {form.targetSpecificItems
                      ? "Coupon will only apply to selected items below"
                      : "Coupon applies to ALL items of the selected categories"}
                  </p>

                  {form.targetSpecificItems && (
                    <div className="space-y-3 mt-3">
                      {loadingItems ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-[#6b6b80]" />
                          <span className="ml-2 text-[#6b6b80]">Loading items...</span>
                        </div>
                      ) : (
                        <>
                          {form.applicableTo.map((type) => {
                            const items = availableItems[type] || [];
                            const typeInfo = ITEM_TYPES.find((t) => t.value === type);
                            const Icon = typeInfo?.icon || Tag;

                            if (items.length === 0) return null;

                            return (
                              <div key={type} className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-[#6b6b80]" />
                                  <span className="text-sm font-medium text-[#9fa0b8]">
                                    {typeInfo?.label || type}
                                  </span>
                                  <span className="text-xs text-[#6b6b80]">
                                    ({items.length} available)
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pl-6">
                                  {items.map((item) => {
                                    const isSelected = form.specificItemIds.includes(item._id);
                                    return (
                                      <button
                                        key={item._id}
                                        type="button"
                                        onClick={() => toggleSpecificItem(item._id)}
                                        className={cn(
                                          "flex items-center gap-2 p-2 rounded-lg border text-left text-sm transition-all",
                                          isSelected
                                            ? "border-brand bg-brand/10 text-brand"
                                            : "border-[#2a2a35] bg-[#0e0e12] text-[#9fa0b8] hover:border-[#3a3a45]"
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                            isSelected
                                              ? "border-brand bg-brand"
                                              : "border-[#3a3a45]"
                                          )}
                                        >
                                          {isSelected && <Check className="w-3 h-3 text-black" />}
                                        </div>
                                        <span className="truncate">{item.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {Object.values(availableItems).flat().length === 0 && (
                            <p className="text-sm text-[#6b6b80] text-center py-4">
                              No items found for the selected categories
                            </p>
                          )}
                          {form.specificItemIds.length > 0 && (
                            <div className="flex items-center gap-2 pt-2 border-t border-[#2a2a35]">
                              <span className="text-xs text-[#6b6b80]">
                                {form.specificItemIds.length} item(s) selected
                              </span>
                              <button
                                type="button"
                                onClick={() => setForm((prev) => ({ ...prev, specificItemIds: [] }))}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Clear all
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Validity Period Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand" />
                  Validity Period
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-[#6b6b80]">Start Date</Label>
                    <Input
                      type="date"
                      value={form.validFrom}
                      onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#6b6b80]">End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={form.validUntil}
                      onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                      min={form.validFrom}
                    />
                  </div>
                </div>
              </div>

              {/* Usage Limits Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand" />
                  Usage Limits
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-[#6b6b80]">Total Uses</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        value={form.maxUsageCount}
                        onChange={(e) => setForm({ ...form, maxUsageCount: e.target.value })}
                        placeholder="Unlimited"
                        className="bg-[#1a1a22] border-[#2a2a35] text-white"
                      />
                      {!form.maxUsageCount && (
                        <Infinity className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b80]" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#6b6b80]">Per Customer</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.maxUsagePerUser}
                      onChange={(e) => setForm({ ...form, maxUsagePerUser: e.target.value })}
                      placeholder="1"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Minimum Order Amount */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand" />
                  Minimum Order (Optional)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b80] font-medium">$</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    placeholder="No minimum"
                    className="bg-[#1a1a22] border-[#2a2a35] text-white pl-8"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-3 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground font-semibold min-w-[120px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingCoupon ? (
                  "Update Coupon"
                ) : (
                  "Create Coupon"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#1a1a22] to-[#0e0e12] rounded-xl border border-[#2a2a35] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-brand/10">
              <Tag className="w-4 h-4 text-brand" />
            </div>
            <span className="text-xs text-[#6b6b80] uppercase tracking-wider">Total</span>
          </div>
          <p className="text-2xl font-bold text-white">{coupons.length}</p>
          <p className="text-xs text-[#6b6b80] mt-1">Coupons created</p>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a22] to-[#0e0e12] rounded-xl border border-[#2a2a35] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Power className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-[#6b6b80] uppercase tracking-wider">Active</span>
          </div>
          <p className="text-2xl font-bold text-white">{activeCoupons}</p>
          <p className="text-xs text-[#6b6b80] mt-1">Currently usable</p>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a22] to-[#0e0e12] rounded-xl border border-[#2a2a35] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs text-[#6b6b80] uppercase tracking-wider">Usage</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalUsage}</p>
          <p className="text-xs text-[#6b6b80] mt-1">Times redeemed</p>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a22] to-[#0e0e12] rounded-xl border border-[#2a2a35] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Percent className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xs text-[#6b6b80] uppercase tracking-wider">Avg</span>
          </div>
          <p className="text-2xl font-bold text-white">{avgDiscount}%</p>
          <p className="text-xs text-[#6b6b80] mt-1">Average discount</p>
        </div>
      </div>

      {/* Coupons List */}
      {coupons.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-[#1a1a22] to-[#0e0e12] rounded-2xl border border-[#2a2a35]">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8 text-brand" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No Coupons Yet
          </h3>
          <p className="text-[#9fa0b8] mb-6 max-w-sm mx-auto">
            Create your first discount code to boost sales and reward your customers.
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground font-semibold h-11 px-6"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Coupon
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div
              key={coupon._id}
              className={cn(
                "bg-gradient-to-br from-[#1a1a22] to-[#0e0e12] rounded-xl border p-5 transition-all hover:border-[#3a3a45]",
                coupon.status === "active" ? "border-[#2a2a35]" : "border-[#1a1a22] opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Code and Status */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#0e0e12] rounded-lg border border-[#2a2a35]">
                      <code className="text-brand font-mono text-lg font-bold tracking-wider">
                        {coupon.code}
                      </code>
                      <button
                        onClick={() => copyCode(coupon.code)}
                        className="p-1 hover:bg-[#1a1a22] rounded transition-colors"
                      >
                        {copiedCode === coupon.code ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-[#6b6b80] hover:text-white" />
                        )}
                      </button>
                    </div>
                    <Badge
                      className={cn(
                        "text-xs font-medium px-2.5 py-1",
                        coupon.status === "active"
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : coupon.status === "expired"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                      )}
                    >
                      {coupon.status}
                    </Badge>
                    <div className="px-3 py-1 bg-brand/10 rounded-lg">
                      <span className="text-brand font-bold">{coupon.discountValue}% OFF</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#9fa0b8]">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      {coupon.currentUsageCount}
                      {coupon.maxUsageCount ? ` / ${coupon.maxUsageCount}` : ""} uses
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {new Date(coupon.validFrom).toLocaleDateString()}
                      {coupon.validUntil && ` - ${new Date(coupon.validUntil).toLocaleDateString()}`}
                    </span>
                    {coupon.minOrderAmount && (
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        Min ${coupon.minOrderAmount / 100}
                      </span>
                    )}
                  </div>

                  {/* Applicable Items */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {coupon.applicableTo.map((type) => {
                      const item = ITEM_TYPES.find((t) => t.value === type);
                      const Icon = item?.icon || Tag;
                      return (
                        <div
                          key={type}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0e12] border border-[#2a2a35] text-xs text-[#9fa0b8]"
                        >
                          <Icon className="w-3 h-3" />
                          {item?.label || type}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(coupon)}
                    className="h-9 w-9 p-0 text-[#6b6b80] hover:text-white hover:bg-[#1a1a22]"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(coupon)}
                    className={cn(
                      "h-9 w-9 p-0 hover:bg-[#1a1a22]",
                      coupon.status === "active"
                        ? "text-green-400 hover:text-green-300"
                        : "text-[#6b6b80] hover:text-white"
                    )}
                  >
                    {coupon.status === "active" ? (
                      <Power className="w-4 h-4" />
                    ) : (
                      <PowerOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(coupon._id)}
                    className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
