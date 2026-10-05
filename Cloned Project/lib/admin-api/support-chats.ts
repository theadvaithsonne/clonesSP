// Typed client for the Support Chats admin API.
//
// Backend: garagenew-backend src/routes/garageAdminSupportChats.ts, live at
// /garage-admin/support-chats/*. Every call goes through garageAdminApi, which
// attaches the admin JWT and throws Error(message) on any non-2xx — so callers
// catch and surface `err.message` (the backend's own `error`/`message` string,
// e.g. the 409 "no app account" text, which is meant to be shown as-is).
//
// Responses are the console envelope { success, data }; each helper returns
// `.data`.

import { garageAdminApi } from "@/lib/api";

export type SupportChatFilter = "all" | "unanswered" | "mine";

export interface SupportPerson {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  profilePicture?: string | null;
  country?: string | null;
}

export interface SupportAgent {
  id: string;
  name: string | null;
  email: string | null;
  profilePicture?: string | null;
}

export interface SupportLastMessage {
  text: string;
  fromId: string;
  fromName: string | null;
  fromStaff: boolean;
  hasAttachments: boolean;
  at: string;
}

export interface SupportChatListItem {
  groupId: string;
  name: string;
  /** null when the subject account was deleted — the backend's userCard(null)
   *  returns null, so every consumer must guard this. */
  user: SupportPerson | null;
  upline: SupportPerson | null;
  assignedAgent: SupportAgent | null;
  lastMessage: SupportLastMessage | null;
  awaitingReply: boolean;
  unread: boolean;
  memberCount: number;
  activityAt: string;
}

export interface SupportChatCounts {
  all: number;
  unanswered: number;
  mine: number;
}

export interface SupportChatListData {
  chats: SupportChatListItem[];
  total: number;
  page: number;
  limit: number;
  counts: SupportChatCounts;
}

export interface SupportChatMember extends SupportPerson {
  role: "member" | "admin";
  isMember: boolean;
  isUpline: boolean;
  isStaff: boolean;
}

export interface SupportChatDetails {
  groupId: string;
  name: string;
  picture: string | null;
  /** The calling admin's own APP user id — compare with message.from to
   *  right-align the admin's messages. */
  me: string;
  /** null when the subject account was deleted (see SupportChatListItem.user). */
  user:
    | (SupportPerson & {
        city?: string | null;
        state?: string | null;
        joinedAt?: string | null;
      })
    | null;
  uplineId: string | null;
  assignedAgent: SupportAgent | null;
  members: SupportChatMember[];
}

export interface SupportAttachment {
  fileName: string;
  fileSize?: number;
  fileType?: string;
  fileUrl: string;
  [k: string]: unknown;
}

export interface SupportMessage {
  _id: string;
  groupId: string;
  /** Absent on system rows. */
  from?: string;
  text: string;
  attachments?: SupportAttachment[];
  mentions?: string[];
  replyTo?: SupportMessage | null;
  reactions?: Record<string, string[]>;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  // System rows:
  type?: "system";
  event?: string;
  actorId?: string;
}

export interface SupportMessageUser {
  name: string | null;
  email: string | null;
  profilePicture?: string | null;
  isStaff: boolean;
  isMember: boolean;
}

export interface SupportMessagesData {
  items: SupportMessage[];
  /** How far the customer has read (their lastReadAt) — drives ✓ / ✓✓. */
  readUpTo?: string | null;
  /** Pass back as `cursor` to load older messages; null when at the top. */
  nextCursor: string | null;
  users: Record<string, SupportMessageUser>;
}

// Must match TRANSLATE_LANGUAGES in garagenew-backend
// src/services/messageTranslation.ts — the backend rejects any other code.
export const SUPPORT_LANGS = [
  { code: "en", label: "English" },
  // Indian languages (all 22 scheduled), native name + English.
  { code: "hi", label: "हिन्दी · Hindi" },
  { code: "bn", label: "বাংলা · Bengali" },
  { code: "te", label: "తెలుగు · Telugu" },
  { code: "mr", label: "मराठी · Marathi" },
  { code: "ta", label: "தமிழ் · Tamil" },
  { code: "ur", label: "اردو · Urdu", rtl: true },
  { code: "gu", label: "ગુજરાતી · Gujarati" },
  { code: "kn", label: "ಕನ್ನಡ · Kannada" },
  { code: "ml", label: "മലയാളം · Malayalam" },
  { code: "or", label: "ଓଡ଼ିଆ · Odia" },
  { code: "pa", label: "ਪੰਜਾਬੀ · Punjabi" },
  { code: "as", label: "অসমীয়া · Assamese" },
  { code: "mai", label: "मैथिली · Maithili" },
  { code: "sa", label: "संस्कृतम् · Sanskrit" },
  { code: "ks", label: "کٲشُر · Kashmiri", rtl: true },
  { code: "ne", label: "नेपाली · Nepali" },
  { code: "sd", label: "سنڌي · Sindhi", rtl: true },
  { code: "kok", label: "कोंकणी · Konkani" },
  { code: "doi", label: "डोगरी · Dogri" },
  { code: "mni", label: "ꯃꯤꯇꯩꯂꯣꯟ · Manipuri" },
  { code: "brx", label: "बड़ो · Bodo" },
  { code: "sat", label: "ᱥᱟᱱᱛᱟᱲᱤ · Santali" },
  // Other
  { code: "es", label: "Español · Spanish" },
  { code: "fr", label: "Français · French" },
  { code: "ar", label: "العربية · Arabic", rtl: true },
  { code: "zh", label: "中文 · Chinese" },
] as const satisfies readonly { code: string; label: string; rtl?: boolean }[];

export type SupportLang = (typeof SUPPORT_LANGS)[number]["code"];

export interface SupportTranslateData {
  lang: SupportLang;
  translations: Record<string, string>;
}

const BASE = "/garage-admin/support-chats";

function qs(params: Record<string, string | number | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
}

export async function listSupportChats(params: {
  filter?: SupportChatFilter;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<SupportChatListData> {
  const res = await garageAdminApi<{ success: boolean; data: SupportChatListData }>(
    `${BASE}${qs({
      filter: params.filter,
      q: params.q,
      page: params.page,
      limit: params.limit,
    })}`,
  );
  return res.data;
}

export async function getSupportChat(
  groupId: string,
): Promise<SupportChatDetails> {
  const res = await garageAdminApi<{ success: boolean; data: SupportChatDetails }>(
    `${BASE}/${groupId}`,
  );
  return res.data;
}

export async function getSupportMessages(
  groupId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<SupportMessagesData> {
  const res = await garageAdminApi<{ success: boolean; data: SupportMessagesData }>(
    `${BASE}/${groupId}/messages${qs({
      cursor: params.cursor,
      limit: params.limit,
    })}`,
  );
  return res.data;
}

export interface OutgoingAttachment {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileUrl: string;
  fileKey?: string;
}

export async function sendSupportReply(
  groupId: string,
  body: {
    text?: string;
    replyTo?: string;
    attachments?: OutgoingAttachment[];
    /** App-user ids tagged in the message (@mentions). */
    mentions?: string[];
  },
): Promise<SupportMessage> {
  const res = await garageAdminApi<{
    success: boolean;
    data: { message: SupportMessage };
  }>(`${BASE}/${groupId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data.message;
}

/** Upload a file for a reply; returns the attachment to pass to sendSupportReply. */
export async function uploadSupportAttachment(
  file: File,
): Promise<OutgoingAttachment> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await garageAdminApi<{
    success: boolean;
    data: OutgoingAttachment;
  }>(`${BASE}/upload`, { method: "POST", body: fd });
  return res.data;
}

/** Toggle the admin's emoji reaction on a message. Returns the full map. */
export async function reactToSupportMessage(
  groupId: string,
  messageId: string,
  emoji: string,
): Promise<{ messageId: string; reactions: Record<string, string[]> }> {
  const res = await garageAdminApi<{
    success: boolean;
    data: { messageId: string; reactions: Record<string, string[]> };
  }>(`${BASE}/${groupId}/messages/${messageId}/react`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
  return res.data;
}

/** Edit a message the admin sent (own messages only). */
export async function editSupportMessage(
  groupId: string,
  messageId: string,
  text: string,
): Promise<{ messageId: string; text: string; editedAt: string }> {
  const res = await garageAdminApi<{
    success: boolean;
    data: { messageId: string; text: string; editedAt: string };
  }>(`${BASE}/${groupId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
  return res.data;
}

/** Add an app user to the support chat as a member (idempotent). */
export async function addSupportMember(
  groupId: string,
  userId: string,
): Promise<{ added: boolean; member: SupportPerson }> {
  const res = await garageAdminApi<{
    success: boolean;
    data: { added: boolean; member: SupportPerson };
  }>(`${BASE}/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  return res.data;
}

/** Who is currently typing in this chat (for the "X is typing…" indicator). */
export async function getSupportTyping(
  groupId: string,
): Promise<{ id: string; name: string }[]> {
  const res = await garageAdminApi<{
    success: boolean;
    data: { typing: { id: string; name: string }[] };
  }>(`${BASE}/${groupId}/typing`);
  return res.data?.typing || [];
}

export async function markSupportChatRead(groupId: string): Promise<void> {
  await garageAdminApi<{ success: boolean }>(`${BASE}/${groupId}/read`, {
    method: "POST",
  });
}

export async function translateSupportMessages(
  groupId: string,
  body: { messageIds: string[]; lang: SupportLang },
): Promise<SupportTranslateData> {
  const res = await garageAdminApi<{
    success: boolean;
    data: SupportTranslateData;
  }>(`${BASE}/${groupId}/translate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export interface CreateTicketResult {
  ticket: {
    _id: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    groupId?: string;
  };
  /** true when a ticket was already open for this chat (none created). */
  existed: boolean;
}

/**
 * Raise a support ticket from a chat — optionally seeded by one message. One
 * open ticket per chat: if one is already open the backend returns it with
 * existed:true rather than creating a duplicate.
 */
export async function createTicketFromChat(
  groupId: string,
  body: {
    sourceMessageId?: string;
    subject?: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "urgent";
  } = {},
): Promise<CreateTicketResult> {
  const res = await garageAdminApi<{ success: boolean; data: CreateTicketResult }>(
    `${BASE}/${groupId}/ticket`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

export interface TicketSuggestion {
  suggest: boolean;
  subject?: string;
  summary?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  reason?: string;
  /** "ai" when the model answered, "rules" when it fell back to keywords. */
  source?: "ai" | "rules";
  openTicketId?: string | null;
}

/**
 * AI (with a rule-based fallback) triage for whether this chat should become a
 * ticket. Never throws a meaningful error on the model's behalf — a failure
 * comes back as { suggest: false }.
 */
export async function getTicketSuggestion(
  groupId: string,
): Promise<TicketSuggestion> {
  const res = await garageAdminApi<{ success: boolean; data: TicketSuggestion }>(
    `${BASE}/${groupId}/ticket-suggestion`,
  );
  return res.data;
}

export async function ensureSupportChat(userId: string): Promise<string> {
  const res = await garageAdminApi<{
    success: boolean;
    data: { groupId: string };
  }>(`${BASE}/ensure/${userId}`, { method: "POST" });
  return res.data.groupId;
}

// ── Taskroom (Rehan's group-chat features, for support chats) ──────────────
// A chat files onto its own board when an admin gave it one, otherwise onto
// the shared support board. Tasks are unassigned — assign them in Taskroom.

export interface SupportChatTaskroom {
  /** True when this chat has its own board (vs the shared support board). */
  own: boolean;
  board: {
    workspaceId: string;
    workspaceName: string | null;
    roomId: string;
    roomName: string | null;
  } | null;
}

export interface SupportChatTask {
  taskId: string;
  title: string;
  priority: string;
  stageName?: string;
  stageColor?: string;
  isCompleted: boolean;
  status: string;
  reporterName: string;
  createdAt?: string;
}

export type SupportTaskPriority = "low" | "normal" | "high" | "urgent";

export async function getSupportChatTaskroom(groupId: string): Promise<SupportChatTaskroom> {
  const res = await garageAdminApi<{ success: boolean; data: SupportChatTaskroom }>(
    `${BASE}/${groupId}/taskroom`,
  );
  return res.data;
}

export async function linkSupportChatTaskroom(
  groupId: string,
  workspaceId: string,
  roomId: string,
): Promise<SupportChatTaskroom> {
  const res = await garageAdminApi<{ success: boolean; data: SupportChatTaskroom }>(
    `${BASE}/${groupId}/taskroom`,
    { method: "PUT", body: JSON.stringify({ workspaceId, roomId }) },
  );
  return res.data;
}

export async function unlinkSupportChatTaskroom(groupId: string): Promise<SupportChatTaskroom> {
  const res = await garageAdminApi<{ success: boolean; data: SupportChatTaskroom }>(
    `${BASE}/${groupId}/taskroom`,
    { method: "DELETE" },
  );
  return res.data;
}

export async function listSupportChatTasks(
  groupId: string,
): Promise<{ tasks: SupportChatTask[]; live: boolean }> {
  const res = await garageAdminApi<{
    success: boolean;
    data: { tasks: SupportChatTask[]; live: boolean };
  }>(`${BASE}/${groupId}/taskroom/tasks`);
  return { tasks: res.data.tasks || [], live: res.data.live };
}

/** Add a task by hand, or from a message (`sourceMessageId`: title/body/files default to it). */
export async function addSupportChatTask(
  groupId: string,
  body: {
    title?: string;
    description?: string;
    priority?: SupportTaskPriority;
    sourceMessageId?: string;
  },
): Promise<{ taskId: string; title: string }> {
  const res = await garageAdminApi<{ success: boolean; data: { taskId: string; title: string } }>(
    `${BASE}/${groupId}/taskroom/tasks`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

export async function removeSupportChatTask(groupId: string, taskId: string): Promise<void> {
  await garageAdminApi(`${BASE}/${groupId}/taskroom/tasks/${taskId}`, { method: "DELETE" });
}

/** Delete a message for everyone (staff can remove any message in a support chat). */
export async function deleteSupportMessage(groupId: string, messageId: string): Promise<void> {
  await garageAdminApi(`${BASE}/${groupId}/messages/${messageId}`, { method: "DELETE" });
}
