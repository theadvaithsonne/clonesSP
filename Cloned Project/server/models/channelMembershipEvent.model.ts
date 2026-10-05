import { Schema, model, Types } from "mongoose";

/**
 * ChannelMembershipEvent — append-only log of significant transitions on
 * a ChannelMembership row. Powers the founder Unsub Log page and any
 * downstream churn analytics without polluting the live membership doc
 * with historical timestamps.
 *
 * Three event types today:
 *
 *   "unsubscribed"        The user actively clicked cancel (or the equivalent
 *                         on any flow). One event per cancel across free /
 *                         one-time / recurring channels. Emitted from
 *                         services/feed.ts:unsubscribeFromChannel.
 *
 *   "expired"             Sweeper flipped a "cancelling this cycle" member
 *                         to inactive after their nextPaymentDate elapsed.
 *                         Always follows an earlier "unsubscribed" event
 *                         for the same (userId, channelId). Emitted from
 *                         the sweepExpiredChannelMemberships loop in
 *                         index.ts.
 *
 *   "payment_defaulted"   Sweeper revoked a recurring member because the
 *                         next cycle's child invoice hit its due date
 *                         unpaid. No prior "unsubscribed" — this is the
 *                         INVOLUNTARY lapse path. Emitted from the
 *                         sweepChannelPaymentDefaults loop in index.ts.
 *                         `accessUntil` is stamped as `occurredAt` (access
 *                         cut immediately at sweep time) and
 *                         `parentInvoiceId` points at the parent whose
 *                         cycle went unpaid so founders can trace the sub.
 *
 * NOT a general-purpose audit log — join events aren't stored here (that
 * data lives on ChannelMembership.joinedAt already). Keep this focused
 * on the exit-flow so the founder view stays legible.
 */

export type ChannelMembershipEventType =
  | "unsubscribed"
  | "expired"
  | "payment_defaulted";
export type ChannelMembershipChannelKind = "free" | "one_time" | "recurring";
// Discriminator between channel and workshop events. Legacy rows
// created before this field existed default to "channel" via the
// schema default, so the Unsub Log page can union both kinds cleanly.
export type MembershipItemKind = "channel" | "workshop";

export interface IChannelMembershipEvent {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  // Required when `itemKind === "channel"`; nullable when
  // `itemKind === "workshop"`. Historical rows are all channel-typed.
  channelId?: Types.ObjectId | null;
  orgId: Types.ObjectId;
  eventType: ChannelMembershipEventType;
  // Discriminates channel-vs-workshop events. Historical rows lack
  // this field and default to "channel" at read-time via schema default.
  itemKind: MembershipItemKind;
  // Set when itemKind === "workshop". Points at the Workshop the user
  // cancelled enrolment in. Nullable overall so channel rows don't
  // carry it.
  workshopId?: Types.ObjectId | null;
  // Populated only on per-session workshop cancels — identifies
  // which specific session in the workshop's recurrence the user
  // walked away from. For full-mode workshop cancels this stays null.
  sessionDate?: Date | null;
  // The moment the event actually happened. For "unsubscribed" this is
  // the cancel click; for "expired" it's when the sweeper ran.
  occurredAt: Date;

  // Channel classification at time of the event.
  channelKind: ChannelMembershipChannelKind;
  // Only meaningful for `channelKind: "recurring"`. Null for free / one-time.
  subscriptionPeriod:
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | null;

  // For "unsubscribed" events on recurring subs: the boundary the user
  // is still active until (parent invoice's nextDueDate). Null for
  // free / one-time (instant leave). Also stamped on "expired" events
  // so the sweeper's row explains "you had access until this exact
  // date, and this event is the sweep past it."
  accessUntil: Date | null;

  // Bookkeeping metrics so the founder view doesn't need to compute
  // them client-side. `activeDaysUsed` = joinedAt → occurredAt (whole
  // days). `activeDaysLeftAtCancel` = occurredAt → accessUntil (only
  // populated on "unsubscribed" for recurring; always 0 on "expired").
  activeDaysUsed: number | null;
  activeDaysLeftAtCancel: number | null;

  // Full lifetime USD paid by this user for this channel at the moment
  // the event fired — snapshot so historical LTV doesn't drift as they
  // rejoin/leave. Computed via convertToUsd for mixed currencies.
  lifetimeValueUsdSnapshot: number;

  // Optional links to related invoice documents so an admin can trace
  // the exact billing chain that got cancelled. `parentInvoiceId` is
  // the recurring root; unset for free / one-time.
  parentInvoiceId: Types.ObjectId | null;
  // The membership row the event was emitted against — kept for joins
  // even though (userId, channelId) is unique on ChannelMembership.
  membershipId: Types.ObjectId;

  // Snapshot of the customer email/name at event time. Users can change
  // their name later and we still want the log to read the way it did
  // when the event fired.
  customerEmailSnapshot: string | null;
  customerNameSnapshot: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const ChannelMembershipEventSchema = new Schema<IChannelMembershipEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel", default: null },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    eventType: {
      type: String,
      enum: ["unsubscribed", "expired", "payment_defaulted"],
      required: true,
    },
    itemKind: {
      type: String,
      enum: ["channel", "workshop"],
      // Default so pre-existing rows read as channel events without
      // migration. New writes always pass the field explicitly.
      default: "channel",
    },
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      default: null,
    },
    sessionDate: { type: Date, default: null },
    occurredAt: { type: Date, required: true, default: Date.now },

    channelKind: {
      type: String,
      enum: ["free", "one_time", "recurring"],
      required: true,
    },
    subscriptionPeriod: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly", null],
      default: null,
    },

    accessUntil: { type: Date, default: null },
    activeDaysUsed: { type: Number, default: null },
    activeDaysLeftAtCancel: { type: Number, default: null },

    lifetimeValueUsdSnapshot: { type: Number, default: 0 },

    parentInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    membershipId: {
      type: Schema.Types.ObjectId,
      // Refers to `ChannelMembership` for channel events and
      // `WorkshopRegistration` for workshop events. Type-erased on
      // purpose — the discriminator is `itemKind`.
      required: true,
    },

    customerEmailSnapshot: { type: String, default: null },
    customerNameSnapshot: { type: String, default: null },
  },
  { timestamps: true }
);

// Founder Unsub Log — main index (list, filter, paginate by org).
ChannelMembershipEventSchema.index({ orgId: 1, occurredAt: -1 });
// Per-channel drill-down.
ChannelMembershipEventSchema.index({ channelId: 1, occurredAt: -1 });
// Powers "did we already log an expired for this cancel?" idempotency
// check the sweeper uses so a mid-run crash doesn't duplicate events.
ChannelMembershipEventSchema.index({
  membershipId: 1,
  eventType: 1,
});
// Per-org drill-down by kind — powers the Unsub Log Kind filter.
ChannelMembershipEventSchema.index({
  orgId: 1,
  itemKind: 1,
  occurredAt: -1,
});
// Per-workshop drill-down.
ChannelMembershipEventSchema.index({ workshopId: 1, occurredAt: -1 });

export const ChannelMembershipEvent = model<IChannelMembershipEvent>(
  "ChannelMembershipEvent",
  ChannelMembershipEventSchema
);
