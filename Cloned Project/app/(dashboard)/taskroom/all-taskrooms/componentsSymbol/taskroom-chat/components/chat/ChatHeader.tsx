'use client';

import { useEffect, useRef, useState } from 'react';
import { chatAPI } from '../../lib/chat-api';
import { Conversation, User } from '../../lib/types';
import LoadingSpinner from '../shared/LoadingSpinner';
import UserAvatar from '../shared/UserAvatar';

interface ChatHeaderProps {
  conversationId: string;
  currentUser: string;
}

export default function ChatHeader({ conversationId, currentUser }: ChatHeaderProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        const data = await chatAPI.getConversation(conversationId);
        setConversation(data);
      } catch (error) {
        console.error('Failed to fetch conversation', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [conversationId]);
  console.log("conversation", conversation)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  if (loading) {
    return (
      <div className="border-b border-gray-800 bg-black px-6 py-4">
        <div className="flex items-center space-x-3">
          <LoadingSpinner size="sm" />
          <span className="text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  const headerInfo = (() => {
    if (!conversation) {
      return { name: 'Group Chat', subtitle: '', avatar: undefined };
    }

    if (conversation.type === 'group') {
      return {
        name: conversation.name || 'Group Chat',
        subtitle: `${conversation.participants.length} members`,
        avatar: conversation.avatar,
      };
    }

    const otherParticipant = conversation.participants.find(p => p._id !== currentUser);
    return {
      name: otherParticipant?.name || 'Direct Message',
      subtitle: otherParticipant?.isOnline ? 'Online' : 'Offline',
      avatar: otherParticipant?.avatar,
      isOnline: otherParticipant?.isOnline,
    };
  })();

  return (
    <div className="border-b border-gray-800 bg-black px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserAvatar
            src={headerInfo.avatar}
            name={headerInfo.name}
            size="md"
            showOnline={conversation?.type === 'direct'}
            isOnline={headerInfo.isOnline}
            userId={conversation?.type === 'direct' ? otherParticipant?._id : undefined}
          />
          <div>
            <h2 className="text-lg font-semibold text-white">{headerInfo.name}</h2>
            <p className="text-sm text-gray-400">{headerInfo.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-800"
            onClick={() => setShowMenu(prev => !prev)}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showMenu && (
            <div ref={menuRef} className="absolute right-6 top-16 w-48 rounded-md border border-gray-800 bg-[#1e1e2d] shadow-lg z-10">
              <div className="py-1 text-sm text-gray-400">
                <div className="px-4 py-2">Group chat actions coming soon</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
