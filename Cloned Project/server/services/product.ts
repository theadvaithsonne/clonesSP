import { Types } from "mongoose";
import { Product, IProduct, IDigitalAsset, IDigitalLink, IKeyFeature, IWhatsInsideGroup, IProductReview, IFaq, IProductDetail, IThankYouPage } from "../models/product.model";
import { ProductOrder, IProductOrder, IOrderItem, IShippingAddress } from "../models/productOrder.model";
import { UserProductLink } from "../models/userProductLink.model";
import { User } from "../models/user.model";
import {
  normalizeEmailAlerts,
  type EmailAlertsInput,
} from "../models/emailAlerts.schema";
import {
  normalizeFounderAlerts,
  type FounderAlertsInput,
} from "../models/founderAlerts.schema";
import { distributeCommissions } from "./commission";

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Helper to generate SKU
function generateSku(name: string): string {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 4);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${random}`;
}

// ============ Product CRUD ============

export interface CreateProductData {
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  currency?: string;
  // Tax + iOS surcharges. Same three fields channels/workshops/courses
  // carry — mongoose default kicks in when omitted.
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  trackQuantity?: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  images?: string[];
  categoryName?: string;
  tags?: string[];
  isDigital?: boolean;
  requiresShipping?: boolean;
  deliveryMethod?: "physical" | "digital" | "both";
  digitalAssets?: Array<{
    name: string;
    fileUrl: string;
    fileType: string;
    fileSize?: number;
  }>;
  digitalLinks?: Array<{
    label: string;
    url: string;
    description?: string;
    linkType?: "static" | "dynamic";
  }>;
  channelIds?: string[];
  // Non-empty = private one-time offer: only these users see the product
  // and each can buy it only once. See getAvailableProducts for the gate.
  // Rejects when combined with isSubscription (subscriptions gate re-purchase
  // via hasSubscriptionAccess).
  allowedUserIds?: string[];
  status?: "active" | "draft" | "archived";
  // Product detail page fields
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
  whatsIncluded?: string[];
  keyFeatures?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  whatsInside?: Array<{
    icon: string;
    title: string;
    items: string[];
  }>;
  reviews?: Array<{
    reviewerName: string;
    reviewerRole?: string;
    reviewerAvatar?: string;
    rating: number;
    text: string;
    helpfulCount?: number;
  }>;
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
  productDetails?: Array<{
    label: string;
    value: string;
  }>;
  videos?: string[];
  isSubscription?: boolean;
  subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
  youtubeLink?: string;
  emailAlerts?: ProductEmailAlertsInput;
  /** "Notify me when someone buys" — see models/founderAlerts.schema.ts. */
  founderAlerts?: FounderAlertsInput;
  thankYouPage?: ThankYouPageInput;
}

/**
 * Order-alert config as it arrives from the product form. Courses and
 * communities post the same shape — see `models/emailAlerts.schema.ts`.
 */
export type ProductEmailAlertsInput = EmailAlertsInput;

// Thank-you page normaliser is shared with Course. Re-exported here so
// existing call sites `import { ThankYouPageInput, normalizeThankYouPage }
// from "./product"` still work while the canonical home is
// services/thankYouPage.ts.
export {
  normalizeThankYouPage,
  MAX_THANK_YOU_SECTIONS,
} from "./thankYouPage";
export type { ThankYouPageInput } from "./thankYouPage";
import {
  normalizeThankYouPage,
  type ThankYouPageInput,
} from "./thankYouPage";

export async function createProduct(data: CreateProductData): Promise<IProduct> {
  // Cross-validation: private one-time offer + subscription is nonsense —
  // subscriptions already gate re-purchase natively via hasSubscriptionAccess.
  if (data.isSubscription && (data.allowedUserIds?.length ?? 0) > 0) {
    throw new Error(
      "Subscription products cannot use per-user allowlists — subscriptions gate re-purchase natively",
    );
  }
  const slug = generateSlug(data.name);
  const sku = data.sku || generateSku(data.name);

  // Check for slug uniqueness within organization
  const existingSlug = await Product.findOne({
    organizationId: new Types.ObjectId(data.organizationId),
    slug,
  });

  let finalSlug = slug;
  if (existingSlug) {
    finalSlug = `${slug}-${Date.now().toString(36)}`;
  }

  // Check for SKU uniqueness within organization
  const existingSku = await Product.findOne({
    organizationId: new Types.ObjectId(data.organizationId),
    sku,
  });

  let finalSku = sku;
  if (existingSku) {
    finalSku = `${sku}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
  }

  const digitalAssets: IDigitalAsset[] = (data.digitalAssets || []).map((asset) => ({
    _id: new Types.ObjectId(),
    name: asset.name,
    fileUrl: asset.fileUrl,
    fileType: asset.fileType,
    fileSize: asset.fileSize,
  }));

  const digitalLinks: IDigitalLink[] = (data.digitalLinks || []).map((link) => ({
    _id: new Types.ObjectId(),
    label: link.label,
    url: link.url,
    description: link.description,
    linkType: link.linkType || "static",
  }));

  const product = new Product({
    organizationId: new Types.ObjectId(data.organizationId),
    createdBy: new Types.ObjectId(data.createdBy),
    name: data.name,
    slug: finalSlug,
    description: data.description,
    sku: finalSku,
    price: data.price,
    currency: data.currency || "USD",
    // Persist only when explicitly set — mongoose schema defaults kick
    // in otherwise (gstInclusive: true, ios flags: false).
    ...(data.gstInclusive !== undefined ? { gstInclusive: data.gstInclusive } : {}),
    ...(data.requireIosPayment !== undefined ? { requireIosPayment: data.requireIosPayment } : {}),
    ...(data.appleFeeInclusive !== undefined ? { appleFeeInclusive: data.appleFeeInclusive } : {}),
    trackQuantity: data.trackQuantity || false,
    quantity: data.quantity,
    lowStockThreshold: data.lowStockThreshold,
    images: data.images || [],
    videos: data.videos || [],
    youtubeLink: data.youtubeLink,
    isSubscription: data.isSubscription || false,
    subscriptionPeriod: data.subscriptionPeriod,
    categoryName: data.categoryName,
    tags: data.tags || [],
    isDigital: data.isDigital || false,
    requiresShipping: data.requiresShipping !== false,
    deliveryMethod: data.deliveryMethod || "physical",
    digitalAssets,
    digitalLinks,
    channelIds: (data.channelIds || []).map((id) => new Types.ObjectId(id)),
    allowedUserIds: (data.allowedUserIds || []).map((id) => new Types.ObjectId(id)),
    status: data.status || "draft",
    // Product detail page fields
    rating: data.rating,
    ratingCount: data.ratingCount,
    downloadCount: data.downloadCount,
    whatsIncluded: data.whatsIncluded,
    keyFeatures: data.keyFeatures,
    whatsInside: data.whatsInside,
    reviews: data.reviews?.map((r) => ({
      _id: new Types.ObjectId(),
      reviewerName: r.reviewerName,
      reviewerRole: r.reviewerRole,
      reviewerAvatar: r.reviewerAvatar,
      rating: r.rating,
      text: r.text,
      helpfulCount: r.helpfulCount || 0,
      createdAt: new Date(),
    })),
    faqs: data.faqs,
    productDetails: data.productDetails,
    thankYouPage: (() => {
      const t = normalizeThankYouPage(data.thankYouPage);
      return t || undefined;
    })(),
    ...(data.emailAlerts !== undefined
      ? { emailAlerts: normalizeEmailAlerts(data.emailAlerts) }
      : {}),
    ...(data.founderAlerts !== undefined
      ? { founderAlerts: normalizeFounderAlerts(data.founderAlerts) }
      : {}),
  });

  return product.save();
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  sku?: string;
  price?: number;
  currency?: string;
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  trackQuantity?: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  images?: string[];
  categoryName?: string;
  tags?: string[];
  isDigital?: boolean;
  requiresShipping?: boolean;
  deliveryMethod?: "physical" | "digital" | "both";
  digitalAssets?: Array<{
    _id?: string;
    name: string;
    fileUrl: string;
    fileType: string;
    fileSize?: number;
  }>;
  digitalLinks?: Array<{
    _id?: string;
    label: string;
    url: string;
    description?: string;
    linkType?: "static" | "dynamic";
  }>;
  channelIds?: string[];
  // See CreateProductData.allowedUserIds. Setting `[]` on update clears the
  // list (returns the product to unrestricted visibility).
  allowedUserIds?: string[];
  status?: "active" | "draft" | "archived";
  // Product detail page fields
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
  whatsIncluded?: string[];
  keyFeatures?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  whatsInside?: Array<{
    icon: string;
    title: string;
    items: string[];
  }>;
  reviews?: Array<{
    _id?: string;
    reviewerName: string;
    reviewerRole?: string;
    reviewerAvatar?: string;
    rating: number;
    text: string;
    helpfulCount?: number;
    createdAt?: string;
  }>;
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
  productDetails?: Array<{
    label: string;
    value: string;
  }>;
  videos?: string[];
  isSubscription?: boolean;
  subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
  youtubeLink?: string;
  thankYouPage?: ThankYouPageInput;
  emailAlerts?: ProductEmailAlertsInput;
  founderAlerts?: FounderAlertsInput;
}

export async function updateProduct(
  productId: string,
  organizationId: string,
  data: UpdateProductData
): Promise<IProduct | null> {
  const product = await Product.findOne({
    _id: new Types.ObjectId(productId),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!product) {
    return null;
  }

  // Update slug if name changed
  if (data.name && data.name !== product.name) {
    const newSlug = generateSlug(data.name);
    const existingSlug = await Product.findOne({
      organizationId: new Types.ObjectId(organizationId),
      slug: newSlug,
      _id: { $ne: product._id },
    });

    product.slug = existingSlug ? `${newSlug}-${Date.now().toString(36)}` : newSlug;
    product.name = data.name;
  }

  // Update SKU if provided and different
  if (data.sku && data.sku !== product.sku) {
    const existingSku = await Product.findOne({
      organizationId: new Types.ObjectId(organizationId),
      sku: data.sku,
      _id: { $ne: product._id },
    });

    if (!existingSku) {
      product.sku = data.sku;
    }
  }

  // Update other fields
  if (data.description !== undefined) product.description = data.description;
  if (data.price !== undefined) product.price = data.price;
  if (data.currency !== undefined) product.currency = data.currency;
  if (data.gstInclusive !== undefined) product.gstInclusive = data.gstInclusive;
  if (data.requireIosPayment !== undefined)
    product.requireIosPayment = data.requireIosPayment;
  if (data.appleFeeInclusive !== undefined)
    product.appleFeeInclusive = data.appleFeeInclusive;
  if (data.trackQuantity !== undefined) product.trackQuantity = data.trackQuantity;
  if (data.quantity !== undefined) product.quantity = data.quantity;
  if (data.lowStockThreshold !== undefined) product.lowStockThreshold = data.lowStockThreshold;
  if (data.images !== undefined) product.images = data.images;
  if (data.videos !== undefined) product.videos = data.videos;
  if (data.youtubeLink !== undefined) product.youtubeLink = data.youtubeLink;
  if (data.isSubscription !== undefined) product.isSubscription = data.isSubscription;
  if (data.subscriptionPeriod !== undefined) product.subscriptionPeriod = data.subscriptionPeriod;
  if (data.categoryName !== undefined) product.categoryName = data.categoryName;
  if (data.tags !== undefined) product.tags = data.tags;
  if (data.isDigital !== undefined) product.isDigital = data.isDigital;
  if (data.requiresShipping !== undefined) product.requiresShipping = data.requiresShipping;
  if (data.deliveryMethod !== undefined) product.deliveryMethod = data.deliveryMethod;
  if (data.status !== undefined) product.status = data.status;

  // Update product detail page fields
  if (data.rating !== undefined) product.rating = data.rating;
  if (data.ratingCount !== undefined) product.ratingCount = data.ratingCount;
  if (data.downloadCount !== undefined) product.downloadCount = data.downloadCount;
  if (data.whatsIncluded !== undefined) product.whatsIncluded = data.whatsIncluded;
  if (data.keyFeatures !== undefined) product.keyFeatures = data.keyFeatures as IKeyFeature[];
  if (data.whatsInside !== undefined) product.whatsInside = data.whatsInside as IWhatsInsideGroup[];
  if (data.faqs !== undefined) product.faqs = data.faqs as IFaq[];
  if (data.productDetails !== undefined) product.productDetails = data.productDetails as IProductDetail[];

  // Thank-you page — undefined = leave as-is, null = clear, else replace.
  if (data.thankYouPage !== undefined) {
    const normalized = normalizeThankYouPage(data.thankYouPage);
    if (normalized === null) {
      product.thankYouPage = undefined;
    } else {
      product.thankYouPage = normalized;
    }
  }

  // Update reviews with proper _id handling
  if (data.reviews !== undefined) {
    product.reviews = data.reviews.map((r) => ({
      _id: r._id ? new Types.ObjectId(r._id) : new Types.ObjectId(),
      reviewerName: r.reviewerName,
      reviewerRole: r.reviewerRole,
      reviewerAvatar: r.reviewerAvatar,
      rating: r.rating,
      text: r.text,
      helpfulCount: r.helpfulCount || 0,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    }));
  }

  // Update digital assets
  if (data.digitalAssets !== undefined) {
    product.digitalAssets = data.digitalAssets.map((asset) => ({
      _id: asset._id ? new Types.ObjectId(asset._id) : new Types.ObjectId(),
      name: asset.name,
      fileUrl: asset.fileUrl,
      fileType: asset.fileType,
      fileSize: asset.fileSize,
    }));
  }

  // Update digital links
  if (data.digitalLinks !== undefined) {
    product.digitalLinks = data.digitalLinks.map((link) => ({
      _id: link._id ? new Types.ObjectId(link._id) : new Types.ObjectId(),
      label: link.label,
      url: link.url,
      description: link.description,
      linkType: link.linkType || "static",
    }));
  }

  // Update channel IDs
  if (data.channelIds !== undefined) {
    product.channelIds = data.channelIds.map((id) => new Types.ObjectId(id));
  }

  // Update private one-time-offer allowlist. Cross-validate against the
  // effective isSubscription state after applying this update.
  if (data.allowedUserIds !== undefined) {
    const effectiveIsSubscription =
      data.isSubscription !== undefined
        ? data.isSubscription
        : !!product.isSubscription;
    if (effectiveIsSubscription && data.allowedUserIds.length > 0) {
      throw new Error(
        "Subscription products cannot use per-user allowlists — subscriptions gate re-purchase natively",
      );
    }
    product.allowedUserIds = data.allowedUserIds.map(
      (id) => new Types.ObjectId(id),
    );
  }

  // Order-alert config. Re-snapshotted by the form on every save, so a template
  // edited in Network Mail lands here the next time the product is saved.
  if (data.emailAlerts !== undefined) {
    product.emailAlerts = normalizeEmailAlerts(data.emailAlerts);
  }

  // The founder's own "someone bought this" alert. Same "only when sent" rule
  // — a stock adjustment must not silently clear the toggle.
  if (data.founderAlerts !== undefined) {
    product.founderAlerts = normalizeFounderAlerts(data.founderAlerts);
  }

  return product.save();
}

export async function deleteProduct(productId: string, organizationId: string): Promise<boolean> {
  const result = await Product.deleteOne({
    _id: new Types.ObjectId(productId),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (result.deletedCount > 0) {
    // Clean up all custom links for this product (non-blocking)
    UserProductLink.deleteMany({ productId: new Types.ObjectId(productId) }).catch((err) => {
      console.error("Failed to clean up custom links for deleted product:", err);
    });
  }

  return result.deletedCount > 0;
}

export async function getProductById(
  productId: string,
  organizationId: string
): Promise<IProduct | null> {
  return Product.findOne({
    _id: new Types.ObjectId(productId),
    organizationId: new Types.ObjectId(organizationId),
  }).populate("createdBy", "name email profilePicture").lean();
}

export async function getProductBySlug(
  slug: string,
  organizationId: string
): Promise<IProduct | null> {
  return Product.findOne({
    slug,
    organizationId: new Types.ObjectId(organizationId),
  }).populate("createdBy", "name email profilePicture").lean();
}

export interface GetProductsOptions {
  status?: "active" | "draft" | "archived" | "all";
  categoryName?: string;
  tags?: string[];
  isDigital?: boolean;
  channelId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "name" | "price";
  sortOrder?: "asc" | "desc";
}

export async function getProducts(
  organizationId: string,
  options: GetProductsOptions = {}
): Promise<{ products: IProduct[]; total: number; page: number; totalPages: number }> {
  const {
    status = "all",
    categoryName,
    tags,
    isDigital,
    channelId,
    search,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const query: Record<string, unknown> = {
    organizationId: new Types.ObjectId(organizationId),
  };

  if (status !== "all") {
    query.status = status;
  }

  if (categoryName) {
    query.categoryName = categoryName;
  }

  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }

  if (isDigital !== undefined) {
    query.isDigital = isDigital;
  }

  if (channelId) {
    query.channelIds = new Types.ObjectId(channelId);
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  const total = await Product.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const sortOptions: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === "asc" ? 1 : -1,
  };

  const products = await Product.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit)
    .populate("createdBy", "name email profilePicture")
    .lean();

  return { products, total, page, totalPages };
}

// Get products available to a user (channel membership + private one-time
// offer allowlist + hide-after-purchase for the allowlisted products).
export async function getAvailableProducts(
  organizationId: string,
  userChannelIds: string[],
  options: GetProductsOptions = {},
  userId?: string,
): Promise<{ products: IProduct[]; total: number; page: number; totalPages: number }> {
  const {
    categoryName,
    tags,
    isDigital,
    search,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const userChannelObjectIds = userChannelIds.map((id) => new Types.ObjectId(id));
  const orgObjectId = new Types.ObjectId(organizationId);

  // The three gate blocks that combine via $and:
  //   1. Existing channel visibility (unchanged).
  //   2. Allowlist gate: unrestricted OR caller is in allowedUserIds.
  //   3. Hide-after-purchase: unrestricted OR caller hasn't paid for it yet
  //      (only restricted products care — unrestricted stay purchaseable).
  const gates: any[] = [
    {
      $or: [
        { channelIds: { $size: 0 } }, // No channel restriction
        { channelIds: { $in: userChannelObjectIds } }, // User has access to at least one channel
      ],
    },
  ];

  if (userId) {
    const uid = new Types.ObjectId(userId);
    gates.push({
      $or: [
        { allowedUserIds: { $size: 0 } },
        { allowedUserIds: { $exists: false } },
        { allowedUserIds: uid },
      ],
    });

    // One-time-purchase hide: pre-query which restricted products the user
    // has already paid for in this org. Unrestricted products are exempt.
    const purchasedProductIds = await ProductOrder.distinct("items.productId", {
      userId: uid,
      organizationId: orgObjectId,
      paymentStatus: "paid",
    });
    if (purchasedProductIds.length > 0) {
      gates.push({
        $or: [
          { allowedUserIds: { $size: 0 } },
          { allowedUserIds: { $exists: false } },
          { _id: { $nin: purchasedProductIds } },
        ],
      });
    }
  }

  const query: Record<string, unknown> = {
    organizationId: orgObjectId,
    status: "active",
    $and: gates,
  };

  if (categoryName) {
    query.categoryName = categoryName;
  }

  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }

  if (isDigital !== undefined) {
    query.isDigital = isDigital;
  }

  if (search) {
    // Merge search into the $and chain (which already carries the gates)
    // instead of overwriting it.
    (query.$and as any[]).push({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ],
    });
  }

  const total = await Product.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const sortOptions: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === "asc" ? 1 : -1,
  };

  const products = await Product.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit)
    .populate("createdBy", "name email profilePicture")
    .lean();

  return { products, total, page, totalPages };
}

// ============ Order Management ============

export interface CreateOrderData {
  organizationId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress?: IShippingAddress;
  paymentMethod?: string;
  paymentId?: string;
  notes?: string;
  /**
   * GST for this order, in the order's smallest currency unit.
   *
   * The checkout routes compute GST and put it on the Invoice, but the
   * ProductOrder used to hardcode `tax: 0` — so the seller's own order record
   * (and the storefront Order mirrored from it, which renders a "GST (18%)"
   * row from `totalTax`) understated both the tax and the total. Callers that
   * charged GST must pass it here so the two records agree.
   */
  tax?: number;
  /**
   * Suppress the automatic $0 invoice this service mints for free orders.
   *
   * For callers that mint their own richer free invoice and hang downstream
   * work off it — `/checkout/product/:id` carries bat246 board/referral
   * metadata and triggers board placement + the order email;
   * `/products/orders/create-razorpay-order` uses a different
   * `metadata.type` ("product_order"). Without this they would get two
   * invoices for one order.
   *
   * Leave unset on any new caller so the invoice happens by default — that
   * default is the whole point of minting here rather than in the routes.
   */
  skipFreeInvoice?: boolean;
  /**
   * PRE-TAX subtotal, when the caller already computed one.
   *
   * Required alongside `tax` for GST-INCLUSIVE products: this function derives
   * subtotal from the products' listed prices, and for an inclusive product
   * the listed price already contains the tax — so `subtotal + tax` would
   * count it twice. Pass the extracted base (the same figure that went onto
   * the invoice line items) to keep subtotal + tax === total.
   */
  subtotal?: number;
  /**
   * Skip this function's own commission distribution (below) for a sale that
   * didn't move real money — e.g. a BAT246 entry paid with B2 Coins or a
   * Snap Back Loan (fulfillInvoice's `case "product":`,
   * invoice.metadata.paidWithB2Coins). This is the FIRST commission
   * distribution callsite in the product purchase flow (see the comment on
   * that call below), so unlike a route-level caller it can't rely on
   * distributeCommissions' paymentId dedup to no-op a second, already-blocked
   * call — there's nothing to dedupe against if this is the only call that
   * would otherwise run.
   */
  skipCommission?: boolean;
}

export async function createOrder(data: CreateOrderData): Promise<IProductOrder> {
  // Check for duplicate order with same paymentId to prevent double processing
  if (data.paymentId) {
    const existingOrder = await ProductOrder.findOne({
      paymentId: data.paymentId,
      organizationId: new Types.ObjectId(data.organizationId),
    }).lean();

    if (existingOrder) {
      console.log(`Order already exists for paymentId: ${data.paymentId}`);
      return existingOrder as IProductOrder;
    }
  }

  // Fetch all products
  const productIds = data.items.map((item) => new Types.ObjectId(item.productId));
  const products = await Product.find({
    _id: { $in: productIds },
    organizationId: new Types.ObjectId(data.organizationId),
  });

  if (products.length !== data.items.length) {
    throw new Error("Some products not found");
  }

  // Look up the buyer's referrer for dynamic link resolution
  // Wrapped in try-catch so dynamic link resolution never blocks order creation
  let referrerId: any = null;
  let referrerCustomLinks: Map<string, { url: string; label?: string; description?: string }> = new Map();
  try {
    const buyer = await User.findById(new Types.ObjectId(data.userId))
      .select("referredBy")
      .lean();
    referrerId = buyer?.referredBy;

    if (referrerId) {
      const customLinks = await UserProductLink.find({
        userId: referrerId,
        productId: { $in: productIds },
      }).lean();
      for (const cl of customLinks) {
        referrerCustomLinks.set(`${cl.productId.toString()}:${cl.digitalLinkLabel}`, {
          url: cl.url,
          label: cl.label,
          description: cl.description,
        });
      }
    }
  } catch (err) {
    console.error("Dynamic link resolution failed, falling back to default links:", err);
    referrerId = null;
    referrerCustomLinks = new Map();
  }

  // Build order items and calculate totals
  let subtotal = 0;
  let requiresShipping = false;
  const orderItems: IOrderItem[] = [];

  for (const item of data.items) {
    const product = products.find((p) => p._id.toString() === item.productId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    // Check inventory if tracking is enabled
    if (product.trackQuantity && product.quantity !== undefined) {
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }

    const unitPrice = product.price;
    const totalPrice = unitPrice * item.quantity;
    subtotal += totalPrice;

    if (product.requiresShipping) {
      requiresShipping = true;
    }

    // Resolve digital links with dynamic link support
    let resolvedDigitalLinks: IOrderItem["digitalLinks"] = undefined;
    if (product.isDigital && product.digitalLinks?.length > 0) {
      resolvedDigitalLinks = product.digitalLinks.map((link) => {
        if (link.linkType === "dynamic" && referrerId) {
          const customLink = referrerCustomLinks.get(
            `${product._id.toString()}:${link.label}`
          );
          if (customLink) {
            return {
              label: customLink.label || link.label,
              url: customLink.url,
              description: customLink.description || link.description,
              linkType: "dynamic" as const,
              isCustomLink: true,
              customLinkSetBy: referrerId as Types.ObjectId,
            };
          }
        }
        return {
          label: link.label,
          url: link.url,
          description: link.description,
          linkType: link.linkType || ("static" as const),
          isCustomLink: false,
        };
      });
    }

    orderItems.push({
      productId: product._id,
      productName: product.name,
      productImage: product.images[0],
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      isDigital: product.isDigital,
      digitalAssets: product.isDigital
        ? product.digitalAssets.map((asset) => ({
            name: asset.name,
            fileUrl: asset.fileUrl,
            fileType: asset.fileType,
          }))
        : undefined,
      digitalLinks: resolvedDigitalLinks,
    });
  }

  // Validate shipping address if required
  if (requiresShipping && !data.shippingAddress) {
    throw new Error("Shipping address required for physical products");
  }

  // Money on the order record. Callers that charged GST pass the pre-tax
  // subtotal + tax so this matches the invoice; everyone else keeps the
  // legacy behaviour of listed-price subtotal and no tax.
  const orderTax = data.tax ?? 0;
  const orderSubtotal = data.subtotal ?? subtotal;

  // Free orders are auto-completed (no payment needed)
  const isFreeOrder = subtotal === 0 || data.paymentMethod === "free";

  const order = new ProductOrder({
    organizationId: new Types.ObjectId(data.organizationId),
    userId: new Types.ObjectId(data.userId),
    items: orderItems,
    subtotal: orderSubtotal,
    discount: 0,
    // GST as charged on the paired invoice (0 when none applied — foreign
    // buyer, exempt item, or a caller that doesn't tax). `total` must include
    // it or the seller's order and the storefront mirror understate the sale.
    tax: orderTax,
    shippingCost: 0,
    total: orderSubtotal + orderTax,
    currency: products[0]?.currency || "USD",
    status: isFreeOrder ? "delivered" : "pending",
    paymentStatus: isFreeOrder ? "paid" : "pending",
    paymentMethod: data.paymentMethod,
    paymentId: data.paymentId,
    shippingAddress: data.shippingAddress,
    requiresShipping,
    notes: data.notes,
  });

  const savedOrder = await order.save();

  // Update inventory
  for (const item of data.items) {
    const product = products.find((p) => p._id.toString() === item.productId);
    if (product?.trackQuantity && product.quantity !== undefined) {
      await Product.updateOne(
        { _id: product._id },
        { $inc: { quantity: -item.quantity } }
      );
    }
  }

  // Distribute commissions for the order
  // Note: In production, this would be done after payment confirmation
  // For now, we distribute immediately on order creation
  // Each product may have its own comb plan, so we distribute per product
  if (subtotal > 0 && !data.skipCommission) {
    for (const item of data.items) {
      const product = products.find((p) => p._id.toString() === item.productId);
      if (product) {
        const orderItem = orderItems.find(
          (oi) => oi.productId.toString() === item.productId
        );
        if (orderItem && orderItem.totalPrice > 0) {
          try {
            // Pre-tax base (per unit × quantity). Only an inclusive-priced
            // product sold to an Indian buyer carries GST inside its listed
            // price. This is the FIRST commission distribution callsite in
            // the product purchase flow — route-level callers dedup on
            // paymentId, so this service-level path is the source of truth
            // for commission math.
            const { getCommissionBase } = await import("../utils/gstTax");
            const { isBuyerInIndia } = await import("../utils/gstBuyerRegion");
            const perUnitCommissionBase = getCommissionBase(
              orderItem.unitPrice || orderItem.totalPrice / item.quantity,
              { gstInclusive: (product as any).gstInclusive },
              await isBuyerInIndia(data.userId, product.currency || "USD")
            );
            await distributeCommissions({
              orgId: data.organizationId,
              sellerId: product.createdBy.toString(),
              customerId: data.userId,
              itemType: "product",
              itemId: product._id.toString(),
              itemName: product.name,
              saleAmount: perUnitCommissionBase * item.quantity,
              currency: product.currency || "USD",
              paymentId: data.paymentId,
              metadata: {
                orderId: savedOrder._id.toString(),
                orderNumber: savedOrder.orderNumber,
                quantity: item.quantity,
              },
            });
          } catch (error) {
            console.error(
              `Error distributing commissions for product ${product.name}:`,
              error
            );
            // Don't fail the order if commission distribution fails
          }
        }
      }
    }
  }

  // Free orders get the same $0 paper trail a free /checkout/product/:id
  // produces. Closes the legacy POST /products/orders endpoint, which granted
  // the product with no invoice at all. One invoice per product in the basket.
  // The order is saved above — the invoice is best-effort and never blocks it.
  if (isFreeOrder && !data.skipFreeInvoice) {
    // Backgrounded: bookkeeping must not add latency to the order response.
    const { mintFreeItemInvoiceInBackground } = await import("./freeInvoice");
    for (const item of data.items) {
      const product: any = products.find(
        (p) => p._id.toString() === item.productId,
      );
      if (!product) continue;
      mintFreeItemInvoiceInBackground({
        userId: data.userId,
        orgId: data.organizationId,
        sellerId: String(product.createdBy),
        itemType: "product",
        itemId: String(product._id),
        itemName: product.name,
        itemDescription: product.description,
        itemImage: Array.isArray(product.images) ? product.images[0] : undefined,
        currency: product.currency,
        metadataType: "product_checkout",
        source: "checkout",
        // A free order is still an order the buyer placed — same confirmation
        // (with its download links) a paid one gets. The order carries those
        // links, so it has to travel with the mint.
        notifyBuyer: true,
        // Single-item basket only. The order lists every product in it, so
        // attaching it to each of N per-product invoices would send N
        // identical emails; a multi-item free basket falls back to the
        // per-product line instead.
        order: data.items.length === 1 ? savedOrder : undefined,
      });
    }
  }

  return savedOrder;
}

export async function getOrderById(
  orderId: string,
  organizationId: string
): Promise<IProductOrder | null> {
  return ProductOrder.findOne({
    _id: new Types.ObjectId(orderId),
    organizationId: new Types.ObjectId(organizationId),
  })
    .populate("userId", "name email profilePicture")
    .lean();
}

export async function getUserOrders(
  userId: string,
  organizationId: string,
  options: { page?: number; limit?: number; status?: string } = {}
): Promise<{ orders: IProductOrder[]; total: number; page: number; totalPages: number }> {
  const { page = 1, limit = 20, status } = options;

  const query: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(organizationId),
  };

  if (status) {
    query.status = status;
  }

  const total = await ProductOrder.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const orders = await ProductOrder.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { orders, total, page, totalPages };
}

export async function getOrganizationOrders(
  organizationId: string,
  options: { page?: number; limit?: number; status?: string; paymentStatus?: string } = {}
): Promise<{ orders: IProductOrder[]; total: number; page: number; totalPages: number }> {
  const { page = 1, limit = 20, status, paymentStatus } = options;

  const query: Record<string, unknown> = {
    organizationId: new Types.ObjectId(organizationId),
  };

  if (status) {
    query.status = status;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  const total = await ProductOrder.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const orders = await ProductOrder.find(query)
    .populate("userId", "name email profilePicture")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { orders, total, page, totalPages };
}

export async function updateOrderStatus(
  orderId: string,
  organizationId: string,
  status: IProductOrder["status"],
  trackingInfo?: { trackingNumber?: string; trackingUrl?: string }
): Promise<IProductOrder | null> {
  const updateData: Record<string, unknown> = { status };

  if (trackingInfo?.trackingNumber) {
    updateData.trackingNumber = trackingInfo.trackingNumber;
  }

  if (trackingInfo?.trackingUrl) {
    updateData.trackingUrl = trackingInfo.trackingUrl;
  }

  return ProductOrder.findOneAndUpdate(
    {
      _id: new Types.ObjectId(orderId),
      organizationId: new Types.ObjectId(organizationId),
    },
    { $set: updateData },
    { new: true }
  )
    .populate("userId", "name email profilePicture")
    .lean();
}

export async function updatePaymentStatus(
  orderId: string,
  organizationId: string,
  paymentStatus: IProductOrder["paymentStatus"],
  paymentId?: string
): Promise<IProductOrder | null> {
  const updateData: Record<string, unknown> = { paymentStatus };

  if (paymentId) {
    updateData.paymentId = paymentId;
  }

  // If payment is successful, update order status to confirmed
  if (paymentStatus === "paid") {
    updateData.status = "confirmed";
  }

  return ProductOrder.findOneAndUpdate(
    {
      _id: new Types.ObjectId(orderId),
      organizationId: new Types.ObjectId(organizationId),
    },
    { $set: updateData },
    { new: true }
  )
    .populate("userId", "name email profilePicture")
    .lean();
}

// Get order statistics for organization
export async function getOrderStats(organizationId: string): Promise<{
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
}> {
  const orgId = new Types.ObjectId(organizationId);

  const [totalOrders, pendingOrders, completedOrders, revenueResult] = await Promise.all([
    ProductOrder.countDocuments({ organizationId: orgId }),
    ProductOrder.countDocuments({ organizationId: orgId, status: "pending" }),
    ProductOrder.countDocuments({ organizationId: orgId, status: "delivered" }),
    ProductOrder.aggregate([
      { $match: { organizationId: orgId, paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  return {
    totalOrders,
    totalRevenue: revenueResult[0]?.total || 0,
    pendingOrders,
    completedOrders,
  };
}
