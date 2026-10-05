import type { NextRequest } from "next/server";

/**
 * Link-preview card for bat246.com — what WhatsApp, iMessage, Telegram etc.
 * show when a bat246.com URL is shared: "BAT 246", bat246.com and the logo,
 * nothing else.
 *
 * The root layout's metadata is one static object ("Garage.App - Ai Operating
 * System for startups") for every domain, and making it read the Host header
 * would turn every statically built page in the app dynamic. So middleware.ts
 * rewrites only link-preview crawlers on bat246.com to this handler; people
 * visiting the site never reach it.
 */

const TITLE = "BAT 246";
/**
 * The bat246.com favicon (BAT246_LOGO_SRC) as a JPEG, so the card and the
 * browser tab show the same mark. 512×512, small enough for WhatsApp.
 */
const IMAGE_PATH = "/images/bat246-share-icon.jpg";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function GET(request: NextRequest) {
  const host = (request.headers.get("host") || "bat246.com").split(":")[0];
  const origin = `https://${host}`;
  // The path the crawler actually asked for, so og:url is the shared link.
  // Set by middleware.ts.
  const rawPath = request.headers.get("x-link-preview-path") || "/";
  const path = rawPath.startsWith("/") ? rawPath : "/";
  const url = escapeAttr(`${origin}${path}`);
  const image = escapeAttr(`${origin}${IMAGE_PATH}`);

  // No description tags on purpose: the card is the title, domain and logo.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${TITLE}</title>
<link rel="canonical" href="${url}" />
<link rel="icon" href="${escapeAttr(`${origin}/images/bat246-favicon.png`)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${TITLE}" />
<meta property="og:title" content="${TITLE}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:secure_url" content="${image}" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="512" />
<meta property="og:image:height" content="512" />
<meta property="og:image:alt" content="${TITLE}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${TITLE}" />
<meta name="twitter:image" content="${image}" />
</head>
<body><h1>${TITLE}</h1></body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
