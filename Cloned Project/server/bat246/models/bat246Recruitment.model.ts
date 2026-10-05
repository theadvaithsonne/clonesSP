import { Schema, model, Types } from "mongoose";

const Bat246RecruitmentSchema = new Schema(
  {
    boardId: { type: Types.ObjectId, ref: "bat246Boards", required: true, index: true },
    recruiterId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    buyerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    payerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    scenario: {
      type: String,
      enum: ["A", "B", "C", "SelfEntry"],
      required: true,
    },
    payerRelinquished: { type: Boolean, default: null },
    tncAcceptedAt: { type: Date },
    entryFeeAmount: { type: Number, default: 650 },
    atBatPosition: { type: String },
  },
  { timestamps: true }
);

export const Bat246Recruitment = model("bat246Recruitments", Bat246RecruitmentSchema);
