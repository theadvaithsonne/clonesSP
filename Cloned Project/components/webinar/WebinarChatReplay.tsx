"use client";

/**
 * Chat replay for a recorded webinar — YouTube-style: messages appear as the
 * video reaches the moment they were sent.
 *
 * The recording itself has no chat in it. LiveKit's composite egress records
 * the participant grid and nothing else, so the messages are re-synced here
 * at playback time instead of being burned into the video. That keeps them
 * searchable and selectable, and means every past recording gets chat too —
 * the data was always being stored.
 *
 * Sync anchor is the recording's `startedAt` (backend derives it from the S3
 * key, which encodes the egress start; `createdAt` is upload time and can be
 * hours later). A message belongs at `timestamp - startedAt` seconds in.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { parseMarker } from "@/lib/chat-markers";
import { GifBubble } from "@/components/webinar/GifBubble";

interface ReplayMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  /**
   * Emoji -> userIds, as they stood when the session ended. Read-only here:
   * the room is over, so there is nobody left to react to.
   */
  reactions?: Record<string, string[]>;
  timestamp: string | number;
}

interface Props {
  workshopId: string;
  /** ISO time the recording started. Without it we can't place anything. */
  startedAt?: string | null;
  /** Playhead position in seconds. */
  currentTime: number;
  className?: string;
}

export default function WebinarChatReplay({
  workshopId,
  startedAt,
  currentTime,
  className,
}: Props) {
  const [messages, setMessages] = useState<ReplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workshopId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ messages: ReplayMessage[] }>(`webinar/${workshopId}/messages`)
      .then((res) => {
        if (!cancelled) setMessages(res.messages || []);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Couldn't load chat");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workshopId]);

  // Offset (seconds into the recording) for every message, computed once.
  const timeline = useMemo(() => {
    const anchor = startedAt ? new Date(startedAt).getTime() : NaN;
    if (Number.isNaN(anchor)) return [];
    return messages
      .map((m) => ({
        ...m,
        offset: (new Date(m.timestamp).getTime() - anchor) / 1000,
      }))
      // Messages from before the egress started have no place on the
      // timeline; showing them at 0:00 would misrepresent when they landed.
      .filter((m) => m.offset >= 0)
      .sort((a, b) => a.offset - b.offset);
  }, [messages, startedAt]);

  const visible = useMemo(
    () => timeline.filter((m) => m.offset <= currentTime),
    [timeline, currentTime],
  );

  // Follow the playhead. Scrubbing backwards re-renders a shorter list, so
  // this lands correctly in both directions.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  function stamp(offset: number) {
    const s = Math.max(0, Math.floor(offset));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(h ? 2 : 1, "0");
    return h
      ? `${h}:${mm}:${String(sec).padStart(2, "0")}`
      : `${mm}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div className={`flex h-full flex-col ${className || ""}`}>
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <MessageSquare className="h-4 w-4 text-zinc-500" />
        <span className="text-sm font-medium text-white">Chat replay</span>
        {timeline.length > 0 && (
          <span className="ml-auto text-[11px] text-zinc-500">
            {visible.length}/{timeline.length}
          </span>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-xs text-zinc-600">{error}</p>
        ) : !startedAt ? (
          <p className="py-6 text-center text-xs text-zinc-600">
            This recording has no start time, so chat can&apos;t be lined up.
          </p>
        ) : timeline.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-600">
            No chat during this recording.
          </p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-600">
            Chat starts at {stamp(timeline[0].offset)}
          </p>
        ) : (
          <div className="space-y-2.5">
            {visible.map((m) => {
              // A GIF or sticker rides inside `text` as an encoded marker.
              // Without this it would replay as a line of raw JSON.
              const marker = parseMarker(m.text);
              const gif = marker?.type === "gif" ? marker.data : null;
              const chips = Object.entries(m.reactions || {}).filter(
                ([, users]) => Array.isArray(users) && users.length > 0,
              );
              return (
                <div key={m.id} className="leading-tight">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-medium text-green-400">
                      {m.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-zinc-600">
                      {stamp(m.offset)}
                    </span>
                  </div>
                  {gif ? (
                    <GifBubble data={gif} />
                  ) : (
                    <p className="break-words text-[13px] text-zinc-200">
                      {m.text}
                    </p>
                  )}
                  {chips.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {chips.map(([emoji, users]) => (
                        <span
                          key={emoji}
                          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[11px] leading-none text-zinc-300"
                        >
                          <span>{emoji}</span>
                          <span className="tabular-nums">{users.length}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
