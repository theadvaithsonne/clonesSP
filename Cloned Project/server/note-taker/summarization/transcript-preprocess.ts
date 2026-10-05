import type { TranscriptSegment } from '../types';

/**
 * Micro-filler segments the summarizer should never see. Most of these
 * are "ok" / "yeah" acknowledgments that burn input tokens without
 * adding signal — dropping them is safe because the surrounding turns
 * still carry the conversation.
 */
const MICRO_FILLER = new Set([
  'ok', 'okay', 'k', 'yeah', 'yep', 'yup', 'yes', 'no', 'nope',
  'right', 'sure', 'cool', 'great', 'nice',
  'mhm', 'mmhm', 'mhmm', 'hmm', 'uh', 'um', 'ah', 'oh',
  'so', 'well', 'true',
]);

function isMicroFiller(text: string): boolean {
  const stripped = text.trim().toLowerCase().replace(/[.,!?…\s]+$/g, '');
  return MICRO_FILLER.has(stripped);
}

/**
 * Collapse obvious disfluency noise:
 *   "uh uh I think" -> "uh I think"
 *   "um, um, well" -> "um, well"
 *   "I mean, I mean we should" -> "I mean we should"
 *   leading "uh, um, " at segment start -> dropped
 *
 * This is intentionally conservative — we collapse repetition of the
 * same filler, not remove all fillers, because a single "uh" can be
 * signal (hesitation before a hard decision).
 */
function stripDisfluencies(text: string): string {
  return text
    .replace(/\b(uh|um|ah|hmm|erm)\b([,\s]+\b\1\b)+/gi, '$1')
    .replace(/\b(you know|i mean|like)\b([,\s]+\b\1\b)+/gi, '$1')
    .replace(/^(\s*(uh|um|ah|hmm|erm)[,.\s]+)+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatTimestamp(seconds: number): string {
  const s = Math.floor(seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

export interface CompactSegment {
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Preprocess raw Deepgram segments into a compact, speaker-attributed
 * form suitable for LLM consumption. Three things happen:
 *
 *   1. Micro-filler segments are dropped entirely.
 *   2. Disfluency repetition inside each segment is collapsed.
 *   3. Consecutive segments from the same speaker are merged into one
 *      turn. This reads as a natural monologue and keeps the model's
 *      attention on the speaker boundary rather than the row boundary.
 *
 * Typical compression: ~20-40% fewer input tokens vs. raw segments,
 * with no loss of meaningful content.
 */
export function preprocessSegments(segments: TranscriptSegment[]): CompactSegment[] {
  const out: CompactSegment[] = [];

  for (const seg of segments) {
    const cleaned = stripDisfluencies(seg.text);
    if (!cleaned || isMicroFiller(cleaned)) continue;

    const speaker = (seg.speakerName || seg.speaker || 'Unknown').trim();
    const last = out[out.length - 1];

    if (last && last.speaker === speaker) {
      last.text = `${last.text} ${cleaned}`.trim();
      last.endTime = seg.endTime;
    } else {
      out.push({
        speaker,
        startTime: seg.startTime,
        endTime: seg.endTime,
        text: cleaned,
      });
    }
  }

  return out;
}

/**
 * Render compact segments as speaker-attributed dialogue with timestamps.
 * This is the exact string the LLM sees:
 *
 *   [00:12] Sarah: Let's ship this by Friday.
 *   [00:14] Mike: I'll handle the migration.
 */
export function formatForPrompt(segments: CompactSegment[]): string {
  return segments.map(renderSegmentLine).join('\n');
}

function renderSegmentLine(s: CompactSegment): string {
  return `[${formatTimestamp(s.startTime)}] ${s.speaker}: ${s.text}`;
}

/**
 * Approximate token count. ~4 chars per token holds for English meeting
 * transcripts; accurate enough for threshold decisions without pulling
 * in tiktoken as a dependency.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Chunk preprocessed segments into prompt-ready strings, each under
 * `targetTokens`. Splits only on speaker-turn boundaries so no turn is
 * ever cut mid-sentence. Used by the map-reduce path in the summarizer
 * when a transcript is too long for a single call.
 */
export function chunkForMapReduce(
  segments: CompactSegment[],
  targetTokens: number,
): string[] {
  const chunks: string[] = [];
  const buf: string[] = [];
  let bufTokens = 0;

  for (const seg of segments) {
    const line = renderSegmentLine(seg);
    const lineTokens = estimateTokens(line);
    // If adding this line would overshoot, flush current buffer first.
    if (bufTokens > 0 && bufTokens + lineTokens > targetTokens) {
      chunks.push(buf.join('\n'));
      buf.length = 0;
      bufTokens = 0;
    }
    buf.push(line);
    bufTokens += lineTokens;
  }
  if (buf.length) chunks.push(buf.join('\n'));
  return chunks;
}
