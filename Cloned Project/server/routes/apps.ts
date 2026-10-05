import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { AppSubscription } from "../models/appSubscription.model";
import { Types } from "mongoose";
import { User } from "../models/user.model";

const router = Router();

async function getOrgUserIds(orgId: string | Types.ObjectId) {
  const rows = await User.find({
    organization: new Types.ObjectId(orgId as any),
  })
    .select("_id")
    .lean();
  return rows.map((r) => r._id as Types.ObjectId);
}

/** List my subscriptions */
router.get("/my", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const meOrg = (req as any).user.orgId as string;

  // Get orgId from query parameters for org-based subscriptions
  const orgIdFromQuery = req.query.orgId as string;
  const targetOrgId = orgIdFromQuery || meOrg;

  // Find subscriptions for ONLY the current user in the target org
  const rows = await AppSubscription.find({
    userId: new Types.ObjectId(me),
    organizationId: new Types.ObjectId(targetOrgId),
  })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    apps: rows.map((r) => ({
      id: r.appId,
      name: r.name,
      url: r.url,
      icon: r.icon,
      description: r.description,
      subscribedAt: r.createdAt,
    })),
  });
});

/** Subscribe (idempotent upsert) */
router.post("/subscribe", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const meOrg = (req as any).user.orgId as string;
  const body = z
    .object({
      appId: z.string().min(2).max(50),
      name: z.string().min(2).max(120),
      url: z.string().url(),
      icon: z.string().optional(),
      description: z.string().optional(),
    })
    .parse(req.body);

  await AppSubscription.updateOne(
    {
      userId: new Types.ObjectId(me),
      appId: body.appId,
      organizationId: new Types.ObjectId(meOrg),
    },
    {
      $set: {
        name: body.name,
        url: body.url,
        icon: body.icon,
        description: body.description,
      },
      $setOnInsert: {
        userId: new Types.ObjectId(me),
        appId: body.appId,
        organizationId: new Types.ObjectId(meOrg),
      },
    },
    { upsert: true }
  );

  res.json({ ok: true });
});

/** Unsubscribe */
router.delete("/:appId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const meOrg = (req as any).user.orgId as string;
  const { appId } = z.object({ appId: z.string() }).parse(req.params);

  await AppSubscription.deleteOne({
    userId: new Types.ObjectId(me),
    appId,
    organizationId: new Types.ObjectId(meOrg),
  });

  res.json({ ok: true });
});

/**
 * GET /apps/admin/assignees?appId=xxx&orgId=xxx
 * Returns userIds who currently have this app assigned.
 */
router.get("/admin/assignees", requireAuth, requireAuth, async (req, res) => {
  const me = (req as any).user as { orgId: string };
  const { appId, orgId } = z
    .object({
      appId: z.string().min(2),
      orgId: z.string().optional(),
    })
    .parse(req.query);

  // Use orgId from query params, fallback to token orgId
  const targetOrgId = orgId || me.orgId;
  console.log("targetOrgId", targetOrgId);
  const orgUserIds = await getOrgUserIds(targetOrgId);

  console.log("orgUserIds", orgUserIds);
  if (!orgUserIds.length) return res.json({ assignees: [] });

  // Find subscriptions for this app in the target org context
  const subs = await AppSubscription.find({
    appId,
    organizationId: new Types.ObjectId(targetOrgId),
  })
    .select("userId")
    .lean();

  console.log("subs", subs);
  res.json({ assignees: subs.map((s) => s.userId.toString()) });
});

/**
 * POST /apps/admin/assign
 * Body: { appId, userIds: string[], name?, url?, icon?, description? }
 * Replaces the entire assignment set for this app across your org.
 */
// helper: normalize empty -> undefined
const norm = (s?: string | null) => {
  if (s == null) return undefined;
  const t = String(s).trim();
  return t.length ? t : undefined;
};

// optional: known catalog fallback (keeps DB clean if frontend forgets to send)
const APP_REGISTRY: Record<
  string,
  { name: string; url: string; icon?: string; description?: string }
> = {
  garage: {
    name: "Garage",
    url: "https://my.garage.app/",
    description:
      "Simple, privacy-respecting link-in-bio & micro-website builder.",
  },
  earngpt: {
    name: "EarnGPT",
    url: "https://www.earngpt.io/",
    description: "Earn while you prompt—tools to monetize AI workflows.",
  },
  "indian-investors": {
    name: "Indian Investors",
    url: "https://app.indianinvestor.com/",
    description: "Connect with India's top investors & VCs.",
  },
  whatsapp: { name: "WhatsApp", url: "https://web.whatsapp.com/" },
  gmail: { name: "Gmail", url: "https://mail.google.com/" },
};

router.post("/admin/assign", requireAuth, requireAuth, async (req, res) => {
  const me = (req as any).user as { orgId: string };

  // Get orgId from query parameters and use it for org-based subscriptions
  const orgIdFromQuery = req.query.orgId as string;
  console.log("Organization ID from query params:", orgIdFromQuery);

  // Use the orgId from query params, fallback to token orgId if not provided
  const targetOrgId = orgIdFromQuery || me.orgId;

  const body = z
    .object({
      appId: z.string().min(2),
      userIds: z.array(z.string()).default([]),
      name: z.string().optional(),
      url: z.string().url().optional(),
      icon: z.string().optional(),
      description: z.string().optional(),
    })
    .parse(req.body);

  const { appId, userIds } = body;

  // All users in the target organization
  const orgUsers = await User.find({ organization: targetOrgId })
    .select("_id")
    .lean();
  const orgUserIds = orgUsers.map((u) => u._id);

  // Current assignments only within org
  const current = await AppSubscription.find({
    appId,
    userId: { $in: orgUserIds },
    organizationId: new Types.ObjectId(targetOrgId),
  }).lean();

  // Maybe reuse metadata from org or anywhere
  const orgExisting = current[0] || null;
  const globalExisting = await AppSubscription.findOne({ appId })
    .sort({ createdAt: -1 })
    .lean();

  const reg = APP_REGISTRY[appId];

  // coalesce with normalization ("" => undefined)
  const chosenName =
    norm(body.name) ??
    orgExisting?.name ??
    globalExisting?.name ??
    reg?.name ??
    appId;
  const chosenUrl =
    norm(body.url) ??
    orgExisting?.url ??
    globalExisting?.url ??
    reg?.url ??
    `https://${appId}.com/`;
  const chosenIcon =
    norm(body.icon) ??
    orgExisting?.icon ??
    globalExisting?.icon ??
    reg?.icon ??
    "";
  const chosenDesc =
    norm(body.description) ??
    orgExisting?.description ??
    globalExisting?.description ??
    reg?.description ??
    "";

  // sets to compute adds/removes
  const nextSet = new Set(userIds);
  const curSet = new Set(current.map((s) => s.userId.toString()));

  const toAdd = [...nextSet].filter((id) => !curSet.has(id));
  const toRemove = [...curSet].filter((id) => !nextSet.has(id));
  const toStay = [...nextSet].filter((id) => curSet.has(id));

  // Upsert new assignments (always writes chosen meta)
  if (toAdd.length) {
    await AppSubscription.bulkWrite(
      toAdd.map((id) => ({
        updateOne: {
          filter: {
            userId: new Types.ObjectId(id),
            appId,
            organizationId: new Types.ObjectId(targetOrgId),
          },
          update: {
            $set: {
              name: chosenName,
              url: chosenUrl,
              icon: chosenIcon,
              description: chosenDesc,
            },
            $setOnInsert: {
              userId: new Types.ObjectId(id),
              appId,
              organizationId: new Types.ObjectId(targetOrgId),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  // Remove unassigned
  if (toRemove.length) {
    await AppSubscription.deleteMany({
      appId,
      userId: { $in: toRemove.map((id) => new Types.ObjectId(id)) },
      organizationId: new Types.ObjectId(targetOrgId),
    });
  }

  // Optional: if admin actually provided any meta, update it on those who remain assigned too
  const adminProvidedAny = [
    body.name,
    body.url,
    body.icon,
    body.description,
  ].some((v) => norm(v));
  if (adminProvidedAny && toStay.length) {
    const $set: any = {};
    if (norm(body.name)) $set.name = chosenName;
    if (norm(body.url)) $set.url = chosenUrl;
    if (norm(body.icon)) $set.icon = chosenIcon;
    if (norm(body.description)) $set.description = chosenDesc;

    if (Object.keys($set).length) {
      await AppSubscription.updateMany(
        {
          appId,
          userId: { $in: toStay.map((id) => new Types.ObjectId(id)) },
          organizationId: new Types.ObjectId(targetOrgId),
        },
        { $set }
      );
    }
  }

  res.json({
    ok: true,
    addedCount: toAdd.length,
    removedCount: toRemove.length,
    stayedCount: toStay.length,
  });
});

export default router;
