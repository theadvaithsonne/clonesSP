'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@livekit/components-react';
import type { ReceivedChatMessage } from '@livekit/components-react';
import { useMeeting } from '@/lib/meeting-context';

/**
 * Wraps LiveKit's useChat() but reads its messages from
 * MeetingProvider's persisted buffer rather than hook-local state.
 * Without this swap, every navigation away from the meet page (e.g.
 * minimize) wipes the chat history because the hook's internal state
 * dies with the component. The provider mounts the buffer once at app
 * scope, so we keep history across mount/unmount cycles.
 *
 * The send path still uses useChat()'s send() — that just publishes
 * to the data channel, no state involved.
 */
export function useMeetChat() {
  const { send, isSending } = useChat();
  const { chatMessages: persistedMessages } = useMeeting();
  // Cast back to ReceivedChatMessage shape so call sites that already
  // expect this type don't need to change. The fields we hold are a
  // subset of the LiveKit type, but match what the UI uses.
  const chatMessages = persistedMessages as unknown as ReceivedChatMessage[];

  const [unreadCount, setUnreadCount] = useState(0);
  const [chatVisible, setChatVisible] = useState(false);
  const prevCountRef = useRef(chatMessages.length);

  // Track new messages when chat is not visible
  useEffect(() => {
    const newCount = chatMessages.length;
    if (newCount > prevCountRef.current && !chatVisible) {
      setUnreadCount((c) => c + (newCount - prevCountRef.current));
    }
    prevCountRef.current = newCount;
  }, [chatMessages.length, chatVisible]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;
      await send(message);
    },
    [send],
  );

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
    setChatVisible(true);
  }, []);

  const markChatHidden = useCallback(() => {
    setChatVisible(false);
  }, []);

  return {
    chatMessages,
    sendMessage,
    isSending,
    unreadCount,
    clearUnread,
    markChatHidden,
  };
}

export type { ReceivedChatMessage };
