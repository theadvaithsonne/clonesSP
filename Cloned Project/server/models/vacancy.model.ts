import { Schema, model, Types } from "mongoose";

const VacancySchema = new Schema(
  {
    orgId: { type: Types.ObjectId, ref: "Organization", required: true },
    title: { type: String, required: true },
    department: { type: String, required: true },
    location: { type: String, required: true },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship"],
      default: "full-time",
    },
    description: { type: String, required: true },
    requirements: { type: String },
    salary: { type: String },
    status: {
      type: String,
      enum: ["open", "closed", "draft"],
      default: "open",
    },
    createdBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Vacancy = model("Vacancy", VacancySchema);
