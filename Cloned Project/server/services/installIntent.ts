import crypto from "crypto";
import { InstallIntent } from "../models/installIntent.model";

/** An intent is only matchable for an hour after it was written — a launch
 *  later than that is almost certainly an unrelated install. */
export const MATCH_WINDOW_MS = 60 * 60 * 1000;

// Shares the salt with affiliate click tracking so the same IP hashes the
// same way across both features (and so neither can be reversed without it).
const IP_HASH_SALT = process.env.IP_HASH_SALT || "nc-affiliate-click";

export function hashIp(ip?: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip + IP_HASH_SALT).digest("hex");
}

export function clientIp(req: any): string | null {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

/** Garage Shop, Garage HQ, NetworkChains (a third-party client of this
 *  backend), and GarageIRL ("pay", the Garage Pay buyer app,
 *  com.garagepayseller.app). A claim only ever matches rows parked for the
 *  same app. */
export type InstallIntentApp = "store" | "hq" | "nc" | "pay";

export interface Fingerprint {
  platform: "ios" | "android";
  /** Which app is parking/claiming. Absent from claims by Shop builds that
   *  predate the field, so it is normalised in `appFilter` rather than here. */
  app?: InstallIntentApp | null;
  ipHash: string;
  userAgent?: string;
  osVersion?: string | null;
  screen?: string | null;
  timezone?: string | null;
  locale?: string | null;
}

/**
 * Score a candidate intent against the claiming device.
 *
 * ipHash + platform are already a hard filter, so this only breaks ties among
 * devices behind the same NAT. OS version and screen are weighted highest
 * because they are the two that actually differ between phones in a household;
 * timezone and locale are near-constant on one network and so are worth little.
 * Nothing here is required to match — a browser that reports no timezone must
 * still be claimable.
 */
function score(candidate: any, fp: Fingerprint): number {
  let s = 0;
  if (fp.osVersion && candidate.osVersion) {
    // Safari reports "17_5"; the app reports "17.5.1". Compare on major
    // version only — a point release can land between the tap and the launch.
    const major = (v: string) => String(v).replace(/_/g, ".").split(".")[0];
    if (major(fp.osVersion) === major(candidate.osVersion)) s += 3;
  }
  if (fp.screen && candidate.screen && fp.screen === candidate.screen) s += 3;
  if (fp.timezone && candidate.timezone && fp.timezone === candidate.timezone) s += 1;
  if (fp.locale && candidate.locale && fp.locale === candidate.locale) s += 1;
  return s;
}

/** "390x844" → [390, 844] sorted, so the two orientations compare equal: an
 *  iPad can launch the app in landscape while Safari reported portrait. */
function screenDims(v: string): string {
  const m = /^(\d+)x(\d+)$/.exec(v.trim());
  if (!m) return v.trim();
  const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
  return `${a}x${b}`;
}

/**
 * Whether a candidate CANNOT have been written by the claiming device.
 *
 * `score` only ranks, so on its own a lone candidate wins at score 0 — a
 * stranger's click on the same IP, with a different screen and timezone,
 * was handed over as this device's. That is not a corner case: mobile
 * carriers put thousands of subscribers behind one address (Jio CGNAT
 * returned another member's invite to a probe whose screen and timezone
 * matched nothing). The signals below cannot change between one person's
 * tap and their install, so a disagreement is a different device.
 *
 * Still only a disagreement, never an absence: a side that reports nothing
 * stays claimable, as before.
 *
 *   screen   — iOS only. Safari's `screen` and the app's window are the same
 *              points on an iPhone; on Android the app's window excludes the
 *              system bars, so the two legitimately differ there.
 *   timezone — the same phone, within the hour.
 *
 * Deliberately NOT OS version: iOS 26 Safari freezes its UA at "18_6", so the
 * web's reading is wrong for every current iPhone.
 */
function contradicts(candidate: any, fp: Fingerprint): boolean {
  if (
    fp.platform === "ios" &&
    fp.screen &&
    candidate.screen &&
    screenDims(fp.screen) !== screenDims(candidate.screen)
  ) {
    return true;
  }
  if (fp.timezone && candidate.timezone && fp.timezone !== candidate.timezone) return true;
  return false;
}

/**
 * Identifies the claiming INSTALL well enough to tell two phones on one
 * network apart: everything the app reports, plus its user agent (app build +
 * OS build). Stable across that install's launches, which is all a re-claim
 * needs.
 */
function claimerKey(fp: Fingerprint): string {
  return crypto
    .createHash("sha256")
    .update(
      [
        fp.ipHash,
        fp.platform,
        fp.app ?? "",
        fp.osVersion ?? "",
        fp.screen ?? "",
        fp.timezone ?? "",
        fp.locale ?? "",
        fp.userAgent ?? "",
      ].join("|"),
    )
    .digest("hex");
}

export async function recordIntent(input: {
  link: string;
  affiliateId?: string | null;
  fp: Fingerprint;
}) {
  return InstallIntent.create({
    link: input.link,
    affiliateId: input.affiliateId ?? null,
    app: input.fp.app ?? "store",
    platform: input.fp.platform,
    ipHash: input.fp.ipHash,
    userAgent: input.fp.userAgent ?? "",
    osVersion: input.fp.osVersion ?? null,
    screen: input.fp.screen ?? null,
    timezone: input.fp.timezone ?? null,
    locale: input.fp.locale ?? null,
  });
}

/**
 * Only rows parked for the claiming app are candidates. Shop is the default on
 * both ends: a Shop build that predates the `app` field sends none, and rows
 * written before the field existed have none — the two must keep matching each
 * other, so "store" also accepts a missing value (rows expire within 3h, so
 * this is a transition rule, not a permanent ambiguity).
 */
function appFilter(app: Fingerprint["app"]) {
  return app === "hq" || app === "nc" || app === "pay" ? app : { $in: ["store", null] };
}

/**
 * Find and consume the intent this device most likely created before it went
 * to the store. Returns null when there is no candidate OR when the best two
 * candidates are indistinguishable — crediting the wrong affiliate is a worse
 * outcome than crediting none, since a wrong credit is invisible and
 * unrecoverable while a missed one just falls back to an unattributed signup.
 */
/** A claimed row stays answerable to the same device for this long (rows
 *  are deleted at 3h regardless, so this is the practical ceiling). */
export const RECLAIM_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * The one candidate this device most plausibly wrote, or null when the best
 * two are indistinguishable. Two different links scoring identically means
 * we cannot tell which device is claiming; the same link twice is not
 * ambiguous — either row sends the user to the same place.
 */
function pickUnambiguous(all: any[], fp: Fingerprint): any | null {
  const candidates = all.filter((c) => !contradicts(c, fp));
  if (!candidates.length) return null;
  const ranked = candidates
    .map((c) => ({ c, s: score(c, fp) }))
    // Newest wins a tie on score — `candidates` arrive newest-first and sort
    // is stable, so only the score needs comparing here.
    .sort((a, b) => b.s - a.s);
  if (ranked.length > 1 && ranked[1].s === ranked[0].s && ranked[1].c.link !== ranked[0].c.link) {
    return null;
  }
  return ranked[0].c;
}

export async function claimIntent(
  fp: Fingerprint,
  opts: { reclaim?: boolean } = {},
): Promise<string | null> {
  const since = new Date(Date.now() - MATCH_WINDOW_MS);
  const candidates = await InstallIntent.find({
    ipHash: fp.ipHash,
    platform: fp.platform,
    app: appFilter(fp.app),
    claimedAt: null,
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const pick = pickUnambiguous(candidates, fp);
  if (pick) {
    // Atomic claim: two launches racing on the same row must not both redeem it.
    const claimed = await InstallIntent.findOneAndUpdate(
      { _id: pick._id, claimedAt: null },
      { $set: { claimedAt: new Date(), claimerKey: claimerKey(fp) } },
      { new: true },
    ).lean();
    if (claimed) return claimed.link;
  }

  // Nothing unclaimed. A client asking to RE-claim is one that already
  // redeemed its row but lost the answer — an install whose first launch
  // ran a store-embedded bundle that kept the route only in memory, before
  // the update that persists it landed on the second launch. Hand the same
  // fingerprint its already-claimed link back, with the same tie-break; the
  // row is left as it is. Only on request, so ordinary claims from other
  // devices on the network never see redeemed rows.
  //
  // And only rows THIS install redeemed (`claimerKey`). Matching the network
  // and re-scoring was not enough: every install re-claimed on its second
  // launch, organic ones included, and got back whatever another phone behind
  // the same carrier NAT had redeemed in the last three hours. Rows claimed
  // before the key existed carry none and are no longer re-claimable; they
  // expire within 3h.
  if (!opts.reclaim) return null;
  const reclaimable = await InstallIntent.find({
    ipHash: fp.ipHash,
    platform: fp.platform,
    app: appFilter(fp.app),
    claimedAt: { $ne: null, $gte: new Date(Date.now() - RECLAIM_WINDOW_MS) },
    claimerKey: claimerKey(fp),
  })
    .sort({ claimedAt: -1 })
    .limit(20)
    .lean();
  const again = pickUnambiguous(reclaimable, fp);
  return again ? again.link : null;
}
