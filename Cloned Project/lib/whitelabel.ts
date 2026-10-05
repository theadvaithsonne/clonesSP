import { API_URL } from "./api";
import { ADMIN_APP_DOMAIN } from "./admin-domain";

export interface WhitelabelOrgData {
  orgId: string;
  orgName: string;
  orgIcon: string | null;
  primaryColor: string;
  secondaryColor: string;
  coverPhoto: string | null;
  /** False when the office's white-label add-on has lapsed. */
  whitelabelActive: boolean;
}

export interface WhitelabelConfig {
  isWhitelabel: boolean;
  domain: string;
  orgId: string | null;
  orgName: string | null;
  orgIcon: string | null;
  primaryColor: string;
  secondaryColor: string;
  coverPhoto: string | null;
  /** False when the office's white-label add-on has lapsed. */
  whitelabelActive: boolean;
  isLoading: boolean;
  error: string | null;
}

// Main Garage app domain
export const MAIN_APP_DOMAIN = "my.garage.app";

// Garage's own back-office subdomain. Listed alongside the main app below
// because it is OURS, not a customer's: without it the check treats any host
// that isn't my.garage.app as a white-label domain and would send the admin
// panel off to look itself up as somebody's office.
export { ADMIN_APP_DOMAIN };

/**
 * Get the current domain with support for local testing.
 * For local testing, uncomment the return statement below and set your test domain.
 */
export function getCurrentDomain(): string {
  // LOCAL TESTING: Uncomment the line below to test whitelabel. Comment it out for production.
  return "bat246.com";

  if (typeof window === "undefined") return "";
  return window.location.hostname;
}

/**
 * Check if current domain is a whitelabel domain.
 * Returns false for: my.garage.app, localhost, 127.0.0.1
 */
export function isWhitelabelDomain(domain: string): boolean {
  if (!domain) return false;

  const mainDomains = [
    MAIN_APP_DOMAIN,
    ADMIN_APP_DOMAIN,
    "localhost",
    "127.0.0.1",
  ];

  return !mainDomains.some(
    (mainDomain) => domain === mainDomain || domain.endsWith(`.${mainDomain}`)
  );
}

/**
 * Fetch whitelabel organization data from backend.
 * Returns null if domain is not found or not verified.
 */
export async function fetchWhitelabelOrg(
  domain: string
): Promise<WhitelabelOrgData | null> {
  try {
    const response = await fetch(
      `${API_URL}/initial-setup/lookup-app-domain?domain=${encodeURIComponent(
        domain
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      return null;
    }

    return {
      orgId: data.orgId,
      orgName: data.orgName,
      orgIcon: data.orgIcon,
      primaryColor: data.primaryColor || "#FBD10D",
      // Falls back to the primary: a one-colour brand should render flat,
      // not as a gradient into Garage yellow.
      secondaryColor: data.secondaryColor || data.primaryColor || "#FBD10D",
      // Absent on an older backend — assume active, so a deploy skew can
      // never lock out a paying office.
      whitelabelActive: data.whitelabelActive !== false,
      coverPhoto: data.coverPhoto || null,
    };
  } catch (error) {
    console.error("Error fetching whitelabel org:", error);
    return null;
  }
}
