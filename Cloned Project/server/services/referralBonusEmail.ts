import { sendMail, senderForOrg, EMAIL_FROM_NOTIFICATION } from "./mailer";
import { emailShell, ctaButton, fallbackLink, greeting, bodyText } from "./bulkEmail";
import { env } from "../config/env";

/**
 * The two emails that go out when a signup referral bonus is paid.
 *
 * ── When these fire ──────────────────────────────────────────────────────
 * ONLY after the payout transaction has committed. Sending from inside the
 * transaction would mean a rollback leaves behind an email announcing money
 * that was never paid — and Resend has no undo. `payReferralSignupBonus`
 * calls this once, on `result === "paid"`, which the unique index on
 * `refereeUserId` already makes a once-per-user event. That is what stops a
 * user re-triggering the mail by editing their profile again.
 *
 * ── Why two separate sends ───────────────────────────────────────────────
 * Each side is told a different thing (you earned / you received) and, more
 * importantly, each is sent from THEIR org's verified domain. A white-label
 * referrer and a Garage-HQ referee must not both receive mail from whichever
 * org happened to be looked up first. They are also awaited independently:
 * a bounce on one address must not swallow the other's email.
 *
 * ── Never throws ─────────────────────────────────────────────────────────
 * The money has already moved by the time this runs. An SMTP problem is a
 * missing notification, not a failed payout, and must never be reported as
 * one. Failures are logged loudly and returned as flags so the caller can
 * stamp the payout row.
 */

const FONT_BRAND = "#FBD10D";

/** Names and org names are user-authored — they reach the inbox as HTML. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstNameOf(fullName?: string | null, email?: string | null): string {
  const name = String(fullName || "").trim();
  if (name) return name.split(/\s+/)[0];
  const local = String(email || "").split("@")[0];
  return local || "";
}

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Deep link to the credited wallet.
 *
 * GaragePay is an in-app tab, not a route — `/revenue-network/wallet` 404s
 * (see the same note on `rewardsLink` in mailer.ts, where that mistake shipped
 * in every coupon email). `openApp` opens the app, `tab=store` selects the
 * Store Vault, and `orgId` scopes it to the org whose wallet was actually
 * credited, which matters for white-label users.
 */
function walletLink(orgId?: string | null): string {
  const base = `${env.FRONTEND_URL}/workspace?openApp=garagepay&tab=store`;
  return orgId ? `${base}&orgId=${encodeURIComponent(String(orgId))}` : base;
}

/** The shared "you were credited X" panel both emails carry. */
function amountCard(amount: number, caption: string): string {
  return `
<div style="background-color:#262638;border-left:4px solid ${FONT_BRAND};padding:22px;margin:24px 0;border-radius:8px;text-align:center;">
  <div style="color:${FONT_BRAND};font-size:34px;font-weight:700;letter-spacing:-0.5px;">${usd(amount)}</div>
  <div style="margin-top:6px;color:#888;font-size:13px;">${esc(caption)}</div>
</div>`;
}

export interface ReferralBonusEmailParty {
  email?: string | null;
  name?: string | null;
  /** Org whose store wallet was credited — drives sender AND the deep link. */
  orgId?: string | null;
}

export interface ReferralBonusEmailArgs {
  referrer: ReferralBonusEmailParty;
  referee: ReferralBonusEmailParty;
  /** Paid to EACH side, not the total debited. */
  amount: number;
}

/** Split from the send so the rendered output can be inspected in tests. */
export function buildReferrerEmail(a: ReferralBonusEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const to = String(a.referrer.email || "").trim();
  const name = firstNameOf(a.referrer.name, to);
  const who =
    firstNameOf(a.referee.name, a.referee.email) || a.referee.email || "someone";
  const link = walletLink(a.referrer.orgId);

  const header = `<h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">You earned a referral bonus</h1>`;
  const body = `
    ${greeting(esc(name))}
    ${bodyText(`<strong style="color:#EAEAEA;">${esc(who)}</strong> just joined Garage using your referral link — and your bonus has already been added to your Store Vault.`)}
    ${amountCard(a.amount, "Added to your Store Vault")}
    ${bodyText("Nothing to claim. It is spendable right now, and every future referral pays the same.")}
    ${ctaButton(link, "View your balance")}
    ${fallbackLink(link)}
  `;

  const text = `${name ? `Hi ${name},` : "Hi there,"}

${who} just joined Garage using your referral link.

You earned ${usd(a.amount)} — already added to your Store Vault. Nothing to claim.

View your balance: ${link}

— Garage`;

  return {
    subject: `You earned ${usd(a.amount)} — ${who} joined through your referral`,
    html: emailShell(header, body),
    text,
  };
}

async function sendReferrerEmail(a: ReferralBonusEmailArgs): Promise<boolean> {
  const to = String(a.referrer.email || "").trim();
  if (!to) return false;
  const { subject, html, text } = buildReferrerEmail(a);
  const from = await senderForOrg(a.referrer.orgId, EMAIL_FROM_NOTIFICATION);
  await sendMail(to, subject, html, text, from);
  return true;
}

export function buildRefereeEmail(a: ReferralBonusEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const to = String(a.referee.email || "").trim();
  const name = firstNameOf(a.referee.name, to);
  const by = firstNameOf(a.referrer.name, a.referrer.email);
  const link = walletLink(a.referee.orgId);

  const header = `<h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">Welcome — here's your joining bonus</h1>`;
  const body = `
    ${greeting(esc(name))}
    ${bodyText(
      by
        ? `Thanks for joining Garage through ${esc(by)}'s referral. We've credited a welcome bonus to your Store Vault to get you started.`
        : `Thanks for joining Garage through a referral. We've credited a welcome bonus to your Store Vault to get you started.`
    )}
    ${amountCard(a.amount, "Added to your Store Vault")}
    ${bodyText("It's yours to spend across Garage straight away — no claim step, no expiry.")}
    ${ctaButton(link, "View your balance")}
    ${fallbackLink(link)}
  `;

  const text = `${name ? `Hi ${name},` : "Hi there,"}

Thanks for joining Garage${by ? ` through ${by}'s referral` : " through a referral"}.

We've credited ${usd(a.amount)} to your Store Vault. It's yours to spend straight away.

View your balance: ${link}

— Garage`;

  return {
    subject: `Welcome to Garage — ${usd(a.amount)} is in your wallet`,
    html: emailShell(header, body),
    text,
  };
}

async function sendRefereeEmail(a: ReferralBonusEmailArgs): Promise<boolean> {
  const to = String(a.referee.email || "").trim();
  if (!to) return false;
  const { subject, html, text } = buildRefereeEmail(a);
  const from = await senderForOrg(a.referee.orgId, EMAIL_FROM_NOTIFICATION);
  await sendMail(to, subject, html, text, from);
  return true;
}

/**
 * Sends both. Returns which ones actually went out so the payout row can be
 * stamped — a silently missing notification is otherwise invisible.
 */
export async function sendReferralBonusEmails(
  a: ReferralBonusEmailArgs
): Promise<{ referrerSent: boolean; refereeSent: boolean }> {
  // allSettled, not all: one bad address must not cancel the other send.
  const [referrer, referee] = await Promise.allSettled([
    sendReferrerEmail(a),
    sendRefereeEmail(a),
  ]);

  if (referrer.status === "rejected") {
    console.error(
      `[referral-bonus] referrer email to ${a.referrer.email} failed:`,
      referrer.reason?.message || referrer.reason
    );
  }
  if (referee.status === "rejected") {
    console.error(
      `[referral-bonus] referee email to ${a.referee.email} failed:`,
      referee.reason?.message || referee.reason
    );
  }

  return {
    referrerSent: referrer.status === "fulfilled" && referrer.value,
    refereeSent: referee.status === "fulfilled" && referee.value,
  };
}
