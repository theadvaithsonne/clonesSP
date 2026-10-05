import {
  buildEmailTemplatePreset,
} from "@/components/dashboard/inlineApps/network-mail/email-template-presets";
import {
  exportToHTML,
  resolveTemplatePreviewHtml,
} from "@/components/dashboard/inlineApps/network-mail/email-html-export";
import { MERGE_SAMPLE_VALUES } from "@/components/dashboard/inlineApps/network-mail/merge-variables";
import { getTemplate } from "@/lib/network-mail-api";

/**
 * Sentinel for the built-in Garage order-confirmation template. Kept out of the
 * Network Mail library so opening the product form never writes a template into
 * the org's list as a side effect — the HTML is rendered locally from the preset.
 */
export const DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID = "__default__";
export const DEFAULT_PRODUCT_EMAIL_TEMPLATE_NAME = "Default — Order Confirmation";

/**
 * The merge-tag contract between this form and the backend sender
 * (`garagenew-backend/src/services/productOrderEmail.ts`). Both sides must agree
 * on these keys; `sample` is only used to make the in-form preview readable.
 */
export const PRODUCT_EMAIL_MERGE_TAGS: Array<{
  key: string;
  label: string;
  sample: string;
}> = [
  { key: "first_name", label: "Customer first name", sample: "Priya" },
  { key: "business_name", label: "Your business name", sample: "Acme Studio" },
  { key: "support_option", label: "Support contact", sample: "support@acme.studio" },
  { key: "order_number", label: "Order number", sample: "ORD-8H2K9Q" },
  { key: "order_date", label: "Order date", sample: "8 August 2026" },
  { key: "order_total", label: "Order total", sample: "₹1,499.00" },
  { key: "order_items", label: "Ordered items", sample: "Design System Kit × 1" },
  { key: "order_url", label: "Link to the order", sample: "#" },
  { key: "invoice_url", label: "Link to the invoice", sample: "#" },
  { key: "unsubscribe_url", label: "Unsubscribe link", sample: "#" },
];

/**
 * Product-specific samples win, with the builder's catalogue underneath — the
 * Dynamic Fields picker offers org tokens in any template, and those should
 * preview as readable values here too rather than as raw `{{tags}}`.
 */
const SAMPLE_VALUES: Record<string, string> = {
  ...MERGE_SAMPLE_VALUES,
  ...Object.fromEntries(PRODUCT_EMAIL_MERGE_TAGS.map((t) => [t.key, t.sample])),
};

/**
 * Swaps `{{tags}}` for readable values so the founder previews an email rather
 * than a page of raw placeholders. `overrides` carries the real org and product
 * details, so the preview shows their own company and the product they are
 * actually creating instead of generic sample text. Unknown tags are left
 * visible on purpose — a stray tag should be obvious at design time, not
 * silently blank.
 */
export function applySampleMergeData(
  html: string,
  overrides?: Record<string, string>,
): string {
  const values = { ...SAMPLE_VALUES, ...(overrides || {}) };
  return html.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

/** Merge values are user-authored — escape before splicing into the preview. */
export function escapeMergeValue(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mirrors the backend's `formatMoney` so the previewed total matches what the
 * customer will actually receive.
 */
export function formatPreviewMoney(amount: number, currency?: string): string {
  const code = (currency || "USD").toUpperCase();
  const symbol = code === "INR" ? "₹" : code === "USD" ? "$" : "";
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${code}`;
}

/** The built-in default, rendered from the shared preset builders. */
export function buildDefaultProductEmailHtml(): string {
  return exportToHTML(
    buildEmailTemplatePreset("order-confirmation"),
    "Order Confirmation",
  );
}

/**
 * Resolves the HTML that will be snapshotted onto the product. Network Mail is a
 * separate service authenticated with the browser's JWT, so the backend cannot
 * fetch templates itself — the rendered HTML has to travel with the product.
 */
export async function resolveProductEmailHtml(
  orgId: string,
  templateId: string,
): Promise<string> {
  if (!templateId || templateId === DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID) {
    return buildDefaultProductEmailHtml();
  }
  const template = await getTemplate(orgId, templateId);
  return resolveTemplatePreviewHtml(template);
}
