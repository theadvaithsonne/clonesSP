import { z } from "zod";

/**
 * Post-purchase order email config, shared by every sellable item that can
 * carry one: products, courses and communities (channels).
 *
 * `templateHtml` is a rendered snapshot of the founder's chosen Network Mail
 * template. Network Mail is a separate service that authenticates with the
 * browser's JWT, so this API cannot fetch the template at send time — the
 * frontend snapshots the HTML and re-syncs it on every save.
 *
 * The three sides of the contract all live here so they cannot drift:
 * the stored shape (`emailAlertsSchemaField`), the accepted request shape
 * (`emailAlertsZodSchema`) and the mapping between them (`normalizeEmailAlerts`).
 */
export interface IEmailAlerts {
  enabled: boolean;
  /** Network Mail template id, or "__default__" for the built-in Garage layout. */
  templateId?: string;
  templateName?: string;
  /** Rendered HTML with `{{merge_tags}}` still in place. */
  templateHtml?: string;
  syncedAt?: Date;
}

/** Mongoose field definition — assign to `emailAlerts` on any owning schema. */
export const emailAlertsSchemaField = {
  enabled: { type: Boolean, default: false },
  templateId: { type: String, trim: true },
  templateName: { type: String, trim: true },
  templateHtml: { type: String },
  syncedAt: { type: Date },
};

/** Shape as it arrives from the product / course / community forms. */
export interface EmailAlertsInput {
  enabled?: boolean;
  templateId?: string;
  templateName?: string;
  templateHtml?: string;
  syncedAt?: string | Date;
}

/**
 * Route-level validator. Every field is optional because a disabled section
 * posts empty strings, and the normaliser below decides what actually gets
 * stored.
 */
export const emailAlertsZodSchema = z.object({
  enabled: z.boolean().optional(),
  templateId: z.string().optional(),
  templateName: z.string().optional(),
  templateHtml: z.string().optional(),
  syncedAt: z.string().optional(),
});

/**
 * Normalises the form payload into the shape the schema stores. Turning alerts
 * off clears the snapshot rather than leaving a stale template behind.
 */
export function normalizeEmailAlerts(input: EmailAlertsInput): IEmailAlerts {
  const enabled = !!input.enabled;
  return {
    enabled,
    templateId: enabled ? input.templateId || "" : "",
    templateName: enabled ? input.templateName || "" : "",
    templateHtml: enabled ? input.templateHtml || "" : "",
    syncedAt: input.syncedAt ? new Date(input.syncedAt) : new Date(),
  };
}
