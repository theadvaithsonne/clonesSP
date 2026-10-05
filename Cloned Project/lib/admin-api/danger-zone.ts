import { garageAdminApi } from "@/lib/api";

/**
 * Destructive super-admin operations for the admin tables.
 *
 * Every delete here is permanent and cascades nothing. Neither User nor
 * Organization has a soft-delete field, and the records that point at them —
 * invoices, wallets, subscriptions — deliberately survive, because financial
 * history has to outlive the account it belonged to.
 *
 * That's why the flow is preview-then-confirm rather than a single call: the
 * preview is what tells the operator how much will be left orphaned, and the
 * confirmation string is re-checked server-side so a mis-selected row can't
 * be deleted by clicking through a dialog.
 */

export interface DependentCount {
  label: string;
  count: number;
  /** Count hit the server's 10,000 cap — the real figure is higher. */
  capped: boolean;
}

export interface UserDeletePreview {
  success: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    isVerified: boolean;
    profileComplete: boolean;
    organizations: number;
    createdAt: string;
  };
  dependents: DependentCount[];
  totalDependents: number;
  countsCapped: boolean;
  cascades: boolean;
}

export interface OrgDeletePreview {
  success: boolean;
  organization: {
    id: string;
    name: string | null;
    slug: string | null;
    createdAt: string;
  };
  dependents: DependentCount[];
  totalDependents: number;
  countsCapped: boolean;
  /** Members whose embedded membership will be detached. */
  members: number;
  cascades: boolean;
}

export function getUserDeletePreview(userId: string) {
  return garageAdminApi<UserDeletePreview>(
    `/garage-admin/users/${userId}/delete-preview`
  );
}

/**
 * Delete a user. `confirm` must match the account's email; for the many broken
 * signups that have no email it must match the name, or be the literal
 * "DELETE" when there's neither. Sent as `confirmEmail` (the server reads that
 * field or `confirm`) and re-checked server-side against whichever applies.
 */
export function deleteAdminUser(userId: string, confirm: string) {
  return garageAdminApi<{ success: boolean }>(`/garage-admin/users/${userId}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmEmail: confirm }),
  });
}

export function getOrgDeletePreview(orgId: string) {
  return garageAdminApi<OrgDeletePreview>(
    `/garage-admin/organizations/${orgId}/delete-preview`
  );
}

/** `confirmName` must match the company's name — the server re-checks it. */
export function deleteAdminOrganization(orgId: string, confirmName: string) {
  return garageAdminApi<{ success: boolean; membersDetached: number }>(
    `/garage-admin/organizations/${orgId}`,
    { method: "DELETE", body: JSON.stringify({ confirmName }) }
  );
}

/**
 * Clear a user's phone number and drop `phoneVerified` back to false.
 *
 * Recoverable, unlike the deletes above — the user can verify a number again —
 * so there's no typed confirmation. The two fields always move together: a
 * cleared number that stayed "verified" would mark an account as having
 * verified a number it no longer has.
 */
export function removeUserPhone(userId: string) {
  return garageAdminApi<{
    success: boolean;
    user: {
      id: string;
      email: string | null;
      phone: null;
      phoneVerified: false;
    };
    /** The number that was removed, for the confirmation toast. */
    removed: string | null;
  }>(`/garage-admin/users/${userId}/phone`, { method: "DELETE" });
}

/**
 * Set or clear a user's email verification by hand.
 *
 * Normally `isVerified` flips itself the first time the user completes an email
 * OTP login. This is the override for accounts that can't get there — a bouncing
 * mailbox, an imported record, support confirming an address out of band.
 *
 * Reversible both ways, so no typed confirmation. It grants nothing: login still
 * requires an OTP every time, so this only reflects the address as confirmed.
 */
export function setUserEmailVerified(userId: string, verified: boolean) {
  return garageAdminApi<{
    success: boolean;
    user: { id: string; email: string | null; isVerified: boolean };
  }>(`/garage-admin/users/${userId}/email-verification`, {
    method: "PATCH",
    body: JSON.stringify({ verified }),
  });
}

/**
 * Set or clear a user's phone verification by hand.
 *
 * Manual override for admins when confirming a phone number out of band.
 */
export function setUserPhoneVerified(userId: string, verified: boolean) {
  return garageAdminApi<{
    success: boolean;
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      phoneVerified: boolean;
    };
  }>(`/garage-admin/users/${userId}/phone-verification`, {
    method: "PATCH",
    body: JSON.stringify({ verified }),
  });
}

export interface CompleteProfileInput {
  name?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  /**
   * Opt in to stamping `profileCompletedAt`, which opens the user's 24-hour
   * free-first-cycle window. Off by default: completing someone's address
   * shouldn't silently start a commercial clock. Ignored if already stamped —
   * nobody gets a second window.
   */
  startOfferWindow?: boolean;
}

export function completeUserProfile(userId: string, input: CompleteProfileInput) {
  return garageAdminApi<{
    success: boolean;
    user: {
      id: string;
      email: string;
      phone?: string | null;
      phoneVerified?: boolean;
      profileComplete: boolean;
      profileCompletedAt: string | null;
      offerWindowStarted: boolean;
    };
  }>(`/garage-admin/users/${userId}/complete-profile`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

