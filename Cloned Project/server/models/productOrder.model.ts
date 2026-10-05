import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOrderItem {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isDigital: boolean;
  digitalAssets?: Array<{
    name: string;
    fileUrl: string;
    fileType: string;
  }>;
  digitalLinks?: Array<{
    label: string;
    url: string;
    description?: string;
    linkType?: "static" | "dynamic";
    isCustomLink?: boolean;
    customLinkSetBy?: Types.ObjectId;
  }>;
}

export interface IShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface IProductOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  currency: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: string;
  paymentId?: string;
  invoiceShortUrl?: string; // Public URL for Razorpay invoice
  shippingAddress?: IShippingAddress;
  billingAddress?: IShippingAddress;
  paymentMode?: "Prepaid" | "COD";
  gstin?: string;
  companyName?: string;
  customerNote?: string;
  requiresShipping: boolean;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
    },
    productName: {
      type: String,
      required: true,
    },
    productImage: {
      type: String,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    isDigital: {
      type: Boolean,
      default: false,
    },
    digitalAssets: [
      {
        name: String,
        fileUrl: String,
        fileType: String,
      },
    ],
    digitalLinks: [
      {
        label: String,
        url: String,
        description: String,
        linkType: {
          type: String,
          enum: ["static", "dynamic"],
          default: "static",
        },
        isCustomLink: {
          type: Boolean,
          default: false,
        },
        customLinkSetBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String },
  },
  { _id: false }
);

const ProductOrderSchema = new Schema<IProductOrder>(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: function () {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ORD-${timestamp}-${random}`;
      },
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [(val: IOrderItem[]) => val.length > 0, "Order must have at least one item"],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
    },
    paymentId: {
      type: String,
    },
    invoiceShortUrl: {
      type: String,
    },
    shippingAddress: {
      type: ShippingAddressSchema,
    },
    billingAddress: {
      type: ShippingAddressSchema,
    },
    paymentMode: {
      type: String,
      enum: ["Prepaid", "COD"],
    },
    gstin: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    customerNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    requiresShipping: {
      type: Boolean,
      default: false,
    },
    trackingNumber: {
      type: String,
    },
    trackingUrl: {
      type: String,
    },
    notes: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Index for order number lookup
ProductOrderSchema.index({ orderNumber: 1 });

// Index for user's orders
ProductOrderSchema.index({ userId: 1, createdAt: -1 });

// Index for organization orders with status
ProductOrderSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

// Unique index on paymentId to prevent duplicate orders from same payment
// sparse: true allows multiple null paymentIds (for legacy orders)
ProductOrderSchema.index({ paymentId: 1 }, { unique: true, sparse: true });

// Covers the "has this user already paid for this product?" hide-after-
// purchase filter that runs on every getAvailableProducts request for a
// user in an org where any allowed-user-list product exists.
ProductOrderSchema.index({ userId: 1, "items.productId": 1, paymentStatus: 1 });

// Covers the offline-store commission gate: "which of these uplines has ever
// paid for anything from this org?" — a $in over the referral chain, run once
// per distribution on the payment hot path. The {userId, createdAt} index above
// can't serve the organizationId + paymentStatus predicates.
ProductOrderSchema.index({ userId: 1, organizationId: 1, paymentStatus: 1 });

export const ProductOrder = mongoose.model<IProductOrder>("ProductOrder", ProductOrderSchema);
