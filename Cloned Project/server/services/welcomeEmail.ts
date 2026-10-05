import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Workshop } from "../models/workshop.model";
import { sendMail, EMAIL_FROM_NOTIFICATION, senderForOrg } from "./mailer";
import { ensureUserHasAffiliateId } from "./affiliate";
import { emailShell, ctaButton, greeting, bodyText } from "./bulkEmail";
import { env } from "../config/env";
import {
  buildReferrerEmail,
  buildManagerEmail,
  buildAdminEmail,
  buildWelcomeEmail,
  formatAffiliateLocation,
  PLATFORM_CC,
} from "./affiliateEmailTemplates";
import {
  buildFounderReferrerEmail,
  buildFounderManagerEmails,
  buildFounderAdminEmail,
  buildFounderWelcomeEmail,
  formatCorporateLocation,
} from "./founderEmailTemplates";

// ── Custom welcome template ──────────────────────────────────────────
//
// Founders pick the join-welcome email in Manage Organization. Picking the
// built-in layout stores this sentinel and no snapshot, so `sendWelcomeEmail`
// keeps rendering `welcomeEmailHtml` below (workshop cards included). Picking a
// Network Mail template stores the rendered HTML on the org — that service
// authenticates with the browser's JWT, so this API cannot fetch it at send
// time — and only merge tags are substituted here.

/** Also the unset case: an org that has never been configured. */
export const DEFAULT_WELCOME_TEMPLATE_ID = "__default__";

/** Merge values are user-authored (org names, descriptions) — escape them. */
function escMerge(value: unknown): string {
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
  return local || "there";
}

/**
 * The founder's own account email, which is the inbox they actually read —
 * `mailboxConfig.email` is a provisioned @networkmail.com address and only a
 * fallback. Organization has no supportEmail field of its own.
 */
async function resolveOrgSupportEmail(org: any): Promise<string> {
  const founderId = org?.mailboxConfig?.founderUserId;
  if (founderId) {
    try {
      const founder: any = await User.findById(founderId)
        .select("email")
        .lean();
      if (founder?.email) return founder.email;
    } catch {
      // fall through to the mailbox address
    }
  }
  return org?.mailboxConfig?.email || "";
}

/**
 * The tag contract with the frontend picker
 * (`garage-web-app-nextjs-v1/lib/org-welcome-email-template.ts`). Both sides
 * must agree on these keys.
 */
async function buildWelcomeMergeVars(
  user: { name?: string | null; email: string },
  org: any,
): Promise<Record<string, string>> {
  const orgName = org?.name || "Garage";
  const location = [org?.city, org?.state, org?.country]
    .filter(Boolean)
    .join(", ");
  const supportEmail = await resolveOrgSupportEmail(org);
  const orgUrl = `${env.FRONTEND_URL || "http://localhost:3000"}/workspace?orgId=${org?._id?.toString() || ""}`;
  const displayName = user.name || user.email;

  return {
    first_name: escMerge(firstNameOf(user.name, user.email)),
    user_name: escMerge(displayName),
    business_name: escMerge(orgName),
    org_name: escMerge(orgName),
    org_description: escMerge(org?.description || ""),
    org_location: escMerge(location),
    member_email: escMerge(user.email),
    org_icon: escMerge(org?.icon || ""),
    support_option: escMerge(supportEmail),
    support_email: escMerge(supportEmail),
    org_url: orgUrl,
    dashboard_url: orgUrl,
  };
}

/**
 * `{{key}}` substitution. Unmatched keys collapse to an empty string so a stray
 * tag never reaches an inbox; images left with an empty `src` (an org with no
 * icon) are dropped entirely rather than shipping as a broken image.
 */
function renderWelcomeTemplate(
  templateHtml: string,
  vars: Record<string, string>,
): string {
  const merged = templateHtml.replace(
    /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
    (_m, key: string) => {
      const v = vars[key];
      return v == null ? "" : String(v);
    },
  );
  return merged.replace(/<img\b[^>]*\bsrc\s*=\s*(""|'')[^>]*>/gi, "");
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatWorkshopDate(
  date: Date,
  startTime: string,
  endTime: string,
  timezone: string,
): string {
  const d = new Date(date);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = dayNames[d.getUTCDay()];
  const month = monthNames[d.getUTCMonth()];
  const dateNum = d.getUTCDate();
  const year = d.getUTCFullYear();

  const tz = timezone || "UTC";
  // Use short timezone label
  const tzLabel = tz.split("/").pop()?.replace(/_/g, " ") || tz;

  return `${day}, ${month} ${dateNum}, ${year} &middot; ${startTime} - ${endTime} ${tzLabel}`;
}

function workshopCardHtml(
  workshop: {
    _id: string;
    title: string;
    thumbnail?: string;
    date: Date;
    startTime: string;
    endTime: string;
    timezone: string;
    meetingUrl?: string;
    isFree: boolean;
    price: number;
    currency: string;
  },
  affiliateId: string,
): string {
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  // Use checkout URL as the affiliate link (so people can register/buy)
  const joinLink = `${frontendUrl}/checkout/workshop/${workshop._id}?ref=${affiliateId}`;

  const dateStr = formatWorkshopDate(
    workshop.date,
    workshop.startTime,
    workshop.endTime,
    workshop.timezone,
  );
  const priceStr = workshop.isFree
    ? `<span style="color:#10b981;font-weight:600;">Free</span>`
    : `<span style="color:#FBD10D;font-weight:700;">${new Intl.NumberFormat("en-US", { style: "currency", currency: workshop.currency || "USD" }).format(workshop.price)}</span>`;

  return `
    <div style="background-color:#262638;border-radius:10px;overflow:hidden;margin-bottom:16px;border:1px solid #2a2a3d;">
      ${workshop.thumbnail ? `<img src="${workshop.thumbnail}" alt="${workshop.title}" style="width:100%;max-height:160px;object-fit:cover;display:block;" />` : ""}
      <div style="padding:16px 20px;">
        <h3 style="margin:0 0 8px;color:#EAEAEA;font-size:16px;font-weight:600;">${workshop.title}</h3>
        <p style="margin:0 0 8px;color:#888;font-size:13px;">${dateStr}</p>
        <p style="margin:0 0 14px;font-size:14px;">${priceStr}</p>
        <div style="text-align:center;">
          <a href="${joinLink}" style="display:inline-block;padding:10px 28px;background:linear-gradient(135deg,#FBA70A,#FBD10D);color:#0C0C0E;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">
            Join Workshop
          </a>
        </div>
        <p style="margin:10px 0 0;color:#666;font-size:12px;line-height:1.4;text-align:center;">
          Copy link: <a href="${joinLink}" style="color:#FBD10D;word-break:break-all;text-decoration:none;">${joinLink}</a>
        </p>
      </div>
    </div>`;
}

// ── Welcome Email Templates ──────────────────────────────────────

function welcomeEmailHtml(
  recipientName: string,
  org: {
    name: string;
    icon?: string;
    description?: string;
    city?: string;
    state?: string;
    country?: string;
  } | null,
  isParentOnly: boolean,
  workshops: Array<{
    _id: string;
    title: string;
    thumbnail?: string;
    date: Date;
    startTime: string;
    endTime: string;
    timezone: string;
    meetingUrl?: string;
    isFree: boolean;
    price: number;
    currency: string;
  }>,
  affiliateId: string,
): string {
  const location = org
    ? [org.city, org.state, org.country].filter(Boolean).join(", ")
    : "";

  // Header
  const header = isParentOnly
    ? `<h1 style="margin:0;color:#0C0C0E;font-size:28px;font-weight:700;">Welcome to Garage</h1>
       <p style="margin:8px 0 0;color:#0C0C0E;font-size:15px;opacity:0.8;">Your collaborative workspace awaits</p>`
    : `${org?.icon ? `<img src="${org.icon}" alt="${org.name}" style="width:56px;height:56px;border-radius:12px;margin-bottom:14px;border:2px solid rgba(255,255,255,0.3);" />` : ""}
       <h1 style="margin:0;color:#0C0C0E;font-size:28px;font-weight:700;">Congratulations!</h1>
       <p style="margin:8px 0 0;color:#0C0C0E;font-size:15px;opacity:0.8;">You're now part of ${org?.name}</p>`;

  // Body sections
  let body = greeting(recipientName);

  // Section 1: HQ details (non-parent only)
  if (!isParentOnly && org) {
    body += `
      <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:0 0 24px;border-radius:8px;">
        <h2 style="margin:0 0 8px;color:#EAEAEA;font-size:20px;font-weight:600;">${org.name}</h2>
        ${location ? `<p style="margin:0 0 6px;color:#888;font-size:14px;">${location}</p>` : ""}
        ${org.description ? `<p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${org.description.substring(0, 300)}${org.description.length > 300 ? "..." : ""}</p>` : ""}
      </div>`;
  }

  // Section 2: Welcome to Garage
  body += `
    <div style="margin-bottom:28px;">
      <h2 style="margin:0 0 12px;color:#EAEAEA;font-size:18px;font-weight:600;">Welcome to Garage</h2>
      ${bodyText("Garage is your all-in-one collaborative workspace — connect with your community, attend live workshops & webinars, access exclusive content, and grow together.")}
      ${bodyText("Explore your HQ, join conversations, and make the most of everything Garage has to offer.")}
    </div>`;

  // Section 3: Upcoming workshops
  if (workshops.length > 0) {
    body += `
      <div style="margin-bottom:20px;">
        <h2 style="margin:0 0 16px;color:#EAEAEA;font-size:18px;font-weight:600;">Upcoming Workshops & Webinars</h2>
        ${workshops.map((w) => workshopCardHtml(w, affiliateId)).join("")}
      </div>`;
  } else {
    body += `
      <div style="background-color:#262638;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
        <p style="margin:0;color:#BDBDBD;font-size:15px;">Stay tuned for upcoming workshops and webinars!</p>
      </div>`;
  }

  // CTA to visit HQ
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  body += ctaButton(frontendUrl, "Explore Garage");

  return emailShell(header, body);
}

function welcomeEmailText(
  recipientName: string,
  orgName: string | null,
  isParentOnly: boolean,
  workshops: Array<{
    _id: string;
    title: string;
    date: Date;
    startTime: string;
    endTime: string;
    timezone: string;
    meetingUrl?: string;
  }>,
  affiliateId: string,
): string {
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  let text = recipientName ? `Hi ${recipientName},\n\n` : "Hi there,\n\n";

  if (!isParentOnly && orgName) {
    text += `Congratulations! You're now part of ${orgName}.\n\n`;
  }

  text += "Welcome to Garage — your all-in-one collaborative workspace.\n\n";

  if (workshops.length > 0) {
    text += "Upcoming Workshops & Webinars:\n\n";
    for (const w of workshops) {
      const joinLink = `${frontendUrl}/checkout/workshop/${w._id}?ref=${affiliateId}`;
      text += `- ${w.title} (${w.startTime} - ${w.endTime} ${w.timezone})\n  Join: ${joinLink}\n\n`;
    }
  }

  text += `Explore Garage: ${frontendUrl}\n\n- Garage`;
  return text;
}

// ── Referrer notification: moved to `affiliateEmailTemplates.ts` ─────
// The workshops-list HTML that used to live here was replaced by the
// dark-themed template in src/services/emails/templates/1-referrer-notification.html
// as part of the 4-email affiliate-onboard fan-out. See
// `notifyAffiliateOnboarded` below.

// ── Upline chain notifications ──────────────────────────────────────
//
// When a new user signs up, the DIRECT referrer gets the celebratory
// "You've onboarded X" email above. Everyone HIGHER in the referral
// chain (grandparent, great-grandparent, ..., root) gets a different
// email letting them know their downline just grew — even though the
// new user didn't join directly under them.
//
// Behavior:
//   - Walks `user.referredBy` from the direct upline's parent upward.
//   - Sends one email per ancestor, containing:
//       - New user's name (and city+country when we have them)
//       - Name of the person they joined DIRECTLY under (their direct upline)
//       - Total current downline size of the ancestor being emailed
//   - Uses a visited-set to defend against circular referral chains
//     (there's a real one at shorupan@gmail.com — walker terminates
//     cleanly instead of looping forever).
//   - Hard-caps at depth 20 as a safety net for pathologically deep chains.
//   - Fire-and-forget per email: one send failure logs and continues.

const UPLINE_CHAIN_MAX_DEPTH = 20;

/**
 * Count every user whose `referredBy` chain eventually traces back to
 * `rootUserId`. Uses a single Mongo `$graphLookup` — no BFS in code, one
 * indexed traversal. `referredBy` is indexed on User (per unilevel plus
 * infinity walk usage).
 *
 * Excludes `rootUserId` itself from the count (only counts descendants).
 * Circular chains are handled naturally by `$graphLookup` (each node
 * appears once in `descendants`).
 */
async function getDownlineCount(rootUserId: string): Promise<number> {
  const result = await User.aggregate([
    { $match: { _id: new Types.ObjectId(rootUserId) } },
    {
      $graphLookup: {
        from: "users",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "referredBy",
        as: "descendants",
        // Cap the traversal depth as a safety net. 30 is well past our
        // typical chain depth but small enough to bound query cost even
        // in the worst case.
        maxDepth: 30,
      },
    },
    { $project: { count: { $size: "$descendants" } } },
  ]);
  return result[0]?.count ?? 0;
}

function uplineChainNotificationHtml(params: {
  ancestorName: string;
  newUserDisplay: string;
  fromClause: string; // Pre-rendered "from City, Country" or "" if missing
  directUplineName: string;
  networkSize: number;
}): string {
  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:28px;font-weight:700;">Your Network Grew!</h1>
    <p style="margin:8px 0 0;color:#0C0C0E;font-size:15px;opacity:0.8;">A new member joined under one of your team</p>`;

  let body = greeting(params.ancestorName);

  body += `
    <div style="background-color:#262638;border-left:4px solid #10b981;padding:20px;margin:0 0 24px;border-radius:8px;">
      <p style="margin:0 0 12px;color:#EAEAEA;font-size:15px;line-height:1.6;">
        <strong style="color:#EAEAEA;">${params.newUserDisplay}</strong>${params.fromClause} has joined your network under <strong style="color:#EAEAEA;">${params.directUplineName}</strong>.
      </p>
      <p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">
        Your network is now <strong style="color:#FBD10D;font-size:16px;">${params.networkSize.toLocaleString()}</strong> ${params.networkSize === 1 ? "person" : "people"} strong.
      </p>
    </div>`;

  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  body += ctaButton(frontendUrl, "View Your Network");

  return emailShell(header, body);
}

function uplineChainNotificationText(params: {
  ancestorName: string;
  newUserDisplay: string;
  fromClause: string;
  directUplineName: string;
  networkSize: number;
}): string {
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  const salutation = params.ancestorName
    ? `Hi ${params.ancestorName},`
    : "Hi there,";
  return (
    `${salutation}\n\n` +
    `${params.newUserDisplay}${params.fromClause} has joined your network under ${params.directUplineName}.\n\n` +
    `Your network is now ${params.networkSize.toLocaleString()} ${params.networkSize === 1 ? "person" : "people"} strong.\n\n` +
    `View your network: ${frontendUrl}\n\n- Garage`
  );
}

/**
 * Walk from the direct upline's PARENT (i.e. grandparent of the new
 * signup) up to the root, sending one email per ancestor. Direct upline
 * is skipped because they already receive the celebratory email above.
 *
 * @param newUser The user who just signed up.
 * @param directUplineName The name/email of `newUser.referredBy` (already
 *   fetched by the caller — passed in to avoid a redundant lookup).
 * @param startFromAncestorId The ID to start walking from — typically
 *   `directUpline.referredBy`. If null/empty, no emails go out.
 */
async function sendUplineChainNotifications(params: {
  newUser: {
    _id: any;
    name?: string | null;
    email: string;
    city?: string | null;
    country?: string | null;
  };
  directUplineName: string;
  startFromAncestorId: string | Types.ObjectId | null | undefined;
}): Promise<void> {
  const startId = params.startFromAncestorId?.toString();
  if (!startId) return;

  const newUserDisplay = params.newUser.name || params.newUser.email;
  // "from City, Country" — dropped entirely when either field is empty.
  // Handles the common OTP-signup case where neither is collected.
  const city = params.newUser.city?.trim();
  const country = params.newUser.country?.trim();
  const fromClause = city && country ? ` from ${city}, ${country}` : "";

  const visited = new Set<string>([params.newUser._id.toString()]);
  let currentId: string | undefined = startId;
  let depth = 0;

  while (
    currentId &&
    !visited.has(currentId) &&
    depth < UPLINE_CHAIN_MAX_DEPTH
  ) {
    visited.add(currentId);

    const ancestor = (await User.findById(currentId)
      .select("name email referredBy")
      .lean()) as {
      _id: any;
      name?: string | null;
      email?: string | null;
      referredBy?: any;
    } | null;
    if (!ancestor) break; // Broken chain — bail out
    if (!ancestor.email) {
      // Ancestor has no email — skip them but continue up the chain.
      currentId = (ancestor.referredBy as any)?.toString() || undefined;
      depth++;
      continue;
    }

    try {
      const networkSize = await getDownlineCount(ancestor._id.toString());
      const html = uplineChainNotificationHtml({
        ancestorName: ancestor.name || "",
        newUserDisplay,
        fromClause,
        directUplineName: params.directUplineName,
        networkSize,
      });
      const text = uplineChainNotificationText({
        ancestorName: ancestor.name || "",
        newUserDisplay,
        fromClause,
        directUplineName: params.directUplineName,
        networkSize,
      });
      await sendMail(
        ancestor.email,
        `${newUserDisplay} joined your network`,
        html,
        text,
        EMAIL_FROM_NOTIFICATION,
      );
      console.log(
        `[WelcomeEmail] Upline chain notification sent to ${ancestor.email} (depth ${depth + 1}, downline: ${networkSize})`,
      );
    } catch (err) {
      // Per-email failure must not break the chain — log and keep walking.
      console.error(
        `[WelcomeEmail] Upline chain notification failed at depth ${depth + 1} for ${ancestor.email}:`,
        err,
      );
    }

    currentId = (ancestor.referredBy as any)?.toString() || undefined;
    depth++;
  }

  if (currentId && depth >= UPLINE_CHAIN_MAX_DEPTH) {
    console.log(
      `[WelcomeEmail] Upline chain walker hit depth cap (${UPLINE_CHAIN_MAX_DEPTH}); stopping.`,
    );
  }
}

// ── Standalone referrer notification ─────────────────────────────
//
// Public entry point for firing "you've onboarded X" to a referrer
// OUTSIDE of the sendWelcomeEmail path. Used by
// `setReferredByAffiliateId` so that when a user's `referredBy` gets
// set (or upgraded from a founder-default) via an affiliate-code
// click on an already-registered user, the affiliate actually gets a
// notification instead of it being silently swallowed because the
// user wasn't "new" any more.
//
// Best-effort — never throws. If the referrer / new user / templates
// can't be resolved, logs and returns.
export async function notifyReferrerOfNewSignup(
  newUserId: string,
  referrerUserId: string,
  orgIdHint?: string | null,
): Promise<void> {
  // Thin wrapper — delegates to the 4-email fan-out. Kept under the old
  // name so `setReferredByAffiliateId` (its only caller) doesn't need to
  // change import + call-site in the same PR.
  return notifyAffiliateOnboarded(newUserId, referrerUserId, orgIdHint);
}

// ── 4-email affiliate-onboard fan-out ────────────────────────────────
//
// Fires when a user has just been attributed to a real affiliate — either
// on fresh signup (`sendWelcomeEmail` step 2) or on the upgrade path
// (existing user's `referredBySource` flips from `founder_default` to
// `affiliate` via `setReferredByAffiliateId`).
//
// Sends four emails, each From the standard notification sender + CC'd to
// `PLATFORM_CC` (philip + shorupan):
//   1. → direct referrer  (template: 1-referrer-notification.html)
//   2. → affiliate manager (amanulla@garage.app)  (template 2)
//   3. → platform admin   (shorupan@gmail.com)       (template 3)
//   4. → the newly-onboarded user themselves         (template 4)
//        — ONLY when `referredBySource === "affiliate"` so this doesn't
//          fire for founder-default attributions (defensive; today
//          setReferredByAffiliateId only reaches here for real affiliates).
//
// Uses Promise.allSettled so one failing send doesn't block the others.
// Best-effort throughout — never throws to the caller.
export async function notifyAffiliateOnboarded(
  newUserId: string,
  referrerUserId: string,
  _orgIdHint?: string | null,
): Promise<void> {
  try {
    const [newUser, referrer] = await Promise.all([
      User.findById(newUserId)
        .select("email name phone city state country referredBySource")
        .lean<any>(),
      User.findById(referrerUserId).select("email name").lean<any>(),
    ]);
    if (!newUser || !newUser.email || !referrer?.email) {
      console.log(
        `[affiliateOnboard] Skipping — newUser or referrer missing (newUserId=${newUserId}, referrerUserId=${referrerUserId})`,
      );
      return;
    }

    const vars = {
      referrerName: referrer.name || "",
      affiliateName: newUser.name || "",
      affiliatePhone: newUser.phone || "",
      affiliateEmail: newUser.email,
      affiliateLocation: formatAffiliateLocation(newUser),
    };

    const sends: Array<Promise<any>> = [];

    // #1 — direct referrer
    const referrerMail = buildReferrerEmail(vars);
    sends.push(
      sendMail(
        referrer.email,
        referrerMail.subject,
        referrerMail.html,
        undefined,
        EMAIL_FROM_NOTIFICATION,
        PLATFORM_CC,
      ).then(
        () =>
          console.log(
            `[affiliateOnboard] #1 referrer sent to ${referrer.email} (new user: ${newUser.email})`,
          ),
        (e) =>
          console.error(
            `[affiliateOnboard] #1 referrer FAILED to ${referrer.email}:`,
            e?.message || e,
          ),
      ),
    );

    // #2 — affiliate manager
    const managerMail = buildManagerEmail(vars);
    sends.push(
      sendMail(
        managerMail.to,
        managerMail.subject,
        managerMail.html,
        undefined,
        EMAIL_FROM_NOTIFICATION,
        PLATFORM_CC,
      ).then(
        () =>
          console.log(
            `[affiliateOnboard] #2 manager sent to ${managerMail.to}`,
          ),
        (e) =>
          console.error(
            `[affiliateOnboard] #2 manager FAILED to ${managerMail.to}:`,
            e?.message || e,
          ),
      ),
    );

    // #3 — platform admin
    const adminMail = buildAdminEmail(vars);
    sends.push(
      sendMail(
        adminMail.to,
        adminMail.subject,
        adminMail.html,
        undefined,
        EMAIL_FROM_NOTIFICATION,
        PLATFORM_CC,
      ).then(
        () =>
          console.log(`[affiliateOnboard] #3 admin sent to ${adminMail.to}`),
        (e) =>
          console.error(
            `[affiliateOnboard] #3 admin FAILED to ${adminMail.to}:`,
            e?.message || e,
          ),
      ),
    );

    // #4 — welcome to the newly-onboarded affiliate (guarded)
    if (newUser.referredBySource === "affiliate") {
      const welcomeMail = buildWelcomeEmail(vars);
      sends.push(
        sendMail(
          newUser.email,
          welcomeMail.subject,
          welcomeMail.html,
          undefined,
          EMAIL_FROM_NOTIFICATION,
          PLATFORM_CC,
        ).then(
          () =>
            console.log(
              `[affiliateOnboard] #4 welcome sent to ${newUser.email}`,
            ),
          (e) =>
            console.error(
              `[affiliateOnboard] #4 welcome FAILED to ${newUser.email}:`,
              e?.message || e,
            ),
        ),
      );
    } else {
      console.log(
        `[affiliateOnboard] #4 welcome SKIPPED for ${newUser.email} (referredBySource=${newUser.referredBySource ?? "unset"})`,
      );
    }

    await Promise.allSettled(sends);
  } catch (err) {
    console.error("[affiliateOnboard] Failed:", err);
  }
}

// ── Main Export ──────────────────────────────────────────────────

export async function sendWelcomeEmail(
  userId: string,
  nonParentOrgId: string | null,
): Promise<void> {
  try {
    // Ensure user has an affiliate ID
    const affiliateId = await ensureUserHasAffiliateId(userId);

    const user = await User.findById(userId)
      .select("email name affiliateId referredBy city country")
      .lean();
    if (!user || !user.email) {
      console.log("[WelcomeEmail] User not found or no email:", userId);
      return;
    }

    let org: any = null;
    let targetOrgId: string;
    let isParentOnly = false;

    if (nonParentOrgId) {
      org = await Organization.findById(nonParentOrgId)
        .select(
          "name icon description city state country parent welcomeEmail mailboxConfig",
        )
        .lean();
      if (!org) {
        console.log("[WelcomeEmail] Organization not found:", nonParentOrgId);
        return;
      }
      targetOrgId = nonParentOrgId;
      isParentOnly = false;
    } else {
      // Parent HQ only
      org = await Organization.findOne({ parent: true })
        .select(
          "name icon description city state country parent welcomeEmail mailboxConfig",
        )
        .lean();
      if (!org) {
        console.log("[WelcomeEmail] Parent org (GARAGE HQ) not found");
        return;
      }
      targetOrgId = org._id.toString();
      isParentOnly = true;
    }

    // Fetch all upcoming workshops (uses checkout URL for affiliate links, so meetingUrl not required)
    const workshops = await Workshop.find({
      orgId: targetOrgId,
      isActive: true,
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .select(
        "title thumbnail date startTime endTime timezone meetingUrl isFree price currency",
      )
      .lean();

    // 1. Send welcome email to the new user
    const subject = isParentOnly
      ? "Welcome to Garage!"
      : `Welcome to ${org.name} on Garage!`;

    // A founder-authored template replaces the built-in layout wholesale. The
    // workshop cards are part of the built-in body only — a custom design owns
    // its own content.
    const custom = (org as any).welcomeEmail;
    const useCustomTemplate =
      !!custom?.templateHtml &&
      !!custom?.templateId &&
      custom.templateId !== DEFAULT_WELCOME_TEMPLATE_ID;

    const html = useCustomTemplate
      ? renderWelcomeTemplate(
          custom.templateHtml,
          await buildWelcomeMergeVars(
            { name: user.name, email: user.email },
            org,
          ),
        )
      : welcomeEmailHtml(
          user.name || "",
          isParentOnly ? null : org,
          isParentOnly,
          workshops as any,
          affiliateId,
        );

    // The plain-text part has to describe the HTML that shipped, so a custom
    // template gets a text body with no workshop list either.
    const text = welcomeEmailText(
      user.name || "",
      isParentOnly ? null : org.name,
      isParentOnly,
      useCustomTemplate ? [] : (workshops as any),
      affiliateId,
    );

    await sendMail(
      user.email,
      subject,
      html,
      text,
      await senderForOrg(org?._id),
    );
    console.log(
      `[WelcomeEmail] Sent to ${user.email} (org: ${org.name}, template: ${
        useCustomTemplate ? custom.templateName || custom.templateId : "default"
      })`,
    );

    // 2. Fan out the 4-email affiliate-onboard bundle (direct referrer +
    //    manager + admin + welcome-to-new-user). The old workshops-list
    //    referrer email was retired here; see
    //    `notifyAffiliateOnboarded` for the new template set. We still
    //    load the direct referrer upfront so the upline-chain walker
    //    below can reuse the name without a second Mongo hit.
    let referrer: {
      _id: any;
      email?: string;
      name?: string;
      referredBy?: any;
    } | null = null;
    if (user.referredBy) {
      try {
        referrer = (await User.findById(user.referredBy)
          .select("email name referredBy")
          .lean()) as any;
        if (referrer?.email) {
          await notifyAffiliateOnboarded(
            String(user._id),
            String(referrer._id),
            targetOrgId,
          );
        }
      } catch (referrerErr) {
        console.error(
          "[WelcomeEmail] Failed to send affiliate-onboard emails:",
          referrerErr,
        );
      }
    }

    // 3. Walk the upline chain from the direct referrer's PARENT upward,
    //    sending one "joined your network under {direct upline}" email per
    //    ancestor. Direct upline was already notified in step 2 with the
    //    celebratory template. Fire-and-forget — a failure here can't
    //    block the response since sendWelcomeEmail is itself called with
    //    .catch(...) from every signup entry point.
    if (referrer?.referredBy) {
      try {
        await sendUplineChainNotifications({
          newUser: user as any,
          directUplineName: referrer.name || referrer.email || "your team",
          startFromAncestorId: referrer.referredBy,
        });
      } catch (chainErr) {
        console.error(
          "[WelcomeEmail] Upline chain notifications failed:",
          chainErr,
        );
      }
    }
  } catch (err) {
    console.error("[WelcomeEmail] Failed to send:", err);
  }
}

/**
 * Sends the organization's join-welcome email to one named user on demand —
 * the "send a test to my inbox" button in Manage Organization.
 *
 * Deliberately runs the same merge engine the real send does, so what lands in
 * the founder's inbox is what a new member will get. `templateHtml` lets them
 * test what is currently on screen; without it the saved snapshot is used, and
 * with neither the built-in layout is rendered.
 *
 * Unlike `sendWelcomeEmail` this throws — the caller is a request the founder
 * is waiting on, so a failure has to reach them rather than be logged away.
 */
export async function sendWelcomeEmailTest(
  userId: string,
  orgId: string,
  templateHtml?: string,
): Promise<{ to: string }> {
  const user = await User.findById(userId).select("email name").lean();
  if (!user?.email) throw new Error("Your account has no email address");

  const org: any = await Organization.findById(orgId)
    .select(
      "name icon description city state country parent welcomeEmail mailboxConfig",
    )
    .lean();
  if (!org) throw new Error("Organization not found");

  const isParentOnly = !!org.parent;
  const custom = (templateHtml || org?.welcomeEmail?.templateHtml || "").trim();
  const affiliateId = await ensureUserHasAffiliateId(userId);

  let html: string;
  let workshops: any[] = [];
  if (custom) {
    html = renderWelcomeTemplate(
      custom,
      await buildWelcomeMergeVars({ name: user.name, email: user.email }, org),
    );
  } else {
    workshops = await Workshop.find({
      orgId,
      isActive: true,
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .select(
        "title thumbnail date startTime endTime timezone meetingUrl isFree price currency",
      )
      .lean();
    html = welcomeEmailHtml(
      user.name || "",
      isParentOnly ? null : org,
      isParentOnly,
      workshops as any,
      affiliateId,
    );
  }

  if (!html.trim()) {
    throw new Error("The selected template rendered as an empty email");
  }

  const text = welcomeEmailText(
    user.name || "",
    isParentOnly ? null : org.name,
    isParentOnly,
    workshops as any,
    affiliateId,
  );

  // Prefixed so a test never gets mistaken for the real thing in the inbox.
  const subject = isParentOnly
    ? "[Test] Welcome to Garage!"
    : `[Test] Welcome to ${org.name} on Garage!`;

  await sendMail(user.email, subject, html, text, EMAIL_FROM_NOTIFICATION);
  console.log(`[WelcomeEmail] Test sent to ${user.email} (org: ${org.name})`);
  return { to: user.email };
}

// ── 4-email founder-onboard fan-out ─────────────────────────────────
//
// Fires when a user creates a NEW Organization and becomes its founder
// (routes: POST /org/create-first-time and POST /org/upsert with
// isNewOrg === true). Distinct from the affiliate 4-email fan-out —
// different templates, different recipients:
//
//   1. → the founder's referrer (auto-set to Shorupan if unattributed)
//   2. → EACH founder manager in FOUNDER_MANAGERS (one send per manager)
//   3. → the platform admin (Shorupan)
//   4. → the founder themselves (corporate welcome mail)
//
// All CC'd to PLATFORM_CC (philip + shorupan). Best-effort throughout —
// uses Promise.allSettled so any one send failing doesn't block others,
// and never throws to the caller (safe to fire-and-forget).
export async function notifyFounderOnboarded(
  founderUserId: string,
  orgId: string,
): Promise<void> {
  try {
    const [founder, org] = await Promise.all([
      User.findById(founderUserId)
        .select("email name phone referredBy")
        .lean<any>(),
      Organization.findById(orgId)
        .select("name city state country")
        .lean<any>(),
    ]);
    if (!founder || !founder.email || !org) {
      console.log(
        `[founderOnboard] Skipping — founder or org missing (founderUserId=${founderUserId}, orgId=${orgId})`,
      );
      return;
    }

    // Referrer resolution — founders always have `referredBy` set
    // (auto-stamped to Shorupan when unattributed by /org/create-first-time
    // + /org/upsert). Only skip if lookup fails.
    let referrerName = "";
    let referrerEmail: string | null = null;
    if (founder.referredBy) {
      const ref = await User.findById(founder.referredBy)
        .select("email name")
        .lean<any>();
      if (ref) {
        referrerName = ref.name || "";
        referrerEmail = ref.email || null;
      }
    }

    const vars = {
      referrerName,
      corporateName: org.name || "",
      corporatePhone: founder.phone || "",
      corporateEmail: founder.email,
      corporateLocation: formatCorporateLocation(org),
      contactName: founder.name || "",
    };

    const sends: Array<Promise<any>> = [];

    // #1 — referrer notification
    if (referrerEmail) {
      const mail = buildFounderReferrerEmail(vars);
      sends.push(
        sendMail(
          referrerEmail,
          mail.subject,
          mail.html,
          undefined,
          EMAIL_FROM_NOTIFICATION,
          PLATFORM_CC,
        ).then(
          () =>
            console.log(
              `[founderOnboard] #1 referrer sent to ${referrerEmail} (org: ${org.name})`,
            ),
          (e) =>
            console.error(
              `[founderOnboard] #1 referrer FAILED to ${referrerEmail}:`,
              e?.message || e,
            ),
        ),
      );
    } else {
      console.log(
        `[founderOnboard] #1 referrer SKIPPED — no referrerEmail for founder ${founder.email}`,
      );
    }

    // #2 — one email per founder manager
    const managerMails = buildFounderManagerEmails(vars);
    for (const mail of managerMails) {
      sends.push(
        sendMail(
          mail.to,
          mail.subject,
          mail.html,
          undefined,
          EMAIL_FROM_NOTIFICATION,
          PLATFORM_CC,
        ).then(
          () =>
            console.log(
              `[founderOnboard] #2 manager sent to ${mail.to} (org: ${org.name})`,
            ),
          (e) =>
            console.error(
              `[founderOnboard] #2 manager FAILED to ${mail.to}:`,
              e?.message || e,
            ),
        ),
      );
    }

    // #3 — admin notification
    const adminMail = buildFounderAdminEmail(vars);
    sends.push(
      sendMail(
        adminMail.to,
        adminMail.subject,
        adminMail.html,
        undefined,
        EMAIL_FROM_NOTIFICATION,
        PLATFORM_CC,
      ).then(
        () =>
          console.log(
            `[founderOnboard] #3 admin sent to ${adminMail.to} (org: ${org.name})`,
          ),
        (e) =>
          console.error(
            `[founderOnboard] #3 admin FAILED to ${adminMail.to}:`,
            e?.message || e,
          ),
      ),
    );

    // #4 — corporate welcome to the founder themselves
    const welcomeMail = buildFounderWelcomeEmail(vars);
    sends.push(
      sendMail(
        founder.email,
        welcomeMail.subject,
        welcomeMail.html,
        undefined,
        EMAIL_FROM_NOTIFICATION,
        PLATFORM_CC,
      ).then(
        () =>
          console.log(`[founderOnboard] #4 welcome sent to ${founder.email}`),
        (e) =>
          console.error(
            `[founderOnboard] #4 welcome FAILED to ${founder.email}:`,
            e?.message || e,
          ),
      ),
    );

    await Promise.allSettled(sends);
  } catch (err) {
    console.error("[founderOnboard] Failed:", err);
  }
}
