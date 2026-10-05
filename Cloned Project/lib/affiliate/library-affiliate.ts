/**
 * The affiliate identity the ADMIN funnel library is authored under.
 *
 * Funnel CTAs normally store identity only (itemType/itemId/orgSlug) and the
 * viewing affiliate's own ref is applied at render. "General" platform links
 * are the exception: they have no resolvable item, so the picker stores a
 * pre-built href with an affiliate id baked into it
 * (e.g. networkchains.com/register/<affiliateId>). Once saved it never changes
 * hands, so in the library it must not be whichever admin did the editing —
 * every affiliate adopts these templates.
 *
 * RESOLVED, not configured. The backend derives it from the garage super-admin
 * role rather than storing a literal, so it follows a change of super admin or
 * a reissued affiliate id on its own. Pinning the value here (or in an env
 * var) would go stale silently and keep sending everyone's traffic to a dead
 * identity.
 */

import { garageAdminApi } from "@/lib/api";

export interface LibraryAffiliate {
  /** Null when the super-admin role has no holder, or that admin has no user
   *  row. Callers must then author the link with NO ref — never fall back to
   *  the signed-in admin, which is the bug this whole path exists to avoid. */
  affiliateId: string | null;
  email: string | null;
}

export async function fetchLibraryAffiliate(): Promise<LibraryAffiliate> {
  const res = await garageAdminApi<{
    success: boolean;
    affiliateId: string | null;
    email: string | null;
  }>("/garage-admin/library-affiliate");
  return { affiliateId: res.affiliateId ?? null, email: res.email ?? null };
}
