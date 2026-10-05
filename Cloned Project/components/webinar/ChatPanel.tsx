"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useWebinarStore from "@/store/webinarStore";
import type { ChatReplyTo } from "@/store/webinarStore";
import { useAuthStore } from "@/store/authStore";
import { linkifyText } from "@/lib/linkify";
import { toast } from "sonner";
import { CornerUpLeft, Plus, Reply, Smile, SmilePlus, Sparkles, X } from "lucide-react";
import type { Socket } from "socket.io-client";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { LinkPreview } from "@/components/ui/link-preview";
import { GifPicker } from "@/components/chat/GifPicker";
import { GifBubble } from "@/components/webinar/GifBubble";
import { encodeGif, parseMarker, type GifData } from "@/lib/chat-markers";

interface ChatPanelProps {
  socket: Socket | null;
  webinarId: string;
}

// The server caps chat text at 1000 characters. A GIF rides in that same
// field as encoded JSON, so a truncated one parses as nothing and the
// receiver gets a blank row. Dropping the optional title/source shrinks the
// payload enough to fit; the GIF itself still renders.
const TEXT_LIMIT = 1000;

function fitMarker(encoded: string): string {
  if (encoded.length <= TEXT_LIMIT) return encoded;
  const parsed = parseMarker(encoded);
  if (parsed?.type !== "gif") return encoded;
  const { url, w, h, kind } = parsed.data;
  return encodeGif({ url, w, h, kind });
}

// Quote preview shown in the quoted line of a reply message + in the
// "replying to…" banner above the input. Truncated to keep rows
// readable; full original message is one scroll away anyway.
function buildSnippet(text: string): string {
  // A GIF or sticker lives in `text` as an encoded marker — quoting it
  // verbatim would put a wall of JSON in the reply banner.
  const marker = parseMarker(text);
  if (marker?.type === "gif") {
    return marker.data.kind === "sticker" ? "Sticker" : "GIF";
  }
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed;
}

interface MentionTarget {
  userId: string;
  name: string;
  avatar?: string;
}

/**
 * Deterministic per-name avatar tint, so the same person keeps the same colour
 * across the session. Dark-only palette — this panel never renders on light.
 */
const AVATAR_TONES = [
  "bg-rose-500/20 text-rose-300",
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-orange-500/20 text-orange-300",
];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

/**
 * Resolve the "@Name" spans in a draft to the userIds they refer to, so the
 * recipient can be told they were tagged.
 *
 * Ids, not names: a participant can rename themselves mid-session and two
 * people can share a display name, so "@Name" is not a stable handle. The
 * server re-checks these against who is actually in the room.
 *
 * Longest name first, matching how renderMessageBody highlights them, so
 * "@John Doe" wins over "@John".
 */
function collectMentions(text: string, targets: MentionTarget[]): string[] {
  if (!targets.length) return [];
  const byName = new Map<string, string>();
  for (const t of targets) if (t.name) byName.set(t.name, t.userId);
  const names = Array.from(byName.keys()).sort((a, b) => b.length - a.length);
  if (!names.length) return [];
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})\\b`, "g");
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    const id = byName.get(m[1]);
    if (id) out.add(id);
  }
  return Array.from(out);
}

// Match the @mention being currently typed in the input — supports
// names with spaces ("@John Doe") up to 30 chars. The match has to
// touch the cursor, hence the trailing $ once we slice up to caret.
const ACTIVE_MENTION_RE = /(?:^|\s)@([\w][\w\s'._-]{0,29})$/;

// Same shape linkify uses — a preview should appear exactly when the
// message body actually renders a clickable link, so bare words like
// "file.ts" never spawn a preview card.
const FIRST_URL_RE = /(?:https?:\/\/|www\.)[^\s<>'")\]]+/i;

// Message-reaction palette. MUST stay in sync with ALLOWED_EMOJIS in the
// backend's mediasoupHandlers.ts — anything else is rejected server-side.
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🔥", "🎉", "💯"];

// WhatsApp's green, which is what people expect an @name to look like.
// Bright enough to read on this panel's #282828 without glowing.
const MENTION_COLOR = "text-[#25D366]";

export default function ChatPanel({ socket, webinarId }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  // First URL in the composer, debounced — pasting lands in one change,
  // but a URL typed out by hand would otherwise fire a metadata fetch per
  // keystroke while it's still half-formed.
  const [composerUrl, setComposerUrl] = useState<string | null>(null);

  // The "+" beside the composer: a tiny menu with the two ways to say
  // something without typing — Emoji and GIF — same as the mobile composer.
  // The pickers themselves stay mounted (triggers hidden) and are opened
  // from here, so the menu can close the moment it hands over without
  // unmounting the picker it just opened.
  const [plusOpen, setPlusOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!plusOpen) return;
    const onDown = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlusOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [plusOpen]);
  const [previewDismissed, setPreviewDismissed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useWebinarStore((s) => s.messages);

  // The original a quote points at, by id — so a reply to a GIF can show the
  // GIF itself in the quote rather than the word "GIF". The snippet is tried
  // as well, for a quote written by a client that copied the marker verbatim.
  const messagesById = useMemo(() => {
    const m = new Map<string, (typeof messages)[number]>();
    for (const msg of messages) if (msg.id) m.set(msg.id, msg);
    return m;
  }, [messages]);
  const quotedGifOf = (reply: ChatReplyTo | null | undefined): GifData | null => {
    if (!reply) return null;
    const original = messagesById.get(reply.id);
    const fromOriginal = original ? parseMarker(original.text) : null;
    if (fromOriginal?.type === "gif") return fromOriginal.data;
    const fromSnippet = parseMarker(reply.snippet);
    return fromSnippet?.type === "gif" ? fromSnippet.data : null;
  };
  const replyingGif = quotedGifOf(replyingTo);
  const peers = useWebinarStore((s) => s.peers);
  const localAvatar = useWebinarStore((s) => s.localAvatar);
  const user = useAuthStore((s) => s.user);

  // Resolve userId → { name, avatar } for both message rows and
  // mention autocomplete. Self comes from authStore + webinar store.
  const directory = useMemo(() => {
    const m = new Map<string, { name: string; avatar?: string }>();
    if (user?.userId) {
      m.set(user.userId, {
        name: user.name || "You",
        avatar:
          localAvatar ||
          (user as { profilePicture?: string }).profilePicture ||
          undefined,
      });
    }
    for (const p of peers) {
      m.set(p.userId, { name: p.name, avatar: p.avatar });
    }
    return m;
  }, [peers, user, localAvatar]);

  const mentionTargets: MentionTarget[] = useMemo(() => {
    return Array.from(directory.entries())
      .filter(([uid]) => uid !== user?.userId)
      .map(([uid, info]) => ({
        userId: uid,
        name: info.name,
        avatar: info.avatar,
      }));
  }, [directory, user?.userId]);

  /**
   * Everyone in the room, INCLUDING yourself — used only for colouring
   * message bodies.
   *
   * `mentionTargets` above deliberately leaves you out, because you don't
   * autocomplete your own name. Reusing it for rendering meant the one
   * mention that matters most — someone tagging YOU — was the only one left
   * uncoloured.
   */
  const highlightTargets: MentionTarget[] = useMemo(
    () =>
      Array.from(directory.entries()).map(([uid, info]) => ({
        userId: uid,
        name: info.name,
        avatar: info.avatar,
      })),
    [directory],
  );

  const filteredMentions = useMemo(() => {
    if (!mentionState) return [] as MentionTarget[];
    const q = mentionState.query.toLowerCase();
    if (!q) return mentionTargets.slice(0, 6);
    return mentionTargets
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionState, mentionTargets]);

  // Reset highlighted suggestion when the candidate list changes.
  useEffect(() => {
    setMentionIndex(0);
  }, [filteredMentions.length, mentionState?.query]);

  // Track the composer's first URL. Clearing is immediate (deleting the
  // link should drop the card at once); appearing waits out the debounce.
  useEffect(() => {
    const m = input.match(FIRST_URL_RE);
    const url = m ? (m[0].startsWith("http") ? m[0] : `https://${m[0]}`) : null;
    if (!url) {
      setComposerUrl(null);
      return;
    }
    const t = setTimeout(() => setComposerUrl(url), 600);
    return () => clearTimeout(t);
  }, [input]);

  // A different link un-dismisses the preview — the X applies to the
  // link it was clicked on, not to composing in general.
  useEffect(() => {
    setPreviewDismissed(false);
  }, [composerUrl]);

  // Keep the view pinned to the bottom unless the user has scrolled up.
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  };

  function detectMentionState(value: string, caret: number) {
    const left = value.slice(0, caret);
    const m = left.match(ACTIVE_MENTION_RE);
    if (!m) {
      setMentionState(null);
      return;
    }
    const query = m[1] ?? "";
    const start = caret - query.length - 1; // -1 for the '@'
    setMentionState({ query, start });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInput(v);
    detectMentionState(v, e.target.selectionStart ?? v.length);
  }

  function insertMention(target: MentionTarget) {
    if (!mentionState) return;
    const before = input.slice(0, mentionState.start);
    const caret = inputRef.current?.selectionStart ?? input.length;
    const after = input.slice(caret);
    // Trailing space so the user can keep typing without deleting.
    const inserted = `@${target.name} `;
    const next = before + inserted + after;
    setInput(next);
    setMentionState(null);
    // Move caret past the inserted mention on the next tick.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = before.length + inserted.length;
      el.setSelectionRange(pos, pos);
      el.focus();
    });
  }

  /**
   * Shared send path. `text` arrives final — typed messages are trimmed and
   * capped by the caller, an encoded GIF marker is passed through untouched
   * because trimming JSON would leave the receiver unable to parse it.
   */
  function emitMessage(
    text: string,
    quoted: ChatReplyTo | null,
    onFail?: () => void,
    mentions?: string[],
  ): boolean {
    if (!socket || !text || sending) return false;
    setSending(true);
    socket.emit(
      "webinar:sendMessage",
      {
        webinarId,
        text,
        replyTo: quoted ?? undefined,
        mentions: mentions?.length ? mentions : undefined,
      },
      (res: { success?: boolean; error?: string }) => {
        setSending(false);
        if (!res?.success) {
          toast.error(res?.error || "Failed to send message");
          onFail?.();
        }
      },
    );
    return true;
  }

  function sendMessage() {
    if (!input.trim() || !socket || sending) return;
    const text = input.trim().slice(0, TEXT_LIMIT);
    const quoted = replyingTo;
    // Resolved from the text actually being sent, so a mention lost to the
    // length cap doesn't ping someone who won't appear in the message.
    const mentions = collectMentions(text, mentionTargets);
    setInput("");
    setMentionState(null);
    setReplyingTo(null);
    emitMessage(
      text,
      quoted,
      () => {
        // Hand the draft back rather than losing what they typed.
        setInput(text);
        if (quoted) setReplyingTo(quoted);
      },
      mentions,
    );
  }

  // A GIF or sticker sends the instant it's picked — there is no draft to
  // compose, so it bypasses the input entirely.
  function sendMarker(encoded: string) {
    const quoted = replyingTo;
    const sent = emitMessage(fitMarker(encoded), quoted, () => {
      if (quoted) setReplyingTo(quoted);
    });
    // Only drop the "replying to" banner once the send is actually in
    // flight; a bail-out would otherwise discard the chosen reply target.
    if (sent) setReplyingTo(null);
  }

  function startReply(message: { id?: string; userId: string; name: string; text: string }) {
    if (!message.id) return; // Optimistic local rows without an id can't be replied to.
    setReplyingTo({
      id: message.id,
      userId: message.userId,
      name: message.name,
      snippet: buildSnippet(message.text),
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function reactToMessage(messageId: string, emoji: string) {
    if (!socket) return;
    socket.emit(
      "webinar:reactToMessage",
      { webinarId, messageId, emoji },
      (res: {
        success?: boolean;
        error?: string;
        reactions?: Record<string, string[]>;
      }) => {
        if (!res?.success) {
          toast.error(res?.error || "Could not react");
          return;
        }
        // The room broadcast carries the same map, but applying the ack
        // too makes the toggle feel instant for the person clicking.
        if (res.reactions) {
          useWebinarStore
            .getState()
            .setMessageReactions(messageId, res.reactions);
        }
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mentionState && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + filteredMentions.length) % filteredMentions.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionState(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleSelect(e: React.SyntheticEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    detectMentionState(el.value, el.selectionStart ?? el.value.length);
  }

  function handleEmoji(emoji: string) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? input.length;
    const next = input.slice(0, caret) + emoji + input.slice(caret);
    setInput(next);
    requestAnimationFrame(() => {
      const elRef = inputRef.current;
      if (!elRef) return;
      const pos = caret + emoji.length;
      elRef.setSelectionRange(pos, pos);
      elRef.focus();
    });
  }

  const formatTime = (ts: string | number) =>
    new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const overLimit = input.length >= 1000;

  return (
    <div className="flex h-full flex-col bg-[#282828]">
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="mx-3 mt-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          New messages
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {messages.length === 0 && (
          <p className="px-4 py-6 text-[13px] text-zinc-400">
            No messages yet. Say hello to the room.
          </p>
        )}

        <ul className="space-y-0.5 p-1">
          {messages.map((msg, i) => {
            // Product ad video card — inserted into the message stream when
            // a pin is REMOVED and its ad video had already rendered. Late
            // arrivals + anyone in scrollback still see the ad.
            if (msg.kind === "pin-video-card") {
              const videoUrl = String(msg.videoUrl || msg.text || "");
              const itemName = String(msg.itemName || msg.name || "Product ad");
              return (
                <li key={msg.id || i} className="px-2 py-1.5">
                  <PinVideoCardRow videoUrl={videoUrl} itemName={itemName} />
                </li>
              );
            }
            const isOwn = msg.userId === user?.userId;
            const info = directory.get(msg.userId);
            const displayName = isOwn ? "You" : info?.name || msg.name;
            const messageId = msg.id;
            return (
              <ChatRow
                key={msg.id || i}
                avatar={info?.avatar}
                displayName={displayName}
                text={msg.text}
                replyTo={msg.replyTo}
                quotedGif={quotedGifOf(msg.replyTo)}
                reactions={msg.reactions}
                myUserId={user?.userId}
                mentionsMe={
                  !!user?.userId && !!msg.mentions?.includes(user.userId)
                }
                stamp={formatTime(msg.timestamp)}
                // Includes self, unlike the autocomplete list — see above.
                mentionTargets={highlightTargets}
                // A quote is stored as a snapshot naming its author, so an
                // optimistic row with no id yet can be read but not replied to.
                onReply={
                  messageId
                    ? () =>
                        startReply({
                          id: messageId,
                          userId: msg.userId,
                          name: msg.name,
                          text: msg.text,
                        })
                    : undefined
                }
                // Same rule as reply: reactions key off the server id.
                onReact={
                  messageId
                    ? (emoji) => reactToMessage(messageId, emoji)
                    : undefined
                }
              />
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="relative shrink-0 border-t border-white/10 p-3"
      >
        {mentionState && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-zinc-950 shadow-xl">
            {filteredMentions.map((m, idx) => (
              <button
                key={m.userId}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
                onMouseEnter={() => setMentionIndex(idx)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${
                  idx === mentionIndex ? "bg-white/[0.1]" : "hover:bg-white/[0.06]"
                }`}
              >
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${toneFor(m.name || "?")}`}
                  >
                    {(m.name || "?")[0]?.toUpperCase()}
                  </span>
                )}
                <span className="truncate text-white">{m.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Live unfurl of the link being composed, WhatsApp-style. Purely
            a courtesy view — the sent message renders its own preview, so
            dismissing this changes nothing about what gets sent. */}
        {composerUrl && !previewDismissed && (
          <div className="relative mb-2">
            <LinkPreview url={composerUrl} />
            <button
              type="button"
              onClick={() => setPreviewDismissed(true)}
              aria-label="Hide link preview"
              className="absolute right-1.5 top-1.5 rounded-md bg-black/40 p-0.5 text-zinc-400 transition-colors hover:bg-black/60 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] py-2 pl-3 pr-2">
            {replyingGif ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={replyingGif.url}
                alt=""
                className="h-8 w-8 shrink-0 rounded-md bg-white/10 object-cover"
              />
            ) : (
              <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold leading-none text-zinc-300">
                Replying to {replyingTo.name}
              </span>
              <span className="mt-1 block truncate text-[11px] leading-none text-zinc-500">
                {replyingTo.snippet}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="shrink-0 rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950 px-4 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            placeholder="Say something…"
            maxLength={1000}
            disabled={sending}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div ref={plusRef} className="relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                setEmojiOpen(false);
                setPlusOpen((v) => !v);
              }}
              aria-label="Emoji or GIF"
              aria-expanded={plusOpen}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                plusOpen ? "bg-white text-black" : "text-zinc-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Plus className={`h-4 w-4 transition-transform ${plusOpen ? "rotate-45" : ""}`} />
            </button>
            {plusOpen && (
              <div className="absolute bottom-full right-0 z-30 mb-2 flex items-center gap-1 rounded-full border border-white/10 bg-zinc-950 p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setPlusOpen(false);
                    setEmojiOpen(true);
                  }}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <Smile className="h-4 w-4" />
                  Emoji
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlusOpen(false);
                    setGifOpen(true);
                  }}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <Sparkles className="h-4 w-4" />
                  GIF
                </button>
              </div>
            )}
            {/* Anchored here (the wrapper sits at the "+"), triggers hidden. */}
            <EmojiPickerComponent
              hideTrigger
              open={emojiOpen}
              onOpenChange={setEmojiOpen}
              onEmojiSelect={handleEmoji}
              align="right"
            />
            <GifPicker hideTrigger open={gifOpen} onOpenChange={setGifOpen} onShare={sendMarker} />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span
            className={`text-[11px] ${
              input.length > 800
                ? overLimit
                  ? "text-red-400"
                  : "text-zinc-400"
                : "text-zinc-400"
            }`}
          >
            {input.length > 800
              ? `${input.length}/1000`
              : "Be nice in chat! Use @ to mention."}
          </span>
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="rounded-md bg-white px-4 py-1.5 text-[13px] font-bold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "…" : "Chat"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Row + body renderer ─────────────────────────────────────────── */

function Avatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${toneFor(name)}`}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function ChatRow({
  avatar,
  displayName,
  text,
  replyTo,
  quotedGif,
  reactions,
  myUserId,
  mentionsMe,
  stamp,
  mentionTargets,
  onReply,
  onReact,
}: {
  avatar?: string;
  displayName: string;
  text: string;
  replyTo?: ChatReplyTo;
  /** The quoted original's GIF, when it was one — drawn in the quote. */
  quotedGif?: GifData | null;
  /** emoji → userIds, as stored/broadcast by the server. */
  reactions?: Record<string, string[]>;
  myUserId?: string;
  /** This message tagged you — tinted so the alert has somewhere to land. */
  mentionsMe?: boolean;
  stamp: string;
  mentionTargets: MentionTarget[];
  /** Omitted for rows that can't be quoted (no server id yet). */
  onReply?: () => void;
  /** Omitted for rows that can't be reacted to (no server id yet). */
  onReact?: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // A GIF or sticker arrives encoded inside `text`; anything else is
  // ordinary chat and renders as before.
  const marker = parseMarker(text);
  const gif = marker?.type === "gif" ? marker.data : null;

  // First linkified URL in the body, if any — unfurled below the text.
  // Skipped for a GIF: the marker's JSON contains the image URL, which would
  // otherwise be unfurled as if the sender had pasted a link.
  const previewUrl = useMemo(() => {
    if (parseMarker(text)?.type === "gif") return null;
    const m = text.match(FIRST_URL_RE);
    if (!m) return null;
    return m[0].startsWith("http") ? m[0] : `https://${m[0]}`;
  }, [text]);

  const reactionEntries = Object.entries(reactions || {}).filter(
    ([, uids]) => Array.isArray(uids) && uids.length > 0,
  );

  return (
    <li
      className={`group flex items-start gap-2 rounded-lg py-1.5 pr-3 transition-colors hover:bg-white/[0.04] ${
        mentionsMe
          ? "border-l-2 border-[#25D366] bg-[#25D366]/[0.08] pl-[10px]"
          : "px-3"
      }`}
      onMouseLeave={() => setPickerOpen(false)}
    >
      <Avatar name={displayName} src={avatar} />
      <div className="min-w-0 flex-1">
        {/* Sender and time own their own line — with the message text trailing
            them inline, a stamp reads as the first word of what was said. */}
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[13px] font-bold leading-snug text-white">
            {displayName}
          </span>
          {stamp && (
            <span className="text-[10px] font-medium tabular-nums text-zinc-500">
              {stamp}
            </span>
          )}
        </p>
        {/* The quoted original, sitting BETWEEN the sender line and the reply
            body — the reading order is then "who is talking → what they are
            answering → what they said". Above the sender line (where this used
            to be) it out-weighed the author's own name and read like a message
            of its own. One line, quiet colours, arrow + name + snippet, so it
            stays subordinate to the actual message. */}
        {replyTo && (
          <div
            className={`my-1 flex w-fit max-w-full items-center gap-1.5 overflow-hidden bg-white/[0.06] text-[11px] leading-none ${
              quotedGif ? "rounded-lg py-1 pl-1 pr-2.5" : "rounded-full py-[3px] pl-2 pr-2.5"
            }`}
          >
            {/* A quoted GIF shows the GIF — that is what the reply is about;
                the word alone said nothing. Text quotes keep the arrow. */}
            {quotedGif ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={quotedGif.url}
                alt=""
                loading="lazy"
                className="h-7 w-7 shrink-0 rounded-md bg-white/10 object-cover"
              />
            ) : (
              <CornerUpLeft className="h-3 w-3 shrink-0 text-zinc-500" />
            )}
            <span className="shrink-0 font-semibold text-zinc-300">
              {replyTo.name}
            </span>
            <span
              aria-hidden
              className="h-2.5 w-px shrink-0 rounded-full bg-white/15"
            />
            <span className="truncate text-zinc-500">
              {quotedGif ? (quotedGif.kind === "sticker" ? "Sticker" : "GIF") : replyTo.snippet}
            </span>
          </div>
        )}
        {gif ? (
          <GifBubble data={gif} />
        ) : (
          <p className="break-words text-[13px] leading-snug text-zinc-300">
            {renderMessageBody(text, mentionTargets, myUserId)}
          </p>
        )}
        {previewUrl && <LinkPreview url={previewUrl} />}

        {/* The emoji tray expands the row instead of floating above it.
            As a popover it was clipped by the scrolling list — the topmost
            message had nothing above it but the tab bar, so the tray opened
            straight into it and became invisible. Raising z-index can't fix
            that: the clipping comes from the list's overflow, not stacking.
            In flow it also survives the panel auto-scrolling on every new
            message, which a positioned popover does not. */}
        {pickerOpen && onReact && (
          <div className="mt-1.5 flex w-fit flex-wrap gap-0.5 rounded-full border border-white/10 bg-zinc-950 px-1.5 py-1 shadow-xl">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  onReact(emoji);
                }}
                aria-label={`React with ${emoji}`}
                className="rounded-full p-1 text-[15px] leading-none transition-transform hover:scale-125 hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {/* Reaction chips. Clicking a chip toggles your own reaction on
            that emoji — the server treats every react as a toggle. */}
        {reactionEntries.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactionEntries.map(([emoji, uids]) => {
              const mine = !!myUserId && uids.includes(myUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact?.(emoji)}
                  disabled={!onReact}
                  aria-label={`${emoji} ${uids.length}${mine ? ", you reacted" : ""}`}
                  className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition-colors ${
                    mine
                      ? "border-sky-400/50 bg-sky-400/15 text-white"
                      : "border-white/10 bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12]"
                  } ${onReact ? "" : "cursor-default"}`}
                >
                  <span>{emoji}</span>
                  <span className="font-semibold tabular-nums">
                    {uids.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {(onReply || onReact) && (
        <div className="flex shrink-0 items-center">
          {onReact && (
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              aria-label={`React to ${displayName}'s message`}
              // Revealed on hover on a pointer device; a touch screen has no
              // hover, so there it simply stays visible. Stays visible while
              // its picker is open so it doesn't vanish under the cursor.
              className={`rounded-md p-1 text-zinc-500 transition-opacity hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
                pickerOpen ? "bg-white/10 text-white opacity-100" : "opacity-0"
              }`}
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
          )}
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              aria-label={`Reply to ${displayName}`}
              className="rounded-md p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// Highlight `@Name` substrings that match a known participant. We
// can't use linkify on the whole string because mentions need
// independent styling. Strategy: split the text on the longest
// matching mention names first (so "@John Doe" wins over "@John"),
// run linkify on the in-between segments, and stitch back together.
// Every row now shares one background, so links no longer need the
// per-side tint the old own/other bubbles required.
function renderMessageBody(
  text: string,
  targets: MentionTarget[],
  myUserId?: string,
): React.ReactNode {
  if (!targets.length) return linkifyText(text);

  // Name -> id, so a match can tell "they were tagged" from "I was tagged".
  const byName = new Map<string, string>();
  for (const t of targets) if (t.name) byName.set(t.name, t.userId);
  const sortedNames = Array.from(byName.keys()).sort(
    (a, b) => b.length - a.length,
  );
  const escaped = sortedNames.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  if (!escaped.length) return linkifyText(text);
  const re = new RegExp(`@(${escaped.join("|")})\\b`, "g");

  const out: React.ReactNode[] = [];
  let cursor = 0;
  let i = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      out.push(
        <span key={`t-${i++}`}>
          {linkifyText(text.slice(cursor, start))}
        </span>,
      );
    }
    // WhatsApp-style: the name carries the accent colour rather than just
    // going bold, which against zinc-300 body text was barely a difference.
    // Your own name additionally gets a tinted pill — in a fast-moving room
    // colour alone is easy to scroll past.
    const isMe = !!myUserId && byName.get(match[1]) === myUserId;
    out.push(
      <span
        key={`m-${i++}`}
        className={
          isMe
            ? `rounded px-1 font-semibold ${MENTION_COLOR} bg-[#25D366]/15`
            : `font-semibold ${MENTION_COLOR}`
        }
      >
        {match[0]}
      </span>,
    );
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    out.push(
      <span key={`t-${i++}`}>
        {linkifyText(text.slice(cursor))}
      </span>,
    );
  }
  return out;
}

// ── Pin ad-video card ─────────────────────────────────────────────────────
// Rendered inline in the chat stream whenever the host unpins a product
// whose AI ad video had finished. Click-to-expand inline player so users
// don't have to leave chat to watch it.
function PinVideoCardRow({
  videoUrl,
  itemName,
}: {
  videoUrl: string;
  itemName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[320px] overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
        {expanded ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="aspect-video w-full bg-black object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="group relative flex aspect-video w-full items-center justify-center bg-black"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.12] to-white/[0.03] transition-colors group-hover:from-white/20 group-hover:to-white/[0.06]" />
            <div className="relative flex flex-col items-center gap-2 text-white">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors group-hover:bg-white/30">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 4l10 6-10 6V4z" />
                </svg>
              </div>
              <span className="text-xs font-medium">Play product ad</span>
            </div>
          </button>
        )}
        <div className="border-t border-white/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Featured earlier
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">
            {itemName}
          </p>
        </div>
      </div>
    </div>
  );
}
