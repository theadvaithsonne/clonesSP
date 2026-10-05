'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { useLocalParticipant } from '@livekit/components-react';
import type { ReceivedChatMessage } from '@livekit/components-react';

interface MeetChatPanelProps {
  isOpen: boolean;
  onClose(): void;
  chatMessages: ReceivedChatMessage[];
  onSend(message: string): void;
  isSending: boolean;
}

export default function MeetChatPanel({ isOpen, onClose, chatMessages, onSend, isSending }: MeetChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { localParticipant } = useLocalParticipant();

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  if (!isOpen) return null;

  function handleSend() {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  }

  function formatTime(timestamp: number) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="fixed bottom-24 right-6 z-[10000] flex w-80 flex-col rounded-2xl border border-[#2a2a35] bg-[#0e0e12]/95 shadow-2xl backdrop-blur-md"
      style={{ height: '384px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a35] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">In-call Chat</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
            <MessageSquare className="h-8 w-8 opacity-30" />
            <p className="text-xs">No messages yet</p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isOwn = msg.from?.identity === localParticipant.identity;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                style={{ maxWidth: '85%' }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] text-gray-400">
                    {isOwn ? 'You' : msg.from?.name || msg.from?.identity || 'Unknown'}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`rounded-2xl px-3 py-1.5 text-sm break-words ${
                    isOwn
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-[#1e1e28] text-gray-200 rounded-bl-md'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-[#2a2a35] px-3 py-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-[#2a2a35] bg-[#1a1a24] px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
