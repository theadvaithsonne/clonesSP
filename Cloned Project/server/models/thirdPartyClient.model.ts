import mongoose, { Schema, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Every scope, in ONE place.
 *
 * The mongoose enum and the admin API's validator both read from here. They
 * used to hardcode their own lists and had already drifted: `analytics:read`
 * existed in the model but could not be granted through the admin route, so an
 * analytics client had to be edited directly in Mongo. A new scope added to the
 * union alone is a scope nobody can ever be given.
 */
export const THIRD_PARTY_SCOPES = [
  "invoices:read",
  "invoices:write",
  // Read-only access to public affiliate-network analytics endpoints
  // (e.g. /public/analytics/affiliate/direct). Clients with only this scope
  // are pure analytics partners and don't need a productConfig.
  "analytics:read",
  // Credit a user's store wallet — money OUT of the platform. A deliberately
  // separate grant from invoices:write: a partner that collects payments has no
  // business paying anyone unless it was given this as well.
  "wallet:credit",
  // Create a starter office for a user who holds NO Unilevel Plus licence,
  // under the 30-day grace programme (routes/platformOffices.ts). Holding this
  // scope is what lets a platform skip the licence gate, so it is granted to
  // the handful of integrating platforms and to nothing else — the main web
  // and mobile apps never send a platform key and keep the gate.
  "offices:grace",
] as const;

export type ThirdPartyScope = (typeof THIRD_PARTY_SCOPES)[number];

/**
 * A purchasable subscription term (1 / 3 / 6 / 12 months).
 *
 * IMPORTANT: `upPortion` and `platformPortion` are PER MONTH, not per term.
 * The commission distributor runs `termMonths` separate Unilevel Plus
 * distributions of exactly `upPortion` each, so per-month values make that a
 * multiplication. Per-term values would force a division (144/12) that is exact
 * today but reintroduces a rounding-bug class the moment a discounted term
 * exists (143.99/12).
 */
export interface IThirdPartyTermPlan {
  termMonths: number; // integer >= 1, unique within the array
  /** DOLLARS, full term. Standalone sell price (100 / 200 / 396). */
  totalAmount: number;
  /**
   * DOLLARS, full term. The SUBSCRIPTION PORTION when bought in the same cart
   * as the Unilevel Plus licence — 75 / 191 / 396. The cart the buyer pays is
   * `licencePrice + this` (100 / 216 / 421); the licence is always charged at
   * its own full list value, so the bundle discount lands entirely here.
   *
   * Stored as the subscription portion, NOT the cart total, so the solvency
   * check below compares like with like. Storing the cart total would leave a
   * licence-price-wide window in which commission exceeds subscription revenue
   * but validation still passes (a 6-month bundle at a $96 cart nets −$1).
   *
   * Omitted ⇒ no bundle discount; the bundled price equals `totalAmount`.
   */
  bundleSubscriptionAmount?: number;
  /**
   * DOLLARS PER MONTH into the Unilevel Plus comp tree — the COMMISSION BASIS,
   * always list value ($12), never derived from the sell price.
   *
   * `platformPortion` is deliberately NOT configured here: with two sell prices
   * per term and comp pinned to list, the platform's share is the residual
   * (`pricePaid − upPortion × termMonths`). Configuring it would let it drift
   * out of agreement with the prices.
   */
  upPortion: number;
  // Rollout gate. A term stays invisible to the catalog and unsellable until
  // the partner confirms their webhook handler honours `termMonths` — see
  // services/thirdPartyWebhook.ts. Flipping this is the go-live switch.
  isActive: boolean;
  label?: string; // "6 months"
  sortOrder?: number;
}

export interface IThirdPartyProductConfig {
  productCode: string;
  totalAmount: number;
  upPortion: number;
  platformPortion: number;
  platformUserEmail: string;
  platformOrgId: string;
  recurringPeriod: "weekly" | "monthly" | "quarterly" | "yearly";
  // When true, this client may also create variable-amount, non-recurring
  // wallet top-up invoices via mode="topup". Defaults to false to keep
  // existing subscription-only clients unaffected.
  allowsTopUp?: boolean;
  // Multi-month terms. Optional: when absent, services/thirdPartyTerms.ts
  // synthesises a 1-month plan from the scalars above, so clients configured
  // before terms existed behave exactly as they always did.
  //
  // There is deliberately NO `defaultTermMonths` here. The default is always
  // 1 month — a multi-month term must be an explicit choice at checkout or on
  // the API call, never something a config change can impose retroactively.
  termPlans?: IThirdPartyTermPlan[];
}

export interface IThirdPartyRateLimits {
  perMinute: number;
  perDay: number;
}

export interface IThirdPartyClient extends Document {
  _id: Types.ObjectId;
  name: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  webhookUrl?: string;
  webhookSecret: string;
  scopes: ThirdPartyScope[];
  isActive: boolean;
  rateLimits: IThirdPartyRateLimits;
  // Optional — only invoice-flow clients need it. Pure analytics clients
  // (scope: ["analytics:read"]) leave this unset.
  productConfig?: IThirdPartyProductConfig;
  /**
   * This is the client the Unilevel Plus combo offer sells.
   *
   * The free-first-month fallback used to identify it by being the ONLY
   * active client. Adding a second one (GarageGo, 10 Sep 2026) silently
   * turned the offer off: buyers on the bare-licence path stopped getting a
   * UPI mandate AND stopped getting their free month, with nothing but a
   * console.warn to show for it. Selling a second product must not disable
   * the first one's offer, so the client is now named rather than counted.
   *
   * Exactly one client should carry this.
   */
  isComboDefault?: boolean;
  createdBy?: Types.ObjectId;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const TermPlanSchema = new Schema<IThirdPartyTermPlan>(
  {
    termMonths: { type: Number, required: true, min: 1, max: 60 },
    totalAmount: { type: Number, required: true, min: 0 },
    bundleSubscriptionAmount: { type: Number, min: 0 },
    upPortion: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    label: { type: String, maxlength: 64 },
    sortOrder: { type: Number },
  },
  { _id: false }
);

const ProductConfigSchema = new Schema<IThirdPartyProductConfig>(
  {
    productCode: { type: String, required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    upPortion: { type: Number, required: true, min: 0 },
    platformPortion: { type: Number, required: true, min: 0 },
    platformUserEmail: { type: String, required: true },
    platformOrgId: { type: String, required: true },
    recurringPeriod: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      required: true,
    },
    allowsTopUp: { type: Boolean, default: false },
    termPlans: {
      type: [TermPlanSchema],
      default: undefined, // stay absent rather than [] on legacy docs
      validate: {
        // A synchronous path validator, deliberately: `pre("validate")` hooks
        // are async middleware and are SKIPPED by `Document.validateSync()`,
        // so rules living there wouldn't fire on every write path.
        validator: function (this: any, plans?: IThirdPartyTermPlan[]) {
          if (!plans || plans.length === 0) return true;

          const seen = new Set<number>();
          for (const p of plans) {
            if (!Number.isInteger(p.termMonths) || p.termMonths < 1) return false;
            if (seen.has(p.termMonths)) return false;
            seen.add(p.termMonths);

            if (p.bundleSubscriptionAmount != null && p.bundleSubscriptionAmount < 0) return false;

            if (p.termMonths === 1) {
              // There is no bundled monthly tier — the $25 licence grants a free
              // month, then bills the standard monthly rate.
              if (p.bundleSubscriptionAmount != null) return false;
              // An explicit 1-month plan must agree with the legacy scalars,
              // otherwise the synthesised and explicit versions would disagree
              // and every existing subscription would reprice on renewal.
              if (
                round2(p.totalAmount) !== round2(this.totalAmount) ||
                round2(p.upPortion) !== round2(this.upPortion)
              ) {
                return false;
              }
            }

            // SOLVENCY INVARIANT.
            //
            // Comp is list-based on multi-month terms: affiliates receive
            // `upPortion` per month regardless of what was collected, and the
            // platform takes the residual. So the CHEAPEST sell price for this
            // term must still cover the full comp outlay — otherwise the
            // platform's share is negative and the wallet gets debited.
            //
            // This replaces the old `upPortion + platformPortion === totalAmount
            // / termMonths` identity, which cannot hold once a term is sold at a
            // discount (3mo standalone $100 ⇒ $33.33/mo vs a $36 list split).
            const cheapest = Math.min(
              p.totalAmount,
              p.bundleSubscriptionAmount ?? p.totalAmount
            );
            if (round2(p.upPortion * p.termMonths) > round2(cheapest)) {
              return false;
            }
          }
          return true;
        },
        message:
          "Invalid termPlans: termMonths must be unique positive integers; upPortion × termMonths must not exceed the cheapest sell price (totalAmount / bundleSubscriptionAmount) or commission would exceed revenue; the termMonths=1 entry must match productConfig.totalAmount/upPortion and must not define bundleSubscriptionAmount",
      },
    },
  },
  { _id: false }
);

// NOTE: the termMonths=1 agreement rule and the no-bundled-monthly rule live in
// the synchronous `termPlans` path validator above, NOT in a pre("validate")
// hook — hooks are async middleware and are skipped by `validateSync()`.

const RateLimitSchema = new Schema<IThirdPartyRateLimits>(
  {
    perMinute: { type: Number, default: 60 },
    perDay: { type: Number, default: 10000 },
  },
  { _id: false }
);

const ThirdPartyClientSchema = new Schema<IThirdPartyClient>(
  {
    name: { type: String, required: true, index: true },
    apiKeyHash: { type: String, required: true, unique: true, index: true },
    apiKeyPrefix: { type: String, required: true, index: true },
    webhookUrl: { type: String },
    webhookSecret: { type: String, required: true },
    scopes: {
      type: [String],
      enum: THIRD_PARTY_SCOPES,
      // Deliberately NOT every scope. A client created without an explicit list
      // can read and write invoices; paying money out is always asked for.
      default: ["invoices:read", "invoices:write"],
    },
    isActive: { type: Boolean, default: true, index: true },
    // See IThirdPartyClient.isComboDefault. Indexed because the combo
    // resolver reads it on every licence checkout and every fulfilment.
    isComboDefault: { type: Boolean, default: false, index: true },
    rateLimits: { type: RateLimitSchema, default: () => ({}) },
    // Required only for invoice-flow clients. Analytics-only clients omit it.
    productConfig: { type: ProductConfigSchema, required: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

ThirdPartyClientSchema.index({ apiKeyPrefix: 1, isActive: 1 });

export const ThirdPartyClient = mongoose.model<IThirdPartyClient>(
  "ThirdPartyClient",
  ThirdPartyClientSchema
);

// ============= API Key Helpers =============

const KEY_PREFIX_LEN = 8;
const KEY_RANDOM_BYTES = 32;

export interface GeneratedApiKey {
  rawKey: string;
  hash: string;
  prefix: string;
}

/**
 * Generate a new API key. Format: gu_tp_<prefix>_<random-hex>
 * The `rawKey` must be returned to the caller exactly once; only the hash is persisted.
 */
export async function generateApiKey(): Promise<GeneratedApiKey> {
  const prefix = crypto
    .randomBytes(KEY_PREFIX_LEN)
    .toString("base64url")
    .slice(0, KEY_PREFIX_LEN);
  const random = crypto.randomBytes(KEY_RANDOM_BYTES).toString("hex");
  const rawKey = `gu_tp_${prefix}_${random}`;
  const hash = await bcrypt.hash(rawKey, 10);
  return { rawKey, hash, prefix };
}

export async function verifyApiKey(rawKey: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(rawKey, hash);
  } catch {
    return false;
  }
}

/**
 * Extract the 8-char prefix from a raw API key. Returns null if malformed.
 * Key format: gu_tp_<prefix>_<random-hex>
 */
export function extractKeyPrefix(rawKey: string): string | null {
  const parts = rawKey.split("_");
  if (parts.length < 4) return null;
  if (parts[0] !== "gu" || parts[1] !== "tp") return null;
  const prefix = parts[2];
  if (!prefix || prefix.length !== KEY_PREFIX_LEN) return null;
  return prefix;
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
