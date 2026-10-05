// src/models/appSubscription.model.ts
import { Schema, model, Types } from "mongoose";

const AppSubscriptionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", index: true, required: true },
    appId: { type: String, required: true, index: true },
    organizationId: {
      type: Types.ObjectId,
      ref: "Organization",
      index: true,
      required: true,
    },
    name: { type: String, required: true },
    url: { type: String, required: true },
    icon: { type: String },
    description: { type: String },
  },
  { timestamps: true }
);

// prevent duplicates per user/app/org
AppSubscriptionSchema.index(
  { userId: 1, appId: 1, organizationId: 1 },
  { unique: true }
);

export const AppSubscription = model("AppSubscription", AppSubscriptionSchema);
