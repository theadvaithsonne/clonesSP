// src/models/jobAlert.model.ts
//
// A saved Garage Jobs search a member wants to hear about. The sweeper
// (services/jobsSweeper.ts) emails new matching postings — instantly, daily or
// weekly on `weekday` — and `lastSentAt` marks where the next digest starts.
// Criteria use the same shape and matching as GET /jobs/discover
// (services/jobSearch.ts), so an alert finds exactly what the search showed.

import { Schema, model, Document, Types } from "mongoose";
import { EMPLOYMENT_TYPES, WORKPLACE_TYPES } from "./jobPosting.model";

export const ALERT_FREQUENCIES = ["instant", "daily", "weekly"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export interface IJobAlertCriteria {
  q?: string;
  location?: string;
  workplace?: string[];
  employmentType?: string[];
  experience?: number;
  salaryMin?: number;
  department?: string;
}

export interface IJobAlert extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  criteria: IJobAlertCriteria;
  frequency: AlertFrequency;
  /** 0 = Sunday … 6 = Saturday (UTC); weekly alerts only. */
  weekday?: number;
  active: boolean;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobAlertSchema = new Schema<IJobAlert>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    criteria: {
      q: { type: String, trim: true, maxlength: 120 },
      location: { type: String, trim: true, maxlength: 120 },
      workplace: { type: [{ type: String, enum: WORKPLACE_TYPES }], default: undefined },
      employmentType: { type: [{ type: String, enum: EMPLOYMENT_TYPES }], default: undefined },
      experience: { type: Number, min: 0, max: 60 },
      salaryMin: { type: Number, min: 0 },
      department: { type: String, trim: true, maxlength: 80 },
    },
    frequency: { type: String, enum: ALERT_FREQUENCIES, default: "daily" },
    weekday: { type: Number, min: 0, max: 6 },
    active: { type: Boolean, default: true },
    lastSentAt: { type: Date },
  },
  { timestamps: true }
);

JobAlertSchema.index({ active: 1, frequency: 1 });
JobAlertSchema.index({ userId: 1, createdAt: -1 });

export const JobAlert = model<IJobAlert>("JobAlert", JobAlertSchema);
