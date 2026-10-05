import { Router, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { isBat246CardAdmin } from "../services/bat246Permission.service";
import {
  createSnapBackLoanRequest,
  respondToSnapBackLoanRequest,
  cancelSnapBackLoanRequest,
  getMySnapBackLoan,
  getMySnapBackLoanRequests,
  getSnapBackLoanRequestsForMe,
  getMySnapBackLoanActivity,
  adminListSnapBackLoans,
} from "../services/bat246SnapBackLoan.service";

const router = Router();

router.post("/request", requireAuth, async (req: Request, res: Response) => {
  try {
    const requestedByUserId = (req as any).user.userId as string;
    const { eligibleUserId, productId, note, borrowerUserId } = req.body as {
      eligibleUserId?: string;
      productId?: string;
      note?: string;
      // Optional — set only when referring a friend/contact instead of
      // requesting for yourself; defaults to the caller.
      borrowerUserId?: string;
    };
    if (!eligibleUserId || !productId) {
      return res.status(400).json({ error: "eligibleUserId and productId required" });
    }
    const request = await createSnapBackLoanRequest({
      requestedByUserId,
      borrowerUserId: borrowerUserId || requestedByUserId,
      eligibleUserId,
      productId,
      note,
    });
    res.json({ ok: true, request });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/requests/:id/respond", requireAuth, async (req: Request, res: Response) => {
  try {
    const responderUserId = (req as any).user.userId as string;
    const { approve } = req.body as { approve?: boolean };
    const result = await respondToSnapBackLoanRequest(req.params.id, responderUserId, !!approve);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/requests/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  try {
    const requesterUserId = (req as any).user.userId as string;
    const result = await cancelSnapBackLoanRequest(req.params.id, requesterUserId);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Requests THIS user sent — status tracking + what Cancel operates on.
router.get("/my-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const requests = await getMySnapBackLoanRequests(userId);
    res.json({ ok: true, requests });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Requests waiting on (or previously answered by) THIS user as the
// eligible person — what Approve/Deny operate on.
router.get("/requests-for-me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const requests = await getSnapBackLoanRequestsForMe(userId);
    res.json({ ok: true, requests });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// The caller's own most recent loan + repayment ledger — powers the B2
// Coin Wallet page's "My Loan" card.
router.get("/my-loan", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const loan = await getMySnapBackLoan(userId);
    res.json({ ok: true, loan });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Every loan THIS user is personally part of (as borrower or as giver) —
// same row shape as the admin grid, but scoped/safe for any authenticated
// user. Powers the "grid like admin have" section on the member-facing
// Snap Back Loans tab.
router.get("/my-activity", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const loans = await getMySnapBackLoanActivity(userId);
    res.json({ ok: true, loans });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Backoffice list — every loan, who owes what, and the borrower's own
// current giving-power as underwriting context. Admin-only, same
// isBat246CardAdmin gate every other bat246 admin route already uses.
router.get("/admin/list", requireAuth, async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const isAdmin = await isBat246CardAdmin(caller?.email, caller?.userId, "snapbackloans");
    if (!isAdmin) return res.status(403).json({ error: "Not authorized" });
    const loans = await adminListSnapBackLoans();
    res.json({ ok: true, loans });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
