// AI triage: should this support chat become a ticket?
//
// Reads the recent conversation of one support group and asks the model whether
// it contains an unresolved customer issue worth tracking as a ticket, plus a
// subject/priority. Powers the "AI suggests creating a ticket" banner in the
// admin console. Fails closed: any model or parse error yields no suggestion,
// never an error the console has to handle.
//
// Same provider as the translate feature — Gemini via DEFAULT_GEMINI_KEY (NOT
// process.env.GEMINI_API_KEY, which the API rejects; see betty.ts).

import { Types } from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { DEFAULT_GEMINI_KEY } from "../routes/betty";
import { env } from "../config/env";
import { Group } from "../models/group.model";
import { GroupMessage } from "../models/groupMessage.model";

const MODEL = "gemini-2.5-flash-lite";
/** How many recent top-level messages to feed the model. */
const WINDOW = 20;

let _genAI: GoogleGenerativeAI | null = null;
function genAI(): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(DEFAULT_GEMINI_KEY);
  return _genAI;
}

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface TicketSuggestion {
  suggest: boolean;
  subject?: string;
  summary?: string;
  priority?: TicketPriority;
  reason?: string;
  /** How the suggestion was produced — "ai" when the model answered, "rules"
   *  when it fell back to the keyword heuristic (model down or no key). */
  source?: "ai" | "rules";
  /** Set when a ticket is already open for this chat (so the banner can point
   *  at it instead of offering to create another). */
  openTicketId?: string | null;
}

/** Messages that are just pleasantries — never worth a ticket on their own. */
const PLEASANTRY =
  /^(hi+|hey+|hello+|ok(ay)?|k|thanks?|thank you|thankyou|ty|tysm|good (morning|afternoon|evening|night)|bye|gm|gn|great|nice|cool|sure|yes|yep|yeah|no|nope|👍|🙏|❤️|😊)\s*$/i;

/**
 * Rule-based fallback used when the model is unavailable. The caller has
 * already established that the member spoke last (something is awaiting
 * support), so this decides whether that message looks like a real issue and
 * guesses a priority from keywords.
 */
function heuristicSuggestion(
  rows: any[],
  memberId: string | null,
): TicketSuggestion {
  const memberMsgs = rows.filter((m) => memberId && String(m.from) === memberId);
  if (!memberMsgs.length) return { suggest: false, source: "rules" };
  const lastText = String(memberMsgs[memberMsgs.length - 1].text || "").trim();
  if (!lastText || PLEASANTRY.test(lastText.replace(/[.!?…\s]+$/, ""))) {
    return { suggest: false, source: "rules" };
  }
  const lower = lastText.toLowerCase();
  const urgent =
    /(urgent|asap|immediately|fraud|scam|lost money|stolen|hacked|can'?t withdraw|not received|double ?charged|unauthori[sz]ed)/.test(
      lower,
    );
  const high =
    /(not working|does'?nt work|doesn'?t work|can'?t (log ?in|login|access)|cannot (log ?in|login|access)|login issue|error|failed|failure|stuck|blocked|unable|missing|wrong|refund|dispute)/.test(
      lower,
    );
  return {
    suggest: true,
    subject: lastText.slice(0, 80),
    summary: memberMsgs
      .slice(-2)
      .map((m) => String(m.text).replace(/\s+/g, " ").slice(0, 200))
      .join(" "),
    priority: urgent ? "urgent" : high ? "high" : "medium",
    reason: "Member is awaiting a reply (auto-flagged).",
    source: "rules",
    openTicketId: null,
  };
}

export async function suggestTicketForChat(
  groupId: string,
): Promise<TicketSuggestion> {
  if (!Types.ObjectId.isValid(groupId)) return { suggest: false };
  const g: any = await Group.findOne({ _id: groupId, kind: "support" }).lean();
  if (!g) return { suggest: false };

  // Multiple tickets per chat are allowed, so an already-open ticket no longer
  // suppresses a suggestion — a new distinct issue can still warrant its own.

  const memberId = g.supportUserId ? String(g.supportUserId) : null;
  const uplineId = g.supportUplineId ? String(g.supportUplineId) : null;

  const docs: any[] = await GroupMessage.find({
    groupId: g._id,
    $or: [{ threadId: null }, { threadId: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .limit(WINDOW)
    .select("from text type deletedAt createdAt")
    .lean();
  docs.reverse();

  const rows = docs.filter(
    (m) => m.type !== "system" && !m.deletedAt && m.text && String(m.text).trim(),
  );
  if (!rows.length) return { suggest: false };

  // Only worth suggesting when the member has written AND is the last to speak
  // — i.e. something is awaiting the support team. If support answered last,
  // assume it's handled unless/until the member replies again.
  const anyMember = rows.some((m) => memberId && String(m.from) === memberId);
  const lastFromMember =
    memberId && String(rows[rows.length - 1].from) === memberId;
  if (!anyMember || !lastFromMember) return { suggest: false };

  // Already handled: a ticket or Taskroom task was made from this chat after
  // the member's latest message (or from that message itself). Without this
  // the banner kept offering a ticket for a message that was already one —
  // nothing new had been said, so "member spoke last" stayed true.
  const lastMemberMsg = rows[rows.length - 1];
  const since = new Date(lastMemberMsg.createdAt);
  const { Ticket } = await import("../models/ticket.model");
  const { GroupAiTask } = await import("../models/groupAiTask.model");
  const [ticketDone, taskDone] = await Promise.all([
    Ticket.exists({
      groupId: g._id,
      $or: [{ createdAt: { $gte: since } }, { sourceMessageId: lastMemberMsg._id }],
    }),
    GroupAiTask.exists({
      groupId: g._id,
      $or: [{ createdAt: { $gte: since } }, { sourceMessageIds: lastMemberMsg._id }],
    }),
  ]);
  if (ticketDone || taskDone) {
    return { suggest: false, reason: "Already turned into a ticket or task" };
  }

  const transcript = rows
    .map((m) => {
      const fid = String(m.from);
      const who =
        fid === memberId ? "Member" : fid === uplineId ? "Upline" : "Support";
      return `${who}: ${String(m.text).replace(/\s+/g, " ").slice(0, 400)}`;
    })
    .join("\n");

  const prompt =
    `You are a support triage assistant for a fintech and social app. Read the ` +
    `support chat below and decide whether it contains an unresolved customer ` +
    `issue that a human agent should track as a ticket. Do NOT suggest a ticket ` +
    `for greetings, small talk, thanks, or an issue the support team has already ` +
    `resolved in the conversation. Respond ONLY as minified JSON with keys: ` +
    `shouldCreate (boolean), subject (string, max 80 chars, no surrounding ` +
    `quotes), summary (1-2 sentence string), priority (one of "low","medium",` +
    `"high","urgent"), reason (short string).\n\nConversation:\n${transcript}`;

  // Model chain: Gemini first, then OpenAI, then the keyword heuristic. Each
  // returns parsed JSON or null (unavailable); only when BOTH models are down
  // do we fall back to rules — a model's "no" is a real answer we honor.
  const p = (await askGemini(prompt)) ?? (await askOpenAI(prompt));
  if (!p) return heuristicSuggestion(rows, memberId);

  const priority: TicketPriority = ["low", "medium", "high", "urgent"].includes(
    p?.priority,
  )
    ? p.priority
    : "medium";
  if (!p?.shouldCreate) {
    return {
      suggest: false,
      source: "ai",
      reason: p?.reason ? String(p.reason) : undefined,
    };
  }
  return {
    suggest: true,
    subject: p?.subject ? String(p.subject).slice(0, 80) : undefined,
    summary: p?.summary ? String(p.summary) : undefined,
    priority,
    reason: p?.reason ? String(p.reason) : undefined,
    source: "ai",
    openTicketId: null,
  };
}

/** Ask Gemini; returns parsed JSON, or null if unavailable/malformed. */
async function askGemini(prompt: string): Promise<any | null> {
  if (!DEFAULT_GEMINI_KEY) return null;
  try {
    const model = genAI().getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    });
    const res = await model.generateContent(prompt);
    return JSON.parse(res.response.text());
  } catch {
    return null;
  }
}

/** Fallback to OpenAI when Gemini is down; returns parsed JSON or null. */
async function askOpenAI(prompt: string): Promise<any | null> {
  if (!env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const c = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const txt = c.choices[0]?.message?.content;
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}
