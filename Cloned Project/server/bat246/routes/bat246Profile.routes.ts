import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { Bat246Distributor } from "../models/bat246Distributor.model";

/**
 * BAT246-only Complete-Profile field ("Country of Birth" —
 * ProfilePopover.tsx, gated on the URL starting with /games/bat246).
 * Deliberately its own route/model field, never the shared User
 * document — see bat246Distributor.model.ts's countryOfBirth comment.
 *
 * A brand-new signup has no Bat246Distributor row yet (that's normally
 * only created later, at first purchase — see productCheckout.ts /
 * services/invoice.ts) — the PUT below upserts one, same pattern those
 * files already use.
 */
const router = Router();

router.get("/country-of-birth", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const dist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(userId) })
      .select("countryOfBirth")
      .lean() as any;
    res.json({ success: true, countryOfBirth: dist?.countryOfBirth || "" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/country-of-birth", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const { countryOfBirth } = req.body as { countryOfBirth?: string };
    if (!countryOfBirth || !countryOfBirth.trim()) {
      return res.status(400).json({ success: false, error: "countryOfBirth is required" });
    }
    await Bat246Distributor.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { countryOfBirth: countryOfBirth.trim() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
