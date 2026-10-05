// src/utils/attachmentMeta.ts
//
// Normalise an inbound chat attachment before it is persisted.
//
// The socket handlers used to build this object inline, listing each field by
// hand — which meant any field the client started sending was silently dropped.
// That is exactly what happened to the playback metadata below: the schema
// accepted `durationMs`/`width`/`height`/`waveform`, but the whitelist in the
// handler threw them away before Mongoose ever saw them.

/** Voice-note waveforms are capped at 64 samples — see message.model.ts. */
export const MAX_WAVEFORM_SAMPLES = 64;

export interface InboundAttachment {
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  fileKey?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  waveform?: number[];
}

/**
 * A non-empty string, or undefined.
 *
 * Kept as a plain passthrough — this is a URL the client already uploaded, and
 * validating its shape here would only reject things the storage layer accepts.
 */
function nonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

/**
 * A finite, non-negative number, or undefined.
 *
 * Guards against `NaN`/`Infinity` reaching Mongo, where they would either fail
 * the write or come back as something a layout calculation divides by.
 */
function positiveNumber(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
  return v;
}

/**
 * Clamp the waveform to 64 samples in 0..1.
 *
 * Trimmed rather than rejected, deliberately: a malformed waveform is a
 * cosmetic problem, and it must never be the reason someone's voice note fails
 * to send.
 */
function cleanWaveform(v: unknown): number[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const out = v
    .slice(0, MAX_WAVEFORM_SAMPLES)
    .map((n) => (typeof n === "number" && Number.isFinite(n) ? n : 0))
    .map((n) => Math.min(1, Math.max(0, n)));
  return out.length ? out : undefined;
}

/**
 * Just the optional metadata, validated and ready to spread onto an attachment
 * the caller has already built.
 *
 * Keys are omitted entirely when absent, so an attachment from an older client
 * is byte-identical to what it produced before these fields existed.
 */
export function processAttachmentMeta(att: Partial<InboundAttachment>) {
  const durationMs = positiveNumber(att?.durationMs);
  const width = positiveNumber(att?.width);
  const height = positiveNumber(att?.height);
  const waveform = cleanWaveform(att?.waveform);
  const thumbnailUrl = nonEmptyString(att?.thumbnailUrl);

  return {
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(waveform ? { waveform } : {}),
  };
}

/**
 * Build the stored attachment. Optional metadata keys are omitted entirely
 * when absent, so an attachment sent by an older client is byte-identical to
 * what it produced before these fields existed.
 */
export function processAttachment(att: InboundAttachment) {
  return {
    fileName: att.fileName,
    fileSize: att.fileSize,
    fileType: att.fileType,
    fileUrl: att.fileUrl,
    // Prefer an explicit key; fall back to the tail of the URL, which is what
    // every call site did before this helper existed.
    fileKey: att.fileKey || att.fileUrl.split("/").pop() || "",
    uploadedAt: new Date(),
    // Delegated rather than repeated, so a field added to one path can never
    // go missing from the other — which is the exact bug this file was
    // written to fix.
    ...processAttachmentMeta(att),
  };
}

export function processAttachments(
  attachments?: InboundAttachment[]
): ReturnType<typeof processAttachment>[] | undefined {
  if (!attachments) return undefined;
  return attachments.map(processAttachment);
}
