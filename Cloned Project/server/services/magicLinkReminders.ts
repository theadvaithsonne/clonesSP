// src/services/magicLinkReminders.ts
//
// Countdown emails for an unclaimed NetworkChain offer: 18h, 12h, 6h and 1h
// before the 24-hour window closes.
//
// Starts only once the magic link's FIRST email has gone out (`emailSentAt`),
// so a link minted but never delivered never generates reminders.
//
// Design notes worth keeping:
//
//   * The sweep is driven by the offer window, not by wall-clock offsets from
//     the send. `comboWindowFor` is the single source of truth for when the
//     offer ends — including admin extensions, which push every remaining
//     reminder out with it.
//
//   * A backlog COLLAPSES. If the process was down from 18h to 5h remaining,
//     the 18/12/6 marks are all overdue; we send only the most urgent one and
//     record the rest as handled. Sending three emails in one minute is worse
//     than sending none.
//
//   * Idempotency is a per-link array of marks, written with an atomic
//     `$addToSet` guarded by a `$nin` filter, so two overlapping ticks (or two
//     replicas) cannot both send the same mark.
//
//   * Each CHANNEL keeps its own array and is claimed and sent independently.
//     A shared list would mean a WhatsApp outage at the 12h mark also retired
//     the 12h email — one provider being down must not cost the recipient a
//     notification on a channel that was working.
//
//   * The claim is taken BEFORE the send, so a send that throws burns that
//     channel's mark rather than retrying. That is deliberate and inherited:
//     re-sending on the next tick risks duplicates when a provider fails after
//     it has already delivered, and for a countdown message a duplicate is
//     worse than a miss.

import { Types } from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { Invoice } from "../models/invoice.model";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";
import { MagicLink } from "../models/magicLink.model";
import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import { comboWindowFor } from "./comboWindow";
import { quoteAllPlans } from "./comboCheckout";
import {
  sendMail,
  offerReminderTemplate,
  EMAIL_FROM_NOTIFICATION,
} from "./mailer";
import {
  sendMagicLinkWhatsapp,
  elevenZaMagicLinkConfigured,
} from "./elevenZaWhatsapp";

/** "Hours to go" marks, descending. */
export const REMINDER_MARKS = [18, 12, 6, 1] as const;

/**
 * Suppress the WhatsApp "buy the $25 package" countdown for bat246 members
 * only — product asked to stop it for bat246 people, not for everyone on the
 * offer. A bat246 member is anyone in the bat246 org or on the bat246
 * distributor list. Email reminders are unaffected. Set
 * OFFER_REMINDER_WHATSAPP_MUTE_BAT246=false in the env to turn it back on.
 */
const MUTE_BAT246_WHATSAPP =
  process.env.OFFER_REMINDER_WHATSAPP_MUTE_BAT246 !== "false";
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

/** Matches setSignupOffersEnabled — lets scripts and tests opt out of sending. */
let ENABLED = true;
export function setOfferRemindersEnabled(on: boolean) {
  ENABLED = on;
}

export interface ReminderSweepResult {
  scanned: number;
  /** Deliveries, counted per channel — one link can add two. */
  sent: number;
  sentEmail: number;
  sentWhatsapp: number;
  collapsed: number;
  skippedPurchased: number;
  skippedExpired: number;
  errors: number;
}

/**
 * A delivery channel for the countdown.
 *
 * `field` is the per-link array of marks already handled on that channel. They
 * are separate documents fields so one channel failing can never retire
 * another channel's mark.
 */
const CHANNELS = [
  { name: "email" as const, field: "remindersSent" as const },
  { name: "whatsapp" as const, field: "remindersSentWhatsapp" as const },
];

/**
 * One pass over every active, already-emailed magic link.
 *
 * Safe to run on any cadence. A 15-minute tick keeps the 1-hour mark accurate
 * to within a quarter hour; running it hourly still works, just coarser.
 */
export async function sweepOfferReminders(
  now: Date = new Date()
): Promise<ReminderSweepResult> {
  const out: ReminderSweepResult = {
    scanned: 0,
    sent: 0,
    sentEmail: 0,
    sentWhatsapp: 0,
    collapsed: 0,
    skippedPurchased: 0,
    skippedExpired: 0,
    errors: 0,
  };
  if (!ENABLED) return out;

  // Only links that have had their opening email and haven't been consumed.
  const links = await MagicLink.find({
    status: "active",
    emailSentAt: { $exists: true, $ne: null },
  }).lean();
  out.scanned = links.length;
  if (!links.length) return out;

  // bat246 members — the only recipients whose WhatsApp nudge is muted. Union
  // of the bat246 org's members and the bat246 distributor list, loaded once
  // for the whole sweep. Fails open (empty set = nobody muted) so a lookup
  // problem never silences legitimate reminders.
  const bat246UserIds = new Set<string>();
  if (MUTE_BAT246_WHATSAPP) {
    try {
      const [orgMembers, distributors] = await Promise.all([
        User.find({
          "organizations.organization": new Types.ObjectId(BAT246_ORG_ID),
        })
          .select("_id")
          .lean(),
        Bat246Distributor.find({}).select("userId").lean(),
      ]);
      for (const u of orgMembers as any[]) bat246UserIds.add(String(u._id));
      for (const d of distributors as any[]) bat246UserIds.add(String(d.userId));
    } catch (err) {
      console.warn("[OfferReminder] bat246 mute lookup failed:", err);
    }
  }

  // One client lookup for the whole sweep rather than one per link.
  const clientCache = new Map<string, any>();

  for (const link of links) {
    try {
      const user = await User.findById(link.userId)
        // phone/phoneVerified decide whether the WhatsApp copy can go.
        .select(
          "email name phone phoneVerified profileCompletedAt offerExpiresAtOverride"
        )
        .lean<any>();
      // A user reachable on neither channel has nothing to receive. Note this
      // is no longer "no email → skip": a phone-only recipient still gets the
      // WhatsApp countdown.
      const canEmail = !!user?.email;
      const canWhatsapp =
        !!user?.phone &&
        !!user?.phoneVerified &&
        elevenZaMagicLinkConfigured() &&
        // Mute the WhatsApp "buy the $25 package" nudge for bat246 members
        // only. Everyone else on the offer still gets it; email is untouched.
        !bat246UserIds.has(String(link.userId));
      if (!canEmail && !canWhatsapp) continue;

      const w = comboWindowFor(user, now);
      if (!w.open) {
        out.skippedExpired++;
        continue;
      }

      const hoursRemaining = w.secondsRemaining / 3600;

      /**
       * What each channel owes, worked out separately.
       *
       * Collapse still applies per channel: if the process was down from 18h
       * to 5h remaining, only the most urgent mark is sent and the rest are
       * retired. Three messages in one minute is worse than one.
       */
      const plan = CHANNELS.map((ch) => {
        const eligible = ch.name === "email" ? canEmail : canWhatsapp;
        if (!eligible) return { ch, due: [] as number[], toSend: 0 };
        const already = new Set<number>((link as any)[ch.field] || []);
        const due = REMINDER_MARKS.filter(
          (m) => hoursRemaining <= m && !already.has(m)
        );
        return {
          ch,
          due: due as unknown as number[],
          toSend: due.length ? Math.min(...due) : 0,
        };
      }).filter((p) => p.due.length > 0);

      if (!plan.length) continue;
      for (const p of plan) {
        if (p.due.length > 1) out.collapsed += p.due.length - 1;
      }

      // Don't chase someone who already bought.
      const live = await Invoice.exists({
        userId: link.userId,
        thirdPartyClientId: link.thirdPartyClientId,
        parentInvoiceId: { $exists: false },
        status: "paid",
        cancelledAt: null,
        nextDueDate: { $gt: now },
      });
      if (live) {
        await MagicLink.updateOne(
          { _id: link._id },
          { $set: { status: "consumed", consumedAt: now } }
        );
        out.skippedPurchased++;
        continue;
      }

      const clientKey = String(link.thirdPartyClientId);
      let client = clientCache.get(clientKey);
      if (!client) {
        client = await ThirdPartyClient.findById(link.thirdPartyClientId);
        if (client) clientCache.set(clientKey, client);
      }
      if (!client?.productConfig) continue;

      // Same call for single-plan and catalog links: the reminder only quotes
      // a "from $X" headline, which is the cheapest entry either way.
      const quotes = await quoteAllPlans({
        userId: String(link.userId),
        client,
        now,
      });
      if (!quotes.length) continue;
      const headline = quotes.reduce((a, b) => (b.cartUsd < a.cartUsd ? b : a));

      const base = (env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
      const url = `${base}/magic-link/${link.token}`;

      /**
       * Send each channel under its own claim and its own try/catch.
       *
       * The claim is a compare-and-set: `$nin` means a concurrent tick that
       * lost the race matches 0 documents and bails, so a mark is sent once.
       * Because the arrays are per channel, WhatsApp failing here cannot stop
       * the email below it — which is the whole point of the split.
       */
      for (const { ch, due, toSend } of plan) {
        try {
          const claim = await MagicLink.updateOne(
            { _id: link._id, [ch.field]: { $nin: due } } as any,
            { $addToSet: { [ch.field]: { $each: due } } } as any
          );
          if (claim.modifiedCount === 0) continue;

          if (ch.name === "email") {
            const tpl = offerReminderTemplate({
              recipientName: user.name,
              clientName: headline.clientName,
              hoursRemaining: toSend,
              cartUsd: headline.cartUsd,
              planCount: quotes.length,
              link: url,
            });
            await sendMail(
              user.email,
              tpl.subject,
              tpl.html,
              tpl.text,
              EMAIL_FROM_NOTIFICATION
            );
            out.sentEmail++;
          } else {
            // Same wording the initial WhatsApp send uses, so a reminder can't
            // quote a different price from the link it is chasing.
            await sendMagicLinkWhatsapp({
              phone: user.phone,
              recipientName: user.name,
              clientName: headline.clientName,
              headingLine: `${quotes.length} plan${
                quotes.length === 1 ? "" : "s"
              } to choose from`,
              price:
                headline.cartUsd === 0 ? "free" : `from $${headline.cartUsd}`,
              offerExpiresAt: w.expiresAt,
              freeMonth: headline.freeMonth,
              link: url,
            });
            out.sentWhatsapp++;
          }

          out.sent++;
          console.log(
            `[OfferReminder] ${toSend}h ${ch.name} -> ${
              ch.name === "email" ? user.email : "phone"
            }` + (due.length > 1 ? ` (collapsed ${due.join("/")})` : "")
          );
        } catch (chErr: any) {
          // Scoped to this channel: the loop continues so the other one still
          // goes out.
          out.errors++;
          console.error(
            `[OfferReminder] ${ch.name} ${toSend}h failed for link ${link.token}: ` +
              (chErr?.message || chErr)
          );
        }
      }
    } catch (err: any) {
      out.errors++;
      console.error(
        `[OfferReminder] link ${link.token} failed: ${err?.message || err}`
      );
    }
  }

  if (out.sent || out.errors) {
    console.log(
      `[OfferReminder] sweep: scanned=${out.scanned} sent=${out.sent} ` +
        `(email=${out.sentEmail} whatsapp=${out.sentWhatsapp}) ` +
        `collapsed=${out.collapsed} purchased=${out.skippedPurchased} ` +
        `expired=${out.skippedExpired} errors=${out.errors}`
    );
  }
  return out;
}
