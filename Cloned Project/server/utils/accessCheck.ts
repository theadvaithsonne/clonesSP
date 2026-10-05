/**
 * Check if a membership has founder-level access.
 * Returns true for actual founders OR stakeholders with fullAccess granted by admin.
 */
export function hasFounderAccess(membership: {
  role?: string | null;
  fullAccess?: boolean;
}): boolean {
  return membership?.role === "founder" || membership?.fullAccess === true;
}
