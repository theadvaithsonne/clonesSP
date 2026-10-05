import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  changeSubscriptionTerm,
  listSubscriptionsForUser,
} from "../services/thirdPartyTerms";
import { ThirdPartyError } from "../services/thirdPartyError";

/**
 * End-user surface for third-party (NetworkChain) subscription terms.
 *
 * The partner-facing equivalents live in routes/thirdPartyInvoice.ts behind an
 * API key; both delegate to the same service so the semantics can't drift.
 */
const router = Router();

router.use(requireAuth);

function sendError(res: Response, err: any) {
  if (err instanceof ThirdPartyError) {
    return res
      .status(err.statusCode)
      .json({ success: false, error: err.code, message: err.message });
  }
  console.error("[ThirdPartySubscription]", err);
  return res.status(500).json({
    success: false,
    error: "internal_error",
    message: err?.message || String(err),
  });
}

/**
 * GET /api/third-party/subscriptions
 * Optional ?clientId= filter. Returns an array — a user can hold more than one
 * chain (e.g. a combo-created parent plus a partner-created one).
 */
router.get("/subscriptions", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const clientId =
      typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    const subscriptions = await listSubscriptionsForUser(me.userId, clientId);
    res.json({ success: true, subscriptions });
  } catch (err) {
    sendError(res, err);
  }
});

const termSchema = z.object({
  termMonths: z.number().int().min(1).max(60),
});

/**
 * PATCH /api/third-party/subscriptions/:parentInvoiceId/term
 *
 * Applies to the next unpaid cycle where possible, otherwise queues for the one
 * after. The response always carries `effectiveFrom` so the UI can say "changes
 * on 12 Feb 2027" rather than implying it took effect immediately.
 */
router.patch(
  "/subscriptions/:parentInvoiceId/term",
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const parsed = termSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "invalid_body",
          details: parsed.error.issues,
        });
      }

      const result = await changeSubscriptionTerm({
        parentInvoiceId: req.params.parentInvoiceId,
        termMonths: parsed.data.termMonths,
        actor: { kind: "user", id: me.userId },
      });

      res.json({ success: true, ...result });
    } catch (err) {
      sendError(res, err);
    }
  }
);

export default router;
