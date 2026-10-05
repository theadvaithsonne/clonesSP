"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TicketPercent,
  Loader2,
  Copy,
  Check,
  Gift,
  Building2,
  Shield,
  User as UserIcon,
  Sparkles,
  Clock,
  DollarSign,
  Wallet,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AnimatePresence, motion } from "framer-motion";
import { GiftRewardModal } from "./GiftRewardModal";
import {
  PendingCouponOffer,
  approveCouponOffer,
  cancelCouponOffer,
  listIncomingOffers,
  listOutgoingOffers,
  rejectCouponOffer,
} from "@/lib/rewards-api";

type Status = "active" | "used" | "revoked" | "expired";

interface Reward {
  _id: string;
  status: Status;
  couponCode: string;
  coupon: {
    _id: string;
    code: string;
    name: string;
    description?: string;
    productType: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    maxDiscountAmount?: number;
    currency: "USD" | "INR";
    cycleCount?: number;
    validUntil?: string;
    status: string;
  } | null;
  assignedByType: "garage_admin" | "founder" | "system" | "user";
  assigner: {
    label: string;
    userId?: string;
    name?: string;
    email?: string;
    profilePicture?: string;
    orgId?: string;
    orgName?: string;
  };
  reason?: string;
  giftMessage?: string;
  availableUses?: number;
  expiresAt?: string;
  redeemedAt?: string;
  createdAt: string;
}

const PRODUCT_LABELS: Record<string, string> = {
  office_plan: "Office Plans",
  unilevel_plus: "Unilevel Plus",
  third_party_subscription: "Subscriptions",
  channel: "Channels",
  course: "Courses",
  workshop: "Workshops",
  product: "Products",
  service: "Services",
  call: "Calls",
};

function discountLabel(c: {
  discountType: "fixed" | "percent";
  discountValue: number;
  maxDiscountAmount?: number;
  currency: "USD" | "INR";
}): string {
  const sym = c.currency === "INR" ? "₹" : "$";
  if (c.discountType === "fixed") {
    return `${sym}${(c.discountValue / 100).toFixed(2)} off`;
  }
  const cap = c.maxDiscountAmount
    ? ` (up to ${sym}${(c.maxDiscountAmount / 100).toFixed(2)})`
    : "";
  return `${c.discountValue}% off${cap}`;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-400" },
  used: { label: "Used", cls: "bg-blue-500/10 text-blue-400" },
  revoked: { label: "Revoked", cls: "bg-zinc-500/10 text-zinc-400" },
  expired: { label: "Expired", cls: "bg-amber-500/10 text-amber-400" },
};

function AssignerPill({ reward }: { reward: Reward }) {
  const a = reward.assigner;
  const t = reward.assignedByType;
  const icon =
    t === "user" ? (
      <UserIcon className="h-3 w-3" />
    ) : t === "founder" ? (
      <Building2 className="h-3 w-3" />
    ) : (
      <Shield className="h-3 w-3" />
    );
  const labelPrefix =
    t === "user" ? "Gift from" : t === "founder" ? "From" : "From";
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-brand/10 text-brand text-[11px]">
      {a.profilePicture ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={a.profilePicture}
          alt=""
          className="h-3.5 w-3.5 rounded-full object-cover"
        />
      ) : (
        icon
      )}
      <span>
        {labelPrefix} {a.label}
      </span>
    </div>
  );
}

// ─── Incoming offer row (recipient sees this) ─────────────────────────

function IncomingOfferCard({
  offer,
  onApprove,
  onReject,
  busy,
}: {
  offer: PendingCouponOffer;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const c = offer.coupon;
  const cp = offer.counterparty;
  const productLabel = c
    ? PRODUCT_LABELS[c.productType] || c.productType
    : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-3xl p-5 overflow-hidden"
      style={{
        // Mixed off var(--brand) rather than hardcoded yellow so the card
        // follows the office's accent colour.
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--brand) 10%, transparent) 0%, color-mix(in oklab, var(--brand) 2%, transparent) 40%, rgba(255,255,255,0.02) 100%)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklab, var(--brand) 18%, transparent), 0 8px 32px -16px color-mix(in oklab, var(--brand) 25%, transparent)",
      }}
    >
      {/* Soft top-right glow */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-brand/15 blur-3xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-2 mb-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/12 text-brand text-[11px] font-medium">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand" />
          </span>
          Pending offer
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#7a7a8c]">
            Asking
          </div>
          <div className="text-xl font-semibold text-brand tracking-tight tabular-nums">
            ${offer.priceUsd.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-2.5 mb-3">
        {cp?.profilePicture ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cp.profilePicture}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <span className="h-9 w-9 rounded-full bg-linear-to-br from-white/10 to-white/5 ring-1 ring-white/10 flex items-center justify-center text-xs text-white">
            {(cp?.name || cp?.email || "?")[0]?.toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-sm text-white truncate leading-tight">
            {cp?.name || cp?.email || "Unknown"}
          </div>
          <div className="text-[11px] text-[#9fa0b8] truncate mt-0.5">
            wants to sell you this coupon
          </div>
        </div>
      </div>

      {c ? (
        <div className="relative rounded-2xl bg-black/30 ring-1 ring-white/5 p-3 mb-3">
          <div className="flex items-center gap-2 mb-0.5">
            <code className="font-mono text-sm font-semibold text-brand tracking-wide">
              {c.code}
            </code>
          </div>
          <div className="text-sm text-white leading-tight">{c.name}</div>
          <div className="text-[11px] text-[#9fa0b8] mt-1">
            {discountLabel(c)}
            {productLabel ? ` · ${productLabel}` : null}
          </div>
        </div>
      ) : null}

      {offer.message && (
        <div className="relative pl-3 py-1 mb-3 text-xs text-[#9fa0b8] italic before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-linear-to-b before:from-brand before:to-brand/0">
          <Sparkles className="inline h-3 w-3 mr-1 text-brand" />
          {offer.message}
        </div>
      )}

      <div className="relative flex gap-2">
        <button
          onClick={onReject}
          disabled={busy}
          className="flex-1 h-10 text-xs rounded-2xl bg-white/4 text-[#9fa0b8] hover:text-white hover:bg-white/7 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
        >
          <XCircle className="h-3.5 w-3.5" />
          Deny
        </button>
        <button
          onClick={onApprove}
          disabled={busy}
          className="flex-1 h-10 text-xs rounded-2xl bg-brand text-brand-foreground font-semibold hover:opacity-90 shadow-[0_4px_20px_-8px] shadow-brand/60 hover:shadow-[0_8px_28px_-8px] hover:shadow-brand/80 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Pay ${offer.priceUsd.toFixed(2)}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────

export function RewardsTab() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [incoming, setIncoming] = useState<PendingCouponOffer[]>([]);
  const [outgoing, setOutgoing] = useState<PendingCouponOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("active");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [giftReward, setGiftReward] = useState<Reward | null>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const [rewardsRes, inc, out] = await Promise.all([
        fetch(`${API_URL}/me/rewards${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then((r) => r.json()),
        listIncomingOffers().catch(() => ({ offers: [] as PendingCouponOffer[] })),
        listOutgoingOffers().catch(() => ({ offers: [] as PendingCouponOffer[] })),
      ]);
      if (rewardsRes.success) setRewards(rewardsRes.rewards || []);
      setIncoming(inc.offers || []);
      setOutgoing(out.offers || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load rewards");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Lookup: which of my active assignments is currently locked by an
  // outgoing pending offer, and to whom for how much?
  const outgoingByAssignment = useMemo(() => {
    const m = new Map<string, PendingCouponOffer>();
    for (const o of outgoing) {
      // The outgoing list comes from PendingCouponGift rows where I am the
      // sender. The locked assignment's _id matches `fromAssignmentId` on the
      // offer — but our API returns counterparty (the recipient) only. We
      // correlate by counterparty + couponCode (good enough — only one
      // pending offer can exist per assignment by DB constraint).
      // Simpler: trust the offer rows themselves and let the renderer match
      // each reward against its assignment id via the offer's
      // fromAssignmentId field, which we don't currently return. Instead we
      // match on couponCode — since each (userId, couponId, couponSource) is
      // unique, there's exactly one active CouponAssignment per code.
      m.set(o.couponCode, o);
    }
    return m;
  }, [outgoing]);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handleApprove = async (offerId: string) => {
    if (
      !confirm(
        "Pay the asking price now? This debits your store wallet and the coupon moves to your rewards."
      )
    )
      return;
    setBusyOfferId(offerId);
    try {
      await approveCouponOffer(offerId);
      toast.success("Coupon transferred — wallet debited");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Approval failed");
    } finally {
      setBusyOfferId(null);
    }
  };

  const handleReject = async (offerId: string) => {
    if (!confirm("Decline this offer? The sender will be notified.")) return;
    setBusyOfferId(offerId);
    try {
      await rejectCouponOffer(offerId);
      toast.success("Offer declined");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Reject failed");
    } finally {
      setBusyOfferId(null);
    }
  };

  const handleCancel = async (offerId: string) => {
    if (!confirm("Cancel your pending offer? The coupon will be unlocked."))
      return;
    setBusyOfferId(offerId);
    try {
      await cancelCouponOffer(offerId);
      toast.success("Offer cancelled");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Cancel failed");
    } finally {
      setBusyOfferId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Incoming offers (recipient inbox) */}
      <AnimatePresence>
        {incoming.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pb-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-linear-to-br from-brand/25 to-brand/5 flex items-center justify-center">
                  <Wallet className="h-3.5 w-3.5 text-brand" />
                </div>
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Pending offers
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/12 text-brand font-medium tabular-nums">
                  {incoming.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnimatePresence>
                  {incoming.map((o) => (
                    <IncomingOfferCard
                      key={o._id}
                      offer={o}
                      busy={busyOfferId === o._id}
                      onApprove={() => handleApprove(o._id)}
                      onReject={() => handleReject(o._id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <div className="h-px bg-linear-to-r from-transparent via-white/8 to-transparent my-2" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["active", "used", "revoked", "all"] as const).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-7 px-3 text-xs rounded-full transition-all duration-200 capitalize",
                active
                  ? "bg-brand text-brand-foreground font-medium shadow-[0_2px_12px_-4px] shadow-brand/50"
                  : "bg-white/4 text-[#9fa0b8] hover:text-white hover:bg-white/7 active:scale-[0.97]"
              )}
            >
              {f}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[#6b6b80]" />
        </div>
      ) : rewards.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="p-4 rounded-2xl bg-linear-to-br from-white/8 to-white/2 ring-1 ring-white/5 mb-3">
            <TicketPercent className="h-7 w-7 text-[#6b6b80]" />
          </div>
          <p className="text-sm font-medium text-[#9fa0b8]">
            {filter === "active"
              ? "No active rewards yet"
              : `No ${filter} rewards`}
          </p>
          <p className="text-xs text-[#6b6b80] mt-1">
            Coupons gifted to you will appear here
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {rewards.map((r) => {
            const c = r.coupon;
            if (!c) return null;
            const statusMeta = STATUS_META[r.status];
            const expiry = c.validUntil
              ? new Date(c.validUntil).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null;
            const outgoingOffer = outgoingByAssignment.get(r.couponCode);
            const isLocked = !!outgoingOffer && r.status === "active";
            return (
              <motion.div
                layout
                key={r._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "relative rounded-3xl p-4 transition-all duration-300 overflow-hidden",
                  isLocked
                    ? "bg-linear-to-br from-brand/6 to-transparent ring-1 ring-brand/25"
                    : "bg-white/4 ring-1 ring-white/6 hover:ring-brand/20 hover:bg-white/5"
                )}
              >
                {isLocked && (
                  <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-brand/10 blur-3xl pointer-events-none" />
                )}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <AssignerPill reward={r} />
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.status === "active" &&
                      typeof r.availableUses === "number" &&
                      r.availableUses > 1 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand/10 text-brand">
                          {r.availableUses} uses left
                        </span>
                      )}
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        statusMeta.cls
                      )}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <code className="font-mono text-base font-semibold text-brand tracking-wide">
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
                <div className="text-sm text-white">{c.name}</div>
                <div className="text-xs text-[#9fa0b8] mt-1">
                  {discountLabel(c)} ·{" "}
                  {PRODUCT_LABELS[c.productType] || c.productType}
                  {c.cycleCount && c.cycleCount > 1 ? (
                    <> · {c.cycleCount} cycles</>
                  ) : null}
                </div>
                {expiry && (
                  <div className="text-[11px] text-[#6b6b80] mt-1">
                    Valid until {expiry}
                  </div>
                )}

                {r.giftMessage && (
                  <div className="relative mt-3 pl-3 py-1 text-xs text-[#9fa0b8] italic before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-linear-to-b before:from-brand before:to-brand/0">
                    <Sparkles className="inline h-3 w-3 mr-1 text-brand" />
                    {r.giftMessage}
                  </div>
                )}
                {r.reason && !r.giftMessage && (
                  <div className="mt-3 text-xs text-[#9fa0b8] italic">
                    &quot;{r.reason}&quot;
                  </div>
                )}

                {isLocked && outgoingOffer ? (
                  <div className="relative mt-3 pt-3 space-y-2 before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-brand/25 before:to-transparent">
                    <div className="flex items-center justify-between text-xs">
                      <div className="inline-flex items-center gap-1.5 text-brand">
                        <Clock className="h-3 w-3" />
                        <span className="truncate">
                          Offered to{" "}
                          {outgoingOffer.counterparty?.name ||
                            outgoingOffer.counterparty?.email}{" "}
                          for ${outgoingOffer.priceUsd.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancel(outgoingOffer._id)}
                      disabled={busyOfferId === outgoingOffer._id}
                      className="w-full h-8 text-xs rounded-xl bg-white/4 text-[#9fa0b8] hover:text-white hover:bg-white/7 ring-1 ring-brand/15 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      {busyOfferId === outgoingOffer._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          Cancel offer
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-2 mt-3 pt-3 before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/8 before:to-transparent">
                    <button
                      onClick={() => copyCode(c.code)}
                      disabled={r.status !== "active"}
                      className="flex-1 h-8 text-xs rounded-xl bg-white/4 text-[#9fa0b8] hover:text-white hover:bg-white/7 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Copy className="h-3 w-3" />
                      Copy code
                    </button>
                    <button
                      onClick={() => setGiftReward(r)}
                      disabled={r.status !== "active"}
                      className="flex-1 h-8 text-xs rounded-xl bg-brand/10 text-brand hover:bg-brand/18 transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-brand/10 flex items-center justify-center gap-1.5"
                    >
                      <Gift className="h-3 w-3" />
                      Gift or Sell
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {giftReward && giftReward.coupon && (
        <GiftRewardModal
          open={!!giftReward}
          onClose={() => setGiftReward(null)}
          assignmentId={giftReward._id}
          couponCode={giftReward.coupon.code}
          couponName={giftReward.coupon.name}
          onGifted={fetchAll}
        />
      )}
    </div>
  );
}
