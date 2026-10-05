import { Schema, model, Types } from "mongoose";

const SlotDataSchema = new Schema(
  {
    playerId: { type: Types.ObjectId, ref: "bat246Players" },
    entryNo: { type: String },
    playerName: { type: String },
    playerEmail: { type: String },
    enteredAt: { type: Date },
    joinedBoardAt: { type: Date },
    cardType: {
      type: String,
      enum: ["Gold", "Black", "Brown", "Gray", "Green", "NoCard"],
      default: null,
    },
    salesCredits: { type: Number, default: 0 },
    noCards: { type: Number, default: 0 },
    goldCards: { type: Number, default: 0 },
    blackCards: { type: Number, default: 0 },
    brownCards: { type: Number, default: 0 },
    grayCards: { type: Number, default: 0 },
    // Gray card sub-types (item: 2 gray card kinds). Logic for when each is
    // awarded is TBD — for now these are admin-settable counters, mirroring
    // the other per-type card counters above.
    freeGrayCards: { type: Number, default: 0 },
    grayCard160: { type: Number, default: 0 },
    warpStatus: { type: Number, default: 0 },
    referredBy: { type: Types.ObjectId, ref: "bat246Players", default: null },
    referredByName: { type: String, default: null },
    isCPD: { type: Boolean, default: false },
    isCompanyInvitee: { type: Boolean, default: false },
    isLayaway: { type: Boolean, default: false },
    isLayawayPlan: { type: Boolean, default: false },
    layawayBalance: { type: Number, default: 0 },
    countryResidence: { type: String, default: null },
    countryOrigin: { type: String, default: null },
    // item 8 — running revenue total on root-board Home Plate slot
    totalEarning: { type: Number, default: 0 },
    // item 3 — how many times HP user (child board) has earned their referral bonus (max 2)
    hpReferralBonusCount: { type: Number, default: 0 },
    // Stamped on all 4 members of a board's POD cycle (the 3 board.pod[]
    // seats + the 4th entrant's dugout/atBat slot) — see Bat246Board.podTeamId.
    podTeamId: { type: String, default: null },
  },
  { _id: false }
);

const PencilingEntrySchema = new Schema(
  {
    playerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    targetAbSlot: {
      type: String,
      enum: ["AB1", "AB2", "AB3", "AB4", "AB5", "AB6", "AB7", "AB8"],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    penciledAt: { type: Date, required: true },
  },
  { _id: false }
);

const PrePickEntrySchema = new Schema(
  {
    playerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    targetAbSlot: {
      type: String,
      enum: ["AB1", "AB2", "AB3", "AB4", "AB5", "AB6", "AB7", "AB8"],
      required: true,
    },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const HotBoxEntrySchema = new Schema(
  {
    cardType: {
      type: String,
      enum: ["Gold", "Black", "Brown", "Gray", "Green"],
      required: true,
    },
    playerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    assignedAt: { type: Date, required: true },
    referredUserId: { type: Types.ObjectId, ref: "bat246Players", default: null },
  },
  { _id: false }
);

const LeaderBoardRowSchema = new Schema(
  {
    tier: { type: String, enum: ["G", "H", "T"], required: true },
    playerId: { type: Types.ObjectId, ref: "bat246Players", default: null },
    qualifiedAt: { type: Date, default: null },
    earningsOnBoard: { type: Number, default: 0 },
  },
  { _id: false }
);

const Bat246BoardSchema = new Schema(
  {
    boardNumber: { type: Number, required: true, unique: true },
    trackingNumber: { type: String, required: true, unique: true },
    title: { type: String },
    status: {
      type: String,
      enum: ["pending", "active", "splitting", "split", "completed", "stalled"],
      default: "active",
      index: true,
    },
    // Excludes this board from every listing (`GET /bat246/boards`, both
    // mine=true and the admin "all boards" view) and from direct
    // GET /bat246/boards/:id lookups, for everyone except Alan K — see
    // ALAN_K_EMAIL checks in bat246.service.ts/bat246.controller.ts.
    hidden: { type: Boolean, default: false },
    // "test" = developer-only test board. It is only served to a frontend
    // running at http://localhost:3000 (the developer's machine) — decided by
    // the request's Origin/Referer, see isLocalFrontend() in bat246.service.ts.
    // Any other frontend (bat246.com, gotobigwin.com, ...) never lists or
    // opens it, Alan K included. Default "live" = a normal board.
    mode: { type: String, enum: ["live", "test"], default: "live" },
    inviteProductId: { type: String, default: null },
    generation: { type: Number, default: 0 },
    familyNumber: { type: Number, default: null },
    side: { type: String, enum: ["left", "right", null], default: null },
    parentBoardId: { type: Types.ObjectId, ref: "bat246Boards", default: null },
    leftChildBoardId: { type: Types.ObjectId, ref: "bat246Boards", default: null },
    rightChildBoardId: { type: Types.ObjectId, ref: "bat246Boards", default: null },
    splitAt: { type: Date, default: null },
    protectionPeriodEnd: { type: Date, required: true },
    // Set while the PP clock is paused (time left, in ms); protectionPeriodEnd is parked 10 years out meanwhile. null = running.
    ppPausedRemainingMs: { type: Number, default: null },
    warpCount: { type: Number, enum: [0, 1, 2, 3, 4], default: 0 },
    minorLeagueAmount: { type: Number, default: 650 },
    // item 3 — configurable per-referral payout for Home Plate users on child boards (max 2 times)
    nextHomePlatePayout: { type: Number, default: 200 },

    // POD gondola — 3 VISUAL seats (mirrors the 4th POD_WINDOWS pane always
    // being empty in the old hardcoded placeholder). A board's POD "cycle"
    // is 4 placements total, all sharing one `podTeamId` (e.g. "P-1001",
    // globally sequential — see Bat246Config.podTeamCounter):
    //   - Entrants 1-3 fill these `pod[]` seats.
    //   - Entrant 4 does NOT occupy a seat or get placed directly on the
    //     board tree. If the board's Protection Period is still active they
    //     go to `dugout` (rendered as the shared podTeamId, not their name —
    //     see slotToPodOccupant-adjacent UI); once PP expires they're
    //     promoted to an open AT BAT slot by the existing
    //     promoteDugoutAfterPP() exactly like any other dugout entry (that
    //     function skips the $650 card-economy side effects for
    //     podTeamId-tagged slots). If PP had ALREADY expired at placement
    //     time, placeUserInPod() promotes/splits immediately instead of
    //     waiting in dugout. See placeUserInPod() in bat246PodInvite.service.ts.
    // podEarnerPlayerId/podCompletedAt record who placed that 4th entrant
    // (they earn a Gray/$160 card) and when the cycle closed.
    // IMPORTANT: none of this — pod[], podTeamId, podEarnerPlayerId,
    // podCompletedAt — is copied onto child boards on a split. A board's POD
    // cycle is closed history specific to that board; only the 4th
    // entrant's dugout/atBat SLOT (a normal slot, just podTeamId-tagged)
    // follows the ordinary dugout split-routing rules (by referredBy) like
    // any other dugout occupant.
    // NOTE: default MUST be [] (empty), not [null, null, null]. Mongoose's
    // DocumentArray default-hydration tries to init() each default element
    // as a real EmbeddedDocument — for a `null` default element that reads
    // `._id` off `null` and throws a ValidationError, on ANY board.save()
    // for a board that predates this field (i.e. every board that hasn't
    // had a POD placement yet — not just POD code, ANY save(), e.g.
    // setPenciling/setPrePick). Confirmed via a real crash 2026-08-05.
    // placeUserInPod()/getMyActivePodBoards() already treat `pod` as
    // possibly short/empty and grow it as needed — they don't require a
    // pre-filled 3-null array.
    pod: { type: [SlotDataSchema], default: [] },
    podTeamId: { type: String, default: null, index: true },
    podEarnerPlayerId: { type: Types.ObjectId, ref: "bat246Players", default: null },
    podCompletedAt: { type: Date, default: null },

    homePlate: { type: SlotDataSchema, default: null },
    thirdBase: { type: SlotDataSchema, default: null },
    secondBaseA: { type: SlotDataSchema, default: null },
    secondBaseB: { type: SlotDataSchema, default: null },
    firstBase: { type: [SlotDataSchema], default: [null, null, null, null] },
    atBat: { type: [SlotDataSchema], default: Array(8).fill(null) },
    dugout: { type: [SlotDataSchema], default: [] },
    onDeckCircle: { type: [SlotDataSchema], default: [] },

    hotBox: { type: [HotBoxEntrySchema], default: [] },
    penciling: { type: [PencilingEntrySchema], default: [] },
    prePick: { type: [PrePickEntrySchema], default: [] },
    leaderBoard: { type: [LeaderBoardRowSchema], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true }
);

Bat246BoardSchema.index({ status: 1, createdAt: 1 });
Bat246BoardSchema.index({ parentBoardId: 1 });

export const Bat246Board = model("bat246Boards", Bat246BoardSchema);
