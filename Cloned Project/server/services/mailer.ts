// roam-backend/src/services/mailer.ts
import { Resend } from "resend";
import { env } from "../config/env";

const resend = new Resend(env.RESEND_API_KEY);

// ── Email "from" addresses by category ──────────────────────────────
/** Initial OTP emails (first-time login, checkout verification, etc.) */
export const EMAIL_FROM_OTP = "Garage <noreply@garageauth.com>";

/** Resend OTP emails (retry / resend flows) */
export const EMAIL_FROM_RESEND_OTP = "Garage <noreply@garageauth.com>";

/** Non-OTP emails (notifications, invites, bulk, subscriptions, events) */
export const EMAIL_FROM_NOTIFICATION = "Garage <noreply@mail.garagemail.in>";

/**
 * The from-address implied by the site a request came from.
 *
 * For account mail — login codes, invites, guest verification — the right
 * sender cannot be derived from the user: someone may belong to several
 * offices, and the one that matters is whichever white-label site they are
 * actually looking at. That comes from Origin/Referer, NOT Host: the front
 * end is served from the client's domain but calls this API on Garage's, so
 * Host here is always the API. See utils/requestOrg.
 *
 * Falls back whenever the site is Garage's own, unknown, or unverified.
 */
export async function senderForHost(
  req: { headers?: Record<string, any> } | null | undefined,
  fallback: string = EMAIL_FROM_NOTIFICATION
): Promise<string> {
  try {
    // Shared with the signup path so mail and membership can never disagree
    // about which office a request belongs to. See utils/requestOrg for why
    // Origin/Referer are read before Host.
    const { orgIdFromRequest } = await import("../utils/requestOrg");
    const orgId = await orgIdFromRequest(req);
    if (!orgId) return fallback;
    return senderForOrg(orgId, fallback);
  } catch {
    return fallback;
  }
}

/**
 * The from-address for an organization's mail.
 *
 * White-label orgs can send from their own domain once it is verified with
 * Resend (see services/resendDomains.ts and the /email-sender endpoints).
 * Anything not fully set up falls back to the Garage address.
 *
 * Gated strictly on `status === "verified"`. Resend rejects a send from an
 * unverified domain outright, so using one early would not degrade politely —
 * it would throw and the email would be lost. Arriving as Garage is visible
 * and fixable; not arriving at all is not.
 *
 * Never throws: an unreachable database must not stop a notification going out
 * under the default sender.
 */
export async function senderForOrg(
  orgId?: string | { toString(): string } | null,
  fallback: string = EMAIL_FROM_NOTIFICATION
): Promise<string> {
  if (!orgId) return fallback;
  try {
    const { Organization } = await import("../models/organization.model");
    const org = await Organization.findById(String(orgId))
      .select("name emailSender")
      .lean<any>();

    const cfg = org?.emailSender;
    if (!cfg?.fromEmail || cfg.status !== "verified") return fallback;

    const name = String(cfg.fromName || org?.name || "").trim();
    // A display name containing a comma must be quoted, or the header parses
    // as two addresses and the send fails.
    const safeName = name.includes(",")
      ? `"${name.replace(/"/g, "")}"`
      : name;
    return safeName ? `${safeName} <${cfg.fromEmail}>` : cfg.fromEmail;
  } catch {
    return fallback;
  }
}

/**
 * Sends an email using Resend. `cc` may be a single address or an array;
 * Resend accepts both and de-dupes any address that also appears in `to`.
 */
export async function sendMail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  from?: string,
  cc?: string | string[]
) {
  try {
    const { data, error } = await resend.emails.send({
      from: from || env.RESEND_FROM,
      to,
      subject,
      html,
      text: text || undefined,
      ...(cc && (Array.isArray(cc) ? cc.length > 0 : cc.length > 0)
        ? { cc }
        : {}),
    });

    if (error) {
      console.error("Error sending email via Resend:", error);
      throw new Error("Failed to send email via Resend.");
    }

    console.log("Email sent via Resend successfully:", data?.id);
    return data;
  } catch (error: any) {
    console.error("Error sending email via Resend:", error.message);
    throw new Error("Failed to send email via Resend.");
  }
}

/**
 * This template function remains unchanged as it only generates content.
 */
export function inviteEmailTemplate(
  email: string,
  code: string,
  orgId: string
) {
  const link = `${env.FRONTEND_URL}/accept-invite?email=${encodeURIComponent(
    email
  )}&code=${encodeURIComponent(code)}&orgId=${encodeURIComponent(orgId)}`;
  return {
    subject: "You are invited – Verify & join",
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111">
<p>You've been invited to join a workspace.</p>
<p>Your OTP is <b>${code}</b> (valid 10 minutes).</p>
<p>
<a href="${link}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#4b0082;color:#fff;text-decoration:none">
Verify & Join
</a>
</p>
<p>If the button doesn't work, open this link:<br />${link}</p>
</div>
`,
  };
}

/**
 * Guest request confirmation email template
 */
export function guestRequestEmailTemplate(email: string, orgName: string) {
  return {
    subject: `Your request to join ${orgName}`,
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111">
<h2>Request Submitted</h2>
<p>Your request to join <b>${orgName}</b> has been submitted successfully.</p>
<p>The organization founders will review your request and you'll receive an email once they respond.</p>
<p>Thank you for your interest!</p>
</div>
`,
  };
}

/**
 * Guest approval email template (sent when founder approves)
 */
export function guestApprovalEmailTemplate(
  email: string,
  code: string,
  orgId: string,
  orgName: string
) {
  const link = `${env.FRONTEND_URL}/accept-invite?email=${encodeURIComponent(
    email
  )}&code=${encodeURIComponent(code)}&orgId=${encodeURIComponent(
    orgId
  )}&guest=true`;
  return {
    subject: `You've been accepted to join ${orgName}!`,
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111">
<h2>Great News!</h2>
<p>Your request to join <b>${orgName}</b> has been approved!</p>
<p>Your OTP is <b>${code}</b> (valid 10 minutes).</p>
<p>
<a href="${link}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#4b0082;color:#fff;text-decoration:none">
Complete Your Registration
</a>
</p>
<p>If the button doesn't work, open this link:<br />${link}</p>
</div>
`,
  };
}

/**
 * Guest rejection email template (optional)
 */
export function guestRejectionEmailTemplate(email: string, orgName: string) {
  return {
    subject: `Update on your request to join ${orgName}`,
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111">
<p>Thank you for your interest in joining <b>${orgName}</b>.</p>
<p>Unfortunately, your request cannot be approved at this time.</p>
<p>Feel free to explore other organizations on our platform.</p>
</div>
`,
  };
}

/**
 * Send event guest invitation email
 */
export async function sendEventGuestInvitation(
  guestEmail: string,
  eventDetails: {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
    creatorName: string;
  },
  joinLink: string
) {
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(date);
  };

  const subject = `You're invited to join: ${eventDetails.title}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">You're Invited!</h1>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        <strong>${eventDetails.creatorName}</strong> has invited you to join a video meeting:
      </p>

      <!-- Event Details Card -->
      <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 8px;">
        <h2 style="margin: 0 0 15px; color: #1a1a1a; font-size: 22px; font-weight: 600;">${eventDetails.title}</h2>
        ${eventDetails.description ? `<p style="margin: 0 0 15px; color: #555555; font-size: 15px; line-height: 1.5;">${eventDetails.description}</p>` : ''}

        <!-- Date and Time -->
        <div style="margin-top: 20px;">
          <div style="display: inline-block; margin-right: 10px;">
            <svg width="20" height="20" style="vertical-align: middle; margin-right: 8px;" viewBox="0 0 24 24" fill="none" stroke="#667eea" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span style="color: #555555; font-size: 14px; vertical-align: middle;">
              <strong>Start:</strong> ${formatDateTime(eventDetails.startTime)}
            </span>
          </div>
          <br>
          <div style="display: inline-block; margin-top: 8px;">
            <svg width="20" height="20" style="vertical-align: middle; margin-right: 8px;" viewBox="0 0 24 24" fill="none" stroke="#667eea" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span style="color: #555555; font-size: 14px; vertical-align: middle;">
              <strong>End:</strong> ${formatDateTime(eventDetails.endTime)}
            </span>
          </div>
        </div>
      </div>

      <!-- Join Button -->
      <div style="text-align: center; margin: 35px 0;background-color:blue;">
        <a href="${joinLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
          Join Meeting
        </a>
      </div>

      <!-- Info Box -->
      <div style="background-color: #e8f4fd; border: 1px solid #b3d9f2; border-radius: 8px; padding: 16px; margin: 25px 0;">
        <p style="margin: 0; color: #0c5490; font-size: 14px; line-height: 1.6;">
          <strong>📌 No account needed!</strong><br>
          Click the button above to join the meeting. You'll be asked to enter your name before joining the call.
        </p>
      </div>

      <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin: 8px 0 0; padding: 12px; background-color: #f5f5f5; border-radius: 6px; word-break: break-all; font-size: 13px; color: #667eea;">
        ${joinLink}
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 13px;">
        This invitation was sent by ${eventDetails.creatorName}
      </p>
      <p style="margin: 8px 0 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
You're invited to join: ${eventDetails.title}

${eventDetails.description ? eventDetails.description + '\n\n' : ''}
Start: ${formatDateTime(eventDetails.startTime)}
End: ${formatDateTime(eventDetails.endTime)}

Join the meeting: ${joinLink}

No account needed! Click the link above and enter your name to join the call.

This invitation was sent by ${eventDetails.creatorName}
`;

  await sendMail(guestEmail, subject, html, text, EMAIL_FROM_NOTIFICATION);
}

/**
 * Send event cancellation email to guest
 */
export async function sendEventCancellationEmail(
  guestEmail: string,
  eventDetails: {
    title: string;
    startTime: Date;
    endTime: Date;
    creatorName: string;
  }
) {
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(date);
  };

  const subject = `Meeting Cancelled: ${eventDetails.title}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Meeting Cancelled</h1>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        We wanted to let you know that the following meeting has been cancelled:
      </p>

      <!-- Event Details Card -->
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0; border-radius: 8px;">
        <h2 style="margin: 0 0 15px; color: #1a1a1a; font-size: 22px; font-weight: 600; text-decoration: line-through; opacity: 0.7;">${eventDetails.title}</h2>

        <!-- Date and Time -->
        <div style="margin-top: 15px; opacity: 0.7;">
          <p style="margin: 0 0 8px; color: #555555; font-size: 14px;">
            <strong>Was scheduled for:</strong> ${formatDateTime(eventDetails.startTime)}
          </p>
        </div>
      </div>

      <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
        This meeting was cancelled by <strong>${eventDetails.creatorName}</strong>. You have been removed from the participant list.
      </p>

      <p style="margin: 15px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
        If you have any questions, please reach out to the meeting organizer directly.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Meeting Cancelled: ${eventDetails.title}

We wanted to let you know that the following meeting has been cancelled:

Event: ${eventDetails.title}
Was scheduled for: ${formatDateTime(eventDetails.startTime)}

This meeting was cancelled by ${eventDetails.creatorName}. You have been removed from the participant list.

If you have any questions, please reach out to the meeting organizer directly.
`;

  await sendMail(guestEmail, subject, html, text, EMAIL_FROM_NOTIFICATION);
}

// ============= Subscription Email Templates =============

/**
 * Email template for subscription activation
 */
export function subscriptionActivatedTemplate(data: {
  userName: string;
  itemName: string;
  itemType: string;
  amount: number;
  currency: string;
  period: string;
  nextChargeDate: Date;
}) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return {
    subject: `Welcome! Your ${data.itemName} subscription is now active`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Subscription Activated!</h1>
    </div>
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Hi ${data.userName},
      </p>
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Thank you for subscribing! Your subscription to <strong>${data.itemName}</strong> is now active.
      </p>
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 8px;">
        <h2 style="margin: 0 0 15px; color: #1a1a1a; font-size: 18px; font-weight: 600;">Subscription Details</h2>
        <p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Plan:</strong> ${data.period} subscription</p>
        <p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Amount:</strong> ${data.currency} ${(data.amount / 100).toFixed(2)}</p>
        <p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Next billing date:</strong> ${formatDate(data.nextChargeDate)}</p>
      </div>
      <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
        You now have full access to all ${data.itemType} content. Enjoy!
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`,
  };
}

/**
 * Email template for successful subscription payment
 */
export function subscriptionPaymentSuccessTemplate(data: {
  userName: string;
  itemName: string;
  amount: number;
  currency: string;
  paymentNumber: number;
  nextChargeDate: Date;
}) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return {
    subject: `Payment successful for ${data.itemName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Payment Successful</h1>
    </div>
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Hi ${data.userName},
      </p>
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Your payment for <strong>${data.itemName}</strong> has been processed successfully.
      </p>
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 8px;">
        <p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Amount paid:</strong> ${data.currency} ${(data.amount / 100).toFixed(2)}</p>
        <p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Payment #:</strong> ${data.paymentNumber}</p>
        <p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Next billing date:</strong> ${formatDate(data.nextChargeDate)}</p>
      </div>
    </div>
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`,
  };
}

/**
 * Email template for subscription payment failure
 */
export function subscriptionPaymentFailedTemplate(data: {
  userName: string;
  itemName: string;
  amount: number;
  currency: string;
  retryDate?: Date;
}) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return {
    subject: `Action required: Payment failed for ${data.itemName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Payment Failed</h1>
    </div>
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Hi ${data.userName},
      </p>
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        We were unable to process your payment for <strong>${data.itemName}</strong>.
      </p>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0; border-radius: 8px;">
        <p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Amount:</strong> ${data.currency} ${(data.amount / 100).toFixed(2)}</p>
        ${data.retryDate ? `<p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Next retry:</strong> ${formatDate(data.retryDate)}</p>` : ""}
      </div>
      <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
        Please update your payment method to continue your subscription. If the issue persists, your subscription access may be suspended.
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`,
  };
}

/**
 * Email template for subscription halted (access revoked)
 */
export function subscriptionHaltedTemplate(data: {
  userName: string;
  itemName: string;
}) {
  return {
    subject: `Subscription suspended: ${data.itemName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Subscription Suspended</h1>
    </div>
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Hi ${data.userName},
      </p>
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Your subscription to <strong>${data.itemName}</strong> has been suspended due to payment failures.
      </p>
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Your access has been revoked. To restore access, please update your payment method and resubscribe.
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`,
  };
}

/**
 * Email template for subscription cancelled
 */
export function subscriptionCancelledTemplate(data: {
  userName: string;
  itemName: string;
  accessEndDate: Date;
}) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return {
    subject: `Subscription cancelled: ${data.itemName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Subscription Cancelled</h1>
    </div>
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Hi ${data.userName},
      </p>
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Your subscription to <strong>${data.itemName}</strong> has been cancelled.
      </p>
      <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 25px 0; border-radius: 8px;">
        <p style="margin: 5px 0; color: #555555; font-size: 14px;"><strong>Access until:</strong> ${formatDate(data.accessEndDate)}</p>
      </div>
      <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
        You'll continue to have access until the end of your current billing period. After that, you can resubscribe at any time.
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`,
  };
}

/**
 * Send subscription email
 */
export async function sendSubscriptionEmail(
  to: string,
  template: { subject: string; html: string }
) {
  await sendMail(to, template.subject, template.html, undefined, EMAIL_FROM_NOTIFICATION);
}

/**
 * Account deletion verification email template
 */
export function accountDeletionOtpTemplate(email: string, code: string) {
  return {
    subject: "Account Deletion Verification Code",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Account Deletion Request</h1>
    </div>
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        You have requested to permanently delete your account.
      </p>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0; border-radius: 8px;">
        <p style="margin: 0 0 10px; color: #555555; font-size: 14px;"><strong>Warning:</strong> This action is irreversible.</p>
        <p style="margin: 0; color: #555555; font-size: 14px;">All your data will be permanently deleted.</p>
      </div>
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Your verification code is:
      </p>
      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
      </div>
      <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
        This code is valid for 10 minutes. If you did not request this, please ignore this email and your account will remain active.
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`,
    text: `
Account Deletion Verification

You have requested to permanently delete your account.

WARNING: This action is irreversible. All your data will be permanently deleted.

Your verification code is: ${code}

This code is valid for 10 minutes. If you did not request this, please ignore this email.
`,
  };
}

// ── Bat246 POD invite email ──────────────────────────────────────────

/**
 * Email sent when a distributor is invited (or reminded) to purchase the
 * POD product and claim their seat.
 */
export function podInviteEmailTemplate(data: {
  recipientName?: string;
  productName: string;
  priceLabel: string;
  productUrl: string;
}) {
  const { recipientName, productName, priceLabel, productUrl } = data;
  const greet = recipientName ? `Hi ${recipientName},` : "Hi,";
  return {
    subject: "Confirm your POD seat",
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111; max-width:560px">
<p>${greet}</p>
<p>You're invited to enter the POD and get your confirmed seat.</p>
<p>Please complete your ${priceLabel} purchase of <b>${productName}</b> below to join:</p>
<p>
<a href="${productUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#FBD10D;color:#000;text-decoration:none;font-weight:600">
Get My POD Seat
</a>
</p>
<p style="color:#6b7280;font-size:12px">If the button doesn't work, open this link:<br />${productUrl}</p>
</div>
`,
    text: `${greet}\n\nYou're invited to enter the POD and get your confirmed seat.\n\nPlease complete your ${priceLabel} purchase of ${productName} to join:\n${productUrl}`,
  };
}

/**
 * Sent by the admin "+ Invite" flow on the Distributors page to recruit a
 * brand-new prospect (no Garage account yet) into the Bat246 program. Unlike
 * podInviteEmailTemplate, the button leads to our own login/signup page
 * first (not a product checkout), so the copy stays product-agnostic.
 */
export function bat246OfficeInviteEmailTemplate(data: {
  recipientName?: string;
  productName: string;
  priceLabel: string;
  productUrl: string;
}) {
  const { recipientName, productName, priceLabel, productUrl } = data;
  const greet = recipientName ? `Hi ${recipientName},` : "Hi,";
  return {
    subject: "You're invited to join Bat246",
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111; max-width:560px">
<p>${greet}</p>
<p>You're invited to become a Bat246 Distributor, starting with <b>${productName}</b> (${priceLabel}).</p>
<p>Click below to sign in (or create your Garage account) and see the steps to get started:</p>
<p>
<a href="${productUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#FBD10D;color:#000;text-decoration:none;font-weight:600">
Get Started
</a>
</p>
<p style="color:#6b7280;font-size:12px">If the button doesn't work, open this link:<br />${productUrl}</p>
</div>
`,
    text: `${greet}\n\nYou're invited to become a Bat246 Distributor, starting with ${productName} (${priceLabel}).\n\nSign in or create your Garage account to get started:\n${productUrl}`,
  };
}

/**
 * Sent to the eligible person a Layaway "Request" is asking to give B2
 * Coins — see createLayawayRequest() in bat246Layaway.service.ts, which
 * imports this alongside the in-app bell notification (this email must
 * never block that request if sending fails — the caller already wraps
 * this in a try/catch).
 */
export function bat246LayawayRequestEmailTemplate(data: {
  eligibleName?: string;
  requesterName: string;
  recipientName: string;
  amountLabel: string;
  note?: string;
}) {
  const { eligibleName, requesterName, recipientName, amountLabel, note } = data;
  const greet = eligibleName ? `Hi ${eligibleName},` : "Hi,";
  const noteHtml = note
    ? `<p style="margin:12px 0 0 0;padding:10px 14px;background:#f9fafb;border-left:3px solid #FBD10D;color:#374151;font-size:14px">"${note}"</p>`
    : "";
  const noteText = note ? `\n\nTheir note: "${note}"` : "";
  return {
    subject: `${requesterName} is asking you for B2 Coins on BAT 246`,
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111; max-width:560px">
<p>${greet}</p>
<p><b>${requesterName}</b> is asking you to give <b>${amountLabel}</b> in B2 Coins to <b>${recipientName}</b>.</p>
${noteHtml}
<p style="margin-top:16px">Open the Layaway button on any BAT 246 board to Approve or Deny this request from your notification bell.</p>
</div>
`,
    text: `${greet}\n\n${requesterName} is asking you to give ${amountLabel} in B2 Coins to ${recipientName}.${noteText}\n\nOpen the Layaway button on any BAT 246 board to Approve or Deny this request from your notification bell.`,
  };
}

/**
 * Explicitly distinct wording from bat246LayawayRequestEmailTemplate
 * above — a Snap Back Loan is a debt the borrower must repay from their
 * own future earnings, not a no-strings coin gift, and the eligible
 * person approving it should understand that difference before they act.
 */
export function bat246SnapBackLoanRequestEmailTemplate(data: {
  eligibleName?: string;
  borrowerName: string;
  amountLabel: string;
  productLabel: string;
  note?: string;
  /** Set only when someone refers a friend/contact rather than asking for
   *  themselves — i.e. different from borrowerName. */
  requestedByName?: string;
}) {
  const { eligibleName, borrowerName, amountLabel, productLabel, note, requestedByName } = data;
  const greet = eligibleName ? `Hi ${eligibleName},` : "Hi,";
  const noteHtml = note
    ? `<p style="margin:12px 0 0 0;padding:10px 14px;background:#f9fafb;border-left:3px solid #FBD10D;color:#374151;font-size:14px">"${note}"</p>`
    : "";
  const noteText = note ? `\n\nTheir note: "${note}"` : "";
  const introHtml = requestedByName
    ? `<p><b>${requestedByName}</b> is asking you to fund a <b>Snap Back Loan</b> of <b>${amountLabel}</b> in B2 Coins for <b>${borrowerName}</b> to purchase the <b>${productLabel}</b>.</p>`
    : `<p><b>${borrowerName}</b> is requesting a <b>Snap Back Loan</b> of <b>${amountLabel}</b> in B2 Coins to purchase the <b>${productLabel}</b>.</p>`;
  const introText = requestedByName
    ? `${requestedByName} is asking you to fund a Snap Back Loan of ${amountLabel} in B2 Coins for ${borrowerName} to purchase the ${productLabel}.`
    : `${borrowerName} is requesting a Snap Back Loan of ${amountLabel} in B2 Coins to purchase the ${productLabel}.`;
  return {
    subject: requestedByName
      ? `${requestedByName} is requesting a Snap Back Loan for ${borrowerName} on BAT 246`
      : `${borrowerName} is requesting a Snap Back Loan on BAT 246`,
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111; max-width:560px">
<p>${greet}</p>
${introHtml}
<p style="margin-top:12px">This is a loan, not a gift — it will be automatically repaid from ${borrowerName}'s own future BAT 246 earnings until it's fully paid off.</p>
${noteHtml}
<p style="margin-top:16px">Open your B2 Coin Wallet's Loan Requests tab on BAT 246 to Approve or Deny this request.</p>
</div>
`,
    text: `${greet}\n\n${introText}\n\nThis is a loan, not a gift — it will be automatically repaid from ${borrowerName}'s own future BAT 246 earnings until it's fully paid off.${noteText}\n\nOpen your B2 Coin Wallet's Loan Requests tab on BAT 246 to Approve or Deny this request.`,
  };
}

// ── Coupon reward / gift emails ─────────────────────────────────────

interface CouponEmailContent {
  code: string;
  name: string;
  discountLabel: string; // e.g. "20% off" or "$5.00 off"
  productLabel: string;  // e.g. "Channels", "Courses", "Office Plans"
  validUntil?: Date;
  /**
   * Where to go to spend it, e.g. "GaragePay → Office and start your Founders
   * Office subscription". Resolved per productType by REDEEM_DESTINATIONS in
   * couponAssignment.ts. Optional — the steps fall back to generic wording.
   */
  redeemAt?: string;
}

function rewardsLink() {
  // `/revenue-network/wallet` is NOT a user-facing page — only an API route
  // and a garage-admin page live under that path — so this link 404'd in every
  // coupon and reward email that has ever been sent.
  //
  // GaragePay is an in-app tab rather than a route, so the working form is the
  // dashboard host plus a deep-link param: `openApp` opens the app (handled in
  // app/(dashboard)/layout.tsx) and `tab` selects the pane (read directly off
  // window.location.search by WalletPageInternal).
  return `${env.FRONTEND_URL}/workspace?openApp=garagepay&tab=rewards`;
}

function couponCardHtml(coupon: CouponEmailContent) {
  const expiry = coupon.validUntil
    ? `<p style="margin:8px 0 0 0;color:#6b7280;font-size:13px">Valid until ${new Date(coupon.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>`
    : "";
  return `
<div style="background:#0e0e12;border:1px solid #2a2a35;border-radius:12px;padding:18px;margin:18px 0">
  <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;color:#FBD10D;letter-spacing:1px">${coupon.code}</div>
  <div style="margin-top:6px;color:#fff;font-weight:600">${coupon.name}</div>
  <div style="margin-top:4px;color:#9fa0b8;font-size:14px">${coupon.discountLabel} • ${coupon.productLabel}</div>
  ${expiry}
</div>`;
}

/**
 * "How to redeem" — the step the coupon emails were missing.
 *
 * Telling someone they have a coupon and showing them the code isn't enough:
 * a coupon is only spendable by pasting the code at that product's checkout.
 * The Rewards tab lists coupons and offers "Copy code" — it cannot redeem one —
 * so a bare "View in Rewards" button leaves the recipient at a dead end.
 *
 * `redeemAt` names the destination and differs per product; without it the copy
 * degrades to generic wording rather than rendering an empty instruction.
 */
function redeemStepsHtml(coupon: CouponEmailContent) {
  const where =
    coupon.redeemAt ||
    `whatever you're buying under ${coupon.productLabel}`;
  return `
<div style="border-left:3px solid #FBD10D;padding:2px 0 2px 14px;margin:18px 0">
  <p style="margin:0 0 8px 0;color:#111;font-weight:600;font-size:14px">How to redeem</p>
  <ol style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.7">
    <li>Copy your code — <b style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${coupon.code}</b></li>
    <li>Go to ${where}</li>
    <li>At checkout, paste it into <b>“Have a coupon?”</b> and press Apply</li>
  </ol>
  <p style="margin:10px 0 0 0;color:#6b7280;font-size:13px">
    The discount shows on the total before you pay. Apply it before paying —
    a coupon can’t be added once a payment is complete.
  </p>
</div>`;
}

function redeemStepsText(coupon: CouponEmailContent) {
  const where =
    coupon.redeemAt || `whatever you're buying under ${coupon.productLabel}`;
  return `How to redeem:\n  1. Copy your code — ${coupon.code}\n  2. Go to ${where}\n  3. At checkout, paste it into "Have a coupon?" and press Apply\n\nApply it before paying — a coupon can't be added once a payment is complete.`;
}

/**
 * Email template for admin/founder-originated coupon rewards.
 */
export function couponAssignedEmailTemplate(args: {
  recipientName?: string;
  assignerLabel: string; // "Garage" or "<OrgName>"
  coupon: CouponEmailContent;
  reason?: string;
}) {
  const { recipientName, assignerLabel, coupon, reason } = args;
  const link = rewardsLink();
  const greet = recipientName ? `Hi ${recipientName},` : "Hi,";
  return {
    subject: `You've received a reward from ${assignerLabel}`,
    html: `
<div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;color:#111;max-width:560px">
  <p>${greet}</p>
  <p><b>${assignerLabel}</b> sent you a reward.</p>
  ${couponCardHtml(coupon)}
  ${reason ? `<p style="color:#374151;font-size:14px"><i>"${reason}"</i></p>` : ""}
  ${redeemStepsHtml(coupon)}
  <p>
    <a href="${link}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#FBD10D;color:#000;text-decoration:none;font-weight:600">
      View in Rewards
    </a>
  </p>
  <p style="color:#6b7280;font-size:12px">If the button doesn't work, open this link:<br />${link}</p>
</div>
`,
    text: `${greet}\n\n${assignerLabel} sent you a reward.\n\nCode: ${coupon.code}\n${coupon.name} — ${coupon.discountLabel}${coupon.validUntil ? `\nValid until ${new Date(coupon.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}\n\n${redeemStepsText(coupon)}\n\nView in Rewards: ${link}`,
  };
}

/**
 * Email template for peer-to-peer coupon gifts (one user gifting to another).
 */
export function couponGiftedEmailTemplate(args: {
  recipientName?: string;
  senderName: string;
  coupon: CouponEmailContent;
  giftMessage?: string;
}) {
  const { recipientName, senderName, coupon, giftMessage } = args;
  const link = rewardsLink();
  const greet = recipientName ? `Hi ${recipientName},` : "Hi,";
  return {
    subject: `${senderName} gifted you a coupon`,
    html: `
<div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;color:#111;max-width:560px">
  <p>${greet}</p>
  <p><b>${senderName}</b> just gifted you a coupon.</p>
  ${couponCardHtml(coupon)}
  ${giftMessage ? `<div style="border-left:3px solid #FBD10D;padding:8px 12px;margin:14px 0;color:#374151;font-size:14px">${giftMessage}</div>` : ""}
  ${redeemStepsHtml(coupon)}
  <p>
    <a href="${link}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#FBD10D;color:#000;text-decoration:none;font-weight:600">
      View in Rewards
    </a>
  </p>
  <p style="color:#6b7280;font-size:12px">If the button doesn't work, open this link:<br />${link}</p>
</div>
`,
    text: `${greet}\n\n${senderName} gifted you a coupon.\n\nCode: ${coupon.code}\n${coupon.name} — ${coupon.discountLabel}\n${giftMessage ? `\n"${giftMessage}"\n` : ""}\n${redeemStepsText(coupon)}\n\nView in Rewards: ${link}`,
  };
}

/** One row of a catalog offer email — a subset of `ComboQuote`. */
export interface OfferEmailPlan {
  planLabel: string;
  cartUsd: number;
  monthsOfAccess: number;
  freeMonth: boolean;
  includesLicence?: boolean;
  licenceUsd?: number;
  /** What each renewal charges (standard price, pre-tax) and how often. */
  renewalUsd?: number;
  renewalMonths?: number;
}

/** "then $36/month", "then $180 every 6 months". */
function renewalLabel(amount: number, months: number) {
  return months === 1
    ? `then ${usd(amount)}/month`
    : `then ${usd(amount)} every ${months} months`;
}

/** Names and labels are user-entered — never interpolate them raw into HTML. */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/**
 * "Thu, 24 Sep 2026, 04:51 UTC". The recipient's zone is unknown, so say UTC
 * outright rather than print `toUTCString()`'s seconds and "GMT".
 */
function formatOfferDeadline(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

const monthsLabel = (n: number) => (n === 1 ? "1 month" : `${n} months`);

/**
 * NetworkChain offer magic link.
 *
 * Deliberately quotes the price but does NOT promise the offer will still be
 * live when the recipient opens it — the landing page re-quotes on every load,
 * so an email read after the window shuts shows normal prices rather than a
 * price the system won't honour. The countdown line is therefore phrased as
 * "ends <time>" rather than "you have N hours left".
 *
 * Mirrors the magic-link page (garage-web-app `app/magic-link/[token]`): the
 * same plan rows, "1 month free" tags and "total today" prices, so the email
 * and the page it opens never disagree.
 */
export function offerMagicLinkTemplate(input: {
  recipientName?: string | null;
  senderName?: string | null;
  clientName: string;
  planLabel: string;
  cartUsd: number;
  freeMonth: boolean;
  monthsOfAccess: number;
  offerExpiresAt?: Date | null;
  /** True when the link shows the whole catalog rather than one plan. */
  catalog?: boolean;
  /** How many plans the catalog offers. Only read when `catalog` is true. */
  planCount?: number;
  /** Every plan in the catalog, listed individually when present. */
  plans?: OfferEmailPlan[];
  /** Single-plan links: is the one-time licence part of `cartUsd`? */
  includesLicence?: boolean;
  licenceUsd?: number;
  /** Single-plan links: what each renewal charges, and how often. */
  renewalUsd?: number;
  renewalMonths?: number;
  link: string;
}) {
  const {
    recipientName,
    senderName,
    planLabel,
    cartUsd,
    freeMonth,
    monthsOfAccess,
    offerExpiresAt,
    catalog = false,
    plans = [],
    link,
  } = input;
  const planCount = input.planCount ?? (plans.length || 1);
  const clientName = input.clientName;

  const name = recipientName?.trim();
  const sender = senderName?.trim();
  const greetText = name ? `Hi ${name},` : "Hi,";
  const greetHtml = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const client = escapeHtml(clientName);
  const url = escapeHtml(link);

  const introText = sender
    ? `${sender} has set up your ${clientName} subscription.`
    : `Your ${clientName} subscription is ready.`;
  const introHtml = sender
    ? `<b>${escapeHtml(sender)}</b> has set up your <b>${client}</b> subscription.`
    : `Your <b>${client}</b> subscription is ready.`;
  const freeLine = freeMonth
    ? "Your first month is on us if you sign up before the offer ends."
    : "";

  // A catalog quotes its cheapest entry point ("from $25"); a single-plan link
  // quotes the plan itself.
  const price =
    cartUsd === 0 ? "Free" : `${catalog ? "from " : ""}${usd(cartUsd)}`;
  const headingLine = catalog
    ? `${planCount} plan${planCount === 1 ? "" : "s"} to choose from`
    : planLabel;
  const accessLine = catalog
    ? "Monthly, or save with a longer term"
    : `${monthsLabel(monthsOfAccess)} of access${
        freeMonth && monthsOfAccess > 1 ? ", including your free first month" : ""
      }`;

  // The cheapest "price" is usually the one-time licence alone (monthly inside
  // the window costs nothing but the licence) — say so, or "$25" reads as a
  // monthly fee.
  const licenceUsd =
    plans.find((p) => p.includesLicence && p.licenceUsd)?.licenceUsd ??
    (input.includesLicence ? input.licenceUsd : undefined);
  const licenceNote = licenceUsd
    ? `Prices include the one-time ${usd(licenceUsd)} Unilevel Plus licence.`
      : "";

  const singleRenewal =
    input.renewalUsd != null && input.renewalMonths
      ? renewalLabel(input.renewalUsd, input.renewalMonths)
      : null;
  // Only claim auto-renewal when we actually know the renewal price.
  const renewNote =
    singleRenewal || plans.some((p) => p.renewalUsd != null && p.renewalMonths)
      ? "Renews automatically at the standard price."
      : "";

  const deadline =
    freeMonth && offerExpiresAt ? formatOfferDeadline(offerExpiresAt) : null;
  const cta = catalog && plans.length !== 1 ? "Choose your plan" : cartUsd === 0 ? "Activate free month" : "View & pay";

  const planRowsHtml = plans
    .map(
      (p, i) => `
          <tr>
            <td style="padding:10px 0;${i ? "border-top:1px solid #f0f0f3;" : ""}">
              <div style="font-size:14px;font-weight:600;color:#111">${escapeHtml(p.planLabel)}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px">${monthsLabel(p.monthsOfAccess)} of access${
                p.renewalUsd != null && p.renewalMonths ? `, ${renewalLabel(p.renewalUsd, p.renewalMonths)}` : ""
              }</div>
            </td>
            <td align="right" style="padding:10px 0;${i ? "border-top:1px solid #f0f0f3;" : ""}white-space:nowrap;vertical-align:top">
              <div style="font-size:15px;font-weight:700;color:#111">${p.cartUsd === 0 ? "Free" : usd(p.cartUsd)}</div>
              ${p.freeMonth ? `<div style="font-size:11px;font-weight:600;color:#059669;margin-top:2px">1 month free</div>` : ""}
            </td>
          </tr>`
    )
    .join("");

  const summaryHtml = plans.length
    ? `
        <div style="font-size:15px;font-weight:600;color:#111;margin-bottom:4px">${headingLine}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${planRowsHtml}
        </table>`
    : `
        <div style="font-size:15px;font-weight:600;color:#111">${escapeHtml(headingLine)}</div>
        <div style="font-size:26px;font-weight:700;color:#111;margin:6px 0 2px">${price}${
          cartUsd === 0 || catalog ? "" : ` <span style="font-size:13px;font-weight:500;color:#6b7280">today</span>`
        }</div>
        <div style="font-size:13px;color:#6b7280">${escapeHtml(accessLine)}${singleRenewal ? `, ${singleRenewal}` : ""}</div>`;

  const html = `
<div style="background:#f6f6f8;padding:24px 12px;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;border-collapse:separate">
    <tr>
      <td style="padding:28px 28px 8px">
        ${freeMonth ? `<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#FEF6CD;color:#8a6d00;font-size:12px;font-weight:700;letter-spacing:.02em">FIRST MONTH FREE</div>` : ""}
        <p style="font-size:15px;margin:16px 0 8px">${greetHtml}</p>
        <p style="font-size:15px;line-height:1.5;margin:0 0 ${freeLine ? "6px" : "0"}">${introHtml}</p>
        ${freeLine ? `<p style="font-size:15px;line-height:1.5;margin:0;color:#374151">${freeLine}</p>` : ""}
      </td>
    </tr>
    <tr>
      <td style="padding:12px 28px">
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">${summaryHtml}
        </div>
        <p style="font-size:12px;line-height:1.5;color:#6b7280;margin:8px 2px 0">${[licenceNote, renewNote, "Taxes are calculated at checkout."].filter(Boolean).join(" ")}</p>
      </td>
    </tr>
    ${
      deadline
        ? `<tr>
      <td style="padding:4px 28px 0">
        <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.5;color:#9a3412">
          <b>Offer ends ${deadline}.</b><br />After that, the first month is charged at the standard rate.
        </div>
      </td>
    </tr>`
        : ""
    }
    <tr>
      <td style="padding:20px 28px 8px">
        <a href="${url}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#FBD10D;color:#000;text-decoration:none;font-weight:600;font-size:15px">${escapeHtml(cta)}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 28px">
        <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0">
          If the button doesn't work, copy this link into your browser:<br />
          <a href="${url}" style="color:#6b7280;word-break:break-all">${url}</a>
        </p>
      </td>
    </tr>
  </table>
</div>
`;

  const planLinesText = plans.length
    ? plans
        .map(
          (p) =>
            `  • ${p.planLabel} — ${p.cartUsd === 0 ? "Free" : usd(p.cartUsd)} (${monthsLabel(p.monthsOfAccess)} of access${p.freeMonth ? ", 1 month free" : ""})${
              p.renewalUsd != null && p.renewalMonths ? `, ${renewalLabel(p.renewalUsd, p.renewalMonths)}` : ""
            }`
        )
        .join("\n")
    : `  ${headingLine} — ${price} (${accessLine})${singleRenewal ? `, ${singleRenewal}` : ""}`;

  const text = [
    greetText,
    "",
    introText + (freeLine ? ` ${freeLine}` : ""),
    "",
    plans.length ? `${headingLine}:` : null,
    planLinesText,
    "",
    [licenceNote, renewNote, "Taxes are calculated at checkout."].filter(Boolean).join(" "),
    deadline
      ? `\nOffer ends ${deadline}. After that, the first month is charged at the standard rate.`
      : null,
    "",
    `${cta}: ${link}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return {
    subject: freeMonth
      ? `Your ${clientName} offer — first month free`
      : `Your ${clientName} subscription`,
    html,
    text,
  };
}

/**
 * Countdown reminder for an unclaimed NetworkChain offer.
 *
 * Separate from `offerMagicLinkTemplate` because the job is different: the
 * first email introduces the offer, this one only has to convey how little
 * time is left. Deliberately short — a reminder that restates the whole
 * pitch reads like a duplicate and gets ignored.
 */
export function offerReminderTemplate(input: {
  recipientName?: string | null;
  clientName: string;
  hoursRemaining: number;
  cartUsd: number;
  planCount: number;
  link: string;
}) {
  const { recipientName, clientName, hoursRemaining, cartUsd, planCount, link } =
    input;

  const greet = recipientName ? `Hi ${recipientName},` : "Hi,";
  const window =
    hoursRemaining <= 1
      ? "in the next hour"
      : `in about ${hoursRemaining} hours`;
  const urgent = hoursRemaining <= 1;
  const headline = urgent
    ? `Last chance — your free month ends ${window}`
    : `Your free first month ends ${window}`;

  return {
    subject: urgent
      ? `Final hour: your free ${clientName} month`
      : `${hoursRemaining} hours left on your free ${clientName} month`,
    html: `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#111">
  <p>${greet}</p>
  <p style="font-size:16px;font-weight:600;margin:14px 0 6px">${headline}</p>
  <p style="color:#4b5563;font-size:14px;margin:0 0 16px">
    Claim it and your first month of ${clientName} is free — from $${cartUsd}
    across ${planCount} plan${planCount === 1 ? "" : "s"}. After the deadline
    the first month is charged at the standard rate.
  </p>
  <p>
    <a href="${link}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:${
      urgent ? "#dc2626" : "#FBD10D"
    };color:${urgent ? "#fff" : "#000"};text-decoration:none;font-weight:600">
      Claim your free month
    </a>
  </p>
  <p style="color:#6b7280;font-size:12px">If the button doesn't work, open this link:<br />${link}</p>
</div>
`,
    text: `${greet}\n\n${headline}\n\nClaim it and your first month of ${clientName} is free — from $${cartUsd} across ${planCount} plan${
      planCount === 1 ? "" : "s"
    }. After the deadline the first month is charged at the standard rate.\n\nClaim: ${link}`,
  };
}
