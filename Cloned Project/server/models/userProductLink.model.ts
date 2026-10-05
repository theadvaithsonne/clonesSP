import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUserProductLink extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  digitalLinkLabel: string;
  url: string;
  label?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserProductLinkSchema = new Schema<IUserProductLink>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    digitalLinkLabel: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// One custom link per user per product per digital link label
UserProductLinkSchema.index(
  { userId: 1, productId: 1, digitalLinkLabel: 1 },
  { unique: true }
);

// For lookups during order creation (find referrer's custom links for a product)
UserProductLinkSchema.index({ productId: 1, digitalLinkLabel: 1 });

export const UserProductLink = mongoose.model<IUserProductLink>(
  "UserProductLink",
  UserProductLinkSchema
);
