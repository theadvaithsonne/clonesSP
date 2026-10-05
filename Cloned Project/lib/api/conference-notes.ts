// lib/api/conference-notes.ts
//
// Thin authed client for the conference note-taker. Wraps the roam-backend
// /note-taker/* endpoints, scoped to conference sessions (source=conference).

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type NoteSessionStatus =
  | "recording"
  | "transcribing"
  | "summarizing"
  | "ready"
  | "failed";

export interface ConferenceNoteSession {
  _id: string;
  roomName: string;
  roomId: string;
  source: string;
  title?: string;
  status: NoteSessionStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  participants: { identity: string; name?: string; email?: string }[];
}

export interface ActionItem {
  description: string;
  assignee?: string;
  deadline?: string;
}

export interface ConferenceNoteSummary {
  _id: string;
  sessionId: string;
  overview: string;
  keyTopics: string[];
  actionItems: ActionItem[];
  decisions: string[];
  questions: string[];
  markdownSummary: string;
}

export interface TranscriptSegment {
  speaker: string;
  speakerName?: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface ConferenceNoteTranscript {
  _id: string;
  sessionId: string;
  segments: TranscriptSegment[];
  speakerCount: number;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text();
    let parsed: { error?: string; message?: string } | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    throw new Error(parsed?.error || parsed?.message || raw || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const conferenceNotesApi = {
  /** All conference note sessions for the caller's org (newest first). */
  async listSessions(): Promise<ConferenceNoteSession[]> {
    const res = await fetch(`${API_URL}/note-taker/sessions?source=conference&limit=100`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    const data = await handle<{ sessions: ConferenceNoteSession[] }>(res);
    return data.sessions || [];
  },

  async getSession(id: string): Promise<ConferenceNoteSession> {
    const res = await fetch(`${API_URL}/note-taker/sessions/${id}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    return handle<ConferenceNoteSession>(res);
  },

  /** Summary for a session. Returns null until summarization completes. */
  async getSummary(id: string): Promise<ConferenceNoteSummary | null> {
    const res = await fetch(`${API_URL}/note-taker/sessions/${id}/summary`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    const data = await handle<{ summary: ConferenceNoteSummary | null }>(res);
    return data.summary ?? null;
  },

  /** Speaker-labeled transcript. Returns null until transcription completes. */
  async getTranscript(id: string): Promise<ConferenceNoteTranscript | null> {
    const res = await fetch(`${API_URL}/note-taker/sessions/${id}/transcript`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    const data = await handle<{ transcript: ConferenceNoteTranscript | null }>(res);
    return data.transcript ?? null;
  },

  /** Fetch the transcript file with auth and trigger a browser download. */
  async downloadTranscript(id: string, title: string, format: "txt" | "srt" | "vtt" = "txt") {
    const res = await fetch(
      `${API_URL}/note-taker/sessions/${id}/transcript/download?format=${format}`,
      { headers: authHeaders() }
    );
    if (!res.ok) throw new Error("Failed to download transcript");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "conference-notes").replace(/[^\w\-]+/g, "-")}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /** Resend the notes email to participants. */
  async resend(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/note-taker/sessions/${id}/send`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handle(res);
  },
};

export function isNoteSessionTerminal(status: NoteSessionStatus): boolean {
  return status === "ready" || status === "failed";
}
