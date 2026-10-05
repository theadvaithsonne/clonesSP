"use client";

// Admin surface for a user's saved cards. Rendered inside the "Saved
// Cards" tab of /garage-admin/one-time-affiliates/[userId]. Four
// actions per row: Set default, Delete, Charge (opens picker), Refund
// (opens past-charges list). Super-admin only — the backend also
// enforces this; the UI simply surfaces the buttons.

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CreditCard,
  Trash2,
  Star,
  Zap,
  RotateCcw,
  Loader2,
  ExternalLink,
  Check,
  X,
  Repeat,
  DollarSign,
  Send,
  Copy,
  Smartphone,
} from "lucide-react";
import {
  fetchAdminSavedCards,
  setAdminDefaultCard,
  deleteAdminCard,
  fetchAdminOrgProducts,
  chargeAdminSavedCard,
  fetchAdminRefundableCharges,
  refundAdminCharge,
  fetchAdminSubscribableItems,
  startAdminSubscription,
  fetchPlatformBillableItems,
  billPlatformItem,
  chargeAdminAdhoc,
  chargeAdminUpiMandate,
  createAdminAddCardLink,
  type AdminSavedStripeMethod,
  type AdminUpiMandate,
  type AdminOrgProduct,
  type AdminRefundableCharge,
  type AdminSubscribableItem,
  type PlatformBillableItem,
} from "@/lib/admin-api/saved-cards";
import { fetchMemberTab, type MemberOffice } from "@/lib/affiliate/downline-profile-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select disallows empty-string values on SelectItem. Placeholder
// text is rendered via SelectValue.placeholder; the "unselected" state
// is expressed as an empty value on the parent Select, not a sentinel
// item. We keep string state for compatibility with the existing
// onValueChange contract — empty string still means "nothing picked".

const selectTriggerCls =
  "w-full rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-white hover:bg-black/60 focus:border-[#FFC200]/60 focus:outline-none focus:ring-0 data-[state=open]:border-[#FFC200]/60";
const selectContentCls =
  "bg-[#0b0b0e] border-white/[0.12] text-white max-h-72";
const selectItemCls =
  "text-sm text-white focus:bg-white/[0.06] focus:text-white";

const CARD_QK = (userId: string) => ["admin-saved-cards", userId] as const;

function formatAmount(smallest: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
    }).format((smallest || 0) / 100);
  } catch {
    return `${currency} ${((smallest || 0) / 100).toFixed(2)}`;
  }
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ──────────────────────────────────────────────────────────────────
// Panel — the tab body
// ──────────────────────────────────────────────────────────────────

export function AdminSavedCardsPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const cardsQ = useQuery({
    queryKey: CARD_QK(userId),
    queryFn: () => fetchAdminSavedCards(userId),
  });

  const [chargeCard, setChargeCard] = useState<AdminSavedStripeMethod | null>(null);
  const [subscribeCard, setSubscribeCard] = useState<AdminSavedStripeMethod | null>(null);
  const [adhocCard, setAdhocCard] = useState<AdminSavedStripeMethod | null>(null);
  const [refundCard, setRefundCard] = useState<AdminSavedStripeMethod | null>(null);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [busyPmId, setBusyPmId] = useState<string | null>(null);

  const cards = cardsQ.data?.stripe?.methods || [];
  // UPI Autopay mandates — the Razorpay counterpart to a saved card. Absent
  // on older backends, so default to empty rather than assuming the key.
  const mandates = cardsQ.data?.razorpay?.mandates || [];
  const [upiMandate, setUpiMandate] = useState<AdminUpiMandate | null>(null);

  async function handleSetDefault(pmId: string) {
    setBusyPmId(pmId);
    try {
      await setAdminDefaultCard(userId, pmId);
      toast.success("Default card updated");
      await qc.invalidateQueries({ queryKey: CARD_QK(userId) });
    } catch (err: any) {
      toast.error(err?.message || "Failed to set default");
    } finally {
      setBusyPmId(null);
    }
  }

  async function handleDelete(pmId: string, last4: string | null) {
    if (!confirm(`Delete card •••• ${last4 || "????"} ? This detaches it from Stripe.`)) return;
    setBusyPmId(pmId);
    try {
      await deleteAdminCard(userId, pmId);
      toast.success("Card removed");
      await qc.invalidateQueries({ queryKey: CARD_QK(userId) });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete card");
    } finally {
      setBusyPmId(null);
    }
  }

  if (cardsQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading saved cards…
      </div>
    );
  }

  if (cardsQ.isError) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/[0.05] p-4 text-sm text-red-300">
        Failed to load saved cards: {(cardsQ.error as any)?.message || "unknown error"}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {cards.length === 0
            ? "This user has no saved cards yet."
            : `${cards.length} saved ${cards.length === 1 ? "card" : "cards"}.`}
        </p>
        <button
          onClick={() => setAddLinkOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-[#FFC200]/40 bg-[#FFC200]/10 px-3 py-1.5 text-xs font-medium text-[#FFC200] hover:bg-[#FFC200]/20"
        >
          <Send className="h-3.5 w-3.5" /> Send add-card link
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-white">No saved cards</p>
          <p className="mt-1 text-xs text-zinc-500">
            Send the user an add-card link to onboard their first card without
            charging them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((c) => (
            <CardRow
              key={c.id}
              card={c}
              busy={busyPmId === c.id}
              onSetDefault={() => handleSetDefault(c.id)}
              onDelete={() => handleDelete(c.id, c.last4)}
              onCharge={() => setChargeCard(c)}
              onSubscribe={() => setSubscribeCard(c)}
              onAdhoc={() => setAdhocCard(c)}
              onRefund={() => setRefundCard(c)}
            />
          ))}
        </div>
      )}

      {/* ── UPI Autopay mandates ──────────────────────────────────
          Rendered as a peer of the card list, not folded into it: a
          mandate is a different instrument with a hard per-debit
          ceiling, and an admin needs that number in front of them
          before choosing an amount. Only shown when the user actually
          has one. */}
      {mandates.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-zinc-400" />
            <p className="text-sm font-medium text-white">UPI Autopay</p>
            <span className="text-xs text-zinc-500">
              {mandates.length} mandate{mandates.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-3">
            {mandates.map((mnd) => (
              <UpiMandateRow
                key={mnd.id}
                mandate={mnd}
                onCharge={() => setUpiMandate(mnd)}
              />
            ))}
          </div>
        </div>
      )}

      {upiMandate && (
        <UpiChargeDialog
          userId={userId}
          mandate={upiMandate}
          onClose={() => setUpiMandate(null)}
          onDone={async () => {
            setUpiMandate(null);
            await qc.invalidateQueries({ queryKey: CARD_QK(userId) });
          }}
        />
      )}

      {addLinkOpen && (
        <AddCardLinkDialog
          userId={userId}
          onClose={() => setAddLinkOpen(false)}
        />
      )}

      {chargeCard && (
        <ChargeOnCardDialog
          userId={userId}
          card={chargeCard}
          onClose={() => setChargeCard(null)}
          onDone={() => {
            setChargeCard(null);
            qc.invalidateQueries({ queryKey: CARD_QK(userId) });
          }}
        />
      )}

      {subscribeCard && (
        <SubscribeOnCardDialog
          userId={userId}
          card={subscribeCard}
          onClose={() => setSubscribeCard(null)}
          onDone={() => {
            setSubscribeCard(null);
            qc.invalidateQueries({ queryKey: CARD_QK(userId) });
          }}
        />
      )}

      {adhocCard && (
        <AdhocChargeDialog
          userId={userId}
          card={adhocCard}
          onClose={() => setAdhocCard(null)}
          onDone={() => {
            setAdhocCard(null);
            qc.invalidateQueries({ queryKey: CARD_QK(userId) });
          }}
        />
      )}

      {refundCard && (
        <RefundFromCardDialog
          userId={userId}
          card={refundCard}
          onClose={() => setRefundCard(null)}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Card row
// ──────────────────────────────────────────────────────────────────

function CardRow({
  card,
  busy,
  onSetDefault,
  onDelete,
  onCharge,
  onSubscribe,
  onAdhoc,
  onRefund,
}: {
  card: AdminSavedStripeMethod;
  busy: boolean;
  onSetDefault: () => void;
  onDelete: () => void;
  onCharge: () => void;
  onSubscribe: () => void;
  onAdhoc: () => void;
  onRefund: () => void;
}) {
  const mandateActive = card.mandateStatus === "active" && !!card.mandateId;
  return (
    <div className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-black/40 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {card.brand || "card"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm text-white">
          <span className="font-medium">•••• {card.last4 || "????"}</span>
          <span className="text-xs text-zinc-500">
            {String(card.expMonth || "?").padStart(2, "0")}/
            {String(card.expYear || "?").slice(-2)}
          </span>
          {card.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFC200]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FFC200]">
              <Star className="h-2.5 w-2.5" />
              Default
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
          <span>Country: {card.country || "—"}</span>
          <span className="text-zinc-700">·</span>
          <span>Added {formatDate(card.addedAt)}</span>
        </div>
        {card.country === "IN" && (
          <div className="mt-1.5">
            {mandateActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                <Zap className="h-2.5 w-2.5" />
                MIT ready (cap {formatAmount(card.mandateAmount || 0, "INR")})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                OTP required (no mandate)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!card.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            disabled={busy}
            className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-white/[0.16] hover:text-white disabled:opacity-40"
            title="Set as default"
          >
            Set default
          </button>
        )}
        <button
          type="button"
          onClick={onCharge}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-40"
          title="Charge this card for a product"
        >
          <Zap className="h-3 w-3" />
          Charge
        </button>
        <button
          type="button"
          onClick={onSubscribe}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 px-2.5 py-1 text-[11px] font-semibold text-sky-300 transition hover:bg-sky-500/10 disabled:opacity-40"
          title="Start a recurring subscription on this card"
        >
          <Repeat className="h-3 w-3" />
          Subscribe
        </button>
        <button
          type="button"
          onClick={onAdhoc}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 px-2.5 py-1 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-40"
          title="Charge a custom amount (not tied to a product)"
        >
          <DollarSign className="h-3 w-3" />
          Adhoc
        </button>
        <button
          type="button"
          onClick={onRefund}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-white/[0.16] hover:text-white disabled:opacity-40"
          title="Refund a past charge on this card"
        >
          <RotateCcw className="h-3 w-3" />
          Refund
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-full border border-red-500/30 p-1 text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
          title="Delete card"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Charge dialog
// ──────────────────────────────────────────────────────────────────

function ChargeOnCardDialog({
  userId,
  card,
  onClose,
  onDone,
}: {
  userId: string;
  card: AdminSavedStripeMethod;
  onClose: () => void;
  onDone: () => void;
}) {
  const officesQ = useQuery({
    queryKey: ["admin-member-offices", userId],
    queryFn: () =>
      fetchMemberTab<MemberOffice>({
        userId,
        category: "offices",
        page: 1,
        limit: 200,
      }),
  });

  const [orgId, setOrgId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof chargeAdminSavedCard>
  > | null>(null);

  const productsQ = useQuery({
    queryKey: ["admin-org-products", orgId],
    queryFn: () => fetchAdminOrgProducts(orgId),
    enabled: !!orgId,
  });

  const offices = officesQ.data?.items || [];
  const products = productsQ.data?.products || [];
  const selectedProduct = useMemo(
    () => products.find((p) => p._id === productId) || null,
    [products, productId],
  );

  // Client-side preview of the effective charge mode. Mirrors
  // services/paymentGating.ts::resolveSavedCardChargeMode so the admin
  // sees the outcome before submitting — server still authoritative.
  const previewMode = useMemo(() => {
    if (!selectedProduct) return null;
    const isINR = (selectedProduct.currency || "").toUpperCase() === "INR";
    if (!isINR) return { label: "USD off-session — zero OTP", tone: "ok" as const };
    if (card.country !== "IN") return { label: "INR foreign card — off-session", tone: "ok" as const };
    const mandateOk =
      !!card.mandateId &&
      card.mandateStatus === "active" &&
      !!card.mandateAmount &&
      selectedProduct.price <= card.mandateAmount;
    if (mandateOk) return { label: "INR MIT — zero OTP", tone: "ok" as const };
    return {
      label: "INR CIT — buyer OTP required (we'll return an invoice URL)",
      tone: "warn" as const,
    };
  }, [selectedProduct, card]);

  async function handleSubmit() {
    if (!orgId || !productId) return;
    setSubmitting(true);
    try {
      const res = await chargeAdminSavedCard(userId, card.id, {
        orgId,
        productId,
      });
      setResult(res);
      if (res.status === "succeeded" || res.status === "processing") {
        toast.success(`Charge ${res.status} — invoice ${res.invoiceNumber || res.invoiceId}`);
        onDone();
      } else if (res.status === "requires_action") {
        toast.info("Buyer OTP required — share the invoice link", { duration: 6000 });
      } else {
        toast.error(res.error || "Charge failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Charge failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/[0.08] bg-[#0b0b0e] p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Charge saved card</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {card.brand} •••• {card.last4} · issuer {card.country || "?"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result?.status === "requires_action" ? (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.05] p-3 text-sm">
            <div className="font-medium text-amber-200">Buyer OTP required</div>
            <p className="text-xs text-amber-100/80">
              The invoice has been created. Share this URL with the buyer to
              complete the OTP:
            </p>
            <a
              href={result.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {result.invoiceUrl}
            </a>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-md border border-white/[0.08] px-3 py-2 text-xs text-white hover:bg-white/[0.04]"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Org (from this user's memberships)
              </label>
              {officesQ.isLoading ? (
                <div className="text-xs text-zinc-500">Loading orgs…</div>
              ) : offices.length === 0 ? (
                <div className="text-xs text-zinc-500">
                  User isn't a member of any org — cannot charge.
                </div>
              ) : (
                <Select
                  value={orgId}
                  onValueChange={(v) => {
                    setOrgId(v);
                    setProductId("");
                  }}
                >
                  <SelectTrigger className={selectTriggerCls}>
                    <SelectValue placeholder="Select an org…" />
                  </SelectTrigger>
                  <SelectContent className={selectContentCls}>
                    {offices.map((o) => (
                      <SelectItem key={o.orgId} value={o.orgId} className={selectItemCls}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Product
              </label>
              {!orgId ? (
                <div className="text-xs text-zinc-600">Pick an org first.</div>
              ) : productsQ.isLoading ? (
                <div className="text-xs text-zinc-500">Loading products…</div>
              ) : products.length === 0 ? (
                <div className="text-xs text-zinc-500">
                  No active products on this org.
                </div>
              ) : (
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className={selectTriggerCls}>
                    <SelectValue placeholder="Select a product…" />
                  </SelectTrigger>
                  <SelectContent className={selectContentCls}>
                    {products.map((p) => (
                      <SelectItem key={p._id} value={p._id} className={selectItemCls}>
                        {p.name} — {formatAmount(p.price, p.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedProduct && previewMode && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Amount</span>
                  <span className="text-white">
                    {formatAmount(selectedProduct.price, selectedProduct.currency)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-zinc-400">
                  <span>Mode</span>
                  <span
                    className={
                      previewMode.tone === "warn"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }
                  >
                    {previewMode.label}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!orgId || !productId || submitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Charging…
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    Charge card
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}

// ──────────────────────────────────────────────────────────────────
// Refund dialog
// ──────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────
// Subscribe dialog — same shape as ChargeOnCardDialog but picker is
// scoped to items with isSubscription: true, preview shows the per-
// cycle amount + subscription period, and the INR-no-mandate combo
// is refused up-front (backend refuses too — this is just faster
// feedback for the admin).
// ──────────────────────────────────────────────────────────────────

function periodLabel(p: string): string {
  if (p === "weekly") return "week";
  if (p === "monthly") return "month";
  if (p === "quarterly") return "quarter";
  if (p === "yearly") return "year";
  return p;
}

/**
 * Bill this card — Garage's own products, or one of the user's orgs'.
 *
 * The office-items half is the original "start subscription" flow, unchanged.
 * The Garage-products half is new: Unilevel Plus, NetworkChain and Office Pro
 * had no admin path at all, so the only options were `charge-adhoc` (takes the
 * money and grants nothing) or running a script by hand.
 *
 * Recurring items can start with a free first cycle — access now, first real
 * charge next cycle.
 */
function SubscribeOnCardDialog({
  userId,
  card,
  onClose,
  onDone,
}: {
  userId: string;
  card: AdminSavedStripeMethod;
  onClose: () => void;
  onDone: () => void;
}) {
  type Source = "garage" | "office";
  const [source, setSource] = useState<Source>("garage");

  // ── Garage's own products ──
  const platformQ = useQuery({
    queryKey: ["admin-platform-billable", userId],
    queryFn: () => fetchPlatformBillableItems(userId),
  });
  const platformItems = platformQ.data?.items || [];
  const [platformKey, setPlatformKey] = useState<string>("");
  const [termMonths, setTermMonths] = useState<number>(1);
  const [planOrgId, setPlanOrgId] = useState<string>("");
  const [freeFirst, setFreeFirst] = useState(false);
  const platformItem =
    platformItems.find((i) => i.itemType === platformKey) || null;

  // ── The user's orgs' products/communities (original flow) ──
  const officesQ = useQuery({
    queryKey: ["admin-member-offices", userId],
    queryFn: () =>
      fetchMemberTab<MemberOffice>({
        userId,
        category: "offices",
        page: 1,
        limit: 200,
      }),
  });
  const [orgId, setOrgId] = useState<string>("");
  const [itemKey, setItemKey] = useState<string>("");
  const itemsQ = useQuery({
    queryKey: ["admin-subscribable-items", orgId],
    queryFn: () => fetchAdminSubscribableItems(orgId),
    enabled: !!orgId && source === "office",
  });
  const offices = officesQ.data?.items || [];
  const items = itemsQ.data?.items || [];
  const selectedItem: AdminSubscribableItem | null = useMemo(() => {
    if (!itemKey) return null;
    const [t, id] = itemKey.split(":");
    return items.find((i) => i.itemType === t && i._id === id) || null;
  }, [items, itemKey]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof startAdminSubscription>
  > | null>(null);

  /** What this card will actually be charged today, and per cycle after. */
  const pricing = useMemo(() => {
    if (source === "office") {
      if (!selectedItem) return null;
      return {
        currency: selectedItem.currency,
        perCycle: selectedItem.price,
        today: selectedItem.price,
        period: periodLabel(selectedItem.subscriptionPeriod),
        recurring: true,
      };
    }
    if (!platformItem) return null;
    const term = platformItem.terms?.find((t) => t.termMonths === termMonths);
    const base = term?.price ?? platformItem.price;
    // A missing licence means NetworkChain is sold together with it.
    const combo =
      platformItem.requiresCombo && platformItem.comboPrice
        ? platformItem.comboPrice - platformItem.price + base
        : null;
    const today = freeFirst ? 0 : (combo ?? base);
    return {
      currency: platformItem.currency,
      perCycle: base,
      today,
      period: platformItem.kind === "recurring" ? "month" : null,
      recurring: platformItem.kind === "recurring",
      combo,
    };
  }, [source, selectedItem, platformItem, termMonths, freeFirst]);

  // Client preview of the MIT/CIT decision — mirrors
  // services/paymentGating.ts::resolveSavedCardChargeMode.
  const previewMode = useMemo(() => {
    if (!pricing) return null;
    const isINR = (pricing.currency || "").toUpperCase() === "INR";
    if (!isINR) return { label: "USD off-session — renewals silent", tone: "ok" as const };
    if (card.country !== "IN") return { label: "INR foreign card — renewals silent", tone: "ok" as const };
    const mandateOk =
      !!card.mandateId &&
      card.mandateStatus === "active" &&
      !!card.mandateAmount &&
      pricing.perCycle <= card.mandateAmount;
    if (mandateOk) return { label: "INR MIT — renewals silent (mandate active)", tone: "ok" as const };
    return {
      label:
        "REFUSED: INR Indian card without active mandate — every renewal would need OTP. Ask buyer to re-save with mandate.",
      tone: "block" as const,
    };
  }, [pricing, card]);

  const needsOrg = platformItem?.itemType === "office_plan";
  const canSubmit =
    previewMode?.tone !== "block" &&
    !submitting &&
    (source === "office"
      ? !!orgId && !!selectedItem
      : !!platformItem &&
        platformItem.eligible &&
        (!needsOrg || !!planOrgId));

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res =
        source === "office"
          ? await startAdminSubscription(userId, card.id, {
              orgId,
              itemType: selectedItem!.itemType,
              itemId: selectedItem!._id,
            })
          : await billPlatformItem(userId, card.id, {
              itemType: platformItem!.itemType,
              ...(needsOrg ? { orgId: planOrgId } : {}),
              ...(platformItem!.terms?.length ? { termMonths } : {}),
              ...(freeFirst ? { freeCycles: 1 } : {}),
            });
      setResult(res as any);
      const label =
        source === "office" ? selectedItem!.name : platformItem!.name;
      if (res.status === "succeeded" || res.status === "processing") {
        toast.success(
          (res as any).freeCycle
            ? `${label} — first cycle free, billing starts next cycle`
            : `${label} — ${res.status}`,
        );
        onDone();
      } else if (res.status === "requires_action") {
        toast.info("Needs buyer authentication — share the invoice link", {
          duration: 6000,
        });
      } else {
        toast.error(res.error || "Failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const tabCls = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? "bg-white/[0.08] text-white"
        : "text-zinc-500 hover:text-zinc-300"
    }`;

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/[0.08] bg-[#0b0b0e] p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Bill this card</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {card.brand} •••• {card.last4} · issuer {card.country || "?"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result?.status === "requires_action" ? (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.05] p-3 text-sm">
            <div className="font-medium text-amber-200">
              Buyer authentication required
            </div>
            <p className="text-xs text-amber-100/80">
              The invoice is created but nothing has been charged or activated.
              Share this URL so the buyer can authenticate; renewals proceed
              automatically afterwards.
            </p>
            <a
              href={result.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {result.invoiceUrl}
            </a>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-md border border-white/[0.08] px-3 py-2 text-xs text-white hover:bg-white/[0.04]"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Which catalogue — Garage's own, or one of the user's orgs'. */}
            <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setSource("garage")}
                className={tabCls(source === "garage")}
              >
                Garage products
              </button>
              <button
                type="button"
                onClick={() => setSource("office")}
                className={tabCls(source === "office")}
              >
                Office items
              </button>
            </div>

            {source === "garage" ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Garage product
                </label>
                {platformQ.isLoading ? (
                  <div className="text-xs text-zinc-500">Loading…</div>
                ) : platformItems.length === 0 ? (
                  <div className="text-xs text-zinc-500">
                    No platform products configured.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {platformItems.map((i) => {
                      const active = platformKey === i.itemType;
                      return (
                        <button
                          key={i.itemType}
                          type="button"
                          disabled={!i.eligible}
                          onClick={() => {
                            setPlatformKey(i.itemType);
                            setTermMonths(i.terms?.[0]?.termMonths ?? 1);
                            setPlanOrgId(i.orgs?.[0]?._id ?? "");
                            if (i.kind === "one_time") setFreeFirst(false);
                          }}
                          className={`w-full rounded-lg border p-3 text-left transition ${
                            active
                              ? "border-sky-500/50 bg-sky-500/[0.06]"
                              : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">
                              {i.name}
                            </span>
                            <span className="shrink-0 text-sm text-white">
                              {formatAmount(i.price, i.currency)}
                              {i.kind === "recurring" ? (
                                <span className="text-zinc-500"> / month</span>
                              ) : null}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                            <span className="text-zinc-500">
                              {i.kind === "one_time"
                                ? "One-time licence"
                                : "Recurring"}
                            </span>
                            {i.reason ? (
                              <span className="text-amber-300/80">
                                · {i.reason}
                              </span>
                            ) : null}
                            {i.eligible && i.requiresCombo ? (
                              <span className="text-sky-300/80">
                                · licence included
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* NetworkChain sells 1/3/6/12-month terms. */}
                {platformItem?.terms && platformItem.terms.length > 1 && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Term
                    </label>
                    <Select
                      value={String(termMonths)}
                      onValueChange={(v) => setTermMonths(Number(v))}
                    >
                      <SelectTrigger className={selectTriggerCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {platformItem.terms.map((t) => (
                          <SelectItem
                            key={t.termMonths}
                            value={String(t.termMonths)}
                            className={selectItemCls}
                          >
                            {t.label} — {formatAmount(t.price, platformItem.currency)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* An office plan bills against a specific org they found. */}
                {needsOrg && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Organization to bill
                    </label>
                    <Select value={planOrgId} onValueChange={setPlanOrgId}>
                      <SelectTrigger className={selectTriggerCls}>
                        <SelectValue placeholder="Select an org…" />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {(platformItem?.orgs || []).map((o) => (
                          <SelectItem key={o._id} value={o._id} className={selectItemCls}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Org (from this user's memberships)
                  </label>
                  {officesQ.isLoading ? (
                    <div className="text-xs text-zinc-500">Loading orgs…</div>
                  ) : offices.length === 0 ? (
                    <div className="text-xs text-zinc-500">
                      User isn't a member of any org — cannot subscribe.
                    </div>
                  ) : (
                    <Select
                      value={orgId}
                      onValueChange={(v) => {
                        setOrgId(v);
                        setItemKey("");
                      }}
                    >
                      <SelectTrigger className={selectTriggerCls}>
                        <SelectValue placeholder="Select an org…" />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {offices.map((o) => (
                          <SelectItem key={o.orgId} value={o.orgId} className={selectItemCls}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Subscribable item (products + communities marked recurring)
                  </label>
                  {!orgId ? (
                    <div className="text-xs text-zinc-600">Pick an org first.</div>
                  ) : itemsQ.isLoading ? (
                    <div className="text-xs text-zinc-500">Loading items…</div>
                  ) : items.length === 0 ? (
                    <div className="text-xs text-zinc-500">
                      No subscription-enabled products or communities on this org.
                    </div>
                  ) : (
                    <Select value={itemKey} onValueChange={setItemKey}>
                      <SelectTrigger className={selectTriggerCls}>
                        <SelectValue placeholder="Select an item…" />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {items.map((i) => (
                          <SelectItem
                            key={`${i.itemType}:${i._id}`}
                            value={`${i.itemType}:${i._id}`}
                            className={selectItemCls}
                          >
                            [{i.itemType}] {i.name} — {formatAmount(i.price, i.currency)} /{" "}
                            {periodLabel(i.subscriptionPeriod)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            )}

            {/* When billing starts. Recurring only — a one-time licence has no
                next cycle to defer to. */}
            {pricing?.recurring && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Billing starts
                </label>
                <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-black/40 p-1">
                  <button
                    type="button"
                    onClick={() => setFreeFirst(false)}
                    className={tabCls(!freeFirst)}
                  >
                    Charge now
                  </button>
                  <button
                    type="button"
                    onClick={() => setFreeFirst(true)}
                    className={tabCls(freeFirst)}
                  >
                    First cycle free
                  </button>
                </div>
              </div>
            )}

            {pricing && previewMode && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Charged today</span>
                  <span
                    className={
                      pricing.today === 0 ? "text-emerald-300" : "text-white"
                    }
                  >
                    {pricing.today === 0
                      ? "Nothing"
                      : formatAmount(pricing.today, pricing.currency)}
                  </span>
                </div>
                {pricing.combo ? (
                  <div className="mt-1 flex items-center justify-between text-zinc-500">
                    <span>includes Unilevel Plus licence</span>
                    <span>required to subscribe</span>
                  </div>
                ) : null}
                {pricing.recurring && (
                  <div className="mt-1 flex items-center justify-between text-zinc-400">
                    <span>{freeFirst ? "Then, from next cycle" : "Per cycle"}</span>
                    <span className="text-white">
                      {formatAmount(pricing.perCycle, pricing.currency)} /{" "}
                      {pricing.period}
                    </span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between text-zinc-400">
                  <span>Mode</span>
                  <span
                    className={
                      previewMode.tone === "block"
                        ? "text-red-300"
                        : "text-emerald-300"
                    }
                  >
                    {previewMode.label}
                  </span>
                </div>
                {pricing.recurring && (
                  <p className="mt-2 text-[10px] text-zinc-500">
                    {freeFirst
                      ? "Access starts now and nothing is charged today. "
                      : ""}
                    Renewals auto-charge via the daily cron on whichever card is
                    this user's default at the time of each cycle — not
                    necessarily this one.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    <Repeat className="h-3.5 w-3.5" />
                    {pricing?.today === 0 ? "Activate" : "Charge & activate"}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}

// ──────────────────────────────────────────────────────────────────
// Adhoc-charge dialog — arbitrary amount + description, NOT tied to
// a product. Same org picker (invoice needs an org for reporting)
// but no item picker. Currency + amount + description free-form.
// Same MIT/CIT preview + INR-no-mandate refusal as the other dialogs.
// ──────────────────────────────────────────────────────────────────

function AdhocChargeDialog({
  userId,
  card,
  onClose,
  onDone,
}: {
  userId: string;
  card: AdminSavedStripeMethod;
  onClose: () => void;
  onDone: () => void;
}) {
  const officesQ = useQuery({
    queryKey: ["admin-member-offices", userId],
    queryFn: () =>
      fetchMemberTab<MemberOffice>({
        userId,
        category: "offices",
        page: 1,
        limit: 200,
      }),
  });

  const [orgId, setOrgId] = useState<string>("");
  const [amountStr, setAmountStr] = useState<string>("");
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof chargeAdminAdhoc>
  > | null>(null);

  const offices = officesQ.data?.items || [];
  const amountNum = Number(amountStr);
  const amountSmallest = Number.isFinite(amountNum) && amountNum > 0
    ? Math.round(amountNum * 100)
    : 0;

  const previewMode = useMemo(() => {
    if (!amountSmallest || !currency) return null;
    const isINR = currency === "INR";
    if (!isINR) return { label: "USD off-session — zero OTP", tone: "ok" as const };
    if (card.country !== "IN")
      return { label: "INR foreign card — off-session", tone: "ok" as const };
    const mandateOk =
      !!card.mandateId &&
      card.mandateStatus === "active" &&
      !!card.mandateAmount &&
      amountSmallest <= card.mandateAmount;
    if (mandateOk)
      return { label: "INR MIT — zero OTP", tone: "ok" as const };
    return {
      label:
        "INR CIT — buyer OTP required (we'll return an invoice URL for them to complete it)",
      tone: "warn" as const,
    };
  }, [amountSmallest, currency, card]);

  const canSubmit =
    !!orgId &&
    amountSmallest > 0 &&
    description.trim().length > 0 &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await chargeAdminAdhoc(userId, card.id, {
        orgId,
        amount: amountNum,
        currency,
        description: description.trim(),
      });
      setResult(res);
      if (res.status === "succeeded" || res.status === "processing") {
        toast.success(
          `Charge ${res.status} — invoice ${res.invoiceNumber || res.invoiceId}`,
        );
        onDone();
      } else if (res.status === "requires_action") {
        toast.info("Buyer OTP required — share the invoice link", {
          duration: 6000,
        });
      } else {
        toast.error(res.error || "Charge failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Charge failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/[0.08] bg-[#0b0b0e] p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Adhoc charge</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {card.brand} •••• {card.last4} · issuer {card.country || "?"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result?.status === "requires_action" ? (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.05] p-3 text-sm">
            <div className="font-medium text-amber-200">Buyer OTP required</div>
            <p className="text-xs text-amber-100/80">
              Invoice created. Share this URL with the buyer to complete the
              OTP:
            </p>
            <a
              href={result.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {result.invoiceUrl}
            </a>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-md border border-white/[0.08] px-3 py-2 text-xs text-white hover:bg-white/[0.04]"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Org (invoice ledger + audit)
              </label>
              {officesQ.isLoading ? (
                <div className="text-xs text-zinc-500">Loading orgs…</div>
              ) : offices.length === 0 ? (
                <div className="text-xs text-zinc-500">
                  User isn't a member of any org — cannot post an adhoc invoice.
                </div>
              ) : (
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger className={selectTriggerCls}>
                    <SelectValue placeholder="Select an org…" />
                  </SelectTrigger>
                  <SelectContent className={selectContentCls}>
                    {offices.map((o) => (
                      <SelectItem key={o.orgId} value={o.orgId} className={selectItemCls}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Amount
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="12.50"
                  className="w-full rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-white focus:border-[#FFC200]/60 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Currency
                </label>
                <Select
                  value={currency}
                  onValueChange={(v) => setCurrency(v as "USD" | "INR")}
                >
                  <SelectTrigger className={selectTriggerCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentCls}>
                    <SelectItem value="USD" className={selectItemCls}>
                      USD
                    </SelectItem>
                    <SelectItem value="INR" className={selectItemCls}>
                      INR
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                placeholder="e.g. Late-payment fee, custom coaching session, retro invoice…"
                className="w-full rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-white focus:border-[#FFC200]/60 focus:outline-none"
              />
              <p className="text-[10px] text-zinc-600">
                Shown to buyer on the invoice/receipt + retained in the audit
                trail. Max 200 chars.
              </p>
            </div>

            {amountSmallest > 0 && previewMode && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Amount</span>
                  <span className="text-white">
                    {formatAmount(amountSmallest, currency)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-zinc-400">
                  <span>Mode</span>
                  <span
                    className={
                      previewMode.tone === "warn"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }
                  >
                    {previewMode.label}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-md bg-violet-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-violet-400 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Charging…
                  </>
                ) : (
                  <>
                    <DollarSign className="h-3.5 w-3.5" />
                    Charge {amountSmallest > 0 ? formatAmount(amountSmallest, currency) : ""}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}

function RefundFromCardDialog({
  userId,
  card,
  onClose,
}: {
  userId: string;
  card: AdminSavedStripeMethod;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const chargesQ = useQuery({
    queryKey: ["admin-refundable", userId, card.id],
    queryFn: () => fetchAdminRefundableCharges(userId, card.id),
  });
  const [busyPI, setBusyPI] = useState<string | null>(null);
  const charges = chargesQ.data?.charges || [];

  async function handleRefund(row: AdminRefundableCharge) {
    if (
      !confirm(
        `Refund ${formatAmount(row.amount, row.currency)} on ${row.invoiceNumber}? This can't be undone.`,
      )
    )
      return;
    setBusyPI(row.paymentIntentId);
    try {
      const res = await refundAdminCharge(userId, row.paymentIntentId);
      toast.success(`Refund ${res.refund.status}`);
      await qc.invalidateQueries({
        queryKey: ["admin-refundable", userId, card.id],
      });
    } catch (err: any) {
      toast.error(err?.message || "Refund failed");
    } finally {
      setBusyPI(null);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/[0.08] bg-[#0b0b0e] p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Refund past charge</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Recent Stripe-paid invoices for this user. Ones charged on{" "}
              {card.brand} •••• {card.last4} show a badge.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {chargesQ.isLoading ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </div>
        ) : charges.length === 0 ? (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center text-xs text-zinc-500">
            No refundable Stripe charges on this user.
          </div>
        ) : (
          <div className="space-y-2">
            {charges.map((row) => (
              <div
                key={row.paymentIntentId}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span className="font-medium truncate">{row.itemName || "—"}</span>
                    {row.matchedPm && (
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                        <Check className="inline h-2 w-2" /> This card
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    {row.invoiceNumber} · {formatDate(row.paidAt)} ·{" "}
                    {formatAmount(row.amount, row.currency)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRefund(row)}
                  disabled={busyPI === row.paymentIntentId}
                  className="rounded-md border border-red-500/40 px-3 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  {busyPI === row.paymentIntentId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Refund"
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-white/[0.08] px-3 py-2 text-xs text-white hover:bg-white/[0.04]"
          >
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ──────────────────────────────────────────────────────────────────
// Overlay (very small — we don't need Radix for a super-admin tool)
// ──────────────────────────────────────────────────────────────────

function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Add-card link dialog
// ──────────────────────────────────────────────────────────────────
// Admin mints a save-card link — user opens it on their own device
// and enters card via Stripe Elements. PAN never touches our servers
// or the admin's browser (PCI SAQ A boundary).

function AddCardLinkDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [minting, setMinting] = useState(false);
  const [link, setLink] = useState<{
    url: string;
    expiresAt: string;
    recipient: { email: string | null; name: string | null };
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleMint = async () => {
    setMinting(true);
    try {
      const r = await createAdminAddCardLink(userId);
      setLink({
        url: r.url,
        expiresAt: r.expiresAt,
        recipient: { email: r.recipient.email, name: r.recipient.name },
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create link");
    } finally {
      setMinting(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#0b0b0e] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            Send add-card link
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!link ? (
          <>
            <p className="text-sm text-zinc-400">
              Generate a secure one-time link the user can open on their own
              device. They'll enter their card via Stripe — the card number
              never touches your browser or our servers. Once saved, you can
              charge the card from this panel.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-zinc-500">
              <li>• RBI mandate is bundled automatically for Indian cards.</li>
              <li>• Link expires in 24 hours.</li>
              <li>• No charge — save-only.</li>
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleMint}
                disabled={minting}
                className="inline-flex items-center gap-2 rounded-md bg-[#FFC200] px-4 py-2 text-sm font-semibold text-black hover:bg-[#FFC200]/90 disabled:opacity-50"
              >
                {minting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Generate link
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-3">
              <p className="text-xs font-medium text-emerald-400">
                Link created — send it to{" "}
                {link.recipient.name || link.recipient.email || "the user"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Expires {formatDate(link.expiresAt)} at{" "}
                {new Date(link.expiresAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-zinc-400">
                Share this URL
              </label>
              <div className="mt-1.5 flex items-stretch gap-2">
                <input
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 font-mono text-xs text-white"
                />
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.08]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setLink(null);
                  setCopied(false);
                }}
                className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Generate another
              </button>
              <button
                onClick={onClose}
                className="rounded-md bg-white/[0.06] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.1]"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}

/* ── UPI Autopay mandate row ─────────────────────────────────────── */

function UpiMandateRow({
  mandate,
  onCharge,
}: {
  mandate: AdminUpiMandate;
  onCharge: () => void;
}) {
  const capRupees =
    mandate.maxAmount != null ? mandate.maxAmount / 100 : null;
  const expired =
    !!mandate.mandateExpiresAt && new Date(mandate.mandateExpiresAt) <= new Date();

  // The status word is the whole story for an admin: only "active" can be
  // charged, and the others each mean something different about what the
  // customer has to do next.
  const tone =
    mandate.mandateStatus === "active"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : mandate.mandateStatus === "pending"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
        : "bg-zinc-500/10 text-zinc-400 border-white/10";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-white">
              {mandate.vpa || "(no VPA on record)"}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${tone}`}>
              {mandate.mandateStatus || "unknown"}
            </span>
            {mandate.isDefault && (
              <span className="rounded-full border border-[#FFC200]/30 bg-[#FFC200]/10 px-2 py-0.5 text-[10px] text-[#FFC200]">
                default
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {capRupees != null ? (
              <>
                Max <b className="text-zinc-300">₹{capRupees.toLocaleString("en-IN")}</b> per debit
              </>
            ) : (
              "No cap recorded"
            )}
            {mandate.mandateExpiresAt && (
              <>
                {" · "}
                {expired ? "expired " : "valid until "}
                {new Date(mandate.mandateExpiresAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </>
            )}
          </p>
          {!mandate.chargeable && (
            <p className="mt-1 text-xs text-amber-400/80">
              {expired
                ? "Mandate has expired — the customer must set autopay up again."
                : mandate.mandateStatus === "pending"
                  ? "Waiting for the customer to approve it in their UPI app."
                  : "Not chargeable — the customer must set autopay up again."}
            </p>
          )}
        </div>
        <button
          onClick={onCharge}
          disabled={!mandate.chargeable}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#FFC200]/40 bg-[#FFC200]/10 px-3 py-1.5 text-xs font-medium text-[#FFC200] hover:bg-[#FFC200]/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Zap className="h-3.5 w-3.5" /> Charge
        </button>
      </div>
    </div>
  );
}

/* ── Charge a UPI mandate ────────────────────────────────────────── */

function UpiChargeDialog({
  userId,
  mandate,
  onClose,
  onDone,
}: {
  userId: string;
  mandate: AdminUpiMandate;
  onClose: () => void;
  onDone: () => void;
}) {
  const [orgId, setOrgId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "INR">("INR");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const capRupees = mandate.maxAmount != null ? mandate.maxAmount / 100 : null;
  // Advisory only for USD — the live FX rate lives on the server, and the
  // backend re-checks the cap after converting. This just stops the obvious
  // mistake before a round trip.
  const overCap =
    capRupees != null &&
    currency === "INR" &&
    Number(amount) > capRupees;

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await chargeAdminUpiMandate(userId, mandate.id, {
        orgId: orgId.trim(),
        amount: Number(amount),
        currency,
        description: description.trim(),
      });
      if (!r.success || r.status === "failed") {
        toast.error(r.error || "Charge failed");
        return;
      }
      // "pending" is a real outcome, not an error — say so plainly.
      toast.success(r.note || "Charge submitted");
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "Charge failed");
    } finally {
      setBusy(false);
    }
  }

  const ready = orgId.trim() && Number(amount) > 0 && description.trim() && !overCap;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0e0e12] p-5">
        <div className="mb-1 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-[#FFC200]" />
          <h3 className="text-sm font-semibold text-white">Charge UPI mandate</h3>
        </div>
        <p className="mb-4 font-mono text-xs text-zinc-400">{mandate.vpa}</p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Organisation ID</label>
            <input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="ObjectId of the selling org"
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-400">Amount</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs text-zinc-400">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "INR")}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown on the invoice"
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
          </div>
        </div>

        {capRupees != null && (
          <p className={`mt-3 text-xs ${overCap ? "text-red-400" : "text-zinc-500"}`}>
            {overCap
              ? `Over the mandate's ₹${capRupees.toLocaleString("en-IN")} per-debit cap. The mandate was authorised for a smaller recurring amount — charging more needs a new mandate.`
              : `Cap is ₹${capRupees.toLocaleString("en-IN")} per debit. Above ₹15,000 the customer must approve in their UPI app, so the charge settles a little later.`}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!ready || busy}
            className="inline-flex items-center gap-2 rounded-md bg-[#FFC200] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Charge
          </button>
        </div>
      </div>
    </div>
  );
}
