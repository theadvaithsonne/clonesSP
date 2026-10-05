# `server/services/groupTaskClassifier.ts`

> AI triage for a linked group chat: is this message WORK or NORMAL CHAT?

**Kind:** backend service · **Lines:** 1416

<!-- docgen:auto -->

## Purpose
AI triage for a linked group chat: is this message WORK or NORMAL CHAT?

Pure: prompt building, the model calls, and parsing/validating the answer.
No database, no Taskroom — services/groupTaskAuto.ts gathers the context and
files the tasks, and the eval harness (scripts/group-task-ai-eval) drives this
module directly with synthetic conversations and screenshots.

Every detected item becomes a plain Taskroom task (title, description,
priority, optional assignee). The prompt reasons about kinds of work — bug,
UI change, feature, action item — but no label ever reaches the task.

Model chain: GROUP_TASK_AI_MODEL first (OpenAI by default), then
GROUP_TASK_AI_FALLBACK_MODEL (Gemini by default). The provider follows the
model name ("gemini-…" → Gemini, anything else → OpenAI), so the two can be
swapped from the environment. Unlike the support-ticket triage there is NO
keyword fallback: a heuristic that files tasks from chat would be wrong far […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GroupTaskPriority` | type |  | 37 |
| `ClassifierImage` | interface | Images are read by the model; anything else is only named. | 41 |
| `ClassifierHistoryMessage` | interface | A message that came before the one being classified (context only). | 47 |
| `ClassifierKnownTask` | interface | A task the AI already filed from this chat. | 63 |
| `ClassifierReplyContext` | interface | The message the current one replies to. | 76 |
| `ClassifierInput` | interface |  | 83 |
| `ClassifiedTask` | interface |  | 119 |
| `TaskUpdate` | interface | A change to a task already on the board (a follow-up message). | 130 |
| `ClassifierResult` | interface |  | 140 |
| `ClassifierOptions` | interface |  | 153 |
| `MAX_CLASSIFIER_IMAGES` | const | `= 4` — Most images any one call may carry (current message first, then earlier). | 173 |
| `groupTaskPrimaryModel` | function | `groupTaskPrimaryModel(): string` | 190 |
| `groupTaskFallbackModel` | function | `groupTaskFallbackModel(): string` | 194 |
| `groupTaskMinConfidence` | function | `groupTaskMinConfidence(): number` — Tasks below this confidence are dropped by the caller (env GROUP_TASK_MIN_CONFIDENCE). | 205 |
| `acceptedTasks` | function | `acceptedTasks(result: ClassifierResult, minConfidence = groupTaskMinConfidence()): ClassifiedTask[]` — The tasks the caller should actually file. | 211 |
| `titleSimilarity` | function | `titleSimilarity(a: string, b: string): number` — Jaccard overlap of the titles' content words, 0–1. | 249 |
| `matchMentionedName` | function | `matchMentionedName(name: string \| null \| undefined, mentionedNames: string[]): string \| null` — The mentioned member a model-written name refers to: an exact match, else one unambiguous partial or first-name match. | 272 |
| `CaptureDecision` | interface |  | 287 |
| `captureDecision` | function | `captureDecision(result: ClassifierResult, ctx: { /** No text, only images. */ imageOnly: boolean; /**…, minConfidence = groupTaskMinConfidence()): CaptureDecision` — What the caller does with an answer. | 305 |
| `buildClassifierUserText` | function | `buildClassifierUserText(input: ClassifierInput, shown: { current: number; replied: number; earlier: number }): string` — The per-message half of the prompt. | 508 |
| `parseClassifierReply` | function | `parseClassifierReply(text: string): Omit<ClassifierResult, "provider" \| "model"> \| nu…` | 780 |
| `MAX_REPLIED_IMAGES` | const | `= 2` — Replied-to images never crowd out more than this many of the rest. | 864 |
| `classifyGroupMessage` | function | `async classifyGroupMessage(input: ClassifierInput, opts: ClassifierOptions = {}): Promise<ClassifierResult \| null>` — Classify one group message. | 1083 |
| `EditTaskInput` | interface | A task filed from the edited message, as it is on the board now. | 1120 |
| `EditRevisionInput` | interface |  | 1128 |
| `TaskRevision` | interface | How one task should read after the edit. | 1148 |
| `EditRevisionResult` | interface |  | 1157 |
| `buildEditUserText` | function | `buildEditUserText(input: EditRevisionInput, shownImages: number): string` | 1215 |
| `parseEditReply` | function | `parseEditReply(text: string): Omit<EditRevisionResult, "provider" \| "model"> \| …` | 1296 |
| `reviseTasksForEdit` | function | `async reviseTasksForEdit(input: EditRevisionInput, opts: ClassifierOptions = {}): Promise<EditRevisionResult \| null>` — Ask how the tasks filed from an edited message should read now. | 1317 |
| `TaskRevisionPlan` | interface | What to write for one task after the edit, and what actually changed. | 1344 |
| `EditDecision` | interface |  | 1350 |
| `editDecision` | function | `editDecision(result: EditRevisionResult, input: Pick<EditRevisionInput, "tasks" \| "otherTaskTitles" …, minConfidence = groupTaskMinConfidence()): EditDecision` — Turn the model's answer into writes. | 1370 |

## Interfaces

- **Environment variables (`process.env`):** `GROUP_TASK_AI_MODEL`, `GROUP_TASK_AI_FALLBACK_MODEL`, `GROUP_TASK_MIN_CONFIDENCE`
- **Environment via `server/config/env.ts`:** `env.OPENAI_API_KEY`
- **Timers / queues:** `setTimeout` at L919

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `@google/generative-ai` — `GoogleGenerativeAI`, `SchemaType`, `GenerationConfig`, `Part`, `ResponseSchema`
  - `openai`
  - `zod` — `z`

## Used by

- `server/services/groupTaskAuto.ts`
