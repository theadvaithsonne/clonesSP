import fs from "fs";
import path from "path";

// ── Hardcoded constants ─────────────────────────────────────────────
// Kept in-code (per product decision) so the values live next to the
// templates that use them. Update these strings + redeploy to change.
const COMPANY_NAME = "Garage";
const MANAGER_NAME = "Khan the Coach";
export const MANAGER_EMAIL = "amanulla@garage.app";
const ADMIN_NAME = "Shorupan";
export const ADMIN_EMAIL = "shorupan@gmail.com";
const CONTACT_NUMBER = "+91-XXXXXXXXXX";

/** CC on every affiliate-onboard notification. Applied even when the To
 *  address is already one of these (Resend de-dupes internally). */
export const PLATFORM_CC = ["philip@garage.app", "shorupan@gmail.com"];

// ── Template loader ─────────────────────────────────────────────────
// Templates ship alongside this file in ./emails/templates/. The build
// script copies them from src → dist so the same relative path resolves
// under `tsx watch` (dev) AND `node dist/…` (prod).
const TEMPLATE_DIR = path.join(__dirname, "emails", "templates");

const TEMPLATE_FILES = {
  referrer: "1-referrer-notification.html",
  manager: "2-affiliate-manager-notification.html",
  admin: "3-garage-admin-notification.html",
  welcome: "4-affiliate-welcome.html",
} as const;

type TemplateKey = keyof typeof TEMPLATE_FILES;

const templateCache: Partial<Record<TemplateKey, string>> = {};

function loadTemplate(key: TemplateKey): string {
  const cached = templateCache[key];
  if (cached) return cached;
  const full = path.join(TEMPLATE_DIR, TEMPLATE_FILES[key]);
  const raw = fs.readFileSync(full, "utf8");
  templateCache[key] = raw;
  return raw;
}

/** Naive `{{Key}}` → value substitution. Undefined values render as
 *  empty string so an unmatched key never leaks to the inbox. */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (_m, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

// ── Public API ──────────────────────────────────────────────────────

export interface AffiliateVars {
  /** Direct upline / referrer's display name. */
  referrerName: string;
  /** Newly-onboarded user's display name (falls back to email upstream). */
  affiliateName: string;
  /** Newly-onboarded user's phone (may be empty). */
  affiliatePhone: string;
  /** Newly-onboarded user's email. */
  affiliateEmail: string;
  /** Comma-joined "city, state, country" (empty pieces filtered). */
  affiliateLocation: string;
}

function baseVars(v: AffiliateVars): Record<string, string> {
  return {
    ReferrerName: v.referrerName || "there",
    AffiliateName: v.affiliateName || v.affiliateEmail,
    AffiliatePhone: v.affiliatePhone || "—",
    AffiliateEmail: v.affiliateEmail,
    AffiliateLocation: v.affiliateLocation || "N/A",
    CompanyName: COMPANY_NAME,
    Year: String(new Date().getFullYear()),
  };
}

export function buildReferrerEmail(v: AffiliateVars): {
  subject: string;
  html: string;
} {
  return {
    subject: "Your referral is now onboarded",
    html: render(loadTemplate("referrer"), baseVars(v)),
  };
}

export function buildManagerEmail(v: AffiliateVars): {
  to: string;
  subject: string;
  html: string;
} {
  return {
    to: MANAGER_EMAIL,
    subject: "A new affiliate has been assigned to you",
    html: render(loadTemplate("manager"), {
      ...baseVars(v),
      ManagerName: MANAGER_NAME,
    }),
  };
}

export function buildAdminEmail(v: AffiliateVars): {
  to: string;
  subject: string;
  html: string;
} {
  return {
    to: ADMIN_EMAIL,
    subject: "New affiliate onboarded in your location",
    html: render(loadTemplate("admin"), {
      ...baseVars(v),
      AdminName: ADMIN_NAME,
    }),
  };
}

export function buildWelcomeEmail(v: AffiliateVars): {
  subject: string;
  html: string;
} {
  return {
    subject: `Welcome to ${COMPANY_NAME}`,
    html: render(loadTemplate("welcome"), {
      ...baseVars(v),
      ContactNumber: CONTACT_NUMBER,
    }),
  };
}

/** Build a comma-joined display location from user profile fields.
 *  Empty pieces are dropped; if all three are empty returns "N/A". */
export function formatAffiliateLocation(user: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): string {
  const parts = [user.city, user.state, user.country]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "N/A";
}
