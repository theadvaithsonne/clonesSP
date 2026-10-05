import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import {
  previewEcommerceCart,
  createEcommerceInvoice,
  EcommerceError,
} from "../services/ecommerceInvoice";

const router = Router();

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  variantId: z.string().optional(),
  // ── Drop attribution (all present together, or all absent) ──
  // Set by the store app when the line was added via a drop's "Buy now".
  // dropCreatorId/Name are client-reported hints only; the real payee is
  // resolved authoritatively from the `storedrops` doc at fulfillment.
  dropProduct: z.boolean().optional(),
  dropId: z.string().max(64).optional(),
  dropCreatorId: z.string().max(64).optional(),
  dropCreatorName: z.string().max(200).optional(),
  // ── Live-selling attribution (both present together, or both absent) ──
  // Set by the store clients when the line was added from a product pinned
  // during a live session. Verified against WebinarProductPin at fulfillment.
  liveWorkshopId: z.string().max(64).optional(),
  liveSessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "liveSessionDate must be YYYY-MM-DD")
    .optional(),
  // Add-on labels ("Extra cheese"). Names only — each is priced from the
  // product's own itemDetails.addOns, never from the client.
  addOns: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
});

const previewSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(50),
  displayCurrency: z.enum(["USD", "INR"]),
  couponCode: z.string().optional(),
  // Affiliate id (`?ref`) — auto-attaches the referrer's cashback code.
  referralId: z.string().optional(),
});

// Loose phone format — digits with optional leading +. Matches the spec's
// "8–15 digits, optional leading +" requirement.
const phoneRegex = /^\+?\d{8,15}$/;

const addressSchema = z
  .object({
    fullName: z.string().min(1).max(120),
    addressLine1: z.string().min(3).max(250),
    addressLine2: z.string().max(250).optional().default(""),
    city: z.string().min(1).max(80),
    state: z.string().min(1).max(80),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(1).max(80),
    phone: z
      .string()
      .regex(phoneRegex, "phone must be 8–15 digits with optional leading +"),
  })
  .superRefine((addr, ctx) => {
    if (
      addr.country.trim().toLowerCase() === "india" &&
      !/^\d{6}$/.test(addr.postalCode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postalCode"],
        message: "Indian postalCode must be 6 digits",
      });
    }
  });

const createSchema = previewSchema
  .extend({
    customerEmail: z.string().email().optional(),
    customerName: z.string().optional(),
    shippingAddress: addressSchema.optional(),
    billingAddress: addressSchema.optional(),
    paymentMode: z.enum(["Prepaid", "COD"]).optional().default("Prepaid"),
    gstin: z.string().trim().max(20).optional(),
    companyName: z.string().trim().max(200).optional(),
    customerNote: z.string().trim().max(1000).optional(),
  })
  // Per spec section 6: unknown extra fields should be ignored, not 400'd —
  // lets the storefront evolve fields ahead of the backend.
  .passthrough();

function handleError(error: unknown, res: Response) {
  if (error instanceof EcommerceError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      error: error.message,
      ...(error.details || {}),
    });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      code: "INVALID_INPUT",
      error: "Invalid request payload",
      issues: error.issues,
    });
  }
  console.error("[Ecommerce] Unexpected error:", error);
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    error: (error as Error)?.message || "Unexpected error",
  });
}

/**
 * POST /api/ecommerce/cart/preview
 * Preview totals + currency conversion + inventory issues. No DB mutation.
 */
router.post(
  "/cart/preview",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const body = previewSchema.parse(req.body);
      const user = (req as any).user as { userId: string };
      const result = await previewEcommerceCart({
        items: body.items,
        displayCurrency: body.displayCurrency,
        couponCode: body.couponCode,
        userId: user.userId,
        referralId: body.referralId,
      });
      res.json({ success: true, ...result, currency: result.displayCurrency });
    } catch (err) {
      handleError(err, res);
    }
  }
);

/**
 * POST /api/ecommerce/invoices
 * Create the ecommerce invoice. Hard-fails on out-of-stock (no invoice
 * is created in that case).
 */
router.post("/invoices", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = createSchema.parse(req.body);
    const user = (req as any).user as { userId: string };

    // Default customerEmail/customerName from the User document if not supplied
    let customerEmail = body.customerEmail;
    let customerName = body.customerName;
    if (!customerEmail || !customerName) {
      const u = await User.findById(user.userId)
        .select("email name")
        .lean();
      if (!u) {
        return res
          .status(401)
          .json({ success: false, code: "UNAUTHORIZED", error: "User not found" });
      }
      customerEmail = customerEmail || u.email || "";
      customerName = customerName || u.name || undefined;
      if (!customerEmail) {
        return res.status(400).json({
          success: false,
          code: "INVALID_INPUT",
          error: "customerEmail is required (none on user record)",
        });
      }
    }

    const { invoice, payUrl } = await createEcommerceInvoice({
      userId: user.userId,
      customerEmail,
      customerName,
      items: body.items,
      displayCurrency: body.displayCurrency,
      couponCode: body.couponCode,
      referralId: body.referralId,
      shippingAddress: body.shippingAddress,
      billingAddress: body.billingAddress,
      paymentMode: body.paymentMode,
      gstin: body.gstin,
      companyName: body.companyName,
      customerNote: body.customerNote,
    });

    res.json({
      success: true,
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        itemCurrency: invoice.itemCurrency,
        expiresAt: invoice.expiresAt,
        shippingAddress: invoice.shippingAddress ?? null,
        billingAddress: invoice.billingAddress ?? null,
        paymentMode: invoice.paymentMode ?? null,
        gstin: invoice.gstin ?? null,
        companyName: invoice.companyName ?? null,
        customerNote: invoice.customerNote ?? null,
      },
      payUrl,
    });
  } catch (err) {
    handleError(err, res);
  }
});

export default router;
