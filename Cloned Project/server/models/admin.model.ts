import { Schema, model, InferSchemaType } from "mongoose";

const AdminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    // store only a hash; do not keep plaintext passwords
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "superadmin"], default: "admin" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AdminSchema.index({ email: 1 }, { unique: true });

export type Admin = InferSchemaType<typeof AdminSchema>;
export const AdminModel = model<Admin>("Admin", AdminSchema);
