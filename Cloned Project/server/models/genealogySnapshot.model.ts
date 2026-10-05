// Month-close snapshot of each user's NC status, UP qualification and personal
// volume — the "previous month" side of the Genealogy page's active Δ. Rows
// exist only for users with something to record (see services/genealogy/snapshot).
import mongoose, { Schema, Types } from "mongoose";

export interface IGenealogySnapshot {
  periodKey: string; // "YYYY-MM" (UTC)
  userId: Types.ObjectId;
  nc: "active" | "lapsed" | "never";
  qualified: boolean;
  volumeUsd: number;
}

const GenealogySnapshotSchema = new Schema<IGenealogySnapshot>(
  {
    periodKey: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    nc: { type: String, enum: ["active", "lapsed", "never"], required: true },
    qualified: { type: Boolean, default: false },
    volumeUsd: { type: Number, default: 0 },
  },
  { timestamps: true },
);
GenealogySnapshotSchema.index({ periodKey: 1, userId: 1 }, { unique: true });

export const GenealogySnapshot = mongoose.model<IGenealogySnapshot>(
  "GenealogySnapshot",
  GenealogySnapshotSchema,
);

const GenealogySnapshotRunSchema = new Schema(
  {
    periodKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ["running", "completed"], default: "running" },
    users: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const GenealogySnapshotRun = mongoose.model(
  "GenealogySnapshotRun",
  GenealogySnapshotRunSchema,
);
