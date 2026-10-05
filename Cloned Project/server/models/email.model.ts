import mongoose, { Schema, Document } from "mongoose";

export interface IEmail extends Document {
  organization: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  mailbox: string; // email address
  folder: string; // INBOX, Sent, etc.
  messageId: string;
  uid: number;
  seqno: number;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: Date;
  text?: string;
  html?: string;
  hasHtml: boolean;
  attachments: number;
  flags: string[];
  isRead: boolean;
  isStarred: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmailSchema = new Schema<IEmail>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mailbox: {
      type: String,
      required: true,
      index: true,
    },
    folder: {
      type: String,
      required: true,
      default: "INBOX",
      index: true,
    },
    messageId: {
      type: String,
      index: true,
    },
    uid: {
      type: Number,
      required: true,
    },
    seqno: {
      type: Number,
    },
    subject: {
      type: String,
      default: "",
    },
    from: {
      type: String,
      default: "",
    },
    to: {
      type: String,
      default: "",
    },
    cc: {
      type: String,
    },
    bcc: {
      type: String,
    },
    date: {
      type: Date,
    },
    text: {
      type: String,
    },
    html: {
      type: String,
    },
    hasHtml: {
      type: Boolean,
      default: false,
    },
    attachments: {
      type: Number,
      default: 0,
    },
    flags: {
      type: [String],
      default: [],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
EmailSchema.index({ user: 1, organization: 1, folder: 1, date: -1 });
EmailSchema.index({ user: 1, organization: 1, folder: 1, uid: 1 }, { unique: true });

export const Email = mongoose.model<IEmail>("Email", EmailSchema);
