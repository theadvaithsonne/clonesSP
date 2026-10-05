/**
 * Which third-party subscription does the Unilevel Plus combo offer sell?
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Two separate places needed that answer and each resolved it the same
 * fragile way — "the client that is the only active one":
 *
 *     const active = await ThirdPartyClient.find({ isActive: true }).limit(2);
 *     if (active.length === 1) { ...use active[0]... }
 *
 * `services/upiAutopay.ts` used it to decide whether to register a UPI
 * mandate at checkout, and `services/invoice.ts` used it to decide whether to
 * grant the free first month at fulfilment.
 *
 * Activating a SECOND client (GarageGo, 10 Sep 2026) made both conditions
 * false at once. Nothing in the code changed, but from that moment buyers on
 * the bare-licence path stopped getting a mandate AND stopped getting their
 * free month — Razorpay opened a one-time order instead of an autopay
 * registration, and fulfilment logged a `console.warn` nobody reads. Two real
 * buyers were affected before it was noticed.
 *
 * The guard itself was right to refuse to guess. The mistake was identifying
 * the product by a count, so that selling a second product silently switched
 * off the first one's offer. It is named now.
 *
 * ── Resolution order ─────────────────────────────────────────────────────
 *   1. The client flagged `isComboDefault` — explicit, survives any number of
 *      other clients being added.
 *   2. Exactly one active client — the pre-existing behaviour, kept so an
 *      installation that never sets the flag keeps working unchanged.
 *   3. Nothing. Ambiguous, so refuse rather than guess which subscription to
 *      hand someone.
 */
import type { IThirdPartyClient } from "../models/thirdPartyClient.model";

export interface ComboClientResolution {
  client: IThirdPartyClient | null;
  /** Why we did or didn't resolve one — logged at both call sites. */
  reason: "flagged" | "sole_active" | "ambiguous" | "none_active";
}

export async function resolveComboClient(): Promise<ComboClientResolution> {
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");

  // 1. Explicitly nominated.
  const flagged = await ThirdPartyClient.findOne({
    isActive: true,
    isComboDefault: true,
  });
  if (flagged) return { client: flagged, reason: "flagged" };

  // 2. Unambiguous by virtue of being the only one. `limit(2)` is enough to
  //    tell "one" from "more than one" without loading the whole collection.
  const active = await ThirdPartyClient.find({ isActive: true }).limit(2);
  if (active.length === 1) return { client: active[0], reason: "sole_active" };

  return {
    client: null,
    reason: active.length === 0 ? "none_active" : "ambiguous",
  };
}

/**
 * Human-readable explanation for a failed resolution, for the log line at the
 * call site. An ambiguous result is a configuration problem someone has to
 * fix, so it should say what to do rather than only what happened.
 */
export function comboClientProblem(reason: ComboClientResolution["reason"]): string {
  if (reason === "none_active") {
    return "no active third-party client is configured";
  }
  if (reason === "ambiguous") {
    return (
      "more than one active third-party client and none flagged isComboDefault " +
      "— set isComboDefault:true on the one the Unilevel Plus combo sells"
    );
  }
  return "";
}
