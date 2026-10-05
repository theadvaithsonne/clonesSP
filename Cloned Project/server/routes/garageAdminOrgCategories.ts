import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireGarageAdminAuth } from "../middleware/garageAdminAuth";
import {
  listCategoriesWithCounts,
  createOrgCategory,
  renameOrgCategory,
  mergeAndDeleteOrgCategory,
} from "../services/orgCategory";
import { ok, fail } from "../utils/http";

/**
 * garage-admin CRUD for the organization category taxonomy. All routes
 * are under `/garage-admin/categories` and gated by `requireGarageAdminAuth`
 * (parity with the platform-fee-overrides and user-management surfaces).
 *
 * Delete requires a `targetCategoryId` in the body — orphaning is
 * intentionally not supported (see plan). If admin wants an "Other"
 * bucket, they create one first, then merge into it.
 */
const router = Router();

/** GET /garage-admin/categories → [{id, name, slug, orgCount, createdAt}] */
router.get("/", requireGarageAdminAuth, async (_req, res) => {
  try {
    const rows = await listCategoriesWithCounts();
    return res.json(
      ok(
        rows.map((r) => ({
          id: r._id,
          name: r.name,
          slug: r.slug,
          orgCount: r.orgCount,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      ),
    );
  } catch (err: any) {
    console.error("[garage-admin/categories][list] error:", err);
    return res.status(500).json(fail(err?.message || "Failed to list categories"));
  }
});

const createBodySchema = z.object({
  name: z.string().min(1, "Name required").max(60, "Name too long"),
});

/** POST /garage-admin/categories { name } */
router.post("/", requireGarageAdminAuth, async (req: Request, res: Response) => {
  try {
    const { name } = createBodySchema.parse(req.body);
    const adminId = (req as any).garageAdmin?.garageAdminId || null;

    const created = await createOrgCategory({
      name,
      createdByAdminId: adminId,
    });

    return res.status(201).json(
      ok({
        id: created._id,
        name: created.name,
        slug: created.slug,
        orgCount: 0,
      }),
    );
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json(fail(err.issues?.[0]?.message || "Bad request"));
    }
    // Duplicate-key errors bubble as {code:11000} from Mongo or our
    // service's "already exists" message — surface both as 409.
    if (err?.code === 11000 || /already exists/i.test(err?.message || "")) {
      return res.status(409).json(fail(err.message || "Category already exists"));
    }
    console.error("[garage-admin/categories][create] error:", err);
    return res.status(500).json(fail(err?.message || "Failed to create category"));
  }
});

const patchBodySchema = z.object({
  name: z.string().min(1, "Name required").max(60, "Name too long"),
});

/** PATCH /garage-admin/categories/:id { name } — rename + cascade */
router.patch(
  "/:id",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const { name } = patchBodySchema.parse(req.body);
      const result = await renameOrgCategory(req.params.id, name);
      return res.json(
        ok({
          id: result.category._id,
          name: result.category.name,
          slug: result.category.slug,
          orgsUpdated: result.orgsUpdated,
        }),
      );
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json(fail(err.issues?.[0]?.message || "Bad request"));
      }
      if (/invalid category id/i.test(err?.message || "")) {
        return res.status(400).json(fail(err.message));
      }
      if (/not found/i.test(err?.message || "")) {
        return res.status(404).json(fail(err.message));
      }
      if (err?.code === 11000 || /already exists/i.test(err?.message || "")) {
        return res.status(409).json(fail(err.message || "Category already exists"));
      }
      console.error("[garage-admin/categories][rename] error:", err);
      return res.status(500).json(fail(err?.message || "Failed to rename category"));
    }
  },
);

const deleteBodySchema = z.object({
  targetCategoryId: z.string().min(1, "targetCategoryId is required"),
});

/**
 * DELETE /garage-admin/categories/:id { targetCategoryId }
 * Merges every org from :id into targetCategoryId, then deletes :id.
 * `targetCategoryId` is REQUIRED — orphaning not supported.
 */
router.delete(
  "/:id",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const { targetCategoryId } = deleteBodySchema.parse(req.body || {});
      const result = await mergeAndDeleteOrgCategory(
        req.params.id,
        targetCategoryId,
      );
      return res.json(
        ok({
          deleted: result.deleted,
          orgsReassigned: result.orgsReassigned,
          mergedInto: {
            id: result.mergedInto._id,
            name: result.mergedInto.name,
          },
        }),
      );
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json(fail(err.issues?.[0]?.message || "Bad request"));
      }
      if (/invalid category id/i.test(err?.message || "")) {
        return res.status(400).json(fail(err.message));
      }
      if (/into itself/i.test(err?.message || "")) {
        return res.status(400).json(fail(err.message));
      }
      if (/not found/i.test(err?.message || "")) {
        return res.status(404).json(fail(err.message));
      }
      console.error("[garage-admin/categories][delete] error:", err);
      return res.status(500).json(fail(err?.message || "Failed to delete category"));
    }
  },
);

export default router;
