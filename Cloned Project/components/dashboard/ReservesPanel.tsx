"use client";

/**
 * ReservesPanel — generic reserve-license tab content, mounted inside each
 * item-type's page (Courses / Channels / Workshops / Calls).
 *
 * The buyer sees licenses they own for that item type, can filter by status,
 * and can assign an available license to another Garage user via email.
 *
 * Visual language mirrors the existing UP reserve UI in WalletPageNew
 * (dark surfaces, no white borders, yellow accent on actions, status-themed
 * gradient icons + chips). Designed to drop in seamlessly.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Package,
  CheckCircle2,
  Send,
  X,
  Mail,
  AlertCircle,
  Filter,
  TicketCheck,
  Lock,
  DollarSign,
  Building2,
  Hourglass,
  Inbox,
  Check,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getItemReserves,
  getItemReserveStats,
  assignItemReserve,
  listIncomingReserveOffers,
  listOutgoingReserveOffers,
  approveReserveOffer,
  rejectReserveOffer,
  cancelReserveOffer,
  getAllStoreWallets,
  type ItemReserveLicense,
  type ItemReserveStatus,
  type ItemReserveType,
  type ReserveOffer,
  type StoreWalletData,
} from "@/lib/feed-api";
import { getOrgId } from "@/lib/auth";
import { toast } from "sonner";

interface ReservesPanelProps {
  itemType: ItemReserveType;
  /** Optional filter — only show reserves for this specific item id (e.g. one course). */
  itemId?: string;
  /** Customizable copy for empty state, scoped to the item type's wording. */
  copy?: {
    title?: string; // empty-state title, e.g. "No course reserves yet"
    description?: string; // empty-state body
    typeLabel?: string; // singular: "course", "channel", "workshop", "call credit"
  };
  className?: string;
}

const TYPE_DEFAULTS: Record<
  ItemReserveType,
  { typeLabel: string; emptyTitle: string; emptyDescription: string }
> = {
  course: {
    typeLabel: "course",
    emptyTitle: "No course reserves yet",
    emptyDescription:
      "Buy a course with quantity greater than 1 and the extra seats land here. Assign them to your team or students.",
  },
  channel: {
    typeLabel: "channel",
    emptyTitle: "No channel reserves yet",
    emptyDescription:
      "Bulk-buy channel memberships and gift access to others. Reserves you own will show up here for assignment.",
  },
  workshop: {
    typeLabel: "workshop",
    emptyTitle: "No workshop reserves yet",
    emptyDescription:
      "Buy workshop seats in bulk and assign them to attendees as registrations open.",
  },
  call: {
    typeLabel: "call credit",
    emptyTitle: "No call reserves yet",
    emptyDescription:
      "Purchase call credits with the “buy to assign to others” toggle, then hand them out one by one.",
  },
  product: {
    typeLabel: "product unit",
    emptyTitle: "No product reserves yet",
    emptyDescription:
      "Buy a product with the “buy to assign” option and the extra units land here. Assign each to a Garage user and they get the order.",
  },
};

type StatusFilter = "all" | ItemReserveStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "assigned", label: "Assigned" },
];

function fmtMoney(unit: number, currency: string) {
  const sym = currency === "INR" ? "₹" : "$";
  return `${sym}${(unit / 100).toFixed(2)}`;
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ReservesPanel({
  itemType,
  itemId,
  copy,
  className,
}: ReservesPanelProps) {
  const defaults = TYPE_DEFAULTS[itemType];
  const emptyTitle = copy?.title ?? defaults.emptyTitle;
  const emptyDescription = copy?.description ?? defaults.emptyDescription;
  const typeLabel = copy?.typeLabel ?? defaults.typeLabel;

  const [licenses, setLicenses] = useState<ItemReserveLicense[]>([]);
  const [stats, setStats] = useState<{
    available: number;
    assigned: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assignTarget, setAssignTarget] = useState<ItemReserveLicense | null>(
    null
  );
  // Paid offer state. Inbox = offers addressed to me (this item type only).
  // Outbox lets the LicenseRow show a "Pending offer" badge + cancel action.
  const [incomingOffers, setIncomingOffers] = useState<ReserveOffer[]>([]);
  const [outgoingOffers, setOutgoingOffers] = useState<ReserveOffer[]>([]);
  const [approveTarget, setApproveTarget] = useState<ReserveOffer | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [reservesRes, statsRes, incomingRes, outgoingRes] =
        await Promise.all([
          getItemReserves({
            itemType,
            status:
              statusFilter === "all"
                ? undefined
                : (statusFilter as ItemReserveStatus),
            limit: 100,
          }),
          getItemReserveStats(),
          listIncomingReserveOffers().catch(() => ({
            success: false,
            offers: [] as ReserveOffer[],
          })),
          listOutgoingReserveOffers().catch(() => ({
            success: false,
            offers: [] as ReserveOffer[],
          })),
        ]);
      let next = reservesRes.licenses;
      if (itemId) {
        next = next.filter((l) => l.itemId === itemId);
      }
      setLicenses(next);
      // Stats are global across all itemTypes; pluck the slice for ours so
      // the counts always match the visible list.
      const slice = statsRes.byItemType?.[itemType];
      if (slice) {
        setStats({
          available: slice.available,
          assigned: slice.assigned,
          total: slice.total,
        });
      } else {
        setStats({ available: 0, assigned: 0, total: 0 });
      }
      // Scope offers to this panel's item type (and item, if any).
      const scopedIncoming = (incomingRes.offers || []).filter(
        (o) => o.itemType === itemType && (!itemId || o.itemId === itemId)
      );
      const scopedOutgoing = (outgoingRes.offers || []).filter(
        (o) => o.itemType === itemType && (!itemId || o.itemId === itemId)
      );
      setIncomingOffers(scopedIncoming);
      setOutgoingOffers(scopedOutgoing);
    } catch (err: any) {
      console.error("[ReservesPanel] load failed:", err);
      toast.error(err?.message || "Failed to load reserves");
    } finally {
      setLoading(false);
    }
  };

  // Map license id → its outgoing pending offer, so each row can render a
  // "Pending offer" pill + cancel handler without a second lookup.
  const outgoingByLicense = useMemo(() => {
    const m = new Map<string, ReserveOffer>();
    for (const o of outgoingOffers) m.set(o.fromLicenseId, o);
    return m;
  }, [outgoingOffers]);

  const handleRejectOffer = async (offer: ReserveOffer) => {
    try {
      await rejectReserveOffer(offer._id);
      toast.success("Offer declined");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Couldn't decline the offer");
    }
  };

  const handleCancelOffer = async (offer: ReserveOffer) => {
    try {
      await cancelReserveOffer(offer._id);
      toast.success("Offer cancelled");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Couldn't cancel the offer");
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [itemType, itemId, statusFilter]);

  // For the filtered list, when itemId is set we want stats scoped too.
  const scopedStats = useMemo(() => {
    if (!itemId) return stats;
    // Recompute from the visible licenses since the global stats are not
    // per-item.
    const available = licenses.filter((l) => l.status === "available").length;
    const assigned = licenses.filter((l) => l.status === "assigned").length;
    return { available, assigned, total: available + assigned };
  }, [stats, licenses, itemId]);

  return (
    <div className={cn("space-y-5", className)}>
      {/* Incoming paid offers — only renders when there are offers to act on */}
      {incomingOffers.length > 0 && (
        <IncomingOffersStrip
          offers={incomingOffers}
          typeLabel={typeLabel}
          onApprove={(o) => setApproveTarget(o)}
          onReject={handleRejectOffer}
        />
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Available"
          value={scopedStats?.available ?? 0}
          tone="emerald"
          icon={TicketCheck}
        />
        <StatCard
          label="Assigned"
          value={scopedStats?.assigned ?? 0}
          tone="sky"
          icon={CheckCircle2}
        />
        <StatCard
          label="Total"
          value={scopedStats?.total ?? 0}
          tone="neutral"
          icon={Package}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1.5 text-[11px] text-[#6b6b80] mr-1.5 pl-0.5">
          <Filter className="w-3 h-3" />
          <span>Status</span>
        </div>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap",
              statusFilter === f.id
                ? "border-brand bg-brand/10 text-brand"
                : "border-[#2a2a35] bg-[#0e0e12] text-[#9fa0b8] hover:border-[#3a3a45] hover:text-white"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-[#2a2a35] bg-[#0e0e12]">
          <div className="w-9 h-9 rounded-full border-2 border-[#2a2a35] border-t-brand animate-spin" />
          <p className="mt-3 text-[12px] text-[#6b6b80]">Loading reserves…</p>
        </div>
      ) : licenses.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {licenses.map((lic) => {
              const pendingOffer = outgoingByLicense.get(lic._id);
              return (
                <LicenseRow
                  key={lic._id}
                  license={lic}
                  typeLabel={typeLabel}
                  pendingOffer={pendingOffer}
                  onAssign={() => setAssignTarget(lic)}
                  onCancelOffer={
                    pendingOffer ? () => handleCancelOffer(pendingOffer) : undefined
                  }
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Assign modal */}
      <AnimatePresence>
        {assignTarget && (
          <AssignModal
            license={assignTarget}
            typeLabel={typeLabel}
            onClose={() => setAssignTarget(null)}
            onAssigned={() => {
              setAssignTarget(null);
              load();
            }}
          />
        )}
      </AnimatePresence>

      {/* Approve-offer modal — recipient picks which Store wallet to pay from */}
      <AnimatePresence>
        {approveTarget && (
          <ApproveOfferModal
            offer={approveTarget}
            typeLabel={typeLabel}
            onClose={() => setApproveTarget(null)}
            onApproved={() => {
              setApproveTarget(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "emerald" | "sky" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClasses = {
    emerald:
      "from-emerald-500/15 to-emerald-500/0 border-emerald-500/15 text-emerald-300",
    sky: "from-sky-500/15 to-sky-500/0 border-sky-500/15 text-sky-300",
    neutral: "from-white/5 to-white/0 border-[#2a2a35] text-white",
  }[tone];
  const numberClass = {
    emerald: "text-emerald-400",
    sky: "text-sky-400",
    neutral: "text-white",
  }[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-[#0e0e12] p-3.5 sm:p-4",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:pointer-events-none",
        toneClasses
      )}
    >
      <div className="relative flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-medium">
          {label}
        </span>
        <Icon className={cn("w-3.5 h-3.5 opacity-70", numberClass)} />
      </div>
      <div className={cn("relative text-2xl sm:text-3xl font-bold tabular-nums", numberClass)}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-10 sm:p-14 text-center">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand/4 to-transparent pointer-events-none"
      />
      <div className="relative">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand/15 to-brand/0 border border-brand/15 mb-4 shadow-[0_0_24px_-12px_color-mix(in_srgb,_var(--brand)_55%,_transparent)]">
          <Sparkles className="w-6 h-6 text-brand" />
        </div>
        <h3 className="text-[15px] font-semibold text-white mb-1.5">{title}</h3>
        <p className="text-[12.5px] text-[#7a7a8e] max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function LicenseRow({
  license,
  typeLabel,
  pendingOffer,
  onAssign,
  onCancelOffer,
}: {
  license: ItemReserveLicense;
  typeLabel: string;
  pendingOffer?: ReserveOffer;
  onAssign: () => void;
  onCancelOffer?: () => void;
}) {
  const isAvailable = license.status === "available";
  const isAssigned = license.status === "assigned";
  // A license can be `available` AND have a live paid offer — that's the
  // locked state. Surface it as its own visual rather than the Assign CTA.
  const isPending = isAvailable && !!pendingOffer;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-[#0e0e12] transition-colors",
        isAvailable
          ? "border-[#2a2a35] hover:border-[#3a3a45]"
          : "border-[#2a2a35] hover:border-[#3a3a45]"
      )}
    >
      {/* status-themed left accent rail */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          isAvailable ? "bg-emerald-500/40" : "bg-sky-500/40"
        )}
      />

      <div className="flex items-stretch gap-4 p-4 pl-5">
        {/* Thumbnail or themed icon */}
        <div className="shrink-0">
          {license.itemImage ? (
            <img
              src={license.itemImage}
              alt={license.itemName}
              className="w-14 h-14 rounded-xl object-cover border border-[#2a2a35]"
            />
          ) : (
            <div
              className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center border",
                isAvailable
                  ? "bg-gradient-to-br from-emerald-500/15 to-emerald-500/0 border-emerald-500/20"
                  : "bg-gradient-to-br from-sky-500/15 to-sky-500/0 border-sky-500/20"
              )}
            >
              <TicketCheck
                className={cn(
                  "w-6 h-6",
                  isAvailable ? "text-emerald-400" : "text-sky-400"
                )}
              />
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                isAvailable
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                  : "bg-sky-500/10 text-sky-300 border-sky-500/20"
              )}
            >
              {isAvailable ? (
                <TicketCheck className="w-3 h-3" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {isAvailable ? "Available" : "Assigned"}
            </span>
            <span className="text-[10.5px] text-[#6b6b80]">
              {timeAgo(license.createdAt)}
            </span>
          </div>
          <p className="text-[13.5px] font-medium text-white truncate">
            {license.itemName}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11.5px] text-[#7a7a8e] flex-wrap">
            <span>#{license.seq + 1}</span>
            <span className="text-[#3a3a45]">•</span>
            <span className="tabular-nums">
              {fmtMoney(license.unitPrice, license.currency)}
            </span>
            <span className="text-[#3a3a45]">•</span>
            <span className="truncate max-w-[180px]">
              {license.invoiceNumber}
            </span>
          </div>
          {isAssigned && license.assignedTo && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-500/5 border border-sky-500/15 px-2 py-1">
              <Mail className="w-3 h-3 text-sky-400" />
              <span className="text-[11px] text-sky-300 truncate max-w-[220px]">
                {license.assignedTo.email}
              </span>
              {license.assignedAt && (
                <>
                  <span className="text-sky-500/40">•</span>
                  <span className="text-[10.5px] text-sky-400/80">
                    {timeAgo(license.assignedAt)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="shrink-0 flex items-center">
          {isPending && pendingOffer ? (
            <div className="flex flex-col items-end gap-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-xl px-2.5 h-7 bg-amber-500/10 border border-amber-500/25 shadow-[0_0_14px_-6px_rgba(245,158,11,0.35)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                </span>
                <span className="text-[10.5px] font-semibold text-amber-200 uppercase tracking-wider">
                  Pending
                </span>
                <span className="text-amber-500/40">·</span>
                <span className="text-[11px] font-bold text-brand tabular-nums">
                  ${pendingOffer.priceUsd.toFixed(2)}
                </span>
              </div>
              {onCancelOffer && (
                <button
                  onClick={onCancelOffer}
                  className="inline-flex items-center gap-1 text-[10.5px] text-[#7a7a8e] hover:text-rose-300 transition-colors px-1"
                >
                  <XCircle className="w-3 h-3" />
                  Cancel offer
                </button>
              )}
            </div>
          ) : isAvailable ? (
            <button
              onClick={onAssign}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-2 text-[12px] font-semibold border transition-all",
                "bg-brand text-brand-foreground border-brand hover:bg-brand/90 hover:shadow-[0_0_20px_-6px_color-mix(in_srgb,_var(--brand)_55%,_transparent)]"
              )}
            >
              <Send className="w-3.5 h-3.5" />
              Assign
            </button>
          ) : (
            <span
              aria-hidden
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium bg-[#0a0a10] border border-[#2a2a35] text-[#6b6b80]"
            >
              <Lock className="w-3 h-3" />
              Settled
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AssignModal({
  license,
  typeLabel,
  onClose,
  onAssigned,
}: {
  license: ItemReserveLicense;
  typeLabel: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [email, setEmail] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // Empty / 0 / NaN → free assign. Any positive number → paid offer.
  const priceNum = parseFloat(priceInput);
  const isPaid = !isNaN(priceNum) && priceNum > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError("");
    try {
      const orgId = getOrgId();
      if (isPaid && !orgId) {
        setError("Pick an organization to set as the credit destination first.");
        setSubmitting(false);
        return;
      }
      const res = await assignItemReserve(license._id, {
        email: email.trim(),
        priceUsd: isPaid ? Math.round(priceNum * 100) / 100 : undefined,
        orgId: isPaid ? orgId! : undefined,
        message: message.trim() || undefined,
      });
      if (res.mode === "paid") {
        toast.success(
          `Offer sent to ${email.trim()} for $${priceNum.toFixed(2)}`
        );
      } else {
        toast.success(`Assigned to ${email.trim()}`);
      }
      onAssigned();
    } catch (err: any) {
      const msg =
        err?.message ||
        (err?.code === "RECIPIENT_NOT_FOUND"
          ? "That email isn't a Garage user yet. Ask them to sign up first."
          : "Couldn't assign — please try again.");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] rounded-2xl border border-[#2a2a35] bg-[#0e0e12] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        {/* Ambient accent — flips amber when this is a paid offer */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-32 pointer-events-none transition-colors duration-300",
            isPaid
              ? "bg-gradient-to-b from-amber-500/12 via-amber-500/4 to-transparent"
              : "bg-gradient-to-b from-brand/10 via-brand/3 to-transparent"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-colors duration-300",
            isPaid ? "via-amber-500/40" : "via-brand/40"
          )}
        />

        <div className="relative p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-colors",
                isPaid
                  ? "bg-amber-500/15 border-amber-500/30 shadow-[0_0_20px_-6px_rgba(245,158,11,0.45)]"
                  : "bg-gradient-to-br from-brand/15 to-brand/0 border-brand/25 shadow-[0_0_18px_-6px_color-mix(in_srgb,_var(--brand)_45%,_transparent)]"
              )}
            >
              {isPaid ? (
                <DollarSign className="w-4 h-4 text-amber-300" />
              ) : (
                <Send className="w-4 h-4 text-brand" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold text-white leading-tight tracking-tight">
                  {isPaid ? "Send paid offer" : `Assign ${typeLabel}`}
                </h3>
                {isPaid && (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 uppercase tracking-wider">
                    <Hourglass className="w-2.5 h-2.5" />
                    Needs approval
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[#7a7a8e] mt-0.5 truncate">
                {license.itemName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[#6b6b80] hover:text-white hover:bg-white/5 transition-colors p-1.5 rounded-lg -mr-1.5"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {/* Recipient email */}
            <div>
              <label className="text-[10.5px] font-medium text-[#9fa0b8] uppercase tracking-wider block mb-1.5">
                Recipient email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b6b80] pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="them@example.com"
                  autoFocus
                  className={cn(
                    "w-full pl-9 pr-3 h-10 rounded-xl bg-[#0a0a10] border text-[13px] text-white",
                    "placeholder:text-[#3a3a45] focus:outline-none focus:ring-0 transition-colors",
                    error
                      ? "border-rose-500/40 focus:border-rose-500/60"
                      : "border-[#2a2a35] focus:border-brand/40"
                  )}
                />
              </div>
              <p className="text-[10.5px] text-[#6b6b80] mt-1.5">
                The recipient must already have a Garage account.
              </p>
            </div>

            {/* Optional price — empty = free assign, > 0 = paid offer */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-[10.5px] font-medium text-[#9fa0b8] uppercase tracking-wider">
                  Asking price
                </label>
                <span className="text-[10px] text-[#6b6b80]">
                  Optional · USD
                </span>
              </div>
              <div
                className={cn(
                  "relative rounded-xl bg-[#0a0a10] border transition-colors",
                  isPaid
                    ? "border-amber-500/40 shadow-[0_0_18px_-10px_rgba(245,158,11,0.5)]"
                    : "border-[#2a2a35] focus-within:border-brand/40"
                )}
              >
                <span
                  className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium tabular-nums pointer-events-none transition-colors",
                    isPaid ? "text-amber-300" : "text-[#6b6b80]"
                  )}
                >
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => {
                    setPriceInput(e.target.value);
                    setError("");
                  }}
                  placeholder="0.00"
                  className="w-full pl-7 pr-14 h-10 bg-transparent text-[14px] text-white tabular-nums font-medium placeholder:text-[#3a3a45] focus:outline-none rounded-xl"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10.5px] font-medium text-[#6b6b80] uppercase tracking-wider pointer-events-none">
                  USD
                </span>
              </div>
              <p className="text-[10.5px] text-[#6b6b80] mt-1.5 leading-relaxed">
                {isPaid ? (
                  <>
                    Creates a pending offer. Recipient picks one of their office
                    Store wallets to pay from; the{" "}
                    <span className="text-brand font-medium tabular-nums">
                      ${priceNum.toFixed(2)}
                    </span>{" "}
                    credits to your current org's Store wallet on approve.
                  </>
                ) : (
                  <>Leave blank to assign for free — no approval needed.</>
                )}
              </p>
            </div>

            {/* Optional message — only shown when this is a paid offer */}
            <AnimatePresence initial={false}>
              {isPaid && (
                <motion.div
                  key="msg"
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <label className="text-[10.5px] font-medium text-[#9fa0b8] uppercase tracking-wider block mb-1.5">
                    Note <span className="text-[#6b6b80] normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="A short note for the buyer"
                    maxLength={500}
                    className="w-full px-3 h-10 rounded-xl bg-[#0a0a10] border border-[#2a2a35] focus:border-brand/40 text-[13px] text-white placeholder:text-[#3a3a45] focus:outline-none transition-colors"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                <p className="text-[11.5px] text-rose-300 leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 h-9 rounded-xl text-[12px] font-medium text-[#9fa0b8] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid || submitting}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 h-9 rounded-xl text-[12px] font-semibold transition-all active:scale-[0.98]",
                  valid && !submitting
                    ? "bg-brand text-brand-foreground hover:bg-brand/90 hover:shadow-[0_0_22px_-6px_color-mix(in_srgb,_var(--brand)_55%,_transparent)]"
                    : "bg-[#1a1a22] text-[#6b6b80] cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {isPaid ? "Sending offer…" : "Assigning…"}
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    {isPaid ? "Send paid offer" : "Assign"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Paid-offer recipient surfaces
// ───────────────────────────────────────────────────────────────────────

function IncomingOffersStrip({
  offers,
  typeLabel,
  onApprove,
  onReject,
}: {
  offers: ReserveOffer[];
  typeLabel: string;
  onApprove: (o: ReserveOffer) => void;
  onReject: (o: ReserveOffer) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0e0e12]"
    >
      {/* Ambient amber glow — purely decorative, sits behind the cards */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent"
      />

      <div className="relative p-3.5 sm:p-4 space-y-3">
        {/* Strip header */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/15 border border-amber-500/30 shadow-[0_0_18px_-6px_rgba(245,158,11,0.45)]">
            <Inbox className="w-3.5 h-3.5 text-amber-300" />
            <span
              aria-hidden
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#0e0e12]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-white tracking-tight">
              {offers.length === 1
                ? `1 incoming ${typeLabel} offer`
                : `${offers.length} incoming ${typeLabel} offers`}
            </p>
            <p className="text-[10.5px] text-[#8b8c9e] leading-tight">
              Approve to pay from one of your office Store wallets, or decline.
            </p>
          </div>
        </div>

        {/* Offer cards */}
        <div className="space-y-2">
          {offers.map((o) => {
            const from =
              typeof o.fromUserId === "object" ? o.fromUserId : null;
            const senderName = from?.name || from?.email || "Someone";
            return (
              <motion.div
                key={o._id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="group relative overflow-hidden rounded-xl border border-[#2a2a35] bg-[#0a0a10] hover:border-[#3a3a48] transition-colors"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[3px] bg-amber-500/50"
                />
                <div className="flex items-center gap-3 p-3 pl-4">
                  {/* Sender avatar */}
                  <div className="shrink-0">
                    {from?.profilePicture ? (
                      <img
                        src={from.profilePicture}
                        alt={senderName}
                        className="w-10 h-10 rounded-xl object-cover border border-[#2a2a35]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-amber-500/0 border border-amber-500/25 text-[12px] font-semibold text-amber-200">
                        {senderName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Item + sender */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[13px] font-medium text-white truncate">
                        {o.itemName}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium bg-[#1a1a22] text-[#9fa0b8] border border-[#2a2a35] uppercase tracking-wider">
                        {o.itemType}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[#7a7a8e] truncate">
                      From <span className="text-[#c7c7da]">{senderName}</span>
                      {o.message ? (
                        <>
                          <span className="text-[#3a3a45] mx-1">·</span>
                          <span className="italic">"{o.message}"</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0 mr-1">
                    <p className="text-[16px] font-bold text-brand tabular-nums leading-none">
                      ${o.priceUsd.toFixed(2)}
                    </p>
                    <p className="text-[9px] text-[#6b6b80] mt-1 uppercase tracking-wider">
                      Asking
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onReject(o)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#2a2a35] bg-[#0e0e12] text-[#9fa0b8] hover:text-rose-300 hover:border-rose-500/30 hover:bg-rose-500/5 transition-colors"
                      aria-label="Decline"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onApprove(o)}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-brand text-brand-foreground text-[11.5px] font-semibold hover:bg-brand/90 hover:shadow-[0_0_22px_-6px_color-mix(in_srgb,_var(--brand)_60%,_transparent)] transition-all active:scale-[0.98]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function ApproveOfferModal({
  offer,
  typeLabel,
  onClose,
  onApproved,
}: {
  offer: ReserveOffer;
  typeLabel: string;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [wallets, setWallets] = useState<StoreWalletData[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load the recipient's own Store wallets on open. Affiliate and Content
  // Rewards are not loaded — only Store is allowed per design.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingWallets(true);
        const res = await getAllStoreWallets();
        if (!alive) return;
        const ws = res.wallets || [];
        setWallets(ws);
        // Default-select the first wallet with enough balance to cover the price.
        const eligible = ws.find((w) => w.balance >= offer.priceUsd);
        const fallback = ws[0];
        const def = eligible || fallback;
        if (def) {
          const orgId =
            typeof def.orgId === "string" ? def.orgId : def.orgId?._id;
          setSelectedOrgId(orgId || null);
        }
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "Couldn't load your wallets");
      } finally {
        if (alive) setLoadingWallets(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [offer._id, offer.priceUsd]);

  const orgIdOf = (w: StoreWalletData) =>
    typeof w.orgId === "string" ? w.orgId : w.orgId._id;
  const orgNameOf = (w: StoreWalletData) =>
    typeof w.orgId === "string" ? "Organization" : w.orgId.name;

  const selectedWallet = wallets.find((w) => orgIdOf(w) === selectedOrgId);
  const hasEnough = !!selectedWallet && selectedWallet.balance >= offer.priceUsd;

  const submit = async () => {
    if (!selectedOrgId) {
      setError("Pick a wallet to pay from");
      return;
    }
    if (!hasEnough) {
      setError("That wallet's balance is below the asking price");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await approveReserveOffer(offer._id, selectedOrgId);
      toast.success(`Paid $${offer.priceUsd.toFixed(2)} — reserve is yours`);
      onApproved();
    } catch (err: any) {
      setError(err?.message || "Couldn't approve the offer");
    } finally {
      setSubmitting(false);
    }
  };

  const from = typeof offer.fromUserId === "object" ? offer.fromUserId : null;
  const senderName = from?.name || from?.email || "the sender";
  const creditOrg =
    typeof offer.orgId === "object" ? offer.orgId.name : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] rounded-2xl border border-[#2a2a35] bg-[#0e0e12] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        {/* Ambient amber wash + hairline accent at top */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/12 via-amber-500/4 to-transparent pointer-events-none"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
        />

        <div className="relative p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/15 border border-amber-500/30 shrink-0 shadow-[0_0_20px_-6px_rgba(245,158,11,0.45)]">
              <TicketCheck className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-white leading-tight tracking-tight">
                Approve {typeLabel} offer
              </h3>
              <p className="text-[11.5px] text-[#7a7a8e] mt-0.5">
                Pay from your office wallet to claim the reserve.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[#6b6b80] hover:text-white hover:bg-white/5 transition-colors p-1.5 rounded-lg -mr-1.5"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Item + sender hero */}
          <div className="relative rounded-xl border border-[#2a2a35] bg-[#0a0a10] overflow-hidden mb-4">
            <div className="flex items-center gap-3 p-3.5">
              <div className="shrink-0">
                {from?.profilePicture ? (
                  <img
                    src={from.profilePicture}
                    alt={senderName}
                    className="w-11 h-11 rounded-xl object-cover border border-[#2a2a35]"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-amber-500/0 border border-amber-500/25 text-[13px] font-semibold text-amber-200">
                    {senderName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <p className="text-[13.5px] font-medium text-white truncate">
                    {offer.itemName}
                  </p>
                  <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-medium bg-[#1a1a22] text-[#9fa0b8] border border-[#2a2a35] uppercase tracking-wider">
                    {offer.itemType}
                  </span>
                </div>
                <p className="text-[10.5px] text-[#7a7a8e] truncate">
                  From <span className="text-[#c7c7da]">{senderName}</span>
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-[#6b6b80] uppercase tracking-wider mb-1">
                  You pay
                </p>
                <p className="text-[20px] font-bold text-brand tabular-nums leading-none">
                  ${offer.priceUsd.toFixed(2)}
                </p>
              </div>
            </div>
            {offer.message && (
              <>
                <div className="h-px bg-[#1f1f2a]" />
                <div className="px-3.5 py-2.5">
                  <p className="text-[10px] text-[#6b6b80] uppercase tracking-wider mb-0.5">
                    Note
                  </p>
                  <p className="text-[12px] text-[#c7c7da] italic leading-snug">
                    "{offer.message}"
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Wallet picker */}
          <div className="space-y-2 mb-4">
            <div className="flex items-baseline justify-between">
              <label className="text-[10.5px] font-medium text-[#9fa0b8] uppercase tracking-wider">
                Pay from
              </label>
              <span className="text-[10px] text-[#6b6b80]">
                Store wallets only
              </span>
            </div>
            {loadingWallets ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-[#2a2a35] bg-[#0a0a10] px-3 py-3">
                <Loader2 className="w-3.5 h-3.5 text-brand animate-spin shrink-0" />
                <span className="text-[12px] text-[#9fa0b8]">
                  Loading your office wallets…
                </span>
              </div>
            ) : wallets.length === 0 ? (
              <div className="rounded-xl border border-[#2a2a35] bg-[#0a0a10] px-3 py-4 text-center">
                <Building2 className="w-4 h-4 text-[#6b6b80] mx-auto mb-1.5" />
                <p className="text-[12px] text-[#c7c7da]">
                  No Store wallets to pay from
                </p>
                <p className="text-[10.5px] text-[#6b6b80] mt-0.5">
                  Top up an office wallet, then come back.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 -mr-1">
                {wallets.map((w) => {
                  const orgId = orgIdOf(w);
                  const orgName = orgNameOf(w);
                  const active = selectedOrgId === orgId;
                  const eligible = w.balance >= offer.priceUsd;
                  return (
                    <button
                      key={orgId}
                      type="button"
                      onClick={() => eligible && setSelectedOrgId(orgId)}
                      disabled={!eligible}
                      className={cn(
                        "group/wallet w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                        !eligible
                          ? "border-[#1f1f2a] bg-[#08080c] opacity-55 cursor-not-allowed"
                          : active
                            ? "border-brand/40 bg-brand/[0.06] shadow-[0_0_22px_-12px_color-mix(in_srgb,_var(--brand)_55%,_transparent)]"
                            : "border-[#2a2a35] bg-[#0a0a10] hover:border-[#3a3a48] hover:bg-[#0d0d12]"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                          active
                            ? "bg-brand/15 border border-brand/25"
                            : "bg-[#1a1a22] border border-[#2a2a35]"
                        )}
                      >
                        <Building2
                          className={cn(
                            "w-3.5 h-3.5",
                            active ? "text-brand" : "text-[#9fa0b8]"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white truncate font-medium">
                          {orgName}
                        </div>
                        <div className="text-[10.5px] tabular-nums flex items-center gap-1.5 mt-0.5">
                          <span
                            className={cn(
                              eligible ? "text-[#8b8c9e]" : "text-rose-300/70"
                            )}
                          >
                            ${w.balance.toFixed(2)} available
                          </span>
                          {!eligible && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 uppercase tracking-wider">
                              Insufficient
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                          active
                            ? "border-brand bg-brand/10"
                            : "border-[#3a3a48] group-hover/wallet:border-[#4a4a5a]"
                        )}
                      >
                        {active && (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Where credit lands — tiny meta line, keeps the user oriented */}
          {creditOrg && (
            <div className="flex items-center gap-1.5 text-[10.5px] text-[#6b6b80] mb-3">
              <Send className="w-3 h-3" />
              <span>
                Credits to{" "}
                <span className="text-[#9fa0b8]">{senderName}</span>'s
                <span className="text-[#9fa0b8]"> {creditOrg}</span> wallet.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-[11.5px] text-rose-300 leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 h-9 rounded-xl text-[12px] font-medium text-[#9fa0b8] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || loadingWallets || !hasEnough}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 h-9 rounded-xl text-[12px] font-semibold transition-all active:scale-[0.98]",
                !submitting && !loadingWallets && hasEnough
                  ? "bg-brand text-brand-foreground hover:bg-brand/90 hover:shadow-[0_0_24px_-6px_color-mix(in_srgb,_var(--brand)_60%,_transparent)]"
                  : "bg-[#1a1a22] text-[#6b6b80] cursor-not-allowed border border-[#2a2a35]"
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Paying…
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Pay ${offer.priceUsd.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
