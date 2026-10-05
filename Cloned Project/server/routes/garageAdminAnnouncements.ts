import { Router, Response } from "express";
import { z } from "zod";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { Announcement } from "../models/announcement.model";
import { ok, fail } from "../utils/http";

/**
 * Alerts & Promotions — the super admin's CRUD over the dialogs and banners
 * shown on the login screen and inside the app.
 *
 * Mounted at /garage-admin/announcements. That prefix already runs
 * `garageAdminPageGate` (app.ts), which is deny-by-default for any path not
 * in the delegatable page catalogue — this one is not, so it is super-admin
 * only by construction. The per-route guards below say so explicitly rather
 * than relying on that side effect.
 *
 * Guards are attached per route, never with router.use: several routers
 * share the bare /garage-admin prefix (see backend CLAUDE.md).
 */
const router = Router();

const ctaSchema = z.object({
  enabled: z.boolean().default(false),
  label: z.string().max(60).default(""),
  kind: z.enum(["page", "url"]).default("page"),
  href: z.string().max(2000).default(""),
  newTab: z.boolean().default(false),
});

/**
 * A crude store-side pass so blatantly hostile markup never lands in the
 * database. This is NOT the security boundary — the renderer sanitises with
 * DOMPurify and an explicit allow-list before anything reaches the DOM
 * (components/announcements/AnnouncementCard). Kept deliberately simple
 * because a hand-rolled HTML parser that *is* relied upon for safety is a
 * worse idea than one that is only defence in depth.
 */
function stripDangerousHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

const bodySchema = z.object({
  title: z.string().min(1, "Title is required").max(140),
  // HTML from the console's rich-text editor. 8000 rather than 2000: markup
  // costs characters, and a bulleted list with links hits the old cap fast.
  body: z.string().max(8000).default("").transform(stripDangerousHtml),
  eyebrow: z.string().max(60).optional(),
  surface: z.enum(["pre-login", "post-login", "everywhere"]),
  size: z.enum(["sm", "md", "lg", "banner"]),
  contentType: z.enum(["text", "image-text"]),
  imageUrl: z.string().max(2000).optional(),
  template: z.string().max(40).default("solid"),
  // Free-form on purpose — the icon catalogue lives in the frontend
  // (lib/announcements.ts) and an unknown name falls back to the default
  // glyph, so adding one there needs no backend deploy.
  icon: z.string().max(40).default("megaphone"),
  cta: ctaSchema.default({
    enabled: false,
    label: "",
    kind: "page",
    href: "",
    newTab: false,
  }),
  comingSoon: z.boolean().default(false),
  comingSoonLabel: z.string().max(40).optional(),
  enabled: z.boolean().default(false),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(-100).max(100).default(0),
});

/**
 * An image-content announcement without an image renders as a broken card,
 * and a CTA with no destination is a dead button. Both are cheap to catch
 * here rather than in front of every user.
 */
function semanticErrors(v: z.infer<typeof bodySchema>): string | null {
  if (v.contentType === "image-text" && !v.imageUrl?.trim()) {
    return "Upload an image, or switch the content type to text-only";
  }
  if (v.cta.enabled && !v.comingSoon) {
    if (!v.cta.label.trim()) return "Give the button a label";
    if (!v.cta.href.trim()) return "Pick a page or enter a URL for the button";
  }
  if (v.startsAt && v.endsAt && new Date(v.startsAt) >= new Date(v.endsAt)) {
    return "The end date must be after the start date";
  }
  return null;
}

export function serializeAnnouncement(a: any) {
  return {
    id: String(a._id),
    title: a.title,
    body: a.body || "",
    eyebrow: a.eyebrow || "",
    surface: a.surface,
    size: a.size,
    contentType: a.contentType,
    imageUrl: a.imageUrl || "",
    template: a.template || "solid",
    icon: a.icon || "megaphone",
    cta: {
      enabled: !!a.cta?.enabled,
      label: a.cta?.label || "",
      kind: a.cta?.kind || "page",
      href: a.cta?.href || "",
      newTab: !!a.cta?.newTab,
    },
    comingSoon: !!a.comingSoon,
    comingSoonLabel: a.comingSoonLabel || "",
    enabled: !!a.enabled,
    startsAt: a.startsAt ? new Date(a.startsAt).toISOString() : null,
    endsAt: a.endsAt ? new Date(a.endsAt).toISOString() : null,
    priority: a.priority ?? 0,
    version: a.version ?? 1,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/** GET /garage-admin/announcements — every announcement, newest first. */
router.get(
  "/",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  async (_req: GarageAdminRequest, res: Response) => {
    try {
      const rows = await Announcement.find({})
        .sort({ enabled: -1, priority: -1, createdAt: -1 })
        .lean();
      return res.json(ok(rows.map(serializeAnnouncement)));
    } catch (err: any) {
      console.error("[garage-admin/announcements][list] error:", err);
      return res
        .status(500)
        .json(fail(err?.message || "Failed to load announcements"));
    }
  }
);

/** POST /garage-admin/announcements */
router.post(
  "/",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const v = bodySchema.parse(req.body);
      const problem = semanticErrors(v);
      if (problem) return res.status(400).json(fail(problem));

      const created = await Announcement.create({
        ...v,
        startsAt: v.startsAt ? new Date(v.startsAt) : null,
        endsAt: v.endsAt ? new Date(v.endsAt) : null,
        createdByAdminId: req.garageAdmin?.id || null,
      });
      return res.status(201).json(ok(serializeAnnouncement(created.toObject())));
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res
          .status(400)
          .json(fail(err.issues?.[0]?.message || "Bad request"));
      }
      console.error("[garage-admin/announcements][create] error:", err);
      return res
        .status(500)
        .json(fail(err?.message || "Failed to create announcement"));
    }
  }
);

/** PATCH /garage-admin/announcements/:id — full replace of the editable set. */
router.patch(
  "/:id",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const v = bodySchema.parse(req.body);
      const problem = semanticErrors(v);
      if (problem) return res.status(400).json(fail(problem));

      const updated = await Announcement.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            ...v,
            eyebrow: v.eyebrow || "",
            imageUrl: v.contentType === "image-text" ? v.imageUrl || "" : "",
            comingSoonLabel: v.comingSoonLabel || "",
            startsAt: v.startsAt ? new Date(v.startsAt) : null,
            endsAt: v.endsAt ? new Date(v.endsAt) : null,
          },
        },
        { new: true }
      ).lean();

      if (!updated) return res.status(404).json(fail("Announcement not found"));
      return res.json(ok(serializeAnnouncement(updated)));
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res
          .status(400)
          .json(fail(err.issues?.[0]?.message || "Bad request"));
      }
      console.error("[garage-admin/announcements][update] error:", err);
      return res
        .status(500)
        .json(fail(err?.message || "Failed to update announcement"));
    }
  }
);

/**
 * POST /garage-admin/announcements/:id/reset-dismissals
 *
 * Dismissal lives in the browser under `${id}:${version}`, so bumping the
 * version is the only thing "show this again to everyone" needs to do.
 */
router.post(
  "/:id/reset-dismissals",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const updated = await Announcement.findByIdAndUpdate(
        req.params.id,
        { $inc: { version: 1 } },
        { new: true }
      ).lean();
      if (!updated) return res.status(404).json(fail("Announcement not found"));
      return res.json(ok(serializeAnnouncement(updated)));
    } catch (err: any) {
      console.error("[garage-admin/announcements][reset] error:", err);
      return res
        .status(500)
        .json(fail(err?.message || "Failed to reset dismissals"));
    }
  }
);

/** DELETE /garage-admin/announcements/:id */
router.delete(
  "/:id",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const deleted = await Announcement.findByIdAndDelete(req.params.id).lean();
      if (!deleted) return res.status(404).json(fail("Announcement not found"));
      return res.json(ok({ deleted: true }));
    } catch (err: any) {
      console.error("[garage-admin/announcements][delete] error:", err);
      return res
        .status(500)
        .json(fail(err?.message || "Failed to delete announcement"));
    }
  }
);

export default router;
