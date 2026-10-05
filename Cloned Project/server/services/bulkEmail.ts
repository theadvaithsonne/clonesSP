import { Resend } from "resend";
import { Types } from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { EMAIL_FROM_NOTIFICATION } from "./mailer";

const resend = new Resend(env.RESEND_API_KEY);

const BATCH_SIZE = 100;
const DELAY_BETWEEN_BATCHES_MS = 1100;

// Global send queue — ensures broadcasts run one at a time to avoid rate limits
let sendQueue: Promise<any> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = sendQueue.then(fn, fn); // run even if previous failed
  sendQueue = task.catch(() => {}); // swallow so queue never rejects
  return task;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function getAllPlatformEmails(
  excludeEmail?: string
): Promise<Array<{ email: string; name: string }>> {
  const users = await User.find({ email: { $exists: true, $ne: null } })
    .select("email name")
    .lean();

  const seen = new Set<string>();
  return (users as Array<{ email?: string; name?: string }>).filter((u) => {
    const e = u.email?.toLowerCase();
    if (!e || seen.has(e) || e === excludeEmail?.toLowerCase()) return false;
    seen.add(e);
    return true;
  }).map((u) => ({ email: u.email!, name: u.name || "" }));
}

async function getOrgMemberEmails(
  orgId: string,
  excludeEmail?: string
): Promise<Array<{ email: string; name: string }>> {
  const users = await User.find({
    "organizations.organization": new Types.ObjectId(orgId),
    email: { $exists: true, $ne: null },
  })
    .select("email name")
    .lean();

  const seen = new Set<string>();
  return (users as Array<{ email?: string; name?: string }>).filter((u) => {
    const e = u.email?.toLowerCase();
    if (!e || seen.has(e) || e === excludeEmail?.toLowerCase()) return false;
    seen.add(e);
    return true;
  }).map((u) => ({ email: u.email!, name: u.name || "" }));
}

async function sendBulkEmail(
  recipients: Array<{ email: string; name: string }>,
  subject: string,
  htmlFn: (recipient: { email: string; name: string }) => string,
  textFn?: (recipient: { email: string; name: string }) => string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  console.log(`[BulkEmail] Sending "${subject}" to ${recipients.length} recipients`);

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);

    const payload = chunk.map((r) => ({
      from: EMAIL_FROM_NOTIFICATION,
      to: r.email,
      subject,
      html: htmlFn(r),
      ...(textFn ? { text: textFn(r) } : {}),
    }));

    try {
      const { data, error } = await resend.batch.send(payload);

      if (error) {
        console.error(`[BulkEmail] Batch error:`, error);
        failed += chunk.length;
      } else {
        sent += data?.data?.length || chunk.length;
      }
    } catch (err) {
      console.error(`[BulkEmail] Batch exception:`, err);
      failed += chunk.length;
    }

    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`[BulkEmail] Done: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

// ── Shared template pieces ───────────────────────────────────────────

export const FONT = `'Geist', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

export function emailShell(headerHtml: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0C0C0E;font-family:${FONT};">
  <div style="max-width:600px;margin:40px auto;background-color:#1E1E2D;border-radius:12px;overflow:hidden;border:1px solid #2a2a3d;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#FBA70A 0%,#FBD10D 50%,#F97316 100%);padding:40px 30px;text-align:center;">
      ${headerHtml}
    </div>
    <!-- Body -->
    <div style="padding:40px 30px;">
      ${bodyHtml}
    </div>
    <!-- Footer -->
    <div style="padding:20px 30px;text-align:center;border-top:1px solid #2a2a3d;">
      <p style="margin:0;color:#555;font-size:12px;">Powered by Garage</p>
    </div>
  </div>
</body>
</html>`;
}

export function ctaButton(href: string, label: string): string {
  return `<div style="text-align:center;margin:30px 0;">
  <a href="${href}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#FBA70A,#FBD10D);color:#0C0C0E;text-decoration:none;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
    ${label}
  </a>
</div>`;
}

export function fallbackLink(href: string): string {
  return `<p style="margin:20px 0 0;color:#666;font-size:13px;line-height:1.5;">
  If the button doesn't work, copy this link:<br/>
  <a href="${href}" style="color:#FBD10D;word-break:break-all;text-decoration:none;">${href}</a>
</p>`;
}

export function greeting(name: string): string {
  return `<p style="margin:0 0 16px;color:#EAEAEA;font-size:16px;line-height:1.6;">
  ${name ? `Hi ${name},` : "Hi there,"}
</p>`;
}

export function bodyText(text: string): string {
  return `<p style="margin:0 0 16px;color:#BDBDBD;font-size:15px;line-height:1.6;">${text}</p>`;
}

// ── New Office Template ──────────────────────────────────────────────

function newOfficeEmailHtml(
  org: { name: string; city?: string; state?: string; country?: string; description?: string; icon?: string },
  hqLink: string,
  recipientName: string
): string {
  const location = [org.city, org.state, org.country].filter(Boolean).join(", ");

  const header = `
    ${org.icon ? `<img src="${org.icon}" alt="${org.name}" style="width:56px;height:56px;border-radius:12px;margin-bottom:14px;border:2px solid rgba(255,255,255,0.3);" />` : ""}
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">New Office on Garage</h1>
  `;

  const body = `
    ${greeting(recipientName)}
    ${bodyText("A new office has just been created on Garage:")}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      <h2 style="margin:0 0 8px;color:#EAEAEA;font-size:20px;font-weight:600;">${org.name}</h2>
      ${location ? `<p style="margin:0 0 6px;color:#888;font-size:14px;">${location}</p>` : ""}
      ${org.description ? `<p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${org.description}</p>` : ""}
    </div>
    ${ctaButton(hqLink, "Visit HQ")}
    ${fallbackLink(hqLink)}
  `;

  return emailShell(header, body);
}

function newOfficeEmailText(
  org: { name: string; city?: string; state?: string; country?: string; description?: string },
  hqLink: string,
  recipientName: string
): string {
  const location = [org.city, org.state, org.country].filter(Boolean).join(", ");
  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

A new office has just been created on Garage:

${org.name}${location ? `\n${location}` : ""}${org.description ? `\n${org.description}` : ""}

Visit the HQ: ${hqLink}

- Garage`;
}

// ── New Product Template ─────────────────────────────────────────────

function newProductEmailHtml(
  product: { name: string; price: number; currency: string; description?: string; images?: string[] },
  productLink: string,
  orgName: string,
  recipientName: string
): string {
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  }).format(product.price);

  const imageHtml = product.images?.[0]
    ? `<img src="${product.images[0]}" alt="${product.name}" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;margin-bottom:20px;" />`
    : "";

  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">New Product Available</h1>
  `;

  const body = `
    ${greeting(recipientName)}
    ${bodyText(`A new product has been listed by <strong style="color:#EAEAEA;">${orgName}</strong>:`)}
    ${imageHtml}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      <h2 style="margin:0 0 8px;color:#EAEAEA;font-size:20px;font-weight:600;">${product.name}</h2>
      <p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">${formattedPrice}</p>
      ${product.description ? `<p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${product.description.substring(0, 200)}${product.description.length > 200 ? "..." : ""}</p>` : ""}
    </div>
    ${ctaButton(productLink, "View Product")}
    ${fallbackLink(productLink)}
  `;

  return emailShell(header, body);
}

function newProductEmailText(
  product: { name: string; price: number; currency: string; description?: string },
  productLink: string,
  orgName: string,
  recipientName: string
): string {
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  }).format(product.price);

  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

A new product has been listed by ${orgName}:

${product.name}
${formattedPrice}${product.description ? `\n${product.description.substring(0, 200)}` : ""}

View the product: ${productLink}

- Garage`;
}

// ── New Person Joined Template ───────────────────────────────────────

function newPersonJoinedEmailHtml(
  newUser: { name?: string; city?: string; referredByName?: string },
  recipientName: string
): string {
  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">New Member on Garage</h1>
  `;

  const rows = [
    { label: "Name", value: newUser.name || "Not provided yet" },
    ...(newUser.city ? [{ label: "City", value: newUser.city }] : []),
    ...(newUser.referredByName ? [{ label: "Referred by", value: newUser.referredByName }] : []),
  ];

  const tableRows = rows
    .map(
      (r) => `<tr>
        <td style="padding:10px 12px;color:#888;font-size:13px;vertical-align:top;width:110px;border-bottom:1px solid #2a2a3d;">${r.label}</td>
        <td style="padding:10px 12px;color:#EAEAEA;font-size:15px;font-weight:600;border-bottom:1px solid #2a2a3d;">${r.value}</td>
      </tr>`
    )
    .join("");

  const body = `
    ${greeting(recipientName)}
    ${bodyText("A new person has joined the Garage community!")}
    <div style="background-color:#262638;border-radius:10px;overflow:hidden;margin:20px 0;border:1px solid #2a2a3d;">
      <table style="width:100%;border-collapse:collapse;">
        ${tableRows}
      </table>
    </div>
  `;

  return emailShell(header, body);
}

function newPersonJoinedEmailText(
  newUser: { name?: string; city?: string; referredByName?: string },
  recipientName: string
): string {
  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

A new person has joined the Garage community!

Name: ${newUser.name || "Not provided yet"}${newUser.city ? `\nCity: ${newUser.city}` : ""}${newUser.referredByName ? `\nReferred by: ${newUser.referredByName}` : ""}

- Garage`;
}

// ── New Service Template ─────────────────────────────────────────────

function newServiceEmailHtml(
  service: { name: string; description?: string; coverImage?: string },
  serviceLink: string,
  orgName: string,
  recipientName: string
): string {
  const imageHtml = service.coverImage
    ? `<img src="${service.coverImage}" alt="${service.name}" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;margin-bottom:20px;" />`
    : "";

  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">New Service Available</h1>
  `;

  const body = `
    ${greeting(recipientName)}
    ${bodyText(`A new service has been listed by <strong style="color:#EAEAEA;">${orgName}</strong>:`)}
    ${imageHtml}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      <h2 style="margin:0 0 8px;color:#EAEAEA;font-size:20px;font-weight:600;">${service.name}</h2>
      ${service.description ? `<p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${service.description.substring(0, 200)}${service.description.length > 200 ? "..." : ""}</p>` : ""}
    </div>
    ${ctaButton(serviceLink, "View Service")}
    ${fallbackLink(serviceLink)}
  `;

  return emailShell(header, body);
}

function newServiceEmailText(
  service: { name: string; description?: string },
  serviceLink: string,
  orgName: string,
  recipientName: string
): string {
  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

A new service has been listed by ${orgName}:

${service.name}${service.description ? `\n${service.description.substring(0, 200)}` : ""}

View the service: ${serviceLink}

- Garage`;
}

// ── New Course Template ──────────────────────────────────────────────

function newCourseEmailHtml(
  course: { name: string; price?: number; currency?: string; description?: string; coverImage?: string },
  courseLink: string,
  orgName: string,
  recipientName: string
): string {
  const priceHtml =
    course.price && course.price > 0
      ? `<p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">${new Intl.NumberFormat("en-US", { style: "currency", currency: course.currency || "USD" }).format(course.price)}</p>`
      : `<p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">Free</p>`;

  const imageHtml = course.coverImage
    ? `<img src="${course.coverImage}" alt="${course.name}" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;margin-bottom:20px;" />`
    : "";

  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">New Course Available</h1>
  `;

  const body = `
    ${greeting(recipientName)}
    ${bodyText(`A new course has been published by <strong style="color:#EAEAEA;">${orgName}</strong>:`)}
    ${imageHtml}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      <h2 style="margin:0 0 8px;color:#EAEAEA;font-size:20px;font-weight:600;">${course.name}</h2>
      ${priceHtml}
      ${course.description ? `<p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${course.description.substring(0, 200)}${course.description.length > 200 ? "..." : ""}</p>` : ""}
    </div>
    ${ctaButton(courseLink, "View Course")}
    ${fallbackLink(courseLink)}
  `;

  return emailShell(header, body);
}

function newCourseEmailText(
  course: { name: string; price?: number; currency?: string; description?: string },
  courseLink: string,
  orgName: string,
  recipientName: string
): string {
  const priceStr =
    course.price && course.price > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: course.currency || "USD" }).format(course.price)
      : "Free";

  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

A new course has been published by ${orgName}:

${course.name}
${priceStr}${course.description ? `\n${course.description.substring(0, 200)}` : ""}

View the course: ${courseLink}

- Garage`;
}

// ── New Workshop Template ────────────────────────────────────────────

function newWorkshopEmailHtml(
  workshop: { name: string; price?: number; currency?: string; description?: string; thumbnail?: string; date?: string },
  workshopLink: string,
  orgName: string,
  recipientName: string
): string {
  const priceHtml =
    workshop.price && workshop.price > 0
      ? `<p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">${new Intl.NumberFormat("en-US", { style: "currency", currency: workshop.currency || "USD" }).format(workshop.price)}</p>`
      : `<p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">Free</p>`;

  const imageHtml = workshop.thumbnail
    ? `<img src="${workshop.thumbnail}" alt="${workshop.name}" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;margin-bottom:20px;" />`
    : "";

  const dateHtml = workshop.date
    ? `<p style="margin:0 0 6px;color:#888;font-size:14px;">📅 ${new Date(workshop.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>`
    : "";

  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">New Workshop Available</h1>
  `;

  const body = `
    ${greeting(recipientName)}
    ${bodyText(`A new workshop has been scheduled by <strong style="color:#EAEAEA;">${orgName}</strong>:`)}
    ${imageHtml}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      <h2 style="margin:0 0 8px;color:#EAEAEA;font-size:20px;font-weight:600;">${workshop.name}</h2>
      ${dateHtml}
      ${priceHtml}
      ${workshop.description ? `<p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${workshop.description.substring(0, 200)}${workshop.description.length > 200 ? "..." : ""}</p>` : ""}
    </div>
    ${ctaButton(workshopLink, "View Workshop")}
    ${fallbackLink(workshopLink)}
  `;

  return emailShell(header, body);
}

function newWorkshopEmailText(
  workshop: { name: string; price?: number; currency?: string; description?: string; date?: string },
  workshopLink: string,
  orgName: string,
  recipientName: string
): string {
  const priceStr =
    workshop.price && workshop.price > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: workshop.currency || "USD" }).format(workshop.price)
      : "Free";
  const dateStr = workshop.date
    ? new Date(workshop.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";

  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

A new workshop has been scheduled by ${orgName}:

${workshop.name}${dateStr ? `\n${dateStr}` : ""}
${priceStr}${workshop.description ? `\n${workshop.description.substring(0, 200)}` : ""}

View the workshop: ${workshopLink}

- Garage`;
}

// ── New Call Offering Template ───────────────────────────────────────

function newCallEmailHtml(
  call: { name: string; pricePerCall?: number; currency?: string; description?: string; coverImage?: string; duration?: number },
  callLink: string,
  orgName: string,
  recipientName: string
): string {
  const priceHtml =
    call.pricePerCall && call.pricePerCall > 0
      ? `<p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">${new Intl.NumberFormat("en-US", { style: "currency", currency: call.currency || "USD" }).format(call.pricePerCall)}</p>`
      : `<p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">Free</p>`;

  const durationHtml = call.duration
    ? `<p style="margin:0 0 6px;color:#888;font-size:14px;">⏱ ${call.duration} minutes</p>`
    : "";

  const imageHtml = call.coverImage
    ? `<img src="${call.coverImage}" alt="${call.name}" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;margin-bottom:20px;" />`
    : "";

  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">New Call Offering Available</h1>
  `;

  const body = `
    ${greeting(recipientName)}
    ${bodyText(`A new call offering has been listed by <strong style="color:#EAEAEA;">${orgName}</strong>:`)}
    ${imageHtml}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      <h2 style="margin:0 0 8px;color:#EAEAEA;font-size:20px;font-weight:600;">${call.name}</h2>
      ${durationHtml}
      ${priceHtml}
      ${call.description ? `<p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${call.description.substring(0, 200)}${call.description.length > 200 ? "..." : ""}</p>` : ""}
    </div>
    ${ctaButton(callLink, "Book a Call")}
    ${fallbackLink(callLink)}
  `;

  return emailShell(header, body);
}

function newCallEmailText(
  call: { name: string; pricePerCall?: number; currency?: string; description?: string; duration?: number },
  callLink: string,
  orgName: string,
  recipientName: string
): string {
  const priceStr =
    call.pricePerCall && call.pricePerCall > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: call.currency || "USD" }).format(call.pricePerCall)
      : "Free";

  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

A new call offering has been listed by ${orgName}:

${call.name}${call.duration ? `\n${call.duration} minutes` : ""}
${priceStr}${call.description ? `\n${call.description.substring(0, 200)}` : ""}

Book a call: ${callLink}

- Garage`;
}

// ── New Channel Template ─────────────────────────────────────────────

function newChannelEmailHtml(
  channel: { name: string; price?: number; currency?: string; description?: string; coverImage?: string },
  channelLink: string,
  orgName: string,
  recipientName: string
): string {
  const priceHtml =
    channel.price && channel.price > 0
      ? `<p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">${new Intl.NumberFormat("en-US", { style: "currency", currency: channel.currency || "USD" }).format(channel.price)}</p>`
      : `<p style="margin:0 0 8px;color:#FBD10D;font-size:22px;font-weight:700;">Free</p>`;

  const imageHtml = channel.coverImage
    ? `<img src="${channel.coverImage}" alt="${channel.name}" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;margin-bottom:20px;" />`
    : "";

  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">New Channel Available</h1>
  `;

  const body = `
    ${greeting(recipientName)}
    ${bodyText(`A new channel has been created by <strong style="color:#EAEAEA;">${orgName}</strong>:`)}
    ${imageHtml}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      <h2 style="margin:0 0 8px;color:#EAEAEA;font-size:20px;font-weight:600;">${channel.name}</h2>
      ${priceHtml}
      ${channel.description ? `<p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${channel.description.substring(0, 200)}${channel.description.length > 200 ? "..." : ""}</p>` : ""}
    </div>
    ${ctaButton(channelLink, "View Channel")}
    ${fallbackLink(channelLink)}
  `;

  return emailShell(header, body);
}

function newChannelEmailText(
  channel: { name: string; price?: number; currency?: string; description?: string },
  channelLink: string,
  orgName: string,
  recipientName: string
): string {
  const priceStr =
    channel.price && channel.price > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: channel.currency || "USD" }).format(channel.price)
      : "Free";

  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

A new channel has been created by ${orgName}:

${channel.name}
${priceStr}${channel.description ? `\n${channel.description.substring(0, 200)}` : ""}

View the channel: ${channelLink}

- Garage`;
}

// ── Public Trigger Functions (fire-and-forget) ───────────────────────

export function notifyNewOfficeCreated(org: {
  _id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  icon?: string;
}) {
  // SUSPENDED (2026-07-03): platform-wide new-office blast temporarily
  // disabled at the source. Both call sites in routes/org.ts are also
  // commented out, but this early-return is belt-and-suspenders — it
  // defuses the function itself so any stale build, forgotten caller,
  // scheduled job, or accidental un-comment can't fire the blast. Remove
  // this block to resume; keep the console log to make suppression
  // visible in prod logs (helps diagnose "why didn't the email go out?").
  console.log(
    `[BulkEmail] notifyNewOfficeCreated SUPPRESSED for org "${org.name}" (${org._id}) — feature suspended`
  );
  return;

  // eslint-disable-next-line no-unreachable
  if (!env.ENABLE_BULK_EMAILS) return;

  // eslint-disable-next-line no-unreachable
  enqueue(() => _notifyNewOfficeCreated(org)).catch((err) =>
    console.error("[BulkEmail] notifyNewOfficeCreated failed:", err)
  );
}

async function _notifyNewOfficeCreated(org: {
  _id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  icon?: string;
}) {
  // SUSPENDED (2026-07-03): last line of defense. Even if the public
  // wrapper somehow bypasses its own guard (stale module cache, hot
  // reload, dynamic import, future re-caller), this internal function
  // no-ops before touching Resend. When resuming: delete this block
  // AND remove the guard from notifyNewOfficeCreated above.
  console.log(
    `[BulkEmail] _notifyNewOfficeCreated SUPPRESSED for org "${org.name}" (${org._id}) — feature suspended`
  );
  return;

  // eslint-disable-next-line no-unreachable
  const recipients = await getAllPlatformEmails();
  if (recipients.length === 0) return;

  // eslint-disable-next-line no-unreachable
  const hqLink = `${env.FRONTEND_URL}/guest/${org.slug}`;

  // eslint-disable-next-line no-unreachable
  await sendBulkEmail(
    recipients,
    `New Office on Garage: ${org.name}`,
    (r) => newOfficeEmailHtml(org, hqLink, r.name),
    (r) => newOfficeEmailText(org, hqLink, r.name)
  );
}

export function notifyNewProductCreated(
  product: {
    _id: string;
    name: string;
    price: number;
    currency: string;
    description?: string;
    images?: string[];
  },
  orgName: string,
  orgId: string
) {
  if (!env.ENABLE_BULK_EMAILS) return;

  enqueue(() => _notifyNewProductCreated(product, orgName, orgId)).catch(
    (err) =>
      console.error("[BulkEmail] notifyNewProductCreated failed:", err)
  );
}

async function _notifyNewProductCreated(
  product: {
    _id: string;
    name: string;
    price: number;
    currency: string;
    description?: string;
    images?: string[];
  },
  orgName: string,
  orgId: string
) {
  // Scoped to the org that owns this offering. Members of other offices
  // shouldn't be spammed about a product they can't browse anyway.
  const recipients = await getOrgMemberEmails(orgId);
  if (recipients.length === 0) return;

  const productLink = `${env.FRONTEND_URL}/checkout/product/${product._id}`;

  await sendBulkEmail(
    recipients,
    `New Product on Garage: ${product.name}`,
    (r) => newProductEmailHtml(product, productLink, orgName, r.name),
    (r) => newProductEmailText(product, productLink, orgName, r.name)
  );
}

export function notifyNewPersonJoined(newUser: {
  email: string;
  name?: string;
  city?: string;
  referredByName?: string;
}) {
  if (!env.ENABLE_BULK_EMAILS) return;

  enqueue(() => _notifyNewPersonJoined(newUser)).catch((err) =>
    console.error("[BulkEmail] notifyNewPersonJoined failed:", err)
  );
}

async function _notifyNewPersonJoined(newUser: {
  email: string;
  name?: string;
  city?: string;
  referredByName?: string;
}) {
  const recipients = await getAllPlatformEmails(newUser.email);
  if (recipients.length === 0) return;

  await sendBulkEmail(
    recipients,
    `New Member on Garage${newUser.name ? `: ${newUser.name}` : ""}`,
    (r) => newPersonJoinedEmailHtml(newUser, r.name),
    (r) => newPersonJoinedEmailText(newUser, r.name)
  );
}

// ── Service ──────────────────────────────────────────────────────────

export function notifyNewServiceCreated(
  service: {
    _id: string;
    name: string;
    description?: string;
    coverImage?: string;
  },
  orgName: string,
  orgId: string
) {
  if (!env.ENABLE_BULK_EMAILS) return;

  enqueue(() => _notifyNewServiceCreated(service, orgName, orgId)).catch(
    (err) =>
      console.error("[BulkEmail] notifyNewServiceCreated failed:", err)
  );
}

async function _notifyNewServiceCreated(
  service: {
    _id: string;
    name: string;
    description?: string;
    coverImage?: string;
  },
  orgName: string,
  orgId: string
) {
  const recipients = await getOrgMemberEmails(orgId);
  if (recipients.length === 0) return;

  const serviceLink = `${env.FRONTEND_URL}/checkout/service/${service._id}`;

  await sendBulkEmail(
    recipients,
    `New Service on Garage: ${service.name}`,
    (r) => newServiceEmailHtml(service, serviceLink, orgName, r.name),
    (r) => newServiceEmailText(service, serviceLink, orgName, r.name)
  );
}

// ── Course ───────────────────────────────────────────────────────────

export function notifyNewCourseCreated(
  course: {
    _id: string;
    name: string;
    price?: number;
    currency?: string;
    description?: string;
    coverImage?: string;
  },
  orgName: string,
  orgId: string
) {
  if (!env.ENABLE_BULK_EMAILS) return;

  enqueue(() => _notifyNewCourseCreated(course, orgName, orgId)).catch(
    (err) => console.error("[BulkEmail] notifyNewCourseCreated failed:", err)
  );
}

async function _notifyNewCourseCreated(
  course: {
    _id: string;
    name: string;
    price?: number;
    currency?: string;
    description?: string;
    coverImage?: string;
  },
  orgName: string,
  orgId: string
) {
  const recipients = await getOrgMemberEmails(orgId);
  if (recipients.length === 0) return;

  const courseLink = `${env.FRONTEND_URL}/checkout/course/${course._id}`;

  await sendBulkEmail(
    recipients,
    `New Course on Garage: ${course.name}`,
    (r) => newCourseEmailHtml(course, courseLink, orgName, r.name),
    (r) => newCourseEmailText(course, courseLink, orgName, r.name)
  );
}

// ── Workshop ─────────────────────────────────────────────────────────

export function notifyNewWorkshopCreated(
  workshop: {
    _id: string;
    name: string;
    price?: number;
    currency?: string;
    description?: string;
    thumbnail?: string;
    date?: string;
  },
  orgName: string,
  orgId: string
) {
  if (!env.ENABLE_BULK_EMAILS) return;

  enqueue(() => _notifyNewWorkshopCreated(workshop, orgName, orgId)).catch(
    (err) =>
      console.error("[BulkEmail] notifyNewWorkshopCreated failed:", err)
  );
}

async function _notifyNewWorkshopCreated(
  workshop: {
    _id: string;
    name: string;
    price?: number;
    currency?: string;
    description?: string;
    thumbnail?: string;
    date?: string;
  },
  orgName: string,
  orgId: string
) {
  const recipients = await getOrgMemberEmails(orgId);
  if (recipients.length === 0) return;

  const workshopLink = `${env.FRONTEND_URL}/checkout/workshop/${workshop._id}`;

  await sendBulkEmail(
    recipients,
    `New Workshop on Garage: ${workshop.name}`,
    (r) => newWorkshopEmailHtml(workshop, workshopLink, orgName, r.name),
    (r) => newWorkshopEmailText(workshop, workshopLink, orgName, r.name)
  );
}

// ── Call Offering ────────────────────────────────────────────────────

export function notifyNewCallCreated(
  call: {
    _id: string;
    name: string;
    pricePerCall?: number;
    currency?: string;
    description?: string;
    coverImage?: string;
    duration?: number;
  },
  orgName: string,
  orgId: string
) {
  if (!env.ENABLE_BULK_EMAILS) return;

  enqueue(() => _notifyNewCallCreated(call, orgName, orgId)).catch((err) =>
    console.error("[BulkEmail] notifyNewCallCreated failed:", err)
  );
}

async function _notifyNewCallCreated(
  call: {
    _id: string;
    name: string;
    pricePerCall?: number;
    currency?: string;
    description?: string;
    coverImage?: string;
    duration?: number;
  },
  orgName: string,
  orgId: string
) {
  const recipients = await getOrgMemberEmails(orgId);
  if (recipients.length === 0) return;

  const callLink = `${env.FRONTEND_URL}/checkout/call/${call._id}`;

  await sendBulkEmail(
    recipients,
    `New Call Offering on Garage: ${call.name}`,
    (r) => newCallEmailHtml(call, callLink, orgName, r.name),
    (r) => newCallEmailText(call, callLink, orgName, r.name)
  );
}

// ── Channel ──────────────────────────────────────────────────────────

export function notifyNewChannelCreated(
  channel: {
    _id: string;
    name: string;
    price?: number;
    currency?: string;
    description?: string;
    coverImage?: string;
  },
  orgName: string,
  orgId: string
) {
  if (!env.ENABLE_BULK_EMAILS) return;

  enqueue(() => _notifyNewChannelCreated(channel, orgName, orgId)).catch(
    (err) =>
      console.error("[BulkEmail] notifyNewChannelCreated failed:", err)
  );
}

async function _notifyNewChannelCreated(
  channel: {
    _id: string;
    name: string;
    price?: number;
    currency?: string;
    description?: string;
    coverImage?: string;
  },
  orgName: string,
  orgId: string
) {
  const recipients = await getOrgMemberEmails(orgId);
  if (recipients.length === 0) return;

  const channelLink = `${env.FRONTEND_URL}/checkout/channel/${channel._id}`;

  await sendBulkEmail(
    recipients,
    `New Channel on Garage: ${channel.name}`,
    (r) => newChannelEmailHtml(channel, channelLink, orgName, r.name),
    (r) => newChannelEmailText(channel, channelLink, orgName, r.name)
  );
}

// ── Feed Post (HQ-level) ─────────────────────────────────────────────

/** Strip HTML tags and decode common entities for plain-text email snippets */
function stripHtmlForSnippet(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function newFeedPostEmailHtml(
  post: { content: string; authorName: string; isArticle?: boolean; title?: string },
  postLink: string,
  orgName: string,
  recipientName: string
): string {
  const cleanContent = stripHtmlForSnippet(post.content);
  const snippet = cleanContent.length > 200
    ? cleanContent.substring(0, 200) + "..."
    : cleanContent;

  const contentLabel = post.isArticle ? "article" : "post";
  const ctaLabel = post.isArticle ? "Read Article" : "View Post";
  const headerTitle = post.isArticle ? "New Article" : "New Post";

  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">${headerTitle} in ${orgName}</h1>
  `;

  const titleHtml = post.isArticle && post.title
    ? `<h2 style="margin:0 0 12px;color:#EAEAEA;font-size:20px;font-weight:600;">${post.title}</h2>`
    : "";

  const body = `
    ${greeting(recipientName)}
    ${bodyText(`<strong style="color:#EAEAEA;">${post.authorName}</strong> shared a new ${contentLabel} in <strong style="color:#EAEAEA;">${orgName}</strong>:`)}
    <div style="background-color:#262638;border-left:4px solid #FBD10D;padding:20px;margin:20px 0;border-radius:8px;">
      ${titleHtml}
      <p style="margin:0;color:#BDBDBD;font-size:14px;line-height:1.5;">${snippet}</p>
    </div>
    ${ctaButton(postLink, ctaLabel)}
    ${fallbackLink(postLink)}
  `;

  return emailShell(header, body);
}

function newFeedPostEmailText(
  post: { content: string; authorName: string; isArticle?: boolean; title?: string },
  postLink: string,
  orgName: string,
  recipientName: string
): string {
  const cleanContent = stripHtmlForSnippet(post.content);
  const snippet = cleanContent.length > 200
    ? cleanContent.substring(0, 200) + "..."
    : cleanContent;

  const contentLabel = post.isArticle ? "article" : "post";
  const ctaLabel = post.isArticle ? "Read the article" : "View the post";
  const titleLine = post.isArticle && post.title ? `\n${post.title}\n` : "";

  return `${recipientName ? `Hi ${recipientName},` : "Hi there,"}

${post.authorName} shared a new ${contentLabel} in ${orgName}:${titleLine}

${snippet}

${ctaLabel}: ${postLink}

- Garage`;
}

export function notifyNewFeedPostCreated(
  post: { _id: string; content: string; postType?: string; title?: string },
  author: { email: string; name: string },
  org: { _id: string; name: string; slug: string }
) {
  if (!env.ENABLE_BULK_EMAILS) return;

  // Mute for new-post blasts (FEED_POST_EMAIL_MUTED_AUTHORS). Added 2026-09-14
  // so a round of test posts doesn't mail every org member. A list of author
  // emails mutes just those authors; "*" mutes new-post emails for EVERYONE.
  // Posts only, on purpose: ENABLE_BULK_EMAILS=false would also silence office,
  // product, course, workshop, call, channel and person-joined emails. The log
  // line keeps suppression visible in prod — same reasoning as the 2026-07-03
  // new-office suspension above.
  const authorEmail = (author.email || "").trim().toLowerCase();
  const muted = env.FEED_POST_EMAIL_MUTED_AUTHORS;
  if (muted.includes("*") || (authorEmail && muted.includes(authorEmail))) {
    console.log(
      `[BulkEmail] notifyNewFeedPostCreated SUPPRESSED — ${muted.includes("*") ? "all new-post emails muted" : `author ${authorEmail} is muted`} (post ${post._id}, org "${org.name}")`
    );
    return;
  }

  enqueue(() => _notifyNewFeedPostCreated(post, author, org)).catch((err) =>
    console.error("[BulkEmail] notifyNewFeedPostCreated failed:", err)
  );
}

async function _notifyNewFeedPostCreated(
  post: { _id: string; content: string; postType?: string; title?: string },
  author: { email: string; name: string },
  org: { _id: string; name: string; slug: string }
) {
  const recipients = await getOrgMemberEmails(org._id, author.email);
  if (recipients.length === 0) return;

  const isArticle = post.postType === "article";

  // Fetch founder's affiliateId so the email link tracks referrals under the founder
  const founder = await User.findOne({
    "organizations.organization": new Types.ObjectId(org._id),
    "organizations.role": "founder",
  })
    .select("affiliateId")
    .lean();

  // Articles get their own URL path for richer rendering
  const pathSegment = isArticle ? "article" : "post";
  const baseLink = `${env.FRONTEND_URL}/guest/${org.slug}/${pathSegment}/${post._id}`;
  const postLink = founder?.affiliateId
    ? `${baseLink}?referCode=${founder.affiliateId}`
    : baseLink;

  const subjectLabel = isArticle ? "New Article" : "New Post";
  // Ensure a title is always present in the subject – for posts without an
  // explicit title, derive one from the content (strip HTML, take first 40 chars)
  const rawSnippet = stripHtmlForSnippet(post.content);
  const subjectTitle =
    post.title || (rawSnippet.length > 40 ? rawSnippet.substring(0, 40) + "..." : rawSnippet) || "Untitled";
  const emailData = {
    content: post.content,
    authorName: author.name,
    isArticle,
    title: post.title,
  };

  await sendBulkEmail(
    recipients,
    `${subjectLabel} in ${org.name}: ${subjectTitle} by ${author.name}`,
    (r) => newFeedPostEmailHtml(emailData, postLink, org.name, r.name),
    (r) => newFeedPostEmailText(emailData, postLink, org.name, r.name)
  );
}
