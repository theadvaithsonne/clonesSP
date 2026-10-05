// Single source of truth for which hostnames are the yourmoneyback.info
// custom domain — used by middleware.ts (edge-safe: no Node APIs), the
// lostmoney layout, and any lostmoney page that links to itself and needs
// to pick short branded paths (/home, /aboutus, ...) instead of the
// internal /games/bat246/lostmoney/index/* route on that domain.
export const LOSTMONEY_CUSTOM_DOMAIN_HOSTS: readonly string[] = [
  "yourmoneyback.info",
  "www.yourmoneyback.info",
];

export function isLostMoneyCustomDomainHost(host: string): boolean {
  return LOSTMONEY_CUSTOM_DOMAIN_HOSTS.includes(host.toLowerCase());
}
