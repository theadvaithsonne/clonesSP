import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { isFounderOrModuleAdmin } from "../utils/rbac";
import { User } from "../models/user.model";
import { Product } from "../models/product.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { ProductOrder } from "../models/productOrder.model";
import { UserProductLink } from "../models/userProductLink.model";
import { Organization } from "../models/organization.model";
import { notifyNewProductCreated } from "../services/bulkEmail";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getAvailableProducts,
  createOrder as createProductOrder,
  getOrderById,
  getUserOrders,
  getOrganizationOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats,
  CreateProductData,
  UpdateProductData,
  GetProductsOptions,
} from "../services/product";
import {
  createOrder as createRazorpayOrder,
  verifyPaymentSignature,
} from "../services/razorpay";
import { distributeCommissions } from "../services/commission";
import { getCommissionBase, applyGstToLine } from "../utils/gstTax";
import { isBuyerInIndia } from "../utils/gstBuyerRegion";
import {
  createSubscriptionPlan,
  getSubscriptionPlanForItem,
  createUserSubscription,
  hasSubscriptionAccess,
  getUserActiveSubscription,
} from "../services/subscription";

const router = Router();

/**
 * Can this user manage digital products in this org?
 *
 * Founders, legacy single-org admins and `fullAccess` holders — plus members a
 * founder granted the "digital_products" module via /rbac. A superset of the
 * founder check this previously performed, so nobody loses access.
 */
async function isUserFounder(userId: string, orgId: string): Promise<boolean> {
  return isFounderOrModuleAdmin(userId, orgId, "digital_products");
}

// Helper: resolve channel IDs a user belongs to within an org.
// Uses a direct ChannelMembership query (orgId + status:active) matching
// the pattern in course.ts to avoid the field-name mismatch in the shared
// channelMembership service.
async function resolveUserChannelIds(
  userId: string,
  orgId: string,
): Promise<string[]> {
  const memberships = await ChannelMembership.find({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    status: "active",
  })
    .select("channelId")
    .lean();
  return memberships.map((m: any) => m.channelId.toString());
}

// ============ Product Routes ============

// Get all products (founders see all, stakeholders see available)
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const isFounder = await isUserFounder(userId, orgId);

    const options: GetProductsOptions = {
      status: req.query.status as GetProductsOptions["status"],
      categoryName: req.query.categoryName as string,
      tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
      isDigital:
        req.query.isDigital === "true"
          ? true
          : req.query.isDigital === "false"
            ? false
            : undefined,
      channelId: req.query.channelId as string,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as GetProductsOptions["sortBy"],
      sortOrder: req.query.sortOrder as GetProductsOptions["sortOrder"],
    };

    let result;

    if (isFounder) {
      // Founders see all products — including sold-out private one-time
      // offers, so they can audit / edit / archive without visibility gates.
      result = await getProducts(orgId, options);
    } else {
      // Stakeholders see only available products: channel-visible AND
      // (unrestricted OR on the allowlist) AND (unrestricted OR unpaid).
      const channelIds = await resolveUserChannelIds(userId, orgId);
      result = await getAvailableProducts(orgId, channelIds, options, userId);
    }

    res.json({
      ...result,
      isFounder,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Get single product
router.get("/:productId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { productId } = req.params;

    const product = await getProductById(productId, orgId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const isFounder = await isUserFounder(userId, orgId);

    // Check access for stakeholders
    if (!isFounder && product.status !== "active") {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check channel access for stakeholders
    if (!isFounder && product.channelIds.length > 0) {
      const channelIds = await resolveUserChannelIds(userId, orgId);
      const hasAccess = product.channelIds.some((chId) =>
        channelIds.includes(chId.toString()),
      );

      if (!hasAccess) {
        return res
          .status(403)
          .json({ error: "You don't have access to this product" });
      }
    }

    // Private one-time offer guard for stakeholders. Two independent checks
    // that both use `product.allowedUserIds` (empty = unrestricted).
    if (!isFounder && (product.allowedUserIds?.length ?? 0) > 0) {
      const onAllowlist = product.allowedUserIds!.some(
        (uid: any) => uid.toString() === userId,
      );
      if (!onAllowlist) {
        return res
          .status(403)
          .json({ error: "You don't have access to this product" });
      }
      // Hide the product from anyone on the allowlist who already paid.
      const alreadyBought = await ProductOrder.exists({
        userId: new Types.ObjectId(userId),
        organizationId: new Types.ObjectId(orgId),
        "items.productId": new Types.ObjectId(productId),
        paymentStatus: "paid",
      });
      if (alreadyBought) {
        return res.status(404).json({ error: "Product not found" });
      }
    }

    res.json({ product, isFounder });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Create product (founders only)
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can create products" });
    }

    const {
      name,
      description,
      sku,
      price,
      currency,
      gstInclusive,
      requireIosPayment,
      appleFeeInclusive,
      trackQuantity,
      quantity,
      lowStockThreshold,
      images,
      videos,
      youtubeLink,
      categoryName,
      tags,
      isDigital,
      requiresShipping,
      deliveryMethod,
      digitalAssets,
      digitalLinks,
      channelIds,
      allowedUserIds,
      status,
      isSubscription,
      subscriptionPeriod,
      // Product detail page fields
      rating,
      ratingCount,
      downloadCount,
      whatsIncluded,
      keyFeatures,
      whatsInside,
      reviews,
      faqs,
      productDetails,
      emailAlerts,
      // "Notify me when someone buys" — the founder's own alert, separate
      // from the buyer's order email. See models/founderAlerts.schema.ts.
      founderAlerts,
      thankYouPage,
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: "Name and price are required" });
    }

    const productData: CreateProductData = {
      organizationId: orgId,
      createdBy: userId,
      name,
      description,
      sku,
      price,
      currency,
      gstInclusive,
      requireIosPayment,
      appleFeeInclusive,
      trackQuantity,
      quantity,
      lowStockThreshold,
      images,
      videos,
      youtubeLink,
      categoryName,
      tags,
      isDigital,
      requiresShipping,
      deliveryMethod,
      digitalAssets,
      digitalLinks,
      channelIds,
      allowedUserIds,
      status,
      isSubscription,
      subscriptionPeriod,
      // Product detail page fields
      rating,
      ratingCount,
      downloadCount,
      whatsIncluded,
      keyFeatures,
      whatsInside,
      reviews,
      faqs,
      productDetails,
      emailAlerts,
      founderAlerts,
      thankYouPage,
    };

    // Auto-tag digital products created by Alan K as bat246_entry so the
    // checkout routing recognises them as game entries without manual tagging.
    if (isDigital) {
      const creator = (await User.findById(userId)
        .select("email")
        .lean()) as any;
      if (creator?.email === "redbaron2020@mail.com") {
        productData.tags = Array.from(
          new Set([...(productData.tags || []), "bat246_entry"]),
        );
      }
    }

    let product;
    try {
      product = await createProduct(productData);
    } catch (svcErr: any) {
      const msg = String(svcErr?.message || "");
      // Surface user-input validation errors (allowlist cross-check,
      // thank-you page URL / section shape, etc.) as 400 so the FE can
      // render a proper toast instead of a generic 500.
      if (
        msg.includes("allowlist") ||
        msg.includes("URL") ||
        msg.includes("thank-you") ||
        msg.includes("Section") ||
        msg.includes("required")
      ) {
        return res.status(400).json({ error: msg });
      }
      throw svcErr;
    }

    // Notify org members about the new product (only for active products).
    // Scoped to this office so members of unrelated orgs aren't spammed.
    if (product.status === "active") {
      const org = await Organization.findById(orgId).select("name").lean();
      notifyNewProductCreated(
        {
          _id: product._id.toString(),
          name: product.name,
          price: product.price,
          currency: product.currency,
          description: product.description,
          images: product.images,
        },
        (org as any)?.name || "an organization",
        orgId,
      );
    }

    res.status(201).json({ product });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Update product (founders only)
router.put("/:productId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { productId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can update products" });
    }

    const updateData: UpdateProductData = req.body;

    let product;
    try {
      product = await updateProduct(productId, orgId, updateData);
    } catch (svcErr: any) {
      const msg = String(svcErr?.message || "");
      // Surface validation errors from normalizeThankYouPage / allowlist
      // guards etc. as 400s instead of a generic 500.
      if (
        msg.includes("allowlist") ||
        msg.includes("URL") ||
        msg.includes("thank-you") ||
        msg.includes("Section") ||
        msg.includes("required")
      ) {
        return res.status(400).json({ error: msg });
      }
      throw svcErr;
    }

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ product });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete product (founders only)
router.delete(
  "/:productId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      // Use orgId from query params if provided, fallback to JWT
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { productId } = req.params;
      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can delete products" });
      }

      const deleted = await deleteProduct(productId, orgId);

      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  },
);

// ============ Custom Dynamic Link Routes ============

/**
 * GET /:productId/my-links
 * Get the authenticated user's custom links for a product's dynamic digital links
 */
router.get(
  "/:productId/my-links",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { productId } = req.params;

      const product = await Product.findOne({
        _id: new Types.ObjectId(productId),
        organizationId: new Types.ObjectId(orgId),
      }).lean();

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Fetch user's custom links for this product
      const customLinks = await UserProductLink.find({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      }).lean();

      // Build response with product's dynamic links and user's custom overrides
      const dynamicLinks = (product.digitalLinks || [])
        .filter((link) => link.linkType === "dynamic")
        .map((link) => {
          const custom = customLinks.find(
            (cl) => cl.digitalLinkLabel === link.label,
          );
          return {
            label: link.label,
            originalUrl: link.url,
            description: link.description,
            linkType: link.linkType,
            customLink: custom
              ? {
                  url: custom.url,
                  label: custom.label,
                  description: custom.description,
                  _id: custom._id,
                }
              : null,
          };
        });

      res.json({ dynamicLinks, customLinks });
    } catch (error) {
      console.error("Error fetching custom links:", error);
      res.status(500).json({ error: "Failed to fetch custom links" });
    }
  },
);

/**
 * PUT /:productId/my-links
 * Set or update a custom link for a dynamic digital link on a product
 * Requires: user must have a paid order for this product
 */
router.put(
  "/:productId/my-links",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { productId } = req.params;
      const { digitalLinkLabel, url, label, description } = req.body;

      if (!digitalLinkLabel || !url) {
        return res
          .status(400)
          .json({ error: "digitalLinkLabel and url are required" });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Please provide a valid URL" });
      }

      // Verify the product exists and has a dynamic link with this label
      const product = await Product.findOne({
        _id: new Types.ObjectId(productId),
        organizationId: new Types.ObjectId(orgId),
      }).lean();

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const dynamicLink = product.digitalLinks?.find(
        (link) =>
          link.label === digitalLinkLabel && link.linkType === "dynamic",
      );

      if (!dynamicLink) {
        return res
          .status(400)
          .json({ error: "No dynamic digital link found with this label" });
      }

      // Upsert the custom link
      const customLink = await UserProductLink.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          productId: new Types.ObjectId(productId),
          digitalLinkLabel,
        },
        {
          url,
          label: label || undefined,
          description: description || undefined,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      res.json({ success: true, customLink });
    } catch (error) {
      console.error("Error setting custom link:", error);
      res.status(500).json({ error: "Failed to set custom link" });
    }
  },
);

/**
 * DELETE /:productId/my-links/:digitalLinkLabel
 * Remove a custom link for a specific dynamic digital link
 */
router.delete(
  "/:productId/my-links/:digitalLinkLabel",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const { productId, digitalLinkLabel } = req.params;

      const result = await UserProductLink.deleteOne({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
        digitalLinkLabel: decodeURIComponent(digitalLinkLabel),
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Custom link not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom link:", error);
      res.status(500).json({ error: "Failed to delete custom link" });
    }
  },
);

// ============ Subscription Routes ============

/**
 * POST /:productId/create-subscription
 * Create a subscription for a subscription-based product
 */
router.post(
  "/:productId/create-subscription",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { productId } = req.params;

      // Get the product
      const product = await Product.findOne({
        _id: new Types.ObjectId(productId),
        organizationId: new Types.ObjectId(orgId),
        status: "active",
      }).lean();

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      // Check if it's a subscription product
      if (!product.isSubscription) {
        return res.status(400).json({
          success: false,
          error:
            "This product is not subscription-based. Use the regular purchase flow.",
        });
      }

      // Check if user already has an active subscription
      const existingAccess = await hasSubscriptionAccess(
        userId,
        "product",
        productId,
      );
      if (existingAccess) {
        return res.status(400).json({
          success: false,
          error: "You already have an active subscription to this product",
        });
      }

      // Get or create subscription plan
      let plan = await getSubscriptionPlanForItem("product", productId);

      if (!plan) {
        // Auto-create the plan
        const price = product.price;
        const period = product.subscriptionPeriod || "monthly";
        plan = await createSubscriptionPlan({
          itemType: "product",
          itemId: productId,
          orgId,
          sellerId: product.createdBy.toString(),
          name: `${product.name} - ${period.charAt(0).toUpperCase() + period.slice(1)} Subscription`,
          amount: Math.round(price * 100),
          currency: product.currency || "USD",
          period,
        });
      }

      // Create the subscription
      const subscription = await createUserSubscription({
        userId,
        planId: plan._id.toString(),
        orgId,
      });

      res.json({
        success: true,
        subscription: {
          id: subscription._id,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          shortUrl: subscription.shortUrl,
          status: subscription.status,
        },
        plan: {
          id: plan._id,
          name: plan.name,
          amount: plan.amount,
          period: plan.period,
          currency: plan.currency,
        },
      });
    } catch (error) {
      console.error("Error creating product subscription:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create subscription",
        details: (error as Error).message,
      });
    }
  },
);

/**
 * GET /:productId/subscription-status
 * Get subscription status for a product
 */
router.get(
  "/:productId/subscription-status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { productId } = req.params;

      // Get the product
      const product = await Product.findOne({
        _id: new Types.ObjectId(productId),
        organizationId: new Types.ObjectId(orgId),
      }).lean();

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      // Check if it's a subscription product
      if (!product.isSubscription) {
        return res.json({
          success: true,
          isSubscriptionProduct: false,
          hasAccess: false, // For regular products, check purchase history
        });
      }

      // Check subscription access
      const hasAccess = await hasSubscriptionAccess(
        userId,
        "product",
        productId,
      );
      const activeSubscription = await getUserActiveSubscription(
        userId,
        "product",
        productId,
      );

      // Get subscription plan
      const plan = await getSubscriptionPlanForItem("product", productId);

      res.json({
        success: true,
        isSubscriptionProduct: true,
        hasAccess,
        subscription: activeSubscription
          ? {
              id: activeSubscription._id,
              status: activeSubscription.status,
              currentEnd: activeSubscription.currentEnd,
              chargeAt: activeSubscription.chargeAt,
              paidCount: activeSubscription.paidCount,
            }
          : null,
        plan: plan
          ? {
              id: plan._id,
              name: plan.name,
              amount: plan.amount,
              period: plan.period,
              currency: plan.currency,
            }
          : null,
      });
    } catch (error) {
      console.error("Error getting product subscription status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get subscription status",
      });
    }
  },
);

// ============ Order Routes ============

// Create order (any authenticated user) - Legacy endpoint, use Razorpay flow instead
router.post("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { items, shippingAddress, paymentMethod, paymentId, notes } =
      req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Order must have at least one item" });
    }

    const order = await createProductOrder({
      organizationId: orgId,
      userId,
      items,
      shippingAddress,
      paymentMethod,
      paymentId,
      notes,
    });

    res.status(201).json({ order });
  } catch (error: any) {
    console.error("Error creating order:", error);
    res.status(400).json({ error: error.message || "Failed to create order" });
  }
});

// ============ Razorpay Payment Flow ============

/**
 * POST /orders/create-razorpay-order
 * Create Razorpay order for product purchase
 */
router.post(
  "/orders/create-razorpay-order",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      // Use orgId from query params if provided, fallback to JWT
      const orgId = (req.query.orgId as string) || jwtOrgId;
      // `forReserve` → purchased units become reserve licenses the buyer assigns
      // to others (read by fulfillInvoice's case "product").
      const { items, forReserve } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Order must have at least one item",
        });
      }

      // Validate items and calculate total
      let totalAmount = 0;
      const validatedItems: {
        productId: string;
        quantity: number;
        price: number;
        name: string;
        currency: string;
        gstInclusive: boolean;
        isBat246Entry: boolean;
      }[] = [];

      for (const item of items) {
        if (!item.productId || !item.quantity || item.quantity < 1) {
          return res.status(400).json({
            success: false,
            error: "Each item must have a productId and quantity >= 1",
          });
        }

        const product = await Product.findOne({
          _id: new Types.ObjectId(item.productId),
          organizationId: new Types.ObjectId(orgId),
          status: "active",
        }).lean();

        if (!product) {
          return res.status(404).json({
            success: false,
            error: `Product ${item.productId} not found or not available`,
          });
        }

        // Private one-time offer enforcement — mirrors the listing gate so
        // no-one can bypass it by POSTing directly with a known productId.
        if ((product.allowedUserIds?.length ?? 0) > 0) {
          const onAllowlist = product.allowedUserIds!.some(
            (uid: any) => uid.toString() === userId,
          );
          if (!onAllowlist) {
            return res.status(403).json({
              success: false,
              error: `You are not authorized to purchase ${product.name}`,
            });
          }
          const alreadyBought = await ProductOrder.exists({
            userId: new Types.ObjectId(userId),
            organizationId: new Types.ObjectId(orgId),
            "items.productId": product._id,
            paymentStatus: "paid",
          });
          if (alreadyBought) {
            return res.status(409).json({
              success: false,
              error: `You have already purchased ${product.name} — this is a one-time offer`,
            });
          }
        }

        // Check stock only if inventory tracking is enabled
        if (product.trackQuantity) {
          const availableQuantity = product.quantity ?? 0;
          if (availableQuantity < item.quantity) {
            return res.status(400).json({
              success: false,
              error: `Insufficient stock for ${product.name}. Available: ${availableQuantity}`,
            });
          }
        }

        const price = product.price;
        const itemTotal = price * item.quantity;
        totalAmount += itemTotal;

        validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price,
          name: product.name,
          currency: product.currency || "USD",
          gstInclusive: !!(product as any).gstInclusive,
          // Same exemption productCheckout.ts applies to single-product buys:
          // bat246 entries are priced net of tax. This path was missing it.
          isBat246Entry:
            Array.isArray((product as any).tags) &&
            (product as any).tags.includes("bat246_entry"),
        });
      }

      // Handle free products - skip Razorpay and create order directly
      if (totalAmount <= 0) {
        const order = await createProductOrder({
          organizationId: orgId,
          userId,
          items: validatedItems.map((vi) => ({
            productId: vi.productId,
            quantity: vi.quantity,
          })),
          paymentMethod: "free",
          // This route mints its own free invoice below under a different
          // metadata.type ("product_order"). Don't let the service add a
          // second one.
          skipFreeInvoice: true,
        });

        // Create paid invoice for free product (for records)
        try {
          const {
            createInvoice: createFreeInvoice,
          } = require("../services/invoice");
          const userDoc = await User.findById(userId)
            .select("email name")
            .lean();
          const firstProduct = await Product.findById(
            validatedItems[0].productId,
          )
            .select("createdBy images description")
            .lean();

          const freeInvoice = await createFreeInvoice({
            organizationId: orgId,
            sellerId: firstProduct?.createdBy?.toString() || userId,
            userId,
            customerEmail: userDoc?.email || "",
            customerName: userDoc?.name || undefined,
            lineItems: validatedItems.map((vi: any) => ({
              itemType: "product",
              itemId: vi.productId,
              itemName: vi.name,
              quantity: vi.quantity,
              unitPrice: 0,
              originalCurrency: vi.currency || "USD",
            })),
            itemCurrency: validatedItems[0]?.currency || "USD",
            metadata: { type: "product_order", free: true },
          });
          freeInvoice.status = "paid";
          freeInvoice.paidAt = new Date();
          await freeInvoice.save();
        } catch (invoiceErr) {
          console.error("[Product] Free invoice creation error:", invoiceErr);
        }

        return res.json({
          success: true,
          isFree: true,
          order,
          items: validatedItems,
          totalAmount: 0,
        });
      }

      // ── GST math ───────────────────────────────────────────────────
      // Multi-item basket: compute per-line unit + tax and sum tax into the
      // invoice-level tax field.
      //
      // GST applicability is a BUYER attribute, so it resolves once for the
      // whole cart. `gstInclusive` stays per-line (each product carries its
      // own founder answer), as does the bat246 exemption.
      const { applyGstToLine, GST_CONFIG } = await import("../utils/gstTax");
      const { resolveBuyerGstRegion, gstSkippedMetadata } =
        await import("../utils/gstBuyerRegion");

      const cartCurrency = validatedItems[0]?.currency || "USD";
      const gstRegion = await resolveBuyerGstRegion({
        buyerUserId: userId,
        paymentCurrency: cartCurrency,
      });

      let totalTaxCents = 0;
      let totalChargeCents = 0;
      let anyInclusive = false;
      let anyGst = false;
      const lineItems = validatedItems.map((vi) => {
        const line = applyGstToLine({
          listedAmountMinor: Math.round(vi.price * 100),
          quantity: vi.quantity,
          gstInclusive: vi.gstInclusive,
          buyerInIndia: gstRegion.inIndia,
          exempt: vi.isBat246Entry,
        });
        totalTaxCents += line.taxTotal;
        totalChargeCents += line.chargeTotal;
        if (line.gstMetadata) {
          anyGst = true;
          if (line.gstMetadata.inclusive) anyInclusive = true;
        }
        return {
          itemType: "product" as const,
          itemId: vi.productId,
          itemName: vi.name,
          quantity: vi.quantity,
          unitPrice: line.lineUnitPrice,
          originalCurrency: vi.currency || "USD",
        };
      });
      const gstMetadata = anyGst
        ? {
            rate: GST_CONFIG.rate,
            amount: totalTaxCents,
            // Basket-level flag reflects the mix. If items were mixed the
            // metadata still correctly totals — the founder-facing UI
            // shouldn't allow mixed carts, but reporting stays honest.
            inclusive: anyInclusive,
            sacCode: GST_CONFIG.sacCode,
            buyerCountry: gstRegion.country,
            buyerRegion: "IN" as const,
            regionSource: gstRegion.source,
          }
        : undefined;
      const gstSkipped = anyGst
        ? undefined
        : gstSkippedMetadata(
            gstRegion,
            gstRegion.inIndia ? "item_exempt" : "buyer_outside_india",
          );

      // Create Razorpay order
      const shortTs = Date.now().toString().slice(-12);
      const order = await createRazorpayOrder({
        amount: totalChargeCents,
        currency: cartCurrency,
        receipt: `pr_${shortTs}`,
        notes: {
          userId,
          orgId,
          itemCount: String(validatedItems.length),
          type: "product_order",
        },
      });

      // Create invoice for the payment flow
      let invoiceId: string | undefined;
      try {
        const { createInvoice } = require("../services/invoice");
        const userDoc = await User.findById(userId).select("email name").lean();

        // Find the seller (product creator) — use first product's creator
        const firstProduct = await Product.findById(validatedItems[0].productId)
          .select("createdBy images description")
          .lean();

        const invoice = await createInvoice({
          organizationId: orgId,
          sellerId: firstProduct?.createdBy?.toString() || userId,
          userId,
          customerEmail: userDoc?.email || "",
          customerName: userDoc?.name || undefined,
          lineItems,
          itemCurrency: cartCurrency,
          tax: totalTaxCents || undefined,
          metadata: {
            type: "product_order",
            ...(forReserve ? { forReserve: true } : {}),
            ...(gstMetadata ? { gst: gstMetadata } : {}),
            ...(gstSkipped ? { gstSkipped } : {}),
          },
        });
        invoiceId = invoice._id.toString();
      } catch (invoiceError) {
        console.error(
          "[Product] Invoice creation error (non-blocking):",
          invoiceError,
        );
      }

      res.json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        invoiceId,
        items: validatedItems,
        totalAmount,
      });
    } catch (error) {
      console.error("Error creating Razorpay order for products:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create order",
        details: (error as Error).message,
      });
    }
  },
);

/**
 * POST /orders/verify-payment
 * Verify Razorpay payment and create order with commission distribution
 */
router.post(
  "/orders/verify-payment",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      // Use orgId from query params if provided, fallback to JWT
      const orgId = (req.query.orgId as string) || jwtOrgId;

      const schema = z.object({
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().min(1),
          }),
        ),
        shippingAddress: z
          .object({
            fullName: z.string(),
            addressLine1: z.string(),
            addressLine2: z.string().optional(),
            city: z.string(),
            state: z.string(),
            postalCode: z.string(),
            country: z.string(),
            phone: z.string().optional(),
          })
          .optional(),
        notes: z.string().optional(),
      });

      const {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        items,
        shippingAddress,
        notes,
      } = schema.parse(req.body);

      // Verify signature
      const isValid = verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      );

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Payment verification failed",
        });
      }

      // GST applicability is a buyer attribute, so resolve it once for the
      // whole basket rather than per line. Carts are single-currency, so the
      // first item's currency is the right payment-currency fallback.
      const firstCartProduct = await Product.findById(items[0]?.productId)
        .select("currency")
        .lean();
      const commissionBuyerInIndia = await isBuyerInIndia(
        userId,
        firstCartProduct?.currency || "USD",
      );

      // Mirror the invoice's GST onto the seller's order record. Per line,
      // because gstInclusive and the bat246 exemption are per product. Without
      // this the storefront Order mirrored from this doc shows ₹0 GST and an
      // understated total on the seller's own invoice.
      let orderSubtotalCents = 0;
      let orderTaxCents = 0;
      for (const item of items) {
        const p = await Product.findById(item.productId)
          .select("price gstInclusive tags")
          .lean();
        if (!p) continue;
        const line = applyGstToLine({
          listedAmountMinor: Math.round(
            ((p as any).price || 0) * 100,
          ),
          quantity: item.quantity,
          gstInclusive: !!(p as any).gstInclusive,
          buyerInIndia: commissionBuyerInIndia,
          exempt:
            Array.isArray((p as any).tags) &&
            (p as any).tags.includes("bat246_entry"),
        });
        orderSubtotalCents += line.lineUnitPrice * item.quantity;
        orderTaxCents += line.taxTotal;
      }

      // Create the order
      const order = await createProductOrder({
        organizationId: orgId,
        userId,
        items,
        shippingAddress,
        paymentMethod: "razorpay",
        paymentId: razorpayPaymentId,
        notes,
        subtotal: orderSubtotalCents,
        tax: orderTaxCents,
      });

      // Distribute commissions for each product
      for (const item of items) {
        try {
          const product = await Product.findById(item.productId).lean();
          if (product) {
            const price = product.price;
            const itemTotal = price * item.quantity;

            if (itemTotal > 0) {
              await distributeCommissions({
                orgId,
                sellerId: product.createdBy.toString(),
                customerId: userId,
                itemType: "product",
                itemId: item.productId,
                itemName: product.name,
                saleAmount:
                  getCommissionBase(
                    price,
                    product as any,
                    commissionBuyerInIndia,
                  ) * item.quantity,
                currency: product.currency || "USD",
                paymentId: razorpayPaymentId,
                metadata: {
                  quantity: item.quantity,
                  unitPrice: price,
                  orderId: order._id.toString(),
                },
              });
            }
          }
        } catch (commissionError) {
          // Log but don't fail the order
          console.error(
            `Error distributing commissions for product ${item.productId}:`,
            commissionError,
          );
        }
      }

      // Update order payment status to paid
      const updatedOrder = await updatePaymentStatus(
        order._id.toString(),
        orgId,
        "paid",
        razorpayPaymentId,
      );

      res.json({
        success: true,
        message: "Payment verified and order created",
        order: updatedOrder || order,
      });
    } catch (error: any) {
      console.error("Error verifying product payment:", error);
      res.status(500).json({
        success: false,
        error: "Failed to verify payment",
        details: error.message,
      });
    }
  },
);

// Get user's orders
router.get("/orders/my", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || jwtOrgId;

    const options = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
    };

    const result = await getUserOrders(userId, orgId, options);

    res.json(result);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get organization orders (founders only)
router.get("/orders/all", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can view all orders" });
    }

    const options = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      paymentStatus: req.query.paymentStatus as string,
    };

    const result = await getOrganizationOrders(orgId, options);

    res.json(result);
  } catch (error) {
    console.error("Error fetching organization orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get order statistics (founders only)
router.get(
  "/orders/stats",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      // Use orgId from query params if provided, fallback to JWT
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can view order statistics" });
      }

      const stats = await getOrderStats(orgId);

      res.json(stats);
    } catch (error) {
      console.error("Error fetching order stats:", error);
      res.status(500).json({ error: "Failed to fetch order statistics" });
    }
  },
);

// Get single order
router.get(
  "/orders/:orderId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      // Use orgId from query params if provided, fallback to JWT
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { orderId } = req.params;

      const order = await getOrderById(orderId, orgId);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Check access - user can only see their own orders unless founder
      const isFounder = await isUserFounder(userId, orgId);
      if (!isFounder && order.userId.toString() !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({ order });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  },
);

// Update order status (founders only)
router.patch(
  "/orders/:orderId/status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      // Use orgId from query params if provided, fallback to JWT
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { orderId } = req.params;
      const { status, trackingNumber, trackingUrl } = req.body;

      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can update order status" });
      }

      const validStatuses = [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const order = await updateOrderStatus(orderId, orgId, status, {
        trackingNumber,
        trackingUrl,
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({ order });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  },
);

// Update payment status (founders only)
router.patch(
  "/orders/:orderId/payment",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      // Use orgId from query params if provided, fallback to JWT
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { orderId } = req.params;
      const { paymentStatus, paymentId } = req.body;

      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can update payment status" });
      }

      const validStatuses = ["pending", "paid", "failed", "refunded"];
      if (!validStatuses.includes(paymentStatus)) {
        return res.status(400).json({ error: "Invalid payment status" });
      }

      const order = await updatePaymentStatus(
        orderId,
        orgId,
        paymentStatus,
        paymentId,
      );

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({ order });
    } catch (error) {
      console.error("Error updating payment status:", error);
      res.status(500).json({ error: "Failed to update payment status" });
    }
  },
);

export default router;
