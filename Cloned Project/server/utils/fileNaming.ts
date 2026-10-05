/**
 * Helpers for keeping a cabinet file's stored names in sync with what the
 * browser actually writes to disk.
 *
 * Renaming a file used to touch only `name`, while every download path read
 * `originalName`, so a renamed file still downloaded under its upload name.
 */

const FALLBACK_NAME = "download";

/**
 * The name a download should be saved as. `name` is the user-facing name and
 * wins; `originalName` is the upload-time fallback for records that predate
 * the rename fix.
 */
export function downloadNameFor(file: {
  name?: string | null;
  originalName?: string | null;
}): string {
  return (
    (file?.name || "").trim() || (file?.originalName || "").trim() || FALLBACK_NAME
  );
}

/**
 * A quoted-string-safe ASCII rendering of the file name. Quotes and
 * backslashes would end the quoted string early, CR/LF would let a name inject
 * headers, and anything outside printable ASCII is not legal here at all.
 */
function toAsciiFilename(name: string): string {
  const ascii = name
    .replace(/[\\"]/g, "")
    .replace(/[\r\n]/g, " ")
    .replace(/[^\x20-\x7e]/g, "_");
  return ascii.trim() || FALLBACK_NAME;
}

/**
 * Build a Content-Disposition header value per RFC 6266 / RFC 5987.
 *
 * Both filename parameters are emitted deliberately: the quoted ASCII form is
 * what older clients read, and `filename*` carries the exact UTF-8 name for
 * everyone else. Clients that understand both prefer `filename*`, so spaces
 * and unicode survive intact.
 */
export function buildContentDisposition(
  fileName: string,
  type: "attachment" | "inline" = "attachment"
): string {
  const name = (fileName || "").trim() || FALLBACK_NAME;
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${type}; filename="${toAsciiFilename(name)}"; filename*=UTF-8''${encoded}`;
}

/**
 * Apply a rename to a cabinet file document (user, organization or floor).
 * Mutates in place; the caller saves.
 */
export function applyFileRename(file: any, newName: string): void {
  const trimmed = String(newName || "").trim();
  if (!trimmed) return;

  file.name = trimmed;
  // Download responses, stream headers and older cabinet views all read
  // originalName, so it has to track the rename or they serve the stale name.
  file.originalName = trimmed;

  // Only when the new name actually carries an extension — renaming to a bare
  // name should not blank out the extension of an unchanged file.
  const dot = trimmed.lastIndexOf(".");
  if (dot > 0 && dot < trimmed.length - 1) {
    file.extension = trimmed.slice(dot + 1);
  }

  const currentPath = typeof file.path === "string" ? file.path : "";
  const slash = currentPath.lastIndexOf("/");
  file.path =
    slash >= 0 ? `${currentPath.slice(0, slash + 1)}${trimmed}` : trimmed;
}
