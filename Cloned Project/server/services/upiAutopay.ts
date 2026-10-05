/**
 * UPI Autopay controls, scoped to a subscription.
 *
 * THE CENTRAL DISTINCTION THIS FILE EXISTS TO ENFORCE:
 *
 *   cancel subscription  → invoices stop being generated, access ends
 *   disable autopay      → invoices KEEP being generated; the payer just
 *                          settles each one by hand, exactly as they do today
 *
 * They are different actions with different consequences, and conflating them
 * is the expensive mistake: someone who only wants "stop taking money from my
 * account automatically" must not lose the thing they are subscribed to.
 * Nothing in here touches subscription state — no `cancelledAt`, no child
 * invoice cancellation, no membership change.
 *
 * How manual payment keeps working with autopay off: `autoChargeOneInvoice`
 * finds no active mandate, records a `skipped_no_card` attempt, and returns
 * WITHOUT altering the invoice. The child stays `draft`, which is precisely
 * the state the normal pay-an-invoice flow expects. So disabling autopay needs
 * no changes to invoice generation at all — it simply stops the cron acting.
 *
 * Re-enabling is not symmetrical, and cannot be: Razorpay has no
 * SetupIntent-style "authorise without paying". A mandate is only ever created
 * as a side effect of a real payment. So `enableAutopay` does not create a
 * mandate — it returns the invoice the payer should settle, and the
 * registration branch in `selectPaymentMethod` attaches the new mandate when
 * they pay it by UPI.
 */
import { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { User } from "../models/user.model";

/**
 * Will paying this invoice put the buyer on a recurring subscription?
 *
 * THE SINGLE SOURCE OF TRUTH for "should this payment establish a mandate".
 * Both the registration branch in services/invoice.ts and the checkout
 * disclosure call this, so a mandate can never be registered without the
 * buyer being told, and the buyer can never be promised autopay that isn't set
 * up. Those two must move together or not at all.
 *
 * Three shapes qualify:
 *
 *  1. `isRecurring` — an ordinary subscription invoice or renewal cycle.
 *
 *  2. A combo cart with `metadata.combo` stamped at checkout. Typed one_time
 *     because fulfilment dispatches on lineItems[0] and can't fulfil a
 *     mixed-line invoice, but a subscription is exactly what it sells.
 *
 *  3. A BARE `unilevel_plus` licence bought while the 24h window is open.
 *     This one is easy to miss and is the highest-volume path we have:
 *     POST /unilevel-plus/checkout/create-order stamps NO combo intent, and
 *     the free NetworkChain month is granted later by the `comboFallback`
 *     block in fulfillInvoice, which re-derives the window at fulfilment time.
 *     So nothing on the invoice says "subscription" while the buyer is paying
 *     — we have to re-derive it here too, because that payment is the only
 *     moment a mandate can ever be established for them.
 *
 * Conditions in (3) mirror `comboFallback` deliberately, INCLUDING the
 * single-active-client rule — with two clients configured, fulfilment refuses
 * to guess which product to hand out and grants nothing, so registering a
 * mandate would take standing debit authority for a subscription that will
 * never exist. If that block changes, change this with it.
 */
export async function willEstablishSubscription(invoice: any): Promise<boolean> {
  if (!invoice) return false;
  if (invoice.isRecurring === true) return true;

  const md = (invoice.metadata as any) || {};
  if (md.combo?.thirdPartyClientId) return true;

  // ── The bare-licence fallback path ───────────────────────────────────
  const isLicencePurchase =
    invoice.lineItems?.[0]?.itemType === "unilevel_plus" ||
    md.type === "unilevel_plus_activation";
  if (!isLicencePurchase) return false;
  // Already granted — a replay must not re-register.
  if (md.comboCompletedAt) return false;

  try {
    const { comboWindowFor } = await import("./comboWindow");
    const buyer = await User.findById(invoice.userId)
      .select("profileCompletedAt offerExpiresAtOverride")
      .lean();
    if (!comboWindowFor(buyer as any, new Date()).open) return false;

    // Named, not counted — adding a second product must not switch this
    // offer off. See services/comboClient.ts.
    const { resolveComboClient, comboClientProblem } = await import("./comboClient");
    const { client, reason } = await resolveComboClient();
    if (!client) {
      console.warn(
        `[Autopay] no mandate for ${invoice?.invoiceNumber}: ${comboClientProblem(reason)}`,
      );
      return false;
    }
    return true;
  } catch (err: any) {
    // Never block a payment over this. Failing closed costs the buyer autopay;
    // failing open would take a mandate for a subscription we can't confirm.
    console.error(
      `[Autopay] subscription check failed for ${invoice?.invoiceNumber}:`,
      err?.message ?? err,
    );
    return false;
  }
}

/**
 * The third-party client whose subscription this invoice will start, and the
 * term it renews on. Mirrors the same three shapes as
 * `willEstablishSubscription`, so the disclosed renewal price is the one that
 * will actually be billed.
 */
async function resolveRenewalPlan(
  invoice: any,
): Promise<{ clientId: string; termMonths: number } | null> {
  const md = (invoice.metadata as any) || {};
  if (md.combo?.thirdPartyClientId) {
    return {
      clientId: String(md.combo.thirdPartyClientId),
      termMonths: md.combo.termMonths || 1,
    };
  }
  // Bare-licence fallback: fulfilment picks the single active client and
  // grants one free month, so renewals are monthly from cycle 2.
  try {
    // Must resolve the SAME client the mandate gate did, or the renewal price
    // disclosed to the payer would be for a different subscription.
    const { resolveComboClient } = await import("./comboClient");
    const { client } = await resolveComboClient();
    if (!client) return null;
    return { clientId: String(client._id), termMonths: 1 };
  } catch {
    return null;
  }
}

/**
 * What the checkout must disclose before a UPI payment establishes a mandate.
 *
 * Exists because "up to ₹50,000 per charge" is the mandate CEILING, not the
 * price — and quoting a ceiling to someone buying a $25 first month tells them
 * nothing useful. The buyer needs the two real numbers: what comes out today,
 * and what comes out every cycle after.
 *
 * Computed server-side on purpose. The renewal price comes from the partner's
 * live term plans, and recomputing it in the browser would let the disclosed
 * amount drift from the amount actually debited the moment prices change.
 */
export interface UpiAutopayNotice {
  /** What the buyer pays right now, minor units of `currency`, GST included. */
  firstAmount: number;
  /** What each renewal will be, same units and basis. Null when unknown. */
  renewalAmount: number | null;
  currency: string;
  /** How often that renewal recurs — "week", "month", "3 months", "year". */
  renewalEvery: string;
  /**
   * Months between renewals, or "weekly" — drives the mandate's declared
   * frequency. Weeks don't divide into months and Razorpay has a distinct
   * `weekly` enum, so it's carried rather than rounded to a month.
   */
  termMonths: number | "weekly";
  /** True when today's charge differs from the renewal (combo/free-month). */
  differsFromRenewal: boolean;
}

/**
 * Build the disclosure for an invoice, or null when paying it would not
 * establish a mandate.
 *
 * The eligibility test MUST mirror `wantsUpiMandate` in services/invoice.ts.
 * If it doesn't, one of two failures follows: a mandate registered with no
 * disclosure shown (silent standing debit authority), or a disclosure promising
 * autopay that never gets set up.
 */
export async function getUpiAutopayNotice(
  invoice: any,
): Promise<UpiAutopayNotice | null> {
  const md = (invoice?.metadata as any) || {};
  if (!(await willEstablishSubscription(invoice))) return null;

  const currency = invoice.itemCurrency || "USD";
  const firstAmount = invoice.totalAmount ?? 0;

  // Renewals are quoted on the same basis as the first charge, so the two
  // numbers are comparable. GST is added to the cart at checkout and to each
  // renewal later; quoting one inclusive and the other exclusive would
  // understate the renewal.
  const gstRate: number | null =
    typeof md.gst?.rate === "number" && md.gst.rate > 0 ? md.gst.rate : null;
  const withGst = (minor: number) =>
    gstRate ? Math.round(minor * (1 + gstRate / 100)) : minor;

  let renewalAmount: number | null = null;
  let term: number | "weekly" = 1;

  if (invoice.isRecurring === true) {
    // A plain recurring invoice renews at what it charges today.
    renewalAmount = firstAmount;
    // Read the cadence from `recurringPeriod` when the months field is absent
    // — office, channels, franchise and addons only ever set the former.
    term = billingTermFor(invoice);
  } else {
    // Combo cart or bare-licence-in-window. Today's charge is the licence
    // (+ any prepaid term); the renewal is the STANDALONE price of the term —
    // a bundle price is a one-time concession for buying alongside the
    // licence, not the ongoing rate.
    try {
      const plan = await resolveRenewalPlan(invoice);
      if (plan) {
        term = plan.termMonths;
        const { ThirdPartyClient } = await import(
          "../models/thirdPartyClient.model"
        );
        const { resolveTermPlan } = await import("./thirdPartyTerms");
        const client = await ThirdPartyClient.findById(plan.clientId)
          .select("productConfig")
          .lean<any>();
        if (client?.productConfig) {
          const resolved = resolveTermPlan(client.productConfig, plan.termMonths);
          if (resolved?.sellAmount > 0) {
            renewalAmount = withGst(Math.round(resolved.sellAmount * 100));
          }
        }
      }
    } catch (err: any) {
      // A missing renewal figure degrades the copy to the generic form; it
      // must never block the buyer from paying.
      console.error(
        `[Autopay] could not resolve renewal price for invoice ${invoice.invoiceNumber}:`,
        err?.message ?? err,
      );
    }
  }

  return {
    firstAmount,
    renewalAmount,
    currency,
    renewalEvery: renewalEveryLabel(term),
    termMonths: term,
    differsFromRenewal:
      renewalAmount != null && renewalAmount !== firstAmount,
  };
}

/**
 * Absolute ceiling on a mandate cap, as a backstop only. The real cap is
 * derived per-subscription from what the payer is actually signing up for.
 */
export const UPI_MANDATE_ABSOLUTE_MAX_PAISE = 10_000_000; // ₹1,00,000

/**
 * Headroom over the renewal amount.
 *
 * The cap has to survive things that legitimately move the debit between now
 * and the next cycle — mainly USD→INR drift, since plans are priced in USD and
 * debited in INR, plus any GST or list-price change. A cap pinned to today's
 * exact rupee figure would start failing renewals the first time the rupee
 * moved the wrong way, and a failed debit is far more expensive than a
 * slightly loose ceiling.
 */
const MANDATE_HEADROOM = 1.25;

/**
 * Work out the mandate ceiling for the subscription this invoice starts.
 *
 * Pinned to the RENEWAL, not to today's charge. Those differ constantly: the
 * combo cart pays ₹2,799 today (licence, first cycle free) and then renews at
 * ₹4,031/month. Capping on today's number would make every subsequent debit
 * bounce off its own mandate.
 *
 * Why not a flat ceiling: a fixed ₹50,000 cap meant someone authorising a
 * ₹4,031/month plan handed over authority for ₹50,000 a shot. Sizing the cap
 * to the plan means the mandate matches what the payer actually agreed to, and
 * — because monthly and quarterly then sit under the ₹15,000 AFA threshold —
 * their renewals debit silently instead of prompting for a UPI PIN every time.
 *
 * Returns null when the renewal price can't be resolved; the caller should
 * fall back to the module default rather than guess.
 */
export async function resolveMandateCapPaise(
  invoice: any,
  /** Today's charge in the payment currency's minor units (INR paise). */
  chargeMinor: number,
): Promise<number | null> {
  const notice = await getUpiAutopayNotice(invoice);
  if (!notice) return null;

  const first = notice.firstAmount || 0;
  const renewal = notice.renewalAmount;
  if (!renewal || !first || !chargeMinor) return null;

  // `notice` is denominated in the invoice's itemCurrency (USD); the mandate is
  // in INR. Derive the rate from the charge we're about to make rather than
  // re-fetching FX, so the cap is consistent with the amount being authorised.
  const rate = chargeMinor / first;
  const renewalMinor = Math.round(renewal * rate);

  // Cover whichever is larger — a prepaid multi-month term can exceed its own
  // renewal, and the registration debit must never exceed its own mandate.
  const base = Math.max(renewalMinor, chargeMinor);

  const withHeadroom = Math.ceil((base * MANDATE_HEADROOM) / 10_000) * 10_000; // → whole ₹100
  return Math.min(Math.max(withHeadroom, base), UPI_MANDATE_ABSOLUTE_MAX_PAISE);
}

/**
 * How often this invoice's subscription bills.
 *
 * `recurringIntervalMonths` is the precise field, but ONLY the third-party
 * (NetworkChain) paths ever write it. Everything else — office plans, channels,
 * franchise, cryptosub, whitelabel addons — sets `recurringPeriod` instead and
 * leaves the months field undefined. Reading only the months field therefore
 * silently reported "monthly" for 180+ invoices that bill yearly or weekly,
 * which would have declared the wrong cadence on the mandate and printed the
 * wrong cadence in the checkout disclosure.
 *
 * Returns months, or the literal "weekly" — weeks don't divide into months and
 * Razorpay has a distinct `weekly` enum, so collapsing it to a number would
 * lose it.
 */
function billingTermFor(invoice: any): number | "weekly" {
  // Explicit field wins when present — NetworkChain terms (3/6/12) rely on it.
  if (invoice?.recurringIntervalMonths) return invoice.recurringIntervalMonths;

  switch (String(invoice?.recurringPeriod || "").toLowerCase()) {
    case "weekly":
      return "weekly";
    case "quarterly":
      return 3;
    case "halfyearly":
    case "half_yearly":
    case "half-yearly":
      return 6;
    case "yearly":
    case "annual":
    case "annually":
      return 12;
    case "monthly":
    default:
      return 1;
  }
}

/** Human wording for the disclosure — "week", "month", "3 months", "year". */
function renewalEveryLabel(term: number | "weekly"): string {
  if (term === "weekly") return "week";
  if (term === 1) return "month";
  if (term === 12) return "year";
  return `${term} months`;
}

/** Frequencies Razorpay actually recognises for a UPI mandate. */
export type UpiMandateFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "as_presented";

/**
 * Declare the real billing cadence on the mandate instead of `as_presented`.
 *
 * `as_presented` is Razorpay's default and the most permissive option, but it
 * renders in the payer's UPI app as "Frequency: As requested" — which tells
 * someone authorising a standing debit nothing about how often they'll be
 * charged. Stating the actual cadence is both clearer and closer to what they
 * agreed to.
 *
 * Only these values are honoured for UPI: per Razorpay, "for UPI, all
 * undefined frequencies except daily, weekly, monthly, quarterly and yearly
 * are considered as-presented". Half-yearly is NOT on that list, so a 6-month
 * term stays `as_presented` — sending "halfyearly" would silently degrade to
 * the same thing while implying we'd declared something.
 *
 * Trade-off worth knowing: a fixed frequency is a stricter mandate than
 * `as_presented`. Debits are expected to follow the declared cadence, so this
 * suits our fixed monthly/quarterly/annual cycles but would be wrong for
 * usage-based or irregular billing.
 */
export function mandateFrequencyForTerm(
  term: number | "weekly",
): UpiMandateFrequency {
  if (term === "weekly") return "weekly";
  switch (term) {
    case 1:
      return "monthly";
    case 3:
      return "quarterly";
    case 12:
      return "yearly";
    default:
      // 6-month and anything unusual — no recognised UPI enum exists, so be
      // explicit rather than declaring a value Razorpay would ignore.
      return "as_presented";
  }
}

/** The mandate cadence this invoice's subscription will bill on. */
export async function resolveMandateFrequency(
  invoice: any,
): Promise<UpiMandateFrequency> {
  const notice = await getUpiAutopayNotice(invoice);
  if (!notice?.termMonths) return "as_presented";
  return mandateFrequencyForTerm(notice.termMonths);
}

export interface AutopayState {
  /** A live mandate exists and the cron will use it. */
  enabled: boolean;
  /** "active" | "pending" | "paused" | "revoked" | null when none exists. */
  mandateStatus: string | null;
  /** Payer's UPI handle, for display. */
  vpa: string | null;
  /** Paise ceiling on a single debit. */
  maxAmount: number | null;
  mandateExpiresAt: Date | null;
  /**
   * Why autopay is not currently running, in words the UI can show.
   * Null when it is running.
   */
  reason: string | null;
}

/**
 * Reconcile an unresolved UPI mandate against Razorpay, and persist what we
 * learn.
 *
 * Mandates change at Razorpay without us hearing: `token.confirmed` and
 * `token.cancelled` are separately-subscribed webhooks with no retry (our
 * handler always answers 200), and a payer revoking inside their own UPI app is
 * invisible to us until we ask. That produced a customer whose row said
 * "pending" while Razorpay had the mandate as "cancelled" — wrong in both
 * directions, and the UI told them to approve something that no longer existed.
 *
 * Only runs for rows still sitting at "pending", which after the
 * `payment.captured` fix is a genuinely transient state — an `active` or
 * `revoked` row never triggers a call. Failures are swallowed: a settings page
 * must still render if Razorpay is unreachable.
 */
async function reconcilePendingMandate(
  userId: string,
  customerId: string | undefined,
  token: any,
): Promise<any> {
  if (!customerId || !token?.id || token.mandateStatus !== "pending") {
    return token;
  }
  try {
    const { fetchCustomerToken, mandateStatusFromRecurring } = await import(
      "./razorpay"
    );
    const live = await fetchCustomerToken(customerId, token.id);
    if (!live) return token;

    const status = mandateStatusFromRecurring(live?.recurring_details?.status);
    const expireAt = live?.expired_at
      ? new Date(Number(live.expired_at) * 1000)
      : token.mandateExpiresAt ?? null;
    const maxAmount = live?.max_amount ?? token.maxAmount ?? null;

    if (
      status === token.mandateStatus &&
      maxAmount === token.maxAmount &&
      String(expireAt) === String(token.mandateExpiresAt)
    ) {
      return token; // nothing moved
    }

    await User.updateOne(
      { _id: userId, "paymentProfile.razorpay.tokens.id": token.id },
      {
        $set: {
          "paymentProfile.razorpay.tokens.$.mandateStatus": status,
          ...(maxAmount != null
            ? { "paymentProfile.razorpay.tokens.$.maxAmount": maxAmount }
            : {}),
          ...(expireAt
            ? {
                "paymentProfile.razorpay.tokens.$.expireAt": expireAt,
                "paymentProfile.razorpay.tokens.$.mandateExpiresAt": expireAt,
              }
            : {}),
        },
      },
    );
    console.log(
      `[UPI-AUTOPAY] RECONCILE mandate ${token.id} for ${userId}: pending → ${status} (Razorpay says "${live?.recurring_details?.status ?? "unknown"}")`,
    );
    return { ...token, mandateStatus: status, maxAmount, mandateExpiresAt: expireAt };
  } catch (err: any) {
    console.error(
      `[UPI-AUTOPAY] RECONCILE-FAILED for ${token.id}:`,
      err?.message ?? err,
    );
    return token;
  }
}

/**
 * Read the buyer's UPI mandate state.
 *
 * NOT a pure read: a mandate still marked "pending" is refreshed from Razorpay
 * first (see `reconcilePendingMandate`), because a stale "pending" is what made
 * approved mandates show as "waiting for approval" indefinitely. Every other
 * state is served straight from Mongo with no outbound call.
 */
export async function getAutopayState(userId: string): Promise<AutopayState> {
  const u: any = await User.findById(userId)
    .select("paymentProfile.razorpay")
    .lean();

  const tokens = (u?.paymentProfile?.razorpay?.tokens || []) as any[];
  let upi = tokens.filter((t) => t?.method === "upi");

  // Resolve anything unconfirmed before deciding what to tell the user.
  const customerId = u?.paymentProfile?.razorpay?.customerId;
  if (upi.some((t) => t.mandateStatus === "pending")) {
    upi = await Promise.all(
      upi.map((t) =>
        t.mandateStatus === "pending"
          ? reconcilePendingMandate(userId, customerId, t)
          : Promise.resolve(t),
      ),
    );
  }

  if (!upi.length) {
    return {
      enabled: false,
      mandateStatus: null,
      vpa: null,
      maxAmount: null,
      mandateExpiresAt: null,
      reason: "No UPI autopay has been set up.",
    };
  }

  // Prefer a live one; otherwise report the most recent so the UI can explain
  // what happened rather than saying "none".
  const now = new Date();
  const live = upi.find(
    (t) =>
      t.mandateStatus === "active" &&
      (!t.mandateExpiresAt || new Date(t.mandateExpiresAt) > now),
  );
  const chosen =
    live ??
    [...upi].sort(
      (a, b) =>
        new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime(),
    )[0];

  const expired =
    !!chosen.mandateExpiresAt && new Date(chosen.mandateExpiresAt) <= now;

  return {
    enabled: !!live,
    mandateStatus: chosen.mandateStatus ?? null,
    vpa: chosen.vpa ?? null,
    maxAmount: chosen.maxAmount ?? null,
    mandateExpiresAt: chosen.mandateExpiresAt ?? null,
    reason: live
      ? null
      : expired
        ? "The autopay mandate has expired and needs to be set up again."
        : chosen.mandateStatus === "pending"
          ? "Waiting for you to approve the mandate in your UPI app."
          : chosen.mandateStatus === "revoked"
            ? "Autopay was cancelled. Invoices are still issued and can be paid manually."
            : chosen.mandateStatus === "paused"
              ? "Autopay is paused in your UPI app. Invoices are still issued and can be paid manually."
              : "Autopay is not active.",
  };
}

/**
 * Turn OFF automatic debiting. The subscription is deliberately untouched.
 *
 * After this the payer keeps receiving invoices on the same schedule and pays
 * each one manually — the collection method everyone used before autopay
 * existed. Access is unaffected.
 *
 * Best-effort at Razorpay, authoritative locally: the cron gates on
 * `mandateStatus === "active"`, so flipping the local row is what actually
 * stops the debits. The remote revoke is what releases the payer's bank
 * authority, and a failure there must not leave the UI claiming autopay is
 * still on.
 */
export async function disableAutopay(userId: string): Promise<{
  disabled: number;
  alreadyOff: boolean;
  state: AutopayState;
}> {
  const u: any = await User.findById(userId)
    .select("paymentProfile.razorpay")
    .lean();

  const custId = u?.paymentProfile?.razorpay?.customerId;
  const active = ((u?.paymentProfile?.razorpay?.tokens || []) as any[]).filter(
    (t) => t?.method === "upi" && t?.mandateStatus === "active",
  );

  if (!active.length) {
    return { disabled: 0, alreadyOff: true, state: await getAutopayState(userId) };
  }

  const { revokeUpiMandate } = await import("./razorpay");
  let disabled = 0;

  for (const m of active) {
    try {
      if (custId) {
        const res = await revokeUpiMandate({ customerId: custId, tokenId: m.id });
        console.log(
          `[UPI-AUTOPAY] REVOKE mandate ${m.id} ${res.alreadyGone ? "already gone at Razorpay" : "cancellation initiated at NPCI"} for user ${userId}`,
        );

        // Cancellation is ASYNCHRONOUS — Razorpay answers
        // "cancellation_initiated" and the docs warn NPCI can still refuse it.
        // Read the token straight back so a refusal is visible instead of us
        // reporting "revoked" over a mandate that is still live in the payer's
        // UPI app. We keep the local row revoked either way (the payer asked us
        // to stop, and the cron must honour that immediately) — this is about
        // knowing when the withdrawal did NOT reach the bank.
        try {
          const { fetchCustomerToken } = await import("./razorpay");
          const live = await fetchCustomerToken(custId, m.id);
          const remote = live?.recurring_details?.status;
          if (remote && !["cancelled", "rejected", "expired"].includes(remote)) {
            console.warn(
              `[UPI-AUTOPAY] REVOKE mandate ${m.id}: Razorpay still reports "${remote}" right after cancelling — NPCI may not have applied it yet. Local marked revoked; getAutopayState will reconcile.`,
            );
          }
        } catch {
          // Verification is best-effort; never block the revoke.
        }
      }
    } catch (err: any) {
      // Still mark it off locally. Leaving it "active" here would let the cron
      // keep trying a mandate the payer has asked us to stop using.
      console.error(
        `[UPI-AUTOPAY] REVOKE-FAILED for ${m.id}, disabling locally anyway:`,
        err?.message ?? err,
      );
    }
    await User.updateOne(
      { _id: userId, "paymentProfile.razorpay.tokens.id": m.id },
      { $set: { "paymentProfile.razorpay.tokens.$.mandateStatus": "revoked" } },
    );
    disabled++;
  }

  return { disabled, alreadyOff: false, state: await getAutopayState(userId) };
}

/**
 * Turn autopay back ON for a subscription — the "resubscribe" path.
 *
 * Used both after a deliberate disable and after a mandate dies on its own:
 * Razorpay stops retrying a failed mandate debit after its own window, which
 * is shorter than our invoice grace, so a payer can end up with a live
 * subscription, unpaid invoices, and a mandate that will never fire again.
 * They must be able to re-establish one without cancelling anything.
 *
 * Returns the invoice to pay rather than creating a mandate, because Razorpay
 * only mints a mandate as a side effect of a real payment. Paying the returned
 * invoice by UPI runs the registration branch in `selectPaymentMethod`, which
 * attaches the new mandate; from the next cycle the cron takes over again.
 *
 * Never mutates the subscription. If the subscription itself was cancelled,
 * this refuses and points at `renew-subscription` — reviving a cancelled
 * subscription is a different, larger decision than re-enabling autopay.
 */
export async function enableAutopay(
  parentInvoiceId: string,
  userId: string,
): Promise<{
  /** The invoice to pay by UPI to establish the mandate. Null if nothing is due. */
  payable: any | null;
  /** True when a live mandate already exists — nothing to do. */
  alreadyOn: boolean;
  state: AutopayState;
  message: string;
}> {
  const parent = await Invoice.findById(parentInvoiceId);
  if (!parent) throw new Error("Subscription not found");
  if (parent.parentInvoiceId)
    throw new Error("Provide the parent subscription, not a child invoice");
  if (!parent.isRecurring) throw new Error("Invoice is not a recurring subscription");
  if (parent.userId.toString() !== userId) throw new Error("Unauthorized");
  if (parent.cancelledAt)
    throw new Error(
      "This subscription is cancelled — renew it first, then autopay can be set up on the next payment.",
    );

  const state = await getAutopayState(userId);
  if (state.enabled) {
    return {
      payable: null,
      alreadyOn: true,
      state,
      message: "Autopay is already active for this account.",
    };
  }

  // The next thing the payer can settle. A mandate rides along with it.
  const payable = await Invoice.findOne({
    parentInvoiceId: parent._id,
    status: { $in: ["draft", "failed", "pending"] },
  })
    .sort({ createdAt: 1 })
    .lean();

  return {
    payable,
    alreadyOn: false,
    state,
    message: payable
      ? "Pay this invoice by UPI to switch autopay back on — you'll approve the mandate once in your UPI app."
      : "Nothing is due right now. Autopay will be set up automatically the next time you pay a renewal by UPI.",
  };
}
