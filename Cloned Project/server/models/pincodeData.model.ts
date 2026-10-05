import { Schema, model } from "mongoose";

const PincodeDataSchema = new Schema(
  {
    code:    { type: String, required: true, trim: true },
    prefix4: { type: String, required: true, trim: true },
    prefix3: { type: String, required: true, trim: true },
    city:    { type: String, required: true, trim: true },
    state:   { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "India" },
  },
  { timestamps: false }
);

PincodeDataSchema.index({ code: 1 }, { unique: true });
PincodeDataSchema.index({ prefix4: 1 });
PincodeDataSchema.index({ prefix3: 1 });

export const PincodeData = model("PincodeData", PincodeDataSchema);
