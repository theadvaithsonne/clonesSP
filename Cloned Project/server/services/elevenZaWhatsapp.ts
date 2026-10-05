// src/services/elevenZaWhatsapp.ts
//
// WhatsApp OTP delivery via 11za, the companion to services/twoFactorSms.ts.
// Same division of labour: we generate and verify the OTP ourselves
// (services/otp.ts, Mongo-backed with a TTL) and 11za is only the pipe.
//
// Endpoint (from the published Postman collection, "Send Body Dynamic value
// Template"):
//
//   POST https://api.11za.in/apis/template/sendTemplate
//   { authToken, originWebsite, sendto, templateName, language, name, data[] }
//   → { "Message": "Message Sent", "Data": 1, "Status": 200, "IsSuccess": true }
//
// Errors come back as HTTP 200 with `IsSuccess: false` and a human message
// ("Invalid authToken…", "Invalid customer mobile number…", "Invalid template
// data…"), so the status code alone is not a success signal — `IsSuccess` is.
//
// Config (config/env.ts):
//   ELEVENZA_AUTH_TOKEN      — required; WhatsApp send is a no-op without it
//   ELEVENZA_ORIGIN_WEBSITE  — the registered origin (e.g. "garage.app")
//   ELEVENZA_OTP_TEMPLATE    — approved template name carrying one variable
//   ELEVENZA_OTP_LANGUAGE    — template language code (default "en")
import { env } from "../config/env";
import { normalizePhone } from "./twoFactorSms";

export function elevenZaConfigured(): boolean {
  return !!env.ELEVENZA_AUTH_TOKEN && !!env.ELEVENZA_OTP_TEMPLATE;
}

/**
 * Magic-link templates, approved on the 11za account.
 *
 * Two of them because a WhatsApp template cannot branch — the body is fixed at
 * approval time. An offer link has a deadline worth stating; a plain
 * subscription link has none, and "This offer expires on —" reads as broken.
 * So the expiry sentence lives in its own template.
 *
 * Neither carries a header or buttons. A header image fails the send outright
 * (`Invalid File or File Not found`) because this client posts no file, and
 * 11za's `data[]` fills BODY variables only — a dynamic URL button needs a
 * payload shape this endpoint doesn't accept. Hence the link is body text.
 */
const MAGIC_LINK_TEMPLATE = "garage_magic_link"; // 7 vars, with expiry
const MAGIC_LINK_TEMPLATE_PLAIN = "garage_magic_link_plain"; // 6 vars, no expiry

/** Magic-link sends need no env-configured template name — both are constants. */
export function elevenZaMagicLinkConfigured(): boolean {
  return !!env.ELEVENZA_AUTH_TOKEN;
}

/**
 * 11za wants the number as country code + subscriber digits with NO plus
 * ("910000000000" in their own example), while `normalizePhone` produces
 * E.164 ("+91…") for 2Factor. Both channels take the same user input, so the
 * shared normaliser stays the source of truth and the `+` is stripped here.
 */
function toElevenZaNumber(raw: string): string | null {
  const e164 = normalizePhone(raw);
  return e164 ? e164.replace(/^\+/, "") : null;
}

interface SendTemplateResponse {
  Message?: string;
  Data?: number;
  Status?: number;
  IsSuccess?: boolean;
}

/**
 * Send a pre-generated OTP over WhatsApp.
 *
 * Throws on misconfiguration or a rejected send so the caller can decide what
 * to do. Callers sending over more than one channel must not let this failure
 * bury a successful SMS — see the request-otp handler.
 *
 * `recipientName` fills the template's greeting where one exists; 11za
 * requires the field, so it falls back to a neutral word rather than an
 * empty string.
 */
export async function sendOtpWhatsapp(
  phone: string,
  code: string,
  recipientName?: string | null
): Promise<string> {
  if (!env.ELEVENZA_AUTH_TOKEN) {
    throw new Error("WhatsApp OTP is not configured (ELEVENZA_AUTH_TOKEN missing)");
  }
  if (!env.ELEVENZA_OTP_TEMPLATE) {
    throw new Error("WhatsApp OTP is not configured (ELEVENZA_OTP_TEMPLATE missing)");
  }

  // The OTP template carries exactly one body variable: the code.
  return sendTemplate(phone, env.ELEVENZA_OTP_TEMPLATE, [code], recipientName);
}

/**
 * POST one approved template. Shared by every sender here.
 *
 * `data` is positional — it fills {{1}}, {{2}}, … in the approved body, in
 * order — so its length must match the template exactly or 11za rejects the
 * send.
 */
async function sendTemplate(
  phone: string,
  templateName: string,
  data: string[],
  recipientName?: string | null
): Promise<string> {
  const sendto = toElevenZaNumber(phone);
  if (!sendto) {
    throw new Error("Invalid phone number");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.11za.in/apis/template/sendTemplate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        authToken: env.ELEVENZA_AUTH_TOKEN,
        originWebsite: env.ELEVENZA_ORIGIN_WEBSITE || "garage.app",
        sendto,
        templateName,
        language: env.ELEVENZA_OTP_LANGUAGE || "en",
        name: (recipientName || "").trim() || "there",
        data,
      }),
    });

    const text = await res.text();
    let body: SendTemplateResponse | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }

    // A rejected send still returns HTTP 200 here, so `IsSuccess` is the only
    // reliable signal — checking res.ok alone would report failures as sent.
    if (!res.ok || body?.IsSuccess !== true) {
      const reason = body?.Message || text || `HTTP ${res.status}`;
      throw new Error(`11za WhatsApp failed: ${String(reason).slice(0, 200)}`);
    }

    return body?.Message || "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a magic link over WhatsApp.
 *
 * Mirrors the copy in `offerMagicLinkTemplate` (services/mailer.ts) so the two
 * channels never quote different prices or deadlines — the caller passes the
 * same values it already computed for the email.
 *
 * Template choice follows the email's own rule: the email prints its expiry
 * line only when `freeMonth && offerExpiresAt`, so anything else uses the
 * plain template rather than a template with an empty deadline in it.
 */
export async function sendMagicLinkWhatsapp(input: {
  phone: string;
  recipientName?: string | null;
  senderName?: string | null;
  clientName: string;
  /** Plan label, or "4 plans to choose from" for a catalog link. */
  headingLine: string;
  /** Already formatted: "$25", "from $25", "free". */
  price: string;
  offerExpiresAt?: Date | null;
  freeMonth?: boolean;
  link: string;
}): Promise<string> {
  if (!env.ELEVENZA_AUTH_TOKEN) {
    throw new Error("WhatsApp is not configured (ELEVENZA_AUTH_TOKEN missing)");
  }

  const recipient = (input.recipientName || "").trim() || "there";
  const sender = (input.senderName || "").trim() || "Garage";
  const withExpiry = !!input.freeMonth && !!input.offerExpiresAt;

  if (withExpiry) {
    return sendTemplate(
      input.phone,
      MAGIC_LINK_TEMPLATE,
      [
        recipient,
        sender,
        input.clientName,
        input.headingLine,
        input.price,
        input.offerExpiresAt!.toUTCString(),
        input.link,
      ],
      input.recipientName
    );
  }

  return sendTemplate(
    input.phone,
    MAGIC_LINK_TEMPLATE_PLAIN,
    [
      recipient,
      sender,
      input.clientName,
      input.headingLine,
      input.price,
      input.link,
    ],
    input.recipientName
  );
}
