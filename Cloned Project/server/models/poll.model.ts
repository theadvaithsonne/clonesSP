import { Schema, model, Types } from "mongoose";

export interface IPollOption {
  _id: Types.ObjectId;
  text: string;
  votesCount: number;
}

export interface IPoll {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  orgId: Types.ObjectId;
  question: string;
  options: IPollOption[];
  totalVotes: number;
  endsAt: Date;
  isMultipleChoice: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PollSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      unique: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: true,
      maxlength: 280,
    },
    options: [
      {
        text: { type: String, required: true, maxlength: 100 },
        votesCount: { type: Number, default: 0, min: 0 },
      },
    ],
    totalVotes: { type: Number, default: 0, min: 0 },
    endsAt: { type: Date, required: true },
    isMultipleChoice: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index for finding active polls
PollSchema.index({ orgId: 1, isActive: 1, endsAt: 1 });

export const Poll = model<IPoll>("Poll", PollSchema);
