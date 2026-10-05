// src/models/callOffering.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import { installCatalogHooks } from "./_catalogHooks";

// Intake question interface - custom questions for buyers
export interface IIntakeQuestion {
  _id: Types.ObjectId;
  question: string;
  answerType: "text" | "file"; // text input or file upload (jpg, pdf)
  isRequired: boolean;
  order: number;
}

// Topic card for "Topics We Cover"
export interface ICallTopic {
  title: string;
  description: string;
}

// How It Works step
export interface ICallHowItWorks {
  icon: string;
  title: string;
  description: string;
}

// FAQ item
export interface ICallFaq {
  question: string;
  answer: string;
}

// Main CallOffering interface
export interface ICallOffering extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  coverImage?: string;

  // Pricing
  pricePerCall: number;
  currency: string;
  isFree: boolean;

  // Call details
  duration: number; // Duration in minutes (30, 60, etc.)

  // Ownership
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId; // Founder who created the call offering

  // Channel association (optional)
  channelIds: Types.ObjectId[];

  // Intake form - custom questions
  intakeQuestions: IIntakeQuestion[];

  // Status
  status: "draft" | "published" | "archived";

  // Stats
  totalPurchased: number;
  totalUsed: number;
  totalScheduled: number;
  purchaseCount: number;
  averageRating?: number;
  reviewCount: number;

  // Detail page fields
  whatsIncluded?: string[];
  topicsWeCover?: ICallTopic[];
  howItWorks?: ICallHowItWorks[];
  faqs?: ICallFaq[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const IntakeQuestionSchema = new Schema<IIntakeQuestion>(
  {
    question: { type: String, required: true, trim: true },
    answerType: {
      type: String,
      enum: ["text", "file"],
      required: true,
      default: "text",
    },
    isRequired: { type: Boolean, default: false },
    order: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

const CallTopicSchema = new Schema<ICallTopic>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CallHowItWorksSchema = new Schema<ICallHowItWorks>(
  {
    icon: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CallFaqSchema = new Schema<ICallFaq>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CallOfferingSchema = new Schema<ICallOffering>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    coverImage: { type: String },

    // Pricing
    pricePerCall: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["INR", "USD"], default: "USD" },
    isFree: { type: Boolean, default: true },

    // Call details
    duration: { type: Number, required: true, default: 30, min: 5 }, // Minimum 5 minutes

    // Ownership
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Channel association
    channelIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Channel",
      },
    ],

    // Intake form - custom questions
    intakeQuestions: [IntakeQuestionSchema],

    // Status
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    // Stats
    totalPurchased: { type: Number, default: 0 },
    totalUsed: { type: Number, default: 0 },
    totalScheduled: { type: Number, default: 0 },
    purchaseCount: { type: Number, default: 0 },
    averageRating: { type: Number, min: 1, max: 5 },
    reviewCount: { type: Number, default: 0 },

    // Detail page fields
    whatsIncluded: { type: [String], default: undefined },
    topicsWeCover: { type: [CallTopicSchema], default: undefined },
    howItWorks: { type: [CallHowItWorksSchema], default: undefined },
    faqs: { type: [CallFaqSchema], default: undefined },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
CallOfferingSchema.index({ organizationId: 1, status: 1 });
CallOfferingSchema.index({ createdBy: 1, status: 1 });
CallOfferingSchema.index({ channelIds: 1 });

// Pre-save hook to sync isFree with pricePerCall
CallOfferingSchema.pre("save", function (next) {
  if (this.pricePerCall === 0) {
    this.isFree = true;
  } else {
    this.isFree = false;
  }
  next();
});

installCatalogHooks(CallOfferingSchema, "call");

export const CallOffering = mongoose.model<ICallOffering>(
  "CallOffering",
  CallOfferingSchema
);
