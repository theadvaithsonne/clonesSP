import { Schema, model } from "mongoose";

const AddressSchema = new Schema(
  {
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    country: { type: String, default: "" },
  },
  { _id: false }
);

const BankDetailsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    country: { type: String, required: true },
    bankName: { type: String, required: true },
    branchAddress: { type: AddressSchema, required: true },
    routingNumber: { type: String, default: "" },
    accountNumber: { type: String, required: true },
    swiftCode: { type: String, required: true },
    ibanNumber: { type: String, default: "" },
    beneficiaryName: { type: String, required: true },
    beneficiaryAddress: { type: AddressSchema, required: true },
  },
  { timestamps: true }
);

export const BankDetails = model("BankDetails", BankDetailsSchema);
