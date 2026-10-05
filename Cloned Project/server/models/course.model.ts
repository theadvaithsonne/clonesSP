// src/models/course.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import { installCatalogHooks } from "./_catalogHooks";
import { emailAlertsSchemaField, type IEmailAlerts } from "./emailAlerts.schema";
import {
  founderAlertsSchemaField,
  type IFounderAlerts,
} from "./founderAlerts.schema";
import {
  ThankYouPageSchema,
  type IThankYouPage,
} from "./thankYouPage.schema";

// Quiz option within a question
export interface IQuizOption {
  text: string;
  isCorrect: boolean;
}

// Quiz question
export interface IQuizQuestion {
  _id: Types.ObjectId;
  questionText: string;
  questionType: "mcq_single" | "mcq_multi" | "true_false";
  options: IQuizOption[];
  explanation?: string;
  points: number;
  relatedChapterId?: Types.ObjectId; // The chapter this Q tests → "go back" link
}

// Quiz settings embedded on a quiz chapter
export interface IQuiz {
  questions: IQuizQuestion[];
  passingScore: number; // Percentage 0-100
  isRequired: boolean; // Must pass to mark chapter complete?
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface IChapterPdf {
  _id?: Types.ObjectId;
  name: string;
  url: string;
  s3Key?: string;
  fileSize?: number;
}

// Chapter interface - individual lesson within a section
export interface IChapter {
  _id: Types.ObjectId;
  title: string;
  order: number;
  contentType: "video" | "link" | "text" | "quiz" | "pdf" | "json";
  videoUrl?: string; // YouTube, Vimeo, or direct video URL
  videoS3Key?: string; // S3 object key for uploaded videos
  linkUrl?: string; // External link
  content?: string; // Rich text content
  duration?: number; // Duration in seconds (for videos)
  quiz?: IQuiz; // Quiz data (only when contentType = "quiz")
  pdfUrl?: string; // PDF URL
  pdfS3Key?: string; // S3 key for uploaded PDF
  pdfs?: IChapterPdf[];
  jsonFiles?: IChapterPdf[]; // JSON document files
}

// Section interface - group of chapters
export interface ISection {
  _id: Types.ObjectId;
  title: string;
  order: number;
  chapters: IChapter[];
}

// Digital asset for course
export interface IDigitalAsset {
  _id: Types.ObjectId;
  name: string;
  url: string;
  fileType: string;
  fileSize?: number;
}

// Course include item (icon + text)
export interface ICourseInclude {
  icon: string;
  text: string;
}

// Course review (founder-curated)
export interface ICourseReview {
  _id: Types.ObjectId;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount: number;
  createdAt: Date;
}

// Main Course interface
export interface ICourse extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  coverImage?: string;
  galleryImages: string[];
  videoUrl?: string;
  videoFile?: string;
  status: "draft" | "published" | "archived";

  // Ownership
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId; // Founder who created the course

  // Channel association (optional - for channel-specific courses)
  channelIds: Types.ObjectId[];

  // Pricing
  isPaid: boolean;
  isFree: boolean;
  price?: number;
  currency: string;

  // Tax + iOS payment surcharges. Same three fields channels/workshops
  // carry. `gstInclusive: true` = listed price already includes 18% GST
  // (INR only). Apple fee is dormant unless something sets
  // paymentSource=ios at checkout.
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;

  // Subscription settings
  isSubscription?: boolean;
  subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";

  // Post-purchase order email — shared shape with products and channels.
  emailAlerts?: IEmailAlerts;

  // "Notify me when someone enrols" — founder-side alert, see
  // models/founderAlerts.schema.ts.
  founderAlerts?: IFounderAlerts;

  // Content
  sections: ISection[];
  digitalAssets: IDigitalAsset[];

  // Stats
  totalDuration: number; // Total duration in seconds
  totalChapters: number;
  enrolledStudents: number;

  // Detail page fields
  rating?: number;
  ratingCount?: number;
  whatYouWillLearn?: string[];
  requirements?: string[];
  courseIncludes?: ICourseInclude[];
  reviews?: ICourseReview[];

  // Founder-configurable post-purchase page (same shape as Product).
  // Shown to the buyer on the invoice success step. Two modes:
  // auto-redirect, or a manual title + message + up to 5 CTA sections.
  thankYouPage?: IThankYouPage;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const QuizOptionSchema = new Schema(
  {
    text: { type: String, required: true },
    isCorrect: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    questionText: { type: String, required: true },
    questionType: {
      type: String,
      enum: ["mcq_single", "mcq_multi", "true_false"],
      required: true,
      default: "mcq_single",
    },
    options: [QuizOptionSchema],
    explanation: { type: String },
    points: { type: Number, default: 1 },
    relatedChapterId: { type: Schema.Types.ObjectId },
  },
  { _id: true }
);

const QuizSchema = new Schema(
  {
    questions: [QuizQuestionSchema],
    passingScore: { type: Number, default: 70, min: 0, max: 100 },
    isRequired: { type: Boolean, default: false },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
  },
  { _id: false }
);

const ChapterPdfSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    s3Key: { type: String },
    fileSize: { type: Number },
  },
  { _id: true }
);

const ChapterSchema = new Schema<IChapter>(
  {
    title: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    contentType: {
      type: String,
      enum: ["video", "link", "text", "quiz", "pdf", "json"],
      required: true,
      default: "video",
    },
    videoUrl: { type: String },
    videoS3Key: { type: String },
    linkUrl: { type: String },
    content: { type: String },
    duration: { type: Number, default: 0 },
    quiz: { type: QuizSchema },
    pdfUrl: { type: String },
    pdfS3Key: { type: String },
    pdfs: [ChapterPdfSchema],
    jsonFiles: [ChapterPdfSchema], // Reuse same schema for JSON files
  },
  { _id: true }
);

const SectionSchema = new Schema<ISection>(
  {
    title: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    chapters: [ChapterSchema],
  },
  { _id: true }
);

const DigitalAssetSchema = new Schema<IDigitalAsset>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number },
  },
  { _id: true }
);

const CourseIncludeSchema = new Schema<ICourseInclude>(
  {
    icon: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CourseReviewSchema = new Schema<ICourseReview>(
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

const CourseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true },
    description: { type: String },
    coverImage: { type: String },
    galleryImages: { type: [String], default: [] },
    videoUrl: { type: String, trim: true },
    videoFile: { type: String, trim: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

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

    // Pricing
    isPaid: { type: Boolean, default: false },
    isFree: { type: Boolean, default: true },
    price: { type: Number, default: 0 },
    currency: { type: String, enum: ["INR", "USD"], default: "USD" },

    // Tax + iOS payment surcharges (parity with channels/workshops).
    gstInclusive: { type: Boolean, default: true },
    requireIosPayment: { type: Boolean, default: false },
    appleFeeInclusive: { type: Boolean, default: false },

    // Subscription settings
    isSubscription: { type: Boolean, default: false },
    subscriptionPeriod: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
    },

    // Post-purchase order email. The HTML is snapshotted by the frontend
    // because Network Mail is a separate, browser-authenticated service.
    emailAlerts: emailAlertsSchemaField,

    // Founder-side "someone enrolled" alert. Unlike emailAlerts this carries
    // no template — see services/founderAlertEmail.ts.
    founderAlerts: founderAlertsSchemaField,

    // Content
    sections: [SectionSchema],
    digitalAssets: [DigitalAssetSchema],

    // Stats
    totalDuration: { type: Number, default: 0 },
    totalChapters: { type: Number, default: 0 },
    enrolledStudents: { type: Number, default: 0 },

    // Detail page fields
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    whatYouWillLearn: {
      type: [String],
      default: undefined,
    },
    requirements: {
      type: [String],
      default: undefined,
    },
    courseIncludes: {
      type: [CourseIncludeSchema],
      default: undefined,
    },
    reviews: {
      type: [CourseReviewSchema],
      default: undefined,
    },
    // Founder-configurable post-payment page. Same sub-schema Product
    // uses — the FE renderer (PostPurchaseThankYouCard) is item-agnostic.
    thankYouPage: {
      type: ThankYouPageSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
CourseSchema.index({ organizationId: 1, status: 1 });
CourseSchema.index({ createdBy: 1, status: 1 });
CourseSchema.index({ channelIds: 1 });

// Virtual to calculate total chapters
CourseSchema.pre("save", function (next) {
  let totalChapters = 0;
  let totalDuration = 0;

  this.sections.forEach((section) => {
    totalChapters += section.chapters.length;
    section.chapters.forEach((chapter) => {
      if (chapter.duration) {
        totalDuration += chapter.duration;
      }
    });
  });

  this.totalChapters = totalChapters;
  this.totalDuration = totalDuration;

  next();
});

installCatalogHooks(CourseSchema, "course");

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
