'use client';

import { Message, User } from '../../lib/types';
import UserAvatar from '../shared/UserAvatar';

interface MessageItemProps {
  message: Message;
  currentUser: string;

}

export default function MessageItem({ message, currentUser }: MessageItemProps) {
  const isOwnMessage = message.senderId === currentUser;
  const timestamp = new Date(message.timestamp);
  const formattedTime = Number.isNaN(timestamp.getTime())
    ? ''
    : timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="max-w-md rounded-lg bg-gray-900 border border-gray-800 px-4 py-2 text-center text-sm text-gray-400">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full gap-3 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      {!isOwnMessage && (
        <UserAvatar
          name={message.sender?.name || 'User'}
          src={message.sender?.avatar}
          size="sm"
          userId={message.sender?._id || message.senderId}
        />
      )}

      <div className={`flex max-w-[70%] flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {!isOwnMessage && (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium text-white">{message.sender?.name || 'User'}</span>
            {formattedTime && <span className="text-xs text-gray-500">{formattedTime}</span>}
          </div>
        )}

        <div
          className={`rounded-3xl border px-4 py-2 text-sm leading-relaxed shadow-sm transition ${isOwnMessage
              ? 'border-emerald-500/30 bg-emerald-500 text-white shadow-emerald-100/50'
              : 'border-gray-800 bg-[#1e1e2d] text-gray-300'
            }`}
        >
          {message.content}
        </div>

        {formattedTime && (
          <div
            className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${isOwnMessage ? 'text-emerald-300' : 'text-gray-500'
              }`}
          >
            <span>{formattedTime}</span>
            {isOwnMessage && <span className="text-xs font-semibold tracking-tight">✓✓</span>}
          </div>
        )}
      </div>

      {/* {isOwnMessage  && <UserAvatar name={currentUser} src={currentUser} size="sm" />} */}
    </div>
  );
}
