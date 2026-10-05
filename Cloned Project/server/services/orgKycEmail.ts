/**
 * The two emails that go out when an admin settles an office's KYC.
 *
 * Without these the verdict is invisible until the founder happens to open
 * the app again — the in-app nudge only fires on load. A rejection in
 * particular is a request for work, so it has to leave the building.
 *
 * ── Who gets it ──────────────────────────────────────────────────────────
 * Every founder of that office (an office can have more than one). Sent from
 * the office's own verified domain when it has one, so a white-label founder
 * doesn't get Garage-branded mail about their own company.
 *
 * ── Never throws ─────────────────────────────────────────────────────────
 * The verdict is already persisted by the time this runs. A Resend outage is
 * a missing notification, not a failed verification, and the admin's request
 * must not 500 because of one. Failures are logged and swallowed.
 */
import { Types } from "mongoose";

import { env } from "../config/env";
import {
  bodyText,
  ctaButton,
  emailShell,
  fallbackLink,
  greeting,
} from "./bulkEmail";
import { sendMail, senderForOrg, EMAIL_FROM_NOTIFICATION } from "./mailer";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";

/** Names, org names and reviewer notes are user-authored — they reach the
 *  inbox as HTML, so everything interpolated below goes through this. */
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
  return String(email || "").split("@")[0] || "";
}

/**
 * Where the founder lands. There is no standalone KYC route — the packet
 * lives in a dialog that opens by itself on load whenever documents are
 * owed, and in Manage Organization otherwise. So both mails point at the
 * workspace and let the app decide what to show.
 */
function officeLink(): string {
  return `${env.FRONTEND_URL}/workspace`;
}

interface FounderRecipient {
  email: string;
  name?: string | null;
}

async function foundersOf(
  orgId: Types.ObjectId | string,
): Promise<FounderRecipient[]> {
  const founders = await User.find({
    organizations: {
      $elemMatch: { organization: new Types.ObjectId(String(orgId)), role: "founder" },
    },
  })
    .select("name email")
    .lean<{ name?: string; email?: string }[]>();

  return founders
    .filter((f) => Boolean(f.email))
    .map((f) => ({ email: f.email as string, name: f.name }));
}

function verifiedHtml(orgName: string, recipientName: string): string {
  const link = officeLink();
  const header = `<h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">Your office is verified</h1>`;
  const body = `
    ${greeting(esc(recipientName))}
    ${bodyText(`The KYC documents for <strong style="color:#EAEAEA;">${esc(orgName)}</strong> have been reviewed and approved. Your office is now verified — nothing further is needed from you.`)}
    ${ctaButton(link, "Open your office")}
    ${fallbackLink(link)}
  `;
  return emailShell(header, body);
}

function verifiedText(orgName: string, recipientName: string): string {
  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

The KYC documents for ${orgName} have been reviewed and approved. Your office is now verified — nothing further is needed from you.

Open your office: ${officeLink()}

- Garage`;
}

function rejectedHtml(
  orgName: string,
  recipientName: string,
  note: string,
  perDocument: { label: string; note?: string }[],
): string {
  const link = officeLink();
  const header = `<h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">Your KYC needs changes</h1>`;

  // The per-document notes are the actionable part — the founder needs to
  // know WHICH document to redo, not just that something was wrong.
  const perDocBlock = perDocument.length
    ? `<div style="background-color:#262638;border-left:4px solid #F87171;padding:20px;margin:20px 0;border-radius:8px;">
        <p style="margin:0 0 10px;color:#EAEAEA;font-size:15px;font-weight:600;">Documents to redo</p>
        ${perDocument
          .map(
            (d) =>
              `<p style="margin:0 0 8px;color:#BDBDBD;font-size:14px;line-height:1.5;"><strong style="color:#EAEAEA;">${esc(
                d.label,
              )}</strong>${d.note ? ` — ${esc(d.note)}` : ""}</p>`,
          )
          .join("")}
      </div>`
    : "";

  const body = `
    ${greeting(esc(recipientName))}
    ${bodyText(`The KYC documents for <strong style="color:#EAEAEA;">${esc(orgName)}</strong> were reviewed and sent back. Here's what your reviewer said:`)}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      <p style="margin:0;color:#BDBDBD;font-size:15px;line-height:1.6;">${esc(note)}</p>
    </div>
    ${perDocBlock}
    ${bodyText("Open your office to replace the documents and send them back for verification.")}
    ${ctaButton(link, "Update documents")}
    ${fallbackLink(link)}
  `;
  return emailShell(header, body);
}

function rejectedText(
  orgName: string,
  recipientName: string,
  note: string,
  perDocument: { label: string; note?: string }[],
): string {
  const lines = perDocument.length
    ? `\n\nDocuments to redo:\n${perDocument
        .map((d) => `- ${d.label}${d.note ? `: ${d.note}` : ""}`)
        .join("\n")}`
    : "";
  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

The KYC documents for ${orgName} were reviewed and sent back. Here's what your reviewer said:

${note}${lines}

Update them here: ${officeLink()}

- Garage`;
}

/** Fire-and-forget verdict mail. Callers do not await a failure path. */
export async function sendOrgKycVerdictEmail(params: {
  orgId: Types.ObjectId | string;
  verdict: "verified" | "rejected";
  /** Required for "rejected" — the whole-packet reason the admin typed. */
  note?: string;
  /** Per-document rejections, so the founder knows which files to redo. */
  perDocument?: { label: string; note?: string }[];
}): Promise<void> {
  try {
    const org = await Organization.findById(String(params.orgId))
      .select("name")
      .lean<{ name?: string }>();
    const orgName = org?.name || "your office";

    const recipients = await foundersOf(params.orgId);
    if (!recipients.length) {
      console.warn(
        "[orgKycEmail] no founder with an email for org",
        String(params.orgId),
      );
      return;
    }

    const from = await senderForOrg(params.orgId, EMAIL_FROM_NOTIFICATION);

    // Sent one at a time and independently: a bounce on one founder's
    // address must not swallow the other's email.
    await Promise.all(
      recipients.map(async (to) => {
        const name = firstNameOf(to.name, to.email);
        try {
          if (params.verdict === "verified") {
            await sendMail(
              to.email,
              `${orgName} is verified`,
              verifiedHtml(orgName, name),
              verifiedText(orgName, name),
              from,
            );
          } else {
            const note = params.note || "Please review and resubmit your documents.";
            await sendMail(
              to.email,
              `Action needed: KYC for ${orgName}`,
              rejectedHtml(orgName, name, note, params.perDocument || []),
              rejectedText(orgName, name, note, params.perDocument || []),
              from,
            );
          }
        } catch (err) {
          console.error("[orgKycEmail] send failed for", to.email, err);
        }
      }),
    );
  } catch (err) {
    console.error("[orgKycEmail] verdict email failed", err);
  }
}
