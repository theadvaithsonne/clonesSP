'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useOfficeAuth } from '@/context/office/AuthContext';
import { useOfficeSocket } from '@/context/office/SocketContext';
import { officeApi as api } from '@/lib/office-api';
import React from 'react';
import { linkifyText } from '@/lib/linkify';

interface Member { _id: string; name: string; status?: string }

interface DmMessage {
  _id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
}

const RECORDING_RE = /^(.*?)\s*\{\{recording:([a-f0-9]+)\}\}$/;

function RecordingBubble({ text, recordingId }: { text: string; recordingId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { data } = await api.get(`/api/recording/${recordingId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${recordingId}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed — recording may still be processing');
    }
    setDownloading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <span>{text}</span>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#1D9E75] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#25c28b] disabled:opacity-50"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
        </svg>
        {downloading ? 'Downloading...' : 'Download Recording'}
      </button>
    </div>
  );
}

const ChatPanel = ({
  member,
  onClose,
  onCall,
  isFullScreen = false,
}: {
  member: Member;
  onClose(): void;
  onCall?(member: Member): void;
  isFullScreen?: boolean;
}) => {
  const { user } = useOfficeAuth();
  const { socket } = useOfficeSocket();
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation history
  useEffect(() => {
    setLoading(true);
    setMessages([]); // Clear previous messages
    api.get(`/api/messages/${member._id}`)
      .then(({ data }) => setMessages(data.messages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [member]);

  // Real-time DM delivery
  useEffect(() => {
    if (!socket) return;
    const handleDm = (msg: DmMessage) => {
      if (
        (msg.from === member._id && msg.to === user?._id) ||
        (msg.from === user?._id && msg.to === member._id)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };
    socket.on('dm_message', handleDm);
    return () => { socket.off('dm_message', handleDm); };
  }, [socket, member._id, user?._id]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open
  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = useCallback(() => {
    const content = input.trim();
    if (!content || !socket) return;
    socket.emit('dm_send', { toId: member._id, content });
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [input, socket, member._id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Group messages by sender for Teams-style grouping
  const grouped = messages.reduce<Array<{ senderId: string; msgs: DmMessage[] }>>(
    (acc, msg) => {
      const last = acc[acc.length - 1];
      if (last && last.senderId === msg.from) {
        last.msgs.push(msg);
      } else {
        acc.push({ senderId: msg.from, msgs: [msg] });
      }
      return acc;
    },
    []
  );

  return (
    <>
      {!isFullScreen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside className={`flex flex-col bg-[#1a1a1a] border-l border-[#3a3a3a] ${
        isFullScreen
          ? 'relative flex-1 w-full'
          : 'fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] shadow-2xl'
      }`}>
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[#3a3a3a] bg-[#2d2d2d] px-4 py-4">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#6264a7] to-[#4a4d7f] text-sm font-bold text-white shadow-md">
              {member.name.charAt(0).toUpperCase()}
            </div>
            {member.status && member.status !== 'offline' && (
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#2d2d2d] bg-[#92c353]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{member.name}</p>
            <p className="text-xs text-[#9d9d9d] capitalize">{member.status ?? 'offline'}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onCall && member._id !== user?._id && (
              <button
                onClick={() => onCall(member)}
                title="Audio call"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#1D9E75] transition hover:bg-[#1D9E75] hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            )}
            {!isFullScreen && (
              <button
                onClick={onClose}
                title="Close chat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#9d9d9d] transition hover:bg-[#3a3a3a] hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Message list ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex flex-1 items-center justify-center pt-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1D9E75] border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 pt-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#6264a7]/30 to-[#1D9E75]/30 text-4xl">
                💬
              </div>
              <div>
                <p className="text-sm font-semibold text-[#d4d4d4]">
                  {member._id === user?._id ? 'Welcome to your chat!' : `Say hello to ${member.name}`}
                </p>
                <p className="mt-1 text-xs text-[#5a5a5a]">
                  {member._id === user?._id
                    ? 'This is where you can access all your conversations'
                    : 'Messages are visible only to you and ' + member.name}
                </p>
              </div>
            </div>
          ) : (
            grouped.map((group, gi) => {
              const isMe = group.senderId === user?._id;
              const senderName = isMe ? (user?.name ?? 'You') : member.name;
              const initial = senderName.charAt(0).toUpperCase();
              return (
                <div key={gi} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white self-end ${isMe ? 'bg-gradient-to-br from-[#6264a7] to-[#4a4d7f]' : 'bg-gradient-to-br from-[#1D9E75] to-[#137855]'}`}>
                    {initial}
                  </div>

                  {/* Bubble group */}
                  <div className={`flex max-w-[75%] flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="px-2 text-[11px] font-medium text-[#5a5a5a]">{senderName}</span>
                    {group.msgs.map((msg, mi) => {
                      const recMatch = msg.content.match(RECORDING_RE);
                      return (
                        <div
                          key={msg._id ?? mi}
                          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm transition hover:shadow-md ${
                            isMe
                              ? 'bg-[#6264a7] text-white rounded-tr-sm'
                              : 'bg-[#2d2d2d] text-[#d4d4d4] rounded-tl-sm'
                          } ${mi === 0 ? '' : isMe ? 'rounded-tr-2xl' : 'rounded-tl-2xl'}`}
                          style={{ maxWidth: '100%', wordBreak: 'break-word' }}
                        >
                          {recMatch ? (
                            <RecordingBubble text={recMatch[1]} recordingId={recMatch[2]} />
                          ) : (
                            linkifyText(msg.content, { isOwnMessage: isMe })
                          )}
                        </div>
                      );
                    })}
                    <span className="px-2 text-[9px] text-[#5a5a5a]">
                      {new Date(group.msgs[group.msgs.length - 1].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input area ── */}
        <div className="shrink-0 border-t border-[#3a3a3a] bg-[#2d2d2d] px-4 py-4">
          <div className="flex items-end gap-2.5 rounded-2xl border border-[#3a3a3a] bg-[#1a1a1a] px-4 py-3 transition focus-within:border-[#6264a7] focus-within:ring-1 focus-within:ring-[#6264a7]/30">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={member._id === user?._id ? 'You can save notes here...' : `Message ${member.name}`}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-[#d4d4d4] placeholder-[#5a5a5a] outline-none"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              title="Send (Enter)"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6264a7] text-white transition hover:bg-[#7b83c7] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,0.9 1.77946707,1.4429026 C0.994623095,2.0766479 0.837654326,3.0192322 1.15159189,3.97181655 L3.03521743,10.4128095 C3.03521743,10.5699069 3.19218622,10.7270043 3.50612381,10.7270043 L16.6915026,11.5124912 C16.6915026,11.5124912 17.1624089,11.5124912 17.1624089,12.0553938 C17.1624089,12.5982963 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[9px] text-[#5a5a5a]">Enter to send · Shift+Enter for new line</p>
        </div>
      </aside>
    </>
  );
}

export default ChatPanel;
