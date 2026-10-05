// Admin notification dispatch: an event happened — which rules fire, who gets
// mailed, and did we already handle it.
//
// Callers must treat this as fire-and-forget and never await it on a request
// path: a notification failure must never fail the payment or signup that
// raised the event. `emitAdminEvent` catches everything itself, but the caller
// should still schedule it off the hot path (see paymentEvents.ts).

import { Types } from "mongoose";
import { AdminNotificationRule, RecipientSpec } from "../../models/adminNotificationRule.model";
import { AdminNotificationLog } from "../../models/adminNotificationLog.model";
import { User } from "../../models/user.model";
import { GarageAdminModel } from "../../models/garageAdmin.model";
import { findEvent } from "../../config/adminNotificationEvents";
import { sendMail, EMAIL_FROM_NOTIFICATION } from "../mailer";
import { evaluate, EvalPayload, EvalUser } from "./evaluate";

/** Hard ceiling regardless of what a rule's `recipientCap` says. */
const ABSOLUTE_RECIPIENT_CAP = 200;
/** An upline can be very deep; mailing all of it is never what anyone meant. */
const UPLINE_CAP = 25;

export interface EmitSummaryRow {
  label: string;
  value: string;
}

export async function emitAdminEvent(args: {
  eventName: string;
  /** Stable per real-world occurrence — the idempotency key with ruleId. */
  eventId: string;
  payload: EvalPayload;
  /** Human-readable lines for the email body, in order. */
  summary: EmitSummaryRow[];
}): Promise<void> {
  const { eventName, eventId, payload, summary } = args;
  try {
    const event = findEvent(eventName);
    if (!event) {
      console.error(`[AdminNotifications] emit for unregistered event "${eventName}"`);
      return;
    }

    const rules = await AdminNotificationRule.find({ event: eventName, enabled: true }).lean();
    if (rules.length === 0) return;

    for (const rule of rules) {
      try {
        if (!evaluate(rule.conditions, payload, event)) continue;
        await deliver(rule, event.label, eventId, payload, summary);
      } catch (err) {
        // One broken rule must not stop the others.
        console.error(`[AdminNotifications] rule ${rule._id} failed on ${eventName}/${eventId}:`, err);
      }
    }
  } catch (err) {
    console.error(`[AdminNotifications] emit ${eventName}/${eventId} failed:`, err);
  }
}

async function deliver(
  rule: any,
  eventLabel: string,
  eventId: string,
  payload: EvalPayload,
  summary: EmitSummaryRow[],
) {
  const cap = Math.min(Number(rule.recipientCap) || 50, ABSOLUTE_RECIPIENT_CAP);
  const recipients = (await resolveRecipients(rule.recipients || [], payload)).slice(0, cap);

  // Claim the (rule, event) slot BEFORE sending. The unique index makes this
  // the idempotency lock: a second emit for the same event — a retry, or the
  // delayed autodebit re-check — hits a duplicate key and stops here, so no
  // rule can ever mail twice for one payment.
  let log;
  try {
    log = await AdminNotificationLog.create({
      ruleId: rule._id,
      ruleName: rule.name,
      eventName: rule.event,
      eventId,
      recipients,
      status: "queued",
    });
  } catch (err: any) {
    if (err?.code === 11000) return; // already handled
    throw err;
  }

  if (recipients.length === 0) {
    log.status = "skipped_no_recipients";
    await log.save();
    return;
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentLastHour = await AdminNotificationLog.countDocuments({
    ruleId: rule._id,
    status: "sent",
    createdAt: { $gte: hourAgo },
  });
  if (sentLastHour >= (Number(rule.throttlePerHour) || 60)) {
    log.status = "skipped_throttle";
    await log.save();
    console.warn(`[AdminNotifications] rule ${rule._id} throttled (${sentLastHour}/h)`);
    return;
  }

  const subject = `${rule.name} — ${eventLabel}`;
  const html = renderEmail(rule.name, eventLabel, summary);
  const text = [`${rule.name}`, eventLabel, "", ...summary.map((r) => `${r.label}: ${r.value}`)].join("\n");

  // One message per recipient, so recipients never see each other's address.
  const failures: string[] = [];
  for (const to of recipients) {
    try {
      await sendMail(to, subject, html, text, EMAIL_FROM_NOTIFICATION);
    } catch (err: any) {
      failures.push(`${to}: ${err?.message || "send failed"}`);
    }
  }

  log.status = failures.length === recipients.length ? "failed" : "sent";
  if (failures.length) log.error = failures.join("; ").slice(0, 1000);
  await log.save();
  await AdminNotificationRule.updateOne({ _id: rule._id }, { $set: { lastFiredAt: new Date() } });
}

/** Flatten a rule's recipient specs into deduped, lower-cased addresses. */
async function resolveRecipients(specs: RecipientSpec[], payload: EvalPayload): Promise<string[]> {
  const out = new Set<string>();
  const add = (e?: string | null) => {
    const v = (e || "").trim().toLowerCase();
    if (v && v.includes("@")) out.add(v);
  };

  for (const spec of specs) {
    switch (spec?.type) {
      case "static":
        (spec.emails || []).forEach(add);
        break;
      case "relation": {
        const subject = payload.user as EvalUser | undefined;
        const sponsor = payload.sponsor as EvalUser | undefined;
        if (spec.relation === "subject") add(subject?.email);
        else if (spec.relation === "sponsor") add(sponsor?.email);
        else if (spec.relation === "upline" && subject?.ancestors?.length) {
          // Nearest first: ancestors[] is ordered root → direct parent.
          const ids = subject.ancestors
            .slice(-UPLINE_CAP)
            .filter((id) => Types.ObjectId.isValid(id));
          const ups = await User.find({ _id: { $in: ids } }).select("email").lean();
          ups.forEach((u: any) => add(u.email));
        }
        // officeOwner has no meaning for a payment event; resolves to nobody.
        break;
      }
      case "role": {
        const admins = await GarageAdminModel.find({ role: spec.role, isActive: true })
          .select("email")
          .lean();
        admins.forEach((a: any) => add(a.email));
        break;
      }
      // "query" recipients are not implemented yet and resolve to nobody —
      // the builder cannot author them, and a query that mails thousands is
      // exactly the thing that should not ship unreviewed.
      default:
        break;
    }
  }
  return [...out];
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function renderEmail(ruleName: string, eventLabel: string, summary: EmitSummaryRow[]): string {
  const rows = summary
    .map(
      (r) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top;">${escapeHtml(r.label)}</td>` +
        `<td style="padding:6px 0;color:#111;">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.04em;">Garage admin notification</p>
      <h2 style="margin:0 0 4px;">${escapeHtml(eventLabel)}</h2>
      <p style="margin:0 0 16px;color:#666;">Rule: ${escapeHtml(ruleName)}</p>
      <table style="border-collapse:collapse;font-size:14px;">${rows}</table>
      <p style="margin:20px 0 0;font-size:12px;color:#999;">Sent because this rule is enabled in Garage Admin → Notifications.</p>
    </div>`;
}
