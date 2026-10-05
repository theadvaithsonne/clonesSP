import { api } from "./api";

/** Map of app IDs to their SSO target app names */
export const SSO_ENABLED_APPS: Record<string, string> = {
  thoughts: "thoughts",
};

/** Check if an app supports SSO */
export function isSSOEnabled(appId: string): boolean {
  return appId in SSO_ENABLED_APPS;
}

/** Generate a one-time exchange token for iframe SSO */
export async function generateExchangeToken(targetApp: string): Promise<string> {
  const res = await api<{ exchangeToken: string }>("/sso/exchange-token", {
    method: "POST",
    body: JSON.stringify({ targetApp }),
  });
  return res.exchangeToken;
}

/** Build the SSO URL by appending the exchange token as a query param */
export function buildSSOUrl(baseUrl: string, exchangeToken: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("sso_token", exchangeToken);
  return url.toString();
}
