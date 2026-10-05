/**
 * Garage Store plans — the "$25 Unilevel Plus + first partner cycle free"
 * combo, sold from inside a webinar.
 *
 * Everything here is per-VIEWER, not per-pin. The host pins the plan; what
 * each attendee is offered depends on their own state:
 *
 *   comboUsed                  → they've redeemed it before   → renew
 *   owns UP + window open      → licence already theirs        → claim free month
 *   owns UP + window closed    → licence already theirs        → subscribe, billed today
 *   no UP  + window open       → combo, first cycle FREE       → create combo invoice
 *   no UP  + window closed     → combo, first cycle prepaid    → create combo invoice
 *
 * The 24h window opens when the buyer completes their profile
 * (backend: services/comboWindow.ts). Prices in `comboTerms` already
 * reflect whether the window is open — the client never adjusts them.
 *
 * Backend spec: garagenew-backend/UNILEVEL_PLUS_COMBO_API.md
 */

import { api } from "@/lib/api";

export interface FreeMonthWindow {
  open: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  secondsRemaining: number;
  windowHours: number;
}

/** One purchasable term inside the combo cart (licence + subscription). */
export interface ComboTerm {
  termMonths: number;
  label: string;
  /** Single payment for the whole cart, in USD. */
  cartTotal: number;
  cartTotalCents: number;
  /** The subscription portion of `cartTotal` (licence is the rest). */
  subscriptionUsd: number;
  /** What the same term costs on its own, for the "you save" line. */
  standaloneUsd: number;
  savingUsd: number;
  /** Inside the window this is termMonths + 1 (the free cycle). */
  monthsOfAccess: number;
}

/** A term price for someone who already owns the licence. */
export interface StandaloneTerm {
  termMonths: number;
  totalAmount: number;
  totalAmountCents: number;
  monthlyEquivalent: number;
}

export interface ComboTermGroup {
  thirdPartyClientId: string;
  clientName: string;
  productCode: string;
  defaultTermMonths: number;
  freeFirstMonth: boolean;
  terms: ComboTerm[];
  standaloneTerms: StandaloneTerm[];
}

export interface UnilevelPlusProduct {
  success: boolean;
  /** The Unilevel Plus licence itself — its price is the whole cart when
   *  someone buys "monthly" inside the free-month window. */
  plan?: { productPrice: number; currency?: string } | null;
  purchased?: boolean;
  comboUsed?: boolean;
  comboEligible?: boolean;
  comboTerms?: ComboTermGroup[];
  freeMonthWindow?: FreeMonthWindow;
  purchase?: { _id: string; status: string; purchasedAt: string } | null;
}

/** The offer state for the current viewer — everything the card needs. */
export type PlanOffer =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: string }
  /** Redeemed before — plain renewal at the standalone price. */
  | { kind: "renew"; group: ComboTermGroup }
  /** Owns the licence, window open — the free cycle is one click away. */
  | { kind: "claim-free"; group: ComboTermGroup }
  /** Owns the licence, window closed — subscribe, billed today. */
  | { kind: "subscribe"; group: ComboTermGroup }
  /** Doesn't own the licence — the combo cart. `freeFirstMonth` says
   *  whether the first cycle rides along free. */
  | {
      kind: "combo";
      group: ComboTermGroup;
      freeFirstMonth: boolean;
      /** Price of the UP licence — the entire cart for a 1-month buy
       *  inside the window, where the free month IS the first cycle. */
      licenceUsd: number;
      /**
       * True when the 24h window has NEVER run. Verifying a phone starts it
       * (backend: /auth/phone/verify-otp), and our buy flow does exactly
       * that — so this buyer will be quoted the free-first-cycle price, not
       * the one the server is showing us right now.
       */
      windowNeverStarted: boolean;
    };

export async function getUnilevelPlusProduct(): Promise<UnilevelPlusProduct> {
  return api<UnilevelPlusProduct>("unilevel-plus/product", { method: "GET" });
}

/**
 * Collapse the raw product payload into the one state this viewer is in.
 * `thirdPartyClientId` is the pinned plan; we only care about that partner.
 */
export function resolveOffer(
  product: UnilevelPlusProduct | null,
  thirdPartyClientId: string,
): PlanOffer {
  if (!product) return { kind: "loading" };

  const group = (product.comboTerms || []).find(
    (g) => g.thirdPartyClientId === thirdPartyClientId,
  );
  if (!group) {
    // Older backend, inactive partner, or a catalog lookup that failed
    // server-side. Either way there's nothing safe to quote.
    return { kind: "unavailable", reason: "This plan isn't available right now." };
  }

  // Match NetworkChains' unlock page exactly: ownership is the PURCHASE
  // record, not the `purchased` flag. The backend sets
  // `purchased = !!purchase || isPlatformUser`, so the platform account
  // reads as purchased with no purchase — treating that as "owns UP"
  // would quote them the wrong price and send them to the wrong endpoint.
  const ownsUp = product.purchase != null;
  const windowOpen = !!product.freeMonthWindow?.open;

  if (product.comboUsed) return { kind: "renew", group };
  if (ownsUp) return windowOpen ? { kind: "claim-free", group } : { kind: "subscribe", group };
  return {
    kind: "combo",
    group,
    freeFirstMonth: group.freeFirstMonth,
    licenceUsd: product.plan?.productPrice ?? 0,
    windowNeverStarted: !product.freeMonthWindow?.startsAt,
  };
}

/** Headline price for a given offer + term, in USD. */
export function offerPrice(offer: PlanOffer, termMonths: number): number | null {
  if (offer.kind === "loading" || offer.kind === "unavailable") return null;
  if (offer.kind === "claim-free") return 0;
  if (offer.kind === "combo") {
    // 1 month costs exactly the licence whenever the free cycle applies —
    // either the window is open now, or our buy flow is about to open it by
    // verifying their phone. Quoting the closed-window price ($25 licence +
    // a paid first month) would show a number they will never be charged.
    if (termMonths === 1 && (offer.freeFirstMonth || offer.windowNeverStarted))
      return offer.licenceUsd;
    return (
      offer.group.terms.find((t) => t.termMonths === termMonths)?.cartTotal ??
      offer.group.terms[0]?.cartTotal ??
      null
    );
  }
  // renew / subscribe → standalone pricing (the bundle rate is gone).
  return (
    offer.group.standaloneTerms.find((t) => t.termMonths === termMonths)
      ?.totalAmount ??
    offer.group.standaloneTerms[0]?.totalAmount ??
    null
  );
}

/* ── Purchase actions ─────────────────────────────────────────────── */

export interface CreatedInvoice {
  success: boolean;
  invoice: { _id: string; invoiceNumber: string; totalAmount: number };
}

export async function createComboInvoice(input: {
  thirdPartyClientId: string;
  termMonths: number;
}): Promise<CreatedInvoice> {
  return api<CreatedInvoice>("unilevel-plus/checkout/create-combo-invoice", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function claimFreeMonth(
  thirdPartyClientId: string,
): Promise<{ success: boolean }> {
  return api("unilevel-plus/checkout/claim-free-month", {
    method: "POST",
    body: JSON.stringify({ thirdPartyClientId }),
  });
}

export async function subscribeStandalone(input: {
  thirdPartyClientId: string;
  termMonths: number;
}): Promise<CreatedInvoice> {
  return api<CreatedInvoice>("unilevel-plus/checkout/subscribe", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type ComboOverall =
  | "pending_payment"
  | "pending_combo"
  | "success"
  | "failed";

export interface ComboStatusResult {
  success: boolean;
  overall: ComboOverall;
  unilevelPlus: { activated: boolean };
  thirdParty: { activated: boolean; failureReason: string | null };
}

/** Poll after payment until `overall === "success"`. */
export async function getComboStatus(
  upInvoiceId: string,
): Promise<ComboStatusResult> {
  return api<ComboStatusResult>(
    `unilevel-plus/checkout/combo-status/${upInvoiceId}`,
    { method: "GET" },
  );
}

/* ── Garage office plans (what "Launch an Office" sells) ──────────── */

/**
 * An office plan (Starter / Pro). Monetary fields arrive in DOLLARS —
 * the backend converts from cents before sending.
 *
 * GST is region-dependent (India only) and `GET /checkout/office/plans`
 * is public, so it can't know the buyer's region. We show the BASE
 * price and let checkout apply tax.
 */
export interface OfficePlan {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  period: string;
  features?: string[];
}

export async function listOfficePlans(): Promise<OfficePlan[]> {
  const res = await api<{ plans: OfficePlan[] }>("checkout/office/plans", {
    method: "GET",
  });
  // Only the two plans the buy flow understands — the catalog can carry
  // legacy/internal rows that have no picker UI.
  return (res.plans || []).filter(
    (p) => p.slug === "starter" || p.slug === "pro",
  );
}

/** Subscribe an EXISTING office to a plan. Requires an orgId. */
export async function subscribeOffice(
  orgId: string,
  planSlug: string,
): Promise<{ success: boolean; requiresPayment?: boolean; invoiceId?: string }> {
  return api(`checkout/office/${orgId}/subscribe`, {
    method: "POST",
    body: JSON.stringify(
      planSlug === "pro" ? { planSlug, totalRoomCount: 1 } : { planSlug },
    ),
  });
}

/** What kind of Garage Store plan a pinned item is. */
export type GarageStoreKind = "subscription" | "office";

/**
 * Split a pinned garage-store id into its catalog id and (optional) term.
 * Ids look like "<catalogId>" or "<catalogId>:<termMonths>" — the term has
 * to travel on the id because a pin carries nothing else.
 */
export function parseGarageStoreId(itemId: string): {
  catalogId: string;
  termMonths: number | null;
} {
  const [catalogId, termRaw] = String(itemId).split(":");
  const n = Number(termRaw);
  return { catalogId, termMonths: Number.isFinite(n) && n > 0 ? n : null };
}

export interface OfficeOffer {
  kind: "office";
  plan: OfficePlan;
  /** The viewer's own org, if they have one. Null → they must create one. */
  orgId: string | null;
}

/**
 * Resolve a pinned garage-store item for THIS viewer.
 *
 * The pin only carries an id. Which catalog it belongs to — and, for an
 * office plan, whether the viewer even has an office to subscribe — is
 * per-viewer, so it's decided here rather than baked into the pin.
 */
export async function resolveGarageStoreItem(
  itemId: string,
  viewerOrgId: string | null,
): Promise<(PlanOffer & { termMonths?: number | null }) | OfficeOffer> {
  const { catalogId, termMonths } = parseGarageStoreId(itemId);

  // Partner subscriptions first (the common case), then office plans.
  // `resolveOffer` reads the CALLER'S own product payload, so the price
  // and CTA are always that viewer's — never the host's.
  try {
    const product = await getUnilevelPlusProduct();
    const offer = resolveOffer(product, catalogId);
    if (offer.kind !== "unavailable") return { ...offer, termMonths };
  } catch {
    /* fall through to the office catalog */
  }

  try {
    const plan = (await listOfficePlans()).find((p) => p._id === catalogId);
    if (plan) return { kind: "office", plan, orgId: viewerOrgId };
  } catch {
    /* nothing to quote */
  }

  return { kind: "unavailable", reason: "This plan isn't available right now." };
}

/**
 * The term this viewer will actually be billed for.
 *
 * Prefers the term the host pinned; falls back to whatever the viewer's
 * own offer supports. A pinned term that no longer exists in their price
 * list (plan retired, or they've moved to standalone pricing) must not be
 * sent to checkout — the server would reject it.
 */
export function resolveTermMonths(
  offer: PlanOffer & { termMonths?: number | null },
): number {
  if (offer.kind === "loading" || offer.kind === "unavailable") return 1;
  const available =
    offer.kind === "combo"
      ? // 1 month is always sellable inside the window even though the
        // bundle catalog omits it — the licence covers it.
        [
          ...offer.group.terms.map((t) => t.termMonths),
          ...(offer.freeFirstMonth || offer.windowNeverStarted ? [1] : []),
        ]
      : offer.group.standaloneTerms.map((t) => t.termMonths);
  const pinned = offer.termMonths;
  if (pinned && available.includes(pinned)) return pinned;
  return (
    available[0] ??
    (offer.kind === "combo" ? offer.group.defaultTermMonths : 1)
  );
}
