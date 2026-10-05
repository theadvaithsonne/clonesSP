"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Loader2, Tag, Check, X, Percent, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: {
    _id: string;
    code: string;
    discountValue: number;
    razorpayOfferId?: string;
  };
  discountAmount?: number;
  finalAmount?: number;
}

export interface AppliedCoupon {
  code: string;
  discountValue: number;
  discountAmount: number;
  finalAmount: number;
  hasRazorpayOffer?: boolean;
}

interface CouponInputProps {
  /** Item type for validation (e.g., "channel", "course", "office_plan") */
  itemType: string;
  /** Item ID for validation */
  itemId: string;
  /** Original amount in smallest currency unit (e.g., paise) */
  amount: number;
  /** Currency code for formatting (default: INR) */
  currency?: string;
  /** Callback when coupon is successfully applied */
  onCouponApplied?: (coupon: AppliedCoupon) => void;
  /** Callback when coupon is removed */
  onCouponRemoved?: () => void;
  /** Optional organization ID for org-specific coupons */
  orgId?: string;
  /** Optional user ID for per-user limits */
  userId?: string;
  /** Additional class names */
  className?: string;
  /** Disable the input */
  disabled?: boolean;
}

export function CouponInput({
  itemType,
  itemId,
  amount,
  currency = "USD",
  onCouponApplied,
  onCouponRemoved,
  orgId,
  userId,
  className,
  disabled = false,
}: CouponInputProps) {
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const formatPrice = useCallback(
    (priceInPaise: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
      }).format(priceInPaise / 100);
    },
    [currency]
  );

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setError("Please enter a coupon code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const code = couponCode.trim().toUpperCase();

      // Try platform coupon validation first (new system).
      // If the code is a platform coupon, we use its validation — including
      // "not valid for this item" errors when product types mismatch.
      const platformRes = await fetch(
        `${API_URL}/checkout/validate-platform-coupon`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            productType: itemType,
            amountCents: amount,
            orgId,
            itemId,
            userId,
          }),
        }
      );
      const platformData = await platformRes.json().catch(() => null);

      // If platform validation found this code (either valid OR rejected with a
      // clear error about mismatch), use that result — don't fall through to
      // legacy, because the code IS known in the platform system.
      if (platformData) {
        if (platformData.success) {
          const applied: AppliedCoupon = {
            code: platformData.coupon.code,
            discountValue: platformData.coupon.discountValue,
            discountAmount: platformData.discount,
            finalAmount: platformData.finalAmount,
            hasRazorpayOffer: false,
          };
          setAppliedCoupon(applied);
          onCouponApplied?.(applied);
          setLoading(false);
          return;
        }
        // Distinguish: if the error says "not valid for this item" (product
        // mismatch/org mismatch) → surface that clearly. If it's "Invalid
        // coupon code" (not found), fall through to legacy.
        const errMsg = (platformData.error || "").toLowerCase();
        const knownMismatch =
          errMsg.includes("not valid for this item") ||
          errMsg.includes("already used") ||
          errMsg.includes("expired") ||
          errMsg.includes("not yet valid") ||
          errMsg.includes("usage limit") ||
          errMsg.includes("minimum order");
        if (knownMismatch) {
          setError(platformData.error);
          setLoading(false);
          return;
        }
        // else: not found in platform → fall through to legacy
      }

      // Legacy coupon validation fallback
      const res = await fetch(`${API_URL}/checkout/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          itemType,
          itemId,
          amount,
          userId,
          orgId,
        }),
      });

      const data: CouponValidationResult = await res.json();

      if (data.valid && data.coupon && data.discountAmount !== undefined) {
        const applied: AppliedCoupon = {
          code: data.coupon.code,
          discountValue: data.coupon.discountValue,
          discountAmount: data.discountAmount,
          finalAmount: data.finalAmount || amount - data.discountAmount,
          hasRazorpayOffer: !!data.coupon.razorpayOfferId,
        };
        setAppliedCoupon(applied);
        onCouponApplied?.(applied);
      } else {
        setError(data.error || "Invalid coupon code");
      }
    } catch (err) {
      console.error("Coupon validation error:", err);
      setError("Failed to validate coupon");
    } finally {
      setLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setError(null);
    onCouponRemoved?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && couponCode.trim()) {
      e.preventDefault();
      validateCoupon();
    }
  };

  // Coupon applied state - show success with discount details
  if (appliedCoupon) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 p-4">
          {/* Decorative sparkle */}
          <Sparkles className="absolute -top-1 -right-1 w-12 h-12 text-green-500/20" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-green-400 text-sm">
                    {appliedCoupon.code}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                    <Percent className="w-3 h-3" />
                    {appliedCoupon.discountValue}% off
                  </span>
                </div>
                <p className="text-sm text-[#9fa0b8] mt-1">
                  You save{" "}
                  <span className="text-green-400 font-medium">
                    {formatPrice(appliedCoupon.discountAmount)}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={removeCoupon}
              disabled={disabled}
              className="flex-shrink-0 p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Remove coupon"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Input state
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9fa0b8]" />
          <Input
            type="text"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter coupon code"
            disabled={loading || disabled}
            className={cn(
              "pl-10 h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] uppercase tracking-wider font-medium transition-all",
              "focus:border-brand focus:ring-brand/20",
              error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
            )}
          />
        </div>
        <Button
          onClick={validateCoupon}
          disabled={loading || !couponCode.trim() || disabled}
          variant="outline"
          className={cn(
            "h-11 px-5 rounded-xl border-[#2a2a35] bg-[#1a1a22] text-white font-medium transition-all",
            "hover:bg-brand hover:text-brand-foreground hover:border-brand",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#1a1a22] disabled:hover:text-white disabled:hover:border-[#2a2a35]"
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Apply"
          )}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

export default CouponInput;
