import { Schema, model, InferSchemaType } from "mongoose";

const AIProviderKeySchema = new Schema(
  {
    providerId: {
      type: String,
      required: true,
      enum: ["openai", "anthropic", "replicate", "google-gemini", "garage-copilot"],
    },
    // Encrypted API key - in production, use proper encryption
    encryptedKey: {
      type: String,
      required: true,
    },
    // Masked version for display (e.g., "sk-...abc123")
    maskedKey: {
      type: String,
      required: true,
    },
    // Organization this key belongs to
    organizationId: {
      type: String,
      required: true,
    },
    // Who created/updated this key
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Ensure one key per provider per organization
AIProviderKeySchema.index({ providerId: 1, organizationId: 1 }, { unique: true });

export type AIProviderKey = InferSchemaType<typeof AIProviderKeySchema>;
export const AIProviderKeyModel = model<AIProviderKey>(
  "AIProviderKey",
  AIProviderKeySchema
);
