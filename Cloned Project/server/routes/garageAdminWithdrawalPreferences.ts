import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
} from "../middleware/garageAdminAuth";
import { WithdrawalPreference } from "../models/withdrawalPreference.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { getWithdrawableBalanceCents } from "../services/withdrawal";
import {
  resolveAffiliateFeeTier,
  AFFILIATE_KEEP_THRESHOLD_CENTS,
} from "../config/affiliateWithdrawalFees";
import { ok } from "../utils/http";

/**
 * GET /garage-admin/withdrawal-preferences
 *
 * The "Preferences" sub-tab on Vaults → Withdrawals: every payout instruction
 * users have set, with what is due against it right now. Nothing here moves
 * money — the team reads it and initiates withdrawals as today.
 *
 *   ?frequency=weekly|daily|all   (default all)
 *   ?due=1                        only rows with dueCents > 0
 *   ?search=<name / email>
 *   ?skip=&limit=
 *
 * dueCents = withdrawable balance − keep-amount, floored at 0. The keep-amount
 * counts on BOTH cadences: on the affiliate wallet, leaving $50+ behind is
 * what buys the lower Garage fee tier (config/affiliateWithdrawalFees.ts),
 * which is why each row carries feePercent / feeOnDueCents / netOnDueCents.
 * Store and content-rewards rows are free and report feePercent 0.
 * Withdrawable follows the same maturity rule the user sees on their wallet
 * (services/withdrawal.ts::getWithdrawableBalanceCents).
 */
const router = Router();

/** Next Friday (or today if it is Friday) at 00:00 — the weekly payout day. */
function nextFriday(from = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const delta = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

router.get(
  "/withdrawal-preferences",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const q = z
        .object({
          frequency: z.enum(["weekly", "daily", "all"]).default("all"),
          due: z.string().optional(),
          search: z.string().trim().optional(),
          skip: z.coerce.number().int().min(0).default(0),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        })
        .parse(req.query);

      const filter: any = {};
      if (q.frequency !== "all") filter.frequency = q.frequency;
      if (q.search) {
        const re = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const users = await User.find({ $or: [{ name: re }, { email: re }, { phone: re }] }, { _id: 1 }).lean();
        filter.userId = { $in: users.map((u) => u._id) };
      }

      const prefs = await WithdrawalPreference.find(filter).sort({ updatedAt: -1 }).lean();

      const userIds = [...new Set(prefs.map((p) => String(p.userId)))];
      const orgIds = [...new Set(prefs.map((p) => (p.orgId ? String(p.orgId) : null)).filter(Boolean))] as string[];
      const [users, orgs] = await Promise.all([
        User.find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
          .select("name email phone profilePicture country")
          .lean(),
        orgIds.length
          ? Organization.find({ _id: { $in: orgIds.map((id) => new Types.ObjectId(id)) } })
              .select("name icon")
              .lean()
          : [],
      ]);
      const usersById = new Map(users.map((u) => [String(u._id), u]));
      const orgsById = new Map(orgs.map((o: any) => [String(o._id), o]));

      // Withdrawable is a live computation per wallet; the list is small
      // (people who changed a setting), so per-row is fine.
      const friday = nextFriday();
      let rows = await Promise.all(
        prefs.map(async (p) => {
          const user = usersById.get(String(p.userId));
          if (!user) return null; // deleted account — nothing to pay
          const withdrawableCents = await getWithdrawableBalanceCents(
            String(p.userId),
            p.walletType,
            p.orgId ? String(p.orgId) : null,
          );
          // The keep-amount applies to daily AND weekly: leaving $50 behind is
          // what buys the lower fee tier on either cadence.
          const keep = Math.max(0, p.keepAmountCents ?? 0);
          const dueCents = Math.max(0, withdrawableCents - keep);
          // Only affiliate withdrawals are priced; store/content-rewards are free.
          const feeTier =
            p.walletType === "affiliate"
              ? resolveAffiliateFeeTier({
                  frequency: p.frequency,
                  keepAmountCents: keep,
                })
              : null;
          const feeOnDueCents = feeTier
            ? Math.round((dueCents * feeTier.feePercent) / 100)
            : 0;
          const org = p.orgId ? orgsById.get(String(p.orgId)) : null;
          return {
            id: String(p._id),
            user: {
              _id: String(user._id),
              name: user.name || null,
              email: user.email || null,
              phone: user.phone || null,
              profilePicture: user.profilePicture || null,
              country: user.country || null,
            },
            walletType: p.walletType,
            org: org ? { id: String(org._id), name: org.name || null, icon: org.icon || null } : null,
            frequency: p.frequency,
            keepAmountCents: p.keepAmountCents ?? null,
            withdrawableCents,
            dueCents,
            /** Garage processing fee this instruction currently earns. */
            feePercent: feeTier ? feeTier.feePercent : 0,
            feeOnDueCents,
            netOnDueCents: Math.max(0, dueCents - feeOnDueCents),
            feeTier,
            keepThresholdCents: AFFILIATE_KEEP_THRESHOLD_CENTS,
            /** When this instruction next falls due. */
            nextRunAt: p.frequency === "daily" ? new Date(new Date().setHours(0, 0, 0, 0)) : friday,
            updatedAt: p.updatedAt,
          };
        }),
      );
      rows = rows.filter(Boolean) as any[];
      if (q.due === "1" || q.due === "true") rows = rows.filter((r: any) => r.dueCents > 0);

      const stats = {
        total: rows.length,
        weekly: rows.filter((r: any) => r.frequency === "weekly").length,
        daily: rows.filter((r: any) => r.frequency === "daily").length,
        dueNow: rows.filter((r: any) => r.dueCents > 0).length,
        dueAmountCents: rows.reduce((s: number, r: any) => s + r.dueCents, 0),
        /** Garage processing fee across everything currently due. */
        feeAmountCents: rows.reduce((s: number, r: any) => s + r.feeOnDueCents, 0),
        nextFriday: friday,
      };

      const page = rows.slice(q.skip, q.skip + q.limit);
      return res.json(
        ok({
          items: page,
          total: rows.length,
          skip: q.skip,
          limit: q.limit,
          hasMore: q.skip + page.length < rows.length,
          stats,
        }),
      );
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({ success: false, error: err.issues?.[0]?.message || "Invalid query" });
      }
      console.error("[garage-admin/withdrawal-preferences] error:", err);
      return res.status(500).json({ success: false, error: "Internal error" });
    }
  },
);

export default router;
