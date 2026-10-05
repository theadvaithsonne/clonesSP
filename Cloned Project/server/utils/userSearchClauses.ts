/**
 * The `$or` clauses for "find a user by what someone typed".
 *
 * Phone is a login identity now, not just a contact field, so every surface
 * that finds people by email has to find them by number too — otherwise an
 * admin can see an account exists but cannot search for it by the thing the
 * user actually signed in with.
 *
 * Numbers are stored E.164 (`+919876543210`), which is NOT how people type
 * them. A bare `98765 43210`, or `(647) 559-0183`, matches nothing under a
 * plain regex. So a query containing digits also gets a digits-only clause
 * that ignores the formatting on both sides.
 */

/** Query strings are user-controlled and go straight into a RegExp. */
export function escapeRegex(s: string): string {
  return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Clauses matching `q` against name, email and phone.
 *
 * @param extraFields additional field names to match with the same regex
 *   (e.g. "affiliateId", "city") — keeps call sites that search more than the
 *   standard three from having to rebuild the array by hand.
 */
export function userSearchClauses(q: string, extraFields: string[] = []): any[] {
  const term = String(q ?? "").trim();
  if (!term) return [];
  const rx = new RegExp(escapeRegex(term), "i");

  const clauses: any[] = [{ name: rx }, { email: rx }, { phone: rx }];
  for (const f of extraFields) clauses.push({ [f]: rx });

  // "98765 43210" and "+91-98765-43210" both reduce to the same digits as the
  // stored "+919876543210". Four is the shortest run worth matching on — below
  // that almost every number in the database matches.
  const digits = term.replace(/\D/g, "");
  if (digits.length >= 4 && digits !== term) {
    clauses.push({ phone: new RegExp(escapeRegex(digits), "i") });
  }
  return clauses;
}

/** Convenience for `filter.$or = ...` call sites. */
export function userSearchOr(q: string, extraFields: string[] = []) {
  return { $or: userSearchClauses(q, extraFields) };
}
