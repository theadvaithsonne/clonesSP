import { Schema, model, Types } from "mongoose";

const ApplicationSchema = new Schema(
  {
    vacancyId: { type: Types.ObjectId, ref: "Vacancy", required: true },
    vacancyTitle: { type: String, required: true },
    orgId: { type: Types.ObjectId, ref: "Organization", required: true },
    applicantName: { type: String, required: true },
    applicantEmail: { type: String, required: true },
    applicantPhone: { type: String },
    resumeUrl: { type: String },
    coverLetter: { type: String },
    status: {
      type: String,
      enum: ["pending", "reviewed", "shortlisted", "rejected", "hired"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Application = model("Application", ApplicationSchema);
