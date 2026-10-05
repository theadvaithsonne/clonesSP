/**
 * Plain-text normalization for user-authored content that is rendered as text,
 * never as markup.
 *
 * Reviews are shown in the community feed, on Discover cards and on public
 * guest pages. Unlike feed posts (which are deliberately rich HTML), a review
 * body has no formatting affordance, so the safe move is to reject markup at
 * the boundary rather than rely on every downstream renderer escaping it.
 *
 * This is defence in depth, not a substitute for escaping on output.
 */

// Matches a tag-like construct: <script>, </div>, <img src=x onerror=y>.
const TAG_LIKE = /<[^>]*>/g;

/**
 * C0/C1 control characters (keeping \n and \t), zero-width characters, and
 * bidi override/isolate characters — the last of these can visually reorder
 * a review so the rendered text differs from the stored text.
 *
 * Built from escape sequences rather than literals so the source stays
 * readable and greppable.
 */
const CONTROL_AND_INVISIBLE = new RegExp(
  "[" +
    "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" + // C0 + DEL
    "\\u0080-\\u009F" + // C1
    "\\u200B-\\u200F" + // zero-width space/joiner, LTR/RTL marks
    "\\u202A-\\u202E" + // bidi embedding + override
    "\\u2066-\\u2069" + // bidi isolates
    "\\uFEFF" + // BOM / zero-width no-break space
    "]",
  "g"
);

/**
 * Strip markup and invisible characters, normalize newlines and whitespace,
 * and trim. Returns a string safe to store and to render as text.
 *
 * - Collapses 3+ consecutive newlines to 2 (a paragraph break) so a review
 *   can't be used to push surrounding content off-screen.
 * - Collapses runs of spaces/tabs to a single space.
 * - Does NOT truncate. Length is enforced by the schema so an over-long body
 *   surfaces as a validation error the user can act on, rather than silent
 *   data loss.
 */
export function toPlainText(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .replace(TAG_LIKE, " ")
    .replace(CONTROL_AND_INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Same normalization, but for single-line fields (titles): newlines collapse
 * to spaces rather than paragraph breaks.
 */
export function toPlainSingleLine(input: string): string {
  return toPlainText(input).replace(/\n+/g, " ").replace(/ {2,}/g, " ").trim();
}
