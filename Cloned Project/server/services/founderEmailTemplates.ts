import fs from "fs";
import path from "path";

// ── Hardcoded constants ─────────────────────────────────────────────
// Mirrors affiliateEmailTemplates.ts — kept in-code per product decision.
const COMPANY_NAME = "Garage";

/** Founder managers. Email #2 is sent as ONE personalized send per manager
 *  (recipient greeted by name). Add/remove entries here to expand or shrink
 *  the manager fan-out — no other code changes needed. */
export const FOUNDER_MANAGERS: Array<{ name: string; email: string }> = [
  { name: "Nithin", email: "Nithin@garage.app" },
  { name: "Punith", email: "Punith@garage.app" },
];

const GARAGE_ADMIN_NAME = "Shorupan";
export const GARAGE_ADMIN_EMAIL = "shorupan@gmail.com";
const GARAGE_CONTACT_NUMBER = "+91-XXXXXXXXXX";
const GARAGE_CONTACT_EMAIL = "shorupan@gmail.com";

// ── Template loader ─────────────────────────────────────────────────
const TEMPLATE_DIR = path.join(__dirname, "emails", "templates");

const TEMPLATE_FILES = {
  referrer: "5-founder-referrer-notification.html",
  manager: "6-founder-manager-notification.html",
  admin: "7-founder-admin-notification.html",
  welcome: "8-founder-welcome.html",
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

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (_m, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

// ── Public API ──────────────────────────────────────────────────────

export interface FounderVars {
  /** Direct upline / referrer's display name. Falls back to "there". */
  referrerName: string;
  /** Organization.name — the "Corporate Name". */
  corporateName: string;
  /** Founder user's phone (no phone on Organization). Falls back to "—". */
  corporatePhone: string;
  /** Founder user's email — the "Corporate Email". */
  corporateEmail: string;
  /** City, state, country of the ORG (org has these fields). "N/A" if empty. */
  corporateLocation: string;
  /** Founder user's personal name (fills "Corporate Contact Name" in #4). */
  contactName: string;
}

function baseVars(v: FounderVars): Record<string, string> {
  return {
    ReferrerName: v.referrerName || "there",
    CorporateName: v.corporateName || "your organization",
    CorporatePhone: v.corporatePhone || "—",
    CorporateEmail: v.corporateEmail,
    CorporateLocation: v.corporateLocation || "N/A",
    ContactName: v.contactName || v.corporateEmail,
    CompanyName: COMPANY_NAME,
    Year: String(new Date().getFullYear()),
  };
}

export function buildFounderReferrerEmail(v: FounderVars): {
  subject: string;
  html: string;
} {
  return {
    subject: "Your corporate referral is now onboarded",
    html: render(loadTemplate("referrer"), baseVars(v)),
  };
}

/** One send per founder manager. Returns an ARRAY — the fan-out loops it. */
export function buildFounderManagerEmails(v: FounderVars): Array<{
  to: string;
  subject: string;
  html: string;
}> {
  return FOUNDER_MANAGERS.map((mgr) => ({
    to: mgr.email,
    subject: "A new corporate partner has been assigned to you",
    html: render(loadTemplate("manager"), {
      ...baseVars(v),
      ManagerName: mgr.name,
    }),
  }));
}

export function buildFounderAdminEmail(v: FounderVars): {
  to: string;
  subject: string;
  html: string;
} {
  return {
    to: GARAGE_ADMIN_EMAIL,
    subject: "New corporate partner onboarded",
    html: render(loadTemplate("admin"), {
      ...baseVars(v),
      AdminName: GARAGE_ADMIN_NAME,
    }),
  };
}

export function buildFounderWelcomeEmail(v: FounderVars): {
  subject: string;
  html: string;
} {
  return {
    subject: `Welcome to ${COMPANY_NAME} Team`,
    html: render(loadTemplate("welcome"), {
      ...baseVars(v),
      AdminName: GARAGE_ADMIN_NAME,
      ContactNumber: GARAGE_CONTACT_NUMBER,
      ContactEmail: GARAGE_CONTACT_EMAIL,
    }),
  };
}

/** Same "city, state, country" join used for the affiliate flow. */
export function formatCorporateLocation(org: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): string {
  const parts = [org.city, org.state, org.country]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "N/A";
}
