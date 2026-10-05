'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner"
import { useMessages } from '../../hooks/useMessages';
import { useTypingUsers } from '../../hooks/useTypingUsers';
import { MessageListProps, Message } from '../../lib/types';
import LoadingSpinner from '../shared/LoadingSpinner';
import TypingIndicator from '../shared/TypingIndicator';
import MessageItem from './MessageItem';
import { socketService } from '../../lib/socket-service';

export default function MessageList({ conversationId, currentUser }: MessageListProps) {
  const { messages, loading, error, hasMore, loadMore } = useMessages(conversationId);
  const { getTypingUsersForConversation } = useTypingUsers();
  const typingUsers = getTypingUsersForConversation(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [initialScrolled, setInitialScrolled] = useState(false);
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevScrollTopRef = useRef<number | null>(null);
  const shouldStickToBottomRef = useRef(true);

  const disconnectedToastShownRef = useRef(false);
  const connectErrorToastShownRef = useRef(false);

  useEffect(() => {
    const handleConnected = () => {
      // Show success message if we were previously disconnected
      if (disconnectedToastShownRef.current || connectErrorToastShownRef.current) {
        toast.success('Chat reconnected successfully');
      }
      disconnectedToastShownRef.current = false;
      connectErrorToastShownRef.current = false;
    };

    const handleDisconnected = () => {
      if (!disconnectedToastShownRef.current) {
        toast.error('Chat connection lost. Reconnecting…');
        disconnectedToastShownRef.current = true;
      }
    };

    const handleConnectError = () => {
      if (!connectErrorToastShownRef.current) {
        toast.error('Connection failed. Retrying…');
        connectErrorToastShownRef.current = true;
      }
    };

    const handleReconnect = () => {
      if (conversationId) {
        socketService.emit('join_conversation', { conversationId });
      }
    };

    socketService.on('connected', handleConnected);
    socketService.on('disconnected', handleDisconnected);
    socketService.on('connect_error', handleConnectError);
    socketService.on('reconnected', handleReconnect); // Auto-rejoin

    return () => {
      socketService.off('connected', handleConnected);
      socketService.off('disconnected', handleDisconnected);
      socketService.off('connect_error', handleConnectError);
      socketService.off('reconnected', handleReconnect);
    };
  }, [conversationId, toast]);

  useEffect(() => {
    // Preserve scroll position if we just prepended older messages
    const container = messagesContainerRef.current;
    if (container && isPrependingRef.current && prevScrollHeightRef.current !== null) {
      const newScrollHeight = container.scrollHeight;
      const previousHeight = prevScrollHeightRef.current ?? 0;
      const previousTop = prevScrollTopRef.current ?? 0;
      const heightDiff = newScrollHeight - previousHeight;
      container.scrollTop = previousTop + heightDiff;
      isPrependingRef.current = false;
      prevScrollHeightRef.current = null;
      prevScrollTopRef.current = null;
      return;
    }

    // On initial load or when new realtime messages arrive, scroll to bottom once
    if (!initialScrolled && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      setInitialScrolled(true);
      shouldStickToBottomRef.current = true;
      return;
    }

    // When new messages arrive at the bottom (e.g., realtime), keep view near bottom
    if (container) {
      if (shouldStickToBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, initialScrolled]);

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [typingUsers]);

  useEffect(() => {
    if (conversationId && socketService.connected) {
      socketService.emit('join_conversation', { conversationId });

      return () => {
        socketService.emit('leave_conversation', { conversationId });
      };
    }
  }, [conversationId]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 200;

    if (loading || !hasMore) {
      return;
    }

    // Trigger lazy load when near the top
    if (container.scrollTop <= 40) {
      // Capture current scroll height to preserve position after prepend
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isPrependingRef.current = true;
      shouldStickToBottomRef.current = false;
      loadMore();
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    const isToday = today.toDateString() === messageDate.toDateString();
    const isYesterday = new Date(today.getTime() - 86400000).toDateString() === messageDate.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return messageDate.toLocaleDateString();
  };

  const groupMessagesByDate = (data: Message[]) => {
    const groups: Record<string, Message[]> = {};

    data.forEach(message => {
      const dateKey = new Date(message.timestamp).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return Object.entries(groups)
      .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
      .map(([date, group]) => ({
        date: formatDate(new Date(date)),
        messages: group.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      }));
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <p className="mb-2 text-red-500">Failed to load messages</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);
  return (
    <div
      ref={messagesContainerRef}
      onScroll={handleScroll}
      className="h-full flex-1 space-y-4 overflow-y-auto bg-black px-6 py-6"
    >
      {loading && hasMore && (
        <div className="flex justify-center py-2">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {messageGroups.map(({ date, messages: group }) => (
        <div key={date}>
          <div className="my-4 flex items-center justify-center">
            <div className="rounded-full bg-gray-900 px-3 py-1 text-sm text-gray-400 border border-gray-800">{date}</div>
          </div>

          <div className="space-y-2">
            {group.map((message, index) => {
              const previousMessage = index > 0 ? group[index - 1] : null;


              return (
                <MessageItem
                  key={message._id}
                  message={message}
                  currentUser={currentUser}

                />
              );
            })}
          </div>
        </div>
      ))}

      {messages.length === 0 && (
        <div className="flex h-full items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 text-gray-700">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
              </svg>
            </div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />

      {typeof window !== 'undefined' &&
        createPortal(
          <TypingIndicator conversationId={conversationId} typingUsers={typingUsers} />,
          document.getElementById('typing-indicator-container') || document.body,
        )}
    </div>
  );
}


