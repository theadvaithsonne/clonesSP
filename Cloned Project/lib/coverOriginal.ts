import type { CropState } from "@/components/shared/ImageCropDialog";

/**
 * Community covers are saved cropped to the banner, so repositioning one later
 * needs the image it was cropped *from*. The channel schema has no field for
 * that, so the link is remembered per-browser, keyed by the saved cover URL.
 *
 * The rules live here as pure functions because the interesting part is the
 * branching — which image a reframe should open, and what to remember after.
 */

const ORIGINAL_KEY_PREFIX = "garage:coverOriginal:";

export interface CoverOriginalRecord {
  /** URL of the fuller image this cover was cropped from. */
  url: string;
  /** Framing used, in that image's coordinates. */
  state: CropState;
}

/** Minimal slice of `Storage`, so this is testable without a browser. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultStore = (): KeyValueStore | null =>
  typeof window === "undefined" ? null : window.localStorage;

export function readCoverOriginal(
  coverUrl: string,
  store: KeyValueStore | null = defaultStore(),
): CoverOriginalRecord | null {
  if (!coverUrl || !store) return null;
  try {
    const raw = store.getItem(ORIGINAL_KEY_PREFIX + coverUrl);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoverOriginalRecord;
    return parsed?.url ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCoverOriginal(
  coverUrl: string,
  record: CoverOriginalRecord,
  store: KeyValueStore | null = defaultStore(),
): void {
  if (!coverUrl || !record?.url || !store) return;
  try {
    store.setItem(ORIGINAL_KEY_PREFIX + coverUrl, JSON.stringify(record));
  } catch {
    // Storage full or blocked — reframing just falls back to the saved cover.
  }
}

export interface ResolvedCropSource {
  /** What the crop dialog should load. */
  source: File | string;
  /** Framing to restore, only when it matches `source`'s coordinates. */
  initialState: CropState | null;
  /** URL of the fuller image, when `source` is one. Null means it is the crop. */
  originalUrl: string | null;
}

/**
 * Which image "Reposition" should open: the file picked this session, else the
 * fuller image remembered from an earlier one, else the saved cover itself.
 */
export function resolveCropSource(args: {
  pickedFile: File | null;
  pickedFileUrl: string | null;
  pickedFileState: CropState | null;
  coverUrl: string;
  store?: KeyValueStore | null;
}): ResolvedCropSource | null {
  const { pickedFile, pickedFileUrl, pickedFileState, coverUrl } = args;

  if (pickedFile) {
    return { source: pickedFile, initialState: pickedFileState, originalUrl: pickedFileUrl };
  }

  const remembered = readCoverOriginal(
    coverUrl,
    args.store === undefined ? defaultStore() : args.store,
  );
  if (remembered) {
    return { source: remembered.url, initialState: remembered.state, originalUrl: remembered.url };
  }

  if (!coverUrl) return null;
  return { source: coverUrl, initialState: null, originalUrl: null };
}

/**
 * What to remember behind a freshly saved cover. Always leaves something at
 * least as full as the crop, so repeated reframing never degrades into
 * nudging a banner-shaped sliver.
 */
export function resolveOriginalToRemember(args: {
  /** What the dialog was editing. */
  croppedFrom: File | string;
  /** URL of `croppedFrom` if it was just uploaded this save. */
  uploadedOriginalUrl: string | null;
  /** URL of `croppedFrom` if it was already hosted. */
  knownOriginalUrl: string | null;
}): string | null {
  const { croppedFrom, uploadedOriginalUrl, knownOriginalUrl } = args;
  if (uploadedOriginalUrl) return uploadedOriginalUrl;
  if (knownOriginalUrl) return knownOriginalUrl;
  // Cropped straight from a saved cover: that cover is the fullest thing left.
  return typeof croppedFrom === "string" ? croppedFrom : null;
}
