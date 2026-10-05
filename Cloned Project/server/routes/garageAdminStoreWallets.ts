// Super-admin surface for per-user, per-currency store wallets.
// Mounted at /garage-admin/store-wallets (see app.ts).
//
// Endpoints:
//   GET  /garage-admin/store-wallets/user/:userId/org/:orgId
//     List every store wallet for (userId, orgId). Auto-mints missing
//     cryptobrand-currency wallets on the way in (safety-net for
//     members who joined before the cryptobrand flag was flipped).
//
//   POST /garage-admin/store-wallets/:walletId/topup
//     Raw credit in the wallet's currency (no FX conversion). Writes
//     a WalletTransaction row so the credit shows up in the audit
//     ledger. Body: { amount: number, note?: string }.
//     Idempotent via optional { idempotencyKey } — a repeat POST with
//     the same key returns the prior transaction instead of double-
//     crediting.

import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireGarageAdminAuth } from "../middleware/garageAdminAuth";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { ensureCryptobrandWallets } from "../services/cryptobrandWallets";

const router = Router();

// ─── Cryptobrand offices list (drives the sidebar page) ─────────────

router.get(
  "/cryptobrand-offices",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || "").trim();
      const filter: any = { officeCreatedFromCryptobrand: true };
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.name = re;
      }
      const orgs = await Organization.find(filter)
        .select("_id name icon city country createdAt")
        .sort({ createdAt: -1 })
        .lean<any[]>();

      // Cheap per-org member count so the list page has a stat to show.
      const orgIds = orgs.map((o) => o._id);
      const counts = orgIds.length
        ? await User.aggregate([
            { $unwind: "$organizations" },
            { $match: { "organizations.organization": { $in: orgIds } } },
            {
              $group: {
                _id: "$organizations.organization",
                count: { $sum: 1 },
              },
            },
          ])
        : [];
      const countById = new Map(counts.map((c: any) => [String(c._id), c.count]));

      res.json({
        success: true,
        offices: orgs.map((o) => ({
          orgId: String(o._id),
          name: o.name,
          icon: o.icon || null,
          city: o.city || null,
          country: o.country || null,
          createdAt: o.createdAt,
          memberCount: countById.get(String(o._id)) || 0,
        })),
        total: orgs.length,
      });
    } catch (err: any) {
      console.error("[garage-admin/cryptobrand-offices] list:", err);
      res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

router.get(
  "/cryptobrand-offices/:orgId/members",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      if (!Types.ObjectId.isValid(orgId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid orgId" });
      }
      const org = await Organization.findById(orgId)
        .select("_id name icon officeCreatedFromCryptobrand")
        .lean<any>();
      if (!org) {
        return res
          .status(404)
          .json({ success: false, error: "Org not found" });
      }
      if (!org.officeCreatedFromCryptobrand) {
        return res.status(400).json({
          success: false,
          error: "This org is not a cryptobrand office",
        });
      }
      const orgObjectId = new Types.ObjectId(orgId);
      const q = String(req.query.q || "").trim();
      const filter: any = { "organizations.organization": orgObjectId };
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [{ name: re }, { email: re }, { phone: re }];
      }
      const users = await User.find(filter)
        .select("_id name email phone profilePicture organizations createdAt")
        .sort({ createdAt: -1 })
        .lean<any[]>();
      const rows = users.map((u) => {
        const membership = (u.organizations || []).find(
          (m: any) => String(m.organization) === String(orgObjectId),
        );
        return {
          userId: String(u._id),
          name: u.name || null,
          email: u.email || null,
          phone: u.phone || null,
          profilePicture: u.profilePicture || null,
          role: membership?.role || "stakeholder",
          guest: !!membership?.guest,
          joinedAt: membership?.joinedAt
            ? new Date(membership.joinedAt).toISOString()
            : null,
        };
      });
      res.json({
        success: true,
        org: {
          orgId: String(org._id),
          name: org.name,
          icon: org.icon || null,
        },
        members: rows,
        total: rows.length,
      });
    } catch (err: any) {
      console.error("[garage-admin/cryptobrand-offices] members:", err);
      res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

// ─── List wallets for a user in an org ───────────────────────────────

router.get(
  "/store-wallets/user/:userId/org/:orgId",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId } = req.params;
      if (
        !Types.ObjectId.isValid(userId) ||
        !Types.ObjectId.isValid(orgId)
      ) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid userId or orgId" });
      }

      // Safety-net creation — same helper the user-facing fetch uses.
      const ensureResult = await ensureCryptobrandWallets(userId, orgId);

      const wallets = await StoreWallet.find({
        userId: new Types.ObjectId(userId),
        orgId: new Types.ObjectId(orgId),
      })
        .select(
          "_id currency balance parentWalletId isActive lastTransactionAt createdAt",
        )
        .lean<any[]>();

      // Hydrate user + org basics for admin display.
      const [user, org] = await Promise.all([
        User.findById(userId).select("email name").lean<any>(),
        Organization.findById(orgId)
          .select("name officeCreatedFromCryptobrand")
          .lean<any>(),
      ]);

      const usd = wallets.find((w) => w.currency === "USD");
      const others = wallets
        .filter((w) => w.currency !== "USD")
        .sort((a, b) => (a.currency < b.currency ? -1 : 1));

      res.json({
        success: true,
        user: user
          ? { userId: String(user._id), email: user.email, name: user.name }
          : null,
        org: org
          ? {
              orgId: String(org._id),
              name: org.name,
              isCryptobrand: !!org.officeCreatedFromCryptobrand,
            }
          : null,
        isCryptobrandOrg: ensureResult.isCryptobrandOrg,
        wallets: [...(usd ? [usd] : []), ...others].map((w) => ({
          walletId: String(w._id),
          currency: w.currency,
          balance: w.balance,
          isParent: !w.parentWalletId,
          parentWalletId: w.parentWalletId ? String(w.parentWalletId) : null,
          isActive: w.isActive,
          lastTransactionAt: w.lastTransactionAt || null,
          createdAt: w.createdAt,
        })),
      });
    } catch (err: any) {
      console.error("[garage-admin/store-wallets] list:", err);
      res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

// ─── Manual admin top-up ─────────────────────────────────────────────

const topupBody = z.object({
  amount: z.number().positive(),
  note: z.string().optional(),
  // Optional idempotency guard — pass the same key on retry and the
  // BE returns the original transaction instead of double-crediting.
  idempotencyKey: z.string().optional(),
});

router.post(
  "/store-wallets/:walletId/topup",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const { walletId } = req.params;
      const admin = (req as any).garageAdmin as {
        id: string;
        email: string;
      };
      if (!Types.ObjectId.isValid(walletId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid walletId" });
      }
      const { amount, note, idempotencyKey } = topupBody.parse(req.body);

      const wallet = await StoreWallet.findById(walletId);
      if (!wallet) {
        return res
          .status(404)
          .json({ success: false, error: "Wallet not found" });
      }

      // Idempotency — if this admin previously topped up with the same
      // key on this wallet, return the prior transaction untouched.
      if (idempotencyKey) {
        const existing = await WalletTransaction.findOne({
          storeWalletId: wallet._id,
          "metadata.idempotencyKey": idempotencyKey,
        }).lean<any>();
        if (existing) {
          return res.json({
            success: true,
            alreadyCredited: true,
            transaction: {
              transactionId: String(existing._id),
              amount: existing.amount,
              balanceAfter: existing.balanceAfter,
            },
          });
        }
      }

      const before = wallet.balance;
      const after = Math.round((before + amount) * 100) / 100;
      wallet.balance = after;
      wallet.lastTransactionAt = new Date();
      await wallet.save();

      const [transaction] = await WalletTransaction.create([
        {
          storeWalletId: wallet._id,
          walletType: "store",
          userId: wallet.userId,
          orgId: wallet.orgId,
          type: "credit",
          amount,
          currency: wallet.currency,
          balanceBefore: before,
          balanceAfter: after,
          description: `Admin top-up (${wallet.currency})`,
          note: note || `Manual top-up by admin ${admin.email}`,
          metadata: {
            kind: "admin_topup",
            initiatedByGarageAdminId: admin.id,
            initiatedByGarageAdminEmail: admin.email,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
          status: "completed",
        },
      ]);

      res.json({
        success: true,
        alreadyCredited: false,
        wallet: {
          walletId: String(wallet._id),
          currency: wallet.currency,
          balanceBefore: before,
          balanceAfter: after,
        },
        transaction: {
          transactionId: String(transaction._id),
          amount,
          currency: wallet.currency,
        },
      });
    } catch (err: any) {
      console.error("[garage-admin/store-wallets] topup:", err);
      res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

export default router;
