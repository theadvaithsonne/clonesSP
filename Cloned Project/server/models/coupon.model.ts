import mongoose, { Schema, Document, Types } from "mongoose";

export type CouponScope = "global" | "organization";
export type CouponStatus = "active" | "inactive" | "expired";
export type CouponCreatorType = "garage_admin" | "founder";
export type ApplicableItemType =
  | "channel"
  | "course"
  | "workshop"
  | "product"
  | "office_plan"
  | "office_addon"
  // Event tickets. `itemId` is the EventProgram, NOT a ticket tier — a founder
  // discounts "the summit", and the discount then applies to whichever tier the
  // buyer picks.
  | "event_ticket";

export interface ICoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string;

  // Discount (percentage only)
  discountValue: number;
  maxDiscountAmount?: number; // Cap in paise (optional)

  // Scope
  scope: CouponScope;
  orgId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdByType: CouponCreatorType;

  // Razorpay mapping (for subscriptions)
  razorpayOfferId?: string;

  // Applicability
  applicableTo: ApplicableItemType[];
  specificItemIds?: Types.ObjectId[];

  // Validity
  validFrom: Date;
  validUntil?: Date;
  status: CouponStatus;

  // Usage limits
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  currentUsageCount: number;

  // Restrictions
  minOrderAmount?: number; // In paise

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[A-Z0-9_-]+$/,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Discount
    discountValue: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },

    // Scope
    scope: {
      type: String,
      enum: ["global", "organization"],
      required: true,
      default: "global",
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "createdByType",
    },
    createdByType: {
      type: String,
      enum: ["garage_admin", "founder"],
      required: true,
    },

    // Razorpay mapping
    razorpayOfferId: {
      type: String,
      trim: true,
    },

    // Applicability
    applicableTo: {
      type: [String],
      enum: ["channel", "course", "workshop", "product", "office_plan", "office_addon", "event_ticket"],
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one item type must be specified",
      },
    },
    specificItemIds: [
      {
        type: Schema.Types.ObjectId,
      },
    ],

    // Validity
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
    },

    // Usage limits
    maxUsageCount: {
      type: Number,
      min: 1,
    },
    maxUsagePerUser: {
      type: Number,
      min: 1,
    },
    currentUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Restrictions
    minOrderAmount: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ scope: 1, orgId: 1 });
couponSchema.index({ status: 1, validFrom: 1, validUntil: 1 });
couponSchema.index({ createdBy: 1, createdByType: 1 });

// Validation: orgId required if scope is "organization"
couponSchema.pre("validate", function (next) {
  if (this.scope === "organization" && !this.orgId) {
    this.invalidate("orgId", "orgId is required when scope is organization");
  }
  if (this.scope === "global" && this.orgId) {
    this.orgId = undefined;
  }
  next();
});

// Virtual to check if coupon is currently valid
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  if (this.status !== "active") return false;
  if (this.validFrom > now) return false;
  if (this.validUntil && this.validUntil < now) return false;
  if (this.maxUsageCount && this.currentUsageCount >= this.maxUsageCount) return false;
  return true;
});

couponSchema.set("toJSON", { virtuals: true });
couponSchema.set("toObject", { virtuals: true });

export const Coupon = mongoose.model<ICoupon>("Coupon", couponSchema);
