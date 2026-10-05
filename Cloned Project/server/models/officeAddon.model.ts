import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOfficeAddon extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  amount: number; // In cents (29900 = $299) - base amount before tax
  currency: string;
  period: "monthly" | "yearly";
  interval: number; // 1 for monthly, 12 for yearly
  features: string[];
  razorpayPlanId?: string;
  isActive: boolean;
  // GST fields
  taxRate: number; // GST percentage (e.g., 18)
  taxInclusive: boolean; // false = GST added on top of amount
  sacCode?: string; // SAC code for services (e.g., 998314 for IT/SaaS)
  createdAt: Date;
  updatedAt: Date;
}

const OfficeAddonSchema = new Schema<IOfficeAddon>(
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
      default: "yearly",
    },
    interval: {
      type: Number,
      default: 12, // 12 months for yearly
    },
    features: {
      type: [String],
      default: [],
    },
    razorpayPlanId: {
      type: String,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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
  },
  {
    timestamps: true,
  }
);

// Index for finding active add-ons
OfficeAddonSchema.index({ isActive: 1, slug: 1 });

export const OfficeAddon = mongoose.model<IOfficeAddon>(
  "OfficeAddon",
  OfficeAddonSchema
);

// GST configuration (same as office plans)
export const ADDON_GST_CONFIG = {
  rate: 18, // 18% GST
  sacCode: "998314", // SAC code for IT/SaaS services
  taxInclusive: true, // The amount passed to Razorpay includes GST
};

// Helper to calculate tax amounts from base amount (GST-exclusive)
export function calculateAddonTaxAmounts(baseAmountPaise: number, taxRate: number = ADDON_GST_CONFIG.rate) {
  const taxAmount = Math.round(baseAmountPaise * taxRate / 100);
  const totalAmount = baseAmountPaise + taxAmount;
  return { baseAmount: baseAmountPaise, taxAmount, totalAmount, taxRate };
}

// Helper to extract base amount from GST-inclusive total amount
export function extractAddonBaseFromTotal(totalAmountPaise: number, taxRate: number = ADDON_GST_CONFIG.rate) {
  const baseAmount = Math.round(totalAmountPaise / (1 + taxRate / 100));
  const taxAmount = totalAmountPaise - baseAmount;
  return { baseAmount, taxAmount, totalAmount: totalAmountPaise, taxRate };
}

// Predefined add-ons configuration
// NOTE: `amount` is BASE amount (GST-exclusive). GST (18%) is added on top.
// Example: White-Label $299 base + $53.82 GST = $352.82 total charged
export const OFFICE_ADDONS_CONFIG = {
  "white-label": {
    name: "White-Label",
    slug: "white-label",
    description: "Remove Garage branding and customize your office",
    amount: 29900, // $299 in cents - BASE amount (GST added on top)
    currency: "USD",
    period: "yearly" as const,
    interval: 12, // 12 months for yearly billing
    features: [
      "Remove Garage branding",
      "Custom branding options",
      "White-label experience for your team",
    ],
    isActive: true,
    // GST fields
    taxRate: ADDON_GST_CONFIG.rate,
    taxInclusive: ADDON_GST_CONFIG.taxInclusive,
    sacCode: ADDON_GST_CONFIG.sacCode,
  },
  // Cryptobrand yearly subscription — same commission shape as
  // whitelabel (3-bucket split + monthly volume bonus) but its own
  // access gate (`hasActiveAddon(orgId, "cryptosub")`). Auto-provisioned
  // alongside the Pro office plan for orgs where
  // `officeCreatedFromCryptobrand === true`; see
  // src/services/cryptobrandOfficeBootstrap.ts.
  cryptosub: {
    name: "Cryptosub",
    slug: "cryptosub",
    description: "Cryptobrand yearly subscription",
    amount: 60000, // $600 in cents - BASE amount (GST added on top)
    currency: "USD",
    period: "yearly" as const,
    interval: 12,
    features: [
      "Cryptobrand-branded office access",
      "Cryptobrand-exclusive commission structure",
      "Monthly volume bonus for direct referrers",
    ],
    isActive: true,
    taxRate: ADDON_GST_CONFIG.rate,
    taxInclusive: ADDON_GST_CONFIG.taxInclusive,
    sacCode: ADDON_GST_CONFIG.sacCode,
  },
};

// Commission structure for add-on subscriptions (same as office plans)
export const ADDON_COMMISSION_STRUCTURE = {
  level1Percentage: 15, // 15% to L1 referrer
  level2Percentage: 10, // 10% to L2 referrer
  level3Percentage: 2.5, // 2.5% to L3 referrer
  level4Percentage: 2.5, // 2.5% to L4 referrer
  platformPercentage: 70, // Remaining to platform (after commissions: 100 - 15 - 10 - 2.5 - 2.5 = 70)
};
