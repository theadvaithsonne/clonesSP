'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chatAPI } from '../lib/chat-api';
import { socketService } from '../lib/socket-service';
import { Message, UseMessagesReturn } from '../lib/types';

export const useMessages = (conversationId: string): UseMessagesReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const isFetchingRef = useRef(false);
  const limitRef = useRef(50);
  const messagesCountRef = useRef(0);
  const LIMIT_STEP = 50;

  useEffect(() => {
    messagesCountRef.current = messages.length;
  }, [messages.length]);

  const fetchMessages = useCallback(async (reset: boolean = false) => {
    if (!conversationId) return;
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      const previousLimit = limitRef.current;
      const limit = reset ? LIMIT_STEP : previousLimit + LIMIT_STEP;
      const response = await chatAPI.getMessages(conversationId, limit, 0);
      const newMessages = response.data?.slice().reverse() ?? [];

      // Prevent redundant state updates that retrigger effects
      setMessages(prev => {
        const prevIds = prev.map(message => message._id).join(',');
        const nextIds = newMessages.map(message => message._id).join(',');
        return prevIds === nextIds ? prev : newMessages;
      });

      setHasMore(Boolean(response.pagination?.hasMore));

      // Update limit tracker if more messages were actually received
      if (reset) {
        limitRef.current = LIMIT_STEP;
      } else if (newMessages.length > messagesCountRef.current) {
        limitRef.current = limit;
      } else {
        limitRef.current = previousLimit;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch messages';
      setError(errorMessage);
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || isFetchingRef.current) return;
    await fetchMessages(false);
  }, [hasMore, loading, fetchMessages]);

  const sendMessage = useCallback(
    async (content: string, type: string = 'text', replyTo?: string) => {
      if (!conversationId) throw new Error('No conversation selected');
      await chatAPI.sendMessage(conversationId, content, type, replyTo);
    },
    [conversationId],
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!conversationId) throw new Error('No conversation selected');
      const updatedMessage = await chatAPI.editMessage(conversationId, messageId, content);
      setMessages(prev => prev.map(msg => (msg._id === messageId ? updatedMessage : msg)));
    },
    [conversationId],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!conversationId) throw new Error('No conversation selected');
      await chatAPI.deleteMessage(conversationId, messageId);
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
    },
    [conversationId],
  );

  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!conversationId) throw new Error('No conversation selected');
      await chatAPI.markMessageAsRead(conversationId, messageId);
    },
    [conversationId],
  );

  useEffect(() => {
    const handleNewMessage = (message: Message) => {
      if (message.conversationId === conversationId) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) {
            return prev;
          }
          return [...prev, message];
        });
      }
    };

    socketService.on('new_message', handleNewMessage);

    return () => {
      socketService.off('new_message', handleNewMessage);
    };
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      fetchMessages(true);
    } else {
      setMessages([]);
      setLoading(false);
    }
    // Intentionally exclude fetchMessages to avoid re-fetch loops caused by changing deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  return {
    messages,
    loading,
    error,
    hasMore,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
  };
};

