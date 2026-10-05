import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import { Types } from "mongoose";
import { z } from "zod";
import { memberCleanupService } from "../services/memberCleanup.service";

const router = Router();

router.get("/list", requireAuth, async (req, res) => {
  const me = (req as any).user as {
    orgId?: string;
    userId?: string;
    role?: string;
  };

  const orgId = req.query.orgId as string;

  if (!orgId) return res.json({ members: [], currentUserActions: null });

  const orgObjectId = new Types.ObjectId(orgId);
  const currentUserId = me.userId || "";

  // Fetch members and downline counts in parallel (optimized)
  const [members, downlineCounts] = await Promise.all([
    User.find({
      "organizations.organization": orgObjectId,
    })
      // `designation` backs the chat thread header ("Online · Partner Manager").
      // `phone` is deliberately NOT selected: it is personal data and every
      // member of an office can read this list. If phone search is wanted later,
      // return a `phoneLast4` rather than the full number.
      .select(
        "name email createdAt organizations profilePicture lastSeenAt designation"
      )
      .lean(),
    // Get downline counts using aggregation on referredBy field
    User.aggregate([
      {
        $match: {
          referredBy: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$referredBy",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // Build downline map
  const downlineMap = new Map(
    downlineCounts.map((d: any) => [d._id.toString(), d.count])
  );

  // Find current user in members to get their role info (avoid extra query)
  const currentUserData = members.find(
    (m: any) => m._id.toString() === currentUserId
  );
  const currentUserMembership = currentUserData?.organizations?.find(
    (org: any) => org.organization?.toString() === orgId
  );
  const isCurrentUserFounder = currentUserMembership ? hasFounderAccess(currentUserMembership) : false;
  const isMemberOfOrg = !!currentUserMembership;

  // Check if current user is founder of any org from their data
  const currentUserFounderOrgs = (currentUserData?.organizations || [])
    .filter((m: any) => m.role === "founder")
    .map((m: any) => ({
      id: m.organization?.toString(),
      name: "Organization",
    }));
  const isCurrentUserFounderOfAny = currentUserFounderOrgs.length > 0;

  // Build set of member IDs who are founders of ANY org (batch check)
  // Only needed if current user is a founder (otherwise they can't delete anyone anyway)
  let founderOfAnyOrgSet = new Set<string>();
  if (isCurrentUserFounder) {
    // Single query to find which members are founders of any org
    const memberIds = members.map((m: any) => m._id);
    const foundersOfAnyOrg = await User.find(
      {
        _id: { $in: memberIds },
        "organizations.role": "founder",
      },
      { _id: 1 }
    ).lean();
    founderOfAnyOrgSet = new Set(
      foundersOfAnyOrg.map((f: any) => f._id.toString())
    );
  }

  // Map members synchronously (no more N+1 queries)
  const mappedMembers = members
    .map((member: any) => {
      // Find the specific membership for the current organization
      const membership = member.organizations?.find(
        (org: any) => org.organization?.toString() === orgId
      );

      // Only include members who have a membership in the current organization
      if (!membership) {
        return null;
      }

      const memberId = member._id.toString();
      const isCurrentUser = memberId === currentUserId;
      const isMemberFounder = membership.role === "founder";

      // Compute actions for this member
      let canKick = false;
      let canDeletePermanently = false;
      let reason: string | null = null;

      if (isCurrentUser) {
        reason = "Cannot perform action on yourself";
      } else if (!isCurrentUserFounder) {
        reason = "Only founders can manage members";
      } else if (isMemberFounder) {
        reason = "Cannot kick or delete a founder";
      } else {
        canKick = true;
        // Check if member is founder of ANY org using pre-computed set
        const isMemberFounderOfAny = founderOfAnyOrgSet.has(memberId);
        canDeletePermanently = !isMemberFounderOfAny;
        if (isMemberFounderOfAny) {
          reason = "User is a founder of another organization";
        }
      }

      return {
        _id: member._id,
        id: member._id,
        name: member.name || member.email?.split("@")[0] || "Unknown",
        email: member.email || "",
        role: membership.role,
        fullAccess: (membership as any).fullAccess || false,
        guest: membership.guest || false,
        createdAt: member.createdAt,
        profilePicture: member.profilePicture,
        // Job title for the chat thread header. Null rather than absent so the
        // key's presence doesn't depend on whether the user filled it in.
        designation: (member as any).designation || null,
        // Feeds the `<LastSeen />` affordance that replaced the green-dot
        // online indicator. May be null if the user hasn't connected to
        // the socket since the field was added.
        lastSeenAt: (member as any).lastSeenAt || null,
        downlineCount: downlineMap.get(memberId) || 0,
        actions: {
          canKick,
          canDeletePermanently,
          isCurrentUser,
          reason,
        },
      };
    })
    .filter(Boolean);

  // Compute current user's self-actions
  const currentUserActions = {
    canLeaveOrg: isMemberOfOrg && !isCurrentUserFounder,
    canDeleteOwnAccount: !isCurrentUserFounderOfAny,
    isFounderOfCurrentOrg: isCurrentUserFounder,
    founderBlockers: currentUserFounderOrgs,
  };

  res.json({ members: mappedMembers, currentUserActions });
});

/** Get network stats for the current organization */
router.get("/network-stats", requireAuth, async (req, res) => {
  const me = (req as any).user as {
    orgId?: string;
    userId?: string;
    role?: string;
  };

  const orgId = req.query.orgId as string || me.orgId;

  if (!orgId) {
    return res.status(400).json({ error: "No organization specified" });
  }

  try {
    const orgObjectId = new Types.ObjectId(orgId);

    // Run all counts in parallel for better performance
    const [
      totalNetworkCount,
      customersCount,
      affiliatesCount,
      stakeholdersCount,
    ] = await Promise.all([
      // Business Network: total stakeholders + customers + guests in HQ
      User.countDocuments({
        "organizations.organization": orgObjectId,
      }),

      // Network 1: Customers (guests who are NOT affiliates - don't have referredBy or downlineCount)
      // Customers are guests who haven't referred anyone
      User.countDocuments({
        organizations: {
          $elemMatch: {
            organization: orgObjectId,
            guest: true,
          },
        },
        $or: [
          { referredBy: { $exists: false } },
          { referredBy: null },
        ],
      }),

      // Network 2: Affiliates (users who have referred others - have downline)
      // First get all users in this org, then count those with referrals
      User.aggregate([
        {
          $match: {
            "organizations.organization": orgObjectId,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "referredBy",
            as: "referrals",
          },
        },
        {
          $match: {
            "referrals.0": { $exists: true },
          },
        },
        {
          $count: "count",
        },
      ]).then((result) => result[0]?.count || 0),

      // Network 3: Stakeholders (non-guest members with stakeholder role)
      User.countDocuments({
        organizations: {
          $elemMatch: {
            organization: orgObjectId,
            role: "stakeholder",
            $or: [{ guest: false }, { guest: { $exists: false } }],
          },
        },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        businessNetwork: totalNetworkCount,
        customers: customersCount,
        affiliates: affiliatesCount,
        stakeholders: stakeholdersCount,
      },
    });
  } catch (error) {
    console.error("Network stats error:", error);
    res.status(500).json({ error: "Failed to fetch network stats" });
  }
});

/** Bulk transfer users between floors */
router.post("/bulk-transfer", requireAuth, async (req, res) => {
  const me = (req as any).user as {
    orgId?: string;
    userId?: string;
    role?: string;
  };

  const body = z
    .object({
      userIds: z.array(z.string()).min(1),
      destinationFloorId: z.string().nullable(),
    })
    .parse(req.body);

  const orgId = me.orgId;
  if (!orgId) {
    return res.status(400).json({ error: "No organization" });
  }

  try {
    // Validate that all users belong to the current organization
    const users = await User.find({
      _id: { $in: body.userIds.map((id) => new Types.ObjectId(id)) },
      organization: new Types.ObjectId(orgId),
    });

    if (users.length !== body.userIds.length) {
      return res.status(400).json({
        error: "Some users don't belong to your organization",
      });
    }

    // Update all users with the new floor assignment
    const updateData: any = {};
    if (body.destinationFloorId) {
      updateData.floorId = new Types.ObjectId(body.destinationFloorId);
    } else {
      updateData.$unset = { floorId: 1 }; // Remove floorId field for unassigned
    }

    const result = await User.updateMany(
      {
        _id: { $in: body.userIds.map((id) => new Types.ObjectId(id)) },
        organization: new Types.ObjectId(orgId),
      },
      updateData
    );

    res.json({
      success: true,
      transferredCount: result.modifiedCount,
      message: `Successfully transferred ${result.modifiedCount} user(s)`,
    });
  } catch (error) {
    console.error("Bulk transfer error:", error);
    res.status(500).json({ error: "Failed to transfer users" });
  }
});

// ────────────────────────────────────────────────────────────────────
// Guest management — founder-scoped mirror of the super-admin
// /garage-admin/affiliate-guests tab.
//
// GET  /team/guests?orgId=X    List users with `organizations.$.guest === true`
//                              on THIS specific org. Founder-only.
// PATCH /team/guests/:userId/graduate?orgId=X
//                              Flip that user's guest flag → false on THIS
//                              org. Positional filter — doesn't touch other
//                              orgs the user may belong to. Founder-only.
// ────────────────────────────────────────────────────────────────────

async function requireFounderOfOrg(
  req: any,
  res: any,
  orgId: string,
): Promise<boolean> {
  const me = req.user as { userId?: string };
  if (!me?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  if (!Types.ObjectId.isValid(orgId)) {
    res.status(400).json({ error: "Invalid orgId" });
    return false;
  }
  const meUser: any = await User.findById(me.userId)
    .select("organizations")
    .lean();
  if (!meUser) {
    res.status(401).json({ error: "User not found" });
    return false;
  }
  const membership = (meUser.organizations || []).find(
    (m: any) => String(m.organization) === String(orgId),
  );
  if (!membership || !hasFounderAccess(membership)) {
    res.status(403).json({ error: "Founder access required for this org" });
    return false;
  }
  return true;
}

router.get("/guests", requireAuth, async (req, res) => {
  try {
    const orgId = String(req.query.orgId || "");
    if (!(await requireFounderOfOrg(req, res, orgId))) return;

    const orgObjectId = new Types.ObjectId(orgId);
    const users: any[] = await User.find({
      organizations: {
        $elemMatch: { organization: orgObjectId, guest: true },
      },
    })
      .select(
        "_id name email phone profilePicture referredBy organizations createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    const rows = users.map((u) => {
      const membership = (u.organizations || []).find(
        (m: any) =>
          String(m.organization) === String(orgObjectId) && m.guest === true,
      );
      return {
        userId: String(u._id),
        name: u.name || null,
        email: u.email || null,
        phone: u.phone || null,
        profilePicture: u.profilePicture || null,
        referredBy: u.referredBy ? String(u.referredBy) : null,
        role: membership?.role || "stakeholder",
        joinedAt: membership?.joinedAt
          ? new Date(membership.joinedAt).toISOString()
          : null,
        createdAt: new Date(u.createdAt).toISOString(),
      };
    });

    res.json({ success: true, rows, total: rows.length });
  } catch (err: any) {
    console.error("[team/guests] list:", err);
    res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

router.patch("/guests/:userId/graduate", requireAuth, async (req, res) => {
  try {
    const orgId = String(req.query.orgId || "");
    const { userId } = req.params;
    if (!(await requireFounderOfOrg(req, res, orgId))) return;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    // Positional filter update — only the org-specific membership row
    // is touched. Idempotent (already false → 200 with modified:0).
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
        error: "User has no membership in this organization",
      });
    }

    res.json({
      success: true,
      modified: result.modifiedCount,
      alreadyGraduated: result.modifiedCount === 0,
    });
  } catch (err: any) {
    console.error("[team/guests] graduate:", err);
    res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

export default router;
