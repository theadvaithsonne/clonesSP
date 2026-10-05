'use client';

import { TypingUser } from '../../lib/types';

interface TypingIndicatorProps {
  conversationId: string;
  typingUsers: TypingUser[];
}

export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) {
    return null;
  }

  const typingNames = typingUsers.map(user => user.userName);
  const typingText =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length === 2
        ? `${typingNames[0]} and ${typingNames[1]} are typing...`
        : `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;

  return (
    <div className="px-4 py-2 text-sm text-muted-foreground">
      <div className="flex items-center space-x-2">
        <span className="flex space-x-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0.2s]" />
        </span>
        <span>{typingText}</span>
      </div>
    </div>
  );
}



