// src/services/messageTranslation.ts
//
// Translate group messages on demand, cached per (message, language).
//
// Used by the support chats — the member-facing route in routes/groups.ts and
// the admin console in routes/garageAdminSupportChats.ts share this so a
// message translated by one is free for the other.
//
// Gemini with the platform key (DEFAULT_GEMINI_KEY), NOT process.env.
// GEMINI_API_KEY — that variable holds a key the API rejects (see betty.ts).

import crypto from "crypto";
import { Types } from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_GEMINI_KEY } from "../routes/betty";
import { GroupMessage } from "../models/groupMessage.model";
import { MessageTranslation } from "../models/messageTranslation.model";

/**
 * The languages the apps offer — the web app's locales. Codes are what the
 * clients send; names are what the model is asked for.
 */
export const TRANSLATE_LANGUAGES = {
  en: "English",
  es: "Spanish",
  fr: "French",
  ar: "Arabic",
  zh: "Simplified Chinese",
  // Indian languages — the 22 scheduled languages of India.
  hi: "Hindi",
  bn: "Bengali",
  te: "Telugu",
  mr: "Marathi",
  ta: "Tamil",
  ur: "Urdu",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  or: "Odia",
  pa: "Punjabi (Gurmukhi script)",
  as: "Assamese",
  mai: "Maithili",
  sa: "Sanskrit",
  ks: "Kashmiri",
  ne: "Nepali",
  sd: "Sindhi",
  kok: "Konkani",
  doi: "Dogri",
  mni: "Manipuri (Meitei)",
  brx: "Bodo",
  sat: "Santali",
} as const;

export type TranslateLang = keyof typeof TRANSLATE_LANGUAGES;

export function isTranslateLang(v: unknown): v is TranslateLang {
  return typeof v === "string" && v in TRANSLATE_LANGUAGES;
}

const MODEL = "gemini-2.5-flash-lite";
/** Cap per request — one model call translates the whole batch. */
export const MAX_TRANSLATE_BATCH = 50;

function hashText(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex");
}

let _genAI: GoogleGenerativeAI | null = null;
function genAI(): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(DEFAULT_GEMINI_KEY);
  return _genAI;
}

/** One model call for the whole batch. Throws on a malformed reply. */
async function translateStrings(texts: string[], lang: TranslateLang): Promise<string[]> {
  const model = genAI().getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  });
  const prompt =
    `Translate each string in this JSON array into ${TRANSLATE_LANGUAGES[lang]}. ` +
    `These are chat messages. Keep names, @mentions, emoji, URLs, email ` +
    `addresses, numbers and currency amounts exactly as written. If a string ` +
    `is already in ${TRANSLATE_LANGUAGES[lang]}, return it unchanged. Return ` +
    `ONLY a JSON object {"translations": [...]} with the same number of ` +
    `strings, in the same order.\n\n${JSON.stringify(texts)}`;

  const res = await model.generateContent(prompt);
  const parsed = JSON.parse(res.response.text());
  const out = parsed?.translations;
  if (!Array.isArray(out) || out.length !== texts.length) {
    throw new Error("Translation reply did not match the request");
  }
  return out.map((t: unknown, i: number) => (typeof t === "string" ? t : texts[i]));
}

/**
 * Translations for the given messages of ONE group, keyed by message id.
 *
 * Messages outside `groupId`, deleted ones, system pills and attachment-only
 * messages (no text) are left out of the result rather than failing the
 * batch. Caller is responsible for checking the requester may read the group.
 */
export async function translateGroupMessages(
  groupId: string,
  messageIds: string[],
  lang: TranslateLang
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(messageIds))
    .filter((id) => Types.ObjectId.isValid(id))
    .slice(0, MAX_TRANSLATE_BATCH)
    .map((id) => new Types.ObjectId(id));
  if (!ids.length) return {};

  const msgs = (await GroupMessage.find({
    _id: { $in: ids },
    groupId: new Types.ObjectId(groupId),
    deletedAt: null,
    type: { $ne: "system" },
  })
    .select("_id text")
    .lean()) as { _id: Types.ObjectId; text?: string }[];

  const withText = msgs.filter((m) => (m.text || "").trim());
  if (!withText.length) return {};

  const cached = (await MessageTranslation.find({
    messageId: { $in: withText.map((m) => m._id) },
    lang,
  }).lean()) as unknown as { messageId: Types.ObjectId; srcHash: string; text: string }[];
  const cacheById = new Map(cached.map((c) => [String(c.messageId), c]));

  const result: Record<string, string> = {};
  const misses: { id: Types.ObjectId; text: string; hash: string }[] = [];
  for (const m of withText) {
    const text = m.text as string;
    const hash = hashText(text);
    const hit = cacheById.get(String(m._id));
    if (hit && hit.srcHash === hash) result[String(m._id)] = hit.text;
    else misses.push({ id: m._id, text, hash });
  }

  if (misses.length) {
    const translated = await translateStrings(
      misses.map((m) => m.text),
      lang
    );
    await MessageTranslation.bulkWrite(
      misses.map((m, i) => ({
        updateOne: {
          filter: { messageId: m.id, lang },
          update: { $set: { srcHash: m.hash, text: translated[i] } },
          upsert: true,
        },
      })),
      { ordered: false }
    ).catch((err: unknown) =>
      // A failed cache write costs a re-translation next time, nothing more.
      console.error("[translate] cache write failed:", err)
    );
    misses.forEach((m, i) => {
      result[String(m.id)] = translated[i];
    });
  }

  return result;
}
