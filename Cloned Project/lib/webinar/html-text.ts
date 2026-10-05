/**
 * Seller-authored product descriptions come out of a rich-text editor, so
 * `description` is an HTML fragment (`<ul><li><b>…</b></li></ul>`), not plain
 * text. Rendering it as a React child prints the tags verbatim; rendering it
 * with dangerouslySetInnerHTML would inject untrusted seller markup into the
 * webinar page. Neither is acceptable for a one- or two-line card snippet, so
 * we flatten it to text instead.
 *
 * Block-level tags become a space so `<li>A</li><li>B</li>` reads "A B"
 * rather than "AB".
 */

const BLOCK_TAGS =
  /<\/?(?:p|div|br|li|ul|ol|tr|td|th|h[1-6]|blockquote|section|article|header|footer)\b[^>]*>/gi;

const ANY_TAG = /<[^>]*>/g;

/** The handful of entities a WYSIWYG realistically emits. */
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

/**
 * Flatten an HTML fragment to a single line of plain text.
 *
 * Returns "" for empty/undefined input so callers can keep using a plain
 * truthiness check before rendering.
 */
export function htmlToPlainText(html?: string | null): string {
  if (!html) return "";
  let out = html;
  // Drop script/style bodies outright — their contents are never prose.
  out = out.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  out = out.replace(BLOCK_TAGS, " ");
  out = out.replace(ANY_TAG, "");
  out = out.replace(
    /&(?:nbsp|amp|lt|gt|quot|apos|hellip|mdash|ndash|rsquo|lsquo|ldquo|rdquo|#39);/gi,
    (m) => ENTITIES[m.toLowerCase()] ?? ENTITIES[m] ?? m,
  );
  // Numeric entities the map doesn't cover (&#8217; and friends).
  out = out.replace(/&#(\d+);/g, (_, code) =>
    String.fromCodePoint(Number(code)),
  );
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
    String.fromCodePoint(parseInt(code, 16)),
  );
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Same flattening, but block tags become NEWLINES instead of spaces.
 *
 * Use this where the whole description is shown rather than a one-line
 * snippet — a webinar blurb is usually a bulleted pitch, and collapsing it
 * into a single paragraph makes it unreadable. Render the result in a
 * container with `whitespace-pre-line` so the breaks survive.
 */
export function htmlToPlainLines(html?: string | null): string {
  if (!html) return "";
  let out = html;
  out = out.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "\n");
  out = out.replace(BLOCK_TAGS, "\n");
  out = out.replace(ANY_TAG, "");
  out = out.replace(
    /&(?:nbsp|amp|lt|gt|quot|apos|hellip|mdash|ndash|rsquo|lsquo|ldquo|rdquo|#39);/gi,
    (m) => ENTITIES[m.toLowerCase()] ?? ENTITIES[m] ?? m,
  );
  out = out.replace(/&#(\d+);/g, (_, code) =>
    String.fromCodePoint(Number(code)),
  );
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
    String.fromCodePoint(parseInt(code, 16)),
  );
  return (
    out
      // Tidy spaces around each break, then collapse blank-line runs: a
      // `</div><div>` pair would otherwise leave a gap on every line.
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
