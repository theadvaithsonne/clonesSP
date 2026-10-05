import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import {
  requireGarageAdminAuth,
  requireAdminAction,
} from "../middleware/garageAdminAuth";
import { Invoice } from "../models/invoice.model";
import { User } from "../models/user.model";
import { NcSubscription } from "../models/ncSubscription.model";
import { GarageAdminModel } from "../models/garageAdmin.model";
import { autoDebitInstrument } from "../services/autoDebitInstrument";

/**
 * GET /garage-admin/networkchain-subs
 *
 * Powers the super-admin "NetworkChain Subs" table (Admin → Citizens →
 * NetworkChain Subs). One row per person with a LIVE NetworkChains
 * subscription (NC's own record is the source of truth), joined to the Garage
 * invoice chain that funds it:
 *   - buyer / upline / location / assigned support agent
 *   - subscriptionStart + lastPayment: date, invoice (public link, paid
 *     badge), "Via $25 offer" with the $25 invoice, payment method, whether
 *     paying it set auto-debit up, whether it was collected by auto-debit
 *   - autoDebit: what will collect the next cycle, or why nothing will
 *     (cancelled by the user vs never applicable)
 *   - nextPayment (date + the drafted invoice), payments, cycle, total
 *     collected, rank
 *
 * Founder's spec, 19 Sep 2026.
 */
const router = Router();

router.get(
  "/networkchain-subs",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
      const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

      // ── Filters (all optional) ──
      // Date range is on the subscription START (see subscriptionStart.date).
      const startedFrom = req.query.startedFrom
        ? new Date(String(req.query.startedFrom))
        : null;
      const startedTo = req.query.startedTo
        ? new Date(String(req.query.startedTo))
        : null;

      const sortByRaw = String(req.query.sortBy || "");
      const sortOrder =
        String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

      // Header search (?q=) — match the BUYER by name / email / phone.
      const q = String(req.query.q || "").trim();
      let searchBuyerIds: Set<string> | null = null;
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const matches = await User.find(
          { $or: [{ name: re }, { email: re }, { phone: re }] },
          { _id: 1 },
        ).lean();
        searchBuyerIds = new Set(matches.map((u) => String(u._id)));
      }

      // Open View / "view as" (?rootUserId=) — narrow to the buyers in that
      // user's DOWNLINE. `ancestors` is the materialized upline path.
      const rootUserId = String(req.query.rootUserId || "").trim();
      let rootDownlineIds: Set<string> | null = null;
      if (rootUserId && Types.ObjectId.isValid(rootUserId)) {
        const descendants = await User.find(
          { ancestors: new Types.ObjectId(rootUserId) },
          { _id: 1 },
        ).lean();
        rootDownlineIds = new Set(descendants.map((u) => String(u._id)));
      }

      /**
       * ── Population: ACTIVE NetworkChains subscriptions, one row each ──
       *
       * This table is "who has a live NetworkChain subscription right now"
       * — the founder's definition (18 Sep 2026). NetworkChains' own record
       * (`networkchain_subscriptions`, mirrored read-only here) is the source
       * of truth the member sees: active iff status is "active" AND the
       * current period has not ended.
       *
       * It used to be built from Garage's parent invoices, which (a) rendered
       * one row per re-subscribe attempt — Ez had 13 — and (b) missed every
       * subscriber NetworkChains activated by hand (staff, comps), who have
       * a live subscription and no Garage invoice for it. Starting from the
       * NC record fixes both: one row per person, and the Garage invoices
       * are joined in to EXPLAIN the row, not to define it.
       */
      const nowMs = Date.now();
      const ncActive = (await NcSubscription.find({
        status: "active",
        currentPeriodEnd: { $gt: new Date(nowMs) },
      }).lean()) as any[];

      const ncByBuyer = new Map<string, any>();
      for (const s of ncActive) ncByBuyer.set(String(s.userId), s);
      let buyerIds = [...ncByBuyer.keys()];

      // Drop subscriptions whose buyer no longer exists. Admin deletion is
      // non-cascading; a row with no person to show is noise here.
      const buyerDocs = await User.find({
        _id: { $in: buyerIds.map((id) => new Types.ObjectId(id)) },
      })
        .select(
          "name email phone country state city profilePicture referredBy ncRank assignedSupportAgentId assignedSupportAgentAt paymentProfile",
        )
        .lean();
      const buyersById = new Map(buyerDocs.map((u) => [String(u._id), u]));
      buyerIds = buyerIds.filter((id) => buyersById.has(id));

      if (searchBuyerIds) buyerIds = buyerIds.filter((id) => searchBuyerIds!.has(id));
      if (rootDownlineIds) buyerIds = buyerIds.filter((id) => rootDownlineIds!.has(id));

      if (buyerIds.length === 0) {
        return res.json({
          data: [],
          stats: computeEmptyStats(),
          pagination: { total: 0, limit, offset },
        });
      }

      // ── Garage's side of the story: every NC subscription invoice chain
      // these buyers have. Parents (isRecurring, no parentInvoiceId) and
      // their cycle children, minus wallet top-ups (also itemType
      // third_party_subscription, tagged metadata.kind="topup").
      const buyerOids = buyerIds.map((id) => new Types.ObjectId(id));
      const ncInvoices = (await Invoice.find({
        userId: { $in: buyerOids },
        "lineItems.itemType": "third_party_subscription",
        $or: [
          { "metadata.kind": { $exists: false } },
          { "metadata.kind": { $ne: "topup" } },
        ],
      })
        .sort({ createdAt: 1 })
        .lean()) as any[];

      const parentsByBuyer = new Map<string, any[]>();
      const childrenByParent = new Map<string, any[]>();
      for (const inv of ncInvoices) {
        if (inv.parentInvoiceId) {
          const k = String(inv.parentInvoiceId);
          (childrenByParent.get(k) || childrenByParent.set(k, []).get(k)!).push(inv);
        } else if (inv.isRecurring) {
          const k = String(inv.userId);
          (parentsByBuyer.get(k) || parentsByBuyer.set(k, []).get(k)!).push(inv);
        }
      }

      // The $25 licence invoices that FUND a combo / bundle subscription —
      // referenced from the NC invoice as metadata.triggerInvoiceId (free
      // first month) or metadata.prepaidViaBundle (licence + term in one
      // cart). Loaded in one query so each row can show "Via $25 offer" with
      // the actual invoice the money went through.
      const offerInvoiceIds = new Set<string>();
      for (const inv of ncInvoices) {
        const t = inv?.metadata?.triggerInvoiceId || inv?.metadata?.prepaidViaBundle;
        if (t && Types.ObjectId.isValid(String(t))) offerInvoiceIds.add(String(t));
      }
      const offerInvoices = offerInvoiceIds.size
        ? ((await Invoice.find({
            _id: { $in: [...offerInvoiceIds].map((id) => new Types.ObjectId(id)) },
          }).lean()) as any[])
        : [];
      const offerById = new Map(offerInvoices.map((i) => [String(i._id), i]));

      // Support agents + uplines, one batch each.
      const agentIds = new Set<string>();
      const uplineIds = new Set<string>();
      for (const u of buyerDocs) {
        if ((u as any).assignedSupportAgentId) agentIds.add(String((u as any).assignedSupportAgentId));
        if (u.referredBy) uplineIds.add(String(u.referredBy));
      }
      const agentDocs = agentIds.size
        ? await GarageAdminModel.find({
            _id: { $in: [...agentIds].map((id) => new Types.ObjectId(id)) },
          })
            .select("name email profilePicture")
            .lean()
        : [];
      const agentsById = new Map(agentDocs.map((a) => [String(a._id), a]));
      const uplineDocs = await User.find({ _id: { $in: [...uplineIds] } })
        .select("name email phone country state city profilePicture")
        .lean();
      const uplinesById = new Map(uplineDocs.map((u) => [String(u._id), u]));

      let rows = buyerIds.map((buyerId) =>
        buildSubscriberRow({
          buyer: buyersById.get(buyerId),
          nc: ncByBuyer.get(buyerId),
          parents: parentsByBuyer.get(buyerId) || [],
          childrenByParent,
          offerById,
          uplinesById,
          agentsById,
        }),
      );

      // Started-date filter, on the resolved start.
      if (startedFrom && !Number.isNaN(startedFrom.getTime())) {
        rows = rows.filter((r) => new Date(r.subscriptionStart.date).getTime() >= startedFrom.getTime());
      }
      if (startedTo && !Number.isNaN(startedTo.getTime())) {
        rows = rows.filter((r) => new Date(r.subscriptionStart.date).getTime() <= startedTo.getTime());
      }

      // Sort in memory — the population is small (double digits) and the
      // sort keys are derived, not stored.
      const sortKey: Record<string, (r: any) => number | string> = {
        subscriptionStart: (r) => new Date(r.subscriptionStart.date).getTime(),
        lastPayment: (r) => (r.lastPayment ? new Date(r.lastPayment.date).getTime() : 0),
        nextPaymentDate: (r) => (r.nextPayment.date ? new Date(r.nextPayment.date).getTime() : 0),
        paymentsCount: (r) => r.paymentsCount,
        cycle: (r) => r.cycle,
        totalCollected: (r) => r.totalCollectedUsd,
        name: (r) => (r.user?.name || r.user?.email || "").toLowerCase(),
        rank: (r) => r.rank || "",
      };
      const keyFn = sortKey[sortByRaw] || sortKey.subscriptionStart;
      rows.sort((a, b) => {
        const ka = keyFn(a);
        const kb = keyFn(b);
        if (ka < kb) return -1 * sortOrder;
        if (ka > kb) return 1 * sortOrder;
        return String(a._id).localeCompare(String(b._id));
      });

      const totalCount = rows.length;
      const page = rows.slice(offset, offset + limit);
      return res.json({
        data: page,
        stats: computeStats(rows),
        pagination: { total: totalCount, limit, offset },
      });
    } catch (err) {
      console.error("[garage-admin/networkchain-subs] error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  },
);

/* ── row construction ──────────────────────────────────────────────── */

// The buyer-facing app, hard-coded: these links are for sending to buyers,
// and a local FRONTEND_URL would mint localhost links into the admin table.
const PUBLIC_APP_ORIGIN = "https://my.garage.app";

/** The link shape every invoice reference in this table carries. */
function invoiceRef(inv: any) {
  if (!inv) return null;
  return {
    id: String(inv._id),
    invoiceNumber: inv.invoiceNumber as string,
    status: String(inv.status || "").toLowerCase(),
    amountUsd: Number(inv.totalAmount || 0) / 100,
    currency: inv.paymentCurrency || inv.itemCurrency || "USD",
    // The buyer-facing page. Opens only for the buyer (ownership check on
    // /invoice/:id) — an admin uses it to send them the link.
    publicUrl: `${PUBLIC_APP_ORIGIN}/invoice/${String(inv._id)}`,
  };
}

/**
 * Whether paying this invoice set up auto-debit, and by what — decided from
 * the stamps checkout leaves on the invoice:
 *   - `metadata.upiAutopayRegistration` → the Razorpay order carried a UPI
 *     mandate; approving the payment approved the mandate. "UPI".
 *   - Stripe with a customer attached (`metadata.stripeCustomerId` — a fresh
 *     card saved for future use — or `stripePaymentMethodId`, an already-saved
 *     card) → "card".
 *   - Crypto / store vault / affiliate vault → nothing can ever be charged
 *     again from these: "not_applicable".
 *   - Anything else (one-off card, UPI without mandate, $0) → "none".
 */
function autoDebitSetUpBy(inv: any): "upi" | "card" | "not_applicable" | "none" {
  if (!inv) return "none";
  const m = inv.metadata || {};
  const cat = String(inv.paymentMethodCategory || "").toLowerCase();
  const plat = String(inv.paymentPlatform || "").toLowerCase();
  if (m.upiAutopayRegistration) return "upi";
  if (plat === "stripe" && (m.stripeCustomerId || m.stripePaymentMethodId)) return "card";
  if (cat === "crypto" || cat === "wallet" || plat === "crypto_wallet" || plat === "store_wallet" || plat === "affiliate_wallet") {
    return "not_applicable";
  }
  return "none";
}

/** Was this invoice collected by the auto-charge cron, and via what? */
function paidByAutoDebit(inv: any): "upi" | "card" | null {
  if (!inv?.metadata?.autoChargedAt) return null;
  const cat = String(inv.paymentMethodCategory || "").toLowerCase();
  if (cat === "upi" || inv.metadata.razorpayRecurringPaymentId) return "upi";
  return "card";
}

/**
 * A subscription invoice funded through the $25 licence: the free first
 * month (`kind: combo_free_first_month`, `triggerInvoiceId` = the UP
 * invoice) or a licence + term bought as one cart (`prepaidViaBundle` = the
 * UP invoice). Either way the NC invoice itself is $0 and the $25 invoice is
 * where the money went.
 */
function offerInvoiceIdOf(inv: any): string | null {
  const m = inv?.metadata || {};
  if (m.kind === "combo_free_first_month" && m.triggerInvoiceId) return String(m.triggerInvoiceId);
  if (m.prepaidViaBundle) return String(m.prepaidViaBundle);
  return null;
}

function buildSubscriberRow(ctx: {
  buyer: any;
  nc: any;
  parents: any[];
  childrenByParent: Map<string, any[]>;
  offerById: Map<string, any>;
  uplinesById: Map<string, any>;
  agentsById: Map<string, any>;
}) {
  const { buyer, nc, parents, childrenByParent, offerById, uplinesById, agentsById } = ctx;
  const buyerId = String(buyer._id);
  const upline = buyer.referredBy ? uplinesById.get(String(buyer.referredBy)) : undefined;
  const agent = buyer.assignedSupportAgentId ? agentsById.get(String(buyer.assignedSupportAgentId)) : undefined;

  // The chain that funds the CURRENT period: the most recent PAID parent
  // (an abandoned later attempt must not displace a live paid chain).
  const paidParents = parents.filter((p) => String(p.status).toLowerCase() === "paid");
  const parent =
    [...paidParents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ||
    null;
  const kids = parent ? childrenByParent.get(String(parent._id)) || [] : [];
  const chain = parent ? [parent, ...kids] : [];
  const paidCycles = chain.filter((i) => String(i.status).toLowerCase() === "paid");

  // Months an invoice's cycle covers. Absent on every pre-term invoice → 1.
  const termOf = (i: any): number =>
    Number(i?.metadata?.termMonths) ||
    i?.recurringIntervalMonths ||
    (i?.recurringPeriod === "quarterly" ? 3 : i?.recurringPeriod === "yearly" ? 12 : 1);

  /**
   * Is the current NC period funded by Garage at all? NetworkChains can
   * activate someone by hand (its `payments[]` then carries a
   * `manual_admin_…` entry). If the newest NC payment is manual and dated
   * after our last paid invoice, the Garage chain is history, not the
   * explanation for today's coverage.
   */
  const ncPayments: any[] = Array.isArray(nc?.payments) ? nc.payments : [];
  const lastNcPayment = [...ncPayments].sort(
    (a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime(),
  )[0];
  const lastPaidInvoice = [...paidCycles].sort(
    (a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime(),
  )[0];
  const manualGrant =
    !!lastNcPayment &&
    String(lastNcPayment.paymentId || "").startsWith("manual_") &&
    (!lastPaidInvoice ||
      new Date(lastNcPayment.paidAt).getTime() >
        new Date(lastPaidInvoice.paidAt || lastPaidInvoice.createdAt).getTime() + 60_000);

  // ── Subscription start ─────────────────────────────────────────────
  // The first invoice of the funding chain. When it is a $0 NC invoice paid
  // for through the $25 licence, the row says so and links the $25 invoice
  // too — that is where the money and the auto-debit setup live.
  const describe = (inv: any) => {
    const offerId = offerInvoiceIdOf(inv);
    const offer = offerId ? offerById.get(offerId) : null;
    // The invoice whose PAYMENT method / autopay setup applies.
    const funding = offer || inv;
    return {
      date: inv.paidAt || inv.createdAt,
      invoice: invoiceRef(inv),
      via25Offer: !!offerId,
      offerInvoice: invoiceRef(offer),
      itemName: inv.lineItems?.[0]?.itemName || null,
      paymentMethodCategory: funding?.paymentMethodCategory || null,
      paymentPlatform: funding?.paymentPlatform || null,
      paymentCurrency: funding?.paymentCurrency || funding?.itemCurrency || null,
      couponCode: inv.couponCode || funding?.couponCode || null,
      /** What paying THIS set up: "upi" | "card" | "not_applicable" | "none". */
      autoDebitSetUp: autoDebitSetUpBy(funding),
      /** Collected by the renewal cron: "upi" | "card" | null. */
      paidByAutoDebit: paidByAutoDebit(inv),
      manualGrant: false,
    };
  };

  const manualDescription = (paidAt: any) => ({
    date: paidAt || nc?.currentPeriodStart || nc?.createdAt,
    invoice: null,
    via25Offer: false,
    offerInvoice: null,
    itemName: null,
    paymentMethodCategory: null,
    paymentPlatform: null,
    paymentCurrency: null,
    couponCode: null,
    autoDebitSetUp: "not_applicable" as const,
    paidByAutoDebit: null,
    manualGrant: true,
  });

  const subscriptionStart = manualGrant
    ? manualDescription(
        [...ncPayments]
          .filter((p) => String(p.paymentId || "").startsWith("manual_"))
          .sort((a, b) => new Date(a.paidAt || 0).getTime() - new Date(b.paidAt || 0).getTime())[0]?.paidAt,
      )
    : parent
      ? describe(parent)
      : manualDescription(nc?.currentPeriodStart);

  // ── Last payment: the most recent invoice on which MONEY MOVED. ──
  //
  // Not "the most recent paid record": a combo activation mints $0
  // bookkeeping cycles on the NetworkChain side (the free first month, and a
  // prepaid term whose cash sits on the $25 combo invoice). Showing one of
  // those here — "$99, Paid" for an invoice that collected nothing — read as
  // a random invoice. So each paid cycle resolves to the invoice that was
  // actually paid: itself when it carried an amount, otherwise the combo /
  // licence invoice that funded it. The newest of those is the last payment,
  // shown directly (no "via $25 offer" indirection — it IS the payment).
  const fundingOf = (inv: any) => {
    if ((inv.totalAmount || 0) > 0) return inv;
    const offerId = offerInvoiceIdOf(inv);
    return (offerId && offerById.get(offerId)) || inv;
  };
  const lastMoneyInvoice = [...paidCycles]
    .map(fundingOf)
    .filter((inv, idx, arr) => arr.findIndex((o) => String(o._id) === String(inv._id)) === idx)
    .sort(
      (a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime(),
    )[0];
  const describeDirect = (inv: any) => ({
    date: inv.paidAt || inv.createdAt,
    invoice: invoiceRef(inv),
    via25Offer: false,
    offerInvoice: null,
    /** What the invoice was for — "Unilevel Plus + 3 months of NetworkChain" on a combo. */
    itemName: inv.lineItems?.[0]?.itemName || null,
    paymentMethodCategory: inv.paymentMethodCategory || null,
    paymentPlatform: inv.paymentPlatform || null,
    paymentCurrency: inv.paymentCurrency || inv.itemCurrency || null,
    couponCode: inv.couponCode || null,
    autoDebitSetUp: autoDebitSetUpBy(inv),
    paidByAutoDebit: paidByAutoDebit(inv),
    manualGrant: false,
  });
  const lastPayment = manualGrant
    ? manualDescription(lastNcPayment?.paidAt)
    : lastMoneyInvoice
      ? describeDirect(lastMoneyInvoice)
      : lastPaidInvoice
        ? describe(lastPaidInvoice)
        : null;

  // ── Next payment: the period end, and the cycle invoice already minted
  // for it when there is one (the cron drafts cycle N+1 ahead of time). ──
  const nextUnpaid = chain
    .filter((i) => !["paid", "cancelled", "expired"].includes(String(i.status).toLowerCase()))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  const nextPayment = {
    date: manualGrant ? nc?.currentPeriodEnd || null : parent?.nextDueDate || nc?.currentPeriodEnd || null,
    invoice: manualGrant ? null : invoiceRef(nextUnpaid),
  };

  // ── Auto debit, right now ──────────────────────────────────────────
  // What would collect the next cycle, or why nothing will.
  const via = autoDebitInstrument(buyer);
  const tokens: any[] = buyer?.paymentProfile?.razorpay?.tokens || [];
  const revokedUpi = tokens.find(
    (t) => t?.method === "upi" && ["revoked", "paused"].includes(String(t?.mandateStatus || "")),
  );
  const removed: any[] = buyer?.paymentProfile?.removedInstruments || [];
  const lastRemoved = [...removed].sort(
    (a, b) => new Date(b.removedAt || 0).getTime() - new Date(a.removedAt || 0).getTime(),
  )[0];
  // Inference for history predating `removedInstruments`: the funding
  // invoice set auto-debit up, yet nothing is live now.
  const setUpAtStart = subscriptionStart.autoDebitSetUp;
  const paidMethodNa = (lastPayment?.autoDebitSetUp || setUpAtStart) === "not_applicable";

  let autoDebit: {
    state: "upi_enabled" | "card_enabled" | "cancelled_by_user" | "not_applicable" | "not_enabled";
    via: "upi" | "card" | null;
    cancelledAt: Date | null;
    detail: string | null;
  };
  if (via === "upi") {
    autoDebit = { state: "upi_enabled", via, cancelledAt: null, detail: tokens.find((t) => t.mandateStatus === "active")?.vpa || null };
  } else if (via === "card") {
    const card = (buyer?.paymentProfile?.stripe?.methods || []).find((m: any) => m.isDefault) ||
      (buyer?.paymentProfile?.stripe?.methods || [])[0];
    autoDebit = { state: "card_enabled", via, cancelledAt: null, detail: card ? [card.brand, card.last4].filter(Boolean).join(" •••• ") : null };
  } else if (revokedUpi) {
    autoDebit = { state: "cancelled_by_user", via: "upi", cancelledAt: null, detail: revokedUpi.vpa || null };
  } else if (lastRemoved) {
    autoDebit = { state: "cancelled_by_user", via: lastRemoved.kind === "upi" ? "upi" : "card", cancelledAt: lastRemoved.removedAt || null, detail: lastRemoved.label || null };
  } else if (setUpAtStart === "upi" || setUpAtStart === "card") {
    // Set up when they paid, gone now, no record of the removal (predates
    // the audit trail) — inferred.
    autoDebit = { state: "cancelled_by_user", via: setUpAtStart, cancelledAt: null, detail: "inferred" };
  } else if (paidMethodNa || manualGrant) {
    autoDebit = { state: "not_applicable", via: null, cancelledAt: null, detail: null };
  } else {
    autoDebit = { state: "not_enabled", via: null, cancelledAt: null, detail: null };
  }

  // ── Counts + money ─────────────────────────────────────────────────
  const paymentsCount = paidCycles.length;
  // Money Garage collected for THIS subscription: every paid NC invoice, plus
  // the subscription slice of a licence+term bundle (the NC invoice is $0
  // then; the cash sits on the $25 invoice under metadata.bundle.subUsd).
  let totalCollectedUsd = paidCycles.reduce((sum, i) => sum + (i.totalAmount || 0) / 100, 0);
  for (const i of paidCycles) {
    const bundleId = i?.metadata?.prepaidViaBundle;
    const bundle = bundleId ? offerById.get(String(bundleId))?.metadata?.bundle : null;
    if (bundle?.subUsd) totalCollectedUsd += Number(bundle.subUsd) || 0;
  }
  const monthsPaid = paidCycles.reduce((sum, i) => sum + termOf(i), 0);

  return {
    _id: buyerId,
    userId: buyerId,
    user: userSummary(buyer),
    upline: userSummary(upline),
    status: "active" as const,
    location: userLocation(buyer),
    assignedTo: agent
      ? {
          id: String(agent._id),
          name: agent.name || null,
          email: agent.email || null,
          profilePicture: agent.profilePicture || null,
          assignedAt: buyer.assignedSupportAgentAt || null,
        }
      : null,
    subscriptionStart,
    lastPayment,
    nextPayment,
    // Kept for the FE's existing sort ids / older readers.
    nextPaymentDate: nextPayment.date,
    paymentsCount,
    // The cycle they are IN — payments made so far (1 payment → 1st cycle).
    cycle: manualGrant ? ncPayments.length : paymentsCount,
    termMonths: parent ? Number(parent?.metadata?.termMonths) || termOf(parent) : 1,
    pendingTermMonths: parent?.metadata?.pendingTermMonths ?? null,
    monthsPaid,
    totalCollectedUsd,
    autoDebit,
    rank: buyer?.ncRank?.current || null,
    rankPeriodKey: buyer?.ncRank?.periodKey || null,
    ncPeriod: {
      start: nc?.currentPeriodStart || null,
      end: nc?.currentPeriodEnd || null,
    },
    commercials: chain.map((i) => ({
      amount: (i.totalAmount ?? 0) / 100,
      currency: i.paymentCurrency || i.itemCurrency || "USD",
      status: i.status,
      invoiceNumber: i.invoiceNumber,
      termMonths: termOf(i),
      periodStart: i?.metadata?.periodStart || null,
      periodEnd: i?.metadata?.periodEnd || null,
    })),
  };
}

/* ── helpers ───────────────────────────────────────────────────────── */

function buyerIdFromInvoice(inv: any): string | undefined {
  const cand =
    inv.userId ??
    inv.buyerUserId ??
    inv.metadata?.userId ??
    inv.metadata?.buyerUserId;
  return cand ? String(cand) : undefined;
}

function userSummary(u: any) {
  if (!u) return null;
  return {
    _id: String(u._id),
    name: u.name || null,
    email: u.email || null,
    phone: u.phone || null,
    profilePicture: u.profilePicture || null,
    country: u.country || null,
    deleted: false as const,
  };
}

/**
 * The buyer, for an invoice whose User document no longer exists.
 *
 * Admin account deletion is deliberately non-cascading — invoices outlive
 * their owner so financial history survives (see routes/garageAdminDangerZone).
 * The consequence is that this table joins to a user that isn't there, and the
 * row rendered completely blank: no name, no email, nothing to identify it by,
 * while the invoice half of the row rendered fine. It read as a broken row
 * rather than a deleted account.
 *
 * `customerEmail` / `customerName` are snapshotted onto the invoice at
 * creation precisely so the record stays self-describing, so use them and mark
 * the row deleted. Nothing is recovered that wasn't already on the invoice —
 * this only stops the UI hiding what it knows.
 */
function deletedBuyerSummary(invoice: any) {
  const email = invoice?.customerEmail || null;
  const name = invoice?.customerName || null;
  if (!email && !name) return null;
  return {
    _id: invoice?.userId ? String(invoice.userId) : null,
    name,
    email,
    phone: null,
    profilePicture: null,
    country: null,
    /** FE renders a "Deleted" badge off this instead of an empty cell. */
    deleted: true as const,
  };
}

function userLocation(u: any) {
  if (!u) return null;
  return {
    city: u.city || null,
    state: u.state || null,
    country: u.country || null,
  };
}

/** The member-facing NetworkChains status, from their NcSubscription record —
 *  the SAME rule as contacts-backend subscription.ts GET /status: active iff
 *  status==="active" AND currentPeriodEnd is in the future. NC's enum spells
 *  cancelled "canceled" (one L); map both to the admin's "cancelled". No
 *  record (or any other non-active state) → expired. */
function ncStatusOf(sub: any, nowMs: number): "active" | "cancelled" | "expired" {
  const st = String(sub?.status || "").toLowerCase();
  if (
    st === "active" &&
    sub?.currentPeriodEnd &&
    new Date(sub.currentPeriodEnd).getTime() > nowMs
  ) {
    return "active";
  }
  if (st === "canceled" || st === "cancelled") return "cancelled";
  return "expired";
}

function computeStats(rows: any[]) {
  // Active only — every row is a live subscription (see the population
  // comment in the route). The other buckets are kept at 0 for readers of
  // the old shape.
  return {
    subscribers: rows.length,
    active: rows.length,
    expired: 0,
    cancelled: 0,
    pending: 0,
  };
}

function computeEmptyStats() {
  return { subscribers: 0, active: 0, expired: 0, cancelled: 0, pending: 0 };
}

/**
 * POST /garage-admin/networkchain-subs/:userId/assign-agent
 * Assign (or reassign / clear) the support agent for a NetworkChain subscriber.
 * Mirrors assignAdminToOrganization, but scoped to the individual paying
 * affiliate (the User), not an organization.
 *
 * Body: { adminId: string | null }  — set assigns, null clears.
 *
 * Access: manage on One Time Affiliates OR NetworkChain Subs — the two
 * tables that surface this action, both keyed off the same User field.
 * Guarded per-route (never router.use — see backend CLAUDE.md); the
 * mount-level gate enforces the same multi-page rule as the belt.
 */
router.post(
  // Two paths, one handler. The assignment is stored on the USER
  // (assignedSupportAgentId), not on anything list-specific, so every admin
  // table that shows that user shares it — assign from NetworkChain Subs or
  // from One Time Affiliates and both reflect the same agent. The neutral
  // /users/... path is what new tables should call.
  ["/networkchain-subs/:userId/assign-agent", "/users/:userId/assign-agent"],
  requireGarageAdminAuth,
  requireAdminAction(["one_time_affiliates", "networkchain_subs"], "assign-agent"),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const adminId = (req.body?.adminId ?? null) as string | null;

      if (!Types.ObjectId.isValid(userId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid user id" });
      }
      const user = await User.findById(userId).select("_id").lean();
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "Subscriber not found" });
      }

      // The garage admin performing the action (from requireGarageAdminAuth).
      // `id`, not `garageAdminId` — attach() in middleware/garageAdminAuth
      // stores the admin's id as `garageAdmin.id`; reading `garageAdminId`
      // was always undefined, so assignedSupportAgentBy was never written.
      const actingAdminId = (req as any).garageAdmin?.id;

      if (adminId === null) {
        await User.updateOne(
          { _id: userId },
          {
            $unset: {
              assignedSupportAgentId: 1,
              assignedSupportAgentAt: 1,
              assignedSupportAgentBy: 1,
            },
          },
        );
        void import("../services/supportChat").then(({ syncSupportAgent }) =>
          syncSupportAgent(userId),
        );
        return res.json({ success: true, data: { userId, assignedTo: null } });
      }

      if (!Types.ObjectId.isValid(adminId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid admin id" });
      }
      const admin = await GarageAdminModel.findById(adminId)
        .select("_id name email profilePicture isActive")
        .lean();
      if (!admin) {
        return res
          .status(404)
          .json({ success: false, message: "Garage admin not found" });
      }
      if ((admin as any).isActive === false) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign an inactive garage admin",
        });
      }

      const now = new Date();
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            assignedSupportAgentId: new Types.ObjectId(adminId),
            assignedSupportAgentAt: now,
            ...(actingAdminId
              ? { assignedSupportAgentBy: new Types.ObjectId(String(actingAdminId)) }
              : {}),
          },
        },
      );

      // The agent joins the user's support chat as staff (and a replaced
      // agent who is no longer staff leaves it).
      void import("../services/supportChat").then(({ syncSupportAgent }) =>
        syncSupportAgent(userId),
      );

      return res.json({
        success: true,
        data: {
          userId,
          assignedTo: {
            id: String(admin._id),
            name: (admin as any).name || null,
            email: (admin as any).email || null,
            profilePicture: (admin as any).profilePicture || null,
            assignedAt: now,
          },
        },
      });
    } catch (err) {
      console.error(
        "[garage-admin/networkchain-subs assign-agent] error:",
        err,
      );
      return res
        .status(500)
        .json({ success: false, message: "Failed to assign agent" });
    }
  },
);

export default router;
