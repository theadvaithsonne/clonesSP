"use client";

import { useState, useEffect } from "react";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
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
  Calendar,
  Users,
  Trash2,
  Edit2,
  Power,
  PowerOff,
  Copy,
  Check,
  Loader2,
  Building2,
  Tv,
  BookOpen,
  GraduationCap,
  ShoppingBag,
  Gift,
  Sparkles,
  Info,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";

interface Coupon {
  _id: string;
  code: string;
  discountValue: number;
  scope: "global" | "organization";
  orgId?: {
    _id: string;
    name: string;
  };
  createdBy: {
    _id: string;
    name?: string;
    email?: string;
  };
  createdByType: "garage_admin" | "founder";
  razorpayOfferId?: string;
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
  scope: "global" | "organization";
  razorpayOfferId: string;
  applicableTo: string[];
  specificItemIds: string[];
  targetSpecificItems: boolean;
  validFrom: string;
  validUntil: string;
  maxUsageCount: string;
  maxUsagePerUser: string;
  minOrderAmount: string;
}

const ITEM_TYPES = [
  { value: "channel", label: "Channels", icon: Tv, description: "Creator channels & memberships" },
  { value: "course", label: "Courses", icon: BookOpen, description: "Educational courses" },
  { value: "workshop", label: "Workshops", icon: GraduationCap, description: "Live workshops & events" },
  { value: "product", label: "Products", icon: ShoppingBag, description: "Digital & physical products" },
  { value: "office_plan", label: "Office Plans", icon: Building2, description: "Virtual office subscriptions" },
  { value: "office_addon", label: "Office Add-ons", icon: Plus, description: "Office subscription extras" },
];

const DISCOUNT_PRESETS = [10, 15, 20, 25, 30, 50];

export default function CouponsPage() {
  // Create / edit / activate (all POST-PATCH) vs. delete are separate grants.
  const { canDoAction } = useAdminAccess();
  const canEditCoupons = canDoAction("garage_coupons", "edit-coupons");
  const canDeleteCoupons = canDoAction("garage_coupons", "delete-coupon");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<Record<string, AvailableItem[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  const [form, setForm] = useState<NewCouponForm>({
    code: "",
    discountValue: 10,
    scope: "global",
    razorpayOfferId: "",
    applicableTo: [],
    specificItemIds: [],
    targetSpecificItems: false,
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: "",
    maxUsageCount: "",
    maxUsagePerUser: "1",
    minOrderAmount: "",
  });

  // Shared header search — filters this table server-side (debounced).
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const loadCoupons = async () => {
    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set("q", debouncedSearch);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const response = await garageAdminApi<{ coupons: Coupon[]; total: number }>(
        `/garage-admin/coupons${suffix}`,
        { method: "GET" }
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
    if (types.length === 0) {
      setAvailableItems({});
      return;
    }
    setLoadingItems(true);
    try {
      const response = await garageAdminApi<AvailableItemsResponse>(
        `/garage-admin/coupons/available-items?types=${types.join(",")}`,
        { method: "GET" }
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
      toast.error("Please select at least one applicable item type");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.toUpperCase().trim(),
        name: form.code.toUpperCase().trim(),
        discountValue: form.discountValue,
        scope: form.scope,
        razorpayOfferId: form.razorpayOfferId.trim() || undefined,
        applicableTo: form.applicableTo,
        specificItemIds: form.targetSpecificItems && form.specificItemIds.length > 0
          ? form.specificItemIds
          : undefined,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
        maxUsageCount: form.maxUsageCount ? parseInt(form.maxUsageCount) : undefined,
        maxUsagePerUser: form.maxUsagePerUser ? parseInt(form.maxUsagePerUser) : undefined,
        minOrderAmount: form.minOrderAmount ? parseInt(form.minOrderAmount) * 100 : undefined,
      };

      if (editingCoupon) {
        await garageAdminApi(`/garage-admin/coupons/${editingCoupon._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Coupon updated successfully");
      } else {
        await garageAdminApi("/garage-admin/coupons", {
          method: "POST",
          body: JSON.stringify(payload),
        });
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
      const newStatus = coupon.status === "active" ? "inactive" : "active";
      await garageAdminApi(`/garage-admin/coupons/${coupon._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
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
      await garageAdminApi(`/garage-admin/coupons/${couponId}`, {
        method: "DELETE",
      });
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
      scope: coupon.scope,
      razorpayOfferId: coupon.razorpayOfferId || "",
      applicableTo: coupon.applicableTo,
      specificItemIds: coupon.specificItemIds || [],
      targetSpecificItems: hasSpecificItems,
      validFrom: coupon.validFrom.split("T")[0],
      validUntil: coupon.validUntil?.split("T")[0] || "",
      maxUsageCount: coupon.maxUsageCount?.toString() || "",
      maxUsagePerUser: coupon.maxUsagePerUser?.toString() || "1",
      minOrderAmount: coupon.minOrderAmount ? (coupon.minOrderAmount / 100).toString() : "",
    });
    // Load available items if targeting specific items
    if (hasSpecificItems) {
      loadAvailableItems(coupon.applicableTo);
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setForm({
      code: "",
      discountValue: 10,
      scope: "global",
      razorpayOfferId: "",
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
    toast.success("Coupon code copied!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleApplicableTo = (value: string) => {
    setForm((prev) => {
      // Single select: if already selected, deselect; otherwise select only this one
      const newApplicableTo = prev.applicableTo.includes(value)
        ? []
        : [value];

      // Clear specific items when category changes
      return {
        ...prev,
        applicableTo: newApplicableTo,
        specificItemIds: [],
      };
    });
    // Clear available items cache when category changes
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
      <div className="w-full h-[60vh] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-[#FBD10D] rounded-full animate-spin"></div>
          <p className="text-lg">Loading Coupons...</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#FBD10D]/20 to-[#FBD10D]/5 border border-[#FBD10D]/30">
            <Gift className="w-8 h-8 text-[#FBD10D]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Platform Coupons</h1>
            <p className="text-gray-400">Create and manage discount codes for all checkout flows</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingCoupon(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button
              className="bg-[#FBD10D] hover:bg-[#e6c00c] text-black font-semibold"
              disabled={!canEditCoupons}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111116] border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#FBD10D]/10">
                  <Sparkles className="w-5 h-5 text-[#FBD10D]" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {editingCoupon ? "Edit Coupon" : "Create New Coupon"}
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    {editingCoupon
                      ? "Update the coupon details below."
                      : "Create a platform-wide discount code."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Coupon Code */}
              <div className="space-y-2">
                <Label className="text-white font-medium">Coupon Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., WELCOME20, SUMMER50"
                  className="bg-[#1a1a22] border-gray-700 text-white uppercase text-lg font-mono tracking-wider"
                />
                <p className="text-xs text-gray-500">Users will enter this code at checkout</p>
              </div>

              {/* Discount Value with Presets */}
              <div className="space-y-3">
                <Label className="text-white font-medium">Discount Percentage</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {DISCOUNT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm({ ...form, discountValue: preset })}
                      className={cn(
                        "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                        form.discountValue === preset
                          ? "border-[#FBD10D] bg-[#FBD10D]/10 text-[#FBD10D]"
                          : "border-gray-700 bg-[#1a1a22] text-gray-400 hover:border-gray-600 hover:text-white"
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
                    className="bg-[#1a1a22] border-gray-700 text-white pr-10 text-lg"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Applicable To */}
              <div className="space-y-3">
                <Label className="text-white font-medium">Applicable To</Label>
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
                          "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                          isSelected
                            ? "border-[#FBD10D] bg-[#FBD10D]/10"
                            : "border-gray-700 bg-[#1a1a22] hover:border-gray-600"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          isSelected ? "bg-[#FBD10D]/20" : "bg-gray-800"
                        )}>
                          <Icon className={cn("w-4 h-4", isSelected ? "text-[#FBD10D]" : "text-gray-400")} />
                        </div>
                        <div>
                          <p className={cn("font-medium text-sm", isSelected ? "text-[#FBD10D]" : "text-white")}>
                            {type.label}
                          </p>
                          <p className="text-xs text-gray-500">{type.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specific Items Targeting (Optional) */}
              {form.applicableTo.length > 0 && (
                <div className="space-y-3 p-4 rounded-lg border border-gray-700 bg-gray-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <Label className="text-gray-300 font-medium">Target Specific Items (Optional)</Label>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTargetSpecificItemsToggle(!form.targetSpecificItems)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        form.targetSpecificItems ? "bg-[#FBD10D]" : "bg-gray-600"
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
                  <p className="text-xs text-gray-400">
                    {form.targetSpecificItems
                      ? "Coupon will only apply to selected items below"
                      : "Coupon applies to ALL items of the selected categories"}
                  </p>

                  {form.targetSpecificItems && (
                    <div className="space-y-3 mt-3">
                      {loadingItems ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          <span className="ml-2 text-gray-400">Loading items...</span>
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
                                  <Icon className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-300">
                                    {typeInfo?.label || type}
                                  </span>
                                  <span className="text-xs text-gray-500">
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
                                            ? "border-[#FBD10D] bg-[#FBD10D]/10 text-[#FBD10D]"
                                            : "border-gray-700 bg-[#1a1a22] text-gray-300 hover:border-gray-600"
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                            isSelected
                                              ? "border-[#FBD10D] bg-[#FBD10D]"
                                              : "border-gray-600"
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
                            <p className="text-sm text-gray-500 text-center py-4">
                              No items found for the selected categories
                            </p>
                          )}
                          {form.specificItemIds.length > 0 && (
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                              <span className="text-xs text-gray-400">
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

              {/* Razorpay Offer ID (optional - for first-payment-only discounts) */}
              {(form.applicableTo.includes("office_plan") || form.applicableTo.includes("office_addon")) && (
                <div className="space-y-2 p-4 rounded-lg border border-gray-700 bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-gray-400" />
                    <Label className="text-gray-300 font-medium">Razorpay Offer ID (Optional)</Label>
                  </div>
                  <Input
                    value={form.razorpayOfferId}
                    onChange={(e) => setForm({ ...form, razorpayOfferId: e.target.value })}
                    placeholder="e.g., offer_JHD834hjbxzhd38d (leave empty for permanent discount)"
                    className="bg-[#1a1a22] border-gray-700 text-white"
                  />
                  <p className="text-xs text-gray-400">
                    <span className="text-green-400">Without Razorpay Offer ID:</span> Discount applies to ALL recurring payments permanently.<br />
                    <span className="text-blue-400">With Razorpay Offer ID:</span> Uses Razorpay's offer system (can configure first-payment-only discounts in Razorpay Dashboard).
                  </p>
                </div>
              )}

              {/* Validity Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Valid From</Label>
                  <Input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                    className="bg-[#1a1a22] border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white font-medium">Valid Until</Label>
                  <Input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                    placeholder="Optional"
                    className="bg-[#1a1a22] border-gray-700 text-white"
                  />
                  <p className="text-xs text-gray-500">Leave empty for no expiry</p>
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Max Total Uses</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.maxUsageCount}
                    onChange={(e) => setForm({ ...form, maxUsageCount: e.target.value })}
                    placeholder="Unlimited"
                    className="bg-[#1a1a22] border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white font-medium">Max Per User</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.maxUsagePerUser}
                    onChange={(e) => setForm({ ...form, maxUsagePerUser: e.target.value })}
                    placeholder="1"
                    className="bg-[#1a1a22] border-gray-700 text-white"
                  />
                </div>
              </div>

              {/* Minimum Order Amount */}
              <div className="space-y-2">
                <Label className="text-white font-medium">Minimum Order Amount (INR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    placeholder="No minimum"
                    className="bg-[#1a1a22] border-gray-700 text-white pl-8"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-[#FBD10D] hover:bg-[#e6c00c] text-black font-semibold"
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#111116] to-[#1a1a22] border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Coupons</p>
                <p className="text-3xl font-bold text-white mt-1">{coupons.length}</p>
              </div>
              <div className="p-3 rounded-full bg-[#FBD10D]/10">
                <Tag className="h-6 w-6 text-[#FBD10D]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#111116] to-[#1a1a22] border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active</p>
                <p className="text-3xl font-bold text-green-400 mt-1">{activeCoupons}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <Power className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#111116] to-[#1a1a22] border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Usage</p>
                <p className="text-3xl font-bold text-blue-400 mt-1">{totalUsage}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#111116] to-[#1a1a22] border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg. Discount</p>
                <p className="text-3xl font-bold text-purple-400 mt-1">{avgDiscount}%</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <Percent className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons Table */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Tag className="h-5 w-5 text-[#FBD10D]" />
            All Coupons
          </CardTitle>
          <CardDescription className="text-gray-400">
            View and manage all platform discount codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coupons.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-300">Code</TableHead>
                  <TableHead className="text-gray-300">Discount</TableHead>
                  <TableHead className="text-gray-300">Applies To</TableHead>
                  <TableHead className="text-gray-300">Usage</TableHead>
                  <TableHead className="text-gray-300">Validity</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon._id} className="border-gray-800 hover:bg-[#1a1a22]/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="px-3 py-1.5 bg-gradient-to-r from-[#FBD10D]/20 to-[#FBD10D]/5 rounded-lg text-[#FBD10D] font-mono text-sm font-semibold border border-[#FBD10D]/20">
                          {coupon.code}
                        </code>
                        <button
                          onClick={() => copyCode(coupon.code)}
                          className="p-1.5 hover:bg-[#1a1a22] rounded-lg transition-colors"
                        >
                          {copiedCode === coupon.code ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                          )}
                        </button>
                        {coupon.razorpayOfferId && (
                          <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/10">
                            Razorpay
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xl font-bold text-white">
                        {coupon.discountValue}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {coupon.applicableTo.slice(0, 3).map((type) => {
                          const item = ITEM_TYPES.find((t) => t.value === type);
                          const Icon = item?.icon || Tag;
                          return (
                            <Badge
                              key={type}
                              variant="outline"
                              className="text-xs border-gray-700 text-gray-300 flex items-center gap-1"
                            >
                              <Icon className="w-3 h-3" />
                              {item?.label || type}
                            </Badge>
                          );
                        })}
                        {coupon.applicableTo.length > 3 && (
                          <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                            +{coupon.applicableTo.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-white font-medium">{coupon.currentUsageCount}</span>
                        {coupon.maxUsageCount && (
                          <span className="text-gray-400">/ {coupon.maxUsageCount}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1 text-gray-300">
                          <Calendar className="w-3 h-3" />
                          {new Date(coupon.validFrom).toLocaleDateString()}
                        </div>
                        {coupon.validUntil && (
                          <div className="text-gray-500 text-xs mt-0.5">
                            to {new Date(coupon.validUntil).toLocaleDateString()}
                          </div>
                        )}
                        {!coupon.validUntil && (
                          <div className="text-gray-500 text-xs mt-0.5">No expiry</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "font-medium",
                          coupon.status === "active"
                            ? "bg-green-500/20 text-green-300 border-green-500/30"
                            : coupon.status === "expired"
                            ? "bg-red-500/20 text-red-300 border-red-500/30"
                            : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                        )}
                      >
                        {coupon.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canEditCoupons && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(coupon)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {canEditCoupons && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(coupon)}
                            className={cn(
                              "h-8 w-8 p-0",
                              coupon.status === "active"
                                ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                : "text-gray-400 hover:text-white hover:bg-gray-800"
                            )}
                          >
                            {coupon.status === "active" ? (
                              <Power className="w-4 h-4" />
                            ) : (
                              <PowerOff className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        {canDeleteCoupons && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(coupon._id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16">
              <div className="p-4 rounded-full bg-gray-800/50 inline-block mb-4">
                <Tag className="h-12 w-12 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Coupons Created Yet
              </h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Create your first discount code to offer promotions across the platform.
              </p>
              {canEditCoupons && (
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="bg-[#FBD10D] hover:bg-[#e6c00c] text-black font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Coupon
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
              <Info className="w-5 h-5 text-blue-400" />
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-white">About Platform Coupons</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Coupons work for all 6 item types: Channels, Courses, Workshops, Products, Office Plans & Add-ons</li>
                <li>• All coupons apply discounts to <span className="text-green-300">ALL recurring payments</span> (permanent discount)</li>
                <li>• Optional: Add a <span className="text-blue-300">Razorpay Offer ID</span> for first-payment-only discounts (configured in Razorpay Dashboard)</li>
                <li>• <span className="text-yellow-300">Founders</span> can create their own coupons for their items (Channels, Courses, Workshops, Products)</li>
                <li>• Platform coupons created here apply globally across the marketplace</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
