// src/utils/requestOrg.ts
//
// Which office is this request coming from?
//
// A white-label site is served from the client's own domain but calls this API
// on Garage's host, so `Host` here is ALWAYS the API — `test.garage.app` — no
// matter which site the visitor is looking at. The only headers carrying the
// originating site are `Origin` and `Referer`, set by the browser on that
// cross-origin call, which is why they are checked first.
//
// Reading `Host` first is the bug this exists to prevent: it silently resolves
// every request to Garage, which made white-label signups join Garage HQ and
// white-label OTPs send from the Garage address.

import { Types } from "mongoose";

/** Hosts that are Garage itself and never carry a white-label org. */
function isGarageHost(host: string): boolean {
  return (
    host === "my.garage.app" ||
    host === "garage.app" ||
    host.endsWith(".garage.app") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

/** The site a request originated from, or "" when it cannot be determined. */
export function hostFromRequest(
  req: { headers?: Record<string, any> } | null | undefined
): string {
  const fromUrl = (v: unknown): string => {
    if (!v || typeof v !== "string") return "";
    try {
      return new URL(v).hostname;
    } catch {
      return "";
    }
  };

  const raw =
    fromUrl(req?.headers?.origin) ||
    fromUrl(req?.headers?.referer) ||
    (req?.headers?.["x-forwarded-host"] as string) ||
    (req?.headers?.host as string) ||
    "";

  // Strip any port, and take the first host if a proxy chained several.
  return String(raw).split(",")[0].trim().split(":")[0].toLowerCase();
}

/**
 * The white-label org this request belongs to, or null for Garage's own hosts,
 * unknown domains, or an unverified one.
 *
 * Never throws — callers use it to *enrich* behaviour, and a lookup failure
 * should fall back to the Garage default rather than break the request.
 */
export async function orgIdFromRequest(
  req: { headers?: Record<string, any> } | null | undefined
): Promise<Types.ObjectId | null> {
  try {
    const host = hostFromRequest(req);
    if (!host || isGarageHost(host)) return null;

    const { Organization } = await import("../models/organization.model");
    const org = await Organization.findOne({
      "customAppDomains.domain": host,
      "customAppDomains.verified": true,
    })
      .select("_id")
      .lean<any>();

    return org?._id || null;
  } catch {
    return null;
  }
}
