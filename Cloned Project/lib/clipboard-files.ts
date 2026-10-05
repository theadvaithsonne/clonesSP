/**
 * Shared plumbing for "paste or drop a file anywhere on the page" uploads.
 *
 * Both gestures hand over a `DataTransfer`, but they need different handling:
 * a paste is usually one unnamed screenshot blob, a drop is a real file list
 * that may also contain whole directories, which have to be walked before
 * their files can be uploaded.
 */

/**
 * A file on its way to the cabinet, with the folder it came from.
 *
 * `relativePath` is "" for a plain file and "Design/Logos" for a file found
 * two levels inside a dropped folder. Callers use it to show the hierarchy in
 * the review dialog and to recreate the folders on upload.
 */
export interface PickedFile {
  file: File;
  relativePath: string;
}

/** Wraps loose files as `PickedFile`s with no folder of their own. */
export function toPickedFiles(files: File[]): PickedFile[] {
  return files.map((file) => ({ file, relativePath: "" }));
}

/** Illegal in a name the backend turns into a cabinet path. */
const UNSAFE_NAME_CHARS = /[/\\]/g;

/**
 * The name a staged file should end up with when the user types `next` over
 * `originalName`.
 *
 * Typing "CompanyLogo" over "photo.jpg" means renaming the file, not dropping
 * its type, so the old extension is put back. A typed extension wins, and one
 * that already matches is left alone rather than doubled.
 */
export function withPreservedExtension(
  originalName: string,
  next: string,
): string {
  const typed = next.replace(UNSAFE_NAME_CHARS, "").trim();
  if (!typed) return originalName;

  const originalDot = originalName.lastIndexOf(".");
  const extension =
    originalDot > 0 ? originalName.slice(originalDot).toLowerCase() : "";
  if (!extension) return typed;

  // `dot > 0` so a dotfile ("`.env`") counts as a name, not an extension.
  const typedDot = typed.lastIndexOf(".");
  const typedHasExtension = typedDot > 0 && typedDot < typed.length - 1;
  if (typedHasExtension) return typed;

  return `${typed.replace(/\.+$/, "")}${extension}`;
}

/**
 * A copy of the staged file carrying a new name. `File.name` is read-only, so
 * the rename has to build a new File — the bytes are shared, not copied, and
 * every downstream step (FormData, S3 key, DB record) reads the new name for
 * free.
 */
export function renamePickedFile(entry: PickedFile, next: string): PickedFile {
  const name = withPreservedExtension(entry.file.name, next);
  if (name === entry.file.name) return entry;
  return {
    ...entry,
    file: new File([entry.file], name, {
      type: entry.file.type,
      lastModified: entry.file.lastModified,
    }),
  };
}

/**
 * True when the event landed in something the user is typing into. Paste has
 * to stay a normal text paste there — hijacking it would break search boxes,
 * rename fields and comment editors.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el =
    target instanceof HTMLElement
      ? target
      : typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable || !!el.closest?.("[contenteditable='true']");
}

/** Screenshots arrive as `image.png` (or nameless) — make them tellable apart. */
function nameClipboardFile(file: File, index: number): File {
  const generic = !file.name || /^image\.(png|jpe?g|gif|webp)$/i.test(file.name);
  if (!generic) return file;
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = index > 0 ? `-${index + 1}` : "";
  return new File([file], `pasted-${stamp}${suffix}.${ext}`, {
    type: file.type || "image/png",
    lastModified: file.lastModified,
  });
}

/** Files carried by a paste, with screenshot blobs given readable names. */
export function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  // `items` covers screenshot blobs, which never appear in `files` on Safari.
  for (const item of Array.from(data.items || [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) out.push(file);
  }
  if (out.length === 0) out.push(...Array.from(data.files || []));
  return out.map(nameClipboardFile);
}

/* ─── Dropped folders ─── */

// A dropped tree could be enormous (someone drops their home directory by
// accident). These bounds keep the review dialog and the browser responsive;
// whatever is skipped is reported back so the UI can say so rather than
// quietly uploading a subset.
const MAX_DEPTH = 8;
const MAX_FILES = 500;

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (file: File) => void, err?: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (
      cb: (entries: FileSystemEntryLike[]) => void,
      err?: (e: unknown) => void,
    ) => void;
  };
}

function entryToFile(entry: FileSystemEntryLike): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof entry.file !== "function") {
      resolve(null);
      return;
    }
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

/**
 * `readEntries` returns at most ~100 entries per call and signals the end with
 * an empty batch, so it has to be drained in a loop rather than called once.
 */
function readAllEntries(entry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve) => {
    const reader = entry.createReader?.();
    if (!reader) {
      resolve([]);
      return;
    }
    const all: FileSystemEntryLike[] = [];
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!batch || batch.length === 0) {
            resolve(all);
            return;
          }
          all.push(...batch);
          readBatch();
        },
        () => resolve(all),
      );
    };
    readBatch();
  });
}

interface WalkState {
  picked: PickedFile[];
  truncated: boolean;
}

async function walkEntry(
  entry: FileSystemEntryLike,
  parentPath: string,
  depth: number,
  state: WalkState,
): Promise<void> {
  if (state.picked.length >= MAX_FILES) {
    state.truncated = true;
    return;
  }

  if (entry.isFile) {
    const file = await entryToFile(entry);
    if (file) state.picked.push({ file, relativePath: parentPath });
    return;
  }

  if (!entry.isDirectory) return;
  if (depth >= MAX_DEPTH) {
    state.truncated = true;
    return;
  }

  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  const children = await readAllEntries(entry);
  for (const child of children) {
    await walkEntry(child, path, depth + 1, state);
    if (state.picked.length >= MAX_FILES) {
      state.truncated = true;
      return;
    }
  }
}

export interface DropResult {
  files: PickedFile[];
  /** True when the tree was bigger than we are willing to walk. */
  truncated: boolean;
  /** Folders we saw but could not read (no entry API in this browser). */
  unreadableDirectories: number;
}

/**
 * Files carried by a drop, folders included.
 *
 * The entry API is what makes folders possible: `DataTransfer.files` lists a
 * dropped directory as a single size-0 entry that cannot be uploaded. Where
 * the API is missing we skip directories and say how many, rather than
 * uploading a bogus zero-byte file named after the folder.
 *
 * Async because reading a directory is: the caller must await this before
 * touching `dataTransfer` again, since the item list is cleared once the drop
 * handler returns — which is why the entries are captured synchronously up
 * front.
 */
export async function filesFromDrop(
  data: DataTransfer | null,
): Promise<DropResult> {
  const empty: DropResult = {
    files: [],
    truncated: false,
    unreadableDirectories: 0,
  };
  if (!data) return empty;

  // Captured now, before any await: the browser empties `items` as soon as the
  // drop event handler returns.
  const items = Array.from(data.items || []);
  const entries = items.map((item) =>
    typeof item.webkitGetAsEntry === "function"
      ? (item.webkitGetAsEntry() as unknown as FileSystemEntryLike | null)
      : null,
  );
  const files = Array.from(data.files || []);

  const state: WalkState = { picked: [], truncated: false };
  let unreadableDirectories = 0;

  const hasEntries = entries.some(Boolean);
  if (hasEntries) {
    for (const entry of entries) {
      if (!entry) continue;
      await walkEntry(entry, "", 0, state);
    }
  } else {
    // No entry API: keep plain files, drop anything that looks like a folder
    // (size 0 with no MIME type is what a dropped directory looks like there).
    files.forEach((file) => {
      if (file.size === 0 && !file.type) {
        unreadableDirectories += 1;
        return;
      }
      state.picked.push({ file, relativePath: "" });
    });
  }

  return {
    files: state.picked,
    truncated: state.truncated,
    unreadableDirectories,
  };
}

/** Whether a drag actually carries files, as opposed to text or a DOM node. */
export function dragHasFiles(data: DataTransfer | null): boolean {
  return !!data && Array.from(data.types || []).includes("Files");
}
