'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Users, MessageSquare, Send, UserX, Mic, MicOff, Bot, PanelRightClose, Smile, Reply, X, CircleDot, Hand } from 'lucide-react';
import { useParticipants, useIsSpeaking, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';
import type { ReceivedChatMessage } from '@livekit/components-react';
import { parseParticipantMeta } from '@/lib/meet-metadata';
import { linkifyText } from '@/lib/linkify';
import { ParticipantAvatar } from './ParticipantAvatar';

interface MentionTarget {
  identity: string;
  name: string;
  avatar?: string;
}

interface ReplyTarget {
  id: string;
  identity: string;
  name: string;
  snippet: string;
}

const ACTIVE_MENTION_RE = /(?:^|\s)@([\w][\w\s'._-]{0,29})$/;

// LiveKit's chat doesn't carry custom metadata, so we wrap the message
// body in a JSON envelope when there's a reply. Old clients that
// haven't reloaded see the raw JSON; parseChatBody on receive is
// resilient to non-envelope plain text so nothing crashes.
const ENVELOPE_MARKER = '__nc_chat_v1__';

function encodeChatBody(text: string, replyTo: ReplyTarget | null): string {
  if (!replyTo) return text;
  return JSON.stringify({
    v: ENVELOPE_MARKER,
    replyTo,
    text,
  });
}

function decodeChatBody(raw: string): { text: string; replyTo?: ReplyTarget } {
  if (!raw) return { text: '' };
  // Cheap upfront check — most messages are plain text.
  if (raw.charAt(0) !== '{' || !raw.includes(ENVELOPE_MARKER)) {
    return { text: raw };
  }
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.v === ENVELOPE_MARKER && typeof obj.text === 'string') {
      const r = obj.replyTo;
      const replyTo: ReplyTarget | undefined =
        r &&
        typeof r.id === 'string' &&
        typeof r.identity === 'string' &&
        typeof r.name === 'string' &&
        typeof r.snippet === 'string'
          ? {
              id: r.id.slice(0, 64),
              identity: r.identity.slice(0, 64),
              name: r.name.slice(0, 80),
              snippet: r.snippet.slice(0, 200),
            }
          : undefined;
      return { text: obj.text, replyTo };
    }
  } catch {
    /* fall through — treat as plain text */
  }
  return { text: raw };
}

function buildSnippet(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 120 ? trimmed.slice(0, 117) + '…' : trimmed;
}

// Curated emoji set — small enough to inline without pulling
// emoji-picker-react. Same set the floating MeetChatPanel uses.
const QUICK_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘',
  '😎', '🤔', '🙃', '😏', '😢', '😭', '😡', '🤯',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '👋', '✌️',
  '🔥', '⭐', '✨', '🎉', '🎊', '💯', '❤️', '💔',
  '🚀', '💡', '✅', '❌', '⏰', '📌', '📎', '🤖',
];

type SidebarTab = 'people' | 'chat' | 'memo' | 'recordings' | 'memos';

// Access-control: pending permission request surfaced to the host in
// the People tab. Shape mirrors the backend (PermissionRequest in
// routes/livekitRecording.ts). Only ever populated for the host — the
// parent gates the prop on isHost.
export interface PendingPermissionRequest {
  userId: string;
  name: string;
  kind: 'unmute' | 'present' | 'both';
  requestedAt: number;
}

interface MeetSidebarProps {
  isOpen: boolean;
  onClose(): void;
  isHost: boolean;
  onKick?(identity: string, name: string): void;
  // Host mute-microphone action. Same visibility rules as onKick
  // (hosts only, not self / bots / other hosts). Hidden when the
  // participant has no publishable mic track at the moment.
  onMute?(identity: string, trackSid: string, name: string): void;
  // Access-control: participants asking to unmute / present. The
  // People tab shows one card per request with Approve / Deny.
  // Empty (or omitted) → no pending block, no red dot. Only meaningful
  // for the host; parent should pass [] for non-hosts.
  pendingRequests?: PendingPermissionRequest[];
  onGrantPermission?(userId: string, kind: 'unmute' | 'present' | 'both'): void;
  onDenyPermission?(userId: string): void;
  // Raised-hand identities. Sidebar renders a ✋ badge next to each
  // matching row in the People tab, and — when the local user is host
  // AND onLowerHand is provided — surfaces a "Lower" button to force
  // it back down. Broadcast via LiveKit DataChannel (see
  // hooks/office/useHandRaise), not persisted.
  raisedHands?: Set<string>;
  onLowerHand?(identity: string): void;
  // Access-control policy — current room-level toggles. Rendered as a
  // host-only settings block at the top of the People tab so the
  // meeting host can flip these mid-call without going back to the
  // pre-join modal. Non-hosts see the block as read-only info (or,
  // more usually, we just don't pass the setter and the block hides).
  accessPolicy?: { allowUnmute: boolean; allowPresent: boolean };
  onSetAccessPolicy?(next: { allowUnmute: boolean; allowPresent: boolean }): Promise<void> | void;
  // Recordings tab body — rendered as-is when tab === 'recordings'. The
  // sidebar doesn't own the data or refresh logic; the parent passes an
  // already-rendered <RecordingsPanel/> so the hook stays in the
  // conference room's scope. Omit to hide the tab entirely.
  recordingsSlot?: React.ReactNode;
  // Voice-memo tab body — same slot pattern as recordingsSlot. Omit
  // to hide the tab.
  memosSlot?: React.ReactNode;
  chatMessages: ReceivedChatMessage[];
  onSendMessage(message: string): void;
  isSending: boolean;
  unreadCount: number;
  onChatViewed(): void;
  onChatHidden(): void;
  /** When the parent wants to open on a specific tab (e.g. from ControlBar). */
  activeTab?: SidebarTab;
  onActiveTabChange?(tab: SidebarTab): void;
}

function ParticipantRow({
  participant,
  isLocalHost,
  onKick,
  onMute,
  handRaised,
  onLowerHand,
}: {
  participant: Participant;
  isLocalHost: boolean;
  onKick?(identity: string, name: string): void;
  // Host mic-mute action. Fires with the participant's identity + the
  // trackSid of their published microphone. Sidebar looks up the
  // mic publication on the participant object at click-time so the
  // caller doesn't need to track track SIDs.
  onMute?(identity: string, trackSid: string, name: string): void;
  // Ephemeral hand-raise state derived from the DataChannel broadcast
  // (see hooks/office/useHandRaise). Draws a ✋ badge next to the
  // participant's name and — for the host — a "Lower" button.
  handRaised?: boolean;
  onLowerHand?(identity: string): void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity;
  const meta = parseParticipantMeta(participant.metadata);
  const participantIsHost = meta.isHost;
  const participantIsBot = meta.isBot;

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/[0.04]">
      <div className="relative h-8 w-8 shrink-0">
        {participantIsBot ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Bot className="h-4 w-4" />
          </div>
        ) : (
          <ParticipantAvatar name={name} avatarUrl={meta.avatar} sizeClass="h-8 w-8" textSizeClass="text-xs" />
        )}
        {isSpeaking && (
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111116] bg-green-400 animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white truncate">{name}</span>
          {participantIsBot && (
            <span className="shrink-0 inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300 border border-emerald-500/20">
              <Bot className="h-2.5 w-2.5" />
              Bot
            </span>
          )}
          {participantIsHost && !participantIsBot && (
            <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-medium text-purple-400">
              Host
            </span>
          )}
          {handRaised && (
            <span
              className="shrink-0 inline-flex items-center rounded bg-amber-500/20 px-1 py-0.5 text-amber-300"
              title="Hand raised"
              aria-label="Hand raised"
            >
              <Hand className="h-3 w-3" />
            </span>
          )}
          {participant.isLocal && (
            <span className="shrink-0 text-[10px] text-gray-500">(you)</span>
          )}
        </div>
        {participantIsBot && (
          <div className="text-[10px] text-gray-500 mt-0.5">
            Recording transcript & summary
          </div>
        )}
      </div>
      {/* Host actions: mute mic + remove. Rendered only for other
          humans (not self, other hosts, or the note-taker bot) and
          only when the corresponding callback is provided. Kick is
          the destructive rightmost action; mute sits just before it. */}
      {isLocalHost &&
        !participant.isLocal &&
        !participantIsHost &&
        !participantIsBot &&
        onMute &&
        (() => {
          // Look up the mic publication at render time. If the
          // participant hasn't published one (mic off from the start
          // / permissions blocked), hide the button — there's nothing
          // to mute.
          const pub =
            typeof (participant as any).getTrackPublication === "function"
              ? (participant as any).getTrackPublication(Track.Source.Microphone)
              : undefined;
          if (!pub || pub.isMuted || !pub.trackSid) return null;
          return (
            <button
              onClick={() => onMute(participant.identity, pub.trackSid, name)}
              className="shrink-0 rounded-lg p-1.5 text-gray-600 transition hover:bg-white/[0.06] hover:text-amber-300"
              title="Mute microphone"
            >
              <MicOff className="h-3.5 w-3.5" />
            </button>
          );
        })()}
      {/* Host action: lower a raised hand. Rendered only when the row
          is currently raised. Non-hosts never see this button. */}
      {isLocalHost && handRaised && onLowerHand && !participantIsBot && (
        <button
          onClick={() => onLowerHand(participant.identity)}
          className="shrink-0 rounded-lg p-1.5 text-gray-600 transition hover:bg-white/[0.06] hover:text-amber-300"
          title="Lower hand"
        >
          <Hand className="h-3.5 w-3.5" />
        </button>
      )}
      {isLocalHost &&
        !participant.isLocal &&
        !participantIsHost &&
        !participantIsBot &&
        onKick && (
          <button
            onClick={() => onKick(participant.identity, name)}
            className="shrink-0 rounded-lg p-1.5 text-gray-600 transition hover:bg-white/[0.06] hover:text-red-400"
            title="Remove from meeting"
          >
            <UserX className="h-3.5 w-3.5" />
          </button>
        )}
    </div>
  );
}

function HostControlsBlock({
  policy,
  onSet,
}: {
  policy: { allowUnmute: boolean; allowPresent: boolean };
  onSet(next: { allowUnmute: boolean; allowPresent: boolean }): Promise<void> | void;
}) {
  const [busy, setBusy] = useState<'unmute' | 'present' | null>(null);

  const flip = async (key: 'allowUnmute' | 'allowPresent') => {
    const which = key === 'allowUnmute' ? 'unmute' : 'present';
    if (busy) return;
    setBusy(which);
    try {
      await onSet({ ...policy, [key]: !policy[key] });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
          Host controls
        </div>
      </div>
      <SidebarToggleRow
        title="Everyone can unmute"
        checked={policy.allowUnmute}
        loading={busy === 'unmute'}
        onToggle={() => flip('allowUnmute')}
      />
      <SidebarToggleRow
        title="Everyone can present"
        checked={policy.allowPresent}
        loading={busy === 'present'}
        onToggle={() => flip('allowPresent')}
      />
    </div>
  );
}

function SidebarToggleRow({
  title,
  checked,
  loading,
  onToggle,
}: {
  title: string;
  checked: boolean;
  loading: boolean;
  onToggle(): void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04] disabled:opacity-60"
      type="button"
    >
      <span className="text-sm text-white">{title}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? 'bg-amber-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export default function MeetSidebar({
  isOpen,
  onClose,
  isHost,
  onKick,
  onMute,
  pendingRequests,
  onGrantPermission,
  onDenyPermission,
  raisedHands,
  onLowerHand,
  accessPolicy,
  onSetAccessPolicy,
  recordingsSlot,
  memosSlot,
  chatMessages,
  onSendMessage,
  isSending,
  unreadCount,
  onChatViewed,
  onChatHidden,
  activeTab,
  onActiveTabChange,
}: MeetSidebarProps) {
  const pendingList = pendingRequests ?? [];
  const [internalTab, setInternalTab] = useState<SidebarTab>('people');
  const tab = activeTab ?? internalTab;
  const setTab = (next: SidebarTab) => {
    setInternalTab(next);
    onActiveTabChange?.(next);
  };

  const [chatInput, setChatInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  // Keyboard inset (mobile only): when the on-screen keyboard opens it shrinks
  // the visual viewport but NOT the layout viewport, so the bottom-anchored
  // chat input on the full-screen overlay would hide behind the keyboard. We
  // pad the panel by the overlap so the input rides just above it.
  const [kbInset, setKbInset] = useState(0);
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // identity → name/avatar lookup (used by message bubbles + mention picker)
  const directory = useMemo(() => {
    const m = new Map<string, { name: string; avatar?: string; isBot: boolean }>();
    for (const p of participants) {
      const meta = parseParticipantMeta(p.metadata);
      m.set(p.identity, {
        name: p.name || meta.displayName || p.identity,
        avatar: meta.avatar,
        isBot: meta.isBot,
      });
    }
    return m;
  }, [participants]);

  const mentionTargets: MentionTarget[] = useMemo(
    () =>
      Array.from(directory.entries())
        .filter(([id, info]) => !info.isBot && id !== localParticipant.identity)
        .map(([id, info]) => ({ identity: id, name: info.name, avatar: info.avatar })),
    [directory, localParticipant.identity],
  );

  const filteredMentions = useMemo(() => {
    if (!mentionState) return [] as MentionTarget[];
    const q = mentionState.query.toLowerCase();
    if (!q) return mentionTargets.slice(0, 6);
    return mentionTargets
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionState, mentionTargets]);

  useEffect(() => {
    setMentionIndex(0);
  }, [filteredMentions.length, mentionState?.query]);

  // Click-away for the emoji popover.
  useEffect(() => {
    if (!showEmoji) return;
    const onDoc = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showEmoji]);

  // Track the on-screen keyboard via visualViewport (mobile only). The overlap
  // is innerHeight − (viewport height + its top offset); we only treat a sizable
  // overlap as a keyboard so address-bar collapse doesn't trigger it.
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onChange = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      setKbInset(isMobile && overlap > 80 ? overlap : 0);
    };
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    onChange();
    return () => {
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
    };
  }, []);

  // Auto-scroll chat on new message
  useEffect(() => {
    if (tab === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, tab]);

  // Track chat visibility for unread counting
  useEffect(() => {
    if (tab === 'chat' && isOpen) {
      onChatViewed();
    } else {
      onChatHidden();
    }
  }, [tab, isOpen, onChatViewed, onChatHidden]);

  function detectMentionState(value: string, caret: number) {
    const left = value.slice(0, caret);
    const m = left.match(ACTIVE_MENTION_RE);
    if (!m) {
      setMentionState(null);
      return;
    }
    const query = m[1] ?? '';
    setMentionState({ query, start: caret - query.length - 1 });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setChatInput(v);
    detectMentionState(v, e.target.selectionStart ?? v.length);
  }

  function handleSelect(e: React.SyntheticEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    detectMentionState(el.value, el.selectionStart ?? el.value.length);
  }

  function insertMention(target: MentionTarget) {
    if (!mentionState) return;
    const before = chatInput.slice(0, mentionState.start);
    const caret = inputRef.current?.selectionStart ?? chatInput.length;
    const after = chatInput.slice(caret);
    const inserted = `@${target.name} `;
    const next = before + inserted + after;
    setChatInput(next);
    setMentionState(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = before.length + inserted.length;
      el.setSelectionRange(pos, pos);
      el.focus();
    });
  }

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? chatInput.length;
    const next = chatInput.slice(0, caret) + emoji + chatInput.slice(caret);
    setChatInput(next);
    setShowEmoji(false);
    requestAnimationFrame(() => {
      const elRef = inputRef.current;
      if (!elRef) return;
      const pos = caret + emoji.length;
      elRef.setSelectionRange(pos, pos);
      elRef.focus();
    });
  }

  function handleSend() {
    if (!chatInput.trim()) return;
    // Wrap in JSON envelope when replying so receivers can render the
    // quoted preview. Plain messages still go out as plain text.
    onSendMessage(encodeChatBody(chatInput.trim(), replyingTo));
    setChatInput('');
    setMentionState(null);
    setReplyingTo(null);
  }

  function startReply(msg: ReceivedChatMessage, decodedText: string) {
    if (!msg.id) return;
    const fromIdentity = msg.from?.identity ?? '';
    const info = directory.get(fromIdentity);
    setReplyingTo({
      id: msg.id,
      identity: fromIdentity,
      name: info?.name || msg.from?.name || fromIdentity || 'Unknown',
      snippet: buildSnippet(decodedText),
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mentionState && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionState(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(timestamp: number) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile: dim + tap-to-dismiss backdrop behind the full-screen panel.
          Desktop (md+) the panel is an in-flow column, so no backdrop. */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
        aria-hidden
      />
      {/* On <md the panel is a fixed full-screen overlay (so it never steals
          width from the video column → control bar can't collapse). On md+ it
          returns to the in-flow w-80 side column. */}
      <aside
        className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-[#111116] md:static md:inset-auto md:z-auto md:h-full md:w-80 md:shrink-0 md:border-l md:border-[#2a2a35] md:!pb-0"
        style={{ paddingBottom: kbInset || undefined }}
      >
      {/* Header with tabs. Tab row scrolls horizontally on overflow
          (5 tabs + badges can exceed the 320px sidebar width when
          participant / unread counts push the labels further out).
          Close button stays shrink-0 on the right so it never gets
          pushed off-screen — earlier we had it fighting the tab row
          for space and it would collapse to zero width. */}
      <div className="flex items-center justify-between gap-1 border-b border-[#2a2a35] px-2 py-1.5">
        <div
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => setTab('people')}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === 'people'
                ? 'bg-white/[0.08] text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            People
            <span className="rounded-full bg-white/[0.1] px-1.5 py-0.5 text-[10px]">
              {participants.length}
            </span>
            {pendingList.length > 0 && tab !== 'people' && (
              <span
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#111116]"
                aria-label={`${pendingList.length} pending request${pendingList.length === 1 ? '' : 's'}`}
              />
            )}
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === 'chat'
                ? 'bg-white/[0.08] text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
            {unreadCount > 0 && tab !== 'chat' && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {recordingsSlot !== undefined && (
            <button
              onClick={() => setTab('recordings')}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === 'recordings'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <CircleDot className="h-3.5 w-3.5" />
              Recordings
            </button>
          )}
          {memosSlot !== undefined && (
            <button
              onClick={() => setTab('memos')}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === 'memos'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              Memos
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
          title="Close sidebar"
          aria-label="Close sidebar"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* People tab */}
      {tab === 'people' && (
        <div className="flex-1 overflow-y-auto p-2">
          {/* Host controls — access policy for the room, editable
              mid-meeting. Hidden entirely when the caller doesn't
              pass the setter (i.e. non-host, or feature disabled).
              Each toggle POSTs /livekit/policy through
              useAccessControl.setRoomPolicy; the socket broadcast
              flips every other client's UI live. */}
          {isHost && accessPolicy && onSetAccessPolicy && (
            <HostControlsBlock
              policy={accessPolicy}
              onSet={onSetAccessPolicy}
            />
          )}
          {/* Access-control: participants asking to unmute / present.
              Rendered above the participants list so the host sees them
              first when they open the tab. Approve widens the
              participant's canPublishSources allowlist server-side;
              deny just clears the request. */}
          {pendingList.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">
                  Permission requests
                </div>
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                  {pendingList.length}
                </span>
              </div>
              {pendingList.map((req) => {
                const what =
                  req.kind === 'both'
                    ? 'unmute & present'
                    : req.kind === 'unmute'
                      ? 'unmute'
                      : 'present';
                return (
                  <div
                    key={req.userId}
                    className="mb-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 last:mb-0"
                  >
                    <ParticipantAvatar
                      name={req.name}
                      sizeClass="h-7 w-7"
                      textSizeClass="text-[10px]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-white">
                        {req.name}
                      </div>
                      <div className="truncate text-[10px] text-amber-200/80">
                        wants to {what}
                      </div>
                    </div>
                    <button
                      onClick={() => onDenyPermission?.(req.userId)}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] text-gray-300 transition hover:bg-white/[0.08] hover:text-white"
                      title="Deny request"
                    >
                      Deny
                    </button>
                    <button
                      onClick={() =>
                        onGrantPermission?.(req.userId, req.kind)
                      }
                      className="shrink-0 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-black transition hover:bg-amber-400"
                      title="Approve request"
                    >
                      Approve
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Sort raised-hand participants to the top so the host
              spots them without scrolling. Stable within each group
              (raised / not) — just partitions the list. */}
          {[...participants]
            .sort((a, b) => {
              const ra = raisedHands?.has(a.identity) ? 1 : 0;
              const rb = raisedHands?.has(b.identity) ? 1 : 0;
              return rb - ra;
            })
            .map((p) => (
              <ParticipantRow
                key={p.identity}
                participant={p}
                isLocalHost={isHost}
                onKick={onKick}
                onMute={onMute}
                handRaised={raisedHands?.has(p.identity)}
                onLowerHand={onLowerHand}
              />
            ))}
        </div>
      )}

      {/* Chat tab */}
      {tab === 'chat' && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <p className="text-xs">No messages yet</p>
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const isOwn = msg.from?.identity === localParticipant.identity;
                const fromIdentity = msg.from?.identity ?? '';
                const info = directory.get(fromIdentity);
                const displayName = isOwn
                  ? 'You'
                  : info?.name || msg.from?.name || msg.from?.identity || 'Unknown';
                const avatar = info?.avatar;
                const prev = chatMessages[i - 1];
                const grouped =
                  !!prev &&
                  prev.from?.identity === fromIdentity &&
                  msg.timestamp - prev.timestamp < 5 * 60_000;
                // Decode JSON envelope so we render the unwrapped text +
                // the quoted preview if any. Plain messages pass through.
                const decoded = decodeChatBody(msg.message);
                return (
                  <ChatRow
                    key={msg.id}
                    isOwn={isOwn}
                    grouped={grouped}
                    avatar={avatar}
                    displayName={displayName}
                    text={decoded.text}
                    replyTo={decoded.replyTo}
                    timestamp={msg.timestamp}
                    formatTime={formatTime}
                    mentionTargets={mentionTargets}
                    onReply={() => startReply(msg, decoded.text)}
                  />
                );
              })
            )}
          </div>

          {/* Chat input — emoji picker + mention autocomplete */}
          <div className="relative border-t border-[#2a2a35] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {mentionState && filteredMentions.length > 0 && (
              <div className="absolute bottom-full left-3 right-3 mb-1 max-h-56 overflow-y-auto rounded-lg border border-[#2a2a35] bg-[#0e0e12] shadow-xl">
                {filteredMentions.map((m, idx) => (
                  <button
                    key={m.identity}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(m);
                    }}
                    onMouseEnter={() => setMentionIndex(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${
                      idx === mentionIndex ? 'bg-[#1e1e28]' : 'hover:bg-[#1a1a22]'
                    }`}
                  >
                    {m.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatar}
                        alt={m.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-[#2a2a35] flex items-center justify-center text-[10px] font-semibold text-white">
                        {(m.name || '?')[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="text-white truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            )}

            {showEmoji && (
              <div
                ref={emojiRef}
                className="absolute bottom-full left-3 right-3 mb-2 z-10 grid max-w-[calc(100vw-1.5rem)] grid-cols-8 gap-1 rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-2 shadow-2xl sm:right-auto sm:max-w-none"
              >
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="h-7 w-7 rounded hover:bg-[#1a1a22] text-lg leading-none"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {replyingTo && (
              <div className="flex items-start gap-2 rounded-lg border-l-2 border-blue-500 bg-[#1a1a22] px-2 py-1.5 mb-2">
                <Reply className="h-3 w-3 mt-0.5 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-blue-300">
                    Replying to {replyingTo.name}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {replyingTo.snippet}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-0.5 text-gray-500 hover:text-white"
                  title="Cancel reply"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
                title="Add emoji"
              >
                <Smile className="h-5 w-5" />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onSelect={handleSelect}
                placeholder="Type a message — use @ to mention"
                className="flex-1 min-w-0 rounded-full border border-[#2a2a35] bg-[#1a1a24] px-4 py-2 text-base sm:text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50"
              />
              <button
                onClick={handleSend}
                disabled={!chatInput.trim() || isSending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Recordings tab — list of past LiveKit egress recordings for this
          room with inline playback + download. Parent owns the fetch
          hook and renders the panel; sidebar just slots it in. */}
      {tab === 'recordings' && recordingsSlot}
      {/* Voice memo tab — MemosPanel handles record + list + play +
          delete. NC's /voice-memos endpoint does the transcription
          and title generation upstream. */}
      {tab === 'memos' && memosSlot}
      </aside>
    </>
  );
}

/* ── Chat row + body renderer ────────────────────────────────────── */

function ChatRow({
  isOwn,
  grouped,
  avatar,
  displayName,
  text,
  replyTo,
  timestamp,
  formatTime,
  mentionTargets,
  onReply,
}: {
  isOwn: boolean;
  grouped: boolean;
  avatar?: string;
  displayName: string;
  text: string;
  replyTo?: ReplyTarget;
  timestamp: number;
  formatTime: (ts: number) => string;
  mentionTargets: MentionTarget[];
  onReply?: () => void;
}) {
  return (
    <div className={`group flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="flex-shrink-0 w-7">
        {!grouped ? (
          avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={displayName}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ${
                isOwn ? 'bg-blue-600' : 'bg-[#2a2a35]'
              }`}
            >
              {(displayName || '?')[0]?.toUpperCase()}
            </span>
          )
        ) : null}
      </div>
      <div
        className={`flex flex-col min-w-0 ${isOwn ? 'items-end' : 'items-start'}`}
        style={{ maxWidth: '80%' }}
      >
        {!grouped && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] text-gray-400">{displayName}</span>
            <span className="text-[10px] text-gray-600">{formatTime(timestamp)}</span>
          </div>
        )}
        <div
          className={`max-w-full rounded-2xl px-3 py-1.5 text-sm break-all ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-[#1e1e28] text-gray-200 rounded-bl-md'
          }`}
        >
          {replyTo && (
            <div
              className={`mb-1.5 rounded border-l-2 px-2 py-1 text-xs ${
                isOwn
                  ? 'border-blue-200 bg-blue-700/40 text-blue-50'
                  : 'border-blue-400 bg-black/30 text-gray-300'
              }`}
            >
              <div
                className={`font-semibold text-[11px] ${
                  isOwn ? 'text-blue-100' : 'text-blue-300'
                }`}
              >
                {replyTo.name}
              </div>
              <div className="truncate">{replyTo.snippet}</div>
            </div>
          )}
          {renderMessageBody(text, mentionTargets, isOwn)}
        </div>
      </div>
      {onReply && (
        <button
          type="button"
          onClick={onReply}
          className="self-center p-1 text-gray-500 opacity-0 transition-opacity hover:text-blue-400 group-hover:opacity-100"
          title="Reply"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function renderMessageBody(
  text: string,
  targets: MentionTarget[],
  isOwn: boolean,
): React.ReactNode {
  if (!targets.length) return linkifyText(text, { isOwnMessage: isOwn });
  const sortedNames = targets
    .map((t) => t.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const escaped = sortedNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return linkifyText(text, { isOwnMessage: isOwn });
  const re = new RegExp(`@(${escaped.join('|')})\\b`, 'g');

  const out: React.ReactNode[] = [];
  let cursor = 0;
  let i = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      out.push(
        <span key={`t-${i++}`}>
          {linkifyText(text.slice(cursor, start), { isOwnMessage: isOwn })}
        </span>,
      );
    }
    out.push(
      <span
        key={`m-${i++}`}
        className={`font-semibold ${
          isOwn ? 'text-blue-100 underline' : 'text-blue-300'
        }`}
      >
        {match[0]}
      </span>,
    );
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    out.push(
      <span key={`t-${i++}`}>
        {linkifyText(text.slice(cursor), { isOwnMessage: isOwn })}
      </span>,
    );
  }
  return out;
}
