import { Types } from "mongoose";
import { Invoice, IInvoice, IShippingAddress } from "../models/invoice.model";
import { StoreProduct } from "../models/storeProduct.model";
import { ProductVariant } from "../models/productVariant.model";
import { Store } from "../models/store.model";
import { User } from "../models/user.model";
import {
  convertUsdToInr,
  convertInrToUsd,
} from "../utils/exchangeRate";

// ============ Seller resolution ============

/**
 * Resolve the User who should receive the seller's share when a storeproduct
 * from `orgId` is sold. The seller is the **founder of the office (org)** —
 * looked up via `User.organizations[]`. For orgs with multiple founders, we
 * pick the earliest-joined one deterministically.
 *
 * Bulk variant: resolves many orgs in one query, returns a map orgId → userId.
 * Throws via the caller if any org has no founders (shouldn't happen in prod).
 */
export async function resolveSellersForOrgs(
  orgIds: string[]
): Promise<Map<string, string>> {
  if (orgIds.length === 0) return new Map();
  const objIds = orgIds.map((o) => new Types.ObjectId(o));
  const founders = await User.aggregate<{
    _id: Types.ObjectId;
    orgId: Types.ObjectId;
    joinedAt: Date;
  }>([
    { $match: { "organizations.organization": { $in: objIds } } },
    { $unwind: "$organizations" },
    {
      $match: {
        "organizations.organization": { $in: objIds },
        "organizations.role": "founder",
      },
    },
    {
      $project: {
        _id: 1,
        orgId: "$organizations.organization",
        joinedAt: "$organizations.joinedAt",
      },
    },
    { $sort: { orgId: 1, joinedAt: 1 } },
  ]);

  // First-by-joinedAt wins per orgId (aggregate is already sorted).
  const map = new Map<string, string>();
  for (const f of founders) {
    const key = String(f.orgId);
    if (!map.has(key)) map.set(key, String(f._id));
  }
  return map;
}

// ============ Types ============

export interface CartItemInput {
  productId: string;
  quantity: number;
  // When set, price and stock are read from the ProductVariant doc (the parent
  // StoreProduct.price / .quantity are not kept in sync with variants).
  variantId?: string;
  // ── Drop attribution — present only when the line came from a drop's
  // "Buy now". Carried through to the invoice line so fulfillment can pay the
  // drop creator a share of the line's affiliate commission. dropCreatorId/Name
  // are hints; the payee is re-resolved from `storedrops` at fulfillment.
  dropProduct?: boolean;
  dropId?: string;
  dropCreatorId?: string;
  dropCreatorName?: string;
  // ── Live-selling attribution — present only when the line came from a
  // product the host pinned during a live session. Both fields travel
  // together; fulfillment re-checks them against WebinarProductPin.
  liveWorkshopId?: string;
  liveSessionDate?: string;
  // Add-on labels chosen for this line ("Extra cheese"). Priced from the
  // product's own `itemDetails.addOns` — the client names them, never prices
  // them — and folded into the line's unit price.
  addOns?: string[];
}

/**
 * A line that is not a catalogue product. Only the counter-bill service
 * (services/counterBill.ts) builds these; the public ecommerce routes never
 * accept them, so a buyer can't invent a line or its price.
 *
 *   - `custom`: an "amount only" bill — the seller types the whole amount.
 *   - `charge`: service charge or packaging on top of the items. Excluded from
 *     coupon discounts, and a `percentOfItems` charge is worked out from the
 *     repriced product lines rather than trusting a figure computed earlier.
 *
 * Both are GST-exempt here: an amount-only bill is the figure the seller wants
 * collected, and the charges are shown to the customer as flat add-ons.
 */
export interface CustomLineInput {
  kind: "custom" | "charge";
  title: string;
  /** Owning org (the seller's store) — decides the seller and the storeId. */
  orgId: string;
  /** Stable id stamped as the line's itemId (the counter bill's _id). */
  refId: string;
  /** INR paise. Ignored when percentOfItems is set. */
  amount?: number;
  /** e.g. 5 → 5% of the product lines' subtotal. */
  percentOfItems?: number;
}

export interface PreviewedLineItem {
  productId: string;
  /** Set when the line targets a specific variant; carried through to the
   * invoice + ProductOrder so fulfillment knows which variant was bought. */
  variantId?: string;
  title: string;
  image?: string;
  vendor?: string;
  storeId?: string;
  storeName?: string;
  organizationId: string;
  /** The User who gets credited when this line is paid (see resolveStoreSellerUserId). */
  sellerId: string;
  quantity: number;
  nativeCurrency: "USD" | "INR";
  nativeUnitPrice: number; // smallest unit
  convertedUnitPrice: number; // smallest unit, in displayCurrency
  convertedTotalPrice: number; // smallest unit
  /**
   * Whether this storeproduct requires a shipping address. Drives the
   * "address required?" check at createEcommerceInvoice time and the
   * requiresShipping flag on the eventual ProductOrder. Defaults to `true`
   * when the storeproduct doesn't explicitly set the flag — safer to ask
   * for an address than to silently drop one.
   */
  requiresShipping: boolean;
  // ── GST (per storeproduct, mirrored from the storefront backend) ──
  // `gstInclusive` is the seller's answer to "does your listed price already
  // include GST?", asked regardless of the product's currency. `taxable:
  // false` opts the product out entirely. Applicability is decided by the
  // BUYER's region at createEcommerceInvoice time, not here.
  gstInclusive: boolean;
  taxable: boolean;
  // ── Drop attribution — carried from CartItemInput to the invoice line. ──
  dropProduct?: boolean;
  dropId?: string;
  liveWorkshopId?: string;
  liveSessionDate?: string;
  dropCreatorId?: string;
  dropCreatorName?: string;
  /** Add-ons folded into convertedUnitPrice, each priced per unit in display currency. */
  addOns?: Array<{ label: string; price: number }>;
  /** Absent on catalogue lines. See CustomLineInput. */
  lineKind?: "custom" | "charge";
}

export interface CartPreviewResult {
  lineItems: PreviewedLineItem[];
  subtotal: number; // smallest unit, in displayCurrency
  discount: number;
  discountReason?: string;
  total: number; // max(0, subtotal - discount)
  displayCurrency: "USD" | "INR";
  exchangeRate: number | null; // null when no conversion was needed
  inventoryIssues: Array<{
    productId: string;
    requested: number;
    available: number;
  }>;
  appliedCouponCode?: string;
  appliedCouponId?: string;
  // Surfaced when the input code resolved to a CashbackCode instead of a
  // PlatformCoupon. The buyer pays full at checkout; the listed amount lands
  // in their StoreWallet (sellerOrg-scoped) after fulfillInvoice runs.
  appliedCashbackCode?: string;
  appliedCashbackCodeId?: string;
  cashbackEstimateUsd?: number;
}

export class EcommerceError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;
  constructor(
    code: string,
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = "EcommerceError";
  }
}

const MAX_ITEMS_PER_CART = 50;

// ============ Helpers ============

function dedupItems(items: CartItemInput[]): CartItemInput[] {
  const map = new Map<string, CartItemInput>();
  for (const it of items) {
    // Key by product AND variant — two variants of the same product are
    // distinct cart lines and must not be merged into one.
    // ...and by add-ons: a plain bao and a bao with extra cheese are two
    // lines at two prices.
    const addOnKey = [...(it.addOns || [])]
      .map((a) => a.trim().toLowerCase())
      .sort()
      .join("|");
    const key = `${it.productId}::${it.variantId || ""}::${addOnKey}`;
    const existing = map.get(key);
    if (existing) existing.quantity += it.quantity;
    else map.set(key, { ...it });
  }
  return [...map.values()];
}

async function convertMainUnit(
  amountInMainUnit: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ converted: number; rate: number | null }> {
  if (fromCurrency === toCurrency) {
    return { converted: amountInMainUnit, rate: null };
  }
  if (fromCurrency === "USD" && toCurrency === "INR") {
    const { inrAmount, exchangeRate } = await convertUsdToInr(amountInMainUnit);
    return { converted: inrAmount, rate: exchangeRate };
  }
  if (fromCurrency === "INR" && toCurrency === "USD") {
    const { usdAmount, exchangeRate } = await convertInrToUsd(amountInMainUnit);
    return { converted: usdAmount, rate: exchangeRate };
  }
  throw new EcommerceError(
    "UNSUPPORTED_CURRENCY",
    `Cannot convert ${fromCurrency} to ${toCurrency}`
  );
}

// ============ Preview ============

export async function previewEcommerceCart(opts: {
  items: CartItemInput[];
  displayCurrency: "USD" | "INR";
  couponCode?: string;
  userId?: string; // required if couponCode is set
  // Affiliate id (`?ref`) for auto-attaching the referrer's cashback code when
  // the buyer didn't type a code. Best-effort, never rejects the cart.
  referralId?: string;
  /** Non-catalogue lines — counter bills only. See CustomLineInput. */
  customLines?: CustomLineInput[];
}): Promise<CartPreviewResult> {
  const customLines = opts.customLines || [];
  // Input validation
  if ((!opts.items || opts.items.length === 0) && customLines.length === 0) {
    throw new EcommerceError("INVALID_INPUT", "Cart must have at least one item");
  }
  opts.items = opts.items || [];
  if (customLines.length > 0 && opts.displayCurrency !== "INR") {
    // Custom amounts are typed in rupees at an Indian counter; converting them
    // would silently change what the seller asked for.
    throw new EcommerceError(
      "INVALID_INPUT",
      "Custom and charge lines are only supported for INR carts"
    );
  }
  for (const cl of customLines) {
    if (!Types.ObjectId.isValid(cl.orgId) || !Types.ObjectId.isValid(cl.refId)) {
      throw new EcommerceError("INVALID_INPUT", "Invalid custom line");
    }
    const hasPct = typeof cl.percentOfItems === "number";
    if (
      hasPct
        ? !(cl.percentOfItems! >= 0 && cl.percentOfItems! <= 100)
        : !(Number.isInteger(cl.amount) && cl.amount! >= 0)
    ) {
      throw new EcommerceError("INVALID_INPUT", `Invalid amount for ${cl.title}`);
    }
  }
  if (opts.items.length + customLines.length > MAX_ITEMS_PER_CART) {
    throw new EcommerceError(
      "INVALID_INPUT",
      `Cart cannot exceed ${MAX_ITEMS_PER_CART} items`
    );
  }
  if (!["USD", "INR"].includes(opts.displayCurrency)) {
    throw new EcommerceError(
      "INVALID_INPUT",
      "displayCurrency must be USD or INR"
    );
  }

  const items = dedupItems(opts.items);
  for (const it of items) {
    if (!Types.ObjectId.isValid(it.productId)) {
      throw new EcommerceError(
        "INVALID_INPUT",
        `Invalid productId: ${it.productId}`
      );
    }
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new EcommerceError(
        "INVALID_INPUT",
        `Invalid quantity for ${it.productId}`
      );
    }
    if (it.variantId && !Types.ObjectId.isValid(it.variantId)) {
      throw new EcommerceError(
        "INVALID_INPUT",
        `Invalid variantId: ${it.variantId}`
      );
    }
  }

  // Bulk-fetch products
  const productIds = items.map((i) => new Types.ObjectId(i.productId));
  const products = await StoreProduct.find({
    _id: { $in: productIds },
    status: "active",
  }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const missing = items.filter((i) => !productMap.has(i.productId));
  if (missing.length > 0) {
    throw new EcommerceError(
      "PRODUCT_NOT_FOUND",
      "One or more products not found or not active",
      400,
      { missingProductIds: missing.map((m) => m.productId) }
    );
  }

  // Bulk-fetch variants for any line that targets one. A variant product's
  // real price and stock live on the ProductVariant doc — the parent
  // StoreProduct carries a stale default — so we must read the variant when a
  // variantId is supplied. Keyed by variantId for O(1) lookup in the loop.
  const variantIds = items
    .filter((i) => i.variantId)
    .map((i) => new Types.ObjectId(i.variantId!));
  const variants = variantIds.length
    ? await ProductVariant.find({
        _id: { $in: variantIds },
        isActive: { $ne: false },
      }).lean()
    : [];
  const variantMap = new Map(variants.map((v) => [String(v._id), v]));
  // A supplied variantId that doesn't exist, or doesn't belong to the line's
  // product, is a hard error — silently falling back to the parent price would
  // charge the wrong amount.
  const badVariant = items.find(
    (i) =>
      i.variantId &&
      (!variantMap.has(i.variantId) ||
        String(variantMap.get(i.variantId)!.productId) !== i.productId)
  );
  if (badVariant) {
    throw new EcommerceError(
      "PRODUCT_NOT_FOUND",
      `Variant not found for product ${badVariant.productId}`,
      400,
      { missingProductIds: [badVariant.productId] }
    );
  }

  // Bulk-fetch stores by orgId
  const orgIds = [
    ...new Set([
      ...products.map((p) => String(p.orgId)),
      ...customLines.map((cl) => cl.orgId),
    ]),
  ];
  const stores = await Store.find({
    orgId: { $in: orgIds.map((o) => new Types.ObjectId(o)) },
  }).lean();
  const storeByOrgId = new Map(stores.map((s) => [String(s.orgId), s]));

  // Bulk-resolve the founder/seller for every org in the cart.
  // Done once up front so we fail fast if any org has no founder.
  const sellerByOrgId = await resolveSellersForOrgs(orgIds);
  for (const oid of orgIds) {
    if (!sellerByOrgId.has(oid)) {
      throw new EcommerceError(
        "STORE_OWNER_MISSING",
        `Cannot resolve seller for org ${oid}: no founder found. The store's office must have at least one founder.`
      );
    }
  }

  // Build line items
  const lineItems: PreviewedLineItem[] = [];
  let subtotal = 0;
  let usdInrRate: number | null = null;
  const inventoryIssues: CartPreviewResult["inventoryIssues"] = [];

  for (const it of items) {
    const product = productMap.get(it.productId)!;
    const store = storeByOrgId.get(String(product.orgId));
    // For variant lines, price + stock come from the variant, not the parent.
    // Validated above to exist and belong to this product.
    const variant = it.variantId ? variantMap.get(it.variantId)! : null;
    // Source of truth for "what currency is this product priced in" is the
    // product document itself — many stores have `store.currency` unset
    // (null), and a blind fallback to USD here would silently scale INR
    // prices by ~95× when the buyer requested an INR display (e.g. a ₹289
    // product invoicing as ₹27,483). The product's own `currency` field is
    // set on the storeProduct doc via `{ strict: false }`, so we read it
    // even though it isn't declared on `IStoreProduct`.
    const nativeCurrency = (
      (product as any).currency ||
      store?.currency ||
      "USD"
    ).toUpperCase() as "USD" | "INR";
    if (!["USD", "INR"].includes(nativeCurrency)) {
      throw new EcommerceError(
        "UNSUPPORTED_CURRENCY",
        `Product currency ${nativeCurrency} is not supported`
      );
    }

    // Add-ons are priced from the product (StoreProduct.itemDetails.addOns,
    // stored via strict:false), in the product's own currency and main unit,
    // exactly like `price`. An add-on the product doesn't offer — or one the
    // seller switched off — is a hard error rather than a silent free extra.
    const chosenAddOns: Array<{ label: string; priceMain: number }> = [];
    if (it.addOns && it.addOns.length > 0) {
      const offered: Array<{ label?: string; price?: number; enabled?: boolean }> =
        ((product as any).itemDetails?.addOns as any[]) || [];
      for (const raw of it.addOns) {
        const want = raw.trim().toLowerCase();
        const match = offered.find(
          (a) =>
            a?.enabled !== false &&
            (a?.label || "").trim().toLowerCase() === want
        );
        if (!match) {
          throw new EcommerceError(
            "ADDON_NOT_FOUND",
            `"${raw}" is not an add-on for ${product.title}`,
            400,
            { productId: it.productId, addOn: raw }
          );
        }
        chosenAddOns.push({
          label: (match.label || raw).trim(),
          priceMain: Math.max(0, Number(match.price) || 0),
        });
      }
    }
    const addOnMain = chosenAddOns.reduce((sum, a) => sum + a.priceMain, 0);

    const nativePriceMain =
      Number(variant ? variant.price : product.price) + addOnMain;
    const nativeUnitSmallest = Math.round(nativePriceMain * 100);

    let convertedUnitPrice = nativeUnitSmallest;
    if (nativeCurrency !== opts.displayCurrency) {
      const { converted, rate } = await convertMainUnit(
        nativePriceMain,
        nativeCurrency,
        opts.displayCurrency
      );
      convertedUnitPrice = Math.round(converted * 100);
      if (rate !== null) usdInrRate = rate;
    }
    const convertedTotalPrice = convertedUnitPrice * it.quantity;
    subtotal += convertedTotalPrice;

    // Stock check reads the variant's own inventory when this is a variant
    // line — the parent's quantity is a default seed, not real variant stock,
    // and using it produced phantom OUT_OF_STOCK errors on in-stock variants.
    const trackInventory = variant ? variant.trackInventory : product.trackInventory;
    const availableQty = (variant ? variant.quantity : product.quantity) ?? 0;
    if (trackInventory && availableQty < it.quantity) {
      inventoryIssues.push({
        productId: it.productId,
        requested: it.quantity,
        available: availableQty,
      });
    }

    // Per-add-on prices in the display currency, for the bill and the invoice
    // line. Same conversion as the unit price; a rounding penny can differ
    // from the folded unit price, which stays the authoritative figure.
    const addOnsDisplay: Array<{ label: string; price: number }> = [];
    for (const a of chosenAddOns) {
      let price = Math.round(a.priceMain * 100);
      if (nativeCurrency !== opts.displayCurrency) {
        const { converted } = await convertMainUnit(
          a.priceMain,
          nativeCurrency,
          opts.displayCurrency
        );
        price = Math.round(converted * 100);
      }
      addOnsDisplay.push({ label: a.label, price });
    }

    lineItems.push({
      productId: it.productId,
      variantId: it.variantId,
      title: chosenAddOns.length
        ? `${product.title} + ${chosenAddOns.map((a) => a.label).join(", ")}`
        : product.title,
      addOns: addOnsDisplay.length ? addOnsDisplay : undefined,
      image: variant?.image || product.featuredImage || product.images?.[0]?.url,
      vendor: product.vendor,
      storeId: store ? String(store._id) : undefined,
      storeName: store?.name,
      organizationId: String(product.orgId),
      sellerId: sellerByOrgId.get(String(product.orgId))!, // guaranteed by check above
      quantity: it.quantity,
      nativeCurrency,
      nativeUnitPrice: nativeUnitSmallest,
      convertedUnitPrice,
      convertedTotalPrice,
      // StoreProduct.requiresShipping is optional. When unset, default to
      // `true` (matches the underlying Product schema default at
      // product.model.ts:243) so we fail closed.
      requiresShipping: product.requiresShipping !== false,
      // GST semantics carried from the storefront product. `taxable` defaults
      // to true (only an explicit false opts out). `gstInclusive` is read as
      // falsy-when-absent = exclusive, matching how legacy sellable items
      // behave. Variants don't carry gstInclusive — it lives on the parent.
      gstInclusive: !!product.gstInclusive,
      taxable: product.taxable !== false,
      // Drop attribution — pass straight through untouched.
      dropProduct: it.dropProduct,
      dropId: it.dropId,
      dropCreatorId: it.dropCreatorId,
      dropCreatorName: it.dropCreatorName,
      // Live-selling attribution — same treatment.
      liveWorkshopId: it.liveWorkshopId,
      liveSessionDate: it.liveSessionDate,
    });
  }

  // Non-catalogue lines (counter bills). Percent charges are taken off the
  // product lines just priced, so the charge can never disagree with them.
  const productSubtotal = subtotal;
  for (const cl of customLines) {
    const store = storeByOrgId.get(cl.orgId);
    const amount =
      typeof cl.percentOfItems === "number"
        ? Math.round((productSubtotal * cl.percentOfItems) / 100)
        : (cl.amount as number);
    if (amount <= 0) continue;
    subtotal += amount;
    lineItems.push({
      productId: cl.refId,
      title: cl.title,
      storeId: store ? String(store._id) : undefined,
      storeName: store?.name,
      vendor: store?.name,
      organizationId: cl.orgId,
      sellerId: sellerByOrgId.get(cl.orgId)!,
      quantity: 1,
      nativeCurrency: "INR",
      nativeUnitPrice: amount,
      convertedUnitPrice: amount,
      convertedTotalPrice: amount,
      requiresShipping: false,
      gstInclusive: false,
      taxable: false,
      lineKind: cl.kind,
    });
  }

  // Coupon OR Cashback (only if userId is supplied — both require a user
  // identity). The unified validator inspects the same input field and
  // resolves it to either a PlatformCoupon (discount applied inline) or a
  // CashbackCode (no discount; stamped on the invoice and paid out
  // post-fulfillment from the creator's AffiliateWallet).
  let discount = 0;
  let discountReason: string | undefined;
  let appliedCouponCode: string | undefined;
  let appliedCouponId: string | undefined;
  let appliedCashbackCode: string | undefined;
  let appliedCashbackCodeId: string | undefined;
  let cashbackEstimateUsd: number | undefined;

  if (opts.couponCode && opts.userId) {
    const { validatePlatformCoupon, getPlatformCouponByCode } = await import(
      "./platformCoupon"
    );

    // Look up the coupon first so we can scope the discount to the lines it
    // actually applies to. Founder coupons are org-scoped (and may target a
    // single item) — a coupon must only discount its own org's / its own
    // item's lines, never the whole (possibly multi-store) cart. If no
    // PlatformCoupon matches the input code, fall through to the cashback
    // path (CashbackCode shares the same input field).
    const couponDoc = await getPlatformCouponByCode(opts.couponCode);

    if (couponDoc) {
      // ── Platform-coupon path (org-scoped) ──
      const couponOrgId = couponDoc.orgId?.toString();
      const specificIds = (couponDoc.specificItemIds || []).map((id) =>
        id.toString()
      );

      const applicableLines = lineItems.filter((li) => {
        // Service charge and packaging are never discounted.
        if (li.lineKind === "charge") return false;
        if (couponOrgId && li.organizationId !== couponOrgId) return false;
        if (specificIds.length > 0 && !specificIds.includes(li.productId))
          return false;
        return true;
      });

      if (applicableLines.length === 0) {
        throw new EcommerceError(
          "INVALID_COUPON",
          "This coupon doesn't apply to any item in your cart."
        );
      }

      // The discount base is the matching lines' subtotal, not the whole cart.
      const applicableSubtotal = applicableLines.reduce(
        (sum, li) => sum + li.convertedTotalPrice,
        0
      );

      const validation = await validatePlatformCoupon({
        code: opts.couponCode,
        productType: "ecommerce",
        userId: opts.userId,
        amountCents: applicableSubtotal,
        orgId: couponOrgId,
        itemId:
          specificIds.length > 0 ? applicableLines[0].productId : undefined,
        invoiceCurrency: opts.displayCurrency,
      });
      if (!validation.valid || !validation.coupon) {
        throw new EcommerceError(
          "INVALID_COUPON",
          validation.error || "Coupon invalid"
        );
      }
      discount = validation.discount || 0;
      appliedCouponCode = validation.coupon.code;
      appliedCouponId = validation.coupon._id.toString();
      discountReason = `Coupon ${appliedCouponCode}`;
    } else {
      // ── Cashback-code path (1 code = 1 product) ──
      // No PlatformCoupon matched — try the input as a CashbackCode. Each
      // ecommerce line is its own cashback candidate. No discount applied
      // here; the buyer pays full and the cashback materializes in their
      // StoreWallet after fulfillment.
      const { validateCashbackCode } = await import("./cashbackCode");
      const cartLines = lineItems
        // Custom/charge lines sit after every product line, so dropping them
        // keeps matchedLineIndex pointing at the same lineItems entry.
        .filter((li) => !li.lineKind)
        .map((li) => ({
          productType: "ecommerce" as const,
          itemId: String(li.productId),
        }));
      const cashback = await validateCashbackCode({
        code: opts.couponCode,
        buyerId: opts.userId,
        cartLines,
        amountCents: subtotal,
      });
      if (!cashback.valid) {
        throw new EcommerceError(
          "INVALID_COUPON",
          cashback.error || "Invalid coupon code"
        );
      }
      appliedCashbackCode = cashback.code.code;
      appliedCashbackCodeId = cashback.code._id.toString();
      // Preview estimate: apply the code's ratePct to the MATCHED line only.
      // Actual amount is capped against the real level-1 commission rate at
      // fulfillment time, so this is an UPPER bound.
      const matchedLine = lineItems[cashback.matchedLineIndex];
      if (matchedLine) {
        const lineTotalSmallestUnit = matchedLine.convertedTotalPrice || 0;
        cashbackEstimateUsd =
          Math.round(
            (lineTotalSmallestUnit / 100) *
              (cashback.code.ratePct / 100) *
              100
          ) / 100;
      }
    }
  } else if (!opts.couponCode && opts.referralId && opts.userId) {
    // ── Auto-attach cashback from the affiliate link ──
    // No code typed, but the buyer arrived via `?ref`. If the referrer has an
    // active cashback code bound to a cart item AND this buyer qualifies, stamp
    // it so the rebate lands without them entering anything. Best-effort: any
    // failure leaves the cart untouched (NEVER throws / blocks checkout).
    try {
      const { getAffiliateCashbackForItem, validateCashbackCode } = await import(
        "./cashbackCode"
      );
      const cartLines = lineItems
        // Custom/charge lines sit after every product line, so dropping them
        // keeps matchedLineIndex pointing at the same lineItems entry.
        .filter((li) => !li.lineKind)
        .map((li) => ({
          productType: "ecommerce" as const,
          itemId: String(li.productId),
        }));
      for (const li of lineItems) {
        if (li.lineKind) continue;
        const teaser = await getAffiliateCashbackForItem({
          affiliateId: opts.referralId,
          productType: "ecommerce",
          itemId: String(li.productId),
        });
        if (!teaser) continue;
        const cashback = await validateCashbackCode({
          code: teaser.code,
          buyerId: opts.userId,
          cartLines,
          amountCents: subtotal,
        });
        if (!cashback.valid) continue;
        appliedCashbackCode = cashback.code.code;
        appliedCashbackCodeId = cashback.code._id.toString();
        const matchedLine = lineItems[cashback.matchedLineIndex];
        if (matchedLine) {
          const lineTotalSmallestUnit = matchedLine.convertedTotalPrice || 0;
          cashbackEstimateUsd =
            Math.round(
              (lineTotalSmallestUnit / 100) * (cashback.code.ratePct / 100) * 100
            ) / 100;
        }
        break;
      }
    } catch (err) {
      console.error("[ecommerce] auto cashback attach failed:", err);
    }
  }

  return {
    lineItems,
    subtotal,
    discount,
    discountReason,
    total: Math.max(0, subtotal - discount),
    displayCurrency: opts.displayCurrency,
    exchangeRate: usdInrRate,
    inventoryIssues,
    appliedCouponCode,
    appliedCouponId,
    appliedCashbackCode,
    appliedCashbackCodeId,
    cashbackEstimateUsd,
  };
}

// ============ Create ============

export async function createEcommerceInvoice(opts: {
  userId: string;
  customerEmail: string;
  customerName?: string;
  items: CartItemInput[];
  displayCurrency: "USD" | "INR";
  couponCode?: string;
  referralId?: string;
  shippingAddress?: IShippingAddress;
  billingAddress?: IShippingAddress;
  paymentMode?: "Prepaid" | "COD";
  gstin?: string;
  companyName?: string;
  customerNote?: string;
  /** Non-catalogue lines — counter bills only. See CustomLineInput. */
  customLines?: CustomLineInput[];
  /** Merged into invoice.metadata (e.g. counterBillId, branchId). */
  extraMetadata?: Record<string, unknown>;
  /**
   * Counter bills are paid by someone standing in the shop: nothing ships,
   * so the address requirement is waived. Defaults to true (checkout rules).
   */
  requireShippingAddress?: boolean;
  /**
   * Price everything exactly as a real invoice would — GST, coupon, charges —
   * and return the unsaved document. Used for the New bill screen's live
   * totals so they come from the same code that bills the customer.
   */
  dryRun?: boolean;
}): Promise<{
  invoice: IInvoice;
  payUrl: string;
  /** Dry runs only: stock problems are reported instead of thrown. */
  inventoryIssues?: CartPreviewResult["inventoryIssues"];
}> {
  // Attribute the buyer to the affiliate (first-touch) BEFORE the cashback
  // eligibility check below — so a buyer arriving via the link qualifies on
  // this very purchase. setReferredByAffiliateId never overwrites an existing
  // referrer and blocks self-referral.
  if (opts.referralId) {
    try {
      const { setReferredByAffiliateId } = await import("./affiliate");
      await setReferredByAffiliateId(opts.userId, opts.referralId);
    } catch (err) {
      console.error("[ecommerce] setReferredByAffiliateId failed:", err);
    }
  }

  const preview = await previewEcommerceCart({
    items: opts.items,
    displayCurrency: opts.displayCurrency,
    couponCode: opts.couponCode,
    userId: opts.userId,
    referralId: opts.referralId,
    customLines: opts.customLines,
  });

  // Hard-block on out-of-stock (a dry run reports it alongside the totals)
  if (preview.inventoryIssues.length > 0 && !opts.dryRun) {
    throw new EcommerceError(
      "OUT_OF_STOCK",
      "One or more items are out of stock",
      409,
      { inventoryIssues: preview.inventoryIssues }
    );
  }

  // Per spec: shippingAddress is required when ANY cart line item's product
  // has requiresShipping !== false. Pure-digital carts may omit it.
  const requiresShippingByProductId: Record<string, boolean> = {};
  for (const li of preview.lineItems) {
    requiresShippingByProductId[String(li.productId)] = li.requiresShipping;
  }
  const anyRequiresShipping = preview.lineItems.some((li) => li.requiresShipping);

  if (
    anyRequiresShipping &&
    !opts.shippingAddress &&
    opts.requireShippingAddress !== false
  ) {
    throw new EcommerceError(
      "INVALID_INPUT",
      "shippingAddress is required for carts containing physical products",
      400,
      {
        missingFields: [
          "shippingAddress.fullName",
          "shippingAddress.addressLine1",
          "shippingAddress.city",
          "shippingAddress.state",
          "shippingAddress.postalCode",
          "shippingAddress.country",
          "shippingAddress.phone",
        ],
      }
    );
  }

  // ── GST ──────────────────────────────────────────────────────────────
  // Same two layers as sellable items:
  //   Layer 1 (seller) — `gstInclusive` on each storeproduct, asked of the
  //                      seller regardless of the product's currency.
  //   Layer 2 (buyer)  — GST is owed only when the buyer is in India.
  // Physical carts collect a shipping address, which is the strongest buyer
  // location signal we have; digital-only carts fall back to the buyer's
  // profile and then to the currency they're paying in.
  const { applyGstToLine, GST_CONFIG } = await import("../utils/gstTax");
  const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
    "../utils/gstBuyerRegion"
  );
  const gstRegion = await resolveBuyerGstRegion({
    buyerUserId: opts.userId,
    shippingAddress: opts.shippingAddress,
    billingAddress: opts.billingAddress,
    paymentCurrency: preview.displayCurrency,
  });

  // Per line, because gstInclusive/taxable are per storeproduct and a cart
  // can legitimately mix them.
  let totalTaxSmallest = 0;
  let anyInclusive = false;
  let anyGst = false;
  const gstByLineIndex = preview.lineItems.map((li) => {
    const line = applyGstToLine({
      listedAmountMinor: li.convertedUnitPrice,
      quantity: li.quantity,
      gstInclusive: li.gstInclusive,
      buyerInIndia: gstRegion.inIndia,
      exempt: !li.taxable,
    });
    totalTaxSmallest += line.taxTotal;
    if (line.gstMetadata) {
      anyGst = true;
      if (line.gstMetadata.inclusive) anyInclusive = true;
    }
    return line;
  });

  const lineItems = preview.lineItems.map((li, i) => ({
    itemType: "ecommerce_item" as const,
    itemId: new Types.ObjectId(li.productId),
    variantId: li.variantId ? new Types.ObjectId(li.variantId) : undefined,
    itemName: li.title,
    itemImage: li.image,
    quantity: li.quantity,
    // Pre-tax base. For an inclusive product sold to an Indian buyer this is
    // the extracted base, so `subtotal` stays pre-tax and the commission math
    // (which reads subtotal) stays correct.
    unitPrice: gstByLineIndex[i].lineUnitPrice,
    totalPrice: gstByLineIndex[i].lineUnitPrice * li.quantity,
    originalCurrency: preview.displayCurrency,
    organizationId: new Types.ObjectId(li.organizationId),
    // sellerId is the founder of the office that owns this storeproduct,
    // resolved at preview time via resolveSellersForOrgs. Their User._id
    // is what distributeCommissions uses to credit the seller's StoreWallet.
    sellerId: new Types.ObjectId(li.sellerId),
    storeId: li.storeId ? new Types.ObjectId(li.storeId) : undefined,
    vendor: li.vendor,
    // Drop attribution — persisted on the line; drives the drop-creator
    // commission split at fulfillment (creator re-resolved from storedrops).
    dropProduct: li.dropProduct || undefined,
    dropId: li.dropId || undefined,
    dropCreatorId:
      li.dropCreatorId && Types.ObjectId.isValid(li.dropCreatorId)
        ? new Types.ObjectId(li.dropCreatorId)
        : undefined,
    dropCreatorName: li.dropCreatorName || undefined,
    // Live-selling attribution — which session this line was bought from.
    liveWorkshopId:
      li.liveWorkshopId && Types.ObjectId.isValid(li.liveWorkshopId)
        ? new Types.ObjectId(li.liveWorkshopId)
        : undefined,
    liveSessionDate: li.liveSessionDate || undefined,
    addOns: li.addOns,
    lineKind: li.lineKind,
  }));

  // Pre-tax subtotal from the (possibly GST-extracted) line bases, and the
  // buyer-facing total. Clamped at 0 so a discount larger than the goods
  // value can't produce a negative charge.
  const gstSubtotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);
  const gstTotalAmount = Math.max(
    0,
    gstSubtotal + totalTaxSmallest - preview.discount
  );

  // Top-level organizationId/sellerId are required by the schema. Use the
  // first line's org as the "primary" for indexing — fulfillment uses
  // line-level fields, not these.
  const primaryOrgId = lineItems[0].organizationId;
  const primarySellerId = lineItems[0].sellerId;

  const orgsInCart = new Set(preview.lineItems.map((l) => l.organizationId));

  const doc = {
    invoiceType: "one_time",
    status: "draft",
    organizationId: primaryOrgId,
    sellerId: primarySellerId,
    userId: new Types.ObjectId(opts.userId),
    customerEmail: opts.customerEmail,
    customerName: opts.customerName,
    lineItems,
    // Recomputed from the line items rather than reusing preview.subtotal:
    // for an inclusive product sold to an Indian buyer the line unitPrice is
    // now the EXTRACTED base, so preview.subtotal (which is the listed total)
    // would overstate it and double-count the tax in totalAmount.
    subtotal: gstSubtotal,
    discount: preview.discount,
    tax: totalTaxSmallest,
    shippingCost: 0,
    totalAmount: gstTotalAmount,
    itemCurrency: preview.displayCurrency,
    couponCode: preview.appliedCouponCode,
    couponId: preview.appliedCouponId
      ? new Types.ObjectId(preview.appliedCouponId)
      : undefined,
    // Cashback path: persisting the code id here is what wires fulfillInvoice's
    // post-distribute executeCashback() hook to fire on this invoice.
    cashbackCodeId: preview.appliedCashbackCodeId
      ? new Types.ObjectId(preview.appliedCashbackCodeId)
      : undefined,
    // Shipping / billing / B2B data from the storefront checkout. paymentMode
    // defaults to "Prepaid" when not supplied (spec §1).
    shippingAddress: opts.shippingAddress,
    billingAddress: opts.billingAddress,
    paymentMode: opts.paymentMode ?? "Prepaid",
    gstin: opts.gstin,
    companyName: opts.companyName,
    customerNote: opts.customerNote,
    metadata: {
      flavor: "ecommerce",
      multiHq: orgsInCart.size > 1,
      orgsInCart: [...orgsInCart],
      exchangeRateUsdToInr: preview.exchangeRate,
      // Same shape the sellable-item flows stamp, so one reporting path and
      // the gst_collected ledger cover ecommerce too.
      ...(anyGst
        ? {
            gst: {
              rate: GST_CONFIG.rate,
              amount: totalTaxSmallest,
              // Basket-level flag reflects the mix when a cart combines
              // inclusive and exclusive products; per-line totals stay exact.
              inclusive: anyInclusive,
              sacCode: GST_CONFIG.sacCode,
              buyerCountry: gstRegion.country,
              buyerRegion: "IN" as const,
              regionSource: gstRegion.source,
            },
          }
        : {
            gstSkipped: gstSkippedMetadata(
              gstRegion,
              gstRegion.inIndia ? "item_exempt" : "buyer_outside_india"
            ),
          }),
      // Per-line requiresShipping snapshot. Used by the fulfillment fanout to
      // set ProductOrder.requiresShipping correctly without re-querying the
      // StoreProduct collection.
      requiresShipping: anyRequiresShipping,
      requiresShippingByProductId,
      ...(opts.extraMetadata || {}),
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  if (opts.dryRun) {
    return {
      invoice: doc as unknown as IInvoice,
      payUrl: "",
      inventoryIssues: preview.inventoryIssues,
    };
  }

  const invoice = await Invoice.create(doc);

  return {
    invoice,
    payUrl: `/invoice/${invoice._id.toString()}`,
  };
}
