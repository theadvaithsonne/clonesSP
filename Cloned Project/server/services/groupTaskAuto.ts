// Auto-capture Taskroom tasks from a linked group chat.
//
// Called fire-and-forget from the socket `group:message` handler for every
// top-level message. Cheap gates first — nearly every message is in a group
// with no Taskroom link, and most of the rest are chatter — then the AI
// (services/groupTaskClassifier.ts) reads the message, its recent context and
// any screenshots, and each work item it finds becomes a plain task on the
// linked board, with the message's files attached and a system pill in the
// chat pointing at it.
//
// Ordering matters here in a way it does not for most background work: a
// screenshot posted as its own message right before or after the text that
// explains it must end up on the same task. So messages of one group are
// processed strictly in order, through an in-process queue per group, and each
// capture sees what the previous one filed.
//
// Load guards: the socket handler only calls in for linked, enabled groups
// (so unlinked groups never load this module); GROUP_TASK_AI_DISABLED=true
// turns capture off; a group's backlog is capped; the heavy part — image
// downloads and the model call — runs at most GROUP_TASK_AI_CONCURRENCY at a
// time process-wide; every network call has a hard timeout and none retries.
//
// Everything is best-effort and never throws: a failed capture must never
// affect the send that triggered it. A board that has gone away (or that
// nobody in the group can act on any more) marks the link "broken" so the
// admin panel can ask for a relink, and capture stops until then.

import { Types } from "mongoose";
import { Group } from "../models/group.model";
import { GroupMessage } from "../models/groupMessage.model";
import { GroupAiTask } from "../models/groupAiTask.model";
import { User } from "../models/user.model";
import { taskroomRequest } from "./taskroomProvision";
import { NoTaskroomActorError, withTaskroomActor } from "./groupTaskroomActor";
import { pickLandingStageId } from "./groupTaskroom";
import { writeGroupSystemMessage } from "./groupSystemMessage";
import { removeAiTasksForDeletedMessage } from "./groupTaskRemoval";
import { getSocketInstance } from "./socket";
import { env } from "../config/env";
import {
  MAX_CLASSIFIER_IMAGES,
  MAX_REPLIED_IMAGES,
  captureDecision,
  classifyGroupMessage,
  editDecision,
  groupTaskMinConfidence,
  matchMentionedName,
  reviseTasksForEdit,
  type CaptureDecision,
  type EditTaskInput,
  type GroupTaskPriority,
  type ClassifiedTask,
  type ClassifierHistoryMessage,
  type ClassifierImage,
  type ClassifierInput,
  type ClassifierKnownTask,
  type ClassifierResult,
  type TaskUpdate,
} from "./groupTaskClassifier";

/** Previous top-level messages shown to the model as context. */
const CONTEXT_MESSAGES = 10;
/** A screenshot this close to its text (same sender) belongs to the same task. */
const PAIRING_WINDOW_MS = 3 * 60 * 1000;
/** Most existing tasks one message may assign or attach to. */
const MAX_UPDATES_PER_MESSAGE = 3;
/** Recent AI tasks shown to the model so it does not file them twice. */
const RECENT_TASKS = 15;
const RECENT_TASK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
/** Refs handed to the model: the replied-to message's tasks plus the recent ones. */
const MAX_KNOWN_TASKS = 18;
const IMAGE_TIMEOUT_MS = 10_000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Footer quote of the original message. */
const ORIGINAL_TEXT_MAX = 500;
// Flood protection and bounded memory: a burst beyond this (a paste storm, a
// bot) is skipped and logged rather than queued.
const MAX_QUEUED_PER_GROUP = 20;
const DEFAULT_CONCURRENCY = 3;

// Rich cards (slash commands, location, contact, GIF) are encoded as a marker
// prefix in `text` — see the web app's lib/chat-markers.ts. None is a work
// item written by a person.
const CARD_MARKER = /^\[garage-([a-z]+)\]/;

// Whole-message pleasantries, checked after stripping punctuation and emoji.
// Anything longer than this goes to the model — it is cheap next to a missed
// request.
const PLEASANTRY =
  /^(hi+|hey+|hello+|yo|ok(ay)?|ok+|k+|thanks?|thank you|thanks a lot|thx|ty|tysm|np|no problem|welcome|good (morning|afternoon|evening|night)|gm|gn|bye|cya|great|nice|cool|awesome|sure|yes|yep|yeah|yup|no|nope|nah|done|noted|lol|lmao|haha+|hehe+|same|same here|agreed|right|true|wow|omg|hmm+|ji|haan|han|ha ji|haan ji|theek hai|thik hai|accha|acha|achha|shukriya|dhanyavad)( (team|all|everyone|guys|folks|bhai|ji|sir|maam|madam|bro))?$/i;

/** Nothing a model could turn into work: empty, emoji-only, or a pleasantry. */
function isChatter(text: string): boolean {
  // Emoji variation selectors and keycaps are combining marks, not symbols.
  const core = text.replace(/[\p{P}\p{S}\p{Z}\p{C}\uFE0E\uFE0F\u20E3]/gu, "");
  if (core.length < 2) return true;
  const plain = text
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{C}\uFE0E\uFE0F\u20E3]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return PLEASANTRY.test(plain);
}

function isImageAttachment(a: any): boolean {
  const type = String(a?.fileType || "").toLowerCase();
  return !!a?.fileUrl && type.startsWith("image/") && !type.includes("svg");
}

function captureEnabled(group: any): boolean {
  const link = group?.taskroom;
  return (
    !!group &&
    group.kind !== "support" &&
    !!link?.roomId &&
    link.enabled !== false &&
    link.status !== "broken"
  );
}

/** Kill switch, read per call. */
function captureDisabled(): boolean {
  return process.env.GROUP_TASK_AI_DISABLED === "true";
}

// ── Process-wide limit on the heavy part ─────────────────────────────────────
//
// Image downloads and the model call are the expensive bit (memory for the
// screenshots, an open request for seconds). However many groups are busy, at
// most GROUP_TASK_AI_CONCURRENCY run it at once; the rest wait their turn in
// arrival order. Each group already runs one message at a time, so the wait
// list holds at most one entry per busy group.

let activeSlots = 0;
const slotWaiters: Array<() => void> = [];

function slotLimit(): number {
  const n = Number(process.env.GROUP_TASK_AI_CONCURRENCY);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_CONCURRENCY;
}

async function withHeavySlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeSlots < slotLimit()) activeSlots++;
  else await new Promise<void>((resolve) => slotWaiters.push(resolve)); // handed a slot on release
  try {
    return await fn();
  } finally {
    const next = slotWaiters.shift();
    if (next) next();
    else activeSlots--;
  }
}

// ── Per-group serial queue ───────────────────────────────────────────────────

const queues = new Map<string, { tail: Promise<void>; size: number }>();

function enqueue(groupId: string, job: () => Promise<void>): Promise<void> {
  const queue = queues.get(groupId) ?? { tail: Promise.resolve(), size: 0 };
  if (queue.size >= MAX_QUEUED_PER_GROUP) {
    console.warn(`[group-task-ai] group=${groupId} backlog full — message skipped`);
    return Promise.resolve();
  }
  queue.size++;
  const run = queue.tail
    .then(job)
    .catch((e: any) => {
      console.warn(`[group-task-ai] group=${groupId} capture failed:`, e?.message || e);
    })
    .finally(() => {
      queue.size--;
      if (queue.size === 0 && queues.get(groupId) === queue) queues.delete(groupId);
    });
  queue.tail = run;
  queues.set(groupId, queue);
  return run;
}

/**
 * Entry point from the socket handler. Never throws; resolves once this
 * message has been processed (or skipped).
 */
export async function maybeCaptureGroupTask(
  groupId: string,
  messageId: string
): Promise<void> {
  try {
    if (captureDisabled()) return;
    if (!Types.ObjectId.isValid(groupId) || !Types.ObjectId.isValid(messageId)) return;
    // The socket handler has already checked the link on the group doc it
    // holds; the queued job re-reads and re-checks it before doing anything.
    await enqueue(String(groupId), () => captureMessage(String(groupId), String(messageId)));
  } catch (e: any) {
    console.warn("[group-task-ai] failed:", e?.message || e);
  }
}

// ── Images ───────────────────────────────────────────────────────────────────

/** The real format, from magic bytes — the stored MIME type is only a hint. */
function sniffImageType(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("ascii", 4, 8) === "ftyp") {
    const brand = b.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}

/**
 * Hosts chat uploads are served from — the same bucket `s3Service.getPublicUrl`
 * builds links for, plus an optional allowlist (GROUP_TASK_FILE_HOSTS,
 * comma-separated) for a CDN in front of it.
 *
 * Attachment URLs arrive straight from the client in the socket payload, so
 * they are untrusted: without this the server would fetch whatever address a
 * member typed in (cloud metadata, internal hosts) and hand arbitrary links to
 * Taskroom as attachments.
 */
function trustedFileOrigins(): Set<string> {
  const origins = new Set<string>();
  if (env.AWS_S3_BUCKET && env.AWS_S3_REGION) {
    origins.add(`https://${env.AWS_S3_BUCKET}.s3.${env.AWS_S3_REGION}.amazonaws.com`);
  }
  if (env.AWS_S3_ENDPOINT) {
    try {
      origins.add(new URL(env.AWS_S3_ENDPOINT).origin);
    } catch {
      /* malformed endpoint — ignore */
    }
  }
  for (const host of (process.env.GROUP_TASK_FILE_HOSTS || "").split(",")) {
    const h = host.trim();
    if (h) origins.add(h.startsWith("http") ? h.replace(/\/$/, "") : `https://${h}`);
  }
  return origins;
}

export function isTrustedFileUrl(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return trustedFileOrigins().has(u.origin);
  } catch {
    return false;
  }
}

/** Fetch a chat image (public S3 URL) for the model; null when unusable. */
async function downloadImage(url: string): Promise<ClassifierImage | null> {
  if (!isTrustedFileUrl(url)) return null;
  try {
    // No redirects: a trusted host must not be able to bounce us elsewhere.
    const res = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      redirect: "error",
    });
    if (!res.ok || !res.body) return null;
    if (Number(res.headers.get("content-length") || 0) > IMAGE_MAX_BYTES) {
      void res.body.cancel().catch(() => {});
      return null;
    }
    // Read with a running cap: a missing or lying content-length must not let
    // a huge file into memory.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > IMAGE_MAX_BYTES) {
        void reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    const data = Buffer.concat(chunks);
    const mimeType = sniffImageType(data);
    return mimeType ? { mimeType, data } : null;
  } catch {
    return null;
  }
}

// ── Taskroom ─────────────────────────────────────────────────────────────────

/** The linked board (or the whole room) no longer exists — relink needed. */
export class BoardGoneError extends Error {}

// Taskroom's own wording: POST tasks answers "Couldn't find the Room Record…"
// / "Couldn't find the Stage Record…", and GET stages/room answers "Couldn't
// find the Room Member Record…" when the ROOM lookup fails.
const ROOM_GONE = /couldn'?t find the room/i;
const BOARD_MISSING =
  /couldn'?t find the (room|stage)|(room|stage|board)\b.{0,30}\bnot found|not found.{0,30}\b(room|stage|board)/i;
// GET stages/room answers 400 with this when the person we act as has a
// Taskroom account but is not on the board. The board is fine — a relink
// would not help — so it is recorded as the link's last error, not "broken".
const NOT_ON_BOARD = /unauthori[sz]ed for this operation/i;

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? "");
}

/** The board's first "to start" column (Backlog), else its first column. */
async function resolveStageId(token: string, roomId: string): Promise<string> {
  let stages: any;
  try {
    stages = await taskroomRequest<any[]>(`stages/room/${roomId}`, { token });
  } catch (e) {
    if (ROOM_GONE.test(errorText(e))) throw new BoardGoneError("The linked Taskroom board no longer exists");
    throw e;
  }
  const stageId = pickLandingStageId(Array.isArray(stages) ? stages : stages?.data || []);
  if (!stageId) throw new BoardGoneError("The linked Taskroom board has no columns");
  return stageId;
}

/**
 * POST the task. When the stored column (or board) is gone, look the board's
 * columns up again, remember the new one on the link, and retry once.
 */
export async function createTaskOnBoard(
  token: string,
  group: any,
  body: Record<string, unknown>
): Promise<any> {
  const link = group.taskroom;
  const payload = { ...body };
  let stageRepaired = false;
  if (!payload.stageId) {
    payload.stageId = await resolveStageId(token, link.roomId);
    stageRepaired = true;
  }
  try {
    const task = await taskroomRequest<any>("tasks", { method: "POST", token, body: payload });
    if (stageRepaired) await rememberStage(group, String(payload.stageId));
    return task;
  } catch (e) {
    if (stageRepaired || !BOARD_MISSING.test(errorText(e))) throw e;
    payload.stageId = await resolveStageId(token, link.roomId);
    await rememberStage(group, String(payload.stageId));
    return taskroomRequest<any>("tasks", { method: "POST", token, body: payload });
  }
}

async function rememberStage(group: any, stageId: string): Promise<void> {
  group.taskroom.stageId = stageId;
  // Guarded on the room so a relink that happened meanwhile is not touched.
  await Group.updateOne(
    { _id: group._id, "taskroom.roomId": group.taskroom.roomId },
    { $set: { "taskroom.stageId": stageId } }
  ).catch(() => {});
}

/**
 * Record a failure on the link for the admin panel. `broken` stops capture
 * until an admin relinks — only for a board that is gone or unreachable by
 * anyone in the group.
 */
async function recordLinkError(group: any, reason: string, broken: boolean): Promise<void> {
  console.warn(
    `[group-task-ai] group=${group._id} ${broken ? "link marked broken" : "link error"}: ${reason}`
  );
  await Group.updateOne(
    { _id: group._id, "taskroom.roomId": group.taskroom.roomId },
    {
      $set: {
        ...(broken ? { "taskroom.status": "broken" } : {}),
        "taskroom.lastError": reason,
        "taskroom.lastErrorAt": new Date(),
      },
    }
  ).catch(() => {});
}

interface TaskroomFile {
  link: string;
  name: string;
  fileType: "image" | "video" | "document";
}

function taskroomFiles(messages: any[]): TaskroomFile[] {
  const out: TaskroomFile[] = [];
  for (const m of messages) {
    for (const a of m?.attachments || []) {
      // Only our own uploads go to Taskroom — see trustedFileOrigins.
      if (!a?.fileUrl || !isTrustedFileUrl(a.fileUrl)) continue;
      const type = String(a.fileType || "").toLowerCase();
      out.push({
        link: a.fileUrl,
        name: a.fileName || String(a.fileUrl).split("/").pop() || "attachment",
        fileType: type.startsWith("image/") ? "image" : type.startsWith("video/") ? "video" : "document",
      });
    }
  }
  return out;
}

/** Attach files to a task; returns how many landed. Never throws. */
export async function attachFiles(
  group: any,
  roomId: string,
  taskId: string,
  files: TaskroomFile[],
  preferUserId: string
): Promise<number> {
  if (!files.length) return 0;
  try {
    await withTaskroomActor(
      group,
      (token) =>
        taskroomRequest("attachments/bulk", {
          method: "POST",
          token,
          body: { roomId, taskId, attachments: files },
        }),
      preferUserId
    );
    return files.length;
  } catch (e) {
    console.warn(`[group-task-ai] group=${group._id} task=${taskId} attach failed:`, errorText(e));
    return 0;
  }
}

// ── Message marks ────────────────────────────────────────────────────────────

/** One entry of GroupMessage.aiTasks — where the task a message fed lives. */
interface AiTaskMark {
  taskId: string;
  roomId: string;
  spaceId?: string;
  workspaceId?: string;
  title: string;
}

/**
 * Put the small "added to Taskroom" mark on the messages a task came from —
 * the trigger and every screenshot message attached to it — and tell the open
 * chats, one `group:message-task` per message with its full `aiTasks` list.
 * Best-effort and never throws: the task exists either way.
 */
async function markMessages(groupId: string, messages: any[], mark: AiTaskMark): Promise<void> {
  const io = getSocketInstance();
  for (const m of messages) {
    try {
      // The `$ne` guard makes a re-run a no-op: no second mark, no emit.
      const updated: any = await GroupMessage.findOneAndUpdate(
        { _id: m._id, groupId, "aiTasks.taskId": { $ne: mark.taskId } },
        { $push: { aiTasks: mark } },
        { new: true }
      )
        .select("aiTasks")
        .lean();
      if (updated && io) {
        io.to(`group:${groupId}`).emit("group:message-task", {
          groupId,
          messageId: String(m._id),
          aiTasks: updated.aiTasks || [],
        });
      }
    } catch (e) {
      console.warn(`[group-task-ai] group=${groupId} msg=${m?._id} mark failed:`, errorText(e));
    }
  }
}

/**
 * Which of these messages still exist and are not deleted. The sender can
 * delete a message while its capture is in flight (deleting a message deletes
 * its task — services/groupTaskRemoval.ts), so this is checked right before
 * and right after filing.
 */
async function liveMessageIds(ids: any[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await GroupMessage.find({ _id: { $in: ids }, deletedAt: null })
    .select("_id")
    .lean();
  return new Set((rows as any[]).map((r) => String(r._id)));
}

// ── Capture ──────────────────────────────────────────────────────────────────

function displayName(u: any): string {
  return u?.name || u?.email?.split("@")[0] || "Someone";
}

function clipText(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

/** What a rich card looks like to the model: `[task card: "Fix login"]`. */
function cardSummary(text: string): { summary: string; taskTitle: string | null } {
  const kind = CARD_MARKER.exec(text)?.[1] || "card";
  let label = "";
  try {
    const data = JSON.parse(text.replace(CARD_MARKER, ""));
    label = String(data?.title || data?.name || data?.question || data?.label || "");
  } catch {
    /* malformed card — the kind alone is enough */
  }
  return {
    summary: label ? `[${kind} card: "${clipText(label, 100)}"]` : `[${kind} card]`,
    taskTitle: kind === "task" && label ? label : null,
  };
}

function taskDescription(
  description: string,
  reporter: string,
  groupName: string,
  at: Date,
  text: string,
  imageCount: number,
  edited = false
): string {
  const date = at.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const label = edited ? "Original message (edited)" : "Original message";
  const original = text
    ? `${label}: "${clipText(text, ORIGINAL_TEXT_MAX)}"`
    : `${label}: [${imageCount} image${imageCount === 1 ? "" : "s"}]`;
  return [
    description.trim(),
    "",
    `Reported by ${reporter} in the "${groupName}" group chat · ${date}`,
    original,
  ].join("\n");
}

/**
 * The member the model named, as a tr2 user id plus display name. The name
 * is matched against the people shown to the model as mentioned; only
 * someone the member sync put on the board qualifies (a Taskroom assignee
 * must be a room member). Anything else leaves the task as it is.
 */
function resolveAssignee(
  name: string | null,
  mentioned: Array<{ id: string; name: string }>,
  members: any[]
): { taskroomUserId: string; name: string } | null {
  const matched = matchMentionedName(name, mentioned.map((m) => m.name));
  const person = matched ? mentioned.find((m) => m.name === matched) : null;
  if (!person) return null;
  const row = (members || []).find(
    (m: any) => String(m.userId) === person.id && m.status === "synced" && m.taskroomUserId
  );
  return row ? { taskroomUserId: String(row.taskroomUserId), name: person.name } : null;
}

function logDecision(
  groupId: string,
  messageId: string,
  result: ClassifierResult,
  decision: CaptureDecision
): void {
  const conf = result.tasks.map((t) => t.confidence.toFixed(2)).join(",");
  const reasons =
    [...result.updates.map((u) => u.reason), ...result.tasks.map((t) => t.reason)]
      .filter(Boolean)
      .join(" | ") || result.analysis;
  const updates = decision.updates.map(
    (u) => `${u.taskRef}${u.assigneeName ? `→${u.assigneeName}` : ""}${u.attachImages ? "+files" : ""}`
  );
  console.log(
    `[group-task-ai] group=${groupId} msg=${messageId} model=${result.model} ` +
      `tasks=${decision.tasks.length} conf=[${conf}]` +
      (updates.length ? ` updates=[${updates.join(",")}]` : "") +
      (decision.duplicates.length ? ` dup=${JSON.stringify(decision.duplicates)}` : "") +
      ` reasons=${JSON.stringify(reasons.slice(0, 300))}`
  );
}

/**
 * The heavy part, under the process-wide slot limit: download the message's
 * screenshots, then the replied-to message's (when no task was filed from
 * it), then the sender's earlier ones (latest first) into whatever room is
 * left, and ask the model. The image buffers exist only inside this call and
 * are garbage once it returns — nothing module-level holds them.
 * Returns null when an image-only message has no image anyone could load.
 */
async function readAndClassify(
  input: Omit<ClassifierInput, "images" | "earlierImages" | "repliedImages">,
  urls: { current: string[]; replied: string[]; earlier: string[] }
): Promise<{ result: ClassifierResult | null; repliedShown: number; earlierShown: number } | null> {
  return withHeavySlot(async () => {
    const load = async (list: string[]) =>
      (await Promise.all(list.map(downloadImage))).filter((i): i is ClassifierImage => !!i);
    const images = await load(urls.current.slice(0, MAX_CLASSIFIER_IMAGES));
    if (!input.message.text && !images.length) return null;
    let room = MAX_CLASSIFIER_IMAGES - images.length;
    const repliedImages =
      room > 0 && urls.replied.length
        ? await load(urls.replied.slice(0, Math.min(room, MAX_REPLIED_IMAGES)))
        : [];
    room -= repliedImages.length;
    const earlierImages =
      room > 0 && urls.earlier.length ? await load(urls.earlier.slice(-room)) : [];
    const result = await classifyGroupMessage({ ...input, images, repliedImages, earlierImages });
    return { result, repliedShown: repliedImages.length, earlierShown: earlierImages.length };
  });
}

async function captureMessage(groupId: string, messageId: string): Promise<void> {
  if (captureDisabled()) return;
  // Re-read inside the queue: the link may have changed while this waited.
  const group: any = await Group.findById(groupId)
    .select("name orgId kind createdBy members taskroom")
    .lean();
  if (!captureEnabled(group)) return;

  const msg: any = await GroupMessage.findById(messageId).lean();
  if (!msg || String(msg.groupId) !== groupId) return;
  if (msg.threadId || !msg.from || msg.type === "system" || msg.agentMeta?.agentId || msg.deletedAt) {
    return;
  }
  // Only current members file work. The socket send path does not check
  // membership, so a removed member with a still-valid login must not be able
  // to spend model calls or put cards on the board.
  if (!(group.members || []).some((m: any) => String(m.userId) === String(msg.from))) {
    return;
  }
  // Already on a task — filed from, attached to, or assigned from.
  if (Array.isArray(msg.aiTasks) && msg.aiTasks.length) return;

  const text = String(msg.text || "").trim();
  const attachments: any[] = Array.isArray(msg.attachments) ? msg.attachments : [];
  const imageAttachments = attachments.filter(isImageAttachment);
  if (CARD_MARKER.test(text)) return;
  if (!imageAttachments.length && isChatter(text)) return;

  // Filed from this message already — a retry, or folded into an earlier task.
  const already = await GroupAiTask.exists({
    groupId: group._id,
    $or: [{ messageId: msg._id }, { sourceMessageIds: msg._id }],
  });
  if (already) return;

  const at = new Date(msg.createdAt || Date.now());
  const since = new Date(at.getTime() - PAIRING_WINDOW_MS);
  const imageOnly = !text && imageAttachments.length > 0;
  const topLevel = { $or: [{ threadId: null }, { threadId: { $exists: false } }] };

  // The message this one replies to. A reply to a task's message — or to its
  // "Task added" pill — is usually about that task ("@Camilla fix this").
  const repliedRaw: any = msg.replyTo
    ? await GroupMessage.findOne({ _id: msg.replyTo, groupId: group._id, deletedAt: null })
        .select("from text attachments createdAt aiTasks type event taskroom")
        .lean()
    : null;
  const repliedPill = repliedRaw?.type === "system" ? repliedRaw : null;
  const replied = repliedRaw && !repliedPill ? repliedRaw : null;
  const repliedTaskIds = [
    ...((replied?.aiTasks || []) as any[]).map((t) => String(t?.taskId || "")),
    String(repliedPill?.taskroom?.taskId || ""),
  ].filter(Boolean);
  const taskFields = "title createdAt fromUserId messageId sourceMessageIds taskroomTaskId roomId";

  const [historyDocs, pairedDocs, recentTaskDocs, repliedTaskDocs] = await Promise.all([
    GroupMessage.find({
      groupId: group._id,
      _id: { $ne: msg._id },
      createdAt: { $lte: at },
      type: { $ne: "system" },
      deletedAt: null,
      ...topLevel,
    })
      .sort({ createdAt: -1 })
      .limit(CONTEXT_MESSAGES)
      .select("from text attachments createdAt agentMeta aiTasks")
      .lean(),
    // The sender's own screenshots posted as separate messages just before.
    GroupMessage.find({
      groupId: group._id,
      from: msg.from,
      _id: { $ne: msg._id },
      createdAt: { $gte: since, $lte: at },
      type: { $ne: "system" },
      deletedAt: null,
      "attachments.0": { $exists: true },
      ...topLevel,
    })
      .sort({ createdAt: 1 })
      .select("text attachments createdAt")
      .lean(),
    GroupAiTask.find({
      groupId: group._id,
      // Current board only: after a relink, old-board tasks are neither
      // duplicates of new work nor something to assign or attach to.
      roomId: String(group.taskroom.roomId),
      createdAt: { $gte: new Date(Date.now() - RECENT_TASK_WINDOW_MS) },
    })
      .sort({ createdAt: -1 })
      .limit(RECENT_TASKS)
      .select(taskFields)
      .lean(),
    replied || repliedTaskIds.length
      ? GroupAiTask.find({
          groupId: group._id,
          roomId: String(group.taskroom.roomId),
          $or: [
            ...(replied ? [{ messageId: replied._id }, { sourceMessageIds: replied._id }] : []),
            ...(repliedTaskIds.length ? [{ taskroomTaskId: { $in: repliedTaskIds } }] : []),
          ],
        })
          .select(taskFields)
          .lean()
      : Promise.resolve([]),
  ]);

  // Earlier screenshots count only while no task has claimed them.
  let paired = (pairedDocs as any[]).filter(
    (d) => !String(d.text || "").trim() && (d.attachments || []).some(isImageAttachment)
  );
  if (paired.length) {
    const claimed = await GroupAiTask.find({
      groupId: group._id,
      sourceMessageIds: { $in: paired.map((d) => d._id) },
    })
      .select("sourceMessageIds")
      .lean();
    const used = new Set(
      (claimed as any[]).flatMap((c) => (c.sourceMessageIds || []).map(String))
    );
    paired = paired.filter((d) => !used.has(String(d._id)));
  }

  // Tasks the model can point at by ref ("T1"): the replied-to message's
  // first, then the chat's recent ones.
  const repliedIds = new Set((repliedTaskDocs as any[]).map((t) => String(t._id)));
  const knownDocs: any[] = [
    ...(repliedTaskDocs as any[]),
    ...(recentTaskDocs as any[]).filter((t) => !repliedIds.has(String(t._id))),
  ].slice(0, MAX_KNOWN_TASKS);
  // An image-only message may illustrate what the sender just reported.
  const senderRecent = imageOnly
    ? knownDocs
        .filter((t) => String(t.fromUserId) === String(msg.from) && new Date(t.createdAt) >= since)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;
  const known = knownDocs.map((doc, i) => ({ ref: `T${i + 1}`, doc }));
  const knownByRef = new Map(known.map((k) => [k.ref, k.doc]));

  const history = (historyDocs as any[]).reverse();
  const mentionIds: string[] = (msg.mentions || []).map(String);
  const userIds = new Set<string>([String(msg.from), ...mentionIds]);
  for (const h of history) if (h.from) userIds.add(String(h.from));
  if (replied?.from) userIds.add(String(replied.from));
  for (const t of knownDocs) if (t.fromUserId) userIds.add(String(t.fromUserId));
  const users = await User.find({ _id: { $in: [...userIds].map((id) => new Types.ObjectId(id)) } })
    .select("name email")
    .lean();
  const userById = new Map((users as any[]).map((u) => [String(u._id), u]));
  const senderName = displayName(userById.get(String(msg.from)));

  const mentioned = mentionIds
    .map((id) => ({ id, user: userById.get(id) }))
    .filter((m) => m.user)
    .map((m) => ({ id: m.id, name: displayName(m.user), email: String(m.user.email || "") }));
  // @all / @here put everyone in `mentions`; show the model only the people
  // actually named in the text — and only they can be assigned.
  const lowered = text.toLowerCase();
  const namedInText = mentioned.filter(
    (m) =>
      lowered.includes(`@${m.name.toLowerCase()}`) ||
      (m.email && lowered.includes(`@${m.email.toLowerCase()}`)) ||
      lowered.includes(`@${m.id}`)
  );

  /** Refs of the known tasks a message was filed from, attached to or assigned from. */
  const refsFor = (m: any): string[] => {
    const id = String(m._id);
    const marks = new Set(((m.aiTasks || []) as any[]).map((t) => String(t?.taskId || "")));
    return known
      .filter(
        ({ doc }) =>
          String(doc.messageId) === id ||
          (doc.sourceMessageIds || []).some((s: any) => String(s) === id) ||
          marks.has(String(doc.taskroomTaskId))
      )
      .map((k) => k.ref);
  };
  const minutesBefore = (d: any) => Math.max(0, (at.getTime() - new Date(d).getTime()) / 60000);
  const shownText = (raw: unknown) => {
    const t = String(raw || "").trim();
    return CARD_MARKER.test(t) ? cardSummary(t).summary : t;
  };

  // Task cards someone created by hand in the last few messages — the model
  // must not file them again, but they cannot be updated from here.
  const cardTitles: string[] = [];
  const historyForModel: ClassifierHistoryMessage[] = history.map((h) => {
    const raw = String(h.text || "").trim();
    if (CARD_MARKER.test(raw)) {
      const title = cardSummary(raw).taskTitle;
      if (title) cardTitles.push(title);
    }
    const files: any[] = h.attachments || [];
    return {
      senderName: h.agentMeta?.agentName || displayName(userById.get(String(h.from))),
      text: shownText(raw),
      imageCount: files.filter((a) => /^image\//i.test(String(a?.fileType || ""))).length,
      fileNames: files
        .filter((a) => !/^image\//i.test(String(a?.fileType || "")))
        .map((a) => String(a?.fileName || "file")),
      minutesAgo: minutesBefore(h.createdAt),
      taskRefs: refsFor(h),
    };
  });

  const knownForModel: ClassifierKnownTask[] = known.map(({ ref, doc }) => ({
    ref,
    title: String(doc.title || ""),
    minutesAgo: minutesBefore(doc.createdAt),
    reporterName: doc.fromUserId ? displayName(userById.get(String(doc.fromUserId))) : undefined,
    repliedTo: repliedIds.has(String(doc._id)),
    fromSenderRecently: !!senderRecent && String(senderRecent._id) === String(doc._id),
  }));
  const replyTo = replied
    ? {
        senderName: displayName(userById.get(String(replied.from))),
        text: shownText(replied.text),
        imageCount: (replied.attachments || []).filter(isImageAttachment).length,
        minutesAgo: minutesBefore(replied.createdAt),
      }
    : repliedPill
      ? { senderName: "Garage", text: String(repliedPill.text || ""), imageCount: 0, minutesAgo: minutesBefore(repliedPill.createdAt) }
      : null;
  // The replied-to message's screenshots are read only while no task was
  // filed from it — then "@Sam fix this" is about what they show.
  const repliedImageUrls: string[] =
    replied && !repliedTaskDocs.length
      ? (replied.attachments || []).filter(isImageAttachment).map((a: any) => String(a.fileUrl))
      : [];

  const read = await readAndClassify(
    {
      groupName: group.name || "Group chat",
      today: at,
      message: {
        senderName,
        text,
        mentionedNames: namedInText.map((m) => m.name),
        imageCount: imageAttachments.length,
        fileNames: attachments.filter((a) => !isImageAttachment(a)).map((a) => String(a.fileName || "file")),
      },
      history: historyForModel,
      recentTaskTitles: cardTitles,
      knownTasks: knownForModel,
      replyTo,
    },
    {
      current: imageAttachments.map((a) => String(a.fileUrl)),
      replied: repliedImageUrls,
      earlier: paired.flatMap((d) =>
        (d.attachments || []).filter(isImageAttachment).map((a: any) => String(a.fileUrl))
      ),
    }
  );
  // Screenshots nobody could load leave an image-only message with nothing to read.
  if (!read) return;
  const { result, repliedShown, earlierShown } = read;
  if (!result) {
    console.warn(`[group-task-ai] group=${groupId} msg=${messageId} no model answer — nothing filed`);
    return;
  }

  const decision = captureDecision(
    result,
    {
      imageOnly,
      hasFiles: attachments.length > 0,
      knownTasks: knownForModel,
      recentTaskTitles: cardTitles,
      mentionedNames: namedInText.map((m) => m.name),
    },
    groupTaskMinConfidence()
  );
  logDecision(groupId, messageId, result, decision);

  // Earlier screenshots travel with the task only when the model tied them to
  // it; the replied-to message's, with a task written from them.
  const withEarlier = earlierShown > 0 && result.useEarlierImages ? paired : [];
  const withReplied = repliedShown > 0 && replied ? [replied] : [];

  if (decision.updates.length) {
    // Same ceiling as new tasks: one message never touches more than a few
    // existing cards, whatever the model (or an injected instruction) says.
    await applyUpdates(group, msg, decision.updates.slice(0, MAX_UPDATES_PER_MESSAGE), knownByRef, {
      mentioned: namedInText,
      // A new task, when there is one, takes the earlier screenshots.
      withEarlier: decision.tasks.length ? [] : withEarlier,
    });
  }
  if (!decision.tasks.length) return;

  await fileTasks(group, msg, decision.tasks, {
    senderName,
    text,
    imageCount: imageAttachments.length,
    at,
    mentioned: namedInText,
    withEarlier,
    withReplied,
  });
}

// ── Follow-ups: changes to a task already on the board ──────────────────────

export type AssignOutcome = "assigned" | "already" | "gone" | "failed";

/**
 * Add one assignee to an existing task. Taskroom's PUT tasks/:id replaces
 * `assignedToIds` wholesale, so the current list is read first and the new
 * person appended — nobody already on the task is dropped. (Two edits landing
 * in the same instant could still race; Taskroom has no atomic add.)
 * `userAddAssignedToIds` is deliberately not sent: it makes Taskroom email the
 * assignee BEFORE saving, and a mail failure there fails the whole edit.
 */
export async function assignTask(
  group: any,
  taskId: string,
  taskroomUserId: string,
  preferUserId: string
): Promise<AssignOutcome> {
  try {
    const { result } = await withTaskroomActor(
      group,
      async (token): Promise<AssignOutcome> => {
        const task = await taskroomRequest<any>(`tasks/${taskId}`, { token });
        // Taskroom deletes by marking the task inactive; GET still returns it.
        if (!task?._id || task.status === "inactive") return "gone";
        const current = ((task.assignedToIds || []) as any[])
          .map((a) => String(a?._id ?? a ?? ""))
          .filter(Boolean);
        if (current.includes(taskroomUserId)) return "already";
        await taskroomRequest(`tasks/${taskId}`, {
          method: "PUT",
          token,
          body: { assignedToIds: [...current, taskroomUserId] },
        });
        return "assigned";
      },
      preferUserId
    );
    return result;
  } catch (e) {
    if (/couldn'?t find the task/i.test(errorText(e))) return "gone";
    console.warn(`[group-task-ai] group=${group._id} task=${taskId} assign failed:`, errorText(e));
    return "failed";
  }
}

/**
 * Apply the model's updates to known tasks: assign a mentioned member, and/or
 * attach this message's files. The message then carries the task's mark.
 * A pure assignment is NOT recorded in the task's sourceMessageIds, so
 * deleting the reply never takes the task down with it; attached screenshots
 * are, so they are never attached twice.
 */
async function applyUpdates(
  group: any,
  msg: any,
  updates: TaskUpdate[],
  knownByRef: Map<string, any>,
  ctx: { mentioned: Array<{ id: string; name: string }>; withEarlier: any[] }
): Promise<void> {
  const link = group.taskroom;
  const senderId = String(msg.from);
  let earlier = ctx.withEarlier;

  for (const u of updates) {
    const doc = knownByRef.get(u.taskRef);
    if (!doc?.taskroomTaskId) continue;
    // Deleted while the model was thinking: leave the task alone.
    const live = await liveMessageIds([msg._id, ...earlier.map((d) => d._id)]);
    if (!live.has(String(msg._id))) return;

    const taskId = String(doc.taskroomTaskId);
    const roomId = String(doc.roomId || link.roomId);
    const mark: AiTaskMark = {
      taskId,
      roomId,
      ...(roomId === String(link.roomId)
        ? { spaceId: link.spaceId, workspaceId: link.workspaceId }
        : {}),
      title: String(doc.title || ""),
    };
    const toMark: any[] = [];
    const outcome: string[] = [];

    if (u.attachImages) {
      const sources = [msg, ...earlier.filter((d) => live.has(String(d._id)))];
      earlier = []; // the first attach takes them
      const count = await attachFiles(group, roomId, taskId, taskroomFiles(sources), senderId);
      if (count) {
        await GroupAiTask.updateOne(
          { _id: doc._id },
          {
            $addToSet: { sourceMessageIds: { $each: sources.map((d) => d._id) } },
            $inc: { attachmentCount: count },
          }
        ).catch(() => {});
        toMark.push(...sources);
      }
      outcome.push(`attached=${count}`);
    }

    if (u.assigneeName) {
      const person = resolveAssignee(u.assigneeName, ctx.mentioned, link.members);
      if (!person) {
        outcome.push(`assignee "${u.assigneeName}" is not on the board`);
      } else {
        const assigned = await assignTask(group, taskId, person.taskroomUserId, senderId);
        outcome.push(`assign ${person.name}: ${assigned}`);
        if (assigned === "assigned") {
          void writeGroupSystemMessage({
            groupId: group._id,
            event: "ai_task_assigned",
            actorId: senderId,
            meta: { taskTitle: mark.title, assigneeName: person.name },
            taskroom: { ...mark },
          });
        }
        if ((assigned === "assigned" || assigned === "already") && !toMark.includes(msg)) {
          toMark.push(msg);
        }
      }
    }

    console.log(
      `[group-task-ai] group=${group._id} msg=${msg._id} update ${u.taskRef} task=${taskId} ${outcome.join(", ")}`
    );
    if (toMark.length) void markMessages(String(group._id), toMark, mark);
  }
}

// ── New tasks ────────────────────────────────────────────────────────────────

async function fileTasks(
  group: any,
  msg: any,
  tasks: ClassifiedTask[],
  ctx: {
    senderName: string;
    text: string;
    imageCount: number;
    at: Date;
    mentioned: Array<{ id: string; name: string }>;
    withEarlier: any[];
    withReplied: any[];
    /** Items an edit adds are numbered after the message's existing tasks. */
    firstItemIndex?: number;
    /** The footer quotes an edited message. */
    edited?: boolean;
  }
): Promise<void> {
  const link = group.taskroom;
  const reporterId = String(msg.from);
  const extras = [...ctx.withEarlier, ...ctx.withReplied];

  for (let i = 0; i < tasks.length; i++) {
    const itemIndex = (ctx.firstItemIndex ?? 0) + i;
    const t = tasks[i];
    const assignee = resolveAssignee(t.assigneeName, ctx.mentioned, link.members);

    // Deleted while the model was thinking: file nothing (and no screenshot
    // that was deleted goes on the task either).
    const live = await liveMessageIds([msg._id, ...extras.map((d) => d._id)]);
    if (!live.has(String(msg._id))) {
      console.log(`[group-task-ai] group=${group._id} msg=${msg._id} deleted before filing — skipped`);
      return;
    }

    let task: any;
    try {
      ({ result: task } = await withTaskroomActor(
        group,
        (token) =>
          createTaskOnBoard(token, group, {
            roomId: link.roomId,
            stageId: link.stageId,
            title: t.title,
            description: taskDescription(
              t.description,
              ctx.senderName,
              group.name || "Group chat",
              ctx.at,
              ctx.text,
              ctx.imageCount,
              ctx.edited
            ),
            priority: t.priority,
            assignedToIds: assignee ? [assignee.taskroomUserId] : [],
          }),
        reporterId
      ));
    } catch (e) {
      if (e instanceof BoardGoneError) {
        await recordLinkError(group, e.message, true);
      } else if (e instanceof NoTaskroomActorError) {
        // Taskroom answers ANY internal failure (a database hiccup included)
        // with 401, which is what exhausts the candidates. Marking the link
        // broken would silently switch capture off for good, so it is only
        // recorded — the next message tries again.
        await recordLinkError(group, e.message, false);
      } else if (NOT_ON_BOARD.test(errorText(e))) {
        await recordLinkError(
          group,
          "Couldn't add an AI task: the account used is not a member of the linked board",
          false
        );
      } else {
        console.warn(`[group-task-ai] group=${group._id} msg=${msg._id} task create failed:`, errorText(e));
      }
      return; // the rest would fail the same way
    }
    const taskId = task?._id ? String(task._id) : "";
    if (!taskId) {
      console.warn(`[group-task-ai] group=${group._id} msg=${msg._id} Taskroom returned no task id`);
      return;
    }

    // Files go on the first task only — several tasks from one message would
    // otherwise all carry the same screenshots.
    const sources =
      itemIndex === 0 ? [msg, ...extras.filter((d) => live.has(String(d._id)))] : [msg];
    const attachmentCount =
      itemIndex === 0
        ? await attachFiles(group, link.roomId, taskId, taskroomFiles(sources), reporterId)
        : 0;

    try {
      await GroupAiTask.create({
        groupId: group._id,
        orgId: group.orgId,
        messageId: msg._id,
        itemIndex,
        sourceMessageIds: sources.map((d) => d._id),
        fromUserId: msg.from,
        taskroomTaskId: taskId,
        roomId: link.roomId,
        priority: t.priority,
        confidence: t.confidence,
        title: t.title,
        attachmentCount,
      });
    } catch (e: any) {
      if (e?.code === 11000) {
        console.warn(
          `[group-task-ai] group=${group._id} msg=${msg._id} item=${itemIndex} already captured — Taskroom task ${taskId} is a duplicate`
        );
        continue;
      }
      console.warn(`[group-task-ai] group=${group._id} msg=${msg._id} record failed:`, errorText(e));
    }

    // Deleted while the task was being filed: the delete route ran before
    // this task existed, so take it down here instead of announcing it.
    if (!(await liveMessageIds([msg._id])).has(String(msg._id))) {
      console.log(
        `[group-task-ai] group=${group._id} msg=${msg._id} deleted while filing — removing task ${taskId}`
      );
      await removeAiTasksForDeletedMessage(String(group._id), String(msg._id), reporterId);
      return;
    }

    void markMessages(String(group._id), sources, {
      taskId,
      roomId: link.roomId,
      spaceId: link.spaceId,
      workspaceId: link.workspaceId,
      title: t.title,
    });
    void writeGroupSystemMessage({
      groupId: group._id,
      event: "ai_task_created",
      actorId: reporterId,
      meta: { taskTitle: t.title },
      taskroom: {
        taskId,
        roomId: link.roomId,
        spaceId: link.spaceId,
        workspaceId: link.workspaceId,
        title: t.title,
      },
    });
  }
}

// ── Edits ────────────────────────────────────────────────────────────────────
//
// When the sender edits a message a task was filed from, the task follows: the
// model says what the edit changed, the task is rewritten in Taskroom, and its
// footer quotes the edited text. A message edited into work is captured like
// a new one. Nothing is deleted here — deleting the message or "Remove from
// Taskroom" does that — so an edit to "nvm, fixed" only updates the footer.
//
// Not handled: edits to assignment/attachment follow-ups (the task they touched
// stays as it is), and @mentions added by an edit (the edit route does not
// re-parse mentions, so nobody new can be assigned this way).

/** Latest edit already synced per message: a burst of quick edits syncs once. */
const syncedEdits = new Map<string, number>();
const SYNCED_EDITS_MAX = 500;

function rememberSyncedEdit(messageId: string, editedAt: number): void {
  syncedEdits.delete(messageId);
  syncedEdits.set(messageId, editedAt);
  if (syncedEdits.size > SYNCED_EDITS_MAX) {
    const oldest = syncedEdits.keys().next().value;
    if (oldest) syncedEdits.delete(oldest);
  }
}

/**
 * Entry point from the message-edit route. Never throws. Runs on the group's
 * capture queue, so an edit that lands while the message itself is still
 * waiting to be captured is handled after it.
 */
export async function maybeUpdateGroupTaskForEdit(
  groupId: string,
  messageId: string,
  editorId: string
): Promise<void> {
  try {
    if (captureDisabled()) return;
    if (!Types.ObjectId.isValid(groupId) || !Types.ObjectId.isValid(messageId)) return;
    await enqueue(String(groupId), () =>
      syncEditedMessage(String(groupId), String(messageId), String(editorId))
    );
  } catch (e: any) {
    console.warn("[group-task-ai] edit sync failed:", e?.message || e);
  }
}

async function syncEditedMessage(groupId: string, messageId: string, editorId: string): Promise<void> {
  if (captureDisabled()) return;
  const group: any = await Group.findById(groupId)
    .select("name orgId kind createdBy members taskroom")
    .lean();
  if (!captureEnabled(group)) return;

  const msg: any = await GroupMessage.findById(messageId).lean();
  if (!msg || String(msg.groupId) !== groupId) return;
  if (msg.threadId || !msg.from || msg.type === "system" || msg.agentMeta?.agentId || msg.deletedAt) {
    return;
  }
  // The route only lets senders edit their own messages; same membership rule as capture.
  if (String(msg.from) !== editorId) return;
  if (!(group.members || []).some((m: any) => String(m.userId) === String(msg.from))) return;

  const editedAt = msg.editedAt ? new Date(msg.editedAt).getTime() : 0;
  if (!editedAt || (syncedEdits.get(messageId) ?? 0) >= editedAt) return;
  rememberSyncedEdit(messageId, editedAt);

  // Current board only, like capture: tasks left on a board the group was
  // unlinked from are not touched.
  const filed: any[] = await GroupAiTask.find({
    groupId: group._id,
    messageId: msg._id,
    roomId: String(group.taskroom.roomId),
  })
    .sort({ itemIndex: 1 })
    .lean();
  if (!filed.length) {
    // Chat edited into work is captured like a new message. captureMessage
    // skips anything already on a task (follow-ups, attached screenshots).
    await captureMessage(groupId, messageId);
    return;
  }
  // Every task is revised, even one filed after the edit: its capture may have
  // read the text before the edit landed. When nothing changed the model says
  // so, and only the footer is refreshed — no pill.
  await reviseFiledTasks(group, msg, filed);
}

/** Our footer, split off a task description: the body, and the text it quotes. */
function splitDescription(desc: string): { body: string; quoted: string | null } {
  const i = desc.lastIndexOf("\n\nReported by ");
  if (i < 0) return { body: desc.trim(), quoted: null };
  const m = /\nOriginal message(?: \(edited\))?: "([\s\S]*)"\s*$/.exec(desc.slice(i));
  return { body: desc.slice(0, i).trim(), quoted: m ? m[1] : null };
}

interface BoardTask {
  title: string;
  description: string;
  priority: GroupTaskPriority;
}

/** The tasks as they are on the board now; missing or deleted ones are left out. */
async function readBoardTasks(
  group: any,
  taskIds: string[],
  preferUserId: string
): Promise<Map<string, BoardTask>> {
  const found = new Map<string, BoardTask>();
  try {
    await withTaskroomActor(
      group,
      async (token) => {
        for (const id of taskIds) {
          try {
            const t = await taskroomRequest<any>(`tasks/${id}`, { token });
            // Taskroom deletes by marking the task inactive; GET still returns it.
            if (!t?._id || t.status === "inactive") continue;
            const priority = ["low", "normal", "high", "urgent"].includes(t.priority)
              ? (t.priority as GroupTaskPriority)
              : "normal";
            found.set(id, {
              title: String(t.title || ""),
              description: String(t.description || ""),
              priority,
            });
          } catch (e) {
            if (/couldn'?t find the task/i.test(errorText(e))) continue;
            throw e;
          }
        }
      },
      preferUserId
    );
  } catch (e) {
    console.warn(`[group-task-ai] group=${group._id} could not read tasks for an edit:`, errorText(e));
  }
  return found;
}

/**
 * Give every message mark of a task its new title, and tell the open chats
 * (`group:message-task` per message, with its full `aiTasks` list).
 */
async function retitleMarks(groupId: string, taskId: string, title: string): Promise<void> {
  try {
    const gid = new Types.ObjectId(groupId);
    await GroupMessage.updateMany(
      { groupId: gid, "aiTasks.taskId": taskId },
      { $set: { "aiTasks.$[m].title": title } },
      { arrayFilters: [{ "m.taskId": taskId }] }
    );
    const io = getSocketInstance();
    if (!io) return;
    const rows: any[] = await GroupMessage.find({ groupId: gid, "aiTasks.taskId": taskId })
      .select("aiTasks")
      .lean();
    for (const m of rows) {
      io.to(`group:${groupId}`).emit("group:message-task", {
        groupId,
        messageId: String(m._id),
        aiTasks: m.aiTasks || [],
      });
    }
  } catch (e) {
    console.warn(`[group-task-ai] group=${groupId} task=${taskId} retitle marks failed:`, errorText(e));
  }
}

async function reviseFiledTasks(group: any, msg: any, filed: any[]): Promise<void> {
  const link = group.taskroom;
  const groupId = String(group._id);
  const senderId = String(msg.from);

  const onBoard = await readBoardTasks(
    group,
    filed.map((t) => String(t.taskroomTaskId)),
    senderId
  );
  const targets = filed
    .filter((t) => onBoard.has(String(t.taskroomTaskId)))
    .map((doc, i) => ({ ref: `T${i + 1}`, doc, board: onBoard.get(String(doc.taskroomTaskId))! }));
  if (!targets.length) return;

  const at = new Date(msg.createdAt || Date.now());
  const text = String(msg.text || "").trim();
  const attachments: any[] = Array.isArray(msg.attachments) ? msg.attachments : [];
  const imageAttachments = attachments.filter(isImageAttachment);
  const topLevel = { $or: [{ threadId: null }, { threadId: { $exists: false } }] };

  const [historyDocs, otherDocs] = await Promise.all([
    GroupMessage.find({
      groupId: group._id,
      _id: { $ne: msg._id },
      createdAt: { $lte: at },
      type: { $ne: "system" },
      deletedAt: null,
      ...topLevel,
    })
      .sort({ createdAt: -1 })
      .limit(CONTEXT_MESSAGES)
      .select("from text attachments createdAt agentMeta")
      .lean(),
    GroupAiTask.find({
      groupId: group._id,
      roomId: String(link.roomId),
      messageId: { $ne: msg._id },
      createdAt: { $gte: new Date(Date.now() - RECENT_TASK_WINDOW_MS) },
    })
      .sort({ createdAt: -1 })
      .limit(RECENT_TASKS)
      .select("title")
      .lean(),
  ]);
  const history = (historyDocs as any[]).reverse();
  const mentionIds: string[] = (msg.mentions || []).map(String);
  const userIds = new Set<string>([senderId, ...mentionIds]);
  for (const h of history) if (h.from) userIds.add(String(h.from));
  const users = await User.find({ _id: { $in: [...userIds].map((id) => new Types.ObjectId(id)) } })
    .select("name email")
    .lean();
  const userById = new Map((users as any[]).map((u) => [String(u._id), u]));
  const senderName = displayName(userById.get(senderId));
  const lowered = text.toLowerCase();
  const namedInText = mentionIds
    .map((id) => ({ id, user: userById.get(id) }))
    .filter((m) => m.user)
    .map((m) => ({ id: m.id, name: displayName(m.user), email: String(m.user.email || "") }))
    .filter(
      (m) =>
        lowered.includes(`@${m.name.toLowerCase()}`) ||
        (m.email && lowered.includes(`@${m.email.toLowerCase()}`))
    );

  const tasksForModel: EditTaskInput[] = targets.map(({ ref, board }) => ({
    ref,
    title: board.title,
    description: splitDescription(board.description).body,
    priority: board.priority,
  }));
  const input = {
    groupName: group.name || "Group chat",
    today: at,
    message: {
      senderName,
      previousText: splitDescription(targets[0].board.description).quoted,
      text,
      mentionedNames: namedInText.map((m) => m.name),
      imageCount: imageAttachments.length,
      fileNames: attachments.filter((a) => !isImageAttachment(a)).map((a) => String(a.fileName || "file")),
    },
    history: history.map((h) => {
      const raw = String(h.text || "").trim();
      const files: any[] = h.attachments || [];
      return {
        senderName: h.agentMeta?.agentName || displayName(userById.get(String(h.from))),
        text: CARD_MARKER.test(raw) ? cardSummary(raw).summary : raw,
        imageCount: files.filter((a) => /^image\//i.test(String(a?.fileType || ""))).length,
        minutesAgo: Math.max(0, (at.getTime() - new Date(h.createdAt).getTime()) / 60000),
      };
    }),
    tasks: tasksForModel,
    otherTaskTitles: (otherDocs as any[]).map((t) => String(t.title || "")).filter(Boolean),
  };

  // Images and the model call, under the same process-wide limit as capture;
  // the image buffers do not outlive this call.
  const result = await withHeavySlot(async () => {
    const images = (
      await Promise.all(
        imageAttachments.slice(0, MAX_CLASSIFIER_IMAGES).map((a) => downloadImage(String(a.fileUrl)))
      )
    ).filter((i): i is ClassifierImage => !!i);
    return reviseTasksForEdit({ ...input, images });
  });
  if (!result) {
    console.warn(`[group-task-ai] group=${groupId} msg=${msg._id} edit: no model answer — tasks left as they are`);
    return;
  }
  const decision = editDecision(result, input, groupTaskMinConfidence());
  console.log(
    `[group-task-ai] group=${groupId} msg=${msg._id} edit model=${result.model} ` +
      `retracted=${decision.retracted} changed=[${decision.revisions
        .filter((r) => r.titleChanged || r.bodyChanged || r.priorityChanged)
        .map((r) => r.taskRef)
        .join(",")}] new=${decision.newTasks.length} analysis=${JSON.stringify(result.analysis.slice(0, 200))}`
  );

  // Deleted while the model was thinking: the delete route has taken the
  // tasks down; do not write to them.
  if (!(await liveMessageIds([msg._id])).has(String(msg._id))) return;

  for (const [i, rev] of decision.revisions.entries()) {
    const { doc, board } = targets[i];
    const taskId = String(doc.taskroomTaskId);
    const roomId = String(doc.roomId || link.roomId);
    // Every edit refreshes the footer's quote; only a changed request
    // rewrites the title and body.
    const description = taskDescription(
      rev.description,
      senderName,
      group.name || "Group chat",
      at,
      text,
      imageAttachments.length,
      true
    );
    try {
      await withTaskroomActor(
        group,
        (token) =>
          taskroomRequest(`tasks/${taskId}`, {
            method: "PUT",
            token,
            body: { title: rev.title || board.title, description, priority: rev.priority },
          }),
        senderId
      );
    } catch (e) {
      console.warn(`[group-task-ai] group=${groupId} task=${taskId} edit update failed:`, errorText(e));
      continue;
    }

    if (rev.titleChanged || rev.priorityChanged) {
      await GroupAiTask.updateOne(
        { _id: doc._id },
        { $set: { title: rev.title, priority: rev.priority } }
      ).catch(() => {});
    }
    if (rev.titleChanged) await retitleMarks(groupId, taskId, rev.title);
    if (rev.titleChanged || rev.bodyChanged) {
      void writeGroupSystemMessage({
        groupId: group._id,
        event: "ai_task_updated",
        actorId: senderId,
        meta: { taskTitle: rev.title },
        taskroom: {
          taskId,
          roomId,
          ...(roomId === String(link.roomId)
            ? { spaceId: link.spaceId, workspaceId: link.workspaceId }
            : {}),
          title: rev.title,
        },
      });
    }
  }

  // New items the edit added become tasks of their own, after the message's
  // existing ones (the message's files are already on its first task).
  if (decision.newTasks.length) {
    // Next free slot in the unique {messageId, itemIndex} index, on any board.
    const last: any = await GroupAiTask.findOne({ messageId: msg._id })
      .sort({ itemIndex: -1 })
      .select("itemIndex")
      .lean();
    const firstItemIndex = (Number(last?.itemIndex) || 0) + 1;
    await fileTasks(group, msg, decision.newTasks, {
      senderName,
      text,
      imageCount: imageAttachments.length,
      at,
      mentioned: namedInText,
      withEarlier: [],
      withReplied: [],
      firstItemIndex,
      edited: true,
    });
  }
}
