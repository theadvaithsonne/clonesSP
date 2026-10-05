import { Schema, model, Types } from "mongoose";

const RankingEntrySchema = new Schema(
  {
    rank: { type: Number, required: true },
    playerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    value: { type: Number, required: true },
    points: { type: Number, required: true },
  },
  { _id: false }
);

const Bat246TopTenSchema = new Schema(
  {
    category: { type: Number, min: 1, max: 11, required: true },
    period: {
      type: String,
      enum: ["A", "B", "C", "D", "E", "F", "G", "H"],
      required: true,
    },
    rankings: { type: [RankingEntrySchema], default: [] },
    computedAt: { type: Date, required: true },
  },
  { timestamps: false }
);

Bat246TopTenSchema.index({ category: 1, period: 1 }, { unique: true });

export const Bat246TopTen = model("bat246TopTen", Bat246TopTenSchema);
