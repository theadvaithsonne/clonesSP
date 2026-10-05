import { z } from "zod";

/**
 * "Tell me when someone joins" — the seller-side counterpart to
 * `emailAlerts` (models/emailAlerts.schema.ts).
 *
 * `emailAlerts` sends the BUYER a branded order confirmation. This sends the
 * FOUNDER a plain notification every time someone acquires the item, free or
 * paid. Carried by every sellable thing a person can join or enrol in:
 * communities, courses, digital products, live streams, services and events.
 *
 * Deliberately has no template: the founder is not a customer, so the mail is
 * the built-in Garage layout and the only choices are on/off and who else gets
 * a copy. Keeping the shape this small is also why it can be bolted onto
 * models (service, event) that never adopted the `emailAlerts` template flow.
 *
 * The three sides of the contract live here so they cannot drift: the stored
 * shape (`founderAlertsSchemaField`), the accepted request shape
 * (`founderAlertsZodSchema`) and the mapping between them
 * (`normalizeFounderAlerts`).
 */
export interface IFounderAlerts {
  enabled: boolean;
  /**
   * Extra addresses CC'd alongside the item owner. Empty means "just me" —
   * the owner is always notified, and is never listed here.
   */
  recipients?: string[];
}

/** Mongoose field definition — assign to `founderAlerts` on any owning schema. */
export const founderAlertsSchemaField = {
  enabled: { type: Boolean, default: false },
  recipients: { type: [String], default: undefined },
};

/** Shape as it arrives from the community / course / product / … forms. */
export interface FounderAlertsInput {
  enabled?: boolean;
  recipients?: string[];
}

/**
 * Route-level validator. Every field is optional because a disabled section
 * posts nothing but `enabled: false`, and the normaliser below decides what
 * actually gets stored.
 */
export const founderAlertsZodSchema = z.object({
  enabled: z.boolean().optional(),
  recipients: z.array(z.string()).optional(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalises the form payload into the shape the schema stores. Turning alerts
 * off drops the extra recipients rather than leaving a stale list behind, and
 * anything that is not an email address is discarded rather than stored and
 * silently failing to send later.
 */
export function normalizeFounderAlerts(
  input: FounderAlertsInput,
): IFounderAlerts {
  const enabled = !!input.enabled;
  if (!enabled) return { enabled: false, recipients: [] };

  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const raw of input.recipients || []) {
    const email = String(raw || "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push(email);
  }

  return { enabled: true, recipients };
}
