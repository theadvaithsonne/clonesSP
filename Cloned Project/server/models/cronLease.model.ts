// src/models/cronLease.model.ts
// Distributed lease for periodic jobs. Replaces in-process boolean flags
// (e.g. `let sweeping = false`) so multiple replicas don't double-run the
// same cron. One document per jobName; lease holders compete via atomic
// findOneAndUpdate.

import mongoose, { Schema, Document } from "mongoose";

export interface ICronLease extends Document {
  jobName: string;
  leaseHolder: string;
  leaseExpiresAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

const CronLeaseSchema = new Schema<ICronLease>(
  {
    jobName: { type: String, required: true, unique: true, index: true },
    leaseHolder: { type: String, default: "" },
    leaseExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const CronLease = mongoose.model<ICronLease>("CronLease", CronLeaseSchema);
