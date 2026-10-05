import { PendingInvite } from "../models/pendingInvite.model";
import { getSponsorCardByAffiliateId } from "./affiliate";
import { findUserByIdentifier, identifierValue, type Identifier } from "./identifier";

/**
 * Invites held against a phone number or email — see pendingInvite.model.ts.
 *
 *   web invite page  →  savePendingInvite(identifier, aff_x)
 *   app login screen →  lookupPendingInvite(identifier)   ("Shorupan invited you")
 *   OTP verified     →  finishLogin → pendingReferralFor / markPendingInviteUsed
 */

/** How long an invite waits for its person. Matches the app's parked-code
 *  window (`CODE_TTL_MS` in the NetworkChains app's lib/affiliate-ref.ts). */
export const INVITE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ValidIdentifier = Extract<Identifier, { kind: "email" } | { kind: "phone" }>;

function liveFilter(id: ValidIdentifier) {
  return {
    identifier: identifierValue(id),
    consumedAt: null,
    savedAt: { $gte: new Date(Date.now() - INVITE_WINDOW_MS) },
  };
}

/** The newest live invite for this identifier, or null. */
async function findLive(id: ValidIdentifier) {
  return PendingInvite.findOne(liveFilter(id)).sort({ savedAt: -1 }).lean();
}

/**
 * Record "this person was invited by `affiliateId`". The code must belong to a
 * real sponsor — a junk code would otherwise sit here and later be shown to the
 * invitee as nobody.
 *
 * Returns whether an account already exists for the identifier, so the web
 * page can tell an existing member to just sign in. The invite is saved either
 * way: `finishLogin` hands it to `setReferredByAffiliateId`, which only ever
 * upgrades a placeholder attribution and never overrides a real one.
 */
export async function savePendingInvite(
  id: ValidIdentifier,
  affiliateId: string,
): Promise<{ saved: boolean; existingAccount: boolean }> {
  const sponsor = await getSponsorCardByAffiliateId(affiliateId);
  if (!sponsor) return { saved: false, existingAccount: false };

  const existing = await findUserByIdentifier(id, "_id");

  // Upsert on the live row, so a second invite for the same person replaces
  // the first rather than stacking behind it (last touch wins).
  await PendingInvite.findOneAndUpdate(
    { identifier: identifierValue(id), consumedAt: null },
    {
      $set: {
        kind: id.kind,
        affiliateId: sponsor.affiliateCode || affiliateId,
        savedAt: new Date(),
      },
    },
    { upsert: true, sort: { savedAt: -1 } },
  );

  return { saved: true, existingAccount: !!existing };
}

/**
 * What the app's login screen may show for a typed identifier.
 *
 * The sponsor is only revealed for an identifier with NO account: an existing
 * member's sponsor is already settled, and this endpoint must not become a way
 * to ask "who referred this person?" about anyone with an account.
 */
export async function lookupPendingInvite(id: ValidIdentifier): Promise<{
  existing: boolean;
  sponsor: Awaited<ReturnType<typeof getSponsorCardByAffiliateId>>;
}> {
  const account = await findUserByIdentifier(id, "_id");
  if (account) return { existing: true, sponsor: null };

  const invite = await findLive(id);
  if (!invite) return { existing: false, sponsor: null };

  return { existing: false, sponsor: await getSponsorCardByAffiliateId(invite.affiliateId) };
}

/**
 * The affiliate code a verified sign-in should be credited to, when the client
 * sent none. Never throws — attribution must not be the reason a login fails.
 */
export async function pendingReferralFor(
  id: ValidIdentifier,
): Promise<{ inviteId: string; affiliateId: string } | null> {
  try {
    const invite = await findLive(id);
    return invite ? { inviteId: String(invite._id), affiliateId: invite.affiliateId } : null;
  } catch (err) {
    console.error("[pendingInvite] lookup at sign-in failed:", err);
    return null;
  }
}

/** Retire an invite once a verified sign-in has used it. Fire-and-forget. */
export function markPendingInviteUsed(inviteId: string, userId: string): void {
  PendingInvite.updateOne(
    { _id: inviteId, consumedAt: null },
    { $set: { consumedAt: new Date(), consumedBy: userId } },
  ).catch((err) => console.error("[pendingInvite] mark used failed:", err));
}

// ─── Spam control ───────────────────────────────────────────────────────────
//
// Both routes are public. Per-caller windows, in memory (this backend runs as
// one process). Deliberately loose: every caller that trips one just gets the
// "nothing to show" answer, and nothing downstream depends on these routes —
// the sign-in itself reads the invite directly.

const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();
let lastSweep = 0;

/** Check-and-record one request for `bucket:caller`. */
export function allowInviteRequest(bucket: "save" | "lookup", caller: string): boolean {
  const now = Date.now();
  if (now - lastSweep > WINDOW_MS) {
    lastSweep = now;
    for (const [k, times] of hits) {
      const live = times.filter((t) => now - t < WINDOW_MS);
      if (live.length) hits.set(k, live);
      else hits.delete(k);
    }
  }
  const max = bucket === "save" ? 30 : 120;
  const key = `${bucket}:${caller}`;
  const times = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= max) return false;
  times.push(now);
  hits.set(key, times);
  return true;
}
