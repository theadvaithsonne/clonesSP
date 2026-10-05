import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validatePlatformCoupon } from "../services/platformCoupon";
import { verifyJwt } from "../services/jwt";

const router = Router();

const schema = z.object({
  code: z.string().min(1),
  productType: z.enum([
    "office_plan",
    "unilevel_plus",
    "third_party_subscription",
    "channel",
    "course",
    "workshop",
    "product",
    "service",
    "call",
    "franchise_program",
    "franchise_territory",
    "ecommerce",
  ]),
  amountCents: z.number().int().nonnegative(),
  orgId: z.string().optional(),
  itemId: z.string().optional(),
  /** Currency of the item being purchased — used to auto-convert fixed coupon amounts */
  itemCurrency: z.enum(["USD", "INR"]).optional(),
  /** Optional — for guest checkouts, use this email to locate/create user context for per-user limits */
  userId: z.string().optional(),
});

// Soft auth: if Authorization header present and valid, attach user; otherwise continue as guest.
function softAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return next();
  try {
    const token = header.split(" ")[1];
    const payload = verifyJwt<{ userId: string }>(token);
    (req as any).user = { userId: payload.userId };
  } catch {
    // invalid token — continue as guest
  }
  next();
}

router.post(
  "/validate-platform-coupon",
  softAuth,
  async (req: Request, res: Response) => {
    try {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid request",
          details: parsed.error.issues,
        });
      }

      // Use the authenticated user if available; else the client-provided userId (optional).
      // If no user context, per-user usage limits are skipped (re-checked at invoice creation).
      const userId =
        ((req as any).user as any)?.userId || parsed.data.userId || "";

      const result = await validatePlatformCoupon({
        code: parsed.data.code,
        productType: parsed.data.productType,
        userId,
        amountCents: parsed.data.amountCents,
        orgId: parsed.data.orgId,
        itemId: parsed.data.itemId,
        invoiceCurrency: parsed.data.itemCurrency,
      });

      if (!result.valid) {
        return res.status(200).json({ success: false, error: result.error });
      }

      return res.json({
        success: true,
        discount: result.discount,
        finalAmount: result.finalAmount,
        willBeFree: result.willBeFree,
        coupon: {
          code: result.coupon!.code,
          discountType: result.coupon!.discountType,
          discountValue: result.coupon!.discountValue,
          maxDiscountAmount: result.coupon!.maxDiscountAmount,
          cycleCount: result.coupon!.cycleCount,
          productType: result.coupon!.productType,
          currency: result.coupon!.currency || "USD",
        },
      });
    } catch (err: any) {
      console.error("[PlatformCoupon] validate error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

export default router;
