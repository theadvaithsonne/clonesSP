/**
 * Caps on the repeatable list fields in the community, live stream, webinar,
 * course, service and product creation forms.
 *
 * Each of those forms posts one JSON document containing every FAQ, benefit,
 * learning outcome, key feature, milestone and deliverable, plus a rendered
 * email-alert HTML snapshot. Left unbounded, that document grew past the
 * request body limit and the save failed with a 413 before it ever reached a
 * route handler. The backend limit is now 50mb, so these caps are not what
 * keeps a normal save under the wire — they exist so a runaway form can't get
 * back there, and so the sales pages these lists render on stay readable.
 *
 * Every list is also stripped of empty and whitespace-only entries before it is
 * sent, so blank rows left in the editor never count against the payload.
 */

/** FAQ accordions on a sales page. */
export const MAX_FAQS = 30;

/** "Benefits" / "What's included" cards. */
export const MAX_BENEFITS = 20;

/** "What you'll learn" bullet points. */
export const MAX_LEARNING_POINTS = 20;

/** Key feature cards on a product page. */
export const MAX_KEY_FEATURES = 20;

/** Deliverables listed against a service, either overall or per milestone. */
export const MAX_DELIVERABLES = 20;

/** Standard helper text shown once a list is full. */
export function limitReachedLabel(max: number, noun: string): string {
  return `Maximum ${max} ${noun} reached`;
}

/** Drops entries whose every text field is blank or whitespace-only. */
export function filterNonEmptyStrings(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}
