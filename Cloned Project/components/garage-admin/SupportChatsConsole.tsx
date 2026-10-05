"use client";

// Support Chats console — Admin → Others → Support Chats.
//
// Every member has exactly one support chat (a Group of kind "support"); every
// active admin is a participant, and a reply here is sent as the admin's own
// app user. See garagenew-backend routes/garageAdminSupportChats.ts and the
// Support Chats admin API doc.
//
// The console has no socket, so it polls — and only while the tab is visible:
// the open conversation every ~5s (latest page, merged by _id) and the list +
// counts every ~20s.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Send,
  Languages,
  Loader2,
  RefreshCw,
  ListChecks,
  ChevronUp,
  X,
  Paperclip,
  CornerUpLeft,
  TicketPlus,
  Sparkles,
  Smile,
  UserPlus,
  Pencil,
  Copy,
  Trash2,
  Check,
  CheckCheck,
  AtSign,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  listSupportChats,
  getSupportChat,
  getSupportMessages,
  sendSupportReply,
  deleteSupportMessage,
  markSupportChatRead,
  getSupportTyping,
  reactToSupportMessage,
  editSupportMessage,
  addSupportMember,
  uploadSupportAttachment,
  type OutgoingAttachment,
  translateSupportMessages,
  createTicketFromChat,
  addSupportChatTask,
  getTicketSuggestion,
  type TicketSuggestion,
  SUPPORT_LANGS,
  type SupportChatFilter,
  type SupportChatListItem,
  type SupportChatCounts,
  type SupportChatDetails,
  type SupportMessage,
  type SupportMessageUser,
  type SupportLang,
} from "@/lib/admin-api/support-chats";
import { searchUsers, type AdminUserSuggestion } from "@/lib/admin-api/users";
import { SupportTaskroomBar } from "@/components/garage-admin/SupportTaskroomPicker";
import { SupportChatTaskroomPanel } from "@/components/garage-admin/SupportChatTaskroomPanel";
import { MessageContent } from "@/components/chat/MessageContent";
// Same composer/media pieces as the app's group chat (all token-free).
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { FormatToolbar } from "@/components/chat/FormatToolbar";
import { GifPicker } from "@/components/chat/GifPicker";
import { LocationShareButton } from "@/components/chat/LocationShareButton";
import { ContactShareButton } from "@/components/chat/ContactShareButton";
import { VoiceRecorder } from "@/components/ui/voice-recorder";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";
import { VideoMessageRecorder } from "@/components/chat/VideoMessageRecorder";
import { LinkPreview } from "@/components/ui/link-preview";
import { getFirstUrl } from "@/lib/url-utils";
import { getAdminToken } from "@/lib/auth";

const REACT_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "🙏"];

const LIST_POLL_MS = 20_000;
const THREAD_POLL_MS = 5_000;
const LANG_KEY = "support-chats:lang";

const FILTERS: { key: SupportChatFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unanswered", label: "Awaiting reply" },
  { key: "mine", label: "Assigned to me" },
];

function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function Avatar({
  name,
  src,
  size = 36,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || ""}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-zinc-700 text-zinc-200 grid place-items-center shrink-0 font-medium"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}

export default function SupportChatsConsole() {
  // ── List state ──
  const [filter, setFilter] = useState<SupportChatFilter>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [chats, setChats] = useState<SupportChatListItem[]>([]);
  const [counts, setCounts] = useState<SupportChatCounts>({
    all: 0,
    unanswered: 0,
    mine: 0,
  });
  const [total, setTotal] = useState(0);
  const [limit] = useState(30);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // ── Thread state ──
  const [activeId, setActiveId] = useState<string | null>(null);
  const [details, setDetails] = useState<SupportChatDetails | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [msgUsers, setMsgUsers] = useState<Record<string, SupportMessageUser>>(
    {},
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  // ── Composer ──
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<SupportMessage | null>(null);

  // ── Translation ──
  const [lang, setLang] = useState<SupportLang>("en");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [shownTranslated, setShownTranslated] = useState<Set<string>>(
    new Set(),
  );
  const [translatingAll, setTranslatingAll] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Grow the composer with its content, up to the CSS max-height.
  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  // Members popover in the thread header.
  const [membersOpen, setMembersOpen] = useState(false);

  // Add-member search (inside the members popover).
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<AdminUserSuggestion[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  useEffect(() => {
    const q = addQuery.trim();
    if (!q) {
      setAddResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      searchUsers(q, 8)
        .then((r) => !cancelled && setAddResults(r))
        .catch(() => !cancelled && setAddResults([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addQuery]);
  const addMember = async (userId: string) => {
    if (!activeId || addingMember) return;
    setAddingMember(true);
    try {
      const r = await addSupportMember(activeId, userId);
      toast.success(
        r.added
          ? `Added ${r.member.name || r.member.email || "member"}`
          : "Already a member",
      );
      setAddQuery("");
      setAddResults([]);
      const d = await getSupportChat(activeId);
      setDetails(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  // In-page media lightbox (image / video).
  const [lightbox, setLightbox] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);

  // Emoji picker for the composer.

  // How far the customer has read — own messages show ✓ / ✓✓ off this.
  const [readUpTo, setReadUpTo] = useState<string | null>(null);

  // @mention picker (same behaviour as the app's group chat composer).
  const [mentioned, setMentioned] = useState<{ id: string; name: string }[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionAnchorRef = useRef(-1);
  const mentionCaretRef = useRef(-1);

  // Files dragged over the thread.
  const [dragOver, setDragOver] = useState(false);

  // Attachments staged for the next reply.
  const [pendingAttachments, setPendingAttachments] = useState<
    OutgoingAttachment[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const a = await uploadSupportAttachment(file);
        setPendingAttachments((prev) => [...prev, a]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // "X is typing…" — polled (the console has no socket).
  const [typingNames, setTypingNames] = useState<string[]>([]);
  useEffect(() => {
    if (!activeId) {
      setTypingNames([]);
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      getSupportTyping(activeId)
        .then((t) => !cancelled && setTypingNames(t.map((x) => x.name)))
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
      setTypingNames([]);
    };
  }, [activeId]);

  // Taskroom panel (Rehan's group-chat Taskroom, admin version) and the
  // per-message "Add to Taskroom" action.
  const [taskroomOpen, setTaskroomOpen] = useState(false);
  const [taskroomRefresh, setTaskroomRefresh] = useState(0);
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const addMessageToTaskroom = async (m: SupportMessage) => {
    if (!activeId || taskBusy) return;
    setTaskBusy(m._id);
    try {
      const r = await addSupportChatTask(activeId, { sourceMessageId: m._id });
      toast.success(`Added to Taskroom: ${r.title}`);
      setTaskroomRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add to Taskroom");
    } finally {
      setTaskBusy(null);
    }
  };

  // Delete for everyone.
  const deleteMessage = async (m: SupportMessage) => {
    if (!activeId) return;
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      await deleteSupportMessage(activeId, m._id);
      setMessages((prev) =>
        prev.map((x) =>
          x._id === m._id
            ? { ...x, deletedAt: new Date().toISOString(), text: "", attachments: [], reactions: {} }
            : x,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  // "Create ticket" from a message.
  const [ticketBusy, setTicketBusy] = useState<string | null>(null);
  const createTicket = async (m: SupportMessage) => {
    if (!activeId || ticketBusy) return;
    setTicketBusy(m._id);
    try {
      const r = await createTicketFromChat(activeId, { sourceMessageId: m._id });
      toast.success(
        r.existed
          ? "A ticket is already open for this chat"
          : "Ticket created for this chat",
      );
      setSuggestion(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create ticket");
    } finally {
      setTicketBusy(null);
    }
  };

  // Edit one of the admin's own messages.
  const editMessage = async (messageId: string, text: string) => {
    if (!activeId) return;
    const r = await editSupportMessage(activeId, messageId, text);
    setMessages((prev) =>
      prev.map((m) =>
        m._id === messageId
          ? { ...m, text: r.text, editedAt: r.editedAt }
          : m,
      ),
    );
  };

  // Toggle an emoji reaction on a message.
  const reactToMessage = async (messageId: string, emoji: string) => {
    if (!activeId) return;
    try {
      const r = await reactToSupportMessage(activeId, messageId, emoji);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, reactions: r.reactions } : m,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to react");
    }
  };

  // AI (rule-based fallback) suggestion banner.
  const [suggestion, setSuggestion] = useState<TicketSuggestion | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  // Chats the operator dismissed this session — don't re-nag them.
  const dismissedSuggest = useRef<Set<string>>(new Set());

  const acceptSuggestion = async () => {
    if (!activeId || !suggestion || suggestBusy) return;
    setSuggestBusy(true);
    try {
      const r = await createTicketFromChat(activeId, {
        subject: suggestion.subject,
        description: suggestion.summary || suggestion.subject,
        priority: suggestion.priority,
      });
      toast.success(
        r.existed ? "A ticket is already open for this chat" : "Ticket created",
      );
      setSuggestion(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create ticket");
    } finally {
      setSuggestBusy(false);
    }
  };

  const dismissSuggestion = () => {
    if (activeId) dismissedSuggest.current.add(activeId);
    setSuggestion(null);
  };

  // Fetch a suggestion once per chat open (not on every poll).
  useEffect(() => {
    if (!activeId || threadLoading) return;
    if (dismissedSuggest.current.has(activeId)) return;
    let cancelled = false;
    getTicketSuggestion(activeId)
      .then((s) => {
        if (cancelled) return;
        setSuggestion(s.suggest ? s : null);
      })
      .catch(() => {
        if (!cancelled) setSuggestion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, threadLoading]);

  // Remember last language.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as SupportLang | null;
      if (saved && SUPPORT_LANGS.some((l) => l.code === saved)) setLang(saved);
    } catch {}
  }, []);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // ── Load list ──
  const loadList = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setListLoading(true);
      try {
        const data = await listSupportChats({
          filter,
          q: debouncedQ || undefined,
          page,
          limit,
        });
        setChats(data.chats);
        setCounts(data.counts);
        setTotal(data.total);
        setListError(null);
      } catch (e) {
        setListError(e instanceof Error ? e.message : "Failed to load chats");
      } finally {
        if (!opts.silent) setListLoading(false);
      }
    },
    [filter, debouncedQ, page, limit],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Poll the list while visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadList({ silent: true });
    }, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [loadList]);

  // ── Open a chat ──
  const openChat = useCallback(async (groupId: string) => {
    setActiveId(groupId);
    setThreadLoading(true);
    setThreadError(null);
    setMessages([]);
    setMsgUsers({});
    setNextCursor(null);
    setReplyTo(null);
    setTranslations({});
    setShownTranslated(new Set());
    setMembersOpen(false);
    setSuggestion(null);
    stickToBottom.current = true;
    try {
      const [d, m] = await Promise.all([
        getSupportChat(groupId),
        getSupportMessages(groupId, {}),
      ]);
      setDetails(d);
      setMessages(m.items);
      setMsgUsers(m.users);
      setReadUpTo(m.readUpTo ?? null);
      setNextCursor(m.nextCursor);
      // Opening clears the unread dot.
      markSupportChatRead(groupId)
        .then(() =>
          setChats((prev) =>
            prev.map((c) =>
              c.groupId === groupId ? { ...c, unread: false } : c,
            ),
          ),
        )
        .catch(() => {});
    } catch (e) {
      setThreadError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // Poll the open thread while visible — latest page, merged by _id.
  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const m = await getSupportMessages(activeId, {});
        setMsgUsers((prev) => ({ ...prev, ...m.users }));
        setReadUpTo(m.readUpTo ?? null);
        setMessages((prev) => {
          const seen = new Map(prev.map((x) => [x._id, x]));
          for (const it of m.items) seen.set(it._id, it);
          return Array.from(seen.values()).sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
      } catch {
        // transient; next tick retries
      }
    }, THREAD_POLL_MS);
    return () => clearInterval(id);
  }, [activeId]);

  // Keep the thread pinned to the bottom unless the admin scrolled up.
  useEffect(() => {
    const el = threadRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // ── Load older ──
  const loadOlder = async () => {
    if (!activeId || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    const el = threadRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const m = await getSupportMessages(activeId, { cursor: nextCursor });
      setMsgUsers((prev) => ({ ...prev, ...m.users }));
      setMessages((prev) => {
        const seen = new Map(m.items.map((x) => [x._id, x]));
        for (const it of prev) seen.set(it._id, it);
        return Array.from(seen.values()).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      setNextCursor(m.nextCursor);
      // Preserve scroll position after prepending.
      stickToBottom.current = false;
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load older");
    } finally {
      setLoadingOlder(false);
    }
  };

  // ── @mentions ──
  // Everyone in the chat except the admin themselves, plus @all.
  const mentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const people = (details?.members || [])
      .filter((mem) => mem.id && mem.id !== details?.me)
      .map((mem) => ({
        id: mem.id,
        name: mem.name || mem.email || "Member",
        sub: mem.isMember ? "Customer" : mem.isUpline ? "Upline" : mem.isStaff ? "Support" : mem.email || "",
        picture: mem.profilePicture || null,
      }));
    const all = [{ id: "all", name: "all", sub: "Everyone in this chat", picture: null as string | null }, ...people];
    return all
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q))
      .slice(0, 8);
  }, [details, mentionQuery]);

  // Decide on every keystroke whether the caret sits in an "@token".
  const onDraftChange = (value: string, caret: number) => {
    setDraft(value);
    autosize();
    const upto = value.slice(0, caret);
    const at = upto.lastIndexOf("@");
    const okBefore = at === 0 || (at > 0 && /\s/.test(upto[at - 1]));
    const token = at >= 0 ? upto.slice(at + 1) : "";
    if (at >= 0 && okBefore && /^[^\s@]{0,40}$/.test(token)) {
      mentionAnchorRef.current = at;
      mentionCaretRef.current = caret;
      setMentionQuery(token);
      setMentionIndex(0);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (c: { id: string; name: string }) => {
    const anchor = mentionAnchorRef.current;
    const caret = mentionCaretRef.current;
    if (anchor < 0) return;
    const next = draft.slice(0, anchor) + "@" + c.name + " " + draft.slice(caret);
    setDraft(next);
    setMentioned((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, { id: c.id, name: c.name }]));
    setMentionOpen(false);
    requestAnimationFrame(() => {
      autosize();
      const el = taRef.current;
      if (el) {
        el.focus();
        const pos = anchor + c.name.length + 2;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  // Post one reply and fold it into the thread. Used by the composer and by
  // one-shot shares (GIF, location, contact, voice/video notes).
  const postReply = async (body: {
    text?: string;
    attachments?: OutgoingAttachment[];
    mentions?: string[];
    replyTo?: string;
  }) => {
    if (!activeId) return;
    const msg = await sendSupportReply(activeId, body);
    setMessages((prev) => (prev.some((x) => x._id === msg._id) ? prev : [...prev, msg]));
    stickToBottom.current = true;
    setChats((prev) =>
      prev.map((c) =>
        c.groupId === activeId ? { ...c, awaitingReply: false, unread: false } : c,
      ),
    );
    markSupportChatRead(activeId).catch(() => {});
  };

  const shareMarker = async (encoded: string) => {
    try {
      await postReply({ text: encoded });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    }
  };

  // Voice / video notes: upload, then send straight away (like the app).
  const sendMediaNote = async (file: File) => {
    if (!activeId) return;
    setUploading(true);
    try {
      const a = await uploadSupportAttachment(file);
      await postReply({ attachments: [a] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setUploading(false);
    }
  };

  // ── Send ──
  const send = async () => {
    const text = draft.trim();
    if ((!text && pendingAttachments.length === 0) || !activeId || sending)
      return;
    setSending(true);
    try {
      // Only tags whose "@name" survived editing; a typed "@all" tags everyone.
      const mentions = mentioned.filter((m) => text.includes("@" + m.name)).map((m) => m.id);
      if (/(^|\s)@all\b/i.test(text) && !mentions.includes("all")) mentions.push("all");
      await postReply({
        text: text || undefined,
        replyTo: replyTo?._id,
        attachments: pendingAttachments.length ? pendingAttachments : undefined,
        mentions: mentions.length ? mentions : undefined,
      });
      setDraft("");
      setMentioned([]);
      setMentionOpen(false);
      setPendingAttachments([]);
      setReplyTo(null);
      requestAnimationFrame(autosize);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // ── Translate ──
  const persistLang = (l: SupportLang) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  };

  const translateOne = async (id: string) => {
    if (!activeId) return;
    // Toggle back to original if already showing.
    if (shownTranslated.has(id)) {
      setShownTranslated((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      return;
    }
    if (translations[id]) {
      setShownTranslated((prev) => new Set(prev).add(id));
      return;
    }
    try {
      const data = await translateSupportMessages(activeId, {
        messageIds: [id],
        lang,
      });
      setTranslations((prev) => ({ ...prev, ...data.translations }));
      if (data.translations[id]) {
        setShownTranslated((prev) => new Set(prev).add(id));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    }
  };

  const translateAll = async () => {
    if (!activeId || translatingAll) return;
    const ids = messages
      .filter((m) => m.type !== "system" && !m.deletedAt && m.text)
      .map((m) => m._id);
    if (!ids.length) return;
    setTranslatingAll(true);
    try {
      const merged: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 50) {
        const data = await translateSupportMessages(activeId, {
          messageIds: ids.slice(i, i + 50),
          lang,
        });
        Object.assign(merged, data.translations);
      }
      setTranslations((prev) => ({ ...prev, ...merged }));
      setShownTranslated((prev) => {
        const n = new Set(prev);
        for (const id of Object.keys(merged)) n.add(id);
        return n;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setTranslatingAll(false);
    }
  };

  const langMeta = useMemo(
    () => SUPPORT_LANGS.find((l) => l.code === lang) || SUPPORT_LANGS[0],
    [lang],
  );

  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    // Height accounts for the admin chrome this page renders inside: the 66px
    // header plus the content wrapper's pt-7/pb-8 padding (~126px total). With
    // a plain 100vh the composer fell below main's scroll fold and looked cut.
    <div className="flex h-[calc(100dvh-126px)] bg-zinc-950 text-zinc-100">
      {/* ── Left: list ── */}
      <div className="w-[360px] shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800 space-y-3">
          <SupportTaskroomBar />
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setPage(1);
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "bg-amber-500 text-black"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {f.label}
                <span className="ml-1 opacity-70">
                  {counts[f.key] ?? 0}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email or phone"
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 pl-8 pr-3 py-2 text-sm outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <div className="grid place-items-center h-40 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : listError ? (
            <div className="m-3 rounded-md bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
              {listError}
            </div>
          ) : chats.length === 0 ? (
            <div className="grid place-items-center h-40 text-zinc-500 text-sm">
              No chats
            </div>
          ) : (
            chats.map((c) => (
              <button
                key={c.groupId}
                onClick={() => openChat(c.groupId)}
                className={`w-full text-left px-3 py-2.5 border-b border-zinc-900 flex gap-3 items-start transition-colors ${
                  activeId === c.groupId
                    ? "bg-zinc-800"
                    : "hover:bg-zinc-900"
                }`}
              >
                <Avatar name={c.user?.name} src={c.user?.profilePicture} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {c.name || c.user?.name || c.user?.email || "Support chat"}
                    </span>
                    {c.unread && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                    )}
                    <span className="ml-auto text-[11px] text-zinc-500 shrink-0">
                      {relTime(c.activityAt)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {c.lastMessage
                      ? `${c.lastMessage.fromStaff ? "You/Admin" : c.lastMessage.fromName || "Member"}: ${c.lastMessage.text}`
                      : c.user?.email || "No messages yet"}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {c.awaitingReply && (
                      <span className="text-[10px] rounded bg-orange-500/15 text-orange-300 px-1.5 py-0.5">
                        Awaiting reply
                      </span>
                    )}
                    {c.assignedAgent && (
                      <span className="text-[10px] text-zinc-500 truncate">
                        {c.assignedAgent.name}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-2 py-1 rounded bg-zinc-800 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            {page} / {pageCount} · {total}
          </span>
          <button
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 rounded bg-zinc-800 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* ── Right: thread ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId ? (
          <div className="flex-1 grid place-items-center text-zinc-600 text-sm">
            Select a chat to view the conversation
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-start gap-3">
              <Avatar
                name={details?.user?.name}
                src={details?.user?.profilePicture}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">
                  {details?.name ||
                    details?.user?.name ||
                    details?.user?.email ||
                    "Support chat"}
                </div>
                <div className="text-xs text-zinc-500 flex flex-wrap gap-x-3">
                  {details?.user?.email && <span>{details.user.email}</span>}
                  {details?.user?.phone && <span>{details.user.phone}</span>}
                  {details?.user?.country && <span>{details.user.country}</span>}
                  {details?.assignedAgent && (
                    <span>Agent: {details.assignedAgent.name}</span>
                  )}
                  {details && (
                    <div className="relative">
                      <button
                        onClick={() => setMembersOpen((v) => !v)}
                        className="underline decoration-dotted hover:text-zinc-300"
                      >
                        {details.members.length} members
                      </button>
                      {membersOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMembersOpen(false)}
                          />
                          <div className="absolute left-0 top-6 z-20 w-72 max-h-96 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-1">
                            {/* Add member */}
                            <div className="p-1 border-b border-zinc-800 mb-1">
                              <input
                                value={addQuery}
                                onChange={(e) => setAddQuery(e.target.value)}
                                placeholder="Add member — search name/email"
                                className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs outline-none focus:border-zinc-500"
                              />
                              {addResults.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {addResults.map((r) => (
                                    <button
                                      key={r._id}
                                      onClick={() => addMember(r._id)}
                                      disabled={addingMember}
                                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800 disabled:opacity-50 text-left"
                                    >
                                      <Avatar
                                        name={r.name}
                                        src={r.profilePicture}
                                        size={22}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs text-zinc-200 truncate">
                                          {r.name || r.email || "Unknown"}
                                        </div>
                                        {r.email && (
                                          <div className="text-[10px] text-zinc-500 truncate">
                                            {r.email}
                                          </div>
                                        )}
                                      </div>
                                      <UserPlus className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {details.members.map((mem) => (
                              <div
                                key={mem.id}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800"
                              >
                                <Avatar
                                  name={mem.name}
                                  src={mem.profilePicture}
                                  size={26}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs text-zinc-200 truncate">
                                    {mem.name || mem.email || "Unknown"}
                                  </div>
                                  {mem.email && (
                                    <div className="text-[10px] text-zinc-500 truncate">
                                      {mem.email}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className={`text-[9px] rounded px-1 py-0.5 shrink-0 ${
                                    mem.isMember
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : mem.isUpline
                                        ? "bg-purple-500/15 text-purple-300"
                                        : mem.isStaff
                                          ? "bg-sky-500/15 text-sky-300"
                                          : "bg-zinc-700 text-zinc-300"
                                  }`}
                                >
                                  {mem.isMember
                                    ? "Member"
                                    : mem.isUpline
                                      ? "Upline"
                                      : mem.isStaff
                                        ? "Admin"
                                        : mem.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={lang}
                  onChange={(e) => persistLang(e.target.value as SupportLang)}
                  className="rounded-md bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-xs outline-none"
                  title="Translation language"
                >
                  {SUPPORT_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={translateAll}
                  disabled={translatingAll}
                  className="flex items-center gap-1 rounded-md bg-zinc-800 hover:bg-zinc-700 px-2 py-1.5 text-xs disabled:opacity-50"
                  title="Translate all messages"
                >
                  {translatingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Languages className="h-3.5 w-3.5" />
                  )}
                  All
                </button>
                <button
                  onClick={() => setTaskroomOpen((v) => !v)}
                  className={`rounded-md px-2 py-1.5 text-xs flex items-center gap-1 ${
                    taskroomOpen ? "bg-amber-500 text-black" : "bg-zinc-800 hover:bg-zinc-700"
                  }`}
                  title="Taskroom tasks for this chat"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  Taskroom
                </button>
                <button
                  onClick={() => activeId && openChat(activeId)}
                  className="rounded-md bg-zinc-800 hover:bg-zinc-700 p-1.5"
                  title="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={threadRef}
              onScroll={onThreadScroll}
              className="flex-1 overflow-y-auto px-4 py-3 flex flex-col space-y-2"
            >
              {/* Spacer keeps a short conversation pinned to the bottom, like a
                  real chat; it collapses once messages fill the height. */}
              <div className="flex-1 min-h-0" />
              {threadError && (
                <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
                  {threadError}
                </div>
              )}
              {nextCursor && (
                <div className="text-center">
                  <button
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    {loadingOlder ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5" />
                    )}
                    Load older
                  </button>
                </div>
              )}
              {threadLoading ? (
                <div className="grid place-items-center h-40 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 && !threadError ? (
                <div className="grid place-items-center h-40 text-zinc-600 text-sm">
                  No messages in this conversation yet
                </div>
              ) : (
                messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const showDate =
                    !prev ||
                    new Date(prev.createdAt).toDateString() !==
                      new Date(m.createdAt).toDateString();
                  // Tuck consecutive messages from the same sender together
                  // (within 5 min): hide the repeated name row and avatar.
                  const grouped =
                    !showDate &&
                    !!prev &&
                    prev.type !== "system" &&
                    m.type !== "system" &&
                    prev.from === m.from &&
                    new Date(m.createdAt).getTime() -
                      new Date(prev.createdAt).getTime() <
                      5 * 60 * 1000;
                  return (
                    <div key={m._id}>
                      {showDate && <DaySeparator iso={m.createdAt} />}
                      <MessageRow
                        m={m}
                        users={msgUsers}
                        meId={details?.me}
                        langLabel={langMeta.label}
                        rtl={"rtl" in langMeta && !!langMeta.rtl}
                        grouped={grouped}
                        translated={
                          shownTranslated.has(m._id)
                            ? translations[m._id]
                            : undefined
                        }
                        onTranslate={() => translateOne(m._id)}
                        onReply={() => setReplyTo(m)}
                        onCreateTicket={() => createTicket(m)}
                        creatingTicket={ticketBusy === m._id}
                        onAddToTaskroom={() => addMessageToTaskroom(m)}
                        addingToTaskroom={taskBusy === m._id}
                        readUpTo={readUpTo}
                        onDelete={() => deleteMessage(m)}
                        onReact={(emoji) => reactToMessage(m._id, emoji)}
                        onOpenMedia={(url, type) => setLightbox({ url, type })}
                        onEdit={(text) => editMessage(m._id, text)}
                      />
                    </div>
                  );
                })
              )}

              {typingNames.length > 0 && (
                <div className="flex items-center gap-2 px-1 pt-1 text-xs text-zinc-400">
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" />
                  </span>
                  <span>
                    {typingNames.length === 1
                      ? `${typingNames[0]} is typing…`
                      : typingNames.length === 2
                        ? `${typingNames[0]} and ${typingNames[1]} are typing…`
                        : `${typingNames[0]} and ${typingNames.length - 1} others are typing…`}
                  </span>
                </div>
              )}
            </div>

            {/* AI ticket suggestion */}
            {suggestion?.suggest && (
              <div className="mx-3 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-amber-200 flex items-center gap-2">
                      Create a ticket for this chat?
                      <span className="text-[9px] font-normal rounded bg-black/20 px-1 py-0.5 text-amber-200/80">
                        {suggestion.source === "rules"
                          ? "auto-flagged"
                          : "AI suggested"}
                      </span>
                      {suggestion.priority && (
                        <span className="text-[9px] font-normal rounded bg-black/20 px-1 py-0.5 text-amber-200/80 capitalize">
                          {suggestion.priority}
                        </span>
                      )}
                    </div>
                    {suggestion.subject && (
                      <div className="text-sm text-zinc-100 mt-0.5 truncate">
                        {suggestion.subject}
                      </div>
                    )}
                    {suggestion.summary && (
                      <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                        {suggestion.summary}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={acceptSuggestion}
                      disabled={suggestBusy}
                      className="rounded-md bg-amber-500 text-black px-3 py-1.5 text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {suggestBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <TicketPlus className="h-3.5 w-3.5" />
                      )}
                      Create ticket
                    </button>
                    <button
                      onClick={dismissSuggestion}
                      className="rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Composer — drop files anywhere on it */}
            <div
              className={`relative border-t border-zinc-800 p-3 ${dragOver ? "bg-amber-500/5" : ""}`}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("Files")) {
                  e.preventDefault();
                  setDragOver(true);
                }
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                if (!e.dataTransfer.files?.length) return;
                e.preventDefault();
                setDragOver(false);
                void onPickFiles(e.dataTransfer.files);
              }}
            >
              {dragOver && (
                <div className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-500/60 bg-zinc-950/80 text-sm text-amber-300">
                  <Upload className="h-4 w-4" />
                  Drop to attach
                </div>
              )}
              {mentionOpen && mentionCandidates.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                  {mentionCandidates.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(c);
                      }}
                      onMouseEnter={() => setMentionIndex(i)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                        i === mentionIndex ? "bg-zinc-800" : ""
                      }`}
                    >
                      {c.id === "all" ? (
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500/20 text-amber-300">
                          <AtSign className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <Avatar name={c.name} src={c.picture} size={24} />
                      )}
                      <span className="truncate text-zinc-100">{c.id === "all" ? "@all" : c.name}</span>
                      <span className="ml-auto truncate text-[11px] text-zinc-500">{c.sub}</span>
                    </button>
                  ))}
                </div>
              )}
              {replyTo && (
                <div className="mb-2 flex items-center gap-2 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
                  <CornerUpLeft className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    Replying to: {replyTo.text || "message"}
                  </span>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="ml-auto text-zinc-500 hover:text-zinc-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {/* Staged attachments */}
              {pendingAttachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingAttachments.map((a, i) => {
                    const isImg = /^image\//i.test(a.fileType || "");
                    return (
                      <div
                        key={i}
                        className="relative rounded-md border border-zinc-700 bg-zinc-900 p-1"
                      >
                        {isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.fileUrl}
                            alt={a.fileName || ""}
                            className="h-14 w-14 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-32 items-center gap-1 px-2 text-xs text-zinc-300">
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{a.fileName}</span>
                          </div>
                        )}
                        <button
                          onClick={() =>
                            setPendingAttachments((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-700 p-0.5 text-zinc-200 hover:bg-zinc-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <FormatToolbar
                inputRef={taRef}
                value={draft}
                onChange={(next) => {
                  setDraft(next);
                  requestAnimationFrame(autosize);
                }}
                className="mb-1.5"
              />
              <div className="flex flex-wrap items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-md bg-zinc-800 hover:bg-zinc-700 p-2 text-zinc-300 disabled:opacity-50"
                  title="Attach file"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </button>
                <EmojiPickerComponent
                  align="left"
                  onEmojiSelect={(emoji) => {
                    const el = taRef.current;
                    const at = el ? el.selectionStart : draft.length;
                    setDraft((d) => d.slice(0, at) + emoji + d.slice(at));
                    requestAnimationFrame(autosize);
                  }}
                />
                <GifPicker onShare={(encoded) => void shareMarker(encoded)} />
                <LocationShareButton onShare={(encoded) => void shareMarker(encoded)} />
                <ContactShareButton
                  members={(details?.members || []).map((mem) => ({
                    id: mem.id,
                    name: mem.name || undefined,
                    email: mem.email || "",
                    profilePicture: mem.profilePicture || undefined,
                    role: mem.isMember ? "Customer" : mem.isStaff ? "Support" : undefined,
                  }))}
                  excludeIds={details?.me ? [details.me] : []}
                  onShare={(encoded) => void shareMarker(encoded)}
                />
                <VoiceRecorder
                  onRecordingComplete={() => {}}
                  onSend={(file) => void sendMediaNote(file)}
                />
                <VideoMessageRecorder
                  onRecordingComplete={() => {}}
                  onSend={(file) => void sendMediaNote(file)}
                />
                <textarea
                  ref={taRef}
                  value={draft}
                  onChange={(e) =>
                    onDraftChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
                  }
                  onPaste={(e) => {
                    // Pasted screenshots/images attach, like the app.
                    const files = Array.from(e.clipboardData?.files || []);
                    if (files.length) {
                      e.preventDefault();
                      void onPickFiles(files);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (mentionOpen && mentionCandidates.length) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        insertMention(mentionCandidates[mentionIndex] || mentionCandidates[0]);
                        return;
                      }
                      if (e.key === "Escape") {
                        setMentionOpen(false);
                        return;
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  maxLength={5000}
                  placeholder="Type a reply — @ to tag, Enter to send, Shift+Enter for a new line"
                  className="flex-1 resize-none rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-zinc-600 max-h-40 overflow-y-auto"
                />
                <button
                  onClick={send}
                  disabled={
                    (!draft.trim() && pendingAttachments.length === 0) ||
                    sending
                  }
                  className="rounded-md bg-amber-500 text-black px-4 py-2 text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {activeId && taskroomOpen && (
        <SupportChatTaskroomPanel
          groupId={activeId}
          refreshKey={taskroomRefresh}
          onClose={() => setTaskroomOpen(false)}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="h-6 w-6" />
          </button>
          {lightbox.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={lightbox.url}
              controls
              autoPlay
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DaySeparator({ iso }: { iso: string }) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const label =
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === yest.toDateString()
        ? "Yesterday"
        : d.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year:
              d.getFullYear() === today.getFullYear() ? undefined : "numeric",
          });
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-zinc-800" />
      <span className="text-[11px] text-zinc-500 font-medium">{label}</span>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  );
}

/** The sender map in the shape MessageContent resolves @mentions against. */
function memberMap(
  users: Record<string, SupportMessageUser>,
): Record<string, { id: string; name?: string; email: string }> {
  const out: Record<string, { id: string; name?: string; email: string }> = {};
  for (const [id, u] of Object.entries(users)) {
    out[id] = { id, name: u.name || undefined, email: u.email || "" };
  }
  return out;
}

function MessageRow({
  m,
  users,
  meId,
  translated,
  langLabel,
  rtl,
  grouped,
  onTranslate,
  onReply,
  onCreateTicket,
  creatingTicket,
  onAddToTaskroom,
  addingToTaskroom,
  readUpTo,
  onDelete,
  onReact,
  onOpenMedia,
  onEdit,
}: {
  m: SupportMessage;
  users: Record<string, SupportMessageUser>;
  meId?: string;
  translated?: string;
  langLabel: string;
  rtl: boolean;
  /** Consecutive message from the same sender — hide the name row + avatar. */
  grouped: boolean;
  onTranslate: () => void;
  onReply: () => void;
  onCreateTicket: () => void;
  creatingTicket: boolean;
  onAddToTaskroom: () => void;
  addingToTaskroom: boolean;
  /** The customer's read position — own messages up to it show ✓✓. */
  readUpTo: string | null;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onOpenMedia: (url: string, type: "image" | "video") => void;
  onEdit: (text: string) => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // System event pill.
  if (m.type === "system") {
    return (
      <div className="flex justify-center my-1">
        <span className="text-[11px] text-zinc-500 bg-zinc-900/80 rounded-full px-3 py-1">
          {m.text}
        </span>
      </div>
    );
  }

  const u = m.from ? users[m.from] : undefined;
  const mine = !!meId && m.from === meId;
  const staff = !!u?.isStaff;
  const deleted = !!m.deletedAt;

  return (
    <div
      className={`flex gap-2 ${grouped ? "mt-0.5" : "mt-3"} ${
        mine ? "flex-row-reverse" : "flex-row"
      } group`}
    >
      {/* Avatar gutter — only for incoming, and only on the first of a group. */}
      {!mine &&
        (grouped ? (
          <div className="w-8 shrink-0" />
        ) : (
          <Avatar name={u?.name} src={u?.profilePicture} size={32} />
        ))}

      <div
        className={`max-w-[72%] flex flex-col ${
          mine ? "items-end" : "items-start"
        }`}
      >
        {!grouped && (
          <div className="flex items-center gap-2 mb-0.5 px-1">
            <span className="text-[11px] font-medium text-zinc-400">
              {mine ? "You" : u?.name || u?.email || "Unknown"}
            </span>
            {staff && !mine && (
              <span className="text-[9px] rounded bg-sky-500/15 text-sky-300 px-1 py-0.5">
                Admin
              </span>
            )}
            <span
              className="text-[10px] text-zinc-600"
              title={new Date(m.createdAt).toLocaleString()}
            >
              {new Date(m.createdAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        <div
          className={`min-w-0 max-w-full rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] shadow-sm ${
            deleted
              ? "bg-zinc-900 text-zinc-600 italic"
              : mine
                ? "bg-amber-500 text-black"
                : staff
                  ? "bg-sky-500/10 text-zinc-100 border border-sky-500/20"
                  : "bg-zinc-800 text-zinc-100"
          }`}
        >
          {m.replyTo && !deleted && (
            <div className="mb-1 border-l-2 border-current/40 pl-2 text-xs opacity-70 truncate">
              {m.replyTo.text || "message"}
            </div>
          )}
          {deleted ? (
            "This message was deleted"
          ) : editing ? (
            <div className="min-w-[220px]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                autoFocus
                className="w-full resize-none rounded-md bg-black/20 border border-black/20 px-2 py-1 text-sm text-inherit outline-none"
              />
              <div className="mt-1 flex gap-2 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="text-[11px] opacity-70 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  disabled={savingEdit || !editText.trim()}
                  onClick={async () => {
                    if (!editText.trim()) return;
                    setSavingEdit(true);
                    try {
                      await onEdit(editText.trim());
                      setEditing(false);
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Failed to edit",
                      );
                    } finally {
                      setSavingEdit(false);
                    }
                  }}
                  className="text-[11px] font-medium underline disabled:opacity-50"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div dir={translated && rtl ? "rtl" : undefined}>
              {/* Same renderer as the app's group chat: links, markdown,
                  WhatsApp bold and strike, @mentions and rich cards. */}
              {translated ? (
                translated
              ) : (
                <MessageContent
                  text={m.text}
                  isOwnMessage={mine}
                  mentions={m.mentions}
                  userMap={m.mentions?.length ? memberMap(users) : undefined}
                />
              )}
              {m.editedAt && (
                <span className="ml-1 text-[10px] opacity-60">(edited)</span>
              )}
            </div>
          )}
          {/* Link preview card for the first URL, like the app's chat. */}
          {!deleted && !editing && !translated && getFirstUrl(m.text || "") && (
            <div className="mt-2 max-w-[320px]">
              <LinkPreview url={getFirstUrl(m.text || "") as string} token={getAdminToken()} />
            </div>
          )}
          {!deleted &&
            m.attachments?.map((a, i) => {
              // Preview images and videos inline; open full-size in the
              // in-page lightbox. Other files stay as a download link.
              // Voice notes first: they are .webm/.ogg, which the video
              // check below would otherwise claim.
              const isAudio =
                /^audio\//i.test(a.fileType || "") ||
                /\.(mp3|m4a|wav|aac|opus|oga)(\?|$)/i.test(a.fileName || "");
              if (isAudio) {
                return (
                  <div key={i} className="mt-1 min-w-[220px]">
                    <VoiceMessagePlayer src={a.fileUrl} isOwnMessage={mine} />
                  </div>
                );
              }
              const isImage =
                /^image\//i.test(a.fileType || "") ||
                /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif)(\?|$)/i.test(
                  a.fileName || "",
                ) ||
                /\.(jpe?g|png|gif|webp|bmp|avif)(\?|$)/i.test(a.fileUrl || "");
              const isVideo =
                /^video\//i.test(a.fileType || "") ||
                /\.(mp4|mov|webm|m4v|ogg|3gp)(\?|$)/i.test(a.fileName || "") ||
                /\.(mp4|mov|webm|m4v|ogg|3gp)(\?|$)/i.test(a.fileUrl || "");
              if (isImage) {
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onOpenMedia(a.fileUrl, "image")}
                    className="mt-1 block"
                    title={a.fileName}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.fileUrl}
                      alt={a.fileName || "attachment"}
                      loading="lazy"
                      className="max-h-64 w-auto max-w-full rounded-lg border border-black/10 cursor-zoom-in"
                    />
                  </button>
                );
              }
              if (isVideo) {
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onOpenMedia(a.fileUrl, "video")}
                    className="mt-1 block"
                    title={a.fileName}
                  >
                    <video
                      src={a.fileUrl}
                      className="max-h-64 w-auto max-w-full rounded-lg border border-black/10 cursor-pointer"
                      preload="metadata"
                      muted
                    />
                  </button>
                );
              }
              return (
                <a
                  key={i}
                  href={a.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 text-xs underline opacity-90"
                >
                  <Paperclip className="h-3 w-3" />
                  {a.fileName}
                </a>
              );
            })}
          {translated && (
            <div className="mt-1 text-[10px] opacity-70">
              Translated · {langLabel} ·{" "}
              <button onClick={onTranslate} className="underline">
                Show original
              </button>
            </div>
          )}
          {/* WhatsApp-style ticks: ✓ sent, ✓✓ (blue) read by the customer. */}
          {mine && !deleted && (
            <div className="mt-0.5 flex justify-end">
              {readUpTo && new Date(readUpTo).getTime() >= new Date(m.createdAt).getTime() ? (
                <span title="Read">
                  <CheckCheck className="h-3.5 w-3.5 text-sky-700" />
                </span>
              ) : (
                <span title="Sent">
                  <Check className="h-3.5 w-3.5 opacity-60" />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Reaction chips — always visible when present. */}
        {!deleted &&
          m.reactions &&
          Object.keys(m.reactions).length > 0 && (
            <div
              className={`flex flex-wrap gap-1 mt-1 px-1 ${
                mine ? "justify-end" : "justify-start"
              }`}
            >
              {Object.entries(m.reactions)
                .filter(([, u]) => (u || []).length > 0)
                .map(([emoji, u]) => {
                  const mineReacted = !!meId && (u || []).includes(meId);
                  return (
                    <button
                      key={emoji}
                      onClick={() => onReact(emoji)}
                      className={`text-[11px] rounded-full px-1.5 py-0.5 border transition-colors ${
                        mineReacted
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {emoji} {(u || []).length}
                    </button>
                  );
                })}
            </div>
          )}

        {!deleted && (
          <div
            className={`flex gap-2 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
              mine ? "justify-end" : "justify-start"
            }`}
          >
            {m.text && !translated && (
              <button
                onClick={onTranslate}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                Translate
              </button>
            )}
            {m.text && (
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(m.text).then(
                    () => toast.success("Copied"),
                    () => toast.error("Couldn't copy"),
                  );
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-0.5"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-[10px] text-zinc-500 hover:text-red-400 inline-flex items-center gap-0.5"
              title="Delete for everyone"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
            {/* React — a small emoji picker. */}
            <div className="relative">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-0.5"
              >
                <Smile className="h-3 w-3" />
                React
              </button>
              {pickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setPickerOpen(false)}
                  />
                  <div
                    className={`absolute bottom-5 z-20 flex gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 shadow-xl ${
                      mine ? "right-0" : "left-0"
                    }`}
                  >
                    {REACT_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => {
                          onReact(e);
                          setPickerOpen(false);
                        }}
                        className="text-base leading-none hover:scale-125 transition-transform"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onReply}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Reply
            </button>
            {mine && m.text && (
              <button
                onClick={() => {
                  setEditText(m.text || "");
                  setEditing(true);
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-0.5"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            <button
              onClick={onCreateTicket}
              disabled={creatingTicket}
              className="text-[10px] text-zinc-500 hover:text-amber-300 inline-flex items-center gap-0.5 disabled:opacity-50"
              title="Raise a support ticket from this message"
            >
              <TicketPlus className="h-3 w-3" />
              {creatingTicket ? "Creating…" : "Create ticket"}
            </button>
            <button
              onClick={onAddToTaskroom}
              disabled={addingToTaskroom}
              className="text-[10px] text-zinc-500 hover:text-amber-300 inline-flex items-center gap-0.5 disabled:opacity-50"
              title="Add this message to Taskroom as a task"
            >
              <ListChecks className="h-3 w-3" />
              {addingToTaskroom ? "Adding…" : "Add to Taskroom"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
