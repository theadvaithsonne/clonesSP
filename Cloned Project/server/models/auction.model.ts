import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAuction extends Document {
  _id: Types.ObjectId;
  createdBy: Types.ObjectId;
  creatorName: string;
  creatorAvatar?: string;
  creatorOrgName: string;
  organizationId: Types.ObjectId;
  productSource: "garage" | "outside";
  productId?: Types.ObjectId;
  productName: string;
  productImages: string[];
  productDescription?: string;
  productVideoUrl?: string;
  minPrice: number;
  currency: "INR" | "USD";
  durationHours: number;
  startTime: Date;
  endTime: Date;
  status: "ongoing" | "ended" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const AuctionSchema = new Schema<IAuction>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    creatorName: { type: String, required: true, trim: true },
    creatorAvatar: { type: String },
    creatorOrgName: { type: String, required: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    productSource: { type: String, enum: ["garage", "outside"], required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true, trim: true },
    productImages: { type: [String], default: [] },
    productDescription: { type: String, trim: true },
    productVideoUrl: { type: String, trim: true },
    minPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["INR", "USD"], default: "USD" },
    durationHours: { type: Number, required: true, enum: [1, 6, 24, 48] },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ["ongoing", "ended", "cancelled"], default: "ongoing" },
  },
  { timestamps: true }
);

AuctionSchema.index({ status: 1, createdAt: -1 });
AuctionSchema.index({ createdBy: 1, status: 1 });

export const Auction = mongoose.model<IAuction>("Auction", AuctionSchema);
