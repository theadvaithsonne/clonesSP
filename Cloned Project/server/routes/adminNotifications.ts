// Admin notification rules — CRUD + the event catalogue that drives the
// condition builder.
//
// Delivery is NOT here. Nothing in this file sends mail: it stores rules and
// serves the registry. Evaluation and sending land in a later phase, which is
// why every rule is created disabled — the surface can be built and reviewed
// without a single real email going out.
//
// See docs/superpowers/specs/2026-09-11-admin-notification-rules-design.md.
import { Router, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { AdminNotificationRule } from "../models/adminNotificationRule.model";
import { User } from "../models/user.model";
import {
  ADMIN_EVENTS,
  ADMIN_EVENT_NAMES,
  OPERATORS_BY_TYPE,
} from "../config/adminNotificationEvents";

const router = Router();

/**
 * Condition tree validator.
 *
 * Recursive, so it needs the explicit type annotation zod requires for
 * `z.lazy`. Depth is capped by the JSON body limit rather than a counter —
 * a deeply nested tree is a UI bug, not an attack, and the evaluator is
 * pure so it cannot hang on one.
 */
type ConditionInput =
  | { all: ConditionInput[] }
  | { any: ConditionInput[] }
  | { not: ConditionInput }
  | { field: string; op: string; value?: unknown };

const conditionSchema: z.ZodType<ConditionInput> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(conditionSchema) }),
    z.object({ any: z.array(conditionSchema) }),
    z.object({ not: conditionSchema }),
    z.object({
      field: z.string().min(1).max(60),
      op: z.string().min(1).max(40),
      value: z.unknown().optional(),
    }),
  ]),
);

const recipientSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("static"),
    emails: z.array(z.string().email()).min(1).max(50),
  }),
  z.object({
    type: z.literal("relation"),
    relation: z.enum(["sponsor", "upline", "officeOwner", "subject"]),
  }),
  z.object({ type: z.literal("role"), role: z.string().min(1).max(60) }),
  z.object({
    type: z.literal("query"),
    filter: z.record(z.string(), z.unknown()),
    // Required, not defaulted: a query rule without a deliberate ceiling is
    // the one shape here that can mail thousands of people by accident.
    cap: z.number().int().min(1).max(5000),
  }),
]);

const ruleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  event: z.string().refine((v) => ADMIN_EVENT_NAMES.includes(v), {
    message: "Unknown event",
  }),
  conditions: conditionSchema.optional(),
  recipients: z.array(recipientSchema).max(20).optional(),
  templateId: z.string().max(200).optional(),
  templateName: z.string().max(200).optional(),
  templateHtml: z.string().optional(),
  throttlePerHour: z.number().int().min(1).max(10000).optional(),
  recipientCap: z.number().int().min(1).max(5000).optional(),
});

/** Enabling is separated from editing so the UI toggle cannot resubmit a
 *  half-edited rule, and so "turn everything off" is one cheap call. */
const patchSchema = ruleSchema.partial().extend({
  enabled: z.boolean().optional(),
});

// ── GET /garage-admin/notifications/events ────────────────────────────────
// The catalogue. The builder renders entirely from this, so a new event
// appears in the UI with no frontend change.
router.get("/events", requireGarageAdminAuth, (_req: GarageAdminRequest, res: Response) => {
  res.json({ success: true, events: ADMIN_EVENTS, operators: OPERATORS_BY_TYPE });
});

// ── GET /garage-admin/notifications/rules ─────────────────────────────────
router.get("/rules", requireGarageAdminAuth, async (_req: GarageAdminRequest, res: Response) => {
  try {
    const rules = await AdminNotificationRule.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, rules });
  } catch (err) {
    console.error("[AdminNotifications] list failed:", err);
    res.status(500).json({ success: false, error: "Failed to load rules" });
  }
});

// ── POST /garage-admin/notifications/rules ────────────────────────────────
router.post("/rules", requireGarageAdminAuth, async (req: GarageAdminRequest, res: Response) => {
  try {
    const body = ruleSchema.parse(req.body);
    const rule = await AdminNotificationRule.create({
      ...body,
      // Never honoured from the request. A rule that could be born enabled
      // would send before anyone had a chance to dry-run it.
      enabled: false,
      createdBy: req.garageAdmin?.id,
    });
    res.json({ success: true, rule });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid rule", issues: err.issues });
    }
    console.error("[AdminNotifications] create failed:", err);
    res.status(500).json({ success: false, error: "Failed to create rule" });
  }
});

// ── PATCH /garage-admin/notifications/rules/:id ───────────────────────────
router.patch("/rules/:id", requireGarageAdminAuth, async (req: GarageAdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid rule id" });
    }
    const body = patchSchema.parse(req.body);

    // Turning a rule ON is the moment it becomes capable of mailing people, so
    // it is the one transition worth refusing when the rule is incomplete.
    if (body.enabled === true) {
      const current = await AdminNotificationRule.findById(id).lean();
      if (!current) return res.status(404).json({ success: false, error: "Rule not found" });
      const recipients = body.recipients ?? current.recipients ?? [];
      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Add at least one recipient before enabling this rule",
        });
      }
    }

    const rule = await AdminNotificationRule.findByIdAndUpdate(id, { $set: body }, { new: true });
    if (!rule) return res.status(404).json({ success: false, error: "Rule not found" });

    if (body.enabled !== undefined) {
      console.warn(
        `[AdminNotifications] rule ${id} ${body.enabled ? "ENABLED" : "disabled"} by ${req.garageAdmin?.email}`,
      );
    }
    res.json({ success: true, rule });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid rule", issues: err.issues });
    }
    console.error("[AdminNotifications] update failed:", err);
    res.status(500).json({ success: false, error: "Failed to update rule" });
  }
});

// ── DELETE /garage-admin/notifications/rules/:id ──────────────────────────
router.delete("/rules/:id", requireGarageAdminAuth, async (req: GarageAdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid rule id" });
    }
    const rule = await AdminNotificationRule.findByIdAndDelete(id);
    if (!rule) return res.status(404).json({ success: false, error: "Rule not found" });
    console.warn(`[AdminNotifications] rule ${id} deleted by ${req.garageAdmin?.email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("[AdminNotifications] delete failed:", err);
    res.status(500).json({ success: false, error: "Failed to delete rule" });
  }
});

// ── GET /garage-admin/notifications/resolve-user?email= ───────────────────
// The builder accepts an email for downline operators but stores a user id,
// so a later email change cannot silently break a rule. This is that lookup.
router.get("/resolve-user", requireGarageAdminAuth, async (req: GarageAdminRequest, res: Response) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, error: "email is required" });
    const user = await User.findOne({ email })
      .select("_id name email profilePicture downlineCount")
      .lean<any>();
    if (!user) return res.status(404).json({ success: false, error: "No user with that email" });
    res.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name ?? null,
        email: user.email ?? null,
        profilePicture: user.profilePicture ?? null,
        downlineCount: user.downlineCount ?? 0,
      },
    });
  } catch (err) {
    console.error("[AdminNotifications] resolve-user failed:", err);
    res.status(500).json({ success: false, error: "Lookup failed" });
  }
});

export default router;
