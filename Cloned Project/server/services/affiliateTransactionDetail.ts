import mongoose from "mongoose";
import { WalletTransaction } from "../models/walletTransaction.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { UnilevelPlusPlan } from "../models/unilevelPlusPlan.model";
import { Invoice } from "../models/invoice.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { CombPlan } from "../models/combPlan.model";
import { Product } from "../models/product.model";
import { Course } from "../models/course.model";
import { Channel } from "../models/channel.model";
import { Workshop } from "../models/workshop.model";
import { Service } from "../models/service.model";
import { CallOffering } from "../models/callOffering.model";

const PLATFORM_USER_EMAIL = "shorupan@gmail.com";

type ItemType = "product" | "course" | "channel" | "workshop" | "service" | "call";

const ITEM_TYPE_LABEL: Record<string, string> = {
  product_digital: "Digital",
  product_physical: "Physical",
  course: "Course",
  channel: "Community",
  workshop: "Live Stream",
  service: "Service",
  call: "Call",
  unilevel_plus: "Unilevel Plus Plan",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const isValidObjectId = (v: unknown): v is string =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

async function isUserActiveAffiliate(userId: mongoose.Types.ObjectId | string): Promise<boolean> {
  const id = typeof userId === "string" ? userId : String(userId);
  const user = await User.findById(id).select("email").lean<{ email?: string }>();
  if (user?.email && user.email.toLowerCase() === PLATFORM_USER_EMAIL) {
    return true;
  }
  const purchase = await UnilevelPlusPurchase.findOne({
    userId: id,
    status: "active",
  })
    .select("_id")
    .lean();
  return !!purchase;
}

async function fetchItemNameAndImage(
  itemType: ItemType,
  itemId: mongoose.Types.ObjectId | string
): Promise<{ name: string | null; image: string | null; typeLabel: string }> {
  switch (itemType) {
    case "product": {
      const p = await Product.findById(itemId)
        .select("name images videos isDigital")
        .lean<{
          name?: string;
          images?: string[];
          videos?: string[];
          isDigital?: boolean;
        }>();
      const firstImage = (p?.images || []).find(
        (u) => typeof u === "string" && u.trim().length > 0,
      );
      return {
        name: p?.name ?? null,
        image: firstImage ?? null,
        typeLabel: p?.isDigital
          ? ITEM_TYPE_LABEL.product_digital
          : ITEM_TYPE_LABEL.product_physical,
      };
    }
    case "course": {
      const c = await Course.findById(itemId)
        .select("title coverImage")
        .lean<{ title?: string; coverImage?: string }>();
      return {
        name: c?.title ?? null,
        image: c?.coverImage ?? null,
        typeLabel: ITEM_TYPE_LABEL.course,
      };
    }
    case "channel": {
      const c = await Channel.findById(itemId)
        .select("title coverImage")
        .lean<{ title?: string; coverImage?: string }>();
      return {
        name: c?.title ?? null,
        image: c?.coverImage ?? null,
        typeLabel: ITEM_TYPE_LABEL.channel,
      };
    }
    case "workshop": {
      const w = await Workshop.findById(itemId)
        .select("title thumbnail")
        .lean<{ title?: string; thumbnail?: string }>();
      return {
        name: w?.title ?? null,
        image: w?.thumbnail ?? null,
        typeLabel: ITEM_TYPE_LABEL.workshop,
      };
    }
    case "service": {
      const s = await Service.findById(itemId)
        .select("title coverImage")
        .lean<{ title?: string; coverImage?: string }>();
      return {
        name: s?.title ?? null,
        image: s?.coverImage ?? null,
        typeLabel: ITEM_TYPE_LABEL.service,
      };
    }
    case "call": {
      const c = await CallOffering.findById(itemId)
        .select("title coverImage")
        .lean<{ title?: string; coverImage?: string }>();
      return {
        name: c?.title ?? null,
        image: c?.coverImage ?? null,
        typeLabel: ITEM_TYPE_LABEL.call,
      };
    }
    default:
      return { name: null, image: null, typeLabel: String(itemType) };
  }
}

function frequencyLabel(invoice: {
  invoiceType?: string;
  recurringPeriod?: string;
} | null): string {
  if (!invoice) return "One Time";
  if (invoice.invoiceType === "recurring" && invoice.recurringPeriod) {
    const map: Record<string, string> = {
      weekly: "Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      yearly: "Yearly",
    };
    return map[invoice.recurringPeriod] ?? "Recurring";
  }
  return "One Time";
}

function installmentLabel(invoice: {
  isRecurring?: boolean;
  recurringPaymentNumber?: number;
} | null): string {
  if (invoice?.isRecurring && invoice.recurringPaymentNumber) {
    return `${invoice.recurringPaymentNumber}`;
  }
  return "1/1";
}

/**
 * Walk up the referral chain from `customerId` (via `User.referredBy`) until
 * `affiliateId` is found or the chain ends. Returns:
 *  - `level`  — hops from customer to affiliate (1 = affiliate is the buyer's
 *               direct upline; N = N ancestors away). Null if not found.
 *  - `leg`    — the position (1-based, createdAt-sorted) of the affiliate's
 *               direct downline that carries the chain leading to this
 *               customer. Null if not resolvable.
 * Safe against cycles and long chains (hard cap 25 hops).
 */
async function computeLegAndLevel(
  customerId: mongoose.Types.ObjectId | string,
  affiliateId: string,
): Promise<{ leg: number | null; level: number | null }> {
  const target = String(affiliateId);
  const customerStr = String(customerId);
  if (customerStr === target) return { leg: null, level: null };

  const visited = new Set<string>([customerStr]);
  // Chain built bottom-up. `lastChildBeforeAffiliate` is whichever hop's
  // referredBy resolves to the affiliate — that's the direct downline that
  // owns the leg.
  let cursor: mongoose.Types.ObjectId | undefined;
  {
    const c = await User.findById(customerId)
      .select("referredBy")
      .lean<{ referredBy?: mongoose.Types.ObjectId }>();
    cursor = c?.referredBy;
  }
  let level: number | null = null;
  let legChildId: mongoose.Types.ObjectId | string | null = customerStr;
  let hops = 1;
  while (cursor && hops <= 25) {
    const cursorStr = String(cursor);
    if (visited.has(cursorStr)) break;
    visited.add(cursorStr);
    if (cursorStr === target) {
      level = hops;
      break;
    }
    legChildId = cursor;
    const next = await User.findById(cursor)
      .select("referredBy")
      .lean<{ referredBy?: mongoose.Types.ObjectId }>();
    cursor = next?.referredBy;
    hops += 1;
  }

  if (level === null) return { leg: null, level: null };

  // Leg = position of `legChildId` among the affiliate's direct downlines,
  // ordered by createdAt ascending (matches getLegNumber in
  // services/unilevelPlusCommission.ts). Query with a projection so the
  // list stays small for uplines with many downlines.
  try {
    const directs = await User.find({
      referredBy: new mongoose.Types.ObjectId(target),
    })
      .sort({ createdAt: 1 })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId }[]>();
    const idx = directs.findIndex((d) => String(d._id) === String(legChildId));
    return { leg: idx >= 0 ? idx + 1 : null, level };
  } catch {
    return { leg: null, level };
  }
}

async function buildCustomerBlock(
  customerId: mongoose.Types.ObjectId | string | undefined,
  affiliateId: string,
  levelOverride: number | null,
  legOverride: number | null,
) {
  if (!customerId) return null;
  const customer = await User.findById(customerId)
    .select("name email profilePicture country state city referredBy")
    .lean<{
      _id: mongoose.Types.ObjectId;
      name?: string;
      email?: string;
      profilePicture?: string;
      country?: string;
      state?: string;
      city?: string;
      referredBy?: mongoose.Types.ObjectId;
    }>();
  if (!customer) return null;

  const [isActive, upline, computed] = await Promise.all([
    isUserActiveAffiliate(customer._id),
    customer.referredBy
      ? User.findById(customer.referredBy)
          .select("name email profilePicture")
          .lean<{
            _id: mongoose.Types.ObjectId;
            name?: string;
            email?: string;
            profilePicture?: string;
          }>()
      : Promise.resolve(null),
    // Skip the tree walk when the caller has already supplied both leg and
    // level (UP metadata path). Otherwise compute both — leg alone requires
    // level anyway, so we always fetch the pair.
    levelOverride !== null && legOverride !== null
      ? Promise.resolve({ leg: legOverride, level: levelOverride })
      : computeLegAndLevel(customer._id, affiliateId),
  ]);

  const clean = (v: string | undefined | null): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v : null;

  let directUpline: {
    userId: string;
    name: string | null;
    email: string | null;
    avatar: string | null;
    isActiveAffiliate: boolean;
  } | null = null;
  if (upline) {
    directUpline = {
      userId: String(upline._id),
      name: clean(upline.name),
      email: clean(upline.email),
      avatar: clean(upline.profilePicture),
      isActiveAffiliate: await isUserActiveAffiliate(upline._id),
    };
  }

  return {
    userId: String(customer._id),
    name: clean(customer.name),
    email: clean(customer.email),
    avatar: clean(customer.profilePicture),
    leg: legOverride ?? computed.leg,
    level: levelOverride ?? computed.level,
    isActiveAffiliate: isActive,
    country: clean(customer.country),
    state: clean(customer.state),
    city: clean(customer.city),
    directUpline,
  };
}

async function buildSourceBlock(orgId: mongoose.Types.ObjectId | string | null | undefined) {
  if (!orgId) return null;
  const org = await Organization.findById(orgId)
    .select("name colored_logo white_logo icon coverPhoto")
    .lean<{
      _id: mongoose.Types.ObjectId;
      name?: string;
      colored_logo?: string;
      white_logo?: string;
      icon?: string;
      coverPhoto?: string;
    }>();
  // Always return a source block when the linked orgId exists on the
  // distribution — even if the Organization doc has been deleted or is
  // otherwise missing — so the Source card still renders (with orgId only)
  // instead of the whole card disappearing. Logo falls back through the
  // four fields that different org creation flows have used historically.
  const pick = (v: string | undefined) => (v && v.trim().length > 0 ? v : null);
  return {
    orgId: String(orgId),
    orgName: pick(org?.name),
    orgLogo:
      pick(org?.colored_logo) ??
      pick(org?.white_logo) ??
      pick(org?.icon) ??
      pick(org?.coverPhoto) ??
      null,
  };
}

export interface AffiliateTransactionDetail {
  transaction: {
    id: string;
    type: string;
    createdAt: Date;
    amount: number;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    distributionType: "comb_plan" | "unilevel_plus" | "unknown";
  };
  source: {
    orgId: string;
    orgName: string | null;
    orgLogo: string | null;
  } | null;
  customer: {
    userId: string;
    name: string | null;
    email: string | null;
    avatar: string | null;
    leg: number | null;
    level: number | null;
    isActiveAffiliate: boolean;
    country: string | null;
    state: string | null;
    city: string | null;
    directUpline: {
      userId: string;
      name: string | null;
      email: string | null;
      avatar: string | null;
      isActiveAffiliate: boolean;
    } | null;
  } | null;
  product: {
    itemType: string;
    itemId: string;
    name: string | null;
    image: string | null;
    type: string;
    currency: string;
    frequency: string;
    installment: string;
    amount: number;
    priceBreakUp: {
      taxes: { percentage: number; amount: number };
      preTaxPrice: number;
      platformFee: { percentage: number; amount: number };
      totalCompPlan: { percentage: number; amount: number };
      seller: { percentage: number; amount: number };
    };
    compPlanPayoutToYou: number;
  } | null;
}

export async function getAffiliateTransactionDetail(
  requestingUserId: string,
  transactionId: string
): Promise<
  | { ok: true; data: AffiliateTransactionDetail }
  | { ok: false; code: "not_found" | "forbidden" | "unsupported"; message: string }
> {
  if (!isValidObjectId(transactionId)) {
    return { ok: false, code: "not_found", message: "Invalid transaction id" };
  }

  const tx = await WalletTransaction.findById(transactionId).lean<{
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    walletType: string;
    type: string;
    amount: number;
    currency?: string;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    createdAt: Date;
    metadata?: Record<string, any>;
    relatedUserId?: mongoose.Types.ObjectId;
  }>();

  if (!tx) {
    return { ok: false, code: "not_found", message: "Transaction not found" };
  }
  if (String(tx.userId) !== requestingUserId) {
    return { ok: false, code: "forbidden", message: "Not your transaction" };
  }
  if (tx.walletType !== "affiliate") {
    return {
      ok: false,
      code: "unsupported",
      message: "This endpoint only serves affiliate wallet transactions",
    };
  }

  const meta = (tx.metadata ?? {}) as Record<string, any>;
  const distributionType: "comb_plan" | "unilevel_plus" | "unknown" =
    meta.distributionType === "unilevel_plus"
      ? "unilevel_plus"
      : meta.distributionId && meta.itemType
      ? "comb_plan"
      : "unknown";

  const baseTx = {
    id: String(tx._id),
    type: tx.type,
    createdAt: tx.createdAt,
    amount: tx.amount,
    currency: tx.currency ?? "USD",
    balanceBefore: tx.balanceBefore,
    balanceAfter: tx.balanceAfter,
    description: tx.description,
    distributionType,
  };

  if (distributionType === "comb_plan") {
    const dist = meta.distributionId
      ? await CommissionDistribution.findById(meta.distributionId).lean<{
          _id: mongoose.Types.ObjectId;
          orgId: mongoose.Types.ObjectId;
          customerId: mongoose.Types.ObjectId;
          combPlanId: mongoose.Types.ObjectId;
          itemType: ItemType;
          itemId: mongoose.Types.ObjectId;
          itemName: string;
          saleAmount: number;
          currency: string;
          platformFeePercentage: number;
          platformFeeAmount: number;
          sellerAmount: number;
          commissions: Array<{
            userId: mongoose.Types.ObjectId;
            level: number;
            percentage: number;
            amount: number;
            transactionId?: mongoose.Types.ObjectId;
          }>;
          paymentId?: string;
        }>()
      : null;

    if (!dist) {
      return {
        ok: true,
        data: { transaction: baseTx, source: null, customer: null, product: null },
      };
    }

    const myRecipient = dist.commissions.find(
      (c) => String(c.userId) === requestingUserId
    );
    const level = myRecipient?.level ?? null;
    const compPlanPayoutToYou = myRecipient?.amount ?? tx.amount;

    const [combPlan, invoice, itemInfo, source, customer] = await Promise.all([
      dist.combPlanId
        ? CombPlan.findById(dist.combPlanId)
            .select("totalPercentage levels")
            .lean<{ totalPercentage?: number; levels?: Array<{ percentage: number }> }>()
        : Promise.resolve(null),
      dist.paymentId
        ? Invoice.findOne({ razorpayPaymentId: dist.paymentId })
            .select(
              "subtotal discount tax totalAmount paymentCurrency itemCurrency invoiceType isRecurring recurringPeriod recurringPaymentNumber lineItems"
            )
            .lean<{
              subtotal: number;
              discount: number;
              tax: number;
              totalAmount: number;
              paymentCurrency: string;
              itemCurrency: string;
              invoiceType?: string;
              isRecurring?: boolean;
              recurringPeriod?: string;
              recurringPaymentNumber?: number;
              lineItems?: Array<{ itemImage?: string; itemName?: string }>;
            }>()
        : Promise.resolve(null),
      fetchItemNameAndImage(dist.itemType, dist.itemId),
      buildSourceBlock(dist.orgId),
      buildCustomerBlock(dist.customerId, requestingUserId, level, null),
    ]);

    const totalCompPlanPct =
      combPlan?.totalPercentage ??
      dist.commissions.reduce((s, c) => s + (c.percentage ?? 0), 0);

    const platformFeePct = dist.platformFeePercentage ?? 5;
    const sellerPct = Math.max(0, round2(100 - platformFeePct - totalCompPlanPct));

    // Tax breakdown from the underlying invoice (paise/cents → decimal).
    // Falls back to zero tax if no invoice is linked.
    const invoiceScale = 100;
    const invoiceSubtotal = invoice ? invoice.subtotal / invoiceScale : 0;
    const invoiceDiscount = invoice ? invoice.discount / invoiceScale : 0;
    const invoiceTax = invoice ? invoice.tax / invoiceScale : 0;
    const preTaxPrice = round2(invoiceSubtotal - invoiceDiscount);
    const taxPct = preTaxPrice > 0 ? round2((invoiceTax / preTaxPrice) * 100) : 0;

    const platformFeeAmount = round2((dist.saleAmount * platformFeePct) / 100);
    const totalCompPlanAmount = round2(
      (dist.saleAmount * totalCompPlanPct) / 100
    );
    const sellerAmount = round2(dist.sellerAmount ?? 0);

    return {
      ok: true,
      data: {
        transaction: baseTx,
        source,
        customer,
        product: {
          itemType: dist.itemType,
          itemId: String(dist.itemId),
          name: itemInfo.name ?? dist.itemName,
          image:
            (itemInfo.image && itemInfo.image.trim().length > 0
              ? itemInfo.image
              : null) ??
            (invoice?.lineItems?.[0]?.itemImage &&
            invoice.lineItems[0].itemImage.trim().length > 0
              ? invoice.lineItems[0].itemImage
              : null) ??
            null,
          type: itemInfo.typeLabel,
          currency: invoice?.itemCurrency ?? dist.currency ?? "USD",
          frequency: frequencyLabel(invoice),
          installment: installmentLabel(invoice),
          amount: round2(dist.saleAmount),
          priceBreakUp: {
            taxes: { percentage: taxPct, amount: round2(invoiceTax) },
            preTaxPrice,
            platformFee: {
              percentage: platformFeePct,
              amount: platformFeeAmount,
            },
            totalCompPlan: {
              percentage: round2(totalCompPlanPct),
              amount: totalCompPlanAmount,
            },
            seller: { percentage: sellerPct, amount: sellerAmount },
          },
          compPlanPayoutToYou: round2(compPlanPayoutToYou),
        },
      },
    };
  }

  if (distributionType === "unilevel_plus") {
    const dist = meta.distributionId
      ? await UnilevelPlusDistribution.findById(meta.distributionId).lean<{
          _id: mongoose.Types.ObjectId;
          planId: mongoose.Types.ObjectId;
          buyerId: mongoose.Types.ObjectId;
          saleAmount: number;
          currency: string;
          companyAmount: number;
          paymentId?: string;
        }>()
      : null;

    // Metadata on the tx already carries leg + level for UP credits.
    const level = typeof meta.level === "number" ? meta.level : null;
    const leg = typeof meta.legNumber === "number" ? meta.legNumber : null;

    const [plan, invoice, source, customer] = await Promise.all([
      dist?.planId
        ? UnilevelPlusPlan.findById(dist.planId)
            .select("name orgId")
            .lean<{ name?: string; orgId?: mongoose.Types.ObjectId }>()
        : Promise.resolve(null),
      dist?.paymentId
        ? Invoice.findOne({ razorpayPaymentId: dist.paymentId })
            .select(
              "subtotal discount tax paymentCurrency itemCurrency invoiceType isRecurring recurringPeriod recurringPaymentNumber organizationId"
            )
            .lean<{
              subtotal: number;
              discount: number;
              tax: number;
              itemCurrency: string;
              invoiceType?: string;
              isRecurring?: boolean;
              recurringPeriod?: string;
              recurringPaymentNumber?: number;
              organizationId?: mongoose.Types.ObjectId;
            }>()
        : Promise.resolve(null),
      // Source org: prefer plan.orgId, fall back to invoice.organizationId.
      (async () => {
        const planDoc = dist?.planId
          ? await UnilevelPlusPlan.findById(dist.planId).select("orgId").lean<{
              orgId?: mongoose.Types.ObjectId;
            }>()
          : null;
        const orgId =
          planDoc?.orgId ??
          (dist?.paymentId
            ? (
                await Invoice.findOne({ razorpayPaymentId: dist.paymentId })
                  .select("organizationId")
                  .lean<{ organizationId?: mongoose.Types.ObjectId }>()
              )?.organizationId
            : null);
        return buildSourceBlock(orgId ?? null);
      })(),
      buildCustomerBlock(dist?.buyerId, requestingUserId, level, leg),
    ]);

    const saleAmount = dist?.saleAmount ?? 0;
    const platformFeePct = saleAmount > 0 ? round2((dist!.companyAmount / saleAmount) * 100) : 0;
    const totalCompPlanPct = round2(100 - platformFeePct);

    const invoiceScale = 100;
    const invoiceSubtotal = invoice ? invoice.subtotal / invoiceScale : 0;
    const invoiceDiscount = invoice ? invoice.discount / invoiceScale : 0;
    const invoiceTax = invoice ? invoice.tax / invoiceScale : 0;
    const preTaxPrice = round2(invoiceSubtotal - invoiceDiscount);
    const taxPct = preTaxPrice > 0 ? round2((invoiceTax / preTaxPrice) * 100) : 0;

    return {
      ok: true,
      data: {
        transaction: baseTx,
        source,
        customer,
        product: dist
          ? {
              itemType: "unilevel_plus",
              itemId: String(dist.planId),
              name: plan?.name ?? "Unilevel Plus Plan",
              image: null,
              type: ITEM_TYPE_LABEL.unilevel_plus,
              currency: invoice?.itemCurrency ?? dist.currency ?? "USD",
              frequency: frequencyLabel(invoice ?? null),
              installment: installmentLabel(invoice ?? null),
              amount: round2(saleAmount),
              priceBreakUp: {
                taxes: { percentage: taxPct, amount: round2(invoiceTax) },
                preTaxPrice,
                platformFee: {
                  percentage: platformFeePct,
                  amount: round2(dist.companyAmount),
                },
                totalCompPlan: {
                  percentage: totalCompPlanPct,
                  amount: round2(saleAmount - dist.companyAmount),
                },
                seller: { percentage: 0, amount: 0 },
              },
              compPlanPayoutToYou: round2(tx.amount),
            }
          : null,
      },
    };
  }

  // Fallback for credits without a linked distribution (manual credits, etc).
  return {
    ok: true,
    data: {
      transaction: baseTx,
      source: null,
      customer: null,
      product: null,
    },
  };
}
