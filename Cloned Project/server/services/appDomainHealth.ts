import { Organization } from "../models/organization.model";
import { PLATFORM_ORG_ID } from "./commission";

/**
 * White-label domain liveness, and the origin public links are minted on.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Share/affiliate links were built from the office's primary *verified*
 * domain. "Verified" means DNS resolves and Vercel issued a certificate — it
 * says nothing about WHICH deployment the domain serves. A domain left
 * attached to an old deployment keeps answering 200 for every path, because
 * that build's own catch-all route ([orgSlug]/[channelId]) renders instead of
 * 404ing. So a link like
 *
 *     https://join.thenetworkeconomy.com/webinar/<id>?sessionDate=…&ref=aff_…
 *
 * rendered the generic landing page — a dead link for every recipient, with
 * nothing anywhere reporting a failure.
 *
 * ── How it is fixed ────────────────────────────────────────────────────────
 * Each verified app domain is probed for GET /api/app-health, which only the
 * current frontend build answers with JSON. A domain that answers HTML (stale
 * build), times out, or reports a linkContract below MIN_LINK_CONTRACT is
 * marked unhealthy, and share links fall back to the canonical origin.
 *
 * The gate is deliberately one-directional: a domain is demoted only after
 * `FAILURES_TO_DEMOTE` consecutive failures, and is restored on the first
 * success. Never-probed domains keep working — a fresh deploy of this service
 * must not blank out every office's branded links before the first sweep.
 */

/**
 * Minimum linkContract a domain must report to be used for public links.
 * Raise this in lockstep with LINK_CONTRACT_VERSION in the frontend's
 * app/api/app-health/route.ts when a link-target route is added or moved.
 */
export const MIN_LINK_CONTRACT = 1;

/** Origin used when an office has no healthy domain of its own. */
export const CANONICAL_APP_ORIGIN = (
  process.env.PUBLIC_APP_ORIGIN || "https://my.garage.app"
).replace(/\/+$/, "");

/**
 * Offices whose public links are ALWAYS minted on CANONICAL_APP_ORIGIN,
 * whatever custom domains they hold.
 *
 * The platform's own org (The Network Economy / "Garage App") carries
 * join.thenetworkeconomy.com as a customAppDomain, so the generic
 * "primary verified domain wins" rule rewrote every Garage link — recurring
 * webinar invites included — onto a host that is not the product's canonical
 * address. Garage's own public address is my.garage.app by definition; a
 * white-label entry on the platform org must not override it.
 *
 * Extra org ids can be pinned via PLATFORM_ORIGIN_ORG_IDS (comma-separated)
 * without a deploy of this file.
 */
export const CANONICAL_ORIGIN_ORG_IDS = new Set(
  [
    PLATFORM_ORG_ID,
    ...(process.env.PLATFORM_ORIGIN_ORG_IDS || "")
      .split(",")
      .map((v) => v.trim()),
  ].filter(Boolean)
);

const PROBE_TIMEOUT_MS = 8_000;
const FAILURES_TO_DEMOTE = 2;

/** Share-origin cache. Link builders hit this on every page that shares. */
const originCache = new Map<string, { origin: string; at: number }>();
const ORIGIN_CACHE_TTL_MS = 60_000;

export type ProbeResult = {
  ok: boolean;
  linkContract?: number;
  deploymentId?: string;
  error?: string;
};

/**
 * Probe one domain's deployment.
 *
 * Matches on the JSON body, never the status code — a stale deployment
 * answers 200 with HTML for /api/app-health just as it does for every other
 * unknown path.
 */
export async function probeAppDomain(domain: string): Promise<ProbeResult> {
  const url = `https://${domain}/api/app-health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      // The tell-tale of a stale build: HTML where JSON should be.
      return { ok: false, error: `non-JSON response (${contentType || "no content-type"})` };
    }

    const body: any = await res.json();
    if (body?.service !== "garage-web" || body?.ok !== true) {
      return { ok: false, error: "unrecognised health payload" };
    }

    const linkContract = Number(body.linkContract ?? 0);
    if (!Number.isFinite(linkContract) || linkContract < MIN_LINK_CONTRACT) {
      return {
        ok: false,
        linkContract,
        deploymentId: body.deploymentId || undefined,
        error: `linkContract ${linkContract} < ${MIN_LINK_CONTRACT} (stale deployment)`,
      };
    }

    return {
      ok: true,
      linkContract,
      deploymentId: body.deploymentId || undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.name === "AbortError" ? "timeout" : err?.message || "probe failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Is the probe trustworthy right now?
 *
 * The canonical origin is used as a control. If /api/app-health does not
 * answer there, the probe cannot distinguish "this domain is stale" from
 * "the endpoint is not deployed anywhere yet" or "Vercel is having an
 * outage" — and demoting on that guess would strip every office of its
 * branded links at once.
 *
 * So the gate arms itself: no verdict is ever written while the control is
 * down. That makes the rollout order-independent — ship the backend first and
 * it simply idles until the frontend build that answers the probe is live.
 */
async function isProbeArmed(): Promise<boolean> {
  const host = hostOf(CANONICAL_APP_ORIGIN);
  if (!host) return false;
  const control = await probeAppDomain(host);
  if (!control.ok) {
    console.warn(
      `[AppDomainHealth] control probe on ${host} failed (${control.error}) — skipping sweep, no domain demoted`
    );
  }
  return control.ok;
}

/**
 * Probe every verified app domain and persist the verdict.
 *
 * Shop domains are skipped — they are served by a different Vercel project
 * and never carry office links.
 */
export async function sweepAppDomainHealth(): Promise<{
  checked: number;
  unhealthy: string[];
  skipped?: boolean;
}> {
  if (!(await isProbeArmed())) {
    return { checked: 0, unhealthy: [], skipped: true };
  }

  const orgs = await Organization.find({
    customAppDomains: { $elemMatch: { verified: true } },
  }).select("_id name customAppDomains");

  let checked = 0;
  const unhealthy: string[] = [];

  for (const org of orgs) {
    let dirty = false;

    for (const entry of (org as any).customAppDomains || []) {
      if (!entry.verified) continue;
      if ((entry.kind || "app") !== "app") continue;

      const result = await probeAppDomain(entry.domain);
      checked++;

      const prevFailures = entry.appHealth?.failures || 0;
      const failures = result.ok ? 0 : prevFailures + 1;
      const ok = result.ok ? true : failures < FAILURES_TO_DEMOTE;

      entry.appHealth = {
        ok,
        checkedAt: new Date(),
        linkContract: result.linkContract,
        deploymentId: result.deploymentId,
        error: result.ok ? undefined : result.error,
        failures,
      };
      dirty = true;

      if (!ok) {
        unhealthy.push(entry.domain);
        console.warn(
          `[AppDomainHealth] ${entry.domain} (${org.name}) unhealthy: ${result.error} — links fall back to ${CANONICAL_APP_ORIGIN}`
        );
      }
    }

    if (dirty) {
      org.markModified("customAppDomains");
      await org.save();
      originCache.delete(String(org._id));
    }
  }

  console.log(
    `[AppDomainHealth] swept ${checked} domain(s), ${unhealthy.length} unhealthy`
  );
  return { checked, unhealthy };
}

/**
 * Re-probe one domain immediately and persist the verdict. Called after a
 * founder verifies a domain, so a good domain is usable for links at once
 * instead of waiting up to a sweep interval.
 */
export async function refreshDomainHealth(
  orgId: string,
  domain: string
): Promise<ProbeResult> {
  const org = await Organization.findById(orgId).select("customAppDomains");
  if (!org) return { ok: false, error: "org not found" };

  const entry = (org as any).customAppDomains?.find(
    (d: any) => d.domain.toLowerCase() === domain.toLowerCase()
  );
  if (!entry) return { ok: false, error: "domain not found" };

  // Same self-arming guard as the sweep: never demote a domain on the word of
  // a probe that cannot even reach the control host.
  if (!(await isProbeArmed())) {
    return { ok: true, error: "probe unarmed — verdict skipped" };
  }

  const result = await probeAppDomain(entry.domain);
  entry.appHealth = {
    ok: result.ok,
    checkedAt: new Date(),
    linkContract: result.linkContract,
    deploymentId: result.deploymentId,
    error: result.ok ? undefined : result.error,
    failures: result.ok ? 0 : (entry.appHealth?.failures || 0) + 1,
  };
  org.markModified("customAppDomains");
  await org.save();
  originCache.delete(String(orgId));

  return result;
}

export type ShareOrigin = {
  origin: string;
  /** The office domain used, or null when falling back. */
  domain: string | null;
  /** Why the office's own domain was not used, when it was not. */
  reason?: string;
};

/**
 * The origin an office's PUBLIC links must be built on.
 *
 * Preference order: primary healthy app domain → any healthy app domain →
 * CANONICAL_APP_ORIGIN. `appHealth.ok === false` is the only thing that
 * disqualifies a verified domain; an unprobed domain (ok == null) is still
 * trusted, so this can ship without waiting for a first sweep.
 */
export async function resolveShareOrigin(orgId: string): Promise<ShareOrigin> {
  // The platform org is pinned to the canonical host — see
  // CANONICAL_ORIGIN_ORG_IDS. Checked before the cache and before any DB read
  // so it cannot be defeated by a stale entry.
  if (CANONICAL_ORIGIN_ORG_IDS.has(String(orgId))) {
    return {
      origin: CANONICAL_APP_ORIGIN,
      domain: null,
      reason: "platform org — canonical origin pinned",
    };
  }

  const cached = originCache.get(orgId);
  if (cached && Date.now() - cached.at < ORIGIN_CACHE_TTL_MS) {
    return { origin: cached.origin, domain: hostOf(cached.origin) };
  }

  const org = await Organization.findById(orgId).select("customAppDomains parent");
  if (!org || (org as any).parent) {
    const result: ShareOrigin = {
      origin: CANONICAL_APP_ORIGIN,
      domain: null,
      reason: (org as any)?.parent
        ? "parent org uses canonical origin"
        : "org not found",
    };
    originCache.set(orgId, { origin: result.origin, at: Date.now() });
    return result;
  }

  const appDomains = ((org as any).customAppDomains || []).filter(
    (d: any) => d.verified && (d.kind || "app") === "app"
  );

  const usable = appDomains.filter((d: any) => d.appHealth?.ok !== false);
  const chosen =
    usable.find((d: any) => d.isPrimary) || usable[0] || null;

  if (!chosen) {
    const blocked = appDomains
      .map((d: any) => `${d.domain}: ${d.appHealth?.error || "unhealthy"}`)
      .join("; ");
    const result: ShareOrigin = {
      origin: CANONICAL_APP_ORIGIN,
      domain: null,
      reason: blocked || "no verified app domain",
    };
    originCache.set(orgId, { origin: result.origin, at: Date.now() });
    return result;
  }

  const origin = `https://${chosen.domain}`;
  originCache.set(orgId, { origin, at: Date.now() });
  return { origin, domain: chosen.domain };
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/**
 * Cron entrypoint — invoked from src/index.ts on boot.
 */
export function startAppDomainHealthCron(
  intervalMs = 10 * 60_000
): NodeJS.Timeout {
  let inFlight = false;

  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await sweepAppDomainHealth();
    } catch (err: any) {
      console.error("[AppDomainHealth] sweep failed:", err?.message || err);
    } finally {
      inFlight = false;
    }
  };

  // First sweep shortly after boot so a stale domain stops being handed out
  // within a minute of a deploy, not ten.
  setTimeout(tick, 60_000);
  const handle = setInterval(tick, intervalMs);
  console.log(
    `[AppDomainHealth] deployment probe scheduled every ${intervalMs}ms (fallback: ${CANONICAL_APP_ORIGIN})`
  );
  return handle;
}
