import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Floor } from "../models/floor.model";
import { User } from "../models/user.model";
import { Types } from "mongoose";
import { Invite } from "../models/invite.model";

const router = Router();

async function getOrgIdForUser(userId: string) {
  const u = await User.findById(userId)
    .select("organization orgId organizations")
    .lean();

  // First try to get orgId from JWT token context (most reliable)
  if ((u as any)?.orgId) {
    return new Types.ObjectId((u as any).orgId);
  }

  // Fallback to legacy organization field
  if ((u as any)?.organization) {
    return new Types.ObjectId((u as any).organization);
  }

  // Last resort: check organizations array
  if ((u as any)?.organizations?.length > 0) {
    return new Types.ObjectId((u as any).organizations[0].organization);
  }

  return null;
}

/** List floors for my org */
router.get("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string; orgId?: string };
  const orgId = (req.query.orgId as string) || me.orgId;

  console.log("=== FLOOR API DEBUG ===");
  console.log("User:", me);
  console.log("orgId from query:", req.query.orgId);
  console.log("orgId from JWT:", me.orgId);
  console.log("Final orgId:", orgId);

  if (!orgId) {
    console.log("No orgId found, returning error");
    return res.status(400).json({ error: "No organization" });
  }

  // Check if there are ANY floors in the database first
  const allFloors = await Floor.find({}).lean();
  console.log("Total floors in database:", allFloors.length);
  console.log("All floors:", allFloors);

  const floors = await Floor.find({ orgId: new Types.ObjectId(orgId) })
    .sort({ level: 1 })
    .lean();

  console.log("Found floors for org:", floors.length);
  console.log("Floors for org:", floors);
  console.log("=== END FLOOR DEBUG ===");

  res.json({
    floors: floors.map((f) => ({
      id: f._id.toString(),
      level: f.level,
      name: f.name,
      departments: (f.departments || []).map((d) => ({
        name: d.name,
        color: d.color || "",
      })),
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    })),
  });
});

/** Create a single floor */
router.post("/", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = await getOrgIdForUser(me);
  if (!orgId) return res.status(400).json({ error: "No organization" });

  const body = z
    .object({
      level: z.number().int().min(1).max(100),
      name: z.string().min(1).max(120),
      departments: z
        .array(
          z.object({
            name: z.string().min(1).max(120),
            color: z.string().optional(),
          }),
        )
        .max(50)
        .default([]),
    })
    .parse(req.body);

  // Check if floor level already exists
  const existingFloor = await Floor.findOne({ orgId, level: body.level });
  if (existingFloor) {
    return res.status(400).json({ error: "Floor level already exists" });
  }

  const floor = new Floor({
    orgId,
    level: body.level,
    name: body.name.trim(),
    departments: body.departments.map((d) => ({
      name: d.name.trim(),
      color: d.color || "",
    })),
  });

  await floor.save();

  res.json({
    id: floor._id.toString(),
    level: floor.level,
    name: floor.name,
    departments: floor.departments.map((d) => ({
      name: d.name,
      color: d.color || "",
    })),
    createdAt: floor.createdAt,
    updatedAt: floor.updatedAt,
  });
});

/** Replace (setup) floors for my org */
router.post("/setup", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = await getOrgIdForUser(me);
  if (!orgId) return res.status(400).json({ error: "No organization" });

  const body = z
    .object({
      floors: z
        .array(
          z.object({
            level: z.number().int().min(1).max(100),
            name: z.string().min(1).max(120),
            departments: z
              .array(
                z.object({
                  name: z.string().min(1).max(120),
                  color: z.string().optional(),
                }),
              )
              .max(50),
          }),
        )
        .max(100),
    })
    .parse(req.body);

  // Replace strategy (simple & safe)
  await Floor.deleteMany({ orgId });
  if (body.floors.length) {
    const docs = body.floors.map((f) => ({
      orgId,
      level: f.level,
      name: f.name.trim(),
      departments: f.departments.map((d) => ({
        name: d.name.trim(),
        color: d.color || "",
      })),
    }));
    await Floor.insertMany(docs);
  }

  res.json({ ok: true });
});

/** Update a single floor */
/** Update a single floor */
router.patch("/:id", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgIdFromQuery = req.query.organizationId as string;
  const orgId = orgIdFromQuery
    ? new Types.ObjectId(orgIdFromQuery)
    : await getOrgIdForUser(me);
  if (!orgId) return res.status(400).json({ error: "No organization" });

  const { id } = z.object({ id: z.string() }).parse(req.params);
  const patch = z
    .object({
      name: z.string().min(1).max(120).optional(),
      departments: z
        .array(
          z.object({
            name: z.string().min(1).max(120),
            color: z.string().optional(),
          }),
        )
        .max(50)
        .optional(),
      level: z.number().int().min(1).max(100).optional(),
    })
    .parse(req.body || {});

  // build $set safely
  const $set: any = {};
  if (patch.name !== undefined) $set.name = patch.name.trim();
  if (patch.level !== undefined) $set.level = patch.level;
  if (patch.departments !== undefined) {
    $set.departments = patch.departments.map((d) => ({
      name: d.name.trim(),
      color: d.color || "",
    }));
  }

  const result = await Floor.updateOne(
    { _id: id, orgId },
    { $set },
    { runValidators: true },
  );
  if (result.matchedCount === 0 && (result as any).n === 0) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json({ ok: true });
});

/** Delete a floor */
router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = req.query.organizationId as string;
  if (!orgId) return res.status(400).json({ error: "No organization" });

  const { id } = z.object({ id: z.string() }).parse(req.params);
  await Floor.deleteOne({ _id: id, orgId: new Types.ObjectId(orgId) });
  res.json({ ok: true });
});

router.get("/roster", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = req.query.orgId as string;

  // console.log(`🔍 Floor roster - OrgId from query: ${orgId}`);

  if (!orgId) return res.status(400).json({ error: "No organization" });

  // fetch floors once
  const floors = await Floor.find({ orgId }).sort({ level: 1 }).lean();

  // fetch all users in this org with placement
  const users = await User.find({
    $or: [
      { organization: orgId }, // Legacy single organization users
      { "organizations.organization": orgId }, // New multi-organization users
    ],
  })
    .select(
      "_id name email role organizations department lastSeenAt profilePicture",
    )
    .lean();

  // (optional) invites by floor to show pending
  const invites = await Invite.find({ orgId, status: "pending" })
    .select("_id email name role floorId department createdAt")
    .lean();

  // index by floorId string
  const byFloorUsers = new Map<string, any[]>();
  for (const u of users) {
    // Get floorId from organization membership or legacy field
    let userFloorId = null;

    // Check legacy floorId field first
    if ((u as any).floorId) {
      userFloorId = (u as any).floorId;
    } else if (u.organizations) {
      // Find the membership for this organization
      const membership = u.organizations.find(
        (membership: any) => membership.organization.toString() === orgId,
      );
      if (membership?.floorId) {
        userFloorId = membership.floorId;
      }
    }

    const key = userFloorId ? String(userFloorId) : "UNASSIGNED";
    if (!byFloorUsers.has(key)) byFloorUsers.set(key, []);
    byFloorUsers.get(key)!.push({
      id: String(u._id),
      name: u.name || "",
      email: u.email,
      role: u.role,
      department: u.department || "",
      profilePicture: (u as any).profilePicture || null,
      // Surfaces "Active X ago" on the floor roster card. Null if the
      // user hasn't connected since the field was added.
      lastSeenAt: (u as any).lastSeenAt || null,
    });
  }

  const byFloorInvites = new Map<string, any[]>();
  for (const inv of invites) {
    const key = inv.floorId ? String(inv.floorId) : "UNASSIGNED";
    if (!byFloorInvites.has(key)) byFloorInvites.set(key, []);
    byFloorInvites.get(key)!.push({
      id: String(inv._id),
      name: inv.name || "",
      email: inv.email,
      role: inv.role,
      department: inv.department || "",
      createdAt: inv.createdAt,
    });
  }

  // transform floors with members + department counts
  const out = floors.map((f) => {
    const fid = String(f._id);
    const members = byFloorUsers.get(fid) || [];
    const pending = byFloorInvites.get(fid) || [];

    // breakdown by department (only those present)
    const deptCounts: Record<string, number> = {};
    for (const m of members) {
      const key = m.department || "—";
      deptCounts[key] = (deptCounts[key] || 0) + 1;
    }

    return {
      id: fid,
      level: f.level,
      name: f.name,
      departments: (f.departments || []).map((d: any) => ({
        name: d.name,
        count: deptCounts[d.name] || 0,
      })),
      members,
      pending, // optional list of invites for that floor
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  });

  // unassigned bucket
  // unassigned bucket (EXCLUDE admins)
  const unassignedMembersRaw = byFloorUsers.get("UNASSIGNED") || [];
  const unassignedMembers = unassignedMembersRaw.filter(
    (m) => m.role !== "founder",
  );
  const unassignedInvites = byFloorInvites.get("UNASSIGNED") || [];

  res.json({
    floors: out,
    unassigned: {
      members: unassignedMembers,
      pending: unassignedInvites,
    },
  });
});

export default router;
