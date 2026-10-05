// name.com domain reseller.
//
// Garage buys domains as a RESELLER and is the registrant — the founder
// leases the domain while they're on the platform. Pricing is name.com's
// cost plus NAMECOM_MARGIN_PERCENT, applied here on the server; a price
// that arrives from a client is never trusted.
//
// Purchasing sits IN FRONT of the flow that already works: once a domain is
// registered, `add-app-domain` attaches it to the right Vercel project and
// issues the DNS records. Nothing downstream of registration is new.
//
// Point NAMECOM_API_URL at https://api.dev.name.com while developing. The
// sandbox is free; against production every successful register call spends
// real money and cannot be undone.

const API_URL = process.env.NAMECOM_API_URL ?? "https://api.dev.name.com";
const USERNAME = process.env.NAMECOM_USERNAME;
const API_TOKEN = process.env.NAMECOM_API_TOKEN;

/** Reseller markup over name.com's cost, in percent. */
const MARGIN_PERCENT = Number(process.env.NAMECOM_MARGIN_PERCENT ?? 20);

export function namecomConfigured(): boolean {
  return Boolean(USERNAME && API_TOKEN);
}

/** True when pointed at the live API, where registrations cost real money. */
export function namecomIsLive(): boolean {
  return !API_URL.includes("dev.name.com");
}

function authHeader(): string {
  return (
    "Basic " + Buffer.from(`${USERNAME}:${API_TOKEN}`).toString("base64")
  );
}

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  if (!namecomConfigured()) {
    throw new Error("name.com is not configured");
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // name.com returns HTML on some auth failures; keep the raw body so the
    // log says something more useful than "unexpected token <".
  }

  if (!res.ok) {
    const detail =
      data?.message || data?.details || text.slice(0, 200) || res.statusText;
    throw new Error(`name.com ${res.status}: ${detail}`);
  }
  return data as T;
}

/** Cost in USD → what we charge, rounded up to a whole cent. */
export function applyMargin(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return 0;
  return Math.ceil(costUsd * (1 + MARGIN_PERCENT / 100) * 100) / 100;
}

export interface DomainOffer {
  domain: string;
  available: boolean;
  /** Premium domains are priced individually and often renew far higher. */
  premium: boolean;
  /** What the buyer pays, margin already applied. */
  priceUsd: number;
  /** What renewal will cost them next year, margin applied. */
  renewalUsd: number;
}

/** name.com's availability rows, normalised and priced. */
function toOffer(r: any): DomainOffer {
  const purchase = Number(r?.purchasePrice ?? 0);
  const renewal = Number(r?.renewalPrice ?? purchase);
  return {
    domain: String(r?.domainName ?? ""),
    available: Boolean(r?.purchasable),
    premium: Boolean(r?.premium),
    priceUsd: applyMargin(purchase),
    renewalUsd: applyMargin(renewal),
  };
}

/** Exact-match availability for specific domains. */
export async function checkAvailability(
  domains: string[],
): Promise<DomainOffer[]> {
  const domainNames = domains
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50);
  if (!domainNames.length) return [];

  const data = await call<{ results?: any[] }>(
    "/v4/domains:checkAvailability",
    { method: "POST", body: { domainNames } },
  );
  return (data?.results ?? []).map(toOffer);
}

/**
 * Suggestions for a keyword — what a founder actually wants when they type
 * "bigwin" rather than a full domain.
 */
export async function searchDomains(keyword: string): Promise<DomainOffer[]> {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];

  const data = await call<{ results?: any[] }>("/v4/domains:search", {
    method: "POST",
    body: { keyword: kw },
  });
  return (data?.results ?? []).map(toOffer).filter((o) => o.domain);
}

/**
 * Register a domain. SPENDS MONEY against the live API.
 *
 * `purchasePrice` is name.com's COST, not our marked-up price — it is the
 * figure name.com echoes back for confirmation, and sending our own price
 * would fail the check. Charge the buyer separately through the invoice
 * flow; this call only buys the domain.
 *
 * Deliberately not wired to any route yet: payment, refund-on-failure and
 * renewal billing all need deciding before a purchase path exists.
 */
export async function registerDomain(opts: {
  domain: string;
  costUsd: number;
  years?: number;
}): Promise<{ domain: string; expiresAt: string | null }> {
  const data = await call<any>("/v4/domains", {
    method: "POST",
    body: {
      domain: {
        domainName: opts.domain.trim().toLowerCase(),
        ...(opts.years ? { renewalPrice: undefined } : {}),
      },
      purchasePrice: opts.costUsd,
      ...(opts.years ? { years: opts.years } : {}),
    },
  });
  return {
    domain: String(data?.domain?.domainName ?? opts.domain),
    expiresAt: data?.domain?.expireDate ?? null,
  };
}
