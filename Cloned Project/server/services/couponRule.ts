import { Types } from "mongoose";
import {
  CouponRule,
  ICouponRule,
  CouponRuleProductType,
  CouponRuleRecurrence,
  CouponRuleScope,
} from "../models/couponRule.model";
import { CouponRuleProgress } from "../models/couponRuleProgress.model";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { Channel } from "../models/channel.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Product } from "../models/product.model";
import { Service } from "../models/service.model";
import { CallOffering } from "../models/callOffering.model";
import { OfficePlan } from "../models/officePlan.model";
import { UnilevelPlusPlan } from "../models/unilevelPlusPlan.model";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";
import { assignCoupon } from "./couponAssignment";
import { IInvoice } from "../models/invoice.model";

// =====================================================================
// Helpers
// =====================================================================

/**
 * Look up an item by `(productType, itemId)`. For org-scoped product types
 * (channel/course/etc.), `orgId` is required and the lookup is constrained to
 * that org. For platform-scoped types (office_plan/unilevel_plus/
 * third_party_subscription), `orgId` is ignored.
 *
 * When `itemId` is omitted, returns a synthetic "wildcard" entry — the rule
 * will fire on any purchase of `productType`. Recurrence is derived per type:
 *   office_plan / third_party_subscription → recurring (qty locked to 1)
 *   unilevel_plus                          → one-time (qty editable)
 *   org-scope types                        → wildcards not supported (false)
 *
 * Returns `{ found, isRecurring, title }`.
 */
async function resolveItem(
  productType: CouponRuleProductType,
  itemId?: string,
  orgId?: string
): Promise<{ found: boolean; isRecurring: boolean; title?: string }> {
  // Wildcard mode (no specific item): only third_party_subscription is
  // allowed. Office plans and unilevel plus always require picking a specific
  // record. Org-scope types (channel/course/etc.) never allow wildcards.
  if (!itemId) {
    if (productType === "third_party_subscription") {
      return {
        found: true,
        isRecurring: true,
        title: "Third-Party Subscription",
      };
    }
    return { found: false, isRecurring: false };
  }

  const itemObjId = new Types.ObjectId(itemId);
  const orgObjId = orgId ? new Types.ObjectId(orgId) : undefined;
  switch (productType) {
    case "channel": {
      if (!orgObjId) return { found: false, isRecurring: false };
      const c = await Channel.findOne({ _id: itemObjId, storeId: orgObjId })
        .select("isSubscription title")
        .lean();
      return c
        ? { found: true, isRecurring: !!c.isSubscription, title: (c as any).title }
        : { found: false, isRecurring: false };
    }
    case "course": {
      if (!orgObjId) return { found: false, isRecurring: false };
      const c = await Course.findOne({ _id: itemObjId, organizationId: orgObjId })
        .select("isSubscription title")
        .lean();
      return c
        ? { found: true, isRecurring: !!(c as any).isSubscription, title: (c as any).title }
        : { found: false, isRecurring: false };
    }
    case "workshop": {
      if (!orgObjId) return { found: false, isRecurring: false };
      const w = await Workshop.findOne({ _id: itemObjId, orgId: orgObjId })
        .select("isSubscription title")
        .lean();
      return w
        ? { found: true, isRecurring: !!w.isSubscription, title: (w as any).title }
        : { found: false, isRecurring: false };
    }
    case "product": {
      if (!orgObjId) return { found: false, isRecurring: false };
      const p = await Product.findOne({ _id: itemObjId, organizationId: orgObjId })
        .select("isSubscription name")
        .lean();
      return p
        ? { found: true, isRecurring: !!(p as any).isSubscription, title: (p as any).name }
        : { found: false, isRecurring: false };
    }
    case "service": {
      if (!orgObjId) return { found: false, isRecurring: false };
      const s = await Service.findOne({ _id: itemObjId, organizationId: orgObjId })
        .select("title")
        .lean();
      return s
        ? { found: true, isRecurring: false, title: (s as any).title }
        : { found: false, isRecurring: false };
    }
    case "call": {
      if (!orgObjId) return { found: false, isRecurring: false };
      const c = await CallOffering.findOne({
        _id: itemObjId,
        organizationId: orgObjId,
      })
        .select("title")
        .lean();
      return c
        ? { found: true, isRecurring: false, title: (c as any).title }
        : { found: false, isRecurring: false };
    }
    // ========== Platform-scope types (admin rules) ==========
    case "office_plan": {
      const p = await OfficePlan.findById(itemObjId).select("name").lean();
      return p
        ? { found: true, isRecurring: true, title: (p as any).name }
        : { found: false, isRecurring: false };
    }
    case "unilevel_plus": {
      const p = await UnilevelPlusPlan.findById(itemObjId).select("name").lean();
      return p
        ? { found: true, isRecurring: false, title: (p as any).name }
        : { found: false, isRecurring: false };
    }
    case "third_party_subscription": {
      const c = await ThirdPartyClient.findById(itemObjId)
        .select("name productConfig")
        .lean();
      return c
        ? {
            found: true,
            isRecurring: true,
            title: `${(c as any).name} — ${(c as any).productConfig?.productCode || "subscription"}`,
          }
        : { found: false, isRecurring: false };
    }
    default:
      return { found: false, isRecurring: false };
  }
}

// =====================================================================
// CRUD
// =====================================================================

export interface CreateCouponRuleInput {
  /** "organization" → orgId required. "platform" → admin rule, no org. */
  scope: CouponRuleScope;
  /** Required when scope === "organization". */
  orgId?: string;
  name?: string;
  triggerProductType: CouponRuleProductType;
  /** Omit for a wildcard rule that fires on any item of `triggerProductType`. */
  triggerItemId?: string;
  triggerQuantity?: number;
  rewardCouponId: string;
  rewardQuantity?: number;
  recurrence?: CouponRuleRecurrence;
  createdBy: string;
}

export async function createCouponRule(
  input: CreateCouponRuleInput
): Promise<ICouponRule> {
  if (input.scope === "organization" && !input.orgId) {
    throw new Error("orgId required for organization-scope rules");
  }

  const isWildcard = !input.triggerItemId;

  // Wildcards are only allowed at platform scope (admin types). Org-scope
  // rules must always specify a concrete item the founder owns.
  if (isWildcard && input.scope === "organization") {
    throw new Error(
      "Org-scope rules must specify a triggerItemId (no wildcard for founder rules)"
    );
  }

  // Validate trigger item exists (scope-aware). Wildcards bypass DB lookup.
  const item = await resolveItem(
    input.triggerProductType,
    input.triggerItemId,
    input.scope === "organization" ? input.orgId : undefined
  );
  if (!item.found) {
    throw new Error(
      input.scope === "organization"
        ? "Trigger item not found in this organization"
        : "Trigger item not found"
    );
  }
  // Recurring items can only fire on first purchase — qty must be 1
  const triggerQuantity = item.isRecurring
    ? 1
    : Math.max(1, input.triggerQuantity ?? 1);

  // Validate reward coupon scope matches rule scope:
  //   organization rule → reward coupon must belong to that org
  //   platform rule     → reward coupon must be platform-scope
  const coupon = await PlatformCoupon.findById(input.rewardCouponId).lean();
  if (!coupon) throw new Error("Reward coupon not found");
  if (input.scope === "organization") {
    const couponOrgId = coupon.orgId?.toString();
    if (couponOrgId !== input.orgId) {
      throw new Error("Reward coupon must belong to your organization");
    }
  } else {
    if ((coupon as any).scope !== "platform") {
      throw new Error("Reward coupon must be a platform-scope coupon");
    }
  }

  // Auto-name if not provided
  const rewardQuantity = Math.max(1, input.rewardQuantity ?? 1);
  const recurrence: CouponRuleRecurrence = input.recurrence ?? "once";
  const autoName =
    input.name?.trim() ||
    `Buy ${triggerQuantity} ${item.title || "item"} → ${rewardQuantity} × ${coupon.code}`;

  const rule = await CouponRule.create({
    scope: input.scope,
    orgId:
      input.scope === "organization" && input.orgId
        ? new Types.ObjectId(input.orgId)
        : undefined,
    name: autoName.slice(0, 100),
    type: "purchase_based",
    triggerProductType: input.triggerProductType,
    triggerItemId: input.triggerItemId
      ? new Types.ObjectId(input.triggerItemId)
      : undefined,
    triggerQuantity,
    rewardCouponId: new Types.ObjectId(input.rewardCouponId),
    rewardQuantity,
    recurrence,
    isActive: true,
    effectiveFrom: new Date(),
    createdBy: new Types.ObjectId(input.createdBy),
  });
  return rule;
}

/**
 * List rules. When `orgId` is provided, returns rules for that org; otherwise
 * returns platform-scope rules (admin view).
 */
export async function listCouponRules(
  orgId: string | null
): Promise<ICouponRule[]> {
  const query =
    orgId !== null
      ? { orgId: new Types.ObjectId(orgId) }
      : { scope: "platform" };
  return CouponRule.find(query)
    .sort({ createdAt: -1 })
    .lean() as unknown as ICouponRule[];
}

export async function getCouponRule(
  id: string,
  orgId: string | null
): Promise<ICouponRule | null> {
  const query: any = { _id: new Types.ObjectId(id) };
  if (orgId !== null) {
    query.orgId = new Types.ObjectId(orgId);
  } else {
    query.scope = "platform";
  }
  return CouponRule.findOne(query);
}

export interface UpdateCouponRuleInput {
  name?: string;
  isActive?: boolean;
  recurrence?: CouponRuleRecurrence;
  triggerQuantity?: number;
  rewardQuantity?: number;
}

export async function updateCouponRule(
  id: string,
  orgId: string | null,
  patch: UpdateCouponRuleInput
): Promise<ICouponRule | null> {
  const query: any = { _id: new Types.ObjectId(id) };
  if (orgId !== null) {
    query.orgId = new Types.ObjectId(orgId);
  } else {
    query.scope = "platform";
  }
  const rule = await CouponRule.findOne(query);
  if (!rule) return null;

  // Lock structural fields once any progress exists (avoid corrupting users
  // mid-cycle). Always allow toggling active/recurrence/name.
  const hasProgress = await CouponRuleProgress.exists({ ruleId: rule._id });

  if (patch.name !== undefined) rule.name = patch.name.slice(0, 100);
  if (patch.isActive !== undefined) rule.isActive = patch.isActive;
  if (patch.recurrence !== undefined) rule.recurrence = patch.recurrence;

  if (!hasProgress) {
    if (patch.triggerQuantity !== undefined) {
      rule.triggerQuantity = Math.max(1, patch.triggerQuantity);
    }
    if (patch.rewardQuantity !== undefined) {
      rule.rewardQuantity = Math.max(1, patch.rewardQuantity);
    }
  }

  await rule.save();
  return rule;
}

export async function deleteCouponRule(
  id: string,
  orgId: string | null
): Promise<boolean> {
  const query: any = { _id: new Types.ObjectId(id) };
  if (orgId !== null) {
    query.orgId = new Types.ObjectId(orgId);
  } else {
    query.scope = "platform";
  }
  const rule = await CouponRule.findOneAndDelete(query);
  if (!rule) return false;
  // Clean up progress rows so a future identically-keyed rule starts fresh.
  await CouponRuleProgress.deleteMany({ ruleId: rule._id });
  return true;
}

// =====================================================================
// Evaluator — invoked after invoice fulfillment
// =====================================================================

/**
 * For each line item in the freshly-paid invoice, find active rules whose
 * trigger matches that item, increment the user's progress, and grant new
 * rule fires when thresholds are crossed.
 *
 * MUST never throw to its caller (caller wraps in try/catch but we also
 * isolate per-line-item failures here).
 */
export async function evaluateRulesForInvoice(invoice: IInvoice): Promise<void> {
  if (invoice.status !== "paid") return;

  // For recurring subscriptions, only the parent (first cycle) counts toward
  // a rule. Renewals don't re-fire.
  const isChildCycle =
    invoice.isRecurring && (invoice.recurringPaymentNumber ?? 1) > 1;

  if (!Array.isArray(invoice.lineItems) || invoice.lineItems.length === 0) {
    return;
  }

  const userId = invoice.userId?.toString();
  const orgId = invoice.organizationId?.toString();
  const paidAt = invoice.paidAt ?? new Date();
  if (!userId || !orgId) return;

  for (const li of invoice.lineItems) {
    try {
      if (!li.itemId) continue;

      // Match rules where ALL of:
      //   - scope matches: org rule for this invoice's org, OR platform rule
      //   - target matches: specific triggerItemId, OR wildcard
      //     (no triggerItemId + matching triggerProductType)
      //   - rule is active and was created before this invoice was paid
      const rules = await CouponRule.find({
        $and: [
          {
            $or: [
              { orgId: new Types.ObjectId(orgId) },
              { scope: "platform" },
            ],
          },
          {
            $or: [
              { triggerItemId: li.itemId },
              {
                $and: [
                  { triggerItemId: { $in: [null, undefined] } },
                  { triggerProductType: li.itemType },
                ],
              },
            ],
          },
        ],
        isActive: true,
        effectiveFrom: { $lt: paidAt },
      }).lean();
      if (!rules.length) continue;

      for (const rule of rules) {
        try {
          // For org-scope rules, resolve item against the rule's org. For
          // platform-scope rules, no org constraint. Wildcard rules pass
          // undefined itemId → resolveItem returns synthetic info.
          const isPlatform = (rule as any).scope === "platform";
          const item = await resolveItem(
            rule.triggerProductType,
            rule.triggerItemId ? rule.triggerItemId.toString() : undefined,
            isPlatform ? undefined : (rule.orgId?.toString() || orgId)
          );
          // For recurring items, skip child cycle invoices entirely.
          if (item.isRecurring && isChildCycle) continue;

          const increment = item.isRecurring
            ? 1
            : Math.max(1, li.quantity ?? 1);

          // Atomic progress upsert + increment
          const progress = await CouponRuleProgress.findOneAndUpdate(
            {
              userId: new Types.ObjectId(userId),
              ruleId: rule._id,
            },
            { $inc: { purchaseCount: increment } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          // Compute fires
          const triggerQty = Math.max(1, rule.triggerQuantity);
          let targetFires = Math.floor(progress.purchaseCount / triggerQty);
          if (rule.recurrence === "once") targetFires = Math.min(1, targetFires);
          const newFires = Math.max(0, targetFires - (progress.firedTimes || 0));
          if (newFires === 0) continue;

          // Grant `newFires × rewardQuantity` uses (sum into one assignment
          // via mergeAvailableUses).
          const usesToGrant = newFires * Math.max(1, rule.rewardQuantity);

          await assignCoupon({
            userId,
            couponId: rule.rewardCouponId.toString(),
            couponSource: "platform",
            assignedBy: rule.createdBy.toString(),
            // Platform rules attribute the gift to the garage admin who
            // created the rule. Org rules attribute it to the founder.
            assignedByType: isPlatform ? "garage_admin" : "founder",
            assignerOrgId: isPlatform ? undefined : (rule.orgId?.toString() || orgId),
            availableUses: usesToGrant,
            mergeAvailableUses: true,
            reason: `Earned by purchase rule: ${rule.name}`,
          });

          // Update fired counter
          progress.firedTimes = (progress.firedTimes || 0) + newFires;
          progress.lastFiredAt = new Date();
          await progress.save();
        } catch (innerErr) {
          console.error(
            `[couponRule] evaluator failed for rule ${rule._id}:`,
            innerErr
          );
        }
      }
    } catch (lineErr) {
      console.error("[couponRule] line-item evaluation failed:", lineErr);
    }
  }
}
