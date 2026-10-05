import { Types } from "mongoose";
import {
  StoreCouponCommission,
  IStoreCouponCommission,
  MAX_STORE_COMMISSION_LEVELS,
} from "../models/storeCouponCommission.model";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { StoreProduct } from "../models/storeProduct.model";
import { User } from "../models/user.model";
import { Invoice, IInvoice } from "../models/invoice.model";
import { StoreCouponCommissionFire } from "../models/storeCouponCommissionFire.model";
import { assignCoupon } from "./couponAssignment";

// ─── Input shapes ─────────────────────────────────────────────────

export interface StoreCommissionLevelInput {
  level: number;
  couponId: string;
  quantity?: number;
}

export interface CreateStoreCommissionInput {
  orgId: string;
  name: string;
  triggerItemId?: string | null;
  levels: StoreCommissionLevelInput[];
  createdBy: string;
  // Distribution cap — see storeCouponCommission.model.ts. Optional so
  // every legacy call defaults to "perpetual".
  capType?: "perpetual" | "per_pair_capped";
  capCount?: number;
}

export interface UpdateStoreCommissionInput {
  name?: string;
  triggerItemId?: string | null;
  levels?: StoreCommissionLevelInput[];
  isActive?: boolean;
  capType?: "perpetual" | "per_pair_capped";
  capCount?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * True when a PlatformCoupon is "unlimited" — safe to hand out to
 * many uplines across many sales. Both usage caps must be unset.
 * Zero is treated as "unset" too, defensively.
 */
export function isUnlimitedCoupon(c: {
  maxUsageCount?: number | null;
  maxUsagePerUser?: number | null;
}): boolean {
  const total = c.maxUsageCount ?? 0;
  const perUser = c.maxUsagePerUser ?? 0;
  return total === 0 && perUser === 0;
}

async function validateLevels(
  orgId: string,
  levels: StoreCommissionLevelInput[],
): Promise<{ level: number; couponId: Types.ObjectId; quantity: number }[]> {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error("At least one level is required");
  }
  if (levels.length > MAX_STORE_COMMISSION_LEVELS) {
    throw new Error(`At most ${MAX_STORE_COMMISSION_LEVELS} levels supported`);
  }

  // Contiguous 1..N with no duplicates.
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].level !== i + 1) {
      throw new Error(
        `Levels must be contiguous 1..N (got ${sorted.map((l) => l.level).join(",")})`,
      );
    }
  }

  // Every couponId must exist, belong to this org, and be "unlimited".
  const couponIds = sorted.map((l) => new Types.ObjectId(l.couponId));
  const coupons = await PlatformCoupon.find({
    _id: { $in: couponIds },
    orgId: new Types.ObjectId(orgId),
  })
    .select("_id maxUsageCount maxUsagePerUser status")
    .lean<any[]>();
  const byId = new Map(coupons.map((c) => [String(c._id), c]));

  for (const lvl of sorted) {
    const c = byId.get(String(lvl.couponId));
    if (!c) {
      throw new Error(
        `Coupon ${lvl.couponId} not found on org ${orgId} (level ${lvl.level})`,
      );
    }
    if (!isUnlimitedCoupon(c)) {
      throw new Error(
        `Coupon at level ${lvl.level} has usage caps; only unlimited coupons can be used in a cascade`,
      );
    }
  }

  return sorted.map((l) => ({
    level: l.level,
    couponId: new Types.ObjectId(l.couponId),
    quantity: Math.max(1, l.quantity ?? 1),
  }));
}

// ─── CRUD ─────────────────────────────────────────────────────────

export async function createStoreCommission(
  input: CreateStoreCommissionInput,
): Promise<IStoreCouponCommission> {
  if (!input.name || !input.name.trim()) {
    throw new Error("name is required");
  }
  if (input.triggerItemId) {
    const p = await StoreProduct.findOne({
      _id: new Types.ObjectId(input.triggerItemId),
      orgId: new Types.ObjectId(input.orgId),
    })
      .select("_id")
      .lean();
    if (!p) {
      throw new Error(
        `StoreProduct ${input.triggerItemId} not found on this org`,
      );
    }
  }
  const levels = await validateLevels(input.orgId, input.levels);
  const now = new Date();
  return StoreCouponCommission.create({
    orgId: new Types.ObjectId(input.orgId),
    name: input.name.trim(),
    triggerItemId: input.triggerItemId
      ? new Types.ObjectId(input.triggerItemId)
      : undefined,
    levels,
    isActive: true,
    effectiveFrom: now,
    createdBy: new Types.ObjectId(input.createdBy),
    ...(input.capType ? { capType: input.capType } : {}),
    ...(input.capCount !== undefined ? { capCount: input.capCount } : {}),
  });
}

export async function listStoreCommissions(
  orgId: string,
): Promise<IStoreCouponCommission[]> {
  return StoreCouponCommission.find({
    orgId: new Types.ObjectId(orgId),
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function getStoreCommission(
  id: string,
  orgId: string,
): Promise<IStoreCouponCommission | null> {
  return StoreCouponCommission.findOne({
    _id: new Types.ObjectId(id),
    orgId: new Types.ObjectId(orgId),
  }).lean();
}

export async function updateStoreCommission(
  id: string,
  orgId: string,
  input: UpdateStoreCommissionInput,
): Promise<IStoreCouponCommission | null> {
  const existing = await StoreCouponCommission.findOne({
    _id: new Types.ObjectId(id),
    orgId: new Types.ObjectId(orgId),
  });
  if (!existing) return null;

  if (input.name !== undefined) {
    const n = String(input.name).trim();
    if (!n) throw new Error("name cannot be empty");
    existing.name = n;
  }
  if (input.triggerItemId !== undefined) {
    if (input.triggerItemId === null) {
      existing.triggerItemId = undefined as any;
    } else {
      const p = await StoreProduct.findOne({
        _id: new Types.ObjectId(input.triggerItemId),
        orgId: new Types.ObjectId(orgId),
      })
        .select("_id")
        .lean();
      if (!p) {
        throw new Error(
          `StoreProduct ${input.triggerItemId} not found on this org`,
        );
      }
      existing.triggerItemId = new Types.ObjectId(input.triggerItemId);
    }
  }
  if (input.levels !== undefined) {
    existing.levels = (await validateLevels(orgId, input.levels)) as any;
  }
  if (input.isActive !== undefined) {
    existing.isActive = !!input.isActive;
  }
  if (input.capType !== undefined) existing.capType = input.capType;
  if (input.capCount !== undefined) existing.capCount = input.capCount;
  await existing.save();
  return existing.toObject();
}

export async function deleteStoreCommission(
  id: string,
  orgId: string,
): Promise<boolean> {
  const res = await StoreCouponCommission.deleteOne({
    _id: new Types.ObjectId(id),
    orgId: new Types.ObjectId(orgId),
  });
  return (res.deletedCount || 0) > 0;
}

// ─── Picker helpers ───────────────────────────────────────────────

/**
 * The picker in the founder editor. Returns this org's PlatformCoupons
 * that are "unlimited" — both usage caps unset — sorted by newest
 * first. Used by the FE to render the level-row coupon dropdown; when
 * this returns [], the FE renders the "create an unlimited coupon
 * first" empty state.
 */
export async function listAvailableUnlimitedCoupons(orgId: string) {
  const rows = await PlatformCoupon.find({
    orgId: new Types.ObjectId(orgId),
    status: "active",
    $and: [
      { $or: [{ maxUsageCount: { $exists: false } }, { maxUsageCount: 0 }] },
      { $or: [{ maxUsagePerUser: { $exists: false } }, { maxUsagePerUser: 0 }] },
    ],
  })
    .select("_id code name discountType discountValue currency productType")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean<any[]>();
  return rows.map((c) => ({
    _id: String(c._id),
    code: c.code,
    name: c.name,
    discountType: c.discountType,
    discountValue: c.discountValue,
    currency: c.currency,
    productType: c.productType,
  }));
}

/**
 * Trigger picker: the org's active store products. FE renders these
 * as the "Trigger item" dropdown alongside the "Any store product"
 * wildcard option.
 */
export async function listOrgStoreProducts(orgId: string) {
  const rows = await StoreProduct.find({
    orgId: new Types.ObjectId(orgId),
    status: "active",
  })
    .select("_id title price currency images")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean<any[]>();
  return rows.map((p: any) => ({
    _id: String(p._id),
    title: p.title,
    price: p.price,
    currency: p.currency,
    image: p.images?.[0]?.url || null,
  }));
}

// ─── Evaluator (fires from fulfillInvoice) ────────────────────────

const FIRED_MARKER = "storeCommissionsFiredAt";

/**
 * Fires cascading coupon grants on a newly-paid `ecommerce_item`
 * invoice. Idempotent via `invoice.metadata.storeCommissionsFiredAt`
 * — a re-fulfill is a no-op. Never throws into fulfillInvoice.
 */
export async function evaluateStoreCommissionsForInvoice(
  invoice: IInvoice,
): Promise<void> {
  try {
    if (invoice.status !== "paid") return;

    // Idempotency guard — re-fulfill must not re-grant.
    const meta = (invoice.metadata as any) || {};
    if (meta[FIRED_MARKER]) return;

    if (!Array.isArray(invoice.lineItems) || invoice.lineItems.length === 0) {
      return;
    }
    const orgId = invoice.organizationId?.toString();
    const userId = invoice.userId?.toString();
    const paidAt = invoice.paidAt ?? new Date();
    if (!orgId || !userId) return;

    // Filter to store items only. Everything else is out of scope.
    const storeItems = invoice.lineItems.filter(
      // Counter-bill amount/charge lines aren't products — a store-wide rule
      // would otherwise fire once per service charge or packaging line.
      (li: any) => li.itemType === "ecommerce_item" && li.itemId && !li.lineKind,
    );
    if (storeItems.length === 0) return;

    // Buyer's upline chain. ancestors[] is stored root→direct-referrer
    // (see backfill-downline-tree.ts line 83 / downlineTree.ts line
    // 37: `[...parent.ancestors, parentId]`). Reverse so upline[0] is
    // the direct referrer (= L1).
    const buyer: any = await User.findById(userId).select("ancestors").lean();
    const ancestors = ((buyer?.ancestors || []) as Types.ObjectId[])
      .map((a) => (a instanceof Types.ObjectId ? a : new Types.ObjectId(String(a))));
    if (ancestors.length === 0) return; // orphaned buyer — nobody to reward
    const upline = [...ancestors].reverse(); // L1 = upline[0]

    let anyGranted = false;
    for (const li of storeItems as any[]) {
      // Match: exact item OR wildcard on this org.
      const rules = await StoreCouponCommission.find({
        orgId: new Types.ObjectId(orgId),
        isActive: true,
        effectiveFrom: { $lt: paidAt },
        $or: [
          { triggerItemId: li.itemId },
          { triggerItemId: { $in: [null, undefined] } },
        ],
      }).lean<any[]>();
      if (rules.length === 0) continue;

      for (const rule of rules) {
        // Per-(affiliate, customer) N-time cap — see
        // storeCouponCommission.model.ts::StoreCouponCommissionCapType.
        // Legacy rules with no capType read as `undefined` (Mongoose
        // does NOT backfill defaults on read for existing docs), so
        // the strict === "per_pair_capped" check treats them as
        // perpetual and skips both the count query and the fire-row
        // insert — zero-cost regression.
        const isCapped =
          rule.capType === "per_pair_capped" &&
          typeof rule.capCount === "number" &&
          rule.capCount >= 1;

        for (const lvl of rule.levels as any[]) {
          const recipient = upline[lvl.level - 1];
          if (!recipient) continue; // short-chain: silently skip

          // Re-check the coupon is still unlimited — a founder may
          // have capped it since the rule was created. Skip with warn
          // rather than corrupt-grant.
          const coupon: any = await PlatformCoupon.findById(lvl.couponId)
            .select("_id maxUsageCount maxUsagePerUser status")
            .lean();
          if (!coupon) {
            console.warn(
              `[storeCommission] rule ${rule._id} L${lvl.level}: coupon ${lvl.couponId} not found — skipping`,
            );
            continue;
          }
          if (coupon.status !== "active") {
            console.warn(
              `[storeCommission] rule ${rule._id} L${lvl.level}: coupon ${lvl.couponId} is ${coupon.status} — skipping`,
            );
            continue;
          }
          if (!isUnlimitedCoupon(coupon)) {
            console.warn(
              `[storeCommission] rule ${rule._id} L${lvl.level}: coupon ${lvl.couponId} has usage caps — skipping to avoid corrupt-grant`,
            );
            continue;
          }

          // Cap gate — how many fires has this (recipient, buyer)
          // pair already earned under this rule? Silently skip this
          // level's grant when they've hit the cap. Other levels /
          // other buyers are unaffected.
          if (isCapped) {
            const alreadyFired =
              await StoreCouponCommissionFire.countDocuments({
                ruleId: rule._id,
                recipientId: recipient,
                buyerId: new Types.ObjectId(userId),
              });
            if (alreadyFired >= (rule.capCount || 0)) {
              continue;
            }
          }

          try {
            await assignCoupon({
              userId: String(recipient),
              couponId: String(lvl.couponId),
              couponSource: "platform",
              assignedBy: String(rule.createdBy),
              assignedByType: "founder",
              assignerOrgId: String(rule.orgId),
              availableUses: Math.max(1, lvl.quantity ?? 1),
              mergeAvailableUses: true,
              reason: `Store commission (L${lvl.level}): ${rule.name}`,
            });
            anyGranted = true;

            // Record the fire ONLY for capped rules — perpetual rules
            // never read the counter, so keeping the collection lean
            // by skipping this insert is a real perf win at scale.
            // E11000 on the unique {ruleId, invoiceId, recipientId}
            // index means this fire already recorded (race / retry) —
            // treat as success; assignCoupon itself is idempotent.
            if (isCapped) {
              try {
                await StoreCouponCommissionFire.create({
                  ruleId: rule._id,
                  orgId: rule.orgId,
                  level: lvl.level,
                  recipientId: recipient,
                  buyerId: new Types.ObjectId(userId),
                  invoiceId: invoice._id,
                  couponId: lvl.couponId,
                  quantity: Math.max(1, lvl.quantity ?? 1),
                });
              } catch (fireErr: any) {
                if (fireErr?.code !== 11000) {
                  console.error(
                    `[storeCommission] fire-row insert failed rule=${rule._id} L${lvl.level}:`,
                    fireErr,
                  );
                  // Don't rethrow — grant already landed, and the
                  // outer FIRED_MARKER will prevent double-fire on
                  // retry so cap-count integrity is preserved.
                }
              }
            }
          } catch (err) {
            console.error(
              `[storeCommission] assignCoupon L${lvl.level} to ${recipient} failed:`,
              err,
            );
            // Continue — one failed grant doesn't kill the cascade.
          }
        }
      }
    }

    // Mark fired so a re-fulfill can't re-grant.
    if (anyGranted) {
      await Invoice.updateOne(
        { _id: invoice._id },
        { $set: { [`metadata.${FIRED_MARKER}`]: new Date().toISOString() } },
      );
    }
  } catch (err) {
    console.error("[storeCommission] evaluator failed:", err);
    // Never throw into fulfillInvoice.
  }
}
