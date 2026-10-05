import { Schema, model, Types } from "mongoose";

const CardBackSchema = new Schema(
  {
    assignedTo: {
      playerName: String,
      playerIdNo: String,
      entryNo: String,
    },
    stolenBy: {
      playerName: String,
      playerIdNo: String,
      entryNo: String,
      playerId: { type: Types.ObjectId, ref: "bat246Players" },
    },
    cardEarned: { type: String, default: null },
    position: { type: String },
    homePlateSide: { type: String, enum: ["L", "R", null], default: null },
    stolenFrom: {
      playerName: String,
      playerIdNo: String,
      entryNo: String,
      playerId: { type: Types.ObjectId, ref: "bat246Players" },
    },
    stolenFromPosition: { type: String, default: null },
    freePositionAssignedTo: { type: Types.ObjectId, ref: "bat246Players", default: null },
    freePosition: {
      playerName: String,
      playerIdNo: String,
      entryNo: String,
    },
    atBatPositionNo: { type: String, default: null },
    firstBasePosition: { type: String, enum: ["A", "B", "C", "D", null], default: null },
    issuedAt: { type: Date },
    boardTrackingNo: { type: String },
  },
  { _id: false }
);

const GrayDistributionSchema = new Schema(
  {
    share1PlayerId: { type: Types.ObjectId, ref: "bat246Players" },
    share2PlayerId: { type: Types.ObjectId, ref: "bat246Players" },
    share3PlayerId: { type: Types.ObjectId, ref: "bat246Players" },
    allStarPlayerId: { type: Types.ObjectId, ref: "bat246Players", default: null },
  },
  { _id: false }
);

const Bat246SalesCreditSchema = new Schema(
  {
    boardId: { type: Types.ObjectId, ref: "bat246Boards", required: true, index: true },
    playerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    playerName: { type: String },
    position: { type: String },
    cardType: {
      type: String,
      enum: ["Gold", "Black", "Brown", "Gray", "Green", "NoCard"],
      required: true,
    },
    countsForLB: { type: Boolean, required: true },
    isPostPP: { type: Boolean, default: false },
    saleAmount: { type: Number, default: 0 },
    isLayaway: { type: Boolean, default: false },
    grayDistribution: { type: GrayDistributionSchema, default: null },
    cardBack: { type: CardBackSchema, default: null },
    earnedAt: { type: Date, required: true },
    referredUserId:      { type: Types.ObjectId, ref: "bat246Players", default: null },
    referredUserName:    { type: String, default: null },
    boardTrackingNumber: { type: String, default: null },
  },
  { timestamps: false }
);

Bat246SalesCreditSchema.index({ playerId: 1, countsForLB: 1 });
Bat246SalesCreditSchema.index({ playerId: 1, cardType: 1 });
Bat246SalesCreditSchema.index({ playerId: 1, earnedAt: 1 });

export const Bat246SalesCredit = model("bat246SalesCredits", Bat246SalesCreditSchema);
