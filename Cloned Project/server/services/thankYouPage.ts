// Shared normaliser for founder-supplied thankYouPage payloads. Wired
// into both createProduct/updateProduct and createCourse/updateCourse.
// The schema lives at models/thankYouPage.schema.ts.

import type { IThankYouPage } from "../models/thankYouPage.schema";

/**
 * Founder-configurable post-payment page. Empty payload = clear existing
 * config on this item (`unset` on save). See IThankYouPage on the model.
 */
export type ThankYouPageInput = {
  autoRedirect: boolean;
  redirectUrl?: string;
  title?: string;
  message?: string;
  sections?: Array<{ heading: string; buttonLabel: string; buttonUrl: string }>;
} | null;

export const MAX_THANK_YOU_SECTIONS = 5;

/**
 * Normalize + validate a founder-supplied thankYouPage payload.
 *   - Returns `undefined` when the caller didn't provide the field
 *     (leaves existing config unchanged on update).
 *   - Returns `null` when the caller explicitly passed `null` (clears).
 *   - Otherwise returns the trimmed/validated shape ready to write.
 * Throws on invalid input so the route handler can 400 with a clear message.
 */
export function normalizeThankYouPage(
  input: ThankYouPageInput | undefined,
): IThankYouPage | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;

  const autoRedirect = !!input.autoRedirect;
  const trimUrl = (u: unknown): string => {
    if (typeof u !== "string") throw new Error("URL must be a string");
    const t = u.trim();
    if (!t) throw new Error("URL is required");
    try {
      // Accept both absolute (http/https) and mail/tel schemes.
      new URL(t);
    } catch {
      throw new Error(`Invalid URL: ${t}`);
    }
    return t;
  };

  if (autoRedirect) {
    return {
      autoRedirect: true,
      redirectUrl: trimUrl(input.redirectUrl),
    };
  }

  const sectionsRaw = Array.isArray(input.sections) ? input.sections : [];
  if (sectionsRaw.length > MAX_THANK_YOU_SECTIONS) {
    throw new Error(
      `Too many thank-you sections (max ${MAX_THANK_YOU_SECTIONS})`,
    );
  }
  const sections = sectionsRaw.map((s, i) => {
    const heading = String(s?.heading || "").trim();
    const buttonLabel = String(s?.buttonLabel || "").trim();
    if (!heading) throw new Error(`Section ${i + 1}: heading is required`);
    if (!buttonLabel)
      throw new Error(`Section ${i + 1}: button label is required`);
    return {
      heading,
      buttonLabel,
      buttonUrl: trimUrl(s?.buttonUrl),
    };
  });

  return {
    autoRedirect: false,
    title: input.title?.trim() || undefined,
    message: input.message?.trim() || undefined,
    sections: sections.length ? sections : undefined,
  };
}
