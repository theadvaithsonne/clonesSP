// HiFi bonds — founder instrument management + investor purchase.
//
// Crypto offices only: every route asserts
// `Organization.officeCreatedFromCryptobrand === true`.
//
// The purchase route is deliberately "silent": it mints an invoice AND
// settles it from the buyer's store wallet inside one request, then
// returns the already-paid invoice as a receipt. The investor never
// sees a checkout page.

import { Router, Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { CombPlan } from "../models/combPlan.model";
import { BondInstrument } from "../models/bondInstrument.model";
import { BondHolding } from "../models/bondHolding.model";
import { BondPayoutEvent } from "../models/bondPayoutEvent.model";
import { BondLedgerEntry } from "../models/bondLedgerEntry.model";
import { createInvoice, fulfillInvoice } from "../services/invoice";
import { debitStoreWallet } from "../services/wallet";
import {
  BOND_CURRENCIES,
  BondCurrency,
  fromAtomic,
  toAtomic,
  mulUnits,
  toWalletAmount,
} from "../config/bondMoney";
import {
  PAYOUT_FREQUENCIES,
  PayoutFrequency,
  deriveInstrumentFigures,
} from "../services/bondMath";
import {
  validateInstrument,
  validateAcknowledgement,
  validateLevelsAgainstRate,
  toInvoiceMinorUnits,
} from "../services/bondValidation";
import { redeemHolding } from "../services/bondPayoutEngine";
import { Invoice } from "../models/invoice.model";
import { normalizeBondHash } from "../services/bondHash";
import {
  buildPublicBondView,
  buildHoldingListItem,
  loadViewSources,
} from "../services/bondView";

const router = Router();

// ---------------------------------------------------------------
// guards
// ---------------------------------------------------------------

async function isOrgFounder(userId: string, orgId: string): Promise<boolean> {
  const u = await User.findOne({
    _id: userId,
    organizations: {
      $elemMatch: { organization: new Types.ObjectId(orgId), role: "founder" },
    },
  })
    .select("_id")
    .lean();
  return !!u;
}

/** Crypto-office gate + founder check. Returns an error payload or null. */
async function assertFounderOfCryptoOffice(
  userId: string,
  orgId: string,
): Promise<{ status: number; body: any } | null> {
  if (!mongoose.isValidObjectId(orgId)) {
    return { status: 400, body: { success: false, error: "Invalid orgId" } };
  }
  const org = await Organization.findById(orgId)
    .select("officeCreatedFromCryptobrand")
    .lean();
  if (!org) {
    return { status: 404, body: { success: false, error: "Organization not found" } };
  }
  if (!(org as any).officeCreatedFromCryptobrand) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Bonds are only available to crypto offices",
      },
    };
  }
  if (!(await isOrgFounder(userId, orgId))) {
    return { status: 403, body: { success: false, error: "Founder access required" } };
  }
  return null;
}

// ---------------------------------------------------------------
// shared input shape
// ---------------------------------------------------------------

const decimalStr = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d+(\.\d+)?$/.test(v), "must be a non-negative decimal");

const instrumentBody = z.object({
  orgId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** Whole units, e.g. "1000" for Rs1,000. */
  unitPrice: decimalStr,
  currency: z.enum(BOND_CURRENCIES),
  durationDays: z.number().int().min(1).max(3650),
  payoutFrequency: z.enum(PAYOUT_FREQUENCIES),
  ratePerPayoutPeriod: decimalStr,
  totalUnits: z.number().int().min(1),
  minUnits: z.number().int().min(1).default(1),
  commissionBasis: z.enum(["principal", "payout", "both", "none"]).default("none"),
  principalCommissionRate: decimalStr.default("0"),
  payoutCommissionRate: decimalStr.default("0"),
  combPlanId: z.string().optional().nullable(),
});

function buildDerived(b: z.infer<typeof instrumentBody>) {
  const unitPriceAtomic = toAtomic(b.unitPrice, b.currency as BondCurrency);
  return {
    unitPriceAtomic,
    derived: deriveInstrumentFigures({
      unitPriceAtomic,
      currency: b.currency as BondCurrency,
      durationDays: b.durationDays,
      payoutFrequency: b.payoutFrequency as PayoutFrequency,
      ratePerPayoutPeriod: b.ratePerPayoutPeriod,
      totalUnits: b.totalUnits,
      commissionBasis: b.commissionBasis,
      principalCommissionRate: b.principalCommissionRate,
      payoutCommissionRate: b.payoutCommissionRate,
    }),
  };
}

/** Same numbers the API returns, in human-readable form too. */
function presentDerived(d: any, currency: BondCurrency) {
  const f = (a: string) =>
    a.startsWith("-")
      ? `-${fromAtomic(a.slice(1), currency)}`
      : fromAtomic(a, currency);
  return {
    atomic: d,
    display: {
      currency,
      payoutAmountPerUnit: f(d.payoutAmountPerUnitAtomic),
      payoutCount: d.payoutCount,
      totalInterestPerUnit: f(d.totalInterestPerUnitAtomic),
      totalCommissionPerUnit: f(d.totalCommissionPerUnitAtomic),
      totalOutflowPerUnit: f(d.totalOutflowPerUnitAtomic),
      sellerNetPerUnit: f(d.sellerNetPerUnitAtomic),
      totalRaise: f(d.totalRaiseAtomic),
      totalInterestAtFull: f(d.totalInterestAtFullAtomic),
      totalCommissionAtFull: f(d.totalCommissionAtFullAtomic),
      totalOutflowAtFull: f(d.totalOutflowAtFullAtomic),
      sellerNetAtFull: f(d.sellerNetAtFullAtomic),
      annualisedRatePct: d.annualisedRatePct,
      stubDays: d.stubDays,
    },
  };
}

// ---------------------------------------------------------------
// POST /bonds/instruments/preview — spec §7 obligation panel
// ---------------------------------------------------------------
router.post("/instruments/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const b = instrumentBody.parse(req.body);
    const guard = await assertFounderOfCryptoOffice(me.userId, b.orgId);
    if (guard) return res.status(guard.status).json(guard.body);

    const { unitPriceAtomic, derived } = buildDerived(b);
    const issues = validateInstrument({
      unitPriceAtomic,
      currency: b.currency as BondCurrency,
      durationDays: b.durationDays,
      payoutFrequency: b.payoutFrequency as PayoutFrequency,
      ratePerPayoutPeriod: b.ratePerPayoutPeriod,
      totalUnits: b.totalUnits,
      minUnits: b.minUnits,
      commissionBasis: b.commissionBasis,
      principalCommissionRate: b.principalCommissionRate,
      payoutCommissionRate: b.payoutCommissionRate,
    });

    return res.json({
      success: true,
      // Preview never writes, so it returns issues rather than 400 —
      // the builder shows them live while the founder is still typing.
      issues,
      publishable: issues.length === 0,
      ...presentDerived(derived, b.currency as BondCurrency),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues });
    }
    console.error("[bonds] preview error:", err);
    return res.status(500).json({ success: false, error: "Preview failed" });
  }
});

// ---------------------------------------------------------------
// POST /bonds/instruments — create a draft
// ---------------------------------------------------------------
router.post("/instruments", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const b = instrumentBody.parse(req.body);
    const guard = await assertFounderOfCryptoOffice(me.userId, b.orgId);
    if (guard) return res.status(guard.status).json(guard.body);

    const { unitPriceAtomic, derived } = buildDerived(b);
    const issues = validateInstrument({
      unitPriceAtomic,
      currency: b.currency as BondCurrency,
      durationDays: b.durationDays,
      payoutFrequency: b.payoutFrequency as PayoutFrequency,
      ratePerPayoutPeriod: b.ratePerPayoutPeriod,
      totalUnits: b.totalUnits,
      minUnits: b.minUnits,
      commissionBasis: b.commissionBasis,
      principalCommissionRate: b.principalCommissionRate,
      payoutCommissionRate: b.payoutCommissionRate,
    });
    if (issues.length) {
      return res.status(400).json({ success: false, issues });
    }

    const doc = await BondInstrument.create({
      orgId: b.orgId,
      createdBy: me.userId,
      name: b.name,
      description: b.description || "",
      status: "draft",
      unitPriceAtomic,
      currency: b.currency,
      durationDays: b.durationDays,
      payoutFrequency: b.payoutFrequency,
      ratePerPayoutPeriod: b.ratePerPayoutPeriod,
      totalUnits: b.totalUnits,
      minUnits: b.minUnits,
      commissionBasis: b.commissionBasis,
      principalCommissionRate: b.principalCommissionRate,
      payoutCommissionRate: b.payoutCommissionRate,
      combPlanId: b.combPlanId || null,
      derived,
    });

    return res.status(201).json({
      success: true,
      instrument: doc,
      ...presentDerived(derived, b.currency as BondCurrency),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues });
    }
    console.error("[bonds] create error:", err);
    return res.status(500).json({ success: false, error: "Create failed" });
  }
});

// ---------------------------------------------------------------
// GET /bonds/instruments?orgId=&status=
// ---------------------------------------------------------------
router.get("/instruments", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = String(req.query.orgId || "");
    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ success: false, error: "orgId is required" });
    }
    const q: any = { orgId };
    if (req.query.status) q.status = String(req.query.status);
    // Investors browsing an office only ever see live instruments;
    // drafts are the founder's private workspace.
    if (!(await isOrgFounder((req as any).user.userId, orgId))) {
      q.status = { $in: ["published", "fully_subscribed"] };
    }
    const items = await BondInstrument.find(q).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, items });
  } catch (err: any) {
    console.error("[bonds] list error:", err);
    return res.status(500).json({ success: false, error: "List failed" });
  }
});

// ---------------------------------------------------------------
// GET /bonds/instruments/:id
// ---------------------------------------------------------------
router.get("/instruments/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const inst: any = await BondInstrument.findById(req.params.id).lean();
    if (!inst) return res.status(404).json({ success: false, error: "Not found" });
    return res.json({
      success: true,
      instrument: inst,
      ...presentDerived(inst.derived, inst.currency),
      unitsRemaining: inst.totalUnits - (inst.unitsSold || 0),
    });
  } catch (err: any) {
    console.error("[bonds] get error:", err);
    return res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

// ---------------------------------------------------------------
// PATCH /bonds/instruments/:id — drafts only (spec §9)
// ---------------------------------------------------------------
router.patch("/instruments/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const inst: any = await BondInstrument.findById(req.params.id);
    if (!inst) return res.status(404).json({ success: false, error: "Not found" });
    const guard = await assertFounderOfCryptoOffice(me.userId, String(inst.orgId));
    if (guard) return res.status(guard.status).json(guard.body);

    // Spec §9: "An instrument with live holdings cannot be edited —
    // only closed to new purchases."
    if (inst.status !== "draft") {
      return res.status(409).json({
        success: false,
        code: "NOT_EDITABLE",
        error:
          `A ${inst.status} bond cannot be edited — investors hold positions priced ` +
          `on its current terms. Close it to new purchases instead.`,
      });
    }

    const b = instrumentBody.parse({ ...req.body, orgId: String(inst.orgId) });
    const { unitPriceAtomic, derived } = buildDerived(b);
    const issues = validateInstrument({
      unitPriceAtomic,
      currency: b.currency as BondCurrency,
      durationDays: b.durationDays,
      payoutFrequency: b.payoutFrequency as PayoutFrequency,
      ratePerPayoutPeriod: b.ratePerPayoutPeriod,
      totalUnits: b.totalUnits,
      minUnits: b.minUnits,
      commissionBasis: b.commissionBasis,
      principalCommissionRate: b.principalCommissionRate,
      payoutCommissionRate: b.payoutCommissionRate,
    });
    if (issues.length) return res.status(400).json({ success: false, issues });

    Object.assign(inst, {
      name: b.name,
      description: b.description || "",
      unitPriceAtomic,
      currency: b.currency,
      durationDays: b.durationDays,
      payoutFrequency: b.payoutFrequency,
      ratePerPayoutPeriod: b.ratePerPayoutPeriod,
      totalUnits: b.totalUnits,
      minUnits: b.minUnits,
      commissionBasis: b.commissionBasis,
      principalCommissionRate: b.principalCommissionRate,
      payoutCommissionRate: b.payoutCommissionRate,
      combPlanId: b.combPlanId || null,
      derived,
      // Terms changed -> any previous acknowledgement is void.
      acknowledgedOutflowAtomic: null,
    });
    await inst.save();

    return res.json({
      success: true,
      instrument: inst,
      ...presentDerived(derived, b.currency as BondCurrency),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues });
    }
    console.error("[bonds] patch error:", err);
    return res.status(500).json({ success: false, error: "Update failed" });
  }
});

// ---------------------------------------------------------------
// POST /bonds/instruments/:id/publish
// ---------------------------------------------------------------
router.post("/instruments/:id/publish", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const inst: any = await BondInstrument.findById(req.params.id);
    if (!inst) return res.status(404).json({ success: false, error: "Not found" });
    const guard = await assertFounderOfCryptoOffice(me.userId, String(inst.orgId));
    if (guard) return res.status(guard.status).json(guard.body);
    if (inst.status !== "draft") {
      return res.status(409).json({ success: false, error: `Already ${inst.status}` });
    }

    const schema = z.object({ acknowledgedOutflow: decimalStr });
    const { acknowledgedOutflow } = schema.parse(req.body);
    const ackAtomic = toAtomic(acknowledgedOutflow, inst.currency);

    const issues = [
      ...validateInstrument({
        unitPriceAtomic: inst.unitPriceAtomic,
        currency: inst.currency,
        durationDays: inst.durationDays,
        payoutFrequency: inst.payoutFrequency,
        ratePerPayoutPeriod: inst.ratePerPayoutPeriod,
        totalUnits: inst.totalUnits,
        minUnits: inst.minUnits,
        commissionBasis: inst.commissionBasis,
        principalCommissionRate: inst.principalCommissionRate,
        payoutCommissionRate: inst.payoutCommissionRate,
      }),
      ...validateAcknowledgement(
        ackAtomic,
        inst.derived.totalOutflowPerUnitAtomic,
        inst.currency,
      ),
    ];

    // A `levels` plan's percentages must sum to the bond's own rate.
    if (inst.combPlanId && inst.commissionBasis !== "none") {
      const plan: any = await CombPlan.findById(inst.combPlanId).lean();
      if (!plan) {
        issues.push({
          field: "combPlanId",
          code: "PLAN_NOT_FOUND",
          message: "The selected comp plan no longer exists.",
        });
      } else if (plan.planKind !== "unilevel_plus") {
        const rate =
          inst.commissionBasis === "payout"
            ? inst.payoutCommissionRate
            : inst.principalCommissionRate;
        issues.push(...validateLevelsAgainstRate(plan.levels || [], rate));
      }
    }

    if (issues.length) return res.status(400).json({ success: false, issues });

    inst.status = "published";
    inst.publishedAt = new Date();
    inst.acknowledgedOutflowAtomic = ackAtomic;
    await inst.save();

    return res.json({ success: true, instrument: inst });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues });
    }
    console.error("[bonds] publish error:", err);
    return res.status(500).json({ success: false, error: "Publish failed" });
  }
});

// ---------------------------------------------------------------
// POST /bonds/instruments/:id/close — stop new purchases
// ---------------------------------------------------------------
router.post("/instruments/:id/close", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const inst: any = await BondInstrument.findById(req.params.id);
    if (!inst) return res.status(404).json({ success: false, error: "Not found" });
    const guard = await assertFounderOfCryptoOffice(me.userId, String(inst.orgId));
    if (guard) return res.status(guard.status).json(guard.body);

    inst.status = "closed";
    inst.closedAt = new Date();
    await inst.save();
    // Existing holdings keep paying out — closing only stops new money.
    return res.json({ success: true, instrument: inst });
  } catch (err: any) {
    console.error("[bonds] close error:", err);
    return res.status(500).json({ success: false, error: "Close failed" });
  }
});

// ---------------------------------------------------------------
// GET /bonds/instruments/:id/quote?units=N
// ---------------------------------------------------------------
router.get("/instruments/:id/quote", requireAuth, async (req: Request, res: Response) => {
  try {
    const units = Number(req.query.units || 0);
    const inst: any = await BondInstrument.findById(req.params.id).lean();
    if (!inst) return res.status(404).json({ success: false, error: "Not found" });
    if (!Number.isInteger(units) || units < 1) {
      return res.status(400).json({ success: false, error: "units must be a positive integer" });
    }

    const principalAtomic = mulUnits(inst.unitPriceAtomic, units);
    const perPayoutAtomic = mulUnits(inst.derived.payoutAmountPerUnitAtomic, units);
    const totalInterestAtomic = mulUnits(inst.derived.totalInterestPerUnitAtomic, units);
    const c = inst.currency as BondCurrency;

    return res.json({
      success: true,
      quote: {
        units,
        currency: c,
        principal: fromAtomic(principalAtomic, c),
        payoutPerDate: fromAtomic(perPayoutAtomic, c),
        payoutCount: inst.derived.payoutCount,
        totalInterest: fromAtomic(totalInterestAtomic, c),
        totalReturn: fromAtomic(
          (BigInt(principalAtomic) + BigInt(totalInterestAtomic)).toString(),
          c,
        ),
        durationDays: inst.durationDays,
        payoutFrequency: inst.payoutFrequency,
        annualisedRatePct: inst.derived.annualisedRatePct,
        atomic: { principalAtomic, perPayoutAtomic, totalInterestAtomic },
      },
    });
  } catch (err: any) {
    console.error("[bonds] quote error:", err);
    return res.status(500).json({ success: false, error: "Quote failed" });
  }
});

// ---------------------------------------------------------------
// POST /bonds/instruments/:id/purchase — one-click, silent settle
// ---------------------------------------------------------------
router.post("/instruments/:id/purchase", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const { units } = z.object({ units: z.number().int().min(1) }).parse(req.body);

    const inst: any = await BondInstrument.findById(req.params.id);
    if (!inst) return res.status(404).json({ success: false, error: "Not found" });

    if (inst.status !== "published") {
      return res.status(409).json({
        success: false,
        code: "NOT_PURCHASABLE",
        error: `This bond is ${inst.status} and is not accepting new purchases.`,
      });
    }
    if (units < inst.minUnits) {
      return res.status(400).json({
        success: false,
        code: "BELOW_MIN_UNITS",
        error: `Minimum purchase is ${inst.minUnits} unit(s).`,
      });
    }
    const remaining = inst.totalUnits - (inst.unitsSold || 0);
    if (units > remaining) {
      return res.status(409).json({
        success: false,
        code: "INSUFFICIENT_SUPPLY",
        error: `Only ${remaining} unit(s) remain.`,
      });
    }

    const orgId = String(inst.orgId);
    const currency = inst.currency as BondCurrency;
    const principalAtomic = mulUnits(inst.unitPriceAtomic, units);
    const principalAmount = toWalletAmount(principalAtomic, currency);

    // Make sure the buyer's sibling wallets exist before reading balance.
    const { ensureCryptobrandWallets } = await import("../services/cryptobrandWallets");
    await ensureCryptobrandWallets(me.userId, orgId).catch(() => undefined);

    const wallet: any = await StoreWallet.findOne({
      userId: me.userId,
      orgId,
      currency,
    }).lean();
    if (!wallet || wallet.balance < principalAmount) {
      return res.status(400).json({
        success: false,
        code: "INSUFFICIENT_BALANCE",
        error:
          `Your ${currency} wallet has ${wallet?.balance ?? 0}, but this purchase costs ` +
          `${fromAtomic(principalAtomic, currency)} ${currency}.`,
      });
    }

    const buyer = await User.findById(me.userId).select("email name").lean();
    const founderId = await (
      await import("../services/hifiInvoiceFulfillment")
    ).findOrgFounderId(orgId);
    if (!founderId) {
      return res.status(409).json({ success: false, error: "Office has no founder" });
    }

    // 1. Mint the invoice.
    const invoice: any = await createInvoice({
      organizationId: orgId,
      sellerId: founderId,
      userId: me.userId,
      customerEmail: (buyer as any)?.email || "",
      customerName: (buyer as any)?.name || undefined,
      itemCurrency: currency,
      lineItems: [
        {
          itemType: "hifi_bond",
          itemId: String(inst._id),
          itemName: inst.name,
          itemDescription: `${units} unit(s) — ${inst.payoutFrequency} payouts over ${inst.durationDays} days`,
          quantity: units,
          unitPrice: toInvoiceMinorUnits(inst.unitPriceAtomic, currency),
          originalCurrency: currency,
        },
      ],
      metadata: {
        type: "hifi_bond_purchase",
        bondInstrumentId: String(inst._id),
        bondUnits: units,
        // The AUTHORITATIVE amount. The invoice's own totalAmount is a
        // 2dp JS number by platform convention; this is exact.
        bondPrincipalAtomic: principalAtomic,
        bondCurrency: currency,
      },
    });

    // 2. Debit the buyer.
    let debit: any;
    try {
      debit = await debitStoreWallet(
        me.userId,
        orgId,
        principalAmount,
        `Bond purchase — ${inst.name}`,
        founderId,
        `${units} unit(s)`,
        currency,
        {
          kind: "bond_purchase_debit",
          bondInstrumentId: String(inst._id),
          invoiceId: String(invoice._id),
          dedupeKey: `bond_purchase_${invoice._id}`,
        } as any,
      );
    } catch (e: any) {
      // Invoice exists but nothing was charged — leave it pending so it
      // is visible rather than deleting evidence of the attempt.
      return res.status(400).json({
        success: false,
        code: "DEBIT_FAILED",
        error: e?.message || "Could not debit wallet",
        invoiceId: String(invoice._id),
      });
    }

    // 3. Mark paid, then fulfil.
    invoice.status = "paid";
    invoice.paidAt = new Date();
    invoice.paymentMethodCategory = "wallet";
    invoice.paymentPlatform = "store_wallet";
    invoice.paymentCurrency = currency;
    invoice.metadata = {
      ...(invoice.metadata || {}),
      walletTransactionId: String(debit.transaction._id),
      walletCurrency: currency,
      paidFromAmount: principalAmount,
    };
    await invoice.save();

    const fulfilment = await fulfillInvoice(invoice, `wallet_${debit.transaction._id}`);

    const holding = await BondHolding.findOne({ invoiceId: invoice._id }).lean();

    return res.status(201).json({
      success: true,
      // Already paid — render as a receipt, not a checkout.
      invoice: {
        id: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        paidAt: invoice.paidAt,
        currency,
        amountPaid: fromAtomic(principalAtomic, currency),
      },
      holding,
      // The bond's public identity — show it on the receipt and use it
      // for the share link.
      bondHash: (holding as any)?.bondHash || null,
      publicPath: (holding as any)?.bondHash
        ? `/public/bonds/${(holding as any).bondHash}`
        : null,
      fulfilment,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues });
    }
    console.error("[bonds] purchase error:", err);
    return res.status(500).json({ success: false, error: "Purchase failed" });
  }
});

// ---------------------------------------------------------------
// GET /bonds/holdings?orgId=
// ---------------------------------------------------------------
router.get("/holdings", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const q: any = { buyerUserId: me.userId };
    if (req.query.orgId) q.orgId = String(req.query.orgId);
    const holdings = await BondHolding.find(q).sort({ createdAt: -1 }).limit(200).lean();

    // Each row keeps its original fields (backwards compatible) and
    // gains `bond`: the same figures the public bond page shows, built
    // by the same code, so the two can never disagree. Loaded in a fixed
    // number of queries however many holdings there are.
    const sources = await loadViewSources(holdings);
    const byId = new Map(sources.map((src) => [String(src.holding._id), src]));
    const items = holdings.map((h: any) => {
      const src = byId.get(String(h._id));
      return {
        ...h,
        bond: src ? buildHoldingListItem(src) : null,
        publicPath: h.bondHash ? `/public/bonds/${h.bondHash}` : null,
      };
    });
    return res.json({ success: true, items });
  } catch (err: any) {
    console.error("[bonds] holdings error:", err);
    return res.status(500).json({ success: false, error: "List failed" });
  }
});

// ---------------------------------------------------------------
// GET /bonds/holdings/by-hash/:bondHash — "I'm the owner"
// ---------------------------------------------------------------
// The public page shows anyone the bond. This tells a LOGGED-IN viewer
// whether it's theirs, and only then hands back what the owner needs to
// act on it (holding id for redeem, invoice). A non-owner gets the same
// public view and nothing more.
router.get("/holdings/by-hash/:bondHash", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const bondHash = normalizeBondHash(req.params.bondHash);
    if (!bondHash) {
      return res.status(400).json({
        success: false,
        code: "INVALID_BOND_HASH",
        error: "A bond hash is 12 digits.",
      });
    }
    const h: any = await BondHolding.findOne({ bondHash }).lean();
    if (!h || h.status === "pending_payment" || h.status === "cancelled") {
      return res.status(404).json({ success: false, code: "BOND_NOT_FOUND", error: "No bond with that hash." });
    }
    const [src] = await loadViewSources([h]);
    if (!src) {
      return res.status(404).json({ success: false, code: "BOND_NOT_FOUND", error: "No bond with that hash." });
    }

    const isOwner = String(h.buyerUserId) === me.userId;
    const isIssuer = await isOrgFounder(me.userId, String(h.orgId));
    const bond = buildPublicBondView(src);

    if (!isOwner) {
      return res.json({ success: true, isOwner: false, isIssuer, bond });
    }

    const inv: any = h.invoiceId
      ? await Invoice.findById(h.invoiceId).select("invoiceNumber").lean()
      : null;
    const matured = h.maturesAt && new Date(h.maturesAt).getTime() <= Date.now();
    return res.json({
      success: true,
      isOwner: true,
      isIssuer,
      holdingId: String(h._id),
      invoice: inv ? { id: String(inv._id), invoiceNumber: inv.invoiceNumber } : null,
      // Mirrors redeemHolding's own rules, so the button never offers an
      // action the server will refuse.
      canRedeem:
        h.status !== "redeemed" && !!matured && bond.progress.paymentsRemaining === 0,
      bond,
    });
  } catch (err: any) {
    console.error("[bonds] by-hash error:", err);
    return res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

// ---------------------------------------------------------------
// GET /bonds/holdings/:id — with the full payout schedule
// ---------------------------------------------------------------
router.get("/holdings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const h: any = await BondHolding.findById(req.params.id).lean();
    if (!h) return res.status(404).json({ success: false, error: "Not found" });

    const isOwner = String(h.buyerUserId) === me.userId;
    const isFounder = await isOrgFounder(me.userId, String(h.orgId));
    if (!isOwner && !isFounder) {
      return res.status(403).json({ success: false, error: "Not your holding" });
    }

    const events = await BondPayoutEvent.find({ holdingId: h._id })
      .sort({ sequenceNo: 1 })
      .lean();
    const c = h.currency as BondCurrency;
    const paidAtomic = events
      .filter((e: any) => e.status === "paid")
      .reduce((s: bigint, e: any) => s + BigInt(e.interestAtomic), 0n)
      .toString();

    const [src] = await loadViewSources([h]);
    return res.json({
      success: true,
      holding: h,
      bondHash: h.bondHash || null,
      publicPath: h.bondHash ? `/public/bonds/${h.bondHash}` : null,
      isOwner,
      // Full detail — identical to the public page, built by the same code.
      bond: src
        ? buildPublicBondView(src, { limit: 200, offset: 0 })
        : null,
      summary: {
        currency: c,
        principal: fromAtomic(h.principalAtomic, c),
        interestPaidToDate: fromAtomic(paidAtomic, c),
        payoutsCompleted: h.payoutsCompleted,
        payoutsTotal: h.payoutCount,
      },
      schedule: events.map((e: any) => ({
        sequenceNo: e.sequenceNo,
        dueAt: e.dueAt,
        status: e.status,
        attempts: e.attempts,
        lastError: e.lastError,
        paidAt: e.paidAt,
        interest: fromAtomic(e.interestAtomic, c),
      })),
    });
  } catch (err: any) {
    console.error("[bonds] holding detail error:", err);
    return res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

// ---------------------------------------------------------------
// POST /bonds/holdings/:id/redeem
// ---------------------------------------------------------------
router.post("/holdings/:id/redeem", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const h: any = await BondHolding.findById(req.params.id).select("buyerUserId currency").lean();
    if (!h) return res.status(404).json({ success: false, error: "Not found" });
    if (String(h.buyerUserId) !== me.userId) {
      return res.status(403).json({ success: false, error: "Not your holding" });
    }

    const r = await redeemHolding(req.params.id, { auto: false });
    if (!r.ok) {
      const map: Record<string, { status: number; msg: string }> = {
        not_matured: {
          status: 409,
          msg: "This bond has not matured yet. Early redemption is not supported.",
        },
        payouts_outstanding: {
          status: 409,
          msg: "Some interest payments are still outstanding — principal is returned once they clear.",
        },
        insufficient_founder_balance: {
          status: 409,
          msg: "The issuer's wallet cannot cover the principal right now. They have been notified.",
        },
      };
      const m = map[r.reason || ""] || { status: 409, msg: r.reason || "Cannot redeem" };
      return res.status(m.status).json({ success: false, code: r.reason, error: m.msg });
    }
    return res.json({
      success: true,
      redeemed: fromAtomic(r.amountAtomic!, h.currency as BondCurrency),
      currency: h.currency,
    });
  } catch (err: any) {
    console.error("[bonds] redeem error:", err);
    return res.status(500).json({ success: false, error: "Redeem failed" });
  }
});

// ---------------------------------------------------------------
// GET /bonds/instruments/:id/obligations — founder's funding view
// ---------------------------------------------------------------
router.get("/instruments/:id/obligations", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const inst: any = await BondInstrument.findById(req.params.id).lean();
    if (!inst) return res.status(404).json({ success: false, error: "Not found" });
    const guard = await assertFounderOfCryptoOffice(me.userId, String(inst.orgId));
    if (guard) return res.status(guard.status).json(guard.body);

    const c = inst.currency as BondCurrency;
    const horizon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const pending = await BondPayoutEvent.find({
      instrumentId: inst._id,
      status: { $in: ["scheduled", "failed"] },
    })
      .select("interestAtomic dueAt status")
      .lean();

    const sum = (rows: any[]) =>
      rows.reduce((s: bigint, r: any) => s + BigInt(r.interestAtomic), 0n).toString();

    const outstandingAll = sum(pending);
    const next30 = sum(pending.filter((p: any) => p.dueAt <= horizon));
    const failed = pending.filter((p: any) => p.status === "failed");

    const holdings = await BondHolding.find({
      instrumentId: inst._id,
      status: { $in: ["active", "payout_failed", "matured"] },
    })
      .select("principalAtomic")
      .lean();
    const principalOwed = holdings
      .reduce((s: bigint, h: any) => s + BigInt(h.principalAtomic), 0n)
      .toString();

    const founderId = await (
      await import("../services/hifiInvoiceFulfillment")
    ).findOrgFounderId(inst.orgId);
    const wallet: any = founderId
      ? await StoreWallet.findOne({ userId: founderId, orgId: inst.orgId, currency: c }).lean()
      : null;
    const balance = wallet?.balance ?? 0;
    const due30 = Number(fromAtomic(next30, c));

    return res.json({
      success: true,
      currency: c,
      walletBalance: balance,
      outstandingInterest: fromAtomic(outstandingAll, c),
      interestDueNext30Days: fromAtomic(next30, c),
      principalOwedAtMaturity: fromAtomic(principalOwed, c),
      failedPayouts: failed.length,
      // Decision D5 means the founder can spend the principal, so a
      // shortfall is a real and visible risk, not a theoretical one.
      shortfallNext30Days: balance >= due30 ? 0 : Number((due30 - balance).toFixed(8)),
      funded: balance >= due30,
    });
  } catch (err: any) {
    console.error("[bonds] obligations error:", err);
    return res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

// ---------------------------------------------------------------
// GET /bonds/organizations/:orgId/ledger
// ---------------------------------------------------------------
router.get("/organizations/:orgId/ledger", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = req.params;
    const guard = await assertFounderOfCryptoOffice(me.userId, orgId);
    if (guard) return res.status(guard.status).json(guard.body);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 20)));
    const q: any = { orgId };
    if (req.query.kind) q.kind = String(req.query.kind);
    if (req.query.instrumentId) q.instrumentId = String(req.query.instrumentId);

    const [items, total] = await Promise.all([
      BondLedgerEntry.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BondLedgerEntry.countDocuments(q),
    ]);

    return res.json({
      success: true,
      data: {
        items: items.map((i: any) => ({
          ...i,
          amount: fromAtomic(i.amountAtomic, i.currency),
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err: any) {
    console.error("[bonds] ledger error:", err);
    return res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

export default router;
