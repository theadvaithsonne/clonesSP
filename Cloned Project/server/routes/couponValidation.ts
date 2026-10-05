// src/routes/couponValidation.ts
// Public endpoint for validating coupons at checkout
import { Router, Request, Response } from "express";
import { z } from "zod";
import { validateCoupon } from "../services/coupon";
import { ApplicableItemType } from "../models/coupon.model";

const router = Router();

const validateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  itemType: z.enum(["channel", "course", "workshop", "product", "office_plan", "office_addon", "event_ticket"] as const),
  itemId: z.string().min(1, "Item ID is required"),
  amount: z.number().positive("Amount must be positive"), // In paise
  userId: z.string().optional(),
  orgId: z.string().optional(),
});

/**
 * POST /checkout/validate-coupon
 * Validate a coupon code for a specific item
 */
router.post("/validate-coupon", async (req: Request, res: Response) => {
  try {
    const parsed = validateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        valid: false,
        error: parsed.error.issues[0]?.message || "Invalid request",
      });
    }

    const { code, itemType, itemId, amount, userId, orgId } = parsed.data;

    const result = await validateCoupon({
      code,
      itemType: itemType as ApplicableItemType,
      itemId,
      amount,
      userId,
      orgId,
    });

    if (!result.valid) {
      return res.status(200).json({
        valid: false,
        error: result.error,
      });
    }

    // Return sanitized coupon info (don't expose internal details)
    return res.json({
      valid: true,
      coupon: result.coupon ? {
        _id: result.coupon._id,
        code: result.coupon.code,
        discountValue: result.coupon.discountValue,
        razorpayOfferId: result.coupon.razorpayOfferId,
      } : undefined,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
    });
  } catch (error) {
    console.error("Coupon validation error:", error);
    return res.status(500).json({
      valid: false,
      error: "Failed to validate coupon",
    });
  }
});

export default router;
