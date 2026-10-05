import { Router, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import {
  computeLayawayEligibility,
  giveB2Coins,
  createLayawayRequest,
  respondToLayawayRequest,
  cancelLayawayRequest,
  searchBat246OfficeUsers,
  searchEligiblePeople,
  getMyB2CoinWallet,
  getMyLayawayRequests,
  getLayawayRequestsForMe,
  payEntryProductWithB2Coins,
} from "../services/bat246Layaway.service";

const router = Router();

router.get("/my-eligibility", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const eligibility = await computeLayawayEligibility(userId);
    res.json({ ok: true, eligibility });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// The B2 Coin Wallet page's own data — real received balance + history.
// Separate from /my-eligibility (giving power) on purpose, see
// getMyB2CoinWallet()'s own doc comment.
router.get("/my-wallet", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const wallet = await getMyB2CoinWallet(userId);
    res.json({ ok: true, wallet });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/recipients/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const users = await searchBat246OfficeUsers(q);
    res.json({ ok: true, users });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/eligible-people", requireAuth, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const people = await searchEligiblePeople(q);
    res.json({ ok: true, people });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/give", requireAuth, async (req: Request, res: Response) => {
  try {
    const fromUserId = (req as any).user.userId as string;
    const { recipientUserId, amount, productId } = req.body as { recipientUserId?: string; amount?: number; productId?: string };
    if (!recipientUserId) return res.status(400).json({ error: "recipientUserId required" });
    const result = await giveB2Coins({ fromUserId, recipientUserId, amount, productId });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/request", requireAuth, async (req: Request, res: Response) => {
  try {
    const requestedByUserId = (req as any).user.userId as string;
    const { eligibleUserId, recipientUserId, amount, productId, note } = req.body as {
      eligibleUserId?: string; recipientUserId?: string; amount?: number; productId?: string; note?: string;
    };
    if (!eligibleUserId || !recipientUserId) {
      return res.status(400).json({ error: "eligibleUserId and recipientUserId required" });
    }
    const request = await createLayawayRequest({ requestedByUserId, eligibleUserId, recipientUserId, amount, productId, note });
    res.json({ ok: true, request });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/requests/:id/respond", requireAuth, async (req: Request, res: Response) => {
  try {
    const responderUserId = (req as any).user.userId as string;
    const { approve, amount } = req.body as { approve?: boolean; amount?: number };
    const result = await respondToLayawayRequest(
      req.params.id,
      responderUserId,
      !!approve,
      typeof amount === "number" ? amount : undefined
    );
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/requests/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  try {
    const requesterUserId = (req as any).user.userId as string;
    const result = await cancelLayawayRequest(req.params.id, requesterUserId);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Requests THIS user sent — status tracking + what "Cancel" operates on.
router.get("/my-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const requests = await getMyLayawayRequests(userId);
    res.json({ ok: true, requests });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Requests waiting on (or previously answered by) THIS user as the
// eligible person being asked — what "Approve"/"Deny" operate on.
router.get("/requests-for-me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const requests = await getLayawayRequestsForMe(userId);
    res.json({ ok: true, requests });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Pay the $650 Board Entry / $160 POD Entry invoice with the caller's own
// B2 Coins wallet balance instead of Razorpay/a real wallet. See
// payEntryProductWithB2Coins()'s own doc comment for the full contract —
// `code` is included alongside `error` (unlike every other route above)
// so the frontend can specifically detect INSUFFICIENT_BALANCE and show
// the "request more from the B2 Coin Wallet" message rather than a
// generic failure toast.
router.post("/pay-entry", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const { invoiceId } = req.body as { invoiceId?: string };
    if (!invoiceId) return res.status(400).json({ error: "invoiceId required" });
    const result = await payEntryProductWithB2Coins(invoiceId, userId);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: err.code });
  }
});

export default router;
