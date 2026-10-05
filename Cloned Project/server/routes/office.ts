import { Router, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Product } from "../models/product.model";

/**
 * Internal office (organization) endpoints used by the Garage frontend.
 * Standard JWT auth via `requireAuth` — no API key, no extra middleware.
 *
 * Mount: app.use("/office", officeRoutes)
 */
const router = Router();

type AddressBlock = {
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  /** "City, State, Country · Postal" — non-empty parts joined for display. */
  formatted: string | null;
};

function buildAddress(u: any): AddressBlock {
  const city = u?.city || null;
  const state = u?.state || null;
  const country = u?.country || null;
  const postalCode = u?.postalCode || null;
  const parts = [city, state, country].filter(Boolean) as string[];
  let formatted: string | null = null;
  if (parts.length || postalCode) {
    formatted = parts.join(", ") + (postalCode ? ` · ${postalCode}` : "");
    formatted = formatted.trim() || null;
  }
  return { city, state, country, postalCode, formatted };
}

type PersonBlock = {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  address: AddressBlock;
  /** ISO date string of last socket activity, or null if never seen. */
  lastSeenAt: string | null;
};

function buildPerson(u: any): PersonBlock {
  return {
    userId: String(u._id),
    name: u.name || null,
    email: u.email || null,
    phone: u.phone || null,
    profilePicture: u.profilePicture || null,
    address: buildAddress(u),
    lastSeenAt: u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : null,
  };
}

/**
 * Shared shaper used by both the generic `/office/:orgId/members` route
 * and the bat246-pinned `/office/bat246/members` route. Returns 404 if the
 * org doesn't exist; otherwise builds the full members+upline payload.
 *
 * `bat246Aware` (only passed true by the pinned bat246 route): the "Upline"
 * shown here defaults to `User.referredBy` — the GENERIC, platform-wide
 * Garage affiliate relationship, set at signup from an unrelated `?ref=`
 * code. For BAT246 that is almost always the wrong person: the actual
 * BAT246 inviter is recorded separately, on
 * `Bat246Distributor.bat246RefUserId`, set by the invite/purchase flows
 * (Inviteandplace's "Invite to become Bat246 Distributor", board-entry
 * purchases, etc.). When true, that field takes priority over
 * `referredBy` per member, falling back to the generic upline only if a
 * member has no bat246 referrer on record.
 */
async function buildMembersResponse(
  orgObjectId: Types.ObjectId,
  res: Response,
  opts: { bat246Aware?: boolean } = {},
) {
  // Office lookup + members fetched in parallel. The compound profile
  // fields we project here cover both the member row AND the upline
  // attachment downstream, so a single User collection scan is enough.
  const memberSelect =
    "name email phone profilePicture country state city postalCode organizations referredBy lastSeenAt";

  const [office, members] = await Promise.all([
    Organization.findById(orgObjectId).select("name slug icon").lean(),
    User.find({ "organizations.organization": orgObjectId })
      .select(memberSelect)
      .lean(),
  ]);

  if (!office) {
    return res
      .status(404)
      .json({ success: false, error: "Office not found" });
  }

  // BAT246-specific upline, keyed by member userId — only fetched when
  // asked for. `bat246RefUserId` is what every BAT246 invite/purchase flow
  // actually sets; `referredBy` below is the unrelated generic fallback.
  const bat246RefByMemberId = new Map<string, string>();
  if (opts.bat246Aware && members.length) {
    const { Bat246Distributor } = await import(
      "../bat246/models/bat246Distributor.model"
    );
    const memberIds = (members as any[]).map((m) => m._id);
    const distributors = await Bat246Distributor.find({
      userId: { $in: memberIds },
      bat246RefUserId: { $exists: true, $ne: null },
    })
      .select("userId bat246RefUserId")
      .lean();
    for (const d of distributors as any[]) {
      bat246RefByMemberId.set(String(d.userId), String(d.bat246RefUserId));
    }
  }

  // Batch fetch all uplines in one query (deduped). Faster than
  // populating per-member, and only loads the fields we actually return.
  // Covers both the generic `referredBy` uplines and (when bat246Aware)
  // the BAT246-specific ones, since a member can need either.
  const uplineIds = Array.from(
    new Set(
      (members as any[])
        .map((m) => m.referredBy)
        .filter(Boolean)
        .map((id: any) => String(id))
        .concat(Array.from(bat246RefByMemberId.values()))
    )
  ).map((id) => new Types.ObjectId(id));

  const uplines = uplineIds.length
    ? await User.find({ _id: { $in: uplineIds } })
        .select(
          "name email phone profilePicture country state city postalCode lastSeenAt"
        )
        .lean()
    : [];

  const uplineByUserId = new Map<string, PersonBlock>();
  for (const u of uplines as any[]) {
    uplineByUserId.set(String(u._id), buildPerson(u));
  }

  // Shape each member row: profile + this office's joinedAt/role + upline.
  const rows = (members as any[])
    .map((m) => {
      const membership = (m.organizations || []).find(
        (om: any) => String(om?.organization) === String(orgObjectId)
      );
      // BAT246 referrer wins when we have one; otherwise fall back to the
      // generic platform-wide referral (matches pre-existing behaviour for
      // every other org, and for any BAT246 member with no recorded
      // BAT246-specific referrer).
      const bat246RefId = bat246RefByMemberId.get(String(m._id));
      const refId = bat246RefId || (m.referredBy ? String(m.referredBy) : null);
      return {
        ...buildPerson(m),
        role: membership?.role || null,
        guest: !!membership?.guest,
        joinedAt: membership?.joinedAt || null,
        // Per the spec sheet: upline data nested under each member.
        upline: refId ? uplineByUserId.get(refId) || null : null,
      };
    })
    // Newest joins first — feels natural for "who's joined" feeds.
    // Use a stable secondary sort (userId) so pages don't drift when
    // joinedAt is missing or identical across users.
    .sort((a, b) => {
      const ta = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
      const tb = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return b.userId.localeCompare(a.userId);
    });

  return res.json({
    success: true,
    office: {
      _id: String((office as any)._id),
      name: (office as any).name || null,
      slug: (office as any).slug || null,
      icon: (office as any).icon || null,
    },
    totalMembers: rows.length,
    members: rows,
  });
}

/**
 * GET /office/bat246/members
 *
 * Pinned variant of the members endpoint that always resolves the bat246
 * office — partners and the frontend don't need to hardcode an orgId.
 *
 * Org resolution matches the existing bat246 service pattern: look up the
 * `bat246_entry` product and read its `organizationId`. That way if the
 * platform ever moves bat246 to a different org, nothing here needs to
 * change.
 *
 * IMPORTANT: this route must be declared BEFORE `/:orgId/members` so
 * Express doesn't capture "bat246" as the `:orgId` param (which would
 * then 400 on the ObjectId check).
 */
router.get("/bat246/members", requireAuth, async (_req, res) => {
  try {
    const entryProduct = await Product.findOne({ tags: "bat246_entry" })
      .select("organizationId")
      .lean();
    const orgIdRaw = (entryProduct as any)?.organizationId;
    if (!orgIdRaw) {
      return res.status(503).json({
        success: false,
        error: "Bat246 office is not configured (no bat246_entry product found)",
      });
    }
    return await buildMembersResponse(new Types.ObjectId(String(orgIdRaw)), res, {
      bat246Aware: true,
    });
  } catch (error: any) {
    console.error("[office] /bat246/members error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error?.message || "Failed to fetch bat246 office members",
      });
  }
});

/**
 * GET /office/:orgId/members
 *
 * Generic version — pass any office's ObjectId. Used by the Garage front-end
 * "garage tree" view.
 */
router.get("/:orgId/members", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    if (!Types.ObjectId.isValid(orgId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid orgId" });
    }
    return await buildMembersResponse(new Types.ObjectId(orgId), res);
  } catch (error: any) {
    console.error("[office] /:orgId/members error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error?.message || "Failed to fetch office members",
      });
  }
});

export default router;
