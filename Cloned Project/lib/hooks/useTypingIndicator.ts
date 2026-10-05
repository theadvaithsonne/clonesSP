"use client";

// WhatsApp-style "typing…", shared by the group, DM and global chats.
//
// The typist announces on the first keystroke and again every PING while still
// typing; everyone else drops a typist EXPIRY after their last announcement, so
// a lost "stop" (closed tab, dropped connection) can't leave "typing…" up
// forever. A pause of IDLE counts as stopping, as do sending, clearing the box,
// and leaving the chat.

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { connectSocket, getSocket } from "@/lib/socket";

export const TYPING_PING_MS = 3000;
export const TYPING_IDLE_MS = 3000;
export const TYPING_EXPIRY_MS = 6000;

export type TypingUser = { userId: string; userName: string };

type TypingEvent = { userId: string; userName?: string } & Record<
  string,
  unknown
>;

export function useTypingIndicator({
  startEvent,
  stopEvent,
  payload,
  accepts,
  enabled = true,
  bottomRef,
}: {
  /** This chat kind's socket events, e.g. "dm:typing" / "dm:stopTyping". */
  startEvent: string;
  stopEvent: string;
  /**
   * What names the chat to the server — { otherId } or { groupId }. It is also
   * the chat's identity here: when it changes, the previous chat is told we
   * stopped and its typists are forgotten.
   */
  payload: Record<string, string>;
  /**
   * Whether an incoming event belongs to this chat. A socket stays in the room
   * of every chat it has opened, so other chats' typing arrives here too.
   */
  accepts: (event: TypingEvent) => boolean;
  /** Off for chats with nobody on the other end (AI agents). */
  enabled?: boolean;
  /** The element after the last message; brought into view with the bubble. */
  bottomRef?: RefObject<HTMLElement | null>;
}) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  // One expiry timer per typist.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  // My own typing state — refs, not state: nothing on screen shows it, and a
  // re-render per keystroke flip would be wasted work.
  const isTypingRef = useRef(false);
  const lastPingRef = useRef(0);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest values for the socket handlers, without re-subscribing each render.
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const acceptsRef = useRef(accepts);
  acceptsRef.current = accepts;
  const chatKey = JSON.stringify(payload);

  const removeTypingUser = useCallback((userId: string) => {
    const t = timersRef.current.get(userId);
    if (t) clearTimeout(t);
    timersRef.current.delete(userId);
    setTypingUsers((prev) =>
      prev.some((u) => u.userId === userId)
        ? prev.filter((u) => u.userId !== userId)
        : prev
    );
  }, []);

  const upsertTypingUser = useCallback(
    (userId: string, userName: string) => {
      const t = timersRef.current.get(userId);
      if (t) clearTimeout(t);
      timersRef.current.set(
        userId,
        setTimeout(() => removeTypingUser(userId), TYPING_EXPIRY_MS)
      );
      setTypingUsers((prev) =>
        prev.some((u) => u.userId === userId)
          ? prev
          : [...prev, { userId, userName }]
      );
    },
    [removeTypingUser]
  );

  // Others typing.
  useEffect(() => {
    if (!enabled) return;
    const s = connectSocket();
    const onStart = (e: TypingEvent) => {
      if (!acceptsRef.current(e)) return;
      upsertTypingUser(e.userId, e.userName || "");
    };
    const onStop = (e: TypingEvent) => {
      if (!acceptsRef.current(e)) return;
      removeTypingUser(e.userId);
    };
    s.on(startEvent, onStart);
    s.on(stopEvent, onStop);
    return () => {
      s.off(startEvent, onStart);
      s.off(stopEvent, onStop);
    };
  }, [enabled, startEvent, stopEvent, upsertTypingUser, removeTypingUser]);

  // Switching chat or closing it: stop announcing there, forget its typists.
  useEffect(() => {
    setTypingUsers([]);
    const timers = timersRef.current;
    const chatPayload = payloadRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      if (isTypingRef.current) {
        isTypingRef.current = false;
        getSocket().emit(stopEvent, chatPayload);
      }
    };
  }, [chatKey, stopEvent]);

  const stopTyping = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    getSocket().emit(stopEvent, payloadRef.current);
  }, [stopEvent]);

  /** Call with the box's new text on every change. */
  const handleTyping = useCallback(
    (value: string) => {
      if (!enabled) return;
      // Clearing the box is stopping, as in WhatsApp.
      if (!value.trim()) {
        stopTyping();
        return;
      }
      const now = Date.now();
      if (!isTypingRef.current || now - lastPingRef.current >= TYPING_PING_MS) {
        isTypingRef.current = true;
        lastPingRef.current = now;
        getSocket().emit(startEvent, payloadRef.current);
      }
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    },
    [enabled, startEvent, stopTyping]
  );

  // Bring the typing bubble into view when it appears — but only for a reader
  // already at the bottom, never pulling them away from older messages.
  const someoneTyping = typingUsers.length > 0;
  useEffect(() => {
    if (!someoneTyping) return;
    const end = bottomRef?.current;
    const scroller = end?.closest<HTMLElement>(".overflow-y-auto");
    if (
      end &&
      scroller &&
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160
    ) {
      end.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [someoneTyping, bottomRef]);

  return { typingUsers, handleTyping, stopTyping, removeTypingUser };
}
