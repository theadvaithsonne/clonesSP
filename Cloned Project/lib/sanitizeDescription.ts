import DOMPurify from "dompurify";

/**
 * Sanitize an org-author-written rich-text description (course / channel /
 * service / event etc.) for safe `dangerouslySetInnerHTML` render on a
 * themed surface.
 *
 * Why we strip `style` and `class`: descriptions are routinely pasted in
 * from Apple Notes, Word, Google Docs, or a third-party rich-text editor.
 * Those sources emit markup like:
 *
 *   <ol class="ol1" style="color: rgb(0, 0, 0); font-size: 13px; ...">
 *     <li class="li1" style="font-family: 'Helvetica Neue'; ...">...</li>
 *   </ol>
 *
 * On a dark checkout card the inline `color: rgb(0, 0, 0)` renders the
 * text invisible (black on dark), and the inline `font-size` / `font-
 * family` overrides our Tailwind classes. Killing `style` + `class` keeps
 * the structural tags (<ol>, <li>, <b>, <em>, <u>, <p>, <a>, ...) so the
 * page's Tailwind arbitrary-variant selectors ([&_ol]:list-decimal etc)
 * actually win and the description renders in-theme.
 *
 * Also strips MS Office / Apple Notes wrapper junk (<o:p>, <w:*>,
 * conditional comments) by way of DOMPurify's default allow-list.
 *
 * Link normalization: any <a href> that is missing a protocol (e.g.
 * "www.google.com") is prefixed with "https://" so it opens as an
 * external absolute URL rather than a relative path on the current site.
 * All anchors are given target="_blank" and rel="noopener noreferrer".
 *
 * Caller is responsible for `"use client"` — DOMPurify needs DOMParser.
 */
export function sanitizeDescription(html: string): string {
  // SSR guard: DOMPurify v3 reaches for window.DOMParser. Client
  // components still render once on the server before hydration; if
  // course.description happens to be available during that pass
  // (e.g. a future server-fetched variant) the sanitize would throw
  // and the whole node would render empty. Returning the raw HTML on
  // the server is fine — hydration will re-run on the client and the
  // sanitized version replaces it before any user interaction.
  if (typeof window === "undefined") return html;

  const clean = DOMPurify.sanitize(html, {
    FORBID_ATTR: ["style", "class"],
    // Anchors get target=_blank treatment below; keep href / target / rel
    // passthrough so authored links survive.
    ADD_ATTR: ["target", "rel"],
  });

  // Post-process: normalize anchor hrefs and ensure external target
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(clean, "text/html");
    doc.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (href) {
        // Prefix bare URLs (no protocol) with https://
        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !/^#/.test(href)) {
          a.setAttribute("href", `https://${href}`);
        }
      }
      // Always open links in a new tab
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    return doc.body.innerHTML;
  } catch {
    return clean;
  }
}
