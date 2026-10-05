// lib/favicon.ts
export function domainFromUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url;
  }
}

export function faviconCandidates(url: string, size = 64) {
  const domain = domainFromUrl(url);
  // Order: DuckDuckGo → Google S2 → site /favicon.ico
  return [
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`,
    // fallback to origin's default favicon
    `https://${domain}/favicon.ico`,
  ];
}
