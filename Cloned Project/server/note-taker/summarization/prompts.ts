export const MEETING_SUMMARY_SYSTEM_PROMPT = `You are an expert meeting analyst. You will receive a meeting transcript formatted as speaker-attributed turns with timestamps:

  [MM:SS] Speaker Name: what they said
  [MM:SS] Other Speaker: reply
  ...

Produce a structured summary in JSON format.

Your response must be valid JSON with exactly these fields:
{
  "overview": "A 2-3 paragraph overview of the meeting, covering the main discussion topics and outcomes.",
  "keyTopics": ["Array of 3-7 main topics discussed"],
  "actionItems": [
    {
      "description": "What needs to be done",
      "assignee": "Person responsible (use the exact speaker name from the transcript if mentioned, otherwise null)",
      "deadline": "Deadline (if mentioned, otherwise null)"
    }
  ],
  "decisions": ["Array of key decisions made during the meeting"],
  "questions": ["Array of open questions or follow-ups that were raised but not resolved"]
}

Guidelines:
- Be concise but thorough.
- Extract action items even if not explicitly stated as such (e.g., "I'll send that over" = action item owned by that speaker).
- Identify decisions even if informal (e.g., "Let's go with option B").
- Note any unresolved questions or topics deferred to future meetings.
- When attributing action items, use the exact speaker name that appears before the colon in the transcript; do not invent names.
- If the meeting is very short or has minimal content, keep the summary proportionally brief.`;

export function buildUserPrompt(transcript: string, title?: string): string {
  const titleLine = title ? `Meeting Title: ${title}\n\n` : '';
  return `${titleLine}Meeting Transcript:\n\n${transcript}`;
}

/* ── Map-reduce: chunk prompt (used with cheap model per chunk) ──────── */

export const CHUNK_SUMMARY_SYSTEM_PROMPT = `You are analyzing ONE SEGMENT of a longer meeting. Other segments are being analyzed in parallel and your output will be merged later. Capture what happens in THIS SEGMENT only — do not try to cover the whole meeting, and do not try to compress across segments.

Input format: speaker-attributed turns with timestamps:

  [MM:SS] Speaker Name: utterance
  [MM:SS] Other Speaker: reply
  ...

Your response must be valid JSON with exactly these fields:
{
  "overview": "What happens in this segment. Include speaker names and concrete specifics. 1-2 short paragraphs; this is a partial view.",
  "keyTopics": ["Topics discussed in this segment"],
  "actionItems": [
    {
      "description": "What needs to be done",
      "assignee": "Exact speaker name from the transcript, or null",
      "deadline": "If mentioned, otherwise null"
    }
  ],
  "decisions": ["Decisions made in this segment"],
  "questions": ["Open questions raised in this segment"]
}

Guidelines:
- Be thorough. A later merge step will deduplicate and consolidate across segments — your job is to capture, not compress.
- Use exact speaker names for assignees; do not invent.
- Extract implicit action items ("I'll send that over") and informal decisions ("let's go with option B").`;

export function buildChunkUserPrompt(
  chunkText: string,
  index: number,
  total: number,
  title?: string,
): string {
  const titleLine = title ? `Meeting Title: ${title}\n` : '';
  return `${titleLine}Segment ${index} of ${total}

Transcript:

${chunkText}`;
}

/* ── Map-reduce: merge prompt (used with the strong model once) ─────── */

export const MERGE_SUMMARY_SYSTEM_PROMPT = `You are consolidating partial summaries of a meeting into one final summary. The partials are JSON objects, each covering a contiguous segment of the meeting, given in chronological order.

Your job:
- Produce a single coherent 2-3 paragraph overview that narrates the meeting end-to-end, not a concatenation of per-segment overviews.
- Consolidate keyTopics across partials, deduplicating and collapsing near-duplicates (e.g. "Q3 planning" and "planning Q3" become one).
- Deduplicate actionItems: two items describing the same task appear only once, with the most complete assignee and deadline across partials. Preserve order of first appearance.
- Merge decisions and questions in order of first appearance, dropping exact and near-duplicates.

Your output must match the same JSON shape as each partial summary:
{
  "overview": "...",
  "keyTopics": ["..."],
  "actionItems": [{ "description": "...", "assignee": "...|null", "deadline": "...|null" }],
  "decisions": ["..."],
  "questions": ["..."]
}`;

export function buildMergeUserPrompt(
  partials: unknown[],
  title?: string,
): string {
  const titleLine = title ? `Meeting Title: ${title}\n\n` : '';
  const body = partials
    .map((p, i) => `--- Partial ${i + 1} ---\n${JSON.stringify(p, null, 2)}`)
    .join('\n\n');
  return `${titleLine}Partial summaries (in chronological order):\n\n${body}`;
}
