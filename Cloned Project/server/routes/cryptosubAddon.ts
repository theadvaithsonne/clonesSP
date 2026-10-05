// Founder-facing routes for the invoice-based cryptosub add-on.
// Mounted at /cryptosub-addon in app.ts.
//
// Endpoints:
//   POST /purchase   — start the on-session first charge against a saved card
//   GET  /status     — has-access + renew-at for the current org
//   GET  /price      — quote base + GST + total for the current buyer
//
// Also mounts an admin-only trigger endpoint for the renewal cron so
// staff can run it on demand from /garage-admin.

import { Router, Request, Response } from "express";
import { requireAuth, requireFounder } from "../middleware/auth";
import { requireGarageAdminAuth } from "../middleware/garageAdminAuth";
import {
  purchaseCryptosubAddon,
  getCryptosubStatus,
  quoteCryptosubPrice,
  runCryptosubRenewalTick,
} from "../services/cryptosubAddonPurchase";

const router = Router();

router.post(
  "/purchase",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string; orgId: string };
      const result = await purchaseCryptosubAddon({
        orgId: user.orgId,
        buyerUserId: user.userId,
      });
      return res.json({ success: true, ...result });
    } catch (err: any) {
      const status = err?.statusCode || 500;
      console.error("[cryptosub-addon] purchase:", err?.message || err);
      return res
        .status(status)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

router.get(
  "/status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string; orgId: string };
      const status = await getCryptosubStatus(user.orgId);
      return res.json({ success: true, ...status });
    } catch (err: any) {
      console.error("[cryptosub-addon] status:", err?.message || err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

router.get("/price", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string };
    const quote = await quoteCryptosubPrice(user.userId, user.orgId);
    return res.json({ success: true, ...quote });
  } catch (err: any) {
    console.error("[cryptosub-addon] price:", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || "Server error" });
  }
});

// Admin-only manual trigger for the renewal cron. Useful for testing +
// manual re-runs when the daily cron is skipped.
router.post(
  "/admin/renewal-tick",
  requireGarageAdminAuth,
  async (_req: Request, res: Response) => {
    try {
      const result = await runCryptosubRenewalTick();
      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[cryptosub-addon] renewal-tick:", err?.message || err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

export default router;
