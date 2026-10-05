// lib/api/voice-memos.ts
//
// Thin client for Garage's voice-memo proxy (`/voice-memos` on roam-backend),
// which forwards to NetworkChain's voice-agent service. Status names + JSON
// shapes match NC so we can reuse status badges, polling, etc.

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type MemoStatus =
  | "pending"
  | "transcribing"
  | "processing"
  | "ready"
  | "failed";

export interface VoiceMemo {
  id: string;
  user_id: string;
  title: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  attributed_transcript: string | null;
  summary: string | null;
  key_points: string[];
  action_items: string[];
  status: MemoStatus;
  error_message: string | null;
  chunks_count: number;
  created_at: string;
  updated_at: string;
  recorded_at: string | null;
  meeting_context: {
    roomId: string;
    roomName?: string;
    participants: { identity: string; name?: string }[];
  } | null;
}

export interface VoiceMemoListResponse {
  items: VoiceMemo[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListMemosQuery {
  page?: number;
  page_size?: number;
  status?: MemoStatus;
  search?: string;
  /** Filter to memos taken inside a specific room / webinar. Matches
   *  meeting_context.roomId server-side. Used by the Recorded Live Stream
   *  view to surface the host's notes for a given webinar. */
  room_id?: string;
}

/** Speaker-timeline snapshot captured by the in-conference recorder. */
export interface SpeakerTimelineEntry {
  /** Offset in ms from recording start. */
  tMs: number;
  /** Active-speaker identities at this moment. */
  speakers: string[];
}

export interface UploadMemoInput {
  audio: Blob;
  title?: string;
  recordedAt?: string; // ISO
  meetingContext?: VoiceMemo["meeting_context"];
  /** Active-speaker timeline (in-call memos) → speaker-attributed transcript. */
  speakerTimeline?: SpeakerTimelineEntry[];
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // Read the body as text first, then try to parse JSON. Calling
    // res.json() and then res.text() on a parse failure consumes the
    // stream twice and throws "body stream already read", which masks
    // the real server error.
    const raw = await res.text();
    let parsed: { error?: string; message?: string } | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    const message =
      parsed?.error ||
      parsed?.message ||
      raw ||
      `Request failed: ${res.status}`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const voiceMemosApi = {
  async upload(
    input: UploadMemoInput,
  ): Promise<{ task_id: string; memo_id: string; status: "queued" }> {
    const form = new FormData();
    // Browsers append a filename only when an explicit name is given.
    // NC validates by mime-type, not filename, so a generic name is fine.
    const filename = `memo.${input.audio.type.includes("mp4") ? "mp4" : "webm"}`;
    form.append("audio", input.audio, filename);
    if (input.title) form.append("title", input.title);
    if (input.recordedAt) form.append("recorded_at", input.recordedAt);
    if (input.meetingContext) {
      form.append("meeting_context", JSON.stringify(input.meetingContext));
    }
    if (input.speakerTimeline && input.speakerTimeline.length > 0) {
      form.append("speaker_timeline", JSON.stringify(input.speakerTimeline));
    }
    const res = await fetch(`${API_URL}/voice-memos`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    return handle(res);
  },

  async list(query: ListMemosQuery = {}): Promise<VoiceMemoListResponse> {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.page_size) params.set("page_size", String(query.page_size));
    if (query.status) params.set("status", query.status);
    if (query.search) params.set("search", query.search);
    if (query.room_id) params.set("room_id", query.room_id);
    const qs = params.toString();
    const res = await fetch(
      `${API_URL}/voice-memos${qs ? `?${qs}` : ""}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    return handle(res);
  },

  async get(id: string): Promise<VoiceMemo> {
    const res = await fetch(`${API_URL}/voice-memos/${id}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    return handle(res);
  },

  async update(id: string, body: { title: string }): Promise<VoiceMemo> {
    const res = await fetch(`${API_URL}/voice-memos/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return handle(res);
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/voice-memos/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handle(res);
  },

  async reprocess(id: string): Promise<{ memo_id: string; status: "queued" }> {
    const res = await fetch(`${API_URL}/voice-memos/${id}/reprocess`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handle(res);
  },
};

export function isMemoTerminal(status: MemoStatus): boolean {
  return status === "ready" || status === "failed";
}
