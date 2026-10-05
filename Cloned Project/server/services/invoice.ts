import mongoose, { Types } from "mongoose";
import { refreshTypeFlags } from "./downlineTree";
import {
  Invoice,
  IInvoice,
  ICurrencyConversion,
  InvoiceItemType,
  PaymentMethodCategory,
  PaymentPlatform,
  couponProductTypeForItem,
} from "../models/invoice.model";
import {
  createOrder as createRazorpayOrder,
  verifyPaymentSignature,
  CouponPromotion,
} from "./razorpay";
import {
  stripeEnabled,
  createPaymentIntent as createStripePaymentIntent,
  chargeSavedPaymentMethod,
  getOrCreateStripeCustomer,
  getStripeClient,
} from "./stripe";
import { getOrCreateRazorpayCustomer } from "./razorpay";
import { createOrder as createProductOrder, updatePaymentStatus } from "./product";
import { enrollInCourse } from "./course";
import { purchaseCalls } from "./call";
import { distributeCommissions } from "./commission";
import { resolveBuyerAddress } from "../utils/buyerAddress";
import { ChannelMembership } from "../models/channelMembership.model";
import { getSocketInstance } from "./socket";
import { addMonthsClamped } from "../utils/dateMath";
import {
  convertUsdToInr,
  convertInrToUsd,
  getUsdToRate,
  isSupportedFiatCurrency,
  EXTRA_PAYMENT_CURRENCIES,
} from "../utils/exchangeRate";
import { FRANCHISE_PRICE_USD } from "../models/franchiseProgram.model";
import { getConfiguredChains } from "../config/cryptoWallets";

// The platform floor ($650) of a franchise territory sale, in USD cents.
const FRANCHISE_FLOOR_CENTS = Math.round(FRANCHISE_PRICE_USD * 100);

/**
 * Discount BASE for a platform coupon, in the invoice's smallest unit.
 *
 * Franchise TERRITORY coupons discount only the $650 platform floor — so the
 * coupon's percent/fixed value is computed against `min(subtotal, $650)`, never
 * the full territory price. The founder/reseller markup (price − $650) is
 * therefore never discounted. Every other product type uses the full subtotal.
 *
 * The resulting discount is still SUBTRACTED from the full subtotal, so the
 * buyer pays `price − discount` and the platform absorbs the cut.
 */
export function couponBaseCents(
  itemType: string | undefined,
  subtotalCents: number
): number {
  if (itemType === "franchise_territory" || itemType === "franchise_global") {
    return Math.min(subtotalCents, FRANCHISE_FLOOR_CENTS);
  }
  return subtotalCents;
}

// ============ Types ============

export interface CreateInvoiceOptions {
  organizationId: string;
  sellerId: string;
  userId: string;
  customerEmail: string;
  customerName?: string;
  lineItems: Array<{
    itemType: InvoiceItemType;
    itemId: string;
    itemName: string;
    itemDescription?: string;
    itemImage?: string;
    quantity: number;
    unitPrice: number; // In item's original currency smallest unit (paise/cents)
    originalCurrency: string;
  }>;
  itemCurrency: string; // Original listing currency
  isRecurring?: boolean;
  recurringPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
  // Months per cycle for multi-month terms; see IInvoice.recurringIntervalMonths.
  recurringIntervalMonths?: number;
  discount?: number; // In smallest unit
  tax?: number;
  shippingCost?: number;
  couponId?: string;
  couponCode?: string;
  couponUsageId?: string;
  shippingAddress?: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  referralId?: string;
  metadata?: Record<string, any>;
  // For subscriptions created outside invoice flow
  razorpaySubscriptionId?: string;
  subscriptionRef?: string;
  // Third-party API integration
  thirdPartyClientId?: string;
  thirdPartyExternalId?: string;
  // Platform coupon (new system, separate from legacy coupon fields)
  platformCouponCode?: string;
  // Where the payment originated (web | ios | android). Stamped onto the
  // invoice and read at fulfillment time to decide whether Apple's 30% fee
  // applies. Default "web" when not set.
  paymentSource?: "web" | "ios" | "android";
}

export interface SelectPaymentOptions {
  paymentCurrency: string;
  paymentMethodCategory: PaymentMethodCategory;
  paymentPlatform: PaymentPlatform;
  // Frontend-supplied URL to return the payer to after a crypto (NowPayments)
  // payment. Only honored if its origin matches FRONTEND_URL (open-redirect guard).
  returnUrl?: string;
  // For paymentPlatform === "crypto_wallet" in the new in-house flow.
  // FE picks these from the coin-picker step before calling select-payment.
  // Ignored by every other paymentPlatform.
  //
  // Keep in lockstep with `src/config/cryptoWallets.ts::SUPPORTED_CHAINS`
  // and the zod enum in `routes/invoice.ts::select-payment-method`.
  chain?: "tron" | "polygon" | "bsc" | "ethereum" | "bitcoin";
  coin?: "USDT" | "USDC" | "ETH" | "BTC" | "POL";
  // ─── Save-card additions (Stripe phase 1) ─────────────────────────────
  // Present when the user clicked "Pay with saved •••• 4242". Skips the
  // Elements iframe entirely — server-side off-session charge on the
  // pre-attached PaymentMethod. Result returns `alreadyPaid: true` on
  // success, or `stripeClientSecret` + `stripePaymentIntentId` when 3DS
  // step-up is required (rare but real; FE completes with
  // stripe.confirmPayment).
  savedPaymentMethodId?: string;
  // Fresh-card flow only: when true, the created PaymentIntent gets
  // `customer` + `setup_future_usage: "off_session"` so Stripe
  // auto-attaches the PM after the charge succeeds. The webhook then
  // persists it onto the User doc.
  savePaymentMethodForFuture?: boolean;
  // ─── Razorpay save-card (phase 2) ────────────────────────────────────
  // When present, the returned Razorpay order + FE popup pre-scope to
  // the founder's saved cards via `customer_id`. Razorpay's Standard
  // Checkout then defaults to that card (or shows the saved-cards tab
  // with it highlighted). Not zero-click — user still OTPs — but skips
  // PAN retyping. Server-side off-session charges land in phase 3.
  savedRazorpayTokenId?: string;
  // Fresh Razorpay-card flow: when true, the popup gets `save: 1` +
  // `customer_id` so the paid card is tokenized. `token.confirmed`
  // webhook then persists it onto the User doc.
  saveRazorpayCardForFuture?: boolean;
}

export interface SelectPaymentResult {
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  razorpaySubscriptionId?: string;
  /**
   * True when this Razorpay order ALSO registers a UPI Autopay mandate, so
   * later cycles can be auto-debited. Lets the checkout say so plainly rather
   * than quietly attaching a standing debit authority to what looks like a
   * one-off payment.
   */
  upiAutopay?: boolean;
  shortUrl?: string;
  /**
   * @deprecated Legacy NOWPayments hosted-page URL. Kept for backward-compat
   * with in-flight payments only; new crypto invoices return `cryptoRequest`
   * instead and the FE renders an inline payment panel.
   */
  cryptoPaymentUrl?: string;
  /** In-house crypto payment request. FE renders <CryptoPaymentPanel/> from this. */
  cryptoRequest?: {
    requestId: string;
    chain: string;
    coin: string;
    chainName: string;
    address: string;
    amount: string; // Display form, e.g. "1.000423"
    amountAtomic: string;
    decimals: number;
    expiresAt: Date;
    contractAddress: string;
  };
  stripeClientSecret?: string;
  stripePublishableKey?: string;
  stripePaymentIntentId?: string;
  // Razorpay save-card additions (phase 2). FE opens Standard Checkout
  // with these threaded into the popup options: `customer_id` scopes
  // saved cards to the founder; `save: 1` (from `saveRazorpayCardForFuture`)
  // triggers tokenization on the paid card; `preferredToken` puts a
  // specific saved card at the top of Razorpay's list.
  razorpayCustomerId?: string;
  razorpayPreferredTokenId?: string;
  razorpaySave?: boolean;
  amount: number;
  currency: string;
  invoiceId: string;
  alreadyPaid?: boolean;
}

export interface VerifyPaymentOptions {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface PaymentOptionsResult {
  currencies: string[];
  methods: Record<
    string,
    Array<{
      category: PaymentMethodCategory;
      platforms: Array<{
        id: PaymentPlatform;
        name: string;
        enabled: boolean;
      }>;
      enabled: boolean;
    }>
  >;
}

// ============ Core Functions ============

/**
 * Create a new invoice in "draft" status.
 * No Razorpay order is created yet — that happens when the user selects a payment method.
 *
 * If the user already has a draft/pending invoice for the same item,
 * returns that existing invoice instead of creating a duplicate.
 */
export async function createInvoice(
  options: CreateInvoiceOptions
): Promise<IInvoice> {
  // ============ Defensive: item-type × recurring guard ============
  // Certain line-item types are ALWAYS meant to be recurring subscriptions
  // (office_plan, office_addon, third_party_subscription). Historically a
  // trial-invoice path forgot `isRecurring: true` and silently produced a
  // one-time invoice — which landed under the FE "One-time" tab and,
  // worse, prevented the recurring cron from ever generating cycle 2+.
  // Fail loudly at the boundary so future callers can't reintroduce that
  // shape without noticing.
  //
  // Explicit non-recurring carve-outs:
  //   - Third-party topups: `itemType: "third_party_subscription"` +
  //     `metadata.kind === "topup"` (see services/thirdPartyInvoice.ts).
  //     Wallet top-ups are legitimately one-off.
  //   - Conference-room prorations: `itemType: "office_addon"` +
  //     `metadata.type === "office_addon_proration"` (see
  //     services/conferenceRoomBilling.ts → generateProratedAddInvoice).
  //     A one-off charge covering the remainder of the current cycle
  //     when the founder adds a room mid-cycle — the recurring parent
  //     rooms invoice keeps chaining monthly children on its own.
  const RECURRING_ONLY_ITEM_TYPES: string[] = [
    "office_plan",
    "office_addon",
    "third_party_subscription",
    // Whitelabel add-on is $600/yr subscription — first invoice at
    // purchase, then a yearly cron mints renewals. Every invoice for
    // this item type must be recurring.
    "whitelabel_addon",
    // Cryptosub is $600/yr — same shape as whitelabel_addon. Always
    // recurring; the yearly cron mints renewal invoices.
    "cryptosub",
  ];
  const primaryItemTypeForGuard = options.lineItems[0]?.itemType;
  const isThirdPartyTopUp =
    primaryItemTypeForGuard === "third_party_subscription" &&
    (options.metadata as any)?.kind === "topup";
  const isRoomsProration =
    primaryItemTypeForGuard === "office_addon" &&
    (options.metadata as any)?.type === "office_addon_proration";
  if (
    primaryItemTypeForGuard &&
    RECURRING_ONLY_ITEM_TYPES.includes(primaryItemTypeForGuard) &&
    !options.isRecurring &&
    !isThirdPartyTopUp &&
    !isRoomsProration
  ) {
    throw new Error(
      `createInvoice: itemType "${primaryItemTypeForGuard}" must be created with isRecurring: true (with a recurringPeriod). ` +
        `A one-time invoice of this type would land under the FE "One-time" tab and would never generate cycle 2+ via the recurring cron. ` +
        `(Allowed non-recurring exceptions: third-party topup [metadata.kind:"topup"] and conference-room proration [metadata.type:"office_addon_proration"].)`
    );
  }

  // ============ Resolve platform coupon (if provided) ============
  // Auto-route: if `couponCode` matches a PlatformCoupon, treat as platform coupon.
  // This makes founder checkouts work without per-checkout wiring.
  let resolvedCouponId: string | undefined = options.couponId;
  let resolvedCouponCode: string | undefined = options.couponCode;
  let resolvedDiscount: number = options.discount || 0;
  let platformCouponDoc: any = null;

  let effectivePlatformCouponCode: string | undefined = options.platformCouponCode;
  if (!effectivePlatformCouponCode && options.couponCode && !options.couponUsageId) {
    // Legacy-style call without usage tracking — check if this is actually a platform coupon
    const { getPlatformCouponByCode } = await import("./platformCoupon");
    const maybePlatform = await getPlatformCouponByCode(options.couponCode);
    if (maybePlatform) {
      effectivePlatformCouponCode = options.couponCode;
      // Clear legacy fields so only platform path runs
      resolvedCouponId = undefined;
      resolvedCouponCode = undefined;
      resolvedDiscount = 0;
    }
  }

  if (effectivePlatformCouponCode) {
    const { validatePlatformCoupon } = await import("./platformCoupon");
    const primaryItemType = options.lineItems[0]?.itemType;
    const rawSubtotal = options.lineItems.reduce(
      (s, i) => s + i.unitPrice * (i.quantity || 1),
      0
    );
    const validation = await validatePlatformCoupon({
      code: effectivePlatformCouponCode,
      productType: primaryItemType
        ? couponProductTypeForItem(primaryItemType)
        : (undefined as any),
      userId: options.userId,
      // Territory coupons discount only the $650 floor (see couponBaseCents).
      amountCents: couponBaseCents(primaryItemType, rawSubtotal),
      orgId: options.organizationId,
      itemId: options.lineItems[0]?.itemId,
      invoiceCurrency: options.itemCurrency,
    });
    if (!validation.valid || !validation.coupon) {
      throw new Error(validation.error || "Invalid coupon");
    }
    platformCouponDoc = validation.coupon;
    resolvedCouponId = validation.coupon._id.toString();
    resolvedCouponCode = validation.coupon.code;
    resolvedDiscount = validation.discount || 0;
  }

  // ============ Cashback code path (mutually exclusive with coupon) ============
  // If the input code wasn't a platform coupon, try resolving it as a cashback
  // code. Cashback DOES NOT discount the invoice — the buyer pays full, and
  // the rebate lands in their StoreWallet after fulfillInvoice runs the
  // executeCashback hook. We just stamp `cashbackCodeId` here so the post-paid
  // hook knows which code to honor.
  let resolvedCashbackCodeId: string | undefined = undefined;
  if (
    options.couponCode &&
    !effectivePlatformCouponCode &&
    !options.couponUsageId
  ) {
    try {
      const { validateCashbackCode, mapItemTypeToCashbackType } = await import(
        "./cashbackCode"
      );
      const cartLines = (options.lineItems || [])
        .map((li) => {
          const pt = mapItemTypeToCashbackType(String(li.itemType));
          return pt ? { productType: pt, itemId: String(li.itemId) } : null;
        })
        .filter((x): x is { productType: any; itemId: string } => !!x);
      const rawSubtotal = options.lineItems.reduce(
        (s, i) => s + i.unitPrice * (i.quantity || 1),
        0
      );
      const cb = await validateCashbackCode({
        code: options.couponCode,
        buyerId: options.userId,
        cartLines,
        amountCents: rawSubtotal,
      });
      if (cb.valid) {
        resolvedCashbackCodeId = String(cb.code._id);
        // Clear coupon stamping — cashback applies no inline discount and
        // shouldn't masquerade as a coupon on the resulting invoice.
        resolvedCouponCode = undefined;
        resolvedCouponId = undefined;
        resolvedDiscount = 0;
      }
      // If neither a coupon nor a cashback, fall through silently — the
      // legacy non-platform coupon path may still apply via couponUsageId,
      // and we don't want to break existing callers with a hard reject.
    } catch (err) {
      console.error("[Invoice] Cashback code resolution failed:", err);
    }
  }

  // ============ Ensure `referredBy` is set for the buyer ============
  // The cashback auto-attach scan below (and `validateCashbackCode` at
  // fulfillment) both key off `User.referredBy` — a null value silently
  // fails both gates. Two existing surfaces set it:
  //   1. `routes/courseCheckout.ts:308-316` — only for the OTP checkout,
  //      and only if the buyer isn't already an org member.
  //   2. `services/affiliate.ts::setReferredBy` — requires the buyer to
  //      ALREADY be a member of a non-parent org, so it no-ops for a
  //      brand-new buyer whose org membership only happens post-fulfillment.
  //
  // Neither covers the "new buyer arriving directly at checkout" case that
  // is our primary cashback failure mode. Set it here deterministically
  // using `options.organizationId` (always present at invoice creation) to
  // find the target org's founder. Idempotent: only writes if the buyer
  // has no existing `referredBy` — never overwrites an established
  // affiliate relationship.
  if (options.userId && options.organizationId) {
    try {
      const { User } = await import("../models/user.model");
      const existing = await User.findById(options.userId)
        .select("referredBy")
        .lean<{ referredBy?: Types.ObjectId }>();
      if (!existing?.referredBy) {
        const orgFounder = await User.findOne({
          organizations: {
            $elemMatch: {
              organization: new Types.ObjectId(options.organizationId),
              role: "founder",
            },
          },
        })
          .select("_id")
          .lean<{ _id: Types.ObjectId }>();
        if (orgFounder?._id) {
          await User.findByIdAndUpdate(options.userId, {
            referredBy: orgFounder._id,
            referredBySource: "founder_default",
          });
        }
      }
    } catch (err) {
      // Never blocks invoice creation.
      console.error("[Invoice] Pre-populate referredBy failed:", err);
    }
  }

  // ============ Auto-attach cashback (upline-configured, buyer-silent) ============
  // Cashback codes are 100% upline-controlled — the buyer never enters one.
  // Two possible ways a code becomes applicable to a purchase:
  //   1. The buyer is in the code's explicit `allowedBuyerIds` whitelist.
  //   2. The code has no whitelist (open to any direct downline) AND the
  //      buyer's `referredBy` matches the code's creator.
  //
  // We fetch candidates for BOTH cases in one bounded query (indexed on
  // allowedBuyerIds + creatorId; further narrowed by productType/itemId
  // matches on the cart, date window, status), then run each through
  // `validateCashbackCode` which enforces the full gate (downline chain,
  // usage caps, min order, self-check).
  //
  // This runs regardless of whether the buyer arrived via a referral link,
  // because cashback is a founder-side reward — not something the buyer
  // opts into.
  if (
    !resolvedCashbackCodeId &&
    !effectivePlatformCouponCode &&
    !options.couponCode &&
    !options.couponUsageId &&
    options.userId
  ) {
    try {
      const { CashbackCode } = await import("../models/cashbackCode.model");
      const { validateCashbackCode, mapItemTypeToCashbackType } = await import(
        "./cashbackCode"
      );
      const { User } = await import("../models/user.model");
      const cartLines = (options.lineItems || [])
        .map((li) => {
          const pt = mapItemTypeToCashbackType(String(li.itemType));
          return pt ? { productType: pt, itemId: String(li.itemId) } : null;
        })
        .filter((x): x is { productType: any; itemId: string } => !!x);
      if (cartLines.length > 0) {
        const buyer = await User.findById(options.userId)
          .select("referredBy")
          .lean<{ referredBy?: Types.ObjectId }>();
        const now = new Date();
        const buyerObjId = new Types.ObjectId(options.userId);
        const referrerId = buyer?.referredBy;
        // `$gte`/`$lte` do NOT match documents where the field is null or
        // missing — codes without a `validUntil` (open-ended) would be
        // silently dropped by a naive `validUntil: { $gte: now }` filter.
        // Matches the null-tolerant pattern already used by
        // `getAffiliateCashbackForItem` in services/cashbackCode.ts.
        const candidates = await CashbackCode.find({
          status: "active",
          $and: [
            {
              $or: [
                { validFrom: { $exists: false } },
                { validFrom: null },
                { validFrom: { $lte: now } },
              ],
            },
            {
              $or: [
                { validUntil: { $exists: false } },
                { validUntil: null },
                { validUntil: { $gte: now } },
              ],
            },
            {
              $or: cartLines.map((c) => ({
                productType: c.productType,
                itemId: new Types.ObjectId(c.itemId),
              })),
            },
            {
              $or: [
                { allowedBuyerIds: buyerObjId },
                ...(referrerId
                  ? [
                      {
                        creatorId: referrerId,
                        $or: [
                          { allowedBuyerIds: { $size: 0 } },
                          { allowedBuyerIds: { $exists: false } },
                        ],
                      },
                    ]
                  : []),
              ],
            },
          ],
        })
          .select("code")
          .lean();
        const autoSubtotal = (options.lineItems || []).reduce(
          (s, i) => s + i.unitPrice * (i.quantity || 1),
          0
        );
        for (const candidate of candidates) {
          const cb = await validateCashbackCode({
            code: candidate.code,
            buyerId: options.userId,
            cartLines,
            amountCents: autoSubtotal,
          });
          if (cb.valid) {
            resolvedCashbackCodeId = String(cb.code._id);
            resolvedCouponCode = undefined;
            resolvedCouponId = undefined;
            resolvedDiscount = 0;
            break;
          }
        }
      }
    } catch (err) {
      console.error("[Invoice] Cashback auto-attach failed:", err);
    }
  }

  // ============ Auto-attach cashback from the affiliate link ============
  // No code was typed, but the buyer arrived via an affiliate link
  // (`referralId`). If that affiliate has an active cashback code bound to a
  // cart item AND this buyer qualifies, stamp it — so buyers (including
  // first-timers, whose `referredBy` was just set by the checkout route
  // upstream) get cashback without ever entering a code. Fully best-effort:
  // any failure leaves the invoice untouched and never rejects checkout.
  if (
    !resolvedCashbackCodeId &&
    !effectivePlatformCouponCode &&
    !options.couponCode &&
    !options.couponUsageId &&
    options.referralId
  ) {
    try {
      const {
        getAffiliateCashbackForItem,
        validateCashbackCode,
        mapItemTypeToCashbackType,
      } = await import("./cashbackCode");
      const autoSubtotal = (options.lineItems || []).reduce(
        (s, i) => s + i.unitPrice * (i.quantity || 1),
        0
      );
      for (const li of options.lineItems || []) {
        const pt = mapItemTypeToCashbackType(String(li.itemType));
        if (!pt) continue;
        const teaser = await getAffiliateCashbackForItem({
          affiliateId: options.referralId,
          productType: pt,
          itemId: String(li.itemId),
        });
        if (!teaser) continue;
        const cb = await validateCashbackCode({
          code: teaser.code,
          buyerId: options.userId,
          cartLines: [{ productType: pt, itemId: String(li.itemId) }],
          amountCents: autoSubtotal,
        });
        if (cb.valid) {
          resolvedCashbackCodeId = String(cb.code._id);
          resolvedCouponCode = undefined;
          resolvedCouponId = undefined;
          resolvedDiscount = 0;
          break;
        }
      }
    } catch (err) {
      console.error("[Invoice] Auto cashback attach failed:", err);
    }
  }

  // Check for existing draft/pending invoice for the same user + item
  if (options.lineItems.length > 0) {
    const primaryItem = options.lineItems[0];
    const expectedTotal = options.lineItems.reduce(
      (sum, item) => sum + item.unitPrice * (item.quantity || 1),
      0
    ) - resolvedDiscount + (options.tax || 0) + (options.shippingCost || 0);

    const existingInvoice = await Invoice.findOne({
      userId: new Types.ObjectId(options.userId),
      status: { $in: ["draft", "pending"] },
      "lineItems.itemType": primaryItem.itemType,
      "lineItems.itemId": new Types.ObjectId(primaryItem.itemId),
    });

    if (existingInvoice) {
      // Verify the amount AND coupon AND cashback code match — otherwise
      // stale/different invoice. Cashback in particular: a draft created
      // BEFORE a cashback code became applicable (e.g. code created after
      // the draft; or auto-attach logic added post-hoc) would silently
      // deny the buyer their credit if we reused it as-is. Compare by
      // stringified id since the invoice field is an ObjectId and the
      // resolved value is a string.
      const couponMatches =
        (existingInvoice.couponCode || undefined) === resolvedCouponCode;
      const cashbackMatches =
        (existingInvoice.cashbackCodeId?.toString() || undefined) ===
        resolvedCashbackCodeId;
      if (
        existingInvoice.totalAmount === expectedTotal &&
        existingInvoice.itemCurrency === options.itemCurrency &&
        couponMatches &&
        cashbackMatches
      ) {
        console.log(
          `[Invoice] Reusing existing ${existingInvoice.status} invoice ${existingInvoice.invoiceNumber} for user ${options.userId}`
        );
        return existingInvoice;
      } else {
        // Cancel the stale invoice and create a fresh one
        console.log(
          `[Invoice] Cancelling stale invoice ${existingInvoice.invoiceNumber} (mismatch)`
        );
        existingInvoice.status = "cancelled";
        existingInvoice.cancelledAt = new Date();
        await existingInvoice.save();
      }
    }
  }

  // Build line items with calculated totals
  const lineItems = options.lineItems.map((item) => ({
    itemType: item.itemType,
    itemId: new Types.ObjectId(item.itemId),
    itemName: item.itemName,
    itemDescription: item.itemDescription,
    itemImage: item.itemImage,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.unitPrice * item.quantity,
    originalCurrency: item.originalCurrency,
  }));

  // Calculate subtotal from line items
  const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const discount = resolvedDiscount;
  const shippingCost = options.shippingCost || 0;

  // ============ GST follows the DISCOUNTED value, not the list price ============
  // Callers compute `options.tax` from the listed price, before any coupon is
  // known (the coupon is resolved here, inside createInvoice). Leaving it at
  // that figure charges GST on money the buyer never pays — and on a 100%-off
  // redemption it leaves the whole invoice sitting at exactly the tax amount:
  // `36 - 36 + 6.48 = 6.48`, which never trips the zero-pay branch below, so a
  // "free" coupon mints an unpayable draft and the subscription never starts.
  // (Real case: NetworkChain GETNETWORKCHAINS → INV-MUCXEQTJ-4G05 at $6.48.)
  //
  // A discount recorded on the invoice reduces the taxable value, so prorate
  // the caller's tax by what's actually being charged. Scaling (rather than
  // recomputing) keeps whatever rate/rounding the caller already applied, and
  // handles partial coupons too: 50% off pays GST on the remaining 50%.
  //
  // Scoped to the platform-coupon path on purpose. A caller-supplied
  // `options.discount` is a different animal — the free/prepaid first-cycle
  // paths deliberately pass `discount = subtotal + tax` and keep `tax` intact
  // so the recurring children inherit the right components (see
  // generateNextChildInvoice) — and must not be prorated a second time.
  let tax = options.tax || 0;
  if (platformCouponDoc && discount > 0 && tax > 0 && subtotal > 0) {
    const taxableAmount = Math.max(0, subtotal - discount);
    tax = Math.round((tax * taxableAmount) / subtotal);
  }

  const totalAmount = subtotal - discount + tax + shippingCost;

  const invoice = await Invoice.create({
    invoiceType: options.isRecurring ? "recurring" : "one_time",
    status: "draft",
    organizationId: new Types.ObjectId(options.organizationId),
    sellerId: new Types.ObjectId(options.sellerId),
    userId: new Types.ObjectId(options.userId),
    customerEmail: options.customerEmail,
    customerName: options.customerName,
    lineItems,
    subtotal,
    discount,
    tax,
    shippingCost,
    totalAmount,
    itemCurrency: options.itemCurrency,
    isRecurring: options.isRecurring || false,
    recurringPeriod: options.recurringPeriod,
    recurringIntervalMonths: options.recurringIntervalMonths,
    couponId: resolvedCouponId ? new Types.ObjectId(resolvedCouponId) : undefined,
    couponCode: resolvedCouponCode,
    couponUsageId: options.couponUsageId
      ? new Types.ObjectId(options.couponUsageId)
      : undefined,
    // Cashback code stamp — drives executeCashback() in fulfillInvoice. Only
    // set when the input code resolved to a CashbackCode (mutex with coupon).
    cashbackCodeId: resolvedCashbackCodeId
      ? new Types.ObjectId(resolvedCashbackCodeId)
      : undefined,
    shippingAddress: options.shippingAddress,
    referralId: options.referralId,
    metadata: options.metadata,
    razorpaySubscriptionId: options.razorpaySubscriptionId,
    subscriptionRef: options.subscriptionRef
      ? new Types.ObjectId(options.subscriptionRef)
      : undefined,
    thirdPartyClientId: options.thirdPartyClientId
      ? new Types.ObjectId(options.thirdPartyClientId)
      : undefined,
    thirdPartyExternalId: options.thirdPartyExternalId,
    paymentSource: options.paymentSource,
    // Auto-expire after 24 hours
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  console.log(
    `[Invoice] Created invoice ${invoice.invoiceNumber} for ${options.customerEmail} (${options.itemCurrency} ${totalAmount})`
  );

  // ============ Platform coupon redemption (post-create) ============
  if (platformCouponDoc) {
    const { redeemPlatformCoupon } = await import("./platformCoupon");
    try {
      const redemption = await redeemPlatformCoupon({
        coupon: platformCouponDoc,
        userId: options.userId,
        productType: options.lineItems[0]?.itemType as any,
        // Same single rule every other call site uses — see
        // services/platformCoupon.ts::redemptionScopeFor.
        ...(await import("./platformCoupon")).redemptionScopeFor(
          platformCouponDoc,
          invoice
        ),
      });
      // If this coupon was pre-assigned to the user (Rewards), mark the
      // assignment as "used" so it disappears from their inbox.
      try {
        const { markAssignmentUsed } = await import("./couponAssignment");
        await markAssignmentUsed(
          options.userId,
          platformCouponDoc._id.toString(),
          "platform",
          redemption?._id?.toString()
        );
      } catch (err) {
        console.error(`[Invoice] markAssignmentUsed failed:`, err);
      }
    } catch (err) {
      console.error(`[Invoice] redeemPlatformCoupon failed:`, err);
    }

    // Zero-pay auto-paid branch
    if (totalAmount === 0) {
      invoice.status = "paid";
      invoice.paidAt = new Date();
      // For recurring, also set the first nextDueDate so the cron picks it up
      if (options.isRecurring) {
        invoice.nextDueDate = getNextChargeDate(
          new Date(),
          options.recurringPeriod || "monthly",
          options.recurringIntervalMonths
        );
      }
      await invoice.save();

      try {
        await fulfillInvoice(invoice, `coupon_zero_${invoice._id}`);
      } catch (err) {
        console.error(
          `[Invoice] fulfillInvoice (zero-pay) failed for ${invoice.invoiceNumber}:`,
          err
        );
      }
      console.log(
        `[Invoice] Zero-pay coupon applied — ${invoice.invoiceNumber} auto-paid`
      );
    }
  }

  return invoice;
}

/**
 * User selects currency + payment method.
 * This locks the exchange rate, creates a Razorpay order, and moves the invoice to "pending".
 */
export async function selectPaymentMethod(
  invoiceId: string,
  options: SelectPaymentOptions
): Promise<SelectPaymentResult> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Zero-amount short-circuit. Two sub-cases:
  //  - status === "paid": already finalized (idempotent re-call).
  //  - status === "draft": user applied a 100%-off coupon and is now clicking
  //    "Confirm" to finalize — mark paid + fulfill here as a single deliberate
  //    action. apply-platform-coupon deliberately no longer auto-fulfills.
  if (invoice.totalAmount === 0) {
    if (invoice.status === "draft") {
      invoice.status = "paid";
      invoice.paidAt = new Date();
      await invoice.save();
      try {
        await fulfillInvoice(invoice, `coupon_zero_${invoice._id}`);
      } catch (err) {
        console.error("[Invoice] coupon-zero finalize fulfill error:", err);
      }
    }
    return {
      invoiceId: invoice._id.toString(),
      amount: 0,
      currency: invoice.paymentCurrency || invoice.itemCurrency,
      alreadyPaid: true,
    } as any;
  }

  // ─── DOUBLE-CHARGE DEFENSE ─────────────────────────────────────
  // Auto-charge cron may have JUST claimed this invoice and be mid-way
  // through calling Stripe. If we let the manual pay path proceed here
  // we'd fire a second PaymentIntent → both settle → double-charge.
  // Refuse cleanly and tell the FE to poll.
  const meta = (invoice.metadata as any) || {};
  if (meta.autoChargeInFlight === true) {
    throw new Error(
      "Auto-payment is currently in progress on this invoice — please refresh in a moment.",
    );
  }
  // Also refuse if we already have a pending Stripe PI on the invoice
  // (auto-charge left it in `processing` for the webhook to finalise).
  // Manual pay would start a second PI = double-charge.
  if (
    invoice.status === "pending" &&
    typeof meta.stripePaymentIntentId === "string" &&
    meta.autoChargedAt
  ) {
    throw new Error(
      "A saved-card auto-renewal is settling on this invoice — please wait for confirmation.",
    );
  }

  // Terminal states (paid / cancelled / refunded / expired) stay locked.
  // `failed` is NOT terminal — a card decline, 3DS timeout, or network
  // hiccup is a legitimate reason to retry with a different card, method,
  // or currency. Same reset dance as `pending`, plus wipe the failure
  // metadata so the new attempt starts clean.
  if (!["draft", "pending", "failed"].includes(invoice.status)) {
    throw new Error(`Invoice cannot be modified (current status: ${invoice.status})`);
  }

  // Reset pending / failed invoice back to draft for re-selection.
  // pending  → user dismissed the gateway modal and wants to try again
  //            or change currency/method.
  // failed   → prior attempt was declined/3DS-timed-out; user retries.
  if (invoice.status === "pending" || invoice.status === "failed") {
    const wasFailed = invoice.status === "failed";
    invoice.status = "draft";
    invoice.razorpayOrderId = undefined as any;
    invoice.paymentCurrency = undefined as any;
    invoice.paymentMethodCategory = undefined as any;
    invoice.paymentPlatform = undefined as any;
    invoice.currencyConversion = undefined as any;
    if (wasFailed) {
      // Clear the failure trace from the prior attempt so the retry
      // doesn't show stale "Payment failed: <old reason>" on the invoice.
      invoice.failedAt = undefined as any;
      invoice.errorDescription = undefined as any;
      const mm = invoice.metadata as any;
      if (mm) {
        delete mm.stripePaymentIntentId;
        delete mm.failureReason;
        delete mm.stripeChargeId;
        invoice.markModified("metadata");
      }
    }
    await invoice.save();
  }

  // Validate payment method + currency combination
  validatePaymentMethodCurrency(
    options.paymentMethodCategory,
    options.paymentCurrency
  );

  let finalAmount = invoice.totalAmount;
  let finalCurrency = options.paymentCurrency;

  // CAD/EUR/GBP are offered as card-via-Stripe only (getPaymentOptions).
  // Enforce it here too so a hand-crafted request can't open a Razorpay
  // order or a crypto ask denominated in a currency those rails don't take.
  if (
    (EXTRA_PAYMENT_CURRENCIES as readonly string[]).includes(options.paymentCurrency) &&
    (options.paymentMethodCategory !== "card" || options.paymentPlatform !== "stripe")
  ) {
    throw new Error(
      `${options.paymentCurrency} payments are card-only via Stripe`
    );
  }

  // Handle currency conversion if needed
  // IMPORTANT: totalAmount always stays in itemCurrency. Converted amount is only used for Razorpay order.
  if (options.paymentCurrency !== invoice.itemCurrency) {
    const conversion = await convertCurrency(
      invoice.totalAmount,
      invoice.itemCurrency,
      options.paymentCurrency
    );
    finalAmount = conversion.convertedAmount;
    invoice.currencyConversion = {
      fromCurrency: invoice.itemCurrency,
      toCurrency: options.paymentCurrency,
      exchangeRate: conversion.exchangeRate,
      convertedAt: new Date(),
    };
    // Do NOT overwrite invoice.totalAmount — it stays in itemCurrency
  } else {
    // Paying in the invoice's own currency — clear any stale conversion
    // from a prior selection. The reset at the top of this function only
    // fires on pending/failed status; a draft invoice that first got
    // USD selected then switched back to INR would otherwise keep the
    // stale conversion note and 400× the buyer's "amount charged" line.
    invoice.currencyConversion = undefined as any;
  }

  invoice.paymentCurrency = options.paymentCurrency;
  invoice.paymentMethodCategory = options.paymentMethodCategory;
  invoice.paymentPlatform = options.paymentPlatform;

  // Crypto payments (in-house — replaces NOWPayments).
  //
  // Flow: FE passes { chain, coin } (e.g. tron/USDT or polygon/USDC). We
  // generate a CryptoPaymentRequest with a unique amount-tail so our
  // background poller can correlate incoming on-chain transfers to the
  // right invoice. FE renders <CryptoPaymentPanel/> with the returned
  // address + amount + QR + 15-min countdown. When the poller matches
  // an incoming tx, markMatched → fulfillInvoice runs (same code path
  // as any other payment platform).
  //
  // We keep the legacy NOWPayments branch commented out below — it can
  // be re-enabled by flipping `USE_LEGACY_NOWPAYMENTS` to true if the
  // in-house poller hits a serious issue in prod (rollback safety net).
  if (options.paymentMethodCategory === "crypto") {
    if (!options.chain || !options.coin) {
      throw new Error(
        "chain and coin are required for crypto_wallet payments (e.g. { chain: 'tron', coin: 'USDT' })"
      );
    }

    // USDT/USDC are USD-pegged (1:1), so the crypto ask must ALWAYS be
    // derived from the USD-cents equivalent of the invoice — never from
    // invoice.totalAmount directly, which lives in itemCurrency's
    // smallest unit (paise for INR). Without this an INR ₹23 invoice
    // asked the customer for 23 USDT instead of ~$0.27.
    let amountInUsdCents: number;
    let cryptoConversion: {
      fromCurrency: string;
      toCurrency: string;
      exchangeRate: number;
    } | null = null;
    if ((invoice.itemCurrency || "USD").toUpperCase() === "USD") {
      amountInUsdCents = invoice.totalAmount;
    } else {
      const conv = await convertCurrency(
        invoice.totalAmount,
        invoice.itemCurrency,
        "USD",
      );
      amountInUsdCents = conv.convertedAmount;
      cryptoConversion = {
        fromCurrency: invoice.itemCurrency,
        toCurrency: "USD",
        exchangeRate: conv.exchangeRate,
      };
    }

    const { createRequest } = await import("./cryptoPaymentRequest");
    const cryptoRequest = await createRequest(
      invoice._id.toString(),
      options.chain,
      options.coin,
      amountInUsdCents,
    );

    invoice.status = "pending";
    if (cryptoConversion) {
      // Record the INR→USD rate used to compute the on-chain ask so
      // reconciliation (and refunds) can back out the exact fiat number
      // the buyer saw. FE currently sends paymentCurrency = itemCurrency
      // for crypto (bypassing the earlier conversion block), so this is
      // the ONLY place we capture the FX for crypto INR invoices.
      invoice.currencyConversion = {
        ...cryptoConversion,
        convertedAt: new Date(),
      };
    }
    invoice.metadata = {
      ...invoice.metadata,
      cryptoPaymentRequestId: cryptoRequest.requestId,
      cryptoChain: cryptoRequest.chain,
      cryptoCoin: cryptoRequest.coin,
      cryptoAmountUsdCents: amountInUsdCents,
    };
    await invoice.save();

    return {
      amount: finalAmount,
      currency: finalCurrency,
      invoiceId: invoice._id.toString(),
      cryptoRequest,
    };
  }

  // Stripe one-time payment (USD card via embedded Elements)
  if (options.paymentPlatform === "stripe") {
    if (!stripeEnabled) {
      throw new Error("Stripe is not configured");
    }
    if (invoice.razorpaySubscriptionId) {
      throw new Error(
        "This subscription is managed by GaragePay; cannot pay via Stripe"
      );
    }

    const piMetadata = {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      userId: invoice.userId.toString(),
      orgId: invoice.organizationId.toString(),
      itemType: invoice.lineItems[0]?.itemType || "",
    };

    // ─── Saved-card fast path ────────────────────────────────────────
    // Founder tapped "Pay with •••• 4242" — server-side off-session
    // charge on the pre-attached PaymentMethod, no Elements iframe.
    // The `payment_intent.succeeded` webhook takes it from here on
    // success; on `requires_action` we bounce back a client_secret so
    // the FE can complete the 3DS challenge inline.
    if (options.savedPaymentMethodId) {
      const { User } = await import("../models/user.model");
      const user = await User.findById(invoice.userId).select(
        "paymentProfile.stripe.customerId paymentProfile.stripe.methods",
      );
      const customerId = (user as any)?.paymentProfile?.stripe?.customerId;
      const savedMethod = ((user as any)?.paymentProfile?.stripe?.methods || [])
        .find((m: any) => m.id === options.savedPaymentMethodId);
      if (!customerId || !savedMethod) {
        throw new Error("Saved payment method not found for this user");
      }

      // ─── INR charge strategy on a saved card ─────────────────────
      // Two paths depending on whether the saved PM has an RBI
      // e-mandate attached AND the amount fits under the cap:
      //
      //   MIT (mandate present, amount ≤ cap):
      //     off_session: true + mandate: <id> → Stripe charges
      //     silently, no OTP. This is the zero-friction reuse path.
      //
      //   CIT (mandate absent OR amount > cap):
      //     off_session: false → Stripe returns requires_action, FE
      //     completes OTP inline via the saved3DSOnly view.
      //
      // USD (and other non-INR) always MIT — Indian mandate rules
      // don't apply, off_session works out of the box.
      // Shared predicate — same helper the admin one-time-charge route
      // uses so both flows apply identical MIT/CIT gating.
      const { resolveSavedCardChargeMode } = await import("./paymentGating");
      const chargeMode = resolveSavedCardChargeMode({
        card: savedMethod,
        invoiceAmount: finalAmount,
        invoiceCurrency: finalCurrency,
      });

      let pi: any;
      try {
        pi = await chargeSavedPaymentMethod({
          customerId,
          paymentMethodId: options.savedPaymentMethodId,
          amountInSmallestUnit: finalAmount,
          currency: finalCurrency,
          metadata: piMetadata,
          description: invoice.lineItems[0]?.itemName,
          receiptEmail: invoice.customerEmail,
          offSession: chargeMode.offSession,
          // Pass the mandate id when going off-session on INR. Stripe
          // rejects off-session INR charges without a mandate.
          ...(chargeMode.mandate ? { mandate: chargeMode.mandate } : {}),
        });
      } catch (err: any) {
        // Stripe throws on `authentication_required` (3DS) instead of
        // returning a plain PI. The PI is attached to err.raw and
        // carries a client_secret we can hand back to the FE.
        if (err?.code === "authentication_required" && err?.raw?.payment_intent) {
          pi = err.raw.payment_intent;
        } else {
          throw err;
        }
      }

      invoice.metadata = {
        ...(invoice.metadata || {}),
        stripePaymentIntentId: pi.id,
        stripeCustomerId: customerId,
        stripePaymentMethodId: options.savedPaymentMethodId,
      };
      invoice.status = "pending";
      await invoice.save();

      if (pi.status === "succeeded") {
        // Webhook will mark paid + fulfill (avoid double-fulfilling here).
        return {
          amount: finalAmount,
          currency: finalCurrency,
          invoiceId: invoice._id.toString(),
          alreadyPaid: true,
          stripePaymentIntentId: pi.id,
        };
      }

      if (
        pi.status === "requires_action" ||
        pi.status === "requires_confirmation"
      ) {
        return {
          amount: finalAmount,
          currency: finalCurrency,
          invoiceId: invoice._id.toString(),
          stripeClientSecret: pi.client_secret,
          stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
          stripePaymentIntentId: pi.id,
        };
      }

      // Card declined / payment_failed etc. — surface Stripe's error.
      throw new Error(
        pi.last_payment_error?.message ||
          `Stripe charge did not succeed (status: ${pi.status})`,
      );
    }

    // ─── Fresh-card flow (Elements) ──────────────────────────────────
    // Optional save-for-future adds `customer` + `setup_future_usage`
    // so the PM auto-attaches on success; webhook persists it.
    let customerIdForFresh: string | undefined;
    if (options.savePaymentMethodForFuture) {
      customerIdForFresh = await getOrCreateStripeCustomer({
        userId: invoice.userId.toString(),
        email: invoice.customerEmail,
        name: invoice.customerName,
      });
    }

    const pi = await createStripePaymentIntent({
      amountInSmallestUnit: finalAmount,
      currency: finalCurrency,
      metadata: piMetadata,
      description: invoice.lineItems[0]?.itemName,
      receiptEmail: invoice.customerEmail,
      ...(customerIdForFresh ? { customer: customerIdForFresh } : {}),
      ...(options.savePaymentMethodForFuture
        ? { setupFutureUsage: "off_session" as const }
        : {}),
      // Attach India e-mandate whenever the founder is saving a card.
      // Stripe scopes it to Indian issuers only (foreign cards ignore
      // the field) so it's safe to always include. RBI cap: ₹1L per
      // MIT for zero-OTP; charges above always require OTP.
      ...(options.savePaymentMethodForFuture
        ? {
            indianMandate: {
              reference: `garage-${invoice.userId.toString()}-${Date.now()}`,
              amountInPaise: 10_000_000,
              description:
                "Garage — subscription renewals and one-off purchases",
              interval: "sporadic" as const,
            },
          }
        : {}),
    });

    invoice.metadata = {
      ...(invoice.metadata || {}),
      stripePaymentIntentId: pi.paymentIntentId,
      ...(customerIdForFresh
        ? { stripeCustomerId: customerIdForFresh }
        : {}),
    };
    invoice.status = "pending";
    await invoice.save();

    return {
      stripeClientSecret: pi.clientSecret,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      stripePaymentIntentId: pi.paymentIntentId,
      amount: finalAmount,
      currency: finalCurrency,
      invoiceId: invoice._id.toString(),
    };
  }

  // Every remaining path — new or legacy — creates a one-time Razorpay
  // Order for the CURRENT cycle's amount. Invoices with a stashed
  // `razorpaySubscriptionId` (from the retired
  // POST /feed/channels/:id/create-subscription flow) intentionally fall
  // through: we ignore Razorpay's subscription surface entirely and let
  // Garage's invoice cycle drive renewals. The field stays on the row
  // for audit but doesn't shape the response.
  //
  // ─── Razorpay save-card prep (phase 2) ─────────────────────────────
  // Two entry points, both need a Razorpay Customer resolved BEFORE
  // the order is created so the popup can scope to it:
  //   1. Fresh card + saveRazorpayCardForFuture → create Customer,
  //      thread `customer_id` + `save: 1` to popup.
  //   2. Reuse a saved token → thread `customer_id` + `preferredToken`
  //      so the popup pre-shows that saved card.
  // Both cases produce the same shape below (`razorpayCustomerId`,
  // `razorpayPreferredTokenId`, `razorpaySave`) so the two Razorpay
  // order branches don't need to diverge.
  let razorpayCustomerIdForCheckout: string | undefined;
  let razorpayPreferredTokenId: string | undefined;
  let razorpaySave = false;

  if (options.paymentPlatform === "razorpay" && options.savedRazorpayTokenId) {
    const { User } = await import("../models/user.model");
    const u = await User.findById(invoice.userId).select(
      "paymentProfile.razorpay.customerId paymentProfile.razorpay.tokens",
    );
    const custId = (u as any)?.paymentProfile?.razorpay?.customerId;
    const owns = ((u as any)?.paymentProfile?.razorpay?.tokens || []).some(
      (t: any) => t.id === options.savedRazorpayTokenId,
    );
    if (!custId || !owns) {
      throw new Error("Saved Razorpay token not found for this user");
    }
    razorpayCustomerIdForCheckout = custId;
    razorpayPreferredTokenId = options.savedRazorpayTokenId;
  } else if (
    options.paymentPlatform === "razorpay" &&
    options.saveRazorpayCardForFuture
  ) {
    razorpayCustomerIdForCheckout = await getOrCreateRazorpayCustomer({
      userId: invoice.userId.toString(),
      email: invoice.customerEmail,
      name: invoice.customerName,
    });
    razorpaySave = true;
  }

  /**
   * UPI Autopay registration.
   *
   * A recurring invoice paid by UPI mints an order that ALSO establishes a
   * mandate, so later cycles can be auto-debited instead of chasing the payer
   * every month. Without this branch every Razorpay payment goes through the
   * plain `createRazorpayOrder` below — no `customer_id`, no `token` block —
   * and no mandate can ever exist, which is why the auto-charge branch had
   * nothing to find.
   *
   * `isRecurring` is read from the INVOICE, never from the request. A standing
   * debit authority must not be attachable by passing a flag.
   *
   * Additive by construction: a one-off UPI payment, or any card payment,
   * falls straight through to the existing path unchanged.
   *
   * The payer still approves the mandate inside their UPI app — that step is
   * intrinsic to the rail. What we control is disclosing the terms at
   * checkout, which the FE does.
   *
   * ── Why `isRecurring` alone is not the test ───────────────────────────
   *
   * Two high-volume NetworkChain purchases are typed `one_time` yet put the
   * buyer on a subscription, because fulfilment dispatches on lineItems[0]
   * and cannot fulfil a mixed-line invoice:
   *
   *   - the combo cart, which stamps `metadata.combo` at checkout;
   *   - a BARE $25 licence bought inside the 24h window, which stamps
   *     NOTHING — the free month is granted later by `comboFallback` in
   *     fulfillInvoice, which re-derives the window at fulfilment time.
   *
   * In both, `comboActivation` mints the subscription root with
   * `totalAmount: 0` and marks it paid in code, never touching a gateway. So
   * THIS payment is the only moment in the entire flow when a mandate can be
   * established — miss it and the buyer reaches their first real renewal with
   * a live subscription and no way to auto-pay it.
   *
   * `willEstablishSubscription` is shared with the checkout disclosure, so a
   * mandate is never registered without the buyer being told, and never
   * promised without being set up. Gating on `metadata.combo` alone missed the
   * bare-licence path entirely and shipped exactly that bug.
   *
   * Flipping `isRecurring` on the cart instead would be destructive — it would
   * turn the $25 licence into a recurring parent and re-bill it every cycle.
   * The cart stays one-time; only mandate registration widens.
   */
  // Cheap rail checks FIRST, so a card payment never pays for the
  // subscription lookup below.
  //
  // UPI ONLY. Cards stay on Stripe and must never reach this branch — widening
  // it to cards would attach a standing debit authority to a rail with
  // entirely different consent and chargeback rules.
  const upiRailEligible =
    options.paymentMethodCategory === "upi" &&
    options.paymentPlatform === "razorpay" &&
    (finalCurrency || "").toUpperCase() === "INR";

  const wantsUpiMandate =
    upiRailEligible &&
    (await import("./upiAutopay").then((m) =>
      m.willEstablishSubscription(invoice),
    ));

  // One line per attempt, including the negative case — when a mandate does
  // NOT get set up, the reason is exactly what you need and is otherwise
  // invisible. Prefix is shared across the whole lifecycle: `grep UPI-AUTOPAY`.
  if (upiRailEligible) {
    console.log(
      `[UPI-AUTOPAY] 1/5 GATE ${invoice.invoiceNumber} user=${invoice.userId} ` +
        `rail=upi/razorpay/${finalCurrency} willEstablishSubscription=${wantsUpiMandate} ` +
        `isRecurring=${invoice.isRecurring} combo=${!!(invoice.metadata as any)?.combo} ` +
        `-> ${wantsUpiMandate ? "REGISTERING MANDATE" : "plain UPI order, no mandate"}`,
    );
  }

  if (wantsUpiMandate) {
    try {
      const { getOrCreateRazorpayCustomer, createUpiMandateOrder } =
        await import("./razorpay");

      const mandateCustomerId =
        razorpayCustomerIdForCheckout ??
        (await getOrCreateRazorpayCustomer({
          userId: invoice.userId.toString(),
          email: invoice.customerEmail,
          name: invoice.customerName,
        }));

      // Size the mandate to THIS subscription rather than using a blanket
      // ceiling — see resolveMandateCapPaise. Falls back to the module default
      // only when the renewal price can't be resolved.
      const { resolveMandateCapPaise, resolveMandateFrequency } = await import(
        "./upiAutopay"
      );
      const mandateCapPaise = await resolveMandateCapPaise(invoice, finalAmount);
      if (!mandateCapPaise) {
        // No resolvable cap means no basis for a ceiling — most often a $0
        // cycle (office runs many before its first real charge). Falling back
        // to the blanket maximum would take authority for a figure nobody
        // chose, so refuse the mandate and let this be an ordinary payment.
        throw new Error(
          `No resolvable mandate cap for ${invoice.invoiceNumber} — skipping registration`,
        );
      }
      // Declare the real cadence so the payer's UPI app shows "Monthly" /
      // "Quarterly" / "Yearly" rather than the opaque "As requested".
      const mandateFrequency = await resolveMandateFrequency(invoice);

      console.log(
        `[UPI-AUTOPAY] 2/5 PARAMS ${invoice.invoiceNumber} customer=${mandateCustomerId} ` +
          `charge=${finalAmount} ${finalCurrency} cap=${mandateCapPaise} paise ` +
          `frequency=${mandateFrequency}`,
      );

      const shortTs = Date.now().toString().slice(-12);
      const order = await createUpiMandateOrder({
        amount: finalAmount,
        currency: finalCurrency,
        receipt: `mnd_${shortTs}`,
        customerId: mandateCustomerId,
        maxAmountPaise: mandateCapPaise,
        frequency: mandateFrequency,
        notes: {
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          itemType: invoice.lineItems[0]?.itemType || "",
          userId: invoice.userId.toString(),
          orgId: invoice.organizationId.toString(),
        },
      });

      console.log(
        `[UPI-AUTOPAY] 3/5 ORDER ${invoice.invoiceNumber} order=${order.id} — ` +
          `checkout must now send recurring:1 + customer_id for the mandate to register`,
      );

      invoice.razorpayOrderId = order.id;
      invoice.status = "pending";
      (invoice.metadata as any) = {
        ...(invoice.metadata as any),
        upiAutopayRegistration: true,
      };
      await invoice.save();

      return {
        razorpayOrderId: order.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
        amount: order.amount,
        currency: order.currency,
        invoiceId: invoice._id.toString(),
        razorpayCustomerId: mandateCustomerId,
        // Tells the FE this payment also establishes a mandate, so the popup
        // and any confirmation copy can say so.
        upiAutopay: true,
      };
    } catch (err: any) {
      // Registration is an enhancement, not the payment. If Razorpay refuses
      // the mandate block (account not enabled for Autopay, for instance),
      // fall through to a normal UPI collect so the buyer can still pay —
      // they simply won't get auto-renewal.
      //
      // This is the failure mode nobody would otherwise notice: the buyer pays
      // successfully, the invoice looks perfect, and autopay was simply never
      // established. Stamp it on the invoice so a silent downgrade is queryable
      // rather than buried in logs:
      //   db.invoices.find({ "metadata.upiMandateFallback": { $exists: true } })
      console.error(
        `[Invoice] UPI mandate order FAILED for ${invoice.invoiceNumber} — falling back to a plain UPI order; this buyer will pay WITHOUT autopay:`,
        err?.message ?? err,
      );
      try {
        await Invoice.updateOne(
          { _id: invoice._id },
          {
            $set: {
              "metadata.upiMandateFallback": {
                reason: String(err?.message ?? err).slice(0, 500),
                at: new Date(),
              },
            },
          },
        );
      } catch {
        // Bookkeeping only — never let it interfere with taking the payment.
      }
    }
  }

  // Create Razorpay order for one-time payments
  if (!invoice.isRecurring) {
    const shortTs = Date.now().toString().slice(-12);

    // Build promotions if coupon was applied
    let promotions: CouponPromotion[] | undefined;
    if (invoice.couponCode && invoice.discount > 0) {
      promotions = [
        {
          reference_id: invoice.couponId?.toString() || "",
          code: invoice.couponCode,
          type: "coupon",
          value: invoice.discount,
          value_type: "fixed_amount",
          description: `Coupon: ${invoice.couponCode}`,
        },
      ];
    }

    const order = await createRazorpayOrder({
      amount: finalAmount,
      currency: finalCurrency,
      receipt: `inv_${shortTs}`,
      notes: {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        itemType: invoice.lineItems[0]?.itemType || "",
        userId: invoice.userId.toString(),
        orgId: invoice.organizationId.toString(),
        ...(razorpayCustomerIdForCheckout
          ? { customerId: razorpayCustomerIdForCheckout }
          : {}),
      },
      promotions,
    });

    invoice.razorpayOrderId = order.id;
    invoice.status = "pending";
    await invoice.save();

    return {
      razorpayOrderId: order.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
      amount: order.amount,
      currency: order.currency,
      invoiceId: invoice._id.toString(),
      ...(razorpayCustomerIdForCheckout
        ? { razorpayCustomerId: razorpayCustomerIdForCheckout }
        : {}),
      ...(razorpayPreferredTokenId
        ? { razorpayPreferredTokenId }
        : {}),
      ...(razorpaySave ? { razorpaySave: true } : {}),
    };
  }

  // Recurring invoice — every cycle is a standalone Razorpay Order.
  // We own the billing cycle regardless of whether `razorpaySubscriptionId`
  // is set on the row (legacy invoices from the retired
  // /feed/channels/:id/create-subscription path have it stamped; new
  // invoices don't; either way we bill THIS cycle as a one-time order).
  {
    const shortTs = Date.now().toString().slice(-12);

    let promotions: CouponPromotion[] | undefined;
    if (invoice.couponCode && invoice.discount > 0) {
      promotions = [
        {
          reference_id: invoice.couponId?.toString() || "",
          code: invoice.couponCode,
          type: "coupon",
          value: invoice.discount,
          value_type: "fixed_amount",
          description: `Coupon: ${invoice.couponCode}`,
        },
      ];
    }

    const order = await createRazorpayOrder({
      amount: finalAmount,
      currency: finalCurrency,
      receipt: `inv_${shortTs}`,
      notes: {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        itemType: invoice.lineItems[0]?.itemType || "",
        userId: invoice.userId.toString(),
        orgId: invoice.organizationId.toString(),
        ...(razorpayCustomerIdForCheckout
          ? { customerId: razorpayCustomerIdForCheckout }
          : {}),
      },
      promotions,
    });

    invoice.razorpayOrderId = order.id;
    invoice.status = "pending";
    await invoice.save();

    return {
      razorpayOrderId: order.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
      amount: order.amount,
      currency: order.currency,
      invoiceId: invoice._id.toString(),
      ...(razorpayCustomerIdForCheckout
        ? { razorpayCustomerId: razorpayCustomerIdForCheckout }
        : {}),
      ...(razorpayPreferredTokenId
        ? { razorpayPreferredTokenId }
        : {}),
      ...(razorpaySave ? { razorpaySave: true } : {}),
    };
  }
}

/**
 * Verify Razorpay payment signature and mark invoice as paid.
 */
export async function verifyAndCompletePayment(
  invoiceId: string,
  options: VerifyPaymentOptions
): Promise<IInvoice> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Idempotency: the webhook (order.paid) and the browser's verify-payment call
  // race each other. If the webhook landed first, the invoice is already paid
  // by the time the browser POSTs here — treat that as success instead of
  // erroring, as long as it's the same payment and the signature is genuine.
  if (
    invoice.status === "paid" &&
    invoice.razorpayPaymentId === options.razorpayPaymentId &&
    verifyPaymentSignature(
      options.razorpayOrderId,
      options.razorpayPaymentId,
      options.razorpaySignature
    )
  ) {
    // Transient marker — tells the route caller not to re-run fulfillment,
    // because the webhook already did it. Not persisted to the DB.
    (invoice as any).__alreadyFulfilled = true;
    return invoice;
  }

  if (invoice.status !== "pending") {
    throw new Error(
      `Invoice is not in pending status (current: ${invoice.status})`
    );
  }

  // Verify Razorpay signature
  const isValid = verifyPaymentSignature(
    options.razorpayOrderId,
    options.razorpayPaymentId,
    options.razorpaySignature
  );

  if (!isValid) {
    invoice.status = "failed";
    invoice.failedAt = new Date();
    invoice.errorCode = "SIGNATURE_MISMATCH";
    invoice.errorDescription = "Payment signature verification failed";
    await invoice.save();
    throw new Error("Payment verification failed");
  }

  invoice.razorpayPaymentId = options.razorpayPaymentId;
  invoice.status = "paid";
  invoice.paidAt = new Date();
  await invoice.save();

  console.log(
    `[Invoice] Invoice ${invoice.invoiceNumber} marked as paid (payment: ${options.razorpayPaymentId})`
  );

  return invoice;
}

/**
 * Cancel an unpaid invoice.
 */
export class CryptoPaymentInFlightError extends Error {
  code = "CRYPTO_PAYMENT_IN_FLIGHT";
  constructor(message: string) {
    super(message);
    this.name = "CryptoPaymentInFlightError";
  }
}

export async function cancelInvoice(
  invoiceId: string,
  options: { force?: boolean } = {}
): Promise<IInvoice> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // `failed` is cancellable too. A failed payment attempt leaves the invoice
  // still owing — it shows in the customer's Pending list and the auto-charger
  // keeps retrying it — so refusing to cancel left people with rows they could
  // not dismiss.
  //
  // This also removes an inconsistency rather than inventing a rule:
  // `selectPaymentMethod` already accepts ["draft", "pending", "failed"] and
  // resets a failed invoice back to draft so it can be retried. The codebase
  // therefore already treats `failed` as recoverable; cancel was the outlier.
  //
  // Terminal states stay refused: `paid` and `refunded` because money moved,
  // `cancelled` because it already is, `expired` because it lapsed on its own.
  if (!["draft", "pending", "failed"].includes(invoice.status)) {
    throw new Error(`Cannot cancel invoice in ${invoice.status} status`);
  }

  // Auto-charge safety, mirroring the crypto guard below. The recurring
  // auto-charger selects `status: { $in: ["draft", "failed"] }` and claims a
  // row by stamping `metadata.autoChargeInFlight` before it calls the
  // processor. Cancelling underneath that claim races the charge: the invoice
  // reads "cancelled" while the customer's card is still charged. Refuse
  // unless the caller explicitly forces it.
  if (!options.force && invoice.metadata?.autoChargeInFlight) {
    throw new Error(
      "This invoice is being charged right now. Wait for the attempt to finish, then cancel.",
    );
  }

  // Crypto safety: a NowPayments invoice that hasn't received its IPN yet may
  // have an in-flight transaction we don't know about. The customer could
  // have already sent crypto and the IPN is just delayed (or, in the past,
  // was misrouted to localhost). Refuse without an explicit force=true.
  // The caller is expected to show a strongly-worded confirmation prompt.
  if (
    !options.force &&
    invoice.metadata?.nowpaymentsInvoiceId &&
    !invoice.metadata?.nowpaymentsPaymentId
  ) {
    throw new CryptoPaymentInFlightError(
      "This invoice may have an in-progress crypto transaction. If you have already sent crypto, do NOT cancel — contact support. To cancel anyway, retry with force=true."
    );
  }

  invoice.status = "cancelled";
  invoice.cancelledAt = new Date();
  await invoice.save();

  console.log(`[Invoice] Invoice ${invoice.invoiceNumber} cancelled`);
  return invoice;
}

/**
 * Cancel a recurring subscription at the end of the current billing period.
 * The parent invoice stays "paid" (the current period is honored).
 * Setting `cancelledAt` prevents the cron from generating future invoices.
 * Any existing draft/pending child invoices are cancelled immediately.
 */
export async function cancelSubscription(
  parentInvoiceId: string,
  userId: string
): Promise<IInvoice> {
  const parent = await Invoice.findById(parentInvoiceId);
  if (!parent) throw new Error("Subscription not found");
  if (parent.parentInvoiceId) throw new Error("Cannot cancel a child invoice — cancel the parent subscription");
  if (!parent.isRecurring) throw new Error("Invoice is not a recurring subscription");
  if (parent.cancelledAt) throw new Error("Subscription is already cancelled");
  if (parent.userId.toString() !== userId) throw new Error("Unauthorized");

  // A pending / draft parent was never activated — nothing has cycled yet,
  // no ChannelMembership was created (channel memberships materialize on
  // paid), no cron cascade to stop. Flip the invoice itself to cancelled
  // and return. This is the same shape cancelInvoice() would apply; keeping
  // the branch here means either endpoint is safe for the FE to hit for a
  // pending recurring parent.
  if (parent.status === "pending" || parent.status === "draft") {
    parent.status = "cancelled";
    parent.cancelledAt = new Date();
    await parent.save();
    console.log(
      `[Invoice] Subscription ${parent.invoiceNumber} cancelled (was ${parent.status === "cancelled" ? "pending/draft" : parent.status}, never activated).`
    );
    return parent;
  }

  // From here down: the historical paid-subscription cancel-at-cycle-end
  // path, unchanged.
  if (parent.status !== "paid") throw new Error("Subscription is not active");

  parent.cancelledAt = new Date();
  await parent.save();

  // Cancel any pending/draft children so the user isn't charged for the next cycle
  const result = await Invoice.updateMany(
    { parentInvoiceId: parent._id, status: { $in: ["draft", "pending"] } },
    { $set: { status: "cancelled", cancelledAt: new Date() } }
  );

  // If a platform coupon redemption exists, mark it cancelled so the cron stops applying it
  const { PlatformCouponRedemption } = await import(
    "../models/platformCouponRedemption.model"
  );
  await PlatformCouponRedemption.updateOne(
    { parentInvoiceId: parent._id, status: "active" },
    { $set: { status: "cancelled" } }
  );

  // Revoke a UPI Autopay mandate that exists only to fund THIS subscription.
  //
  // Leaving it live would be the worst kind of bug: the payer cancelled, the
  // invoices stop, but a standing debit authority remains on their bank
  // account. Best-effort and never fatal — the cancel itself has already
  // succeeded and must not be undone by a Razorpay hiccup. The cron is gated
  // on `mandateStatus === "active"`, so flipping the local row is what
  // actually stops billing; the remote revoke is what releases the payer.
  //
  // Only revoked when this is the user's LAST active subscription on that
  // mandate — one mandate can fund several, and killing it on the first
  // cancellation would silently break the others.
  try {
    const stillActive = await Invoice.countDocuments({
      userId: parent.userId,
      isRecurring: true,
      parentInvoiceId: { $exists: false },
      status: "paid",
      cancelledAt: { $exists: false },
      _id: { $ne: parent._id },
    });

    if (stillActive === 0) {
      const { User } = await import("../models/user.model");
      const u: any = await User.findById(parent.userId)
        .select("paymentProfile.razorpay")
        .lean();
      const custId = u?.paymentProfile?.razorpay?.customerId;
      const mandates = ((u?.paymentProfile?.razorpay?.tokens || []) as any[]).filter(
        (t) => t?.method === "upi" && t?.mandateStatus === "active",
      );

      if (custId && mandates.length) {
        const { revokeUpiMandate } = await import("./razorpay");
        for (const m of mandates) {
          const res = await revokeUpiMandate({ customerId: custId, tokenId: m.id });
          await User.updateOne(
            { _id: parent.userId, "paymentProfile.razorpay.tokens.id": m.id },
            { $set: { "paymentProfile.razorpay.tokens.$.mandateStatus": "revoked" } },
          );
          console.log(
            `[Invoice] UPI mandate ${m.id} ${res.alreadyGone ? "already gone at Razorpay" : "revoked"} on cancel of ${parent.invoiceNumber}`,
          );
        }
      }
    } else {
      console.log(
        `[Invoice] Kept UPI mandate — ${stillActive} other active subscription(s) still rely on it.`,
      );
    }
  } catch (err: any) {
    console.error(
      `[Invoice] UPI mandate revoke failed for ${parent.invoiceNumber} (cancel still stands):`,
      err?.message ?? err,
    );
  }

  console.log(
    `[Invoice] Subscription ${parent.invoiceNumber} cancelled at end of period. ${result.modifiedCount} pending children cancelled.`
  );
  return parent;
}

/**
 * Renew (reactivate) a recurring subscription IN PLACE — reusing the existing
 * parent invoice so the subscription's identity, price and child history stay
 * continuous. This is the inverse of cancelSubscription and the ONLY way a
 * cancelled/expired subscription should come back: creating a fresh invoice via
 * the normal subscribe path would mint a brand-new parent and orphan this one.
 *
 * Steps:
 *  1. Clear the parent's one-way `cancelledAt` flag — this re-arms the daily
 *     cron + the on-payment chain, both of which skip cancelled parents.
 *  2. Ensure exactly ONE payable next-cycle CHILD invoice exists (idempotent —
 *     never duplicates):
 *       a. reuse a live draft/pending child if one already exists (e.g. the
 *          cron-minted renewal sitting unpaid on an expired sub), else
 *       b. resurrect the child that cancel/expiry killed — back to `draft`,
 *          re-priced to the full per-cycle amount with any leftover coupon
 *          stripped (reusing the row avoids the {clientId, externalId} unique
 *          collision that re-minting the same cycle would hit), else
 *       c. mint a fresh cycle via generateNextChildInvoice (only when no child
 *          was ever generated — a parent still on cycle 1).
 *
 * Price is always the subscription's own per-cycle price (subtotal + tax +
 * shipping, discount 0) — never the $25 first-month combo.
 *
 * Returns { parent, child, covered }. `covered` = the current paid period still
 * covers today: when true the child is due at period end (no charge now, the
 * caller should NOT prompt payment — coverage is unbroken); when false the
 * child is payable immediately (pay it to reactivate). Paying the child flows
 * through the normal fulfill → applyPaidInvoice path (advances nextDueDate,
 * flips the sub active).
 */
export async function renewSubscription(
  parentInvoiceId: string,
  userId: string
): Promise<{ parent: IInvoice; child: IInvoice | null; covered: boolean }> {
  const parent = await Invoice.findById(parentInvoiceId);
  if (!parent) throw new Error("Subscription not found");
  if (parent.parentInvoiceId)
    throw new Error("Provide the parent subscription, not a child invoice");
  if (!parent.isRecurring)
    throw new Error("Invoice is not a recurring subscription");
  if (parent.userId.toString() !== userId) throw new Error("Unauthorized");
  // Renew only applies to a subscription that was activated at least once. A
  // never-paid draft/pending parent should go through the normal subscribe flow.
  if (parent.status !== "paid")
    throw new Error("Subscription was never active — subscribe instead");

  // 1. Un-cancel. `cancelledAt` is otherwise a one-way flag; clearing it re-arms
  //    generateNextChildInvoice + generateDueRecurringInvoices (both bail on it).
  if (parent.cancelledAt) {
    await Invoice.updateOne({ _id: parent._id }, { $unset: { cancelledAt: 1 } });
    parent.cancelledAt = undefined;
  }

  const now = new Date();
  const STALE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // matches child expiresAt window
  const covered =
    !!parent.nextDueDate && parent.nextDueDate.getTime() > now.getTime();
  const fullPrice =
    parent.subtotal + (parent.tax || 0) + (parent.shippingCost || 0);

  // 2a. A live child already covers this cycle — reuse it (no duplicate).
  const live = await Invoice.findOne({
    parentInvoiceId: parent._id,
    status: { $in: ["draft", "pending"] },
  }).sort({ recurringPaymentNumber: -1 });
  if (live) return { parent, child: live, covered };

  // 2b. Resurrect the child cancel/expiry killed — back to a payable draft at
  //     full per-cycle price (coupon stripped). Reusing the row sidesteps the
  //     {thirdPartyClientId, thirdPartyExternalId} unique index. The old due
  //     date is left as-is: a lapsed cycle reads overdue, a still-covered one
  //     stays at period end; either way the hosted page accepts payment and
  //     fulfill advances nextDueDate from today.
  const dead = await Invoice.findOne({
    parentInvoiceId: parent._id,
    status: { $in: ["cancelled", "expired"] },
  }).sort({ recurringPaymentNumber: -1 });
  if (dead) {
    const set: Record<string, unknown> = {
      status: "draft",
      discount: 0,
      totalAmount: fullPrice,
    };
    // A lapsed cycle's expiry window is already in the past — extend it so the
    // payable draft isn't voided by expireStaleInvoices before the user pays.
    // A still-covered cycle keeps its period-end-based (future) expiry.
    if (!covered) set.expiresAt = new Date(now.getTime() + STALE_GRACE_MS);
    await Invoice.updateOne(
      { _id: dead._id },
      { $set: set, $unset: { cancelledAt: 1, couponId: 1, couponCode: 1 } }
    );
    const refreshed = await Invoice.findById(dead._id);
    return { parent, child: refreshed, covered };
  }

  // 2c. No child ever generated (parent still on cycle 1) — mint the next cycle.
  //     cancelledAt is cleared + status is paid, so this now succeeds. It's due
  //     at period end when covered, or at the (past) schedule date when lapsed.
  const child = await generateNextChildInvoice(parent);
  // Same guard as 2b: a freshly-minted lapsed cycle inherits a past expiresAt.
  if (child && !covered) {
    const grace = new Date(now.getTime() + STALE_GRACE_MS);
    if (!child.expiresAt || child.expiresAt.getTime() < grace.getTime()) {
      await Invoice.updateOne({ _id: child._id }, { $set: { expiresAt: grace } });
      child.expiresAt = grace;
    }
  }
  return { parent, child, covered };
}

/**
 * Create a recurring invoice record when a subscription webhook fires.
 * Called from webhook handler on subscription.charged event.
 */
export async function createRecurringInvoice(
  parentInvoiceId: string,
  paymentData: {
    razorpayPaymentId: string;
    razorpaySubscriptionId: string;
    razorpayInvoiceId?: string;
    invoiceShortUrl?: string;
    amount: number;
    currency: string;
    paymentNumber: number;
    method?: string;
  }
): Promise<IInvoice> {
  const parentInvoice = await Invoice.findById(parentInvoiceId);
  if (!parentInvoice) {
    throw new Error("Parent invoice not found");
  }

  const invoice = await Invoice.create({
    invoiceType: "recurring",
    status: "paid",
    organizationId: parentInvoice.organizationId,
    sellerId: parentInvoice.sellerId,
    userId: parentInvoice.userId,
    customerEmail: parentInvoice.customerEmail,
    customerName: parentInvoice.customerName,
    lineItems: parentInvoice.lineItems,
    subtotal: paymentData.amount,
    discount: 0,
    tax: 0,
    shippingCost: 0,
    totalAmount: paymentData.amount,
    itemCurrency: parentInvoice.itemCurrency,
    paymentCurrency: paymentData.currency,
    paymentMethodCategory: parentInvoice.paymentMethodCategory,
    paymentPlatform: parentInvoice.paymentPlatform,
    razorpayPaymentId: paymentData.razorpayPaymentId,
    razorpaySubscriptionId: paymentData.razorpaySubscriptionId,
    razorpayInvoiceId: paymentData.razorpayInvoiceId,
    invoiceShortUrl: paymentData.invoiceShortUrl,
    paidAt: new Date(),
    isRecurring: true,
    recurringPeriod: parentInvoice.recurringPeriod,
    recurringPaymentNumber: paymentData.paymentNumber,
    parentInvoiceId: parentInvoice._id,
    subscriptionRef: parentInvoice.subscriptionRef,
    referralId: parentInvoice.referralId,
    metadata: {
      ...parentInvoice.metadata,
      method: paymentData.method,
    },
  });

  console.log(
    `[Invoice] Created recurring invoice ${invoice.invoiceNumber} (payment #${paymentData.paymentNumber}) for parent ${parentInvoice.invoiceNumber}`
  );

  return invoice;
}

/**
 * Get available payment options based on the buyer's region + platform
 * config. Callers MUST resolve `isIndia` server-side via
 * `resolveBuyerGstRegion` (same helper GST uses) — do NOT trust an
 * FE-passed `country` param here. See the `/payment-options` route
 * handler in routes/invoice.ts for the wiring.
 *
 * India-only rules baked in:
 *   • UPI method surfaces ONLY for Indian buyers.
 *   • Crypto method is STRIPPED for Indian buyers (regulatory / tax
 *     reasons). Same signal as GST — a buyer counted as Indian for GST
 *     is counted as Indian here too.
 */
export function getPaymentOptions(opts: {
  isIndia: boolean;
}): PaymentOptionsResult {
  const { isIndia } = opts;
  // Crypto tab shows whenever the in-house poller has at least one
  // (chain, coin) fully configured (platform address env var populated)
  // AND the buyer is NOT in India. The legacy NOWPAYMENTS_API_KEY no
  // longer gates this — the FE has moved off the hosted NOWPayments
  // checkout to the in-house Tron/Polygon/BSC pipeline. NOWPayments
  // code stays as a dormant rollback.
  const cryptoEnabled = !isIndia && getConfiguredChains().length > 0;

  // CAD / EUR / GBP: card via Stripe, nothing else — no wallet (vaults are
  // USD), no UPI, no crypto. Offered to every buyer, Indian ones included:
  // the Stripe India account refuses non-INR charges on Indian-ISSUED cards
  // ("Non-INR transactions in India require a card issued outside India"),
  // but that is a property of the card, not the buyer's address — an
  // Indian buyer with a foreign card pays fine, and the FE labels the tile
  // "International cards only". Requires Stripe — no Razorpay fallback.
  const extraCardCurrencies: string[] = stripeEnabled
    ? [...EXTRA_PAYMENT_CURRENCIES]
    : [];
  const cardOnlyStripe = [
    {
      category: "card" as PaymentMethodCategory,
      platforms: [{ id: "stripe" as PaymentPlatform, name: "Stripe", enabled: true }],
      enabled: true,
    },
  ];

  const methods: PaymentOptionsResult["methods"] = {
      USD: [
        {
          category: "card",
          // Cards always route through Stripe now — same for USD and
          // INR (see the INR block below). Razorpay is kept as a
          // dormant fallback (enabled only when Stripe is unconfigured)
          // so the payment surface stays functional if the Stripe
          // creds ever go missing.
          platforms: [
            ...(stripeEnabled
              ? [{ id: "stripe" as PaymentPlatform, name: "Stripe", enabled: true }]
              : []),
            { id: "razorpay" as PaymentPlatform, name: "RazorPay", enabled: !stripeEnabled },
          ],
          enabled: true,
        },
        {
          category: "wallet",
          // Store Vault only. The Affiliate Vault was removed as a payment
          // source (19 Sep 2026) — pay-with-wallet refuses it too. Earnings
          // reach purchases by transferring to the Store Vault first.
          platforms: [
            { id: "store_wallet", name: "Store Vault", enabled: true },
          ],
          enabled: true,
        },
        // Crypto card omitted entirely for Indian buyers — cleaner than
        // sending `enabled: false` (the FE filters on truthy `enabled`,
        // but omission is unambiguous).
        ...(cryptoEnabled
          ? [
              {
                category: "crypto" as PaymentMethodCategory,
                platforms: [
                  { id: "crypto_wallet" as PaymentPlatform, name: "NOWPayments", enabled: true },
                ],
                enabled: true,
              },
            ]
          : []),
      ],
      INR: [
        {
          category: "card",
          // Cards for INR now route through Stripe (India account) —
          // same SetupIntent + off-session PaymentIntent flow already
          // used for USD, so the save-card + reuse path Just Works
          // without Razorpay's `token.confirmed` webhook onboarding.
          // Stripe listed FIRST so `platforms.find(p => p.enabled)`
          // in the FE picks it as the default. Razorpay kept as a
          // fallback (disabled by default — set enabled:true if the
          // Stripe India account is ever suspended and we need a
          // hot-swap without a code deploy).
          platforms: [
            ...(stripeEnabled
              ? [{ id: "stripe" as PaymentPlatform, name: "Stripe", enabled: true }]
              : []),
            { id: "razorpay" as PaymentPlatform, name: "RazorPay", enabled: !stripeEnabled },
          ],
          enabled: true,
        },
        ...(isIndia
          ? [
              {
                category: "upi" as PaymentMethodCategory,
                // UPI stays on Razorpay — Stripe India's UPI coverage
                // is limited vs Razorpay's full VPA/QR/intent support.
                platforms: [
                  { id: "razorpay" as PaymentPlatform, name: "RazorPay", enabled: true },
                ],
                enabled: true,
              },
            ]
          : []),
        // Same omission rule as the USD block — cryptoEnabled is already
        // false for Indian buyers.
        ...(cryptoEnabled
          ? [
              {
                category: "crypto" as PaymentMethodCategory,
                platforms: [
                  { id: "crypto_wallet" as PaymentPlatform, name: "NOWPayments", enabled: true },
                ],
                enabled: true,
              },
            ]
          : []),
      ],
  };
  // Appended AFTER USD/INR on purpose: the FE sniffs crypto availability
  // from the FIRST currency's method list, and these card-only entries
  // carry no crypto row — putting them first made the crypto tile vanish.
  for (const c of extraCardCurrencies) methods[c] = cardOnlyStripe;

  return {
    currencies: ["USD", "INR", ...extraCardCurrencies],
    methods,
  };
}

/**
 * Expire stale invoices that have been in draft or pending status for too long.
 * Intended to be called from a daily cron job.
 */
export async function expireStaleInvoices(): Promise<number> {
  const result = await Invoice.updateMany(
    {
      status: { $in: ["draft", "pending"] },
      expiresAt: { $lte: new Date() },
    },
    {
      $set: { status: "expired" },
    }
  );

  const count = result.modifiedCount || 0;
  if (count > 0) {
    console.log(`[Invoice] Expired ${count} stale invoices`);
  }
  return count;
}

/**
 * Fetch an invoice by ID.
 */
/**
 * Fetch an invoice by either its MongoDB _id or its invoiceNumber (e.g., INV-MNIQ04RQ-0EAY).
 */
export async function getInvoice(idOrNumber: string): Promise<IInvoice | null> {
  // Try ObjectId first
  if (Types.ObjectId.isValid(idOrNumber)) {
    const byId = await Invoice.findById(idOrNumber);
    if (byId) return byId;
  }
  // Fall back to invoice number lookup
  return Invoice.findOne({ invoiceNumber: idOrNumber });
}

/**
 * List invoices for a user within an organization.
 */
export async function listUserInvoices(
  userId: string,
  options?: {
    organizationId?: string;
    status?: string;
    invoiceType?: "one_time" | "recurring";
    limit?: number;
    skip?: number;
  }
): Promise<{ invoices: IInvoice[]; total: number }> {
  const query: any = { userId: new Types.ObjectId(userId) };

  if (options?.organizationId) {
    query.organizationId = new Types.ObjectId(options.organizationId);
  }
  if (options?.status) {
    query.status = options.status;
  }
  if (options?.invoiceType) {
    query.invoiceType = options.invoiceType;
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .sort({ createdAt: -1 })
      .limit(options?.limit || 20)
      .skip(options?.skip || 0)
      .lean(),
    Invoice.countDocuments(query),
  ]);

  return { invoices: invoices as IInvoice[], total };
}

/**
 * Get upcoming/pending invoices for a user.
 * For recurring subscriptions, generates a "due soon" invoice 5 days before the next charge date.
 * Returns both existing pending invoices and projected upcoming ones.
 */
export async function getUpcomingInvoices(
  userId: string,
  organizationId?: string
): Promise<IInvoice[]> {
  const now = new Date();
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  // 1. Get any existing pending/draft/failed invoices.
  //    `failed` is retryable — selectPaymentMethod (line ~836) resets
  //    it back to draft and clears the failure trace on the next pay
  //    attempt, so the user needs to see it in the pending list to
  //    click "Pay Now" again. Excluding it here (and only surfacing
  //    the failure on the standalone /invoice/:id page) stranded users
  //    on OrdersPage — they saw "failed" in history but no retry CTA.
  const pendingQuery: any = {
    userId: new Types.ObjectId(userId),
    status: { $in: ["draft", "pending", "failed"] },
  };
  if (organizationId) {
    pendingQuery.organizationId = new Types.ObjectId(organizationId);
  }
  const pendingInvoices = await Invoice.find(pendingQuery)
    .sort({ createdAt: -1 })
    .lean();

  // 2. Find recurring parent invoices (paid) that have active subscriptions
  //    to generate upcoming "due soon" projections
  const recurringQuery: any = {
    userId: new Types.ObjectId(userId),
    isRecurring: true,
    status: "paid",
    parentInvoiceId: { $exists: false }, // Only parent invoices
    razorpaySubscriptionId: { $exists: true, $ne: null },
    cancelledAt: { $in: [null, undefined] },
  };
  if (organizationId) {
    recurringQuery.organizationId = new Types.ObjectId(organizationId);
  }
  const parentInvoices = await Invoice.find(recurringQuery).lean();

  const upcomingProjections: any[] = [];

  for (const parent of parentInvoices) {
    // Find the latest recurring invoice for this subscription
    const latestChild = await Invoice.findOne({
      parentInvoiceId: parent._id,
    })
      .sort({ recurringPaymentNumber: -1 })
      .lean();

    // Estimate the next charge date based on recurring period
    const lastPaidAt = latestChild?.paidAt || parent.paidAt || parent.createdAt;
    const nextChargeDate = getNextChargeDate(
      lastPaidAt,
      parent.recurringPeriod || "monthly"
    );

    // Only show if within 5 days
    if (nextChargeDate <= fiveDaysFromNow) {
      // Check if we already have a pending invoice for this subscription
      const alreadyPending = pendingInvoices.some(
        (inv) =>
          inv.razorpaySubscriptionId === parent.razorpaySubscriptionId &&
          ["draft", "pending"].includes(inv.status)
      );

      if (!alreadyPending) {
        const nextPaymentNumber = latestChild
          ? (latestChild.recurringPaymentNumber || 0) + 1
          : (parent.recurringPaymentNumber || 0) + 1;

        upcomingProjections.push({
          _id: `upcoming_${parent._id}_${nextPaymentNumber}`,
          invoiceNumber: `UPCOMING`,
          invoiceType: "recurring",
          status: "upcoming", // Virtual status — not in DB
          organizationId: parent.organizationId,
          sellerId: parent.sellerId,
          userId: parent.userId,
          customerEmail: parent.customerEmail,
          customerName: parent.customerName,
          lineItems: parent.lineItems,
          subtotal: parent.subtotal,
          discount: 0,
          tax: parent.tax,
          shippingCost: 0,
          totalAmount: parent.totalAmount,
          itemCurrency: parent.itemCurrency,
          paymentCurrency: parent.paymentCurrency || parent.itemCurrency,
          isRecurring: true,
          recurringPeriod: parent.recurringPeriod,
          recurringPaymentNumber: nextPaymentNumber,
          parentInvoiceId: parent._id,
          razorpaySubscriptionId: parent.razorpaySubscriptionId,
          dueDate: nextChargeDate,
          createdAt: now,
          updatedAt: now,
          // The parent invoiceId the user can use to pay one-time
          _parentInvoiceId: parent._id.toString(),
        });
      }
    }
  }

  // Combine and sort: upcoming first (by due date), then pending (by created)
  return [
    ...upcomingProjections.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    ),
    ...(pendingInvoices as IInvoice[]),
  ];
}

// Re-exported for the many existing importers of this module.
export { addMonthsClamped };

/**
 * Calculate the next charge date based on the last payment date and period.
 *
 * `intervalMonths` supports multi-month terms (e.g. NetworkChain's 3/6/12-month
 * subscriptions) without adding new values to the `recurringPeriod` enum — that
 * enum is duplicated across ~8 backend spots plus the frontend, and the
 * `default:` branch below silently bills monthly, so a partial rollout of a new
 * enum value would mint a 6-month invoice due in one month.
 *
 * Deliberately gated on `>= 2`: `1` and `undefined` fall through to the legacy
 * switch untouched, so every existing caller is provably unchanged.
 */
export function getNextChargeDate(
  lastPaidAt: Date,
  period: string,
  intervalMonths?: number
): Date {
  if (typeof intervalMonths === "number" && intervalMonths >= 2) {
    return addMonthsClamped(lastPaidAt, intervalMonths);
  }

  const date = new Date(lastPaidAt);
  switch (period) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      // Loud and greppable, but NOT a throw — throwing here would break live
      // payment fulfillment for any row carrying a stale period string.
      console.warn(
        `[Invoice] getNextChargeDate: unknown period "${period}" — falling back to +1 month`
      );
      date.setMonth(date.getMonth() + 1);
  }
  return date;
}

/**
 * How many months one billing cycle of this invoice covers.
 *
 * `recurringIntervalMonths` is authoritative when present; otherwise derive it
 * from the coarse period label so pre-term invoices keep working. Returns 0 for
 * weekly, which is not month-based — callers doing month math must guard.
 */
export function intervalMonthsFor(inv: {
  recurringIntervalMonths?: number;
  recurringPeriod?: string;
}): number {
  if (inv.recurringIntervalMonths && inv.recurringIntervalMonths >= 1) {
    return inv.recurringIntervalMonths;
  }
  switch (inv.recurringPeriod) {
    case "quarterly":
      return 3;
    case "yearly":
      return 12;
    case "weekly":
      return 0;
    default:
      return 1;
  }
}

/**
 * Best-fit `recurringPeriod` label for a term length. 6 has no enum slot and
 * labels as "monthly" — `recurringIntervalMonths` is the authority for it.
 */
export function periodLabelFor(
  termMonths: number
): "monthly" | "quarterly" | "yearly" {
  if (termMonths === 3) return "quarterly";
  if (termMonths === 12) return "yearly";
  return "monthly";
}

// ============ Fulfillment ============

/**
 * Fulfill an invoice based on item type.
 * Called after payment is verified. Handles commissions + item-specific fulfillment.
 * Also updates nextDueDate for recurring invoices (our-managed billing cycle).
 */
export async function fulfillInvoice(
  invoice: any,
  razorpayPaymentId: string
): Promise<any> {
  const primaryItem = invoice.lineItems[0];
  if (!primaryItem) return null;

  // The buyer's invoice. Placed FIRST and fire-and-forget so it is unaffected
  // by anything below: fulfilment does a lot of chained work (subscriptions,
  // commissions, next-cycle generation) and any of it throwing must not cost
  // the buyer their receipt. Claimed atomically inside, so the repeated calls
  // this function gets from webhook/browser races still send exactly one.
  //
  // Distinct from queueOrderEmail below/elsewhere: that one is the SELLER's
  // branded confirmation and only fires if they configured a template.
  void import("./invoiceEmail").then(({ queueInvoiceEmail }) =>
    queueInvoiceEmail(invoice)
  );

  // The SELLER's "someone joined" alert, for the item types that carry a
  // `founderAlerts` toggle (community, course, product, live stream, service,
  // event). Placed here rather than in the per-type switch below so a new
  // payment path cannot forget it, and fire-and-forget for the same reason the
  // buyer's invoice is: fulfilment does a lot of chained work and none of it
  // should be able to swallow the notification — or vice versa.
  //
  // No-ops on invoices for anything without the toggle, and de-dupes on the
  // invoice itself, so the repeated calls this function gets from
  // webhook/browser races still send exactly one.
  void import("./founderAlertEmail").then(({ queueFounderAlertForInvoice }) =>
    queueFounderAlertForInvoice(invoice)
  );

  // Counter bills (Garage IRL "New bill") track their invoice's payment. Same
  // placement and reasoning as the two hooks above: every payment path comes
  // through here, and it must neither block nor be blocked by fulfilment. The
  // hook only re-reads the invoice, so repeated calls are harmless.
  if (invoice.metadata?.counterBillId) {
    void import("./counterBill")
      .then(({ onInvoicePaid }) => onInvoicePaid(invoice))
      .catch((err) =>
        console.error(`[Invoice] counter bill sync failed for ${invoice.invoiceNumber}:`, err)
      );
  }

  // Bat246 POD invite — flips "Remind" → "Ready to place on board" the
  // instant this specific product is paid for, regardless of payment method
  // (this fulfillInvoice() call is the shared choke point for all of them).
  // Non-fatal: a failure here must never block the actual purchase/receipt.
  if (primaryItem.itemId?.toString() === "6a7236f5e76fd9817e7238d9" && invoice.userId) {
    try {
      const { markPodPurchaseCompleted } = await import("../bat246/services/bat246PodInvite.service");
      await markPodPurchaseCompleted(invoice.userId.toString());
    } catch (err) {
      console.error("[bat246-pod] markPodPurchaseCompleted failed:", err);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // On-payment chain trigger for recurring invoices.
  //
  // Fire-and-forget (with a .catch) so a generation failure NEVER breaks
  // the payment fulfillment path. The same `generateNextChildInvoice`
  // function is also called by the daily cron as a safety net — its
  // built-in idempotency check on (parentInvoiceId, recurringPaymentNumber)
  // means both paths can fire safely without duplicating children.
  //
  // Handles three shapes:
  //   - PARENT invoice paid (cycle 1): parent === invoice; we generate cycle 2.
  //   - CHILD invoice paid (cycle N ≥ 2): look up parent via parentInvoiceId,
  //     generate cycle N+1.
  //   - Non-recurring invoice paid: function returns null at the top.
  //
  // This shifts next-cycle visibility from "5 days before due" (cron
  // window) to "immediately after payment" — same total invoices over a
  // year, same due dates, just earlier in the dashboard.
  // ──────────────────────────────────────────────────────────────────
  //
  // Free-plan carve-out: the office_free_plan (Starter) child is created
  // with childTotalAmount = 0 and immediately auto-paid inside
  // generateNextChildInvoice's zero-pay branch — which then calls this
  // fulfillInvoice, which would re-trigger generateNextChildInvoice, which
  // would mint cycle N+2 (also zero) and cascade forever. The scheduled
  // cron already mints one child per cycle when nextDueDate lands; the
  // on-payment trigger is the extra one we suppress.
  const isFreePlanCycle =
    (invoice.metadata as any)?.kind === "office_free_plan";
  if (invoice.isRecurring && !isFreePlanCycle) {
    (async () => {
      try {
        const parent = invoice.parentInvoiceId
          ? await Invoice.findById(invoice.parentInvoiceId)
          : invoice;
        if (!parent) return;
        await generateNextChildInvoice(parent as IInvoice);
      } catch (err) {
        console.error(
          `[Invoice] On-payment chain trigger failed for ${invoice.invoiceNumber}:`,
          err
        );
      }
    })();
  }

  const orgId = invoice.organizationId.toString();
  const userId = invoice.userId.toString();
  const sellerId = invoice.sellerId.toString();

  // Distribute commissions for paid items.
  // Skip:
  //   - unilevel_plus / third_party_subscription — own distributors in switch below
  //   - ecommerce_item — per-line distribution inside the ecommerce_item case
  //     (uses each line's own orgId/sellerId, not the invoice's primary)
  //
  // saleAmount = PRE-TAX, PRE-APPLE-FEE base. Comp on the GST-inflated total
  // would over-pay affiliates by ~18% (GST is the government's, not the
  // seller's). Apple's 30% is similarly carved out — Apple already kept it
  // on the iOS side; the seller never sees it, so neither should comp.
  const appleFeeCents = ((invoice.metadata as any)?.appleFee?.amount as number) || 0;
  const saleAmount =
    (invoice.subtotal - (invoice.discount || 0) - appleFeeCents) / 100;
  if (
    saleAmount > 0 &&
    primaryItem.itemType !== "unilevel_plus" &&
    primaryItem.itemType !== "third_party_subscription" &&
    primaryItem.itemType !== "ecommerce_item" &&
    primaryItem.itemType !== "bat246_membership" &&
    // Franchise subscriptions are platform fees / territory sales, not
    // marketplace sales — they have their own fulfilment cases below.
    primaryItem.itemType !== "franchise_program" &&
    primaryItem.itemType !== "franchise_territory" &&
    primaryItem.itemType !== "franchise_global" &&
    // Auction Wallet top-ups are the buyer funding their own balance, not a
    // sale. Running distributeCommissions here would credit the "seller" the
    // full principal and mint money out of nothing.
    primaryItem.itemType !== "auction_wallet_topup" &&
    // Whitelabel add-on has a bespoke L1-only 50% commission handled by
    // chargeReferralCommission (whitelabelAddonPurchase.ts), not the
    // multi-level CombPlan cascade. Skipping default commission avoids
    // double-paying and avoids CombPlan resolution against a virtual
    // item that has no plan doc.
    primaryItem.itemType !== "whitelabel_addon" &&
    // Cryptosub — same reasoning as whitelabel_addon. Its own bespoke
    // 3-bucket commission lives in cryptosubAddonPurchase.ts.
    primaryItem.itemType !== "cryptosub" &&
    // HiFi investment — the hifi seller app + our fulfillment
    // handler own the money flow (escrow into founder-org wallet on
    // pay; the seller app runs its own affiliate/payout logic). No
    // CombPlan cascade here.
    primaryItem.itemType !== "hifi_investment" &&
    // B2 Coins are a non-monetary internal currency (and a Snap Back Loan
    // is just borrowed coins, spent the same way) — no real wallet should
    // be credited for a coin-funded purchase. payEntryProductWithB2Coins()
    // (bat246Layaway.service.ts) sets this flag instead of
    // paymentPlatform/paymentMethodCategory — neither enum has a value
    // that means "B2 Coins" (see that function's own doc comment).
    !(invoice.metadata as any)?.paidWithB2Coins
  ) {
    try {
      // An event ticket's line item points at the TIER, but the affiliate plan
      // is set on the event as a whole — a founder configures commission once,
      // not per Early-bird/VIP row. Remap so CombPlan(itemType:"event",
      // itemId:<eventId>) resolves; every other type passes through.
      const commissionItemType =
        primaryItem.itemType === "event_ticket"
          ? "event"
          : primaryItem.itemType;
      const commissionItemId =
        primaryItem.itemType === "event_ticket" &&
        (invoice.metadata as any)?.eventId
          ? String((invoice.metadata as any).eventId)
          : primaryItem.itemId.toString();

      await distributeCommissions({
        orgId,
        sellerId,
        customerId: userId,
        itemType: commissionItemType as any,
        itemId: commissionItemId,
        itemName: primaryItem.itemName,
        saleAmount,
        // `saleAmount` is `invoice.totalAmount / 100`, which is always in
        // `itemCurrency` units. Wallet payments overwrite `paymentCurrency`
        // to "USD" (because wallets are USD-denominated) but the underlying
        // sale was still priced in `itemCurrency`. Using paymentCurrency here
        // made the converter skip INR→USD conversion for wallet-paid INR
        // invoices, leaving commissions ~84× too large. (Bug fixed 2026-05.)
        currency: invoice.itemCurrency,
        paymentId: razorpayPaymentId,
        isRecurringPayment: invoice.isRecurring && (invoice.recurringPaymentNumber || 0) > 1,
        recurringPaymentNumber: invoice.recurringPaymentNumber,
        metadata: {
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          source: "invoice_checkout",
          // Founder-franchise programs attribute commission by BUYER location.
          // Prefer the invoice's shipping/billing address; commission.ts falls
          // back to the buyer's User profile when this is null.
          buyerAddress: resolveBuyerAddress(invoice, null),
        },
      });

      invoice.commissionDistributed = true;
      await invoice.save();
    } catch (commissionError) {
      console.error(
        `[Invoice] Commission distribution error for ${invoice.invoiceNumber}:`,
        commissionError
      );
    }
  }

  // ── GST collected → Shorupan's HQ store wallet ──────────────────────
  // For every paid invoice that carries GST (invoice.tax > 0), credit
  // shorupan@gmail.com's StoreWallet on the platform org with the GST
  // amount as a SEPARATE WalletTransaction labeled "GST collected ...".
  // This gives a clean offline-remittance ledger. Idempotent on
  // (kind="gst_collected", invoiceId) so re-runs of fulfillInvoice never
  // double-credit.
  if ((invoice.tax || 0) > 0) {
    try {
      const { User } = await import("../models/user.model");
      const { StoreWallet } = await import("../models/storeWallet.model");
      const { WalletTransaction } = await import(
        "../models/walletTransaction.model"
      );
      const { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } = await import(
        "./commission"
      );

      const taxCents = invoice.tax || 0;
      const taxUsd = taxCents / 100;

      const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
        .select("_id")
        .lean();
      if (platformUser) {
        const platformOrg = new Types.ObjectId(PLATFORM_ORG_ID);

        const alreadyCredited = await WalletTransaction.findOne({
          userId: platformUser._id,
          orgId: platformOrg,
          walletType: "store",
          type: "credit",
          "metadata.kind": "gst_collected",
          "metadata.invoiceId": invoice._id.toString(),
        }).lean();

        if (!alreadyCredited) {
          let storeWallet = await StoreWallet.findOne({
            userId: platformUser._id,
            orgId: platformOrg,
          });
          if (!storeWallet) {
            storeWallet = await StoreWallet.create({
              userId: platformUser._id,
              orgId: platformOrg,
              balance: 0,
              currency: "USD",
            });
          }
          const balanceBefore = storeWallet.balance;
          const balanceAfter = Math.round((balanceBefore + taxUsd) * 100) / 100;
          storeWallet.balance = balanceAfter;
          storeWallet.lastTransactionAt = new Date();
          await storeWallet.save();

          const gst = (invoice.metadata as any)?.gst || {};
          const itemName = invoice.lineItems?.[0]?.itemName || "(unknown)";
          await WalletTransaction.create({
            storeWalletId: storeWallet._id,
            walletType: "store",
            userId: platformUser._id,
            orgId: platformOrg,
            type: "credit",
            amount: taxUsd,
            currency: "USD",
            balanceBefore,
            balanceAfter,
            description: `GST collected — ${itemName}`,
            status: "completed",
            metadata: {
              kind: "gst_collected",
              invoiceId: invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
              itemType: invoice.lineItems?.[0]?.itemType,
              itemId: invoice.lineItems?.[0]?.itemId?.toString(),
              gstRate: gst.rate,
              sacCode: gst.sacCode,
              taxAmountInItemCurrency: taxCents,
              itemCurrency: invoice.itemCurrency,
            },
          });
          console.log(
            `[Invoice] GST $${taxUsd.toFixed(2)} → ${PLATFORM_USER_EMAIL} (invoice ${invoice.invoiceNumber})`
          );
        }
      }
    } catch (gstCreditErr) {
      console.error(
        `[Invoice] GST credit to platform wallet failed for ${invoice.invoiceNumber}:`,
        gstCreditErr
      );
      // Non-blocking — comp already distributed, fulfillment continues.
    }
  }

  // Update nextDueDate for our-managed recurring invoices
  if (invoice.isRecurring && !invoice.razorpaySubscriptionId) {
    const period = invoice.recurringPeriod || "monthly";
    // Advance by THIS invoice's own cycle length. Without the interval a
    // 6-month subscription's root would advance one month and the cron would
    // mint the next cycle five months early.
    const newNextDueDate = getNextChargeDate(
      new Date(),
      period,
      intervalMonthsFor(invoice)
    );

    // Update on this invoice (if it's the parent) or on the parent
    if (invoice.parentInvoiceId) {
      await Invoice.findByIdAndUpdate(invoice.parentInvoiceId, {
        nextDueDate: newNextDueDate,
      });
    } else {
      invoice.nextDueDate = newNextDueDate;
      await invoice.save();
    }
  }

  // Evaluate purchase-based coupon rules — best-effort, never block fulfillment
  try {
    const { evaluateRulesForInvoice } = await import("./couponRule");
    await evaluateRulesForInvoice(invoice);
  } catch (ruleErr) {
    console.error(
      `[Invoice] coupon rule evaluation failed for ${invoice.invoiceNumber}:`,
      ruleErr
    );
  }

  // Evaluate store cascade commissions — cascading coupon grants up
  // the buyer's upline chain for ecommerce_item sales. Best-effort,
  // never blocks fulfillment. Own service swallows internal errors;
  // outer try/catch is belt-and-braces against import failure.
  try {
    const { evaluateStoreCommissionsForInvoice } = await import(
      "./storeCouponCommission"
    );
    await evaluateStoreCommissionsForInvoice(invoice);
  } catch (cascadeErr) {
    console.error(
      `[Invoice] store commission evaluation failed for ${invoice.invoiceNumber}:`,
      cascadeErr,
    );
  }

  // Record platform-coupon redemption on payment success for ECOMMERCE
  // invoices. Unlike the regular createInvoice path (which redeems at invoice
  // creation), createEcommerceInvoice does not — so coupon usage counts,
  // per-user limits, and the founder Redemptions view all depend on this.
  // Recording here (on payment) avoids consuming a use on an abandoned draft.
  // redeemPlatformCoupon is idempotent (keyed on invoiceId); scoped to
  // ecommerce so the regular path is untouched.
  if (invoice.couponId && (invoice.metadata as any)?.flavor === "ecommerce") {
    try {
      const { getPlatformCouponById, redeemPlatformCoupon, redemptionScopeFor } = await import(
        "./platformCoupon"
      );
      const coupon = await getPlatformCouponById(invoice.couponId.toString());
      if (coupon) {
        await redeemPlatformCoupon({
          coupon,
          userId: invoice.userId.toString(),
          productType: coupon.productType,
          // Ecommerce is one-time, so this resolves to `invoiceId` — but go
          // through the shared rule anyway, so a future recurring ecommerce
          // item cannot quietly inherit the wrong scope.
          ...redemptionScopeFor(coupon, invoice),
        });
      }
    } catch (redeemErr) {
      console.error(
        `[Invoice] ecommerce coupon redeem failed for ${invoice.invoiceNumber}:`,
        redeemErr
      );
    }
  }

  // Cashback execution — fires only when invoice.cashbackCodeId is stamped
  // (i.e., the buyer's input code resolved to a CashbackCode, not a
  // PlatformCoupon). Runs after distributeCommissions so the level-1 rate
  // it reads off the CD is the real, post-distribution number. Never throws;
  // failures land as CashbackDistribution rows with status="failed".
  try {
    const { executeCashback } = await import("./cashbackCode");
    await executeCashback(invoice);
  } catch (cashbackErr) {
    console.error(
      `[Invoice] cashback execution failed for ${invoice.invoiceNumber}:`,
      cashbackErr
    );
  }

  // Item-specific fulfillment
  switch (primaryItem.itemType) {
    case "ecommerce_item": {
      // Multi-HQ ecommerce flow:
      //   1. Atomic inventory decrement per line on storeproducts
      //   2. One productorders doc per orgId (each store sees its own order)
      //   3. Per-line commission distribution against each line's seller chain
      // Idempotent: if metadata.fulfillment.orders is set, skip recreation.
      if (invoice.metadata?.fulfillment?.orders) {
        return {
          type: "ecommerce",
          orders: invoice.metadata.fulfillment.orders,
          alreadyFulfilled: true,
        };
      }

      const { StoreProduct } = await import("../models/storeProduct.model");
      const { ProductVariant } = await import("../models/productVariant.model");
      const { ProductOrder } = await import("../models/productOrder.model");
      // Read-only mirror of the store backend's `storedrops` collection (same
      // DB), used to authoritatively resolve a drop-driven line's creator.
      const { StoreDrop } = await import("../models/storeDrop.model");

      // 1) Inventory decrement. For variant lines the real stock lives on the
      // ProductVariant doc (the parent storeproducts.quantity is just a seed),
      // so decrement the variant when variantId is present, else the parent.
      // The conditional $or guard is identical in both cases: skip the gate
      // when trackInventory isn't on, otherwise only decrement if enough stock
      // remains (paid invoices continue on shortfall — just logged).
      const inventoryAdjustments: Array<{
        productId: string;
        variantId?: string;
        delta: number;
        succeeded: boolean;
      }> = [];
      for (const li of invoice.lineItems as any[]) {
        // Amount-only and charge lines (counter bills) aren't stock — their
        // itemId is the bill, not a storeproduct.
        if (li.lineKind) continue;
        const stockGuard = {
          $or: [
            { trackInventory: { $ne: true } },
            { quantity: { $gte: li.quantity } },
          ],
        };
        try {
          const updated = li.variantId
            ? await ProductVariant.findOneAndUpdate(
                { _id: li.variantId, ...stockGuard },
                { $inc: { quantity: -li.quantity } },
                { new: true }
              )
            : await StoreProduct.findOneAndUpdate(
                { _id: li.itemId, ...stockGuard },
                { $inc: { quantity: -li.quantity } },
                { new: true }
              );
          inventoryAdjustments.push({
            productId: String(li.itemId),
            variantId: li.variantId ? String(li.variantId) : undefined,
            delta: -li.quantity,
            succeeded: !!updated,
          });
          if (!updated) {
            console.warn(
              `[Invoice] Inventory shortfall during fulfillment for invoice ${invoice.invoiceNumber}, ${li.variantId ? `variant ${li.variantId}` : `product ${li.itemId}`} — invoice already paid, continuing.`
            );
          }
        } catch (err) {
          console.error(
            `[Invoice] Inventory decrement error for ${li.variantId || li.itemId}:`,
            err
          );
        }
      }

      // 2) One productorders doc per orgId
      const groupedByOrg = new Map<string, any[]>();
      for (const li of invoice.lineItems as any[]) {
        const ogId = String(li.organizationId || invoice.organizationId);
        if (!groupedByOrg.has(ogId)) groupedByOrg.set(ogId, []);
        groupedByOrg.get(ogId)!.push(li);
      }

      // Per-product requiresShipping snapshot was stored on the invoice
      // metadata at create time (see createEcommerceInvoice). Fall back to
      // `true` for any line not present in the snapshot — safer to ask the
      // seller to confirm a shipping address than to silently drop one.
      const requiresShippingByProduct =
        (invoice.metadata?.requiresShippingByProductId as
          | Record<string, boolean>
          | undefined) || {};

      // Invoice line amounts are stored in itemCurrency (the buyer's display
      // currency). When the gateway settled in a different paymentCurrency
      // (e.g. USD-priced item paid via the INR gateway), the order must be
      // denominated in paymentCurrency — what the buyer actually paid — using
      // the exchange rate captured on the invoice. Both currencies use 1/100
      // minor units, so the major-unit rate applies directly to the minor-unit
      // integers (e.g. 10¢ × 95.74 = 957 paise = ₹9.57). Without conversion we
      // were stamping a paymentCurrency label onto itemCurrency amounts.
      const itemCur = invoice.itemCurrency;
      const payCur = invoice.paymentCurrency || invoice.itemCurrency;
      const conv = invoice.currencyConversion;
      const canConvert =
        payCur !== itemCur &&
        conv &&
        conv.fromCurrency === itemCur &&
        conv.toCurrency === payCur &&
        conv.exchangeRate > 0;
      if (payCur !== itemCur && !canConvert) {
        console.warn(
          `[Invoice] ${invoice.invoiceNumber}: paymentCurrency ${payCur} ≠ itemCurrency ${itemCur} but no usable currencyConversion — order amounts left in ${itemCur}.`
        );
      }
      const toPaymentCurrency = (amt: number): number => {
        if (!amt) return 0;
        return canConvert ? Math.round(amt * conv!.exchangeRate) : amt;
      };

      const orderRecords: Array<{ orgId: string; orderId: string }> = [];
      // Verified live-selling lines, keyed by line id — filled while the orders
      // are created below, read by the commission loop after it so the payout
      // rows carry the same session attribution as the order itself.
      const verifiedLiveLines = new Map<
        string,
        { workshopId: string; sessionDate: string }
      >();
      for (const [ogId, groupItems] of groupedByOrg.entries()) {
        const items = groupItems.map((li) => ({
          productId: li.itemId,
          variantId: li.variantId,
          productName: li.itemName,
          productImage: li.itemImage,
          quantity: li.quantity,
          unitPrice: toPaymentCurrency(li.unitPrice),
          totalPrice: toPaymentCurrency(li.totalPrice),
          isDigital: false,
          digitalAssets: [],
          digitalLinks: [],
        }));
        const subtotal = items.reduce(
          (s, it) => s + (it.totalPrice || 0),
          0
        );
        // Order requires shipping if any of its items requires shipping.
        const orderRequiresShipping = groupItems.some((li) => {
          const flag = requiresShippingByProduct[String(li.itemId)];
          return flag !== false;
        });
        // Drop attribution for the seller dashboard. The store backend mirrors
        // productorders into its Order collection, so this is what surfaces
        // "this was a drop sale, and whose drop" downstream. Client-reported
        // creator id is a hint; the paid creator is resolved separately below.
        const orderDrops = groupItems
          .filter((li) => li.dropProduct && li.dropId)
          .map((li) => ({
            productId: String(li.itemId),
            variantId: li.variantId ? String(li.variantId) : undefined,
            dropId: String(li.dropId),
            dropCreatorId: li.dropCreatorId ? String(li.dropCreatorId) : undefined,
            dropCreatorName: li.dropCreatorName || undefined,
          }));
        // Live-selling attribution. The client says "this came from session X";
        // we only believe it if that item really was pinned in that session
        // (WebinarProductPin), so a crafted checkout can't inflate a founder's
        // live-selling figures.
        const liveClaims = groupItems.filter(
          (li) => li.liveWorkshopId && li.liveSessionDate
        );
        const orderLiveSales: {
          productId: string;
          variantId?: string;
          workshopId: string;
          sessionDate: string;
        }[] = [];
        if (liveClaims.length) {
          const { WebinarProductPin } = await import(
            "../models/webinarProductPin.model"
          );
          for (const li of liveClaims) {
            const sessionDate = new Date(`${li.liveSessionDate}T00:00:00.000Z`);
            const pinned = await WebinarProductPin.exists({
              workshopId: li.liveWorkshopId,
              sessionDate,
              itemId: li.itemId,
            });
            if (!pinned) {
              console.warn(
                `[Invoice] live-selling claim rejected — ${String(li.itemId)} was not pinned in ${String(li.liveWorkshopId)} on ${li.liveSessionDate}`
              );
              continue;
            }
            orderLiveSales.push({
              productId: String(li.itemId),
              variantId: li.variantId ? String(li.variantId) : undefined,
              workshopId: String(li.liveWorkshopId),
              sessionDate: li.liveSessionDate as string,
            });
            verifiedLiveLines.set(
              `${String(li.itemId)}_${String(li.variantId ?? "")}`,
              {
                workshopId: String(li.liveWorkshopId),
                sessionDate: li.liveSessionDate as string,
              }
            );
          }
        }

        const order = await ProductOrder.create({
          orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          organizationId: new mongoose.Types.ObjectId(ogId),
          userId: invoice.userId,
          items,
          subtotal,
          discount: 0,
          tax: 0,
          shippingCost: 0,
          total: subtotal,
          currency: invoice.paymentCurrency || invoice.itemCurrency,
          status: "confirmed",
          paymentStatus: "paid",
          paymentMethod: invoice.paymentPlatform || "razorpay",
          paymentId: razorpayPaymentId,
          requiresShipping: orderRequiresShipping,
          shippingAddress: invoice.shippingAddress,
          // Per spec §3: billingAddress falls back to shippingAddress when
          // the buyer didn't supply a separate billing block at checkout.
          billingAddress: invoice.billingAddress ?? invoice.shippingAddress,
          paymentMode: invoice.paymentMode ?? "Prepaid",
          gstin: invoice.gstin,
          companyName: invoice.companyName,
          customerNote: invoice.customerNote,
          metadata: {
            flavor: "ecommerce",
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            // Counter bills know their outlet; the store backend's mirror reads
            // po.metadata.branchId to stamp the branch on the seller's order.
            ...(invoice.metadata?.branchId
              ? { branchId: invoice.metadata.branchId }
              : {}),
            ...(invoice.metadata?.counterBillId
              ? { counterBillId: invoice.metadata.counterBillId }
              : {}),
            ...(orderDrops.length
              ? { dropProduct: true, drops: orderDrops }
              : {}),
            ...(orderLiveSales.length
              ? { liveSelling: true, liveSales: orderLiveSales }
              : {}),
          },
        });
        orderRecords.push({ orgId: ogId, orderId: String(order._id) });
      }

      // 3) Per-line commission distribution
      // Pro-rate the invoice-level coupon discount across lines by each
      // line's share of subtotal — otherwise commission would be computed
      // on the pre-discount price and over-credit the seller/affiliate/
      // franchise chain. Matches the primary-item branch above which uses
      // (subtotal - discount) as its base.
      // Service charge / packaging lines (counter bills) are never discounted
      // (see previewEcommerceCart), so they're outside the pro-rata base.
      const invoiceSubtotal = (invoice.lineItems as any[]).reduce(
        (sum: number, li: any) =>
          li.lineKind === "charge" ? sum : sum + (li.totalPrice || 0),
        0
      );
      const invoiceDiscount = invoice.discount || 0;
      // Per-line commission failures are swallowed (a bad line must not abort
      // an already-paid invoice), so collect them and stamp them on the
      // invoice below — otherwise "the seller wasn't paid" leaves no trace
      // outside the logs.
      const commissionErrors: Array<{
        itemId: string;
        variantId?: string;
        error: string;
        at: string;
      }> = [];
      for (const [lineIndex, li] of (invoice.lineItems as any[]).entries()) {
        const lineOrg = String(li.organizationId || invoice.organizationId);
        const lineSeller = String(
          li.sellerId || li.organizationId || invoice.sellerId
        );
        const lineGross = li.totalPrice || 0;
        const lineDiscount =
          invoiceSubtotal > 0 && li.lineKind !== "charge"
            ? Math.round((lineGross / invoiceSubtotal) * invoiceDiscount)
            : 0;
        const lineSale = Math.max(0, lineGross - lineDiscount) / 100;
        if (lineSale <= 0) continue;

        // Drop-creator resolution. When the line came from a drop's "Buy now",
        // the creator earns a carve-out of this line's affiliate pool. We do
        // NOT trust the client-reported dropCreatorId for payment: resolve the
        // author from the storedrops doc, requiring it be published and bound
        // to this exact product. On any failure/mismatch we simply omit the
        // drop split and distribute the line normally.
        let resolvedDropCreatorId: string | undefined;
        let resolvedDropCreatorName: string | undefined;
        if (
          li.dropProduct &&
          li.dropId &&
          mongoose.Types.ObjectId.isValid(String(li.dropId))
        ) {
          try {
            const drop: any = await StoreDrop.findById(li.dropId)
              .select("authorId authorName productId status")
              .lean();
            if (
              drop &&
              drop.status === "published" &&
              String(drop.productId) === String(li.itemId)
            ) {
              const authorId = drop.authorId ? String(drop.authorId) : "";
              if (authorId && authorId !== String(userId)) {
                resolvedDropCreatorId = authorId;
                resolvedDropCreatorName = drop.authorName || undefined;
              } else {
                // Creator == buyer (self-purchase) or missing author — no split.
                console.log(
                  `[Invoice] Drop ${li.dropId}: creator missing or equals buyer; distributing line without drop split.`
                );
              }
            } else {
              console.log(
                `[Invoice] Drop ${li.dropId} not eligible (missing/unpublished/product mismatch); distributing line normally.`
              );
            }
          } catch (dropErr) {
            console.error(
              `[Invoice] Drop creator lookup failed for drop ${li.dropId}:`,
              dropErr
            );
          }
        }

        try {
          await distributeCommissions({
            orgId: lineOrg,
            sellerId: lineSeller,
            customerId: userId,
            // Use the existing combplan itemType "product" — admins create
            // CombPlan(itemType:"product", itemId: storeproducts._id, orgId: store.orgId).
            // No comb plan = graceful no-op.
            itemType: "product",
            itemId: String(li.itemId),
            // Per-variant comb plans override the product plan for this line.
            variantId: li.variantId ? String(li.variantId) : undefined,
            itemName: li.itemName,
            saleAmount: lineSale,
            // IMPORTANT: lineSale is in the invoice's ITEM currency (matches
            // li.totalPrice/li.originalCurrency). Passing paymentCurrency would
            // make convertToUsd inside distributeCommissions divide by the
            // wrong rate and silently shrink the credit. (Bug fixed 2026-05.)
            currency: li.originalCurrency || invoice.itemCurrency,
            // Scope the idempotency key by variant too, so two variants of the
            // same product in one cart don't collide on the (paymentId, itemId)
            // duplicate guard inside distributeCommissions.
            // Counter-bill custom/charge lines all carry the bill's id as
            // itemId, so they're keyed by kind + position as well — otherwise
            // the guard reads the second one as already paid and the seller
            // silently isn't credited for it.
            paymentId: `${razorpayPaymentId}_${String(li.itemId)}${
              li.variantId ? `_${String(li.variantId)}` : ""
            }${li.lineKind ? `_${li.lineKind}_${lineIndex}` : ""}`,
            isRecurringPayment: false,
            metadata: {
              invoiceId: invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
              source: "ecommerce_checkout",
              storeId: li.storeId ? String(li.storeId) : undefined,
              // Drop split: when resolved, distributeCommissions carves 25% of
              // this line's affiliate pool to the creator (75% stays on the
              // upline levels). Founder/platform cut is unchanged.
              ...(resolvedDropCreatorId
                ? {
                    dropCreatorId: resolvedDropCreatorId,
                    dropCreatorName: resolvedDropCreatorName,
                    dropId: String(li.dropId),
                    dropCreatorSplitPct: 25,
                  }
                : {}),
              // Live selling: same session attribution the order carries, so
              // the founder's per-session commission figure can be summed
              // straight off these rows.
              ...(verifiedLiveLines.get(
                `${String(li.itemId)}_${String(li.variantId ?? "")}`
              )
                ? {
                    liveWorkshopId: verifiedLiveLines.get(
                      `${String(li.itemId)}_${String(li.variantId ?? "")}`
                    )!.workshopId,
                    liveSessionDate: verifiedLiveLines.get(
                      `${String(li.itemId)}_${String(li.variantId ?? "")}`
                    )!.sessionDate,
                  }
                : {}),
            },
          });
        } catch (commissionError) {
          console.error(
            `[Invoice] Per-line commission distribution error for ${li.itemId}:`,
            commissionError
          );
          // Record it on the invoice as well as the log. A swallowed error
          // here means the SELLER WAS NOT PAID even though this function
          // returns success and sets commissionDistributed below — so the log
          // line was previously the only trace that anything went wrong.
          // Callers (and the auction diagnostics) read this array to tell a
          // real payout apart from a silent miss.
          commissionErrors.push({
            itemId: String(li.itemId),
            variantId: li.variantId ? String(li.variantId) : undefined,
            error:
              (commissionError as Error)?.message || String(commissionError),
            at: new Date().toISOString(),
          });
        }
      }

      // Stamp fulfillment record on invoice for idempotency.
      //
      // Note this is stamped even when commissionErrors is non-empty: the
      // ProductOrders above ARE created and carry a unique-sparse paymentId,
      // so re-running fulfillInvoice would collide rather than heal. Repairing
      // a missed payout means re-running the commission for that line only —
      // see the auction settlement repair path.
      invoice.metadata = {
        ...(invoice.metadata || {}),
        fulfillment: {
          flavor: "ecommerce",
          orders: orderRecords,
          inventoryAdjustments,
          fulfilledAt: new Date().toISOString(),
          ...(commissionErrors.length > 0 ? { commissionErrors } : {}),
        },
      };
      invoice.commissionDistributed = true;
      await invoice.save();

      return {
        type: "ecommerce",
        orders: orderRecords,
      };
    }

    case "product": {
      // "Buy to assign" → mint one reserve per unit instead of an order; the
      // buyer assigns each later (recipient gets a ProductOrder on assign).
      const forReserve = invoice.metadata?.forReserve === true;
      if (forReserve) {
        const { createItemReserves } = await import("./itemReserveLicense");
        let startSeq = 0;
        let total = 0;
        for (const item of invoice.lineItems as any[]) {
          const count = item.quantity || 1;
          const reserves = await createItemReserves({
            buyerId: userId,
            itemType: "product",
            itemId: item.itemId.toString(),
            itemName: item.itemName,
            itemImage: item.itemImage,
            organizationId: orgId,
            invoiceId: invoice._id.toString(),
            invoiceNumber: invoice.invoiceNumber,
            paymentId: razorpayPaymentId,
            count,
            startSeq,
            unitPrice: item.unitPrice || 0,
            currency: invoice.itemCurrency,
          });
          startSeq += count;
          total += reserves.length;
        }
        return { type: "product", flow: "reserves", reserveCount: total };
      }

      const orderData: any = {
        organizationId: orgId,
        userId,
        items: invoice.lineItems.map((item: any) => ({
          productId: item.itemId.toString(),
          quantity: item.quantity,
        })),
        paymentMethod: invoice.paymentPlatform || "razorpay",
        paymentId: razorpayPaymentId,
        // createOrder() has its own, separate distributeCommissions() call —
        // see its doc comment. Without this, a B2-coins/Snap-Back-Loan-paid
        // invoice (which correctly skips THIS file's own commission block
        // above via the paidWithB2Coins guard) still credited Alan's real
        // wallet through createOrder's independent call.
        skipCommission: !!(invoice.metadata as any)?.paidWithB2Coins,
      };
      // Carry every shipping / billing / B2B field forward to the order so
      // the seller dashboard + Shiprocket have everything in one doc. Spec
      // §3: "When an invoice creates child productorders, propagate the
      // same fields."
      if (invoice.shippingAddress) {
        orderData.shippingAddress = invoice.shippingAddress;
      }
      if (invoice.billingAddress) {
        orderData.billingAddress = invoice.billingAddress;
      } else if (invoice.shippingAddress) {
        // Default billingAddress to shippingAddress when not separately set.
        orderData.billingAddress = invoice.shippingAddress;
      }
      if (invoice.paymentMode) orderData.paymentMode = invoice.paymentMode;
      if (invoice.gstin) orderData.gstin = invoice.gstin;
      if (invoice.companyName) orderData.companyName = invoice.companyName;
      if (invoice.customerNote) orderData.customerNote = invoice.customerNote;
      // Only set requiresShipping when the invoice carries the snapshot
      // (currently only ecommerce-flow invoices do). For legacy product-case
      // invoices that pre-date the snapshot, we leave it to the
      // ProductOrder schema default (false) — same behaviour as before.
      if (invoice.metadata?.requiresShipping !== undefined) {
        orderData.requiresShipping = invoice.metadata.requiresShipping;
      }
      const order = await createProductOrder(orderData);
      const updatedOrder = await updatePaymentStatus(
        order._id.toString(),
        orgId,
        "paid",
        razorpayPaymentId
      );

      // bat246_entry product → run board placement logic
      try {
        const { Product: ProductModel } = await import("../models/product.model");
        const prod = await ProductModel.findById(primaryItem.itemId).select("tags").lean() as any;
        const isBat246Entry = Array.isArray(prod?.tags) && prod.tags.includes("bat246_entry");
        if (isBat246Entry) {
          const invoiceUser = await import("../models/user.model").then(m =>
            m.User.findById(userId).select("name email country").lean()
          ) as any;
          const uName = invoiceUser?.name || "";
          const uEmail = invoiceUser?.email || "";
          const meta = invoice.metadata || {};
          const { bat246BoardId, bat246Pos, bat246Ref, bat246UpperRef, bat246UpperRefPlayerId, bat246GenRef, bat246DugoutRef } = meta;

          const { Bat246Player } = await import("../bat246/models/bat246Player.model");
          const { createBat246Player } = await import("../bat246/services/bat246PlayerId.util");
          let player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) });
          if (!player) {
            player = await createBat246Player({ userId: new Types.ObjectId(userId), nickname: uName || uEmail, email: uEmail, memberSince: new Date() });
          }

          if (bat246BoardId && bat246Pos && bat246Ref) {
            const { Bat246Distributor: BD2 } = await import("../bat246/models/bat246Distributor.model");
            const { Bat246PendingPlacement } = await import("../bat246/models/bat246PendingPlacement.model");
            const { Bat246PositionReservation } = await import("../bat246/models/bat246PositionReservations.model");
            const { Bat246PlacementNotification: BPN2 } = await import("../bat246/models/bat246PlacementNotifications.model");
            // Do NOT set hasPurchasedProduct here — admin approval (placeUserFromReservation) sets it.
            await BD2.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { playerId: player._id, bat246RefUserId: new Types.ObjectId(bat246Ref) }, $setOnInsert: { isOfficeMember: false, isGarageAffiliate: false, hasBat246Membership: false, hasPurchasedProduct: false, isQualified: false } }, { upsert: true, setDefaultsOnInsert: false });
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await Bat246PendingPlacement.updateOne({ userId: new Types.ObjectId(userId), boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, isPlaced: false }, { $setOnInsert: { userId: new Types.ObjectId(userId), userName: uName, userEmail: uEmail, boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, refUserId: new Types.ObjectId(bat246Ref), purchasedAt: new Date(), expiresAt } }, { upsert: true });
            await Bat246PositionReservation.updateOne({ reservedByUserId: new Types.ObjectId(userId), status: "active" }, { $setOnInsert: { reservedByUserId: new Types.ObjectId(userId), reservedByEmail: uEmail, boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, status: "active", reservedAt: new Date(), expiresAt } }, { upsert: true });
            await BPN2.create({ notificationType: "placement", boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: uEmail, qualifiedUserName: uName, uplineUserId: new Types.ObjectId(bat246Ref) });
          } else {
            const { addAtBatFromPurchase, addFromUpperBaseInvite, addFromGenericInvite, addToDugoutFromPurchase } = await import("../bat246/services/bat246Entry.service");
            const saleAmt = invoice.totalAmount / 100;
            if (bat246BoardId && bat246Pos) {
              await addAtBatFromPurchase({ boardId: bat246BoardId, pos1stBase: bat246Pos, userId, userName: uName, userEmail: uEmail, productId: primaryItem.itemId.toString(), saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
            } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
              await addFromUpperBaseInvite({ boardId: bat246BoardId, referrerPosition: bat246UpperRef, referrerPlayerId: bat246UpperRefPlayerId, userId, userName: uName, userEmail: uEmail, productId: primaryItem.itemId.toString(), saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
            } else if (bat246BoardId && bat246GenRef) {
              await addFromGenericInvite({ boardId: bat246BoardId, referrerPlayerId: bat246GenRef, userId, userName: uName, userEmail: uEmail, productId: primaryItem.itemId.toString(), saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
            } else if (bat246BoardId && bat246DugoutRef) {
              await addToDugoutFromPurchase({ boardId: bat246BoardId, referredByPlayerId: bat246DugoutRef, userId, userName: uName, userEmail: uEmail, productId: primaryItem.itemId.toString(), saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
            } else if (bat246Ref) {
              // Boards/Inviteandplace "Buy $650/$160 entry" link — no specific
              // board/position yet, just mark this distributor's entry as
              // purchased so their qualification progress bar advances and
              // their upline (1st Base) can Approve + place them later.
              // Mirrors productCheckout.ts's identical branch for the
              // coupon-zero ($0) path — that one only runs at invoice-creation
              // time for a free invoice, so a REAL paid purchase (Razorpay/
              // Stripe/wallet, verified after the fact via fulfilInvoice) had
              // no equivalent here and silently never flipped
              // hasPurchasedProduct, leaving the Path to Bat246 Distributor
              // stuck even after a successful payment.
              const { Bat246Distributor: BD3 } = await import("../bat246/models/bat246Distributor.model");
              const { Bat246PlacementNotification: BPN3 } = await import("../bat246/models/bat246PlacementNotifications.model");
              const dist = await BD3.findOneAndUpdate(
                { userId: new Types.ObjectId(userId) },
                { $set: { playerId: player._id, hasPurchasedProduct: true, isOfficeMember: true, bat246RefUserId: new Types.ObjectId(bat246Ref) }, $setOnInsert: { isGarageAffiliate: false, hasBat246Membership: false, isQualified: false } },
                { upsert: true, new: true },
              ) as any;
              // isGarageAffiliate ($25 Garage Affiliate) dropped from
              // qualification on request.
              const isNowQualified = !!(dist?.hasPurchasedProduct && dist?.isOfficeMember && dist?.hasBat246Membership);
              const wasQualified = !!dist?.isQualified;
              if (isNowQualified !== wasQualified) {
                await BD3.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { isQualified: isNowQualified, ...(isNowQualified && !wasQualified ? { qualifiedAt: new Date() } : {}) } });
              }
              await BPN3.create({ notificationType: "placement", boardId: null, position: null, qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: uEmail, qualifiedUserName: uName, uplineUserId: new Types.ObjectId(bat246Ref) });
              if (isNowQualified && !wasQualified) {
                const { maybeCreatePlacementNotification } = await import("../bat246/services/bat246.service");
                const { assignDistributorId } = await import("../bat246/services/bat246DistributorId.util");
                await assignDistributorId(userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
                await maybeCreatePlacementNotification(userId).catch(() => {});
              }
            } else {
              // No invite-link context — do not auto-create a board. User must purchase via an invite link.
              console.log(`[bat246] fulfillInvoice: no board context for user ${userId}, skipping board creation`);
            }
          }
        }
      } catch (bat246Err: any) {
        console.error("[bat246] fulfillInvoice product placement failed:", bat246Err.message);
      }

      // Order confirmation email, when the founder enabled alerts on the
      // product. Fire-and-forget: a mail failure must never fail fulfilment.
      // De-duped inside via an atomic claim on invoice.metadata, because this
      // function runs more than once when a webhook races the browser.
      void import("./orderEmail")
        .then(({ queueOrderEmail }) =>
          queueOrderEmail({
            invoice,
            itemType: "product",
            itemId: primaryItem.itemId,
            order: updatedOrder || order,
          }),
        )
        .catch((err: any) =>
          console.error("[order-email] fulfillInvoice import failed:", err?.message),
        );

      return { type: "product", order: updatedOrder || order };
    }

    case "course": {
      const qty = primaryItem.quantity || 1;
      // Order confirmation, when the founder enabled alerts on the course.
      // Same fire-and-forget + atomic-claim de-dupe as the product case; there
      // is no order record for courses, so the item line is built from the
      // course itself.
      const queueCourseEmail = () =>
        void import("./orderEmail")
          .then(({ queueOrderEmail }) =>
            queueOrderEmail({
              invoice,
              itemType: "course",
              itemId: primaryItem.itemId,
              quantity: qty,
            }),
          )
          .catch((err: any) =>
            console.error("[order-email] course import failed:", err?.message),
          );
      if (qty > 1) {
        // Bulk buy → reserve all N seats. Buyer is not auto-enrolled; they
        // can self-assign one if they want (matches "reseller" default for
        // the new generic reserve flow — distinct from UP's auto-activate).
        const { createItemReserves } = await import("./itemReserveLicense");
        const reserves = await createItemReserves({
          buyerId: userId,
          itemType: "course",
          itemId: primaryItem.itemId.toString(),
          itemName: primaryItem.itemName,
          itemImage: primaryItem.itemImage,
          organizationId: orgId,
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          paymentId: razorpayPaymentId,
          count: qty,
          unitPrice: primaryItem.unitPrice || 0,
          currency: invoice.itemCurrency,
        });
        queueCourseEmail();
        return {
          type: "course",
          flow: "reserves",
          reserveCount: reserves.length,
        };
      }
      // Single seat — current behavior, unchanged.
      const enrollment = await enrollInCourse({
        courseId: primaryItem.itemId.toString(),
        userId,
        organizationId: orgId,
        isPaid: true,
        amountPaid: saleAmount,
        // saleAmount is in itemCurrency units — use itemCurrency, not
        // paymentCurrency (which gets forced to USD on wallet payments).
        currency: invoice.itemCurrency,
        paymentId: razorpayPaymentId,
      });
      queueCourseEmail();
      return { type: "course", enrollmentId: enrollment._id.toString() };
    }

    case "channel": {
      const qty = primaryItem.quantity || 1;
      // Order confirmation, when the founder enabled alerts on the community.
      const queueChannelEmail = () =>
        void import("./orderEmail")
          .then(({ queueOrderEmail }) =>
            queueOrderEmail({
              invoice,
              itemType: "channel",
              itemId: primaryItem.itemId,
              quantity: qty,
            }),
          )
          .catch((err: any) =>
            console.error("[order-email] channel import failed:", err?.message),
          );
      if (qty > 1) {
        // Bulk buy → reserve all N seats; buyer assigns later.
        const { createItemReserves } = await import("./itemReserveLicense");
        const reserves = await createItemReserves({
          buyerId: userId,
          itemType: "channel",
          itemId: primaryItem.itemId.toString(),
          itemName: primaryItem.itemName,
          itemImage: primaryItem.itemImage,
          organizationId: orgId,
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          paymentId: razorpayPaymentId,
          count: qty,
          unitPrice: primaryItem.unitPrice || 0,
          currency: invoice.itemCurrency,
        });
        queueChannelEmail();
        return {
          type: "channel",
          flow: "reserves",
          reserveCount: reserves.length,
        };
      }
      // Single seat — current upsert behavior, unchanged.
      const membership = await ChannelMembership.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          channelId: primaryItem.itemId,
          orgId: new Types.ObjectId(orgId),
        },
        {
          userId: new Types.ObjectId(userId),
          channelId: primaryItem.itemId,
          orgId: new Types.ObjectId(orgId),
          status: "active",
          role: "member",
          joinedAt: new Date(),
          paymentId: razorpayPaymentId,
        },
        { upsert: true, new: true }
      );
      queueChannelEmail();
      return { type: "channel", membershipId: membership._id.toString() };
    }

    case "call": {
      // The `forReserve` flag (set by callCheckout) controls whether the N
      // call credits go to the buyer's own CallPurchase (default) or into
      // the buyer's reserve pool (one reserve per credit). Quantity always
      // applies — the flag just routes where the credits land.
      const qty = primaryItem.quantity || 1;
      const forReserve = invoice.metadata?.forReserve === true;
      if (forReserve && qty > 0) {
        const { createItemReserves } = await import("./itemReserveLicense");
        const reserves = await createItemReserves({
          buyerId: userId,
          itemType: "call",
          itemId: primaryItem.itemId.toString(),
          itemName: primaryItem.itemName,
          itemImage: primaryItem.itemImage,
          organizationId: orgId,
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          paymentId: razorpayPaymentId,
          count: qty,
          unitPrice: primaryItem.unitPrice || 0,
          currency: invoice.itemCurrency,
        });
        return {
          type: "call",
          flow: "reserves",
          reserveCount: reserves.length,
        };
      }
      // Default: existing "buyer gets N credits" behavior, unchanged.
      const purchase = await purchaseCalls({
        callOfferingId: primaryItem.itemId.toString(),
        userId,
        organizationId: orgId,
        quantity: primaryItem.quantity,
        isPaid: true,
        totalAmount: saleAmount,
        // saleAmount is in itemCurrency units — see comment on commission
        // distribution above.
        currency: invoice.itemCurrency,
        paymentId: razorpayPaymentId,
        paymentStatus: "completed",
      });
      return { type: "call", purchaseId: purchase._id.toString() };
    }

    case "service":
      return { type: "service", status: "payment_recorded" };

    case "workshop": {
      const qty = primaryItem.quantity || 1;
      // Registration confirmation, when the host enabled alerts on the live
      // stream. Same fire-and-forget + atomic-claim de-dupe as the course and
      // channel cases; free registrations get theirs from the $0 mint in
      // services/freeInvoice.ts instead, which never reaches this function.
      const queueWorkshopEmail = () =>
        void import("./orderEmail")
          .then(({ queueOrderEmail }) =>
            queueOrderEmail({
              invoice,
              itemType: "workshop",
              itemId: primaryItem.itemId,
              quantity: qty,
            }),
          )
          .catch((err: any) =>
            console.error("[order-email] workshop import failed:", err?.message),
          );
      if (qty > 1) {
        // Bulk buy → reserve all N seats; buyer assigns later.
        const { createItemReserves } = await import("./itemReserveLicense");
        const reserves = await createItemReserves({
          buyerId: userId,
          itemType: "workshop",
          itemId: primaryItem.itemId.toString(),
          itemName: primaryItem.itemName,
          itemImage: primaryItem.itemImage,
          organizationId: orgId,
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          paymentId: razorpayPaymentId,
          count: qty,
          unitPrice: primaryItem.unitPrice || 0,
          currency: invoice.itemCurrency,
        });
        queueWorkshopEmail();
        return {
          type: "workshop",
          flow: "reserves",
          reserveCount: reserves.length,
        };
      }
      // Single seat — enroll here so wallet / coupon-zero / manual-clear
      // paths don't silently skip registration. Historical bug: the
      // Razorpay verify-payment route in workshopCheckout.ts:562 called
      // `registerForPaidWorkshop` inline and this branch just returned
      // "payment_recorded" — which meant every non-Razorpay workshop
      // buyer got billed and never enrolled (webinar stayed on their
      // Discover page). `registerForPaidWorkshop` is idempotent on the
      // (userId, workshopId, sessionDate?) uniqueness — the Razorpay
      // route hitting it first is safe; this call becomes belt-and-
      // braces for that path and primary for every other path.
      //
      // For per_session workshops, the invoice's metadata.sessionDate
      // is the source of truth — stamped at process-checkout time so
      // both Razorpay + wallet + coupon paths agree.
      const { registerForPaidWorkshop } = await import("./workshop");
      const nativeAmount = (primaryItem.unitPrice || 0) / 100;
      const metaSessionDate = (invoice.metadata as any)?.sessionDate;
      const sessionDate = metaSessionDate
        ? new Date(metaSessionDate)
        : undefined;
      const result = await registerForPaidWorkshop(
        userId,
        primaryItem.itemId.toString(),
        orgId,
        {
          paymentId: razorpayPaymentId,
          orderId: invoice.invoiceNumber,
          amount: nativeAmount,
          currency: primaryItem.originalCurrency || invoice.itemCurrency,
          sessionDate,
        }
      );
      if (!result.success) {
        // "Already registered" is the expected shape when the Razorpay
        // route beat us here — swallow it. Anything else (workshop full,
        // workshop not found) logs so we can spot data drift.
        if (!/already registered/i.test(result.message)) {
          console.error(
            `[fulfillInvoice] workshop registration failed for ${invoice.invoiceNumber}: ${result.message}`
          );
        }
      }
      queueWorkshopEmail();
      return { type: "workshop", status: "registered" };
    }

    case "event_ticket": {
      // The EventRegistration row already exists — it was created at
      // checkout with paymentStatus "pending" so the seat was held while
      // the buyer paid. All this branch does is settle it.
      //
      // Idempotent on purpose: every payment path (Razorpay verify, wallet,
      // coupon-zero, manual clear) funnels through fulfillInvoice, and a
      // webhook replay must not double-approve or double-count.
      // An order can hold several pass types — General Admission AND a VIP
      // pass — and each is its own registration with its own QR code.
      // `eventRegistrationIds` is the whole order; `eventRegistrationId` is
      // the first of them, and the only thing invoices minted before
      // multi-pass carts carry.
      const meta = (invoice.metadata as any) || {};
      const registrationIds: string[] = Array.isArray(meta.eventRegistrationIds)
        ? meta.eventRegistrationIds
        : meta.eventRegistrationId
          ? [meta.eventRegistrationId]
          : [];
      if (!registrationIds.length) {
        console.error(
          `[fulfillInvoice] event_ticket invoice ${invoice.invoiceNumber} has no metadata.eventRegistrationId`
        );
        return { type: "event_ticket", status: "payment_recorded" };
      }

      const { EventRegistration } = await import(
        "../models/eventRegistration.model"
      );
      const { EventProgram } = await import("../models/eventProgram.model");

      // Minor units per registration, so a two-pass order doesn't record the
      // full invoice total against each ticket in it. Absent on single-pass
      // invoices, where the whole total belongs to the one registration.
      const amounts: Record<string, number> =
        meta.eventRegistrationAmounts && typeof meta.eventRegistrationAmounts === "object"
          ? meta.eventRegistrationAmounts
          : {};

      const settled: string[] = [];
      // Only the passes THIS run flipped from unpaid to paid. Every payment
      // path funnels through here and a webhook replay re-runs the branch, so
      // emailing `settled` would send the ticket again on every replay.
      const newlyPaid: string[] = [];
      let primary: any = null;

      for (const registrationId of registrationIds) {
        const registration = await EventRegistration.findById(registrationId);
        if (!registration) {
          console.error(
            `[fulfillInvoice] event registration ${registrationId} not found for ${invoice.invoiceNumber}`
          );
          continue;
        }

        const event = await EventProgram.findById(registration.eventId)
          .select("requireApproval")
          .lean();

        const alreadyPaid = registration.paymentStatus === "paid";

        // Paid after the hold lapsed: the sweep cancelled this seat and put it
        // back on sale. Take it again if it's still there; if it was resold,
        // record the payment for a refund and issue nothing — a ticket marked
        // paid but cancelled would fail at the door.
        if (registration.status === "cancelled" && !alreadyPaid) {
          const { claimTierSeats, releaseTierSeats } = await import(
            "./eventManagement"
          );
          const wanted = [
            { tierId: registration.ticketTierId, qty: registration.quantity || 1 },
            ...(registration.addons || []).map((a: any) => ({
              tierId: a.ticketTierId,
              qty: a.quantity || 1,
            })),
          ];
          const claimed: typeof wanted = [];
          for (const w of wanted) {
            if (!(await claimTierSeats(w.tierId, w.qty))) break;
            claimed.push(w);
          }
          if (claimed.length === wanted.length) {
            registration.status = "pending_approval";
            registration.rejectedReason = undefined;
          } else {
            for (const c of claimed) await releaseTierSeats(c.tierId, c.qty).catch(() => {});
            registration.paymentStatus = "paid";
            registration.amountPaid =
              (amounts[registrationId] ?? invoice.totalAmount) / 100;
            registration.invoiceId = invoice._id;
            registration.needsRefund = true;
            registration.rejectedReason = "Paid after the seats were resold";
            await registration.save();
            console.error(
              `[fulfillInvoice] ${invoice.invoiceNumber}: registration ${registrationId} paid after its seats were resold — needs refund`
            );
            continue;
          }
        }

        registration.paymentStatus = "paid";
        registration.amountPaid =
          (amounts[registrationId] ?? invoice.totalAmount) / 100;
        registration.currency = invoice.itemCurrency || "USD";
        registration.invoiceId = invoice._id;
        // The seats are paid for, so they are no longer a hold that expires.
        registration.holdExpiresAt = null;
        // Paying does not skip the organizer's door policy — an
        // approval-gated event keeps the buyer pending until reviewed.
        if (registration.status === "pending_approval" && !event?.requireApproval) {
          registration.status = "approved";
        }
        await registration.save();
        settled.push(registration._id.toString());
        if (!alreadyPaid) newlyPaid.push(registration._id.toString());
        primary = primary || registration;
      }

      if (!primary) {
        return { type: "event_ticket", status: "payment_recorded" };
      }

      // The ticket email.
      //
      // This branch settled the passes and then returned without telling
      // anybody, so a paid buyer never received their QR code — only free
      // registrations did, because that path sends inline. Fired per pass,
      // because each attendee holds their own and is scanned in separately.
      //
      // Fire-and-forget and individually caught: a bounced address must not
      // fail an invoice that is already paid, and one bad recipient must not
      // stop the rest of the order going out.
      if (newlyPaid.length) {
        try {
          const { sendTicketEmail } = await import("./eventManagement");
          const { EventTicketTier } = await import(
            "../models/eventTicketTier.model"
          );
          const emailEvent = await EventProgram.findById(primary.eventId)
            .select("name slug")
            .lean();
          for (const registrationId of newlyPaid) {
            const registration = await EventRegistration.findById(registrationId);
            if (!registration || !emailEvent) continue;
            const tier = await EventTicketTier.findById(registration.ticketTierId)
              .select("name")
              .lean();
            void sendTicketEmail(emailEvent, registration, tier).catch((e) =>
              console.error(
                `[fulfillInvoice] ticket email failed for ${registrationId}:`,
                e?.message
              )
            );
          }
        } catch (emailErr: any) {
          console.error(
            `[fulfillInvoice] could not send ticket emails for ${invoice.invoiceNumber}:`,
            emailErr?.message
          );
        }
      }

      return {
        type: "event_ticket",
        status: primary.status,
        registrationId: primary._id.toString(),
        registrationIds: settled,
      };
    }

    case "office_plan": {
      // Fire the Pro-branch commission ($24 UP + $24 direct + $48
      // platform) for Pro invoices paid OUTSIDE Razorpay — the
      // cryptobrand-bootstrap flow (wallet / crypto) would otherwise
      // never distribute, since distributeOfficeCommission in
      // officeSubscription.ts only fires from Razorpay webhook handlers.
      // Idempotent — the service stamps metadata.officeProCommissionAt
      // and no-ops on re-invocation. Non-Pro (Starter/Basic) short-
      // circuits inside the service.
      try {
        const { distributeProOfficeCommissionForInvoice } = await import(
          "./officeProInvoiceCommission"
        );
        await distributeProOfficeCommissionForInvoice(invoice);
      } catch (err) {
        console.error(
          `[fulfillInvoice/office_plan] Pro commission failed for ${invoice.invoiceNumber}:`,
          err,
        );
      }

      // ── Actually deliver the thing that was bought ──
      // This branch used to stop at the commission and return
      // "payment_recorded", because activation lived only in the Razorpay
      // webhook handlers. Any office invoice settled another way — wallet,
      // crypto, or a 100%-off coupon — therefore paid the upline and gave
      // the customer nothing. Org 6a0207e0e7ce4252ed4b1d17 paid twelve
      // FOUNDERSOFFICE cycles on 2026-09-01, triggered $888 of commission,
      // and still had no office the next morning.
      //
      // Idempotent per invoice, and cumulative — twelve paid cycles extend
      // twelve billing periods, not one.
      let officeSubscriptionId: string | undefined;
      try {
        const { activateOfficeFromPaidInvoice } = await import(
          "./officeSubscription"
        );
        const result = await activateOfficeFromPaidInvoice(invoice);
        officeSubscriptionId = result.subscriptionId;
        if (officeSubscriptionId) {
          invoice.metadata = {
            ...(invoice.metadata || {}),
            officeSubscriptionId,
            officeActivationStatus: result.status,
          };
          await invoice.save();
        }
        console.log(
          `[fulfillInvoice/office_plan] ${invoice.invoiceNumber}: office ${result.status}` +
            `${officeSubscriptionId ? ` (sub ${officeSubscriptionId})` : ""}`,
        );
      } catch (err) {
        // Non-fatal: the payment is already recorded, and a failure here
        // must not roll back the invoice. It IS the customer-visible half
        // though, so it needs to be loud.
        console.error(
          `[fulfillInvoice/office_plan] ACTIVATION FAILED for ${invoice.invoiceNumber} — ` +
            `payment taken but office not delivered:`,
          err,
        );
      }

      return { type: "office_plan", status: "payment_recorded" };
    }

    case "office_addon":
      // Conference-room subscription. Rooms are activated independently in
      // the `ConferenceRoom` collection at the moment the founder adds them;
      // this invoice is the financial receipt. No commission distribution
      // (Shorupan's call — $5 is too small to split meaningfully). Same
      // shape as office_plan: payment_recorded + early return.
      return { type: "office_addon", status: "payment_recorded" };

    case "whitelabel_addon": {
      // Founder self-serve $600/yr whitelabel add-on. Two side effects
      // fire in order, both idempotent (see invoice.metadata markers):
      //   1. Upsert an OfficeAddonSubscription so hasActiveAddon(orgId,
      //      "white-label") flips true (whitelabel UI turns on).
      //   2. Credit 50% of the base $600 = $300 USD to the buyer's
      //      direct referrer's Affiliate Wallet.
      const {
        activateWhitelabelFromInvoice,
        chargeReferralCommission,
      } = await import("./whitelabelAddonPurchase");
      try {
        await activateWhitelabelFromInvoice(invoice);
      } catch (err) {
        console.error(
          `[fulfillInvoice:whitelabel_addon] activation failed for ${invoice._id}:`,
          (err as any)?.message || err,
        );
      }
      try {
        await chargeReferralCommission(invoice);
      } catch (err) {
        // Commission failure shouldn't block activation. Log and move
        // on; admin can manually credit if needed.
        console.error(
          `[fulfillInvoice:whitelabel_addon] commission failed for ${invoice._id}:`,
          (err as any)?.message || err,
        );
      }
      return { type: "whitelabel_addon", status: "activated" };
    }

    case "cryptosub": {
      // Cryptosub — same shape as whitelabel_addon. Two side effects
      // fire in order, both idempotent:
      //   1. Upsert an OfficeAddonSubscription for slug "cryptosub"
      //      so hasActiveAddon(orgId, "cryptosub") flips true.
      //   2. 3-bucket commission split: $150 direct L1 + $144 cascade
      //      L1..L6 + $6 platform residual. Missing chain levels
      //      absorb into platform.
      const {
        activateCryptosubFromInvoice,
        chargeReferralCommission: chargeCryptosubCommission,
      } = await import("./cryptosubAddonPurchase");
      try {
        await activateCryptosubFromInvoice(invoice);
      } catch (err) {
        console.error(
          `[fulfillInvoice:cryptosub] activation failed for ${invoice._id}:`,
          (err as any)?.message || err,
        );
      }
      // Whitelabel bundle: if the org opted in at creation time
      // (Organization.whitelabelRequested === true), grant whitelabel
      // access alongside cryptosub — no extra invoice, no charge, no
      // commission. Skips silently otherwise. Same idempotency guard
      // as activateCryptosubFromInvoice (its own invoice.metadata
      // stamp). See services/whitelabelAddonPurchase.ts for the
      // metadata.source = "cryptosub_bundle" rationale.
      try {
        const { activateBundledWhitelabelFromCryptosub } = await import(
          "./whitelabelAddonPurchase"
        );
        await activateBundledWhitelabelFromCryptosub(invoice);
      } catch (err) {
        console.error(
          `[fulfillInvoice:cryptosub] bundled whitelabel grant failed for ${invoice._id}:`,
          (err as any)?.message || err,
        );
      }
      try {
        await chargeCryptosubCommission(invoice);
      } catch (err) {
        console.error(
          `[fulfillInvoice:cryptosub] commission failed for ${invoice._id}:`,
          (err as any)?.message || err,
        );
      }
      return { type: "cryptosub", status: "activated" };
    }

    case "hifi_investment": {
      // HiFi investment payment — the invoice already debited the
      // investor's currency-matched StoreWallet. This hook:
      //   1. Marks the hifi_investment_application `paymentStatus=success`
      //      + stamps paidAt + paymentPayload
      //   2. Upserts a hifi_investment_subscription row (owned by the
      //      hifi seller app; we just create it via wallet-payment)
      //   3. Escrows the principal into the founder-org StoreWallet
      //      (same currency)
      // Full flow: services/hifiInvoiceFulfillment.ts.
      try {
        const { fulfillHifiInvestmentInvoice } = await import(
          "./hifiInvoiceFulfillment"
        );
        await fulfillHifiInvestmentInvoice(invoice);
      } catch (err) {
        console.error(
          `[fulfillInvoice:hifi_investment] fulfillment failed for ${invoice._id}:`,
          (err as any)?.message || err,
        );
      }
      return { type: "hifi_investment", status: "settled" };
    }

    case "hifi_bond": {
      // HiFi bond purchase — the buyer's store wallet has already been
      // debited by the pay path. This hook creates the holding,
      // pre-creates every scheduled payout event (before any money can
      // move for them), and passes the principal through to the
      // founder's wallet. Full flow: services/bondInvoiceFulfillment.ts.
      //
      // Errors are caught rather than thrown: the payment has already
      // settled, and throwing here would not give the buyer their money
      // back — it would only leave the invoice in a worse state. A
      // failure is logged loudly and surfaced in the return value so it
      // is visible rather than silent.
      try {
        const { fulfillBondInvoice } = await import("./bondInvoiceFulfillment");
        const res = await fulfillBondInvoice(invoice);
        if (res.status !== "fulfilled" && res.status !== "already_fulfilled") {
          console.error(
            `[fulfillInvoice:hifi_bond] ${invoice.invoiceNumber} did not settle: ${res.status}`,
          );
          return { type: "hifi_bond", status: res.status };
        }
        return {
          type: "hifi_bond",
          status: res.status,
          holdingId: res.holdingId,
          payoutEventsCreated: res.payoutEventsCreated,
        };
      } catch (err) {
        console.error(
          `[fulfillInvoice:hifi_bond] BUYER DEBITED BUT FULFILLMENT FAILED for ${invoice._id}:`,
          (err as any)?.message || err,
        );
        return { type: "hifi_bond", status: "failed" };
      }
    }

    case "store_wallet_topup": {
      // Buyer-funded credit into their own per-org Store Wallet. Not a sale —
      // no commission, no UP routing, no coupon side effects. The total
      // amount already paid through the gateway is the exact USD amount
      // to credit.
      const { creditStoreWallet } = await import("./wallet");
      const buyerId = invoice.userId.toString();
      const orgIdStr = invoice.organizationId.toString();
      // invoice.totalAmount is denominated in paymentCurrency smallest unit.
      // We force topups to USD at creation time, so this is always cents.
      const amountUsd = Math.round(invoice.totalAmount) / 100;
      if (amountUsd <= 0) {
        invoice.commissionDistributed = true;
        await invoice.save();
        return { type: "store_wallet_topup", status: "zero_amount" };
      }
      try {
        const { wallet } = await creditStoreWallet(
          buyerId, // funder (self) — used as `relatedUserId` in the audit
          buyerId, // recipient
          orgIdStr,
          amountUsd,
          `Store Wallet top-up · invoice ${invoice.invoiceNumber}`
        );
        invoice.commissionDistributed = true;
        await invoice.save();
        return {
          type: "store_wallet_topup",
          status: "credited",
          amount: amountUsd,
          balanceAfter: wallet?.balance,
        };
      } catch (err) {
        console.error(
          `[Invoice] store_wallet_topup credit failed for ${invoice.invoiceNumber}:`,
          err
        );
        return { type: "store_wallet_topup", status: "credit_failed" };
      }
    }

    case "auction_wallet_topup": {
      // Buyer-funded credit into their own (user-global) Auction Wallet — the
      // prepaid balance that backs storefront auction bids. Not a sale: this
      // itemType is on the commission-skip list above.
      const { creditAuctionWallet } = await import("./auctionWallet");
      const buyerId = invoice.userId.toString();
      // Forced to USD at creation time, so totalAmount is always cents.
      const amountUsd = Math.round(invoice.totalAmount) / 100;
      if (amountUsd <= 0) {
        invoice.commissionDistributed = true;
        await invoice.save();
        return { type: "auction_wallet_topup", status: "zero_amount" };
      }
      try {
        const { wallet, alreadyCredited } = await creditAuctionWallet({
          userId: buyerId,
          amountUsd,
          description: `Auction Wallet top-up · invoice ${invoice.invoiceNumber}`,
          // A single payment can reach fulfillInvoice more than once —
          // verify-payment plus a gateway webhook, or the crypto poller
          // re-matching. This key makes the replay a no-op instead of a
          // double credit (the bug the store_wallet_topup branch above has).
          idempotencyKey: `topup:${invoice._id}`,
          type: "topup",
          metadata: {
            kind: "auction_topup",
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
          },
        });
        invoice.commissionDistributed = true;
        await invoice.save();
        return {
          type: "auction_wallet_topup",
          status: alreadyCredited ? "already_credited" : "credited",
          amount: amountUsd,
          balanceAfter: wallet?.balance,
        };
      } catch (err) {
        console.error(
          `[Invoice] auction_wallet_topup credit failed for ${invoice.invoiceNumber}:`,
          err
        );
        return { type: "auction_wallet_topup", status: "credit_failed" };
      }
    }

    case "franchise_program": {
      // Founder opt-in / renewal. The line item's itemId IS the
      // FranchiseProgram _id. Activate (or renew) the program and stamp the
      // yearly subscription window.
      //
      // Money flow: the $650 is platform revenue. For payment-gateway paid
      // invoices the gateway settles it to our real bank externally, so no
      // internal wallet split is needed. For `store_wallet` paid invoices
      // there IS no external settlement — the buyer's wallet was debited
      // and the money would vanish unless we explicitly credit the platform
      // wallet. See the floor-credit block below.
      const { FranchiseProgram } = await import("../models/franchiseProgram.model");
      const program = await FranchiseProgram.findById(primaryItem.itemId);
      if (!program) {
        console.error(
          `[Invoice] franchise_program ${primaryItem.itemId} not found for ${invoice.invoiceNumber}`
        );
        return { type: "franchise_program", status: "program_not_found" };
      }
      const now = new Date();
      // Renewals extend from the later of (current expiry, now) so an early
      // renewal doesn't lose remaining time.
      const base =
        program.subscription?.expiresAt &&
        new Date(program.subscription.expiresAt) > now
          ? new Date(program.subscription.expiresAt)
          : now;
      program.status = "active";
      program.subscription = {
        ...(program.subscription as any),
        priceUSD: program.subscription?.priceUSD ?? 650,
        period: "yearly",
        invoiceId: program.subscription?.invoiceId ?? invoice._id,
        startedAt: program.subscription?.startedAt ?? now,
        expiresAt: getNextChargeDate(base, "yearly"),
        lastPaymentInvoiceId: invoice._id,
      } as any;
      await program.save();

      // ── Platform floor credit (store_wallet-paid only) ────────────────
      // Gateway-paid invoices: the gateway already moved the money to our
      // bank externally — skip. Wallet-paid: we debited the buyer's store
      // wallet at select/verify-payment time and never credited the
      // platform. Move the paid amount into Shorupan's Garage App wallet
      // so the ledger balances. Idempotent via metadata.franchiseFloor —
      // fulfillInvoice's own guard shouldn't let this re-run, but belt-
      // and-braces means the reconciliation script and any future replay
      // can't double-credit.
      if (invoice.paymentPlatform === "store_wallet" && invoice.totalAmount > 0) {
        try {
          const { WalletTransaction } = await import(
            "../models/walletTransaction.model"
          );
          const { User } = await import("../models/user.model");
          const alreadyCredited = await WalletTransaction.findOne({
            "metadata.franchiseFloor.invoiceId": invoice._id.toString(),
          }).lean();
          if (!alreadyCredited) {
            const { creditStoreWallet } = await import("./wallet");
            const { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } = await import(
              "./commission"
            );
            const platformUser = await User.findOne({
              email: PLATFORM_USER_EMAIL,
            })
              .select("_id")
              .lean();
            if (platformUser) {
              const paidUSD = invoice.totalAmount / 100;
              const { transaction } = await creditStoreWallet(
                invoice.userId.toString(),
                platformUser._id.toString(),
                PLATFORM_ORG_ID,
                paidUSD,
                `Franchise program floor: ${primaryItem.itemName || program._id}`,
                `Invoice ${invoice.invoiceNumber} — store_wallet paid`,
              );
              // Tag the transaction so idempotency check above finds it.
              await WalletTransaction.updateOne(
                { _id: transaction._id },
                {
                  $set: {
                    "metadata.franchiseFloor": {
                      kind: "program_floor",
                      invoiceId: invoice._id.toString(),
                      invoiceNumber: invoice.invoiceNumber,
                    },
                  },
                },
              );
              console.log(
                `[Invoice] franchise_program floor $${paidUSD} → ${PLATFORM_USER_EMAIL} (invoice ${invoice.invoiceNumber})`,
              );
            }
          }
        } catch (floorErr) {
          console.error(
            `[Invoice] franchise_program floor credit failed for ${invoice.invoiceNumber}:`,
            floorErr,
          );
        }
      }

      return { type: "franchise_program", status: "activated" };
    }

    case "franchise_territory": {
      // Territory purchase / renewal. The line item's itemId IS the
      // FranchiseTerritoryAssignment _id. Activate the assignment and split the
      // price: $650 floor stays with the platform (collected by gateway); any
      // excess is credited to the founder's office StoreWallet.
      const { FranchiseTerritoryAssignment } = await import(
        "../models/franchiseTerritoryAssignment.model"
      );
      const assignment = await FranchiseTerritoryAssignment.findById(
        primaryItem.itemId
      );
      if (!assignment) {
        console.error(
          `[Invoice] franchise_territory ${primaryItem.itemId} not found for ${invoice.invoiceNumber}`
        );
        return { type: "franchise_territory", status: "assignment_not_found" };
      }
      const now = new Date();

      // Buyer-initiated resale (Phase 3): entirely separate money-flow from the
      // owner-initiated flow below. On payment, transfer ownership, PRESERVE
      // the existing `expiresAt`, credit 100% of the paid amount to the seller
      // (no platform floor, no founder markup), and mint a fresh recurring
      // parent invoice at the NEW price with dueDate = preservedExpiresAt so
      // the next annual cycle bills correctly through the standard engine.
      const isBuyerResale =
        (invoice.metadata as any)?.kind === "buyer_resale" &&
        assignment.pendingResaleOffer &&
        String(assignment.pendingResaleOffer.resaleInvoiceId) ===
          String(invoice._id);

      if (isBuyerResale) {
        const p = assignment.pendingResaleOffer!;
        const preservedExpiresAt =
          assignment.subscription?.expiresAt || undefined;
        const oldSubInvoiceId = assignment.subscription?.invoiceId || null;
        const oldOwnerUserId = assignment.ownerUserId;

        // 1. Transfer ownership + apply the new agreed price. expiresAt is
        //    UNCHANGED — the new owner inherits the remaining cycle window.
        assignment.ownerUserId = p.buyerUserId;
        assignment.ownerEmail = p.buyerEmail;
        assignment.acquisitionType = "resale";
        assignment.priceUSD = p.agreedPriceUSD;
        assignment.status = "active";
        assignment.subscription = {
          ...(assignment.subscription as any),
          startedAt: assignment.subscription?.startedAt || now,
          expiresAt: preservedExpiresAt,
          lastPaymentInvoiceId: invoice._id,
        } as any;
        assignment.pendingResaleOffer = null;
        await assignment.save();

        // 2. Cancel the old recurring parent so it doesn't mint a renewal
        //    invoice for the seller anymore.
        if (
          oldSubInvoiceId &&
          String(oldSubInvoiceId) !== String(invoice._id)
        ) {
          await Invoice.updateOne(
            {
              _id: oldSubInvoiceId,
              cancelledAt: { $in: [null, undefined] },
            },
            { $set: { cancelledAt: now, status: "cancelled" } },
          );
        }

        // 3. Credit 100% of the paid amount to the seller's office wallet.
        //    Platform + office founder receive $0 on the resale itself.
        const paidUSD = invoice.totalAmount / 100;
        let sellerWalletTxId: any = null;
        if (paidUSD > 0 && oldOwnerUserId) {
          try {
            const { creditStoreWallet } = await import("./wallet");
            const { transaction } = await creditStoreWallet(
              String(invoice.userId), // payer (buyer) — descriptive; recipient below
              String(oldOwnerUserId), // recipient (seller)
              String(assignment.officeId),
              paidUSD,
              `Franchise territory buyer-resale (100% to seller): ${assignment.geoEntityName || assignment.geoEntityId}`,
              `Invoice ${invoice.invoiceNumber} — buyer resale, prorated`,
            );
            sellerWalletTxId = transaction._id;
            const { WalletTransaction } = await import(
              "../models/walletTransaction.model"
            );
            await WalletTransaction.updateOne(
              { _id: transaction._id },
              {
                $set: {
                  "metadata.franchiseProgram": {
                    programId: String(assignment.programId),
                    assignmentId: String(assignment._id),
                    kind: "territory_buyer_resale_full",
                    offerId: (invoice.metadata as any)?.franchiseOfferId,
                    agreedFullPriceUSD: p.agreedPriceUSD,
                  },
                },
              },
            );
          } catch (walletErr) {
            console.error(
              `[Invoice] buyer_resale seller credit failed for ${invoice.invoiceNumber}:`,
              walletErr,
            );
          }
        }

        // 4. Mint the follow-on recurring parent at the NEW full price. dueDate
        //    = preservedExpiresAt so it becomes the "next annual" invoice.
        //    subscription.invoiceId re-points to this row so the recurring
        //    engine treats it as the new parent chain.
        let renewalParentId: any = null;
        try {
          const { User } = await import("../models/user.model");
          const buyer = await User.findById(p.buyerUserId)
            .select("email name")
            .lean<any>();
          const renewal = await createInvoice({
            organizationId: String(assignment.officeId),
            sellerId: String(assignment.assignedByUserId),
            userId: String(p.buyerUserId),
            customerEmail: buyer?.email,
            customerName: buyer?.name,
            lineItems: [
              {
                itemType: "franchise_territory",
                itemId: String(assignment._id),
                itemName: `Franchise territory (annual) — ${assignment.geoEntityName || assignment.geoEntityId}`,
                quantity: 1,
                unitPrice: Math.round(p.agreedPriceUSD * 100),
                originalCurrency: "USD",
              },
            ],
            itemCurrency: "USD",
            isRecurring: true,
            recurringPeriod: "yearly",
            dueDate: preservedExpiresAt,
            metadata: {
              franchiseProgramId: String(assignment.programId),
              franchiseAssignmentId: String(assignment._id),
              officeId: String(assignment.officeId),
              kind: "resale_renewal_parent",
              sourceOfferId: (invoice.metadata as any)?.franchiseOfferId,
              spawnedFromInvoiceId: String(invoice._id),
            },
          } as any);
          renewalParentId = (renewal as any)._id;
          await FranchiseTerritoryAssignment.updateOne(
            { _id: assignment._id },
            {
              $set: {
                "subscription.invoiceId": renewalParentId,
                "subscription.startedAt":
                  assignment.subscription?.startedAt || now,
                "subscription.expiresAt": preservedExpiresAt,
              },
            },
          );
        } catch (renewalErr) {
          console.error(
            `[Invoice] buyer_resale renewal-parent mint failed for ${invoice.invoiceNumber}:`,
            renewalErr,
          );
        }

        // 5. Stamp resolution refs on the offer row for audit trail.
        try {
          const { FranchiseOffer } = await import(
            "../models/franchiseOffer.model"
          );
          const offerId = (invoice.metadata as any)?.franchiseOfferId;
          if (offerId) {
            await FranchiseOffer.updateOne(
              { _id: offerId },
              {
                $set: {
                  "resolutionTxRefs.resaleInvoiceId": invoice._id,
                  "resolutionTxRefs.renewalParentInvoiceId": renewalParentId,
                  "resolutionTxRefs.sellerWalletTxId": sellerWalletTxId,
                },
              },
            );
          }
        } catch (stampErr) {
          console.error(
            `[Invoice] buyer_resale offer stamp failed for ${invoice.invoiceNumber}:`,
            stampErr,
          );
        }

        return {
          type: "franchise_territory",
          status: "buyer_resale_completed",
        };
      }

      // Resale (Phase 2): a founder-approved reassignment whose invoice is THIS
      // one. Transfer ownership and credit the markup to the reseller (not the
      // founder). Otherwise it's the original sale / a renewal.
      const pr = assignment.pendingReassignment as any;
      const isResale =
        pr?.status === "approved" &&
        pr?.invoiceId &&
        String(pr.invoiceId) === String(invoice._id);

      // Who receives the markup over the $650 floor on THIS payment:
      //   - original sale + every renewal → the founder (the territory's
      //     recurring excess is ongoing program revenue; assignedByUserId stays
      //     the founder for the life of the assignment).
      //   - the resale transaction itself → the reseller, ONE TIME. Subsequent
      //     renewals revert to the founder (assignedByUserId is left untouched).
      const markupRecipientUserId = isResale
        ? pr.resellerUserId
        : assignment.assignedByUserId;

      let oldSubInvoiceId: any = null;
      let completedReassignmentId: any = null;
      if (isResale) {
        oldSubInvoiceId = assignment.subscription?.invoiceId || null;
        completedReassignmentId = pr?.reassignmentId || null;
        // Transfer ownership to the new owner. assignedByUserId is left as the
        // founder so renewal markups continue flowing to the program owner —
        // the reseller only earns the one-time markup above.
        assignment.ownerUserId = pr.newOwnerUserId;
        assignment.ownerEmail = pr.newOwnerEmail;
        // Mark how the NEW owner acquired it, and link the resale row.
        assignment.acquisitionType = "resale";
        assignment.acquiredReassignmentId = completedReassignmentId || undefined;
        // Fresh subscription window for the new owner.
        assignment.subscription = {
          invoiceId: invoice._id,
          startedAt: now,
          expiresAt: getNextChargeDate(now, "yearly"),
          lastPaymentInvoiceId: invoice._id,
        } as any;
        assignment.status = "active";
        assignment.pendingReassignment = null;
      } else {
        const base =
          assignment.subscription?.expiresAt &&
          new Date(assignment.subscription.expiresAt) > now
            ? new Date(assignment.subscription.expiresAt)
            : now;
        assignment.status = "active";
        assignment.subscription = {
          ...(assignment.subscription as any),
          invoiceId: assignment.subscription?.invoiceId ?? invoice._id,
          startedAt: assignment.subscription?.startedAt ?? now,
          expiresAt: getNextChargeDate(base, "yearly"),
          lastPaymentInvoiceId: invoice._id,
        } as any;
      }
      await assignment.save();

      // Stop the prior owner's recurring subscription on a resale, so it no
      // longer generates renewal invoices for the old owner.
      if (isResale && oldSubInvoiceId && String(oldSubInvoiceId) !== String(invoice._id)) {
        await Invoice.updateOne(
          { _id: oldSubInvoiceId, cancelledAt: { $in: [null, undefined] } },
          { $set: { cancelledAt: now, status: "cancelled" } }
        );
      }

      // Mark the durable resale ledger row → completed (the in-flight
      // pendingReassignment is already cleared above; this is the history).
      if (isResale && completedReassignmentId) {
        const { FranchiseReassignment } = await import(
          "../models/franchiseReassignment.model"
        );
        await FranchiseReassignment.updateOne(
          { _id: completedReassignmentId },
          { $set: { status: "completed", completedAt: now } }
        );
      }

      // Markup split: (price − $650 floor) → markup recipient's office wallet.
      // IMPORTANT: the markup is computed from the line item's ORIGINAL
      // unitPrice (undiscounted), NOT invoice.totalAmount — so a franchise
      // territory coupon (which only discounts the $650 floor) never reduces
      // the founder/reseller markup. The platform absorbs the discount.
      const { FRANCHISE_PRICE_USD: FRANCHISE_FLOOR_USD } = await import(
        "../models/franchiseProgram.model"
      );
      const fullPriceUSD = (primaryItem.unitPrice ?? invoice.totalAmount) / 100;
      const paidUSD = invoice.totalAmount / 100;
      // Never credit more markup than was actually paid (defensive — with a
      // floor-only coupon, paid ≥ markup always holds).
      const excess = Math.min(
        Math.round((fullPriceUSD - FRANCHISE_FLOOR_USD) * 100) / 100,
        Math.round(paidUSD * 100) / 100
      );
      if (excess > 0 && markupRecipientUserId) {
        try {
          const { StoreWallet } = await import("../models/storeWallet.model");
          const { WalletTransaction } = await import(
            "../models/walletTransaction.model"
          );
          let wallet = await StoreWallet.findOne({
            userId: markupRecipientUserId,
            orgId: assignment.officeId,
          });
          if (!wallet) {
            wallet = await StoreWallet.create({
              userId: markupRecipientUserId,
              orgId: assignment.officeId,
              balance: 0,
              currency: "USD",
            });
          }
          const before = wallet.balance;
          const after = Math.round((before + excess) * 100) / 100;
          wallet.balance = after;
          wallet.lastTransactionAt = new Date();
          await wallet.save();
          await WalletTransaction.create({
            storeWalletId: wallet._id,
            walletType: "store",
            userId: markupRecipientUserId,
            orgId: assignment.officeId,
            type: "credit",
            amount: excess,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description: `Franchise territory ${isResale ? "resale" : "sale"} markup: ${assignment.geoEntityName || assignment.geoEntityId}`,
            note: `${isResale ? "Resold" : "Sold"} ${assignment.geoLevel} to ${assignment.ownerEmail} for $${fullPriceUSD} (paid $${paidUSD}; $${FRANCHISE_FLOOR_USD} platform floor)`,
            relatedUserId: assignment.ownerUserId,
            metadata: {
              franchiseProgram: {
                programId: String(assignment.programId),
                assignmentId: String(assignment._id),
                kind: isResale ? "territory_resale_markup" : "territory_sale_markup",
              },
            },
            status: "completed",
          });
        } catch (markupErr) {
          console.error(
            `[Invoice] franchise_territory markup credit failed for ${invoice.invoiceNumber}:`,
            markupErr
          );
        }
      }
      // ── Platform floor credit (store_wallet-paid only) ────────────────
      // Same reasoning as franchise_program above. Gateway-paid invoices
      // settle the $650 floor externally. Wallet-paid: we already debited
      // the buyer's store wallet at pay-time, but nothing credited the
      // platform floor internally — the excess-only credit above covers
      // the founder markup but never the platform's $650 slice. Move
      // MIN(floor, paid) into Shorupan's Garage App wallet.
      if (invoice.paymentPlatform === "store_wallet" && invoice.totalAmount > 0) {
        try {
          const { WalletTransaction } = await import(
            "../models/walletTransaction.model"
          );
          const { User } = await import("../models/user.model");
          const alreadyCredited = await WalletTransaction.findOne({
            "metadata.franchiseFloor.invoiceId": invoice._id.toString(),
          }).lean();
          if (!alreadyCredited) {
            const { creditStoreWallet } = await import("./wallet");
            const { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } = await import(
              "./commission"
            );
            const platformUser = await User.findOne({
              email: PLATFORM_USER_EMAIL,
            })
              .select("_id")
              .lean();
            if (platformUser) {
              // Never credit more floor than was actually paid (coupon on
              // the floor may have brought paid < $650).
              const floorUSD = Math.min(FRANCHISE_FLOOR_USD, paidUSD);
              if (floorUSD > 0) {
                const { transaction } = await creditStoreWallet(
                  invoice.userId.toString(),
                  platformUser._id.toString(),
                  PLATFORM_ORG_ID,
                  floorUSD,
                  `Franchise territory floor: ${assignment.geoEntityName || assignment.geoEntityId}`,
                  `Invoice ${invoice.invoiceNumber} — store_wallet paid`,
                );
                await WalletTransaction.updateOne(
                  { _id: transaction._id },
                  {
                    $set: {
                      "metadata.franchiseFloor": {
                        kind: "territory_floor",
                        invoiceId: invoice._id.toString(),
                        invoiceNumber: invoice.invoiceNumber,
                        assignmentId: String(assignment._id),
                      },
                    },
                  },
                );
                console.log(
                  `[Invoice] franchise_territory floor $${floorUSD} → ${PLATFORM_USER_EMAIL} (invoice ${invoice.invoiceNumber})`,
                );
              }
            }
          }
        } catch (floorErr) {
          console.error(
            `[Invoice] franchise_territory floor credit failed for ${invoice.invoiceNumber}:`,
            floorErr,
          );
        }
      }

      return {
        type: "franchise_territory",
        status: isResale ? "reassigned" : "activated",
      };
    }

    case "franchise_global": {
      // Global-catalog franchise entity (country / territory / sub-territory)
      // sold via the Garage invoice engine (System A). Line item itemId IS
      // the FranchiseGlobalAssignment _id. Flip pending_payment → active,
      // stamp the yearly subscription window, and (for store_wallet-paid
      // invoices) credit the paid amount to Shorupan's platform wallet.
      //
      // Unlike franchise_territory (System B) there is NO markup middleman —
      // the whole paid amount is platform revenue. Resale (Phase 2, currently
      // stubbed at 501 on the route) will introduce a resale branch here
      // mirroring franchise_territory's pattern.
      const { FranchiseGlobalAssignment } = await import(
        "../models/franchiseGlobalAssignment.model"
      );
      const assignment = await FranchiseGlobalAssignment.findById(
        primaryItem.itemId
      );
      if (!assignment) {
        console.error(
          `[Invoice] franchise_global ${primaryItem.itemId} not found for ${invoice.invoiceNumber}`
        );
        return { type: "franchise_global", status: "assignment_not_found" };
      }
      const now = new Date();

      // Owner-initiated directed sale (System A): owner picked a specific
      // buyer email + price → invoice minted for buyer → on pay, ownership
      // transfers, fresh 1-year subscription window (like a listing claim,
      // NOT like the buyer-offer path which preserves expiresAt). Money
      // split mirrors the marketplace-listing model: $650 → Shorupan
      // platform floor, excess → prior owner. Store-wallet-paid only —
      // gateway-paid invoices settle externally.
      const isDirectedSale =
        (invoice.metadata as any)?.kind === "directed_sale" &&
        assignment.pendingDirectedSale &&
        String(assignment.pendingDirectedSale.invoiceId) === String(invoice._id);

      if (isDirectedSale) {
        const p = assignment.pendingDirectedSale!;
        const priorOwnerUserId = assignment.ownerUserId
          ? new Types.ObjectId(String(assignment.ownerUserId))
          : null;
        const oldSubInvoiceId = assignment.subscription?.invoiceId || null;

        // 1. Transfer ownership + fresh yearly window.
        assignment.ownerUserId = p.buyerUserId;
        assignment.ownerEmail = p.buyerEmail;
        assignment.acquisitionType = "resale";
        assignment.priceUSD = p.priceUSD;
        assignment.status = "active";
        assignment.subscription = {
          invoiceId: invoice._id,
          startedAt: now,
          expiresAt: getNextChargeDate(now, "yearly"),
          lastPaymentInvoiceId: invoice._id,
        } as any;
        assignment.pendingDirectedSale = null;
        await assignment.save();

        // 2. Cancel the prior owner's old recurring parent so it stops
        //    generating renewal invoices for them.
        if (
          oldSubInvoiceId &&
          String(oldSubInvoiceId) !== String(invoice._id)
        ) {
          await Invoice.updateOne(
            {
              _id: oldSubInvoiceId,
              cancelledAt: { $in: [null, undefined] },
            },
            { $set: { cancelledAt: now, status: "cancelled" } },
          );
        }

        // 3. Money split ($650 → Shorupan, excess → prior owner).
        //    store_wallet-paid only; gateway settles externally.
        if (
          invoice.paymentPlatform === "store_wallet" &&
          invoice.totalAmount > 0
        ) {
          try {
            const { WalletTransaction } = await import(
              "../models/walletTransaction.model"
            );
            const { User } = await import("../models/user.model");
            const alreadyCredited = await WalletTransaction.findOne({
              "metadata.franchiseFloor.invoiceId": invoice._id.toString(),
            }).lean();
            if (!alreadyCredited) {
              const { creditStoreWallet } = await import("./wallet");
              const { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } = await import(
                "./commission"
              );
              const { FRANCHISE_PRICE_USD: FRANCHISE_FLOOR_USD } = await import(
                "../models/franchiseProgram.model"
              );
              const platformUser = await User.findOne({
                email: PLATFORM_USER_EMAIL,
              })
                .select("_id")
                .lean();
              if (platformUser) {
                const paidUSD = invoice.totalAmount / 100;
                const fullPriceUSD = p.priceUSD;
                const floorUSD = Math.min(FRANCHISE_FLOOR_USD, paidUSD);
                const excess = Math.min(
                  Math.round((fullPriceUSD - FRANCHISE_FLOOR_USD) * 100) / 100,
                  Math.round(paidUSD * 100) / 100,
                );

                if (floorUSD > 0) {
                  const { transaction } = await creditStoreWallet(
                    invoice.userId.toString(),
                    platformUser._id.toString(),
                    PLATFORM_ORG_ID,
                    floorUSD,
                    `Franchise (global) floor: ${assignment.geoEntityName || assignment.geoEntityId}`,
                    `Invoice ${invoice.invoiceNumber} — directed sale`,
                  );
                  await WalletTransaction.updateOne(
                    { _id: transaction._id },
                    {
                      $set: {
                        "metadata.franchiseFloor": {
                          kind: "global_floor",
                          invoiceId: invoice._id.toString(),
                          invoiceNumber: invoice.invoiceNumber,
                          assignmentId: String(assignment._id),
                          geoLevel: assignment.geoLevel,
                          geoEntityId: assignment.geoEntityId,
                          directedSale: true,
                        },
                      },
                    },
                  );
                }

                if (excess > 0 && priorOwnerUserId) {
                  const { transaction: markupTx } = await creditStoreWallet(
                    invoice.userId.toString(),
                    String(priorOwnerUserId),
                    PLATFORM_ORG_ID,
                    excess,
                    `Franchise (global) directed-sale markup: ${assignment.geoEntityName || assignment.geoEntityId}`,
                    `Invoice ${invoice.invoiceNumber} — directed sale, $${fullPriceUSD} price ($${FRANCHISE_FLOOR_USD} platform floor)`,
                  );
                  await WalletTransaction.updateOne(
                    { _id: markupTx._id },
                    {
                      $set: {
                        "metadata.franchiseGlobal": {
                          kind: "franchise_global_directed_sale_markup",
                          invoiceId: invoice._id.toString(),
                          invoiceNumber: invoice.invoiceNumber,
                          assignmentId: String(assignment._id),
                          geoLevel: assignment.geoLevel,
                          geoEntityId: assignment.geoEntityId,
                          priorOwnerUserId: String(priorOwnerUserId),
                          fullPriceUSD,
                          floorUSD: FRANCHISE_FLOOR_USD,
                        },
                      },
                    },
                  );
                }
              }
            }
          } catch (splitErr) {
            console.error(
              `[Invoice] franchise_global directed_sale split failed for ${invoice.invoiceNumber}:`,
              splitErr,
            );
          }
        }

        // 4. Best-effort catalog sync (matches the original-sale path below).
        try {
          const { syncCatalogOwner } = await import("./franchiseCatalogSync");
          await syncCatalogOwner(
            assignment.geoLevel as any,
            String(assignment.geoEntityId),
            assignment.ownerEmail || null,
          );
        } catch (syncErr) {
          console.error(
            `[Invoice] franchise_global directed_sale catalog sync failed for ${invoice.invoiceNumber}:`,
            syncErr,
          );
        }

        return {
          type: "franchise_global",
          status: "directed_sale_completed",
        };
      }

      // Buyer-initiated resale (System A): entirely separate money-flow from
      // the platform-original-sale path below. On payment, transfer ownership,
      // PRESERVE the existing `expiresAt`, credit 100% of the paid amount to
      // the seller's store wallet at PLATFORM_ORG_ID (no platform floor cut),
      // cancel the seller's old recurring parent, and mint a fresh recurring
      // parent at the NEW full price with dueDate = preservedExpiresAt so the
      // next annual cycle bills correctly through the standard engine.
      const isBuyerResaleG =
        (invoice.metadata as any)?.kind === "buyer_resale" &&
        assignment.pendingResaleOffer &&
        String(assignment.pendingResaleOffer.resaleInvoiceId) ===
          String(invoice._id);

      if (isBuyerResaleG) {
        const p = assignment.pendingResaleOffer!;
        const preservedExpiresAt =
          assignment.subscription?.expiresAt || undefined;
        const oldSubInvoiceId = assignment.subscription?.invoiceId || null;
        const oldOwnerUserId = assignment.ownerUserId;

        // 1. Transfer ownership + apply the new agreed price. expiresAt is
        //    UNCHANGED — the new owner inherits the remaining cycle window.
        assignment.ownerUserId = p.buyerUserId;
        assignment.ownerEmail = p.buyerEmail;
        assignment.acquisitionType = "resale";
        assignment.priceUSD = p.agreedPriceUSD;
        assignment.status = "active";
        assignment.subscription = {
          ...(assignment.subscription as any),
          startedAt: assignment.subscription?.startedAt || now,
          expiresAt: preservedExpiresAt,
          lastPaymentInvoiceId: invoice._id,
        } as any;
        assignment.pendingResaleOffer = null;
        await assignment.save();

        // 2. Cancel the old recurring parent so it doesn't mint a renewal
        //    invoice for the seller anymore.
        if (
          oldSubInvoiceId &&
          String(oldSubInvoiceId) !== String(invoice._id)
        ) {
          await Invoice.updateOne(
            {
              _id: oldSubInvoiceId,
              cancelledAt: { $in: [null, undefined] },
            },
            { $set: { cancelledAt: now, status: "cancelled" } },
          );
        }

        // 3. Credit 100% of the paid amount to the seller's store wallet at
        //    PLATFORM_ORG_ID (matches where Shorupan gets credited on
        //    original global sales — the platform org is the canonical home
        //    for all global-catalog transactions). Platform + no founder cut
        //    on the resale itself.
        const paidUSD = invoice.totalAmount / 100;
        let sellerWalletTxId: any = null;
        if (paidUSD > 0 && oldOwnerUserId) {
          try {
            const { creditStoreWallet } = await import("./wallet");
            const { PLATFORM_ORG_ID } = await import("./commission");
            const { transaction } = await creditStoreWallet(
              String(invoice.userId), // payer (buyer) — descriptive
              String(oldOwnerUserId), // recipient (seller)
              PLATFORM_ORG_ID,
              paidUSD,
              `Franchise (global) buyer-resale (100% to seller): ${assignment.geoEntityName || assignment.geoEntityId}`,
              `Invoice ${invoice.invoiceNumber} — buyer resale, prorated`,
            );
            sellerWalletTxId = transaction._id;
            const { WalletTransaction } = await import(
              "../models/walletTransaction.model"
            );
            await WalletTransaction.updateOne(
              { _id: transaction._id },
              {
                $set: {
                  "metadata.franchiseGlobal": {
                    assignmentId: String(assignment._id),
                    kind: "global_buyer_resale_full",
                    offerId: (invoice.metadata as any)?.franchiseGlobalOfferId,
                    agreedFullPriceUSD: p.agreedPriceUSD,
                  },
                },
              },
            );
          } catch (walletErr) {
            console.error(
              `[Invoice] franchise_global buyer_resale seller credit failed for ${invoice.invoiceNumber}:`,
              walletErr,
            );
          }
        }

        // 4. Mint the follow-on recurring parent at the NEW full price. dueDate
        //    = preservedExpiresAt so it becomes the "next annual" invoice.
        //    sellerId = platform (matches original global sales — platform
        //    resumes revenue at the next annual cycle).
        let renewalParentId: any = null;
        try {
          const { User } = await import("../models/user.model");
          const { PLATFORM_ORG_ID, PLATFORM_USER_EMAIL } = await import(
            "./commission"
          );
          const platformUser = await User.findOne({
            email: PLATFORM_USER_EMAIL,
          })
            .select("_id")
            .lean();
          const buyer = await User.findById(p.buyerUserId)
            .select("email name")
            .lean<any>();
          if (platformUser) {
            const renewal = await createInvoice({
              organizationId: PLATFORM_ORG_ID,
              sellerId: String(platformUser._id),
              userId: String(p.buyerUserId),
              customerEmail: buyer?.email,
              customerName: buyer?.name,
              lineItems: [
                {
                  itemType: "franchise_global",
                  itemId: String(assignment._id),
                  itemName: `Franchise (global, annual) — ${assignment.geoEntityName || assignment.geoEntityId}`,
                  quantity: 1,
                  unitPrice: Math.round(p.agreedPriceUSD * 100),
                  originalCurrency: "USD",
                },
              ],
              itemCurrency: "USD",
              isRecurring: true,
              recurringPeriod: "yearly",
              dueDate: preservedExpiresAt,
              metadata: {
                franchiseGlobalAssignmentId: String(assignment._id),
                kind: "resale_renewal_parent",
                sourceOfferId: (invoice.metadata as any)?.franchiseGlobalOfferId,
                spawnedFromInvoiceId: String(invoice._id),
              },
            } as any);
            renewalParentId = (renewal as any)._id;
            await FranchiseGlobalAssignment.updateOne(
              { _id: assignment._id },
              {
                $set: {
                  "subscription.invoiceId": renewalParentId,
                  "subscription.startedAt":
                    assignment.subscription?.startedAt || now,
                  "subscription.expiresAt": preservedExpiresAt,
                },
              },
            );
          }
        } catch (renewalErr) {
          console.error(
            `[Invoice] franchise_global buyer_resale renewal-parent mint failed for ${invoice.invoiceNumber}:`,
            renewalErr,
          );
        }

        // 5. Stamp resolution refs on the offer row for audit trail.
        try {
          const { FranchiseGlobalOffer } = await import(
            "../models/franchiseGlobalOffer.model"
          );
          const offerId = (invoice.metadata as any)?.franchiseGlobalOfferId;
          if (offerId) {
            await FranchiseGlobalOffer.updateOne(
              { _id: offerId },
              {
                $set: {
                  "resolutionTxRefs.resaleInvoiceId": invoice._id,
                  "resolutionTxRefs.renewalParentInvoiceId": renewalParentId,
                  "resolutionTxRefs.sellerWalletTxId": sellerWalletTxId,
                },
              },
            );
          }
        } catch (stampErr) {
          console.error(
            `[Invoice] franchise_global buyer_resale offer stamp failed for ${invoice.invoiceNumber}:`,
            stampErr,
          );
        }

        return {
          type: "franchise_global",
          status: "buyer_resale_completed",
        };
      }

      // Resale path (Phase 2) — same shape as franchise_territory once the
      // reassign endpoints ship. For now, always original-sale/renewal path.
      const pr = assignment.pendingReassignment as any;
      const isResale =
        pr?.status === "approved" &&
        pr?.invoiceId &&
        String(pr.invoiceId) === String(invoice._id);

      let oldSubInvoiceId: any = null;
      let completedReassignmentId: any = null;
      if (isResale) {
        oldSubInvoiceId = assignment.subscription?.invoiceId || null;
        completedReassignmentId = pr?.reassignmentId || null;
        assignment.ownerUserId = pr.newOwnerUserId;
        assignment.ownerEmail = pr.newOwnerEmail;
        assignment.acquisitionType = "resale";
        assignment.acquiredReassignmentId = completedReassignmentId || undefined;
        assignment.subscription = {
          invoiceId: invoice._id,
          startedAt: now,
          expiresAt: getNextChargeDate(now, "yearly"),
          lastPaymentInvoiceId: invoice._id,
        } as any;
        assignment.status = "active";
        assignment.pendingReassignment = null;
      } else {
        const base =
          assignment.subscription?.expiresAt &&
          new Date(assignment.subscription.expiresAt) > now
            ? new Date(assignment.subscription.expiresAt)
            : now;
        assignment.status = "active";
        assignment.subscription = {
          ...(assignment.subscription as any),
          invoiceId: assignment.subscription?.invoiceId ?? invoice._id,
          startedAt: assignment.subscription?.startedAt ?? now,
          expiresAt: getNextChargeDate(base, "yearly"),
          lastPaymentInvoiceId: invoice._id,
        } as any;
        // Listing-claim path: promote the resale ask (listedPriceUSD)
        // to the NEW owner's historical `priceUSD`, then clear the
        // listing marker. Renewal invoices on the new owner will bill
        // `priceUSD` going forward. Self-buy / admin direct-assign
        // (no listedPriceUSD present) leaves priceUSD as-is.
        if (
          (invoice.metadata as any)?.claimedFromListing === true &&
          typeof (assignment as any).listedPriceUSD === "number"
        ) {
          assignment.priceUSD = (assignment as any).listedPriceUSD;
          (assignment as any).listedPriceUSD = null;
        }
      }
      await assignment.save();

      if (isResale && oldSubInvoiceId && String(oldSubInvoiceId) !== String(invoice._id)) {
        await Invoice.updateOne(
          { _id: oldSubInvoiceId, cancelledAt: { $in: [null, undefined] } },
          { $set: { cancelledAt: now, status: "cancelled" } }
        );
      }
      if (isResale && completedReassignmentId) {
        const { FranchiseReassignment } = await import(
          "../models/franchiseReassignment.model"
        );
        await FranchiseReassignment.updateOne(
          { _id: completedReassignmentId },
          { $set: { status: "completed", completedAt: now } }
        );
      }

      // ── Marketplace-listing markup + platform floor split ─────────────
      // Original-sale money-flow forks by origin:
      //   - `claimedFromListing`: split into platform floor $650 → Shorupan
      //     and (paid − $650) excess → listedByUserId. If lister IS Shorupan
      //     (fresh admin listing) both credits still land in the platform
      //     wallet — net same total, two ledger rows.
      //   - self-buy / admin direct-assign (no `claimedFromListing`): 100% of
      //     the paid amount → Shorupan, single ledger row. Unchanged.
      // Gateway-paid invoices skip both credits — gateway settled externally.
      const isListingClaim =
        (invoice.metadata as any)?.claimedFromListing === true &&
        !!assignment.listedByUserId;

      if (invoice.paymentPlatform === "store_wallet" && invoice.totalAmount > 0) {
        try {
          const { WalletTransaction } = await import(
            "../models/walletTransaction.model"
          );
          const { User } = await import("../models/user.model");
          const alreadyCredited = await WalletTransaction.findOne({
            "metadata.franchiseFloor.invoiceId": invoice._id.toString(),
          }).lean();
          if (!alreadyCredited) {
            const { creditStoreWallet } = await import("./wallet");
            const { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } = await import(
              "./commission"
            );
            const { FRANCHISE_PRICE_USD: FRANCHISE_FLOOR_USD } = await import(
              "../models/franchiseProgram.model"
            );
            const platformUser = await User.findOne({
              email: PLATFORM_USER_EMAIL,
            })
              .select("_id")
              .lean();
            if (platformUser) {
              const paidUSD = invoice.totalAmount / 100;
              const fullPriceUSD =
                (primaryItem.unitPrice ?? invoice.totalAmount) / 100;

              if (isListingClaim) {
                // Split: floor to Shorupan, excess to lister.
                const floorUSD = Math.min(FRANCHISE_FLOOR_USD, paidUSD);
                const excess = Math.min(
                  Math.round(
                    (fullPriceUSD - FRANCHISE_FLOOR_USD) * 100,
                  ) / 100,
                  Math.round(paidUSD * 100) / 100,
                );

                if (floorUSD > 0) {
                  const { transaction } = await creditStoreWallet(
                    invoice.userId.toString(),
                    platformUser._id.toString(),
                    PLATFORM_ORG_ID,
                    floorUSD,
                    `Franchise (global) floor: ${assignment.geoEntityName || assignment.geoEntityId}`,
                    `Invoice ${invoice.invoiceNumber} — store_wallet paid, listing claim`,
                  );
                  await WalletTransaction.updateOne(
                    { _id: transaction._id },
                    {
                      $set: {
                        "metadata.franchiseFloor": {
                          kind: "global_floor",
                          invoiceId: invoice._id.toString(),
                          invoiceNumber: invoice.invoiceNumber,
                          assignmentId: String(assignment._id),
                          geoLevel: assignment.geoLevel,
                          geoEntityId: assignment.geoEntityId,
                          claimedFromListing: true,
                        },
                      },
                    },
                  );
                  console.log(
                    `[Invoice] franchise_global floor $${floorUSD} → ${PLATFORM_USER_EMAIL} (invoice ${invoice.invoiceNumber}, listing claim)`,
                  );
                }

                if (excess > 0 && assignment.listedByUserId) {
                  const { transaction: markupTx } = await creditStoreWallet(
                    invoice.userId.toString(),
                    String(assignment.listedByUserId),
                    PLATFORM_ORG_ID,
                    excess,
                    `Franchise (global) sale markup: ${assignment.geoEntityName || assignment.geoEntityId}`,
                    `Invoice ${invoice.invoiceNumber} — listing claim, $${fullPriceUSD} price ($${FRANCHISE_FLOOR_USD} platform floor)`,
                  );
                  await WalletTransaction.updateOne(
                    { _id: markupTx._id },
                    {
                      $set: {
                        "metadata.franchiseGlobal": {
                          kind: "franchise_global_sale_markup",
                          invoiceId: invoice._id.toString(),
                          invoiceNumber: invoice.invoiceNumber,
                          assignmentId: String(assignment._id),
                          geoLevel: assignment.geoLevel,
                          geoEntityId: assignment.geoEntityId,
                          listedByUserId: String(assignment.listedByUserId),
                          fullPriceUSD,
                          floorUSD: FRANCHISE_FLOOR_USD,
                        },
                      },
                    },
                  );
                  console.log(
                    `[Invoice] franchise_global markup $${excess} → lister ${assignment.listedByUserId} (invoice ${invoice.invoiceNumber})`,
                  );
                }
              } else {
                // Legacy path — self-buy or admin direct-assign. 100% → Shorupan.
                const { transaction } = await creditStoreWallet(
                  invoice.userId.toString(),
                  platformUser._id.toString(),
                  PLATFORM_ORG_ID,
                  paidUSD,
                  `Franchise (global) ${assignment.geoLevel} sale: ${assignment.geoEntityName || assignment.geoEntityId}`,
                  `Invoice ${invoice.invoiceNumber} — store_wallet paid`,
                );
                await WalletTransaction.updateOne(
                  { _id: transaction._id },
                  {
                    $set: {
                      "metadata.franchiseFloor": {
                        kind: "global_floor",
                        invoiceId: invoice._id.toString(),
                        invoiceNumber: invoice.invoiceNumber,
                        assignmentId: String(assignment._id),
                        geoLevel: assignment.geoLevel,
                        geoEntityId: assignment.geoEntityId,
                      },
                    },
                  },
                );
                console.log(
                  `[Invoice] franchise_global floor $${paidUSD} → ${PLATFORM_USER_EMAIL} (invoice ${invoice.invoiceNumber})`,
                );
              }
            }
          }
        } catch (floorErr) {
          console.error(
            `[Invoice] franchise_global floor credit failed for ${invoice.invoiceNumber}:`,
            floorErr
          );
        }
      }

      // ── Catalog ownership sync (best-effort, non-blocking) ────────────
      // Write the assignment's owner onto the roam-admin catalog doc so
      // external consumers reading `ownerEmail` directly see the new owner
      // without needing to poll /franchise-api. Failure here does NOT
      // abort fulfilment — the paid buyer + assignment activation are
      // already committed above. See services/franchiseCatalogSync.ts for
      // the semantics rationale.
      try {
        const { syncCatalogOwner } = await import("./franchiseCatalogSync");
        await syncCatalogOwner(
          assignment.geoLevel as any,
          String(assignment.geoEntityId),
          assignment.ownerEmail || null
        );
      } catch (syncErr) {
        console.error(
          `[Invoice] franchise_global catalog sync failed for ${invoice.invoiceNumber}:`,
          syncErr
        );
      }

      return {
        type: "franchise_global",
        status: isResale ? "reassigned" : "activated",
      };
    }

    case "unilevel_plus": {
      // Unilevel Plus has its own purchase model and commission distributor.
      // Supports quantity > 1 for reserve licenses.
      const { UnilevelPlusPurchase } = await import("../models/unilevelPlusPurchase.model");
      const { getActiveUnilevelPlusPlan, getUserPurchase, distributeUnilevelPlusCommission } = await import(
        "../services/unilevelPlusCommission"
      );
      const { createReserveLicenses } = await import("../services/reserveLicense");

      const plan = await getActiveUnilevelPlusPlan();
      if (!plan) {
        console.error(`[Invoice] No active Unilevel Plus plan found — cannot fulfill ${invoice.invoiceNumber}`);
        return { type: "unilevel_plus", status: "no_active_plan" };
      }

      let quantity = primaryItem.quantity || 1;
      let startSeq = 0;
      let selfActivated = false;
      let selfPurchaseId: string | undefined;

      // Per-seat sale amount for commission (proportional to any coupon discount).
      // MUST use `subtotal` (pre-tax) not `totalAmount` — the latter includes
      // GST, and paying affiliates on the tax-inflated amount over-pays them
      // by 18% (this bug shipped a $10.62 direct-bonus on a $25 UP plan
      // instead of the correct $9.00). Fall back to totalAmount only for
      // legacy invoices that predate the subtotal field.
      // Amounts are in cents and already reflect any coupon discount.
      //
      // BUNDLE OVERRIDE — load-bearing. A "$25 licence + N-month term" bundle is
      // sold as ONE unilevel_plus invoice priced at the whole cart (e.g. $100),
      // because fulfilInvoice dispatches on lineItems[0] and cannot fulfil a
      // mixed-line invoice. Without this override the UP tree would distribute
      // on $100 instead of $25 — a 4x over-payment on every bundled purchase.
      // The licence is always attributed at its full $25 list; the bundle's
      // discount lands entirely on the subscription leg.
      const bundleMeta = (invoice.metadata as any)?.bundle;
      const commissionBaseCents =
        bundleMeta?.licenceUsd != null
          ? Math.round(Number(bundleMeta.licenceUsd) * 100)
          : (invoice.subtotal ?? invoice.totalAmount);
      const perSeatSaleAmount = commissionBaseCents / quantity / 100;
      const skipCommission = perSeatSaleAmount === 0;

      // Step A: If buyer doesn't already have UP, activate them with the first license
      const existing = await getUserPurchase(userId);
      if (!existing && quantity > 0) {
        const selfPaymentId = `reserve_${invoice._id}_0`;

        // Idempotent check: maybe we already created this on a previous attempt
        const existingByPayment = await UnilevelPlusPurchase.findOne({ paymentId: selfPaymentId });
        if (!existingByPayment) {
          const purchase = await UnilevelPlusPurchase.create({
            userId: new Types.ObjectId(userId),
            planId: plan._id,
            paymentId: selfPaymentId,
            amount: perSeatSaleAmount,
            currency: plan.currency,
            status: "active",
            purchasedAt: new Date(),
            metadata: {
              invoiceId: invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
              source: "invoice_fulfillment",
              reserveSeq: 0,
              couponCode: invoice.couponCode,
            },
          });
          selfPurchaseId = purchase._id.toString();
          // Downline-table Type column: activates "1Network Activated". Fire-and-forget.
          void refreshTypeFlags(userId);
        }

        // Distribute commissions for the buyer's own activation — proportional to paid amount
        if (!skipCommission) {
          try {
            await distributeUnilevelPlusCommission({
              buyerId: userId,
              planId: plan._id.toString(),
              saleAmount: perSeatSaleAmount,
              currency: plan.currency,
              paymentId: selfPaymentId,
              metadata: {
                invoiceId: invoice._id.toString(),
                invoiceNumber: invoice.invoiceNumber,
                source: "invoice_fulfillment",
                reserveSeq: 0,
                couponCode: invoice.couponCode,
              },
            });
          } catch (err) {
            console.error(`[Invoice] UP self-activation commission error:`, err);
          }
        } else {
          console.log(
            `[Invoice] UP self-activation: skipping commission (zero-pay coupon)`
          );
        }

        selfActivated = true;
        startSeq = 1;
        quantity--;
        console.log(`[Invoice] Unilevel Plus: buyer ${userId} activated (seq 0)`);

        // Update isGarageAffiliate on Bat246Distributor + recompute isQualified (4-step check)
        try {
          const { Bat246Distributor: BD } = await import("../bat246/models/bat246Distributor.model");
          const { Bat246PlacementNotification: BPN } = await import("../bat246/models/bat246PlacementNotifications.model");
          const distDoc = await BD.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { $setOnInsert: { isOfficeMember: false, hasBat246Membership: false, hasPurchasedProduct: false, isQualified: false } },
            { upsert: true, new: true, lean: true, setDefaultsOnInsert: false }
          ) as any;
          if (distDoc) {
            const isNowQualified = !!(distDoc.isOfficeMember && distDoc.hasBat246Membership && distDoc.hasPurchasedProduct);
            const upd: any = { isGarageAffiliate: true };
            if (!distDoc.isQualified && isNowQualified) { upd.isQualified = true; upd.qualifiedAt = new Date(); }
            await BD.updateOne({ userId: new Types.ObjectId(userId) }, upd);
            if (!distDoc.isQualified && isNowQualified) {
              try {
                const { maybeCreatePlacementNotification } = await import("../bat246/services/bat246.service");
                const { assignDistributorId } = await import("../bat246/services/bat246DistributorId.util");
                await assignDistributorId(userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
                await maybeCreatePlacementNotification(userId);
              } catch { /* non-fatal */ }
            }
            // Notify upline that this user purchased Unilevel Plus ($25)
            if (distDoc.bat246RefUserId) {
              const invoiceUser = await import("../models/user.model").then(m => m.User.findById(userId).select("name email").lean()) as any;
              BPN.create({ notificationType: "affiliate", qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: invoiceUser?.email || "", qualifiedUserName: invoiceUser?.name || "", uplineUserId: distDoc.bat246RefUserId }).catch(() => {});
            }
          }
        } catch { /* non-fatal */ }
      }

      // Combo offer: if the invoice was created via /checkout/create-combo-order
      // (metadata.combo set), issue the $0 first-cycle third-party invoice
      // here as well. Idempotent — verify-payment may have already done it;
      // activateComboFreeFirstMonth short-circuits on the existing combo
      // invoice. Failure is non-fatal: UP stays activated, the failure
      // reason is stamped on this invoice so the admin retry endpoint can
      // replay it.
      const combo = (invoice.metadata as any)?.combo as
        | {
            thirdPartyClientId?: string;
            productCode?: string;
            termMonths?: number;
            /**
             * Whether the free first month was still on offer when this cart
             * was created. Decided at checkout and carried here, so a payment
             * that clears after the 24-hour window closes still honours the
             * price the buyer was quoted.
             *
             * Undefined on carts created before this field existed — those
             * pre-date the window entirely and were all promised a free month,
             * so the default must be `true`.
             */
            freeFirstCycle?: boolean;
          }
        | undefined;
      const comboAlreadyDone = !!(invoice.metadata as any)?.comboCompletedAt;

      /**
       * Fallback: honour the 24-hour offer even when the cart never stamped it.
       *
       * The block below only fires when checkout put `metadata.combo` on the
       * invoice — i.e. the offer was opt-in at the client. Two checkout
       * endpoints exist and only one stamps it, so buyers routed through
       * `/checkout/create-order` silently missed the free month no matter how
       * fast they paid: one bought two minutes after completing his profile and
       * got nothing, while 10 of 19 recent carts did carry the intent.
       *
       * The offer is a property of WHEN someone bought, not which button the
       * frontend happened to call. So when no intent was stamped, re-check the
       * window here — at the moment the money actually cleared — and grant.
       *
       * Deliberately narrow:
       *   - only when `combo` is absent; a stamped cart keeps its own terms,
       *     including a `freeFirstCycle: false` that was priced accordingly
       *   - only while `comboWindowFor` is open, honouring the admin override
       *   - only when exactly one active third-party client exists, so this can
       *     never guess which product to hand out
       *   - assigned/reserve-gifted seats never reach here: they mint a
       *     UnilevelPlusPurchase directly, with no paid invoice to fulfil
       *
       * activateComboFreeFirstMonth is idempotent on (clientId, buyerId), so a
       * replayed fulfilment cannot produce a second free month.
       */
      let comboFallback: { thirdPartyClientId: string } | null = null;
      if (!combo?.thirdPartyClientId && !comboAlreadyDone) {
        try {
          const { comboWindowFor } = await import("./comboWindow");
          const buyerDoc = await import("../models/user.model").then((m) =>
            m.User.findById(userId)
              .select("profileCompletedAt offerExpiresAtOverride")
              .lean(),
          );
          const win = comboWindowFor(buyerDoc as any, new Date());
          if (win.open) {
            // Named, not counted — see services/comboClient.ts. Counting is
            // what let a second active client silently stop granting the
            // free month.
            const { resolveComboClient, comboClientProblem } = await import(
              "./comboClient"
            );
            const combo = await resolveComboClient();
            if (combo.client) {
              comboFallback = {
                thirdPartyClientId: String(combo.client._id),
              };
              console.log(
                `[Invoice] UP combo: no intent stamped on ${invoice.invoiceNumber} but the 24h window is open — granting the free month (client resolved by ${combo.reason})`,
              );
            } else {
              console.warn(
                `[Invoice] UP combo fallback skipped for ${invoice.invoiceNumber}: ${comboClientProblem(combo.reason)}`,
              );
            }
          }
        } catch (fbErr: any) {
          // Never let the fallback break fulfilment — the $25 licence is the
          // thing the buyer paid for and must always be delivered.
          console.error(
            `[Invoice] UP combo fallback check failed for ${invoice.invoiceNumber}:`,
            fbErr?.message ?? fbErr,
          );
        }
      }

      const effectiveCombo = combo?.thirdPartyClientId
        ? combo
        : comboFallback
          ? { ...comboFallback, freeFirstCycle: true }
          : undefined;

      if (effectiveCombo?.thirdPartyClientId && !comboAlreadyDone) {
        try {
          const { activateComboFreeFirstMonth } = await import("./comboActivation");
          const result = await activateComboFreeFirstMonth({
            buyerId: userId,
            clientId: effectiveCombo.thirdPartyClientId!,
            // Undefined on the fallback — the client's own productConfig then
            // picks the product, which is what the stamped carts resolve to
            // anyway (one active client, one recurring product).
            productCode: (effectiveCombo as any).productCode,
            triggerInvoiceId: invoice._id.toString(),
            nextTermMonths: (effectiveCombo as any).termMonths,
            // Present only when a term was purchased in the same cart; drives
            // the prepaid cycle-2 invoice. Post-window it is ALSO present for
            // monthly carts, because month 1 is paid for there too. Never set
            // on the fallback — that path is always a plain free first month.
            bundle: (invoice.metadata as any)?.bundle,
            // Default true: carts minted before this flag existed all carried
            // the free month, and the fallback only fires inside the window.
            freeFirstCycle: (effectiveCombo as any).freeFirstCycle !== false,
          });
          await Invoice.updateOne(
            { _id: invoice._id },
            {
              $set: {
                "metadata.comboCompletedAt": new Date(),
                "metadata.comboInvoiceId": result.invoice._id.toString(),
                "metadata.comboAlreadyExisted": result.alreadyExisted,
              },
              $unset: { "metadata.comboFailureReason": "" },
            }
          );
        } catch (comboErr: any) {
          console.error(
            `[Invoice] UP combo activation failed for ${invoice.invoiceNumber}:`,
            comboErr
          );
          await Invoice.updateOne(
            { _id: invoice._id },
            {
              $set: {
                "metadata.comboFailureReason":
                  comboErr?.message || String(comboErr),
                "metadata.comboFailedAt": new Date(),
              },
            }
          );
        }
      }

      // Step B: Remaining licenses go to reserve (with commissions distributed at buy time)
      let reserveCount = 0;
      if (quantity > 0) {
        // If buyer already had UP, all licenses go to reserve starting at seq 0
        if (!selfActivated) startSeq = 0;

        const licenses = await createReserveLicenses({
          userId,
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          planId: plan._id.toString(),
          planProductPrice: perSeatSaleAmount,
          planCurrency: plan.currency,
          count: quantity,
          startSeq,
          skipCommission,
        });
        reserveCount = licenses.length;
        console.log(`[Invoice] Unilevel Plus: ${reserveCount} reserve licenses created for ${invoice.invoiceNumber}`);
      }

      return {
        type: "unilevel_plus",
        status: selfActivated ? "activated_with_reserve" : "reserve_only",
        selfPurchaseId,
        reserveLicenses: reserveCount,
        totalLicenses: (selfActivated ? 1 : 0) + reserveCount,
      };
    }

    case "third_party_subscription": {
      const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
      const { distributeThirdPartySubscription } = await import("./commission");
      const { deliverInvoiceWebhook } = await import("./thirdPartyWebhook");

      if (!invoice.thirdPartyClientId) {
        console.error(
          `[Invoice] third_party_subscription invoice ${invoice.invoiceNumber} missing thirdPartyClientId`
        );
        return { type: "third_party_subscription", status: "missing_client" };
      }

      const client = await ThirdPartyClient.findById(invoice.thirdPartyClientId);
      if (!client) {
        console.error(
          `[Invoice] ThirdPartyClient ${invoice.thirdPartyClientId} not found for invoice ${invoice.invoiceNumber}`
        );
        return { type: "third_party_subscription", status: "client_not_found" };
      }

      // Top-up branch: variable-amount wallet credit. No commission distribution
      // (it's a partner-account top-up, not a marketplace sale) — just mark
      // commission-distributed=true (so the cron / dashboards treat it as
      // settled) and fire the webhook so the partner credits the user's
      // wallet on their side. Mirrors the existing subscription webhook shape;
      // the discriminator is metadata.kind="topup", which is forwarded in the
      // webhook payload.
      if ((invoice.metadata as any)?.kind === "topup") {
        invoice.commissionDistributed = true;
        await invoice.save();
        deliverInvoiceWebhook(invoice, client, "invoice.paid").catch((err) =>
          console.error("[Invoice] topup webhook dispatch failed:", err)
        );
        return {
          type: "third_party_subscription",
          status: "fulfilled_topup",
          amount: invoice.totalAmount,
        };
      }

      // The webhook MUST fire whenever a third-party invoice flips to paid —
      // even if our internal commission distribution or invoice.save() throws.
      // The third party's subscription period advancement is their own
      // accounting, independent of ours; they shouldn't be punished for
      // upstream bugs on our side. Previously the webhook lived inside the
      // try/catch that wrapped distributeThirdPartySubscription + save, so
      // any ParallelSaveError or Mongo write conflict swallowed silently
      // and the webhook never went out — that was the mohammedusmani2005
      // bug where 3 cascaded child invoices marked paid but NetworkChain's
      // currentPeriodEnd didn't advance.
      let result: any = {
        upPortion: 0,
        platformCreditAmount: 0,
        upDistributionId: null,
      };
      let fulfilStatus: "fulfilled" | "distribution_error" = "fulfilled";
      let distributionError: string | undefined;

      try {
        // Zero-pay short-circuit: invoice is $0 → nothing was collected, so
        // skip commission entirely (free combo month, 100%-off coupon).
        //
        // EXCEPT a bundle-prepaid cycle. Those carry totalAmount === 0 because
        // the cash was collected on the UP licence invoice, not because the
        // service was free — the real subscription revenue is in
        // `metadata.bundle.subUsd` and the affiliates are owed their months.
        const prepaidViaBundle = !!(invoice.metadata as any)?.prepaidViaBundle;
        if (invoice.totalAmount === 0 && !prepaidViaBundle) {
          console.log(
            `[Invoice] Third-party ${invoice.invoiceNumber}: zero-pay coupon, skipping commission`
          );
          invoice.commissionDistributed = true;
          await invoice.save();
        } else {
          result = await distributeThirdPartySubscription({
            invoice,
            paymentId: razorpayPaymentId,
            client,
          });
          invoice.commissionDistributed = true;
          await invoice.save();
        }
      } catch (err) {
        fulfilStatus = "distribution_error";
        distributionError = (err as Error).message;
        console.error(
          `[Invoice] Third-party distribution failed for ${invoice.invoiceNumber} (webhook will still fire):`,
          err
        );
      }

      // ALWAYS deliver the webhook — regardless of whether commission
      // distribution succeeded. Fire-and-forget; the function itself
      // handles retries + tracks delivery state on the invoice doc.
      deliverInvoiceWebhook(invoice, client, "invoice.paid").catch((err) =>
        console.error("[Invoice] webhook dispatch failed:", err)
      );

      return {
        type: "third_party_subscription",
        status: fulfilStatus,
        upPortion: result.upPortion,
        platformCreditAmount: result.platformCreditAmount,
        ...(distributionError ? { error: distributionError } : {}),
      };
    }

    case "bat246_membership": {
      const { Bat246Player } = await import("../bat246/models/bat246Player.model");
      const { Bat246Distributor } = await import("../bat246/models/bat246Distributor.model");
      const { StoreWallet } = await import("../models/storeWallet.model");
      const { Types: MongoTypes } = await import("mongoose");

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Idempotency: skip if membership already active with same or later expiry
      const existing = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) }).select("membershipActive membershipExpiresAt").lean() as any;
      const alreadyActive = existing?.membershipActive && existing?.membershipExpiresAt && new Date(existing.membershipExpiresAt) > new Date();
      if (!alreadyActive) {
        await Bat246Player.updateOne(
          { userId: new Types.ObjectId(userId) },
          { membershipActive: true, membershipExpiresAt: expiresAt }
        );
      }

      // Update distributor flag + recompute isQualified (4-step: office member + membership + product + unilevel plus)
      const dist = await Bat246Distributor.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $setOnInsert: { isOfficeMember: false, isGarageAffiliate: false, hasPurchasedProduct: false, isQualified: false } },
        { upsert: true, new: true, lean: true, setDefaultsOnInsert: false }
      ) as any;
      if (dist) {
        // isGarageAffiliate ($25 Garage Affiliate) dropped from
        // qualification on request. hasBat246Membership isn't checked
        // either — this IS the membership-activation path, setting it
        // true in the same update below.
        const isNowQualified = !!(dist.isOfficeMember && dist.hasPurchasedProduct);
        const distUpdate: any = { hasBat246Membership: true, membershipExpiresAt: expiresAt, isQualified: isNowQualified };
        if (!dist.isQualified && isNowQualified) distUpdate.qualifiedAt = new Date();
        await Bat246Distributor.updateOne({ userId: new Types.ObjectId(userId) }, distUpdate);
        if (!dist.isQualified && isNowQualified) {
          try {
            const { maybeCreatePlacementNotification } = await import("../bat246/services/bat246.service");
            const { assignDistributorId } = await import("../bat246/services/bat246DistributorId.util");
            await assignDistributorId(userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
            await maybeCreatePlacementNotification(userId);
          } catch { /* non-fatal */ }
        }
        // Notify upline that this user purchased $20 membership
        if (dist.bat246RefUserId) {
          try {
            const { Bat246PlacementNotification: BPN } = await import("../bat246/models/bat246PlacementNotifications.model");
            const memberUser = await import("../models/user.model").then(m => m.User.findById(userId).select("name email").lean()) as any;
            BPN.create({ notificationType: "membership", qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: memberUser?.email || "", qualifiedUserName: memberUser?.name || "", uplineUserId: dist.bat246RefUserId }).catch(() => {});
          } catch { /* non-fatal */ }
        }
      }

      // Credit Alan K's Bat246 store wallet (100% — no commission split for membership)
      // Use listed price (lineItems unitPrice), not saleAmount, so a 100%-off platform
      // coupon still credits the full $20 — mirrors the bat246 entry product behavior.
      const membershipCreditAmount = (invoice.lineItems?.[0]?.unitPrice ?? 0) / 100;
      if (membershipCreditAmount > 0) {
        const { WalletTransaction } = await import("../models/walletTransaction.model");
        let wallet = await StoreWallet.findOne({ userId: new Types.ObjectId(sellerId), orgId: new Types.ObjectId(orgId) });
        if (!wallet) {
          wallet = await StoreWallet.create({ userId: new Types.ObjectId(sellerId), orgId: new Types.ObjectId(orgId), balance: 0, currency: "USD", isActive: true });
        }
        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + membershipCreditAmount;
        wallet.balance = balanceAfter;
        wallet.lastTransactionAt = new Date();
        await wallet.save();

        await WalletTransaction.create({
          storeWalletId: wallet._id,
          walletType: "store",
          userId: new Types.ObjectId(sellerId),
          orgId: new Types.ObjectId(orgId),
          type: "credit",
          amount: membershipCreditAmount,
          currency: "USD",
          balanceBefore,
          balanceAfter,
          description: `Sale: ${invoice.lineItems?.[0]?.itemName || "Bat246 Annual Membership"}`,
          note: "Bat246 annual membership purchase. 100% credited to Alan K's store wallet.",
          relatedUserId: new Types.ObjectId(userId),
          metadata: {
            itemType: "bat246_membership",
            itemId: invoice.lineItems?.[0]?.itemId,
          },
          status: "completed",
        });
      }

      return { type: "bat246_membership", status: alreadyActive ? "already_active" : "activated" };
    }

    default:
      console.log(
        `[Invoice] No specific fulfillment handler for itemType: ${primaryItem.itemType}`
      );
      return { type: primaryItem.itemType, status: "payment_recorded" };
  }
}

// ============ Recurring Invoice Generation ============

/**
 * Generate draft invoices for recurring subscriptions due within 5 days.
 * Called by cron job daily. Only generates for our-managed billing (no razorpaySubscriptionId).
 */
/**
 * Generate the next child invoice for a single recurring parent.
 *
 * Called from two places:
 *   1. The on-payment trigger inside `fulfillInvoice` — fires the moment
 *      any invoice in a recurring chain flips to status=paid, so the next
 *      cycle's pending invoice exists in the founder's dashboard
 *      immediately instead of 25 days later.
 *   2. The daily `generateDueRecurringInvoices` cron — safety net that
 *      catches any parent the on-payment trigger missed (exception,
 *      race, transitional state).
 *
 * Idempotent by design: looks for an existing child with the same
 * `parentInvoiceId + recurringPaymentNumber` and bails before creating.
 * Both call paths share this guard so simultaneous invocations from the
 * trigger + the cron cannot duplicate.
 *
 * Returns the newly-created child invoice, or null if eligibility checks
 * fail / idempotency check finds an existing child.
 */
export async function generateNextChildInvoice(
  parent: IInvoice
): Promise<IInvoice | null> {
  // Eligibility checks — must match the cron's WHERE filter so we never
  // generate for a parent the cron would have skipped.
  if (!parent.isRecurring) return null;
  if (parent.parentInvoiceId) return null; // must be the chain root
  if (parent.cancelledAt) return null;
  if (parent.status !== "paid") return null; // can't chain off an unpaid parent

  // Razorpay-owns-the-cycles guard.
  //
  // Historic bug: this used to short-circuit on the mere presence of
  // `razorpaySubscriptionId`, but the channel /subscribe endpoint in
  // routes/feed.ts eagerly creates a Razorpay subscription plan + stamps
  // its id on the invoice at create-time, even when the customer ends up
  // paying via a different platform (store_wallet, stripe, crypto, etc.).
  // In that case Razorpay is NOT going to auto-charge — the sub id is a
  // dead pointer — and we own the next-cycle generation. The old guard
  // was orphaning every wallet-paid weekly/monthly channel subscription.
  //
  // Rule: only skip when Razorpay actually collected the payment
  // (paymentPlatform === "razorpay"). That's the case where Razorpay's
  // webhook will produce the next cycle's invoice and our cron would
  // duplicate. Every other paymentPlatform means we generate.
  if (
    parent.razorpaySubscriptionId &&
    parent.paymentPlatform === "razorpay"
  ) {
    return null;
  }

  // Compute the intended next payment number FIRST (stable key for dedup)
  const latestChild = await Invoice.findOne({ parentInvoiceId: parent._id })
    .sort({ recurringPaymentNumber: -1 })
    .lean();
  const nextPaymentNumber = latestChild
    ? (latestChild.recurringPaymentNumber || 1) + 1
    : (parent.recurringPaymentNumber || 1) + 1;

  // Idempotency: if a child already exists for THIS exact cycle, bail.
  // Uses recurringPaymentNumber (more precise than status alone).
  const existing = await Invoice.findOne({
    parentInvoiceId: parent._id,
    recurringPaymentNumber: nextPaymentNumber,
  });
  if (existing) return null;

  // This cycle is due when the PREVIOUS cycle's nextDueDate lands — chain off
  // the latest child, NOT the root. Every child carries parentInvoiceId=root,
  // so using parent.nextDueDate here made every cascade-minted cycle compute
  // the same date (root.nextDueDate + 1 period) and the schedule never advanced
  // (cycles 2/3/4 all landed on the same day). Chaining off latestChild makes
  // cycle N due one period after cycle N-1.
  const thisCycleDue = latestChild?.nextDueDate ?? parent.nextDueDate!;

  // ── Third-party term pricing ────────────────────────────────────────────
  // A third-party subscription's cycle length and price come from the term
  // selected on the parent (metadata.termMonths / pendingTermMonths), not from
  // the parent's own money fields — those stay a truthful record of cycle 1.
  // Everything else falls through to the legacy copy-the-parent behaviour.
  //
  // Resolved BEFORE nextNextDueDate because the term drives the interval.
  let childSubtotal = parent.subtotal;
  let childTax = parent.tax || 0;
  let childLineItems: any = parent.lineItems;
  let childPeriod = parent.recurringPeriod;
  let childInterval = intervalMonthsFor(parent);
  let termPricing: any = null;

  if (parent.thirdPartyClientId) {
    try {
      const { priceThirdPartyChildCycle } = await import("./thirdPartyTerms");
      termPricing = await priceThirdPartyChildCycle({
        parent,
        nextPaymentNumber,
        thisCycleDue,
      });
    } catch (err) {
      // Never let term pricing break the recurring chain — fall back to the
      // legacy copy so the customer still gets billed.
      console.error(
        `[Invoice] term pricing failed for ${parent.invoiceNumber}, using legacy copy:`,
        err
      );
    }
    if (termPricing) {
      childSubtotal = termPricing.subtotal;
      childTax = termPricing.tax;
      childLineItems = termPricing.lineItems;
      childPeriod = termPricing.recurringPeriod;
      childInterval = termPricing.recurringIntervalMonths;
    }
  }

  // The due date of the cycle AFTER this one (stored as this child's nextDueDate).
  const nextNextDueDate = getNextChargeDate(
    thisCycleDue,
    childPeriod || "monthly",
    childInterval
  );

  // Hoisted so both the trial-guard branch below AND the post-create
  // redemption bookkeeping at the end of this function can reference them.
  const { PlatformCouponRedemption } = await import(
    "../models/platformCouponRedemption.model"
  );

  const redemption = await PlatformCouponRedemption.findOne({
    parentInvoiceId: parent._id,
    status: "active",
  });

  let childDiscount = 0;
  let childCouponId: Types.ObjectId | undefined;
  let childCouponCode: string | undefined;

  // ============ Trial cycle guard (office_plan trial + any future free-N-cycle scheme) ============
  // Parents born with `metadata.trialCyclesTotal: N` (see
  // routes/officeCheckout.ts start-trial) have the first N cycles fully
  // discounted. The parent itself is cycle 1 and was already zero'd out
  // at create-time via `discount: subtotal + tax`. This block mirrors
  // that treatment for cycles 2..N by force-discounting the child to $0.
  // Cycle N+1 falls through with childDiscount=0 → bills the full plan
  // price and lands in the founder's dashboard as an unpaid invoice.
  //
  // Chosen over creating a synthetic PlatformCoupon for the trial: the
  // metadata is explicit ("this parent is a trial"), the check is
  // localized to the cron, and no fake coupon rows pollute reporting.
  // Takes precedence over any platform coupon (belt-and-suspenders — a
  // trial should always be free during the trial window).
  const trialCyclesTotal = Number(
    (parent.metadata as any)?.trialCyclesTotal || 0
  );
  const isWithinTrialWindow =
    trialCyclesTotal > 0 && nextPaymentNumber <= trialCyclesTotal;
  // Starter (office_free_plan): every cycle is $0 forever, not just the
  // first N. Force the same subtotal+tax discount as trial cycles so the
  // child bills 0 — the zero-pay branch below then auto-pays it. The
  // fulfillInvoice free-plan carve-out prevents the cascade from spinning.
  const isFreePlan =
    (parent.metadata as any)?.kind === "office_free_plan";

  if (isWithinTrialWindow || isFreePlan) {
    childDiscount = childSubtotal + childTax;
  } else if (redemption && nextPaymentNumber <= redemption.cycleCount) {
    // ============ Platform coupon: apply to this cycle if redemption is active ============
    // If the redemption's cycleCount has been exhausted, NO discount applies
    // and the child charges the full per-cycle amount — which causes the
    // auto-pay cascade to halt naturally (childTotalAmount > 0 →
    // fulfillInvoice is NOT called by the helper, the founder pays normally).
    const { applyRedemptionToChild } = await import("./platformCoupon");
    // Territory coupons discount only the $650 floor; compute the discount on
    // that base, then subtract it from the FULL subtotal so the buyer keeps
    // paying their price minus the floor cut.
    const parentItemType = parent.lineItems?.[0]?.itemType;
    const { discount } = await applyRedemptionToChild(
      redemption,
      couponBaseCents(parentItemType, childSubtotal),
      parent.itemCurrency
    );
    childDiscount = discount;
    childCouponId = redemption.couponId;
    childCouponCode = redemption.couponCode;
    // Same proration as createInvoice: the cycle's GST is owed on what the
    // redemption leaves payable, not on the list price. Without this a 100%
    // coupon cycle totals exactly the tax, stays unpaid, and the coupon's
    // remaining cycles never generate (the cron only walks paid parents).
    if (childDiscount > 0 && childTax > 0 && childSubtotal > 0) {
      const childTaxable = Math.max(0, childSubtotal - childDiscount);
      childTax = Math.round((childTax * childTaxable) / childSubtotal);
    }
  }

  // Always compute childTotalAmount from the parent's COMPONENT fields
  // (subtotal + tax + shipping − childDiscount).
  //
  // CRITICAL: never inherit `parent.totalAmount`. If the parent invoice was
  // itself coupon-driven to $0 (e.g. combo_free_first_month, or a 100% off
  // coupon on cycle 1), copying parent.totalAmount would make EVERY child
  // cycle also $0 — auto-paid by the cascade, forever. That was the
  // mohammedusmani2005 NetworkChain bug: 4 invoices generated and auto-paid
  // in 0.6s because cycle 4 (coupon exhausted) still inherited $0.
  //
  // By recomputing from parent.subtotal + tax + shipping, the only way a
  // child invoice's total is $0 is when childDiscount fully covers the
  // amount THIS CYCLE — i.e. the redemption is still active. Once the
  // redemption exhausts, childDiscount=0 and the cycle requires payment.
  //
  // This also makes the previous combo-parent special-case redundant —
  // combo's discount lives on the parent only; children naturally pay full
  // price under this formula because there's no childDiscount.
  //
  // `childSubtotal`/`childTax` are the parent's own values EXCEPT for
  // term-priced third-party subscriptions, where they come from the selected
  // term plan (with GST recomputed for the new base) — see the term block above.
  const childTotalAmount =
    childSubtotal - childDiscount + childTax + (parent.shippingCost || 0);

  const newInvoice = await Invoice.create({
    invoiceType: "recurring",
    status: "draft",
    organizationId: parent.organizationId,
    sellerId: parent.sellerId,
    userId: parent.userId,
    customerEmail: parent.customerEmail,
    customerName: parent.customerName,
    lineItems: childLineItems,
    subtotal: childSubtotal,
    discount: childDiscount,
    tax: childTax,
    shippingCost: 0,
    totalAmount: childTotalAmount,
    itemCurrency: parent.itemCurrency,
    isRecurring: true,
    recurringPeriod: childPeriod,
    recurringIntervalMonths: termPricing
      ? termPricing.recurringIntervalMonths
      : parent.recurringIntervalMonths,
    recurringPaymentNumber: nextPaymentNumber,
    parentInvoiceId: parent._id,
    nextDueDate: nextNextDueDate,
    referralId: parent.referralId,
    thirdPartyClientId: parent.thirdPartyClientId,
    couponId: childCouponId,
    couponCode: childCouponCode,
    // Per-cycle idempotency key. The collection has a unique index on
    // {thirdPartyClientId, thirdPartyExternalId}; leaving this null makes every
    // third-party child collide on {clientId, null}. Derive a deterministic,
    // unique-per-cycle id (only for third-party invoices) so children insert
    // cleanly and re-runs stay idempotent. Non-third-party parents → undefined.
    thirdPartyExternalId: parent.thirdPartyClientId
      ? `${parent.thirdPartyExternalId || parent._id.toString()}__cycle${nextPaymentNumber}`
      : undefined,
    expiresAt: new Date(thisCycleDue.getTime() + 7 * 24 * 60 * 60 * 1000),
    metadata: (() => {
      const md: Record<string, any> = {
        ...(parent.metadata as any),
        generatedByCron: true,
      };
      // Combo parent marker is one-time only — children are regular paid
      // cycles, so the kind discriminator must NOT propagate (otherwise
      // fulfillment would still hit the zero-pay branch).
      if (md.kind === "combo_free_first_month") {
        delete md.kind;
        md.parentWasCombo = true; // breadcrumb for analytics / debugging
      }
      // Subscription-level state that belongs to the chain ROOT only. Leaving
      // these on the child would (a) make a queued term change re-apply on
      // every subsequent cycle and (b) leak internal bookkeeping to the partner,
      // since the webhook forwards invoice.metadata verbatim.
      delete md.pendingTermMonths;
      delete md.termHistory;
      delete md.lastTermChange;
      delete md.commissionPartial;
      // Term pricing for THIS cycle — frozen here so commission distribution
      // reads the term the invoice was actually billed at, not whatever the
      // parent's mutable state says at payment time.
      if (termPricing) Object.assign(md, termPricing.metadataPatch);
      return md;
    })(),
  });

  // A queued term change has now been baked into a real invoice — promote it to
  // the parent's current term so cycle N+2 inherits the NEW term instead of
  // reverting. The parent's own money fields are deliberately left alone; only
  // metadata carries mutable subscription state.
  if (termPricing?.promoteFromPending) {
    await Invoice.updateOne(
      { _id: parent._id },
      {
        $set: { "metadata.termMonths": termPricing.termMonths },
        $unset: { "metadata.pendingTermMonths": "" },
      }
    );
    console.log(
      `[Invoice] ${parent.invoiceNumber}: promoted pending term → ${termPricing.termMonths} months`
    );
  }

  // If a coupon was applied, increment redemption.cyclesApplied (and mark
  // exhausted if done). Uses atomic $inc + returnDocument: "after" so two
  // simultaneous cascades on the same redemption produce monotonically-
  // increasing counts (instead of $set'ing the same read-then-write value
  // and losing one of the increments). Status flips to "exhausted" exactly
  // when the post-increment count reaches the cap.
  if (redemption && childCouponCode) {
    const updated = await PlatformCouponRedemption.findOneAndUpdate(
      { _id: redemption._id },
      { $inc: { cyclesApplied: 1 } },
      { new: true }
    );
    if (updated && (updated.cyclesApplied || 0) >= updated.cycleCount) {
      await PlatformCouponRedemption.updateOne(
        { _id: redemption._id, status: { $ne: "exhausted" } },
        { $set: { status: "exhausted" } }
      );
    }
  }

  // Zero-pay auto-paid branch: if coupon drove total to 0, mark paid + fulfill.
  // Note: fulfilling triggers the on-payment chain recursively, so coupon-
  // covered free cycles unfold automatically until either coupon exhausts or
  // childTotalAmount becomes non-zero (then waits for human payment).
  if (childTotalAmount === 0) {
    newInvoice.status = "paid";
    newInvoice.paidAt = new Date();
    await newInvoice.save();
    try {
      await fulfillInvoice(newInvoice, `coupon_zero_${newInvoice._id}`);
    } catch (err) {
      console.error(
        `[Invoice] zero-pay fulfill failed for ${newInvoice.invoiceNumber}:`,
        err
      );
    }
    console.log(
      `[Invoice] cycle ${nextPaymentNumber} of ${parent.invoiceNumber} auto-paid via coupon`
    );
  }

  // Notify user via socket (only for non-zero-pay; zero-pay is silent)
  if (childTotalAmount > 0) {
    const io = getSocketInstance();
    if (io) {
      io.to(`user:${parent.userId.toString()}`).emit("invoice:pending", {
        invoiceId: newInvoice._id.toString(),
        invoiceNumber: newInvoice.invoiceNumber,
        itemName: parent.lineItems[0]?.itemName || "Subscription",
        amount: childTotalAmount,
        currency: parent.itemCurrency,
        dueDate: parent.nextDueDate,
        paymentNumber: nextPaymentNumber,
      });
    }
  }

  return newInvoice;
}

export async function generateDueRecurringInvoices(): Promise<number> {
  const now = new Date();
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  // Find paid recurring invoices whose nextDueDate is within 5 days.
  // With the on-payment trigger in `fulfillInvoice`, the vast majority of
  // children are already generated at payment time — this cron acts as a
  // safety net for anything the trigger missed (exception, race, etc.).
  //
  // "Ours to manage" rule (mirrors the guard in generateNextChildInvoice):
  // a parent is ours to manage unless Razorpay actually collected the
  // payment (paymentPlatform === "razorpay") AND has a subscription id.
  // Wallet-, Stripe-, or crypto-paid invoices are ours to cycle even if
  // a Razorpay subscription id was eagerly stamped at create-time — the
  // old filter was orphaning every such recurring parent.
  const parentInvoices = await Invoice.find({
    isRecurring: true,
    status: "paid",
    nextDueDate: { $lte: fiveDaysFromNow, $gte: now },
    cancelledAt: { $in: [null, undefined] },
    parentInvoiceId: { $exists: false },
    $or: [
      // No Razorpay subscription id → always ours
      { razorpaySubscriptionId: { $exists: false } },
      { razorpaySubscriptionId: null },
      { razorpaySubscriptionId: "" },
      // Razorpay subscription id present BUT paid via a non-Razorpay
      // platform (wallet / stripe / crypto / …) → also ours
      {
        razorpaySubscriptionId: { $exists: true, $nin: [null, ""] },
        paymentPlatform: { $ne: "razorpay" },
      },
    ],
  });

  let created = 0;
  for (const parent of parentInvoices) {
    const child = await generateNextChildInvoice(parent);
    if (child) created++;
  }

  if (created > 0) {
    console.log(`[Invoice] Cron generated ${created} recurring invoices`);
  }
  return created;
}

// ─── Auto-charge (daily saved-card cron) ────────────────────────────────
//
// Pairs with the mint-child cron above. For every unpaid recurring child
// that has crossed its period-start date (`thisCycleDue`, derivable from
// `expiresAt - 7d`) and hasn't yet lapsed grace (`expiresAt > now`), pull
// the buyer's default Stripe card and attempt an off-session charge:
//
//   USD invoice          → always tries off_session (Stripe handles
//                          Indian presentment conversion transparently
//                          for Indian-issued cards billed in USD).
//   INR invoice + card.country !== "IN"
//                        → tries off_session as-is (foreign issuer, no
//                          RBI mandate rule).
//   INR invoice + card.country === "IN"
//                        → REQUIRES an active mandate on the card AND
//                          totalAmount ≤ mandateAmount. Otherwise
//                          skipped (RBI blocks off_session INR sans mandate).
//
// Cadence: once per day. The route-level cron already fires daily; a 20h
// throttle on `metadata.autoChargeLastAttemptAt` prevents duplicate runs
// (redeploy / manual re-invoke) from double-charging.
//
// Manual-pay protection: only invoices in `draft` or `failed` are picked
// up. `pending` (user mid-flow) is left alone. `paid` is obviously done.
//
// Decline handling: on the FIRST decline we send one email; subsequent
// declines are silent until the grace window closes, at which point
// `notifyAutoChargeGraceLapsed` sends the "we couldn't collect"
// heads-up before `expireStaleInvoices` flips the row to `expired`.

interface AutoChargeStats {
  attempted: number;
  succeeded: number;
  declined: number;
  skippedNoCard: number;
  skippedNoMandate: number;
  graceLapsedEmails: number;
}

export async function autoChargeRecurringInvoices(): Promise<AutoChargeStats> {
  const now = new Date();
  const stats: AutoChargeStats = {
    attempted: 0,
    succeeded: 0,
    declined: 0,
    skippedNoCard: 0,
    skippedNoMandate: 0,
    graceLapsedEmails: 0,
  };

  // ─── Pre-pass 1: release stale claims (crashed cron mid-charge) ───
  // If autoChargeInFlight has been set for > 15 min without resolution,
  // the previous cron process died between claim and Stripe response.
  // Free the invoice so this run (or the next) can retry. status stays
  // `pending` here because we don't know if the crashed run actually
  // hit Stripe — reconcileStalePendingAutoCharges below asks Stripe
  // directly using the idempotency-key PI if one exists.
  const staleClaimCutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const staleClaimed = await Invoice.updateMany(
    {
      "metadata.autoChargeInFlight": true,
      "metadata.autoChargeClaimedAt": { $lte: staleClaimCutoff.toISOString() },
    },
    {
      $unset: {
        "metadata.autoChargeInFlight": "",
        "metadata.autoChargeClaimedAt": "",
      },
    },
  );
  if (staleClaimed.modifiedCount > 0) {
    console.log(
      `[auto-charge] released ${staleClaimed.modifiedCount} stale claim(s)`,
    );
  }

  // ─── Pre-pass 2: reconcile orphaned pending PIs ───────────────────
  // Invoices where we left status=pending + stripePaymentIntentId set
  // (webhook was supposed to finalize) but no update in >2 hours.
  // Retrieve the PI from Stripe and settle to paid/failed accordingly.
  // Prevents the "invoice stays pending forever if webhook is missed"
  // failure mode.
  const reconciled = await reconcileStalePendingAutoCharges(now);
  if (reconciled > 0) {
    console.log(`[auto-charge] reconciled ${reconciled} stale pending PI(s)`);
  }

  // thisCycleDue = expiresAt - 7d. `now >= thisCycleDue` ⇔ `expiresAt <= now + 7d`.
  // Also require `expiresAt > now` so lapsed rows are handled by the
  // grace-lapse pass below instead.
  const dueThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const throttleThreshold = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  const candidates = await Invoice.find({
    isRecurring: true,
    parentInvoiceId: { $exists: true, $ne: null },
    status: { $in: ["draft", "failed"] },
    totalAmount: { $gt: 0 }, // zero-pay children auto-fulfill elsewhere
    expiresAt: { $lte: dueThreshold, $gt: now },
    $or: [
      { "metadata.autoChargeLastAttemptAt": { $exists: false } },
      { "metadata.autoChargeLastAttemptAt": { $lte: throttleThreshold } },
    ],
  }).limit(500);

  for (const inv of candidates) {
    stats.attempted++;
    try {
      const outcome = await autoChargeOneInvoice(inv, now);
      if (outcome === "succeeded") stats.succeeded++;
      else if (outcome === "declined") stats.declined++;
      else if (outcome === "no_card") stats.skippedNoCard++;
      else if (outcome === "no_mandate") stats.skippedNoMandate++;
    } catch (err) {
      console.error(
        `[auto-charge] ${inv.invoiceNumber} unexpected error:`,
        err,
      );
    }
  }

  // Second pass: invoices that finished grace since we last ran. Fire the
  // "we couldn't collect" email so the founder isn't surprised by the
  // office downgrade / community access cut that follows.
  stats.graceLapsedEmails = await notifyAutoChargeGraceLapsed(now);

  if (stats.attempted > 0 || stats.graceLapsedEmails > 0) {
    console.log(
      `[auto-charge] attempted=${stats.attempted} succeeded=${stats.succeeded} declined=${stats.declined} skippedNoCard=${stats.skippedNoCard} skippedNoMandate=${stats.skippedNoMandate} graceLapsedEmails=${stats.graceLapsedEmails}`,
    );
  }
  return stats;
}

type AutoChargeOutcome =
  | "succeeded"
  | "declined"
  | "no_card"
  | "no_mandate";

/**
 * Auto-debit one invoice against a UPI Autopay mandate.
 *
 * Mirrors the Stripe path deliberately — same atomic claim, same
 * `noteAutoChargeAttempt` bookkeeping, same decline email — so a UPI
 * subscriber behaves identically to a card subscriber everywhere except the
 * rail. Only the differences are spelled out below.
 *
 * The one behaviour with no Stripe analogue: a UPI debit above the RBI no-AFA
 * ceiling is ACCEPTED but waits on the payer approving it in their UPI app.
 * That is neither success nor decline. We leave the invoice `pending` with the
 * payment id recorded and let the webhook settle it, exactly as the Stripe
 * `processing` branch does.
 */
async function chargeViaUpiMandate(
  inv: IInvoice,
  now: Date,
  ctx: { buyer: any; customerId: string; mandate: any },
): Promise<AutoChargeOutcome> {
  const { customerId, mandate, buyer } = ctx;

  /**
   * Confirm the mandate is still alive at Razorpay before debiting.
   *
   * A payer can revoke or pause a mandate from inside their own UPI app, and
   * the bank can cancel one — none of which reaches us reliably, because
   * `token.cancelled` is a separately-subscribed webhook that our handler
   * always answers 200 to (so Razorpay never retries a miss). Observed in
   * production: two mandates showed "pending" locally while Razorpay had both
   * as "cancelled".
   *
   * Without this, a dead mandate produces a hard payment failure, a decline
   * email and a `failed` invoice — when the truthful outcome is "there is no
   * mandate, this invoice is payable by hand". One fetch per debit attempt,
   * which the 20h throttle already bounds.
   */
  {
    const { fetchCustomerToken, mandateStatusFromRecurring } = await import(
      "./razorpay"
    );
    const live = await fetchCustomerToken(customerId, mandate.id);
    if (live) {
      const status = mandateStatusFromRecurring(live?.recurring_details?.status);
      if (status !== "active") {
        const { User } = await import("../models/user.model");
        await User.updateOne(
          { _id: inv.userId, "paymentProfile.razorpay.tokens.id": mandate.id },
          { $set: { "paymentProfile.razorpay.tokens.$.mandateStatus": status } },
        );
        console.warn(
          `[UPI-AUTOPAY] 5/5 DEBIT-BLOCKED mandate ${mandate.id} is "${live?.recurring_details?.status}" at Razorpay (local said "${mandate.mandateStatus}") — skipping debit for ${inv.invoiceNumber} and marking ${status}`,
        );
        await noteAutoChargeAttempt(inv._id, {
          at: now.toISOString(),
          status: "skipped_no_mandate",
          error: `Mandate is ${live?.recurring_details?.status} at Razorpay`,
        });
        return "no_mandate";
      }
      console.log(
        `[UPI-AUTOPAY] 5/5 DEBIT ${inv.invoiceNumber} mandate ${mandate.id} confirmed live at Razorpay — charging`,
      );
    } else {
      // Lookup itself failed. Proceed and let the debit decide — a transient
      // Razorpay blip must not stall collection — but say so, otherwise a
      // silent skip of the safety check looks identical to a clean pass.
      console.warn(
        `[UPI-AUTOPAY] 5/5 DEBIT ${inv.invoiceNumber} could NOT verify mandate ${mandate.id} at Razorpay — proceeding on local state (${mandate.mandateStatus})`,
      );
    }
  }

  /**
   * Debit in the MANDATE's currency, not the invoice's.
   *
   * `inv.totalAmount` is always denominated in `itemCurrency`, which for both
   * office plans and NetworkChain is USD — while the mandate was registered in
   * INR, because `selectPaymentMethod` converted before minting the
   * registration order. Presenting "USD 11328" against an INR mandate is not a
   * near-miss; it is a different currency and a 90× different number.
   *
   * The Stripe branch of this same cron already resolves a target currency for
   * exactly this reason; the UPI branch simply never did. Nothing had caught it
   * because no mandate has ever existed to charge — it would have broken the
   * very first auto-renewal, whichever product got there first.
   *
   * Reusing `convertCurrency` (the helper registration uses) rather than
   * recomputing keeps the debit consistent with what was authorised.
   */
  const mandateCurrency = "INR"; // UPI mandates are always INR-denominated
  let debitAmount = inv.totalAmount;
  if ((inv.itemCurrency || "").toUpperCase() !== mandateCurrency) {
    try {
      const conversion = await convertCurrency(
        inv.totalAmount,
        inv.itemCurrency,
        mandateCurrency,
      );
      debitAmount = conversion.convertedAmount;
    } catch (err: any) {
      // Without a rate we cannot know what to charge. Refusing is correct —
      // guessing would debit the wrong amount against a standing authority.
      await noteAutoChargeAttempt(inv._id, {
        at: now.toISOString(),
        status: "skipped_no_mandate",
        error: `Could not convert ${inv.itemCurrency}→${mandateCurrency}: ${err?.message ?? err}`,
      });
      return "no_mandate";
    }
  }

  // The mandate's own ceiling. Charging above it is rejected by Razorpay, so
  // catch it here and report it as a mandate problem rather than a decline —
  // the fix is re-authorisation, not a retry.
  //
  // Compare LIKE FOR LIKE: `maxAmount` is INR paise, so it must be checked
  // against the converted debit, not against `inv.totalAmount` in USD cents.
  // The old comparison was meaningless and only ever passed because the paise
  // figure was numerically larger — which stopped being safe once caps were
  // sized per plan instead of a blanket ₹50,000.
  if (mandate.maxAmount && debitAmount > Number(mandate.maxAmount)) {
    await noteAutoChargeAttempt(inv._id, {
      at: now.toISOString(),
      status: "skipped_no_mandate",
      error: `Amount ${debitAmount} paise exceeds mandate cap ${mandate.maxAmount} paise`,
    });
    return "no_mandate";
  }

  // Same claim as the Stripe path — see the long comment there.
  const claimed = await Invoice.findOneAndUpdate(
    {
      _id: inv._id,
      status: { $in: ["draft", "failed"] },
      "metadata.autoChargeInFlight": { $ne: true },
    },
    {
      $set: {
        status: "pending",
        "metadata.autoChargeInFlight": true,
        "metadata.autoChargeClaimedAt": now.toISOString(),
      },
    },
    { new: true },
  );
  if (!claimed) return "declined";

  const releaseClaim = { $unset: { "metadata.autoChargeInFlight": "", "metadata.autoChargeClaimedAt": "" } };

  try {
    const { chargeUpiMandate } = await import("./razorpay");
    const result = await chargeUpiMandate({
      amount: debitAmount,
      currency: mandateCurrency,
      customerId,
      tokenId: mandate.id,
      description: `Auto-renewal: ${inv.lineItems?.[0]?.itemName || inv.invoiceNumber}`,
      notes: {
        invoiceId: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        userId: String(inv.userId),
        autoChargeCron: "true",
        email: buyer?.email || inv.customerEmail || "",
      },
    });

    if (result.requiresApproval) {
      // Money not taken yet. Stay `pending` so the webhook can finish it.
      //
      // `razorpayOrderId` is the load-bearing field here: the
      // payment.captured / payment.failed handlers correlate back to an
      // invoice ONLY by order id, and this order was minted server-side, not
      // by the browser. Without writing it the debit could never be matched
      // and the invoice would sit pending forever.
      await Invoice.updateOne(
        { _id: inv._id },
        {
          $set: {
            razorpayOrderId: result.orderId,
            "metadata.razorpayRecurringPaymentId": result.paymentId,
            "metadata.autoChargedAt": now.toISOString(),
          },
          ...releaseClaim,
        },
      );
      await noteAutoChargeAttempt(inv._id, {
        at: now.toISOString(),
        status: "pending_approval",
        error: `Awaiting payer approval in UPI app (status: ${result.status})`,
      });
      // Counted as succeeded for stats parity with Stripe's `processing`
      // branch — the attempt did what it could and nothing is owed a retry
      // this run.
      return "succeeded";
    }

    if (result.status === "captured") {
      const updated = await Invoice.findOneAndUpdate(
        { _id: inv._id, status: { $ne: "paid" } },
        {
          $set: {
            status: "paid",
            paidAt: new Date(),
            paymentPlatform: "razorpay",
            paymentMethodCategory: "upi",
            razorpayOrderId: result.orderId,
            razorpayPaymentId: result.paymentId,
            "metadata.razorpayRecurringPaymentId": result.paymentId,
            "metadata.autoChargedAt": now.toISOString(),
          },
          ...releaseClaim,
        },
        { new: true },
      );
      if (updated) {
        await fulfillInvoice(updated, `auto_charge_upi_${result.paymentId}`);
      }
      return "succeeded";
    }

    throw new Error(`UPI debit did not settle (status: ${result.status})`);
  } catch (err: any) {
    await Invoice.updateOne(
      { _id: inv._id },
      {
        $set: {
          status: "failed",
          failedAt: new Date(),
          errorDescription: err?.message ?? String(err),
          "metadata.autoChargeLastAttemptAt": now.toISOString(),
        },
        ...releaseClaim,
      },
    );
    const priorAttempts = ((inv.metadata as any)?.autoChargeAttempts || []) as any[];
    await noteAutoChargeAttempt(inv._id, {
      at: now.toISOString(),
      status: "declined",
      error: err?.message ?? String(err),
    });
    // Email on the FIRST failure only — same rule as the card path, so a
    // week of retries doesn't become a week of emails.
    if (priorAttempts.length === 0) {
      await notifyAutoChargeDecline(
        inv,
        buyer,
        err?.message ?? String(err),
      ).catch(() => {});
    }
    return "declined";
  }
}

async function autoChargeOneInvoice(
  inv: IInvoice,
  now: Date,
): Promise<AutoChargeOutcome> {
  const { User } = await import("../models/user.model");
  const buyer: any = await User.findById(inv.userId)
    .select("_id email name paymentProfile")
    .lean();

  const customerId = buyer?.paymentProfile?.stripe?.customerId as
    | string
    | undefined;
  const methods = (buyer?.paymentProfile?.stripe?.methods || []) as any[];
  // Prefer the explicitly-defaulted card; fall back to whichever is
  // most-recently-added so a lone card still wins.
  const defaultCard =
    methods.find((m) => m.isDefault) ||
    [...methods].sort(
      (a, b) =>
        new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime(),
    )[0];

  /**
   * UPI Autopay branch.
   *
   * Cards stay on Stripe; UPI mandates are Razorpay. A user can have both, so
   * the Stripe card wins when present — it is the proven path and needs no
   * payer approval. UPI is used when there is no chargeable Stripe card, which
   * is exactly the population that was being skipped as `no_card` and never
   * billed at all.
   *
   * Gated on mandateStatus === "active", never on the token merely existing:
   * a payer can revoke in their UPI app and leave the token row behind.
   */
  const rzpCustomerId = buyer?.paymentProfile?.razorpay?.customerId as
    | string
    | undefined;
  const upiMandate = ((buyer?.paymentProfile?.razorpay?.tokens || []) as any[])
    .filter(
      (t) =>
        t?.method === "upi" &&
        t?.mandateId &&
        t?.mandateStatus === "active" &&
        (!t.mandateExpiresAt || new Date(t.mandateExpiresAt) > now),
    )
    .sort(
      (a, b) =>
        Number(!!b.isDefault) - Number(!!a.isDefault) ||
        new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime(),
    )[0];

  const hasStripeCard = !!customerId && !!defaultCard?.id;

  if (!hasStripeCard && rzpCustomerId && upiMandate) {
    return chargeViaUpiMandate(inv, now, {
      buyer,
      customerId: rzpCustomerId,
      mandate: upiMandate,
    });
  }

  if (!hasStripeCard) {
    await noteAutoChargeAttempt(inv._id, {
      at: now.toISOString(),
      status: "skipped_no_card",
    });
    return "no_card";
  }

  const isINRInvoice =
    (inv.itemCurrency || inv.paymentCurrency || "USD").toUpperCase() === "INR";
  const isIndianCard = defaultCard.country === "IN";

  // Renew in the currency the buyer chose. `totalAmount` is in itemCurrency
  // (USD/INR) and that is what the card is charged for a USD/INR payer. A
  // buyer who settled the first cycle in CAD/EUR/GBP keeps being billed in
  // it — the recurring child copies the parent's paymentCurrency — so the
  // amount is re-converted at today's rate and the FX stamped on the
  // invoice, exactly as select-payment does for a manual payment.
  const itemCur = (inv.itemCurrency || "USD").toUpperCase();
  const chosenPayCur = String(inv.paymentCurrency || "").toUpperCase();
  const renewInExtraCurrency =
    (EXTRA_PAYMENT_CURRENCIES as readonly string[]).includes(chosenPayCur) &&
    chosenPayCur !== itemCur;
  let chargeAmount = inv.totalAmount;
  let chargeCurrency = isINRInvoice ? "inr" : "usd";
  let paidCurrencyLabel = isINRInvoice ? "INR" : "USD";
  let renewalConversion: ICurrencyConversion | undefined;
  if (renewInExtraCurrency) {
    const conv = await convertCurrency(inv.totalAmount, itemCur, chosenPayCur);
    chargeAmount = conv.convertedAmount;
    chargeCurrency = chosenPayCur.toLowerCase();
    paidCurrencyLabel = chosenPayCur;
    renewalConversion = {
      fromCurrency: itemCur,
      toCurrency: chosenPayCur,
      exchangeRate: conv.exchangeRate,
      convertedAt: now,
    };
  }

  // RBI: off-session INR on an Indian card requires a live mandate.
  // Foreign cards billed in INR + any card billed in USD go through
  // without a mandate.
  let mandateArg: string | undefined;
  if (isINRInvoice && isIndianCard) {
    const mandateOk =
      !!defaultCard.mandateId &&
      defaultCard.mandateStatus === "active" &&
      !!defaultCard.mandateAmount &&
      inv.totalAmount <= Number(defaultCard.mandateAmount);
    if (!mandateOk) {
      await noteAutoChargeAttempt(inv._id, {
        at: now.toISOString(),
        status: "skipped_no_mandate",
      });
      return "no_mandate";
    }
    mandateArg = defaultCard.mandateId;
  }

  // ─── ATOMIC CLAIM (double-charge defense, layer 2) ────────────────
  //
  // Before any Stripe call, atomically transition the invoice to a
  // "held-by-cron" state so:
  //   (a) A parallel cron run can't also claim it (findOneAndUpdate
  //       filter requires autoChargeInFlight != true).
  //   (b) The manual-pay path can't reset the invoice while our PI is
  //       in flight — selectPaymentMethod checks autoChargeInFlight
  //       and refuses.
  //
  // Status is flipped to `pending` (an existing enum value) so any
  // other code path that treats pending as "someone else is paying"
  // already respects it. If the claim fails (concurrent claim or the
  // invoice was already paid/expired), we bail — this attempt didn't
  // happen.
  const claimed = await Invoice.findOneAndUpdate(
    {
      _id: inv._id,
      status: { $in: ["draft", "failed"] },
      "metadata.autoChargeInFlight": { $ne: true },
    },
    {
      $set: {
        status: "pending",
        "metadata.autoChargeInFlight": true,
        "metadata.autoChargeClaimedAt": now.toISOString(),
      },
    },
    { new: true },
  );
  if (!claimed) {
    // Someone else has it (parallel cron, manual pay, or it already
    // moved to a terminal state). Don't touch.
    return "declined"; // benign — just means this run does nothing
  }

  // Stamp the FX BEFORE the charge, not only on the success branch: a PI
  // that lands in `processing` is settled later by the reconciler, which
  // learns the currency from the PI but not the rate — and fulfilment
  // needs the rate to denominate the order in what was actually paid.
  if (renewalConversion) {
    await Invoice.updateOne(
      { _id: inv._id },
      { $set: { currencyConversion: renewalConversion } },
    );
  }

  // Stripe idempotency key — per-invoice, per-day. If Node crashes
  // between paymentIntents.create returning and our DB write, the
  // next cron run using the SAME key returns the SAME PaymentIntent
  // instead of billing the card a second time. Date is UTC-based so
  // it's stable across container restarts.
  const dayKey = now.toISOString().slice(0, 10); // yyyy-mm-dd
  const idempotencyKey = `auto-charge-${inv._id.toString()}-${dayKey}`;

  let pi: any;
  try {
    pi = await chargeSavedPaymentMethod({
      customerId,
      paymentMethodId: defaultCard.id,
      amountInSmallestUnit: chargeAmount,
      currency: chargeCurrency,
      offSession: true,
      ...(mandateArg ? { mandate: mandateArg } : {}),
      idempotencyKey,
      metadata: {
        invoiceId: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        userId: String(inv.userId),
        orgId: String(inv.organizationId || ""),
        autoChargeCron: "true",
      } as any,
      description: `Auto-renewal: ${inv.lineItems?.[0]?.itemName || inv.invoiceNumber}`,
      receiptEmail: inv.customerEmail,
    });
  } catch (err: any) {
    const msg = err?.raw?.message || err?.message || "Unknown Stripe error";
    const priorAttempts =
      ((inv.metadata as any)?.autoChargeAttempts || []) as any[];
    // Release the claim + flip status back to `failed` so tomorrow's
    // cron picks it up cleanly and the manual pay path re-opens.
    await Invoice.updateOne(
      { _id: inv._id },
      {
        $set: { status: "failed", failedAt: now, errorDescription: msg },
        $unset: {
          "metadata.autoChargeInFlight": "",
          "metadata.autoChargeClaimedAt": "",
        },
        $push: {
          "metadata.autoChargeAttempts": {
            at: now.toISOString(),
            status: "declined",
            error: msg,
          },
        },
      },
    );
    await Invoice.updateOne(
      { _id: inv._id },
      { $set: { "metadata.autoChargeLastAttemptAt": now.toISOString() } },
    );
    if (priorAttempts.length === 0) {
      await notifyAutoChargeDecline(inv, buyer, msg);
    }
    return "declined";
  }

  const chargeId =
    typeof pi.latest_charge === "string" ? pi.latest_charge : null;

  if (pi.status === "succeeded") {
    // Terminal success — flip to paid + fulfil. fulfillInvoice is
    // idempotent (checks status="paid" before running distributions),
    // so a webhook that arrives after we've already fulfilled is a
    // no-op.
    const updated = await Invoice.findOneAndUpdate(
      {
        _id: inv._id,
        status: { $ne: "paid" }, // idempotency guard vs. concurrent webhook
      },
      {
        $set: {
          status: "paid",
          paidAt: now,
          paymentPlatform: "stripe",
          paymentMethodCategory: "card",
          paymentCurrency: paidCurrencyLabel,
          ...(renewalConversion ? { currencyConversion: renewalConversion } : {}),
          "metadata.stripePaymentIntentId": pi.id,
          "metadata.stripeChargeId": chargeId,
          "metadata.autoChargedAt": now.toISOString(),
          "metadata.autoChargeLastAttemptAt": now.toISOString(),
        },
        $unset: {
          "metadata.autoChargeInFlight": "",
          "metadata.autoChargeClaimedAt": "",
        },
        $push: {
          "metadata.autoChargeAttempts": {
            at: now.toISOString(),
            status: "succeeded",
            piId: pi.id,
          },
        },
      },
      { new: true },
    );
    if (updated) {
      try {
        await fulfillInvoice(updated, `auto_charge_${pi.id}`);
      } catch (err) {
        console.error(
          `[auto-charge] fulfill error for ${inv.invoiceNumber}:`,
          err,
        );
      }
    }
    return "succeeded";
  }

  if (pi.status === "processing") {
    // In-flight at Stripe / issuer. Poll briefly — INR MIT often
    // settles in <15s and we'd rather resolve inside the cron than
    // leave the invoice in `pending`. If it still hasn't settled after
    // the poll window, we retrieve one final time; whichever status
    // wins, we resolve to paid or failed. This upholds the "no invoice
    // left pending after cron finishes" invariant.
    const POLL_ATTEMPTS = 6;
    const POLL_INTERVAL_MS = 5000; // total ~30s
    const stripeClient = getStripeClient();
    let finalPi: any = pi;
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      try {
        finalPi = await stripeClient.paymentIntents.retrieve(pi.id);
      } catch (_) {
        // transient — try again next tick
      }
      if (finalPi.status !== "processing") break;
    }

    if (finalPi.status === "succeeded") {
      const finalCharge =
        typeof finalPi.latest_charge === "string"
          ? finalPi.latest_charge
          : null;
      const updated = await Invoice.findOneAndUpdate(
        { _id: inv._id, status: { $ne: "paid" } },
        {
          $set: {
            status: "paid",
            paidAt: now,
            paymentPlatform: "stripe",
            paymentMethodCategory: "card",
            paymentCurrency: paidCurrencyLabel,
            ...(renewalConversion ? { currencyConversion: renewalConversion } : {}),
            "metadata.stripePaymentIntentId": finalPi.id,
            "metadata.stripeChargeId": finalCharge,
            "metadata.autoChargedAt": now.toISOString(),
            "metadata.autoChargeLastAttemptAt": now.toISOString(),
          },
          $unset: {
            "metadata.autoChargeInFlight": "",
            "metadata.autoChargeClaimedAt": "",
          },
          $push: {
            "metadata.autoChargeAttempts": {
              at: now.toISOString(),
              status: "succeeded_after_poll",
              piId: finalPi.id,
            },
          },
        },
        { new: true },
      );
      if (updated) {
        try {
          await fulfillInvoice(updated, `auto_charge_${finalPi.id}`);
        } catch (err) {
          console.error(
            `[auto-charge] fulfill (post-poll) error for ${inv.invoiceNumber}:`,
            err,
          );
        }
      }
      return "succeeded";
    }

    if (finalPi.status === "processing") {
      // Still not settled after ~30s. Leave the PI id + status=pending
      // and release the in-flight flag so the webhook is the ONLY
      // remaining path that can flip paid. Manual-pay path sees status
      // pending + stripePaymentIntentId set and refuses (guard added
      // in selectPaymentMethod), so no double-charge risk.
      //
      // The 20h throttle prevents tomorrow's cron from re-charging;
      // the reconcileStalePendingAutoCharges sweeper handles cases
      // where the webhook never arrives.
      await Invoice.updateOne(
        { _id: inv._id },
        {
          $set: {
            "metadata.stripePaymentIntentId": finalPi.id,
            "metadata.autoChargedAt": now.toISOString(),
            "metadata.autoChargeLastAttemptAt": now.toISOString(),
          },
          $unset: {
            "metadata.autoChargeInFlight": "",
            "metadata.autoChargeClaimedAt": "",
          },
          $push: {
            "metadata.autoChargeAttempts": {
              at: now.toISOString(),
              status: "processing_left_for_webhook",
              piId: finalPi.id,
            },
          },
        },
      );
      // Not a decline — Stripe hasn't rejected. Treat as succeeded for
      // stats so we don't count it as failed.
      return "succeeded";
    }

    // Final status is not succeeded/processing → treat as decline below
    pi = finalPi;
  }

  // requires_action / requires_payment_method / canceled / etc.
  // Off-session shouldn't produce these but if it does, resolve to
  // failed so tomorrow's cron picks up and manual retry re-opens.
  const priorAttempts =
    ((inv.metadata as any)?.autoChargeAttempts || []) as any[];
  const reason = `Charge did not settle off-session (status: ${pi.status})`;
  await Invoice.updateOne(
    { _id: inv._id },
    {
      $set: {
        status: "failed",
        failedAt: now,
        errorDescription: reason,
        "metadata.autoChargeLastAttemptAt": now.toISOString(),
      },
      $unset: {
        "metadata.autoChargeInFlight": "",
        "metadata.autoChargeClaimedAt": "",
      },
      $push: {
        "metadata.autoChargeAttempts": {
          at: now.toISOString(),
          status: "unexpected",
          piId: pi.id,
          piStatus: pi.status,
        },
      },
    },
  );
  if (priorAttempts.length === 0) {
    await notifyAutoChargeDecline(inv, buyer, reason);
  }
  return "declined";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * For every invoice that auto-charge left in `pending` with a
 * Stripe PI attached but hasn't been touched in >2 hours, ask Stripe
 * directly and settle. Upholds the "no invoice stays pending forever"
 * invariant when the webhook is missed / delayed.
 */
async function reconcileStalePendingAutoCharges(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const orphans = await Invoice.find({
    status: "pending",
    "metadata.stripePaymentIntentId": { $exists: true, $ne: null },
    "metadata.autoChargedAt": { $exists: true, $lte: cutoff.toISOString() },
    "metadata.autoChargeInFlight": { $ne: true },
  }).limit(200);

  if (orphans.length === 0) return 0;
  const stripeClient = getStripeClient();
  let settled = 0;

  for (const inv of orphans) {
    const piId = (inv.metadata as any)?.stripePaymentIntentId as
      | string
      | undefined;
    if (!piId) continue;
    let pi: any;
    try {
      pi = await stripeClient.paymentIntents.retrieve(piId);
    } catch (err) {
      console.error(
        `[auto-charge] reconcile: retrieve ${piId} failed:`,
        err,
      );
      continue;
    }

    if (pi.status === "succeeded") {
      const chargeId =
        typeof pi.latest_charge === "string" ? pi.latest_charge : null;
      // The PI is the record of what was charged — same source the Stripe
      // webhook uses. (A CAD/EUR/GBP renewal already stamped its
      // currencyConversion on the invoice when the charge was made.)
      const paidCurrencyLabel = String(
        pi.currency ||
          ((inv.itemCurrency || inv.paymentCurrency || "USD").toUpperCase() === "INR"
            ? "INR"
            : "USD"),
      ).toUpperCase();
      const updated = await Invoice.findOneAndUpdate(
        { _id: inv._id, status: { $ne: "paid" } },
        {
          $set: {
            status: "paid",
            paidAt: now,
            paymentPlatform: "stripe",
            paymentMethodCategory: "card",
            paymentCurrency: paidCurrencyLabel,
            "metadata.stripeChargeId": chargeId,
            "metadata.autoChargeReconciledAt": now.toISOString(),
          },
          $push: {
            "metadata.autoChargeAttempts": {
              at: now.toISOString(),
              status: "succeeded_via_reconcile",
              piId,
            },
          },
        },
        { new: true },
      );
      if (updated) {
        try {
          await fulfillInvoice(updated, `auto_charge_reconcile_${piId}`);
        } catch (err) {
          console.error(
            `[auto-charge] reconcile fulfill error for ${inv.invoiceNumber}:`,
            err,
          );
        }
      }
      settled++;
    } else if (
      pi.status === "canceled" ||
      pi.status === "requires_payment_method" ||
      pi.status === "requires_action"
    ) {
      await Invoice.updateOne(
        { _id: inv._id },
        {
          $set: {
            status: "failed",
            failedAt: now,
            errorDescription: `Stripe PI resolved to ${pi.status} (reconciled)`,
          },
          $push: {
            "metadata.autoChargeAttempts": {
              at: now.toISOString(),
              status: "failed_via_reconcile",
              piId,
              piStatus: pi.status,
            },
          },
        },
      );
      settled++;
    }
    // Still `processing`? Leave it another 2h — some INR MIT settlements
    // legitimately take longer. Next cron will re-check.
  }

  return settled;
}

async function noteAutoChargeAttempt(
  invoiceId: any,
  entry: Record<string, any>,
): Promise<void> {
  await Invoice.updateOne(
    { _id: invoiceId },
    {
      $push: { "metadata.autoChargeAttempts": entry },
      $set: { "metadata.autoChargeLastAttemptAt": entry.at },
    },
  );
}

async function notifyAutoChargeDecline(
  inv: IInvoice,
  buyer: any,
  reason: string,
): Promise<void> {
  const to = inv.customerEmail || buyer?.email;
  if (!to) return;
  try {
    const { sendMail, EMAIL_FROM_NOTIFICATION, senderForOrg } = await import("./mailer");
    const invoiceUrl = `${process.env.FRONTEND_URL || "https://my.garage.app"}/invoice/${inv._id}`;
    const amount = ((inv.totalAmount || 0) / 100).toFixed(2);
    const currency = (
      inv.itemCurrency ||
      inv.paymentCurrency ||
      "USD"
    ).toUpperCase();
    const itemName = inv.lineItems?.[0]?.itemName || "your subscription";
    const subject = `Auto-renewal failed for ${itemName}`;
    const html = `
      <p>Hi${buyer?.name ? ` ${buyer.name}` : ""},</p>
      <p>We tried to auto-charge your saved card for invoice
      <strong>${inv.invoiceNumber}</strong> (${currency} ${amount}) but it
      was declined:</p>
      <blockquote style="color:#666;border-left:3px solid #ddd;padding-left:12px;margin:12px 0">
        ${escapeHtml(reason)}
      </blockquote>
      <p>We'll try again once a day for the next 7 days. To avoid a
      service interruption, please either update your card or complete
      payment manually:</p>
      <p><a href="${invoiceUrl}"
         style="display:inline-block;background:#FBD10D;color:#000;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
         Pay invoice ${inv.invoiceNumber}
      </a></p>
      <p style="color:#888;font-size:13px">— Garage</p>
    `;
    await sendMail(
      to,
      subject,
      html,
      undefined,
      // Seller's own domain when that office has one verified.
      await senderForOrg((inv as any)?.organizationId)
    );
  } catch (err) {
    console.error("[auto-charge] decline email failed:", err);
  }
}

/**
 * Invoices that had at least one auto-charge attempt but exhausted the
 * grace window without success. Emails the founder once, then flags the
 * row so we don't re-mail on the next cron pass. Runs BEFORE
 * expireStaleInvoices so status is still draft/failed here.
 */
async function notifyAutoChargeGraceLapsed(now: Date): Promise<number> {
  const lapsed = await Invoice.find({
    isRecurring: true,
    parentInvoiceId: { $exists: true, $ne: null },
    status: { $in: ["draft", "failed"] },
    expiresAt: { $lte: now },
    "metadata.autoChargeAttempts.0": { $exists: true },
    "metadata.autoChargeGraceLapsedEmailSent": { $ne: true },
  }).limit(500);

  if (lapsed.length === 0) return 0;

  const { User } = await import("../models/user.model");
  const { sendMail, EMAIL_FROM_NOTIFICATION, senderForOrg } = await import("./mailer");
  let sent = 0;

  for (const inv of lapsed) {
    const to = inv.customerEmail;
    if (!to) {
      // Still stamp the flag so we don't re-scan it every day.
      await Invoice.updateOne(
        { _id: inv._id },
        { $set: { "metadata.autoChargeGraceLapsedEmailSent": true } },
      );
      continue;
    }
    const buyer: any = await User.findById(inv.userId).select("name").lean();
    const amount = ((inv.totalAmount || 0) / 100).toFixed(2);
    const currency = (
      inv.itemCurrency ||
      inv.paymentCurrency ||
      "USD"
    ).toUpperCase();
    const itemName = inv.lineItems?.[0]?.itemName || "your subscription";
    const invoiceUrl = `${process.env.FRONTEND_URL || "https://my.garage.app"}/invoice/${inv._id}`;
    try {
      await sendMail(
        to,
        `We couldn't renew ${itemName}`,
        `
          <p>Hi${buyer?.name ? ` ${buyer.name}` : ""},</p>
          <p>We spent the last 7 days trying to auto-charge your saved
          card for invoice <strong>${inv.invoiceNumber}</strong>
          (${currency} ${amount}) and each attempt was declined.</p>
          <p>The invoice will now expire. If your subscription needs
          reactivating, please update your card and pay manually:</p>
          <p><a href="${invoiceUrl}"
             style="display:inline-block;background:#FBD10D;color:#000;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
             Open invoice ${inv.invoiceNumber}
          </a></p>
          <p style="color:#888;font-size:13px">— Garage</p>
        `,
        undefined,
        EMAIL_FROM_NOTIFICATION,
      );
      await Invoice.updateOne(
        { _id: inv._id },
        { $set: { "metadata.autoChargeGraceLapsedEmailSent": true } },
      );
      sent++;
    } catch (err) {
      console.error(
        `[auto-charge] grace-lapse email failed for ${inv.invoiceNumber}:`,
        err,
      );
    }
  }
  return sent;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============ Helpers ============

/**
 * Validate that the payment method category is compatible with the chosen currency.
 */
function validatePaymentMethodCurrency(
  category: PaymentMethodCategory,
  currency: string
): void {
  if (category === "upi" && currency !== "INR") {
    throw new Error("UPI payments are only available for INR currency");
  }
  // Crypto is now supported via NOWPayments
}

/**
 * Convert amount between currencies using live exchange rates.
 * Returns the converted amount in the target currency's smallest unit.
 */
async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ convertedAmount: number; exchangeRate: number }> {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, exchangeRate: 1 };
  }

  if (fromCurrency === "USD" && toCurrency === "INR") {
    // Amount is in cents, convert to INR paise
    const amountInDollars = amount / 100;
    const { inrAmount, exchangeRate } = await convertUsdToInr(amountInDollars);
    return {
      convertedAmount: Math.round(inrAmount * 100), // Convert to paise
      exchangeRate,
    };
  }

  if (fromCurrency === "INR" && toCurrency === "USD") {
    // Amount is in paise, convert to USD cents
    const amountInRupees = amount / 100;
    const { usdAmount, exchangeRate } = await convertInrToUsd(amountInRupees);
    return {
      convertedAmount: Math.round(usdAmount * 100), // Convert to cents
      exchangeRate,
    };
  }

  // Any other pair of supported fiat currencies (USD/INR-priced invoice paid
  // in CAD/EUR/GBP, and the reverse for the crypto USD-cents ask). Every
  // supported currency uses 1/100 minor units, so the rate is applied to the
  // minor-unit integer directly and cross-rated through USD:
  //   from → USD → to  ⇒  rate = (USD→to) / (USD→from)
  // `exchangeRate` is stored as from→to, the same orientation the two
  // branches above record, so `currencyConversion` reads the same everywhere.
  if (isSupportedFiatCurrency(fromCurrency) && isSupportedFiatCurrency(toCurrency)) {
    const [usdToFrom, usdToTo] = await Promise.all([
      getUsdToRate(fromCurrency),
      getUsdToRate(toCurrency),
    ]);
    const exchangeRate = usdToTo / usdToFrom;
    return {
      convertedAmount: Math.round(amount * exchangeRate),
      exchangeRate,
    };
  }

  throw new Error(
    `Unsupported currency conversion: ${fromCurrency} → ${toCurrency}`
  );
}
