import { Schema, model, Types } from "mongoose";

export interface IPollVote {
  _id: Types.ObjectId;
  pollId: Types.ObjectId;
  userId: Types.ObjectId;
  optionIds: Types.ObjectId[];
  createdAt: Date;
}

const PollVoteSchema = new Schema(
  {
    pollId: {
      type: Schema.Types.ObjectId,
      ref: "Poll",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    optionIds: [
      {
        type: Schema.Types.ObjectId,
        required: true,
      },
    ],
  },
  { timestamps: true }
);

// Unique index to prevent duplicate votes per user per poll
PollVoteSchema.index({ pollId: 1, userId: 1 }, { unique: true });

export const PollVote = model<IPollVote>("PollVote", PollVoteSchema);
