import mongoose, { Schema } from "mongoose";

/**
 * Cached machine translation of one group message into one language.
 *
 * Its own collection rather than a field on GroupMessage: the message routes
 * return whole documents, so a `translations` map there would ride along on
 * every page of every thread for every client.
 *
 * `srcHash` is a hash of the text that was translated. An edited message no
 * longer matches it, so the stale row is simply re-translated and overwritten
 * — no invalidation hook on the edit path is needed.
 */
const MessageTranslationSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "GroupMessage", required: true },
    lang: { type: String, required: true },
    srcHash: { type: String, required: true },
    text: { type: String, default: "" },
  },
  { timestamps: true }
);

MessageTranslationSchema.index({ messageId: 1, lang: 1 }, { unique: true });

export const MessageTranslation =
  mongoose.models.MessageTranslation ||
  mongoose.model("MessageTranslation", MessageTranslationSchema);
