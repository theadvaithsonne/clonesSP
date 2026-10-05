import { api } from "@/lib/api";

/**
 * Affiliate attribution for anything the user shares.
 *
 * Every share URL the product hands out carries `?ref=<affiliateId>` so a
 * signup that starts from that link is credited back to the sharer. The id is
 * the *copier's* own, never the id a visitor arrived with — see the same rule
 * in `app/webinar/[id]/WebinarRoomClient.tsx`.
 */

/**
 * The signed-in user's affiliate id, or "" when they have none (guests,
 * accounts created before affiliates existed, or a backend that is down).
 * Callers treat "" as "share the plain link" rather than as an error.
 */
export async function fetchMyAffiliateId(): Promise<string> {
  try {
    const res = await api<{ success: boolean; affiliateId?: string }>(
      "/affiliate/my-affiliate-id",
    );
    return res.success && res.affiliateId ? res.affiliateId : "";
  } catch {
    return "";
  }
}

/**
 * Adds (or replaces) the `ref` parameter on a share URL. Replacing rather than
 * appending matters: a link fetched back from the backend may already carry
 * someone else's ref, and two `ref` values in one URL is undefined behaviour.
 */
export function withAffiliateRef(url: string, affiliateId?: string): string {
  if (!url || !affiliateId) return url;
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : undefined);
    parsed.searchParams.set("ref", affiliateId);
    return parsed.toString();
  } catch {
    // Relative or otherwise unparseable — fall back to plain string surgery.
    const [base, hash] = url.split("#");
    const joiner = base.includes("?") ? "&" : "?";
    const stripped = base.replace(/([?&])ref=[^&]*&?/g, "$1").replace(/[?&]$/, "");
    const next = `${stripped}${stripped.includes("?") ? "&" : joiner === "?" ? "?" : "&"}ref=${encodeURIComponent(affiliateId)}`;
    return hash ? `${next}#${hash}` : next;
  }
}

/** Clipboard write that reports its own failure — permissions can deny it. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
