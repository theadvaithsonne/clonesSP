// src/services/signupOffer.ts
//
// Fires once per new account: mints a CATALOG magic link (every active
// NetworkChain term on one page) and emails it, so the 24-hour free-first-month
// window that opens at sign-up is actually put in front of the user.
//
// Called from a post-save hook on the User model, which is why everything here
// is defensive: this must never be able to fail an account creation. Every
// failure path logs and returns rather than throwing, and the caller invokes it
// fire-and-forget.
//
// Idempotent on (userId, client, catalog-link): re-running finds the existing
// link and skips the send, so a retried signup can't double-mail anyone.

import { Types } from "mongoose";
import { env } from "../config/env";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";
import { MagicLink, generateMagicLinkToken } from "../models/magicLink.model";
import { quoteAllPlans } from "./comboCheckout";
import {
  sendMail,
  offerMagicLinkTemplate,
  EMAIL_FROM_NOTIFICATION,
} from "./mailer";

/**
 * Kill switch for bulk contexts — seed scripts, backfills, imports — where a
 * few hundred User.create() calls must not turn into a few hundred emails.
 *
 * Scripts that create users should call `setSignupOffersEnabled(false)` before
 * doing so. Defaults to on, because the common case is a real signup.
 */
let ENABLED = true;
export function setSignupOffersEnabled(on: boolean) {
  ENABLED = on;
}

/**
 * Send the sign-up offer to a brand-new user.
 *
 * Returns quietly (never throws) when there is nothing sensible to do: no
 * email address, no configured partner, no sellable terms, or a link already
 * sent. The caller cannot handle any of those anyway.
 */
export async function sendSignupOffer(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!ENABLED) return { sent: false, reason: "disabled" };
  if (!input.email) return { sent: false, reason: "no_email" };

  try {
    // The offer only exists for a subscription-enabled partner. There is
    // exactly one today (NetworkChain); picking the first active one keeps this
    // from hard-coding an id.
    const client = await ThirdPartyClient.findOne({
      isActive: true,
      "productConfig.recurringPeriod": { $exists: true },
      "productConfig.productCode": { $exists: true },
    });
    if (!client) return { sent: false, reason: "no_active_client" };

    const userId = new Types.ObjectId(input.userId);

    // Idempotency: one catalog link per user per partner, ever.
    const existing = await MagicLink.findOne({
      userId,
      thirdPartyClientId: client._id,
      termMonths: { $exists: false },
    });
    if (existing?.emailSentAt) {
      return { sent: false, reason: "already_sent" };
    }

    const quotes = await quoteAllPlans({ userId: input.userId, client });
    if (!quotes.length) return { sent: false, reason: "no_sellable_plans" };
    // Cheapest entry point is the headline — "from $25", not an arbitrary term.
    const headline = quotes.reduce((a, b) => (b.cartUsd < a.cartUsd ? b : a));

    const link =
      existing ||
      (await MagicLink.create({
        token: generateMagicLinkToken(),
        userId,
        thirdPartyClientId: client._id,
        // No termMonths — this is the catalog.
        // Self-attributed: nobody minted it on the user's behalf.
        createdByUserId: userId,
      }));

    const base = (env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
    const url = `${base}/magic-link/${link.token}`;

    const tpl = offerMagicLinkTemplate({
      recipientName: input.name,
      senderName: null,
      clientName: headline.clientName,
      planLabel: headline.planLabel,
      cartUsd: headline.cartUsd,
      freeMonth: headline.freeMonth,
      monthsOfAccess: headline.monthsOfAccess,
      offerExpiresAt: headline.window.expiresAt,
      catalog: true,
      planCount: quotes.length,
      plans: quotes.map((q) => ({
        planLabel: q.planLabel,
        cartUsd: q.cartUsd,
        monthsOfAccess: q.monthsOfAccess,
        freeMonth: q.freeMonth,
        includesLicence: q.includesLicence,
        licenceUsd: q.licenceUsd,
        renewalUsd: q.renewalUsd,
        renewalMonths: q.termMonths,
      })),
      includesLicence: headline.includesLicence,
      licenceUsd: headline.licenceUsd,
      renewalUsd: headline.renewalUsd,
      renewalMonths: headline.termMonths,
      link: url,
    });

    await sendMail(
      input.email,
      tpl.subject,
      tpl.html,
      tpl.text,
      EMAIL_FROM_NOTIFICATION
    );

    link.emailSentAt = new Date();
    await link.save();

    console.log(
      `[SignupOffer] sent to ${input.email} — ${quotes.length} plans, from $${headline.cartUsd}, expires ${headline.window.expiresAt?.toISOString()}`
    );
    return { sent: true };
  } catch (err: any) {
    // Never surface: this runs inside a post-save hook on User.
    console.error(
      `[SignupOffer] failed for ${input.email}: ${err?.message || err}`
    );
    return { sent: false, reason: "error" };
  }
}
