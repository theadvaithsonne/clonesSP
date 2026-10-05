import mongoose, { Schema, Document, Types } from "mongoose";
import { installCatalogHooks } from "./_catalogHooks";
import { emailAlertsSchemaField, type IEmailAlerts } from "./emailAlerts.schema";
import {
  founderAlertsSchemaField,
  type IFounderAlerts,
} from "./founderAlerts.schema";

export interface IDigitalAsset {
  _id: Types.ObjectId;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
}

export interface IDigitalLink {
  _id: Types.ObjectId;
  label: string;
  url: string;
  description?: string;
  linkType: "static" | "dynamic";
}

export interface IKeyFeature {
  icon: string;
  title: string;
  description: string;
}

export interface IWhatsInsideGroup {
  icon: string;
  title: string;
  items: string[];
}

export interface IProductReview {
  _id: Types.ObjectId;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount: number;
  createdAt: Date;
}

export interface IFaq {
  question: string;
  answer: string;
}

export interface IProductDetail {
  label: string;
  value: string;
}

// Thank-you page shape is shared with Course (and any future sellable
// with the same post-purchase experience). Re-exported here so existing
// `import { IThankYouPage } from "../models/product.model"` call sites
// keep working while the canonical home is models/thankYouPage.schema.ts.
export type {
  IThankYouPage,
  IThankYouPageSection,
} from "./thankYouPage.schema";
import type { IThankYouPage } from "./thankYouPage.schema";
import {
  ThankYouPageSchema,
  ThankYouPageSectionSchema as _ThankYouPageSectionSchema,
} from "./thankYouPage.schema";
// Force the section schema import to be retained (side-effect: registers
// the sub-schema alongside the parent). Explicit reference silences the
// unused-import linter without changing behavior.
void _ThankYouPageSectionSchema;

/** @deprecated Use `IEmailAlerts` — the config is shared with courses and channels. */
export type IProductEmailAlerts = IEmailAlerts;

export interface IProduct extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  sku: string;
  price: number;
  currency: string;
  trackQuantity: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  images: string[];
  categoryName?: string;
  tags: string[];
  isDigital: boolean;
  requiresShipping: boolean;
  deliveryMethod: "physical" | "digital" | "both";
  digitalAssets: IDigitalAsset[];
  digitalLinks: IDigitalLink[];
  channelIds: Types.ObjectId[];
  // Private one-time offer. Empty = no restriction (today's behavior; visible
  // per channelIds and purchaseable unlimited times). Non-empty = only these
  // users see the product AND each user can only buy it once — after payment,
  // the product disappears from that user's catalog (see getAvailableProducts).
  // Never mutated on purchase; stays as the founder's original invite roster.
  allowedUserIds?: Types.ObjectId[];
  status: "active" | "draft" | "archived";
  // Tax + iOS payment surcharges (parity with channels/workshops/courses).
  // gstInclusive: listed price already includes 18% GST (INR only).
  // requireIosPayment + appleFeeInclusive stay dormant until iOS wiring.
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  // Subscription settings
  isSubscription?: boolean;
  subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
  // Post-purchase order email. `templateHtml` is a rendered snapshot of the
  // founder's chosen Network Mail template — that service lives outside this
  // API and authenticates with the browser's JWT, so we cannot fetch the
  // template at send time. The frontend re-syncs this on every product save.
  emailAlerts?: IProductEmailAlerts;
  // "Notify me when someone buys" — founder-side alert, see
  // models/founderAlerts.schema.ts.
  founderAlerts?: IFounderAlerts;
  // Product detail page fields
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
  whatsIncluded?: string[];
  keyFeatures?: IKeyFeature[];
  whatsInside?: IWhatsInsideGroup[];
  reviews?: IProductReview[];
  faqs?: IFaq[];
  productDetails?: IProductDetail[];
  videos?: string[];
  youtubeLink?: string;
  thankYouPage?: IThankYouPage;
  createdAt: Date;
  updatedAt: Date;
}

const DigitalAssetSchema = new Schema<IDigitalAsset>(
  {
    _id: { type: Schema.Types.ObjectId, default: () => new Types.ObjectId() },
    name: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number },
  },
  { _id: false },
);

const DigitalLinkSchema = new Schema<IDigitalLink>(
  {
    _id: { type: Schema.Types.ObjectId, default: () => new Types.ObjectId() },
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    linkType: {
      type: String,
      enum: ["static", "dynamic"],
      default: "static",
    },
  },
  { _id: false },
);

const KeyFeatureSchema = new Schema<IKeyFeature>(
  {
    icon: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const WhatsInsideGroupSchema = new Schema<IWhatsInsideGroup>(
  {
    icon: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    items: { type: [String], default: [] },
  },
  { _id: false },
);

const ProductReviewSchema = new Schema<IProductReview>(
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
  { _id: false },
);

const FaqSchema = new Schema<IFaq>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const ProductDetailSchema = new Schema<IProductDetail>(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const ProductSchema = new Schema<IProduct>(
  {
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
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      default: "USD",
    },
    trackQuantity: {
      type: Boolean,
      default: false,
    },
    quantity: {
      type: Number,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      min: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    videos: {
      type: [String],
      default: [],
    },
    youtubeLink: {
      type: String,
      trim: true,
    },
    categoryName: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    isDigital: {
      type: Boolean,
      default: false,
    },
    requiresShipping: {
      type: Boolean,
      default: true,
    },
    deliveryMethod: {
      type: String,
      enum: ["physical", "digital", "both"],
      default: "physical",
    },
    digitalAssets: {
      type: [DigitalAssetSchema],
      default: [],
    },
    digitalLinks: {
      type: [DigitalLinkSchema],
      default: [],
    },
    channelIds: {
      type: [Schema.Types.ObjectId],
      ref: "Channel",
      default: [],
    },
    allowedUserIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "draft",
    },
    // Tax + iOS payment surcharges (parity with channels/workshops/courses).
    gstInclusive: { type: Boolean, default: true },
    requireIosPayment: { type: Boolean, default: false },
    appleFeeInclusive: { type: Boolean, default: false },
    // Subscription settings
    isSubscription: {
      type: Boolean,
      default: false,
    },
    subscriptionPeriod: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
    },
    // Post-purchase order email. The HTML is snapshotted by the frontend
    // because Network Mail is a separate, browser-authenticated service.
    emailAlerts: emailAlertsSchemaField,
    // Founder-side "someone bought this" alert. No template — see
    // services/founderAlertEmail.ts.
    founderAlerts: founderAlertsSchemaField,
    // Product detail page fields
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
    downloadCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    whatsIncluded: {
      type: [String],
      default: undefined,
    },
    keyFeatures: {
      type: [KeyFeatureSchema],
      default: undefined,
    },
    whatsInside: {
      type: [WhatsInsideGroupSchema],
      default: undefined,
    },
    reviews: {
      type: [ProductReviewSchema],
      default: undefined,
    },
    faqs: {
      type: [FaqSchema],
      default: undefined,
    },
    productDetails: {
      type: [ProductDetailSchema],
      default: undefined,
    },
    thankYouPage: {
      type: ThankYouPageSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for organization + slug uniqueness
ProductSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

// Index for SKU uniqueness within organization
ProductSchema.index({ organizationId: 1, sku: 1 }, { unique: true });

// Index for status filtering
ProductSchema.index({ organizationId: 1, status: 1 });

// Index for private-offer visibility filter (multikey on allowedUserIds).
ProductSchema.index({ organizationId: 1, allowedUserIds: 1 });

// Mirror catalog mutations into NetworkChainApi via the outbox.
installCatalogHooks(ProductSchema, "product");

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
