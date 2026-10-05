import { Schema, model } from "mongoose";

const OpenClawMessageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    agentId: { type: String, required: true },
    sessionId: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

OpenClawMessageSchema.index({ userId: 1, agentId: 1, createdAt: 1 });

export const OpenClawMessage = model("OpenClawMessage", OpenClawMessageSchema);
