import { Schema, model, Document, Types } from "mongoose";

export interface IOfficeType {
  name: string;
  description?: string;
  pricePerSeat: number;
  capacity: number;
  images?: string[];
}

export interface ICoworkingSpace extends Document {
  name: string;
  description?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  amenities: string[];
  officeTypes: IOfficeType[];
  rating: number;
  ratingCount: number;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeTypeSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    pricePerSeat: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 1 },
    images: [{ type: String }],
  },
  { _id: true }
);

const CoworkingSpaceSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    // Location details (same pattern as Organization)
    location: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    // Media
    images: [{ type: String }],
    // Amenities (free text tags)
    amenities: [{ type: String }],
    // Nested office types
    officeTypes: [OfficeTypeSchema],
    // Rating
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    // Status
    isActive: { type: Boolean, default: true },
    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin", required: true },
  },
  { timestamps: true }
);

// Indexes
CoworkingSpaceSchema.index({ name: 1 });
CoworkingSpaceSchema.index({ city: 1, state: 1, country: 1 });
CoworkingSpaceSchema.index({ isActive: 1 });
CoworkingSpaceSchema.index({ "officeTypes.name": 1 });

export const CoworkingSpace = model<ICoworkingSpace>(
  "CoworkingSpace",
  CoworkingSpaceSchema
);
