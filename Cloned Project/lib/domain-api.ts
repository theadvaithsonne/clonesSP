// lib/domain-api.ts
// Domain reseller API client

import { api } from "./api";

// ============ Types ============

export interface DomainAvailability {
  domainName: string;
  available: boolean;
  premium: boolean;
  purchasePrice?: number;
  renewalPrice?: number;
  retailPrice?: number;
  retailRenewalPrice?: number;
}

export interface DomainSearchResult {
  success: boolean;
  results: DomainAvailability[];
}

export interface DomainPricing {
  domainName: string;
  purchasePrice: number;
  renewalPrice: number;
  transferPrice: number;
  wholesalePurchasePrice: number;
  wholesaleRenewalPrice: number;
  premium: boolean;
}

export interface DomainContact {
  firstName: string;
  lastName: string;
  companyName?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  fax?: string;
  email: string;
}

export interface DnsRecord {
  id?: number;
  host: string;
  type: "A" | "AAAA" | "ANAME" | "CNAME" | "MX" | "NS" | "SRV" | "TXT" | "CAA";
  answer: string;
  ttl: number;
  priority?: number;
}

export interface Domain {
  _id: string;
  userId: string;
  orgId: string;
  domainName: string;
  tld: string;
  status: "pending" | "active" | "expired" | "transferred" | "cancelled" | "failed";
  registeredAt?: string;
  expiresAt?: string;
  autoRenew: boolean;
  locked: boolean;
  nameservers: string[];
  contacts: {
    registrant: DomainContact;
    admin: DomainContact;
    tech: DomainContact;
    billing: DomainContact;
  };
  purchasePrice: number;
  costPrice: number;
  renewalPrice: number;
  currency: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  dnsRecords: DnsRecord[];
  premium: boolean;
  years: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseDomainOptions {
  domainName: string;
  years?: number;
  contacts: {
    registrant: DomainContact;
    admin?: DomainContact;
    tech?: DomainContact;
    billing?: DomainContact;
  };
  nameservers?: string[];
  autoRenew?: boolean;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

// ============ Search & Pricing ============

/**
 * Search for domain availability
 */
export async function searchDomains(domains: string[]): Promise<DomainSearchResult> {
  return api<DomainSearchResult>("/domains/search", {
    method: "POST",
    body: JSON.stringify({ domains }),
  });
}

/**
 * Get domain suggestions based on keyword
 */
export async function getDomainSuggestions(
  keyword: string,
  tlds?: string[]
): Promise<DomainSearchResult> {
  return api<DomainSearchResult>("/domains/suggestions", {
    method: "POST",
    body: JSON.stringify({ keyword, tlds }),
  });
}

/**
 * Get pricing for a specific domain
 */
export async function getDomainPricing(
  domain: string
): Promise<{ success: boolean; pricing: DomainPricing }> {
  return api<{ success: boolean; pricing: DomainPricing }>(
    `/domains/pricing/${encodeURIComponent(domain)}`
  );
}

// ============ Purchase ============

/**
 * Initialize domain purchase - returns Razorpay order
 */
export async function purchaseDomain(
  options: PurchaseDomainOptions
): Promise<{
  success: boolean;
  domain: { _id: string; domainName: string; years: number; purchasePrice: number; currency: string };
  razorpayOrder: RazorpayOrder;
}> {
  return api("/domains/purchase", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

/**
 * Verify payment and complete domain registration
 */
export async function verifyDomainPayment(data: {
  domainId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{
  success: boolean;
  domain: Domain;
}> {
  return api("/domains/verify-payment", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============ Domain Management ============

/**
 * List user's domains
 */
export async function listDomains(): Promise<{ success: boolean; domains: Domain[] }> {
  return api<{ success: boolean; domains: Domain[] }>("/domains");
}

/**
 * Get domain details
 */
export async function getDomain(domainId: string): Promise<{ success: boolean; domain: Domain }> {
  return api<{ success: boolean; domain: Domain }>(`/domains/${domainId}`);
}

/**
 * Sync domain with Name.com
 */
export async function syncDomain(domainId: string): Promise<{ success: boolean; domain: Domain }> {
  return api<{ success: boolean; domain: Domain }>(`/domains/${domainId}/sync`, {
    method: "POST",
  });
}

// ============ DNS Management ============

/**
 * Get DNS records for a domain
 */
export async function getDnsRecords(
  domainId: string
): Promise<{ success: boolean; records: DnsRecord[] }> {
  return api<{ success: boolean; records: DnsRecord[] }>(`/domains/${domainId}/dns`);
}

/**
 * Create DNS record
 */
export async function createDnsRecord(
  domainId: string,
  record: Omit<DnsRecord, "id">
): Promise<{ success: boolean; record: DnsRecord }> {
  return api<{ success: boolean; record: DnsRecord }>(`/domains/${domainId}/dns`, {
    method: "POST",
    body: JSON.stringify(record),
  });
}

/**
 * Update DNS record
 */
export async function updateDnsRecord(
  domainId: string,
  recordId: number,
  record: Partial<Omit<DnsRecord, "id" | "type">>
): Promise<{ success: boolean; record: DnsRecord }> {
  return api<{ success: boolean; record: DnsRecord }>(`/domains/${domainId}/dns/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

/**
 * Delete DNS record
 */
export async function deleteDnsRecord(
  domainId: string,
  recordId: number
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/domains/${domainId}/dns/${recordId}`, {
    method: "DELETE",
  });
}

// ============ Domain Settings ============

/**
 * Update nameservers
 */
export async function updateNameservers(
  domainId: string,
  nameservers: string[]
): Promise<{ success: boolean; nameservers: string[] }> {
  return api<{ success: boolean; nameservers: string[] }>(`/domains/${domainId}/nameservers`, {
    method: "POST",
    body: JSON.stringify({ nameservers }),
  });
}

/**
 * Toggle auto-renew
 */
export async function setAutoRenew(
  domainId: string,
  enabled: boolean
): Promise<{ success: boolean; autoRenew: boolean }> {
  return api<{ success: boolean; autoRenew: boolean }>(`/domains/${domainId}/autorenew`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

/**
 * Lock/unlock domain
 */
export async function setDomainLock(
  domainId: string,
  locked: boolean
): Promise<{ success: boolean; locked: boolean }> {
  return api<{ success: boolean; locked: boolean }>(`/domains/${domainId}/lock`, {
    method: "POST",
    body: JSON.stringify({ locked }),
  });
}

/**
 * Get auth code for transfer
 */
export async function getAuthCode(
  domainId: string
): Promise<{ success: boolean; authCode: string }> {
  return api<{ success: boolean; authCode: string }>(`/domains/${domainId}/authcode`);
}

// ============ Renewal ============

/**
 * Initialize domain renewal - returns Razorpay order
 */
export async function renewDomain(
  domainId: string,
  years: number = 1
): Promise<{
  success: boolean;
  renewal: { domainName: string; years: number; price: number; currency: string };
  razorpayOrder: RazorpayOrder;
}> {
  return api(`/domains/${domainId}/renew`, {
    method: "POST",
    body: JSON.stringify({ years }),
  });
}

/**
 * Verify renewal payment
 */
export async function verifyRenewalPayment(
  domainId: string,
  data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    years: number;
  }
): Promise<{ success: boolean; domain: Domain }> {
  return api(`/domains/${domainId}/verify-renewal`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============ Utility Functions ============

/**
 * Parse domain name into name and TLD
 */
export function parseDomainName(domain: string): { name: string; tld: string } {
  const parts = domain.toLowerCase().trim().split(".");
  if (parts.length < 2) {
    return { name: domain, tld: "" };
  }
  const name = parts[0];
  const tld = parts.slice(1).join(".");
  return { name, tld };
}

/**
 * Format price with currency
 */
export function formatDomainPrice(price: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price);
}

/**
 * Calculate days until expiration
 */
export function getDaysUntilExpiry(expiresAt: string): number {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get status color for domain status
 */
export function getDomainStatusColor(
  status: Domain["status"]
): "green" | "yellow" | "red" | "gray" {
  switch (status) {
    case "active":
      return "green";
    case "pending":
      return "yellow";
    case "expired":
    case "failed":
      return "red";
    default:
      return "gray";
  }
}

/**
 * Popular TLDs for suggestions
 */
export const POPULAR_TLDS = [
  ".com",
  ".net",
  ".org",
  ".io",
  ".co",
  ".app",
  ".dev",
  ".ai",
  ".tech",
  ".online",
  ".store",
  ".shop",
  ".site",
  ".xyz",
  ".info",
];

/**
 * Generate domain variations for search
 */
export function generateDomainVariations(keyword: string, tlds: string[] = POPULAR_TLDS): string[] {
  const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return tlds.map((tld) => `${cleanKeyword}${tld}`);
}
