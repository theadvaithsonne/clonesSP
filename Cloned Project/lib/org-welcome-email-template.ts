import { buildEmailTemplatePreset } from "@/components/dashboard/inlineApps/network-mail/email-template-presets";
import {
  exportToHTML,
  resolveTemplatePreviewHtml,
} from "@/components/dashboard/inlineApps/network-mail/email-html-export";
import {
  MERGE_VARIABLES,
  applyMergeSamples,
  stripEmptyImages as stripEmptyImagesFromHtml,
} from "@/components/dashboard/inlineApps/network-mail/merge-variables";
import { getTemplate } from "@/lib/network-mail-api";
import { escapeMergeValue } from "@/lib/product-email-template";

/**
 * Sentinel for the built-in Garage welcome email. Kept out of the Network Mail
 * library so opening Manage Organization never writes a template into the org's
 * list as a side effect — the HTML is rendered locally from the preset.
 *
 * Same value as the product sentinel on purpose: the backend treats
 * "__default__" as "no snapshot, use the hardcoded layout" everywhere.
 */
export const DEFAULT_ORG_WELCOME_TEMPLATE_ID = "__default__";
export const DEFAULT_ORG_WELCOME_TEMPLATE_NAME =
  "Default — Organization Welcome";

/**
 * The merge-tag contract between this form and the backend sender
 * (`garagenew-backend/src/services/welcomeEmail.ts`). Both sides must agree on
 * these keys. The catalogue itself lives with the Network Mail editor — the
 * builder's Dynamic Fields picker and this preview have to resolve the same
 * tokens, so there is one list rather than two that drift.
 */
export const ORG_WELCOME_MERGE_TAGS = MERGE_VARIABLES.filter(
  (v) => v.category !== "Order & Purchase",
).map((v) => ({ key: v.key, label: v.label, sample: v.sample }));

/** Real org values the founder should see instead of sample text. */
export interface OrgWelcomePreviewContext {
  name?: string;
  description?: string;
  city?: string;
  state?: string;
  country?: string;
  icon?: string;
  supportEmail?: string;
  orgUrl?: string;
}

/** "City, State, Country", skipping whatever the org hasn't filled in. */
export function formatOrgLocation(org: OrgWelcomePreviewContext): string {
  return [org.city, org.state, org.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Merge values for the tags we can know at design time — everything about the
 * organization. Only the joining member's own name stays sample data, since no
 * member exists yet.
 */
export function buildOrgWelcomeOverrides(
  org: OrgWelcomePreviewContext,
): Record<string, string> {
  const next: Record<string, string> = {};
  const name = org.name?.trim();
  if (name) {
    next.business_name = escapeMergeValue(name);
    next.org_name = next.business_name;
  }
  const description = org.description?.trim();
  if (description) next.org_description = escapeMergeValue(description);

  const location = formatOrgLocation(org);
  if (location) next.org_location = escapeMergeValue(location);

  // Not escaped through `escapeMergeValue`'s quote rule alone — these land in
  // `src`/`href` attributes, and the same escaping is what the backend applies.
  if (org.icon?.trim()) next.org_icon = escapeMergeValue(org.icon.trim());

  const support = org.supportEmail?.trim();
  if (support) {
    next.support_option = escapeMergeValue(support);
    next.support_email = next.support_option;
  }

  const url = org.orgUrl?.trim();
  if (url) {
    next.org_url = escapeMergeValue(url);
    next.dashboard_url = next.org_url;
  }
  return next;
}

/**
 * Swaps `{{tags}}` for readable values so the founder previews an email rather
 * than a page of raw placeholders. Unknown tags are left visible on purpose — a
 * stray tag should be obvious at design time, not silently blank.
 */
export function applyOrgWelcomeSampleData(
  html: string,
  overrides?: Record<string, string>,
): string {
  return applyMergeSamples(html, overrides);
}

/** Drops `<img>` tags left with an empty `src` after substitution. */
export const stripEmptyImages = stripEmptyImagesFromHtml;

/** The built-in default, rendered from the shared preset builders. */
export function buildDefaultOrgWelcomeHtml(): string {
  return exportToHTML(buildEmailTemplatePreset("org-welcome"), "Welcome");
}

/**
 * Resolves the HTML that will be snapshotted onto the organization. Network
 * Mail is a separate service authenticated with the browser's JWT, so the
 * backend cannot fetch templates itself — the rendered HTML has to travel with
 * the org record.
 */
export async function resolveOrgWelcomeEmailHtml(
  orgId: string,
  templateId: string,
): Promise<string> {
  if (!templateId || templateId === DEFAULT_ORG_WELCOME_TEMPLATE_ID) {
    return buildDefaultOrgWelcomeHtml();
  }
  const template = await getTemplate(orgId, templateId);
  return resolveTemplatePreviewHtml(template);
}
