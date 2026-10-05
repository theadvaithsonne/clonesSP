// Auto-assign a freshly created support ticket to a garage admin.
//
// Called fire-and-forget right after a ticket is created (chat auto-ticket,
// user-filed, guest, or admin-raised). The AI reads the roster of active
// admins — their names and role labels ("Support Agent", "NVC", "Finance", …)
// — and picks the best fit for the ticket's topic. A human can override the
// choice at any time from the console (that sets assignedBy "admin"), so this
// only ever fills an UNassigned ticket and never touches one a person owns.
//
// Fails safe: if the models are down or pick nothing usable, it falls back to
// the least-loaded active admin so no ticket is left unowned. If there are no
// eligible admins at all, it leaves the ticket unassigned.
//
// Same Gemini provider/key as the triage + translate features (DEFAULT_GEMINI_KEY,
// NOT process.env.GEMINI_API_KEY — see betty.ts), with OpenAI as the fallback.

import { Types } from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { DEFAULT_GEMINI_KEY } from "../routes/betty";
import { env } from "../config/env";

const MODEL = "gemini-2.5-flash-lite";

// The super admin is excluded from auto-assignment by policy — tickets should
// land on the support team, not the owner. A human can still hand one to them.
const EXCLUDED_ROLES = new Set(["garage-super-admin"]);

let _genAI: GoogleGenerativeAI | null = null;
function genAI(): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(DEFAULT_GEMINI_KEY);
  return _genAI;
}

interface RosterAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Result of an assignment attempt, for the caller's log line. */
export interface AutoAssignResult {
  assignedToId: string;
  assignedToName: string;
  via: "ai" | "balance";
}

export async function autoAssignTicket(
  ticketId: string,
): Promise<AutoAssignResult | null> {
  try {
    if (!Types.ObjectId.isValid(ticketId)) return null;
    const { Ticket } = await import("../models/ticket.model");
    const ticket: any = await Ticket.findById(ticketId);
    if (!ticket) return null;
    // Never override a human (or an earlier) assignment.
    if (ticket.assignedToId) return null;

    const roster = await loadRoster();
    if (!roster.length) return null;

    // Ask the model to pick the best-fit admin; fall back to least-loaded.
    const pick = await pickBestFit(ticket, roster);
    let chosen = pick ? roster.find((a) => a.id === pick.adminId) || null : null;
    let via: "ai" | "balance" = "ai";
    let reason = pick?.reason || null;
    if (!chosen) {
      chosen = await leastLoaded(roster);
      via = "balance";
      reason = reason || "Balanced to the least-loaded agent.";
    }
    if (!chosen) return null;

    ticket.assignedToId = new Types.ObjectId(chosen.id);
    ticket.assignedToName = chosen.name;
    ticket.assignedToEmail = chosen.email;
    ticket.assignedBy = "ai";
    ticket.assignedAt = new Date();
    ticket.assignReason = reason ? String(reason).slice(0, 300) : null;
    await ticket.save();

    console.log(
      `[ticket-auto-assign] ${ticketId} -> ${chosen.name} (${chosen.id}) via=${via}`,
    );
    return { assignedToId: chosen.id, assignedToName: chosen.name, via };
  } catch (e: any) {
    console.warn("[ticket-auto-assign] failed:", e?.message || e);
    return null;
  }
}

/** Active admins eligible to receive tickets (super admin excluded). */
async function loadRoster(): Promise<RosterAdmin[]> {
  const { GarageAdminModel } = await import("../models/garageAdmin.model");
  const rows = await GarageAdminModel.find({ isActive: true })
    .select("name email role")
    .lean<any[]>();
  return rows
    .filter((r) => !EXCLUDED_ROLES.has(String(r.role || "")))
    .map((r) => ({
      id: String(r._id),
      name: String(r.name || r.email || "Admin"),
      email: String(r.email || ""),
      role: String(r.role || "garage-admin"),
    }));
}

/** The eligible admin with the fewest open/in-progress tickets right now. */
async function leastLoaded(roster: RosterAdmin[]): Promise<RosterAdmin | null> {
  if (!roster.length) return null;
  const { Ticket } = await import("../models/ticket.model");
  const counts = await Promise.all(
    roster.map(async (a) => ({
      admin: a,
      load: await Ticket.countDocuments({
        assignedToId: new Types.ObjectId(a.id),
        status: { $in: ["open", "in_progress"] },
      }),
    })),
  );
  counts.sort((x, y) => x.load - y.load);
  return counts[0]?.admin || null;
}

/**
 * Ask the AI which admin best fits the ticket. Returns { adminId, reason } with
 * an id guaranteed to be in the roster, or null when the models are unavailable
 * or return nothing usable (the caller then balances by load).
 */
async function pickBestFit(
  ticket: any,
  roster: RosterAdmin[],
): Promise<{ adminId: string; reason?: string } | null> {
  const rosterText = roster
    .map((a) => `- id:${a.id} | ${a.name} | role: ${roleLabel(a.role)}`)
    .join("\n");
  const prompt =
    `You route incoming support tickets to the right admin for a fintech and ` +
    `social app. Choose the single best admin for the ticket below, matching ` +
    `the ticket's topic to an admin's role where you can (e.g. billing/payment ` +
    `/withdrawal → Finance; login/technical → Support; network/affiliate → NVC). ` +
    `If no role clearly fits, pick any suitable support admin. Respond ONLY as ` +
    `minified JSON: {"adminId": string (one of the ids below, exactly), ` +
    `"reason": string (short)}.\n\n` +
    `Admins:\n${rosterText}\n\n` +
    `Ticket:\nTitle: ${String(ticket.title || "").slice(0, 200)}\n` +
    `Priority: ${ticket.priority || "medium"}\n` +
    `Category: ${ticket.category || "—"}\n` +
    `Description: ${String(ticket.description || "").replace(/\s+/g, " ").slice(0, 800)}`;

  const p = (await askGemini(prompt)) ?? (await askOpenAI(prompt));
  if (!p) return null;
  const adminId = String(p.adminId || "").trim();
  if (!roster.some((a) => a.id === adminId)) return null;
  return { adminId, reason: p.reason ? String(p.reason) : undefined };
}

function roleLabel(role: string): string {
  if (role === "garage-admin") return "Admin";
  if (role === "garage-super-admin") return "Super Admin";
  return role;
}

/** Ask Gemini; returns parsed JSON, or null if unavailable/malformed. */
async function askGemini(prompt: string): Promise<any | null> {
  if (!DEFAULT_GEMINI_KEY) return null;
  try {
    const model = genAI().getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
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
      temperature: 0.1,
    });
    const txt = c.choices[0]?.message?.content;
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}
