import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  getItemReserves,
  getItemReserveStats,
  assignItemReserve,
  ItemReserveError,
} from "../services/itemReserveLicense";
import {
  createPendingReserveAssignment,
  approvePendingReserveAssignment,
  rejectPendingReserveAssignment,
  cancelPendingReserveAssignment,
  listIncomingPendingReserves,
  listOutgoingPendingReserves,
  PendingReserveError,
} from "../services/pendingReserveAssignment";

/**
 * Buyer-facing reserve license endpoints for course / channel / workshop /
 * call. Mirrors the shape of `/unilevel-plus/reserve/*` (which stays
 * separate). Auth is regular user auth — no founder gate — because anyone
 * who buys in bulk owns their reserves.
 */
const router = Router();
router.use(requireAuth);

const ITEM_TYPES = ["course", "channel", "workshop", "call", "product"] as const;

/** GET /item-reserves — list buyer's reserves with filters */
router.get("/", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const itemType = req.query.itemType as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (itemType && !ITEM_TYPES.includes(itemType as any)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid itemType" });
    }
    if (status && !["available", "assigned", "expired"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const result = await getItemReserves(me.userId, {
      itemType: itemType as any,
      status: status as any,
      limit,
      offset,
    });

    res.json({
      success: true,
      licenses: result.licenses,
      total: result.total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[ItemReserves] list error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch reserves" });
  }
});

/** GET /item-reserves/stats — quick counts for the buyer's dashboard summary */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const stats = await getItemReserveStats(me.userId);
    res.json({ success: true, ...stats });
  } catch (error: any) {
    console.error("[ItemReserves] stats error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

const AssignSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().optional(),
    // Optional paid-offer fields. When `priceUsd > 0` the route creates a
    // pending offer instead of assigning immediately; the recipient picks
    // which Store wallet to debit at approve time. `orgId` is required for
    // paid offers (sender's current org → credit destination).
    priceUsd: z.number().positive().optional(),
    orgId: z.string().optional(),
    message: z.string().max(500).optional(),
  })
  .refine((d) => !!d.email || !!d.userId, {
    message: "Provide either email or userId",
  });

/**
 * POST /item-reserves/:licenseId/assign
 *
 * Two paths, branching on body shape:
 *   - **Free** (no `priceUsd`): existing one-click grant — flips status to
 *     assigned and creates the downstream artifact for the recipient.
 *   - **Paid** (`priceUsd > 0`): creates a `PendingReserveAssignment` and
 *     locks the license. No money or artifact moves until the recipient
 *     approves and picks a Store wallet to pay from.
 */
router.post(
  "/:licenseId/assign",
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const parsed = AssignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid request body",
          issues: parsed.error.issues,
        });
      }

      // Paid path
      if (parsed.data.priceUsd && parsed.data.priceUsd > 0) {
        if (!parsed.data.orgId) {
          return res.status(400).json({
            success: false,
            error: "orgId is required for paid offers",
          });
        }
        const offer = await createPendingReserveAssignment({
          fromUserId: me.userId,
          fromLicenseId: req.params.licenseId,
          toEmail: parsed.data.email,
          toUserId: parsed.data.userId,
          priceUsd: parsed.data.priceUsd,
          orgId: parsed.data.orgId,
          message: parsed.data.message,
        });
        return res.json({
          success: true,
          mode: "paid",
          offer: {
            _id: offer._id,
            priceUsd: offer.priceUsd,
            status: offer.status,
            createdAt: offer.createdAt,
            itemType: offer.itemType,
            itemName: offer.itemName,
          },
        });
      }

      // Free path (unchanged)
      const result = await assignItemReserve(
        req.params.licenseId,
        me.userId,
        { email: parsed.data.email, userId: parsed.data.userId }
      );

      res.json({
        success: true,
        mode: "free",
        license: result.license,
        recipient: result.recipient,
        artifact: {
          type: result.artifactType,
          id: result.artifactId,
        },
      });
    } catch (error) {
      if (error instanceof ItemReserveError) {
        return res
          .status(error.status)
          .json({ success: false, code: error.code, error: error.message });
      }
      if (error instanceof PendingReserveError) {
        return res
          .status(error.status)
          .json({ success: false, code: error.code, error: error.message });
      }
      console.error("[ItemReserves] assign error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to assign reserve" });
    }
  }
);

// ───────────────────────────────────────────────────────────────────────
// Paid offers — inbox / outbox / approve / reject / cancel
// ───────────────────────────────────────────────────────────────────────

/** GET /item-reserves/offers/incoming — pending offers addressed to me */
router.get("/offers/incoming", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const offers = await listIncomingPendingReserves(me.userId);
    res.json({ success: true, offers });
  } catch (error: any) {
    console.error("[ItemReserves] incoming offers error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch incoming offers" });
  }
});

/** GET /item-reserves/offers/outgoing — pending offers I have sent */
router.get("/offers/outgoing", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const offers = await listOutgoingPendingReserves(me.userId);
    res.json({ success: true, offers });
  } catch (error: any) {
    console.error("[ItemReserves] outgoing offers error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch outgoing offers" });
  }
});

const ApproveSchema = z.object({
  sourceOrgId: z.string().min(1, "Pick a wallet to pay from"),
});

/**
 * POST /item-reserves/offers/:offerId/approve
 * Body: { sourceOrgId } — the org whose Store wallet the recipient pays from.
 */
router.post("/offers/:offerId/approve", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const parsed = ApproveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }
    const offer = await approvePendingReserveAssignment(
      req.params.offerId,
      me.userId,
      parsed.data.sourceOrgId
    );
    res.json({ success: true, offer });
  } catch (error) {
    if (error instanceof PendingReserveError) {
      return res
        .status(error.status)
        .json({ success: false, code: error.code, error: error.message });
    }
    console.error("[ItemReserves] approve offer error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to approve offer" });
  }
});

/** POST /item-reserves/offers/:offerId/reject — recipient rejects */
router.post("/offers/:offerId/reject", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const offer = await rejectPendingReserveAssignment(
      req.params.offerId,
      me.userId
    );
    res.json({ success: true, offer });
  } catch (error) {
    if (error instanceof PendingReserveError) {
      return res
        .status(error.status)
        .json({ success: false, code: error.code, error: error.message });
    }
    console.error("[ItemReserves] reject offer error:", error);
    res.status(500).json({ success: false, error: "Failed to reject offer" });
  }
});

/** POST /item-reserves/offers/:offerId/cancel — sender cancels */
router.post("/offers/:offerId/cancel", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const offer = await cancelPendingReserveAssignment(
      req.params.offerId,
      me.userId
    );
    res.json({ success: true, offer });
  } catch (error) {
    if (error instanceof PendingReserveError) {
      return res
        .status(error.status)
        .json({ success: false, code: error.code, error: error.message });
    }
    console.error("[ItemReserves] cancel offer error:", error);
    res.status(500).json({ success: false, error: "Failed to cancel offer" });
  }
});

export default router;
