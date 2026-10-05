import mongoose, { Schema, Document, Types } from "mongoose";
import { SUPPORTED_FIAT_CURRENCIES } from "../utils/exchangeRate";

// ============ Enums ============

export type InvoiceType = "one_time" | "recurring";

export type InvoiceStatus =
  | "draft"
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "expired";

export type InvoiceItemType =
  | "product"
  | "course"
  | "channel"
  | "service"
  | "call"
  | "workshop"
  | "office_plan"
  | "unilevel_plus"
  | "third_party_subscription"
  | "ecommerce_item"
  | "bat246_membership"
  | "franchise_program"
  | "franchise_territory"
  // Global-catalog franchise entity (country / territory / sub-territory)
  // sold via the Garage invoice engine (System A). Fulfilment upserts a
  // FranchiseGlobalAssignment. `metadata.geoLevel` disambiguates the level;
  // one itemType is sufficient (mirrors the single `franchise_territory`
  // itemType covering all three System B levels via metadata).
  | "franchise_global"
  // Buyer-funded top-up of their own per-org StoreWallet. Not a sale —
  // no commission distribution, no platform coupon, no UP routing. The
  // invoice fulfills by crediting StoreWallet[userId, organizationId]
  // for the totalAmount (USD). Mirrors the third-party `metadata.kind=topup`
  // pattern. itemId points at the destination org so the FE can render
  // "Top up Store Wallet · Org Name" without any extra joins.
  | "store_wallet_topup"
  // Buyer-funded top-up of their Auction Wallet — the prepaid balance that
  // backs storefront auction bids. Same shape as store_wallet_topup but the
  // wallet is global per user rather than per-org, so itemId points at the
  // destination USER. Always billed in USD; the buyer may still pay in INR and
  // the standard currencyConversion handles it. Not a sale — on the
  // commission-skip list in fulfillInvoice.
  | "auction_wallet_topup"
  // Per-month, per-extra-conference-room charge. $5/room × quantity. Rides
  // its own recurring parent Invoice (separate from the office_plan invoice
  // by design — Shorupan wants them as distinct documents even when paid
  // together). Non-commissionable for now ($5 is too small to split).
  | "office_addon"
  // Ad-hoc admin charge: super-admin bills a saved card for an arbitrary
  // amount + free-form description, not tied to a Product/Course/Channel.
  // Used for penalties, custom fees, retroactive charges, advances, etc.
  // fulfillInvoice hits the default no-op branch — money moves via Stripe,
  // invoice acts as the ledger row, no commissions / no coupon / no
  // subscription. `metadata.type = "admin_adhoc_charge"` +
  // `metadata.initiatedByGarageAdminId` are the audit trail.
  | "admin_adhoc"
  // Whitelabel add-on — $600 USD/yr (+18% GST when Indian-billed).
  // Founder self-serves from Domain Management. Payment charged
  // immediately against a saved card. On paid, fulfillInvoice's
  // whitelabel_addon case upserts an OfficeAddonSubscription doc so
  // `hasActiveAddon(orgId, "white-label")` flips true, and credits 50%
  // of the base ($300 USD) to the buyer's direct referrer's Affiliate
  // Wallet. Yearly renewal via cron + off_session charge.
  | "whitelabel_addon"
  // Cryptosub — $600 USD/yr yearly subscription auto-provisioned for
  // cryptobrand-flagged orgs alongside the Pro office plan. Same
  // commission shape as whitelabel_addon (3-bucket $150 direct + $144
  // cascade + $6 platform, plus $150/sale monthly volume bonus when a
  // referrer clears ≥10 sales/month) but its own access gate
  // (`hasActiveAddon(orgId, "cryptosub")`). Fulfillment via
  // services/cryptosubAddonPurchase.ts.
  | "cryptosub"
  // HiFi investment payment — one invoice per hifi_investment_application
  // ready to settle at the "Pay" step. Priced + billed in the investor's
  // chosen currency (USD/INR/ETH/BTC, mapped from the application's
  // free-text currency). Invoice metadata carries `hifiApplicationId`,
  // `hifiProductId`, and `allowedWalletCurrencies` so the FE payment
  // selector shows the matching sibling wallet. Fulfillment
  // (services/hifiInvoiceFulfillment.ts) marks the application paid,
  // upserts a hifi_investment_subscription, and escrows the principal in
  // the founder-org StoreWallet. No default commission distribution —
  // the hifi seller app owns the affiliate/payout mechanics.
  | "hifi_investment"
  // HiFi bond — a fixed-income instrument issued by a CRYPTO-OFFICE
  // founder (see HIFI_BONDS_PLAN.md). One invoice per purchase of N
  // units; minted and paid from the buyer's store wallet server-side in
  // the same request, then shown as an already-paid receipt rather than
  // sending the buyer to a checkout page. Fulfillment
  // (services/bondInvoiceFulfillment.ts) creates the bond_holding,
  // pre-creates every scheduled payout event, and passes the principal
  // through to the founder's wallet.
  //
  // Distinct from `hifi_investment`: that one bridges an application
  // owned by the external garage-seller-hifi app, whereas a bond is
  // issued, sold and serviced entirely inside this backend.
  | "hifi_bond"
  // A ticket to a founder-run EventProgram (the /event-management module).
  // itemId is the EventTicketTier; `metadata.eventRegistrationId` points at the
  // EventRegistration the buyer created at checkout, and fulfillment flips that
  // registration to paid (+ approved, unless the event requires approval).
  // Separate from `workshop` because an event is a multi-tier, multi-attendee
  // program — reusing the workshop branch would try to enrol the buyer in a
  // Workshop that does not exist.
  | "event_ticket";

/**
 * Map an invoice line item's itemType to the corresponding platform-coupon
 * productType. Most names match 1:1 (e.g. "product" → "product"). Only
 * `ecommerce_item` differs because ecommerce coupons are scoped to the whole
 * cart, not per-line.
 */
export function couponProductTypeForItem(
  itemType: InvoiceItemType
):
  | "product"
  | "course"
  | "channel"
  | "service"
  | "call"
  | "workshop"
  | "office_plan"
  | "unilevel_plus"
  | "third_party_subscription"
  | "ecommerce"
  | "franchise_program"
  | "franchise_territory" {
  if (itemType === "ecommerce_item") return "ecommerce";
  if (itemType === "bat246_membership") return "product";
  // Both franchise invoice types are couponable (admin-only), but with
  // DIFFERENT coupon product types so a program coupon can't be applied to a
  // territory invoice and vice-versa. Territory coupons discount only the $650
  // floor (handled where the discount base is computed — see couponBaseCents).
  if (itemType === "franchise_program") return "franchise_program";
  if (itemType === "franchise_territory") return "franchise_territory";
  // Global-catalog franchise sales are couponable through the same
  // "franchise_territory" coupon bucket (they're conceptually territory sales
  // sold platform-side rather than office-side). If a distinct coupon type
  // is later needed, split here.
  if (itemType === "franchise_global") return "franchise_territory";
  // Store Wallet top-ups don't accept platform coupons — caller is funding
  // their own balance, not buying anything. The createInvoice callers /
  // checkout entry points reject coupons on these invoices upstream, so
  // this mapping is never reached; fall back to "product" to keep the
  // return type narrow.
  if (itemType === "store_wallet_topup") return "product";
  // Auction Wallet top-ups are non-couponable for the same reason.
  if (itemType === "auction_wallet_topup") return "product";
  // Office conference-room addons (`$5/month per extra room`) ride on a
  // separate recurring invoice from the office plan and aren't couponable
  // — there's no UI for applying a coupon to room billing. Fall back to
  // "product" for the same reason as store_wallet_topup: the upstream
  // callers don't pass `couponCode` on rooms invoices, so this branch is
  // unreachable in practice.
  if (itemType === "office_addon") return "product";
  // Ad-hoc admin charges don't accept coupons — admin sets an arbitrary
  // amount + description, no product to base a discount on. The
  // charge-adhoc route never passes couponCode, so this branch is
  // unreachable in practice; falls back to "product" only to satisfy
  // the narrow return-type contract.
  if (itemType === "admin_adhoc") return "product";
  // Whitelabel add-on is not couponable — the price is fixed at $600/yr
  // and the purchase endpoint never accepts a coupon. Fall back to
  // "product" to satisfy the narrow return-type contract.
  if (itemType === "whitelabel_addon") return "product";
  // Cryptosub — coupons off by design (same as whitelabel_addon).
  if (itemType === "cryptosub") return "product";
  // HiFi investment payment — coupons off by design (a discount on
  // principal would confuse the payout math). Fall back to "product"
  // to keep the return type narrow; the /hifi/applications/:id/invoice
  // route never passes a coupon anyway.
  if (itemType === "hifi_investment") return "product";
  // HiFi bond — coupons off by design, same reasoning as hifi_investment
  // but stronger: the payout schedule is derived from unit price, so a
  // discount would make the holding owe interest on money never paid.
  if (itemType === "hifi_bond") return "product";
  // Event tickets ARE couponable, through the same founder/platform engine as
  // everything else. Platform coupons on an event invoice are resolved by
  // createInvoice; the bucket they draw from is "workshop" because an event is
  // a live, dated program and Garage-admin coupon inventory is organised that
  // way — a dedicated "event" product type would need its own admin UI for no
  // behavioural difference.
  if (itemType === "event_ticket") return "workshop";
  return itemType;
}

export type PaymentMethodCategory = "card" | "upi" | "crypto" | "wallet";

export type PaymentPlatform =
  | "razorpay"
  | "stripe"
  | "openmoney"
  | "square"
  | "phonepe"
  | "paytm"
  | "crypto_wallet"
  | "store_wallet"
  | "affiliate_wallet"
  // Auction win settled straight out of escrow — no gateway was involved at
  // settlement time (the buyer's money moved when they placed the bid).
  | "auction_wallet";

// ============ Sub-document Interfaces ============

export interface IInvoiceLineItem {
  itemType: InvoiceItemType;
  itemId: Types.ObjectId;
  // Set on variant ecommerce lines — references the productvariants doc that
  // was actually purchased, so downstream fulfillment isn't variant-blind.
  variantId?: Types.ObjectId;
  itemName: string;
  itemDescription?: string;
  itemImage?: string;
  quantity: number;
  unitPrice: number; // In the item's original currency smallest unit (paise/cents)
  totalPrice: number; // unitPrice * quantity
  originalCurrency: string; // Currency the item was listed in
  // Multi-HQ ecommerce support — set on `ecommerce_item` line items, optional
  // for legacy single-seller flows (which fall back to invoice-level fields).
  organizationId?: Types.ObjectId;
  sellerId?: Types.ObjectId;
  storeId?: Types.ObjectId;
  vendor?: string; // Human-readable seller name (e.g. "Garage Beauty") for UI
  // ── Drop attribution — set only on lines added via a drop's "Buy now". ──
  // Drives the drop-creator commission split at fulfillment. dropCreatorId is a
  // client-reported hint; the real payee is re-resolved from the storedrops doc.
  dropProduct?: boolean;
  dropId?: string;
  dropCreatorId?: Types.ObjectId;
  dropCreatorName?: string;
  // Live selling: the session this line was bought from (workshop + the
  // UTC day key of the session). Set when the buyer came from a pinned
  // product during a live stream.
  liveWorkshopId?: Types.ObjectId;
  liveSessionDate?: string;
  // ── Counter bills (services/counterBill.ts) ──
  // Add-ons folded into unitPrice, listed so the receipt can show them.
  addOns?: Array<{ label: string; price: number }>;
  // Absent on catalogue lines. "custom" = an amount-only bill, "charge" =
  // service charge / packaging. Their itemId is the CounterBill _id, not a
  // storeproduct, so fulfilment must not treat them as stock.
  lineKind?: "custom" | "charge";
}

export interface ICurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  convertedAt: Date;
}

export interface IShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

// ============ Main Interface ============

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;

  // Parties
  organizationId: Types.ObjectId;
  sellerId: Types.ObjectId;
  userId: Types.ObjectId;
  customerEmail: string;
  customerName?: string;

  // Line items
  lineItems: IInvoiceLineItem[];

  // Pricing (all in paymentCurrency smallest unit)
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  totalAmount: number;

  // Currency
  itemCurrency: string;
  paymentCurrency: string;
  currencyConversion?: ICurrencyConversion;

  // Payment method
  paymentMethodCategory?: PaymentMethodCategory;
  paymentPlatform?: PaymentPlatform;
  // Where the payment originated. Drives Apple's 30% fee math at fulfillment:
  // "ios" triggers the appleFee branch in services/invoice.ts; "web"/"android"
  // never do. Default "web" — kept optional so existing rows don't need a
  // migration.
  paymentSource?: "web" | "ios" | "android";

  // Gateway references
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySubscriptionId?: string;
  razorpayInvoiceId?: string;
  invoiceShortUrl?: string;

  // Timestamps
  paidAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
  expiresAt?: Date;

  // Recurring
  isRecurring: boolean;
  recurringPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
  /**
   * Months covered by one cycle. Authoritative for multi-month terms (3/6/12)
   * where `recurringPeriod` can't express the length — 6 has no enum slot, and
   * adding one risks `getNextChargeDate`'s silent +1-month fallback. Absent on
   * every pre-term invoice, which reads as 1 via `intervalMonthsFor()`.
   */
  recurringIntervalMonths?: number;
  recurringPaymentNumber?: number;
  parentInvoiceId?: Types.ObjectId;
  subscriptionRef?: Types.ObjectId;
  nextDueDate?: Date;

  // Coupon
  couponId?: Types.ObjectId;
  couponCode?: string;
  couponUsageId?: Types.ObjectId;

  // Cashback — populated when the buyer's input code resolved to a
  // CashbackCode (not a PlatformCoupon). Drives the post-paid cashback
  // hook in fulfillInvoice → executeCashback.
  cashbackCodeId?: Types.ObjectId;

  // Shipping
  shippingAddress?: IShippingAddress;
  billingAddress?: IShippingAddress;
  paymentMode?: "Prepaid" | "COD";
  gstin?: string;
  companyName?: string;
  customerNote?: string;

  // Referral
  referralId?: string;

  // Metadata
  metadata?: Record<string, any>;
  notes?: string;

  // Commission
  commissionDistributed: boolean;
  commissionDistributionId?: Types.ObjectId;

  // Error tracking
  errorCode?: string;
  errorDescription?: string;

  // Third-party integration
  thirdPartyClientId?: Types.ObjectId;
  thirdPartyExternalId?: string;
  webhookDelivery?: {
    attempts: number;
    lastAttemptAt?: Date;
    lastStatus?: number;
    deliveredAt?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

// ============ Sub-document Schemas ============

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    itemType: {
      type: String,
      enum: [
        "product",
        "course",
        "channel",
        "service",
        "call",
        "workshop",
        "office_plan",
        "unilevel_plus",
        "third_party_subscription",
        "ecommerce_item",
        "bat246_membership",
        "franchise_program",
        "franchise_territory",
        "franchise_global",
        "store_wallet_topup",
        "auction_wallet_topup",
        "office_addon",
        // Admin ad-hoc charge — arbitrary amount + description billed
        // to a saved card via /garage-admin/users/:userId/saved-cards/
        // :pmId/charge-adhoc. fulfillInvoice hits the default no-op
        // branch. Must be in this runtime enum array (Mongoose doesn't
        // read the TS type union) or every adhoc-charge invoice save
        // fails validation.
        "admin_adhoc",
        // Whitelabel add-on — see the InvoiceItemType union above for
        // the full flow. Same TS/runtime-sync rule as admin_adhoc.
        "whitelabel_addon",
        // Cryptosub — see the InvoiceItemType union above for the full
        // flow. Same TS/runtime-sync rule.
        "cryptosub",
        // HiFi investment — see the InvoiceItemType union above.
        // Same TS/runtime-sync rule.
        "hifi_investment",
        // HiFi bond — see the InvoiceItemType union above.
        // Same TS/runtime-sync rule.
        "hifi_bond",
        // Event ticket — see the InvoiceItemType union above.
        // Same TS/runtime-sync rule.
        "event_ticket",
      ],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },
    itemName: {
      type: String,
      required: true,
    },
    itemDescription: {
      type: String,
    },
    itemImage: {
      type: String,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    originalCurrency: {
      type: String,
      enum: ["USD", "INR"],
      required: true,
    },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    sellerId: { type: Schema.Types.ObjectId, ref: "User" },
    storeId: { type: Schema.Types.ObjectId, ref: "Store" },
    vendor: { type: String },
    // ── Drop attribution (only on drop-driven lines) ──
    dropProduct: { type: Boolean },
    dropId: { type: String },
    dropCreatorId: { type: Schema.Types.ObjectId, ref: "User" },
    dropCreatorName: { type: String },
    liveWorkshopId: { type: Schema.Types.ObjectId, ref: "Workshop" },
    liveSessionDate: { type: String },
    // ── Counter bills ──
    addOns: {
      type: [
        new Schema(
          { label: { type: String }, price: { type: Number } },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    lineKind: { type: String, enum: ["custom", "charge"] },
  },
  { _id: false }
);

const CurrencyConversionSchema = new Schema<ICurrencyConversion>(
  {
    fromCurrency: { type: String, required: true },
    toCurrency: { type: String, required: true },
    exchangeRate: { type: Number, required: true },
    convertedAt: { type: Date, required: true },
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String },
  },
  { _id: false }
);

// ============ Main Schema ============

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      default: function () {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `INV-${timestamp}-${random}`;
      },
    },
    invoiceType: {
      type: String,
      enum: ["one_time", "recurring"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "paid", "failed", "cancelled", "refunded", "expired"],
      default: "draft",
      index: true,
    },

    // Parties
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerEmail: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
    },

    // Line items
    lineItems: {
      type: [InvoiceLineItemSchema],
      required: true,
      validate: [(val: IInvoiceLineItem[]) => val.length > 0, "Invoice must have at least one line item"],
    },

    // Pricing
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Currency
    itemCurrency: {
      type: String,
      enum: ["USD", "INR"],
      required: true,
    },
    // What the buyer actually settled in. Invoices are only ever PRICED in
    // USD or INR (`itemCurrency`); CAD/EUR/GBP are card-only payment
    // currencies via Stripe, with the FX captured in `currencyConversion`.
    // The Stripe webhook writes the PaymentIntent's currency straight into
    // this field, so every currency a PI can be minted in must be here.
    paymentCurrency: {
      type: String,
      enum: [...SUPPORTED_FIAT_CURRENCIES],
    },
    currencyConversion: {
      type: CurrencyConversionSchema,
    },

    // Payment method
    paymentMethodCategory: {
      type: String,
      enum: ["card", "upi", "crypto", "wallet"],
    },
    paymentPlatform: {
      type: String,
      enum: ["razorpay", "stripe", "openmoney", "square", "phonepe", "paytm", "crypto_wallet", "store_wallet", "affiliate_wallet", "auction_wallet"],
    },
    paymentSource: {
      type: String,
      enum: ["web", "ios", "android"],
      default: "web",
    },

    // Gateway references
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySubscriptionId: {
      type: String,
    },
    razorpayInvoiceId: {
      type: String,
    },
    invoiceShortUrl: {
      type: String,
    },

    // Timestamps
    paidAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },

    // Recurring
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPeriod: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
    },
    // Deliberately un-enumerated so a future 24-month term needs no migration.
    recurringIntervalMonths: {
      type: Number,
      min: 1,
      max: 60,
    },
    recurringPaymentNumber: {
      type: Number,
      min: 1,
    },
    parentInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
    },
    subscriptionRef: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
    },
    nextDueDate: {
      type: Date,
    },

    // Coupon
    couponId: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
    },
    couponCode: {
      type: String,
    },
    couponUsageId: {
      type: Schema.Types.ObjectId,
      ref: "CouponUsage",
    },

    // Cashback (only set when input code resolved to a CashbackCode)
    cashbackCodeId: {
      type: Schema.Types.ObjectId,
      ref: "CashbackCode",
      index: true,
    },

    // Shipping
    shippingAddress: {
      type: ShippingAddressSchema,
    },
    // Optional separate billing address (defaults to shippingAddress at
    // fulfillment time when not set).
    billingAddress: {
      type: ShippingAddressSchema,
    },
    paymentMode: {
      type: String,
      enum: ["Prepaid", "COD"],
    },
    // Optional B2B fields surfaced by the storefront checkout.
    gstin: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    customerNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // Referral
    referralId: {
      type: String,
    },

    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
    },
    notes: {
      type: String,
    },

    // Commission
    commissionDistributed: {
      type: Boolean,
      default: false,
    },
    commissionDistributionId: {
      type: Schema.Types.ObjectId,
      ref: "CommissionDistribution",
    },

    // Error tracking
    errorCode: {
      type: String,
    },
    errorDescription: {
      type: String,
    },

    // Third-party integration
    thirdPartyClientId: {
      type: Schema.Types.ObjectId,
      ref: "ThirdPartyClient",
    },
    thirdPartyExternalId: {
      type: String,
    },
    webhookDelivery: {
      attempts: { type: Number, default: 0 },
      lastAttemptAt: { type: Date },
      lastStatus: { type: Number },
      deliveredAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// ============ Indexes ============

// User's invoices
InvoiceSchema.index({ userId: 1, createdAt: -1 });

// Organization invoices with status
InvoiceSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

// Seller's invoices
InvoiceSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

// Razorpay order lookup (unique sparse to allow multiple nulls)
InvoiceSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });

// Razorpay payment lookup
InvoiceSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

// Recurring invoice chain
InvoiceSchema.index({ parentInvoiceId: 1 });
InvoiceSchema.index({ razorpaySubscriptionId: 1, recurringPaymentNumber: 1 });

// Stale invoice cleanup
InvoiceSchema.index({ status: 1, expiresAt: 1 });

// Commission distribution tracking
InvoiceSchema.index({ status: 1, commissionDistributed: 1 });

// Recurring invoice generation cron query
InvoiceSchema.index({ isRecurring: 1, status: 1, nextDueDate: 1 });
// Daily Reports: paid invoices of a few item types within a paidAt window.
// Nothing else indexes paidAt, so that query scanned every paid invoice.
InvoiceSchema.index({ status: 1, "lineItems.itemType": 1, paidAt: -1 });

// Third-party invoice queries + idempotency
InvoiceSchema.index({ thirdPartyClientId: 1, createdAt: -1 });
InvoiceSchema.index(
  { thirdPartyClientId: 1, thirdPartyExternalId: 1 },
  { unique: true, sparse: true }
);

export const Invoice = mongoose.model<IInvoice>("Invoice", InvoiceSchema);
