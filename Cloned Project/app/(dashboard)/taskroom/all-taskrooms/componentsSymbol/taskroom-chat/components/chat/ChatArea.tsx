'use client';

import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function ChatArea({ conversationId, currentUser }) {
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-[#e5e7eb29] shadow-lg">
      <div className="border-b border-[#e5e7eb29] to-slate-100">
        <ChatHeader conversationId={conversationId} currentUser={currentUser} />
      </div>

      <div className="flex-1 overflow-hidden bg-white/70">
        <MessageList conversationId={conversationId} currentUser={currentUser} />
      </div>

      <div >
        <div id="typing-indicator-container" className="min-h-[12px]" />
      </div>

      <div className=" bg-[#0e0e12] p-4">
        <MessageInput conversationId={conversationId} currentUser={currentUser} />
      </div>
    </div>
  );
}