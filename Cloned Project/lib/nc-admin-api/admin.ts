/**
 * NetworkChains super-admin API client, ported from the NC web app.
 *
 * Identical surface to networkchains-web-app `lib/api/admin.ts` so the ported
 * pages import the same names — only the transport changed: auth now comes from
 * ./auth (garage→NC silent elevation) instead of the NC OTP flow.
 *
 * Source of truth for behaviour remains contacts-backend's /admin routes.
 */

import { ncAdminFetch, ncAdminFetchRaw, NcAdminApiError } from "./auth";

export {
  NcAdminUnauthorizedError as AdminUnauthorizedError,
  NcAdminApiError as AdminApiError,
  getNcAdminToken as getAdminToken,
  clearNcAdminToken as clearAdminToken,
} from "./auth";

// ── Product enum + labels ───────────────────────────────────────────────────

export type AdminProduct =
  | "earngpt"
  | "earngpt_live"
  | "note_taker"
  | "memo"
  | "clipper"
  | "dubbing";

export const ADMIN_PRODUCTS: AdminProduct[] = [
  "earngpt",
  "earngpt_live",
  "note_taker",
  "memo",
  "clipper",
  "dubbing",
];

export const PRODUCT_LABELS: Record<AdminProduct, string> = {
  earngpt: "EarnGPT",
  earngpt_live: "EarnGPT Live",
  note_taker: "Note-taker",
  memo: "Memo",
  clipper: "Clipper",
  dubbing: "Dubbing",
};

// ── Response types ──────────────────────────────────────────────────────────

export type ProductCostMap = Partial<Record<AdminProduct, number>>;

export interface UsageUserRow {
  userId: string;
  name: string;
  email: string;
  totalCostCents: number;
  byProduct: ProductCostMap;
}

export interface UsageUsersData {
  from: string;
  to: string;
  users: UsageUserRow[];
}

export interface UsageModelRow {
  model: string;
  provider: string;
  kind: string;
  promptTokens: number;
  completionTokens: number;
  audioSeconds: number;
  characters: number;
  requests: number;
  costCents: number;
}

export interface UsageProductBlock {
  product: AdminProduct;
  costCents: number;
  models: UsageModelRow[];
}

export interface UsageUserDetailData {
  userId: string;
  from: string;
  to: string;
  products: UsageProductBlock[];
}

export interface UsageSummaryTopUser {
  userId: string;
  name: string;
  email: string;
  totalCostCents: number;
}

export interface UsageSummaryData {
  totalCostCents: number;
  byProduct: ProductCostMap;
  topUsers: UsageSummaryTopUser[];
  from: string;
  to: string;
}

// ── Data endpoints ──────────────────────────────────────────────────────────

const q = (from: string, to: string) =>
  `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

export function getUsageUsers(
  from: string,
  to: string,
): Promise<UsageUsersData> {
  return ncAdminFetch<UsageUsersData>(`/admin/usage/users?${q(from, to)}`);
}

export function getUsageUser(
  userId: string,
  from: string,
  to: string,
): Promise<UsageUserDetailData> {
  return ncAdminFetch<UsageUserDetailData>(
    `/admin/usage/users/${encodeURIComponent(userId)}?${q(from, to)}`,
  );
}

export function getUsageSummary(
  from: string,
  to: string,
): Promise<UsageSummaryData> {
  return ncAdminFetch<UsageSummaryData>(`/admin/usage/summary?${q(from, to)}`);
}

// ── Meet analytics (admin-gated) ──────────────────────────────────────────────

export interface MeetAnalyticsData {
  rangeDays: number;
  overall: {
    totalMeetings: number;
    totalDurationSeconds: number;
    totalJoins: number;
    totalRecorded: number;
    avgParticipants: number;
    avgDurationSeconds: number;
    totalScreenShareSeconds: number;
    sessionsWithScreenShare: number;
    soloSessions: number;
    maxDurationSeconds: number;
  };
  topParticipants: {
    _id: string;
    name?: string;
    totalSeconds: number;
    meetingsAttended: number;
  }[];
  topScreenSharers?: {
    _id: string;
    name?: string;
    totalSeconds: number;
    shareCount: number;
  }[];
  dailyTrend: { _id: string; count: number; totalSeconds: number }[];
  hourlyDistribution?: { hour: number; count: number }[];
  weekdayDistribution?: { day: string; count: number; totalSeconds: number }[];
  userTypeBreakdown?: {
    guestCount: number;
    authedCount: number;
    hostCount: number;
  } | null;
  recentSessions: MeetSession[];
  recordings: { totalRecordings: number; sessionsRecorded: number };
}

export interface MeetParticipant {
  identity: string;
  name?: string;
  joinedAt: string;
  leftAt?: string;
  durationSeconds?: number;
  isHost?: boolean;
  isGuest?: boolean;
}

export interface MeetScreenShareEvent {
  identity: string;
  name?: string;
  trackSid: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
}

export interface MeetSession {
  _id: string;
  roomName: string;
  roomId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  participants: MeetParticipant[];
  peakParticipants: number;
  totalJoins: number;
  screenShares?: MeetScreenShareEvent[];
  totalScreenShareSeconds?: number;
  wasRecorded: boolean;
  recordingIds: string[];
}

/** Authed POST (admin token) returning {ok,data}. */
async function postAuthed<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return ncAdminFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function getMeetAnalytics(days: number): Promise<MeetAnalyticsData> {
  return ncAdminFetch<MeetAnalyticsData>(`/meet/analytics/overview?days=${days}`);
}

// ── LIVE call management (admin-gated) ─────────────────────────────────────
//
// Endpoints under /admin/meet-manage return plain JSON (not the {ok,data}
// envelope), so we hit them with ncAdminFetchRaw directly rather than
// ncAdminFetch / postAuthed.

export interface LiveRoomSummary {
  roomName: string;
  roomId: string | null;
  title: string | null;
  numParticipants: number;
  numPublishers: number;
  createdAt: number | null;
  host: { userId?: string; name?: string; email?: string } | null;
  orgId?: string;
  kind: "meet" | "office" | "webinar" | "other";
  isRecording: boolean;
}

export interface LiveParticipant {
  identity: string;
  name?: string;
  userId?: string;
  isHost: boolean;
  isBot: boolean;
  joinedAt: number | null;
  state: number;
  tracks: {
    mic: { sid: string; muted: boolean; mimeType: string } | null;
    camera: { sid: string; muted: boolean; mimeType: string } | null;
    screen: { sid: string; muted: boolean } | null;
  };
}

export interface AdminMeetRecording {
  id: string;
  egressId: string;
  filename: string;
  displayName?: string;
  status: "recording" | "processing" | "ready" | "failed";
  size: number;
  duration: number;
  createdAt: string;
}

export interface AdminMeetNoteSession {
  id: string;
  status: string;
  transcriptId: string | null;
  summaryId: string | null;
  startedAt: string;
  endedAt?: string | null;
}

export interface AdminMeetOrganization {
  id: string;
  name: string;
}

export interface AdminMeetHost {
  userId: string;
  name?: string;
  email?: string;
  avatar?: string;
}

export interface LiveRoomDetail {
  room: {
    roomName: string;
    roomId: string | null;
    numParticipants: number;
    createdAt: number | null;
    /** Only populated by the /ended variant */
    endedAt?: number | null;
    durationSeconds?: number | null;
    peakParticipants?: number;
    closedReason?: string | null;
    session: {
      orgId?: string;
      startedAt?: string;
      endedAt?: string;
      hostUserId?: string;
      allowUnmute: boolean;
      allowPresent: boolean;
    } | null;
    recording: { egressId: string; filename: string; status: string } | null;
    organization?: AdminMeetOrganization | null;
    host?: AdminMeetHost | null;
    recordings?: AdminMeetRecording[];
    notes?: AdminMeetNoteSession | null;
  };
  participants: LiveParticipant[];
}

export interface EndedRoomParticipant {
  identity: string;
  name?: string;
  userId?: string;
  isHost: boolean;
  joinedAt: number | null;
  leftAt: number | null;
  durationSeconds: number | null;
}

export type EndedRoomDetail = Omit<LiveRoomDetail, "participants"> & {
  participants: EndedRoomParticipant[];
};

export interface LiveBan {
  userId: string;
  name?: string;
  email?: string;
  bannedAt: string;
  reason?: string;
}

export interface RecentEndedSession {
  roomName: string;
  roomId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds?: number;
  peakParticipants: number;
  closedReason?: string;
  host: { userId: string; name?: string; email?: string } | null;
}

export interface AdminScheduledMeet {
  _id: string;
  roomId: string;
  title: string;
  scheduledAt: string;
  startedAt?: string | null;
  durationMinutes: number;
  host: { userId: string; name?: string; email?: string } | null;
}

export function listLiveRooms(): Promise<{ rooms: LiveRoomSummary[]; total: number }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live`);
}

export function getLiveRoom(roomName: string): Promise<LiveRoomDetail> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}`);
}

export function getEndedRoom(roomName: string): Promise<EndedRoomDetail> {
  return ncAdminFetchRaw(`/admin/meet-manage/ended/${encodeURIComponent(roomName)}`);
}

export function getAdminRecordingUrl(
  recordingId: string,
  inline = false,
): Promise<{ url: string }> {
  return ncAdminFetchRaw(
    `/admin/meet-manage/recording/${encodeURIComponent(recordingId)}/download${
      inline ? "?inline=1" : ""
    }`,
  );
}

export function muteLiveParticipant(
  roomName: string,
  identity: string,
  muted = true,
  source?: "microphone" | "camera" | "screen_share",
): Promise<{ ok: true; identity: string; muted: boolean; affected: number }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}/mute`, {
    method: "POST",
    body: JSON.stringify({ identity, muted, source }),
  });
}

export function kickLiveParticipant(
  roomName: string,
  identity: string,
): Promise<{ ok: true; identity: string }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}/kick`, {
    method: "POST",
    body: JSON.stringify({ identity }),
  });
}

export function endLiveRoom(roomName: string): Promise<{ ok: true; roomName: string }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}/end`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listScheduledMeets(daysAhead = 7): Promise<{
  total: number;
  schedules: AdminScheduledMeet[];
}> {
  return ncAdminFetchRaw(`/admin/meet-manage/scheduled?days=${daysAhead}`);
}

/** minutes=0 → all sessions ever (capped by server `limit`, default 100).
 *  Otherwise a rolling window. */
export function listRecentEnded(minutes = 60, limit = 100): Promise<{
  total: number;
  sessions: RecentEndedSession[];
}> {
  return ncAdminFetchRaw(
    `/admin/meet-manage/recent-ended?minutes=${minutes}&limit=${limit}`,
  );
}

export function muteAllInRoom(
  roomName: string,
  except: string[] = [],
): Promise<{ ok: true; mutedTracks: number }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}/mute-all`, {
    method: "POST",
    body: JSON.stringify({ except }),
  });
}

export function banLiveParticipant(
  roomName: string,
  identity: string,
  reason?: string,
): Promise<{ ok: true; roomId: string; userId: string }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}/ban`, {
    method: "POST",
    body: JSON.stringify({ identity, reason }),
  });
}

export function unbanLiveParticipant(
  roomName: string,
  userId: string,
): Promise<{ ok: true }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}/unban`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function listRoomBans(roomName: string): Promise<{ bans: LiveBan[] }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}/bans`);
}

export function broadcastToRoom(
  roomName: string,
  text: string,
): Promise<{ ok: true }> {
  return ncAdminFetchRaw(`/admin/meet-manage/live/${encodeURIComponent(roomName)}/broadcast`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function updateRoomSettings(
  roomName: string,
  settings: { allowUnmute?: boolean; allowPresent?: boolean },
): Promise<{ ok: true; allowUnmute: boolean; allowPresent: boolean }> {
  return ncAdminFetchRaw(
    `/admin/meet-manage/live/${encodeURIComponent(roomName)}/settings`,
    { method: "POST", body: JSON.stringify(settings) },
  );
}

export function startRoomRecording(
  roomName: string,
): Promise<{ ok: true; recordingId: string; egressId: string }> {
  return ncAdminFetchRaw(
    `/admin/meet-manage/live/${encodeURIComponent(roomName)}/recording/start`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function stopRoomRecording(
  roomName: string,
  egressId?: string,
): Promise<{ ok: true; egressId: string }> {
  return ncAdminFetchRaw(
    `/admin/meet-manage/live/${encodeURIComponent(roomName)}/recording/stop`,
    { method: "POST", body: JSON.stringify(egressId ? { egressId } : {}) },
  );
}

// ── EarnGPT suggestion-learning log (admin-gated) ─────────────────────────────

export type {
  AdminSuggestionFeedbackItem,
  AdminSuggestionFeedbackResponse,
} from "./earngpt-types";
import type { AdminSuggestionFeedbackResponse } from "./earngpt-types";

/** Super-admin: the EarnGPT suggestion-learning timeline (newest-first). */
export function getSuggestionFeedback(
  page = 1,
  option?: "wrong" | "close" | "chosen",
): Promise<AdminSuggestionFeedbackResponse> {
  const q = new URLSearchParams({ page: String(page) });
  if (option) q.set("option", option);
  return ncAdminFetch<AdminSuggestionFeedbackResponse>(
    `/earngpt/admin/suggestion-feedback?${q.toString()}`,
  );
}

// ── Offerings explorer (admin-gated) ──────────────────────────────────────────

export type OfferingCategory =
  | "digital"
  | "physical"
  | "office"
  | "offer"
  | "platform";

export interface OfferingOppStats {
  total: number;
  toReach: number;
  reachedOut: number;
  snoozed: number;
  potentialUsdCents: number;
}
export interface OfferingOutcomeStats {
  chosen: number;
  close: number;
  wrong: number;
}
export interface OfferingLinkedItem {
  itemId: string;
  itemType: string | null;
  name: string | null;
}
export interface Offering {
  key: string;
  itemType: string;
  itemId: string;
  name: string;
  category: OfferingCategory;
  priceMinor: number | null;
  currency: string | null;
  commissionPct: number | null;
  orgName: string | null;
  coverUrl: string | null;
  offer?: {
    code: string;
    discountValue: number;
    appliesTo: string;
    linkedItems: OfferingLinkedItem[];
  };
  opps: OfferingOppStats;
  outcomes: OfferingOutcomeStats;
}
export interface OfferingsResponse {
  offerings: Offering[];
  typeCounts: Record<string, number>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface OfferingOppRow {
  _id: string;
  userId: string;
  userName: string;
  eventTitle: string;
  platform: string;
  status: string;
  potentialUsdCents: number;
  createdAt: string;
}
export interface OfferingFeedbackRow {
  _id: string;
  userId: string;
  userName: string;
  suggestedName?: string;
  option: "wrong" | "close" | "chosen";
  reasoning?: string;
  freeText?: string;
  createdAt: string;
}
export interface OfferingDetailResponse {
  offering: Omit<Offering, "opps" | "outcomes">;
  stats: { opps: OfferingOppStats; outcomes: OfferingOutcomeStats };
  opportunities: {
    rows: OfferingOppRow[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
  feedback: OfferingFeedbackRow[];
}

/** Super-admin: paged offerings list with cross-user opportunity stats. */
export function getOfferings(opts: {
  page?: number;
  search?: string;
  type?: string;
  sort?: string;
  order?: "asc" | "desc";
}): Promise<OfferingsResponse> {
  const q = new URLSearchParams({ page: String(opts.page ?? 1) });
  if (opts.search) q.set("search", opts.search);
  if (opts.type && opts.type !== "all") q.set("type", opts.type);
  if (opts.sort) q.set("sort", opts.sort);
  if (opts.order) q.set("sortOrder", opts.order);
  return ncAdminFetch<OfferingsResponse>(`/admin/offerings?${q.toString()}`);
}

/** Super-admin: one offering's stats + drill-down rows across all users. */
export function getOfferingDetail(
  itemType: string,
  itemId: string,
  page = 1,
): Promise<OfferingDetailResponse> {
  return ncAdminFetch<OfferingDetailResponse>(
    `/admin/offerings/${encodeURIComponent(itemType)}/${encodeURIComponent(
      itemId,
    )}?page=${page}`,
  );
}

// ── Subscription admin (admin-gated) ──────────────────────────────────────────

export interface SubUser {
  userId: string;
  name?: string;
  email?: string;
  role?: string;
  isActive: boolean;
  status: string;
  currentPeriodEnd: string | null;
  daysRemaining: number;
  paymentCount: number;
}

export interface SubscriptionUsersQuery {
  search?: string;
  view?: "all" | "active" | "expired";
  role?: string;
  payMin?: number;
  payMax?: number;
  daysMin?: number;
  daysMax?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface SubscriptionUsersResult {
  data: SubUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  activeCount: number;
  expiredCount: number;
  roles: { value: string; count: number }[];
}

/** Server-side filtered/sorted/paginated subscription list (+ full-set counts
 *  and role facets, which the UI needs regardless of the current page). */
export async function getSubscriptionUsers(
  params: SubscriptionUsersQuery = {},
): Promise<SubscriptionUsersResult> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const json: any = await ncAdminFetchRaw<any>(
    `/subscription/admin/users${qs.toString() ? `?${qs}` : ""}`,
  );
  if (json.ok === false) {
    throw new NcAdminApiError(json.error || "Request failed", 200);
  }
  return {
    data: json.data ?? [],
    total: json.total ?? 0,
    page: json.page ?? 1,
    limit: json.limit ?? 20,
    totalPages: json.totalPages ?? 1,
    activeCount: json.activeCount ?? 0,
    expiredCount: json.expiredCount ?? 0,
    roles: json.roles ?? [],
  };
}

export function activateSubscription(userId: string, days = 30): Promise<unknown> {
  return postAuthed(`/subscription/admin/activate`, { userId, days });
}

export function expireSubscription(userId: string): Promise<unknown> {
  return postAuthed(`/subscription/admin/expire`, { userId });
}

// ── User Explorer (admin-gated, read-only per-user drill-down) ────────────────

export interface AdminUserRow {
  _id: string;
  name?: string;
  email?: string;
  username?: string;
  profilePicture?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUsersListData {
  users: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SyncedPlatform {
  platform: string;
  contactCount: number;
}

export interface ConnectedAccount {
  platform: string;
  label?: string;
  profileUrl?: string;
  verified?: boolean;
  oauthConnected?: boolean;
  followerCount?: number;
  connectedAt?: string;
  lastSyncedAt?: string;
}

export interface AdminUserOverview {
  user: AdminUserRow;
  syncedPlatforms: SyncedPlatform[];
  connectedAccounts: ConnectedAccount[];
  counts: {
    contacts: number;
    conversations: number;
    meetings: number;
    noteSessions: number;
  };
}

export interface AdminContact {
  _id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  imageUrl?: string;
  source?: { platform?: string };
  isFavorite?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminContactsData {
  contacts: AdminContact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminConversationRow {
  sessionId: string;
  status: string;
  stage?: string;
  kind: string;
  title?: string | null;
  contact?: {
    _id?: string;
    fullName?: string;
    email?: string;
    company?: string;
    imageUrl?: string;
  } | null;
  displayName: string;
  lastMessage?: {
    role: string;
    content: string;
    hasAttachments: boolean;
    timestamp: string;
  } | null;
  updatedAt: string;
  createdAt: string;
}

export interface AdminConversationsData {
  conversations: AdminConversationRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  attachments?: { key: string; mimeType: string; filename?: string; url?: string }[];
  metadata?: Record<string, unknown>;
}

export interface AdminConversationDetail {
  _id: string;
  sessionId: string;
  contactId?: { fullName?: string; email?: string; company?: string; imageUrl?: string } | null;
  title?: string;
  kind?: string;
  status: string;
  messages: AdminChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminMeeting {
  _id: string;
  roomName: string;
  roomId: string;
  createdByName?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  participants: { identity: string; name?: string; isHost?: boolean; isGuest?: boolean }[];
  peakParticipants: number;
  wasRecorded: boolean;
}

export interface AdminNoteSession {
  _id: string;
  roomName: string;
  title?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  status: string;
  participants: { name?: string; email?: string }[];
  transcriptId?: string;
  summaryId?: string;
  createdAt: string;
}

export interface AdminNoteSessionDetail {
  session: AdminNoteSession;
  transcript: {
    fullText: string;
    segments: { speaker: string; speakerName?: string; startTime: number; endTime: number; text: string }[];
    wordCount: number;
    speakerCount: number;
  } | null;
  summary: {
    overview: string;
    keyTopics: string[];
    actionItems: { description: string; assignee?: string; deadline?: string }[];
    decisions: string[];
    questions: string[];
    markdownSummary: string;
  } | null;
}

export interface AdminRecording {
  id: string;
  roomName: string;
  displayName?: string;
  size: number;
  duration: number;
  createdAt: string;
  url: string | null;
}

const enc = encodeURIComponent;

export function getAdminUsers(opts: {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
} = {}): Promise<AdminUsersListData> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.sortBy) params.set("sortBy", opts.sortBy);
  if (opts.sortOrder) params.set("sortOrder", opts.sortOrder);
  const qs = params.toString();
  return ncAdminFetch<AdminUsersListData>(`/admin/users${qs ? `?${qs}` : ""}`);
}

export function getAdminUserOverview(userId: string): Promise<AdminUserOverview> {
  return ncAdminFetch<AdminUserOverview>(`/admin/users/${enc(userId)}/overview`);
}

export interface AdminWalletTxn {
  type: "credit" | "debit";
  amount: number;
  amountDollars: string;
  balanceAfter: number;
  balanceAfterDollars: string;
  description: string;
  createdAt: string;
}

export interface AdminUserWallet {
  balanceCents: number;
  balanceDollars: string;
  debtCents: number;
  debtDollars: string;
  transactions: AdminWalletTxn[];
}

export function getAdminUserWallet(userId: string): Promise<AdminUserWallet> {
  return ncAdminFetch<AdminUserWallet>(`/admin/users/${enc(userId)}/wallet`);
}

export function creditAdminUserWallet(userId: string, amountDollars: number): Promise<AdminUserWallet> {
  return postAuthed<AdminUserWallet>(`/admin/users/${enc(userId)}/wallet/credit`, { amountDollars });
}

export function getAdminUserContacts(userId: string, opts: { search?: string; page?: number } = {}): Promise<AdminContactsData> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.page) params.set("page", String(opts.page));
  const qs = params.toString();
  return ncAdminFetch<AdminContactsData>(`/admin/users/${enc(userId)}/contacts${qs ? `?${qs}` : ""}`);
}

export function getAdminUserConversations(userId: string, opts: { search?: string; page?: number } = {}): Promise<AdminConversationsData> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.page) params.set("page", String(opts.page));
  const qs = params.toString();
  return ncAdminFetch<AdminConversationsData>(`/admin/users/${enc(userId)}/conversations${qs ? `?${qs}` : ""}`);
}

export function getAdminUserConversation(userId: string, sessionId: string): Promise<AdminConversationDetail> {
  return ncAdminFetch<AdminConversationDetail>(`/admin/users/${enc(userId)}/conversations/${enc(sessionId)}`);
}

export function getAdminUserMeetings(userId: string): Promise<{ meetings: AdminMeeting[] }> {
  return ncAdminFetch<{ meetings: AdminMeeting[] }>(`/admin/users/${enc(userId)}/meetings`);
}

// ── User activity (PostHog HogQL) ─────────────────────────────────────
export interface AdminUserActivityEvent {
  timestamp: string;
  event: string;
  distinct_id: string;
  url: string | null;
  pathname: string | null;
  browser: string | null;
  device_type: string | null;
  el_text: string | null;
  session_id: string | null;
  ip: string | null;
  referrer: string | null;
  audit_flag: string | null;
}
export interface AdminUserActivityData {
  events: AdminUserActivityEvent[];
  hasNext: boolean;
  nextCursor: string | null;
  limit: number;
  fromHours: number;
}
export function getAdminUserActivity(
  userId: string,
  opts: { limit?: number; fromHours?: number; event?: string; before?: string } = {},
): Promise<AdminUserActivityData> {
  const q = new URLSearchParams();
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.fromHours) q.set("fromHours", String(opts.fromHours));
  if (opts.event) q.set("event", opts.event);
  if (opts.before) q.set("before", opts.before);
  const qs = q.toString();
  return ncAdminFetch<AdminUserActivityData>(
    `/admin/users/${enc(userId)}/activity${qs ? `?${qs}` : ""}`,
  );
}

// ── User Sentry issues (Sentry API proxy) ──────────────────────────────
export interface AdminUserSentryIssue {
  id: string;
  shortId?: string;
  title?: string;
  culprit?: string;
  level?: string;
  status?: string;
  count?: string | number;
  userCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  permalink?: string;
  metadata?: { value?: string; type?: string };
}
export interface AdminUserSentryIssuesData {
  issues: AdminUserSentryIssue[];
  nextCursor: string | null;
  project: { key: string; slug: string };
}
export function getAdminUserSentryIssues(
  userId: string,
  opts: {
    project?: string;
    query?: string;
    statsPeriod?: string;
    cursor?: string;
  } = {},
): Promise<AdminUserSentryIssuesData> {
  const q = new URLSearchParams();
  if (opts.project) q.set("project", opts.project);
  if (opts.query) q.set("query", opts.query);
  if (opts.statsPeriod) q.set("statsPeriod", opts.statsPeriod);
  if (opts.cursor) q.set("cursor", opts.cursor);
  const qs = q.toString();
  return ncAdminFetch<AdminUserSentryIssuesData>(
    `/admin/users/${enc(userId)}/sentry-issues${qs ? `?${qs}` : ""}`,
  );
}

export function getAdminUserNoteSessions(userId: string): Promise<{ sessions: AdminNoteSession[] }> {
  return ncAdminFetch<{ sessions: AdminNoteSession[] }>(`/admin/users/${enc(userId)}/note-sessions`);
}

export function getAdminUserNoteSession(userId: string, id: string): Promise<AdminNoteSessionDetail> {
  return ncAdminFetch<AdminNoteSessionDetail>(`/admin/users/${enc(userId)}/note-sessions/${enc(id)}`);
}

export function getAdminUserRecordings(userId: string): Promise<{ recordings: AdminRecording[] }> {
  return ncAdminFetch<{ recordings: AdminRecording[] }>(`/admin/users/${enc(userId)}/recordings`);
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Format a (possibly fractional) cents value as USD. */
export function formatCents(cents: number | undefined, dp: 2 | 4 = 4): string {
  const value = (cents ?? 0) / 100;
  return `$${value.toFixed(dp)}`;
}
