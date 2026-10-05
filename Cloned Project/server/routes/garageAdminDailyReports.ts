import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import {
  requireGarageAdminAuth,
  requireAdminPage,
} from "../middleware/garageAdminAuth";
import { Invoice } from "../models/invoice.model";
import { User } from "../models/user.model";
import { OFFICE_PLAN_IDS } from "../models/officePlan.model";

/**
 * GET /garage-admin/daily-reports
 *
 * "What did we sell, and to whom" — every PAID invoice of three kinds inside
 * a date window, grouped by the person who paid:
 *
 *   office     Founders Office plans (`office_plan`), new and renewals. $0
 *              cycles (Starter, trials, free first cycles) are not sales and
 *              are dropped.
 *   unilevel   Every Unilevel Plus purchase (`unilevel_plus`): the $25 combo,
 *              combo + prepaid term, plain licence, reserve seats.
 *   networkchain NetworkChain subscriptions paid on their own
 *              (`third_party_subscription` with money on it): a first cycle
 *              bought through NC, or a renewal. The $0 records a combo mints
 *              (free first month, prepaid term) are bookkeeping for cash that
 *              already sits on the combo invoice, and are dropped; so are
 *              wallet top-ups that share the item type.
 *   whitelabel Crypto white-label add-ons (`whitelabel_addon`, `cryptosub`).
 *
 * Payment method is orthogonal to kind: a licence paid in USDT on BSC is a
 * unilevel sale whose `method` says so and whose `charged` is the on-chain
 * amount.
 *
 * Days are Asia/Kolkata days — the team reads this in IST. Default window is
 * yesterday 00:00 IST → now. Wire format is calendar days (`from`/`to` as
 * YYYY-MM-DD); the response echoes the resolved instants.
 *
 * Amounts: `totalAmount` is minor units of `itemCurrency`, and every item type
 * here is priced in USD, so `usd = totalAmount / 100`. When the buyer settled
 * in another currency the invoice carries `currencyConversion`, and
 * `charged` is what they actually paid (e.g. ₹11,907 for a $124 combo).
 *
 * Read-only. Page-gated (`daily_reports`, view) — grantable to non-super
 * admins through Roles & Access.
 */
const router = Router();

export type DailyReportKind = "office" | "unilevel" | "networkchain" | "whitelabel";
type Flag = "cryptobrand_bootstrap" | "legacy_inr_paise" | "paidAt_missing";

const KIND_OF_ITEM_TYPE: Record<string, DailyReportKind> = {
  office_plan: "office",
  unilevel_plus: "unilevel",
  third_party_subscription: "networkchain",
  whitelabel_addon: "whitelabel",
  cryptosub: "whitelabel",
};

// The buyer-facing invoice page — for sending to the buyer, so hard-coded
// rather than read from a FRONTEND_URL that is localhost in dev.
const PUBLIC_APP_ORIGIN = "https://my.garage.app";
const TZ = "Asia/Kolkata";

/* ── IST calendar days ─────────────────────────────────────────────── */

function ymdInIst(d: Date): string {
  // en-CA gives YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function istDayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000+05:30`);
}
function istDayEnd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+05:30`);
}
function shiftYmd(ymd: string, days: number): string {
  // Shift at IST noon so DST-free IST arithmetic never crosses a day edge.
  const at = new Date(`${ymd}T12:00:00.000+05:30`);
  at.setUTCDate(at.getUTCDate() + days);
  return ymdInIst(at);
}
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/* ── helpers copied from garageAdminNetworkChainSubs (same row shapes) ── */

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

/** The buyer, for an invoice whose User document no longer exists. */
function deletedBuyerSummary(invoice: any) {
  return {
    _id: invoice?.userId ? String(invoice.userId) : null,
    name: invoice?.customerName || null,
    email: invoice?.customerEmail || null,
    phone: null,
    profilePicture: null,
    country: null,
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

const CHAIN_LABEL: Record<string, string> = {
  bsc: "BSC",
  tron: "Tron",
  polygon: "Polygon",
  ethereum: "Ethereum",
  bitcoin: "Bitcoin",
};

function isCryptoPaid(inv: any): boolean {
  return (
    String(inv.paymentMethodCategory || "").toLowerCase() === "crypto" ||
    String(inv.paymentPlatform || "").toLowerCase() === "crypto_wallet"
  );
}

function paymentMethodLabel(inv: any): string {
  const cat = String(inv.paymentMethodCategory || "").toLowerCase();
  const plat = String(inv.paymentPlatform || "").toLowerCase();
  if (plat === "store_wallet") return "Store Vault";
  if (plat === "affiliate_wallet") return "Affiliate Vault";
  if (plat === "auction_wallet") return "Auction Vault";
  if (isCryptoPaid(inv)) {
    const m = inv.metadata || {};
    const coin = m.cryptoCoin ? String(m.cryptoCoin).toUpperCase() : null;
    const chain = m.cryptoChain ? CHAIN_LABEL[String(m.cryptoChain).toLowerCase()] || String(m.cryptoChain) : null;
    return coin ? `Crypto · ${coin}${chain ? ` (${chain})` : ""}` : "Crypto";
  }
  const provider = plat === "razorpay" ? "Razorpay" : plat === "stripe" ? "Stripe" : plat;
  if (cat === "card") return provider ? `Card (${provider})` : "Card";
  if (cat === "upi") return provider ? `UPI (${provider})` : "UPI";
  if (cat === "wallet") return "Wallet";
  if (!cat && !plat) return "—";
  return provider || cat || "—";
}

/* ── classification ────────────────────────────────────────────────── */

const OFFICE_PLAN_NAME: Record<string, string> = {
  [OFFICE_PLAN_IDS.pro]: "Founders Office",
  [OFFICE_PLAN_IDS.basic]: "Distributors Office",
  [OFFICE_PLAN_IDS.starter]: "Starter",
};

type Classified = {
  kind: DailyReportKind;
  tag: string;
  itemName: string;
  flags: Flag[];
};

/** Null = not a sale (a $0 office cycle); otherwise how to label it. */
function classify(inv: any, line: any): Classified | null {
  const kind = KIND_OF_ITEM_TYPE[line.itemType];
  const m = inv.metadata || {};
  const flags: Flag[] = [];
  if (m.source === "cryptobrand_bootstrap") flags.push("cryptobrand_bootstrap");

  if (kind === "office") {
    // Starter, trials, admin free cycles, 100%-off coupons: paid, but no sale.
    if ((inv.totalAmount || 0) <= 0) return null;
    const isRenewal = !!inv.parentInvoiceId || Number(inv.recurringPaymentNumber || 0) > 1;
    const cycle = Number(inv.recurringPaymentNumber || 0);
    return {
      kind,
      tag: isRenewal ? `Renewal · cycle ${cycle || "?"}` : "New",
      itemName: OFFICE_PLAN_NAME[String(line.itemId)] || line.itemName || "Office plan",
      flags,
    };
  }

  if (kind === "unilevel") {
    let tag: string;
    if (m.bundle?.termMonths) tag = `Combo + ${m.bundle.termMonths}-month`;
    else if (m.combo) tag = m.combo.freeFirstCycle ? "Combo · free 1st month" : "Combo";
    else if (Number(line.quantity || 1) > 1) tag = `Reserve ×${line.quantity}`;
    else tag = "Licence";
    return { kind, tag, itemName: line.itemName || "Unilevel Plus", flags };
  }

  if (kind === "networkchain") {
    // Money must have moved on THIS invoice. A combo's free month and its
    // prepaid term are $0 here (cash on the combo invoice, already counted
    // under unilevel); wallet top-ups borrow the item type and aren't subs.
    if ((inv.totalAmount || 0) <= 0) return null;
    if (m.kind === "topup") return null;
    const isRenewal = !!inv.parentInvoiceId || Number(inv.recurringPaymentNumber || 0) > 1;
    const cycle = Number(inv.recurringPaymentNumber || 0);
    const term = Number(m.termMonths || 0);
    const termLabel = term > 1 ? `${term}-month` : "monthly";
    return {
      kind,
      tag: `${isRenewal ? `Renewal · cycle ${cycle || "?"}` : "First cycle"} · ${termLabel}`,
      itemName: m.thirdPartyClientName ? `${m.thirdPartyClientName} subscription` : line.itemName || "NetworkChain subscription",
      flags,
    };
  }

  // whitelabel_addon / cryptosub
  const product = line.itemType === "cryptosub" ? "Cryptosub" : "White-label";
  const source = m.source === "cryptobrand_bootstrap" ? "bootstrap" : "self-serve";
  return {
    kind,
    tag: `${product} · ${source}`,
    itemName: line.itemName || m.addonSlug || product,
    flags,
  };
}

/* ── the route ─────────────────────────────────────────────────────── */

router.get(
  "/daily-reports",
  requireGarageAdminAuth,
  requireAdminPage("daily_reports", "view"),
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
      const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
      const sortBy = String(req.query.sortBy || "totalUsd");
      const sortOrder =
        String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
      const q = String(req.query.q || "").trim();

      /**
       * Downline scope (?rootUserId=) and its exceptions (?excludeUserId=),
       * same contract and same semantics as One Time Affiliates:
       *   • the root's OWN row is not in their downline
       *   • excluding someone removes what they recruited (every generation
       *     below them) but keeps that person, since they are still one of
       *     the root's people
       * A malformed root means "nobody", never "everybody".
       */
      const rootUserId = String(req.query.rootUserId || "").trim();
      const excludeRaw = req.query.excludeUserId;
      const excludeIds = (
        Array.isArray(excludeRaw) ? excludeRaw.map((v) => String(v)) : String(excludeRaw || "").split(",")
      )
        .map((v) => v.trim())
        .filter((v) => v && Types.ObjectId.isValid(v))
        .map((v) => new Types.ObjectId(v));

      let scopedBuyerIds: Set<string> | null = null;
      if (rootUserId) {
        if (!Types.ObjectId.isValid(rootUserId)) {
          scopedBuyerIds = new Set<string>();
        } else {
          const rootOid = new Types.ObjectId(rootUserId);
          const descendants = await User.find(
            { $or: [{ ancestors: rootOid }, { referredBy: rootOid }] },
            { _id: 1 },
          ).lean();
          scopedBuyerIds = new Set(descendants.map((u) => String(u._id)));
          if (excludeIds.length) {
            const dropped = await User.find(
              { $or: [{ ancestors: { $in: excludeIds } }, { referredBy: { $in: excludeIds } }] },
              { _id: 1 },
            ).lean();
            for (const u of dropped) scopedBuyerIds.delete(String(u._id));
          }
        }
      }
      const kindFilter = String(req.query.kind || "").trim() as DailyReportKind | "";
      if (kindFilter && !["office", "unilevel", "networkchain", "whitelabel"].includes(kindFilter)) {
        return res.status(400).json({ error: "kind must be office, unilevel, networkchain or whitelabel" });
      }

      // ── Window ──
      const now = new Date();
      const todayIst = ymdInIst(now);
      let fromYmd = String(req.query.from || shiftYmd(todayIst, -1)).trim();
      let toYmd = String(req.query.to || todayIst).trim();
      if (!YMD.test(fromYmd) || !YMD.test(toYmd)) {
        return res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
      }
      if (fromYmd > toYmd) [fromYmd, toYmd] = [toYmd, fromYmd];
      const fromAt = istDayStart(fromYmd);
      let toAt = istDayEnd(toYmd);
      if (Number.isNaN(fromAt.getTime()) || Number.isNaN(toAt.getTime())) {
        return res.status(400).json({ error: "from/to is not a valid date" });
      }
      if (toAt > now) toAt = now;

      // ── Invoices ──
      const itemTypes = kindFilter
        ? Object.keys(KIND_OF_ITEM_TYPE).filter((t) => KIND_OF_ITEM_TYPE[t] === kindFilter)
        : Object.keys(KIND_OF_ITEM_TYPE);
      const invoices = (await Invoice.find({
        status: "paid",
        ...(scopedBuyerIds
          ? {
              userId: {
                $in: [...scopedBuyerIds].filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)),
              },
            }
          : {}),
        "lineItems.itemType": { $in: itemTypes },
        $or: [
          { paidAt: { $gte: fromAt, $lte: toAt } },
          // Very old paid rows never had paidAt stamped.
          { paidAt: null, createdAt: { $gte: fromAt, $lte: toAt } },
        ],
      })
        .select(
          "invoiceNumber userId customerEmail customerName lineItems totalAmount subtotal tax itemCurrency paymentCurrency currencyConversion paymentMethodCategory paymentPlatform paidAt createdAt parentInvoiceId recurringPaymentNumber razorpaySubscriptionId metadata",
        )
        .lean()) as any[];

      // ── Buyers ──
      const buyerIds = [...new Set(invoices.map((i) => String(i.userId)).filter(Boolean))];
      const buyers = await User.find({
        _id: { $in: buyerIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)) },
      })
        .select("name email phone country state city profilePicture referredBy")
        .lean();
      const buyersById = new Map(buyers.map((u) => [String(u._id), u]));

      // ── Uplines ──
      // Who referred each buyer, resolved in one batch. Same source as the
      // NetworkChain Subs table (`User.referredBy`), so the two pages name
      // the same person for the same buyer.
      const uplineIds = new Set<string>();
      for (const b of buyers as any[]) {
        if (b.referredBy) uplineIds.add(String(b.referredBy));
      }
      const uplines = uplineIds.size
        ? await User.find({
            _id: {
              $in: [...uplineIds]
                .filter((id) => Types.ObjectId.isValid(id))
                .map((id) => new Types.ObjectId(id)),
            },
          })
            .select("name email phone country profilePicture")
            .lean()
        : [];
      const uplinesById = new Map(uplines.map((u) => [String(u._id), u]));

      // ── Group ──
      type Row = {
        _id: string;
        user: ReturnType<typeof userSummary> | ReturnType<typeof deletedBuyerSummary>;
        /** Who referred the buyer. Null for a deleted buyer or a direct signup. */
        upline: ReturnType<typeof userSummary>;
        location: ReturnType<typeof userLocation>;
        invoiceCount: number;
        counts: Record<DailyReportKind, number>;
        byKindUsd: Record<DailyReportKind, number>;
        totalUsd: number;
        lastPaidAt: string;
        invoices: any[];
      };
      const rows = new Map<string, Row>();
      const zero = () => ({ office: 0, unilevel: 0, networkchain: 0, whitelabel: 0 });

      for (const inv of invoices) {
        const line = (inv.lineItems || []).find((l: any) => KIND_OF_ITEM_TYPE[l.itemType]) || inv.lineItems?.[0];
        if (!line) continue;
        const c = classify(inv, line);
        if (!c) continue;

        const flags: Flag[] = [...c.flags];
        const paidAtDate: Date = inv.paidAt || inv.createdAt;
        if (!inv.paidAt) flags.push("paidAt_missing");

        // Money. Pre-April-2026 office renewals minted from Razorpay
        // subscriptions stored the Razorpay amount (INR paise) in totalAmount
        // while itemCurrency stayed USD — convert when the FX is on the row,
        // otherwise show the rupees and keep them out of the USD sums.
        let usd: number | null = (inv.totalAmount || 0) / 100;
        let charged: { amount: number; currency: string } | null = null;
        const conv = inv.currencyConversion;
        const legacyPaise =
          c.kind === "office" &&
          !!inv.razorpaySubscriptionId &&
          !!inv.parentInvoiceId &&
          String(inv.paymentPlatform || "") === "razorpay" &&
          String(inv.paymentCurrency || "") === "INR";
        if (legacyPaise) {
          flags.push("legacy_inr_paise");
          charged = { amount: (inv.totalAmount || 0) / 100, currency: "INR" };
          usd =
            conv?.fromCurrency === "USD" && conv?.toCurrency === "INR" && conv.exchangeRate > 0
              ? Math.round(((inv.totalAmount || 0) / conv.exchangeRate)) / 100
              : null;
        } else if (isCryptoPaid(inv) && inv.metadata?.cryptoCoin) {
          // Stablecoins are USD-pegged; the ask was made in USD cents and
          // settled 1:1 in the coin. Show it in the coin so the line reads
          // as what was actually sent.
          const cents = Number(inv.metadata.cryptoAmountUsdCents || inv.totalAmount || 0);
          charged = { amount: cents / 100, currency: String(inv.metadata.cryptoCoin).toUpperCase() };
        } else if (
          inv.paymentCurrency &&
          inv.paymentCurrency !== (inv.itemCurrency || "USD") &&
          conv?.exchangeRate > 0
        ) {
          charged = {
            amount: Math.round((inv.totalAmount || 0) * conv.exchangeRate) / 100,
            currency: inv.paymentCurrency,
          };
        }
        const gstUsd = (inv.tax || 0) > 0 && !legacyPaise ? inv.tax / 100 : null;

        const entry = {
          id: String(inv._id),
          invoiceNumber: inv.invoiceNumber,
          publicUrl: `${PUBLIC_APP_ORIGIN}/invoice/${String(inv._id)}`,
          kind: c.kind,
          tag: c.tag,
          itemName: c.itemName,
          paidAt: paidAtDate,
          usd,
          gstUsd,
          charged,
          method: paymentMethodLabel(inv),
          /** On-chain transaction for a crypto payment, when we have it. */
          txHash: isCryptoPaid(inv) && inv.metadata?.cryptoTxHash ? String(inv.metadata.cryptoTxHash) : null,
          cryptoChain: isCryptoPaid(inv) && inv.metadata?.cryptoChain ? String(inv.metadata.cryptoChain).toLowerCase() : null,
          flags,
        };

        const uid = String(inv.userId || "");
        const buyer = buyersById.get(uid);
        const rowId = buyer ? uid : `deleted:${uid || inv.customerEmail || String(inv._id)}`;
        let row = rows.get(rowId);
        if (!row) {
          row = {
            _id: rowId,
            user: buyer ? userSummary(buyer) : deletedBuyerSummary(inv),
            upline: userSummary(
              (buyer as any)?.referredBy
                ? uplinesById.get(String((buyer as any).referredBy))
                : null
            ),
            location: userLocation(buyer),
            invoiceCount: 0,
            counts: zero(),
            byKindUsd: zero(),
            totalUsd: 0,
            lastPaidAt: paidAtDate.toISOString(),
            invoices: [],
          };
          rows.set(rowId, row);
        }
        row.invoices.push(entry);
        row.invoiceCount++;
        row.counts[c.kind]++;
        if (usd != null) {
          row.byKindUsd[c.kind] = round2(row.byKindUsd[c.kind] + usd);
          row.totalUsd = round2(row.totalUsd + usd);
        }
        if (paidAtDate.toISOString() > row.lastPaidAt) row.lastPaidAt = paidAtDate.toISOString();
      }

      let list = [...rows.values()];
      for (const r of list) {
        r.invoices.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      }

      // ── Search (header box): buyer name / email / phone ──
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        list = list.filter(
          (r) => re.test(r.user?.name || "") || re.test(r.user?.email || "") || re.test(r.user?.phone || ""),
        );
      }

      // ── Sort ──
      const sortKey: Record<string, (r: Row) => number | string> = {
        totalUsd: (r) => r.totalUsd,
        invoiceCount: (r) => r.invoiceCount,
        lastPaidAt: (r) => r.lastPaidAt,
        name: (r) => (r.user?.name || r.user?.email || "").toLowerCase(),
      };
      const keyFn = sortKey[sortBy] || sortKey.totalUsd;
      list.sort((a, b) => {
        const ka = keyFn(a);
        const kb = keyFn(b);
        if (ka < kb) return -1 * sortOrder;
        if (ka > kb) return 1 * sortOrder;
        return a._id.localeCompare(b._id);
      });

      // ── Stats over everything in the window (not just the page) ──
      const stats = {
        users: list.length,
        invoices: list.reduce((n, r) => n + r.invoiceCount, 0),
        totalUsd: round2(list.reduce((n, r) => n + r.totalUsd, 0)),
        officeUsd: round2(list.reduce((n, r) => n + r.byKindUsd.office, 0)),
        unilevelUsd: round2(list.reduce((n, r) => n + r.byKindUsd.unilevel, 0)),
        networkchainUsd: round2(list.reduce((n, r) => n + r.byKindUsd.networkchain, 0)),
        whitelabelUsd: round2(list.reduce((n, r) => n + r.byKindUsd.whitelabel, 0)),
        cryptoUsd: round2(
          list.reduce(
            (n, r) => n + r.invoices.filter((i) => i.method.startsWith("Crypto")).reduce((m, i) => m + (i.usd || 0), 0),
            0,
          ),
        ),
        officeCount: list.reduce((n, r) => n + r.counts.office, 0),
        unilevelCount: list.reduce((n, r) => n + r.counts.unilevel, 0),
        networkchainCount: list.reduce((n, r) => n + r.counts.networkchain, 0),
        whitelabelCount: list.reduce((n, r) => n + r.counts.whitelabel, 0),
        cryptoCount: list.reduce((n, r) => n + r.invoices.filter((i) => i.method.startsWith("Crypto")).length, 0),
        flagged: list.reduce(
          (n, r) => n + r.invoices.filter((i) => i.flags.includes("legacy_inr_paise")).length,
          0,
        ),
      };

      const page = list.slice(offset, offset + limit);
      return res.json({
        data: page,
        stats,
        pagination: { total: list.length, limit, offset },
        range: {
          from: fromYmd,
          to: toYmd,
          fromAt: fromAt.toISOString(),
          toAt: toAt.toISOString(),
          timeZone: TZ,
        },
      });
    } catch (err) {
      console.error("[garage-admin/daily-reports] error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  },
);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default router;
