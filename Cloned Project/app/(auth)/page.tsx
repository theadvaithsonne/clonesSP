import type { Metadata } from "next";
import { headers } from "next/headers";
import { WelcomeRootClient } from "./WelcomeRootClient";

/**
 * gotobigwin.com-only social-share preview (e.g. WhatsApp link unfurling).
 *
 * Root layout's `metadata` export (app/layout.tsx) is ONE static object for
 * the entire app, my.garage.app included — this page used to be pure
 * "use client" with no way to override it per request, and all whitelabel
 * branding (getCurrentDomain/useWhitelabel) only resolves in the browser
 * after hydration, which a link-preview crawler never runs. So every share
 * of this page, on any domain, showed the generic Garage.App title.
 *
 * Deliberately scoped to gotobigwin.com only, not every whitelabel domain:
 * every other host returns `{}`, which Next.js merges with the parent
 * layout's metadata unchanged — so my.garage.app and every other office's
 * domain keep exactly the title/description they had before this file
 * existed.
 */
export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host")?.split(":")[0].toLowerCase() || "";
  if (!host.includes("gotobigwin.com")) return {};

  const title = "BAT 246 - Go To Big Win";
  const description =
    "You've been chosen. See how BAT 246 works and start earning like a pro this month.";
  const image = "/images/bat246-alan-logo.png";

  // The gold B2 coin, shared with bat246.com and yourmoneyback.info —
  // app/favicon.ico is one global file for every route/domain, same problem
  // as the title above, and `icons` here overrides it for this route the
  // same way `openGraph`/`twitter` override the title.
  const favicon = "/images/bat246-favicon-b2.png";

  return {
    title,
    description,
    icons: { icon: favicon, shortcut: favicon, apple: favicon },
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function AuthRootPage() {
  return <WelcomeRootClient />;
}
