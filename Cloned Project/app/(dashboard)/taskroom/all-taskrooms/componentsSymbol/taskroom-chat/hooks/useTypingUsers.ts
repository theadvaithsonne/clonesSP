'use client';

import { useEffect, useState } from 'react';
import { socketService } from '../lib/socket-service';
import { TypingUser } from '../lib/types';

export const useTypingUsers = () => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    const handleUserTyping = (data: TypingUser & { isTyping: boolean }) => {
      setTypingUsers(prev => {
        const filtered = prev.filter(
          user => user.userId !== data.userId || user.conversationId !== data.conversationId,
        );

        if (data.isTyping) {
          return [
            ...filtered,
            {
              userId: data.userId,
              userName: data.userName,
              conversationId: data.conversationId,
            },
          ];
        }

        return filtered;
      });
    };

    socketService.on('user_typing', handleUserTyping);

    return () => {
      socketService.off('user_typing', handleUserTyping);
    };
  }, []);

  const getTypingUsersForConversation = (conversationId: string) => {
    return typingUsers.filter(user => user.conversationId === conversationId);
  };

  return {
    typingUsers,
    getTypingUsersForConversation,
  };
};



