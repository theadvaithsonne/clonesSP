'use client';

import { useEffect, useState } from 'react';

import ChatArea from './components/chat/ChatArea';
import { useOnlineUsers } from './hooks/useOnlineUsers';
import { useTypingUsers } from './hooks/useTypingUsers';
import { chatAPI } from './lib/chat-api';
import { Conversation } from './lib/types';
import { toast } from "sonner"
import Cookies from 'js-cookie'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Trash, Users } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogFooter, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const API_URL = "https://uatapi.garage.app"

async function removeMemberFromTaskroomChat(conversationId: string, userId: string) {
  const token = localStorage.getItem("garage_tok")
  const response = await fetch(
    `${API_URL}/api/chat/conversations/${conversationId}/participants/${userId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  )
  if (!response.ok) throw new Error('Failed to remove member')
  return response.json()
}

export default function TaskroomGroupChat({ conversationId, currentUser, employees }) {

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  useOnlineUsers();
  useTypingUsers();

  useEffect(() => {
    const loadConversation = async () => {
      if (!conversationId) return;
      try {
        setLoading(true);
        const data = await chatAPI.getConversation(conversationId);
        setConversation(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load conversation', err);
        setError('Unable to load group chat.');
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [conversationId]); // Add conversationId to deps

  const handleRemoveMember = async (userId: string) => {
    if (!conversationId) return
    setIsRemoving(userId)
    try {
      await removeMemberFromTaskroomChat(conversationId, userId)
      const data = await chatAPI.getConversation(conversationId);
      setConversation(data);
      toast.success("Member removed")
    } catch {
      toast.error("Failed to remove member")
    } finally {
      setIsRemoving(null)
    }
  }
  const getUserById = (id: string) => employees.find(u => u.id === id);
  const getEmployeeName = (id: string) => getUserById(id)?.name || id;
  const participants = conversation?.participants ?? [];
  const memberEntries = participants.filter((participant: any) => participant?._id);
  const otherMembers = memberEntries.filter((participant: any) => participant._id !== currentUser);
  const memberCount = memberEntries.length;
  const currentMember = memberEntries.find((participant: any) => participant._id === currentUser);

  // Early returns for auth/loading/error
  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-sm text-muted-foreground">
          Sign in to view the group chat.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="text-sm text-muted-foreground">Loading group chat…</p>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-500">{error ?? 'Group chat not available.'}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              chatAPI
                .getConversation(conversationId)
                .then(data => {
                  setConversation(data);
                  setError(null);
                })
                .catch(err => {
                  console.error('Retry failed', err);
                  setError('Unable to load group chat.');
                })
                .finally(() => setLoading(false));
            }}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Now safe: conversationId is guaranteed to be string
  return (
    <div className="flex h-full w-full flex-col overflow-hidden  p-3 sm:p-5">
      <div className="flex h-full min-h-0 flex-1 gap-3 sm:gap-4">
        <div className="flex min-h-0 flex-1">
          <ChatArea conversationId={conversationId} currentUser={currentUser} />
        </div>

        <aside className="hidden h-full w-[260px] flex-col overflow-hidden rounded-2xl border border-[#e5e7eb29]  shadow-lg backdrop-blur-sm md:flex xl:w-[300px]">
          <div className="border-b border-[#e5e7eb29]  px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Team Members</h3>
                  <p className="text-xs text-muted-foreground">{memberCount} member{memberCount === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
                Active chat
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {currentMember && (
              <div className="mb-4 rounded-xl border border-[#e5e7eb29] bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-11 w-11 shadow-sm">
                      <AvatarFallback className="bg-emerald-500/10 text-sm font-semibold text-emerald-600">
                        {getEmployeeName(currentUser).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{getEmployeeName(currentUser)}</p>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">You</span>
                    </div>
                    <p className="text-xs text-slate-500">Currently signed in</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {otherMembers.length === 0 && (
                <div className="rounded-xl border border-dashed border-border/60 bg-slate-50/80 p-4 text-center text-sm text-muted-foreground">
                  No other members yet. Invite teammates to collaborate in real time.
                </div>
              )}

              {otherMembers.map((user: any) => {
                const displayName = user?.name || getEmployeeName(user?._id);
                const initials = displayName?.slice(0, 2)?.toUpperCase() || 'TM';

                return (
                  <div
                    key={user._id}
                    className="group relative flex items-center gap-3 rounded-xl border border-[#e5e7eb29] bg-card  p-3 shadow-sm transition "
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10 shadow-sm">
                        <AvatarFallback
                          className="text-sm font-semibold text-slate-700"
                          style={{ backgroundColor: user.color || getUserById(user._id)?.color || '#e2e8f0' }}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-1 -right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-black shadow-sm" />
                    </div>

                    <div className="flex-1 pr-10">
                      <p className="text-sm font-medium text-whit3e">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{user.email ?? 'Member'}</p>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isRemoving === user._id}
                          className="absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white text-slate-500 shadow-sm transition group-hover:text-red-500"
                        >
                          {isRemoving === user._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {displayName}?</AlertDialogTitle>
                          <AlertDialogDescription>They will immediately lose access to this chat history.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleRemoveMember(user._id)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#e5e7eb29] bg-card px-5 py-3 text-xs text-muted-foreground">
            Manage members to control who can follow along with this conversation.
          </div>
        </aside>
      </div>
    </div>
  );
}
