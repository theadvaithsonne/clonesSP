'use client';

import { useEffect, useState } from 'react';
import { socketService } from '../lib/socket-service';

interface OnlineUser {
  userId: string;
  lastSeen: Date;
}

export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleOnlineUsers = (users: OnlineUser[]) => {
      const userIds = new Set(users.map(u => u.userId));
      setOnlineUsers(userIds);
    };

    const handleUserOnline = (data: { userId: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.add(data.userId);
        return next;
      });
    };

    const handleUserOffline = (data: { userId: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socketService.on('online_users', handleOnlineUsers);
    socketService.on('user_online', handleUserOnline);
    socketService.on('user_offline', handleUserOffline);

    return () => {
      socketService.off('online_users', handleOnlineUsers);
      socketService.off('user_online', handleUserOnline);
      socketService.off('user_offline', handleUserOffline);
    };
  }, []);

  const isUserOnline = (userId: string) => onlineUsers.has(userId);

  return {
    onlineUsers,
    isUserOnline,
  };
};