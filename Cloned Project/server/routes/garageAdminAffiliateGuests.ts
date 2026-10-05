// Super-admin surface for graduating "affiliate guests" — users who
// signed up via the OTP flow and got auto-joined to some org as
// `organizations.$.guest === true`. The default new-user path stamps
// guest:true in GARAGE HQ; founders can also invite users as guests
// via the join-request approval flow. This admin tab lets Shorupan
// flip that flag to `false` in one click, promoting the user to a full
// member of the org.
//
// Endpoints:
//   GET  /garage-admin/affiliate-guests
//     List users with at least one guest:true membership. Server-side
//     search via ?q= (name / email / phone regex).
//
//   PATCH /garage-admin/affiliate-guests/:userId/orgs/:orgId/graduate
//     Flip that specific membership's guest flag → false. Idempotent
//     (already false → no-op success). Returns the updated membership.

import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireGarageAdminAuth } from "../middleware/garageAdminAuth";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";

const router = Router();

interface GuestMembership {
  orgId: string;
  orgName: string;
  orgIcon: string | null;
  role: string;
  joinedAt: string | null;
}

interface GuestRow {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  referredBy: string | null;
  createdAt: string;
  guestMemberships: GuestMembership[];
}

router.get(
  "/affiliate-guests",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || "").trim();
      const limit = Math.min(
        parseInt(String(req.query.limit ?? "100"), 10) || 100,
        500,
      );

      const baseFilter: any = { "organizations.guest": true };
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        baseFilter.$or = [{ name: re }, { email: re }, { phone: re }];
      }

      const users = await User.find(baseFilter)
        .select(
          "_id name email phone profilePicture referredBy organizations createdAt",
        )
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<any[]>();

      // Hydrate org names in one query. Collect the org ids that appear
      // on any guest membership across the result set, look them up
      // once, then map back.
      const orgIdSet = new Set<string>();
      for (const u of users) {
        for (const m of u.organizations || []) {
          if (m?.guest === true && m.organization) {
            orgIdSet.add(String(m.organization));
          }
        }
      }
      const orgIds = Array.from(orgIdSet).map((s) => new Types.ObjectId(s));
      const orgs = orgIds.length
        ? await Organization.find({ _id: { $in: orgIds } })
            .select("_id name icon")
            .lean<any[]>()
        : [];
      const orgById = new Map(orgs.map((o) => [String(o._id), o]));

      const rows: GuestRow[] = users.map((u) => {
        const guestMemberships: GuestMembership[] = (u.organizations || [])
          .filter((m: any) => m?.guest === true)
          .map((m: any) => {
            const org = orgById.get(String(m.organization));
            return {
              orgId: String(m.organization),
              orgName: org?.name || "Unknown organization",
              orgIcon: org?.icon || null,
              role: m.role || "stakeholder",
              joinedAt: m.joinedAt
                ? new Date(m.joinedAt).toISOString()
                : null,
            };
          });
        return {
          userId: String(u._id),
          name: u.name || null,
          email: u.email || null,
          phone: u.phone || null,
          profilePicture: u.profilePicture || null,
          referredBy: u.referredBy ? String(u.referredBy) : null,
          createdAt: new Date(u.createdAt).toISOString(),
          guestMemberships,
        };
      });

      // Total count of user rows matching the filter (not memberships).
      const total = await User.countDocuments(baseFilter);

      return res.json({ success: true, rows, total, returned: rows.length });
    } catch (err: any) {
      console.error("[garage-admin/affiliate-guests] list:", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

router.patch(
  "/affiliate-guests/:userId/orgs/:orgId/graduate",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId } = req.params;
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(orgId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid userId or orgId" });
      }

      // Positional filter: only the specific membership matching orgId.
      // Idempotent — flipping guest:false when it's already false still
      // returns 200 (matchedCount: 1, modifiedCount: 0).
      const result = await User.updateOne(
        {
          _id: new Types.ObjectId(userId),
          "organizations.organization": new Types.ObjectId(orgId),
        },
        { $set: { "organizations.$.guest": false } },
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "User has no membership in the specified organization",
        });
      }

      return res.json({
        success: true,
        modified: result.modifiedCount,
        alreadyGraduated: result.modifiedCount === 0,
      });
    } catch (err: any) {
      console.error("[garage-admin/affiliate-guests] graduate:", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

export default router;
