/**
 * Magic-link checkout for Garage Store plans.
 *
 * A magic link is a per-(user, plan, term) offer token. Everything about it
 * is computed LIVE on every read — nothing is frozen at creation — which is
 * what lets us mint the link first and only then open the buyer's 24-hour
 * window: the next read re-quotes at the better price.
 *
 * Endpoints (garagenew-backend/src/routes/magicLink.ts):
 *   POST /magic-link                  requireAuth  — mint (or re-use) a token
 *   GET  /magic-link/:token           public       — live status + quote
 *   POST /magic-link/:token/checkout  public       — invoice, or free claim
 *
 * Creation is rate-limited to 30/hour per creating user, so a link is minted
 * on the Buy click — never just to render a price.
 */

import { api } from "@/lib/api";

/** What the buyer is being charged for, as the server sees it. */
export interface ComboQuote {
  kind: string;
  termMonths: number;
  planLabel: string;
  clientName: string;
  freeMonth: boolean;
  includesLicence: boolean;
  licenceUsd: number;
  subUsd: number;
  cartUsd: number;
  monthsOfAccess: number;
  currency: string;
}

/** The buyer's own 24-hour free-first-cycle window. */
export interface MagicLinkOffer {
  open: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  secondsRemaining: number;
  windowHours: number;
}

export type MagicLinkStatus =
  | "active"
  | "purchased"
  | "revoked"
  | "not_found";

export interface MagicLinkRead {
  success: boolean;
  status: MagicLinkStatus;
  recipient?: { name: string | null; emailMasked: string };
  plan?: {
    termMonths: number;
    label?: string;
    clientName: string;
    productCode?: string;
  };
  offer?: MagicLinkOffer;
  quote?: ComboQuote;
}

export interface MagicLinkCreated {
  token: string;
  url: string;
  emailed?: boolean;
  recipient?: unknown;
  quote?: ComboQuote;
  offer?: MagicLinkOffer;
}

export interface MagicLinkCheckout {
  success: boolean;
  /** Null when the claim was free and nothing needed charging. */
  payUrl: string | null;
  invoiceId?: string;
  activated?: boolean;
}

export async function createMagicLink(input: {
  userId: string;
  thirdPartyClientId: string;
  termMonths?: number;
  sendEmail?: boolean;
}): Promise<MagicLinkCreated> {
  return api<MagicLinkCreated>("magic-link", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Where the hosted offer page lives. The create response already carries a
 * `url`, but the resume-after-phone-verify path only holds a token — this
 * keeps both routes pointing at the same place.
 */
export function magicLinkUrl(token: string): string {
  return `/magic-link/${encodeURIComponent(token)}`;
}

export async function readMagicLink(token: string): Promise<MagicLinkRead> {
  return api<MagicLinkRead>(`magic-link/${encodeURIComponent(token)}`, {
    method: "GET",
  });
}

export async function checkoutMagicLink(
  token: string,
): Promise<MagicLinkCheckout> {
  return api<MagicLinkCheckout>(
    `magic-link/${encodeURIComponent(token)}/checkout`,
    { method: "POST" },
  );
}
