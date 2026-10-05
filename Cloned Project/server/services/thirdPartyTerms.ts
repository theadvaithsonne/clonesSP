import {
  IThirdPartyProductConfig,
  IThirdPartyTermPlan,
} from "../models/thirdPartyClient.model";
import { ThirdPartyError } from "./thirdPartyError";
import { addMonthsClamped } from "../utils/dateMath";

/**
 * Multi-month subscription terms for third-party (NetworkChain) subscriptions.
 *
 * This module is the SINGLE source of truth for "what does term N cost and how
 * does it split". Pricing, date math, and commission distribution all resolve
 * through here so the fallback logic for legacy clients exists in exactly one
 * place.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Which price list a resolution should use. */
export type TermPricingMode = "standalone" | "bundle";

export interface ResolvedTermPlan {
  termMonths: number;
  /**
   * Dollars, FULL term. The price for THIS purchase context — standalone or
   * bundled. This is what the buyer is charged.
   */
  totalAmount: number;
  /** Alias of totalAmount, named for clarity at call sites that also read listAmount. */
  sellAmount: number;
  /**
   * Dollars, FULL term at LIST rate (upPortion+platformPortion per month ×
   * months). The undiscounted value of the service — never charged, but it's
   * what the comp plan is reasoned about against.
   */
  listAmount: number;
  /** Standalone price, regardless of which mode was requested. */
  standaloneAmount: number;
  /** True when this resolution used the bundled price list. */
  isBundlePricing: boolean;
  /** Dollars PER MONTH into the Unilevel Plus comp tree. Always list value. */
  upPortionPerMonth: number;
  /**
   * Dollars PER MONTH credited to the platform store wallet at LIST price.
   * On multi-month terms the real platform share is the residual
   * (`sellAmount − upPortionPerMonth × termMonths`), not this × months.
   */
  platformPortionPerMonth: number;
  /** True when derived from the legacy scalars rather than an explicit plan. */
  isSynthetic: boolean;
  isActive: boolean;
  label?: string;
  sortOrder?: number;
}

function syntheticMonthlyPlan(
  pc: IThirdPartyProductConfig
): ResolvedTermPlan {
  return {
    termMonths: 1,
    totalAmount: pc.totalAmount,
    sellAmount: pc.totalAmount,
    listAmount: pc.totalAmount,
    standaloneAmount: pc.totalAmount,
    isBundlePricing: false,
    upPortionPerMonth: pc.upPortion,
    platformPortionPerMonth: pc.platformPortion,
    isSynthetic: true,
    isActive: true,
    label: "Monthly",
    sortOrder: 0,
  };
}

function toResolved(
  p: IThirdPartyTermPlan,
  pc: IThirdPartyProductConfig,
  pricing: TermPricingMode
): ResolvedTermPlan {
  // Bundle price falls back to standalone when the term has no bundled tier,
  // so "bundle" never accidentally costs MORE than standalone.
  const useBundle = pricing === "bundle" && p.bundleSubscriptionAmount != null;
  const sell = useBundle ? p.bundleSubscriptionAmount! : p.totalAmount;

  return {
    termMonths: p.termMonths,
    totalAmount: sell,
    sellAmount: sell,
    // List = the undiscounted monthly rate × months, from the legacy scalars.
    listAmount: round2((pc.upPortion + pc.platformPortion) * p.termMonths),
    standaloneAmount: p.totalAmount,
    isBundlePricing: useBundle,
    upPortionPerMonth: p.upPortion,
    platformPortionPerMonth: pc.platformPortion,
    isSynthetic: false,
    isActive: p.isActive !== false,
    label: p.label,
    sortOrder: p.sortOrder,
  };
}

/**
 * The term used when the caller doesn't pick one: ALWAYS 1 month.
 *
 * Intentionally a constant rather than a config knob. A configurable default
 * would mean a partner calling POST /invoices without `termMonths` could be
 * silently billed $432 instead of $36 because someone flipped a setting — a
 * multi-month term must always be an explicit, deliberate choice.
 */
export function defaultTermMonths(_pc?: IThirdPartyProductConfig): number {
  return 1;
}

/**
 * Resolve a term plan, or throw INVALID_TERM.
 *
 * Backward compatibility: a client with no `termPlans` (which is every client
 * configured before this feature) resolves termMonths=1 to a synthetic plan
 * built from the legacy scalars — producing numbers identical to today.
 *
 * `allowInactive` is for the RENEWAL path only. A partner disabling the 12-month
 * plan must not break renewal for everyone already on it; create/change paths
 * always leave it off so a disabled term cannot be newly sold.
 */
export function resolveTermPlan(
  pc: IThirdPartyProductConfig,
  termMonths?: number,
  opts?: { allowInactive?: boolean; pricing?: TermPricingMode }
): ResolvedTermPlan {
  const want = termMonths ?? defaultTermMonths(pc);
  const pricing: TermPricingMode = opts?.pricing ?? "standalone";

  if (!Number.isInteger(want) || want < 1) {
    throw new ThirdPartyError(
      "INVALID_TERM",
      `termMonths must be a positive integer (got ${termMonths})`,
      400
    );
  }

  // Bundle pricing exists only for multi-month terms. The $25 licence already
  // grants a free month; there is no discounted monthly rate on top of it.
  if (pricing === "bundle" && want === 1) {
    throw new ThirdPartyError(
      "INVALID_TERM",
      "There is no bundled price for the monthly plan — the $25 licence grants a free month, then bills the standard monthly rate",
      400
    );
  }

  const explicit = pc.termPlans?.find((p) => p.termMonths === want);
  if (explicit) {
    const resolved = toResolved(explicit, pc, pricing);
    if (!resolved.isActive && !opts?.allowInactive) {
      throw new ThirdPartyError(
        "INVALID_TERM",
        `The ${want}-month term is not currently available`,
        400
      );
    }
    return resolved;
  }

  // No explicit plan. Only the 1-month case can be synthesised.
  if (want === 1) return syntheticMonthlyPlan(pc);

  const available = listActiveTermPlans(pc)
    .map((p) => p.termMonths)
    .join(", ");
  throw new ThirdPartyError(
    "INVALID_TERM",
    `termMonths=${want} is not configured for this product (available: ${available || 1})`,
    400
  );
}

/**
 * Sellable terms, for catalog endpoints. Always includes the 1-month plan.
 *
 * `pricing` selects which price list the returned `totalAmount` reflects;
 * `standaloneAmount` is always present so a bundle catalog can show both.
 */
export function listActiveTermPlans(
  pc: IThirdPartyProductConfig,
  pricing: TermPricingMode = "standalone"
): ResolvedTermPlan[] {
  const plans = (pc.termPlans || [])
    .filter((p) => p.isActive !== false)
    // A bundle catalog must not offer a bundled monthly tier; it doesn't exist.
    .filter((p) => !(pricing === "bundle" && p.termMonths === 1))
    .map((p) => toResolved(p, pc, pricing));

  // Standalone catalogs always offer monthly, synthesising it from the legacy
  // scalars when no explicit 1-month plan exists. Bundle catalogs never do —
  // there is no bundled monthly tier, and re-adding it here would undo the
  // filter above.
  if (pricing === "standalone" && !plans.some((p) => p.termMonths === 1)) {
    plans.push(syntheticMonthlyPlan(pc));
  }

  return plans.sort(
    (a, b) =>
      (a.sortOrder ?? a.termMonths) - (b.sortOrder ?? b.termMonths) ||
      a.termMonths - b.termMonths
  );
}

/**
 * How many months an invoice's cycle covers, read from the INVOICE ITSELF.
 *
 * Deliberately never consults the parent. The parent carries mutable
 * subscription state (`metadata.termMonths` can change at any time), so a term
 * change landing between "child generated at $216" and "child paid" would
 * otherwise run 12 distributions against a 6-month invoice.
 */
export function resolveInvoiceTermMonths(invoice: {
  metadata?: any;
  recurringIntervalMonths?: number;
  recurringPeriod?: string;
}): number {
  const stamped = Number(invoice?.metadata?.termMonths);
  if (Number.isInteger(stamped) && stamped >= 1) return stamped;

  if (invoice.recurringIntervalMonths && invoice.recurringIntervalMonths >= 1) {
    return invoice.recurringIntervalMonths;
  }

  // Default: ONE month. Deliberately does NOT infer from `recurringPeriod`.
  //
  // This is the number of commission distributions to run, which is not the
  // same question as "how long is a cycle" (that's intervalMonthsFor in
  // services/invoice.ts, and there `quarterly` legitimately means +3 months).
  // A pre-existing client configured `recurringPeriod: "quarterly"` receives
  // exactly one distribution per invoice today; inferring 3 here would silently
  // triple their payout with no config change. Multi-month comp is opt-in via
  // an explicit termPlan, never inferred.
  return 1;
}

/** Convenience for callers that need the monthly split regardless of term. */
export function perMonthPortions(pc: IThirdPartyProductConfig): {
  upPortion: number;
  platformPortion: number;
} {
  const base = resolveTermPlan(pc, 1, { allowInactive: true });
  return {
    upPortion: round2(base.upPortionPerMonth),
    platformPortion: round2(base.platformPortionPerMonth),
  };
}

// ============= Child-cycle pricing =============

export interface ChildTermPricing {
  termMonths: number;
  lineItems: any[];
  subtotal: number; // cents
  tax: number; // cents — RECOMPUTED, not inherited
  recurringPeriod: "monthly" | "quarterly" | "yearly";
  recurringIntervalMonths: number;
  periodStart: Date;
  periodEnd: Date;
  metadataPatch: Record<string, any>;
  /** True when a queued term change was consumed and should be promoted. */
  promoteFromPending: boolean;
}

/**
 * Price the next cycle of a third-party subscription from its selected term.
 *
 * Returns `null` when the caller should keep the legacy "copy the parent's
 * subtotal/tax" behaviour — that is the safe default for anything that isn't a
 * term-priced third-party subscription.
 *
 * NEVER throws for a recoverable condition: a throw here would break the
 * recurring chain for the whole product, so unknown clients, missing configs and
 * unresolvable terms all degrade to `null` or to the 1-month plan.
 */
export async function priceThirdPartyChildCycle(input: {
  parent: any; // IInvoice
  nextPaymentNumber: number;
  thisCycleDue: Date;
}): Promise<ChildTermPricing | null> {
  const { parent, thisCycleDue } = input;

  if (!parent?.thirdPartyClientId) return null;
  // Wallet top-ups are one-off, not subscriptions.
  if ((parent.metadata as any)?.kind === "topup") return null;

  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
  const client = await ThirdPartyClient.findById(parent.thirdPartyClientId).lean();
  if (!client?.productConfig) return null;
  const pc = client.productConfig as IThirdPartyProductConfig;

  const md = (parent.metadata as any) || {};
  let wanted = md.pendingTermMonths ?? md.termMonths ?? defaultTermMonths(pc);
  let promoteFromPending = md.pendingTermMonths != null;

  // Defence in depth: PlatformCouponRedemption.cycleCount counts CYCLES, not
  // months, and the discount base would become the term price. A 3-cycle 50%-off
  // coupon on a 6-month term is 18 months at half price on a $216 base. Creation
  // and term-change both reject that combination, so reaching here means someone
  // edited metadata directly — force the cycle back to 1 month.
  try {
    const { PlatformCouponRedemption } = await import(
      "../models/platformCouponRedemption.model"
    );
    const activeRedemption = await PlatformCouponRedemption.findOne({
      parentInvoiceId: parent._id,
      status: "active",
    })
      .select({ _id: 1 })
      .lean();
    if (activeRedemption && wanted > 1) {
      console.warn(
        `[ThirdPartyTerms] ${parent.invoiceNumber}: active coupon redemption with termMonths=${wanted} — forcing 1-month cycle`
      );
      wanted = 1;
      promoteFromPending = false;
    }
  } catch {
    /* best effort — never block the chain on this lookup */
  }

  // Same reasoning for trial windows (N free *terms* would be the same bug).
  if (Number(md.trialCyclesTotal || 0) > 0 && wanted > 1) {
    console.warn(
      `[ThirdPartyTerms] ${parent.invoiceNumber}: trialCyclesTotal set with termMonths=${wanted} — forcing 1-month cycle`
    );
    wanted = 1;
    promoteFromPending = false;
  }

  let plan: ResolvedTermPlan;
  try {
    // allowInactive: a partner disabling a term must not break renewal for the
    // subscribers already on it.
    plan = resolveTermPlan(pc, wanted, { allowInactive: true });
  } catch (err) {
    console.error(
      `[ThirdPartyTerms] ${parent.invoiceNumber}: cannot resolve termMonths=${wanted}, falling back to default:`,
      err
    );
    plan = resolveTermPlan(pc, defaultTermMonths(pc), { allowInactive: true });
    promoteFromPending = false;
  }

  const unitPriceCents = Math.round(plan.totalAmount * 100);

  // GST must be RECOMPUTED — parent.tax is 18% of a different subtotal, and
  // inheriting it would under- or over-tax every multi-month cycle. Mirrors
  // createThirdPartyInvoice's resolution exactly so parent and child agree.
  const recomputeGst =
    process.env.THIRD_PARTY_CHILD_GST_RECOMPUTE !== "off";

  let taxAmount = parent.tax || 0;
  let gstMetadata: Record<string, any> = {};

  if (recomputeGst) {
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );
    const { applyGstToLine } = await import("../utils/gstTax");

    const region = await resolveBuyerGstRegion({
      buyerUserId: parent.userId.toString(),
      paymentCurrency: "USD",
    });
    const line = applyGstToLine({
      listedAmountMinor: unitPriceCents,
      gstInclusive: false,
      buyerInIndia: !!region?.inIndia,
    });
    taxAmount = line.taxTotal ?? 0;

    gstMetadata = line.gstMetadata
      ? {
          gst: {
            ...line.gstMetadata,
            buyerCountry: region.country,
            buyerRegion: "IN" as const,
            regionSource: region.source,
          },
        }
      : { gstSkipped: gstSkippedMetadata(region, "buyer_outside_india") };

    if ((parent.tax || 0) !== taxAmount && plan.termMonths === 1) {
      // Only interesting on the monthly path, where the amounts should match.
      console.log(
        `[ThirdPartyTerms] ${parent.invoiceNumber}: recomputed GST ${parent.tax} → ${taxAmount} (buyer region changed)`
      );
    }
  }

  const src = parent.lineItems?.[0] || {};
  const lineItems = [
    {
      ...(src.toObject ? src.toObject() : src),
      itemName:
        plan.termMonths === 1
          ? `${client.name} subscription`
          : `${client.name} subscription — ${plan.termMonths} months`,
      itemDescription: `${pc.productCode} subscription — ${plan.termMonths}-month term`,
      quantity: 1,
      unitPrice: unitPriceCents,
      totalPrice: unitPriceCents,
    },
  ];

  const periodStart = new Date(thisCycleDue);
  const periodEnd = addMonthsClamped(periodStart, plan.termMonths);

  return {
    termMonths: plan.termMonths,
    lineItems,
    subtotal: unitPriceCents,
    tax: taxAmount,
    recurringPeriod: periodLabelForTerm(plan.termMonths),
    recurringIntervalMonths: plan.termMonths,
    periodStart,
    periodEnd,
    metadataPatch: {
      termMonths: plan.termMonths,
      termPriceUsd: plan.totalAmount,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      ...gstMetadata,
    },
    promoteFromPending,
  };
}

/**
 * Best-fit `recurringPeriod` label for a term. 6 has no enum slot and labels as
 * "monthly" — `recurringIntervalMonths` is the authority for it.
 *
 * Duplicated from services/invoice.ts#periodLabelFor to keep this module free of
 * a static import of the invoice service (which pulls in Razorpay and would be
 * circular, since invoice.ts imports this module for child pricing).
 */
function periodLabelForTerm(
  termMonths: number
): "monthly" | "quarterly" | "yearly" {
  if (termMonths === 3) return "quarterly";
  if (termMonths === 12) return "yearly";
  return "monthly";
}

// ============= Term changes =============

export interface ChangeTermResult {
  parentInvoiceId: string;
  previousTermMonths: number;
  termMonths: number;
  /** When the new term starts billing. */
  effectiveFrom: Date;
  /** Set when an already-generated draft invoice was repriced in place. */
  repricedInvoiceId?: string;
  /**
   * "reissued": the root had never been paid, so there was no renewal to
   * re-price. The unpaid root was cancelled and a fresh first-cycle invoice
   * minted at the requested term — `parentInvoiceId` is the NEW root and
   * `invoice` is what the user now has to pay.
   */
  status: "applied" | "queued" | "noop" | "reissued";
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    currency: string;
    paymentUrl: string;
  };
}

/**
 * Change the term of an existing third-party subscription.
 *
 * The next cycle's invoice is minted the instant the current one is paid
 * (fulfillInvoice's on-payment trigger), so there is usually an unpaid draft
 * already sitting there. Three cases:
 *
 *   no draft yet         → queue on the parent; priceThirdPartyChildCycle uses it
 *   draft, unpaid        → reprice in place
 *   draft with a live payment intent, or already paid → queue for the cycle after
 *
 * The parent's own money fields are never touched — they are the historical
 * record of cycle 1, read by receipts and the admin commercials view.
 */
export async function changeSubscriptionTerm(input: {
  parentInvoiceId: string;
  termMonths: number;
  actor: { kind: "user" | "partner" | "admin"; id?: string; clientId?: string };
}): Promise<ChangeTermResult> {
  const { parentInvoiceId, termMonths, actor } = input;

  const { Invoice } = await import("../models/invoice.model");
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
  const { PlatformCouponRedemption } = await import(
    "../models/platformCouponRedemption.model"
  );

  const found = await Invoice.findById(parentInvoiceId);
  if (!found) {
    throw new ThirdPartyError("SUBSCRIPTION_NOT_FOUND", "Subscription not found", 404);
  }
  // Non-null alias so the nested helpers below (hoisted function declarations)
  // keep the narrowing.
  const parent = found;

  // Must be a live third-party subscription chain ROOT.
  if (
    !parent.isRecurring ||
    parent.parentInvoiceId ||
    parent.lineItems?.[0]?.itemType !== "third_party_subscription" ||
    (parent.metadata as any)?.kind === "topup"
  ) {
    throw new ThirdPartyError(
      "NOT_A_SUBSCRIPTION",
      "That invoice is not a third-party subscription root",
      400
    );
  }
  if (parent.cancelledAt) {
    throw new ThirdPartyError(
      "SUBSCRIPTION_CANCELLED",
      "This subscription has been cancelled",
      409
    );
  }
  // Ownership.
  if (actor.kind === "user" && parent.userId.toString() !== actor.id) {
    throw new ThirdPartyError("FORBIDDEN", "Not your subscription", 403);
  }
  if (
    actor.kind === "partner" &&
    parent.thirdPartyClientId?.toString() !== actor.clientId
  ) {
    throw new ThirdPartyError("FORBIDDEN", "Not your customer", 403);
  }

  const client = await ThirdPartyClient.findById(parent.thirdPartyClientId);
  if (!client?.productConfig) {
    throw new ThirdPartyError("CLIENT_NOT_ELIGIBLE", "Partner is not configured", 404);
  }
  const pc = client.productConfig as IThirdPartyProductConfig;

  // Must be an ACTIVE term — no allowInactive on the sell path.
  const plan = resolveTermPlan(pc, termMonths);

  // A root that was never paid has no "next renewal" to re-price — the only
  // thing to change is the first cycle itself. Reissue it at the requested
  // term rather than refusing: the user sees this picker precisely when they
  // are trying to start (or restart) a subscription, and "pay the first cycle
  // before changing term" sends them to pay the WRONG amount first.
  if (parent.status !== "paid") {
    return reissueUnpaidRoot(parent, client, pc, plan.termMonths, actor);
  }

  const md = (parent.metadata as any) || {};
  const previousTermMonths = md.pendingTermMonths ?? md.termMonths ?? 1;
  if (previousTermMonths === plan.termMonths) {
    return {
      parentInvoiceId: parent._id.toString(),
      previousTermMonths,
      termMonths: plan.termMonths,
      effectiveFrom: parent.nextDueDate || new Date(),
      status: "noop",
    };
  }

  // Coupons and trials are cycle-scoped, so a multi-month term would multiply
  // their value by the term length. Blocked at creation too.
  if (plan.termMonths > 1) {
    const activeRedemption = await PlatformCouponRedemption.findOne({
      parentInvoiceId: parent._id,
      status: "active",
    })
      .select({ _id: 1 })
      .lean();
    if (activeRedemption) {
      throw new ThirdPartyError(
        "TERM_CHANGE_BLOCKED_BY_COUPON",
        "A multi-month term cannot be selected while a coupon is still applying to this subscription",
        409
      );
    }
    if (Number(md.trialCyclesTotal || 0) > 0) {
      throw new ThirdPartyError(
        "TERM_CHANGE_BLOCKED_BY_TRIAL",
        "A multi-month term cannot be selected during a trial",
        409
      );
    }
  }

  const auditEntry = {
    from: previousTermMonths,
    to: plan.termMonths,
    at: new Date(),
    actor: actor.kind,
    actorId: actor.id || actor.clientId,
  };

  // Is there an unpaid draft for the next cycle already?
  const pendingChild = await Invoice.findOne({
    parentInvoiceId: parent._id,
    status: { $in: ["draft", "pending"] },
    cancelledAt: { $in: [null, undefined] },
  }).sort({ recurringPaymentNumber: -1 });

  const queue = async (reason?: string): Promise<ChangeTermResult> => {
    await Invoice.updateOne(
      { _id: parent._id },
      {
        $set: {
          "metadata.pendingTermMonths": plan.termMonths,
          "metadata.lastTermChange": { ...auditEntry, queued: true, reason },
        },
        $push: { "metadata.termHistory": auditEntry },
      }
    );
    return {
      parentInvoiceId: parent._id.toString(),
      previousTermMonths,
      termMonths: plan.termMonths,
      effectiveFrom: pendingChild?.nextDueDate || parent.nextDueDate || new Date(),
      status: "queued",
    };
  };

  /**
   * A term change invalidates the existing UPI mandate.
   *
   * The mandate ceiling is now sized to the plan the payer authorised (see
   * resolveMandateCapPaise), so it deliberately will NOT cover a larger term —
   * a monthly mandate capped around ₹5,000 cannot fund a ₹36,000 annual debit,
   * and the charge would simply bounce off its own mandate every cycle. On a
   * downgrade the old cap would still clear, but it would leave the payer
   * authorising far more than the plan they just chose.
   *
   * Either way the honest move is the same: revoke, and let the next payment
   * establish a mandate that matches the new plan. The SUBSCRIPTION IS NOT
   * TOUCHED — invoices keep generating, and that one cycle is paid by hand,
   * exactly as with any other autopay-off state.
   *
   * Caveat worth knowing: one mandate funds every subscription on the account,
   * so this also stops auto-collection for any other active subscription. Those
   * self-heal — their next renewal is paid manually and re-registers — but the
   * payer sees one hand-paid cycle.
   */
  const revokeForTermChange = async (r: ChangeTermResult) => {
    try {
      const { disableAutopay } = await import("./upiAutopay");
      const { disabled } = await disableAutopay(parent.userId.toString());
      if (disabled > 0) {
        console.log(
          `[Terms] term change on ${parent.invoiceNumber} (${previousTermMonths}→${plan.termMonths}mo) revoked ${disabled} mandate(s); the next payment re-registers at the new amount`,
        );
      }
    } catch (err: any) {
      // Never fail the term change over this. Worst case the stale mandate
      // survives and its next debit is refused by its own cap — recoverable,
      // and visible, unlike silently charging the wrong ceiling.
      console.error(
        `[Terms] mandate revoke after term change on ${parent.invoiceNumber} failed:`,
        err?.message ?? err,
      );
    }
    return r;
  };

  if (!pendingChild) {
    // Nothing minted yet — the next generation will pick up the queued term and
    // promote it. Re-query after writing to close the race where the generator
    // read the parent just before this update landed.
    const queued = await queue();
    const raced = await Invoice.findOne({
      parentInvoiceId: parent._id,
      status: { $in: ["draft", "pending"] },
      cancelledAt: { $in: [null, undefined] },
    }).sort({ recurringPaymentNumber: -1 });
    if (!raced) return revokeForTermChange(queued);
    // A child appeared mid-flight; fall through and reprice it.
    return revokeForTermChange(await repriceDraft(raced));
  }

  // A live gateway order can't be repriced without desyncing the amount.
  if (pendingChild.razorpayOrderId) {
    return revokeForTermChange(await queue("payment_in_progress"));
  }

  return revokeForTermChange(await repriceDraft(pendingChild));

  async function repriceDraft(child: any): Promise<ChangeTermResult> {
    // Recover this cycle's service start. periodStart is stamped by
    // priceThirdPartyChildCycle; expiresAt-7d is the pre-term fallback.
    const thisCycleDue = child.metadata?.periodStart
      ? new Date(child.metadata.periodStart)
      : child.expiresAt
        ? new Date(child.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date();

    // Price against the NEW term by staging it on an in-memory parent copy.
    const stagedParent: any = {
      ...(parent.toObject?.() ?? parent),
      _id: parent._id,
      metadata: { ...md, pendingTermMonths: plan.termMonths },
    };
    const pricing = await priceThirdPartyChildCycle({
      parent: stagedParent,
      nextPaymentNumber: child.recurringPaymentNumber || 2,
      thisCycleDue,
    });
    if (!pricing) return queue("pricing_unavailable");

    const total =
      pricing.subtotal - (child.discount || 0) + pricing.tax + (child.shippingCost || 0);

    // Conditional update: if it flipped to paid between our read and this write,
    // modifiedCount is 0 and we fall back to queueing for the cycle after.
    const res = await Invoice.updateOne(
      { _id: child._id, status: { $in: ["draft", "pending"] } },
      {
        $set: {
          lineItems: pricing.lineItems,
          subtotal: pricing.subtotal,
          tax: pricing.tax,
          totalAmount: total,
          recurringPeriod: pricing.recurringPeriod,
          recurringIntervalMonths: pricing.recurringIntervalMonths,
          nextDueDate: pricing.periodEnd,
          "metadata.termMonths": pricing.termMonths,
          "metadata.termPriceUsd": pricing.metadataPatch.termPriceUsd,
          "metadata.periodStart": pricing.metadataPatch.periodStart,
          "metadata.periodEnd": pricing.metadataPatch.periodEnd,
          "metadata.termRepricedAt": new Date(),
        },
      }
    );
    if (res.modifiedCount !== 1) return queue("paid_mid_flight");

    // The change is now baked into a real invoice — make it the parent's term.
    await Invoice.updateOne(
      { _id: parent._id },
      {
        $set: {
          "metadata.termMonths": plan.termMonths,
          "metadata.lastTermChange": auditEntry,
        },
        $unset: { "metadata.pendingTermMonths": "" },
        $push: { "metadata.termHistory": auditEntry },
      }
    );

    return {
      parentInvoiceId: parent._id.toString(),
      previousTermMonths,
      termMonths: plan.termMonths,
      effectiveFrom: thisCycleDue,
      repricedInvoiceId: child._id.toString(),
      status: "applied",
    };
  }
}

/** Subscription chains for a buyer, for the "my subscriptions" surfaces. */
export async function listSubscriptionsForUser(
  userId: string,
  clientId?: string
): Promise<any[]> {
  const { Invoice } = await import("../models/invoice.model");
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
  const { Types } = await import("mongoose");

  const q: any = {
    userId: new Types.ObjectId(userId),
    isRecurring: true,
    parentInvoiceId: { $exists: false },
    "lineItems.itemType": "third_party_subscription",
    "metadata.kind": { $ne: "topup" },
  };
  if (clientId) q.thirdPartyClientId = new Types.ObjectId(clientId);

  const parents = await Invoice.find(q).sort({ createdAt: -1 });
  const out: any[] = [];

  for (const parent of parents) {
    // A root we cancelled and reissued at a different term was never paid and
    // has a successor in this same list — showing both would look like two
    // subscriptions, one of them dead.
    if (parent.cancelledAt && (parent.metadata as any)?.reissuedTo) continue;
    const client = await ThirdPartyClient.findById(parent.thirdPartyClientId).lean();
    if (!client?.productConfig) continue;
    const pc = client.productConfig as IThirdPartyProductConfig;
    const md = (parent.metadata as any) || {};

    const pendingChild = await Invoice.findOne({
      parentInvoiceId: parent._id,
      status: { $in: ["draft", "pending"] },
      cancelledAt: { $in: [null, undefined] },
    }).sort({ recurringPaymentNumber: -1 });

    const blockedReason = parent.cancelledAt
      ? "cancelled"
      : pendingChild?.razorpayOrderId
        ? "payment_in_progress"
        : null;

    out.push({
      parentInvoiceId: parent._id.toString(),
      clientId: client._id.toString(),
      clientName: client.name,
      productCode: pc.productCode,
      currentTermMonths: md.termMonths ?? 1,
      pendingTermMonths: md.pendingTermMonths ?? null,
      // Whether the first cycle was ever paid. When it wasn't, a term change
      // REISSUES that first invoice at the new price (see reissueUnpaidRoot)
      // rather than queueing a change for a renewal that doesn't exist — the
      // UI should say "we'll issue a new invoice", not "changes next cycle".
      firstCyclePaid: parent.status === "paid",
      rootStatus: parent.status,
      nextDueDate: parent.nextDueDate,
      pendingInvoice: pendingChild
        ? {
            id: pendingChild._id.toString(),
            invoiceNumber: pendingChild.invoiceNumber,
            status: pendingChild.status,
            totalAmount: pendingChild.totalAmount,
            termMonths: (pendingChild.metadata as any)?.termMonths ?? 1,
          }
        : null,
      canChangeTerm: !blockedReason,
      changeBlockedReason: blockedReason,
      terms: listActiveTermPlans(pc).map((t) => ({
        termMonths: t.termMonths,
        label: t.label || `${t.termMonths} month${t.termMonths > 1 ? "s" : ""}`,
        totalAmount: t.totalAmount,
        totalAmountCents: Math.round(t.totalAmount * 100),
        monthlyEquivalent: round2(t.totalAmount / t.termMonths),
      })),
    });
  }

  return out;
}

/**
 * Cancel an unpaid subscription root and mint a fresh first-cycle invoice at
 * `termMonths`, through the same path a partner-created subscription uses so
 * pricing, GST and metadata cannot diverge from a normal purchase.
 *
 * Refuses while a payment is genuinely in flight. A Razorpay order cannot be
 * cancelled from here, and a Stripe PaymentIntent is cancelled first so that
 * completing a stale checkout tab can never pay a root we just cancelled —
 * the Stripe webhook only checks for `paid`, not `cancelled`.
 */
async function reissueUnpaidRoot(
  parent: any,
  client: any,
  pc: IThirdPartyProductConfig,
  termMonths: number,
  actor: { kind: "user" | "partner" | "admin"; id?: string; clientId?: string }
): Promise<ChangeTermResult> {
  const md = (parent.metadata as any) || {};
  const previousTermMonths = Number(md.termMonths) || parent.recurringIntervalMonths || 1;

  // Same term and still payable: nothing to reissue — they just need to pay it.
  if (previousTermMonths === termMonths && ["draft", "pending"].includes(parent.status)) {
    return {
      parentInvoiceId: parent._id.toString(),
      previousTermMonths,
      termMonths,
      effectiveFrom: new Date(),
      status: "noop",
      invoice: describeInvoice(parent),
    };
  }

  if (parent.razorpayOrderId) {
    throw new ThirdPartyError(
      "PAYMENT_IN_PROGRESS",
      "A payment for this subscription is still in progress — finish or wait for it to lapse before changing the term",
      409
    );
  }
  if (md.stripePaymentIntentId) {
    try {
      const { getStripeClient, stripeEnabled } = await import("./stripe");
      if (stripeEnabled) {
        await getStripeClient().paymentIntents.cancel(md.stripePaymentIntentId);
      }
    } catch (err: any) {
      // Already succeeded/cancelled at Stripe is fine; anything else means we
      // cannot guarantee the old root stays unpaid, so do not reissue.
      const code = err?.code || err?.raw?.code;
      if (code !== "payment_intent_unexpected_state" && code !== "resource_missing") {
        throw new ThirdPartyError(
          "PAYMENT_IN_PROGRESS",
          "Could not release the pending payment on this subscription — try again shortly",
          409
        );
      }
    }
  }

  const { User } = await import("../models/user.model");
  const customer: any = await User.findById(parent.userId).select("email").lean();
  if (!customer?.email) {
    throw new ThirdPartyError("CUSTOMER_NOT_FOUND", "Subscriber has no email on file", 404);
  }

  // Cancel the stale root FIRST. createThirdPartyInvoice dedupes on
  // externalId, so a fresh one is minted below in the same shape the
  // NetworkChain app uses when it reactivates.
  parent.status = "cancelled";
  parent.cancelledAt = new Date();
  parent.metadata = {
    ...md,
    cancelReason: "term_change_reissue",
    termChangeLog: [
      ...(Array.isArray(md.termChangeLog) ? md.termChangeLog : []),
      { from: previousTermMonths, to: termMonths, at: new Date(), actor: actor.kind, reissued: true },
    ],
  };
  parent.markModified("metadata");
  await parent.save();

  const { createThirdPartyInvoice } = await import("./thirdPartyInvoice");
  const fresh = await createThirdPartyInvoice({
    client,
    customerEmail: customer.email,
    productCode: pc.productCode,
    termMonths,
    externalId: `nc_sub_${parent.userId.toString()}_${Date.now()}`,
    metadata: {
      reissuedFrom: parent._id.toString(),
      reissuedFromInvoiceNumber: parent.invoiceNumber,
      reissueReason: "term_change_on_unpaid_root",
    },
  });

  await parent.updateOne({ $set: { "metadata.reissuedTo": fresh._id.toString() } });

  console.log(
    `[thirdPartyTerms] reissued unpaid root ${parent.invoiceNumber} (${parent.status}, ${previousTermMonths}mo) as ${fresh.invoiceNumber} (${termMonths}mo) for ${customer.email}`
  );

  return {
    parentInvoiceId: fresh._id.toString(),
    previousTermMonths,
    termMonths,
    effectiveFrom: new Date(),
    status: "reissued",
    invoice: describeInvoice(fresh),
  };
}

function describeInvoice(inv: any): NonNullable<ChangeTermResult["invoice"]> {
  const base = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    totalAmount: inv.totalAmount,
    currency: inv.currency || "USD",
    paymentUrl: `${base}/invoice/${inv._id.toString()}`,
  };
}
