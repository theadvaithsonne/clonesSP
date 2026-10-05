import { Schema, model, Types } from "mongoose";

// Minimal Deal collection. Kept intentionally small — just enough to back
// the chat /deal slash command. When a full CRM ships it can extend this
// schema in place without breaking the marker shape used by chat cards.
const DealSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    stage: {
      type: String,
      enum: ["lead", "qualified", "proposal", "won", "lost"],
      default: "lead",
      index: true,
    },
    value: { type: Number, default: 0 },
    currency: { type: String, default: "USD", maxlength: 8 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    nextFollowUp: { type: Date },
  },
  { timestamps: true }
);

// Text index so the /search route can sort by relevance without a regex scan.
DealSchema.index({ name: "text" });

export const Deal = model("Deal", DealSchema);
