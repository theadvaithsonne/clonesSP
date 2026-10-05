'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@livekit/components-react';
import type { ReceivedChatMessage } from '@livekit/components-react';

export function useMeetChat() {
  const { chatMessages, send, isSending } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(chatMessages.length);

  // Track new messages when panel is closed
  useEffect(() => {
    const newCount = chatMessages.length;
    if (newCount > prevCountRef.current && !isOpen) {
      setUnreadCount((c) => c + (newCount - prevCountRef.current));
    }
    prevCountRef.current = newCount;
  }, [chatMessages.length, isOpen]);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setUnreadCount(0); // Opening -> clear unread
      return !prev;
    });
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openChat = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;
      await send(message);
    },
    [send],
  );

  return {
    chatMessages,
    sendMessage,
    isSending,
    isOpen,
    toggleChat,
    openChat,
    closeChat,
    unreadCount,
  };
}

export type { ReceivedChatMessage };
