"use client";

import { useEffect } from "react";
import {
  BAT246_DISPLAY_NAME,
  BAT246_FAVICON_SRC,
  useIsBat246Domain,
  useIsBat246Office,
} from "@/lib/bat246Office";

/**
 * Swaps the browser-tab favicon and title to BAT 246 while the session is
 * scoped to the BAT 246 office (see lib/bat246Office.ts), and on every
 * bat246.com page whether or not anyone is signed in. Renders nothing.
 *
 * Mounted in the root layout so the bat246.com login pages are covered too.
 *
 * app/favicon.ico and the root metadata title are global, so this patches the
 * <head> tags the root layout already emitted, and puts them back when the
 * user leaves the office.
 */
export default function Bat246Branding() {
  const isBat246Office = useIsBat246Office();
  const isBat246Domain = useIsBat246Domain();
  const active = isBat246Office || isBat246Domain;

  useEffect(() => {
    if (!active) return;

    const isOurs = (l: HTMLLinkElement) =>
      l.getAttribute("href") === BAT246_FAVICON_SRC;
    // What each tag held before we touched it, to put back on the way out.
    const originalHrefs = new Map<HTMLLinkElement, string>();
    let originalTitle: string | null = null;
    let added: HTMLLinkElement | null = null;

    const apply = () => {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>(
          'link[rel~="icon"], link[rel="apple-touch-icon"]',
        ),
      );
      // A page with no favicon tag at all still gets one.
      if (links.length === 0) {
        added = document.createElement("link");
        added.rel = "icon";
        added.href = BAT246_FAVICON_SRC;
        document.head.appendChild(added);
      }
      for (const l of links) {
        if (isOurs(l)) continue;
        if (!originalHrefs.has(l)) originalHrefs.set(l, l.getAttribute("href") || "");
        l.setAttribute("href", BAT246_FAVICON_SRC);
      }
      if (document.title !== BAT246_DISPLAY_NAME) {
        if (originalTitle === null) originalTitle = document.title;
        document.title = BAT246_DISPLAY_NAME;
      }
    };

    apply();
    // Next.js writes its own <title> and icon tags after hydration (streamed
    // metadata) and again on client navigations, which silently undid a
    // one-off swap. Re-apply whenever <head> changes; apply() only writes
    // when something differs, so its own writes settle immediately.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href"],
    });

    return () => {
      observer.disconnect();
      originalHrefs.forEach((href, l) => l.setAttribute("href", href));
      added?.remove();
      if (originalTitle !== null) document.title = originalTitle;
    };
  }, [active]);

  return null;
}
