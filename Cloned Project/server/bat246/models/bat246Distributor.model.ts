import { Schema, model, Types } from "mongoose";

const Bat246DistributorSchema = new Schema(
  {
    userId:   { type: Types.ObjectId, ref: "User",          required: true, unique: true, index: true },
    playerId: { type: Types.ObjectId, ref: "bat246Players", index: true },

    // Distributor ID — cached name split + sequential ID (assigned on qualification)
    // e.g. name "Bat246-1" -> firstName "Bat246", lastName "1" -> distributorId "1001B1"
    firstName:     { type: String, default: null },
    lastName:      { type: String, default: null },
    distributorId: { type: String, default: null, unique: true, sparse: true, index: true },

    // Copy of the user's display fields, taken while the User document
    // still exists — this is what survives if that account is later
    // deleted. userId above stays a live reference (used for board
    // placement, invoices, permission checks, linking to the profile
    // page, etc.), but nothing display-facing should depend on populate()
    // succeeding: that's exactly what crashed /games/bat246/distributors
    // (TypeError reading 'name' off a null populate result) once 33
    // seed/test distributors turned out to reference deleted/nonexistent
    // users. Written once, guaranteed, in assignDistributorId() at
    // qualification time (bat246DistributorId.util.ts), and opportunistically
    // refreshed by listDistributors whenever the live user is still there
    // — so it also stays reasonably current if the person edits their
    // profile, not just a permanent one-time copy.
    userSnapshot: {
      name:           { type: String, default: null },
      email:          { type: String, default: null },
      phone:          { type: String, default: null },
      profilePicture: { type: String, default: null },
      country:        { type: String, default: null },
      state:          { type: String, default: null },
      city:           { type: String, default: null },
      postalCode:     { type: String, default: null },
    },

    // Collected on Complete Profile, BAT246-only (see
    // bat246Profile.routes.ts) — deliberately separate from
    // userSnapshot.country (current residence) and never written to the
    // shared User document.
    countryOfBirth: { type: String, default: null },

    // Qualification flags — each updated independently
    isOfficeMember:           { type: Boolean, default: false },
    isGarageAffiliate:        { type: Boolean, default: false },
    garageAffiliateExpiresAt: { type: Date,    default: null  },
    hasBat246Membership:      { type: Boolean, default: false },
    membershipExpiresAt:      { type: Date,    default: null  },
    hasPurchasedProduct:      { type: Boolean, default: false },

    // Who invited this user to Bat246 (from invite link bat246Ref param)
    bat246RefUserId: { type: Types.ObjectId, ref: "User", default: null },
    // Board the "unassigned" invite link pointed to (placement hint)
    bat246RefBoardId: { type: Types.ObjectId, ref: "bat246Boards", default: null },
    // Product the admin "+ Invite" flow originally pointed this person at
    // ($650 board entry vs $160 POD entry) — drives which product the
    // "Path to Bat246 Distributor" step-4 CTA offers them.
    invitedProductId: { type: Types.ObjectId, ref: "Product", default: null },

    // Admin approval — marks distributor as ready to be placed on a board
    isApproved:  { type: Boolean, default: false },
    approvedAt:  { type: Date,    default: null  },

    // POD invite tracking — "Invite To POD" / "POD Invite Status" columns.
    // podInvitedByUserId is first-touch: set once on the first invite/remind
    // sent to this distributor and never overwritten by later reminders.
    podInvitedByUserId:       { type: Types.ObjectId, ref: "User", default: null },
    podInvitedByEmail:        { type: String, default: null },
    podInvitedByName:         { type: String, default: null },
    podInviteSentAt:          { type: Date,   default: null }, // most recent send (invite or remind)
    podInviteCount:           { type: Number, default: 0 },
    podPurchaseCompletedAt:   { type: Date,   default: null },
    // Snapshot of podInvitedByUserId taken at purchase time — permanent credit record.
    podPurchaseCreditedToUserId: { type: Types.ObjectId, ref: "User", default: null },

    // POD board placement — "Ready to place on board" button on the Distributors grid.
    // podPlacedPositionKey: "pod-0"|"pod-1"|"pod-2" for the 3 visual POD seats,
    // or a real board position ("1stA", "atBat-3", "dugout", ...) for the 4th
    // (downline-redirected) placement — see placeUserInPod().
    podPlacedBoardId:       { type: Types.ObjectId, ref: "bat246Boards", default: null },
    podPlacedPositionKey:   { type: String, default: null },
    podPlacedAt:            { type: Date,   default: null },
    podPlacedByUserId:      { type: Types.ObjectId, ref: "User", default: null }, // who picked the board

    // $650 Board Entry invite tracking — "Invite To Board" / "Board Invite
    // Status" columns (Inviteandplace page only). Same first-touch pattern
    // as the POD fields above: boardInvitedByUserId is set once on the first
    // invite/remind and never overwritten by later reminders. Unlike POD,
    // "ready to place" is driven by the existing isQualified flag (not a
    // separate purchase-completion field) — isQualified already means
    // "completed all 4 qualification steps, including the $650 purchase".
    boardInvitedByUserId: { type: Types.ObjectId, ref: "User", default: null },
    boardInvitedByEmail:  { type: String, default: null },
    boardInvitedByName:   { type: String, default: null },
    boardInviteSentAt:    { type: Date,   default: null }, // most recent send (invite or remind)
    boardInviteCount:     { type: Number, default: 0 },

    // Board placement via the "Ready to be placed on board" button — a second,
    // open-to-any-active-board-member path onto the board tree alongside the
    // existing admin/1st-Base Approve flow. Both paths converge on the same
    // isApproved flag (so every other isApproved/isOnBoard check in the app
    // still works unchanged); these fields just add POD-parity attribution
    // for *this specific* placement path. See placeDistributorOnBoard().
    boardPlacedBoardId:     { type: Types.ObjectId, ref: "bat246Boards", default: null },
    boardPlacedPositionKey: { type: String, default: null },
    boardPlacedAt:          { type: Date,   default: null },
    boardPlacedByUserId:    { type: Types.ObjectId, ref: "User", default: null },

    // Derived — recomputed whenever any flag changes
    isQualified:    { type: Boolean, default: false },
    qualifiedAt:    { type: Date,    default: null  },
    disqualifiedAt: { type: Date,    default: null  },
  },
  { timestamps: true }
);

Bat246DistributorSchema.index({ isQualified: 1, createdAt: -1 });

export const Bat246Distributor = model("bat246Distributors", Bat246DistributorSchema);
