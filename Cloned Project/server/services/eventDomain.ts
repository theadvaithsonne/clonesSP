// src/services/eventDomain.ts
//
// Hostname hygiene for event custom domains.
//
// Attaching and verifying a domain is the org-wide app-domain flow in
// routes/initialSetup.ts — the same one whitelabel uses, which registers the
// host with Vercel so a certificate is issued. This module only holds the one
// rule that is specific to events: the host must not be one of ours.

/**
 * Hostnames we will never serve for someone else.
 *
 * An event pointed at the app's own domain would shadow the real app for
 * every visitor, so those are rejected outright rather than left to DNS.
 */
function reservedHost(host: string): boolean {
  const reserved = [
    "garage.app",
    "my.garage.app",
    "admin.garage.app",
    "localhost",
  ];
  const appHost = (process.env.APP_URL || "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase();
  if (appHost) reserved.push(appHost);
  return reserved.includes(host) || host.endsWith(".vercel.app");
}

/**
 * Normalise and sanity-check what the organizer typed.
 *
 * Accepts a bare host; strips a scheme, path, port or trailing dot if they
 * paste a URL, which they usually do.
 */
export function normaliseHost(
  input: string
): { ok: true; host: string } | { ok: false; error: string } {
  let host = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "");

  if (!host) return { ok: false, error: "Enter a domain" };
  if (host.length > 253) return { ok: false, error: "That domain is too long" };

  // Letters, digits and hyphens per label; at least one dot; no leading or
  // trailing hyphen. Deliberately strict — a host we can't resolve is a host
  // we can't verify.
  const valid = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
  if (!valid.test(host))
    return { ok: false, error: "That doesn't look like a domain" };

  if (reservedHost(host))
    return { ok: false, error: "That domain is reserved" };

  return { ok: true, host };
}

// Everything below this point used to live here — DNS record templates and a
// hand-rolled TXT/CNAME check. It was deleted in favour of the org-wide
// app-domain flow in routes/initialSetup.ts, which attaches the host to the
// Vercel project and therefore actually gets a certificate issued. Only the
// hostname hygiene above is still ours, because event domains have one extra
// rule: they must never shadow the app's own host.
