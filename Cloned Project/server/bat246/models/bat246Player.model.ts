import { Schema, model, Types } from "mongoose";

const LeagueStatsSchema = new Schema(
  {
    totalEntries: { type: Number, default: 0 },
    timesAllStar: { type: Number, default: 0 },
    totalBCs: { type: Number, default: 0 },
    goldBCs: { type: Number, default: 0 },
    lbLevel: { type: String, enum: ["none", "T", "H", "G"], default: "none" },
    lbStats: {
      triple: { type: Number, default: 0 },
      homeRun: { type: Number, default: 0 },
      grandSlam: { type: Number, default: 0 },
    },
    cardsEarned: {
      gold: { type: Number, default: 0 },
      black: { type: Number, default: 0 },
      brown: { type: Number, default: 0 },
      gray: { type: Number, default: 0 },
      green: { type: Number, default: 0 },
      noCard: { type: Number, default: 0 },
      // Gray card sub-types (mirrors SlotDataSchema.freeGrayCards / grayCard160 on the board).
      // Kept separate so the leaderboard never merges them into one ×N stack.
      freeGray: { type: Number, default: 0 },
      gray160: { type: Number, default: 0 },
    },
    totalEarnings: { type: Number, default: 0 },
    matchingBonuses: { type: Number, default: 0 },
    crossedHp: { type: Boolean, default: false },
    crossedHpAt: { type: Date, default: null },
    lbEarnings: {
      triple:    { type: Number, default: 0 },
      homeRun:   { type: Number, default: 0 },
      grandSlam: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const Bat246PlayerSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", index: true },
    playerIdNo: { type: String, required: true, unique: true },
    nickname: { type: String },
    email: { type: String, required: true },
    role: { type: String },
    memberSince: { type: Date },
    countryResidence: { type: String },
    countryOrigin: { type: String },
    membershipActive:    { type: Boolean, default: false },
    membershipExpiresAt: { type: Date,    default: null  },
    // Free-trial-then-monthly membership billing (2026-08-18) — replaces the
    // old one-time $20/year purchase for new users. null for anyone who
    // activated the old way (or hasn't activated at all); set the moment a
    // new user claims the free trial via activateFreeTrialMembership().
    // "trial"   — in the free 3-month window, no charge yet.
    // "monthly" — trial ended, $12/month is being auto-debited.
    membershipPlan:      { type: String,  enum: ["trial", "monthly", null], default: null },
    membershipStartedAt: { type: Date,    default: null },
    // Next date runDueMembershipBilling() should charge this player — the
    // trial end date until the first charge, then pushed forward a month at
    // a time after each successful charge. null for legacy $20/year members
    // (they are never picked up by the billing sweeper).
    nextBillingAt:       { type: Date,    default: null },
    freeEntriesEarned: { type: Number, default: 0 },
    freeEntriesUsed: { type: Number, default: 0 },
    freeEntryInterval: { type: Number, default: 3 },
    minorLeague: { type: LeagueStatsSchema, default: () => ({}) },
    majorLeague: { type: LeagueStatsSchema, default: () => ({}) },
    // Permanent trophies — earned once when the player first occupies the
    // corresponding leaderboard tier on any board. Never removed or re-awarded
    // (kept even after the LB slot is vacated on cap hit).
    trophies: {
      T: { type: new Schema({ earnedAt: Date, boardId: { type: Types.ObjectId, ref: "bat246Boards" }, boardTrackingNo: String }, { _id: false }), default: null },
      H: { type: new Schema({ earnedAt: Date, boardId: { type: Types.ObjectId, ref: "bat246Boards" }, boardTrackingNo: String }, { _id: false }), default: null },
      G: { type: new Schema({ earnedAt: Date, boardId: { type: Types.ObjectId, ref: "bat246Boards" }, boardTrackingNo: String }, { _id: false }), default: null },
    },
  },
  { timestamps: true }
);

export const Bat246Player = model("bat246Players", Bat246PlayerSchema);
