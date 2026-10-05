import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOfficePlan extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  amount: number; // In cents (900 = $9) - base amount before tax
  currency: string;
  period: "monthly" | "yearly";
  interval: number; // 1 for monthly, 12 for yearly
  features: string[];
  canInviteStakeholders: boolean;
  maxStakeholders?: number; // null = unlimited
  razorpayPlanId?: string;
  isActive: boolean;
  isDefault?: boolean; // Mark the recommended plan
  // GST fields
  taxRate: number; // GST percentage (e.g., 18)
  taxInclusive: boolean; // false = GST added on top of amount
  sacCode?: string; // SAC code for services (e.g., 998314 for IT/SaaS)
  // Per-plan override for the org's platform-fee %. When set, subscribing to
  // this plan writes this value onto Organization.paymentConfig, so every
  // downstream sale from the org's users routes commission through
  // distributeCommissions() at the plan's rate instead of the global 5%.
  platformFeeOverride?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const OfficePlanSchema = new Schema<IOfficePlan>(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    period: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    interval: {
      type: Number,
      default: 1,
    },
    features: {
      type: [String],
      default: [],
    },
    canInviteStakeholders: {
      type: Boolean,
      required: true,
      default: false,
    },
    maxStakeholders: {
      type: Number,
      default: null,
    },
    razorpayPlanId: {
      type: String,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    // GST fields
    taxRate: {
      type: Number,
      default: 18, // 18% GST
    },
    taxInclusive: {
      type: Boolean,
      default: false, // GST added on top of base amount
    },
    sacCode: {
      type: String,
      default: "998314", // SAC code for IT/SaaS services
    },
    platformFeeOverride: {
      type: Number,
      min: 0,
      max: 50,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for finding active plans
OfficePlanSchema.index({ isActive: 1, slug: 1 });

export const OfficePlan = mongoose.model<IOfficePlan>(
  "OfficePlan",
  OfficePlanSchema,
);

// Re-exports — the canonical home for these helpers is now src/utils/gstTax.ts
// so non-office callers (channels, courses, products, etc.) can use them
// without importing from a model file. Keep the re-exports so existing callers
// don't need to update their imports. Imported locally too so other code in
// THIS file can still reference GST_CONFIG by its bare name.
import {
  GST_CONFIG as _GST_CONFIG,
  calculateTaxAmounts as _calculateTaxAmounts,
  extractBaseFromTotal as _extractBaseFromTotal,
} from "../utils/gstTax";
export const GST_CONFIG = _GST_CONFIG;
export const calculateTaxAmounts = _calculateTaxAmounts;
export const extractBaseFromTotal = _extractBaseFromTotal;

// Fixed MongoDB ObjectIds for office plans
// IMPORTANT: These IDs are hardcoded to ensure subscriptions always reference
// the same plan documents, even if plans are deleted and recreated.
// DO NOT change these IDs - they are referenced by existing subscriptions.
export const OFFICE_PLAN_IDS = {
  basic: "695b96bda3149ec5949aa92a", // Fixed ID for Basic plan
  pro: "695b96bea3149ec5949aa92e", // Fixed ID for Pro plan
  starter: "6a7b96be0000000000000001", // Fixed ID for Starter (free) plan
} as const;

// Predefined plans configuration
// NOTE: `amount` is BASE amount (GST-exclusive). GST (18%) is added on top.
// Example: Basic $10 base + $1.80 GST = $11.80 total charged
//
// Basic ("Distributors Office") was deprecated — new signups go straight to
// the Pro plan. We deliberately keep `OFFICE_PLAN_IDS.basic` and any legacy
// read paths (affiliate.ts, joinRequests.ts, guestAuth.ts) alive so existing
// Basic subscribers in Mongo continue to resolve their plan correctly — only
// the seed entry is removed so the initializer stops re-creating it.
export const OFFICE_PLANS_CONFIG = {
  // basic: {
  //   _id: OFFICE_PLAN_IDS.basic, // Fixed ID to prevent orphaned subscriptions
  //   name: "Distributors Office",
  //   slug: "basic",
  //   description: "Everything you need to launch — for solo founders",
  //   amount: 4800, // $48 in cents - BASE amount (GST added on top)
  //   currency: "USD",
  //   period: "monthly" as const,
  //   interval: 1,
  //   features: [
  //     "Virtual workspace access",
  //     "Floor & department management",
  //     "Real-time messaging & DMs",
  //     "File storage (Cabinet)",
  //     "Calendar & bookings",
  //     "Store & products",
  //     "Courses & workshops",
  //     "Channels",
  //   ],
  //   canInviteStakeholders: false,
  //   maxStakeholders: 0,
  //   isActive: true,
  //   isDefault: false,
  //   // GST fields
  //   taxRate: GST_CONFIG.rate,
  //   taxInclusive: GST_CONFIG.taxInclusive,
  //   sacCode: GST_CONFIG.sacCode,
  // },
  starter: {
    _id: OFFICE_PLAN_IDS.starter,
    name: "Starters Offer",
    slug: "starter",
    description: "Free forever — pay only through a 10% platform fee on your transactions",
    amount: 0,
    currency: "USD",
    period: "monthly" as const,
    interval: 1,
    // Feature parity with Pro (see below) — the ONLY differentiator is
    // pricing model + BackOffice tab, which the FE locks separately.
    features: [
      "Virtual workspace access",
      "Floor & department management",
      "Real-time messaging & DMs",
      "File storage (Cabinet)",
      "Calendar & bookings",
      "Store & products",
      "Courses & workshops",
      "Channels",
      "Unlimited stakeholder invites",
      "Team collaboration",
      "Role-based access control",
    ],
    canInviteStakeholders: true,
    maxStakeholders: null,
    isActive: true,
    isDefault: false,
    // $0 base → GST would be $0 too; skip the GST config entirely to avoid
    // populating a meaningless tax row on invoices.
    taxRate: 0,
    taxInclusive: true,
    sacCode: GST_CONFIG.sacCode,
    // Bumps Organization.paymentConfig.platformFeePercentage to 10 on
    // subscribe; distributeCommissions() picks it up automatically.
    platformFeeOverride: 10,
  },
  pro: {
    _id: OFFICE_PLAN_IDS.pro, // Fixed ID to prevent orphaned subscriptions
    name: "Founders Office",
    slug: "pro",
    description: "Scale your team — unlimited everything",
    amount: 9600, // $96 in cents - BASE amount (GST added on top)
    currency: "USD",
    period: "monthly" as const,
    interval: 1,
    features: [
      "Virtual workspace access",
      "Floor & department management",
      "Real-time messaging & DMs",
      "File storage (Cabinet)",
      "Calendar & bookings",
      "Store & products",
      "Courses & workshops",
      "Channels",
      "Unlimited stakeholder invites",
      "Team collaboration",
      "Role-based access control",
      "Priority support",
    ],
    canInviteStakeholders: true,
    maxStakeholders: null, // Unlimited
    isActive: true,
    isDefault: true,
    // GST fields
    taxRate: GST_CONFIG.rate,
    taxInclusive: GST_CONFIG.taxInclusive,
    sacCode: GST_CONFIG.sacCode,
  },
};

// Commission structure for office subscriptions (hardcoded)
export const OFFICE_COMMISSION_STRUCTURE = {
  level1Percentage: 15, // 15% to L1 referrer
  level2Percentage: 10, // 10% to L2 referrer
  level3Percentage: 2.5, // 2.5% to L3 referrer
  level4Percentage: 2.5, // 2.5% to L4 referrer
  platformPercentage: 70, // Remaining to platform (after commissions: 100 - 15 - 10 - 2.5 - 2.5 = 70)
};
