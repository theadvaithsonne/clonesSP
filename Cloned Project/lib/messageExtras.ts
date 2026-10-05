"use client";

// Client-side store for per-message extras: reactions, starred, pinned.
// Persists to localStorage so it survives reload. Components subscribe via
// useSyncExternalStore so reads stay snapshot-stable.

type ReactionMap = Record<string, string[]>;
type ExtraStore = {
  reactions: Record<string, ReactionMap>;
  starred: Record<string, true>;
  pinned: Record<string, true>;
};

const KEY = "garage_message_extras_v1";

function emptyStore(): ExtraStore {
  return { reactions: {}, starred: {}, pinned: {} };
}

function load(): ExtraStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      reactions: parsed.reactions ?? {},
      starred: parsed.starred ?? {},
      pinned: parsed.pinned ?? {},
    };
  } catch {
    return emptyStore();
  }
}

let state: ExtraStore = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = load();
    emit();
  });
}

const EMPTY_REACTIONS_INTERNAL: ReactionMap = Object.freeze({}) as ReactionMap;

export const messageExtras = {
  subscribe,
  getReactions(messageId: string): ReactionMap {
    // Must return a stable reference when there are no reactions —
    // useSyncExternalStore re-renders if the snapshot identity changes.
    return state.reactions[messageId] ?? EMPTY_REACTIONS_INTERNAL;
  },
  toggleReaction(messageId: string, emoji: string, userId: string) {
    // One reaction per user per message: clicking another emoji replaces
    // the user's existing reaction; clicking the same one removes it.
    const next = { ...state.reactions };
    const forMsg: ReactionMap = {};
    const existing = next[messageId] || {};
    let removingOwnSame = false;
    for (const [e, users] of Object.entries(existing)) {
      const filtered = users.filter((u) => u !== userId);
      if (e === emoji && users.includes(userId)) {
        removingOwnSame = true;
      }
      if (filtered.length > 0) forMsg[e] = filtered;
    }
    if (!removingOwnSame) {
      forMsg[emoji] = [...(forMsg[emoji] || []), userId];
    }
    if (Object.keys(forMsg).length === 0) {
      delete next[messageId];
    } else {
      next[messageId] = forMsg;
    }
    state = { ...state, reactions: next };
    persist();
    emit();
  },
  isStarred(messageId: string): boolean {
    return !!state.starred[messageId];
  },
  toggleStar(messageId: string) {
    const next = { ...state.starred };
    if (next[messageId]) delete next[messageId];
    else next[messageId] = true;
    state = { ...state, starred: next };
    persist();
    emit();
  },
  isPinned(messageId: string): boolean {
    return !!state.pinned[messageId];
  },
  togglePin(messageId: string) {
    const next = { ...state.pinned };
    if (next[messageId]) delete next[messageId];
    else next[messageId] = true;
    state = { ...state, pinned: next };
    persist();
    emit();
  },
  pinnedIds(): string[] {
    return Object.keys(state.pinned);
  },
  starredIds(): string[] {
    return Object.keys(state.starred);
  },
  removeMessage(messageId: string) {
    const reactions = { ...state.reactions };
    const starred = { ...state.starred };
    const pinned = { ...state.pinned };
    let changed = false;
    if (reactions[messageId]) { delete reactions[messageId]; changed = true; }
    if (starred[messageId]) { delete starred[messageId]; changed = true; }
    if (pinned[messageId]) { delete pinned[messageId]; changed = true; }
    if (!changed) return;
    state = { reactions, starred, pinned };
    persist();
    emit();
  },
};

import { useSyncExternalStore } from "react";

export function useMessageExtras(messageId: string) {
  const reactions = useSyncExternalStore<ReactionMap>(
    messageExtras.subscribe,
    () => messageExtras.getReactions(messageId),
    () => EMPTY_REACTIONS_INTERNAL
  );
  const starred = useSyncExternalStore<boolean>(
    messageExtras.subscribe,
    () => messageExtras.isStarred(messageId),
    () => false
  );
  const pinned = useSyncExternalStore<boolean>(
    messageExtras.subscribe,
    () => messageExtras.isPinned(messageId),
    () => false
  );
  return { reactions, starred, pinned };
}

export function usePinnedIds() {
  return useSyncExternalStore(
    messageExtras.subscribe,
    () => messageExtras.pinnedIds().join(","),
    () => ""
  ).split(",").filter(Boolean);
}

// ─── Forwarded prefix helpers ──────────────────────────────────────────
// Messages are flagged as forwarded by prefixing their text with this marker
// before sending. On render we detect and strip the marker, showing a label.
export const FORWARDED_PREFIX = "↪ Forwarded\n";

export function isForwardedText(text: string | null | undefined): boolean {
  return !!text && text.startsWith(FORWARDED_PREFIX);
}

export function stripForwarded(text: string | null | undefined): string {
  if (!text) return "";
  return isForwardedText(text) ? text.slice(FORWARDED_PREFIX.length) : text;
}

// ─── Edit window + count constraints ───────────────────────────────────
export const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes (WhatsApp parity)
export const MAX_EDITS = 5;

const EDIT_COUNT_KEY = "garage_message_edit_counts_v1";

function readEditCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EDIT_COUNT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeEditCounts(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EDIT_COUNT_KEY, JSON.stringify(map));
  } catch {}
}

export function getEditCount(messageId: string): number {
  return readEditCounts()[messageId] || 0;
}

export function bumpEditCount(messageId: string): number {
  const map = readEditCounts();
  const next = (map[messageId] || 0) + 1;
  map[messageId] = next;
  writeEditCounts(map);
  return next;
}

export function canEditMessage(
  msg: { _id: string; createdAt: string },
  isMine: boolean
): { ok: boolean; reason?: string } {
  if (!isMine) return { ok: false, reason: "Not your message" };
  const age = Date.now() - new Date(msg.createdAt).getTime();
  if (Number.isNaN(age)) return { ok: false, reason: "Unknown time" };
  if (age > EDIT_WINDOW_MS) return { ok: false, reason: "Edit window closed" };
  if (getEditCount(msg._id) >= MAX_EDITS) return { ok: false, reason: "Edit limit reached" };
  return { ok: true };
}
