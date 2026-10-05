// Inline markers used to encode "rich" message types (location, contact,
// GIF, and slash-command cards) inside the existing plain-text `text` field
// of a chat message. The renderer detects the prefix and renders a card
// instead of raw text. Storing as text avoids any backend schema change.

export const LOC_MARKER = "[garage-location]";
export const CONTACT_MARKER = "[garage-contact]";
export const GIF_MARKER = "[garage-gif]";

// Slash-command markers
export const TASK_MARKER = "[garage-task]";
export const POLL_MARKER = "[garage-poll]";
export const MEET_MARKER = "[garage-meet]";
export const DEAL_MARKER = "[garage-deal]";
export const APPROVAL_MARKER = "[garage-approval]";
export const DOC_MARKER = "[garage-doc]";
export const SHARE_MARKER = "[garage-share]";

// Sentinel roomId for the office's DEFAULT conference room (no ConferenceRoom
// id). Lets any member book + join the org-wide room (hq-room:<orgId>) from
// /meet when no founder-created named room exists. See ConferenceCallStandalone
// (spaceId) and MeetForm (booking without conferenceRoomId).
export const OFFICE_CONFERENCE_ROOM_ID = "office";

export interface LocationData {
  lat: number;
  lng: number;
  label?: string;
}

export interface ContactData {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
}

export interface GifData {
  url: string;
  w?: number;
  h?: number;
  title?: string;
  // Distinguishes the picker source so the bubble can label "Sticker" vs "GIF".
  kind?: "gif" | "sticker";
  // Tenor's permanent shareable URL for the GIF (good for "View on Tenor" hint).
  source?: string;
}

export type TaskStatus = "todo" | "inprogress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskStageRef {
  id: string;
  name: string;
}

export interface TaskAssigneeRef {
  id: string;
  name?: string;
}

export interface TaskCardData {
  taskId: string;
  title: string;
  // Legacy field — kept for compatibility with old cards that predate the
  // Taskrooms integration. New cards rely on currentStageId + stages.
  status: TaskStatus;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  priority?: TaskPriority;
  description?: string;
  // Taskrooms integration: links the card to a specific room + stage so the
  // card can deep-link and PATCH stage from chat without re-fetching state.
  taskroomId?: string;
  taskroomName?: string;
  stages?: TaskStageRef[];
  currentStageId?: string;
  // Multi-assignee support: group chats can assign one task per member, so
  // the card may reference N Taskrooms tasks that share title/stage/dueDate.
  // Stage + reassign actions fan out across all taskIds.
  taskIds?: string[];
  assignees?: TaskAssigneeRef[];
  // Snapshot of the chat members at send time — used by the Reassign popover
  // so it doesn't need to re-fetch the roster.
  availableAssignees?: TaskAssigneeRef[];
}

export interface PollCardData {
  pollId: string;
  question: string;
  options: { id: string; text: string }[];
  isAnonymous?: boolean;
  isMultiChoice?: boolean;
  deadline?: string;
  createdBy?: string;
}

export interface MeetCardData {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  invitees: { id: string; name?: string }[];
  // NEW — a real booked conference room (RoomBooking). Old cards omit these
  // and fall back to the legacy `joinCode` below.
  orgId?: string;
  roomId?: string; // ConferenceRoom _id — builds /meet/conference/<orgId>/<roomId>
  roomName?: string;
  bookingId?: string; // RoomBooking _id
  description?: string;
  joinCode?: string; // LEGACY external URL / short code — kept for old cards
}

export type DealStage = "lead" | "qualified" | "proposal" | "won" | "lost";

export interface DealCardData {
  dealId: string;
  name: string;
  stage: DealStage;
  value?: number;
  currency?: string;
  ownerName?: string;
  ownerId?: string;
  nextFollowUp?: string;
}

export type ApprovalDecision = "pending" | "approved" | "rejected";

export interface ApprovalCardData {
  approvalId: string;
  title: string;
  description?: string;
  approvers: { id: string; name?: string }[];
  requesterId: string;
  requesterName?: string;
  deadline?: string;
}

export interface DocCardData {
  docId: string;
  name: string;
  size?: number;
  mimeType?: string;
  url: string;
  thumbnail?: string;
}

export type ShareKind = "course" | "webinar" | "product";

export interface ShareCardData {
  kind: ShareKind;
  itemId: string;
  title: string;
  image?: string;
  price?: number;
  currency?: string;
  description?: string;
  url: string;
}

export type ParsedMarker =
  | { type: "location"; data: LocationData; raw: string }
  | { type: "contact"; data: ContactData; raw: string }
  | { type: "gif"; data: GifData; raw: string }
  | { type: "task"; data: TaskCardData; raw: string }
  | { type: "poll"; data: PollCardData; raw: string }
  | { type: "meet"; data: MeetCardData; raw: string }
  | { type: "deal"; data: DealCardData; raw: string }
  | { type: "approval"; data: ApprovalCardData; raw: string }
  | { type: "doc"; data: DocCardData; raw: string }
  | { type: "share"; data: ShareCardData; raw: string };

export function encodeLocation(data: LocationData): string {
  return `${LOC_MARKER}${JSON.stringify(data)}`;
}

export function encodeContact(data: ContactData): string {
  return `${CONTACT_MARKER}${JSON.stringify(data)}`;
}

export function encodeGif(data: GifData): string {
  return `${GIF_MARKER}${JSON.stringify(data)}`;
}

export function encodeTask(data: TaskCardData): string {
  return `${TASK_MARKER}${JSON.stringify(data)}`;
}

export function encodePoll(data: PollCardData): string {
  return `${POLL_MARKER}${JSON.stringify(data)}`;
}

export function encodeMeet(data: MeetCardData): string {
  return `${MEET_MARKER}${JSON.stringify(data)}`;
}

export function encodeDeal(data: DealCardData): string {
  return `${DEAL_MARKER}${JSON.stringify(data)}`;
}

export function encodeApproval(data: ApprovalCardData): string {
  return `${APPROVAL_MARKER}${JSON.stringify(data)}`;
}

export function encodeDoc(data: DocCardData): string {
  return `${DOC_MARKER}${JSON.stringify(data)}`;
}

export function encodeShare(data: ShareCardData): string {
  return `${SHARE_MARKER}${JSON.stringify(data)}`;
}

// Lookup table keeps parseMarker O(n) over a fixed list with a single JSON
// parse per call. Validators ensure the payload has the minimum required
// shape before claiming the marker is valid.
type MarkerSpec<T extends ParsedMarker["type"], D> = {
  marker: string;
  type: T;
  validate: (d: unknown) => d is D;
};

// `unknown` payloads are narrowed via this helper so each validator can use
// safe property access without sprinkling casts.
function obj(d: unknown): Record<string, unknown> {
  return (d && typeof d === "object" ? (d as Record<string, unknown>) : {});
}

const SPECS: ReadonlyArray<MarkerSpec<ParsedMarker["type"], unknown>> = [
  {
    marker: LOC_MARKER,
    type: "location",
    validate: (d): d is LocationData => {
      const o = obj(d);
      return typeof o.lat === "number" && typeof o.lng === "number";
    },
  },
  {
    marker: CONTACT_MARKER,
    type: "contact",
    validate: (d): d is ContactData => {
      const o = obj(d);
      return !!o.id && !!o.name;
    },
  },
  {
    marker: GIF_MARKER,
    type: "gif",
    validate: (d): d is GifData => {
      const o = obj(d);
      return typeof o.url === "string" && !!o.url;
    },
  },
  {
    marker: TASK_MARKER,
    type: "task",
    validate: (d): d is TaskCardData => {
      const o = obj(d);
      return !!o.taskId && !!o.title;
    },
  },
  {
    marker: POLL_MARKER,
    type: "poll",
    validate: (d): d is PollCardData => {
      const o = obj(d);
      return (
        !!o.pollId &&
        !!o.question &&
        Array.isArray(o.options) &&
        (o.options as unknown[]).length >= 2
      );
    },
  },
  {
    marker: MEET_MARKER,
    type: "meet",
    validate: (d): d is MeetCardData => {
      const o = obj(d);
      return !!o.eventId && !!o.title && !!o.startTime;
    },
  },
  {
    marker: DEAL_MARKER,
    type: "deal",
    validate: (d): d is DealCardData => {
      const o = obj(d);
      return !!o.dealId && !!o.name && !!o.stage;
    },
  },
  {
    marker: APPROVAL_MARKER,
    type: "approval",
    validate: (d): d is ApprovalCardData => {
      const o = obj(d);
      return !!o.approvalId && !!o.title && Array.isArray(o.approvers);
    },
  },
  {
    marker: DOC_MARKER,
    type: "doc",
    validate: (d): d is DocCardData => {
      const o = obj(d);
      return !!o.docId && !!o.name && typeof o.url === "string";
    },
  },
  {
    marker: SHARE_MARKER,
    type: "share",
    validate: (d): d is ShareCardData => {
      const o = obj(d);
      return !!o.kind && !!o.itemId && !!o.title && typeof o.url === "string";
    },
  },
];

export function parseMarker(text: string | null | undefined): ParsedMarker | null {
  if (!text) return null;
  const trimmed = text.trim();
  for (const spec of SPECS) {
    if (!trimmed.startsWith(spec.marker)) continue;
    try {
      const data = JSON.parse(trimmed.slice(spec.marker.length));
      if (spec.validate(data)) {
        return { type: spec.type, data, raw: trimmed } as ParsedMarker;
      }
    } catch {}
    // Matched the prefix but payload was malformed — no other marker can win.
    return null;
  }
  return null;
}

export function hasMarker(text: string | null | undefined): boolean {
  return parseMarker(text) !== null;
}
