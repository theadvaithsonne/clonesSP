"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Loader2, TicketPercent, Check, X, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";

export type PlatformProductType =
  | "office_plan"
  | "unilevel_plus"
  | "third_party_subscription"
  | "channel"
  | "course"
  | "workshop"
  | "product"
  | "service"
  | "call"
  | "ecommerce";

/**
 * Map an invoice line item's itemType (from the Invoice schema) to the
 * platform-coupon productType. Most names are 1:1 — only `ecommerce_item`
 * differs because ecommerce coupons are scoped to the whole cart.
 *
 * Mirrors the backend helper in `models/invoice.model.ts` —
 * keep the two in sync.
 */
export function couponProductTypeForItem(
  itemType: string | undefined
): PlatformProductType | undefined {
  if (!itemType) return undefined;
  if (itemType === "ecommerce_item") return "ecommerce";
  if (
    itemType === "office_plan" ||
    itemType === "unilevel_plus" ||
    itemType === "third_party_subscription" ||
    itemType === "channel" ||
    itemType === "course" ||
    itemType === "workshop" ||
    itemType === "product" ||
    itemType === "service" ||
    itemType === "call"
  ) {
    return itemType;
  }
  return undefined;
}

export interface AppliedPlatformCoupon {
  code: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  maxDiscountAmount?: number;
  cycleCount?: number;
  discount: number;
  finalAmount: number;
  willBeFree: boolean;
  productType: PlatformProductType;
  /** Currency the coupon's amounts are denominated in */
  currency?: "USD" | "INR";
}

interface PlatformCouponInputProps {
  productType: PlatformProductType;
  /** Amount in cents (original, pre-discount) */
  amountCents: number;
  userId?: string;
  /**
   * Org ID of the item being purchased (required for founder coupons).
   * Accepts either a raw id string or a populated `{ _id, ... }` object —
   * we normalize before sending to the API.
   */
  orgId?: string | { _id?: string } | null;
  /** Specific item being purchased (enables item-level gating). */
  itemId?: string | { _id?: string } | null;
  /** Currency of the invoice/item amount — USD or INR */
  invoiceCurrency?: "USD" | "INR";
  /**
   * Persist the coupon against the real invoice. MUST throw (or reject) if
   * that write fails — the green "applied" state is only shown once this
   * resolves, so a silent failure would tell the buyer their discount landed
   * when the invoice still holds the full amount.
   */
  onApplied?: (applied: AppliedPlatformCoupon) => void | Promise<void>;
  onRemoved?: () => void;
  disabled?: boolean;
  className?: string;
  /** Optional JWT bearer token. When omitted, validates as guest. */
  authToken?: string;
}

const PRODUCT_LABEL: Record<PlatformProductType, string> = {
  office_plan: "this subscription",
  unilevel_plus: "Unilevel Plus",
  third_party_subscription: "this subscription",
  channel: "this channel",
  course: "this course",
  workshop: "this workshop",
  product: "this product",
  service: "this service",
  call: "this call",
  ecommerce: "this order",
};

export function PlatformCouponInput({
  productType,
  amountCents,
  userId,
  orgId,
  itemId,
  invoiceCurrency = "USD",
  onApplied,
  onRemoved,
  disabled,
  className,
  authToken,
}: PlatformCouponInputProps) {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedPlatformCoupon | null>(null);

  const handleApply = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setValidating(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      // Defensive normalization: callers sometimes pass populated mongoose
      // refs (e.g. `{ _id, name }`) instead of plain id strings. The API
      // expects strings; coerce here so all call sites stay simple.
      const toIdString = (v: unknown): string | undefined => {
        if (!v) return undefined;
        if (typeof v === "string") return v;
        if (typeof v === "object" && v !== null && "_id" in v) {
          const id = (v as any)._id;
          return typeof id === "string" ? id : undefined;
        }
        return undefined;
      };
      const res = await fetch(
        `${API_URL}/checkout/validate-platform-coupon`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            code: trimmed,
            productType,
            amountCents,
            orgId: toIdString(orgId),
            itemId: toIdString(itemId),
            userId,
            itemCurrency: invoiceCurrency,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        // The backend returns {success:false, error} for known validation errors
        // including product-type mismatch ("This coupon is not valid for <product>").
        setError(data.error || "Invalid coupon");
        setApplied(null);
        return;
      }

      const applied: AppliedPlatformCoupon = {
        code: data.coupon.code,
        discountType: data.coupon.discountType,
        discountValue: data.coupon.discountValue,
        maxDiscountAmount: data.coupon.maxDiscountAmount,
        cycleCount: data.coupon.cycleCount,
        discount: data.discount,
        finalAmount: data.finalAmount,
        willBeFree: data.willBeFree,
        productType: data.coupon.productType,
        currency: data.coupon.currency,
      };
      // Validation only proves the CODE is good; it says nothing about whether
      // the invoice accepted it. Wait for the consumer to persist it before
      // claiming success — previously this rendered the green box first and
      // ignored the result, so a rejected coupon still displayed as applied
      // while the totals (and the Razorpay sheet) kept the full amount.
      await onApplied?.(applied);
      setApplied(applied);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to validate coupon");
    } finally {
      setValidating(false);
    }
  }, [code, productType, amountCents, authToken, onApplied]);

  const handleRemove = useCallback(() => {
    setApplied(null);
    setCode("");
    setError(null);
    onRemoved?.();
  }, [onRemoved]);

  if (applied) {
    const invoiceSymbol = invoiceCurrency === "INR" ? "₹" : "$";
    const couponSymbol = applied.currency === "INR" ? "₹" : "$";
    // `applied.discount` and `applied.finalAmount` come back from the backend
    // already in the invoice's currency (the backend converts if needed).
    const fmt = (cents: number) =>
      `${invoiceSymbol}${(cents / 100).toFixed(2)}`;
    // `applied.discountValue` and `applied.maxDiscountAmount` are stored in
    // the coupon's currency — show that symbol in the label.
    const discountLabel =
      applied.discountType === "fixed"
        ? `${couponSymbol}${(applied.discountValue / 100).toFixed(2)} off`
        : `${applied.discountValue}% off${
            applied.maxDiscountAmount
              ? ` (up to ${couponSymbol}${(applied.maxDiscountAmount / 100).toFixed(2)})`
              : ""
          }`;
    return (
      <div
        className={cn(
          "rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-emerald-500/10 shrink-0">
            <Check className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-sm font-semibold text-emerald-500">
                {applied.code}
              </code>
              <span className="text-xs text-emerald-500/80">
                {discountLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              You save {fmt(applied.discount)} —{" "}
              {applied.willBeFree ? (
                <span className="text-emerald-500 font-medium">Free!</span>
              ) : (
                <>final {fmt(applied.finalAmount)}</>
              )}
            </p>
            {applied.cycleCount && applied.cycleCount > 1 && (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
                Applies to your next {applied.cycleCount} billing cycles. Cannot be removed once redeemed.
              </p>
            )}
          </div>
          <button
            onClick={handleRemove}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground shrink-0"
            title="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <TicketPercent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
            placeholder="Have a coupon code?"
            disabled={disabled || validating}
            maxLength={20}
            className="pl-8 font-mono text-sm"
          />
        </div>
        <Button
          type="button"
          onClick={handleApply}
          disabled={disabled || validating || !code.trim()}
          size="sm"
        >
          {validating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Apply"
          )}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <X className="h-3 w-3" />
          {error}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Enter a coupon code valid for {PRODUCT_LABEL[productType]}.
      </p>
    </div>
  );
}
