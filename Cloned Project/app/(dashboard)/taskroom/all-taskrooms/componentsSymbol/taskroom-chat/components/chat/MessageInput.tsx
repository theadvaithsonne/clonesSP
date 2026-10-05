'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageInputProps } from '../../lib/types';
import { socketService } from '../../lib/socket-service';

export default function MessageInput({ conversationId, currentUser }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleTypingStart = () => {
    if (!conversationId || !socketService.connected) return;
    socketService.emit('typing_start', { conversationId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.emit('typing_stop', { conversationId });
    }, 3000);
  };

  const handleTypingStop = () => {
    if (!conversationId || !socketService.connected) return;
    socketService.emit('typing_stop', { conversationId });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || !socketService.connected) return;

    socketService.emit('send_message', {
      conversationId,
      content: message.trim(),
      type: 'text',
    });

    setMessage('');
    handleTypingStop();
  };
  console.log("socketService", socketService)
  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-800 bg-black px-6 py-4">
      <div className="flex items-center space-x-3 rounded-full border border-gray-800 bg-gray-900 px-4 py-2.5">
        <input
          type="text"
          value={message}
          onChange={event => setMessage(event.target.value)}
          onFocus={handleTypingStart}
          onBlur={handleTypingStop}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event as unknown as React.FormEvent);
            }
          }}
          placeholder="Type a message..."
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
        />
        <button
          type="submit"
          className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-back disabled:opacity-50"
          disabled={!message.trim()}
        >
          Send
        </button>
      </div>
    </form>
  );
}



