import mongoose, { Schema, Document, Types } from "mongoose";

// Gallery image interface
export interface IGalleryImage {
  url: string;
  caption?: string;
  alt?: string;
}

// Content block interface - flexible rich content
export interface IContentBlock {
  _id: Types.ObjectId;
  order: number;
  type: "text" | "image" | "video" | "youtube" | "gallery" | "quote";

  // Text block
  content?: string; // Rich HTML content

  // Image block
  imageUrl?: string;
  imageCaption?: string;
  imageAlt?: string;

  // Video block (uploaded)
  videoUrl?: string;
  videoThumbnail?: string;

  // YouTube embed
  youtubeUrl?: string;
  youtubeId?: string;

  // Gallery block (multiple images)
  galleryImages?: IGalleryImage[];

  // Quote block
  quoteText?: string;
  quoteAuthor?: string;
  quoteRole?: string;
}

// Metric interface
export interface IMetric {
  label: string;
  value: string;
  description?: string;
}

// Main Testimonial interface
export interface ITestimonial extends Document {
  _id: Types.ObjectId;

  // Ownership
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;

  // Client Info
  clientName: string;
  clientLogo?: string;
  clientWebsite?: string;
  clientIndustry?: string;

  // Testimonial Identity
  title: string;
  slug: string;
  shortDescription: string; // For card preview

  // Visual
  coverImage?: string;
  featuredImage?: string; // Hero image for detail page

  // Categories/Tags for filtering (simple strings)
  categories: string[]; // Array of category strings (e.g., ["AI", "DEV TOOLS"])
  tags: string[];

  // Rich Content (flexible blocks - NO LIMIT)
  contentBlocks: IContentBlock[];

  // Client Quote (primary testimonial quote)
  primaryQuote?: string;
  primaryQuoteAuthor?: string;
  primaryQuoteAuthorRole?: string;
  primaryQuoteAuthorImage?: string;

  // Metrics/Results (optional showcase numbers)
  metrics: IMetric[];

  // Live artifact link
  artifactUrl?: string;
  artifactLabel?: string;

  // Display options
  isFeatured: boolean;
  displayOrder: number;

  // Status
  status: "draft" | "published" | "archived";
  isPublic: boolean;

  // SEO
  metaTitle?: string;
  metaDescription?: string;

  // Timestamps
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Gallery Image Schema
const GalleryImageSchema = new Schema<IGalleryImage>(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    caption: {
      type: String,
      trim: true,
    },
    alt: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// Content Block Schema
const ContentBlockSchema = new Schema<IContentBlock>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      default: () => new Types.ObjectId(),
    },
    order: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video", "youtube", "gallery", "quote"],
      required: true,
    },

    // Text block
    content: {
      type: String,
      trim: true,
    },

    // Image block
    imageUrl: {
      type: String,
      trim: true,
    },
    imageCaption: {
      type: String,
      trim: true,
    },
    imageAlt: {
      type: String,
      trim: true,
    },

    // Video block
    videoUrl: {
      type: String,
      trim: true,
    },
    videoThumbnail: {
      type: String,
      trim: true,
    },

    // YouTube embed
    youtubeUrl: {
      type: String,
      trim: true,
    },
    youtubeId: {
      type: String,
      trim: true,
    },

    // Gallery block
    galleryImages: {
      type: [GalleryImageSchema],
      default: [],
    },

    // Quote block
    quoteText: {
      type: String,
      trim: true,
    },
    quoteAuthor: {
      type: String,
      trim: true,
    },
    quoteRole: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// Metric Schema
const MetricSchema = new Schema<IMetric>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// Main Testimonial Schema
const TestimonialSchema = new Schema<ITestimonial>(
  {
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
    },

    // Client Info
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientLogo: {
      type: String,
      trim: true,
    },
    clientWebsite: {
      type: String,
      trim: true,
    },
    clientIndustry: {
      type: String,
      trim: true,
    },

    // Testimonial Identity
    title: {
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
    shortDescription: {
      type: String,
      required: true,
      trim: true,
    },

    // Visual
    coverImage: {
      type: String,
      trim: true,
    },
    featuredImage: {
      type: String,
      trim: true,
    },

    // Categories/Tags (simple strings)
    categories: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },

    // Rich Content (flexible blocks - NO LIMIT)
    contentBlocks: {
      type: [ContentBlockSchema],
      default: [],
    },

    // Client Quote (primary)
    primaryQuote: {
      type: String,
      trim: true,
    },
    primaryQuoteAuthor: {
      type: String,
      trim: true,
    },
    primaryQuoteAuthorRole: {
      type: String,
      trim: true,
    },
    primaryQuoteAuthorImage: {
      type: String,
      trim: true,
    },

    // Metrics
    metrics: {
      type: [MetricSchema],
      default: [],
    },

    // Live artifact
    artifactUrl: {
      type: String,
      trim: true,
    },
    artifactLabel: {
      type: String,
      trim: true,
    },

    // Display options
    isFeatured: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },

    // Status
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },

    // SEO
    metaTitle: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String,
      trim: true,
    },

    // Publish date
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for organization + slug uniqueness
TestimonialSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

// Index for organization + status filtering
TestimonialSchema.index({ organizationId: 1, status: 1 });

// Index for category filtering
TestimonialSchema.index({ organizationId: 1, categories: 1, status: 1 });

// Index for featured testimonials ordering
TestimonialSchema.index({ organizationId: 1, isFeatured: 1, displayOrder: 1 });

// Index for public testimonials
TestimonialSchema.index({ organizationId: 1, isPublic: 1, status: 1 });

// Index for tags
TestimonialSchema.index({ tags: 1 });

// Index for creator's testimonials
TestimonialSchema.index({ createdBy: 1, status: 1 });

export const Testimonial = mongoose.model<ITestimonial>(
  "Testimonial",
  TestimonialSchema
);
