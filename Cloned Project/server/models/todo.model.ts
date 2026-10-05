import { Schema, model, Types } from "mongoose";

const TodoSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    task: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isPersonal: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries by org and user
TodoSchema.index({ orgId: 1, userId: 1 });

export const Todo = model("Todo", TodoSchema);
