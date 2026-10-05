import { Schema, model, Document, Types } from "mongoose";

/**
 * Snapshot of the message being replied to. Denormalised so quoted
 * previews render even if the original was deleted, paginated out, or
 * the replier never had it in their cached chat history. snippet is
 * a truncated copy of the original text.
 */
export interface IWebinarReplyTo {
  id: string;
  userId: string;
  name: string;
  snippet: string;
}

/**
 * A file shared in chat. `url` is the durable S3 object URL; clients
 * render by `kind` (inline image, audio player, or a download row) and
 * fall back to a download row for anything unrecognised.
 */
export interface IWebinarAttachment {
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "audio" | "file";
  durationMs?: number;
}

/**
 * Emoji reactions on a message, stored as emoji -> userIds. Keeping the
 * userId list (rather than a bare count) is what lets a client show
 * "you reacted" state and makes the toggle idempotent under retries.
 */
export type WebinarReactions = Record<string, string[]>;

export interface IWebinarMessage extends Document {
  _id: Types.ObjectId;
  workshopId: Types.ObjectId;
  userId: string;
  userName: string;
  text: string;
  replyTo?: IWebinarReplyTo;
  attachments?: IWebinarAttachment[];
  reactions?: WebinarReactions;
  /**
   * userIds the sender @mentioned, resolved at send time from the room
   * roster. Stored as ids rather than re-matched from the text on read:
   * participants can rename themselves mid-session (webinar:updateName), and
   * two people can share a display name, so "@Name" is not a stable handle.
   * A recipient decides "was I tagged?" by looking for their own id here.
   */
  mentions?: string[];
  /**
   * Which run of a recurring workshop this was said in — the UTC-midnight day
   * key, matching WebinarProductPin and WorkshopSessionOverride.
   *
   * A workshop keeps one id across every session it ever runs, so without this
   * there is no way to tell one night's chat from the next. Ending a webinar
   * used to `deleteMany` the whole thread to get a clean room next time, which
   * destroyed the record every recording needs for replay. Scoping reads to a
   * session gives the same fresh room without throwing anything away.
   *
   * Optional: messages written before this field existed have none, and the
   * live-history query treats a missing value as "belongs to this session" so
   * an in-flight session isn't blanked by a deploy.
   */
  sessionDate?: Date;
  timestamp: Date;
}

const ReplyToSchema = new Schema<IWebinarReplyTo>(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 80 },
    snippet: { type: String, required: true, maxlength: 200 },
  },
  { _id: false },
);

const AttachmentSchema = new Schema<IWebinarAttachment>(
  {
    url: { type: String, required: true, maxlength: 2048 },
    name: { type: String, required: true, maxlength: 200 },
    mime: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true, min: 0 },
    kind: {
      type: String,
      enum: ["image", "audio", "file"],
      default: "file",
    },
    durationMs: { type: Number, min: 0 },
  },
  { _id: false },
);

const WebinarMessageSchema = new Schema<IWebinarMessage>({
  workshopId: {
    type: Schema.Types.ObjectId,
    ref: "Workshop",
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
    maxlength: 80,
  },
  text: {
    type: String,
    // Not required: a message carrying only attachments has empty text.
    default: "",
    trim: true,
    maxlength: 1000,
  },
  replyTo: { type: ReplyToSchema, default: undefined },
  attachments: { type: [AttachmentSchema], default: undefined },
  // Map of emoji -> userIds. Mixed because emoji are arbitrary keys;
  // writes go through $addToSet/$pull on a dotted path so concurrent
  // reactions from different users can't clobber each other.
  reactions: { type: Schema.Types.Mixed, default: undefined },
  mentions: { type: [String], default: undefined },
  sessionDate: { type: Date },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for fast room chat history queries
WebinarMessageSchema.index({ workshopId: 1, timestamp: 1 });
// Live chat loads one session's thread; replay reads a session's messages.
WebinarMessageSchema.index({ workshopId: 1, sessionDate: 1, timestamp: 1 });

export const WebinarMessage = model<IWebinarMessage>(
  "WebinarMessage",
  WebinarMessageSchema
);
