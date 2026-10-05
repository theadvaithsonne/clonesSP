import { Schema, model, Types } from "mongoose";

const TaskSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["todo", "inprogress", "done"],
      default: "todo",
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dueDate: { type: Date },
  },
  { timestamps: true }
);

export const Task = model("Task", TaskSchema);