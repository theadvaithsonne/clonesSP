import { Schema, model, Types } from "mongoose";
import { installCatalogHooks } from "./_catalogHooks";
import { emailAlertsSchemaField } from "./emailAlerts.schema";
import { founderAlertsSchemaField } from "./founderAlerts.schema";
import { ThankYouPageSchema } from "./thankYouPage.schema";

// Sub-interfaces for channel detail page fields
export interface IChannelBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface IChannelReview {
  _id: Types.ObjectId;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount: number;
  createdAt: Date;
}

export interface IChannelFaq {
  question: string;
  answer: string;
}

// Sub-schemas
const ChannelBenefitSchema = new Schema<IChannelBenefit>(
  {
    icon: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ChannelReviewSchema = new Schema<IChannelReview>(
  {
    _id: { type: Schema.Types.ObjectId, default: () => new Types.ObjectId() },
    reviewerName: { type: String, required: true, trim: true },
    reviewerRole: { type: String, trim: true },
    reviewerAvatar: { type: String, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true },
    helpfulCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChannelFaqSchema = new Schema<IChannelFaq>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ChannelSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },

    // Pricing
    price: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "USD" },

    // Media
    coverImage: { type: String },
    galleryImages: { type: [String], default: undefined },
    videoUrl: { type: String, trim: true },   // YouTube link
    videoFile: { type: String, trim: true },   // Uploaded MP4 file URL
    shareLink: { type: String },

    // Posting permissions
    whoCanPost: {
      type: String,
      enum: ["everyone", "admins_only"],
      default: "everyone",
    },

    // Tax & iOS
    gstInclusive: { type: Boolean, default: true },
    requireIosPayment: { type: Boolean, default: false },
    appleFeeInclusive: { type: Boolean, default: false },

    // Configuration
    isActive: { type: Boolean, default: true },
    isFree: { type: Boolean, default: true },
    isSubscription: { type: Boolean, default: false },
    subscriptionPeriod: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
    },
    subscriptionInterval: { type: Number },
    allowPayWhatYouWant: { type: Boolean, default: false },

    // Default community: auto-join new members when they join this org
    // Only ONE channel per org can be isDefault: true (enforced by partial unique index)
    isDefault: { type: Boolean, default: false },

    // Mandatory on join: every user who joins this org is auto-enrolled into
    // this community. UNLIKE `isDefault` there is no unique index — a founder
    // can mandate any number of communities.
    //
    // FREE ONLY. Auto-enrolling someone into a paid community would hand them
    // something they never bought, so `setChannelMandatory` refuses it and
    // pricing a mandated channel clears the flag (see services/channel.ts).
    // The auto-join walk re-checks price at enrolment time too, so a channel
    // that slipped through is skipped rather than given away.
    mandatoryOnJoin: { type: Boolean, default: false, index: true },

    // Relationships
    combPlanId: { type: Schema.Types.ObjectId },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Post-purchase order email, sent when someone joins/buys this community.
    // Same shape products carry — see emailAlerts.schema.ts.
    emailAlerts: emailAlertsSchemaField,

    // "Notify me when someone joins" — the founder-side alert. Fires on every
    // new member, free or paid, including the auto-joins that deliberately
    // skip the buyer's order email. See services/founderAlertEmail.ts.
    founderAlerts: founderAlertsSchemaField,

    // Founder-configurable post-payment page. Same sub-schema Product +
    // Course use — the FE renderer (PostPurchaseThankYouCard) is
    // item-agnostic. Fires on the invoice `success` step only, so
    // renewal invoices for subscription channels will re-show it if
    // configured (matches how order-email `emailAlerts` behaves).
    thankYouPage: {
      type: ThankYouPageSchema,
      default: undefined,
    },

    // Channel detail page fields
    rating: { type: Number, min: 0, max: 5 },
    ratingCount: { type: Number, min: 0, default: 0 },
    aboutText: { type: String, trim: true },
    whatsIncluded: { type: [String], default: undefined },
    benefits: { type: [ChannelBenefitSchema], default: undefined },
    reviews: { type: [ChannelReviewSchema], default: undefined },
    faqs: { type: [ChannelFaqSchema], default: undefined },
  },
  { timestamps: true }
);

// Indexes
ChannelSchema.index({ storeId: 1, title: 1 });
ChannelSchema.index({ storeId: 1, isActive: 1 });
// Ensure at most ONE default channel per org (partial unique index)
ChannelSchema.index(
  { storeId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

installCatalogHooks(ChannelSchema, "channel");

export const Channel = model("Channel", ChannelSchema);
