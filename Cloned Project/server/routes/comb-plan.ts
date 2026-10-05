import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  createCombPlan,
  getCombPlan,
  getCombPlanForItem,
  getCombPlansByOrg,
  updateCombPlan,
  deleteCombPlan,
  getCommissionHistory,
  getItemCommissionStats,
} from "../services/commission";

const router = Router();

// ============= Comb Plan CRUD =============

/**
 * POST /comb-plans
 * Create a new comb plan for an item
 * Only founders can create comb plans
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    const schema = z
      .object({
        name: z.string().min(1),
        description: z.string().max(500).optional(),
        itemType: z.enum(["course", "product", "channel", "workshop", "service", "call", "event"]),
        itemId: z.string().min(1),
        levels: z
          .array(
            z.object({
              level: z.number().int().min(1).max(10),
              percentage: z.number().min(0).max(100),
              description: z.string().max(100).optional(),
            })
          )
          .default([]),
        // Distribution cap. Absent = "perpetual" (same as every legacy
        // plan). "per_pair_capped" requires a positive `capCount`.
        capType: z.enum(["perpetual", "per_pair_capped"]).optional(),
        capCount: z.number().int().min(1).max(100).optional(),
        // Which comp engine this plan drives. Absent = "levels", which is
        // every plan that existed before this field.
        planKind: z.enum(["levels", "unilevel_plus"]).optional(),
        unilevelPlusPercentage: z.number().min(0).max(90).optional(),
      })
      .superRefine((val, ctx) => {
        if (val.planKind === "unilevel_plus") {
          // Exclusive: a plan drives fixed levels OR the Unilevel Plus tree.
          // Both would pay the same uplines twice from one sale and make the
          // 90% ceiling unenforceable, since each is checked separately.
          if (val.levels && val.levels.length > 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["levels"],
              message:
                "A unilevel_plus plan cannot also define levels — choose one comp engine",
            });
          }
          if (
            typeof val.unilevelPlusPercentage !== "number" ||
            val.unilevelPlusPercentage <= 0
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["unilevelPlusPercentage"],
              message:
                "unilevelPlusPercentage must be greater than 0 when planKind is 'unilevel_plus'",
            });
          }
        } else if (typeof val.unilevelPlusPercentage === "number") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["unilevelPlusPercentage"],
            message:
              "unilevelPlusPercentage is only valid when planKind is 'unilevel_plus'",
          });
        }
        if (val.capType === "per_pair_capped") {
          if (typeof val.capCount !== "number" || val.capCount < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["capCount"],
              message:
                "capCount is required and must be at least 1 when capType is 'per_pair_capped'",
            });
          }
        }
      });

    const data = schema.parse(req.body);

    // Validate total percentage doesn't exceed 90%.
    //
    // 90, not 95: 5% platform fee + 90% commissions + 5% seller floor = 100%.
    // createCombPlan (assertCombPlanWithinCap) and the model's own validator
    // both enforce 90 already — this check exists only so the caller gets a
    // clean 400 instead of the 500 that a service-level throw produces. It
    // used to say 95, which let 91–95% plans through to that throw.
    const totalPercentage = data.levels.reduce((sum, l) => sum + l.percentage, 0);
    if (totalPercentage > 90) {
      return res.status(400).json({
        success: false,
        error:
          "Total commission percentage cannot exceed 90% (5% platform fee + 5% seller floor reserved)",
      });
    }

    const plan = await createCombPlan({
      ...data,
      orgId: me.orgId,
      createdBy: me.userId,
    });

    res.status(201).json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Error creating comb plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create comb plan",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /comb-plans
 * List comb plans for the organization
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    const schema = z.object({
      itemType: z.enum(["course", "product", "channel", "workshop", "service"]).optional(),
      isActive: z
        .string()
        .optional()
        .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 50)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const options = schema.parse(req.query);

    const result = await getCombPlansByOrg(me.orgId, options);

    res.json({
      success: true,
      plans: result.plans,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error) {
    console.error("Error listing comb plans:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list comb plans",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /comb-plans/public/item/:itemType/:itemId
 * Get active comb plan for a specific item (PUBLIC - no auth required)
 * Used by guest pages to display affiliate commission info
 */
router.get("/public/item/:itemType/:itemId", async (req, res) => {
  try {
    const { itemType, itemId } = req.params;

    if (!["course", "product", "channel", "workshop", "service", "call", "event"].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid item type",
      });
    }

    const plan = await getCombPlanForItem(
      itemType as "course" | "product" | "channel" | "workshop" | "service" | "call" | "event",
      itemId
    );

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Error getting comb plan for item (public):", error);
    res.status(500).json({
      success: false,
      error: "Failed to get comb plan",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /comb-plans/item/:itemType/:itemId
 * Get active comb plan for a specific item
 */
router.get("/item/:itemType/:itemId", requireAuth, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;

    if (!["course", "product", "channel", "workshop", "service", "call", "event"].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid item type",
      });
    }

    const plan = await getCombPlanForItem(
      itemType as "course" | "product" | "channel" | "workshop" | "service" | "call" | "event",
      itemId
    );

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Error getting comb plan for item:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get comb plan",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /comb-plans/:id
 * Get a specific comb plan
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await getCombPlan(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Comb plan not found",
      });
    }

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Error getting comb plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get comb plan",
      details: (error as Error).message,
    });
  }
});

/**
 * PUT /comb-plans/:id
 * Update a comb plan
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const schema = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().max(500).optional(),
        levels: z
          .array(
            z.object({
              level: z.number().int().min(1).max(10),
              percentage: z.number().min(0).max(100),
              description: z.string().max(100).optional(),
            })
          )
          .optional(),
        isActive: z.boolean().optional(),
        // Distribution cap update. Founder can flip between perpetual
        // and per_pair_capped freely; on switch to perpetual the model's
        // pre-save hook drops any stray capCount. Switching back to
        // per_pair_capped without capCount → 400 here.
        capType: z.enum(["perpetual", "per_pair_capped"]).optional(),
        capCount: z.number().int().min(1).max(100).optional(),
      })
      .superRefine((val, ctx) => {
        if (val.capType === "per_pair_capped") {
          if (typeof val.capCount !== "number" || val.capCount < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["capCount"],
              message:
                "capCount is required and must be at least 1 when capType is 'per_pair_capped'",
            });
          }
        }
      });

    const updates = schema.parse(req.body);

    // Validate total percentage if levels are being updated
    if (updates.levels) {
      const totalPercentage = updates.levels.reduce((sum, l) => sum + l.percentage, 0);
      if (totalPercentage > 95) {
        return res.status(400).json({
          success: false,
          error: "Total commission percentage cannot exceed 95% (platform takes 5%)",
        });
      }
    }

    const plan = await updateCombPlan(id, updates);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Comb plan not found",
      });
    }

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Error updating comb plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update comb plan",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /comb-plans/:id
 * Delete a comb plan (soft delete if commissions exist)
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await deleteCombPlan(id);

    res.json({
      success: true,
      message: "Comb plan deleted",
    });
  } catch (error) {
    console.error("Error deleting comb plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete comb plan",
      details: (error as Error).message,
    });
  }
});

// ============= Commission History =============

/**
 * GET /comb-plans/commissions/history
 * Get commission history for the current user
 */
router.get("/commissions/history", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    const schema = z.object({
      role: z.enum(["seller", "referrer"]).optional().default("seller"),
      itemType: z.enum(["course", "product", "channel", "workshop", "service"]).optional(),
      startDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      endDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 50)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const options = schema.parse(req.query);

    const result = await getCommissionHistory(me.userId, {
      ...options,
      orgId: me.orgId,
    });

    res.json({
      success: true,
      distributions: result.distributions,
      total: result.total,
      summary: result.summary,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error) {
    console.error("Error getting commission history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get commission history",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /comb-plans/commissions/stats/:itemType/:itemId
 * Get commission stats for a specific item
 */
router.get("/commissions/stats/:itemType/:itemId", requireAuth, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;

    if (!["course", "product", "channel", "workshop", "service", "call", "event"].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid item type",
      });
    }

    const stats = await getItemCommissionStats(
      itemType as "course" | "product" | "channel" | "workshop" | "service" | "call" | "event",
      itemId
    );

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting commission stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get commission stats",
      details: (error as Error).message,
    });
  }
});

export default router;
