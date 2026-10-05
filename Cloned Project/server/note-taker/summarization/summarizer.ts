import OpenAI from 'openai';
import { env } from '../../config/env';
import { NoteTranscript } from '../models/note-transcript.model';
import { NoteSummary } from '../models/note-summary.model';
import { NoteSession } from '../models/note-session.model';
import {
  MEETING_SUMMARY_SYSTEM_PROMPT,
  buildUserPrompt,
  CHUNK_SUMMARY_SYSTEM_PROMPT,
  buildChunkUserPrompt,
  MERGE_SUMMARY_SYSTEM_PROMPT,
  buildMergeUserPrompt,
} from './prompts';
import {
  preprocessSegments,
  formatForPrompt,
  estimateTokens,
  chunkForMapReduce,
} from './transcript-preprocess';
import { Types } from 'mongoose';

/** If compact transcript fits under this budget, single-pass with the
 *  strong model. Above it, map-reduce: per-chunk summaries with the
 *  cheap model, merged by the strong model. ~15k tokens is roughly a
 *  50-minute dense meeting after preprocessing. */
const SINGLE_PASS_TOKEN_BUDGET = 15_000;

/** Target size per chunk when map-reducing. Keep well under the cheap
 *  model's comfort zone so attention doesn't dilute mid-chunk. */
const CHUNK_TARGET_TOKENS = 5_000;

const STRONG_MODEL = 'gpt-4o';
const CHEAP_MODEL = 'gpt-4o-mini';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface SummaryResult {
  overview: string;
  keyTopics: string[];
  actionItems: { description: string; assignee?: string; deadline?: string }[];
  decisions: string[];
  questions: string[];
}

/**
 * Generate and save a meeting summary for a NoteSession.
 * Reads the transcript, calls OpenAI, saves NoteSummary, updates NoteSession.
 */
export async function generateAndSaveSummary(sessionId: Types.ObjectId): Promise<Types.ObjectId> {
  const session = await NoteSession.findById(sessionId);
  if (!session) throw new Error(`NoteSession not found: ${sessionId}`);

  const transcript = await NoteTranscript.findOne({ sessionId });
  if (!transcript) throw new Error(`NoteTranscript not found for session: ${sessionId}`);

  // Build compact speaker-structured turns from segments (not fullText).
  // Drops micro-filler, collapses disfluency repetition, merges
  // consecutive same-speaker turns.
  const compact = preprocessSegments(transcript.segments || []);
  const formattedTranscript = compact.length
    ? formatForPrompt(compact)
    : transcript.fullText;
  const approxInputTokens = estimateTokens(formattedTranscript);

  const { result, aiModel, promptTokens, completionTokens } =
    approxInputTokens <= SINGLE_PASS_TOKEN_BUDGET || compact.length === 0
      ? await singlePassSummary(formattedTranscript, session.title)
      : await mapReduceSummary(compact, session.title);

  // Build markdown version for email
  const markdownSummary = buildMarkdownSummary(result, session.title);

  // Save to DB
  const summary = await NoteSummary.create({
    sessionId,
    overview: result.overview || '',
    keyTopics: result.keyTopics || [],
    actionItems: result.actionItems || [],
    decisions: result.decisions || [],
    questions: result.questions || [],
    markdownSummary,
    aiModel,
    promptTokens,
    completionTokens,
  });

  // Update NoteSession
  await NoteSession.findByIdAndUpdate(sessionId, {
    summaryId: summary._id,
    status: 'ready',
  });

  console.log(
    `[Summarizer] Summary saved for session ${sessionId} (model=${aiModel}, tokens=${promptTokens}+${completionTokens})`,
  );
  return summary._id as Types.ObjectId;
}

interface SummaryCallResult {
  result: SummaryResult;
  aiModel: string;
  promptTokens: number;
  completionTokens: number;
}

/** Single strong-model call. Used when the transcript fits comfortably
 *  in one request. */
async function singlePassSummary(
  formattedTranscript: string,
  title?: string,
): Promise<SummaryCallResult> {
  const completion = await openai.chat.completions.create({
    model: STRONG_MODEL,
    messages: [
      { role: 'system', content: MEETING_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(formattedTranscript, title) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4096,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  return {
    result: JSON.parse(content) as SummaryResult,
    aiModel: STRONG_MODEL,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
}

/** Map-reduce path: chunk the transcript on speaker boundaries,
 *  summarize each chunk with the cheap model in parallel, then merge
 *  the partial JSONs with the strong model. Total cost stays well
 *  below a single strong-model pass on the same input because only
 *  the (much smaller) merge call pays strong-model pricing. */
async function mapReduceSummary(
  compact: ReturnType<typeof preprocessSegments>,
  title?: string,
): Promise<SummaryCallResult> {
  const chunks = chunkForMapReduce(compact, CHUNK_TARGET_TOKENS);
  console.log(
    `[Summarizer] Long meeting — map-reduce over ${chunks.length} chunks (target ${CHUNK_TARGET_TOKENS} tokens each)`,
  );

  let promptTokens = 0;
  let completionTokens = 0;

  const partials = await Promise.all(
    chunks.map(async (chunkText, idx) => {
      const c = await openai.chat.completions.create({
        model: CHEAP_MODEL,
        messages: [
          { role: 'system', content: CHUNK_SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: buildChunkUserPrompt(chunkText, idx + 1, chunks.length, title) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2048,
      });
      promptTokens += c.usage?.prompt_tokens ?? 0;
      completionTokens += c.usage?.completion_tokens ?? 0;
      const content = c.choices[0]?.message?.content;
      if (!content) throw new Error(`Empty chunk response for partial ${idx + 1}`);
      return JSON.parse(content) as SummaryResult;
    }),
  );

  const mergeCompletion = await openai.chat.completions.create({
    model: STRONG_MODEL,
    messages: [
      { role: 'system', content: MERGE_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: buildMergeUserPrompt(partials, title) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4096,
  });

  const mergeContent = mergeCompletion.choices[0]?.message?.content;
  if (!mergeContent) throw new Error('Empty merge response from OpenAI');
  promptTokens += mergeCompletion.usage?.prompt_tokens ?? 0;
  completionTokens += mergeCompletion.usage?.completion_tokens ?? 0;

  return {
    result: JSON.parse(mergeContent) as SummaryResult,
    aiModel: `${STRONG_MODEL}+mini (map-reduce, ${chunks.length} chunks)`,
    promptTokens,
    completionTokens,
  };
}

function buildMarkdownSummary(result: SummaryResult, title?: string): string {
  const lines: string[] = [];

  if (title) {
    lines.push(`# ${title}\n`);
  } else {
    lines.push('# Meeting Summary\n');
  }

  lines.push('## Overview\n');
  lines.push(result.overview + '\n');

  if (result.keyTopics.length > 0) {
    lines.push('## Key Topics\n');
    result.keyTopics.forEach((t) => lines.push(`- ${t}`));
    lines.push('');
  }

  if (result.actionItems.length > 0) {
    lines.push('## Action Items\n');
    result.actionItems.forEach((item) => {
      let line = `- [ ] ${item.description}`;
      if (item.assignee) line += ` (**${item.assignee}**)`;
      if (item.deadline) line += ` — by ${item.deadline}`;
      lines.push(line);
    });
    lines.push('');
  }

  if (result.decisions.length > 0) {
    lines.push('## Decisions\n');
    result.decisions.forEach((d) => lines.push(`- ${d}`));
    lines.push('');
  }

  if (result.questions.length > 0) {
    lines.push('## Open Questions\n');
    result.questions.forEach((q) => lines.push(`- ${q}`));
    lines.push('');
  }

  return lines.join('\n');
}
